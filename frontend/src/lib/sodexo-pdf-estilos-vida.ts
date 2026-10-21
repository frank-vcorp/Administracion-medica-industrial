/**
 * §8 Estilos de vida — extensión Sodexo + respaldo APNP (no patológicos).
 */
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'
import {
  estilosVidaSodexoIsEmpty,
  SODEXO_ESTILOS_VIDA_PDF,
  type SodexoEstilosVidaSodexo,
  type SodexoTabacoDejoHace,
  type SodexoTabacoOpcion,
} from '@/lib/sodexo-estilos-vida-catalog'
import { prefillEstilosVidaSodexoFromApnp } from '@/lib/sodexo-estilos-vida-prefill'

function mergeEstilos(
  ext: SodexoEstilosVidaSodexo | null | undefined,
  apnp: Record<string, unknown> | null | undefined,
): SodexoEstilosVidaSodexo {
  const fromApnp = prefillEstilosVidaSodexoFromApnp(apnp)
  const e = ext ?? {}
  return {
    ...fromApnp,
    ...e,
    tabaco_opcion: e.tabaco_opcion ?? legacyTabacoOpcion(e) ?? fromApnp.tabaco_opcion,
    tabaco_anios_habito: e.tabaco_anios_habito ?? e.tabaco_anios ?? fromApnp.tabaco_anios_habito,
    alcohol_ocasional: (e.alcohol_ocasional ?? '').trim() || fromApnp.alcohol_ocasional,
    drogas_tipo: (e.drogas_tipo ?? '').trim() || fromApnp.drogas_tipo,
  }
}

function legacyTabacoOpcion(e: SodexoEstilosVidaSodexo): SodexoTabacoOpcion | undefined {
  const i = e.tabaco_intensidad
  if (i === 'EVENTUAL' || i === 'HABITUAL' || i === 'COMPULSIVO') return i
  if (i === 'EXFUMADOR') return 'SI'
  return undefined
}

function applyTabaco(form: PdfForm, ev: SodexoEstilosVidaSodexo) {
  const p = SODEXO_ESTILOS_VIDA_PDF.tabaco
  const op = ev.tabaco_opcion
  if (op === 'NO') sodexoSetCheck(form, p.no, true)
  else if (op === 'SI') sodexoSetCheck(form, p.si, true)
  else if (op === 'EVENTUAL') sodexoSetCheck(form, p.eventual, true)
  else if (op === 'HABITUAL') sodexoSetCheck(form, p.habitual, true)
  else if (op === 'COMPULSIVO') sodexoSetCheck(form, p.compulsivo, true)

  const anios = ev.tabaco_anios_habito
  if (anios && p.anios[anios]) sodexoSetCheck(form, p.anios[anios], true)

  if (ev.tabaco_exfumador || ev.tabaco_intensidad === 'EXFUMADOR') {
    sodexoSetCheck(form, p.exfumador, true)
  }
  const dejo = ev.tabaco_dejo_hace
  if (dejo && p.dejo[dejo]) sodexoSetCheck(form, p.dejo[dejo as SodexoTabacoDejoHace], true)
}

function applyAlcohol(form: PdfForm, ev: SodexoEstilosVidaSodexo) {
  const p = SODEXO_ESTILOS_VIDA_PDF.alcohol
  const alc = ev.alcohol
  if (alc === 'NO') sodexoSetCheck(form, p.no, true)
  else if (alc === 'SI') {
    sodexoSetCheck(form, p.si, true)
    const det = (ev.alcohol_ocasional ?? '').trim()
    if (ev.alcohol_modo === 'OCASIONAL' || det.toUpperCase().includes('OCASIONAL')) {
      sodexoSetCheck(form, p.ocasional, true)
    }
    if (det) sodexoSetText(form, p.ocasionalText, det)
    else if (ev.alcohol_modo === 'FRECUENTE') sodexoSetText(form, p.ocasionalText, 'FRECUENTE')
  }
}

function applyDrogas(form: PdfForm, ev: SodexoEstilosVidaSodexo) {
  const p = SODEXO_ESTILOS_VIDA_PDF.drogas
  if (ev.drogas === 'NO') sodexoSetCheck(form, p.no, true)
  else if (ev.drogas === 'SI') {
    sodexoSetCheck(form, p.si, true)
    if (ev.drogas_tipo) sodexoSetText(form, p.tipoText, ev.drogas_tipo)
  }
}

/** Respaldo mínimo si no hay extensión (solo Niega/Sí APNP). */
function applyApnpFallback(
  form: PdfForm,
  apnp: { tabaco?: string | null; alcohol?: string | null; drogas?: string | null },
) {
  const tab = mapNegadoSi(apnp.tabaco)
  if (tab === 'no') sodexoSetCheck(form, SODEXO_ESTILOS_VIDA_PDF.tabaco.no, true)
  else if (tab === 'si') sodexoSetCheck(form, SODEXO_ESTILOS_VIDA_PDF.tabaco.si, true)
  const alc = mapNegadoSi(apnp.alcohol)
  if (alc === 'no') sodexoSetCheck(form, SODEXO_ESTILOS_VIDA_PDF.alcohol.no, true)
  else if (alc === 'si') sodexoSetCheck(form, SODEXO_ESTILOS_VIDA_PDF.alcohol.si, true)
  const drog = mapNegadoSi(apnp.drogas)
  if (drog === 'no') sodexoSetCheck(form, SODEXO_ESTILOS_VIDA_PDF.drogas.no, true)
  else if (drog === 'si') {
    sodexoSetCheck(form, SODEXO_ESTILOS_VIDA_PDF.drogas.si, true)
    sodexoSetText(form, SODEXO_ESTILOS_VIDA_PDF.drogas.tipoText, apnp.drogas ?? '')
  }
}

function mapNegadoSi(raw: string | null | undefined): 'no' | 'si' | null {
  const u = (raw ?? '').trim().toUpperCase()
  if (!u || u === 'NEGADO' || u === 'NO') return 'no'
  if (u === 'SI' || u.startsWith('SI')) return 'si'
  return null
}

export function fillSodexoEstilosVida(
  form: PdfForm,
  apnp: {
    tabaco?: string | null
    alcohol?: string | null
    drogas?: string | null
  },
  estilosExt?: SodexoEstilosVidaSodexo | null,
  apnpRecord?: Record<string, unknown> | null,
) {
  const merged = mergeEstilos(estilosExt, apnpRecord)
  if (!estilosVidaSodexoIsEmpty(merged)) {
    applyTabaco(form, merged)
    applyAlcohol(form, merged)
    applyDrogas(form, merged)
    return
  }
  applyApnpFallback(form, apnp)
}
