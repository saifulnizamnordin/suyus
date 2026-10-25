import { getCollection, type CollectionEntry } from "astro:content"

export type Portfolio = CollectionEntry<"portfolios">
export type PortfolioData = Portfolio["data"]
export type ExperienceItem = PortfolioData["experience"][number]
export type Role = ExperienceItem["roles"][number]

export function avatarUrl(username: string, size = 160) {
  return `https://github.com/${username}.png?size=${size}`
}

export function githubUrl(username: string) {
  return `https://github.com/${username}`
}

/** Active portfolios, sorted by name. The file name must match the `github` field. */
export async function getPortfolios(): Promise<Portfolio[]> {
  const all = await getCollection("portfolios")
  for (const entry of all) {
    if (entry.id !== entry.data.github) {
      throw new Error(
        `Portfolio file "${entry.id}.md" must be named after its github username ("${entry.data.github}.md").`
      )
    }
  }
  return all
    .filter((entry) => entry.data.status === "active")
    .sort((a, b) => a.data.name.localeCompare(b.data.name))
}
