/*
 * The view through the windscreen: a night road with the car gently driving,
 * the next stop on a roadside sign, and the crew in the rear-view mirror.
 *
 * The scene earns its height by carrying two real readings. The sign answers
 * "what are we doing next" and links to the calendar; the mirror shows who is
 * in the car and links to members. The road is atmosphere, so it is cheap:
 * transform-only motion, paused off-screen, and still under reduced motion.
 */

import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'
import { AvatarStack } from '@/components/common/people'
import type { CalendarItem } from '@/lib/calendar'
import { formatDay, formatTime } from '@/lib/dates'
import type { Profile } from '@/types'

/** Seconds for one thing on the road to travel from the horizon to the glass. */
const TRIP_SECONDS = 8

/** Scale at a point in that journey: 1/z, so speed along the road is constant. */
const scaleAt = (p: number) => 1 / (33 - 32.643 * p)

/** A mover's resting pose doubles as its reduced-motion pose. */
function moverStyle(phase: number) {
  return {
    transform: `scale(${scaleAt(phase)})`,
    opacity: Math.min(1, phase * 2),
    animationDuration: `${TRIP_SECONDS}s`,
    animationDelay: `${-phase * TRIP_SECONDS}s`,
  }
}

/* Enough of each that, frozen at any instant, some are always near the glass. */
const DASHES = 18
const POSTS = 8
const TREES = 3
const BUSHES = 5

/*
 * A gum tree and a low bush, drawn once on the left verge at the reference
 * depth and mirrored for the right. They stand further out than the guide
 * posts, so they slide off the edge of the glass before they loom.
 */
function GumTree({ mirror }: { mirror?: boolean }) {
  return (
    <g transform={mirror ? 'matrix(-1 0 0 1 400 0)' : undefined} fill="var(--foliage)">
      <polygon points="-63,168 -57,168 -58,126 -62,126" />
      <circle cx="-60" cy="112" r="17" />
      <circle cx="-75" cy="120" r="13" />
      <circle cx="-45" cy="118" r="14" />
      <circle cx="-67" cy="98" r="13" />
      <circle cx="-51" cy="101" r="12" />
    </g>
  )
}

function Bush({ mirror }: { mirror?: boolean }) {
  return (
    <g transform={mirror ? 'matrix(-1 0 0 1 400 0)' : undefined} fill="var(--foliage)">
      <ellipse cx="-14" cy="165" rx="15" ry="7" />
      <ellipse cx="-4" cy="163" rx="9" ry="6" />
    </g>
  )
}

/** A static treeline along the far range, broken where the road runs out. */
const TREELINE = (() => {
  let seed = 11
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 70 }, (_, i) => ({ key: i, x: i * 6 + rand() * 4, r: 1.6 + rand() * 2.2 }))
    .filter((t) => Math.abs(t.x - 200) > 10)
})()

/** A fixed scatter, so the stars do not move between renders. */
const STARS = (() => {
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: 34 }, (_, i) => ({
    key: i,
    x: rand() * 400,
    y: rand() * 92,
    r: rand() < 0.15 ? 0.9 : 0.5,
    o: 0.25 + rand() * 0.55,
  }))
})()

function RoadScene() {
  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMax slice"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ws-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--sky-top)" />
          <stop offset="1" stopColor="var(--sky-horizon)" />
        </linearGradient>
        <linearGradient id="ws-verge" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--verge-far)" />
          <stop offset="1" stopColor="var(--verge-near)" />
        </linearGradient>
        {/* Low beams: brightest at the bonnet, gone well before the horizon. */}
        <linearGradient id="ws-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#fff1d6" stopOpacity="0.2" />
          <stop offset="0.55" stopColor="#fff1d6" stopOpacity="0.07" />
          <stop offset="1" stopColor="#fff1d6" stopOpacity="0" />
        </linearGradient>
        <filter id="ws-beam-soft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
        <radialGradient id="ws-headlights" cx="0.5" cy="1" r="0.5">
          <stop offset="0" stopColor="#fff4dc" stopOpacity="0.16" />
          <stop offset="1" stopColor="#fff4dc" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="400" height="120" fill="url(#ws-sky)" />
      {STARS.map((s) => (
        <circle key={s.key} cx={s.x} cy={s.y} r={s.r} fill="var(--luminous)" opacity={s.o} />
      ))}

      {/* Hills: a far range across the horizon, nearer shoulders either side. */}
      <path
        d="M0 108 Q 30 96 70 104 T 150 100 T 230 107 T 310 97 T 400 105 L 400 120 L 0 120 Z"
        fill="var(--hill-far)"
      />
      {TREELINE.map((t) => (
        <circle key={t.key} cx={t.x} cy={117 - t.r * 0.4} r={t.r} fill="var(--foliage-far)" />
      ))}
      <path d="M-20 120 Q 40 104 110 114 L 180 119 L -20 122 Z" fill="var(--hill-near)" />
      <path d="M420 120 Q 350 102 280 113 L 220 119 L 420 122 Z" fill="var(--hill-near)" />

      {/* The road, and the pool the headlights throw onto it. */}
      <rect y="118" width="400" height="82" fill="url(#ws-verge)" />
      <polygon points="198,118 202,118 470,200 -70,200" fill="var(--asphalt)" />
      <ellipse cx="200" cy="200" rx="230" ry="70" fill="url(#ws-headlights)" />
      <g stroke="var(--luminous)" strokeOpacity="0.28" strokeWidth="1.2">
        <line x1="198" y1="118" x2="-60" y2="200" />
        <line x1="202" y1="118" x2="460" y2="200" />
      </g>

      {/* Greenery either side, staggered against each other and the posts. */}
      {Array.from({ length: TREES }, (_, i) => (
        <g key={`tree-l-${i}`} className="road-mover" style={moverStyle(i / TREES)}>
          <GumTree />
        </g>
      ))}
      {Array.from({ length: TREES }, (_, i) => (
        <g key={`tree-r-${i}`} className="road-mover" style={moverStyle((i + 0.5) / TREES)}>
          <GumTree mirror />
        </g>
      ))}
      {Array.from({ length: BUSHES }, (_, i) => (
        <g key={`bush-l-${i}`} className="road-mover" style={moverStyle((i + 0.25) / BUSHES)}>
          <Bush />
        </g>
      ))}
      {Array.from({ length: BUSHES }, (_, i) => (
        <g key={`bush-r-${i}`} className="road-mover" style={moverStyle((i + 0.75) / BUSHES)}>
          <Bush mirror />
        </g>
      ))}

      {Array.from({ length: DASHES }, (_, i) => (
        <polygon
          key={`dash-${i}`}
          className="road-mover"
          style={moverStyle(i / DASHES)}
          points="197.6,150 202.4,150 203.6,172 196.4,172"
          fill="var(--luminous)"
          fillOpacity="0.7"
        />
      ))}

      {/* Guide posts either side, staggered so they never pass in pairs. */}
      {Array.from({ length: POSTS }, (_, i) => (
        <g key={`post-l-${i}`} className="road-mover" style={moverStyle(i / POSTS)}>
          <rect x="13" y="150" width="4" height="18" fill="#c9d0d3" fillOpacity="0.75" />
          <rect x="13" y="151" width="4" height="4" fill="var(--luminous)" />
        </g>
      ))}
      {Array.from({ length: POSTS }, (_, i) => (
        <g
          key={`post-r-${i}`}
          className="road-mover"
          style={moverStyle((i + 0.5) / POSTS)}
        >
          <rect x="383" y="150" width="4" height="18" fill="#c9d0d3" fillOpacity="0.75" />
          <rect x="383" y="151" width="4" height="4" fill="var(--luminous)" />
        </g>
      ))}

      {/*
        The headlight beams, laid over everything on the road and screened on,
        so whatever passes through them (dashes, posts, the greenery on the
        verge) is lit as it nears the car and falls back to silhouette beyond.
      */}
      <g filter="url(#ws-beam-soft)" style={{ mixBlendMode: 'screen' }} pointerEvents="none">
        <polygon points="-30,200 235,200 204,128 176,128" fill="url(#ws-beam)" />
        <polygon points="165,200 430,200 224,128 196,128" fill="url(#ws-beam)" />
      </g>
    </svg>
  )
}

export function Windscreen({
  tripId,
  profiles,
  next,
}: {
  tripId: string
  profiles: Profile[]
  next: CalendarItem | null
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Nobody is watching a road that has scrolled out of view.
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) el.removeAttribute('data-paused')
      else el.setAttribute('data-paused', '')
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className="windscreen relative h-54 overflow-hidden rounded-t-[2rem] bg-[var(--sky-top)] md:h-76 md:rounded-t-[3rem]"
    >
      <RoadScene />

      {/* Rear-view mirror: who is in the car. */}
      <Link
        to={`/trips/${tripId}/members`}
        aria-label={`Crew: ${profiles.length} members. Open members and invite.`}
        className="group absolute left-1/2 top-0 z-10 flex -translate-x-1/2 flex-col items-center rounded-b-2xl"
      >
        <span className="h-2.5 w-2 bg-[var(--chrome-lo)]" aria-hidden="true" />
        <span className="rounded-[1.1rem] bg-[linear-gradient(180deg,var(--chrome-hi),var(--chrome-lo))] p-[2px] shadow-[0_6px_14px_-4px_#000]">
          <span className="relative flex h-11 items-center justify-center overflow-hidden rounded-[1rem] bg-[linear-gradient(170deg,#1b2230_0%,#0a0d13_60%)] px-3 transition-colors group-hover:bg-[linear-gradient(170deg,#232c3d_0%,#0d1118_60%)] md:h-16 md:w-52">
            <AvatarStack profiles={profiles} size={28} />
            {/* The mirror glass catches one raked streak of light. */}
            <span
              className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgb(255_255_255/0.08)_42%,transparent_54%)]"
              aria-hidden="true"
            />
          </span>
        </span>
      </Link>

      {/* The next stop, on a roadside guide sign. */}
      <Link
        to={next ? `/trips/${tripId}/calendar` : `/trips/${tripId}/voting`}
        className="group absolute right-[5%] top-[30%] z-10 flex w-[min(52%,17rem)] flex-col items-stretch md:right-[3%] md:top-[26%]"
      >
        <span className="rounded-md bg-[var(--road-sign)] p-[3px] shadow-[0_6px_18px_-6px_#000] transition-[filter] group-hover:brightness-110">
          <span className="flex items-start gap-2 rounded-[0.3rem] border-2 border-[var(--luminous)] px-2.5 py-2 text-[var(--luminous)]">
            <ArrowUp size={20} strokeWidth={3} className="mt-0.5 shrink-0" aria-hidden="true" />
            {next ? (
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="sr-only">Next: </span>
                <span className="line-clamp-2 text-sm font-semibold leading-tight">
                  {next.title}
                </span>
                <time dateTime={next.startsAt} className="font-sans text-sm tabular-nums leading-tight">
                  {formatTime(next.startsAt)} · {formatDay(next.startsAt)}
                </time>
              </span>
            ) : (
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-semibold leading-tight">Nothing agreed yet</span>
                <span className="text-sm leading-tight underline underline-offset-4">
                  Vote on ideas
                </span>
              </span>
            )}
          </span>
        </span>
        <span className="flex justify-between px-[22%]" aria-hidden="true">
          <span className="h-16 w-1 bg-[#4a5057] md:h-8" />
          <span className="h-16 w-1 bg-[#4a5057] md:h-8" />
        </span>
      </Link>

      <div className="windscreen-glass pointer-events-none absolute inset-0 rounded-[inherit]" />
    </div>
  )
}
