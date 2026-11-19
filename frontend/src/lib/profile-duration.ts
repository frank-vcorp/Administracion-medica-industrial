/**
 * Cálculo puro de duración teórica de un `MedicalProfile` a partir de sus
 * pruebas, regla de Mesa de Control, proyecciones RX extra y override opcional.
 */

import { normalizeCatalogLabel } from '@/lib/medical-test-duration-seed'

export const CONTROL_DESK_MODES = [
  'AUTO',
  'NONE',
  'CONTROL_5',
  'CONTROL_10',
] as const

export type ControlDeskMode = (typeof CONTROL_DESK_MODES)[number]

export const CONTROL_DESK_5_MINUTES = 5
export const CONTROL_DESK_10_MINUTES = 10
export const EXTRA_RX_PROJECTION_MINUTES = 5

export type ProfileDurationTestInput = {
  id?: string
  code?: string | null
  name: string
  theoreticalDurationMinutes?: number | null
}

export type ProfileDurationBreakdown = {
  testsMinutes: number
  definedTestsCount: number
  undefinedTestsCount: number
  hasExamenMedico: boolean
  hasControlDeskTrigger: boolean
  resolvedControlDeskMode: Exclude<ControlDeskMode, 'AUTO'>
  controlDeskMinutes: number
  extraRxProjections: number
  extraRxMinutes: number
  calculatedDurationMinutes: number
  durationOverrideMinutes: number | null
  effectiveDurationMinutes: number
  isManualOverride: boolean
}

const EXAMEN_MEDICO_CODES = new Set([
  'GEN-015',
  'MED-01',
  'GEN-EM-AMI',
  'GEN-EM-SOD',
  'GEN-EM-FLO',
])

export function isControlDeskMode(value: unknown): value is ControlDeskMode {
  return (
    typeof value === 'string' &&
    (CONTROL_DESK_MODES as readonly string[]).includes(value)
  )
}

export function normalizeControlDeskMode(value: unknown): ControlDeskMode {
  return isControlDeskMode(value) ? value : 'AUTO'
}

function testMatchesExamenMedico(test: ProfileDurationTestInput): boolean {
  const code = (test.code ?? '').trim().toUpperCase()
  if (EXAMEN_MEDICO_CODES.has(code)) return true
  const norm = normalizeCatalogLabel(test.name)
  return norm.includes('EXAMEN MEDICO')
}

function testMatchesControlDeskStudy(test: ProfileDurationTestInput): boolean {
  const code = (test.code ?? '').trim().toUpperCase()
  if (
    code === 'GEN-013' ||
    code === 'GEN-014' ||
    code === 'ESPIRO-01' ||
    code === 'GEN-003' ||
    code === 'AUDIO-01' ||
    code.startsWith('RX-')
  ) {
    return true
  }
  const norm = normalizeCatalogLabel(test.name)
  if (norm.includes('ESPIROM')) return true
  if (norm.includes('AUDIOM')) return true
  if (
    norm.startsWith('RX ') ||
    norm.includes(' RX ') ||
    norm.includes('RADIOGRAF') ||
    norm.includes('TELE DE TORAX')
  ) {
    return true
  }
  return false
}

export function calculateProfileDuration(input: {
  tests: readonly ProfileDurationTestInput[]
  controlDeskMode?: unknown
  extraRxProjections?: number | null
  durationOverrideMinutes?: number | null
}): ProfileDurationBreakdown {
  let testsMinutes = 0
  let definedTestsCount = 0
  let undefinedTestsCount = 0
  let hasExamenMedico = false
  let hasControlDeskTrigger = false

  for (const t of input.tests) {
    if (testMatchesExamenMedico(t)) hasExamenMedico = true
    if (testMatchesControlDeskStudy(t)) hasControlDeskTrigger = true

    if (
      typeof t.theoreticalDurationMinutes === 'number' &&
      Number.isFinite(t.theoreticalDurationMinutes) &&
      t.theoreticalDurationMinutes >= 0
    ) {
      testsMinutes += Math.round(t.theoreticalDurationMinutes)
      definedTestsCount += 1
    } else {
      undefinedTestsCount += 1
    }
  }

  const mode = normalizeControlDeskMode(input.controlDeskMode)
  let resolvedControlDeskMode: Exclude<ControlDeskMode, 'AUTO'> = 'NONE'
  let controlDeskMinutes = 0

  if (mode === 'CONTROL_5') {
    resolvedControlDeskMode = 'CONTROL_5'
    controlDeskMinutes = CONTROL_DESK_5_MINUTES
  } else if (mode === 'CONTROL_10') {
    resolvedControlDeskMode = 'CONTROL_10'
    controlDeskMinutes = CONTROL_DESK_10_MINUTES
  } else if (mode === 'AUTO') {
    if (hasControlDeskTrigger) {
      if (hasExamenMedico) {
        resolvedControlDeskMode = 'CONTROL_5'
        controlDeskMinutes = CONTROL_DESK_5_MINUTES
      } else {
        resolvedControlDeskMode = 'CONTROL_10'
        controlDeskMinutes = CONTROL_DESK_10_MINUTES
      }
    }
  }

  const rawExtra =
    typeof input.extraRxProjections === 'number' &&
    Number.isFinite(input.extraRxProjections)
      ? Math.max(0, Math.floor(input.extraRxProjections))
      : 0
  const extraRxMinutes = rawExtra * EXTRA_RX_PROJECTION_MINUTES

  const calculatedDurationMinutes =
    testsMinutes + controlDeskMinutes + extraRxMinutes

  const overrideVal =
    typeof input.durationOverrideMinutes === 'number' &&
    Number.isFinite(input.durationOverrideMinutes) &&
    input.durationOverrideMinutes >= 0
      ? Math.round(input.durationOverrideMinutes)
      : null

  const effectiveDurationMinutes =
    overrideVal !== null ? overrideVal : calculatedDurationMinutes

  return {
    testsMinutes,
    definedTestsCount,
    undefinedTestsCount,
    hasExamenMedico,
    hasControlDeskTrigger,
    resolvedControlDeskMode,
    controlDeskMinutes,
    extraRxProjections: rawExtra,
    extraRxMinutes,
    calculatedDurationMinutes,
    durationOverrideMinutes: overrideVal,
    effectiveDurationMinutes,
    isManualOverride: overrideVal !== null,
  }
}

export function resolveEffectiveProfileDuration(profile: {
  calculatedDurationMinutes?: number | null
  durationOverrideMinutes?: number | null
} | null | undefined): number | null {
  if (!profile) return null
  if (
    typeof profile.durationOverrideMinutes === 'number' &&
    Number.isFinite(profile.durationOverrideMinutes) &&
    profile.durationOverrideMinutes >= 0
  ) {
    return Math.round(profile.durationOverrideMinutes)
  }
  if (
    typeof profile.calculatedDurationMinutes === 'number' &&
    Number.isFinite(profile.calculatedDurationMinutes) &&
    profile.calculatedDurationMinutes >= 0
  ) {
    return Math.round(profile.calculatedDurationMinutes)
  }
  return null
}

export function formatMinutesLabel(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) return 'Sin definir'
  const total = Math.max(0, Math.round(minutes))
  if (total < 60) return `${total} min`
  const h = Math.floor(total / 60)
  const m = total % 60
  return m === 0 ? `${total} min (${h} h)` : `${total} min (${h} h ${m} min)`
}

export function controlDeskModeLabel(mode: ControlDeskMode): string {
  switch (mode) {
    case 'AUTO':
      return 'Automático (según pruebas)'
    case 'CONTROL_5':
      return '+5 min (Espiro/Audio/RX)'
    case 'CONTROL_10':
      return '+10 min (Espiro/Audio/RX + Signos)'
    case 'NONE':
      return 'Sin mesa de control (0 min)'
  }
}
