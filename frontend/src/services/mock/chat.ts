import { latency, read, uid, write } from '@/services/mock/db'
import { ApiError, toChannel, toMessage } from '@/types'
import type { Channel, Message } from '@/types'

export async function listChannels(tripId: string): Promise<Channel[]> {
  await latency()
  return read()
    .channels.filter((c) => c.trip_id === tripId)
    .map(toChannel)
}

export async function listMessages(channelId: string): Promise<Message[]> {
  await latency()
  return read()
    .messages.filter((m) => m.channel_id === channelId)
    .map(toMessage)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function send(channelId: string, body: string): Promise<Message> {
  await latency()
  const userId = read().sessionUserId
  if (!userId) throw new ApiError('forbidden', 'Sign in to send a message.')
  const trimmed = body.trim()
  if (!trimmed) throw new ApiError('invalid', 'Type something first.')
  const row = write((draft) => {
    const message = {
      id: uid(),
      channel_id: channelId,
      author_id: userId,
      body: trimmed,
      created_at: new Date().toISOString(),
    }
    draft.messages.push(message)
    return message
  })
  return toMessage(row)
}

/** How many messages this member has not seen in the channel. */
export function unreadCount(channelId: string, userId: string): number {
  const db = read()
  const lastRead = db.channelReads[`${userId}:${channelId}`]
  return db.messages.filter(
    (m) =>
      m.channel_id === channelId &&
      m.author_id !== userId &&
      (!lastRead || m.created_at > lastRead),
  ).length
}

/**
 * The message the unread divider goes above, or null when nothing is unread.
 *
 * This has to be resolved from the read marker rather than by counting back from
 * the end: the unread count skips your own messages, so an offset from the tail
 * lands past the real boundary whenever you have spoken recently.
 */
export function firstUnreadId(channelId: string, userId: string): string | null {
  const db = read()
  const lastRead = db.channelReads[`${userId}:${channelId}`]
  const ordered = db.messages
    .filter((m) => m.channel_id === channelId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  const first = ordered.find(
    (m) => m.author_id !== userId && (!lastRead || m.created_at > lastRead),
  )
  return first?.id ?? null
}

/** Called when the chat screen is opened, which is what clears the tile count. */
export async function markRead(channelId: string): Promise<void> {
  const userId = read().sessionUserId
  if (!userId) return
  write((draft) => {
    draft.channelReads[`${userId}:${channelId}`] = new Date().toISOString()
  })
}

/**
 * Stand-in for a live subscription. Polls the store and calls back when the
 * message list for this channel changes; returns an unsubscribe function.
 * A real backend swaps this for a WebSocket or STOMP subscription without the
 * chat screen changing.
 */
export function subscribe(channelId: string, onChange: (messages: Message[]) => void): () => void {
  let lastCount = -1
  const tick = () => {
    const messages = read()
      .messages.filter((m) => m.channel_id === channelId)
      .map(toMessage)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    if (messages.length !== lastCount) {
      lastCount = messages.length
      onChange(messages)
    }
  }
  tick()
  const handle = setInterval(tick, 1500)
  return () => clearInterval(handle)
}
