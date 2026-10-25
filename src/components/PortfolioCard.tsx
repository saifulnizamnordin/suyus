import { ArrowRight, MapPin } from "lucide-react"
import { avatarUrl, type DirectoryEntry } from "@/lib/directory"
import { cn } from "@/lib/utils"

type Props = {
  entry: DirectoryEntry
  /** Skills to show first, e.g. the ones the visitor filtered by. */
  highlight?: string[]
}

export default function PortfolioCard({ entry, highlight = [] }: Props) {
  const highlighted = new Set(highlight.map((s) => s.toLowerCase()))
  const skills = [
    ...entry.skills.filter((s) => highlighted.has(s.toLowerCase())),
    ...entry.skills.filter((s) => !highlighted.has(s.toLowerCase())),
  ].slice(0, 4)

  return (
    <a
      href={`/p/${entry.github}`}
      className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <img
          src={avatarUrl(entry.github, 96)}
          alt=""
          width={48}
          height={48}
          loading="lazy"
          className="size-12 shrink-0 rounded-full bg-muted object-cover ring-1 ring-foreground/10"
        />
        <div className="min-w-0">
          <p className="truncate font-medium">{entry.name}</p>
          <p className="truncate text-xs text-muted-foreground">@{entry.github}</p>
        </div>
        <ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{entry.headline}</p>
      {entry.location && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" />
          {entry.location}
        </p>
      )}
      {skills.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1.5">
          {skills.map((s) => (
            <span
              key={s}
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs",
                highlighted.has(s.toLowerCase()) && "border-primary bg-primary text-primary-foreground"
              )}
            >
              {s}
            </span>
          ))}
        </div>
      )}
    </a>
  )
}
