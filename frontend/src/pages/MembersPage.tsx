import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, Link2, LogOut, RefreshCw, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { MemberAvatar } from '@/components/common/people'
import { PageHeader, Placard } from '@/components/common/chrome'
import { ListSkeleton, QueryBoundary } from '@/components/common/state'
import {
  useExpenses,

  useMembers,
  useRegenerateCode,
  useRemoveMember,
  useTrip,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'

import { formatMoney, splitEvenly } from '@/lib/money'
import { formatDayLong } from '@/lib/dates'
import { totalSpent } from '@/lib/balances'

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
          toast.success(`${label} copied`)
          setTimeout(() => setCopied(false), 1800)
        } catch {
          toast.error('Your browser would not let us copy that.')
        }
      }}
    >
      {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
      {copied ? 'Copied' : `Copy ${label.toLowerCase()}`}
    </Button>
  )
}

export function MembersPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const userId = useCurrentUserId()
  const navigate = useNavigate()

  const trip = useTrip(tripId)
  const members = useMembers(tripId)
  const expenses = useExpenses(tripId)


  const regenerate = useRegenerateCode(tripId)
  const removeMember = useRemoveMember(tripId)

  const isOwner = members.data?.find((m) => m.userId === userId)?.role === 'owner'
  const joinLink = trip.data ? `${window.location.origin}/join/${trip.data.inviteCode}` : ''

  const spent = totalSpent(expenses.data ?? [])
  const memberIds = (members.data ?? []).map((m) => m.userId)

  /** What each head carries if the group shrinks by one. */
  const splitAfterRemoval = (): string => {
    const remaining = Math.max(1, memberIds.length - 1)
    const parts = splitEvenly(spent, remaining)
    return formatMoney(parts[0] ?? 0)
  }

  const currentSplit = (): string => {
    const parts = splitEvenly(spent, Math.max(1, memberIds.length))
    return formatMoney(parts[0] ?? 0)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Members"
        subtitle="Anyone with the code can join, and joining puts them in every even split from then on."
      />

      <section className="plate flex flex-col gap-4 p-5">
        <span className="placard text-xs">Invite code</span>
        <p className="instrument-value select-all text-4xl leading-none tracking-[0.18em] text-radium">
          {trip.data?.inviteCode ?? '------'}
        </p>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={trip.data?.inviteCode ?? ''} label="Code" />
          <CopyButton value={joinLink} label="Link" />
          {isOwner ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-placard"
              disabled={regenerate.isPending}
              onClick={async () => {
                await regenerate.mutateAsync()
                toast.success('New code generated. The old one stops working.')
              }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Regenerate
            </Button>
          ) : null}
        </div>
        <p className="flex items-start gap-2 text-xs text-muted-foreground">
          <Link2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span className="break-all">{joinLink}</span>
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <span className="placard text-xs">On this trip</span>
          <span className="tabular text-xs text-muted-foreground">
            {currentSplit()} each of {formatMoney(spent)} so far
          </span>
        </div>

        <QueryBoundary query={members} loading={<ListSkeleton rows={4} />}>
          {(list) => (
            <ul className="flex flex-col gap-2">
              {list.map((member) => {
                const isSelf = member.userId === userId
                const canRemove = isOwner && !isSelf
                return (
                  <li key={member.userId} className="plate flex items-center gap-3 px-4 py-3">
                    <MemberAvatar profile={member.profile} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.profile.displayName}
                        {isSelf ? <span className="text-placard"> (you)</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        Joined {formatDayLong(member.joinedAt)}
                      </p>
                    </div>
                    {member.role === 'owner' ? (
                      <Badge variant="outline" className="placard border-radium/40 text-[0.625rem] text-radium">
                        owner
                      </Badge>
                    ) : null}
                    {canRemove ? (
                      <RemoveMemberDialog
                        name={member.profile.displayName}
                        currentSplit={currentSplit()}
                        nextSplit={splitAfterRemoval()}
                        onConfirm={async () => {
                          await removeMember.mutateAsync(member.userId)
                          toast.success(`${member.profile.displayName} removed. Splits updated.`)
                        }}
                      />
                    ) : null}
                    {isSelf && !isOwner ? (
                      <LeaveTripDialog
                        onConfirm={async () => {
                          await removeMember.mutateAsync(userId)
                          toast.success('You have left the trip.')
                          navigate('/trips', { replace: true })
                        }}
                      />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </QueryBoundary>
      </section>

      <Placard className="self-start">Even splits only</Placard>
      <p className="-mt-3 text-xs text-muted-foreground">
        Removing someone recalculates every balance on the trip. Fuel legs keep their own rider
        list, so they only change if the person removed was riding.
      </p>
    </div>
  )
}

function RemoveMemberDialog({
  name,
  currentSplit,
  nextSplit,
  onConfirm,
}: {
  name: string
  currentSplit: string
  nextSplit: string
  onConfirm: () => Promise<void>
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-placard">
          <UserMinus size={15} aria-hidden="true" />
          <span className="sr-only">Remove {name}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name} from this trip?</AlertDialogTitle>
          <AlertDialogDescription>
            Every balance recalculates. The per-head split on what has been spent so far goes from{' '}
            <span className="tabular text-foreground">{currentSplit}</span> to{' '}
            <span className="tabular text-caution">{nextSplit}</span>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep them</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>Remove {name}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function LeaveTripDialog({ onConfirm }: { onConfirm: () => Promise<void> }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-placard">
          <LogOut size={15} aria-hidden="true" />
          <span className="sr-only">Leave this trip</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave this trip?</AlertDialogTitle>
          <AlertDialogDescription>
            You come out of every split from here on. Anything already settled between you and the
            others is not undone, so square up first if you owe anyone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Stay</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>Leave trip</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
