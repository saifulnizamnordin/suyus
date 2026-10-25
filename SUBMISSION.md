# Submit your portfolio to suy.us

Any GitHub user can add a portfolio. Your page lives at:

```
https://suy.us/p/<your-github-username>
```

Everything about it is one Markdown file in this repository, and you submit it with a pull request.

## Steps

1. **Fork** this repository.
2. **Copy the template** [`templates/portfolio.md`](templates/portfolio.md) to:

   ```
   src/content/portfolios/<your-github-username>.md
   ```

   Use your GitHub username **in lowercase**, for example `src/content/portfolios/octocat.md`.

3. **Fill it in.** The frontmatter (between the `---` lines) holds your details, experience, skills and projects. The Markdown below it becomes your **About me** section. Delete any optional section you don't need.
4. **Preview locally** (optional, but recommended):

   ```sh
   npm install
   npm run dev
   ```

   Then open `http://localhost:4321/p/<your-github-username>/`.

5. **Open a pull request** from your fork. Only add or change your own file.

Once the checks pass and a maintainer merges your PR, your page is published automatically.

## Rules

- **One portfolio per GitHub account**, named after that account.
- **The pull request must come from the same GitHub account** as the file name. You can't submit or edit someone else's portfolio.
- Only change files in `src/content/portfolios/`. PRs that touch other files will be asked to split them up.
- Keep it professional. No ads, no spam, nothing you don't have the right to publish.
- Everything in your file is public, including your email address if you add one.

## What the checks do

Every pull request that touches `src/content/portfolios/` runs **Validate portfolio submission**:

| Check | What it means |
| --- | --- |
| File name | Must be `<username>.md`, lowercase, a valid GitHub username |
| Account exists | The username must belong to a real GitHub account |
| `github` field | Must match the file name |
| `githubId` field | If you set it, must match your account's ID |
| Author | The PR author must be that GitHub account |
| Build | The site must build, so required fields and URLs must be valid |

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
| `projects` | | Cards with `title`, `summary`, optional `url`, `tags` and `stats` |
| `experience` | | Companies, each with one or more `roles` |
| `skills` | | Groups of `name` + `items` |
| `education`, `certifications` | | |
| `githubId` | | Leave it out — it's filled in automatically |

Your profile photo comes from your GitHub avatar, so there's nothing to upload.

The schema that enforces all of this is in [`src/content.config.ts`](src/content.config.ts).

## Changing your GitHub username

You don't need to do anything. A scheduled job runs every day and looks up each portfolio by its **GitHub account ID**, which never changes:

- **You renamed your account:** the job opens a PR that renames your file, updates `github`, and records the old name in `previousUsernames`. Once merged, your page moves to `/p/<new-username>/` and the old address redirects there.
- **Your account was deleted:** your portfolio is marked `status: inactive` and hidden from the site. If the account comes back, it's reactivated.

## Updating or removing your portfolio

Open another pull request that edits or deletes your file. The same checks apply.
