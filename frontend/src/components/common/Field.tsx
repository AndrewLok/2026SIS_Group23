/*
 * Form field wrapper. shadcn's `form` is not in this registry, and a hand-rolled
 * one suits the panel anyway: the label is a placard, and the error names the
 * problem rather than just going red.
 */

import type { ReactNode } from 'react'
import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string
  /** Says what the app will and will not do with this, where that is not obvious. */
  hint?: string
  error?: string
  required?: boolean
  children: (props: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id} className="placard text-xs">
        {label}
        {required ? <span className="text-placard"> *</span> : null}
      </Label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-caution">
          {error}
        </p>
      ) : null}
    </div>
  )
}
