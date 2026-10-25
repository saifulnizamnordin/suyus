import { useState, type ReactNode } from "react"
import {
  ArrowDown,
  ArrowRight,
  Boxes,
  Container,
  Cpu,
  FileArchive,
  GitBranch,
  GitMerge,
  LayoutDashboard,
  MemoryStick,
  Package,
  ServerCog,
  ShieldCheck,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { fpgaPlatform } from "./data"
import { useFleetSimulation } from "./useFleetSimulation"
import { DashboardPanel, KubernetesPanel, RegistryPanel, RunnerFleetPanel } from "./panels"

type Tab = "runners" | "registry" | "dashboard" | "k8s"

const tabs: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "runners", label: "Runner fleet", icon: <ServerCog /> },
  { id: "registry", label: "Registry", icon: <Package /> },
  { id: "dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
  { id: "k8s", label: "Kubernetes", icon: <Boxes /> },
]

function Stat({ icon, value, label, sub }: { icon: ReactNode; value: string; label: string; sub: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-3xl">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  )
}

function Node({
  icon,
  title,
  sub,
  tab,
  active,
  onSelect,
}: {
  icon: ReactNode
  title: string
  sub: string
  tab?: Tab
  active?: boolean
  onSelect: (t: Tab) => void
}) {
  const body = (
    <>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted [&_svg]:size-4">{icon}</span>
      <span className="min-w-0 text-left">
        <span className="block text-sm leading-tight font-medium">{title}</span>
        <span className="block text-xs leading-tight text-muted-foreground">{sub}</span>
      </span>
    </>
  )
  const base = "flex w-full items-center gap-2.5 rounded-lg border bg-card p-2.5 md:flex-col md:items-start"
  if (!tab) return <div className={cn(base, "border-dashed")}>{body}</div>
  return (
    <button
      type="button"
      onClick={() => onSelect(tab)}
      aria-pressed={active}
      className={cn(
        base,
        "cursor-pointer transition-all outline-none hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring",
        active && "border-viz bg-viz-soft ring-1 ring-viz"
      )}
    >
      {body}
    </button>
  )
}

function Arrow() {
  return (
    <div className="flex shrink-0 items-center justify-center text-muted-foreground" aria-hidden="true">
      <ArrowDown className="size-4 md:hidden" />
      <ArrowRight className="hidden size-4 md:block" />
    </div>
  )
}

export default function DevOpsShowcase() {
  const { runners } = fpgaPlatform
  const [tab, setTab] = useState<Tab>("runners")
  const sim = useFleetSimulation(runners.count, fpgaPlatform.jobTypes)
  const busy = sim.fleet.runners.filter((r) => r.state === "busy").length

  function select(t: Tab) {
    setTab(t)
    document.getElementById("showcase-tabs")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{fpgaPlatform.title}</CardTitle>
            <Badge variant="secondary">DevOps</Badge>
            <Badge variant="secondary">FPGA</Badge>
          </div>
          <CardDescription className="leading-relaxed">{fpgaPlatform.summary}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat icon={<ServerCog />} label="CI/CD runners" value={String(runners.count)} sub="self-hosted" />
            <Stat
              icon={<Cpu />}
              label="CPU cores"
              value={(runners.count * runners.coresEach).toLocaleString("en-US")}
              sub={`${runners.count} × ${runners.coresEach} cores`}
            />
            <Stat
              icon={<MemoryStick />}
              label="Memory"
              value={`${(runners.count * runners.memoryGbEach).toLocaleString("en-US")} GB`}
              sub={`${runners.count} × ${runners.memoryGbEach} GB`}
            />
            <Stat icon={<Container />} label="Containerized" value="100%" sub={`${runners.executor} executor on every job`} />
          </div>

          <div className="rounded-xl bg-muted/40 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Platform architecture</p>
              <p className="text-xs text-muted-foreground">Click a component to explore</p>
            </div>
            <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-stretch">
              <Node icon={<GitBranch />} title="Merge request" sub="FPGA app source" onSelect={select} />
              <Arrow />
              <Node icon={<GitMerge />} title="CI/CD pipeline" sub="schedules jobs" onSelect={select} />
              <Arrow />
              <Node
                icon={<ServerCog />}
                title={`${runners.count} runners`}
                sub={sim.fleet.running ? `${busy} busy now` : `${runners.coresEach}c / ${runners.memoryGbEach}GB each`}
                tab="runners"
                active={tab === "runners"}
                onSelect={select}
              />
              <Arrow />
              <Node
                icon={<ShieldCheck />}
                title="Quality gate"
                sub="SonarQube on K8s"
                tab="k8s"
                active={tab === "k8s"}
                onSelect={select}
              />
              <Arrow />
              <Node icon={<FileArchive />} title="Artifacts" sub="builds & bitstreams" onSelect={select} />
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Node
                icon={<Package />}
                title="Container registry"
                sub="dependency images pulled by runners"
                tab="registry"
                active={tab === "registry"}
                onSelect={select}
              />
              <Node
                icon={<LayoutDashboard />}
                title="Status dashboard"
                sub={sim.fleet.incident ? "⚠ incident in progress" : "monitors the whole platform"}
                tab="dashboard"
                active={tab === "dashboard"}
                onSelect={select}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs id="showcase-tabs" value={tab} onValueChange={(v) => setTab(v as Tab)} className="scroll-mt-20">
        <TabsList className="grid h-auto! w-full grid-cols-2 sm:grid-cols-4">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id} className="h-8">
              {t.icon}
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        <Card className="mt-2">
          <CardContent>
            <TabsContent value="runners">
              <RunnerFleetPanel {...sim} />
            </TabsContent>
            <TabsContent value="registry">
              <RegistryPanel />
            </TabsContent>
            <TabsContent value="dashboard">
              <DashboardPanel {...sim} />
            </TabsContent>
            <TabsContent value="k8s">
              <KubernetesPanel />
            </TabsContent>
          </CardContent>
        </Card>
      </Tabs>
    </div>
  )
}
