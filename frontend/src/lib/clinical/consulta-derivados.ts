/** Marca de auditoría al crear un EventTest desde Consulta → Estudios derivados. */
export const CONSULTA_DERIVADOS_SOURCE = 'consulta_derivados'

export function consultaDerivadoAuditMatches(
  details: unknown,
  eventId: string,
  consultaEventTestId: string,
): boolean {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return false
  const row = details as Record<string, unknown>
  return (
    row.source === CONSULTA_DERIVADOS_SOURCE &&
    row.eventId === eventId &&
    row.consultaEventTestId === consultaEventTestId
  )
}
