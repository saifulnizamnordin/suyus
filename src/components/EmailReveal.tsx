import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Copy, LoaderCircle, Mail, RotateCcw, Send, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type Turnstile = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: Turnstile
  }
}

const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
let scriptPromise: Promise<Turnstile> | undefined

// Turnstile is only loaded once someone asks for the address, so normal page views stay light.
function loadTurnstile() {
  scriptPromise ??= new Promise<Turnstile>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile)
    const script = document.createElement("script")
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile failed to load")))
    script.onerror = () => {
      scriptPromise = undefined
      reject(new Error("Turnstile failed to load"))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

type Status = "loading" | "challenge" | "verifying" | "revealed" | "error"

type Props = {
  name: string
  ciphertext: string
  apiUrl: string
  siteKey: string
  variant?: "button" | "link"
}

export default function EmailReveal({ name, ciphertext, apiUrl, siteKey, variant = "button" }: Props) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Status>("loading")
  const [email, setEmail] = useState<string>()
  const [error, setError] = useState<string>()
  const [copied, setCopied] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const widgetRef = useRef<HTMLDivElement>(null)

  const reveal = useCallback(
    async (token: string) => {
      setStatus("verifying")
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, ciphertext }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || typeof data.email !== "string") throw new Error(data.error ?? "Couldn't reveal the address")
        setEmail(data.email)
        setStatus("revealed")
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't reveal the address")
        setStatus("error")
      }
    },
    [apiUrl, ciphertext]
  )

  useEffect(() => {
    if (!open || email) return
    let widgetId: string | undefined
    let cancelled = false
    setStatus("loading")
    setError(undefined)
    loadTurnstile()
      .then((turnstile) => {
        if (cancelled || !widgetRef.current) return
        widgetId = turnstile.render(widgetRef.current, {
          sitekey: siteKey,
          action: "reveal-email",
          theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
          callback: (token: string) => reveal(token),
          "error-callback": () => {
            setError("The check couldn't complete. Please try again.")
            setStatus("error")
          },
          "expired-callback": () => setStatus("challenge"),
        })
        setStatus("challenge")
      })
      .catch(() => {
        setError("The verification service couldn't load. Check your connection or ad blocker and try again.")
        setStatus("error")
      })
    return () => {
      cancelled = true
      if (widgetId) window.turnstile?.remove(widgetId)
    }
  }, [open, email, siteKey, reveal, attempt])

  async function copy() {
    if (!email) return
    try {
      await navigator.clipboard.writeText(email)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "button" ? (
          <Button size="lg" variant="outline">
            <Mail className="size-4" />
            Email
          </Button>
        ) : (
          <button type="button" className="inline-flex items-center gap-1 hover:text-foreground">
            <Mail className="size-3.5" /> Email
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Email {name}</DialogTitle>
          <DialogDescription>
            {email
              ? "Here's the address. Please don't share it publicly."
              : "Complete the quick check below to see the email address. This keeps it away from spam bots."}
          </DialogDescription>
        </DialogHeader>

        {email ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
              <ShieldCheck className="size-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate font-mono text-sm select-all">{email}</span>
              <Button size="icon-sm" variant="ghost" onClick={copy} aria-label="Copy email address">
                {copied ? <Check /> : <Copy />}
              </Button>
            </div>
            <Button asChild className="w-full">
              <a href={`mailto:${email}`}>
                <Send /> Send email
              </a>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div ref={widgetRef} className={cn("flex min-h-[65px] justify-center", status === "error" && "hidden")} />
            {(status === "loading" || status === "verifying") && (
              <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin" />
                {status === "loading" ? "Loading check…" : "Verifying…"}
              </p>
            )}
            {status === "error" && (
              <div className="space-y-3 text-center">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                  <RotateCcw /> Try again
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
