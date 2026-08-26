/**
 * @file Resolución de la "atención/cita" a partir de un `MedicalEvent.id`.
 *
 *   Este módulo centraliza la pregunta "¿qué otros Events pertenecen a
 *   la misma atención o cita del trabajador que `eventId`?", exigida por
 *   `DEC-20260826-01` / `BR-20260826-01` / `BR-20260826-02` y
 *   `SPEC-FEATURE-20260826-01` (consolidado documental por atención/cita).
 *
 *   **REGLA DE ORO (IMPL-20260826-06 / DEC-20260826-01 / ADR-20260826-01):**
 *   no se inventa una relación nueva. Sólo se usan relaciones que
 *   EXISTEN en el `Prisma schema`. La consolidación N:1 se activa
 *   automáticamente tras la migración Prisma no destructiva de
 *   `ADR-20260826-01` (`DROP INDEX medical_events_appointmentId_key`).
 *
 *   ## Migración del schema (DEC-20260826-02 / ADR-20260826-01)
 *
 *   El `MedicalEvent` actual tiene:
 *     - `appointmentId String?` (sin `@unique`) — relación 1:N con `Appointment`.
 *     - `workerId String` — filtra adicional por el mismo trabajador
 *       (BR-20260826-02).
 *
 *   Consecuencia operativa: una `Appointment` puede tener N
 *   `MedicalEvent` del mismo `workerId`. El helper los recoge
 *   automáticamente, sin cambios en los call-sites.
 *
 *   ## Defensa contra errores de scope (BR-20260826-02)
 *
 *   El helper NUNCA devuelve Events de:
 *     - Otro `workerId` (filtro adicional por `workerId`).
 *     - Otra `appointmentId` (filtro estricto por `appointmentId`).
 *     - Walk-in Events sin cita (excluidos del grupo consolidado).
 *
 *   ## Call-sites actuales
 *
 *   - `frontend/src/lib/zip-cierre-clinico.ts` — `buildCierreClinicoZip`
 *     usa el resultado para crear una carpeta por cada Event del ZIP y
 *     consolidar el `manifest.txt` (IMPL-20260826-06).
 *   - `frontend/src/actions/signature.actions.tsx` — `signMedicalDictamPDF`
 *     usa el resultado para consolidar el PDF firmado con los hallazgos
 *     de los Events hermanos de la misma cita.
 *
 * @id IMPL-20260826-06 (FIX: consolidación por atención/cita,
 *     DEC-20260826-01 / BR-20260826-01 / DEC-20260826-02)
 * @adr context/decisions/ADR-20260826-01-EVENTS-POR-ATENCION.md
 * @businessRule discovery/BUSINESS-RULES.md BR-20260826-01
 * @businessRule discovery/BUSINESS-RULES.md BR-20260826-02
 * @decision discovery/DECISIONS.md DEC-20260826-01
 * @decision discovery/DECISIONS.md DEC-20226-02
 * @finding discovery/FINDINGS.md FND-20260826-02
 */

import type { PrismaClient } from '@prisma/client'

export interface AtencionResolution {
  /** IDs de los Events que pertenecen a la misma atención/cita Y mismo trabajador, ordenados por `createdAt` asc. */
  eventIds: string[]
  /** `appointmentId` que agrupa los Events (puede ser `null` para walk-in Events sin cita). */
  appointmentId: string | null
  /** `true` si el Event resuelto tiene `appointmentId`; `false` si es walk-in (sin cita). */
  hasAppointment: boolean
  /** `workerId` del Event de entrada (usado para validar scope del consolidado). */
  workerId: string | null
}

/**
 * Resuelve el conjunto de Events del **mismo trabajador** que
 * pertenecen a la misma atención/cita que `eventId`, usando
 * exclusivamente relaciones que EXISTEN en el `Prisma schema`
 * (`MedicalEvent.appointmentId` + `MedicalEvent.workerId`).
 *
 * Reglas:
 *   - Si el Event no existe → resolución vacía.
 *   - Si el Event no tiene `appointmentId` (walk-in legacy)
 *     → `{ eventIds: [eventId] }` (el "grupo de atención" es sólo este
 *     Event, sin citas).
 *   - Si el Event tiene `appointmentId` → devuelve TODOS los Events
 *     con el mismo `appointmentId` Y el mismo `workerId` (BR-20260826-02
 *     excluye Events de otros trabajadores aunque compartan cita).
 *
 * @param eventId  ID del `MedicalEvent` actual.
 * @param prisma   Cliente Prisma inyectado (testeable con mocks).
 * @returns Estructura `AtencionResolution` con los IDs ordenados por `createdAt` asc.
 *
 * Defensa:
 *   - `eventId` vacío/null → retorna resolución vacía (no rompe ZIP/PDF).
 *   - NUNCA devuelve Events de otro `workerId` aunque compartan cita.
 *   - NUNCA devuelve Events de otra `appointmentId` aunque compartan
 *     trabajador (el contrato es "mismo trabajador + misma cita").
 */
export async function findSiblingEventsInAtencion(
  eventId: string,
  prisma: PrismaClient,
): Promise<AtencionResolution> {
  if (!eventId || typeof eventId !== 'string') {
    return {
      eventIds: [],
      appointmentId: null,
      hasAppointment: false,
      workerId: null,
    }
  }

  const current = await prisma.medicalEvent.findUnique({
    where: { id: eventId },
    select: { appointmentId: true, workerId: true },
  })

  if (!current) {
    return {
      eventIds: [],
      appointmentId: null,
      hasAppointment: false,
      workerId: null,
    }
  }

  if (!current.appointmentId) {
    // Walk-in / sin cita: el "grupo de atención" es este único Event.
    // NO se buscan hermanos (BR-20260826-02 — sin cita no agrupa).
    return {
      eventIds: [eventId],
      appointmentId: null,
      hasAppointment: false,
      workerId: current.workerId,
    }
  }

  // N:1 Appointment → MedicalEvent (post-migración IMPL-20260826-06).
  // Defensa adicional: filtro por `workerId` para evitar fugas
  // entre pacientes que comparten cita (BR-20260826-02).
  const siblings = await prisma.medicalEvent.findMany({
    where: {
      appointmentId: current.appointmentId,
      workerId: current.workerId,
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  return {
    eventIds: siblings.map((s) => s.id),
    appointmentId: current.appointmentId,
    hasAppointment: true,
    workerId: current.workerId,
  }
}

/**
 * Helper puro (testeable sin Prisma) que, dado el ID de un Event y
 * los IDs resueltos por `findSiblingEventsInAtencion`, indica si ese
 * Event pertenece al conjunto consolidado.
 *
 * Útil para manifests y para gates del ZIP/PDF que filtran Events
 * externos a la cita (BR-20260826-01 exclusiones).
 */
export function isEventInAtencion(
  eventId: string,
  resolution: AtencionResolution,
): boolean {
  return resolution.eventIds.includes(eventId)
}
