# Submit your portfolio to Suyus

Any GitHub user can add a portfolio. Your page lives at:

```
https://suy.us/p/<your-github-username>
```

A portfolio is one Markdown file in this repository, plus optional **showcases**: small interactive React sections for things Markdown can't show. You submit both with a pull request.

## What you can change

Everything you own is named after your GitHub username:

```
src/
├── content/portfolios/
│   └── <your-username>.md          ← your portfolio (required)
└── showcases/
    └── <your-username>/            ← your showcases (optional)
        └── <showcase-name>/
            ├── index.tsx           ← the component (default export)
            └── data.ts …           ← any other files it needs
```

A pull request may only add, change or delete files in those two places.

## Steps

1. **Fork** this repository.
2. **Copy the template** [`templates/portfolio.md`](templates/portfolio.md) to:

   ```
   src/content/portfolios/<your-github-username>.md
   ```

   Use your GitHub username **in lowercase**, for example `src/content/portfolios/octocat.md`.

3. **Fill it in.** The frontmatter (between the `---` lines) holds your details, experience, skills and projects. The Markdown below it becomes your **About me** section. Delete any optional section you don't need.
4. **Optional: add a showcase.** See [Showcases](#showcases) below.
5. **Preview locally** (recommended):

   ```sh
   npm install
   npm run dev
   ```

   Then open `http://localhost:4321/p/<your-github-username>/`.

6. **Open a pull request** from your fork.

Once the checks pass and a maintainer merges your PR, your page is published automatically.

## Showcases

A showcase is a React component that appears at the top of the **Portfolio** section of your page. Use it for something people can click: a demo, a simulation, a before/after toggle, a live-looking dashboard. The interactive CI/CD runner fleet on [`/p/saifulnizamnordin`](https://suy.us/p/saifulnizamnordin) is a showcase. Its source is in [`src/showcases/saifulnizamnordin/fpga-cicd/`](src/showcases/saifulnizamnordin/fpga-cicd/).

If you just want project cards with a summary, tags and stats, use `projects:` in your Markdown file instead. You don't need a showcase for that.

### Add one

1. **Copy the starter** [`templates/showcase/`](templates/showcase/) to your own folder, and pick a name in lowercase-with-dashes:

   ```
   src/showcases/<your-username>/<showcase-name>/index.tsx
   ```

   For example `src/showcases/octocat/pipeline-speedup/index.tsx`.

2. **Build your component** in `index.tsx`. It must `export default` a React component that takes no props:

   ```tsx
   import { useState } from "react"
   import { Button } from "@/components/ui/button"
   import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

   export default function PipelineSpeedup() {
     const [after, setAfter] = useState(true)
     return (
       <Card>
         <CardHeader>
           <CardTitle>Pipeline speed-up</CardTitle>
         </CardHeader>
         <CardContent className="space-y-3">
           <p className="text-3xl font-semibold">{after ? "11 min" : "42 min"}</p>
           <Button onClick={() => setAfter(!after)}>{after ? "Show before" : "Show after"}</Button>
         </CardContent>
       </Card>
     )
   }
   ```

   Split bigger showcases into more files in the same folder (`./data.ts`, `./Chart.tsx`, …) and import them with `./`.

3. **Turn it on** in your portfolio file. List the folder names in the order you want them shown:

   ```yaml
   showcases: [pipeline-speedup]
   ```

4. **Preview** with `npm run dev` and open your page. Check it in both light and dark mode (toggle at the top right) and at phone width.

### What a showcase can use

| Import | For |
| --- | --- |
| `react` | Hooks: `useState`, `useEffect`, `useReducer`, … |
| `lucide-react` | Icons ([lucide.dev/icons](https://lucide.dev/icons)) |
| `@/components/ui/<name>` | The site's [shadcn/ui](https://ui.shadcn.com) components: `button`, `card`, `badge`, `tabs`, `separator` |
| `@/lib/utils` | `cn()` for combining class names |
| `./anything` | Other files in your own showcase folder |

Style with **Tailwind classes** and the theme colours (`bg-card`, `text-muted-foreground`, `border`, `bg-primary`, …) so your showcase matches the site and works in dark mode. Avoid fixed colours like `bg-white` or `text-black`.

Allowed file types: `.tsx`, `.ts`, `.json`, and images (`.svg`, `.png`, `.jpg`, `.webp`, `.gif`). Keep images small.

### Showcase rules

Showcases run on Suyus for every visitor, so they're kept self-contained:

- **No network access:** no `fetch`, `XMLHttpRequest`, WebSockets or tracking. Put your data in the folder. Simulate "live" numbers instead of loading them.
- **No other packages.** Use only the imports in the table above. You can't add npm dependencies.
- **No raw HTML or code execution:** no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `<script>` or `<iframe>`.
- **No cookies, and nothing outside your own folder.** No `../` imports.
- **Label made-up numbers.** If your showcase simulates data, say so on screen (e.g. "Simulation for illustration").

The PR check enforces these automatically. A maintainer still reads every showcase before merging, and may ask for changes.

## Rules

- **One portfolio per GitHub account**, named after that account.
- **The pull request must come from the same GitHub account** as the file name and the showcase folder. You can't submit or edit someone else's portfolio or showcases.
- Only change your own portfolio file and your own `src/showcases/<your-username>/` folder.
- Keep it professional. No ads, no spam, nothing you don't have the right to publish.
- Everything you submit is public, including your email address if you add one.

## What the checks do

Every pull request that touches `src/content/portfolios/` or `src/showcases/` runs **Validate portfolio submission**:

| Check | What it means |
| --- | --- |
| Ownership | The PR only touches `src/content/portfolios/<you>.md` and `src/showcases/<you>/` |
| File name | Must be `<username>.md`, lowercase, a valid GitHub username |
| Account exists | The username must belong to a real GitHub account |
| `github` field | Must match the file name |
| `githubId` field | If you set it, must match your account's ID |
| Showcase layout | `src/showcases/<you>/<name>/index.tsx` with a default export, allowed file types |
| Showcase code | Only allowed imports; no network, raw HTML, `eval` or cookies |
| Build | The site must build: required fields and URLs are valid, and every name in `showcases` has a folder |

If a check fails, open the **Details** link on the check for the exact error.

## Fields

| Field | Required | Notes |
| --- | --- | --- |
| `name` | yes | Your display name |
| `github` | yes | Your GitHub username, lowercase. Must match the file name |
| `headline` | yes | One line under your name |
| `role` | | Current role, e.g. "Backend Engineer at Example Corp" |
| `location` | | |
| `email` | | Shown publicly as a mailto link |
| `linkedin`, `website` | | Full URLs starting with `https://` |
| `showcases` | | Names of your showcase folders, e.g. `[pipeline-speedup]` |
| `projects` | | Cards with `title`, `summary`, optional `url`, `tags` and `stats` |
| `experience` | | Companies, each with one or more `roles` |
| `skills` | | Groups of `name` + `items` |
| `education`, `certifications` | | |
| `githubId` | | Leave it out — it's filled in automatically |

Your profile photo comes from your GitHub avatar, so there's nothing to upload.

The schema that enforces all of this is in [`src/content.config.ts`](src/content.config.ts).

## Changing your GitHub username

You don't need to do anything. A scheduled job runs every day and looks up each portfolio by its **GitHub account ID**, which never changes:

- **You renamed your account:** the job opens a PR that renames your portfolio file **and your showcase folder**, updates `github`, and records the old name in `previousUsernames`. Once merged, your page moves to `/p/<new-username>/` and the old address redirects there.
- **Your account was deleted:** your portfolio is marked `status: inactive` and hidden from the site. If the account comes back, it's reactivated.

## Updating or removing your portfolio

Open another pull request that edits or deletes your file and showcase folder. The same checks apply.
