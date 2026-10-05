/*
 * The trip meter: mechanical drums that roll up to the count on power-on.
 * Before the trip it counts days to go; during it, the day you are on.
 */

import type { CSSProperties } from 'react'

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

export function TripMeter({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span
        className="instrument-value flex overflow-hidden rounded-[3px] border border-black bg-black text-2xl leading-none text-radium shadow-[0_0_0_2px_var(--chrome-mid),0_2px_6px_#000] md:text-3xl"
        aria-hidden="true"
      >
        {[...value].map((char, i) => (
          <span key={i} className="drum">
            {/[0-9]/.test(char) ? (
              <span
                className="drum-strip glow-radium"
                style={{ '--d': Number(char), animationDelay: `${i * 90}ms` } as CSSProperties}
              >
                {DIGITS.map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
            ) : (
              <span className="block h-[1.3em] text-center leading-[1.3em] glow-radium">{char}</span>
            )}
          </span>
        ))}
      </span>
      <span className="sr-only">{value.replace(/^0+(?=\d)/, '')} </span>
      <span className="placard text-center text-xs leading-tight">{label}</span>
    </div>
  )
}
