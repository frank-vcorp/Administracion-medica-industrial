/**
 * Firmante del PDF de audiometría: la cuenta que genera el documento.
 *
 * El nombre, la cédula y la imagen de firma salen del perfil de ese
 * usuario. Si no hay cédula, se imprime «—». Si no hay una imagen de
 * firma registrada, el espacio queda vacío: no se sustituye por un
 * trazo ni por una firma de ejemplo.
 */

export interface AudiometryAccountProfile {
  fullName?: string | null
  professionalLicense?: string | null
  signatureImageUrl?: string | null
}

export interface AudiometryAccountSigner {
  fullName: string
  professionalLicense: string
  signatureImageUrl: string
}

function isAccountSignatureImage(value: string): boolean {
  const sig = value.toLowerCase()
  return (
    sig.startsWith('data:image/png') ||
    sig.startsWith('data:image/jpeg') ||
    sig.startsWith('data:image/jpg') ||
    sig.startsWith('/uploads/') ||
    sig.startsWith('https://')
  )
}

/** null si la cuenta no tiene un nombre usable. */
export function audiometrySignerFromAccount(
  account: AudiometryAccountProfile | null | undefined,
): AudiometryAccountSigner | null {
  const fullName = (account?.fullName ?? '').trim()
  if (fullName.length < 3) return null
  const license = (account?.professionalLicense ?? '').trim()
  const signature = (account?.signatureImageUrl ?? '').trim()
  return {
    fullName,
    professionalLicense: license.length > 0 ? license : '—',
    signatureImageUrl: isAccountSignatureImage(signature) ? signature : '',
  }
}
