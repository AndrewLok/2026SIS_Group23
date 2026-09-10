/*
 * The instrument. Every reading in Voyager is one of these.
 *
 * A real gauge earns its face: a tick scale so a value has somewhere to sit, an
 * arc that fills from the scale's start, a caution band where the range turns
 * amber, and a needle. A circle with a number in the middle is the cheap version
 * and reads as a card wearing a costume.
 *
 * Colour is meaning, fixed across the whole app and never restyled per trip:
 * radium is a normal reading, amber is one that wants attention, red is only
 * ever destructive.
 */

import { Minus, TrendingDown, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

export type InstrumentTone = 'normal' | 'caution' | 'warning'
export type Trend = 'up' | 'down' | 'steady'

/** Trend marker. Drawn from the icon set, never a Unicode arrow. */
export function TrendMark({
  trend,
  stroke,
  inline = false,
}: {
  trend: Trend
  stroke: string
  /** Inline sits in a row of text; otherwise it pins to the gauge face. */
  inline?: boolean
}) {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const label = trend === 'up' ? 'rising' : trend === 'down' ? 'falling' : 'steady'
  return (
    <span
      className={inline ? 'inline-flex' : 'absolute right-[10%] top-[22%]'}
      style={{ color: trend === 'steady' ? 'var(--placard)' : stroke }}
    >
      <Icon size={13} strokeWidth={2.25} aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </span>
  )
}

const SWEEP_START = 135
const SWEEP_DEGREES = 270

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const start = polar(cx, cy, r, to)
  const end = polar(cx, cy, r, from)
  const largeArc = to - from <= 180 ? '0' : '1'
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

/** Where a value sits on the dial, clamped so an overrun pins rather than wraps. */
function angleFor(value: number, min: number, max: number): number {
  if (max <= min) return SWEEP_START
  const ratio = Math.min(1, Math.max(0, (value - min) / (max - min)))
  return SWEEP_START + ratio * SWEEP_DEGREES
}

/** Longer readings step down so "$1,234.56" fits the same face as "5". */
function valueScale(display: string): number {
  if (display.length <= 2) return 0.24
  if (display.length <= 4) return 0.2
  if (display.length <= 6) return 0.155
  return 0.125
}

const toneVar: Record<InstrumentTone, string> = {
  normal: 'var(--radium)',
  caution: 'var(--caution)',
  warning: 'var(--warning)',
}

export type InstrumentProps = {
  /** The reading itself, already formatted. */
  display: string
  /** Numeric position on the dial. */
  value: number
  min?: number
  max: number
  /** Where the amber band begins, in the same units as value. */
  cautionFrom?: number
  tone?: InstrumentTone
  /** Small unit shown under the reading, like "open" or "legs". */
  unit?: string
  trend?: Trend
  /** Numerals around the dial. Off by default; a tile is too small for them. */
  showScale?: boolean
  /** How a scale position reads. Required for any dial holding cents. */
  formatScale?: (value: number) => string
  size?: number
  className?: string
}

export function Instrument({
  display,
  value,
  min = 0,
  max,
  cautionFrom,
  tone = 'normal',
  unit,
  trend,
  showScale = false,
  formatScale = (v) => String(Math.round(v)),
  size = 132,
  className,
}: InstrumentProps) {
  const cx = 100
  const cy = 100
  const trackRadius = 82
  const valueAngle = angleFor(value, min, max)
  const filled = (valueAngle - SWEEP_START) / SWEEP_DEGREES
  const stroke = toneVar[tone]

  // Ticks: a major every fifth, minors between, across the full sweep.
  const tickCount = 41
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const angle = SWEEP_START + (i / (tickCount - 1)) * SWEEP_DEGREES
    const major = i % 5 === 0
    const outer = polar(cx, cy, trackRadius, angle)
    const inner = polar(cx, cy, trackRadius - (major ? 12 : 6), angle)
    return { angle, major, outer, inner, key: i }
  })

  /*
   * Only the midpoint and the top of the range are labelled. At tile size more
   * than two numerals crowds the face, and zero sits exactly where the reading
   * goes: a gauge does not need its zero written on it, because the start of
   * the arc already says where the scale begins.
   *
   * The formatter matters. A dial measuring money holds cents, and printing the
   * raw number puts "59934" on a face that means $599.34.
   */
  const scaleNumbers = showScale
    ? [0.5, 1].map((ratio, i) => {
        const angle = SWEEP_START + ratio * SWEEP_DEGREES
        const at = polar(cx, cy, trackRadius - 27, angle)
        return { key: i, at, label: formatScale(min + ratio * (max - min)) }
      })
    : []

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} role="presentation" aria-hidden="true">
        {/* Recessed face inside a satin bezel. */}
        <circle cx={cx} cy={cy} r={96} fill="var(--bezel)" />
        <circle cx={cx} cy={cy} r={92} fill="var(--panel)" stroke="var(--bezel-edge)" strokeWidth={2} />

        {/* Unfilled scale track. */}
        <path
          d={arcPath(cx, cy, trackRadius, SWEEP_START, SWEEP_START + SWEEP_DEGREES)}
          fill="none"
          stroke="var(--bezel-edge)"
          strokeWidth={4}
          strokeLinecap="round"
        />

        {/* Caution band, drawn under the value arc so an amber reading still reads amber. */}
        {cautionFrom !== undefined && cautionFrom < max ? (
          <path
            d={arcPath(
              cx,
              cy,
              trackRadius,
              angleFor(cautionFrom, min, max),
              SWEEP_START + SWEEP_DEGREES,
            )}
            fill="none"
            stroke="var(--caution)"
            strokeWidth={4}
            strokeLinecap="butt"
            opacity={0.42}
          />
        ) : null}

        {/*
          The reading. Drawn as the full sweep and revealed with a dash offset,
          so the needle and the arc can settle together on power-up rather than
          the arc snapping into place under a moving needle.
        */}
        <path
          d={arcPath(cx, cy, trackRadius, SWEEP_START, SWEEP_START + SWEEP_DEGREES)}
          fill="none"
          stroke={stroke}
          strokeWidth={5}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          className="instrument-arc"
          style={{ strokeDashoffset: 1 - filled }}
        />

        {ticks.map((t) => (
          <line
            key={t.key}
            x1={t.outer.x}
            y1={t.outer.y}
            x2={t.inner.x}
            y2={t.inner.y}
            stroke={t.major ? 'var(--luminous)' : 'var(--placard)'}
            strokeWidth={t.major ? 2.5 : 1.25}
            opacity={t.major ? 0.9 : 0.5}
          />
        ))}

        {scaleNumbers.map((n) => (
          <text
            key={n.key}
            x={n.at.x}
            y={n.at.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--placard)"
            fontSize={12}
            fontFamily="var(--font-sans)"
            fontStretch="82%"
          >
            {n.label}
          </text>
        ))}

        {/* Needle, damped rather than snapped when the value changes. */}
        <g
          className="instrument-needle"
          style={{ transform: `rotate(${valueAngle}deg)`, transformOrigin: `${cx}px ${cy}px` }}
        >
          <line
            x1={cx}
            y1={cy + 12}
            x2={cx}
            y2={cy - (trackRadius - 18)}
            stroke={stroke}
            strokeWidth={3}
            strokeLinecap="round"
          />
        </g>
        <circle cx={cx} cy={cy} r={7} fill="var(--bezel-edge)" />
        <circle cx={cx} cy={cy} r={3} fill={stroke} />
      </svg>

      {/*
        The reading sits over the lower half of the face, where a real gauge puts
        it, and shrinks with its own length so a currency figure cannot run out
        past the bezel. The unit is not drawn here: at tile size there is no room
        for one without it colliding with the scale, so it rides under the placard.
      */}
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center pb-[20%]">
        <span
          className="instrument-value px-[14%] text-center leading-none"
          style={{ color: stroke, fontSize: size * valueScale(display) }}
        >
          {display}
        </span>
      </div>

      {trend ? <TrendMark trend={trend} stroke={stroke} /> : null}

      {/* The whole reading in one phrase, since the dial itself is decorative to a reader. */}
      <span className="sr-only">
        {display}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  )
}
