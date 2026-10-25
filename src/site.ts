// Site-wide settings. Update `repo` here if the GitHub repository is renamed.
const repo = "https://github.com/saifulnizamnordin/portfolio"

export const site = {
  name: "suy.us",
  url: "https://suy.us",
  tagline: "Developer portfolios, written in Markdown.",
  description:
    "Open-source portfolio pages for GitHub users. Submit one Markdown file and get your own page at suy.us/p/<username>.",
  repo,
  submissionUrl: `${repo}/blob/main/SUBMISSION.md`,
  templateUrl: `${repo}/blob/main/templates/portfolio.md`,
}

export const portfolioPath = (username: string) => `/p/${username}/`
