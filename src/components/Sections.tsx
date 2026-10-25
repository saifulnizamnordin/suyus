import { ArrowUpRight, Award, BadgeCheck, Globe, GraduationCap, Mail, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { GithubIcon, LinkedinIcon } from "@/components/icons"
import { avatarUrl, githubUrl, type PortfolioData } from "@/lib/portfolios"

type Props = { data: PortfolioData }

export function Hero({ data }: Props) {
  return (
    <section className="flex flex-col gap-6 pt-12 pb-4 sm:pt-20">
      <img
        src={avatarUrl(data.github, 160)}
        alt={data.name}
        width={80}
        height={80}
        className="size-20 rounded-full bg-muted object-cover ring-1 ring-foreground/10"
      />
      <div className="space-y-3">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{data.name}</h1>
        <p className="text-lg text-muted-foreground sm:text-xl">{data.headline}</p>
        {(data.role || data.location) && (
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {data.role && <span>{data.role}</span>}
            {data.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {data.location}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {data.linkedin && (
          <Button asChild size="lg">
            <a href={data.linkedin} target="_blank" rel="noreferrer">
              <LinkedinIcon className="size-4" />
              LinkedIn
            </a>
          </Button>
        )}
        <Button asChild size="lg" variant={data.linkedin ? "outline" : "default"}>
          <a href={githubUrl(data.github)} target="_blank" rel="noreferrer">
            <GithubIcon className="size-4" />
            GitHub
          </a>
        </Button>
        {data.website && (
          <Button asChild size="lg" variant="outline">
            <a href={data.website} target="_blank" rel="noreferrer">
              <Globe className="size-4" />
              Website
            </a>
          </Button>
        )}
        {data.email && (
          <Button asChild size="lg" variant="outline">
            <a href={`mailto:${data.email}`} title={data.email}>
              <Mail className="size-4" />
              Email
            </a>
          </Button>
        )}
      </div>
    </section>
  )
}

export function SectionHeading({ id, title, eyebrow }: { id: string; title: string; eyebrow: string }) {
  return (
    <div id={id} className="mb-6 scroll-mt-20">
      <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h2>
    </div>
  )
}

export function Projects({ data }: Props) {
  return (
    <div className="grid gap-4">
      {data.projects.map((p) => (
        <Card key={p.title}>
          <CardHeader>
            <CardTitle className="text-lg">
              {p.url ? (
                <a href={p.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline hover:underline-offset-4">
                  {p.title} <ArrowUpRight className="size-4 text-muted-foreground" />
                </a>
              ) : (
                p.title
              )}
            </CardTitle>
            <CardDescription className="leading-relaxed">{p.summary}</CardDescription>
          </CardHeader>
          {(p.stats.length > 0 || p.tags.length > 0) && (
            <CardContent className="space-y-4">
              {p.stats.length > 0 && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {p.stats.map((s) => (
                    <div key={s.label} className="rounded-xl border p-3">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{s.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {p.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.map((t) => (
                    <Badge key={t} variant="secondary">
                      {t}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}

export function Skills({ data }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {data.skills.map((group) => (
        <Card key={group.name} size="sm">
          <CardHeader>
            <CardTitle>{group.name}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {group.items.map((item) => (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

export function Education({ data }: Props) {
  const { education, certifications } = data
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {education.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <GraduationCap className="size-4" /> Education
          </h3>
          {education.map((e) => (
            <Card key={e.school + e.degree}>
              <CardHeader>
                <CardTitle>{e.school}</CardTitle>
                <CardDescription>{e.degree}</CardDescription>
              </CardHeader>
              {(e.period || e.activities) && (
                <CardContent className="space-y-1 text-muted-foreground">
                  {e.period && <p className="tabular-nums">{e.period}</p>}
                  {e.activities && <p>Activities and societies: {e.activities}</p>}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
      {certifications.length > 0 && (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Award className="size-4" /> Licenses & Certifications
          </h3>
          {certifications.map((c) => (
            <Card key={c.name}>
              <CardHeader>
                <CardTitle className="flex items-start gap-2">
                  <BadgeCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer" className="hover:underline hover:underline-offset-4">
                      {c.name}
                    </a>
                  ) : (
                    c.name
                  )}
                </CardTitle>
                <CardDescription>{c.issuer}</CardDescription>
              </CardHeader>
              {(c.issued || c.credentialId || c.skills.length > 0) && (
                <CardContent className="space-y-3 text-muted-foreground">
                  {(c.issued || c.credentialId) && (
                    <p>
                      {c.issued && <>Issued {c.issued}</>}
                      {c.issued && c.credentialId && " · "}
                      {c.credentialId && <>Credential ID {c.credentialId}</>}
                    </p>
                  )}
                  {c.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {c.skills.map((s) => (
                        <Badge key={s} variant="secondary">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

/** Contact links for a portfolio page footer. */
export function ContactLinks({ data }: Props) {
  const link = "inline-flex items-center gap-1 hover:text-foreground"
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {data.email && (
        <a className={link} href={`mailto:${data.email}`}>
          <Mail className="size-3.5" /> {data.email}
        </a>
      )}
      {data.linkedin && (
        <a className={link} href={data.linkedin} target="_blank" rel="noreferrer">
          LinkedIn <ArrowUpRight className="size-3.5" />
        </a>
      )}
      <a className={link} href={githubUrl(data.github)} target="_blank" rel="noreferrer">
        GitHub <ArrowUpRight className="size-3.5" />
      </a>
      {data.website && (
        <a className={link} href={data.website} target="_blank" rel="noreferrer">
          Website <ArrowUpRight className="size-3.5" />
        </a>
      )}
    </div>
  )
}
