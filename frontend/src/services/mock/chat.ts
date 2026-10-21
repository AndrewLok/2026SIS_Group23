import { latency, read, uid, write } from '@/services/mock/db'
import { ApiError, toChannel, toMessage } from '@/types'
import type { Channel, ChatReadState, Message } from '@/types'

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

/**
 * What this member has not seen in the channel: how many messages, and which one the unread
 * divider goes above (null when nothing is unread).
 *
 * The divider has to be resolved from the read marker rather than by counting back from the end:
 * the unread count skips your own messages, so an offset from the tail lands past the real
 * boundary whenever you have spoken recently.
 *
 * Async, like the real backend's version, because the backend is where the marker lives.
 */
export async function readState(channelId: string): Promise<ChatReadState> {
  await latency()
  const db = read()
  const userId = db.sessionUserId
  if (!userId) throw new ApiError('forbidden', 'Sign in to read the chat.')
  const lastRead = db.channelReads[`${userId}:${channelId}`]
  const unread = db.messages
    .filter(
      (m) =>
        m.channel_id === channelId &&
        m.author_id !== userId &&
        (!lastRead || m.created_at > lastRead),
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  return { unreadCount: unread.length, firstUnreadId: unread[0]?.id ?? null }
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
 * Stand-in for the live connection. Polls the store and calls back when the message list for
 * this channel changes; returns an unsubscribe function. Like the real one it only says "look
 * again" and carries no messages, so the screen refetches either way.
 */
export function subscribe(channelId: string, onChange: () => void): () => void {
  const count = () => read().messages.filter((m) => m.channel_id === channelId).length
  let last = count()
  const handle = setInterval(() => {
    const now = count()
    if (now !== last) {
      last = now
      onChange()
    }
  }, 1500)
  return () => clearInterval(handle)
}
