// Turns the submission form's state into a portfolio Markdown file and back.
// The output must pass the schema in src/content.config.ts; keep the two in sync.
import YAML, { isScalar, isSeq, visit } from "yaml"
import publicKey from "@/contact/public-key.json"

export interface Stat { label: string; value: string }
export interface Project { title: string; summary: string; url: string; tags: string; stats: Stat[] }
export interface Role { title: string; period: string; location: string; summary: string; highlights: string }
export interface Experience { company: string; type: string; skills: string; roles: Role[] }
export interface SkillGroup { name: string; items: string }
export interface Education { school: string; degree: string; period: string; activities: string }
export interface Certification { name: string; issuer: string; issued: string; credentialId: string; url: string; skills: string }

export interface FormState {
  name: string
  headline: string
  role: string
  location: string
  emailEncrypted: string
  linkedin: string
  website: string
  about: string
  projects: Project[]
  experience: Experience[]
  skills: SkillGroup[]
  education: Education[]
  certifications: Certification[]
  /** Fields the form doesn't edit (showcases, githubId, status, …), carried over unchanged. */
  keep: Record<string, unknown>
}

export const emptyProject = (): Project => ({ title: "", summary: "", url: "", tags: "", stats: [] })
export const emptyRole = (): Role => ({ title: "", period: "", location: "", summary: "", highlights: "" })
export const emptyExperience = (): Experience => ({ company: "", type: "", skills: "", roles: [emptyRole()] })
export const emptySkillGroup = (): SkillGroup => ({ name: "", items: "" })
export const emptyEducation = (): Education => ({ school: "", degree: "", period: "", activities: "" })
export const emptyCertification = (): Certification => ({ name: "", issuer: "", issued: "", credentialId: "", url: "", skills: "" })

export const emptyForm = (): FormState => ({
  name: "",
  headline: "",
  role: "",
  location: "",
  emailEncrypted: "",
  linkedin: "",
  website: "",
  about: "",
  projects: [],
  experience: [],
  skills: [],
  education: [],
  certifications: [],
  keep: {},
})

// ---------------------------------------------------------------- helpers

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v))
const list = (s: string) => [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))]
const lines = (s: string) => s.split("\n").map((x) => x.replace(/^\s*[-*]\s+/, "").trim()).filter(Boolean)
const joinList = (v: unknown) => (Array.isArray(v) ? v.map(str).join(", ") : "")
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [])

/** Drops empty strings, empty arrays and undefined so optional fields stay out of the file. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === "" || (Array.isArray(v) && v.length === 0)) continue
    out[k] = v
  }
  return out as Partial<T>
}

export const isUrl = (s: string) => {
  if (!/^https?:\/\//i.test(s)) return false
  try {
    new URL(s)
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------- form → Markdown

const FORM_KEYS = new Set([
  "name", "github", "headline", "role", "location", "emailEncrypted", "linkedin", "website",
  "projects", "experience", "skills", "education", "certifications",
])
const KEEP_ORDER = ["githubId", "status", "previousUsernames", "showcases"]

export function toMarkdown(form: FormState, github: string, githubId?: number): string {
  const keep = { ...form.keep }
  if (githubId) keep.githubId = githubId

  const data: Record<string, unknown> = compact({
    name: form.name.trim(),
    github,
    githubId: keep.githubId,
    headline: form.headline.trim(),
    role: form.role.trim(),
    location: form.location.trim(),
    emailEncrypted: form.emailEncrypted.trim(),
    linkedin: form.linkedin.trim(),
    website: form.website.trim(),
  })
  for (const key of KEEP_ORDER.slice(1)) if (keep[key] !== undefined) data[key] = keep[key]

  Object.assign(
    data,
    compact({
      projects: form.projects.map((p) =>
        compact({
          title: p.title.trim(),
          summary: p.summary.trim(),
          url: p.url.trim(),
          tags: list(p.tags),
          stats: p.stats.map((s) => ({ label: s.label.trim(), value: s.value.trim() })).filter((s) => s.label && s.value),
        })
      ),
      experience: form.experience.map((e) =>
        compact({
          company: e.company.trim(),
          type: e.type.trim(),
          roles: e.roles.map((r) =>
            compact({
              title: r.title.trim(),
              period: r.period.trim(),
              location: r.location.trim(),
              summary: r.summary.trim(),
              highlights: lines(r.highlights),
            })
          ),
          skills: list(e.skills),
        })
      ),
      skills: form.skills.map((g) => ({ name: g.name.trim(), items: list(g.items) })),
      education: form.education.map((e) =>
        compact({ school: e.school.trim(), degree: e.degree.trim(), period: e.period.trim(), activities: e.activities.trim() })
      ),
      certifications: form.certifications.map((c) =>
        compact({
          name: c.name.trim(),
          issuer: c.issuer.trim(),
          issued: c.issued.trim(),
          credentialId: c.credentialId.trim(),
          url: c.url.trim(),
          skills: list(c.skills),
        })
      ),
    })
  )
  // Anything else that was in the file (fields added to the schema later) is kept as is.
  for (const [k, v] of Object.entries(keep)) if (!(k in data) && !FORM_KEYS.has(k)) data[k] = v

  const doc = new YAML.Document(data)
  // Short lists of words read better on one line: skills: [Go, Docker]
  visit(doc, {
    Seq(_, node) {
      if (isSeq(node) && node.items.every((i) => isScalar(i) && String(i.value).length < 60 && !String(i.value).includes(","))) {
        node.flow = node.items.length > 0
      }
    },
  })
  const yaml = doc.toString({ lineWidth: 0, flowCollectionPadding: false })
  const about = form.about.replace(/\r\n/g, "\n").trim()
  return `---\n${yaml}---\n${about ? `\n${about}\n` : ""}`
}

// ---------------------------------------------------------------- Markdown → form

export function fromMarkdown(text: string): FormState {
  const match = text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  if (!match) throw new Error("This file has no frontmatter.")
  const d = (YAML.parse(match[1]) ?? {}) as Record<string, unknown>

  const keep: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(d)) if (!FORM_KEYS.has(k)) keep[k] = v

  return {
    name: str(d.name),
    headline: str(d.headline),
    role: str(d.role),
    location: str(d.location),
    emailEncrypted: str(d.emailEncrypted),
    linkedin: str(d.linkedin),
    website: str(d.website),
    about: match[2].trim(),
    projects: arr(d.projects).map((p) => ({
      title: str(p.title),
      summary: str(p.summary),
      url: str(p.url),
      tags: joinList(p.tags),
      stats: arr(p.stats).map((s) => ({ label: str(s.label), value: str(s.value) })),
    })),
    experience: arr(d.experience).map((e) => ({
      company: str(e.company),
      type: str(e.type),
      skills: joinList(e.skills),
      roles: arr(e.roles).map((r) => ({
        title: str(r.title),
        period: str(r.period),
        location: str(r.location),
        summary: str(r.summary),
        highlights: Array.isArray(r.highlights) ? r.highlights.map(str).join("\n") : "",
      })),
    })),
    skills: arr(d.skills).map((g) => ({ name: str(g.name), items: joinList(g.items) })),
    education: arr(d.education).map((e) => ({
      school: str(e.school),
      degree: str(e.degree),
      period: str(e.period),
      activities: str(e.activities),
    })),
    certifications: arr(d.certifications).map((c) => ({
      name: str(c.name),
      issuer: str(c.issuer),
      issued: str(c.issued),
      credentialId: str(c.credentialId),
      url: str(c.url),
      skills: joinList(c.skills),
    })),
    keep,
  }
}

/** Fills in anything missing from a draft saved by an older version of the form. */
export function normalizeForm(value: unknown): FormState {
  const base = emptyForm()
  if (!value || typeof value !== "object") return base
  return { ...base, ...(value as Partial<FormState>), keep: { ...((value as FormState).keep ?? {}) } }
}

// ---------------------------------------------------------------- validation

export interface Problem { step: number; message: string }

export const STEP_BASICS = 1
export const STEP_ABOUT = 2
export const STEP_PORTFOLIO = 3
export const STEP_EXPERIENCE = 4
export const STEP_SKILLS = 5

/** Everything the schema would reject, tagged with the form step that fixes it. */
export function validate(form: FormState): Problem[] {
  const p: Problem[] = []
  const need = (step: number, value: string, label: string) => {
    if (!value.trim()) p.push({ step, message: `${label} is required.` })
  }
  const url = (step: number, value: string, label: string) => {
    if (value.trim() && !isUrl(value.trim())) p.push({ step, message: `${label} must be a full link starting with https://` })
  }

  need(STEP_BASICS, form.name, "Your name")
  need(STEP_BASICS, form.headline, "A headline")
  url(STEP_BASICS, form.linkedin, "LinkedIn")
  url(STEP_BASICS, form.website, "Website")

  form.projects.forEach((x, i) => {
    need(STEP_PORTFOLIO, x.title, `Project ${i + 1}: title`)
    need(STEP_PORTFOLIO, x.summary, `Project ${i + 1}: summary`)
    url(STEP_PORTFOLIO, x.url, `Project ${i + 1}: link`)
  })
  form.experience.forEach((x, i) => {
    need(STEP_EXPERIENCE, x.company, `Experience ${i + 1}: company`)
    if (x.roles.length === 0) p.push({ step: STEP_EXPERIENCE, message: `Experience ${i + 1}: add at least one role.` })
    x.roles.forEach((r, j) => {
      need(STEP_EXPERIENCE, r.title, `Experience ${i + 1}, role ${j + 1}: title`)
      need(STEP_EXPERIENCE, r.period, `Experience ${i + 1}, role ${j + 1}: period`)
    })
  })
  form.skills.forEach((x, i) => {
    need(STEP_SKILLS, x.name, `Skill group ${i + 1}: name`)
    if (list(x.items).length === 0) p.push({ step: STEP_SKILLS, message: `Skill group ${i + 1}: add at least one skill.` })
  })
  form.education.forEach((x, i) => {
    need(STEP_SKILLS, x.school, `Education ${i + 1}: school`)
    need(STEP_SKILLS, x.degree, `Education ${i + 1}: degree`)
  })
  form.certifications.forEach((x, i) => {
    need(STEP_SKILLS, x.name, `Certification ${i + 1}: name`)
    need(STEP_SKILLS, x.issuer, `Certification ${i + 1}: issuer`)
    url(STEP_SKILLS, x.url, `Certification ${i + 1}: link`)
  })
  return p
}

// ---------------------------------------------------------------- email

/** Same as `npm run encrypt-email`: RSA-OAEP with the contact Worker's public key, done in the browser. */
export async function encryptEmail(email: string): Promise<string> {
  const key = await crypto.subtle.importKey("jwk", publicKey as JsonWebKey, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"])
  const bytes = new Uint8Array(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, new TextEncoder().encode(email.trim())))
  let bin = ""
  for (const b of bytes) bin += String.fromCharCode(b)
  return "v1." + btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())
