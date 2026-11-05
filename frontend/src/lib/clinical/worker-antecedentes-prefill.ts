import prisma from '@/lib/prisma'
import { mergeProfileAntecedentesIntoConsulta } from '@/lib/clinical/consulta-antecedentes'

/** Último snapshot `antecedentes_captured` de otro evento del trabajador (excluye evento actual). */
export async function findLatestWorkerAntecedentesCaptured(
  workerId: string,
  excludeEventId: string,
): Promise<Record<string, unknown> | null> {
  const exam = await prisma.medicalExam.findFirst({
    where: {
      event: { workerId, id: { not: excludeEventId } },
    },
    orderBy: { updatedAt: 'desc' },
    select: { physicalExamData: true },
  })
  if (!exam?.physicalExamData || typeof exam.physicalExamData !== 'object') return null
  const captured = (exam.physicalExamData as Record<string, unknown>).antecedentes_captured
  return captured && typeof captured === 'object' && !Array.isArray(captured)
    ? (captured as Record<string, unknown>)
    : null
}

/**
 * Historial maestro + snapshots de examen (visita actual y previa) para prellenar consulta/examen.
 */
export function buildWorkerLongitudinalAntecedentesPrefill(args: {
  clinicalHistoryData: Record<string, unknown> | null | undefined
  currentExamCaptured?: Record<string, unknown> | null
  priorExamCaptured?: Record<string, unknown> | null
}): Record<string, unknown> | null {
  const history = args.clinicalHistoryData ?? {}
  const visitChain = mergeProfileAntecedentesIntoConsulta(
    {},
    args.priorExamCaptured ?? {},
    args.currentExamCaptured ?? {},
  )
  const merged = mergeProfileAntecedentesIntoConsulta({}, history, visitChain)
  return Object.keys(merged).length > 0 ? merged : null
}
