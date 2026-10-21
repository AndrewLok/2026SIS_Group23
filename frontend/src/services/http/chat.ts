/*
 * Chat against the Spring backend (/api/trips/{id}/channels, /api/channels/*), with the same
 * signatures as services/mock/chat.ts so client.ts can swap one for the other.
 *
 * Messages travel over plain requests. The live part (hearing about a new message without
 * asking) is services/http/liveChat.ts, which only says "look again".
 */

import { subscribeToChannel } from '@/services/http/liveChat'
import {
  isNumber,
  isRecord,
  isString,
  isStringOrNull,
  readJson,
  request,
  UNEXPECTED_MESSAGE,
} from '@/services/http/request'
import { ApiError } from '@/types'
import type { Channel, ChatReadState, Message } from '@/types'

const unexpected = (): ApiError => new ApiError('unavailable', UNEXPECTED_MESSAGE)

function parseChannel(data: unknown): Channel {
  if (!isRecord(data) || !isString(data.id) || !isString(data.tripId) || !isString(data.name)) {
    throw unexpected()
  }
  return { id: data.id, tripId: data.tripId, name: data.name }
}

function parseMessage(data: unknown): Message {
  if (
    !isRecord(data) ||
    !isString(data.id) ||
    !isString(data.channelId) ||
    !isString(data.authorId) ||
    !isString(data.body) ||
    !isString(data.createdAt)
  ) {
    throw unexpected()
  }
  return {
    id: data.id,
    channelId: data.channelId,
    authorId: data.authorId,
    body: data.body,
    createdAt: data.createdAt,
  }
}

function parseReadState(data: unknown): ChatReadState {
  if (!isRecord(data) || !isNumber(data.unreadCount) || !isStringOrNull(data.firstUnreadId)) {
    throw unexpected()
  }
  return { unreadCount: data.unreadCount, firstUnreadId: data.firstUnreadId }
}

const parseList = <T>(data: unknown, parseOne: (item: unknown) => T): T[] => {
  if (!Array.isArray(data)) throw unexpected()
  return data.map(parseOne)
}

const channelPath = (channelId: string): string => `/channels/${encodeURIComponent(channelId)}`

export async function listChannels(tripId: string): Promise<Channel[]> {
  const response = await request('GET', `/trips/${encodeURIComponent(tripId)}/channels`)
  return parseList(await readJson(response), parseChannel)
}

/** Oldest first. */
export async function listMessages(channelId: string): Promise<Message[]> {
  const response = await request('GET', `${channelPath(channelId)}/messages`)
  return parseList(await readJson(response), parseMessage)
}

export async function send(channelId: string, body: string): Promise<Message> {
  const response = await request('POST', `${channelPath(channelId)}/messages`, { body })
  return parseMessage(await readJson(response))
}

/** How many messages this member has not seen, and where the "New" divider goes. */
export async function readState(channelId: string): Promise<ChatReadState> {
  const response = await request('GET', `${channelPath(channelId)}/read-state`)
  return parseReadState(await readJson(response))
}

/** "I have seen everything up to now." Kept on the server, so it follows you between devices. */
export async function markRead(channelId: string): Promise<void> {
  await request('POST', `${channelPath(channelId)}/read`)
}

/** Calls back whenever something new may be in the channel. Returns the unsubscribe function. */
export function subscribe(channelId: string, onChange: () => void): () => void {
  return subscribeToChannel(channelId, onChange)
}
