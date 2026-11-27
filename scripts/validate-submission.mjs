// Validates the files changed in a portfolio pull request (the `validate` check).
//
// Ownership (skipped for maintainers):
//   - contributors may only touch src/content/portfolios/<their-username>.md
//     and files under src/showcases/<their-username>/
//
// Portfolio files (src/content/portfolios/<username>.md):
//   - the file name is a valid, lowercase GitHub username and that account exists
//   - the `github` field matches the file name, and `githubId` (if set) matches the account
//   - the About text is plain Markdown: no HTML, no javascript:-style links
//
// Showcase files (src/showcases/<username>/<name>/…):
//   - folder names are valid, the showcase has an index.tsx with a default export
//   - only allowed file types and imports; no network calls or raw HTML injection
//   - the report also says whether the stricter auto-merge rules pass (see automerge.mjs); that part never fails
//
// Schema validation and "is every listed showcase present?" happen in `npm run build`.
// Env: BASE_SHA, PR_AUTHOR, AUTHOR_ASSOCIATION, GITHUB_TOKEN
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { basename, dirname, extname } from "node:path"
import { github, readPortfolio, summary } from "./lib.mjs"
import {
  PORTFOLIO_DIR,
  SHOWCASE_DIR,
  SHOWCASE_EXTENSIONS,
  SHOWCASE_NAME_RE,
  USERNAME_RE,
  isOwnPath,
  markdownProblems,
  showcaseCodeProblems,
  showcaseStrictProblems,
} from "./submission-rules.mjs"

const { BASE_SHA, PR_AUTHOR = "", AUTHOR_ASSOCIATION = "" } = process.env
const isMaintainer = ["OWNER", "MEMBER", "COLLABORATOR"].includes(AUTHOR_ASSOCIATION)
const author = PR_AUTHOR.toLowerCase()

const changedFiles = (filter) =>
  execFileSync("git", ["diff", "--name-only", `--diff-filter=${filter}`, `${BASE_SHA}...HEAD`], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)

const touched = changedFiles("ACDMR")
const present = new Set(changedFiles("ACMR"))

const errors = []
const ok = []
const review = [] // auto-merge notes, informational only
const fail = (path, msg) => errors.push(`- \`${path}\`: ${msg}`)

// 1. Ownership: contributors only touch their own portfolio file and showcase folder.
if (!isMaintainer) {
  for (const path of touched) {
    if (!isOwnPath(path, author)) {
      fail(path, `@${PR_AUTHOR} can only change \`${PORTFOLIO_DIR}/${author}.md\` and files under \`${SHOWCASE_DIR}/${author}/\``)
    }
  }
}

// 2. Portfolio files.
for (const path of [...present].filter((p) => p.startsWith(`${PORTFOLIO_DIR}/`))) {
  const username = basename(path, ".md")
  if (dirname(path) !== PORTFOLIO_DIR || extname(path) !== ".md") {
    fail(path, `portfolios must be Markdown files directly inside \`${PORTFOLIO_DIR}/\``)
    continue
  }
  if (!USERNAME_RE.test(username)) {
    fail(path, "file name must be your GitHub username in lowercase, e.g. `octocat.md`")
    continue
  }

  let portfolio
  try {
    portfolio = readPortfolio(path)
  } catch (e) {
    fail(path, e.message)
    continue
  }
  const { doc, body } = portfolio
  for (const problem of markdownProblems(body)) fail(path, problem)

  const account = await github(`/users/${username}`)
  if (!account) {
    fail(path, `no GitHub account named \`${username}\``)
    continue
  }
  if (doc.get("github") !== username) fail(path, `the \`github\` field must be \`${username}\` to match the file name`)
  const id = doc.get("githubId")
  if (id !== undefined && id !== account.id) {
    fail(path, `\`githubId\` is \`${id}\`, but @${account.login}'s account ID is \`${account.id}\`. Remove the field or fix it`)
  }
  if (!errors.some((e) => e.includes(`\`${path}\``))) ok.push(`- \`${path}\` → @${account.login}`)
}

// 3. Showcase files.
const showcaseFolders = new Set()
for (const path of [...present].filter((p) => p.startsWith(`${SHOWCASE_DIR}/`))) {
  const [, , username, name, ...rest] = path.split("/")
  if (!username || !name || rest.length === 0) {
    fail(path, `showcase files go in \`${SHOWCASE_DIR}/<username>/<showcase-name>/\``)
    continue
  }
  if (!USERNAME_RE.test(username)) {
    fail(path, "the folder after `src/showcases/` must be your GitHub username in lowercase")
    continue
  }
  if (!SHOWCASE_NAME_RE.test(name)) {
    fail(path, "showcase folder names must be lowercase-with-dashes, e.g. `pipeline-speedup`")
    continue
  }
  showcaseFolders.add(`${SHOWCASE_DIR}/${username}/${name}`)

  const ext = extname(path).toLowerCase()
  if (!SHOWCASE_EXTENSIONS.has(ext)) {
    fail(path, `file type \`${ext || basename(path)}\` isn't allowed in a showcase`)
    continue
  }
  if (ext !== ".ts" && ext !== ".tsx") continue

  const source = readFileSync(path, "utf8")
  for (const problem of showcaseCodeProblems(source)) fail(path, problem)
  for (const why of showcaseStrictProblems(source)) review.push(`- \`${path}\`: ${why}`)
}

for (const folder of showcaseFolders) {
  const index = `${folder}/index.tsx`
  if (!existsSync(index)) fail(folder, "a showcase needs an `index.tsx`")
  else if (!/export\s+default\b/.test(readFileSync(index, "utf8"))) fail(index, "must have a default export (your component)")
  else if (!errors.some((e) => e.includes(`\`${folder}/`))) ok.push(`- \`${folder}/\` → showcase`)
}

let report = "## Portfolio submission check\n\n"
if (!touched.length) report += "No files changed.\n"
if (ok.length) report += `**Passed**\n\n${ok.join("\n")}\n\n`
if (errors.length) report += `**Failed**\n\n${errors.join("\n")}\n\nSee SUBMISSION.md for the rules.\n\n`
if (showcaseFolders.size && !errors.length) {
  report += review.length
    ? `**Showcase needs a maintainer review** (it can't be merged automatically):\n\n${review.join("\n")}\n`
    : "Showcase code passes the auto-merge rules.\n"
}

console.log(report)
summary(report)
if (errors.length) process.exit(1)
