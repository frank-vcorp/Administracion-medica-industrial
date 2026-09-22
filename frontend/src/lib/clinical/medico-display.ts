/** Línea "Nombre — Cédula: …" para PDF / examen médico. */
export function formatMedicoNombreYCedula(
  fullName: string | null | undefined,
  professionalLicense: string | null | undefined,
): string {
  const name = (fullName ?? '').trim()
  const ced = (professionalLicense ?? '').trim()
  if (!name && !ced) return ''
  if (name && ced) return `${name} — Cédula: ${ced}`
  if (name) return name
  return `Cédula: ${ced}`
}
