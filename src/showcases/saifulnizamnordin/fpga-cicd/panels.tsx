import { useEffect, useState } from "react"
import {
  TriangleAlert,
  Check,
  CircleCheck,
  Circle,
  Copy,
  Layers,
  LoaderCircle,
  Play,
  RotateCcw,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { fpgaPlatform } from "./data"
import type { Fleet, Runner } from "./useFleetSimulation"
import UtilizationChart from "./UtilizationChart"

const REGISTRY_HOST = "registry.local"

type SimControls = {
  fleet: Fleet
  start: () => void
  reset: () => void
  incident: () => void
  resolve: () => void
}

function Counter({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function SimulationNote() {
  return <p className="text-xs text-muted-foreground">Interactive simulation for illustration — not production metrics.</p>
}

const runnerStyle: Record<Runner["state"], string> = {
  idle: "bg-muted text-muted-foreground",
  busy: "bg-viz text-white",
  offline: "bg-critical/15 text-critical line-through",
}

export function RunnerFleetPanel({ fleet, start, reset }: SimControls) {
  const { runners: spec } = fpgaPlatform
  const [focused, setFocused] = useState<number | null>(null)
  const busy = fleet.runners.filter((r) => r.state === "busy").length
  const selected = focused !== null ? fleet.runners[focused - 1] : null

  return (
    <div className="space-y-5">
      <p className="leading-relaxed text-muted-foreground">
        {spec.count} self-hosted runners, each with {spec.coresEach} cores and {spec.memoryGbEach} GB of memory. Every job runs
        inside a {spec.executor} container, so FPGA builds are reproducible on any runner. Start a pipeline to watch jobs fan out
        across the fleet.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button onClick={start}>
          <Play /> {fleet.running ? "Queue another pipeline" : "Run pipeline"}
        </Button>
        <Button variant="outline" onClick={reset}>
          <RotateCcw /> Reset
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Counter label="Queued jobs" value={fleet.queued} />
        <Counter label="Running" value={busy} />
        <Counter label="Completed" value={fleet.done} />
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-14" onMouseLeave={() => setFocused(null)}>
          {fleet.runners.map((r) => (
            <button
              key={r.id}
              type="button"
              onMouseEnter={() => setFocused(r.id)}
              onFocus={() => setFocused(r.id)}
              onClick={() => setFocused(r.id)}
              aria-label={`Runner ${r.id}: ${r.state}${r.job ? `, running ${r.job}` : ""}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-[11px] font-medium tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                runnerStyle[r.state],
                focused === r.id && "ring-2 ring-foreground/40"
              )}
            >
              {r.id}
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex flex-wrap gap-3">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-viz" /> Busy
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-muted ring-1 ring-border" /> Idle
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm bg-critical/30" /> Offline
            </span>
          </div>
          <span className="min-h-4 tabular-nums" aria-live="polite">
            {selected
              ? `runner-${String(selected.id).padStart(2, "0")} · ${spec.coresEach} cores · ${spec.memoryGbEach} GB · ${
                  selected.state === "busy" ? `running ${selected.job}` : selected.state
                }`
              : "Hover a runner for details"}
          </span>
        </div>
      </div>

      <UtilizationChart history={fleet.history} capacity={spec.count} slots={80} tickSeconds={0.3} />
      <SimulationNote />
    </div>
  )
}

export function RegistryPanel() {
  const images = fpgaPlatform.registryImages
  const [active, setActive] = useState(images[0].name)
  const [copied, setCopied] = useState(false)
  const image = images.find((i) => i.name === active) ?? images[0]
  const pull = `docker pull ${REGISTRY_HOST}/${image.name}:latest`

  useEffect(() => setCopied(false), [active])

  async function copy() {
    try {
      await navigator.clipboard.writeText(pull)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <div className="space-y-5">
      <p className="leading-relaxed text-muted-foreground">
        A private container registry with a dedicated image for each dependency the FPGA application needs. Runners pull
        pre-built images instead of installing toolchains on every job, so pipelines start fast and every build uses the exact
        same environment. Select an image to inspect its layers.
      </p>

      <div className="grid gap-4 md:grid-cols-[minmax(0,14rem)_1fr]">
        <div className="flex flex-col gap-1.5" role="listbox" aria-label="Registry images">
          {images.map((img) => (
            <button
              key={img.name}
              type="button"
              role="option"
              aria-selected={img.name === active}
              onClick={() => setActive(img.name)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-left font-mono text-xs transition-colors hover:bg-muted",
                img.name === active && "border-viz bg-viz-soft"
              )}
            >
              <Layers className="size-3.5 shrink-0 text-muted-foreground" />
              {img.name}
            </button>
          ))}
        </div>

        <div className="space-y-4 rounded-xl border p-4">
          <div>
            <p className="font-mono text-sm font-medium">{image.name}</p>
            <p className="mt-1 text-muted-foreground">{image.purpose}</p>
          </div>
          <div className="flex flex-col-reverse gap-1">
            {image.layers.map((layer, i) => (
              <div
                key={layer}
                className="rounded-md border px-3 py-1.5 text-xs"
                style={{ marginInline: `${(image.layers.length - 1 - i) * 6}px` }}
              >
                <span className="mr-2 text-muted-foreground tabular-nums">L{i + 1}</span>
                {layer}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 font-mono text-xs">
            <code className="min-w-0 flex-1 truncate">{pull}</code>
            <Button size="icon-sm" variant="ghost" onClick={copy} aria-label="Copy pull command">
              {copied ? <Check /> : <Copy />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

type Status = "operational" | "degraded"

function StatusRow({ name, detail, status }: { name: string; detail: string; status: Status }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">{detail}</p>
      </div>
      {status === "operational" ? (
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
          <CircleCheck className="size-4 text-good" /> Operational
        </span>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
          <TriangleAlert className="size-4 text-warning" /> Degraded
        </span>
      )}
    </div>
  )
}

export function DashboardPanel({ fleet, start, incident, resolve }: SimControls) {
  const { runners: spec } = fpgaPlatform
  const online = fleet.runners.filter((r) => r.state !== "offline").length
  const busy = fleet.runners.filter((r) => r.state === "busy").length
  const util = Math.round((busy / spec.count) * 100)
  const allGood = !fleet.incident

  return (
    <div className="space-y-5">
      <p className="leading-relaxed text-muted-foreground">
        A status dashboard gives the team one place to see the health of the whole platform — runners, registry, Kubernetes
        and CI/CD tools. This preview is wired to the runner simulation: run a pipeline or trigger an incident and watch it react.
      </p>

      <div className="flex flex-wrap gap-2">
        {fleet.incident ? (
          <Button variant="outline" onClick={resolve}>
            <ShieldCheck /> Resolve incident
          </Button>
        ) : (
          <Button variant="outline" onClick={incident}>
            <TriangleAlert /> Simulate incident
          </Button>
        )}
        {!fleet.running && (
          <Button variant="ghost" onClick={start}>
            <Play /> Generate load
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border">
        <div
          className={cn(
            "flex items-center gap-2 border-b px-4 py-3 text-sm font-medium",
            allGood ? "bg-good/10" : "bg-warning/15"
          )}
        >
          {allGood ? (
            <CircleCheck className="size-4 text-good" />
          ) : (
            <TriangleAlert className="size-4 text-warning" />
          )}
          {allGood ? "All systems operational" : "Partial outage — runner capacity reduced"}
        </div>

        <div className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-4">
          {[
            { label: "Runners online", value: `${online}/${spec.count}` },
            { label: "Busy runners", value: busy },
            { label: "Queue depth", value: fleet.queued },
            { label: "Jobs completed", value: fleet.done },
          ].map((m) => (
            <div key={m.label} className="bg-card px-4 py-3">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-xl font-semibold tabular-nums">{m.value}</p>
            </div>
          ))}
        </div>

        <div className="border-b px-4 py-3">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Fleet CPU allocation</span>
            <span className="tabular-nums">
              {busy * spec.coresEach} / {spec.count * spec.coresEach} cores · {util}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-viz transition-[width] duration-300" style={{ width: `${util}%` }} />
          </div>
        </div>

        <div className="divide-y">
          <StatusRow name="GitLab CI/CD" detail="Pipelines & job scheduling" status="operational" />
          <StatusRow
            name="Runner fleet"
            detail={`${online} of ${spec.count} runners online · Docker executor`}
            status={fleet.incident ? "degraded" : "operational"}
          />
          <StatusRow name="Container registry" detail={`${fpgaPlatform.registryImages.length} FPGA dependency images`} status="operational" />
          <StatusRow name="Kubernetes cluster" detail="CI/CD tooling workloads" status="operational" />
          {fpgaPlatform.k8sTools.map((t) => (
            <StatusRow key={t.name} name={t.name} detail={t.role} status="operational" />
          ))}
        </div>
      </div>
      <SimulationNote />
    </div>
  )
}

const gateSteps = [
  "Runner job runs sonar-scanner inside its Docker image",
  "Analysis report is uploaded to SonarQube on Kubernetes",
  "SonarQube computes bugs, code smells, coverage and duplication",
  "Quality gate result is reported back to the pipeline",
]

export function KubernetesPanel() {
  const [step, setStep] = useState(-1)
  const running = step >= 0 && step < gateSteps.length

  useEffect(() => {
    if (!running) return
    const id = setTimeout(() => setStep((s) => s + 1), 900)
    return () => clearTimeout(id)
  }, [step, running])

  return (
    <div className="space-y-5">
      <p className="leading-relaxed text-muted-foreground">
        The tools the CI/CD pipelines depend on run on Kubernetes rather than on the runners themselves, keeping build capacity
        free for FPGA jobs while the tooling gets self-healing, rolling updates and simple scaling.
      </p>

      <div className="rounded-xl border border-dashed p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium">Kubernetes cluster</p>
          <Badge variant="outline">namespace: ci-tools</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {fpgaPlatform.k8sTools.map((t) => (
            <div key={t.name} className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{t.name}</p>
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CircleCheck className="size-3.5 text-good" /> Running
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t.role}</p>
            </div>
          ))}
          <div className="flex items-center justify-center rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            + other CI/CD tooling
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setStep(0)} disabled={running}>
            <Play /> Run quality gate
          </Button>
          {step >= gateSteps.length && (
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <CircleCheck className="size-4 text-good" /> Quality gate passed
            </span>
          )}
        </div>
        <ol className="space-y-2">
          {gateSteps.map((s, i) => {
            const state = step > i ? "done" : step === i ? "active" : "pending"
            return (
              <li key={s} className={cn("flex items-start gap-2.5", state === "pending" && "text-muted-foreground")}>
                {state === "done" && <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" />}
                {state === "active" && <LoaderCircle className="mt-0.5 size-4 shrink-0 animate-spin text-viz" />}
                {state === "pending" && <Circle className="mt-0.5 size-4 shrink-0" />}
                <span>{s}</span>
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}

