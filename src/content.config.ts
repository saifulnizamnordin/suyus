import { defineCollection } from "astro:content"
import { glob } from "astro/loaders"
import { z } from "astro/zod"

// One Markdown file per person: src/content/portfolios/<github-username>.md
// The frontmatter holds structured data; the Markdown body is the "About" section.
// Keep templates/portfolio.md and SUBMISSION.md in sync with this schema.

const role = z.object({
  title: z.string(),
  period: z.string(),
  location: z.string().optional(),
  summary: z.string().optional(),
  highlights: z.array(z.string()).default([]),
})

const portfolios = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/portfolios" }),
  schema: z.object({
    name: z.string().min(1),
    github: z
      .string()
      .regex(/^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}$/, "Use your GitHub username in lowercase"),
    // Numeric GitHub account ID. Usernames can change; this can't. Filled in automatically if missing.
    githubId: z.number().int().positive().optional(),
    headline: z.string().min(1),
    role: z.string().optional(),
    location: z.string().optional(),
    email: z.email().optional(),
    linkedin: z.url().optional(),
    website: z.url().optional(),
    // Managed by the username sync job.
    status: z.enum(["active", "inactive"]).default("active"),
    previousUsernames: z.array(z.string()).default([]),
    // Interactive React sections from src/showcases/<github>/<name>/index.tsx, in display order.
    showcases: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Showcase names are lowercase-with-dashes")).default([]),
    projects: z
      .array(
        z.object({
          title: z.string(),
          summary: z.string(),
          url: z.url().optional(),
          tags: z.array(z.string()).default([]),
          stats: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
        })
      )
      .default([]),
    experience: z
      .array(
        z.object({
          company: z.string(),
          type: z.string().optional(),
          roles: z.array(role).min(1),
          skills: z.array(z.string()).default([]),
        })
      )
      .default([]),
    skills: z.array(z.object({ name: z.string(), items: z.array(z.string()).min(1) })).default([]),
    education: z
      .array(
        z.object({
          school: z.string(),
          degree: z.string(),
          period: z.string().optional(),
          activities: z.string().optional(),
        })
      )
      .default([]),
    certifications: z
      .array(
        z.object({
          name: z.string(),
          issuer: z.string(),
          issued: z.string().optional(),
          credentialId: z.string().optional(),
          url: z.url().optional(),
          skills: z.array(z.string()).default([]),
        })
      )
      .default([]),
  }),
})

export const collections = { portfolios }
