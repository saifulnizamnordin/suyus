// Keeps portfolio files in sync with their GitHub accounts.
//
// Each portfolio is tracked by its numeric GitHub account ID (`githubId`), which never changes,
// so a renamed account can be followed to its new username:
//   - missing githubId   → looked up from the username and filled in
//   - account renamed    → file renamed, `github` updated, old name added to `previousUsernames`
//   - account deleted    → `status: inactive` (hidden from the site)
//   - account is back    → `status: active` again
//
// Changes are written to the working tree; the workflow turns them into a pull request.
// Usage: GITHUB_TOKEN=... node scripts/sync-usernames.mjs [--dry-run]
import { existsSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { PORTFOLIO_DIR, github, listPortfolios, readPortfolio, summary, writePortfolio } from "./lib.mjs"

const dryRun = process.argv.includes("--dry-run")
const changes = []

for (const path of listPortfolios()) {
  const portfolio = readPortfolio(path)
  const { doc, username } = portfolio
  const id = doc.get("githubId")
  const status = doc.get("status") ?? "active"

  const account = id ? await github(`/user/${id}`) : await github(`/users/${username}`)

  if (!account) {
    if (status !== "inactive") {
      doc.set("status", "inactive")
      changes.push(`- \`${username}\`: GitHub account not found — marked **inactive**`)
      if (!dryRun) writePortfolio(path, portfolio)
    }
    continue
  }

  let changed = false
  if (!id) {
    doc.set("githubId", account.id)
    changes.push(`- \`${username}\`: recorded GitHub account ID \`${account.id}\``)
    changed = true
  }
  if (status === "inactive") {
    doc.delete("status")
    changes.push(`- \`${username}\`: GitHub account is back — marked **active**`)
    changed = true
  }

  const login = account.login.toLowerCase()
  let target = path
  if (login !== username) {
    target = join(PORTFOLIO_DIR, `${login}.md`)
    if (existsSync(target)) {
      changes.push(`- \`${username}\`: renamed to \`${login}\` on GitHub, but \`${target}\` already exists — **needs manual review**`)
    } else {
      const previous = doc.get("previousUsernames")?.toJSON?.() ?? []
      doc.set("github", login)
      doc.set("previousUsernames", doc.createNode([...new Set([...previous, username])], { flow: true }))
      changes.push(`- \`${username}\` → \`${login}\`: GitHub username changed — file renamed, old address will redirect`)
      changed = true
    }
  }

  if (changed && !dryRun) {
    writePortfolio(path, portfolio)
    if (target !== path && !existsSync(target)) renameSync(path, target)
  }
}

const report = changes.length
  ? `## Portfolio username sync\n\n${changes.join("\n")}\n`
  : "## Portfolio username sync\n\nAll portfolios match their GitHub accounts. Nothing to change.\n"

console.log(report)
summary(report)
if (!dryRun) writeFileSync("sync-report.md", report)
