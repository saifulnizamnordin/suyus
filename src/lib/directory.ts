// Client-safe helpers for the portfolio directory (no astro:content imports, so islands can use them).

export function avatarUrl(username: string, size = 160) {
  return `https://github.com/${username}.png?size=${size}`
}

export function githubUrl(username: string) {
  return `https://github.com/${username}`
}

/** The slice of a portfolio the directory needs: small enough to ship to the browser for search. */
export type DirectoryEntry = {
  github: string
  name: string
  headline: string
  role?: string
  location?: string
  country?: string
  skills: string[]
  companies: string[]
  titles: string[]
}

export function countryOf(location?: string) {
  return location?.split(",").at(-1)?.trim() || undefined
}

export const normalize = (s: string) => s.toLocaleLowerCase().normalize("NFKD").replace(/\p{M}/gu, "")

/** Lower-cased text the search box matches against. Built in the browser to keep the page small. */
export function searchText(e: DirectoryEntry) {
  return normalize(
    [e.name, e.github, e.headline, e.role, e.location, ...e.skills, ...e.companies, ...e.titles].filter(Boolean).join(" | ")
  )
}

/** Every word in the query must appear somewhere in the text. */
export function matchesQuery(text: string, query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  return terms.every((t) => text.includes(t))
}

/** Most common values first, ties alphabetical. */
export function rankByFrequency(values: string[]) {
  const counts = new Map<string, number>()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }))
}
