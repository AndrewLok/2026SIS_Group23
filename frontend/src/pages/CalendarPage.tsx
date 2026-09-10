import * as React from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { format } from 'date-fns'
import { CalendarDays, ChevronLeft, ChevronRight, Plane } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { PageHeader, Placard, SpecRow } from '@/components/common/chrome'
import { EmptyState, ListSkeleton, ScreenError, anyFailed } from '@/components/common/state'
import { useBookings, useIdeas } from '@/hooks/queries'
import { sourceColor, sourceLabel, toCalendarItems } from '@/lib/calendar'
import type { CalendarItem } from '@/lib/calendar'
import { dayKey, formatDay, formatDayTime, formatTime } from '@/lib/dates'

function ItemPip({ item }: { item: CalendarItem }) {
  return (
    <span
      className="block size-1.5 rounded-full"
      style={{ backgroundColor: sourceColor[item.source] }}
      aria-hidden="true"
    />
  )
}

function AgendaView({
  items,
  onOpen,
  tripId,
}: {
  items: CalendarItem[]
  onOpen: (item: CalendarItem) => void
  tripId: string
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        line="Nothing agreed yet. Once enough of you are for an idea it lands here, along with any booking that has a time."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/trips/${tripId}/voting`}>Go to voting</Link>
          </Button>
        }
      />
    )
  }

  // Group by day so a scrolling read has somewhere to breathe between days.
  const byDay = new Map<string, CalendarItem[]>()
  for (const item of items) {
    const key = dayKey(item.startsAt)
    byDay.set(key, [...(byDay.get(key) ?? []), item])
  }

  return (
    <div className="flex flex-col gap-6">
      {[...byDay.entries()].map(([key, dayItems]) => (
        <section key={key} className="flex flex-col gap-2">
          <div className="flex items-baseline gap-3">
            <h2 className="placard text-xs">{formatDay(dayItems[0]?.startsAt ?? key)}</h2>
            <span className="h-px flex-1 bg-bezel" aria-hidden="true" />
          </div>
          <ul className="flex flex-col gap-2">
            {dayItems.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onOpen(item)}
                  className="plate flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:border-bezel-edge"
                >
                  <span
                    className="h-9 w-0.5 shrink-0 rounded-full"
                    style={{ backgroundColor: sourceColor[item.source] }}
                    aria-hidden="true"
                  />
                  <span className="tabular w-12 shrink-0 text-sm text-muted-foreground">
                    {item.allDay ? 'All' : formatTime(item.startsAt)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="placard block text-xs">
                      {sourceLabel[item.source]}
                      {item.belongsTo ? ' · personal' : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function MonthView({
  items,
  onOpen,
}: {
  items: CalendarItem[]
  onOpen: (item: CalendarItem) => void
}) {
  const [month, setMonth] = React.useState(() =>
    items.length > 0 ? startOfMonth(parseISO(items[0]!.startsAt)) : startOfMonth(new Date()),
  )
  const [selected, setSelected] = React.useState<Date | null>(null)

  const grid = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  const itemsOn = (day: Date) =>
    items.filter((item) => isSameDay(parseISO(item.startsAt), day))

  const selectedItems = selected ? itemsOn(selected) : []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="icon" onClick={() => setMonth(subMonths(month, 1))}>
          <ChevronLeft size={16} aria-hidden="true" />
          <span className="sr-only">Previous month</span>
        </Button>
        <h2 className="text-sm font-medium">{format(month, 'MMMM yyyy')}</h2>
        <Button variant="ghost" size="icon" onClick={() => setMonth(addMonths(month, 1))}>
          <ChevronRight size={16} aria-hidden="true" />
          <span className="sr-only">Next month</span>
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="placard py-1 text-center caption">
            {d}
          </span>
        ))}
        {grid.map((day) => {
          const dayItems = itemsOn(day)
          const inMonth = isSameMonth(day, month)
          const isSelected = selected ? isSameDay(day, selected) : false
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => setSelected(day)}
              aria-label={`${format(day, 'd MMMM')}, ${dayItems.length} items`}
              className={[
                'flex min-h-12 flex-col items-center gap-1 rounded-sm border py-1.5 transition-colors',
                isSelected ? 'border-radium' : 'border-bezel',
                inMonth ? 'bg-face' : 'bg-transparent',
              ].join(' ')}
            >
              <span
                className={[
                  'tabular text-xs',
                  inMonth ? 'text-foreground' : 'text-placard/50',
                  isToday(day) ? 'text-radium' : '',
                ].join(' ')}
              >
                {format(day, 'd')}
              </span>
              <span className="flex gap-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <ItemPip key={item.id} item={item} />
                ))}
              </span>
            </button>
          )
        })}
      </div>

      {selected ? (
        <section className="flex flex-col gap-2">
          <h3 className="placard text-xs">{format(selected, 'EEEE d MMMM')}</h3>
          {selectedItems.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing on this day.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {selectedItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(item)}
                    className="plate flex w-full items-center gap-3 px-4 py-3 text-left"
                  >
                    <span className="tabular w-12 shrink-0 text-sm text-muted-foreground">
                      {item.allDay ? 'All' : formatTime(item.startsAt)}
                    </span>
                    <span className="truncate text-sm">{item.title}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  )
}

export function CalendarPage() {
  const { tripId = '' } = useParams<{ tripId: string }>()
  const ideas = useIdeas(tripId)
  const bookings = useBookings(tripId)
  const [view, setView] = React.useState<'agenda' | 'month'>('agenda')
  const [open, setOpen] = React.useState<CalendarItem | null>(null)

  if (ideas.isPending || bookings.isPending) return <ListSkeleton rows={4} />

  // A failed load must say so rather than falling through to an empty state.
  const queries = [ideas, bookings]
  if (anyFailed(queries)) return <ScreenError queries={queries} />

  const items = toCalendarItems(ideas.data ?? [], bookings.data ?? [])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        subtitle="Agreed ideas and bookings, in one list. Nothing here is stored twice."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to={`/trips/${tripId}/bookings`}>
              <Plane size={14} aria-hidden="true" />
              Bookings
            </Link>
          </Button>
        }
      />

      <Tabs value={view} onValueChange={(v) => setView(v as 'agenda' | 'month')}>
        <TabsList>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === 'agenda' ? (
        <AgendaView items={items} onOpen={setOpen} tripId={tripId} />
      ) : (
        <MonthView items={items} onOpen={setOpen} />
      )}

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="bottom" className="mx-auto max-w-md">
          {open ? (
            <>
              <SheetHeader>
                <SheetTitle>{open.title}</SheetTitle>
                <SheetDescription>{formatDayTime(open.startsAt)}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col px-4 pb-6">
                <Placard className="mb-3 self-start" >{sourceLabel[open.source]}</Placard>
                {open.detail ? (
                  <p className="mb-3 text-sm text-muted-foreground">{open.detail}</p>
                ) : null}
                <SpecRow label="Starts" value={formatDayTime(open.startsAt)} />
                {open.endsAt ? <SpecRow label="Ends" value={formatDayTime(open.endsAt)} /> : null}
                {open.belongsTo ? <SpecRow label="Whose" value="Personal booking" /> : null}
                <div className="mt-4">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={
                        open.source === 'idea'
                          ? `/trips/${tripId}/voting`
                          : `/trips/${tripId}/bookings`
                      }
                    >
                      {open.source === 'idea' ? 'Open in voting' : 'Open in bookings'}
                    </Link>
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}

