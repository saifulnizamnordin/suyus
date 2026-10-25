// Shared helpers for the portfolio maintenance scripts.
import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { basename, join } from "node:path"
import YAML from "yaml"

export const PORTFOLIO_DIR = "src/content/portfolios"
export const USERNAME_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

/** Reads a portfolio file. `doc` is a YAML Document, so edits keep comments and formatting. */
export function readPortfolio(path) {
  const match = readFileSync(path, "utf8").match(FRONTMATTER_RE)
  if (!match) throw new Error(`${path}: missing --- frontmatter --- block`)
  const doc = YAML.parseDocument(match[1])
  if (doc.errors.length) throw new Error(`${path}: invalid YAML frontmatter: ${doc.errors[0].message}`)
  return { path, username: basename(path, ".md"), doc, body: match[2] }
}

export function writePortfolio(path, { doc, body }) {
  writeFileSync(path, `---\n${doc.toString({ lineWidth: 0, flowCollectionPadding: false })}---\n${body}`)
}

export function listPortfolios() {
  return readdirSync(PORTFOLIO_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(PORTFOLIO_DIR, f))
}

/** GitHub REST call. Returns null on 404, throws on anything else that isn't OK. */
export async function github(path) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`
  const res = await fetch(`https://api.github.com${path}`, { headers })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GitHub API ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

/** Appends Markdown to the GitHub Actions job summary when running in CI. */
export function summary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + "\n", { flag: "a" })
}
