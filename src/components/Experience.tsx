import { useState } from "react"
import { ChevronDown, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { ExperienceItem, Role } from "@/lib/portfolios"

const PREVIEW_COUNT = 3

function RoleBlock({ role }: { role: Role }) {
  const [open, setOpen] = useState(false)
  const hidden = role.highlights.length - PREVIEW_COUNT
  const shown = open ? role.highlights : role.highlights.slice(0, PREVIEW_COUNT)

  return (
    <div className="relative pl-5 before:absolute before:top-2 before:left-0 before:size-2 before:rounded-full before:bg-primary">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h4 className="font-medium">{role.title}</h4>
        <span className="text-xs tabular-nums text-muted-foreground">{role.period}</span>
      </div>
      {role.location && (
        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="size-3" />
          {role.location}
        </p>
      )}
      {role.summary && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{role.summary}</p>}
      <ul className="mt-3 list-disc space-y-1.5 pl-4 text-sm leading-relaxed marker:text-muted-foreground/60">
        {shown.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      {hidden > 0 && (
        <Button variant="link" size="sm" className="mt-1 px-0" onClick={() => setOpen(!open)} aria-expanded={open}>
          {open ? "Show less" : `Show ${hidden} more`}
          <ChevronDown className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </Button>
      )}
    </div>
  )
}

export default function Experience({ items }: { items: ExperienceItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <Card key={item.company}>
          <CardHeader>
            <CardTitle className="text-lg">{item.company}</CardTitle>
            <CardDescription>{item.type}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {item.roles.map((role) => (
              <RoleBlock key={role.title + role.period} role={role} />
            ))}
            {item.skills && (
              <div className="flex flex-wrap gap-1.5">
                {item.skills.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
