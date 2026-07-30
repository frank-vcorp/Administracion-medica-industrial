/**
 * Server Actions para MobileUnit (Unidades Móviles) — IMPL-20260711-01
 * @id IMPL-20260711-01
 * @spec context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 * @backup context/interconsultas/HANDOFF_ARCH-20260711-01_SOFIA_UNIDADES-MOVILES.md
 */
'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { getServerSession } from 'next-auth/next'
import { Prisma } from '@prisma/client'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { isAdminLike } from '@/lib/auth/roles'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const STATUS_VALUES = [
  'ACTIVA',
  'MANTENIMIENTO',
  'REPARACION',
  'FUERA_SERVICIO',
  'BAJA_PERMANENTE',
] as const

const CreateMobileUnitSchema = z.object({
  name: z.string().min(1).max(100),
  plate: z.string().max(20).optional().nullable(),
  vin: z.string().max(50).optional().nullable(),
  year: z.number().int().min(1900).max(2100).optional().nullable(),
  capacity: z.number().int().min(1).max(500).optional().nullable(),
  economicNumber: z.string().max(50).optional().nullable(),
  status: z.enum(STATUS_VALUES).optional(),
  equipment: z.record(z.string(), z.boolean()).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
})

const UpdateMobileUnitSchema = CreateMobileUnitSchema.partial()

// ─── Tipos exportados ─────────────────────────────────────────────────────────

export type MobileUnitListItem = {
  id: string
  name: string
  plate: string | null
  status: string
  capacity: number | null
  imageUrl: string | null
  nextMaintenanceDate: Date | null
  nextMaintenanceType: string | null
  _count: { projects: number; maintenances: number }
}

export type MobileUnitWithDetails = Prisma.MobileUnitGetPayload<{
  include: {
    projects: {
      select: {
        id: true
        name: true
        startDate: true
        endDate: true
        status: true
      }
    }
    maintenances: true
  }
}>

// ─── Helpers de auth ─────────────────────────────────────────────────────────

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session || !isAdminLike(session.user.role)) return null
  return session
}

async function requireAnyAuth() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  return session
}

function isPrismaKnownError(e: unknown): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Lista todas las unidades, opcionalmente filtradas por status.
 * Incluye contador de proyectos + mantenimientos y la fecha del próximo mantenimiento
 * (más temprano en estado PROGRAMADO/REPROGRAMADO).
 * SPEC §4.1
 */
export async function getMobileUnits(status?: (typeof STATUS_VALUES)[number]) {
  const session = await requireAnyAuth()
  if (!session) return []

  const where: Prisma.MobileUnitWhereInput = {}
  if (status) where.status = status

  const units = await prisma.mobileUnit.findMany({
    where,
    include: {
      _count: {
        select: { projects: true, maintenances: true },
      },
      maintenances: {
        where: { status: { in: ['PROGRAMADO', 'REPROGRAMADO'] } },
        orderBy: { scheduledDate: 'asc' },
        take: 1,
        select: { scheduledDate: true, type: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  return units.map((u: (typeof units)[number]) => ({
    id: u.id,
    name: u.name,
    plate: u.plate,
    status: u.status,
    capacity: u.capacity,
    imageUrl: u.imageUrl,
    nextMaintenanceDate: u.maintenances[0]?.scheduledDate ?? null,
    nextMaintenanceType: u.maintenances[0]?.type ?? null,
    _count: u._count,
  }))
}

/**
 * Retorna una unidad con detalle: proyectos asignados + historial completo de mantenimientos.
 * Lanza error si no existe.
 * SPEC §4.1
 */
export async function getMobileUnitById(id: string) {
  const session = await requireAnyAuth()
  if (!session) throw new Error('No autorizado')

  const unit = await prisma.mobileUnit.findUnique({
    where: { id },
    include: {
      projects: {
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          status: true,
        },
        orderBy: { startDate: 'desc' },
      },
      maintenances: {
        orderBy: { scheduledDate: 'desc' },
      },
    },
  })
  if (!unit) throw new Error('MobileUnit no encontrada')
  return unit
}

// ─── Mutaciones ───────────────────────────────────────────────────────────────

/**
 * Crea una unidad móvil. Valida unicidad de `name` vía Zod (DB también lo enforza).
 * SPEC §4.1 / §3.5 — Solo ADMIN.
 */
export async function createMobileUnit(data: z.infer<typeof CreateMobileUnitSchema>) {
  const session = await requireAdmin()
  if (!session) return { success: false as const, error: 'No autorizado' }

  const parsed = CreateMobileUnitSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  try {
    const unit = await prisma.mobileUnit.create({
      data: {
        name: parsed.data.name,
        plate: parsed.data.plate ?? null,
        vin: parsed.data.vin ?? null,
        year: parsed.data.year ?? null,
        capacity: parsed.data.capacity ?? null,
        economicNumber: parsed.data.economicNumber ?? null,
        status: parsed.data.status ?? 'ACTIVA',
        equipment: (parsed.data.equipment ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        notes: parsed.data.notes ?? null,
        imageUrl: parsed.data.imageUrl ?? null,
      },
    })
    revalidatePath('/admin/mobile-units')
    return { success: true as const, unit }
  } catch (e: unknown) {
    if (isPrismaKnownError(e) && e.code === 'P2002') {
      return { success: false as const, error: `Ya existe una unidad con el nombre '${parsed.data.name}'` }
    }
    const err = e as Error
    console.error('[createMobileUnit]', err.message)
    return { success: false as const, error: 'Error al crear la unidad' }
  }
}

export async function updateMobileUnit(
  unitId: string,
  data: z.infer<typeof UpdateMobileUnitSchema>
) {
  const session = await requireAdmin()
  if (!session) return { success: false as const, error: 'No autorizado' }

  const parsed = UpdateMobileUnitSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0]?.message ?? 'Datos inválidos' }
  }

  try {
    await prisma.mobileUnit.update({
      where: { id: unitId },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.plate !== undefined && { plate: parsed.data.plate }),
        ...(parsed.data.vin !== undefined && { vin: parsed.data.vin }),
        ...(parsed.data.year !== undefined && { year: parsed.data.year }),
        ...(parsed.data.capacity !== undefined && { capacity: parsed.data.capacity }),
        ...(parsed.data.economicNumber !== undefined && { economicNumber: parsed.data.economicNumber }),
        ...(parsed.data.status !== undefined && { status: parsed.data.status }),
        ...(parsed.data.notes !== undefined && { notes: parsed.data.notes }),
        ...(parsed.data.imageUrl !== undefined && { imageUrl: parsed.data.imageUrl }),
        ...(parsed.data.equipment !== undefined && {
          equipment: (parsed.data.equipment ?? Prisma.JsonNull) as Prisma.InputJsonValue | typeof Prisma.JsonNull,
        }),
      },
    })
    revalidatePath('/admin/mobile-units')
    revalidatePath(`/admin/mobile-units/${unitId}`)
    return { success: true as const }
  } catch (e: unknown) {
    if (isPrismaKnownError(e) && e.code === 'P2002') {
      return { success: false as const, error: `Ya existe otra unidad con ese nombre` }
    }
    const err = e as Error
    console.error('[updateMobileUnit]', err.message)
    return { success: false as const, error: 'Error al actualizar la unidad' }
  }
}

/**
 * SPEC §3.4 — bloquea si tiene proyectos o mantenimientos activos.
 */
export async function deleteMobileUnit(unitId: string) {
  const session = await requireAdmin()
  if (!session) return { success: false as const, error: 'No autorizado' }

  try {
    const counts = await prisma.mobileUnit.findUnique({
      where: { id: unitId },
      include: {
        _count: {
          select: {
            projects: true,
            maintenances: true,
            medicalEvents: true,
            labOrders: true,
          },
        },
      },
    })
    if (!counts) return { success: false as const, error: 'Unidad no encontrada' }

    const blockers = Object.entries(counts._count as Record<string, number>)
      .filter((entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0)
      .map(([k, v]) => `${k}=${v}`)
    if (blockers.length > 0) {
      return {
        success: false as const,
        error: `No se puede eliminar la unidad porque tiene: ${blockers.join(', ')}`,
      }
    }

    await prisma.mobileUnit.delete({ where: { id: unitId } })
    revalidatePath('/admin/mobile-units')
    return { success: true as const }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[deleteMobileUnit]', err.message)
    return { success: false as const, error: 'Error al eliminar la unidad' }
  }
}

// ─── Upload de imagen ────────────────────────────────────────────────────────

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png'])

/**
 * SPEC §3.3 / §7 — sube la imagen vía backend /api/v1/mobile-units/{id}/image
 * (que persiste en S3 Railway Storage + fallback local).
 * Valida tipo (image/jpeg|image/png) y tamaño (<=5MB).
 */
export async function uploadMobileUnitImage(unitId: string, file: File) {
  const session = await requireAdmin()
  if (!session) return { success: false as const, error: 'No autorizado' }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { success: false as const, error: 'Tipo de archivo no permitido. Solo JPG/PNG.' }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { success: false as const, error: 'La imagen excede el tamaño máximo (5MB).' }
  }

  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || ''
  if (!backendBase) {
    return { success: false as const, error: 'Backend no configurado (NEXT_PUBLIC_BACKEND_URL faltante).' }
  }

  const formData = new FormData()
  formData.append('file', file, file.name)

  try {
    const res = await fetch(`${backendBase}/api/v1/mobile-units/${unitId}/image`, {
      method: 'POST',
      headers: { 'X-AMI-UserId': session.user.id },
      body: formData,
    })
    const json = (await res.json()) as { imageUrl?: string; detail?: string }
    if (!res.ok) {
      return { success: false as const, error: json.detail ?? 'Error al subir imagen' }
    }
    const imageUrl = json.imageUrl
    if (!imageUrl) return { success: false as const, error: 'Backend no devolvió imageUrl' }

    // Persistir imageUrl en la unidad.
    await prisma.mobileUnit.update({
      where: { id: unitId },
      data: { imageUrl },
    })
    revalidatePath(`/admin/mobile-units/${unitId}`)
    return { success: true as const, imageUrl }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[uploadMobileUnitImage]', err.message)
    return { success: false as const, error: 'Error al subir imagen' }
  }
}

export async function deleteMobileUnitImage(unitId: string) {
  const session = await requireAdmin()
  if (!session) return { success: false as const, error: 'No autorizado' }

  try {
    await prisma.mobileUnit.update({
      where: { id: unitId },
      data: { imageUrl: null },
    })
    revalidatePath(`/admin/mobile-units/${unitId}`)
    return { success: true as const }
  } catch (e: unknown) {
    const err = e as Error
    console.error('[deleteMobileUnitImage]', err.message)
    return { success: false as const, error: 'Error al eliminar la imagen' }
  }
}
