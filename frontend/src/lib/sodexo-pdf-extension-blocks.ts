/**
 * Bloques P1/P2 de extensión Sodexo → AcroForm (sin defaults inventados).
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'
import { SODEXO_GINECO_TOXICO_EXTENSION_ROWS } from '@/lib/sodexo-gineco-extension-rows'
import {
  SODEXO_PATOLOGICOS_LEFT,
  SODEXO_PATOLOGICOS_RIGHT,
} from '@/lib/sodexo-pdf-patologicos'

const CONSENT_INFO_VERDADERA = 'Check Box76'
const CONSENT_AVISO_PRIVACIDAD = 'Check Box77'

const DISMENORREA_NO = 'Check Box416'
const DISMENORREA_SI = 'Check Box417'
const DISMENORREA_INCAP_NO = 'Check Box368'
const DISMENORREA_INCAP_SI = 'Check Box369'

export function fillSodexoExtensionBlocks(form: PdfForm, ext: SodexoExtensionData | null) {
  if (!ext) return

  const c = ext.consentimiento_ho
  if (c?.informacion_verdadera) sodexoSetCheck(form, CONSENT_INFO_VERDADERA, true)
  if (c?.acepta_aviso_privacidad) sodexoSetCheck(form, CONSENT_AVISO_PRIVACIDAD, true)

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

  fillPatologicosExtension(form, ext)
  fillGinecoExtension(form, ext)
  fillEstilosVidaExtension(form, ext)
  fillInmunComplementarias(form, ext)
}

function fillPatologicosExtension(form: PdfForm, ext: SodexoExtensionData) {
  const map = ext.patologicos_sodexo
  if (!map) return
  const rows = [...SODEXO_PATOLOGICOS_LEFT, ...SODEXO_PATOLOGICOS_RIGHT]
  for (const row of rows) {
    const entry = map[row.amiKey]
    if (!entry?.estado) continue
    if (entry.estado === 'NEGADO') sodexoSetCheck(form, row.checkNo, true)
    else if (entry.estado === 'SI') {
      sodexoSetCheck(form, row.checkSi, true)
      sodexoSetText(form, row.descField, entry.descripcion ?? '')
    }
  }
}

function fillGinecoExtension(form: PdfForm, ext: SodexoExtensionData) {
  const g = ext.gineco_sodexo
  if (!g) return
  if (g.dismenorrea === 'NEGADO') sodexoSetCheck(form, DISMENORREA_NO, true)
  else if (g.dismenorrea === 'SI') {
    sodexoSetCheck(form, DISMENORREA_SI, true)
    if (g.dismenorrea_incapacitante) sodexoSetCheck(form, DISMENORREA_INCAP_SI, true)
    else if (g.dismenorrea_incapacitante === false) {
      sodexoSetCheck(form, DISMENORREA_INCAP_NO, true)
    }
  }
  const tox = g.toxicos_medicamentos ?? {}
  for (const row of SODEXO_GINECO_TOXICO_EXTENSION_ROWS) {
    const st = tox[row.id]
    if (st === 'NEGADO') sodexoSetCheck(form, row.no, true)
    else if (st === 'SI') sodexoSetCheck(form, row.si, true)
  }
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

function fillInmunComplementarias(form: PdfForm, ext: SodexoExtensionData) {
  const ic = ext.inmunizaciones_complementarias
  if (!ic) return
  if (ic.niega) {
    sodexoSetCheck(form, 'Check Box557', true)
    return
  }
  if (ic.covid?.estado === 'SI') sodexoSetCheck(form, 'Check Box557', true)
  if (ic.hepatitis_ab?.estado === 'SI') sodexoSetCheck(form, 'Check Box558', true)
  if (ic.otras?.estado === 'SI') sodexoSetCheck(form, 'Check Box556', true)
  if (ic.otras?.observaciones) sodexoSetText(form, 'Texto541', ic.otras.observaciones)
}
