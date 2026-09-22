import type { ComponentType } from 'react'
import {
  ClipboardList,
  Eye,
  FileText,
  FlaskConical,
  Headphones,
  Heart,
  HeartPulse,
  Microscope,
  ScanLine,
  ScanEye,
  Scale,
  Wind,
  type LucideProps,
} from 'lucide-react'
import { getCanonicalAIStudyType, type StudyTestRef } from '@/lib/study-ai'
import { isExamenMedicoTestName } from '@/lib/clinical/examen-medico-variant'

export type StudyMenuIconInput = {
  testNameSnapshot: string
  fileUrl?: string | null
  test?: {
    category?: { name?: string | null } | null
    options?: unknown
  } | null
}

function isSomatometria(name: string) {
  const lower = name.toLowerCase().trim()
  return (
    lower.includes('somatometría') ||
    lower.includes('somatometria') ||
    lower.includes('signos vitales')
  )
}

function isAgudezaVisual(name: string) {
  const lower = name.toLowerCase().trim()
  return lower.includes('agudeza visual')
}

function isLabTest(test: StudyMenuIconInput) {
  const catName = test.test?.category?.name?.toLowerCase() || ''
  const testName = test.testNameSnapshot.toLowerCase()
  return (
    catName.includes('lab') ||
    catName.includes('laboratorio') ||
    catName.includes('laborat') ||
    testName.includes('biometría') ||
    testName.includes('biometria') ||
    testName.includes('orina') ||
    testName.includes('ego') ||
    testName.includes('sangre') ||
    testName.includes('sanguínea') ||
    testName.includes('sanguinea') ||
    testName.includes('química') ||
    testName.includes('quimica')
  )
}

export function resolveStudyMenuLucideIcon(
  test: StudyMenuIconInput,
): ComponentType<LucideProps> {
  const name = test.testNameSnapshot
  if (isExamenMedicoTestName(name)) return ClipboardList
  if (isSomatometria(name)) return Scale
  if (isAgudezaVisual(name)) return Eye

  const canonical = getCanonicalAIStudyType({
    testNameSnapshot: name,
    test: (test.test ?? null) as StudyTestRef['test'],
  })
  if (canonical === 'Audiometria') return Headphones
  if (canonical === 'Espirometria') return Wind
  if (canonical === 'Campimetria') return ScanEye
  if (canonical === 'Electrocardiograma') return HeartPulse
  if (canonical === 'RiesgoCardiovascular') return Heart
  if (canonical === 'Rayos_X') return ScanLine
  if (test.fileUrl) return FileText
  if (isLabTest(test)) return FlaskConical
  return Microscope
}

/** Icono de estudio con el mismo estilo que el menú lateral (Lucide + círculo AMI). */
export function StudyMenuIcon({
  test,
  active = false,
  className = '',
}: {
  test: StudyMenuIconInput
  active?: boolean
  className?: string
}) {
  const Icon = resolveStudyMenuLucideIcon(test)
  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
        active ? 'bg-[#592c82] text-white' : 'bg-[#592c82]/15 text-[#592c82]'
      } ${className}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden="true" />
    </span>
  )
}
