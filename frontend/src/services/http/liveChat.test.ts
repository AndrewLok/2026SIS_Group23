/*
 * The shared chat connection against a fake WebSocket and fake timers: who gets nudged, and what
 * happens when the connection drops, cannot connect, or has nobody left to serve.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

class FakeSocket {
  static instances: FakeSocket[] = []
  static failToConstruct = false

  url: string
  sent: Array<Record<string, unknown>> = []
  closed = false
  onopen: (() => void) | null = null
  onmessage: ((event: { data: unknown }) => void) | null = null
  onclose: (() => void) | null = null
  onerror: (() => void) | null = null

  constructor(url: string) {
    if (FakeSocket.failToConstruct) throw new SyntaxError('bad url')
    this.url = url
    FakeSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(JSON.parse(data) as Record<string, unknown>)
  }

  close() {
    this.closed = true
  }

  /* What the network and the server do. */
  open() {
    this.onopen?.()
  }
  receive(frame: unknown) {
    this.onmessage?.({ data: typeof frame === 'string' ? frame : JSON.stringify(frame) })
  }
  drop() {
    this.onclose?.()
  }
}

type Live = typeof import('@/services/http/liveChat')
let live: Live

const sockets = () => FakeSocket.instances
const latest = () => FakeSocket.instances[FakeSocket.instances.length - 1]!

beforeEach(async () => {
  vi.useFakeTimers()
  FakeSocket.instances = []
  FakeSocket.failToConstruct = false
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.stubGlobal('location', { protocol: 'http:', host: 'localhost:5173' })
  // The module keeps its connection in module state, so each test gets a fresh copy.
  vi.resetModules()
  live = await import('@/services/http/liveChat')
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('connecting', () => {
  it('opens one socket on the same host, however many channels listen, and subscribes each once it is open', () => {
    live.subscribeToChannel('ch-1', () => {})
    live.subscribeToChannel('ch-2', () => {})

    expect(sockets()).toHaveLength(1)
    expect(latest().url).toBe('ws://localhost:5173/ws/chat')
    expect(latest().sent).toEqual([]) // nothing can be sent before it is open

    latest().open()

    expect(latest().sent).toEqual([
      { type: 'subscribe', channelId: 'ch-1' },
      { type: 'subscribe', channelId: 'ch-2' },
    ])
  })

  it('uses wss when the page is on https', () => {
    vi.stubGlobal('location', { protocol: 'https:', host: 'voyager.example' })

    live.subscribeToChannel('ch-1', () => {})

    expect(latest().url).toBe('wss://voyager.example/ws/chat')
  })

  it('subscribes at once when a channel is added to a connection that is already open', () => {
    live.subscribeToChannel('ch-1', () => {})
    latest().open()

    live.subscribeToChannel('ch-2', () => {})
    live.subscribeToChannel('ch-2', () => {}) // a second listener on the same channel needs nothing more

    expect(sockets()).toHaveLength(1)
    expect(latest().sent).toEqual([
      { type: 'subscribe', channelId: 'ch-1' },
      { type: 'subscribe', channelId: 'ch-2' },
    ])
  })

  it('pings while connected so a proxy does not drop an idle connection', () => {
    live.subscribeToChannel('ch-1', () => {})
    latest().open()
    latest().sent = []

    vi.advanceTimersByTime(25_000)
    expect(latest().sent).toEqual([{ type: 'ping' }])
    vi.advanceTimersByTime(25_000)
    expect(latest().sent).toEqual([{ type: 'ping' }, { type: 'ping' }])
  })
})

describe('being told', () => {
  it('nudges only the listeners of the channel that has news', () => {
    const one = vi.fn()
    const alsoOne = vi.fn()
    const two = vi.fn()
    live.subscribeToChannel('ch-1', one)
    live.subscribeToChannel('ch-1', alsoOne)
    live.subscribeToChannel('ch-2', two)
    latest().open()

    latest().receive({ type: 'message', channelId: 'ch-1', messageId: 'm-9' })

    expect(one).toHaveBeenCalledTimes(1)
    expect(alsoOne).toHaveBeenCalledTimes(1)
    expect(two).not.toHaveBeenCalled()
  })

  it('also nudges when the server confirms a subscription, to close the gap before it was listening', () => {
    const listener = vi.fn()
    live.subscribeToChannel('ch-1', listener)
    latest().open()

    latest().receive({ type: 'subscribed', channelId: 'ch-1' })

    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('ignores pongs, errors, unknown channels and anything that is not a frame', () => {
    const listener = vi.fn()
    live.subscribeToChannel('ch-1', listener)
    latest().open()

    latest().receive({ type: 'pong' })
    latest().receive({ type: 'error', code: 'not_found', channelId: 'ch-1' })
    latest().receive({ type: 'message', channelId: 'someone-else' })
    latest().receive({ type: 'message', channelId: 42 })
    latest().receive('not json')
    latest().receive('null')
    latest().receive('[]')
    latest().onmessage?.({ data: new ArrayBuffer(4) })

    expect(listener).not.toHaveBeenCalled()
  })

  it('lets one listener leave without disturbing the other', () => {
    const staying = vi.fn()
    const leaving = vi.fn()
    live.subscribeToChannel('ch-1', staying)
    const stop = live.subscribeToChannel('ch-1', leaving)
    latest().open()
    latest().sent = []

    stop()
    stop() // leaving twice does nothing
    latest().receive({ type: 'message', channelId: 'ch-1' })

    expect(leaving).not.toHaveBeenCalled()
    expect(staying).toHaveBeenCalledTimes(1)
    expect(latest().sent).toEqual([]) // the channel still has a listener, so it stays subscribed
    expect(latest().closed).toBe(false)
  })
})

describe('leaving', () => {
  it('tells the server when the last listener of a channel goes, and closes the socket when nobody listens at all', () => {
    const stopOne = live.subscribeToChannel('ch-1', () => {})
    const stopTwo = live.subscribeToChannel('ch-2', () => {})
    latest().open()
    latest().sent = []

    stopOne()
    expect(latest().sent).toEqual([{ type: 'unsubscribe', channelId: 'ch-1' }])
    expect(latest().closed).toBe(false)

    stopTwo()
    expect(latest().closed).toBe(true)
  })

  it('stops all timers when idle: no retries, no polling, no pings', () => {
    const stop = live.subscribeToChannel('ch-1', () => {})
    const first = latest()
    first.open()
    stop()
    const count = sockets().length

    vi.advanceTimersByTime(120_000)

    expect(sockets()).toHaveLength(count)
    expect(first.sent.filter((frame) => frame.type === 'ping')).toEqual([])
  })

  it('opens a fresh connection when something listens again', () => {
    live.subscribeToChannel('ch-1', () => {})()
    expect(sockets()).toHaveLength(1)

    live.subscribeToChannel('ch-1', () => {})

    expect(sockets()).toHaveLength(2)
    expect(latest().closed).toBe(false)
  })

  it('ignores whatever a closed socket says afterwards', () => {
    const listener = vi.fn()
    const stop = live.subscribeToChannel('ch-1', listener)
    const old = latest()
    old.open()
    stop()

    old.receive({ type: 'message', channelId: 'ch-1' })
    old.drop()
    vi.advanceTimersByTime(60_000)

    expect(listener).not.toHaveBeenCalled()
    expect(sockets()).toHaveLength(1)
  })
})

describe('when the connection is lost', () => {
  it('is not confused by a late close from a socket it already replaced', () => {
    const listener = vi.fn()
    live.subscribeToChannel('ch-1', listener)
    const first = latest()
    first.open()
    first.drop()
    vi.advanceTimersByTime(1_000)
    const second = latest()
    second.open()

    first.drop() // the old one reports its close again, late
    vi.advanceTimersByTime(60_000)

    expect(second.closed).toBe(false)
    expect(sockets()).toHaveLength(2)
    second.receive({ type: 'message', channelId: 'ch-1' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('reconnects, resubscribes, and asks everyone to look again, since messages may have been missed', () => {
    const listener = vi.fn()
    live.subscribeToChannel('ch-1', listener)
    latest().open()
    latest().drop()

    vi.advanceTimersByTime(1_000)
    expect(sockets()).toHaveLength(2)
    latest().open()
    expect(latest().sent).toEqual([{ type: 'subscribe', channelId: 'ch-1' }])

    latest().receive({ type: 'subscribed', channelId: 'ch-1' })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('checks every few seconds while there is no connection, and stops once it is back', () => {
    const listener = vi.fn()
    live.subscribeToChannel('ch-1', listener)
    latest().open()
    latest().drop()

    vi.advanceTimersByTime(4_999)
    expect(listener).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(listener).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1_000) // the retry fires and the new socket opens
    latest().open()
    listener.mockClear()
    vi.advanceTimersByTime(30_000)

    expect(listener).not.toHaveBeenCalled()
  })

  it('backs off between failed attempts and starts again from the short delay after a success', () => {
    live.subscribeToChannel('ch-1', () => {})
    const attempt = (waitMs: number) => {
      const before = sockets().length
      vi.advanceTimersByTime(waitMs - 1)
      expect(sockets()).toHaveLength(before)
      vi.advanceTimersByTime(1)
      expect(sockets()).toHaveLength(before + 1)
    }

    latest().drop() // never connected
    attempt(1_000)
    latest().drop()
    attempt(2_000)
    latest().drop()
    attempt(4_000)
    latest().drop()
    attempt(8_000)
    latest().drop()
    attempt(15_000)
    latest().drop()
    attempt(15_000) // capped

    latest().open() // a success resets it
    latest().drop()
    attempt(1_000)
  })

  it('still works, by polling, when a socket cannot even be created', () => {
    FakeSocket.failToConstruct = true
    const listener = vi.fn()
    live.subscribeToChannel('ch-1', listener)
    expect(sockets()).toHaveLength(0)

    vi.advanceTimersByTime(5_000)
    expect(listener).toHaveBeenCalledTimes(1)

    // Retries went at 1s and 3s and failed; the next is due at 7s, and this time it can connect.
    FakeSocket.failToConstruct = false
    vi.advanceTimersByTime(2_000)
    expect(sockets()).toHaveLength(1)
  })

  it('polls while a connection is still opening, then stops as soon as it opens', () => {
    const listener = vi.fn()
    live.subscribeToChannel('ch-1', listener)

    vi.advanceTimersByTime(5_000)
    expect(listener).toHaveBeenCalledTimes(1)

    latest().open()
    listener.mockClear()
    vi.advanceTimersByTime(30_000)
    expect(listener).not.toHaveBeenCalled()
  })
})
