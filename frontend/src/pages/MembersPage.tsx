import * as React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Copy, Crown, Link2, LogOut, RefreshCw, UserMinus } from 'lucide-react'
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
  useUpdateRole,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'

import { formatMoney, splitEvenly } from '@/lib/money'
import { formatDayLong } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
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
  // Live: who is an owner, and who has joined or gone, changes under an open screen.
  const members = useMembers(tripId, true)
  const expenses = useExpenses(tripId)


  const regenerate = useRegenerateCode(tripId)
  const removeMember = useRemoveMember(tripId)
  const updateRole = useUpdateRole(tripId)

  const isOwner = members.data?.find((m) => m.userId === userId)?.role === 'owner'
  const ownerCount = (members.data ?? []).filter((m) => m.role === 'owner').length
  // A trip always keeps an owner, so the last one has to hand over before leaving or stepping down.
  const otherOwnerExists = ownerCount > 1
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
                try {
                  await regenerate.mutateAsync()
                  toast.success('New code generated. The old one stops working.')
                } catch (error) {
                  toast.error(messageFor(error, 'Could not make a new code.'))
                }
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
                const makeOwner = member.role !== 'owner'
                // An owner can change anyone's role, their own included once somebody else is an owner.
                const canChangeRole = isOwner && (!isSelf || otherOwnerExists) && (makeOwner || otherOwnerExists)
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
                      <Badge variant="outline" className="placard border-radium/40 text-xs text-radium">
                        owner
                      </Badge>
                    ) : null}
                    {canChangeRole ? (
                      <RoleDialog
                        name={member.profile.displayName}
                        isSelf={isSelf}
                        makeOwner={makeOwner}
                        onConfirm={async () => {
                          const role = makeOwner ? 'owner' : 'member'
                          try {
                            await updateRole.mutateAsync({ userId: member.userId, role })
                            toast.success(
                              makeOwner
                                ? `${member.profile.displayName} is now an owner.`
                                : isSelf
                                  ? 'You are no longer an owner.'
                                  : `${member.profile.displayName} is no longer an owner.`,
                            )
                          } catch (error) {
                            toast.error(messageFor(error, 'Could not change that role.'))
                          }
                        }}
                      />
                    ) : null}
                    {canRemove ? (
                      <RemoveMemberDialog
                        name={member.profile.displayName}
                        currentSplit={currentSplit()}
                        nextSplit={splitAfterRemoval()}
                        onConfirm={async () => {
                          try {
                            await removeMember.mutateAsync(member.userId)
                            toast.success(`${member.profile.displayName} removed. Splits updated.`)
                          } catch (error) {
                            toast.error(messageFor(error, `Could not remove ${member.profile.displayName}.`))
                          }
                        }}
                      />
                    ) : null}
                    {isSelf && (!isOwner || otherOwnerExists) ? (
                      <LeaveTripDialog
                        onConfirm={async () => {
                          try {
                            await removeMember.mutateAsync(userId)
                            toast.success('You have left the trip.')
                            navigate('/trips', { replace: true })
                          } catch (error) {
                            toast.error(messageFor(error, 'Could not leave the trip.'))
                          }
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

      {isOwner && !otherOwnerExists && memberIds.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          You are the only owner, so you cannot leave yet. Make someone else an owner first.
        </p>
      ) : null}

      <Placard className="self-start">Even splits only</Placard>
      <p className="-mt-3 text-xs text-muted-foreground">
        Removing someone recalculates every balance on the trip. Fuel legs keep their own rider
        list, so they only change if the person removed was riding.
      </p>
    </div>
  )
}

function RoleDialog({
  name,
  isSelf,
  makeOwner,
  onConfirm,
}: {
  name: string
  isSelf: boolean
  makeOwner: boolean
  onConfirm: () => Promise<void>
}) {
  const label = makeOwner ? `Make ${name} an owner` : isSelf ? 'Step down as owner' : `Make ${name} a member`
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8 shrink-0 text-placard">
          <Crown size={15} aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>
            {makeOwner
              ? 'Owners can change the trip’s name, dates and budget cap, make a new invite code, remove people and change roles, including yours.'
              : isSelf
                ? 'You will stay on the trip as a member and lose those powers. Another owner can make you one again.'
                : `${name} stays on the trip as a member and loses those powers.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void onConfirm()}>{label}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
