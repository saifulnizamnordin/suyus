import { getCollection, type CollectionEntry } from "astro:content"
import { countryOf, type DirectoryEntry } from "@/lib/directory"

export { avatarUrl, githubUrl } from "@/lib/directory"

export type Portfolio = CollectionEntry<"portfolios">
export type PortfolioData = Portfolio["data"]
export type ExperienceItem = PortfolioData["experience"][number]
export type Role = ExperienceItem["roles"][number]

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

/** Builds the searchable directory entry for a portfolio. */
export function toDirectoryEntry({ data }: Portfolio): DirectoryEntry {
  const skills = [...new Set([...data.skills.flatMap((g) => g.items), ...data.experience.flatMap((e) => e.skills)])]
  const companies = data.experience.map((e) => e.company)
  const titles = [...new Set(data.experience.flatMap((e) => e.roles.map((r) => r.title)))]
  return {
    github: data.github,
    name: data.name,
    headline: data.headline,
    role: data.role,
    location: data.location,
    country: countryOf(data.location),
    skills,
    companies,
    titles,
  }
}
