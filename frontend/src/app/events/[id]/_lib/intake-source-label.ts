/**
 * Helper puro para mapear origen de admisión → etiqueta legible.
 * Sin estado, sin I/O, sin async. Vive fuera del módulo 'use server'
 * porque Next.js 16 / Turbopack exige que TODA exportación en 'use server'
 * sea `async function` (build error: "Server Actions must be async functions").
 * SPEC FIX-20260729-01-BASELINE: extraído de event-page-data.ts para
 * resolver build de Vercel. La función pura puede vivir en cualquier capa
 * cliente sin riesgo.
 */

export function getIntakeSourceLabel(
  intakeSource?: string | null,
  appointmentId?: string | null,
): string {
  const source = intakeSource ?? (appointmentId ? 'APPOINTMENT' : null)
  switch (source) {
    case 'APPOINTMENT':
      return 'Programado'
    case 'PROJECT_PRE_REGISTERED':
      return 'Proyecto'
    case 'PROJECT_SAME_DAY':
      return 'Proyecto hoy'
    case 'EXTERNAL_WALK_IN':
      return 'Externo'
    case 'DIRECT_RECEPTION':
      return 'Recepción'
    default:
      return 'Ingreso legado'
  }
}
