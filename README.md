<p align="center">
  <a href="https://suy.us">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="public/brand/suyus-logo-color-on-dark.svg">
      <img src="public/brand/suyus-logo-color.svg" alt="Suyus" height="64">
    </picture>
  </a>
</p>

<p align="center"><b>Portfolios for everyone, written in Markdown.</b><br><a href="https://suy.us">suy.us</a> · <a href="https://suy.us/p">Browse</a> · <a href="https://suy.us/submit">Submit yours</a> · <a href="https://suy.us/sponsor">Sponsor</a> · <a href="https://suy.us/brand">Media kit</a></p>

# Suyus

Anyone with a GitHub account can add a portfolio. Each one is a single Markdown file and gets a page at `https://suy.us/p/<github-username>`.

There are two ways to submit, both chosen at [suy.us/submit](https://suy.us/submit):

- **With a form** ([`/submit/form`](https://suy.us/submit/form)): sign in with GitHub, fill in the page step by step, and Suyus opens the pull request in your name. No Git needed. Showcases aren't available here.
- **With a pull request**: fork, copy the template, open a PR. Full control, including showcases. See [SUBMISSION.md](SUBMISSION.md).

Built with [Astro](https://astro.build), [React](https://react.dev) and [shadcn/ui](https://ui.shadcn.com) (Tailwind CSS v4). The form runs on a Cloudflare Worker ([`workers/submit/`](workers/submit/)) with [PocketBase](https://pocketbase.io) for storage.

## How it's organised

| Path | What it is |
| --- | --- |
| [`src/content/portfolios/`](src/content/portfolios/) | One `<username>.md` per person. Frontmatter = structured data, body = About section |
| [`templates/portfolio.md`](templates/portfolio.md) | Starting point for new submissions |
| [`src/content.config.ts`](src/content.config.ts) | Schema every portfolio is validated against at build time |
| [`src/pages/index.astro`](src/pages/index.astro) | Landing page with the first 6 portfolios (`/`) |
| [`src/pages/p/index.astro`](src/pages/p/index.astro) | Browse all (`/p`): search by name, role, skill, company; filter by skill and country; filters live in the URL (`/p?q=devops&skill=Kubernetes&country=Malaysia`) |
| [`src/pages/p/[username].astro`](src/pages/p/[username].astro) | Portfolio page (`/p/<username>`), plus redirects from previous usernames |
| [`src/showcases/registry.ts`](src/showcases/registry.ts) | Finds showcases by folder; [`Showcase.tsx`](src/components/Showcase.tsx) is the single island that renders them |
| [`src/showcases/<username>/<name>/`](src/showcases/) | Interactive React sections owned by one user, enabled with `showcases:` |
| [`templates/showcase/`](templates/showcase/) | Starter showcase for contributors |
| [`src/pages/submit.astro`](src/pages/submit.astro) | Chooser between the form and the pull request route (`/submit`) |
| [`src/components/submit/`](src/components/submit/) | The submission form (`/submit/form`); [`src/lib/portfolio-form.ts`](src/lib/portfolio-form.ts) turns it into the Markdown file and back |
| [`workers/submit/`](workers/submit/) | Cloudflare Worker behind the form: GitHub sign-in, drafts in PocketBase, opening the PR as the user — [setup](workers/submit/README.md) |
| [`src/site.ts`](src/site.ts) | Site name, repo URL and submission links |
| [`scripts/`](scripts/) | Submission check, username sync, `encrypt-email` |
| [`workers/contact/`](workers/contact/) | Cloudflare Worker that reveals emails after a Turnstile check — [setup](workers/contact/README.md) |

## Development

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # output in ./dist
npm run preview
```

The form at `/submit/form` talks to the `suyus-submit` Worker at `https://submit.suy.us` (override with `PUBLIC_SUBMIT_API_URL`). If the Worker can't be reached, the form says it isn't available yet and points to the pull request route.

## Automation

| Workflow | When | What it does |
| --- | --- | --- |
| [Deploy to GitHub Pages](.github/workflows/deploy.yml) | push to `main` | Builds and publishes the site |
| [CI](.github/workflows/ci.yml) (`build`) | every PR to `main` | `npm ci` + `npm run build`, which also validates every portfolio against the schema |
| [Validate portfolio submission](.github/workflows/validate-submission.yml) (`validate`) | every PR | When portfolio or showcase files changed: checks file name, GitHub account, `githubId`, PR author and showcase code. Otherwise passes straight away |
| [Auto-merge portfolio submissions](.github/workflows/automerge.yml) | after `build` and `validate` finish on a PR | Merges the PR and starts the deploy when it only changes the author's own portfolio file and showcase folder and passes the strict rules in [`scripts/submission-rules.mjs`](scripts/submission-rules.mjs). Otherwise labels it `needs-review` and comments why. Never runs the PR's code |
| [Sync portfolio usernames](.github/workflows/sync-usernames.yml) | daily 03:17 UTC, or manually | Follows each portfolio by GitHub account ID and opens a PR for renames, deleted accounts and missing IDs |

Run the sync locally without changing anything:

```sh
GITHUB_TOKEN=<token> node scripts/sync-usernames.mjs --dry-run
```

Check what auto-merge would do with a PR, without merging, labelling or commenting:

```sh
GITHUB_TOKEN=<token> REPO=saifulnizamnordin/suyus DRY_RUN=1 PR_NUMBER=<n> node scripts/automerge.mjs
```

Auto-merge switches, under **Settings → Secrets and variables → Actions → Variables**: `AUTOMERGE=false` turns it off; `AUTOMERGE_SHOWCASES=false` makes every showcase wait for a review while portfolio files still merge automatically.

### One-time repository settings

1. **Settings → Pages → Source**: **GitHub Actions**.
2. **Settings → Actions → General → Workflow permissions**: tick **Allow GitHub Actions to create and approve pull requests** (needed by the username sync).
3. **Settings → Rules → Rulesets**: a ruleset for the default branch (`main`), set to **Active**, with:
   - **Restrict deletions** and **Block force pushes**
   - **Require a pull request before merging**, with 0 required approvals (GitHub doesn't let you approve your own PR)
   - **Require status checks to pass**: `build` and `validate`. Both run on every PR, so no PR waits for a check that never starts.
   - **Bypass list**: Repository admin → Always allow, for emergencies
4. **Settings → General → Pull Requests**: tick **Allow auto-merge** if you want PRs to merge by themselves once the checks pass.
5. **Settings → Actions → General → Fork pull request workflows**: GitHub asks a maintainer to approve the checks for first-time contributors by default, and auto-merge waits until they've run. Choose **Require approval for first-time contributors who are new to GitHub** so new accounts still wait but regular people's PRs merge on their own.

## Custom domain: `suy.us`

[`public/CNAME`](public/CNAME) contains `suy.us` and is copied into every build.

DNS records for `suy.us`:

| Type    | Name  | Value                           |
| ------- | ----- | ------------------------------- |
| `A`     | `@`   | `185.199.108.153`               |
| `A`     | `@`   | `185.199.109.153`               |
| `A`     | `@`   | `185.199.110.153`               |
| `A`     | `@`   | `185.199.111.153`               |
| `AAAA`  | `@`   | `2606:50c0:8000::153`           |
| `AAAA`  | `@`   | `2606:50c0:8001::153`           |
| `AAAA`  | `@`   | `2606:50c0:8002::153`           |
| `AAAA`  | `@`   | `2606:50c0:8003::153`           |
| `CNAME` | `www` | `saifulnizamnordin.github.io`   |

Then **Settings → Pages → Custom domain**: enter `suy.us`, save, wait for the DNS check, and tick **Enforce HTTPS**. If the DNS is on Cloudflare, keep these records **DNS only** until the certificate is issued.

## Renaming this repository

After renaming the repository on GitHub, update `repo` in [`src/site.ts`](src/site.ts) so the Submit buttons point at the new name. (GitHub redirects the old URL, but it's better not to rely on it.)

## Showcases

Showcases are per-user React components at `src/showcases/<username>/<name>/index.tsx` (default export), turned on with `showcases: [<name>]` in that user's portfolio file. They are discovered automatically — no registration step. The username folder is the ownership boundary:

- a portfolio can only render showcases from its own folder
- the PR check only lets a contributor touch their own folder, and statically blocks network calls, raw HTML, `eval` and imports outside `react`, `lucide-react`, `@/components/ui/*`, `@/lib/utils` and the showcase's own files
- the username sync renames the folder together with the portfolio file

The static checks are a first pass, not a sandbox: **read every showcase before merging**, since it runs on the suy.us origin.

All showcases are bundled into one client chunk today. If there get to be many, switch [`src/showcases/registry.ts`](src/showcases/registry.ts) to lazy loading.

Contributor docs: [SUBMISSION.md → Showcases](SUBMISSION.md#showcases).

## Brand

Logos, colours, pronunciation and usage rules live on the [media kit page](https://suy.us/brand). The files are in [`public/brand/`](public/brand/):

- `suyus-logo-*`: horizontal logo, in `color`, `color-on-dark`, `black` and `white`
- `suyus-mark-*`: square mark, in `color`, `black` and `white`
- `suyus-media-kit.zip`: everything, plus `BRAND.txt`

Each logo comes as .svg and transparent .png. The site header uses [`src/components/Logo.astro`](src/components/Logo.astro), the same artwork drawn inline so the wordmark follows light and dark mode.

## Sponsor

Suyus is free and has no ads. If it's useful to you, you can [sponsor it on GitHub](https://github.com/sponsors/saifulnizamnordin). [suy.us/sponsor](https://suy.us/sponsor) explains what sponsorship pays for. The **Sponsor** button on this repository comes from [`.github/FUNDING.yml`](.github/FUNDING.yml).
