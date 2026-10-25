import type { ComponentType } from "react"

// Every showcase is a folder: src/showcases/<github-username>/<showcase-name>/index.tsx
// with a default-exported React component. The username folder is what ties a showcase
// to its owner: a portfolio can only use showcases from its own folder.
const modules = import.meta.glob<{ default: ComponentType }>("./*/*/index.tsx", { eager: true })

export function getShowcase(username: string, name: string): ComponentType | undefined {
  return modules[`./${username}/${name}/index.tsx`]?.default
}

export function showcasePath(username: string, name: string) {
  return `src/showcases/${username}/${name}/index.tsx`
}
