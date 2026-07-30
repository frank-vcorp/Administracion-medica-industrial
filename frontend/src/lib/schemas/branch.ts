/**
 * @file Zod schemas: Sucursales (Branch) — Soft-disable + edición básica.
 * @id IMPL-20260730-02 (ARCH-20260730-01) — PR-1
 * @spec context/SPECs/SPEC_ARCH-20260730-01-MODULO-SUCURSALES-COMPLETO.md §5.3, §6
 *
 * Schemas de validación server-side para crear / actualizar sucursales.
 * Se aplican en `src/actions/branch.actions.ts` antes de cualquier `prisma.*`.
 *
 * Reglas:
 *   - `openingTime` y `closingTime` siguen formato HH:MM 24h (`timeRegex`).
 *   - `openingTime` debe ser estrictamente menor que `closingTime`
 *     (una sucursal no puede cerrar antes de abrir). En update, sólo se
 *     valida si AMBOS vienen presentes (partial-update compatible).
 *   - `hourlyCapacity` ∈ [1, 100] (límite racional; cita pacientes por hora).
 *   - `phone`, `address` y `managerName` admiten cadena vacía ("" o undefined)
 *     para no obligar a capturar datos opcionales.
 *
 * NOTA sobre Zod 4: `.partial()` NO funciona sobre object schemas con `.refine()`,
 * por eso los campos se factorizan como constantes reutilizables y se construye
 * tanto `branchCreateSchema` como `branchUpdateSchema` con la misma refine
 * (condicional en update: sólo aplica si AMBOS tiempos están presentes).
 *
 * NO incluye:
 *   - Validación de unicidad de `name` por tenant (se hace en la action con Prisma).
 *   - Validación de `expectedUpdatedAt` para optimistic locking (propuesto en SPEC §5.4,
 *     queda como TODO para PR-3 si se requiere).
 */
import { z } from 'zod'

// --------------------------------------------------------------------------
// Regex reutilizables
// --------------------------------------------------------------------------

/** Hora en formato HH:MM 24h (00:00 – 23:59). */
export const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

/** Teléfono laxo: dígitos, espacios, +, paréntesis y guiones; 7-20 chars. */
export const phoneRegex = /^[+\d\s()-]{7,20}$/

// --------------------------------------------------------------------------
// Field schemas (compartidos entre create y update)
// --------------------------------------------------------------------------

const nameField = z
  .string()
  .min(2, 'Nombre debe tener al menos 2 caracteres')
  .max(100)
const addressField = z.string().max(200)
const phoneField = z
  .string()
  .regex(phoneRegex, 'Teléfono inválido')
  .optional()
  .or(z.literal(''))
const managerNameField = z.string().max(100).optional().or(z.literal(''))
// IMPORTANTE (H3 — GEMINI AUD-20260730-01): `z.coerce.number()` para aceptar
// payloads FormData/JSON donde el número viaja como string ("20"). PR-2 envía
// desde formulario HTML y rompería con `z.number()` puro.
const hourlyCapacityField = z.coerce.number().int().min(1).max(100)
const openingTimeField = z
  .string()
  .regex(timeRegex, 'Hora de apertura inválida (HH:MM)')
const closingTimeField = z
  .string()
  .regex(timeRegex, 'Hora de cierre inválida (HH:MM)')

// Refinamiento reutilizable (condicionado a presencia de ambos campos).
const openingBeforeClosingRefine = (
  d: { openingTime?: string; closingTime?: string },
) => {
  if (d.openingTime === undefined || d.closingTime === undefined) return true
  return d.openingTime < d.closingTime
}

// --------------------------------------------------------------------------
// Schemas de creación / actualización
// --------------------------------------------------------------------------

/** Payload completo para crear una sucursal. */
export const branchCreateSchema = z
  .object({
    name: nameField,
    address: addressField,
    phone: phoneField,
    managerName: managerNameField,
    hourlyCapacity: hourlyCapacityField,
    openingTime: openingTimeField,
    closingTime: closingTimeField,
  })
  .refine(openingBeforeClosingRefine, {
    message: 'openingTime debe ser menor que closingTime',
    path: ['closingTime'],
  })

/** Update parcial: cada campo es opcional; los mismos validadores aplican cuando está presente. */
export const branchUpdateSchema = z
  .object({
    name: nameField.optional(),
    address: addressField.optional(),
    phone: phoneField,
    managerName: managerNameField,
    hourlyCapacity: hourlyCapacityField.optional(),
    openingTime: openingTimeField.optional(),
    closingTime: closingTimeField.optional(),
  })
  .refine(openingBeforeClosingRefine, {
    message: 'openingTime debe ser menor que closingTime',
    path: ['closingTime'],
  })

/** Schema para toggle de isActive vía toggleBranchActiveAction (PR-2/3). */
export const branchToggleSchema = z.object({
  id: z.string().uuid('ID inválido'),
  isActive: z.boolean(),
})

/** UUID helper para params de Branch. */
export const branchIdSchema = z.string().uuid('ID inválido')

// --------------------------------------------------------------------------
// Tipos inferidos (re-exports de dominio)
// --------------------------------------------------------------------------

export type BranchCreateInput = z.infer<typeof branchCreateSchema>
export type BranchUpdateInput = z.infer<typeof branchUpdateSchema>
export type BranchToggleInput = z.infer<typeof branchToggleSchema>
