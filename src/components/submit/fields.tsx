// Small building blocks for the submission form.
import { useId, type ReactNode } from "react"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface FieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: ReactNode
  placeholder?: string
  required?: boolean
  type?: string
  className?: string
}

export function TextField({ label, value, onChange, hint, placeholder, required, type = "text", className }: FieldProps) {
  const id = useId()
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-critical">*</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      <Input id={id} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

export function AreaField({ label, value, onChange, hint, placeholder, required, rows = 4, className }: FieldProps & { rows?: number }) {
  const id = useId()
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required ? <span className="text-critical">*</span> : <span className="font-normal text-muted-foreground">(optional)</span>}
      </Label>
      <Textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

/** A list of cards the user can add to, reorder and remove from. */
export function Repeater<T>({
  items,
  onChange,
  create,
  render,
  itemLabel,
  addLabel,
  empty,
}: {
  items: T[]
  onChange: (items: T[]) => void
  create: () => T
  render: (item: T, update: (patch: Partial<T>) => void, index: number) => ReactNode
  itemLabel: (item: T, index: number) => string
  addLabel: string
  empty?: ReactNode
}) {
  const move = (from: number, to: number) => {
    const next = [...items]
    const [x] = next.splice(from, 1)
    next.splice(to, 0, x)
    onChange(next)
  }
  return (
    <div className="space-y-3">
      {items.length === 0 && empty && <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">{empty}</p>}
      {items.map((item, i) => (
        <fieldset key={i} className="space-y-4 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <legend className="truncate text-sm font-medium">{itemLabel(item, i)}</legend>
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, i - 1)}>
                <ArrowUp />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>
                <ArrowDown />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove" onClick={() => onChange(items.filter((_, j) => j !== i))}>
                <Trash2 />
              </Button>
            </div>
          </div>
          {render(item, (patch) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x))), i)}
        </fieldset>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, create()])}>
        <Plus /> {addLabel}
      </Button>
    </div>
  )
}
