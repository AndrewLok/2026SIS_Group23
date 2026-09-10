/*
 * The four states every list screen has to handle: loading, empty, loaded, error.
 *
 * QueryBoundary makes that structural rather than a thing each screen remembers,
 * so a screen cannot ship with a spinner and no error case.
 */

import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function EmptyState({
  icon: Icon,
  line,
  action,
  className,
}: {
  icon: LucideIcon
  line: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'plate flex flex-col items-center gap-4 px-6 py-10 text-center',
        className,
      )}
    >
      <span className="recessed flex size-12 items-center justify-center rounded-full text-placard">
        <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="max-w-[36ch] text-sm text-muted-foreground">{line}</p>
      {action}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn('plate flex flex-col items-center gap-4 px-6 py-10 text-center', className)}>
      <span className="recessed flex size-12 items-center justify-center rounded-full text-caution">
        <AlertTriangle size={20} strokeWidth={1.75} aria-hidden="true" />
      </span>
      <p className="max-w-[40ch] text-sm text-muted-foreground">{message}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw size={14} aria-hidden="true" />
          Try again
        </Button>
      ) : null}
    </div>
  )
}

export function ListSkeleton({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-[var(--radius)]" />
      ))}
    </div>
  )
}

export type QueryBoundaryProps<T> = {
  query: UseQueryResult<T>
  /** Shown while the first load is in flight. */
  loading?: ReactNode
  /** Decides whether the loaded result counts as empty. */
  isEmpty?: (data: T) => boolean
  empty?: ReactNode
  children: (data: T) => ReactNode
}

export function QueryBoundary<T>({
  query,
  loading,
  isEmpty,
  empty,
  children,
}: QueryBoundaryProps<T>) {
  if (query.isPending) return <>{loading ?? <ListSkeleton />}</>

  if (query.isError) {
    const message =
      query.error instanceof Error
        ? query.error.message
        : 'Something went wrong loading this.'
    return <ErrorState message={message} onRetry={() => void query.refetch()} />
  }

  const data = query.data as T
  if (empty && isEmpty?.(data)) return <>{empty}</>
  return <>{children(data)}</>
}
