// The "Submit with a form" wizard. Sign in with GitHub, fill in one step at a time (every step is saved as a draft),
// then the suyus-submit Worker (workers/submit) commits the file to your fork and opens the pull request as you.
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  GitPullRequest,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Save,
  Sparkles,
} from "lucide-react"
import { GithubIcon } from "@/components/icons"
import { Button } from "@/components/ui/button"
import { AreaField, Repeater, TextField } from "@/components/submit/fields"
import {
  api,
  clearSession,
  getSession,
  isAvailable,
  signInUrl,
  takeAuthResult,
  type Draft,
  type Me,
  type SubmitResult,
} from "@/lib/submit-api"
import {
  STEP_ABOUT,
  STEP_BASICS,
  STEP_EXPERIENCE,
  STEP_PORTFOLIO,
  STEP_SKILLS,
  emptyCertification,
  emptyEducation,
  emptyExperience,
  emptyForm,
  emptyProject,
  emptyRole,
  emptySkillGroup,
  encryptEmail,
  fromMarkdown,
  isEmail,
  normalizeForm,
  toMarkdown,
  validate,
  type FormState,
} from "@/lib/portfolio-form"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: STEP_BASICS, title: "Basics" },
  { id: STEP_ABOUT, title: "About" },
  { id: STEP_PORTFOLIO, title: "Portfolio" },
  { id: STEP_EXPERIENCE, title: "Experience" },
  { id: STEP_SKILLS, title: "Skills" },
  { id: 6, title: "Review" },
] as const
const STEP_REVIEW = 6

interface Props {
  /** "owner/name" of the Suyus repository. */
  repo: string
  repoUrl: string
  prGuideUrl: string
  siteUrl: string
}

type Phase = "loading" | "unavailable" | "signed-out" | "ready"

const errorText = (err: unknown) => (err instanceof Error && err.message) || "Something went wrong."

export default function SubmitForm({ repo, repoUrl, prGuideUrl, siteUrl }: Props) {
  const [phase, setPhase] = useState<Phase>("loading")
  const [user, setUser] = useState<Me | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [published, setPublished] = useState<string | null>(null) // the file currently on the site, if any
  const [fromPublished, setFromPublished] = useState(false) // the form was filled from the live page, not a draft
  const [step, setStep] = useState<number>(STEP_BASICS)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showProblems, setShowProblems] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)

  const login = user?.githubLogin ?? ""
  const problems = useMemo(() => validate(form), [form])
  const stepProblems = problems.filter((p) => p.step === step)
  const markdown = useMemo(() => (login ? toMarkdown(form, login, user?.githubId || undefined) : ""), [form, login, user])
  const unchanged = published !== null && markdown.trim() === published.replace(/\r\n/g, "\n").trim()

  // ------------------------------------------------------------ session & draft

  useEffect(() => {
    const { error: authError } = takeAuthResult() // back from GitHub: #session=… or #error=…
    if (authError) setError(authError)
    ;(async () => {
      if (!(await isAvailable())) return setPhase("unavailable")
      if (!getSession()) return setPhase("signed-out")
      try {
        await start(await api<Me>("/me"))
      } catch (err) {
        setError(errorText(err))
        setPhase("signed-out")
      }
    })()
  }, [])

  async function start(me: Me) {
    setUser(me)
    // The published file: the starting point when there's no draft, and how we tell whether anything changed.
    const livePage = fetch(`https://raw.githubusercontent.com/${repo}/main/src/content/portfolios/${me.githubLogin}.md`, { cache: "no-store" })
      .then((res) => (res.ok ? res.text() : null))
      .catch(() => null)
    const saved = await api<{ draft: Draft | null }>("/draft").then((r) => r.draft).catch(() => null)
    const text = await livePage
    setPublished(text)
    setFromPublished(false)

    const pr = saved?.prNumber ? `Pull request #${saved.prNumber}` : "Your pull request"
    if (saved?.prState === "merged" && text) {
      // Merged: the live file is the truth now (a maintainer may have touched it), so edit from there.
      setDraft({ ...saved, prUrl: "", prNumber: 0 })
      setForm(fromMarkdown(text))
      setFromPublished(true)
      setNotice(`${pr} was merged and your page is live. We loaded it so you can make changes; submitting opens a new pull request.`)
    } else if (saved) {
      const closed = saved.prState === "closed" || saved.prState === "merged"
      setDraft(closed ? { ...saved, prUrl: "", prNumber: 0 } : saved)
      setForm(normalizeForm(saved.data))
      setStep(Math.min(Math.max(saved.step || STEP_BASICS, STEP_BASICS), STEP_REVIEW))
      setNotice(
        saved.prState === "closed"
          ? `${pr} was closed without being merged. Your draft is still here; submitting opens a new pull request.`
          : "Welcome back. Your draft is restored.",
      )
    } else if (text) {
      setForm(fromMarkdown(text))
      setFromPublished(true)
      setNotice("You already have a portfolio. We loaded it so you can update it.")
    } else {
      setForm({ ...emptyForm(), name: me.name ?? "" })
    }
    setPhase("ready")
  }

  /** Throw the draft away and start again from the page that's live now. */
  function startFromPublished() {
    if (!published) return
    setForm(fromMarkdown(published))
    setFromPublished(true)
    setShowProblems(false)
    setStep(STEP_BASICS)
    setSaving("idle")
    setNotice("Loaded your live page. Your old draft is replaced when you move to the next step or save.")
  }

  function signIn() {
    window.location.href = signInUrl(window.location.pathname)
  }

  async function signOut(forgetAccess: boolean) {
    await api("/logout", { method: "POST", body: { forget: forgetAccess } }).catch(() => {})
    clearSession()
    setUser(null)
    setDraft(null)
    setForm(emptyForm())
    setPublished(null)
    setFromPublished(false)
    setResult(null)
    setStep(STEP_BASICS)
    setPhase("signed-out")
  }

  async function save(nextStep = step) {
    if (!user) return
    setSaving("saving")
    try {
      const { draft: saved } = await api<{ draft: Draft }>("/draft", { method: "PUT", body: { data: form, step: nextStep } })
      setDraft((d) => ({ ...saved, prUrl: saved.prUrl || d?.prUrl || "", prNumber: saved.prNumber || d?.prNumber || 0 }))
      setSaving("saved")
    } catch {
      setSaving("error")
    }
  }

  function go(next: number) {
    if (next > step && stepProblems.length > 0 && step !== STEP_REVIEW) {
      setShowProblems(true)
      return
    }
    setShowProblems(false)
    setNotice(null)
    setStep(next)
    void save(next)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  async function submit() {
    if (problems.length > 0 || unchanged) return
    setSubmitting(true)
    setError(null)
    try {
      await save(STEP_REVIEW)
      const res = await api<SubmitResult>("/submit", { method: "POST", body: { markdown } })
      setResult(res)
      setDraft((d) => (d ? { ...d, prUrl: res.prUrl, prNumber: res.prNumber } : d))
    } catch (err) {
      setError(errorText(err))
    } finally {
      setSubmitting(false)
    }
  }

  const patch = (p: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...p }))
    setSaving("idle")
  }

  // ------------------------------------------------------------ screens

  if (phase === "unavailable") {
    return (
      <Panel icon={<AlertCircle className="size-5" />} title="The form isn't available yet">
        <p>
          Submitting with a form needs the Suyus sign-in service, which isn't reachable right now. You can still add your
          portfolio <a className="underline underline-offset-4" href={prGuideUrl}>with a pull request</a>.
        </p>
      </Panel>
    )
  }

  if (phase === "loading") {
    return (
      <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading…
      </div>
    )
  }

  if (phase === "signed-out" || !user) {
    return (
      <Panel icon={<GithubIcon className="size-5" />} title="Sign in with GitHub">
        <p>
          Your page lives at <code>{new URL(siteUrl).host}/p/&lt;your-github-username&gt;</code>, so we need to know your GitHub
          account. Signing in also lets Suyus open the pull request <span className="text-foreground">as you</span>: it forks{" "}
          <a className="underline underline-offset-4" href={repoUrl} target="_blank" rel="noreferrer">{repo}</a> to your
          account and adds one file.
        </p>
        <ul className="mt-3 space-y-1.5">
          <li className="flex gap-2"><LockKeyhole className="mt-0.5 size-4 shrink-0" /><span>GitHub asks you to allow access to public repositories. That's what forking and opening a pull request need.</span></li>
          <li className="flex gap-2"><Save className="mt-0.5 size-4 shrink-0" /><span>Your progress is saved after every step, so you can come back later.</span></li>
          <li className="flex gap-2"><LogOut className="mt-0.5 size-4 shrink-0" /><span>You can remove Suyus's access at any time when you sign out.</span></li>
        </ul>
        {error && <ErrorNote>{error}</ErrorNote>}
        <Button className="mt-5" size="lg" onClick={signIn}>
          <GithubIcon /> Continue with GitHub
        </Button>
      </Panel>
    )
  }

  if (result) {
    return (
      <Panel icon={<CircleCheck className="size-5 text-good" />} title={result.updatedExistingPr ? "Pull request updated" : "Submitted!"}>
        <p>
          {result.updatedExistingPr
            ? "Your changes were added to your open pull request."
            : "Your pull request is open. A check confirms the file matches your GitHub account and that the site still builds."}{" "}
          Once a maintainer merges it, your page goes live at{" "}
          <a className="underline underline-offset-4" href={`/p/${result.login}`}>{new URL(siteUrl).host}/p/{result.login}</a>.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <a href={result.prUrl} target="_blank" rel="noreferrer">
              <GitPullRequest /> View pull request #{result.prNumber}
            </a>
          </Button>
          <Button variant="outline" size="lg" onClick={() => { setResult(null); setStep(STEP_BASICS) }}>
            Keep editing
          </Button>
        </div>
      </Panel>
    )
  }

  return (
    <div>
      {/* Account bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={`https://github.com/${login}.png?size=64`} alt="" className="size-8 rounded-full bg-muted" />
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{user.name || login}</p>
            <p className="truncate text-xs text-muted-foreground">@{login} · page at /p/{login}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <SaveState state={saving} />
          <Button variant="ghost" size="sm" onClick={() => signOut(false)}>Sign out</Button>
        </div>
      </div>

      {/* Progress */}
      <ol className="mt-6 grid grid-cols-6 gap-1.5" aria-label="Steps">
        {STEPS.map((s) => {
          const done = s.id < step
          const current = s.id === step
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => (s.id < step ? go(s.id) : undefined)}
                disabled={s.id > step}
                aria-current={current ? "step" : undefined}
                className="group w-full text-left disabled:cursor-default"
              >
                <span className={cn("block h-1.5 rounded-full", current ? "bg-primary" : done ? "bg-primary/50" : "bg-muted")} />
                <span className={cn("mt-1.5 hidden text-xs sm:block", current ? "font-medium" : "text-muted-foreground", done && "group-hover:text-foreground")}>
                  {s.id}. {s.title}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 text-xs text-muted-foreground sm:hidden">
        Step {step} of {STEPS.length}: {STEPS[step - 1].title}
      </p>

      {notice && (
        <p className="mt-6 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0" /> {notice}
        </p>
      )}
      {published && !fromPublished && !unchanged && (
        <p className="mt-3 text-sm text-muted-foreground">
          Editing a saved draft.{" "}
          <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={startFromPublished}>
            Start from my live page instead
          </button>
        </p>
      )}
      {draft?.prUrl && step !== STEP_REVIEW && (
        <p className="mt-3 text-sm text-muted-foreground">
          You have a pull request open:{" "}
          <a className="underline underline-offset-4" href={draft.prUrl} target="_blank" rel="noreferrer">#{draft.prNumber}</a>. Submitting
          again adds your changes to it.
        </p>
      )}

      <div className="mt-8 space-y-5">
        {step === STEP_BASICS && <Basics form={form} patch={patch} />}
        {step === STEP_ABOUT && (
          <Section title="About you" lead="This becomes the About me section at the top of your page. Markdown works: **bold**, lists, [links](https://…).">
            <AreaField
              label="About me"
              rows={10}
              value={form.about}
              onChange={(about) => patch({ about })}
              placeholder={"A few short paragraphs work best: what you do, what you're good at, and what you're looking for."}
            />
          </Section>
        )}
        {step === STEP_PORTFOLIO && (
          <Section title="Portfolio" lead="Projects you're proud of. Each one becomes a card with a summary, tags and a few numbers.">
            <Repeater
              items={form.projects}
              onChange={(projects) => patch({ projects })}
              create={emptyProject}
              addLabel="Add a project"
              itemLabel={(p, i) => p.title || `Project ${i + 1}`}
              empty="No projects yet. This section is optional."
              render={(p, set) => (
                <>
                  <TextField label="Title" required value={p.title} onChange={(title) => set({ title })} />
                  <AreaField label="Summary" required rows={3} value={p.summary} onChange={(summary) => set({ summary })} />
                  <TextField label="Link" value={p.url} onChange={(url) => set({ url })} placeholder="https://github.com/you/project" />
                  <TextField label="Tags" value={p.tags} onChange={(tags) => set({ tags })} placeholder="Docker, Terraform" hint="Separate with commas." />
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Numbers <span className="font-normal text-muted-foreground">(optional, up to 4 look best)</span></p>
                    {p.stats.map((s, j) => (
                      <div key={j} className="flex items-end gap-2">
                        <TextField className="flex-1" label="Label" required value={s.label} onChange={(label) => set({ stats: p.stats.map((x, k) => (k === j ? { ...x, label } : x)) })} placeholder="Faster builds" />
                        <TextField className="w-28" label="Value" required value={s.value} onChange={(value) => set({ stats: p.stats.map((x, k) => (k === j ? { ...x, value } : x)) })} placeholder="2×" />
                        <Button type="button" variant="ghost" size="sm" onClick={() => set({ stats: p.stats.filter((_, k) => k !== j) })}>Remove</Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => set({ stats: [...p.stats, { label: "", value: "" }] })}>Add a number</Button>
                  </div>
                </>
              )}
            />
            <p className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              Want something interactive here, like a demo or a custom design? That's a <span className="font-medium text-foreground">showcase</span>, a
              small React component. Showcases are added <a className="underline underline-offset-4" href={prGuideUrl}>with a pull request</a>.
              {Array.isArray(form.keep.showcases) && form.keep.showcases.length > 0 && <> Your existing showcases are kept as they are.</>}
            </p>
          </Section>
        )}
        {step === STEP_EXPERIENCE && (
          <Section title="Experience" lead="Newest first. A company can have several roles. The first three highlights show by default; the rest expand.">
            <Repeater
              items={form.experience}
              onChange={(experience) => patch({ experience })}
              create={emptyExperience}
              addLabel="Add a company"
              itemLabel={(e, i) => e.company || `Company ${i + 1}`}
              empty="No experience yet. This section is optional."
              render={(e, set) => (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="Company" required value={e.company} onChange={(company) => set({ company })} />
                    <TextField label="Type" value={e.type} onChange={(type) => set({ type })} placeholder="Full-time" />
                  </div>
                  <Repeater
                    items={e.roles}
                    onChange={(roles) => set({ roles })}
                    create={emptyRole}
                    addLabel="Add a role"
                    itemLabel={(r, j) => r.title || `Role ${j + 1}`}
                    render={(r, setRole) => (
                      <>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <TextField label="Title" required value={r.title} onChange={(title) => setRole({ title })} />
                          <TextField label="Period" required value={r.period} onChange={(period) => setRole({ period })} placeholder="Jan 2023 – Present" />
                        </div>
                        <TextField label="Location" value={r.location} onChange={(location) => setRole({ location })} placeholder="Kuala Lumpur, Malaysia · Hybrid" />
                        <AreaField label="Summary" rows={2} value={r.summary} onChange={(summary) => setRole({ summary })} />
                        <AreaField label="Highlights" rows={4} value={r.highlights} onChange={(highlights) => setRole({ highlights })} hint="One per line." placeholder={"Cut deploy time from 40 to 8 minutes.\nLed the move to Kubernetes."} />
                      </>
                    )}
                  />
                  <TextField label="Skills used" value={e.skills} onChange={(skills) => set({ skills })} placeholder="Go, PostgreSQL, Kubernetes" hint="Separate with commas." />
                </>
              )}
            />
          </Section>
        )}
        {step === STEP_SKILLS && (
          <>
            <Section title="Skills" lead="Group them however you like, for example Languages, Cloud, Design.">
              <Repeater
                items={form.skills}
                onChange={(skills) => patch({ skills })}
                create={emptySkillGroup}
                addLabel="Add a skill group"
                itemLabel={(g, i) => g.name || `Group ${i + 1}`}
                empty="No skills yet. This section is optional."
                render={(g, set) => (
                  <>
                    <TextField label="Group name" required value={g.name} onChange={(name) => set({ name })} placeholder="Languages" />
                    <TextField label="Skills" required value={g.items} onChange={(items) => set({ items })} placeholder="Go, TypeScript, Python" hint="Separate with commas." />
                  </>
                )}
              />
            </Section>
            <Section title="Education">
              <Repeater
                items={form.education}
                onChange={(education) => patch({ education })}
                create={emptyEducation}
                addLabel="Add education"
                itemLabel={(e, i) => e.school || `Education ${i + 1}`}
                render={(e, set) => (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="School" required value={e.school} onChange={(school) => set({ school })} />
                      <TextField label="Degree" required value={e.degree} onChange={(degree) => set({ degree })} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Period" value={e.period} onChange={(period) => set({ period })} placeholder="2015 – 2019" />
                      <TextField label="Activities" value={e.activities} onChange={(activities) => set({ activities })} />
                    </div>
                  </>
                )}
              />
            </Section>
            <Section title="Certifications">
              <Repeater
                items={form.certifications}
                onChange={(certifications) => patch({ certifications })}
                create={emptyCertification}
                addLabel="Add a certification"
                itemLabel={(c, i) => c.name || `Certification ${i + 1}`}
                render={(c, set) => (
                  <>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Name" required value={c.name} onChange={(name) => set({ name })} />
                      <TextField label="Issuer" required value={c.issuer} onChange={(issuer) => set({ issuer })} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <TextField label="Issued" value={c.issued} onChange={(issued) => set({ issued })} placeholder="Mar 2024" />
                      <TextField label="Credential ID" value={c.credentialId} onChange={(credentialId) => set({ credentialId })} />
                    </div>
                    <TextField label="Link" value={c.url} onChange={(url) => set({ url })} placeholder="https://…" />
                    <TextField label="Skills" value={c.skills} onChange={(skills) => set({ skills })} hint="Separate with commas." />
                  </>
                )}
              />
            </Section>
          </>
        )}
        {step === STEP_REVIEW && (
          <Section title="Review & submit" lead={`This is the file that will be added as src/content/portfolios/${login}.md.`}>
            {problems.length > 0 && (
              <div className="rounded-xl border border-critical/40 bg-critical/5 p-4 text-sm">
                <p className="font-medium">Fix these before submitting:</p>
                <ul className="mt-2 space-y-1">
                  {problems.map((p, i) => (
                    <li key={i}>
                      <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => go(p.step)}>
                        {STEPS[p.step - 1].title}: {p.message}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {unchanged && <p className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">Nothing has changed from your published portfolio yet.</p>}
            <pre className="max-h-[28rem] overflow-auto rounded-xl border bg-muted/30 p-4 text-xs leading-relaxed whitespace-pre-wrap">{markdown}</pre>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /><span>Suyus forks <a className="underline underline-offset-4" href={repoUrl} target="_blank" rel="noreferrer">{repo}</a> to @{login} (if you haven't already) and commits this file there.</span></li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /><span>A pull request is opened in your name. Checks run, then a maintainer merges it.</span></li>
              <li className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /><span>To change something later, come back here and submit again.</span></li>
            </ul>
            {error && <ErrorNote>{error}</ErrorNote>}
          </Section>
        )}
      </div>

      {showProblems && stepProblems.length > 0 && (
        <div className="mt-6 rounded-xl border border-critical/40 bg-critical/5 p-4 text-sm">
          <p className="font-medium">Almost there:</p>
          <ul className="mt-1 list-disc pl-5">
            {stepProblems.map((p, i) => <li key={i}>{p.message}</li>)}
          </ul>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t pt-6">
        <Button variant="outline" size="lg" onClick={() => go(step - 1)} disabled={step === STEP_BASICS}>
          <ArrowLeft /> Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="lg" onClick={() => save()} disabled={saving === "saving"}>
            <Save /> Save draft
          </Button>
          {step < STEP_REVIEW ? (
            <Button size="lg" onClick={() => go(step + 1)}>
              Next: {STEPS[step].title} <ArrowRight />
            </Button>
          ) : (
            <Button size="lg" onClick={submit} disabled={submitting || problems.length > 0 || unchanged}>
              {submitting ? <Loader2 className="animate-spin" /> : <GitPullRequest />}
              {submitting ? "Opening pull request…" : draft?.prUrl ? "Update pull request" : "Submit portfolio"}
            </Button>
          )}
        </div>
      </div>

      <p className="mt-10 text-xs text-muted-foreground">
        Signed in as @{login}.{" "}
        <button type="button" className="underline underline-offset-4 hover:text-foreground" onClick={() => signOut(true)}>
          Sign out and remove Suyus's access to your GitHub account
        </button>
        . You can also revoke it in GitHub under Settings → Applications.
      </p>
    </div>
  )
}

// ------------------------------------------------------------ step: basics

function Basics({ form, patch }: { form: FormState; patch: (p: Partial<FormState>) => void }) {
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [encrypting, setEncrypting] = useState(false)

  async function saveEmail() {
    if (!email.trim()) return
    if (!isEmail(email)) {
      setEmailError("That doesn't look like an email address.")
      return
    }
    setEncrypting(true)
    try {
      patch({ emailEncrypted: await encryptEmail(email) })
      setEmail("")
      setEmailError(null)
    } catch {
      setEmailError("Couldn't encrypt the address in this browser.")
    } finally {
      setEncrypting(false)
    }
  }

  return (
    <Section title="The basics" lead="Shown at the top of your page and on your card in Browse.">
      <TextField label="Name" required value={form.name} onChange={(name) => patch({ name })} placeholder="Your Name" />
      <TextField
        label="Headline"
        required
        value={form.headline}
        onChange={(headline) => patch({ headline })}
        placeholder="Product Designer · Branding & UX"
        hint="One line about what you do."
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Current role" value={form.role} onChange={(role) => patch({ role })} placeholder="Designer at Example Co" />
        <TextField label="Location" value={form.location} onChange={(location) => patch({ location })} placeholder="Kuala Lumpur, Malaysia" hint="End with your country to appear in the country filter." />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="LinkedIn" value={form.linkedin} onChange={(linkedin) => patch({ linkedin })} placeholder="https://www.linkedin.com/in/you" />
        <TextField label="Website" value={form.website} onChange={(website) => patch({ website })} placeholder="https://example.com" />
      </div>

      <div className="space-y-2 rounded-xl border bg-card p-4">
        <p className="flex items-center gap-2 text-sm font-medium">
          <Mail className="size-4" /> Email <span className="font-normal text-muted-foreground">(optional)</span>
        </p>
        {form.emailEncrypted ? (
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="flex items-center gap-1.5 text-muted-foreground">
              <LockKeyhole className="size-4 text-good" /> Email saved, encrypted. Visitors see it only after a human check.
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={() => patch({ emailEncrypted: "" })}>Remove</Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveEmail())}
                placeholder="you@example.com"
                className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label="Email address"
              />
              <Button type="button" variant="outline" onClick={saveEmail} disabled={encrypting || !email.trim()}>
                {encrypting ? <Loader2 className="animate-spin" /> : <LockKeyhole />} Encrypt & add
              </Button>
            </div>
            {emailError && <p className="text-xs text-critical">{emailError}</p>}
            <p className="text-xs text-muted-foreground">
              Encrypted here in your browser. Only the encrypted text is saved and published, so the address never appears in plain text.
            </p>
          </>
        )}
      </div>
    </Section>
  )
}

// ------------------------------------------------------------ layout bits

function Section({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {lead && <p className="mt-1 text-sm text-muted-foreground">{lead}</p>}
      </div>
      {children}
    </section>
  )
}

function Panel({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-6 text-sm leading-relaxed text-muted-foreground">
      <p className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
        {icon} {title}
      </p>
      <div className="mt-3">{children}</div>
    </div>
  )
}

function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-xl border border-critical/40 bg-critical/5 p-3 text-sm text-foreground">
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-critical" /> {children}
    </p>
  )
}

function SaveState({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "saving") return <span className="flex items-center gap-1"><Loader2 className="size-3 animate-spin" /> Saving…</span>
  if (state === "saved") return <span className="flex items-center gap-1"><Check className="size-3" /> Draft saved</span>
  if (state === "error") return <span className="text-critical">Couldn't save the draft</span>
  return null
}
