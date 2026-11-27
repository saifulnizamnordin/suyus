// Merges a portfolio pull request automatically when it only changes the author's own files and passes
// every rule. Run by .github/workflows/automerge.yml after the `build` and `validate` checks finish.
//
// A PR is merged when all of these hold:
//   - it's open, not a draft, targets the default branch, and its head is still the commit that was checked
//   - the `build` and `validate` checks both passed on that commit
//   - every changed file is the author's own: src/content/portfolios/<author>.md or src/showcases/<author>/…
//     (nothing deleted, nothing else touched)
//   - the portfolio's About text is plain Markdown (submission-rules.mjs)
//   - showcase code passes the strict rules: it can only draw inside its own box in the 02 Portfolio section
//     (no window/document, storage, other sites, <head> tags, fixed positioning or tricks to hide those)
//   - sizes are within LIMITS
// Otherwise the PR gets a `needs-review` label and a comment saying why, and waits for a maintainer.
//
// SECURITY: this runs with a write token, so it never checks out or runs the PR's code. It reads the
// changed files through the API as plain text and only applies the pattern rules to them.
//
// Env: GITHUB_TOKEN, REPO (owner/name), HEAD_SHA, AUTOMERGE_SHOWCASES ("false" = showcases always wait for review)
// Testing: DRY_RUN=1 PR_NUMBER=12 checks that PR (any state) and prints the verdict without writing anything.
import { extname } from "node:path"
import {
  IMAGE_EXTENSIONS,
  LIMITS,
  PORTFOLIO_DIR,
  SHOWCASE_DIR,
  SHOWCASE_EXTENSIONS,
  SHOWCASE_NAME_RE,
  isOwnPath,
  markdownProblems,
  showcaseCodeProblems,
  showcaseStrictProblems,
} from "./submission-rules.mjs"

const { GITHUB_TOKEN, REPO, AUTOMERGE_SHOWCASES = "", DRY_RUN, PR_NUMBER } = process.env
let { HEAD_SHA } = process.env
const REQUIRED_CHECKS = ["build", "validate"]
const MARKER = "<!-- suyus-automerge -->"
const LABEL = "needs-review"

async function api(path, { method = "GET", body, accept = "application/vnd.github+json" } = {}) {
  if (DRY_RUN && method !== "GET") {
    console.log(`[dry run] would ${method} ${path}`)
    return { status: 200, ok: true, data: {} }
  }
  const res = await fetch(path.startsWith("http") ? path : `https://api.github.com${path}`, {
    method,
    headers: {
      Accept: accept,
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = text
  try {
    data = JSON.parse(text)
  } catch {}
  return { status: res.status, ok: res.ok, data }
}

async function all(path) {
  const items = []
  for (let page = 1; page <= 30; page++) {
    const res = await api(`${path}${path.includes("?") ? "&" : "?"}per_page=100&page=${page}`)
    if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status} ${JSON.stringify(res.data)}`)
    const list = Array.isArray(res.data) ? res.data : res.data.check_runs ?? []
    items.push(...list)
    if (list.length < 100) break
  }
  return items
}

const log = (...a) => console.log(...a)

// 1. The open PR whose head is the commit that was just checked.
const repo = (await api(`/repos/${REPO}`)).data
const pr =
  DRY_RUN && PR_NUMBER
    ? (await api(`/repos/${REPO}/pulls/${PR_NUMBER}`)).data
    : (await all(`/repos/${REPO}/pulls?state=open`)).find((p) => p.head.sha === HEAD_SHA)
if (pr && DRY_RUN && PR_NUMBER) HEAD_SHA = pr.head.sha
if (!pr) {
  log(`No open pull request has ${HEAD_SHA} as its head (already merged, closed or pushed to again). Nothing to do.`)
  process.exit(0)
}
const author = pr.user.login.toLowerCase()
log(`PR #${pr.number} by @${pr.user.login}: ${pr.title}`)

// 2. Which files changed. PRs that aren't portfolio submissions (site changes) are left alone, quietly.
const files = await all(`/repos/${REPO}/pulls/${pr.number}/files`)
const isSubmissionPath = (p) => p.startsWith(`${PORTFOLIO_DIR}/`) || p.startsWith(`${SHOWCASE_DIR}/`)
if (!files.some((f) => isSubmissionPath(f.filename))) {
  log("Not a portfolio submission (no portfolio or showcase files). Leaving it for a maintainer.")
  process.exit(0)
}

// 3. Both required checks passed on this exact commit (the newest run of each counts).
const runs = await all(`/repos/${REPO}/commits/${HEAD_SHA}/check-runs`)
for (const name of REQUIRED_CHECKS) {
  const latest = runs.filter((r) => r.name === name).sort((a, b) => b.id - a.id)[0]
  if (!latest || latest.status !== "completed") {
    log(`Check \`${name}\` hasn't finished yet; the job runs again when it does.`)
    process.exit(0)
  }
  if (latest.conclusion !== "success") {
    log(`Check \`${name}\` didn't pass (${latest.conclusion}). Not merging; the check itself explains why.`)
    process.exit(0)
  }
}

// 4. The rules.
const reasons = []
const why = (path, msg) => reasons.push(path ? `\`${path}\`: ${msg}` : msg)

if (pr.draft) why("", "the pull request is a draft")
if (pr.base.ref !== repo.default_branch) why("", `it targets \`${pr.base.ref}\`, not \`${repo.default_branch}\``)
if (pr.user.type !== "User") why("", "it was opened by a bot or app account")
if (files.length > LIMITS.files) why("", `it changes ${files.length} files (the limit is ${LIMITS.files})`)

const headRepo = pr.head.repo?.full_name
if (!headRepo) why("", "the fork it comes from no longer exists")

async function readFile(path) {
  const meta = await api(`/repos/${headRepo}/contents/${encodeURI(path)}?ref=${HEAD_SHA}`)
  if (!meta.ok) throw new Error(`can't read ${path}: ${meta.status}`)
  const size = meta.data.size
  if (size > LIMITS.imageBytes) return { size, text: null }
  const raw = await api(`/repos/${headRepo}/contents/${encodeURI(path)}?ref=${HEAD_SHA}`, { accept: "application/vnd.github.raw+json" })
  return { size, text: typeof raw.data === "string" ? raw.data : JSON.stringify(raw.data) }
}

let total = 0
for (const f of headRepo ? files : []) {
  const path = f.filename
  if (!isOwnPath(path, author)) {
    why(path, `@${pr.user.login} can only change \`${PORTFOLIO_DIR}/${author}.md\` and \`${SHOWCASE_DIR}/${author}/\``)
    continue
  }
  if (f.status === "removed") {
    why(path, "deleted files need a maintainer")
    continue
  }
  if (f.status === "renamed" && !isOwnPath(f.previous_filename ?? "", author)) {
    why(path, `renamed from \`${f.previous_filename}\`, which isn't yours`)
    continue
  }

  const { size, text } = await readFile(path)
  total += size
  const ext = extname(path).toLowerCase()

  if (path.startsWith(`${PORTFOLIO_DIR}/`)) {
    const body = /^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/.exec(text ?? "")?.[1]
    if (body === undefined) why(path, "missing its frontmatter")
    else for (const problem of markdownProblems(body)) why(path, problem)
    continue
  }

  // A showcase file.
  if (AUTOMERGE_SHOWCASES === "false") {
    why(path, "showcases are set to always wait for a maintainer (repository variable AUTOMERGE_SHOWCASES)")
    continue
  }
  const [, , , name, ...rest] = path.split("/")
  if (!SHOWCASE_NAME_RE.test(name ?? "") || rest.length === 0) why(path, "isn't inside a valid showcase folder")
  if (rest.some((part) => part.startsWith("."))) why(path, "hidden files aren't allowed")
  if (!SHOWCASE_EXTENSIONS.has(ext)) {
    why(path, `file type \`${ext}\` isn't allowed`)
  } else if (IMAGE_EXTENSIONS.has(ext)) {
    if (size > LIMITS.imageBytes) why(path, `image is ${Math.round(size / 1000)} KB (the limit is ${LIMITS.imageBytes / 1000} KB)`)
  } else if (size > LIMITS.codeBytes) {
    why(path, `file is ${Math.round(size / 1000)} KB (the limit is ${LIMITS.codeBytes / 1000} KB)`)
  } else if (ext === ".svg") {
    // Served from suy.us as a file, so it could run script if opened directly.
    if (/<\s*(?:script|foreignObject|iframe|embed|object)\b|\bon[a-z]+\s*=|javascript:|(?:href|src)\s*=\s*["']\s*(?:https?:)?\/\//i.test(text)) {
      why(path, "SVG contains script, event handlers or external links")
    }
  } else if (ext === ".ts" || ext === ".tsx") {
    for (const problem of [...showcaseCodeProblems(text), ...showcaseStrictProblems(text)]) why(path, problem)
  }
}
if (total > LIMITS.totalBytes) why("", `the changed files add up to ${Math.round(total / 1000)} KB (the limit is ${LIMITS.totalBytes / 1000} KB)`)

// 5. Merge, or explain.
async function upsertComment(body) {
  const comments = await all(`/repos/${REPO}/issues/${pr.number}/comments`)
  const mine = comments.find((c) => c.body?.startsWith(MARKER))
  const full = `${MARKER}\n${body}`
  if (mine) await api(`/repos/${REPO}/issues/comments/${mine.id}`, { method: "PATCH", body: { body: full } })
  else await api(`/repos/${REPO}/issues/${pr.number}/comments`, { method: "POST", body: { body: full } })
}

if (reasons.length) {
  log(`Not merging automatically:\n- ${reasons.join("\n- ")}`)
  await api(`/repos/${REPO}/issues/${pr.number}/labels`, { method: "POST", body: { labels: [LABEL] } })
  await upsertComment(
    `**This pull request needs a maintainer review** before it can be merged, because:\n\n` +
      reasons.map((r) => `- ${r}`).join("\n") +
      `\n\nPull requests that only change your own portfolio file (and showcases that stay inside their own section) are merged automatically. See SUBMISSION.md.`
  )
  process.exit(0)
}

const merged = await api(`/repos/${REPO}/pulls/${pr.number}/merge`, {
  method: "PUT",
  body: { merge_method: "squash", sha: HEAD_SHA, commit_title: `${pr.title} (#${pr.number})` },
})
if (!merged.ok) {
  console.error(`Merge failed (${merged.status}): ${JSON.stringify(merged.data)}`)
  process.exit(1)
}
log(`Merged #${pr.number}.`)
await api(`/repos/${REPO}/issues/${pr.number}/labels/${LABEL}`, { method: "DELETE" })

// A merge made with the workflow's token doesn't trigger the push workflow, so start the deploy here.
const deploy = await api(`/repos/${REPO}/actions/workflows/deploy.yml/dispatches`, {
  method: "POST",
  body: { ref: repo.default_branch },
})
log(deploy.ok ? "Deploy started." : `Couldn't start the deploy (${deploy.status}); run "Deploy to GitHub Pages" by hand.`)

await upsertComment(
  `Merged automatically: every change is in @${pr.user.login}'s own files and all checks passed. ` +
    `Your page will be live at https://suy.us/p/${author} in a minute or two.`
)
