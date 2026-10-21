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

  const cual = ext.examen_anormal_cual
  if (cual) {
    sodexoSetText(form, 'Cuál', cual.cual_1)
    sodexoSetText(form, 'Cuál_2', cual.cual_2)
    sodexoSetText(form, 'Cuál_3', cual.cual_3)
    sodexoSetText(form, 'Cuál_4', cual.cual_4)
  }

  if (ext.titulo_seccion_sodexo?.trim()) {
    sodexoSetText(form, 'SALUD OCUPACIONAL SODEXO MÉXICO', ext.titulo_seccion_sodexo)
  }

  fillEstilosVidaExtension(form, ext)
}

function fillEstilosVidaExtension(form: PdfForm, ext: SodexoExtensionData) {
  const ev = ext.estilos_vida_sodexo
  if (!ev) return
  if (ev.tabaco_intensidad === 'EVENTUAL') sodexoSetCheck(form, 'Check Box547', true)
  if (ev.tabaco_intensidad === 'HABITUAL') sodexoSetCheck(form, 'Check Box548', true)
  if (ev.tabaco_intensidad === 'COMPULSIVO') sodexoSetCheck(form, 'Check Box549', true)
  if (ev.tabaco_intensidad === 'EXFUMADOR') sodexoSetCheck(form, 'Check Box342', true)
  if (ev.tabaco_anios === '1_5') sodexoSetCheck(form, 'Check Box340', true)
  if (ev.tabaco_anios === '6_10') sodexoSetCheck(form, 'Check Box338', true)
  if (ev.tabaco_anios === '11_20') sodexoSetCheck(form, 'Check Box336', true)
  if (ev.tabaco_anios === 'MAS_20') sodexoSetCheck(form, 'Check Box334', true)
  if (ev.alcohol_modo === 'OCASIONAL') sodexoSetCheck(form, 'Check Box559', true)
}
