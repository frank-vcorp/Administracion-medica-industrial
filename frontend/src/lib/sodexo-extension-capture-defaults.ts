/**
 * Valores por defecto de captura REG-SO-01 (extensión Sodexo).
 * Solo rellena opciones aún sin elegir — no sustituye datos ya guardados ni el PDF.
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'
import { SODEXO_EXAMEN_FISICO_CATALOG } from '@/lib/sodexo-examen-fisico-catalog'
import { sodexoEfEntryVisibleForSex } from '@/lib/sodexo-examen-fisico-visibility'
import {
  SODEXO_ARCOS_LIMBS,
  sodexoArcosCellKey,
  type SodexoArcosLimbDef,
} from '@/lib/sodexo-examen-fisico-arcos'
import {
  SODEXO_COLUMNA_ARCO_MOVIMIENTOS,
  SODEXO_COLUMNA_ARCO_REGIONES,
  SODEXO_COLUMNA_CURVAS,
  SODEXO_COLUMNA_ESCOLIOSIS_LADOS,
  SODEXO_COLUMNA_REGIONES,
  sodexoColumnaArcoKey,
  sodexoColumnaCurvaKey,
  sodexoColumnaEscoliosisKey,
} from '@/lib/sodexo-examen-fisico-columna'
import { SODEXO_GINECO_TOXICO_EXTENSION_ROWS } from '@/lib/sodexo-gineco-extension-rows'
import { prefillGinecoSodexoFromModulo1 } from '@/lib/sodexo-gineco-prefill'
import {
  SODEXO_HEREDOFAMILIAR_KEYS,
  prefillHeredofamiliarFromAmi,
} from '@/lib/sodexo-heredofamiliar'
import {
  mergeLegacyInmunComplementarias,
  prefillInmunizacionesSodexoFromModulo1,
} from '@/lib/sodexo-inmunizaciones-prefill'
import { SODEXO_INMUNIZACIONES_CATALOG } from '@/lib/sodexo-inmunizaciones-catalog'
import { prefillPatologicosSodexoFromAmi } from '@/lib/sodexo-patologicos-prefill'
import { SODEXO_PATOLOGICOS_CATALOG } from '@/lib/sodexo-patologicos-catalog'
import { prefillEstilosVidaSodexoFromApnp } from '@/lib/sodexo-estilos-vida-prefill'
import { sectionRecord } from '@/lib/sodexo-ami-mirror'

export type SodexoCaptureSyncInput = {
  patientSexo: string
  showGineco: boolean
  antecedentesCaptured?: Record<string, unknown> | null
  modulo1?: Record<string, unknown> | null
  inmunizacionesComplementariasLegacy?: SodexoExtensionData['inmunizaciones_complementarias']
}

function arcosCellKeys(def: SodexoArcosLimbDef): string[] {
  const keys: string[] = []
  for (const mov of def.movements) {
    for (const joint of def.joints) {
      if (!def.applies(mov.id, joint.id)) continue
      for (const side of ['D', 'I'] as const) {
        keys.push(sodexoArcosCellKey(def.limb, mov.id, joint.id, side))
      }
    }
  }
  return keys
}

/** Rellena Niega / Normal / No en opciones sin valor (idempotente). */
export function fillUnsetSodexoCaptureDefaults(
  ext: SodexoExtensionData,
  patientSexo: string,
): SodexoExtensionData {
  const out: SodexoExtensionData = { ...ext }
  let changed = false

  const heredofamiliar = { ...(out.heredofamiliar_sodexo ?? {}) }
  let hfChanged = false
  for (const key of SODEXO_HEREDOFAMILIAR_KEYS) {
    if (!heredofamiliar[key]?.respuesta) {
      heredofamiliar[key] = { respuesta: 'NO', parentesco: '' }
      hfChanged = true
    }
  }
  if (hfChanged) {
    out.heredofamiliar_sodexo = heredofamiliar
    changed = true
  }

  const patologicos = { ...(out.patologicos_sodexo ?? {}) }
  let patChanged = false
  for (const entry of SODEXO_PATOLOGICOS_CATALOG) {
    if (!patologicos[entry.key]?.estado) {
      patologicos[entry.key] = { estado: 'NEGADO', descripcion: '' }
      patChanged = true
    }
  }
  if (patChanged) {
    out.patologicos_sodexo = patologicos
    changed = true
  }

  const inmunFilas = { ...(out.inmunizaciones_sodexo?.filas ?? {}) }
  let inmunChanged = false
  for (const row of SODEXO_INMUNIZACIONES_CATALOG) {
    if (!inmunFilas[row.key]?.estado) {
      inmunFilas[row.key] = { estado: 'NEGADO' }
      inmunChanged = true
    }
  }
  if (inmunChanged) {
    out.inmunizaciones_sodexo = {
      ...(out.inmunizaciones_sodexo ?? {}),
      filas: inmunFilas,
    }
    changed = true
  }

  const estilos = { ...(out.estilos_vida_sodexo ?? {}) }
  let evChanged = false
  if (!estilos.tabaco_opcion && !estilos.tabaco_intensidad) {
    estilos.tabaco_opcion = 'NO'
    evChanged = true
  }
  if (!estilos.alcohol) {
    estilos.alcohol = 'NO'
    evChanged = true
  }
  if (!estilos.drogas) {
    estilos.drogas = 'NO'
    evChanged = true
  }
  if (evChanged) {
    out.estilos_vida_sodexo = estilos
    changed = true
  }

  if (out.examen_encabezado == null) {
    out.examen_encabezado = {
      estado_general_normal: true,
      estado_mental_normal: true,
      mano_dominante: null,
    }
    changed = true
  } else {
    const enc = { ...out.examen_encabezado }
    let encChanged = false
    if (enc.estado_general_normal !== true && enc.estado_general_normal !== false) {
      enc.estado_general_normal = true
      encChanged = true
    }
    if (enc.estado_mental_normal !== true && enc.estado_mental_normal !== false) {
      enc.estado_mental_normal = true
      encChanged = true
    }
    if (encChanged) {
      out.examen_encabezado = enc
      changed = true
    }
  }

  const efMap = { ...(out.examen_fisico_sodexo ?? {}) }
  let efChanged = false
  for (const entry of SODEXO_EXAMEN_FISICO_CATALOG) {
    if (!sodexoEfEntryVisibleForSex(entry, patientSexo)) continue
    const row = efMap[entry.key]
    if (entry.kind === 'texto' || entry.kind === 'check_solo') continue
    if (row?.resultado) continue
    if (entry.kind === 'normal_anormal') {
      efMap[entry.key] = { ...(row ?? {}), resultado: 'NORMAL', desc: row?.desc ?? '' }
      efChanged = true
    } else if (entry.kind === 'signo') {
      efMap[entry.key] = { ...(row ?? {}), resultado: 'NEG', desc: row?.desc ?? '' }
      efChanged = true
    }
  }
  if (efChanged) {
    out.examen_fisico_sodexo = efMap
    changed = true
  }

  const arcosMap = { ...(out.examen_fisico_arcos_sodexo ?? {}) }
  let arcosChanged = false
  for (const def of SODEXO_ARCOS_LIMBS) {
    for (const key of arcosCellKeys(def)) {
      if (arcosMap[key]?.anormal === true || arcosMap[key]?.anormal === false) continue
      arcosMap[key] = { anormal: false }
      arcosChanged = true
    }
  }
  if (arcosChanged) {
    out.examen_fisico_arcos_sodexo = arcosMap
    changed = true
  }

  const columna = {
    curvas: { ...(out.examen_fisico_columna_sodexo?.curvas ?? {}) },
    escoliosis: { ...(out.examen_fisico_columna_sodexo?.escoliosis ?? {}) },
    arcos: { ...(out.examen_fisico_columna_sodexo?.arcos ?? {}) },
    observaciones: out.examen_fisico_columna_sodexo?.observaciones ?? '',
  }
  let colChanged = false
  for (const curva of SODEXO_COLUMNA_CURVAS) {
    for (const region of SODEXO_COLUMNA_REGIONES) {
      const key = sodexoColumnaCurvaKey(curva.id, region.id)
      if (!columna.curvas[key]) {
        columna.curvas[key] = 'N'
        colChanged = true
      }
    }
  }
  for (const lado of SODEXO_COLUMNA_ESCOLIOSIS_LADOS) {
    for (const region of SODEXO_COLUMNA_REGIONES) {
      const key = sodexoColumnaEscoliosisKey(lado.id, region.id)
      if (!columna.escoliosis[key]) {
        columna.escoliosis[key] = 'NO'
        colChanged = true
      }
    }
  }
  for (const mov of SODEXO_COLUMNA_ARCO_MOVIMIENTOS) {
    for (const region of SODEXO_COLUMNA_ARCO_REGIONES) {
      const key = sodexoColumnaArcoKey(mov.id, region.id)
      if (!columna.arcos[key]) {
        columna.arcos[key] = 'NORMAL'
        colChanged = true
      }
    }
    for (const aspect of ['dolor', 'espasmo'] as const) {
      const key = sodexoColumnaArcoKey(mov.id, aspect)
      if (!columna.arcos[key]) {
        columna.arcos[key] = 'NO'
        colChanged = true
      }
    }
  }
  if (colChanged) {
    out.examen_fisico_columna_sodexo = columna
    changed = true
  }

  return changed ? out : ext
}

function mergeHeredofamiliar(
  current: SodexoExtensionData['heredofamiliar_sodexo'],
  suggested: ReturnType<typeof prefillHeredofamiliarFromAmi>,
) {
  const out = { ...(current ?? {}) }
  for (const key of SODEXO_HEREDOFAMILIAR_KEYS) {
    if (!out[key]?.respuesta && suggested[key]?.respuesta) {
      out[key] = suggested[key]
    }
  }
  return out
}

function mergePatologicos(
  current: SodexoExtensionData['patologicos_sodexo'],
  suggested: ReturnType<typeof prefillPatologicosSodexoFromAmi>,
) {
  const out = { ...(current ?? {}) }
  for (const entry of SODEXO_PATOLOGICOS_CATALOG) {
    if (!out[entry.key]?.estado && suggested[entry.key]?.estado) {
      out[entry.key] = suggested[entry.key]
    }
  }
  return out
}

function mergeInmunizaciones(
  current: SodexoExtensionData['inmunizaciones_sodexo'],
  suggested: ReturnType<typeof prefillInmunizacionesSodexoFromModulo1>,
) {
  const filas = { ...(current?.filas ?? {}) }
  for (const row of SODEXO_INMUNIZACIONES_CATALOG) {
    const sug = suggested.filas?.[row.key]
    if (!filas[row.key]?.estado && sug?.estado) {
      filas[row.key] = { ...filas[row.key], ...sug }
    }
  }
  return {
    ...(current ?? {}),
    observaciones: current?.observaciones ?? suggested.observaciones ?? '',
    filas,
  }
}

function applyGinecoCaptureDefaults(
  gineco: NonNullable<SodexoExtensionData['gineco_sodexo']>,
): NonNullable<SodexoExtensionData['gineco_sodexo']> {
  const tox = { ...(gineco.toxicos_medicamentos ?? {}) }
  for (const row of SODEXO_GINECO_TOXICO_EXTENSION_ROWS) {
    if (!tox[row.id]) tox[row.id] = 'NEGADO'
  }
  return {
    ...gineco,
    dismenorrea: gineco.dismenorrea ?? 'NEGADO',
    toxicos_medicamentos: tox,
  }
}

function mergeGinecoFromModulo1(
  current: SodexoExtensionData['gineco_sodexo'],
  fromModulo1: ReturnType<typeof prefillGinecoSodexoFromModulo1>,
): NonNullable<SodexoExtensionData['gineco_sodexo']> {
  const g = { ...(current ?? {}) }
  const textKeys = [
    'ciclos',
    'fum',
    'gesta',
    'parto',
    'cesarea',
    'aborto',
    'vivos',
    'fup',
    'metodo_planificacion',
    'ultima_citologia',
  ] as const
  for (const k of textKeys) {
    const cur = g[k]
    const sug = fromModulo1[k]
    if ((cur == null || String(cur).trim() === '') && sug != null && String(sug).trim()) {
      g[k] = sug
    }
  }
  if (!g.dismenorrea && fromModulo1.dismenorrea) {
    g.dismenorrea = fromModulo1.dismenorrea
  }
  const tox = { ...(g.toxicos_medicamentos ?? {}) }
  const fromTox = fromModulo1.toxicos_medicamentos ?? {}
  for (const row of SODEXO_GINECO_TOXICO_EXTENSION_ROWS) {
    if (!tox[row.id] && fromTox[row.id]) tox[row.id] = fromTox[row.id]
  }
  g.toxicos_medicamentos = tox
  return applyGinecoCaptureDefaults(g)
}

function mergeEstilosVida(
  current: SodexoExtensionData['estilos_vida_sodexo'],
  suggested: ReturnType<typeof prefillEstilosVidaSodexoFromApnp>,
) {
  const out = { ...(current ?? {}) }
  if (!out.tabaco_opcion && !out.tabaco_intensidad && suggested.tabaco_opcion) {
    out.tabaco_opcion = suggested.tabaco_opcion
  }
  if (!out.alcohol && suggested.alcohol) out.alcohol = suggested.alcohol
  if (!out.drogas && suggested.drogas) out.drogas = suggested.drogas
  return out
}

/** AMI (solo huecos) + defaults Negado/Normal para captura. */
export function syncSodexoExtensionCapture(
  ext: SodexoExtensionData,
  input: SodexoCaptureSyncInput,
): SodexoExtensionData {
  const ant = input.antecedentesCaptured ?? {}
  const m1 = (input.modulo1 ?? {}) as Record<string, unknown>

  let out: SodexoExtensionData = { ...ext }

  out = {
    ...out,
    heredofamiliar_sodexo: mergeHeredofamiliar(
      out.heredofamiliar_sodexo,
      prefillHeredofamiliarFromAmi(ant),
    ),
    patologicos_sodexo: mergePatologicos(
      out.patologicos_sodexo,
      prefillPatologicosSodexoFromAmi(sectionRecord(ant, 'patologicos')),
    ),
    estilos_vida_sodexo: mergeEstilosVida(
      out.estilos_vida_sodexo,
      prefillEstilosVidaSodexoFromApnp(sectionRecord(ant, 'no_patologicos')),
    ),
  }

  let inmunSuggested = prefillInmunizacionesSodexoFromModulo1(m1)
  inmunSuggested = mergeLegacyInmunComplementarias(
    inmunSuggested,
    input.inmunizacionesComplementariasLegacy,
  )
  out = {
    ...out,
    inmunizaciones_sodexo: mergeInmunizaciones(out.inmunizaciones_sodexo, inmunSuggested),
  }

  if (input.showGineco) {
    out = {
      ...out,
      gineco_sodexo: mergeGinecoFromModulo1(out.gineco_sodexo, prefillGinecoSodexoFromModulo1(m1)),
    }
  }

  const hoFilas = out.historia_ocupacional_filas
  if (hoFilas?.length) {
    const rows = hoFilas.map((row) => {
      const next = { ...row }
      if (!next.rt) next.rt = 'NEGADO'
      if (!next.secuelas) next.secuelas = 'NEGADO'
      if (!next.indemnizado) next.indemnizado = 'NEGADO'
      return next
    })
    out = { ...out, historia_ocupacional_filas: rows }
  }

  return fillUnsetSodexoCaptureDefaults(out, input.patientSexo)
}
