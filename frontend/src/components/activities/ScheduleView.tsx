/*
 * The day grid: one column per day, hours running down, so the white space
 * between things reads as the free time it is. Hovering an empty stretch
 * offers to put an activity there to the group.
 */

import * as React from 'react'
import { format, isToday } from 'date-fns'
import { Plus } from 'lucide-react'
import { MemberAvatar } from '@/components/common/people'
import { formatTime } from '@/lib/dates'
import {
  WAKING_END_HOUR,
  WAKING_START_HOUR,
  endOf,
  formatMinutes,
  freeGaps,
  layoutDay,
  minutesIn,
} from '@/lib/schedule'
import type { Placed, ScheduleEntry, Span } from '@/lib/schedule'

const HOUR = 60 * 60 * 1000
const HOUR_PX = 48
const SLOT_MINUTES = 30
const SLOT_PX = (HOUR_PX * SLOT_MINUTES) / 60
/** Anything this long is a stay or a hire, not something that fills the day. */
const BANNER_AFTER = 12 * HOUR
const ADD_BUTTON_PX = 108
/** Gaps shorter than this are left unlabelled; they read as white space anyway. */
const LABEL_GAP_MINUTES = 60

const atHour = (day: Date, hour: number): number => {
  const d = new Date(day)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

type Column = {
  day: Date
  dayStart: number
  banners: ScheduleEntry[]
  placed: Placed<ScheduleEntry>[]
  gaps: Span[]
  freeMinutes: number
}

function buildColumn(day: Date, entries: ScheduleEntry[]): Column {
  const dayStart = atHour(day, 0)
  const dayEnd = atHour(day, 24)
  const banners: ScheduleEntry[] = []
  const timed: (Span & { item: ScheduleEntry })[] = []

  for (const entry of entries) {
    const start = Date.parse(entry.startsAt)
    const end = endOf(entry.startsAt, entry.endsAt)
    if (end <= dayStart || start >= dayEnd) continue
    if (entry.allDay || end - start >= BANNER_AFTER) banners.push(entry)
    else timed.push({ start: Math.max(start, dayStart), end: Math.min(end, dayEnd), item: entry })
  }

  // Free time counts what is actually happening; a proposal is not yet.
  const gaps = freeGaps(
    timed.filter((t) => t.item.kind !== 'proposal'),
    { start: atHour(day, WAKING_START_HOUR), end: atHour(day, WAKING_END_HOUR) },
  )
  return {
    day,
    dayStart,
    banners,
    placed: layoutDay(timed),
    gaps,
    freeMinutes: gaps.reduce((sum, g) => sum + minutesIn(g), 0),
  }
}

const toPx = (ms: number): number => (ms / HOUR) * HOUR_PX

type Hover = { day: number; minutes: number; x: number; columnWidth: number }

export function ScheduleView({
  days,
  entries,
  onAdd,
  onOpen,
}: {
  days: Date[]
  entries: ScheduleEntry[]
  /** Called with the start of the slot that was picked. */
  onAdd: (start: Date) => void
  onOpen: (entry: ScheduleEntry) => void
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const bodyRef = React.useRef<HTMLDivElement>(null)
  const [hover, setHover] = React.useState<Hover | null>(null)

  const columns = React.useMemo(() => days.map((day) => buildColumn(day, entries)), [days, entries])

  // Open on the morning rather than at midnight.
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = (WAKING_START_HOUR - 1) * HOUR_PX
  }, [])

  const slotAt = (event: React.MouseEvent): Hover | null => {
    const body = bodyRef.current
    if (!body || days.length === 0) return null
    const rect = body.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const columnWidth = rect.width / days.length
    const day = Math.min(days.length - 1, Math.max(0, Math.floor(x / columnWidth)))
    const minutes = Math.min(
      24 * 60 - SLOT_MINUTES,
      Math.max(0, Math.floor(y / SLOT_PX) * SLOT_MINUTES),
    )
    return { day, minutes, x, columnWidth }
  }

  const startOf = (slot: Hover): Date => {
    const d = new Date(days[slot.day] ?? new Date())
    d.setHours(0, slot.minutes, 0, 0)
    return d
  }

  const onMove = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-add]')) return
    if (target.closest('[data-entry]')) {
      setHover(null)
      return
    }
    const next = slotAt(event)
    // The button settles where the slot was entered, so moving across to it
    // does not chase it away.
    setHover((prev) =>
      prev && next && prev.day === next.day && prev.minutes === next.minutes ? prev : next,
    )
  }

  const onPick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest('[data-entry]') || target.closest('[data-add]')) return
    // A tap on a touch screen has no hover first, so the slot comes from the tap.
    const slot = slotAt(event)
    if (slot) onAdd(startOf(slot))
  }

  const addLeft = hover
    ? Math.max(
        hover.day * hover.columnWidth + 2,
        Math.min(hover.x + 12, (hover.day + 1) * hover.columnWidth - ADD_BUTTON_PX - 4),
      )
    : 0

  return (
    <div className="flex flex-col gap-3">
      <div className="plate overflow-hidden p-0">
        <div ref={scrollRef} className="relative max-h-[70vh] overflow-auto overscroll-contain">
          <div
            className="grid min-w-max"
            style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(8.5rem, 1fr))` }}
          >
            {/* Day headings, pinned while the hours scroll under them. */}
            <div className="sticky top-0 left-0 z-30 border-b border-bezel bg-face" />
            {columns.map((col) => (
              <div
                key={col.dayStart}
                className="sticky top-0 z-20 flex min-w-0 flex-col gap-1 border-b border-l border-bezel bg-face px-2 py-2"
              >
                <span
                  className={`placard text-xs ${isToday(col.day) ? 'text-radium' : 'text-foreground'}`}
                >
                  {format(col.day, 'EEE d MMM')}
                </span>
                <span className="tabular caption text-muted-foreground">
                  {col.freeMinutes === 0 ? 'No free time' : `${formatMinutes(col.freeMinutes)} free`}
                </span>
                {col.banners.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => onOpen(entry)}
                    title={entry.title}
                    className="truncate rounded-sm border-l-2 bg-face-raised px-1.5 py-0.5 text-left text-[0.7rem]"
                    style={{ borderLeftColor: entry.color }}
                  >
                    {entry.title}
                  </button>
                ))}
              </div>
            ))}

            {/* Hour labels. */}
            <div className="sticky left-0 z-10 bg-face" style={{ height: 24 * HOUR_PX }}>
              {Array.from({ length: 24 }, (_, h) => (
                <span
                  key={h}
                  className="tabular absolute right-1.5 -translate-y-1/2 text-[0.65rem] text-muted-foreground"
                  style={{ top: h * HOUR_PX }}
                >
                  {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                </span>
              ))}
            </div>

            <div
              ref={bodyRef}
              className="relative grid cursor-pointer"
              style={{
                gridColumn: `2 / span ${days.length}`,
                gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))`,
                height: 24 * HOUR_PX,
              }}
              onMouseMove={onMove}
              onMouseLeave={() => setHover(null)}
              onClick={onPick}
            >
              {columns.map((col) => (
                <div
                  key={col.dayStart}
                  className="relative border-l border-bezel"
                  style={{
                    backgroundImage: `repeating-linear-gradient(to bottom, var(--bezel) 0 1px, transparent 1px ${HOUR_PX}px)`,
                  }}
                >
                  {/* Outside waking hours is dimmed; it is not counted as free. */}
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 bg-panel/50"
                    style={{ height: WAKING_START_HOUR * HOUR_PX }}
                  />
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 bg-panel/50"
                    style={{ height: (24 - WAKING_END_HOUR) * HOUR_PX }}
                  />

                  {col.gaps
                    .filter((gap) => minutesIn(gap) >= LABEL_GAP_MINUTES)
                    .map((gap) => (
                      <span
                        key={gap.start}
                        className="placard caption pointer-events-none absolute inset-x-0 -translate-y-1/2 text-center text-placard/60"
                        style={{ top: toPx((gap.start + gap.end) / 2 - col.dayStart) }}
                      >
                        {formatMinutes(minutesIn(gap))} free
                      </span>
                    ))}

                  {col.placed.map((p) => {
                    const lane = 100 / p.columns
                    const proposal = p.item.kind === 'proposal'
                    const height = Math.max(toPx(p.end - p.start), 22)
                    return (
                      <button
                        key={p.item.id}
                        type="button"
                        data-entry
                        onClick={() => onOpen(p.item)}
                        title={`${p.item.title}${p.item.people.length ? ` · ${p.item.people.map((m) => m.displayName).join(', ')}` : ''}`}
                        className="absolute z-[5] flex flex-col overflow-hidden rounded-sm border border-l-[3px] px-1.5 py-1 text-left text-xs transition-colors hover:brightness-125"
                        style={{
                          top: toPx(p.start - col.dayStart) + 1,
                          height: height - 2,
                          left: `calc(${p.column * lane}% + 2px)`,
                          width: `calc(${lane}% - 4px)`,
                          borderColor: p.item.color,
                          borderStyle: proposal ? 'dashed' : 'solid',
                          background: proposal
                            ? 'var(--face)'
                            : `color-mix(in oklab, ${p.item.color} 16%, var(--face-raised))`,
                        }}
                      >
                        <span className="truncate font-medium leading-tight">{p.item.title}</span>
                        <span className="tabular truncate text-[0.65rem] text-muted-foreground">
                          {formatTime(new Date(p.start).toISOString())}
                          {proposal ? ' · vote' : ''}
                        </span>
                        {height >= 64 && p.item.people.length > 0 ? (
                          <span className="mt-auto flex flex-wrap gap-0.5 pt-1">
                            {p.item.people.map((m) => (
                              <MemberAvatar key={m.id} profile={m} size={16} />
                            ))}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              ))}

              {hover ? (
                <>
                  <div
                    className="pointer-events-none absolute z-[4] rounded-sm border border-radium/50 bg-radium/10 px-1.5 text-[0.65rem] leading-6 text-radium"
                    style={{
                      top: (hover.minutes / 60) * HOUR_PX,
                      height: SLOT_PX,
                      left: hover.day * hover.columnWidth + 1,
                      width: hover.columnWidth - 2,
                    }}
                  >
                    <span className="tabular">{format(startOf(hover), 'HH:mm')}</span>
                  </div>
                  <button
                    type="button"
                    data-add
                    onClick={(event) => {
                      event.stopPropagation()
                      onAdd(startOf(hover))
                    }}
                    className="absolute z-20 inline-flex h-6 items-center gap-1 rounded-md bg-primary px-2 text-xs font-medium whitespace-nowrap text-primary-foreground shadow-md"
                    style={{ top: (hover.minutes / 60) * HOUR_PX, left: addLeft }}
                  >
                    <Plus size={12} aria-hidden="true" />
                    Add activity
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border-l-[3px] border-radium bg-radium/20" />
          On the plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border border-dashed border-radium" />
          Up for a vote
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm border-l-[3px] border-foreground bg-face-raised" />
          Booking
        </span>
        <span>
          Free time counts {WAKING_START_HOUR}:00 to {WAKING_END_HOUR}:00. Hover or tap an empty
          slot to put an activity to a vote.
        </span>
      </div>
    </div>
  )
}
