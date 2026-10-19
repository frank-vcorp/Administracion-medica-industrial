/**
 * Proyección al AcroForm desde `variant_extensions.SODEXO` (captura exclusiva Sodexo).
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'
import {
  SODEXO_FUNCIONES_CHECKBOXES,
  SODEXO_FUNCIONES_OTRO_TEXT,
} from '@/lib/sodexo-pdf-mappings'

const LEE_ESCRIBE_SI = 'Check Box26'

const ESTADO_GENERAL_NORMAL = 'Check Box679'
const ESTADO_MENTAL_NORMAL = 'Check Box685'
const MANO_DIESTRA = 'Check Box687'
const MANO_ZURDA = 'Check Box688'
const MANO_AMBIDIESTRA = 'Check Box689'

export function fillSodexoPdfFromExtension(form: PdfForm, ext: SodexoExtensionData | null) {
  if (!ext) return

  sodexoSetText(form, 'Lugar de nacimiento', ext.lugar_nacimiento)
  sodexoSetText(form, 'Teléfono Casa', ext.telefono_casa)
  sodexoSetText(form, 'Teléfono Movil', ext.telefono_movil)
  sodexoSetText(form, 'Num Ext', ext.numero_exterior)
  sodexoSetText(form, 'Num Int', ext.numero_interior)
  sodexoSetText(form, 'Estado', ext.estado_domicilio)
  sodexoSetText(form, 'Tiempo de radicar', ext.tiempo_radicar)
  sodexoSetText(form, 'Profesión', ext.profesion)

  if (ext.lee_y_escribe === 'SI') sodexoSetCheck(form, LEE_ESCRIBE_SI, true)

  const fn = ext.funciones_principales
  if (fn) {
    if (fn.administrativa) sodexoSetCheck(form, SODEXO_FUNCIONES_CHECKBOXES.administrativa, true)
    if (fn.ayudante) sodexoSetCheck(form, SODEXO_FUNCIONES_CHECKBOXES.ayudante, true)
    if (fn.mantenimiento) sodexoSetCheck(form, SODEXO_FUNCIONES_CHECKBOXES.mantenimiento, true)
    if (fn.tecnica) sodexoSetCheck(form, SODEXO_FUNCIONES_CHECKBOXES.tecnica, true)
    if (fn.telefono) sodexoSetCheck(form, SODEXO_FUNCIONES_CHECKBOXES.telefono, true)
    if (fn.conduccion) sodexoSetCheck(form, SODEXO_FUNCIONES_CHECKBOXES.conduccion, true)
  }
  if (ext.tipo_actividad?.trim()) {
    sodexoSetText(form, SODEXO_FUNCIONES_OTRO_TEXT, ext.tipo_actividad)
  }

  const enc = ext.examen_encabezado
  if (enc) {
    if (enc.estado_general_normal) sodexoSetCheck(form, ESTADO_GENERAL_NORMAL, true)
    if (enc.estado_mental_normal) sodexoSetCheck(form, ESTADO_MENTAL_NORMAL, true)
    if (enc.mano_dominante === 'DIESTRA') sodexoSetCheck(form, MANO_DIESTRA, true)
    else if (enc.mano_dominante === 'ZURDA') sodexoSetCheck(form, MANO_ZURDA, true)
    else if (enc.mano_dominante === 'AMBIDIESTRA') sodexoSetCheck(form, MANO_AMBIDIESTRA, true)
  }
}
