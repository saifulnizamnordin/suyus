// Custom interactive sections, keyed by name. Each one belongs to a single portfolio:
// the `showcase` frontmatter field only renders it on the owner's page.
export const showcaseOwners = {
  "fpga-cicd": "saifulnizamnordin",
} as const

export type ShowcaseKey = keyof typeof showcaseOwners

export const showcaseKeys = Object.keys(showcaseOwners) as [ShowcaseKey, ...ShowcaseKey[]]
