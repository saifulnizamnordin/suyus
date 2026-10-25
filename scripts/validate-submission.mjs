// Validates the portfolio files changed in a pull request.
//
// For every added or modified src/content/portfolios/<username>.md:
//   - the file name is a valid, lowercase GitHub username
//   - that GitHub account exists
//   - the `github` field matches the file name, and `githubId` (if set) matches the account
//   - the PR author is that account (maintainers may edit any file)
//
// Schema validation (required fields, URLs, …) happens in `npm run build`.
// Env: BASE_SHA, PR_AUTHOR, AUTHOR_ASSOCIATION, GITHUB_TOKEN
import { execFileSync } from "node:child_process"
import { existsSync } from "node:fs"
import { basename, dirname } from "node:path"
import { PORTFOLIO_DIR, USERNAME_RE, github, readPortfolio, summary } from "./lib.mjs"

const { BASE_SHA, PR_AUTHOR = "", AUTHOR_ASSOCIATION = "" } = process.env
const isMaintainer = ["OWNER", "MEMBER", "COLLABORATOR"].includes(AUTHOR_ASSOCIATION)
const author = PR_AUTHOR.toLowerCase()

const changed = execFileSync("git", ["diff", "--name-only", "--diff-filter=AMR", `${BASE_SHA}...HEAD`, "--", PORTFOLIO_DIR], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)

const errors = []
const ok = []

for (const path of changed) {
  const name = basename(path)
  const username = basename(path, ".md")
  const fail = (msg) => errors.push(`- \`${path}\`: ${msg}`)

  if (dirname(path) !== PORTFOLIO_DIR || !name.endsWith(".md")) {
    fail(`portfolios must be Markdown files directly inside \`${PORTFOLIO_DIR}/\``)
    continue
  }
  if (!USERNAME_RE.test(username)) {
    fail("file name must be your GitHub username in lowercase, e.g. `octocat.md`")
    continue
  }
  if (!existsSync(path)) continue

  let portfolio
  try {
    portfolio = readPortfolio(path)
  } catch (e) {
    fail(e.message)
    continue
  }
  const { doc } = portfolio

  const account = await github(`/users/${username}`)
  if (!account) {
    fail(`no GitHub account named \`${username}\``)
    continue
  }
  if (doc.get("github") !== username) {
    fail(`the \`github\` field must be \`${username}\` to match the file name`)
  }
  const id = doc.get("githubId")
  if (id !== undefined && id !== account.id) {
    fail(`\`githubId\` is \`${id}\`, but @${account.login}'s account ID is \`${account.id}\` — remove the field or fix it`)
  }
  if (author !== username && !isMaintainer) {
    fail(`this file belongs to @${account.login}, but the pull request was opened by @${PR_AUTHOR}. Submit your own portfolio only.`)
  }
  if (!errors.some((e) => e.includes(`\`${path}\``))) ok.push(`- \`${path}\` → @${account.login}`)
}

let report = "## Portfolio submission check\n\n"
if (!changed.length) report += "No portfolio files changed.\n"
if (ok.length) report += `**Passed**\n\n${ok.join("\n")}\n\n`
if (errors.length) report += `**Failed**\n\n${errors.join("\n")}\n\nSee SUBMISSION.md for the rules.\n`

console.log(report)
summary(report)
if (errors.length) process.exit(1)
