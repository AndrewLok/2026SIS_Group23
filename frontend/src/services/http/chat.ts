import { request, seg } from '@/services/http/request'
import type { Channel, Message } from '@/types'

type Unread = { count: number; firstUnreadId: string | null }

export const listChannels = (tripId: string): Promise<Channel[]> =>
  request('GET', `/trips/${seg(tripId)}/channels`)

export const listMessages = (channelId: string): Promise<Message[]> =>
  request('GET', `/channels/${seg(channelId)}/messages`)

export const send = (channelId: string, body: string): Promise<Message> =>
  request('POST', `/channels/${seg(channelId)}/messages`, { body })

/** The server works out unread from the signed-in session, so userId only keeps the signature. */
export async function unreadCount(channelId: string, _userId: string): Promise<number> {
  return (await request<Unread>('GET', `/channels/${seg(channelId)}/unread`)).count
}

export async function firstUnreadId(channelId: string, _userId: string): Promise<string | null> {
  return (await request<Unread>('GET', `/channels/${seg(channelId)}/unread`)).firstUnreadId
}

export const markRead = (channelId: string): Promise<void> =>
  request('POST', `/channels/${seg(channelId)}/read`)

/**
 * Polls for new messages and calls back when the list changes; returns an unsubscribe
 * function. Same contract as the mock's, so a socket can replace it later unseen.
 */
export function subscribe(channelId: string, onChange: (messages: Message[]) => void): () => void {
  let lastKey = ''
  let stopped = false
  const tick = async () => {
    try {
      const messages = await listMessages(channelId)
      const key = `${messages.length}:${messages.at(-1)?.id ?? ''}`
      if (!stopped && key !== lastKey) {
        lastKey = key
        onChange(messages)
      }
    } catch {
      // A missed poll is not worth surfacing; the next one will try again.
    }
  }
  void tick()
  const handle = setInterval(() => void tick(), 1500)
  return () => {
    stopped = true
    clearInterval(handle)
  }
}
