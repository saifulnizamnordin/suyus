// Site-wide settings. Update `repoSlug` here if the GitHub repository is renamed.
const repoSlug = "saifulnizamnordin/suyus"
const repo = `https://github.com/${repoSlug}`

export const site = {
  name: "Suyus",
  domain: "suy.us",
  url: "https://suy.us",
  tagline: "Portfolios for everyone, written in Markdown.",
  description:
    "Free, open-source portfolio pages for anyone with a GitHub account. Fill in a form or submit one Markdown file, and get your own page at suy.us/p/<username>.",
  repo,
  repoSlug,
  /** Chooser between the form and the pull request route. */
  submitPath: "/submit",
  formPath: "/submit/form",
  /** GitHub Sponsors (also in .github/FUNDING.yml) and the page that explains it. */
  sponsorUrl: "https://github.com/sponsors/saifulnizamnordin",
  sponsorPath: "/sponsor",
  submissionUrl: `${repo}/blob/main/SUBMISSION.md`,
  templateUrl: `${repo}/blob/main/templates/portfolio.md`,
}

export const portfolioPath = (username: string) => `/p/${username}`
