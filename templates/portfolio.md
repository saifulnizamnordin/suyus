---
# ─────────────────────────────────────────────────────────────────────────────
# Portfolio template
#
# 1. Copy this file to src/content/portfolios/<your-github-username>.md
#    (lowercase, e.g. src/content/portfolios/octocat.md)
# 2. Replace the example values below. Delete any optional section you don't need.
# 3. Write your "About me" in Markdown below the closing --- line.
#
# Full guide: SUBMISSION.md
# ─────────────────────────────────────────────────────────────────────────────

# Required ────────────────────────────────────────────────────────────────────
name: Your Name
github: your-username            # your GitHub username, lowercase — must match the file name
headline: Backend Engineer · Cloud & DevOps

# Optional ────────────────────────────────────────────────────────────────────
role: Senior Backend Engineer at Example Corp
location: Kuala Lumpur, Malaysia
email: you@example.com           # shown publicly as a mailto link — remove if you'd rather not
linkedin: https://www.linkedin.com/in/your-profile
website: https://example.com
# githubId: 1234567              # optional — filled in automatically after your PR is merged

# Showcases — optional interactive React sections, shown at the top of "Portfolio".
# Each name is a folder in src/showcases/your-username/<name>/ (start from templates/showcase/).
# showcases: [pipeline-speedup]

# Projects — shown as cards in the "Portfolio" section.
projects:
  - title: Self-hosted CI runners
    summary: Built an autoscaling fleet of Docker-based CI runners that cut average pipeline time in half.
    url: https://github.com/your-username/your-project   # optional
    tags: [Docker, GitLab CI, Terraform]
    stats:                                              # optional, up to 4 look best
      - label: Runners
        value: "24"
      - label: Faster pipelines
        value: "2×"

# Experience — newest first. A company can have several roles.
experience:
  - company: Example Corp
    type: Full-time
    roles:
      - title: Senior Backend Engineer
        period: Jan 2023 – Present
        location: Kuala Lumpur, Malaysia
        summary: One or two sentences about the role.   # optional
        highlights:
          - Something you built or improved, with the outcome.
          - Another achievement. The first three show by default; the rest expand.
    skills: [Go, PostgreSQL, Kubernetes]

# Skills — grouped however you like.
skills:
  - name: Languages
    items: [Go, TypeScript, Python]
  - name: Cloud & DevOps
    items: [AWS, Docker, Kubernetes, Terraform]

education:
  - school: Example University
    degree: BSc Computer Science
    period: 2015 – 2019          # optional
    activities: Robotics club    # optional

certifications:
  - name: Certified Kubernetes Administrator (CKA)
    issuer: The Linux Foundation
    issued: Mar 2024                         # optional
    credentialId: ABC-123                    # optional
    url: https://example.com/credential      # optional
    skills: [Kubernetes]                     # optional
---

Write your **About me** here, in Markdown. A few short paragraphs work best:
what you do, what you're good at, and what you're looking for.

### A subheading works too

- So do lists
- and [links](https://example.com).
