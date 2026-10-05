/*
 * A classic analogue dial: brushed chrome ring, black face, green-backlit
 * scale, orange needle on a capped hub.
 *
 * A dial is only drawn where a level is genuinely being read. Anything that is
 * an alert rather than a level belongs on a warning lamp, not here.
 *
 * The sweep is centred on twelve o'clock, so a centre-zero dial reads "square"
 * with the needle straight up and a half-full one reads half with it there too.
 */

import { useId, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type DialMark = { at: number; label?: string }
export type DialTone = 'normal' | 'caution' | 'idle'

const toneFill: Record<DialTone, string> = {
  normal: 'var(--radium)',
  caution: 'var(--caution)',
  idle: 'var(--placard)',
}

const C = 100

/** 0 degrees is twelve o'clock, positive is clockwise. */
function point(r: number, deg: number) {
  const rad = (deg * Math.PI) / 180
  return { x: C + r * Math.sin(rad), y: C - r * Math.cos(rad) }
}

function arc(r: number, from: number, to: number): string {
  const a = point(r, from)
  const b = point(r, to)
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${b.x} ${b.y}`
}

export type DialProps = {
  /** Printed on the face, the way a real dial prints its unit. */
  name: string
  value: number
  min: number
  max: number
  /** Total sweep in degrees, centred on twelve o'clock. */
  sweep: number
  /** Major ticks, in value units. Labelled ones carry their numeral. */
  marks: DialMark[]
  /** Minor ticks drawn between each pair of majors. */
  minors?: number
  /** An amber band over part of the scale, in value units. */
  caution?: { from: number; to: number }
  reading: string
  tone?: DialTone
  /** An icon printed on the face beside the name. */
  icon?: ReactNode
  className?: string
}

export function Dial({
  name,
  value,
  min,
  max,
  sweep,
  marks,
  minors = 4,
  caution,
  reading,
  tone = 'normal',
  icon,
  className,
}: DialProps) {
  const id = useId().replace(/:/g, '')
  const half = sweep / 2
  const angleOf = (v: number) => {
    if (max <= min) return -half
    const ratio = Math.min(1, Math.max(0, (v - min) / (max - min)))
    return -half + ratio * sweep
  }
  const needleAngle = angleOf(value)

  const majors = [...marks].sort((a, b) => a.at - b.at)
  const minorTicks = majors.slice(1).flatMap((m, i) => {
    const prev = majors[i]
    return Array.from({ length: minors }, (_, k) => prev.at + ((m.at - prev.at) * (k + 1)) / (minors + 1))
  })

  // Readings shrink with their own length so "$1,234.56" fits where "5" does.
  const readingSize = reading.length <= 4 ? 30 : reading.length <= 7 ? 25 : 21

  return (
    // The binnacle seats the dial in the cowl; the bezel is the brushed chrome ring.
    <div className={cn('binnacle w-full', className)}>
      <div className="dial-bezel">
        <svg
          viewBox="0 0 200 200"
          className="block aspect-square w-full"
          role="presentation"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id={`${id}-face`} cx="0.5" cy="0.42" r="0.6">
              <stop offset="0" stopColor="#13171b" />
              <stop offset="1" stopColor="#050608" />
            </radialGradient>
            <linearGradient id={`${id}-hub`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--chrome-hi)" />
              <stop offset="1" stopColor="var(--chrome-lo)" />
            </linearGradient>
            <linearGradient id={`${id}-glass`} x1="0" y1="0" x2="0.7" y2="0.8">
              <stop offset="0" stopColor="white" stopOpacity="0.17" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            {/* A raked crescent: one ellipse less a second, offset away from the reading. */}
            <mask id={`${id}-crescent`}>
              <circle cx={C} cy={C} r={90} fill="black" />
              <ellipse cx={78} cy={58} rx={78} ry={52} transform="rotate(-28 78 58)" fill="white" />
              <ellipse cx={96} cy={84} rx={84} ry={58} transform="rotate(-28 96 84)" fill="black" />
            </mask>
            {/* Backlit markings bleed a little light into the face around them. */}
            <filter id={`${id}-backlight`} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* A bright lip where the ring meets the glass, a dark gap, then the face sunk below. */}
          <circle cx={C} cy={C} r={93} fill="#020303" />
          <circle cx={C} cy={C} r={93.4} fill="none" stroke="#e4e9ed" strokeOpacity={0.5} strokeWidth={0.8} />
          <circle cx={C} cy={C} r={91} fill={`url(#${id}-face)`} />
          <circle cx={C} cy={C} r={89} fill="none" stroke="#000" strokeOpacity={0.7} strokeWidth={4} />

          {caution ? (
            <path
              d={arc(74, angleOf(caution.from), angleOf(caution.to))}
              fill="none"
              stroke="var(--caution)"
              strokeWidth={5}
              opacity={0.85}
            />
          ) : null}

          <g filter={`url(#${id}-backlight)`}>
            {minorTicks.map((v) => {
              const a = point(84, angleOf(v))
              const b = point(78, angleOf(v))
              return (
                <line
                  key={`minor-${v}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--radium)"
                  strokeOpacity={0.55}
                  strokeWidth={1.3}
                />
              )
            })}
            {majors.map((m) => {
              const a = point(85, angleOf(m.at))
              const b = point(72, angleOf(m.at))
              return (
                <line
                  key={`major-${m.at}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--radium)"
                  strokeWidth={2.6}
                />
              )
            })}
            {majors
              .filter((m) => m.label)
              .map((m) => {
                // Longer words sit further in, so "OWED" at three o'clock clears the ticks.
                const p = point(58 - ((m.label?.length ?? 1) - 1) * 5, angleOf(m.at))
                return (
                  <text
                    key={`label-${m.at}`}
                    x={p.x}
                    y={p.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="var(--radium)"
                    fontSize={16}
                    fontWeight={500}
                    fontFamily="var(--font-sans)"
                    fontStretch="82%"
                    letterSpacing="0.04em"
                  >
                    {m.label}
                  </text>
                )
              })}

            <g transform="translate(0 166)">
              {icon ? (
                <g transform="translate(58 -7)" color="var(--radium)" opacity={0.75}>
                  {icon}
                </g>
              ) : null}
              <text
                x={icon ? C + 11 : C}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill="var(--radium)"
                fillOpacity={0.75}
                fontSize={14}
                fontFamily="var(--font-sans)"
                fontStretch="92%"
                letterSpacing="0.14em"
              >
                {name.toUpperCase()}
              </text>
            </g>

            <text
              x={C}
              y={136}
              textAnchor="middle"
              dominantBaseline="central"
              fill={toneFill[tone]}
              fontSize={readingSize}
              fontWeight={500}
              fontFamily="var(--font-sans)"
              fontStretch="82%"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {reading}
            </text>
          </g>

          {/* Needle, damped on change and swept from rest on power-on. */}
          <g
            className="dial-needle"
            style={
              {
                transform: `rotate(${needleAngle}deg)`,
                transformOrigin: `${C}px ${C}px`,
                '--rest': `${-half}deg`,
              } as CSSProperties
            }
          >
            <polygon
              points={`${C},${C - 76} ${C + 2.8},${C} ${C + 1.8},${C + 18} ${C - 1.8},${C + 18} ${C - 2.8},${C}`}
              fill="var(--needle)"
            />
          </g>
          <circle cx={C} cy={C} r={11} fill={`url(#${id}-hub)`} />
          <circle cx={C} cy={C} r={8.5} fill="#07080a" />

          {/* The glass over the face catches a crescent of light, clear of the reading. */}
          <rect
            width="200"
            height="200"
            fill={`url(#${id}-glass)`}
            mask={`url(#${id}-crescent)`}
            pointerEvents="none"
          />
        </svg>
      </div>
    </div>
  )
}
