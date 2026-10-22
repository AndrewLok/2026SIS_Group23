import { describe, expect, it } from 'vitest'
import { RECOMMENDATIONS, prefillFor } from '@/lib/recommendations'

describe('booking recommendations', () => {
  it('are two, with different ids, and each costs something', () => {
    expect(RECOMMENDATIONS).toHaveLength(2)
    expect(new Set(RECOMMENDATIONS.map((r) => r.id)).size).toBe(2)
    for (const r of RECOMMENDATIONS) expect(r.costCents).toBeGreaterThan(0)
  })

  it('fill in times from the trip’s first day, ending after they start', () => {
    for (const r of RECOMMENDATIONS) {
      const form = prefillFor(r, '2026-11-08')
      expect(form.startsAt).toMatch(/^2026-11-\d\dT\d\d:\d\d$/)
      expect(form.endsAt > form.startsAt).toBe(true)
    }
    expect(prefillFor(RECOMMENDATIONS[0]!, '2026-11-08').startsAt).toBe('2026-11-09T15:00')
    expect(prefillFor(RECOMMENDATIONS[0]!, '2026-11-30').endsAt).toBe('2026-12-04T10:00')
  })

  it('leave the times empty when the trip has no dates yet', () => {
    const form = prefillFor(RECOMMENDATIONS[1]!, null)
    expect(form.startsAt).toBe('')
    expect(form.endsAt).toBe('')
  })

  it('make a booking for the whole group, with no notes', () => {
    const form = prefillFor(RECOMMENDATIONS[0]!, null)
    expect(form.notes).toBe('')
    expect(form.belongsTo).toBe('group')
  })

  it('fit within the length limits the booking form enforces', () => {
    for (const r of RECOMMENDATIONS) {
      expect(r.title.length).toBeLessThanOrEqual(100)
      expect(r.provider.length).toBeLessThanOrEqual(100)
    }
  })
})
