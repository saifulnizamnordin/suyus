# suy.us

Developer portfolios, written in Markdown. Live at **https://suy.us**.

Any GitHub user can add a portfolio by submitting one Markdown file. Each one gets a page at `https://suy.us/p/<github-username>`.

Built with [Astro](https://astro.build), [React](https://react.dev) and [shadcn/ui](https://ui.shadcn.com) (Tailwind CSS v4).

**Want to add yours? Read [SUBMISSION.md](SUBMISSION.md).**

## How it's organised

| Path | What it is |
| --- | --- |
| [`src/content/portfolios/`](src/content/portfolios/) | One `<username>.md` per person. Frontmatter = structured data, body = About section |
| [`templates/portfolio.md`](templates/portfolio.md) | Starting point for new submissions |
| [`src/content.config.ts`](src/content.config.ts) | Schema every portfolio is validated against at build time |
| [`src/pages/index.astro`](src/pages/index.astro) | Landing page and portfolio directory (`/`) |
| [`src/pages/p/[username].astro`](src/pages/p/[username].astro) | Portfolio page (`/p/<username>/`), plus redirects from previous usernames |
| [`src/showcases/`](src/showcases/) | Custom interactive sections, each tied to one portfolio via `showcase:` |
| [`src/site.ts`](src/site.ts) | Site name, repo URL and submission links |
| [`scripts/`](scripts/) | Submission check and username sync |

## Development

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # output in ./dist
npm run preview
```

## Automation

| Workflow | When | What it does |
| --- | --- | --- |
| [Deploy to GitHub Pages](.github/workflows/deploy.yml) | push to `main` | Builds and publishes the site |
| [Validate portfolio submission](.github/workflows/validate-submission.yml) | PRs touching `src/content/portfolios/` | Checks file name, GitHub account, `githubId`, PR author, then builds |
| [Sync portfolio usernames](.github/workflows/sync-usernames.yml) | daily 03:17 UTC, or manually | Follows each portfolio by GitHub account ID and opens a PR for renames, deleted accounts and missing IDs |

Run the sync locally without changing anything:

```sh
GITHUB_TOKEN=<token> node scripts/sync-usernames.mjs --dry-run
```

### One-time repository settings

1. **Settings → Pages → Source**: **GitHub Actions**.
2. **Settings → Actions → General → Workflow permissions**: tick **Allow GitHub Actions to create and approve pull requests** (needed by the username sync).
3. **Settings → Branches**: protect `main` and require the **Validate portfolio submission** check, so submissions can't be merged with failing checks.
4. Optionally, require approval for workflows from first-time contributors (**Settings → Actions → General → Fork pull request workflows**).

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

## Adding a showcase

A showcase is a custom React section for one person's portfolio, for things Markdown can't express (like the interactive CI/CD simulation on `/p/saifulnizamnordin`).

1. Add the component under `src/showcases/<key>/`.
2. Register `<key>` and its owner's username in [`src/showcases/keys.ts`](src/showcases/keys.ts).
3. Render it in [`src/pages/p/[username].astro`](src/pages/p/[username].astro).
4. Set `showcase: <key>` in the owner's portfolio file.
