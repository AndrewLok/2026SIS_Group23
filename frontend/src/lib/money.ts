/*
 * Money. Integer cents everywhere, never a float.
 *
 * Every figure the user sees passes through formatMoney, and every figure the
 * user types passes through parseMoneyToCents. Nothing else formats currency.
 */

/** "$42.50". Pass signed to get a leading + or - for a net position. */
export function formatMoney(
  cents: number,
  options: { signed?: boolean; currency?: string } = {},
): string {
  const { signed = false, currency = 'AUD' } = options
  const symbol = currency === 'AUD' ? '$' : ''
  const magnitude = Math.abs(cents)
  const dollars = Math.floor(magnitude / 100)
  const remainder = String(magnitude % 100).padStart(2, '0')
  const grouped = dollars.toLocaleString('en-AU')
  const sign = signed && cents !== 0 ? (cents > 0 ? '+' : '-') : cents < 0 ? '-' : ''
  return `${sign}${symbol}${grouped}.${remainder}`
}

/** Compact form for a tight instrument face: "$1.2k" past a thousand dollars. */
export function formatMoneyCompact(cents: number): string {
  const magnitude = Math.abs(cents)
  if (magnitude < 100_000) return formatMoney(cents)
  const sign = cents < 0 ? '-' : ''
  return `${sign}$${(magnitude / 100_000).toFixed(1)}k`
}

/**
 * Parse user input to cents. Accepts "42", "42.5", "42.50", "$42.50", "1,234.56".
 * Returns null when the input is not a usable amount, so callers can show an
 * error rather than silently storing a zero.
 */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.replace(/[$,\s]/g, '')
  if (cleaned === '' || !/^-?\d*\.?\d*$/.test(cleaned)) return null
  const negative = cleaned.startsWith('-')
  const digits = negative ? cleaned.slice(1) : cleaned
  if (digits === '' || digits === '.') return null
  const [whole = '0', fraction = ''] = digits.split('.')
  if (fraction.length > 2) return null
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  if (!Number.isFinite(cents)) return null
  return negative ? -cents : cents
}

/**
 * Split cents across n participants so the parts always sum back to the total.
 * The remainder cents go to the first participants, which is why callers pass
 * participants in a stable id order: the same expense always splits the same way.
 */
export function splitEvenly(totalCents: number, participants: number): number[] {
  if (participants <= 0) return []
  const base = Math.floor(totalCents / participants)
  const remainder = totalCents - base * participants
  return Array.from({ length: participants }, (_, i) => base + (i < remainder ? 1 : 0))
}
