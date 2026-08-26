/**
 * @fileoverview Panel clínico de Audiometría con criterios AMI + PTA
 *   calculado y PTA fuente por separado.
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 *
 * Paralelo a `EspirometriaClinicalCriteriaPanel`, pero con criterios
 * audiométricos:
 *   - Tabla bilateral de umbrales por frecuencia (TA = vía aérea y VO =
 *     vía ósea cuando aparecen en el documento fuente). NO se inventan
 *     frecuencias ausentes.
 *   - PTA calculado (PTA3) por oído: `(TA500 + TA1000 + TA2000) / 3`. Se
 *     muestra la ECUACIÓN, sus TRES ENTRADAS, el resultado, la fuente del
 *     cálculo y el `pta_fuente` del documento por separado.
 *   - Criterio AMI de normalidad: ≤ 25 dB → normal.
 *   - Clasificación por patrón (graves vs agudas) + PTA/criterio AMI. Si
 *     hay umbrales en huecos AMI, la clasificación se marca
 *     `NO_CONCLUYENTE_PARA_CLASIFICACION`.
 *   - Capas explícitas en la UI: NOM (referencia), AMI (criterio
 *     audiométrico operativo), datos fuente.
 *   - NO copia el diagnóstico nosológico ni la recomendación del PDF AMI
 *     como conclusión IA: el panel sólo presenta la interpretación
 *     derivada de los umbrales y los criterios del sistema.
 *
 * El panel es TOLERANTE a payload parcial: si falta TA1000 (p. ej. el
 * documento sólo trae 4 frecuencias), el PTA se calcula con los valores
 * disponibles y se marca explícitamente como `INCOMPLETO` cuando faltan
 * los 3 componentes de PTA3.
 */
import type { ReactNode } from 'react'

// ──────────────────────────────────────────────────────────────────────────
// Tipos públicos y constantes
// ──────────────────────────────────────────────────────────────────────────

/** Umbral de normalidad audiométrica AMI (BR-20260825-04 / DEC-20260825-05). */
export const AMI_NORMALIDAD_DB = 25

/**
 * Frecuencias canónicas de PTA3 (BR-20260825-04). Graves 250/500/1000;
 * agudas 2000/3000/4000/6000/8000. `1000` es frontera y NO se duplica.
 */
export const PTA3_FREQUENCIES_HZ = [500, 1000, 2000] as const

/** Frecuencias graves y agudas para el patrón audiométrico. */
export const FRECUENCIAS_GRAVES_HZ = [250, 500, 1000] as const
export const FRECUENCIAS_AGUDAS_HZ = [2000, 3000, 4000, 6000, 8000] as const

// ──────────────────────────────────────────────────────────────────────────
// FND-20260825-12 — Referencia del programa audiométrico AMI.
//
// Estas constantes representan la TABLA DE REFERENCIA del criterio
// audiométrico AMI (BR-20260825-04 / DEC-20260825-05). NO son resultados
// derivados del paciente: sirven para que el médico y el programa lean
// la tabla de referencia y comparen con el resultado derivado del
// paciente (que se calcula arriba de esta sección, en el panel clínico,
// y en la sección III del PDF).
//
// DEFINICIONES (referencia operativa):
//   - Normalidad:         PTA ≤ 25 dB
//   - Patrones operativos (etiquetas nosológicas):
//       NORMAL                            todos los umbrales dentro de rango
//       GRAVES                            compromiso en 250/500/1000 Hz
//       NEUROSENSORIAL_MEDIAS_AGUDAS      compromiso en 2000/3000/4000/6000/8000 Hz
//                                         (predominio agudas con perfil neurosensorial)
//       MIXTA                             compromiso simultáneo en graves y medias/agudas
//       FATIGA                            caída de umbral > 10 dB al final del estudio
//                                         (descenso sostenido, NO coclear)
//   - Severidad (por peor PTA en dB HL):
//       NO_APLICA         ≤ 25 dB
//       LEVE              30–40 dB
//       MODERADA          45–55 dB
//       MODERADAMENTE_SEVERA 60–70 dB
//       SEVERA            75–90 dB
//       PROFUNDA          ≥ 95 dB
//   - Categorías etiológicas AMI (REFERENCIA, selección administrativa):
//       NORMAL
//       TRAUMA_ACUSTICO_CRONICO        (TAC — exposición ocupacional/recreativa)
//       PRESBIACUSIA                  (relacionada con edad)
//       PROBABLE_VIAS_RESPIRATORIAS_ALTAS (CAI/MTI/tapón)
//       ETIOLOGIA_A_DETERMINAR        (no clasificable con datos disponibles)
//
// REGLA: esta tabla NO convierte la referencia en diagnóstico automático.
// El panel conserva su separación entre:
//   1) Resultado derivado (PTA, criterio, patrón) — capa AMI interpretada.
//   2) Impresión diagnóstica — decisión del médico firmante.
// La sección de referencia es información administrativa que el clínico
// consulta al emitir la impresión.
// ──────────────────────────────────────────────────────────────────────────

export type AmPatronNosologico =
  | 'NORMAL'
  | 'GRAVES'
  | 'NEUROSENSORIAL_MEDIAS_AGUDAS'
  | 'MIXTA'
  | 'FATIGA'

export type AmSeveridad =
  | 'NO_APLICA'
  | 'LEVE'
  | 'MODERADA'
  | 'MODERADAMENTE_SEVERA'
  | 'SEVERA'
  | 'PROFUNDA'

export type AmEtiologia =
  | 'NORMAL'
  | 'TRAUMA_ACUSTICO_CRONICO'
  | 'PRESBIACUSIA'
  | 'PROBABLE_VIAS_RESPIRATORIAS_ALTAS'
  | 'ETIOLOGIA_A_DETERMINAR'

export interface AmiPatronReferencia {
  id: AmPatronNosologico
  etiqueta: string
  descripcion: string
  frecuenciasOperativas: string
}

export interface AmiSeveridadReferencia {
  id: AmSeveridad
  etiqueta: string
  rangoDB: string
  descripcion: string
}

export interface AmiEtiologiaReferencia {
  id: AmEtiologia
  etiqueta: string
  nota: string
}

export const AMI_PATRONES_REFERENCIA: ReadonlyArray<AmiPatronReferencia> = [
  {
    id: 'NORMAL',
    etiqueta: 'Normal',
    descripcion:
      'Todos los umbrales TA dentro de la banda de normalidad operativa.',
    frecuenciasOperativas: '250–8000 Hz',
  },
  {
    id: 'GRAVES',
    etiqueta: 'Patrón de graves',
    descripcion:
      'Compromiso predominante en frecuencias graves (perfil conductivo o mixto bajo).',
    frecuenciasOperativas: '250 / 500 / 1000 Hz',
  },
  {
    id: 'NEUROSENSORIAL_MEDIAS_AGUDAS',
    etiqueta: 'Neurosensorial medias/agudas',
    descripcion:
      'Compromiso predominante en medias y agudas (perfil neurosensorial alto).',
    frecuenciasOperativas: '2000 / 3000 / 4000 / 6000 / 8000 Hz',
  },
  {
    id: 'MIXTA',
    etiqueta: 'Hipoacusia mixta',
    descripcion:
      'Compromiso simultáneo en graves y medias/agudas (componentes conductiva y neurosensorial).',
    frecuenciasOperativas: '250–8000 Hz (ambas regiones)',
  },
  {
    id: 'FATIGA',
    etiqueta: 'Fatiga auditiva',
    descripcion:
      'Caída de umbral > 10 dB al final del estudio; NO coclear.',
    frecuenciasOperativas: 'umbrales finales',
  },
]

export const AMI_SEVERIDAD_REFERENCIA: ReadonlyArray<AmiSeveridadReferencia> = [
  {
    id: 'NO_APLICA',
    etiqueta: 'No aplica',
    rangoDB: 'PTA ≤ 25 dB HL',
    descripcion: 'Umbrales dentro del rango de normalidad operativa.',
  },
  {
    id: 'LEVE',
    etiqueta: 'Leve',
    rangoDB: '30–40 dB HL',
    descripcion: 'Déficit leve en la inteligibilidad de la palabra.',
  },
  {
    id: 'MODERADA',
    etiqueta: 'Moderada',
    rangoDB: '45–55 dB HL',
    descripcion: 'Dificultad para la conversación en ambiente ruidoso.',
  },
  {
    id: 'MODERADAMENTE_SEVERA',
    etiqueta: 'Moderadamente severa',
    rangoDB: '60–70 dB HL',
    descripcion: 'Requiere amplificación; impacto laboral y social.',
  },
  {
    id: 'SEVERA',
    etiqueta: 'Severa',
    rangoDB: '75–90 dB HL',
    descripcion: 'Sólo percibe ruidos fuertes; requiere lectura labial.',
  },
  {
    id: 'PROFUNDA',
    etiqueta: 'Profunda',
    rangoDB: '≥ 95 dB HL',
    descripcion: 'Pérdida total o casi total; impacto funcional profundo.',
  },
]

export const AMI_ETIOLOGIAS_REFERENCIA: ReadonlyArray<AmiEtiologiaReferencia> = [
  {
    id: 'NORMAL',
    etiqueta: 'Normal',
    nota: 'Sin hallazgos audiométricos operativos.',
  },
  {
    id: 'TRAUMA_ACUSTICO_CRONICO',
    etiqueta: 'Trauma acústico crónico',
    nota:
      'Antecedente de exposición ocupacional o recreativa reiterada a ruido.',
  },
  {
    id: 'PRESBIACUSIA',
    etiqueta: 'Presbiacusia',
    nota: 'Pérdida asociada al envejecimiento del receptor coclear.',
  },
  {
    id: 'PROBABLE_VIAS_RESPIRATORIAS_ALTAS',
    etiqueta: 'Probable compromiso de vías respiratorias altas',
    nota: 'Hallazgo reproducible en conducción aérea/ósea media.',
  },
  {
    id: 'ETIOLOGIA_A_DETERMINAR',
    etiqueta: 'Etiología a determinar',
    nota:
      'No clasificable con la evidencia actual; requiere correlación clínica.',
  },
]
export interface OidoInterpretacion {
  oido: 'OD' | 'OI'
  ptaCalculado: number | null
  ptaCalculadoCompleto: boolean // true si los 3 componentes PTA3 están presentes
  ptaFuente: number | null
  ptaFuenteOrigen: 'documento' | 'no_disponible'
  criterioAmi: 'NORMAL' | 'ALTERADO' | 'NO_CONCLUYENTE'
  patron: {
    graves: number | null // peor umbral en graves (dB)
    agudas: number | null // peor umbral en agudas (dB)
  }
  patronAmi: 'NORMAL' | 'GRAVES' | 'AGUDAS' | 'MIXTA' | 'NO_CONCLUYENTE'
}

export interface ResolvedAudiometriaCriteria {
  readonly oidos: ReadonlyArray<OidoInterpretacion>
  readonly bilateral: {
    readonly estado: 'NORMAL_BILATERAL' | 'ALTERADO_BILATERAL' | 'ASIMETRIA' | 'NO_CONCLUYENTE'
    readonly nota: string
  }
  readonly completitudDocumental:
    | 'suficiente'
    | 'parcial'
    | 'no_concluyente'
    | 'desconocida'
  /** Frecuencias detectadas en el documento fuente (sólo lo presente). */
  readonly frecuenciasDetectadas: number[]
  readonly advertencias: string[]
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers puros — testeables y reutilizables desde el PDF
// ──────────────────────────────────────────────────────────────────────────

function asFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function readOido(
  extracted: Record<string, unknown>,
  side: 'oido_derecho' | 'oido_izquierdo',
): {
  va: Record<number, number>
  vo: Record<number, number>
  ptaVisible: number | null
} {
  const oido = extracted[side]
  const oidoObj =
    oido && typeof oido === 'object' && !Array.isArray(oido)
      ? (oido as Record<string, unknown>)
      : null
  const vaRaw = oidoObj?.va ?? oidoObj?.via_aerea ?? {}
  const voRaw = oidoObj?.vo ?? oidoObj?.via_osea ?? {}
  const va: Record<number, number> = {}
  const vo: Record<number, number> = {}
  if (vaRaw && typeof vaRaw === 'object' && !Array.isArray(vaRaw)) {
    for (const [k, v] of Object.entries(vaRaw as Record<string, unknown>)) {
      const n = asFiniteNumber(v)
      if (n !== null) {
        const freq = Number(k)
        if (Number.isFinite(freq)) va[freq] = n
      }
    }
  }
  if (voRaw && typeof voRaw === 'object' && !Array.isArray(voRaw)) {
    for (const [k, v] of Object.entries(voRaw as Record<string, unknown>)) {
      const n = asFiniteNumber(v)
      if (n !== null) {
        const freq = Number(k)
        if (Number.isFinite(freq)) vo[freq] = n
      }
    }
  }
  // pta_fuente = el PTA explícito del documento (si está visible), NO se
  // calcula: se conserva tal cual aparece en el formato fuente.
  const ptaVisible = asFiniteNumber(oidoObj?.pta_visible ?? oidoObj?.pta)
  return { va, vo, ptaVisible: ptaVisible !== null ? ptaVisible : null }
}

/**
 * Calcula PTA3 = (TA500 + TA1000 + TA2000) / 3 sobre los umbrales de vía
 * aérea (TA). Devuelve el promedio redondeado a 1 decimal y un flag que
 * indica si los 3 componentes estaban presentes (para distinguir entre
 * "PTA parcial" vs "PTA completo").
 *
 * NO inventa frecuencias: si una de las 3 falta, devuelve `promedio=null`
 * y `completo=false`. NO rellena con el promedio, NO interpola.
 */
export function calcularPTA3(
  va: Record<number, number>,
): { promedio: number | null; completo: boolean; valores: Record<500 | 1000 | 2000, number | null> } {
  const ta500 = asFiniteNumber(va[500]) ?? null
  const ta1000 = asFiniteNumber(va[1000]) ?? null
  const ta2000 = asFiniteNumber(va[2000]) ?? null
  const valores: Record<500 | 1000 | 2000, number | null> = {
    500: ta500,
    1000: ta1000,
    2000: ta2000,
  }
  const presentes = [ta500, ta1000, ta2000].filter((v) => v !== null) as number[]
  if (presentes.length !== 3) {
    return { promedio: null, completo: false, valores }
  }
  const promedio = Math.round(((ta500! + ta1000! + ta2000!) / 3) * 10) / 10
  return { promedio, completo: true, valores }
}

/**
 * Clasifica el patrón audiométrico (graves vs agudas) usando el peor
 * umbral TA en cada grupo. Si el grupo no tiene umbrales en el documento,
 * queda `null` y la clasificación combinada se considera
 * `NO_CONCLUYENTE_PARA_CLASIFICACION`.
 *
 * El patrón es audiométrico-operativo (sólo TA). NO se interpreta la
 * diferencia TA-VO (gap) en este incremento: el SPEC §4.3 reserva el
 * cruce con VO a la revisión médica.
 */
function clasificarPatron(
  va: Record<number, number>,
  ptaCompleto: boolean,
  ptaCalculado: number | null,
): OidoInterpretacion['patronAmi'] {
  const gravesVals: number[] = []
  const agudasVals: number[] = []
  for (const f of FRECUENCIAS_GRAVES_HZ) {
    const v = asFiniteNumber(va[f])
    if (v !== null) gravesVals.push(v)
  }
  for (const f of FRECUENCIAS_AGUDAS_HZ) {
    const v = asFiniteNumber(va[f])
    if (v !== null) agudasVals.push(v)
  }
  const peorGraves = gravesVals.length > 0 ? Math.max(...gravesVals) : null
  const peorAgudas = agudasVals.length > 0 ? Math.max(...agudasVals) : null
  // Clasificación combinada: requiere ambos grupos para no degenerar en
  // sobre-interpretación. Si falta uno, no concluyente.
  if (peorGraves === null || peorAgudas === null) return 'NO_CONCLUYENTE'
  const gravesAlt = peorGraves > AMI_NORMALIDAD_DB
  const agudasAlt = peorAgudas > AMI_NORMALIDAD_DB
  if (!gravesAlt && !agudasAlt) {
    // Si el PTA está completo y también es ≤ 25 dB confirmamos NORMAL;
    // si el PTA no está completo (faltan datos) pero los peores
    // umbrales visibles están dentro del rango, marcamos NORMAL pero
    // dejamos nota en `criterioAmi`/`completitudDocumental`.
    return 'NORMAL'
  }
  if (gravesAlt && agudasAlt) return 'MIXTA'
  if (gravesAlt) return 'GRAVES'
  return 'AGUDAS'
  // `ptaCompleto` / `ptaCalculado` se mantienen en el shape para debugging
  // futuro; el patrón actual no los usa para evitar inferencias no
  // autorizadas.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void ptaCompleto
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void ptaCalculado
}

/**
 * Resuelve la interpretación audiométrica derivada a partir de un
 * `extractedData` (el snapshot congelado por el extractor). Es un helper
 * PURO sin dependencias de React, reutilizable desde el PDF validado.
 */
export function resolveAudiometriaCriteria(
  extractedData: Record<string, unknown> | null | undefined,
): ResolvedAudiometriaCriteria {
  const data = (extractedData ?? {}) as Record<string, unknown>
  const od = readOido(data, 'oido_derecho')
  const oi = readOido(data, 'oido_izquierdo')

  const ptaOd = calcularPTA3(od.va)
  const ptaOi = calcularPTA3(oi.va)

  const advertencias: string[] = []
  if (!ptaOd.completo) {
    advertencias.push(
      'OD: PTA3 incompleto (faltan TA500/TA1000/TA2000). Mostrando valores disponibles.',
    )
  }
  if (!ptaOi.completo) {
    advertencias.push(
      'OI: PTA3 incompleto (faltan TA500/TA1000/TA2000). Mostrando valores disponibles.',
    )
  }

  function interpretarOido(
    side: 'OD' | 'OI',
    pta: { promedio: number | null; completo: boolean; valores: Record<500 | 1000 | 2000, number | null> },
    oido: { va: Record<number, number>; ptaVisible: number | null },
  ): OidoInterpretacion {
    const patron = clasificarPatron(oido.va, pta.completo, pta.promedio)
    // Criterio AMI: normalidad ≤ 25 dB. Sólo aplica cuando PTA está
    // completo y dentro del patrón. Si el patrón es NO_CONCLUYENTE, el
    // criterio AMI también lo es.
    let criterioAmi: OidoInterpretacion['criterioAmi']
    if (!pta.completo || pta.promedio === null) {
      criterioAmi = 'NO_CONCLUYENTE'
    } else if (pta.promedio <= AMI_NORMALIDAD_DB) {
      criterioAmi = 'NORMAL'
    } else {
      criterioAmi = 'ALTERADO'
    }
    // Si el patrón dice NO_CONCLUYENTE, el criterio AMI también.
    if (patron === 'NO_CONCLUYENTE' && criterioAmi !== 'NORMAL') {
      criterioAmi = 'NO_CONCLUYENTE'
    }
    // pta_fuente: se conserva tal cual aparece en el documento. null si
    // no está visible.
    const ptaFuente = oido.ptaVisible
    const ptaFuenteOrigen: OidoInterpretacion['ptaFuenteOrigen'] =
      ptaFuente !== null ? 'documento' : 'no_disponible'
    // peores umbrales para patrón UI
    const gravesVals = FRECUENCIAS_GRAVES_HZ.map((f) => asFiniteNumber(oido.va[f])).filter(
      (v): v is number => v !== null,
    )
    const agudasVals = FRECUENCIAS_AGUDAS_HZ.map((f) => asFiniteNumber(oido.va[f])).filter(
      (v): v is number => v !== null,
    )
    const patronGraves = gravesVals.length > 0 ? Math.max(...gravesVals) : null
    const patronAgudas = agudasVals.length > 0 ? Math.max(...agudasVals) : null
    return {
      oido: side,
      ptaCalculado: pta.promedio,
      ptaCalculadoCompleto: pta.completo,
      ptaFuente,
      ptaFuenteOrigen,
      criterioAmi,
      patron: { graves: patronGraves, agudas: patronAgudas },
      patronAmi: patron,
    }
  }

  const oidos: OidoInterpretacion[] = [
    interpretarOido('OD', ptaOd, od),
    interpretarOido('OI', ptaOi, oi),
  ]

  // Estado bilateral
  const odEstado = oidos[0].criterioAmi
  const oiEstado = oidos[1].criterioAmi
  let bilateralEstado: ResolvedAudiometriaCriteria['bilateral']['estado']
  let bilateralNota: string
  if (
    odEstado === 'NO_CONCLUYENTE' ||
    oiEstado === 'NO_CONCLUYENTE'
  ) {
    bilateralEstado = 'NO_CONCLUYENTE'
    bilateralNota =
      'Al menos un oído no es concluyente para clasificación AMI (faltan TA500/TA1000/TA2000 o patrón incompleto).'
  } else if (odEstado === oiEstado) {
    bilateralEstado =
      odEstado === 'NORMAL' ? 'NORMAL_BILATERAL' : 'ALTERADO_BILATERAL'
    bilateralNota = `Ambos oídos: ${odEstado === 'NORMAL' ? 'normales (≤25 dB)' : 'alterados (>25 dB)'}.`
  } else {
    bilateralEstado = 'ASIMETRIA'
    bilateralNota = 'Asimetría entre OD y OI. Requiere revisión médica.'
  }

  // completitud documental (BR-20260825-04)
  const totalFrecuencias = new Set<number>()
  for (const f of Object.keys(od.va)) totalFrecuencias.add(Number(f))
  for (const f of Object.keys(oi.va)) totalFrecuencias.add(Number(f))
  const frecuenciasDetectadas = Array.from(totalFrecuencias)
    .filter((f) => Number.isFinite(f))
    .sort((a, b) => a - b)
  let completitud: ResolvedAudiometriaCriteria['completitudDocumental']
  if (frecuenciasDetectadas.length >= 6) completitud = 'suficiente'
  else if (frecuenciasDetectadas.length >= 3) completitud = 'parcial'
  else if (frecuenciasDetectadas.length > 0) completitud = 'no_concluyente'
  else completitud = 'desconocida'

  // advertimos si hay sólo 4 frecuencias como en el ejemplo de la SPEC §7
  if (frecuenciasDetectadas.length === 4) {
    advertencias.push(
      'Cobertura parcial: el documento sólo expone 4 frecuencias. Las ausentes quedan null y reducen la completitud.',
    )
  }

  return {
    oidos,
    bilateral: { estado: bilateralEstado, nota: bilateralNota },
    completitudDocumental: completitud,
    frecuenciasDetectadas,
    advertencias,
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Sub-componentes UI (cliente puro)
// ──────────────────────────────────────────────────────────────────────────

function formatDb(v: number | null): string {
  if (v === null || Number.isNaN(v)) return '—'
  return `${v} dB`
}

function LayerBadge({
  label,
  tone,
  children,
}: {
  label: string
  tone: 'nom' | 'ami' | 'fuente' | 'derivada'
  children: ReactNode
}) {
  const cls =
    tone === 'nom'
      ? 'bg-slate-100 text-slate-700 border-slate-300'
      : tone === 'ami'
        ? 'bg-amber-50 text-amber-800 border-amber-300'
        : tone === 'fuente'
          ? 'bg-sky-50 text-sky-800 border-sky-300'
          : 'bg-teal-50 text-teal-800 border-teal-300'
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border rounded px-2 py-0.5 ${cls}`}
      data-testid={`audiometria-layer-${tone}`}
    >
      <span>{label}</span>
      <span className="font-normal normal-case tracking-normal">
        {children}
      </span>
    </span>
  )
}

function CriterioBadge({
  value,
}: {
  value: OidoInterpretacion['criterioAmi']
}) {
  const map: Record<OidoInterpretacion['criterioAmi'], { txt: string; cls: string }> = {
    NORMAL: {
      txt: 'Normal (≤ 25 dB)',
      cls: 'bg-emerald-50 text-emerald-700 border-emerald-300',
    },
    ALTERADO: {
      txt: 'Alterado (> 25 dB)',
      cls: 'bg-red-50 text-red-700 border-red-300',
    },
    NO_CONCLUYENTE: {
      txt: 'No concluyente',
      cls: 'bg-orange-50 text-orange-700 border-orange-300',
    },
  }
  const v = map[value]
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider border rounded px-2 py-0.5 ${v.cls}`}
      data-testid={`audiometria-criterio-${value.toLowerCase()}`}
    >
      {v.txt}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Componente principal (UI)
// ──────────────────────────────────────────────────────────────────────────

export type AudiometriaClinicalCriteriaPanelProps = {
  extractedData: Record<string, unknown> | null | undefined
  version: number
}

export default function AudiometriaClinicalCriteriaPanel({
  extractedData,
  version,
}: AudiometriaClinicalCriteriaPanelProps) {
  const resolved = resolveAudiometriaCriteria(extractedData)
  const od = resolved.oidos.find((o) => o.oido === 'OD') ?? null
  const oi = resolved.oidos.find((o) => o.oido === 'OI') ?? null

  // Para evitar inventar frecuencias (AC-2): sólo renderizamos las
  // frecuencias REALMENTE detectadas en el documento, ordenadas.
  const frecuencias = resolved.frecuenciasDetectadas

  const od_va = readOidoVa(extractedData, 'oido_derecho')
  const oi_va = readOidoVa(extractedData, 'oido_izquierdo')
  const od_vo = readOidoVo(extractedData, 'oido_derecho')
  const oi_vo = readOidoVo(extractedData, 'oido_izquierdo')

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
      data-testid="audiometria-clinical-criteria-panel"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">🎧</span>
          <p className="text-sm font-bold text-slate-700">
            Criterios clínicos audiométricos
          </p>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
          v{version}
        </span>
      </div>

      <p className="text-[11px] text-slate-500">
        Capas diferenciadas:{' '}
        <LayerBadge label="NOM" tone="nom"> referencia regulatoria</LayerBadge>{' '}
        <LayerBadge label="AMI" tone="ami"> criterio audiométrico</LayerBadge>{' '}
        <LayerBadge label="Fuente" tone="fuente"> datos del documento</LayerBadge>{' '}
        <LayerBadge label="Derivada" tone="derivada"> cálculo del sistema</LayerBadge>
      </p>

      {/* Advertencias de cobertura parcial */}
      {resolved.advertencias.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <p className="text-[11px] font-bold text-amber-800 mb-1">Advertencias</p>
          <ul className="space-y-0.5">
            {resolved.advertencias.map((a, i) => (
              <li key={i} className="text-xs text-amber-700">
                • {a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabla bilateral por frecuencia */}
      <div>
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          Vía aérea (TA) por oído y frecuencia
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200">
                  Frecuencia (Hz)
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200">
                  TA OD
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200">
                  TA OI
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200">
                  VO OD
                </th>
                <th className="px-3 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-b border-slate-200">
                  VO OI
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {frecuencias.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-3 text-center text-slate-400"
                  >
                    Sin umbrales detectados en el documento fuente.
                  </td>
                </tr>
              ) : (
                frecuencias.map((freq, idx) => (
                  <tr
                    key={freq}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                  >
                    <td className="px-3 py-1.5 font-medium text-slate-700 whitespace-nowrap">
                      {freq}
                    </td>
                    <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                      {formatDb(od_va[freq] ?? null)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-700 whitespace-nowrap">
                      {formatDb(oi_va[freq] ?? null)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                      {formatDb(od_vo[freq] ?? null)}
                    </td>
                    <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap">
                      {formatDb(oi_vo[freq] ?? null)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* PTA por oído — calculado vs fuente */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PTACard oidoLabel="OD" interpretacion={od} va={od_va} />
        <PTACard oidoLabel="OI" interpretacion={oi} va={oi_va} />
      </div>

      {/* Estado bilateral */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
          Estado bilateral
        </p>
        <p className="text-xs text-slate-700">{resolved.bilateral.nota}</p>
        <p className="text-[10px] text-slate-500 mt-1 font-mono">
          {resolved.bilateral.estado}
        </p>
      </div>

      {/* Completitud documental */}
      <div className="bg-white border border-slate-200 rounded-lg px-3 py-2">
        <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
          Completitud documental
        </p>
        <p className="text-xs text-slate-700">
          {resolved.completitudDocumental === 'suficiente' &&
            'Suficiente (≥ 6 frecuencias por oído).'}
          {resolved.completitudDocumental === 'parcial' &&
            'Parcial (3–5 frecuencias por oído). La interpretación derivada se muestra con advertencia.'}
          {resolved.completitudDocumental === 'no_concluyente' &&
            'No concluyente (< 3 frecuencias).'}
          {resolved.completitudDocumental === 'desconocida' &&
            'Sin datos suficientes para evaluar.'}
        </p>
        <p className="text-[10px] text-slate-500 mt-1">
          Frecuencias detectadas:{' '}
          {resolved.frecuenciasDetectadas.length > 0
            ? resolved.frecuenciasDetectadas.join(', ') + ' Hz'
            : 'ninguna'}
        </p>
      </div>

      {/* FND-20260825-12 — Criterio audiométrico AMI (referencia).
          Sección explícita y legible, SEPARADA del resultado derivado
          (arriba) y de la decisión médica (abajo, fuera del panel).
          El médico y el programa consultan esta tabla para emitir la
          impresión diagnóstica. */}
      <AMIReferenceSection />

      {/* Guardia clínica: el panel NO copia diagnóstico ni recomendación
          textual del PDF AMI como salida de IA (SPEC §3). */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        <p className="text-[11px] text-amber-700">
          ⚠️ Este panel NO replica el diagnóstico nosológico ni la
          recomendación textual del documento fuente AMI. La impresión
          clínica final la emite el médico tratante.
        </p>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Lectores crudos de TA/VO para la tabla
// ──────────────────────────────────────────────────────────────────────────

function readOidoVa(
  extractedData: Record<string, unknown> | null | undefined,
  side: 'oido_derecho' | 'oido_izquierdo',
): Record<number, number> {
  const r = readOido(extractedData ?? {}, side)
  return r.va
}

function readOidoVo(
  extractedData: Record<string, unknown> | null | undefined,
  side: 'oido_derecho' | 'oido_izquierdo',
): Record<number, number> {
  const r = readOido(extractedData ?? {}, side)
  return r.vo
}

// ──────────────────────────────────────────────────────────────────────────
// FND-20260825-12 — `AMIReferenceSection`
// FND-20260825-13 — UX: la sección se envuelve en un acordeón nativo
// `<details>`/`<summary>` CERRADO por defecto. Acordeón accesible por
// teclado (Tab + Space/Enter) y screen reader (gestión nativa de
// `aria-expanded`).
// FND-20260825-14 / DEC-20260825-10 — esta referencia es el ÚNICO
// contenedor canónico de las tablas AMI (normalidad, patrón
// operativo, severidad, etiologías). El PDF validado RETIRÓ su
// sección equivalente en este incremento y se enfoca sólo en
// trazabilidad clínica del paciente (evidencia, criterios derivados,
// impresión y firma). Las constantes `AMI_*_REFERENCIA` siguen
// exportadas desde este módulo, pero el PDF ya no las importa.
//
// Bloque explícito de la TABLA DE REFERENCIA del programa audiométrico
// AMI. Es la contraparte administrativa del resultado derivado que el
// panel calcula arriba. NO realiza la clasificación del paciente ni
// convierte el resultado en impresión diagnóstica: el clínico consulta
// esta tabla para emitir su impresión.
//
// Capas diferenciadas:
//   - Normalidad (≤ 25 dB).
//   - Patrón nosológico operativo (graves, neurosensorial medias/agudas,
//     mixta, normal, fatiga).
//   - Severidad (rango de dB HL asociado al peor PTA).
//   - Categorías etiológicas AMI (referencia administrativa).
//
// Las tablas se renderizan a partir de las constantes
// `AMI_*_REFERENCIA` declaradas al inicio del módulo, reutilizadas
// también desde el PDF validado.
// ──────────────────────────────────────────────────────────────────────────

function AMIReferenceSection() {
  return (
    <details
      className="bg-slate-50 border border-slate-300 rounded-lg overflow-hidden group"
      data-testid="audiometria-ami-reference-section"
      aria-label="Criterio audiométrico AMI (referencia)"
    >
      <summary
        className="cursor-pointer select-none px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-100 transition-colors [&::-webkit-details-marker]:hidden"
        data-testid="audiometria-ami-reference-summary"
      >
        <div className="flex items-center gap-2">
          <span aria-hidden="true">📖</span>
          <p className="text-sm font-bold text-slate-800">
            Criterio audiométrico AMI (referencia)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-300 rounded px-2 py-0.5 bg-white"
            data-testid="audiometria-ami-reference-tag"
          >
            Referencia operativa
          </span>
          <span
            aria-hidden="true"
            className="text-slate-500 text-xs transition-transform group-open:rotate-90"
            data-testid="audiometria-ami-reference-toggle"
          >
            ▶
          </span>
        </div>
      </summary>
      <div
        className="px-3 py-3 space-y-3 border-t border-slate-200"
        data-testid="audiometria-ami-reference-body"
        role="region"
        aria-label="Contenido de la referencia audiométrica AMI"
      >
        <p className="text-[11px] text-slate-600">
          Tabla administrativa del programa audiométrico AMI. Esta sección
          es de <strong>consulta</strong>: el resultado derivado del paciente
          (PTA, criterio, patrón) está arriba; la impresión diagnóstica la
          emite el médico firmante.
        </p>

        {/* 1. Normalidad */}
        <div data-testid="audiometria-ami-ref-normalidad">
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            1. Normalidad (umbral AMI)
          </p>
          <p className="text-xs text-slate-700 font-mono">
            PTA ≤ {AMI_NORMALIDAD_DB} dB HL → Normal
          </p>
        </div>

        {/* 2. Patrones nosológicos operativos */}
        <div data-testid="audiometria-ami-ref-patrones">
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            2. Patrón nosológico operativo
          </p>
          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left font-semibold text-slate-600 border-b border-slate-200">
                    Patrón
                  </th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-600 border-b border-slate-200">
                    Frecuencias operativas
                  </th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-600 border-b border-slate-200">
                    Descripción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {AMI_PATRONES_REFERENCIA.map(p => (
                  <tr key={p.id} data-testid={`audiometria-ami-ref-patron-${p.id.toLowerCase()}`}>
                    <td className="px-2 py-1 font-medium text-slate-700">
                      {p.etiqueta}
                    </td>
                    <td className="px-2 py-1 font-mono text-slate-600 whitespace-nowrap">
                      {p.frecuenciasOperativas}
                    </td>
                    <td className="px-2 py-1 text-slate-600">
                      {p.descripcion}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. Severidad */}
        <div data-testid="audiometria-ami-ref-severidad">
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            3. Severidad (por peor PTA, dB HL)
          </p>
          <div className="overflow-x-auto rounded border border-slate-200 bg-white">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="px-2 py-1 text-left font-semibold text-slate-600 border-b border-slate-200">
                    Categoría
                  </th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-600 border-b border-slate-200">
                    Rango
                  </th>
                  <th className="px-2 py-1 text-left font-semibold text-slate-600 border-b border-slate-200">
                    Descripción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {AMI_SEVERIDAD_REFERENCIA.map(s => (
                  <tr
                    key={s.id}
                    data-testid={`audiometria-ami-ref-severidad-${s.id.toLowerCase()}`}
                  >
                    <td className="px-2 py-1 font-medium text-slate-700">
                      {s.etiqueta}
                    </td>
                    <td className="px-2 py-1 font-mono text-slate-600 whitespace-nowrap">
                      {s.rangoDB}
                    </td>
                    <td className="px-2 py-1 text-slate-600">
                      {s.descripcion}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. Categorías etiológicas */}
        <div data-testid="audiometria-ami-ref-etiologias">
          <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
            4. Categorías etiológicas AMI (referencia administrativa)
          </p>
          <ul className="space-y-1">
            {AMI_ETIOLOGIAS_REFERENCIA.map(e => (
              <li
                key={e.id}
                className="bg-white border border-slate-200 rounded px-2 py-1"
                data-testid={`audiometria-ami-ref-etiologia-${e.id.toLowerCase()}`}
              >
                <span className="text-xs font-bold text-slate-700">
                  {e.etiqueta}
                </span>
                <span className="text-xs text-slate-600"> — {e.nota}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  )
}

function PTACard({
  oidoLabel,
  interpretacion,
  va,
}: {
  oidoLabel: 'OD' | 'OI'
  interpretacion: OidoInterpretacion | null
  va: Record<number, number>
}) {
  if (!interpretacion) return null
  const { ptaCalculado, ptaCalculadoCompleto, ptaFuente, criterioAmi } =
    interpretacion
  const ta500 = va[500] ?? null
  const ta1000 = va[1000] ?? null
  const ta2000 = va[2000] ?? null
  return (
    <div
      className="bg-white border border-slate-200 rounded-lg p-3"
      data-testid={`audiometria-pta-card-${oidoLabel.toLowerCase()}`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-bold text-slate-700">
          PTA oído {oidoLabel}
        </p>
        <CriterioBadge value={criterioAmi} />
      </div>
      <p
        className="text-[11px] text-slate-600 font-mono"
        data-testid={`audiometria-pta-equation-${oidoLabel.toLowerCase()}`}
      >
        PTA3 = (TA500 + TA1000 + TA2000) / 3
      </p>
      <p
        className="text-[11px] text-slate-700 mt-1"
        data-testid={`audiometria-pta-entries-${oidoLabel.toLowerCase()}`}
      >
        <strong>Entradas TA:</strong> 500=
        <span className="font-mono">{ta500 === null ? '—' : `${ta500} dB`}</span>
        {' · '}1000=
        <span className="font-mono">
          {ta1000 === null ? '—' : `${ta1000} dB`}
        </span>
        {' · '}2000=
        <span className="font-mono">
          {ta2000 === null ? '—' : `${ta2000} dB`}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="bg-teal-50 border border-teal-200 rounded px-2 py-1">
          <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider">
            PTA calculado
          </p>
          <p
            className="text-sm font-bold text-teal-800"
            data-testid={`audiometria-pta-calculado-${oidoLabel.toLowerCase()}`}
          >
            {ptaCalculado === null ? '—' : `${ptaCalculado} dB`}
          </p>
          {!ptaCalculadoCompleto && (
            <p className="text-[10px] text-orange-600">
              Incompleto (faltan TA500/TA1000/TA2000)
            </p>
          )}
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded px-2 py-1">
          <p className="text-[10px] font-bold text-sky-700 uppercase tracking-wider">
            PTA fuente (documento)
          </p>
          <p
            className="text-sm font-bold text-sky-800"
            data-testid={`audiometria-pta-fuente-${oidoLabel.toLowerCase()}`}
          >
            {ptaFuente === null ? '—' : `${ptaFuente} dB`}
          </p>
          <p className="text-[10px] text-sky-600">
            {interpretacion.ptaFuenteOrigen === 'documento'
              ? 'Visible en formato'
              : 'No visible en formato'}
          </p>
        </div>
      </div>
    </div>
  )
}