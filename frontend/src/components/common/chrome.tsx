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
