import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  appointmentCapacityUserMessage,
  checkBranchHourCapacity,
  computeBranchDayAvailabilityForDates,
  distributeDurationAcrossHours,
  evaluateMinuteSlotForStartHour,
  exceedsBranchClosingTime,
} from '@/lib/appointment-capacity'
import { parseAppointmentLocalDateTime } from '@/lib/appointment-scheduling'

describe('distribución de minutos y cierre de clínica', () => {
  it('distribuye perfiles <= 60 min en su hora de inicio', () => {
    const map = distributeDurationAcrossHours(10, 0, 45)
    expect(Object.fromEntries(map)).toEqual({ 10: 45 })
  })

  it('distribuye perfiles > 60 min en bloques consecutivos de 60 min', () => {
    const map = distributeDurationAcrossHours(10, 0, 75)
    expect(Object.fromEntries(map)).toEqual({ 10: 60, 11: 15 })
  })

  it('distribuye correctamente cuando inicia con minutos distintos de cero', () => {
    const map = distributeDurationAcrossHours(10, 30, 60)
    expect(Object.fromEntries(map)).toEqual({ 10: 30, 11: 30 })
  })

  it('detecta cuando horaInicio + duración rebasa la hora de cierre', () => {
    expect(exceedsBranchClosingTime(16, 0, 75, '17:00')).toBe(true)
    expect(exceedsBranchClosingTime(15, 0, 75, '17:00')).toBe(false)
    expect(exceedsBranchClosingTime(16, 0, 60, '17:00')).toBe(false)
  })

  it('evalúa cuántos trabajadores caben con un perfil largo considerando derrame en hora siguiente', () => {
    const used = new Map<number, number>([
      [10, 60], // quedan 120 de 180
      [11, 150], // quedan 30 de 180
    ])
    const res = evaluateMinuteSlotForStartHour({
      startHour: 10,
      hours: [8, 9, 10, 11, 12, 13, 14, 15, 16],
      usedMinutesByHour: used,
      hourlyMinutesCapacity: 180,
      closingTime: '17:00',
      durationMinutes: 75, // 60 en hora 10, 15 en hora 11
    })

    expect(res.ok).toBe(true)
    expect(res.fitCount).toBe(2) // min(floor(120/60)=2, floor(30/15)=2) = 2
  })
})

describe('checkBranchHourCapacity en modo DURATION_MINUTES vs HOURLY_COUNT', () => {
  const mockBranchFindUnique = vi.fn()
  const mockAppointmentFindMany = vi.fn()
  const mockMedicalProfileFindUnique = vi.fn()

  const fakeDb = {
    branch: { findUnique: mockBranchFindUnique },
    appointment: { findMany: mockAppointmentFindMany },
    medicalProfile: { findUnique: mockMedicalProfileFindUnique },
  } as unknown as PrismaClient

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserva modo legacy HOURLY_COUNT sin romper comportamiento previo', async () => {
    mockBranchFindUnique.mockResolvedValue({
      id: 'branch-1',
      hourlyCapacity: 2,
      openingTime: '08:00',
      closingTime: '17:00',
      isActive: true,
      weeklySchedule: null,
      capacityMode: 'HOURLY_COUNT',
      hourlyMinutesCapacity: null,
    })
    mockAppointmentFindMany.mockResolvedValue([
      {
        id: 'a1',
        scheduledAt: parseAppointmentLocalDateTime('2099-05-10', '10:00'),
        estimatedDurationMinutes: 45,
        serviceProfile: null,
      },
      {
        id: 'a2',
        scheduledAt: parseAppointmentLocalDateTime('2099-05-10', '10:00'),
        estimatedDurationMinutes: 45,
        serviceProfile: null,
      },
    ])

    const check = await checkBranchHourCapacity(
      fakeDb,
      'branch-1',
      parseAppointmentLocalDateTime('2099-05-10', '10:00'),
    )
    expect(check.ok).toBe(false)
    expect(check.count).toBe(2)
    expect(check.capacity).toBe(2)
  })

  it('en modo DURATION_MINUTES rechaza si horaInicio + duración rebasa cierre', async () => {
    mockBranchFindUnique.mockResolvedValue({
      id: 'branch-1',
      hourlyCapacity: 15,
      openingTime: '08:00',
      closingTime: '17:00',
      isActive: true,
      weeklySchedule: null,
      capacityMode: 'DURATION_MINUTES',
      hourlyMinutesCapacity: 180,
    })
    mockAppointmentFindMany.mockResolvedValue([])
    mockMedicalProfileFindUnique.mockResolvedValue({
      calculatedDurationMinutes: 75,
      durationOverrideMinutes: null,
    })

    const check = await checkBranchHourCapacity(
      fakeDb,
      'branch-1',
      parseAppointmentLocalDateTime('2099-05-10', '16:00'),
      { serviceProfileId: 'prof-75' },
    )
    expect(check.ok).toBe(false)
    expect(check.reason).toBe('EXCEEDS_CLOSING_TIME')
    expect(appointmentCapacityUserMessage(check)).toMatch(/rebasa la hora de cierre/i)
  })

  it('en modo DURATION_MINUTES rechaza cuando no alcanzan los minutos y acepta cuando sí caben', async () => {
    mockBranchFindUnique.mockResolvedValue({
      id: 'branch-1',
      hourlyCapacity: 15,
      openingTime: '08:00',
      closingTime: '17:00',
      isActive: true,
      weeklySchedule: null,
      capacityMode: 'DURATION_MINUTES',
      hourlyMinutesCapacity: 120,
    })
    mockAppointmentFindMany.mockResolvedValue([
      {
        id: 'a1',
        scheduledAt: parseAppointmentLocalDateTime('2099-05-10', '10:00'),
        estimatedDurationMinutes: 90, // 60 en hora 10, 30 en hora 11
        serviceProfile: null,
      },
      {
        id: 'a2',
        scheduledAt: parseAppointmentLocalDateTime('2099-05-10', '10:00'),
        estimatedDurationMinutes: 45, // 45 en hora 10 -> total hora 10 = 105 (quedan 15)
        serviceProfile: null,
      },
    ])

    const failCheck = await checkBranchHourCapacity(
      fakeDb,
      'branch-1',
      parseAppointmentLocalDateTime('2099-05-10', '10:00'),
      { requiredDurationMinutes: 30 },
    )
    expect(failCheck.ok).toBe(false)
    expect(failCheck.reason).toBe('INSUFFICIENT_MINUTES')
    expect(failCheck.remainingMinutes).toBe(15)
    expect(appointmentCapacityUserMessage(failCheck)).toMatch(/15 min disponibles/i)

    // Al reagendar excluyendo 'a2', quedan 60 min en hora 10 y sí cabe un perfil de 45 min
    mockAppointmentFindMany.mockResolvedValueOnce([
      {
        id: 'a1',
        scheduledAt: parseAppointmentLocalDateTime('2099-05-10', '10:00'),
        estimatedDurationMinutes: 90,
        serviceProfile: null,
      },
    ])
    const okReschedule = await checkBranchHourCapacity(
      fakeDb,
      'branch-1',
      parseAppointmentLocalDateTime('2099-05-10', '10:00'),
      { requiredDurationMinutes: 45, excludeAppointmentId: 'a2' },
    )
    expect(okReschedule.ok).toBe(true)
    expect(mockAppointmentFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'a2' },
        }),
      }),
    )
  })

  it('computeBranchDayAvailabilityForDates calcula openHourSlots y booked en minutos', async () => {
    mockAppointmentFindMany.mockResolvedValue([
      {
        id: 'a1',
        scheduledAt: parseAppointmentLocalDateTime('2099-05-12', '08:00'),
        estimatedDurationMinutes: 120, // 60 en 08:00 + 60 en 09:00
        serviceProfile: null,
      },
    ])

    const days = await computeBranchDayAvailabilityForDates(
      fakeDb,
      'branch-1',
      ['2099-05-12'],
      {
        hourlyCapacity: 15,
        openingTime: '08:00',
        closingTime: '11:00',
        capacityMode: 'DURATION_MINUTES',
        hourlyMinutesCapacity: 60,
      },
      '2099-05-01',
      { requiredDurationMinutes: 60 },
    )

    // Horas operativas: 08, 09, 10 (total 180 min). 08 y 09 ocupadas (60/60 c/u), 10 libre (0/60) -> 1 openHourSlot
    expect(days).toHaveLength(1)
    expect(days[0].capacityMode).toBe('DURATION_MINUTES')
    expect(days[0].booked).toBe(120)
    expect(days[0].capacityTotal).toBe(180)
    expect(days[0].openHourSlots).toBe(1)
    expect(days[0].status).toBe('partial')
  })
})
