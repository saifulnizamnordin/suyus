// Validates the files changed in a portfolio pull request.
//
// Ownership (skipped for maintainers):
//   - contributors may only touch src/content/portfolios/<their-username>.md
//     and files under src/showcases/<their-username>/
//
// Portfolio files (src/content/portfolios/<username>.md):
//   - the file name is a valid, lowercase GitHub username and that account exists
//   - the `github` field matches the file name, and `githubId` (if set) matches the account
//
// Showcase files (src/showcases/<username>/<name>/…):
//   - folder names are valid, the showcase has an index.tsx with a default export
//   - only allowed file types and imports; no network calls or raw HTML injection
//
// Schema validation and "is every listed showcase present?" happen in `npm run build`.
// These checks are a first pass — maintainers still review showcase code before merging.
// Env: BASE_SHA, PR_AUTHOR, AUTHOR_ASSOCIATION, GITHUB_TOKEN
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { basename, dirname, extname } from "node:path"
import { PORTFOLIO_DIR, SHOWCASE_DIR, USERNAME_RE, github, readPortfolio, summary } from "./lib.mjs"

const { BASE_SHA, PR_AUTHOR = "", AUTHOR_ASSOCIATION = "" } = process.env
const isMaintainer = ["OWNER", "MEMBER", "COLLABORATOR"].includes(AUTHOR_ASSOCIATION)
const author = PR_AUTHOR.toLowerCase()

const SHOWCASE_NAME_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHOWCASE_EXTENSIONS = new Set([".tsx", ".ts", ".json", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"])
const ALLOWED_IMPORTS = [/^react$/, /^lucide-react$/, /^@\/components\/ui\/[a-z-]+$/, /^@\/lib\/utils$/, /^\.\/[\w./-]+$/]
const FORBIDDEN = [
  [/\bfetch\s*\(/, "network requests (fetch)"],
  [/\bXMLHttpRequest\b/, "network requests (XMLHttpRequest)"],
  [/\bWebSocket\b|\bEventSource\b|\bsendBeacon\b/, "network connections"],
  [/\beval\s*\(|\bnew\s+Function\b/, "eval / new Function"],
  [/dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=/, "raw HTML injection"],
  [/document\.cookie/, "cookies"],
  [/\bimport\s*\(/, "dynamic imports"],
  [/\brequire\s*\(/, "require()"],
  [/<script\b|<iframe\b/i, "script or iframe tags"],
]

const changedFiles = (filter) =>
  execFileSync("git", ["diff", "--name-only", `--diff-filter=${filter}`, `${BASE_SHA}...HEAD`], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)

const touched = changedFiles("ACDMR")
const present = new Set(changedFiles("ACMR"))

const errors = []
const ok = []
const fail = (path, msg) => errors.push(`- \`${path}\`: ${msg}`)

// 1. Ownership: contributors only touch their own portfolio file and showcase folder.
if (!isMaintainer) {
  for (const path of touched) {
    const ownPortfolio = path === `${PORTFOLIO_DIR}/${author}.md`
    const ownShowcase = path.startsWith(`${SHOWCASE_DIR}/${author}/`)
    if (!ownPortfolio && !ownShowcase) {
      fail(
        path,
        `@${PR_AUTHOR} can only change \`${PORTFOLIO_DIR}/${author}.md\` and files under \`${SHOWCASE_DIR}/${author}/\``
      )
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
  const { doc } = portfolio

  const account = await github(`/users/${username}`)
  if (!account) {
    fail(path, `no GitHub account named \`${username}\``)
    continue
  }
  if (doc.get("github") !== username) fail(path, `the \`github\` field must be \`${username}\` to match the file name`)
  const id = doc.get("githubId")
  if (id !== undefined && id !== account.id) {
    fail(path, `\`githubId\` is \`${id}\`, but @${account.login}'s account ID is \`${account.id}\` — remove the field or fix it`)
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
  for (const [, spec] of source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)) {
    if (!ALLOWED_IMPORTS.some((re) => re.test(spec)) || spec.includes("..")) {
      fail(path, `import \`${spec}\` isn't allowed — see "Showcases" in SUBMISSION.md`)
    }
  }
  for (const [re, what] of FORBIDDEN) {
    if (re.test(source)) fail(path, `${what} aren't allowed in showcases`)
  }
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
if (errors.length) report += `**Failed**\n\n${errors.join("\n")}\n\nSee SUBMISSION.md for the rules.\n`
if (showcaseFolders.size && !errors.length) report += "Showcase code still needs a maintainer review before merging.\n"

console.log(report)
summary(report)
if (errors.length) process.exit(1)
