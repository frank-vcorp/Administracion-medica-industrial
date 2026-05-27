'use server'

/**
 * @intervention IMPL-20260527-01
 * @see context/interconsultas/HANDOFF_ARCH-20260527-13_SOFIA_SLICE-C-ALTA-RAPIDA-MISMO-DIA.md
 */

import { z } from 'zod'
import prisma from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { generateUniversalId } from "@/lib/id.utils"
import { logAudit } from "@/actions/audit.actions"
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'

// Get all workers with their company name and jobPosition (includes defaultProfileId for auto-selection)
// @id IMPL-20260313-07
export async function getWorkers() {
    return await prisma.worker.findMany({
        include: {
            company: {
                select: { name: true, defaultBranchId: true }
            },
            jobPosition: {
                select: { id: true, name: true, defaultProfileId: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    })
}

/**
 * Retorna los trabajadores de una empresa específica, con incluidos de puesto y empresa.
 * @id IMPL-20260318-07
 */
export async function getWorkersByCompany(companyId: string) {
    return await prisma.worker.findMany({
        where: { companyId },
        include: {
            company: {
                select: { name: true, defaultBranchId: true }
            },
            jobPosition: {
                select: { id: true, name: true, defaultProfileId: true }
            }
        },
        orderBy: { lastName: 'asc' }
    })
}

export async function createWorker(formData: FormData) {
    try {
        const firstName = formData.get('firstName') as string
        const lastName = formData.get('lastName') as string
        const companyId = formData.get('companyId') as string

        if (!firstName || !lastName) {
            return { success: false, error: 'Nombre y apellidos son obligatorios' }
        }

        const dob = formData.get('dob') as string
        const gender = formData.get('gender') as string

        // IMPL-20260318-08: Detección de duplicados fuerte por nombre + apellido + fecha de nacimiento
        // Coincidencia: normalización minúsculas + trim para reducir falsos negativos por tipeo
        const duplicateCandidate = await prisma.worker.findFirst({
            where: {
                firstName: { equals: firstName.trim(), mode: 'insensitive' },
                lastName: { equals: lastName.trim(), mode: 'insensitive' },
                ...(dob ? { dob: new Date(dob) } : {}),
            },
            select: {
                id: true,
                universalId: true,
                firstName: true,
                lastName: true,
                dob: true,
                email: true,
                phone: true,
                company: { select: { id: true, name: true } },
            }
        })

        if (duplicateCandidate) {
            return {
                success: false,
                status: 'duplicate_found',
                existingWorker: duplicateCandidate,
            }
        }

        const universalId = generateUniversalId({ firstName, lastName, dob, gender })

        const jobPositionId = formData.get('jobPositionId') as string

        const worker = await prisma.worker.create({
            data: {
                firstName,
                lastName,
                universalId,
                dob: dob ? new Date(dob) : null,
                nationalId: formData.get('nationalId') as string,
                email: formData.get('email') as string,
                phone: formData.get('phone') as string,
                companyId: companyId || null,
                jobPositionId: jobPositionId || null,
            }
        })
        revalidatePath('/workers')
        // Retornamos también el Id de la empresa y Sucursal Default si la tiene para redirecciones
        const company = await prisma.company.findUnique({
            where: { id: companyId },
            select: { id: true, defaultBranchId: true }
        })
        
        return { 
            success: true, 
            status: 'created',
            worker: { 
                ...worker, 
                company: company ? { id: company.id, defaultBranchId: company.defaultBranchId } : null 
            } 
        }
    } catch (e: unknown) {
        const error = e as Error
        console.error('Error creating worker:', error)
        return { success: false, status: 'error', error: error.message || 'Error al crear el trabajador' }
    }
}

/**
 * Actualiza los datos de un trabajador existente.
 * @id IMPL-20260318-01
 */
export async function updateWorker(id: string, formData: FormData) {
    try {
        const firstName = formData.get('firstName') as string
        const lastName = formData.get('lastName') as string

        if (!firstName || !lastName) {
            return { success: false, error: 'Nombre y apellidos son obligatorios' }
        }

        const companyId = formData.get('companyId') as string
        const jobPositionId = formData.get('jobPositionId') as string
        const dob = formData.get('dob') as string

        await prisma.worker.update({
            where: { id },
            data: {
                firstName,
                lastName,
                dob: dob ? new Date(dob) : null,
                email: (formData.get('email') as string) || null,
                phone: (formData.get('phone') as string) || null,
                companyId: companyId || null,
                jobPositionId: jobPositionId || null,
            }
        })
        revalidatePath('/workers')
        return { success: true }
    } catch (e: unknown) {
        const error = e as Error
        console.error('Error updating worker:', error)
        return { success: false, error: error.message || 'Error al actualizar el trabajador' }
    }
}

/**
 * Actualiza solo los datos de contacto seguros del trabajador en el paso de corroboración.
 * Solo permite teléfono, email y empresa/puesto actual, sin tocar identidad.
 * @id IMPL-20260318-08
 */
export async function updateWorkerContactData(
    workerId: string,
    updates: { phone?: string; email?: string; companyId?: string; jobPositionId?: string }
) {
    try {
        await prisma.worker.update({
            where: { id: workerId },
            data: {
                ...(updates.phone !== undefined ? { phone: updates.phone || null } : {}),
                ...(updates.email !== undefined ? { email: updates.email || null } : {}),
                ...(updates.companyId !== undefined ? { companyId: updates.companyId || null } : {}),
                ...(updates.jobPositionId !== undefined ? { jobPositionId: updates.jobPositionId || null } : {}),
            }
        })
        revalidatePath('/workers')
        return { success: true }
    } catch (e: unknown) {
        const error = e as Error
        return { success: false, error: error.message || 'Error al actualizar datos de contacto' }
    }
}

/**
 * Corrige el nombre completo del trabajador durante la corroboración previa al check-in.
 * Solo actualiza firstName y lastName. Registra trazabilidad en AuditLog.
 * No toca CURP, NSS, empresa, puesto ni datos clínicos.
 * @id IMPL-20260514-01
 * @spec context/SPECs/SPEC_ARCH-20260514-01-ALINEACION-CORROBORACION-NOMBRE-INE.md
 */
export async function updateWorkerCorroboratedName(
    workerId: string,
    updates: { firstName: string; lastName: string }
) {
    try {
        const previous = await prisma.worker.findUnique({
            where: { id: workerId },
            select: { firstName: true, lastName: true },
        })
        if (!previous) return { success: false, error: 'Trabajador no encontrado' }

        const newFirstName = updates.firstName.trim()
        const newLastName = updates.lastName.trim()

        if (!newFirstName || !newLastName) {
            return { success: false, error: 'El nombre y los apellidos son obligatorios' }
        }

        await prisma.worker.update({
            where: { id: workerId },
            data: { firstName: newFirstName, lastName: newLastName },
        })

        // Trazabilidad: registrar corrección en AuditLog con nombre previo y nuevo
        await logAudit('IDENTITY_CORRECTION', 'Worker', workerId, {
            previousName: `${previous.firstName} ${previous.lastName}`,
            newName: `${newFirstName} ${newLastName}`,
            correctionSource: 'INE_CORROBORATION',
        })

        revalidatePath('/workers')
        revalidatePath('/appointments')
        return { success: true }
    } catch (e: unknown) {
        const error = e as Error
        return { success: false, error: error.message || 'Error al corregir nombre del trabajador' }
    }
}

// ===========================================================================
// IMPL-20260519-14: Alta Masiva de Trabajadores por Excel (ARCH-20260519-11)
// Ref: context/SPECs/SPEC_ARCH-20260519-11-ALTA-MASIVA-TRABAJADORES.md
//
// Restricciones críticas:
//  - companyId NUNCA llega desde cliente; se resuelve desde project.companyId
//  - gender solo se usa para generateUniversalId(); NO se persiste en Worker
//  - Limite: 200 filas por importación
// ===========================================================================

const BulkWorkerRowSchema = z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    nationalId: z.string().max(18).optional(),
    dob: z.string().optional(),
    gender: z.enum(['M', 'F']).optional(),
    email: z.union([z.string().email(), z.literal('')]).optional(),
    phone: z.string().max(15).optional(),
    jobPositionName: z.string().optional(),
    _rowIndex: z.number(),
})

export type BulkWorkerRow = z.infer<typeof BulkWorkerRowSchema>

export interface BulkImportResult {
    created: number
    duplicates: { rowIndex: number; firstName: string; lastName: string; existingId: string; existingUniversalId: string }[]
    warnings: { rowIndex: number; firstName: string; lastName: string; reason: string; existingId: string }[]
    errors: { rowIndex: number; firstName?: string; lastName?: string; reason: string }[]
    error?: string
}

const QuickWorkerRowSchema = z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    nationalId: z.string().max(18).optional(),
    dob: z.string().optional(),
    phone: z.string().max(15).optional(),
    jobPositionName: z.string().optional(),
    _rowIndex: z.number(),
})

export type QuickWorkerRow = z.infer<typeof QuickWorkerRowSchema>

/** Parsea una fecha que puede venir en formato DD/MM/AAAA o ISO */
function parseDob(raw: string | undefined): Date | null {
    if (!raw?.trim()) return null
    // Intentar DD/MM/AAAA
    const ddmmyyyy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyy) {
        const [, d, m, y] = ddmmyyyy
        const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`)
        return isNaN(dt.getTime()) ? null : dt
    }
    // Intentar ISO u otros
    const dt = new Date(raw)
    return isNaN(dt.getTime()) ? null : dt
}

/**
 * Importación masiva de trabajadores desde plantilla Excel (panel interno).
 * @id IMPL-20260519-14
 */
export async function bulkImportWorkers(
    rows: BulkWorkerRow[],
    projectId: string
): Promise<BulkImportResult> {
    const empty: BulkImportResult = { created: 0, duplicates: [], warnings: [], errors: [] }

    // 1. Verificar sesión y rol
    // FASE 1 (panel interno): solo ADMIN y RECEPTIONIST pueden importar trabajadores.
    // TODO FASE 2 (portal B2B COMPANY_CLIENT): agregar validación adicional
    //   project.companyId === session.user.companyId antes de resolver el proyecto.
    const session = await getServerSession(authOptions)
    if (!session) return { ...empty, error: 'No autorizado' }
    const _allowedBulkRoles = ['ADMIN', 'RECEPTIONIST'] as const
    if (!(_allowedBulkRoles as readonly string[]).includes(session.user.role)) {
        return { ...empty, error: 'No autorizado' }
    }

    // 2. Validar límite de filas
    if (rows.length > 200) {
        return { ...empty, error: 'El límite de esta importación es 200 filas.' }
    }

    // 3. Resolver proyecto y companyId
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { company: { select: { id: true, name: true } } },
    })
    if (!project) return { ...empty, error: 'Proyecto no encontrado' }

    const companyId = project.companyId
    const addedBy = (session.user as { id?: string }).id ?? null

    const result: BulkImportResult = { created: 0, duplicates: [], warnings: [], errors: [] }

    // 4. Precargar puestos de trabajo de la empresa para resolución por nombre
    const jobPositions = await prisma.jobPosition.findMany({
        where: { companyId },
        select: { id: true, name: true },
    })

    for (const rawRow of rows) {
        // 4a. Validar row con Zod
        const parsed = BulkWorkerRowSchema.safeParse(rawRow)
        if (!parsed.success) {
            result.errors.push({
                rowIndex: rawRow._rowIndex,
                firstName: rawRow.firstName,
                lastName: rawRow.lastName,
                reason: parsed.error.issues[0]?.message ?? 'Datos inválidos en la fila',
            })
            continue
        }

        const row = parsed.data
        const dobDate = parseDob(row.dob)

        // 4b. Buscar coincidencias por nombre (case-insensitive, sin filtro de empresa)
        const candidates = await prisma.worker.findMany({
            where: {
                firstName: { equals: row.firstName.trim(), mode: 'insensitive' },
                lastName: { equals: row.lastName.trim(), mode: 'insensitive' },
            },
            select: {
                id: true,
                universalId: true,
                firstName: true,
                lastName: true,
                dob: true,
                companyId: true,
            },
        })

        if (candidates.length > 0) {
            // Evaluar cada candidato con la matriz de clasificación
            let classified = false

            for (const candidate of candidates) {
                const sameCompany = candidate.companyId === companyId
                const incomingHasDob = !!dobDate
                const existingHasDob = !!candidate.dob

                if (incomingHasDob && existingHasDob) {
                    const dobMatch =
                        candidate.dob!.getFullYear() === dobDate!.getFullYear() &&
                        candidate.dob!.getMonth() === dobDate!.getMonth() &&
                        candidate.dob!.getDate() === dobDate!.getDate()

                    if (dobMatch && sameCompany) {
                        // 🔴 Duplicado duro
                        result.duplicates.push({
                            rowIndex: row._rowIndex,
                            firstName: row.firstName,
                            lastName: row.lastName,
                            existingId: candidate.id,
                            existingUniversalId: candidate.universalId,
                        })
                        classified = true
                        break
                    } else if (dobMatch && !sameCompany) {
                        // 🟡 Misma persona, empresa distinta
                        result.warnings.push({
                            rowIndex: row._rowIndex,
                            firstName: row.firstName,
                            lastName: row.lastName,
                            reason: 'Mismo nombre y fecha de nacimiento en empresa diferente — posible transferencia',
                            existingId: candidate.id,
                        })
                        classified = true
                        break
                    }
                    // Si DOB no coincide con ninguno → persona distinta, se crea
                } else {
                    // Uno o ambos sin DOB
                    result.warnings.push({
                        rowIndex: row._rowIndex,
                        firstName: row.firstName,
                        lastName: row.lastName,
                        reason: 'Mismo nombre pero sin fecha de nacimiento para confirmar identidad — requiere revisión manual',
                        existingId: candidate.id,
                    })
                    classified = true
                    break
                }
            }

            if (classified) continue
        }

        // 4c. Crear trabajador — gender solo para universalId, NO se persiste
        try {
            const universalId = generateUniversalId({
                firstName: row.firstName,
                lastName: row.lastName,
                dob: dobDate,
                gender: row.gender,
            })

            // Resolver jobPositionId por nombre (case-insensitive)
            const matchedPosition = row.jobPositionName
                ? jobPositions.find(
                      (jp) => jp.name.toLowerCase() === row.jobPositionName!.toLowerCase()
                  )
                : null

            const worker = await prisma.worker.create({
                data: {
                    firstName: row.firstName.trim(),
                    lastName: row.lastName.trim(),
                    universalId,
                    nationalId: row.nationalId?.trim() || null,
                    dob: dobDate,
                    email: row.email?.trim() || null,
                    phone: row.phone?.trim() || null,
                    companyId,
                    jobPositionId: matchedPosition?.id ?? null,
                    // gender NO se incluye — no existe columna gender en Worker
                },
            })

            // 4d. Crear relación ProjectWorker
            await prisma.projectWorker.create({
                data: {
                    projectId,
                    workerId: worker.id,
                    addedBy,
                },
            })

            result.created++
        } catch (e: unknown) {
            const err = e as Error
            result.errors.push({
                rowIndex: row._rowIndex,
                firstName: row.firstName,
                lastName: row.lastName,
                reason: err.message.includes('Unique constraint')
                    ? 'ID universal duplicado — revisar nombre y fecha de nacimiento'
                    : 'Error al crear trabajador',
            })
        }
    }

    // 5. Registrar AuditLog con resumen
    try {
        await prisma.auditLog.create({
            data: {
                userId: addedBy,
                action: 'BULK_IMPORT',
                entity: 'Worker',
                entityId: projectId,
                details: {
                    projectId,
                    companyId,
                    created: result.created,
                    duplicates: result.duplicates.length,
                    warnings: result.warnings.length,
                    errors: result.errors.length,
                },
            },
        })
    } catch {
        // El AuditLog no debe bloquear el resultado de la importación
    }

    revalidatePath('/workers')
    return result
}

/**
 * Alta rápida empresarial del mismo día (hasta 20 filas), sin Excel.
 * Reutiliza la matriz de deduplicación y persistencia ya validada en bulkImportWorkers.
 * @id IMPL-20260527-01
 */
export async function quickRegisterWorkersSameDay(
    rows: QuickWorkerRow[],
    projectId: string
): Promise<BulkImportResult> {
    const base: BulkImportResult = { created: 0, duplicates: [], warnings: [], errors: [] }

    if (rows.length === 0) {
        return { ...base, error: 'Debes capturar al menos una fila válida.' }
    }

    if (rows.length > 20) {
        return { ...base, error: 'El límite de alta rápida es 20 trabajadores por operación.' }
    }

    const validRows: BulkWorkerRow[] = []
    const preValidationErrors: BulkImportResult['errors'] = []

    for (const row of rows) {
        const parsed = QuickWorkerRowSchema.safeParse(row)
        if (!parsed.success) {
            preValidationErrors.push({
                rowIndex: row._rowIndex,
                firstName: row.firstName,
                lastName: row.lastName,
                reason: parsed.error.issues[0]?.message ?? 'Datos inválidos en la fila',
            })
            continue
        }

        validRows.push({
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            nationalId: parsed.data.nationalId,
            dob: parsed.data.dob,
            phone: parsed.data.phone,
            jobPositionName: parsed.data.jobPositionName,
            _rowIndex: parsed.data._rowIndex,
        })
    }

    if (validRows.length === 0) {
        return {
            ...base,
            errors: preValidationErrors,
            error: 'Ninguna fila válida para procesar.',
        }
    }

    const imported = await bulkImportWorkers(validRows, projectId)

    return {
        ...imported,
        errors: [...preValidationErrors, ...imported.errors],
    }
}

/**
 * Búsqueda previa server-side para ingreso externo, alineada con el universo real de identidad.
 * @id IMPL-20260527-01
 * @backup context/SPECs/SPEC_ARCH-20260527-24-BUSQUEDA-EXTERNA-SERVER-SIDE-Y-REUTILIZACION.md
 */
export async function searchExternalIntakeCandidates(query: string) {
    const session = await getServerSession(authOptions)
    if (!session) return { success: false, error: 'No autorizado', candidates: [] }
    if (!['ADMIN', 'RECEPTIONIST'].includes(session.user.role)) {
        return { success: false, error: 'No autorizado', candidates: [] }
    }

    const normalizedQuery = query.trim().replace(/\s+/g, ' ')
    if (normalizedQuery.length < 2) {
        return { success: true, candidates: [] }
    }

    const terms = normalizedQuery
        .split(' ')
        .map((term) => term.trim())
        .filter(Boolean)

    try {
        const candidates = await prisma.worker.findMany({
            where: {
                AND: terms.map((term) => ({
                    OR: [
                        { firstName: { contains: term, mode: 'insensitive' } },
                        { lastName: { contains: term, mode: 'insensitive' } },
                    ],
                })),
            },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                dob: true,
                company: { select: { name: true } },
            },
            orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
            take: 8,
        })

        return {
            success: true,
            candidates: candidates.map((candidate) => ({
                id: candidate.id,
                firstName: candidate.firstName,
                lastName: candidate.lastName,
                dob: candidate.dob ? candidate.dob.toISOString() : null,
                company: candidate.company ? { name: candidate.company.name } : null,
            })),
        }
    } catch (error) {
        console.error(
            '[searchExternalIntakeCandidates]',
            error instanceof Error ? error.message : 'Unknown error'
        )
        return {
            success: false,
            error: 'No se pudo consultar la base de personas existentes.',
            candidates: [],
        }
    }
}

/**
 * Alta mínima de persona externa sin empresa para admisión de mostrador.
 * @id IMPL-20260527-01
 * @backup context/interconsultas/HANDOFF_ARCH-20260527-14_SOFIA_SLICE-D-ADMISION-EXTERNA.md
 */
export async function createExternalWorkerIntake(input: {
    firstName: string
    lastName: string
    dob?: string
    nationalId?: string
    phone?: string
    email?: string
    forceCreate?: boolean
}) {
    const session = await getServerSession(authOptions)
    if (!session) return { success: false, error: 'No autorizado' }
    if (!['ADMIN', 'RECEPTIONIST'].includes(session.user.role)) {
        return { success: false, error: 'No autorizado' }
    }

    const firstName = input.firstName.trim()
    const lastName = input.lastName.trim()
    const dobDate = parseDob(input.dob)

    if (!firstName || !lastName) {
        return { success: false, error: 'Nombre y apellidos son obligatorios.' }
    }

    const candidates = await prisma.worker.findMany({
        where: {
            firstName: { equals: firstName, mode: 'insensitive' },
            lastName: { equals: lastName, mode: 'insensitive' },
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            dob: true,
            companyId: true,
        },
        take: 5,
    })

    if (dobDate) {
        const strongMatch = candidates.find((candidate) => {
            if (!candidate.dob) return false
            return (
                candidate.dob.getFullYear() === dobDate.getFullYear() &&
                candidate.dob.getMonth() === dobDate.getMonth() &&
                candidate.dob.getDate() === dobDate.getDate()
            )
        })

        if (strongMatch) {
            return {
                success: true,
                status: 'reused',
                workerId: strongMatch.id,
            }
        }
    } else if (candidates.length > 0 && !input.forceCreate) {
        return {
            success: false,
            status: 'ambiguous_match',
            error: 'Existe coincidencia por nombre y apellido. Agrega fecha de nacimiento o confirma creación manual.',
        }
    }

    try {
        const universalId = generateUniversalId({
            firstName,
            lastName,
            dob: dobDate,
        })

        const created = await prisma.worker.create({
            data: {
                firstName,
                lastName,
                universalId,
                dob: dobDate,
                nationalId: input.nationalId?.trim() || null,
                phone: input.phone?.trim() || null,
                email: input.email?.trim() || null,
                companyId: null,
                jobPositionId: null,
            },
            select: { id: true },
        })

        revalidatePath('/workers')
        return { success: true, status: 'created', workerId: created.id }
    } catch (error) {
        console.error('[createExternalWorkerIntake]', error)
        return { success: false, error: 'No se pudo crear la persona externa.' }
    }
}
