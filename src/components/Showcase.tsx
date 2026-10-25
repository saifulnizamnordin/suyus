import { getShowcase } from "@/showcases/registry"

// One island for every showcase. Astro can only hydrate components it imports statically,
// so this wrapper is the hydrated component and it looks the showcase up by its props.
export default function Showcase({ username, name }: { username: string; name: string }) {
  const Component = getShowcase(username, name)
  return Component ? <Component /> : null
}
