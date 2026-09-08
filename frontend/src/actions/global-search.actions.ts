'use server'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { isAdminLike } from '@/lib/auth/roles'

/** AMI-SR F-017 minuta #4 — resultado unificado de búsqueda global. */
export type GlobalSearchResult = {
  id: string
  type: 'patient' | 'expediente' | 'company'
  title: string
  subtitle: string
  href: string
}

const MIN_QUERY_LENGTH = 2
const MAX_PATIENTS = 8
const MAX_EXPEDIENTES = 6
const MAX_COMPANIES = 5

function normalizeQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

function splitTerms(query: string): string[] {
  return query
    .split(' ')
    .map((t) => t.trim())
    .filter(Boolean)
}

function buildWorkerNameWhere(terms: string[]) {
  return {
    AND: terms.map((term) => ({
      OR: [
        { firstName: { contains: term, mode: 'insensitive' as const } },
        { lastName: { contains: term, mode: 'insensitive' as const } },
      ],
    })),
  }
}

export async function globalSearchAction(rawQuery: string): Promise<{
  success: boolean
  results: GlobalSearchResult[]
  error?: string
}> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.role) {
    return { success: false, results: [], error: 'No autorizado' }
  }
  if (session.user.role === 'COMPANY_CLIENT') {
    return { success: false, results: [], error: 'No autorizado' }
  }

  const query = normalizeQuery(rawQuery)
  if (query.length < MIN_QUERY_LENGTH) {
    return { success: true, results: [] }
  }

  const terms = splitTerms(query)
  const compact = query.replace(/\s+/g, '').toLowerCase()

  try {
    const results: GlobalSearchResult[] = []

    const workers = await prisma.worker.findMany({
      where: {
        OR: [
          buildWorkerNameWhere(terms),
          { universalId: { contains: query, mode: 'insensitive' } },
          ...(compact.length >= 3
            ? [{ nationalId: { contains: query, mode: 'insensitive' as const } }]
            : []),
          { email: { contains: query, mode: 'insensitive' } },
          { phone: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        universalId: true,
        company: { select: { name: true } },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: MAX_PATIENTS,
    })

    for (const w of workers) {
      const name = `${w.firstName} ${w.lastName}`.trim()
      results.push({
        id: `patient-${w.id}`,
        type: 'patient',
        title: name,
        subtitle: [w.universalId, w.company?.name].filter(Boolean).join(' · '),
        href: `/workers/${w.id}`,
      })
    }

    const expedientes = await prisma.medicalEvent.findMany({
      where: {
        OR: [
          ...(query.length >= 4
            ? [{ id: { contains: query, mode: 'insensitive' as const } }]
            : []),
          {
            worker: buildWorkerNameWhere(terms),
          },
          { worker: { universalId: { contains: query, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        status: true,
        checkInDate: true,
        createdAt: true,
        worker: {
          select: {
            firstName: true,
            lastName: true,
            universalId: true,
            company: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPEDIENTES,
    })

    for (const ev of expedientes) {
      const patient = `${ev.worker.firstName} ${ev.worker.lastName}`.trim()
      const folioShort = ev.id.slice(0, 8).toUpperCase()
      results.push({
        id: `expediente-${ev.id}`,
        type: 'expediente',
        title: `Expediente ${folioShort}`,
        subtitle: [patient, ev.worker.universalId, ev.worker.company?.name]
          .filter(Boolean)
          .join(' · '),
        href: `/events/${ev.id}`,
      })
    }

    if (isAdminLike(session.user.role)) {
      const companies = await prisma.company.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { rfc: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, rfc: true },
        orderBy: { name: 'asc' },
        take: MAX_COMPANIES,
      })

      for (const c of companies) {
        results.push({
          id: `company-${c.id}`,
          type: 'company',
          title: c.name,
          subtitle: c.rfc ? `RFC ${c.rfc}` : 'Empresa',
          href: `/companies/${c.id}`,
        })
      }
    }

    return { success: true, results }
  } catch (error) {
    console.error('[globalSearchAction]', error)
    return {
      success: false,
      results: [],
      error: 'No se pudo completar la búsqueda.',
    }
  }
}
