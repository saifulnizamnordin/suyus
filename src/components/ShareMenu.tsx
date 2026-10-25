import { useEffect, useState, type ComponentType, type SVGProps } from "react"
import { Check, Link2, Mail, Share2, Smartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { FacebookIcon, LinkedinIcon, RedditIcon, TelegramIcon, WhatsappIcon, XIcon } from "@/components/icons"

type Props = {
  url: string
  title: string
}

type Service = {
  label: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  href: (url: string, title: string) => string
}

const e = encodeURIComponent

const groups: { label: string; services: Service[] }[] = [
  {
    label: "Professional",
    services: [
      { label: "LinkedIn", icon: LinkedinIcon, href: (u) => `https://www.linkedin.com/sharing/share-offsite/?url=${e(u)}` },
    ],
  },
  {
    label: "Messaging",
    services: [
      { label: "WhatsApp", icon: WhatsappIcon, href: (u, t) => `https://wa.me/?text=${e(`${t}\n${u}`)}` },
      { label: "Telegram", icon: TelegramIcon, href: (u, t) => `https://t.me/share/url?url=${e(u)}&text=${e(t)}` },
      { label: "Email", icon: Mail, href: (u, t) => `mailto:?subject=${e(t)}&body=${e(`${t}\n\n${u}`)}` },
    ],
  },
  {
    label: "Social",
    services: [
      { label: "X", icon: XIcon, href: (u, t) => `https://x.com/intent/post?url=${e(u)}&text=${e(t)}` },
      { label: "Facebook", icon: FacebookIcon, href: (u) => `https://www.facebook.com/sharer/sharer.php?u=${e(u)}` },
      { label: "Reddit", icon: RedditIcon, href: (u, t) => `https://www.reddit.com/submit?url=${e(u)}&title=${e(t)}` },
    ],
  },
]

export default function ShareMenu({ url, title }: Props) {
  const [canShareNatively, setCanShareNatively] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setCanShareNatively(typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches)
  }, [])

  async function copyLink(event: Event) {
    event.preventDefault() // keep the menu open to show the confirmation
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  async function shareNatively() {
    try {
      await navigator.share({ title, url })
    } catch {}
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="lg">
          <Share2 className="size-4" />
          Share
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {canShareNatively && (
          <>
            <DropdownMenuItem onSelect={shareNatively}>
              <Smartphone /> Share via…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        {groups.map((group) => (
          <DropdownMenuGroup key={group.label}>
            <DropdownMenuLabel className="text-xs text-muted-foreground">{group.label}</DropdownMenuLabel>
            {group.services.map(({ label, icon: Icon, href }) => (
              <DropdownMenuItem key={label} asChild>
                <a href={href(url, title)} target="_blank" rel="noopener noreferrer">
                  <Icon className="size-4" /> {label}
                </a>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={copyLink}>
          {copied ? <Check /> : <Link2 />}
          {copied ? "Link copied" : "Copy link"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
