'use server'

import { getServerSession } from 'next-auth/next'
import type { EventStatus } from '@prisma/client'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'

const workerSelect = {
  id: true,
  universalId: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  dob: true,
  companyId: true,
  medicalProfileId: true,
  createdAt: true,
  lastIdentityDocumentType: true,
  lastIdentityVerifiedAt: true,
  company: {
    select: { name: true, defaultBranchId: true },
  },
  medicalProfile: {
    select: { id: true, name: true },
  },
} as const

export type PatientExpedienteListRow = {
  eventId: string | null
  eventStatus: EventStatus | null
  sortDate: string
  worker: {
    id: string
    universalId: string
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    dob: Date | null
    companyId: string | null
    medicalProfileId: string | null
    createdAt: Date
    lastIdentityDocumentType: string | null
    lastIdentityVerifiedAt: Date | null
    company: { name: string; defaultBranchId: string | null } | null
    medicalProfile: { id: string; name: string } | null
  }
}

function sortRowsByDateDesc(rows: PatientExpedienteListRow[]): PatientExpedienteListRow[] {
  return [...rows].sort(
    (a, b) => new Date(b.sortDate).getTime() - new Date(a.sortDate).getTime(),
  )
}

/**
 * Listado unificado paciente + expediente (Word R-16).
 * Una fila por atención clínica, ordenada de más reciente a más antigua.
 */
export async function getPatientExpedienteList(options?: {
  companyId?: string
  status?: EventStatus | 'ALL' | 'NO_EVENT'
}) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return { success: false as const, error: 'No autorizado', rows: [] as PatientExpedienteListRow[] }
  }

  try {
    if (options?.status === 'NO_EVENT') {
      const workers = await prisma.worker.findMany({
        where: {
          ...(options.companyId ? { companyId: options.companyId } : {}),
          medicalHistory: { none: {} },
        },
        select: workerSelect,
        orderBy: { createdAt: 'desc' },
      })

      return {
        success: true as const,
        rows: workers.map((worker) => ({
          eventId: null,
          eventStatus: null,
          sortDate: worker.createdAt.toISOString(),
          worker,
        })),
      }
    }

    const events = await prisma.medicalEvent.findMany({
      where: {
        ...(options?.status && options.status !== 'ALL'
          ? { status: options.status }
          : {}),
        ...(options?.companyId
          ? { worker: { companyId: options.companyId } }
          : {}),
      },
      select: {
        id: true,
        status: true,
        checkInDate: true,
        createdAt: true,
        worker: { select: workerSelect },
      },
    })

    const rows: PatientExpedienteListRow[] = events.map((event) => ({
      eventId: event.id,
      eventStatus: event.status,
      sortDate: (event.checkInDate ?? event.createdAt).toISOString(),
      worker: event.worker,
    }))

    return { success: true as const, rows: sortRowsByDateDesc(rows) }
  } catch (error) {
    console.error('[getPatientExpedienteList]', error)
    return {
      success: false as const,
      error: error instanceof Error ? error.message : 'Error al cargar el listado',
      rows: [] as PatientExpedienteListRow[],
    }
  }
}
