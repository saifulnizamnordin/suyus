import { useEffect, useMemo, useState } from "react"
import { Plus, Search, SlidersHorizontal, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import PortfolioCard from "@/components/PortfolioCard"
import { matchesQuery, rankByFrequency, searchText, type DirectoryEntry } from "@/lib/directory"
import { cn } from "@/lib/utils"

type Props = {
  entries: DirectoryEntry[]
  submissionUrl: string
}

const PAGE_SIZE = 24
const POPULAR_SKILLS = 16

// Filters live in the URL (?q=…&skill=…&country=…) so a search can be bookmarked or shared.
function readParams() {
  const params = new URLSearchParams(location.search)
  return { q: params.get("q") ?? "", skills: params.getAll("skill"), country: params.get("country") ?? "" }
}

function writeParams(q: string, skills: string[], country: string) {
  const params = new URLSearchParams()
  if (q.trim()) params.set("q", q.trim())
  for (const s of skills) params.append("skill", s)
  if (country) params.set("country", country)
  const query = params.toString()
  history.replaceState(null, "", query ? `?${query}` : location.pathname)
}

export default function Directory({ entries, submissionUrl }: Props) {
  const [query, setQuery] = useState("")
  const [skills, setSkills] = useState<string[]>([])
  const [country, setCountry] = useState("")
  const [showAllSkills, setShowAllSkills] = useState(false)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const p = readParams()
    setQuery(p.q)
    setSkills(p.skills)
    setCountry(p.country)
    setReady(true)
  }, [])

  useEffect(() => {
    if (!ready) return
    writeParams(query, skills, country)
    setVisible(PAGE_SIZE)
  }, [query, skills, country, ready])

  const texts = useMemo(() => new Map(entries.map((e) => [e.github, searchText(e)])), [entries])
  const skillOptions = useMemo(() => rankByFrequency(entries.flatMap((e) => e.skills)), [entries])
  const countryOptions = useMemo(
    () => rankByFrequency(entries.flatMap((e) => (e.country ? [e.country] : []))).sort((a, b) => a.value.localeCompare(b.value)),
    [entries]
  )

  const results = useMemo(() => {
    const wanted = skills.map((s) => s.toLowerCase())
    return entries.filter((e) => {
      if (country && e.country !== country) return false
      const own = e.skills.map((s) => s.toLowerCase())
      if (!wanted.every((s) => own.includes(s))) return false
      return matchesQuery(texts.get(e.github) ?? "", query)
    })
  }, [entries, texts, query, skills, country])

  const shownSkills = showAllSkills ? skillOptions : skillOptions.slice(0, POPULAR_SKILLS)
  // Keep selected skills visible even if they aren't in the popular list.
  const skillChips = [
    ...shownSkills,
    ...skills.filter((s) => !shownSkills.some((o) => o.value === s)).map((value) => ({ value, count: 0 })),
  ]
  const filtered = Boolean(query.trim() || skills.length || country)

  function toggleSkill(skill: string) {
    setSkills((current) => (current.includes(skill) ? current.filter((s) => s !== skill) : [...current, skill]))
  }

  function clearAll() {
    setQuery("")
    setSkills([])
    setCountry("")
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Search portfolios</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, role, skill or company…"
              className="h-10 w-full rounded-lg border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
          {countryOptions.length > 0 && (
            <label className="sm:w-48">
              <span className="sr-only">Country</span>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <option value="">All locations</option>
                {countryOptions.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.value} ({c.count})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {skillOptions.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <SlidersHorizontal className="size-3.5" /> Skills
            </p>
            <div className="flex flex-wrap gap-1.5">
              {skillChips.map(({ value, count }) => {
                const active = skills.includes(value)
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleSkill(value)}
                    aria-pressed={active}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs transition-colors",
                      active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                  >
                    {value}
                    {count > 0 && <span className={cn("ml-1 tabular-nums", !active && "text-muted-foreground")}>{count}</span>}
                  </button>
                )
              })}
              {skillOptions.length > POPULAR_SKILLS && (
                <button
                  type="button"
                  onClick={() => setShowAllSkills(!showAllSkills)}
                  className="rounded-full px-2.5 py-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {showAllSkills ? "Fewer skills" : `All ${skillOptions.length} skills`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-4 text-sm">
        <p className="text-muted-foreground tabular-nums" aria-live="polite">
          {filtered
            ? `${results.length} of ${entries.length} ${entries.length === 1 ? "person" : "people"}`
            : `${entries.length} ${entries.length === 1 ? "person" : "people"}`}
        </p>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <X /> Clear filters
          </Button>
        )}
      </div>

      {results.length > 0 ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {results.slice(0, visible).map((entry) => (
            <li key={entry.github}>
              <PortfolioCard entry={entry} highlight={skills} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No one matches that yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Try fewer filters or a different search.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={clearAll}>
              <X /> Clear filters
            </Button>
            <Button asChild>
              <a href={submissionUrl} target="_blank" rel="noreferrer">
                <Plus /> Add your portfolio
              </a>
            </Button>
          </div>
        </div>
      )}

      {results.length > visible && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show more ({results.length - visible} left)
          </Button>
        </div>
      )}
    </div>
  )
}
