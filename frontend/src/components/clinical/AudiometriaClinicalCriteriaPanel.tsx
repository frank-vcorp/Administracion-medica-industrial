/**
 * @fileoverview Panel clínico de Audiometría que el médico ve en la papeleta.
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 *
 * La vista muestra sólo tres datos, en modo oración:
 *   - Índice de Fletcher.
 *   - Estado bilateral.
 *   - Completitud documental.
 *
 * El cálculo interno sigue usando las frecuencias y el PTA3
 * `(TA500 + TA1000 + TA2000) / 3` porque Fletcher y el estado bilateral
 * dependen de ellos. Esa captura (tabla TA/VO, PTA calculado, PTA fuente,
 * sustitución, entradas TA y las capas NOM/SME/fuente/derivada) no se
 * renderiza.
 *
 * Índice de Fletcher: a partir de los dos PTA3 completos, oído menos
 * afectado = menor dB HL, oído más afectado = mayor dB HL:
 * `((PTA_menor × 7) + (PTA_mayor × 1)) / 8`. Si falta PTA3 en algún oído,
 * no se calcula (no se interpola).
 *
 * Criterio AMI (interno, alimenta el estado bilateral): combina PTA3 y
 * patrón por grupos (DEC-20260825-03); ≤25 dB en PTA3 no fuerza NORMAL si
 * hay patrón patológico.
 */
import { normalizeAudiometriaSnapshot } from '@/lib/normalize-audiometria-snapshot'

// ──────────────────────────────────────────────────────────────────────────
// Tipos públicos y constantes
// ──────────────────────────────────────────────────────────────────────────

/** Umbral de normalidad audiométrica AMI (BR-20260825-04 / DEC-20260825-05). */
export const AMI_NORMALIDAD_DB = 25

/** Huecos sin clasificación explícita en escala AMI (BR-20260825-04). */
export const AMI_HUECOS_DB: ReadonlyArray<readonly [number, number]> = [
  [41, 44],
  [56, 59],
  [71, 74],
  [91, 94],
] as const

/**
 * Frecuencias canónicas de PTA3 (BR-20260825-04). Graves 250/500/1000;
 * agudas 2000/3000/4000/6000/8000. `1000` es frontera y NO se duplica.
 */
export const PTA3_FREQUENCIES_HZ = [500, 1000, 2000] as const

/** Frecuencias graves y agudas para el patrón audiométrico. */
export const FRECUENCIAS_GRAVES_HZ = [250, 500, 1000] as const
export const FRECUENCIAS_AGUDAS_HZ = [2000, 3000, 4000, 6000, 8000] as const

// ──────────────────────────────────────────────────────────────────────────
// FND-20260825-12 — Referencia del programa audiométrico SME.
//
// Estas constantes representan la TABLA DE REFERENCIA del criterio
// audiométrico AMI (BR-20260825-04 / DEC-20260825-05). NO son resultados
// derivados del paciente. El cálculo interno las usa; el panel que ve
// el médico no las renderiza.
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
// REGLA: estas constantes no convierten la referencia en diagnóstico.
// El estado bilateral se calcula aparte. La tabla no se muestra en el
// panel del médico.
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
  readonly indiceFletcher: IndiceFletcherResultado
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

export type IndiceFletcherResultado = {
  valor: number | null
  completo: boolean
  /** Menor PTA3 (dB HL) = oído menos afectado. */
  oidoMenosAfectado: 'OD' | 'OI' | null
  /** Mayor PTA3 (dB HL) = oído más afectado. */
  oidoMasAfectado: 'OD' | 'OI' | null
  ptaMenor: number | null
  ptaMayor: number | null
}

/**
 * Índice de Fletcher (audiometría): media ponderada bilateral usando los
 * PTA3 por oído. Oído **menos afectado** = menor umbral en dB HL; **más
 * afectado** = mayor dB HL.
 * Fórmula: `((PTA_menor × 7) + (PTA_mayor × 1)) / 8`.
 * Si empatan, el resultado es el mismo PTA y se etiqueta OD como menor y OI
 * como mayor solo para mostrar la sustitución (la expresión es simétrica).
 */
export function umbralEnHuecoAmi(db: number): boolean {
  return AMI_HUECOS_DB.some(([lo, hi]) => db >= lo && db <= hi)
}

/**
 * Combina patrón por grupos de frecuencia y PTA3 (DEC-20260825-03, BR-20260825-04,
 * SPEC-FEATURE-20260825-02 §4.3, SPEC_ARCH-20260518-15 §7.4). No fuerza NORMAL
 * sólo porque PTA3 ≤ 25 si el patrón operativo indica compromiso.
 */
export function resolverCriterioAmiCombinado(
  pta: { promedio: number | null; completo: boolean },
  patronAmi: OidoInterpretacion['patronAmi'],
  umbralesVa: number[],
): OidoInterpretacion['criterioAmi'] {
  if (umbralesVa.some((db) => umbralEnHuecoAmi(db))) {
    return 'NO_CONCLUYENTE'
  }

  const patronPatologico =
    patronAmi === 'GRAVES' || patronAmi === 'AGUDAS' || patronAmi === 'MIXTA'

  if (!pta.completo || pta.promedio === null) {
    if (patronPatologico) return 'ALTERADO'
    if (patronAmi === 'NO_CONCLUYENTE') {
      if (umbralesVa.length > 0 && Math.max(...umbralesVa) > AMI_NORMALIDAD_DB) {
        return 'ALTERADO'
      }
      return 'NO_CONCLUYENTE'
    }
    return 'NO_CONCLUYENTE'
  }

  const ptaAlterado = pta.promedio > AMI_NORMALIDAD_DB

  if (patronAmi === 'NO_CONCLUYENTE') {
    if (ptaAlterado) return 'ALTERADO'
    if (umbralesVa.length > 0 && Math.max(...umbralesVa) > AMI_NORMALIDAD_DB) {
      return 'ALTERADO'
    }
    return 'NO_CONCLUYENTE'
  }

  if (patronPatologico || ptaAlterado) return 'ALTERADO'
  return 'NORMAL'
}

export function calcularIndiceFletcher(
  ptaOd: number | null,
  ptaOi: number | null,
): IndiceFletcherResultado {
  if (ptaOd === null || ptaOi === null) {
    return {
      valor: null,
      completo: false,
      oidoMenosAfectado: null,
      oidoMasAfectado: null,
      ptaMenor: null,
      ptaMayor: null,
    }
  }
  let oidoMenosAfectado: 'OD' | 'OI'
  let oidoMasAfectado: 'OD' | 'OI'
  let ptaMenor: number
  let ptaMayor: number
  if (ptaOd < ptaOi) {
    oidoMenosAfectado = 'OD'
    oidoMasAfectado = 'OI'
    ptaMenor = ptaOd
    ptaMayor = ptaOi
  } else if (ptaOi < ptaOd) {
    oidoMenosAfectado = 'OI'
    oidoMasAfectado = 'OD'
    ptaMenor = ptaOi
    ptaMayor = ptaOd
  } else {
    oidoMenosAfectado = 'OD'
    oidoMasAfectado = 'OI'
    ptaMenor = ptaOd
    ptaMayor = ptaOi
  }
  const valor = Math.round(((ptaMenor * 7 + ptaMayor * 1) / 8) * 10) / 10
  return {
    valor,
    completo: true,
    oidoMenosAfectado,
    oidoMasAfectado,
    ptaMenor,
    ptaMayor,
  }
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
  const data = normalizeAudiometriaSnapshot(
    (extractedData ?? {}) as Record<string, unknown>,
  )
  const od = readOido(data, 'oido_derecho')
  const oi = readOido(data, 'oido_izquierdo')

  const ptaOd = calcularPTA3(od.va)
  const ptaOi = calcularPTA3(oi.va)
  const indiceFletcher = calcularIndiceFletcher(ptaOd.promedio, ptaOi.promedio)

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
  if (!indiceFletcher.completo) {
    advertencias.push(
      'Índice de Fletcher: no calculable hasta tener PTA3 completo en ambos oídos.',
    )
  }

  function interpretarOido(
    side: 'OD' | 'OI',
    pta: { promedio: number | null; completo: boolean; valores: Record<500 | 1000 | 2000, number | null> },
    oido: { va: Record<number, number>; ptaVisible: number | null },
  ): OidoInterpretacion {
    const patron = clasificarPatron(oido.va, pta.completo, pta.promedio)
    const umbralesVa = Object.values(oido.va).filter(
      (v): v is number => typeof v === 'number' && Number.isFinite(v),
    )
    const criterioAmi = resolverCriterioAmiCombinado(pta, patron, umbralesVa)
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
      'Al menos un oído no es concluyente para clasificación audiométrica (faltan TA500/TA1000/TA2000 o patrón incompleto).'
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
    indiceFletcher,
    bilateral: { estado: bilateralEstado, nota: bilateralNota },
    completitudDocumental: completitud,
    frecuenciasDetectadas,
    advertencias,
  }
}

function resolvedAudiometriaHasRenderable(
  resolved: ResolvedAudiometriaCriteria,
): boolean {
  if (resolved.frecuenciasDetectadas.length > 0) return true
  return resolved.oidos.some((o) => o.ptaFuente !== null)
}

/**
 * Hay algo que mostrar en la papeleta (umbrales y/o PTA del documento).
 * Evita un panel vacío cuando el snapshot existe pero aún no trae extracción.
 */
export function hasRenderableAudiometriaCriteria(
  extractedData: Record<string, unknown> | null | undefined,
): boolean {
  if (!extractedData || typeof extractedData !== 'object') return false
  return resolvedAudiometriaHasRenderable(resolveAudiometriaCriteria(extractedData))
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
  if (!extractedData || typeof extractedData !== 'object') return null
  const resolved = resolveAudiometriaCriteria(extractedData)
  if (!resolvedAudiometriaHasRenderable(resolved)) return null

  return (
    <div
      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
      data-testid="audiometria-clinical-criteria-panel"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">🎧</span>
          <p className="text-sm font-semibold text-slate-700 tracking-normal">
            Criterios clínicos audiométricos
          </p>
        </div>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
          v{version}
        </span>
      </div>

      <FletcherCard indice={resolved.indiceFletcher} />

      <div
        className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
        data-testid="audiometria-estado-bilateral"
      >
        <p className="text-[11px] font-semibold text-slate-600 mb-1 tracking-normal">
          Estado bilateral
        </p>
        <p className="text-xs text-slate-700">{resolved.bilateral.nota}</p>
      </div>

      <div
        className="bg-white border border-slate-200 rounded-lg px-3 py-2"
        data-testid="audiometria-completitud-documental"
      >
        <p className="text-[11px] font-semibold text-slate-600 mb-1 tracking-normal">
          Completitud documental
        </p>
        <p className="text-xs text-slate-700">
          {resolved.completitudDocumental === 'suficiente' &&
            'Suficiente: hay al menos 6 frecuencias por oído.'}
          {resolved.completitudDocumental === 'parcial' &&
            'Parcial: hay entre 3 y 5 frecuencias por oído.'}
          {resolved.completitudDocumental === 'no_concluyente' &&
            'No concluyente: hay menos de 3 frecuencias.'}
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
    </div>
  )
}


function FletcherCard({ indice }: { indice: IndiceFletcherResultado }) {
  const { valor, completo } = indice
  return (
    <div
      className="bg-violet-50 border border-violet-200 rounded-lg p-3"
      data-testid="audiometria-fletcher-card"
    >
      <p className="text-xs font-semibold text-violet-900 tracking-normal">
        Índice de Fletcher
      </p>
      {!completo && (
        <p
          className="text-xs text-orange-700 mt-2"
          data-testid="audiometria-fletcher-incompleto"
        >
          No se puede calcular hasta tener los dos oídos completos.
        </p>
      )}
      {completo && valor !== null && (
        <p
          className="text-sm font-semibold text-violet-950 mt-2 tracking-normal"
          data-testid="audiometria-fletcher-valor"
        >
          {valor} dB HL
        </p>
      )}
    </div>
  )
}
