// Showcase starter.
//
// 1. Copy this folder to src/showcases/<your-github-username>/<showcase-name>/
//    e.g. src/showcases/octocat/pipeline-speedup/index.tsx
// 2. Add the name to your portfolio file:  showcases: [pipeline-speedup]
// 3. Replace the example below with your own. Keep a default export.
//
// Rules and the list of allowed imports: SUBMISSION.md → "Showcases".
import { useState } from "react"
import { Gauge, Rocket } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

const data = {
  before: { label: "Before", minutes: 42, failures: 18 },
  after: { label: "After", minutes: 11, failures: 3 },
}

type Mode = keyof typeof data

export default function PipelineSpeedup() {
  const [mode, setMode] = useState<Mode>("after")
  const current = data[mode]
  const width = Math.round((current.minutes / data.before.minutes) * 100)

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Pipeline speed-up</CardTitle>
          <Badge variant="secondary">CI/CD</Badge>
        </div>
        <CardDescription>Toggle to compare the pipeline before and after the rework.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-2">
          {(Object.keys(data) as Mode[]).map((m) => (
            <Button key={m} variant={m === mode ? "default" : "outline"} onClick={() => setMode(m)}>
              {m === "after" ? <Rocket /> : <Gauge />}
              {data[m].label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Average pipeline</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{current.minutes} min</p>
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Failed runs / month</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{current.failures}</p>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Duration vs. original</span>
            <span className="tabular-nums">{width}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${width}%` }} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
