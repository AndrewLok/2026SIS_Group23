/*
 * Money on screen and money typed in.
 *
 * The wording of a balance lives here and nowhere else, so "you owe" never
 * drifts into an accusation on one screen and a shrug on another. The tone is
 * the instrument's: amber is a reading that wants attention, not a telling-off.
 */

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatMoney, parseMoneyToCents } from '@/lib/money'

export type MoneyTextProps = {
  cents: number
  /** Colour by position: positive is owed to you, negative is owing. */
  colored?: boolean
  signed?: boolean
  className?: string
}

export function MoneyText({ cents, colored = false, signed = false, className }: MoneyTextProps) {
  const tone = !colored
    ? undefined
    : cents > 0
      ? 'var(--radium)'
      : cents < 0
        ? 'var(--caution)'
        : 'var(--placard)'
  return (
    <span className={cn('tabular', className)} style={tone ? { color: tone } : undefined}>
      {formatMoney(cents, { signed })}
    </span>
  )
}

/** One sentence saying where a member stands. Plain, blunt, never guilt-tripping. */
export function BalanceSentence({ cents, className }: { cents: number; className?: string }) {
  if (cents === 0) {
    return <span className={className}>You are square with everyone.</span>
  }
  if (cents > 0) {
    return (
      <span className={className}>
        You are owed <MoneyText cents={cents} colored />
      </span>
    )
  }
  return (
    <span className={className}>
      You owe <MoneyText cents={Math.abs(cents)} colored={false} className="text-caution" />
    </span>
  )
}

export type MoneyInputProps = {
  /** Value in cents, or null while the field is empty. */
  valueCents: number | null
  onChangeCents: (cents: number | null) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
}

/**
 * Accepts dollars, stores cents, never a float. Keeps the raw keystrokes while
 * the field is focused so a half-typed "42." is not rewritten under the cursor.
 */
export function MoneyInput({
  valueCents,
  onChangeCents,
  id,
  placeholder = '0.00',
  disabled,
  className,
  ...aria
}: MoneyInputProps) {
  /*
   * The draft holds raw keystrokes only while the field is being edited, so a
   * half-typed "42." is not rewritten under the cursor. Outside editing the
   * value is derived from the prop during render rather than synced by an
   * effect, which would otherwise fight whoever owns the value.
   */
  const [draft, setDraft] = React.useState<string | null>(null)
  const formatted = valueCents === null ? '' : (valueCents / 100).toFixed(2)
  const raw = draft ?? formatted

  return (
    <div className={cn('relative', className)}>
      <span
        className="placard pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs"
        aria-hidden="true"
      >
        $
      </span>
      <Input
        id={id}
        value={raw}
        disabled={disabled}
        placeholder={placeholder}
        inputMode="decimal"
        autoComplete="off"
        className="pl-7 font-mono tabular-nums"
        onFocus={() => setDraft(raw)}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const next = event.target.value
          setDraft(next)
          onChangeCents(next.trim() === '' ? null : parseMoneyToCents(next))
        }}
        {...aria}
      />
    </div>
  )
}
