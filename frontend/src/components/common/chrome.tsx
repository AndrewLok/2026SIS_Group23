/*
 * Panel chrome: the plates and placards the instrument world is built
 * from. Nothing here is a card, and nothing nests inside anything else here.
 *
 * The field stays achromatic on purpose. Radium marks a live reading, amber a
 * figure wanting attention, red destruction, and nothing else on screen carries
 * chroma — which is what makes the one signal colour impossible to miss.
 */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExpenseCategory, IdeaCategory } from '@/types'

/** A bolted-on label plate. Sits under what it names, never above a heading. */
export function Placard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'placard inline-flex items-center justify-center rounded-sm border border-bezel px-2 py-1 text-xs leading-none',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-bezel pb-5',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}

/**
 * Category chip. Deliberately achromatic: the category is carried by the word
 * itself in placard caps, not by a colour. A palette of category hues would put
 * four more chromatic things on a field whose whole point is that only the
 * signal colour is chromatic.
 */
export function CategoryBadge({
  category,
  className,
}: {
  category: IdeaCategory | ExpenseCategory
  /** Kept for call-site clarity; both kinds render identically by design. */
  kind?: 'idea' | 'expense'
  className?: string
}) {
  return (
    <span
      className={cn(
        'placard inline-flex items-center rounded-sm border border-bezel-edge px-2 py-1 text-xs leading-none',
        className,
      )}
    >
      {category}
    </span>
  )
}

/**
 * A small either-or switch, laid out as one strip. Behaves as a radio group:
 * arrow keys move the choice, and only the chosen option is a tab stop.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  const move = (step: number) => {
    const index = options.findIndex((o) => o.value === value)
    const next = options[(index + step + options.length) % options.length]
    if (next) onChange(next.value)
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('grid gap-1 rounded-lg border border-bezel p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          event.preventDefault()
          move(1)
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          event.preventDefault()
          move(-1)
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            ref={(node) => {
              // Follow the choice with focus when it moves by keyboard.
              if (selected && node && node.parentElement?.contains(document.activeElement)) {
                node.focus()
              }
            }}
            onClick={() => onChange(option.value)}
            className={cn(
              'min-h-10 rounded-md px-3 text-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              selected
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** A row of label and value with a hairline rule, as used down a spec panel. */
export function SpecRow({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string
  value: ReactNode
  icon?: LucideIcon
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 border-b border-bezel py-2.5 last:border-b-0',
        className,
      )}
    >
      <span className="placard flex items-center gap-2 text-xs">
        {Icon ? <Icon size={13} strokeWidth={1.75} aria-hidden="true" /> : null}
        {label}
      </span>
      <span className="tabular text-sm text-foreground">{value}</span>
    </div>
  )
}
