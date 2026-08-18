/**
 * @file Helpers para auto-poblar recomendaciones del dictamen de aptitud
 * (IMPL-20260817-09-C2, Corte 2).
 *
 * **Regla explícita de Frank (2026-08-17):** *"Quiero que se autopoble.
 * Quiero que el médico solo llene lo estrictamente necesario."*
 *
 * Catálogo cerrado de reglas `hallazgo → recomendación(es)` (DA-7) +
 * `detectHallazgos` para derivar hallazgos desde el estado del examen +
 * resultados IA. El médico puede EDITAR el resultado final (sobrescribir)
 * pero el default ya viene auto-poblado.
 *
 * **Lista numerada** — formato del PDF canónico: `1.- ... 2.- ... 3.- ...`.
 *
 * **Fuente canónica:** `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf`
 * (literales verbatim del PDF; ampliar conforme Jaqueline/Erika validen en
 * iteración futura — no bloquea esta SPEC).
 *
 * @id IMPL-20260817-09-C2
 * @spec SPEC_ARCH-20260817-02 §2.3 (DA-7), §6
 * @decision DA-7 (ARCH-20260817-02) — recomendaciones: catálogo MIXTO
 *           (hallazgo→recomendación + edición manual).
 */

// ─── Tipos ────────────────────────────────────────────────────────────────────

/** Hallazgo detectado (semilla para el catálogo de recomendaciones). */
export interface Hallazgo {
  /** ID canónico del hallazgo (clave del catálogo). Requerido. */
  id: string
  /** Texto legible del hallazgo (para logs/UI). Opcional — `buildRecommendations`
   *  solo necesita `id` para armar la lista; el `texto` se usa para diagnóstico. */
  texto?: string
  /** Categoría opcional para agrupación. */
  categoria?: HallazgoCategoria
}

export type HallazgoCategoria =
  | 'salud_bucal'
  | 'cardiovascular'
  | 'nutricional'
  | 'visual'
  | 'auditiva'
  | 'respiratoria'
  | 'radiologica'
  | 'laboratorio'
  | 'venosa'

/** Forma mínima del examen físico para detectar hallazgos. */
export interface ExamForHallazgos {
  estado_nutricional?: string | null
  agudeza_visual_resumen?: string | null
  salud_bucal?: string | null
  presion_arterial_resumen?: string | null
  /** Texto diagnóstico (para marcadores específicos como "hiperglucemia"). */
  examen_medico_texto?: string | null
  /** Marcadores de circulación venosa (Exploración Física). */
  exploracion?: {
    circulacion_venosa?: string | null
  } | null
}

/** Resultados de IA para detectar hallazgos. */
export interface IaResultsForHallazgos {
  audiometria_clasificacion?: string | null
  espirometria_patron?: string | null
  radiografia_hallazgo?: string | null
  laboratorio_out_of_range?: boolean | null
}

// ─── Catálogo de recomendaciones (DA-7) ───────────────────────────────────────

/**
 * Catálogo cerrado de reglas `hallazgo → recomendación(es)`. Es la SEMILLA —
 * se amplía en iteraciones futuras conforme Jaqueline/Erika validen con
 * casos reales. No vive en schema Prisma.
 *
 * **Reversibilidad:** cambiar/agregar reglas aquí no rompe datos existentes;
 * el médico siempre puede editar/sobrescribir el resultado (D3/DA-7).
 */
export const CATALOGO_RECOMENDACIONES: Record<string, string[]> = {
  // Salud bucal
  caries_sarro: [
    'VALORACIÓN POR ODONTOLOGÍA PARA TRATAMIENTO DE CARIES Y SARRO',
  ],
  caries: ['VALORACIÓN POR ODONTOLOGÍA PARA TRATAMIENTO DE CARIES'],
  sarro: ['VALORACIÓN POR ODONTOLOGÍA PARA TRATAMIENTO DE SARRO'],

  // Estado nutricional
  sobrepeso: [
    'MEJORAR HÁBITOS ALIMENTICIOS',
    'REALIZAR EJERCICIO TODOS LOS DÍAS, DURANTE 30 MINUTOS AL DÍA',
  ],
  obesidad: [
    'MEJORAR HÁBITOS ALIMENTICIOS',
    'REALIZAR EJERCICIO TODOS LOS DÍAS, DURANTE 30 MINUTOS AL DÍA',
    'VALORACIÓN POR NUTRICIÓN',
  ],
  bajo_peso: [
    'VALORACIÓN POR NUTRICIÓN',
    'MEJORAR HÁBITOS ALIMENTICIOS',
  ],

  // Agudeza visual
  vision_disminuida: [
    'VALORACIÓN CON OPTOMETRISTA POR DISMINUCIÓN DE LA AGUDEZA VISUAL',
    'USO DE LENTES PARA LABORAR',
    'EXAMEN DE LA VISTA CADA AÑO',
  ],

  // Cardiovascular / presión arterial
  presion_alta: [
    'VALORACIÓN POR MEDICINA INTERNA POR HIPERTENSIÓN ARTERIAL',
  ],
  presion_baja: [
    'VALORACIÓN POR MEDICINA INTERNA POR HIPOTENSIÓN ARTERIAL',
  ],

  // Insuficiencia venosa
  insuficiencia_venosa: ['MEDIDAS DE HIGIENE VENOSA'],

  // Auditiva
  auditiva_conductiva: [
    'USO ADECUADO DE TAPONES AUDITIVOS',
    'AUDIOMETRÍA DE SEGUIMIENTO EN 12 SEMANAS',
    'POSTERIORMENTE CADA AÑO',
  ],
  auditiva_sensorineural: [
    'USO ADECUADO DE TAPONES AUDITIVOS',
    'AUDIOMETRÍA DE SEGUIMIENTO EN 12 SEMANAS',
    'POSTERIORMENTE CADA AÑO',
  ],
  auditiva_mixta: [
    'USO ADECUADO DE TAPONES AUDITIVOS',
    'AUDIOMETRÍA DE SEGUIMIENTO EN 12 SEMANAS',
    'POSTERIORMENTE CADA AÑO',
  ],

  // Respiratoria (espirometría)
  patron_restrictivo: [
    'INDICAR EJERCICIOS RESPIRATORIOS',
    'SE SUGIERE COMPLEMENTAR CON RADIOGRAFÍA DE TÓRAX',
    'ESPIROMETRÍAS DE SEGUIMIENTO EN 12 SEMANAS',
  ],
  patron_obstructivo: [
    'INDICAR EJERCICIOS RESPIRATORIOS',
    'USO ADECUADO DE EQUIPO DE PROTECCIÓN RESPIRATORIA',
    'ESPIROMETRÍAS DE SEGUIMIENTO EN 12 SEMANAS',
  ],
  patron_mixto: [
    'INDICAR EJERCICIOS RESPIRATORIOS',
    'USO ADECUADO DE EQUIPO DE PROTECCIÓN RESPIRATORIA',
    'ESPIROMETRÍAS DE SEGUIMIENTO EN 12 SEMANAS',
  ],

  // Radiología
  radiografia_patologica: [
    'ESPECIFICAR HALLAZGOS EN OBSERVACIONES',
    'VALORACIÓN POR MEDICINA INTERNA',
  ],

  // Laboratorio
  laboratorio_anormal: [
    'VALORACIÓN POR MEDICINA INTERNA POR HALLAZGOS DE LABORATORIO',
  ],
}

// ─── Detección de hallazgos ───────────────────────────────────────────────────

/**
 * Normaliza un valor (trim + uppercase) para matching tolerante.
 * "sobrepeso" === "SOBREPESO" === " Sobrepeso ".
 */
function norm(v: string | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v).trim().toUpperCase()
}

/** Coincide si el valor pertenece a un set (case-insensitive). */
function inSet(v: string | null | undefined, set: readonly string[]): boolean {
  const nv = norm(v)
  if (nv === '') return false
  return set.some(s => norm(s) === nv)
}

/**
 * Deriva una lista de hallazgos a partir del estado del examen físico
 * (campos manuales del formulario).
 *
 * **Idempotente** — múltiples llamadas con el mismo input devuelven el mismo
 * output. La deduplicación de hallazgos se hace por `id`.
 */
export function detectHallazgosFromExam(exam: ExamForHallazgos): Hallazgo[] {
  const hallazgos: Hallazgo[] = []

  // Salud bucal
  if (inSet(exam.salud_bucal, ['CARIES Y SARRO', 'CARIES Y SARRO '])) {
    hallazgos.push({ id: 'caries_sarro', texto: 'Caries y sarro', categoria: 'salud_bucal' })
  } else if (inSet(exam.salud_bucal, ['CARIES'])) {
    hallazgos.push({ id: 'caries', texto: 'Caries', categoria: 'salud_bucal' })
  } else if (inSet(exam.salud_bucal, ['SARRO'])) {
    hallazgos.push({ id: 'sarro', texto: 'Sarro', categoria: 'salud_bucal' })
  }

  // Estado nutricional
  if (inSet(exam.estado_nutricional, ['SOBREPESO'])) {
    hallazgos.push({ id: 'sobrepeso', texto: 'Sobrepeso', categoria: 'nutricional' })
  } else if (
    inSet(exam.estado_nutricional, ['OBESIDAD', 'OBESIDAD G1', 'OBESIDAD G2', 'OBESIDAD G3'])
  ) {
    hallazgos.push({ id: 'obesidad', texto: 'Obesidad', categoria: 'nutricional' })
  } else if (inSet(exam.estado_nutricional, ['BAJO PESO', 'DESNUTRICIÓN'])) {
    hallazgos.push({ id: 'bajo_peso', texto: 'Bajo peso', categoria: 'nutricional' })
  }

  // Agudeza visual
  if (norm(exam.agudeza_visual_resumen) === 'DISMINUIDA') {
    hallazgos.push({ id: 'vision_disminuida', texto: 'Disminución agudeza visual', categoria: 'visual' })
  }

  // Presión arterial
  if (norm(exam.presion_arterial_resumen) === 'ALTA') {
    hallazgos.push({ id: 'presion_alta', texto: 'Hipertensión arterial', categoria: 'cardiovascular' })
  } else if (norm(exam.presion_arterial_resumen) === 'BAJA') {
    hallazgos.push({ id: 'presion_baja', texto: 'Hipotensión arterial', categoria: 'cardiovascular' })
  }

  // Exploración: circulación venosa
  if (exam.exploracion?.circulacion_venosa) {
    const cv = norm(exam.exploracion.circulacion_venosa)
    if (cv.includes('INSUFICIENCIA')) {
      hallazgos.push({ id: 'insuficiencia_venosa', texto: 'Insuficiencia venosa', categoria: 'venosa' })
    }
  }

  return hallazgos
}

/**
 * Deriva hallazgos a partir de los resultados de IA disponibles.
 *
 * Mismas reglas que la sección D3 del SPEC:
 * - audiometría con clasificación !== 'normal'
 * - espirometría con patrón ∈ {restrictivo, obstructivo, mixto}
 * - RX con hallazgo patológico
 * - laboratorio con isOutOfRange === true
 */
export function detectHallazgosFromIa(ia: IaResultsForHallazgos): Hallazgo[] {
  const hallazgos: Hallazgo[] = []

  // Audiometría
  const audioClass = norm(ia.audiometria_clasificacion)
  if (audioClass !== '' && audioClass !== 'NORMAL') {
    if (audioClass.includes('CONDUCTIVA')) {
      hallazgos.push({ id: 'auditiva_conductiva', texto: 'Hipoacusia conductiva', categoria: 'auditiva' })
    } else if (audioClass.includes('SENSORINEURAL')) {
      hallazgos.push({ id: 'auditiva_sensorineural', texto: 'Hipoacusia sensorineural', categoria: 'auditiva' })
    } else if (audioClass.includes('MIXTA')) {
      hallazgos.push({ id: 'auditiva_mixta', texto: 'Hipoacusia mixta', categoria: 'auditiva' })
    } else {
      // Clasificación patológica sin subtipo → usar conductiva como genérico.
      hallazgos.push({ id: 'auditiva_conductiva', texto: 'Hipoacusia', categoria: 'auditiva' })
    }
  }

  // Espirometría
  const patron = norm(ia.espirometria_patron)
  if (patron === 'RESTRICTIVO') {
    hallazgos.push({ id: 'patron_restrictivo', texto: 'Patrón restrictivo', categoria: 'respiratoria' })
  } else if (patron === 'OBSTRUCTIVO') {
    hallazgos.push({ id: 'patron_obstructivo', texto: 'Patrón obstructivo', categoria: 'respiratoria' })
  } else if (patron === 'MIXTO') {
    hallazgos.push({ id: 'patron_mixto', texto: 'Patrón mixto', categoria: 'respiratoria' })
  }

  // Radiografía
  const rx = norm(ia.radiografia_hallazgo)
  if (rx !== '' && rx !== 'NORMAL' && rx !== 'SIN HALLAZGOS') {
    hallazgos.push({ id: 'radiografia_patologica', texto: 'Hallazgo radiográfico', categoria: 'radiologica' })
  }

  // Laboratorio
  if (ia.laboratorio_out_of_range === true) {
    hallazgos.push({ id: 'laboratorio_anormal', texto: 'Laboratorio fuera de rango', categoria: 'laboratorio' })
  }

  return hallazgos
}

/**
 * Atajo: detecta TODOS los hallazgos (manual + IA) y deduplica por `id`.
 */
export function extractHallazgos(
  exam: ExamForHallazgos,
  ia?: IaResultsForHallazgos | null
): Hallazgo[] {
  const all = [
    ...detectHallazgosFromExam(exam),
    ...detectHallazgosFromIa(ia ?? {}),
  ]
  const seen = new Set<string>()
  const dedup: Hallazgo[] = []
  for (const h of all) {
    if (!seen.has(h.id)) {
      seen.add(h.id)
      dedup.push(h)
    }
  }
  return dedup
}

// ─── Builder principal ────────────────────────────────────────────────────────

/**
 * Genera la lista numerada de recomendaciones a partir de una lista de
 * hallazgos. Aplica el catálogo `CATALOGO_RECOMENDACIONES` y deduplica las
 * recomendaciones resultantes.
 *
 * **Formato de salida:** lista numerada verbatim del PDF canónico.
 * ```
 * 1.- VALORACIÓN POR ODONTOLOGÍA PARA TRATAMIENTO DE CARIES Y SARRO. 2.- MEJORAR HÁBITOS ALIMENTICIOS. 3.- REALIZAR EJERCICIO...
 * ```
 *
 * @param hallazgos - Lista de hallazgos (típicamente de `extractHallazgos`).
 * @returns String con la lista numerada (vacío si no hay hallazgos).
 */
export function buildRecommendations(hallazgos: Hallazgo[]): string {
  const recSet = new Set<string>()

  for (const h of hallazgos) {
    const recs = CATALOGO_RECOMENDACIONES[h.id]
    if (!recs) continue
    for (const r of recs) {
      recSet.add(r)
    }
  }

  const arr = Array.from(recSet)
  if (arr.length === 0) return ''

  return arr.map((r, i) => `${i + 1}.- ${r}`).join('. ')
}

/**
 * Atajo: deriva hallazgos desde examen + IA y construye recomendaciones.
 */
export function buildRecommendationsFromExam(
  exam: ExamForHallazgos,
  ia?: IaResultsForHallazgos | null
): string {
  return buildRecommendations(extractHallazgos(exam, ia))
}
