import * as React from 'react'
import { useParams } from 'react-router-dom'
import { Loader2, MessagesSquare, SendHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MemberAvatar } from '@/components/common/people'
import { EmptyState, ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import {
  useChannels,
  useChatLive,
  useMarkChatRead,
  useMembers,
  useMessages,
  useSendMessage,
} from '@/hooks/queries'
import { useCurrentUserId } from '@/hooks/useSession'
import { api } from '@/services/client'
import { dayKey, formatDay, formatTime } from '@/lib/dates'
import { messageFor } from '@/lib/errors'
import type { Message, Profile } from '@/types'

/** The server's limit on one message (backend ChatService.MAX_BODY_LENGTH). The box stops typing here. */
const MESSAGE_MAX = 2000

/**
 * Multiple channels ship later. The list is built now behind this flag so adding
 * them is a data change rather than a rebuild of this screen.
 */
const MULTIPLE_CHANNELS_ENABLED = false

function ChannelList({ names }: { names: string[] }) {
  if (!MULTIPLE_CHANNELS_ENABLED) return null
  return (
    <ul className="flex gap-2 overflow-x-auto pb-2">
      {names.map((name) => (
        <li key={name}>
          <span className="placard rounded-sm border border-bezel px-2 py-1 text-xs">
            {name}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Consecutive messages from one person on one day read as a single block. */
function groupMessages(messages: Message[]) {
  const groups: { authorId: string; day: string; messages: Message[] }[] = []
  for (const message of messages) {
    const day = dayKey(message.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.authorId === message.authorId && last.day === day) {
      last.messages.push(message)
    } else {
      groups.push({ authorId: message.authorId, day, messages: [message] })
    }
  }
  return groups
}

export function ChatPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const userId = useCurrentUserId()
  const channels = useChannels(tripId)
  const members = useMembers(tripId)
  const channelId = channels.data?.[0]?.id
  const messages = useMessages(channelId)
  const send = useSendMessage(channelId ?? '')

  const [draft, setDraft] = React.useState('')
  const bottomRef = React.useRef<HTMLDivElement>(null)

  const profiles = React.useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.profile])),
    [members.data],
  )

  useChatLive(channelId)
  const markRead = useMarkChatRead(channelId)

  /*
   * Where the divider goes is read once, on arrival, and held in state: marking the channel read
   * is what clears it, so asking again later would always come back empty and the divider would
   * vanish while you were still looking at it. The cancelled flag keeps a stale answer (from a
   * previous channel, or a first effect run that React threw away) from being used.
   */
  const [divider, setDivider] = React.useState<{ channelId: string; messageId: string | null } | null>(null)
  React.useEffect(() => {
    if (!channelId) return
    let cancelled = false
    api.chat.readState(channelId).then(
      (state) => {
        if (!cancelled) setDivider({ channelId, messageId: state.firstUnreadId })
      },
      () => {
        // No divider is better than no chat.
        if (!cancelled) setDivider({ channelId, messageId: null })
      },
    )
    return () => {
      cancelled = true
    }
  }, [channelId])
  const dividerReady = divider !== null && divider.channelId === channelId
  const dividerId = dividerReady ? divider.messageId : null

  // Once the divider is fixed, whatever is on screen counts as read, including messages that
  // arrive while you are here. Marking read first would have wiped the divider.
  React.useEffect(() => {
    if (!dividerReady) return
    void markRead().catch(() => {})
  }, [dividerReady, messages.data?.length, markRead])

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.data?.length])

  if (channels.isPending || members.isPending || messages.isPending || (channelId && !dividerReady)) {
    return <ListSkeleton rows={5} />
  }

  // A failed load must say so rather than falling through to an empty state.
  const queries = [channels, members, messages]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const all = messages.data ?? []
  const groups = groupMessages(all)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const body = draft.trim()
    if (!body || !channelId) return
    setDraft('')
    try {
      await send.mutateAsync(body)
    } catch (error) {
      // Say why, in the server's words when it has some ("That message is too long..."), and put
      // the text back so nothing typed is lost. If more has been typed since, the old text goes first.
      toast.error(messageFor(error, 'Could not send that. Your message is still in the box.'))
      setDraft((current) => (current ? `${body}\n${current}` : body))
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col gap-4">
      <ChannelList names={(channels.data ?? []).map((c) => c.name)} />

      {all.length === 0 ? (
        <EmptyState icon={MessagesSquare} line="Nothing said yet. Start it off." />
      ) : (
        <ul className="flex flex-1 flex-col gap-5">
          {groups.map((group, groupIndex) => {
            const profile: Profile | undefined = profiles.get(group.authorId)
            const mine = group.authorId === userId
            const showDay =
              groupIndex === 0 || groups[groupIndex - 1]?.day !== group.day
            const carriesDivider = group.messages.some((m) => m.id === dividerId)

            return (
              <React.Fragment key={`${group.authorId}-${group.messages[0]?.id}`}>
                {showDay ? (
                  <li className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
                    <span className="placard caption">
                      {formatDay(group.messages[0]?.createdAt ?? '')}
                    </span>
                    <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
                  </li>
                ) : null}

                {carriesDivider ? (
                  <li className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-caution/50" aria-hidden="true" />
                    <span className="placard caption text-caution">New</span>
                    <span className="h-px flex-1 bg-caution/50" aria-hidden="true" />
                  </li>
                ) : null}

                <li className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                  {profile ? <MemberAvatar profile={profile} size={30} /> : null}
                  <div className={`flex min-w-0 flex-col gap-1 ${mine ? 'items-end' : ''}`}>
                    <span className="placard caption">
                      {mine ? 'You' : (profile?.displayName ?? 'Someone')} ·{' '}
                      {formatTime(group.messages[0]?.createdAt ?? '')}
                    </span>
                    {group.messages.map((message) => (
                      <p
                        key={message.id}
                        className={[
                          'max-w-[46ch] rounded-md px-3 py-2 text-sm break-words whitespace-pre-wrap',
                          mine
                            ? 'bg-bezel text-foreground'
                            : 'border border-bezel bg-face text-foreground',
                        ].join(' ')}
                      >
                        {message.body}
                      </p>
                    ))}
                  </div>
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      )}

      <div ref={bottomRef} />

      <form
        onSubmit={submit}
        className="sticky bottom-0 flex items-end gap-2 border-t border-bezel bg-panel pt-3"
      >
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void submit(e)
            }
          }}
          rows={1}
          maxLength={MESSAGE_MAX}
          placeholder="Message the group"
          className="max-h-32 min-h-10 flex-1 resize-none"
          aria-label="Message"
        />
        <Button type="submit" size="icon" disabled={send.isPending || draft.trim() === ''}>
          {send.isPending ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <SendHorizontal size={15} aria-hidden="true" />
          )}
          <span className="sr-only">Send</span>
        </Button>
      </form>
    </div>
  )
}
