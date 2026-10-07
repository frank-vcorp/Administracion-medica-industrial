'use server'

import prisma from '@/lib/prisma'
// IMPL-20260817-08-C4 (ARCH-20260817-02 DA-1): heurística `includes('no apto')`
// migra a `isNoCumple(aptitud)` estructurada con fallback legacy. El literal
// canónico "NO CUMPLE CON LOS CRITERIOS..." NO contiene "no apto", por lo
// que la heurística histórica clasificaba erróneamente como APTO.
import { isNoCumple } from '@/lib/clinical/aptitud.helper'
import { resolvePortalCompanyAccess } from '@/lib/portal-access'

/**
 * Obtiene las métricas generales de una empresa para el Dashboard B2B
 * El companyId se extrae de la sesión segura del servidor (NO del cliente)
 * @fix IMPL-20260225-01 - Elimina vulnerabilidad de Acceso Inadecuado a Datos
 */
export async function getCompanyDashboardStats() {
  try {
    const { companyId } = await resolvePortalCompanyAccess()

    const workersCount = await prisma.worker.count({
      where: { companyId }
    })

    // FIX REFERENCE: FIX-20260225-02 - Optimización de consultas para evitar DoS lógico
    const totalEvents = await prisma.medicalEvent.count({
      where: { worker: { companyId } }
    })

    const completedEvents = await prisma.medicalEvent.count({
      where: { worker: { companyId }, status: 'COMPLETED' }
    })

    const inProgressEvents = totalEvents - completedEvents

    // IMPL-20260817-08-C4 (ARCH-20260817-02 DA-1): clasificar apto/no-apto desde
    // el campo estructurado `aptitud` de `MedicalExam.physicalExamData`. Fallback
    // legacy: si `aptitud` es null/indef, cae a `finalDiagnosis.includes('no apto')`
    // (preserva dictámenes históricos sin campo estructurado).
    const verdicts = await prisma.medicalVerdict.findMany({
      where: { event: { worker: { companyId } } },
      select: {
        finalDiagnosis: true,
        event: {
          select: {
            exam: {
              select: { physicalExamData: true }
            }
          }
        }
      }
    })

    let aptos = 0
    let noAptos = 0
    verdicts.forEach(v => {
      const physicalExamData = (v.event?.exam?.physicalExamData ?? null) as
        | { aptitud?: string | null }
        | null
      const aptitud = physicalExamData?.aptitud ?? null
      if (aptitud) {
        // Camino estructurado (DA-1): lee el campo `aptitud` canónico.
        if (isNoCumple(aptitud)) noAptos++
        else aptos++
      } else {
        // Fallback legacy: dictámenes sin `aptitud` estructurada.
        const diag = (v.finalDiagnosis ?? '').toLowerCase()
        if (diag.includes('no apto')) noAptos++
        else aptos++
      }
    })

    return {
      success: true,
      stats: {
        workers: workersCount,
        totalEvents,
        completed: completedEvents,
        inProgress: inProgressEvents,
        aptos,
        noAptos
      }
    }
  } catch (error) {
    // FIX REFERENCE: FIX-20260225-02 - Sanitización de logs
    console.error("Error fetching company stats:", error instanceof Error ? error.message : "Unknown error")
    return { success: false, error: 'Hubo un error al cargar las métricas.' }
  }
}

/**
 * Obtiene la lista de trabajadores de una empresa con su último estatus médico
 * Solo retorna datos de la empresa del usuario logueado
 * @fix IMPL-20260225-01 - Optimiza con select() en lugar de include()
 */
export async function getCompanyWorkersWithStatus() {
  try {
    const { companyId } = await resolvePortalCompanyAccess()

    const workers = await prisma.worker.findMany({
      where: { companyId },
      select: {
        id: true,
        universalId: true,
        nationalId: true,
        firstName: true,
        lastName: true,
        email: true,
        medicalHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            createdAt: true,
            verdict: {
              select: {
                id: true,
                finalDiagnosis: true,
                // IMPL-20260817-08-C6 (ARCH-20260817-02 DA-1): exponer
                // `physicalExamData.aptitud` para clasificación estructurada en /portal/workers.
                event: {
                  select: {
                    exam: {
                      select: { physicalExamData: true }
                    }
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { lastName: 'asc' }
    })

    return { success: true, workers }
  } catch (error) {
    console.error("Error fetching workers for portal:", error)
    return { success: false, error: 'Hubo un error al cargar los trabajadores.' }
  }
}

/**
 * Obtiene el historial de todos los eventos médicos de una empresa
 * Solo retorna datos de la empresa del usuario logueado
 * @fix IMPL-20260225-01 - Elimina vulnerabilidad Broken Access Control
 */
function parsePortalDateBound(isoDate: string, endOfDay: boolean): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null
  const [y, m, d] = isoDate.split('-').map(Number)
  if (endOfDay) return new Date(y, m - 1, d, 23, 59, 59, 999)
  return new Date(y, m - 1, d, 0, 0, 0, 0)
}

export type PortalEventsHistoryFilters = {
  workerQuery?: string
  dateFrom?: string
  dateTo?: string
}

export async function getCompanyEventsHistory(filters?: PortalEventsHistoryFilters) {
  try {
    const { companyId } = await resolvePortalCompanyAccess()

    const workerNameTerms = (filters?.workerQuery ?? '')
      .trim()
      .split(/\s+/)
      .filter((t) => t.length >= 2)
    const dateFrom = filters?.dateFrom ? parsePortalDateBound(filters.dateFrom, false) : null
    const dateTo = filters?.dateTo ? parsePortalDateBound(filters.dateTo, true) : null

    const events = await prisma.medicalEvent.findMany({
      where: {
        worker: {
          companyId,
          ...(workerNameTerms.length > 0
            ? {
                AND: workerNameTerms.map((term) => ({
                  OR: [
                    { firstName: { contains: term, mode: 'insensitive' as const } },
                    { lastName: { contains: term, mode: 'insensitive' as const } },
                  ],
                })),
              }
            : {}),
        },
        ...(dateFrom || dateTo
          ? {
              createdAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        appointment: {
          select: {
            id: true,
            expedientId: true,
            serviceProfile: { select: { name: true } },
          },
        },
        eventTests: {
          select: {
            id: true,
            testNameSnapshot: true,
            status: true,
            fileUrl: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        worker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            universalId: true,
          }
        },
        verdict: {
          select: {
            id: true,
            finalDiagnosis: true,
            signedAt: true,
            // IMPL-20260817-08-C5 (ARCH-20260817-02 DA-1): exponer
            // `physicalExamData.aptitud` para clasificación estructurada en el portal.
            event: {
              select: {
                exam: {
                  select: { physicalExamData: true }
                }
              }
            }
          }
        },
        branch: {
          select: {
            id: true,
            name: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return { success: true, events }
  } catch (error) {
    console.error("Error fetching events history for portal:", error)
    return { success: false, error: 'Hubo un error al cargar el historial.' }
  }
}

export async function getPortalWorkerDetail(workerId: string) {
  try {
    const { companyId } = await resolvePortalCompanyAccess()

    const worker = await prisma.worker.findFirst({
      where: { id: workerId, companyId },
      select: {
        id: true,
        universalId: true,
        firstName: true,
        lastName: true,
        nationalId: true,
        dob: true,
        email: true,
        phone: true,
        lastIdentityFrontFileUrl: true,
        lastIdentityBackFileUrl: true,
        lastIdentityVerifiedAt: true,
        lastInformedConsentPdfUrl: true,
        lastInformedConsentSignedAt: true,
        medicalProfile: { select: { id: true, name: true } },
        appointments: {
          where: { companyId },
          orderBy: { scheduledAt: 'desc' },
          take: 24,
          select: {
            id: true,
            expedientId: true,
            scheduledAt: true,
            status: true,
            identityFrontFileUrl: true,
            identityBackFileUrl: true,
            informedConsentPdfUrl: true,
            informedConsentSignedAt: true,
            serviceProfile: { select: { name: true } },
            medicalEvents: {
              select: { id: true, status: true, createdAt: true },
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
    })

    if (!worker) {
      return { success: false as const, error: 'Trabajador no encontrado' }
    }

    return { success: true as const, worker }
  } catch (error) {
    console.error('Error fetching portal worker:', error instanceof Error ? error.message : error)
    return { success: false as const, error: 'No se pudo cargar la ficha' }
  }
}

