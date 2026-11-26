import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ default: {} }))

import { resolvePrefillInvitationExpiresAt } from '@/lib/prefilled-invitation-server'

describe('resolvePrefillInvitationExpiresAt', () => {
  const now = new Date('2026-11-25T18:00:00.000Z')
  const hourMs = 60 * 60 * 1000
  const dayMs = 24 * hourMs

  it('expira en 6 horas desde now si no hay cita o la cita ya pasó', () => {
    const withoutDate = resolvePrefillInvitationExpiresAt(null, now)
    expect(withoutDate.getTime()).toBe(now.getTime() + 6 * hourMs)

    const pastApt = new Date(now.getTime() - 2 * hourMs)
    expect(resolvePrefillInvitationExpiresAt(pastApt, now).getTime()).toBe(
      now.getTime() + 6 * hourMs,
    )
  })

  it('extiende la vigencia hasta 6 horas después de una cita próxima o en 3 días', () => {
    const inTwoHours = new Date(now.getTime() + 2 * hourMs)
    expect(resolvePrefillInvitationExpiresAt(inTwoHours, now).getTime()).toBe(
      inTwoHours.getTime() + 6 * hourMs,
    )

    const inThreeDays = new Date(now.getTime() + 3 * dayMs)
    expect(resolvePrefillInvitationExpiresAt(inThreeDays, now).getTime()).toBe(
      inThreeDays.getTime() + 6 * hourMs,
    )
  })

  it('limita la vigencia máxima a 30 días desde now', () => {
    const inSixtyDays = new Date(now.getTime() + 60 * dayMs)
    expect(resolvePrefillInvitationExpiresAt(inSixtyDays, now).getTime()).toBe(
      now.getTime() + 30 * dayMs,
    )
  })
})
