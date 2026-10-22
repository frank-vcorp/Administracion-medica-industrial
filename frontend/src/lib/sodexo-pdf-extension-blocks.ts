/**
 * Bloques P1/P2 de extensión Sodexo → AcroForm (sin defaults inventados).
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'
const CONSENT_INFO_VERDADERA = 'Check Box76'
const CONSENT_AVISO_PRIVACIDAD = 'Check Box77'
const DECLARACION_PROTESTA_NOMBRE_1 = 'Texto26'
const DECLARACION_PROTESTA_NOMBRE_2 = 'Texto27'

/** Casillas y nombre de declaración §3 desde consentimiento de check-in. */
export function fillSodexoConsentFromCheckIn(
  form: PdfForm,
  opts: {
    signedAt: Date | string | null | undefined
    patientFullName: string
  },
) {
  if (!opts.signedAt) return
  sodexoSetCheck(form, CONSENT_INFO_VERDADERA, true)
  sodexoSetCheck(form, CONSENT_AVISO_PRIVACIDAD, true)
  const name = opts.patientFullName.trim()
  if (name && name !== '—') {
    sodexoSetText(form, DECLARACION_PROTESTA_NOMBRE_1, name)
    sodexoSetText(form, DECLARACION_PROTESTA_NOMBRE_2, name)
  }
}

export function fillSodexoExtensionBlocks(form: PdfForm, ext: SodexoExtensionData | null) {
  if (!ext) return

  /** Capturas antiguas (antes de mapear «Cuál*» a filas §9.4 / §9.5). */
  const cual = ext.examen_anormal_cual
  if (cual?.cual_1?.trim()) sodexoSetText(form, 'Cuál', cual.cual_1)
  if (cual?.cual_2?.trim()) sodexoSetText(form, 'Cuál_2', cual.cual_2)
  if (cual?.cual_3?.trim()) sodexoSetText(form, 'Cuál_3', cual.cual_3)
  if (cual?.cual_4?.trim()) sodexoSetText(form, 'Cuál_4', cual.cual_4)

  if (ext.titulo_seccion_sodexo?.trim()) {
    sodexoSetText(form, 'SALUD OCUPACIONAL SODEXO MÉXICO', ext.titulo_seccion_sodexo)
  }

}
