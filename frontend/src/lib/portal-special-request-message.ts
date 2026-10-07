/** Texto interno — solo servidor / WhatsApp institucional; nunca mostrar al cliente. */
export function buildPortalSpecialRequestMessage(args: {
  companyName: string
  appointmentCount: number
  branchName: string
  dateLabel?: string
  timeLabel?: string
  reason: 'capacity_full' | 'custom'
  contactName: string
  contactEmail: string
  contactPhone?: string
  comment?: string
}): string {
  const pref =
    args.dateLabel && args.timeLabel
      ? `Preferencia horario: ${args.dateLabel} ${args.timeLabel}. `
      : ''
  const motive =
    args.reason === 'capacity_full'
      ? 'Contexto: horario en portal sin cupo. '
      : ''
  const phoneLine = args.contactPhone?.trim()
    ? `Tel. contacto: ${args.contactPhone.trim()}. `
    : ''
  const commentLine = args.comment?.trim() ? `Comentario: ${args.comment.trim()}` : ''

  return [
    '[Portal cliente AMI] Solicitud de atención personalizada.',
    `Empresa: ${args.companyName}.`,
    `Citas requeridas: ${args.appointmentCount}.`,
    `Sucursal: ${args.branchName}.`,
    pref + motive,
    `Contacto: ${args.contactName} (${args.contactEmail}).`,
    phoneLine,
    commentLine,
  ]
    .filter(Boolean)
    .join(' ')
}
