/*
 * The live connection for chat: one WebSocket to the backend (/ws/chat), shared by every screen
 * that is listening, however many channels that is.
 *
 * The socket carries no messages. The server only says "something new in this channel", and the
 * screen then fetches over plain requests. That keeps one path for reading messages, and means a
 * missed nudge costs nothing: the next fetch gets everything.
 *
 * Things that go wrong on a phone are expected here, not exceptional:
 *   - The connection drops (a tunnel, a proxy timeout, the server restarting). It reconnects with
 *     a growing delay, and asks every listener to look again once it is back, because anything
 *     sent in the gap was missed.
 *   - It cannot connect at all (a network that blocks sockets). Listeners are nudged every few
 *     seconds instead, so chat still arrives, only slower.
 *   - Nothing is listening. The socket is closed, and opened again when something listens.
 *
 * What goes over the wire is documented on the backend's ChatSocketHandler.
 */

type Listener = () => void

const PING_MS = 25_000
const POLL_MS = 5_000
const RETRY_MS = [1_000, 2_000, 4_000, 8_000, 15_000]

const listeners = new Map<string, Set<Listener>>()

let socket: WebSocket | null = null
let connected = false
let failures = 0
let retryTimer: ReturnType<typeof setTimeout> | undefined
let pingTimer: ReturnType<typeof setInterval> | undefined
let pollTimer: ReturnType<typeof setInterval> | undefined

const socketUrl = (): string =>
  `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws/chat`

function nudge(channelId: string): void {
  for (const listener of [...(listeners.get(channelId) ?? [])]) listener()
}

function nudgeAll(): void {
  for (const channelId of [...listeners.keys()]) nudge(channelId)
}

function transmit(ws: WebSocket, frame: object): void {
  try {
    ws.send(JSON.stringify(frame))
  } catch {
    // The socket closed under us. Its close handler deals with it.
  }
}

/* While there is no socket, ask on a timer. */

function startPolling(): void {
  if (pollTimer === undefined) pollTimer = setInterval(nudgeAll, POLL_MS)
}

function stopPolling(): void {
  if (pollTimer !== undefined) clearInterval(pollTimer)
  pollTimer = undefined
}

/* The socket */

function scheduleRetry(): void {
  if (retryTimer !== undefined || listeners.size === 0) return
  const delay = RETRY_MS[Math.min(failures, RETRY_MS.length - 1)] ?? 15_000
  failures += 1
  retryTimer = setTimeout(() => {
    retryTimer = undefined
    connect()
  }, delay)
}

function dropSocket(): void {
  connected = false
  if (pingTimer !== undefined) clearInterval(pingTimer)
  pingTimer = undefined
  const old = socket
  socket = null
  try {
    old?.close()
  } catch {
    // Already closed.
  }
}

function connect(): void {
  if (socket || listeners.size === 0) return

  let ws: WebSocket
  try {
    ws = new WebSocket(socketUrl())
  } catch {
    startPolling()
    scheduleRetry()
    return
  }
  socket = ws
  startPolling()

  ws.onopen = () => {
    if (socket !== ws) return
    connected = true
    failures = 0
    stopPolling()
    for (const channelId of listeners.keys()) transmit(ws, { type: 'subscribe', channelId })
    pingTimer = setInterval(() => transmit(ws, { type: 'ping' }), PING_MS)
  }

  ws.onmessage = (event: MessageEvent) => {
    if (socket !== ws || typeof event.data !== 'string') return
    let frame: unknown
    try {
      frame = JSON.parse(event.data)
    } catch {
      return
    }
    if (typeof frame !== 'object' || frame === null) return
    const { type, channelId } = frame as { type?: unknown; channelId?: unknown }
    if (typeof channelId !== 'string') return
    // "subscribed" also nudges: a message may have landed between the screen's last fetch and the
    // server starting to listen, and this is the moment that gap closes (first connect or reconnect).
    if (type === 'message' || type === 'subscribed') nudge(channelId)
  }

  ws.onclose = () => {
    if (socket !== ws) return
    dropSocket()
    if (listeners.size > 0) {
      startPolling()
      scheduleRetry()
    }
  }

  // An error is always followed by a close, which does the work.
  ws.onerror = () => {}
}

function disconnectIfIdle(): void {
  if (listeners.size > 0) return
  stopPolling()
  if (retryTimer !== undefined) clearTimeout(retryTimer)
  retryTimer = undefined
  failures = 0
  dropSocket()
}

/**
 * Call `listener` whenever something new may be in this channel. Returns the unsubscribe function.
 * Many listeners can share one channel; the connection is shared by all of them.
 */
export function subscribeToChannel(channelId: string, listener: Listener): () => void {
  let set = listeners.get(channelId)
  const isNew = !set
  if (!set) {
    set = new Set()
    listeners.set(channelId, set)
  }
  set.add(listener)

  if (socket && connected) {
    if (isNew) transmit(socket, { type: 'subscribe', channelId })
  } else {
    connect()
  }

  return () => {
    const current = listeners.get(channelId)
    if (!current?.delete(listener)) return
    if (current.size === 0) {
      listeners.delete(channelId)
      if (socket && connected) transmit(socket, { type: 'unsubscribe', channelId })
    }
    disconnectIfIdle()
  }
}
