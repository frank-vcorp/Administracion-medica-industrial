import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// FIX-20260730-06: tamaño de chunk para hard-delete masivo de Workers.
// Coincide con DELETE_CHUNK_SIZE usado en CompanyService para mantener un
// patrón consistente. Con cascade DB activado, cada `tx.worker.delete()`
// puede tardar segundos — 5 es el balance entre throughput y timeout Vercel.
const DELETE_CHUNK_SIZE = 5

export const getWorkerById = async (id: string) => {
    return await prisma.worker.findUnique({
        where: { id },
        include: {
            company: true,
            medicalHistory: {
                orderBy: { createdAt: 'desc' }
            }
        }
    })
}

export const getWorkerByUniversalId = async (universalId: string) => {
    return await prisma.worker.findUnique({
        where: { universalId },
        include: { medicalHistory: true }
    })
}

export const createWorker = async (data: Prisma.WorkerCreateInput) => {
    return await prisma.worker.create({
        data
    })
}

export const updateWorker = async (id: string, data: Prisma.WorkerUpdateInput) => {
    return await prisma.worker.update({
        where: { id },
        data
    })
}

export const deleteWorker = async (id: string) => {
    return await prisma.worker.delete({
        where: { id }
    })
}

/**
 * FIX-20260730-06: Hard delete masivo de pacientes (Workers) con TODO su
 * historial clínico.
 *
 * Atomicidad per-chunk: el lote se divide en chunks de DELETE_CHUNK_SIZE
 * workers; cada chunk se procesa en su propio `prisma.$transaction`. Si un
 * chunk falla (timeout Vercel), los chunks previos ya quedaron commitidos.
 *
 * Cascade DB maneja la propagación: Appointment, ClinicalHistory,
 * MedicalEvent, LabOrder, ProjectWorker, WorkerReportEmail + sus transitivos
 * (EventTest, LabRecord, StudyRecord, MedicalExam, MedicalVerdict,
 * AIPrediagnosisSnapshot, DoctorStudyReview, PrefilledInvitation) — todos
 * configurados `onDelete: Cascade` vía migración
 * `20260730180000_worker_cascade_delete`.
 *
 * Solo permitido para rol SUPERADMIN — la RBAC se valida en la server
 * action `deleteWorkersAction`. AuditLog NO tiene FK a Worker: los logs
 * antiguos se preservan intactos.
 *
 * @returns
 *   - { ok: true, deletedCount, deletedWorkerIds } cuando se eliminan uno o más
 *   - { ok: false, code: 'INVALID_INPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR', error }
 */
export async function deleteWorkers(args: {
    workerIds: string[]
    actorUserId: string
    reason?: string
}): Promise<
    | { ok: true; deletedCount: number; deletedWorkerIds: string[] }
    | {
        ok: false
        code: 'INVALID_INPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR'
        error: string
    }
> {
    const workerIds = Array.isArray(args.workerIds) ? args.workerIds : []
    if (workerIds.length === 0) {
        return { ok: false, code: 'INVALID_INPUT', error: 'workerIds requerido (array no vacío)' }
    }

    // Snapshot de nombres pre-delete para audit log (estable aunque el
    // cascade borre los registros después).
    const workers = await prisma.worker.findMany({
        where: { id: { in: workerIds } },
        select: { id: true, firstName: true, lastName: true, universalId: true },
    })
    if (workers.length === 0) {
        return { ok: false, code: 'NOT_FOUND', error: 'No se encontraron trabajadores con esos IDs' }
    }

    const nameById = new Map(
        workers.map((w) => [w.id, `${w.firstName} ${w.lastName}`] as const)
    )
    const deletedIds: string[] = []

    try {
        for (let i = 0; i < workerIds.length; i += DELETE_CHUNK_SIZE) {
            const chunk = workerIds.slice(i, i + DELETE_CHUNK_SIZE)
            const chunkNames = chunk.map((id) => nameById.get(id) ?? null)

            await prisma.$transaction(
                async (tx) => {
                    // Cascade DB borra automáticamente: Appointment, ClinicalHistory,
                    // MedicalEvent (con EventTest, LabRecord, StudyRecord, MedicalExam,
                    // MedicalVerdict), LabOrder (con LabOrderItem, LabResult, etc.),
                    // ProjectWorker, WorkerReportEmail + transitivos (PrefilledInvitation,
                    // StudyExtractionSnapshot → AIPrediagnosisSnapshot → DoctorStudyReview).
                    for (const workerId of chunk) {
                        await tx.worker.delete({ where: { id: workerId } })
                    }

                    // Audit log por chunk con los ids/nombres del chunk.
                    await tx.auditLog.create({
                        data: {
                            userId: args.actorUserId,
                            action: 'WORKERS_HARD_DELETE',
                            entity: 'Worker',
                            entityId: chunk.join(','),
                            details: {
                                deletedWorkerIds: chunk,
                                deletedWorkerNames: chunkNames,
                                workerCount: chunk.length,
                                reason: args.reason ?? null,
                            } as Prisma.InputJsonValue,
                        },
                    })
                },
                { timeout: 30000, maxWait: 10000 }
            )

            deletedIds.push(...chunk)
        }

        return { ok: true, deletedCount: deletedIds.length, deletedWorkerIds: deletedIds }
    } catch (err) {
        console.error('[deleteWorkers] failed:', err)
        return {
            ok: false,
            code: 'INTERNAL_ERROR',
            error: (err as Error).message ?? 'Error desconocido',
        }
    }
}
