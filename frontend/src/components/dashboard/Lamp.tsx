/*
 * A warning lamp. Dark when there is nothing to do, lit amber with a count
 * when something is waiting on you. A lamp that is always on is not a lamp,
 * so each one lights from a single honest condition.
 *
 * Each symbol sits behind its own recessed lens, the way a telltale does, so
 * the strip reads as part of the cluster rather than as a second tab bar.
 */

import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Lamp({
  to,
  icon: Icon,
  label,
  count,
  lit,
  description,
}: {
  to: string
  icon: LucideIcon
  label: string
  /** Shown beside a lit lamp; omitted for a lamp that is simply on or off. */
  count?: number
  lit: boolean
  /** The whole state in words, for anyone not reading the lamp. */
  description: string
}) {
  return (
    <Link
      to={to}
      aria-label={description}
      className="group flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-md px-1 py-2"
    >
      <span className={cn('lamp-lens', lit && 'lamp-lens-lit')}>
        <span className={cn('flex items-center gap-1', lit ? 'lamp-lit' : 'lamp-off')}>
          <Icon size={20} strokeWidth={2.25} aria-hidden="true" />
          {lit && count !== undefined ? (
            <span className="tabular text-sm font-semibold leading-none">{count}</span>
          ) : null}
        </span>
      </span>
      <span
        className={cn(
          'placard text-xs leading-none transition-colors',
          lit ? 'text-caution' : 'opacity-75 group-hover:opacity-100',
        )}
        aria-hidden="true"
      >
        {label}
      </span>
    </Link>
  )
}
