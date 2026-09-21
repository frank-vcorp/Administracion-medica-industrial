/**
 * Limpieza operativa: pacientes, expedientes (cascade) y empresas cliente.
 * Preserva catálogo `medical_tests` y empresa «Público General».
 */
import prisma from '@/lib/prisma'
import { isPublicGeneralCompany } from '@/lib/public-general-company'
import { deleteCompanies } from '@/services/company.service'
import { deleteWorkers } from '@/services/worker.service'

export type OperationalCleanupPreview = {
  workerCount: number
  medicalEventCount: number
  companyDeleteCount: number
  companyTotal: number
  preservedCompanyNames: string[]
  medicalTestCount: number
}

export async function previewOperationalCleanup(): Promise<OperationalCleanupPreview> {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, rfc: true },
  })
  const preserve = companies.filter((c) => isPublicGeneralCompany(c))
  const deleteCompanyIds = companies
    .filter((c) => !isPublicGeneralCompany(c))
    .map((c) => c.id)

  const [workerCount, medicalEventCount, medicalTestCount] = await Promise.all([
    prisma.worker.count(),
    prisma.medicalEvent.count(),
    prisma.medicalTest.count(),
  ])

  return {
    workerCount,
    medicalEventCount,
    companyDeleteCount: deleteCompanyIds.length,
    companyTotal: companies.length,
    preservedCompanyNames: preserve.map((c) => c.name),
    medicalTestCount,
  }
}

export type OperationalCleanupResult =
  | {
      ok: true
      deletedWorkers: number
      deletedCompanies: number
      after: OperationalCleanupPreview
    }
  | { ok: false; code: 'NOT_FOUND' | 'INTERNAL_ERROR'; error: string }

export async function runOperationalCleanup(args: {
  actorUserId: string
  reason?: string
}): Promise<OperationalCleanupResult> {
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, rfc: true },
  })
  const deleteCompanyIds = companies
    .filter((c) => !isPublicGeneralCompany(c))
    .map((c) => c.id)

  const workers = await prisma.worker.findMany({ select: { id: true } })
  const deleteWorkerIds = workers.map((w) => w.id)

  if (deleteWorkerIds.length === 0 && deleteCompanyIds.length === 0) {
    const after = await previewOperationalCleanup()
    return {
      ok: true,
      deletedWorkers: 0,
      deletedCompanies: 0,
      after,
    }
  }

  let deletedWorkers = 0
  let deletedCompanies = 0

  if (deleteWorkerIds.length > 0) {
    const wr = await deleteWorkers({
      workerIds: deleteWorkerIds,
      actorUserId: args.actorUserId,
      reason: args.reason ?? 'operational-cleanup',
    })
    if (!wr.ok) {
      return { ok: false, code: 'INTERNAL_ERROR', error: wr.error }
    }
    deletedWorkers = wr.deletedCount
  }

  if (deleteCompanyIds.length > 0) {
    const cr = await deleteCompanies({
      companyIds: deleteCompanyIds,
      actorUserId: args.actorUserId,
      reason: args.reason ?? 'operational-cleanup',
    })
    if (!cr.ok) {
      return { ok: false, code: 'INTERNAL_ERROR', error: cr.error }
    }
    deletedCompanies = cr.deletedCount
  }

  const after = await previewOperationalCleanup()
  return {
    ok: true,
    deletedWorkers,
    deletedCompanies,
    after,
  }
}
