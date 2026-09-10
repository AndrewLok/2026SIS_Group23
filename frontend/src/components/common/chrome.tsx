/*
 * Panel chrome: the plates, placards and strips the instrument world is built
 * from. Nothing here is a card, and nothing nests inside anything else here.
 */

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { InstrumentTone, Trend } from '@/components/common/Instrument'
import { Instrument } from '@/components/common/Instrument'
import type { ExpenseCategory, IdeaCategory } from '@/types'

/** A bolted-on label plate. Sits under what it names, never above a heading. */
export function Placard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'placard inline-flex items-center justify-center rounded-sm border border-bezel px-2 py-1 text-[0.6875rem] leading-none',
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
 * A full-width reading. Label left, value right, supporting line beneath.
 * This is the shape the two questions get answered in.
 */
export function ReadingStrip({
  label,
  value,
  detail,
  tone = 'normal',
  action,
  className,
}: {
  label: string
  value: string
  detail: ReactNode
  tone?: InstrumentTone
  action?: ReactNode
  className?: string
}) {
  const color =
    tone === 'caution' ? 'var(--caution)' : tone === 'warning' ? 'var(--warning)' : 'var(--radium)'
  return (
    <section className={cn('plate px-5 py-4', className)}>
      <div className="flex items-baseline justify-between gap-4">
        <span className="placard text-xs">{label}</span>
        <span className="instrument-value text-2xl leading-none" style={{ color }}>
          {value}
        </span>
      </div>
      <div className="mt-2 text-sm text-muted-foreground">{detail}</div>
      {action ? <div className="mt-3">{action}</div> : null}
    </section>
  )
}

/** One gauge on the overview grid, and the link to the screen behind it. */
export function SectionTile({
  to,
  label,
  display,
  value,
  max,
  unit,
  tone = 'normal',
  cautionFrom,
  trend,
  className,
}: {
  to: string
  label: string
  display: string
  value: number
  max: number
  unit?: string
  tone?: InstrumentTone
  cautionFrom?: number
  trend?: Trend
  className?: string
}) {
  return (
    <Link
      to={to}
      className={cn(
        'plate group flex flex-col items-center gap-3 p-4 transition-colors hover:border-bezel-edge focus-visible:border-bezel-edge',
        className,
      )}
    >
      <Instrument
        display={display}
        value={value}
        max={max}
        unit={unit}
        tone={tone}
        cautionFrom={cautionFrom}
        trend={trend}
        size={124}
      />
      <div className="flex w-full flex-col items-center gap-1.5">
        <Placard className="w-full">{label}</Placard>
        {/* The unit lives here rather than on the dial, where it collided with the scale. */}
        {unit ? (
          <span className="placard text-center text-[0.5625rem] leading-tight">{unit}</span>
        ) : null}
      </div>
    </Link>
  )
}

const ideaVariants: Record<IdeaCategory, string> = {
  activity: 'border-radium/40 text-radium',
  food: 'border-caution/40 text-caution',
  stay: 'border-[color:var(--chart-3)]/40 text-[color:var(--chart-3)]',
  travel: 'border-[color:var(--chart-4)]/40 text-[color:var(--chart-4)]',
}

const expenseVariants: Record<ExpenseCategory, string> = {
  food: 'border-caution/40 text-caution',
  transport: 'border-[color:var(--chart-3)]/40 text-[color:var(--chart-3)]',
  tickets: 'border-[color:var(--chart-4)]/40 text-[color:var(--chart-4)]',
  stay: 'border-radium/40 text-radium',
  other: 'border-bezel-edge text-placard',
}

export function CategoryBadge({
  category,
  kind,
  className,
}: {
  category: IdeaCategory | ExpenseCategory
  kind: 'idea' | 'expense'
  className?: string
}) {
  const variant =
    kind === 'idea'
      ? ideaVariants[category as IdeaCategory]
      : expenseVariants[category as ExpenseCategory]
  return (
    <Badge
      variant="outline"
      className={cn('placard bg-transparent text-[0.625rem]', variant, className)}
    >
      {category}
    </Badge>
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
      <span className="placard flex items-center gap-2 text-[0.6875rem]">
        {Icon ? <Icon size={13} strokeWidth={1.75} aria-hidden="true" /> : null}
        {label}
      </span>
      <span className="tabular text-sm text-foreground">{value}</span>
    </div>
  )
}
