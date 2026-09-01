/**
 * @fileoverview Generador server-side del PDF validado de Examen Médico
 * consolidado AMI. Reutiliza `buildExamSummary`, los snapshots existentes
 * (`MedicalExam.physicalExamData`, `MedicalVerdict`, `ClinicalHistory`,
 * `Worker`) y los slots por prueba.
 *
 * @id IMPL-FEATURE-20260825-03
 * @backup context/SPECs/SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md
 * @adr context/decisions/ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md
 *
 * Patrón (paralelo a `espirometry-pdf.tsx` y `audiometry-pdf.tsx`):
 *   - Toma los datos del Event + `MedicalExam` + `MedicalVerdict` + perfil
 *     clínico + identidad congelada del médico (`validatorSnapshot*`).
 *   - El resumen ejecutivo de 9 campos se construye con `buildExamSummary`
 *     (helper ya existente en `lib/clinical/exam-summary.ts`).
 *   - Las recomendaciones se construyen desde `buildRecommendationsFromExam`
 *     (helper ya existente en `lib/clinical/recommendations.ts`).
 *   - Los hallazgos extraídos desde la exploración física y los estudios se
 *     cruzan con `extractHallazgos` para alimentar `buildRecommendations`.
 *   - NO se decide aptitud automáticamente. La aptitud, impresión,
 *     restricciones y observaciones se leen de la decisión médica explícita
 *     persistida en `MedicalVerdict` y/o `physicalExamData.aptitud`.
 *   - Renderiza `<ExamenMedicoValidatedPDF>` con `@react-pdf/renderer`.
 *   - Persiste el PDF a disco en `uploads/examen-medico-pdfs/<eventId>.pdf`
 *     y devuelve URL relativa + hash SHA-256 + bytes para que la API route
 *     los sirva desde disco o regenere en línea.
 *
 * Guardrails respetados (ADR §reglas):
 *   - R2: NO duplica captura — los campos vienen del perfil clínico +
 *     Event + `physicalExamData` + slots por prueba.
 *   - R3: cada estudio conserva su dictamen independiente (slot). El
 *     Examen Médico genera el consolidado, no reemplaza los slots.
 *   - R4: aptitud NUNCA se calcula automáticamente. Se respeta la decisión
 *     explícita del médico autenticado.
 *   - R5: IA sólo apoya; no firma ni decide aptitud. El PDF refleja la
 *     decisión humana validada.
 *   - R6: el PDF sólo se genera con revisión/aptitud válida y médico
 *     autenticado (gate implementado en `route.tsx`).
 *   - R7: descarga protegida por Event/paciente y autorización de sesión.
 *   - R8: datos faltantes generan estado visible (`—`) — nunca defaults
 *     silenciosos.
 *
 * Privacidad:
 *   - El PDF incluye datos clínicos del paciente (PII). La URL del archivo
 *     generado NO se expone públicamente; sólo se sirve por la API route
 *     autenticada `/api/pdf/examen-medico/[eventId]` (control de acceso
 *     aplicado en el handler, fuera de este helper). La ruta legacy
 *     `/api/pdf/[eventId]` sirve el dictamen reducido (también autenticada
 *     desde FND-20260825-18 / P1-2) y se mantiene para consumo del portal
 *     corporativo.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { renderToBuffer } from '@react-pdf/renderer'
import { ExamenMedicoValidatedPDF } from '@/components/pdf/ExamenMedicoValidatedPDF'
import type { ExamenMedicoPDFData } from '@/components/pdf/ExamenMedicoValidatedPDF'
import { buildExamSummary, type ExamSnapshot } from '@/lib/clinical/exam-summary'
import {
  buildRecommendationsFromExam,
  type ExamForHallazgos,
  type IaResultsForHallazgos,
} from '@/lib/clinical/recommendations'
import { formatQuisteDisplay } from '@/schemas/clinical/exam.schema'

// Reutiliza el cache del logo AMI (una descarga por proceso). Si la red
// falla al boot, el logo queda null y el PDF cae al fallback "AMI".
export { resolveAmiLogoDataUrl } from '@/lib/espirometry-pdf'

const REPO_UPLOAD_DIR = path.join(process.cwd(), '..', 'uploads')

// ──────────────────────────────────────────────────────────────────────────
// Helpers puros — testeables y reutilizables desde la API route
// ──────────────────────────────────────────────────────────────────────────

/** String seguro para PDF: convierte null/undefined a '' y trim. */
function s(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

/** Formato seguro para una edad (años o '' si ausente). */
function edadFromFechaNacimiento(
  dob: Date | string | null | undefined
): string {
  if (!dob) return ''
  const d = typeof dob === 'string' ? new Date(dob) : dob
  if (Number.isNaN(d.getTime())) return ''
  const diff = Date.now() - d.getTime()
  const years = Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000))
  if (years < 0 || years > 130) return ''
  return String(years)
}

/** Formato seguro para fecha (dd/mm/yyyy) o '' si ausente. */
function fechaFromDate(
  d: Date | string | null | undefined
): string {
  if (!d) return ''
  const date = typeof d === 'string' ? new Date(d) : d
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** Une una lista de pares `key/value` no vacíos en un texto multilinea. */
function joinPairs(
  pairs: Array<[string, string | null | undefined]>,
  joiner = '; '
): string {
  const out: string[] = []
  for (const [k, v] of pairs) {
    const val = s(v)
    if (val.length > 0) out.push(`${k}: ${val}`)
  }
  return out.join(joiner)
}

// ──────────────────────────────────────────────────────────────────────────
// Tipos de entrada — los datos crudos que el caller (API route) resuelve
// desde Prisma. Concentrar aquí la preparación evita que la route duplique
// queries y mantiene la función pura y testeable.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Forma mínima del `Worker` + `ClinicalHistory.data` que necesita el helper.
 * Construido por la API route a partir de Prisma.
 */
export interface BuildExamenMedicoPdfWorkerInput {
  firstName: string
  lastName: string
  universalId: string
  dob?: Date | string | null
  /** `M` | `F` u otro string libre. */
  sexo?: string | null
  /** Identidad de género declarada por el paciente (string libre). */
  identidadGenero?: string | null
  /** Empresa + puesto + área + tipo de examen desde la papeleta/Event. */
  empresa?: string | null
  puesto?: string | null
  area?: string | null
  tipoExamen?: string | null
  /** Dirección del paciente (snapshot longitudinal o portal). */
  direccion?: string | null
  /** Estado civil (snapshot longitudinal). */
  estadoCivil?: string | null
  /** Escolaridad (snapshot longitudinal). */
  escolaridad?: string | null
  /** Tipo sanguíneo (snapshot APNP). */
  tipoSanguineo?: string | null
}

/** Historia ocupacional consolidada para la sección I. */
export interface BuildExamenMedicoPdfHistoriaOcupacionalInput {
  empresa?: string | null
  puesto?: string | null
  area?: string | null
  /** Texto narrativo de historia ocupacional (exposiciones previas). */
  narrativa?: string | null
  /** Riesgos de trabajo (matriz 1-5+A). */
  riesgos?: string | null
  /** EPP usado. */
  epp?: string | null
}

/** Resumen de hallazgos clínicos (APP) para la sección II. */
export interface BuildExamenMedicoPdfAppInput {
  /** Texto libre consolidado del APP (33+ acordeones). */
  texto?: string | null
}

/** Resultado de estudios IA para alimentar `detectHallazgosFromIa`. */
export interface BuildExamenMedicoPdfIaInputs {
  audiometriaClasificacion?: string | null
  espirometriaPatron?: string | null
  radiografiaHallazgo?: string | null
  laboratorioOutOfRange?: boolean | null
}

export interface BuildExamenMedicoPdfInput {
  folio: string
  signedAt: Date
  status: ExamenMedicoPDFData['status']
  worker: BuildExamenMedicoPdfWorkerInput
  ahf: {
    diabetes?: string | null
    hipertension?: string | null
    epilepsia?: string | null
    cardiopatia?: string | null
    renales?: string | null
    asma?: string | null
    cancer?: string | null
    mentales?: string | null
    otras?: string | null
  }
  apnp: {
    alcohol?: string | null
    tabaco?: string | null
    drogas?: string | null
    ejercicio?: string | null
    alimentacion?: string | null
    tratamientoMedicoActual?: string | null
    tatuajes?: string | null
  }
  historiaOcupacional: BuildExamenMedicoPdfHistoriaOcupacionalInput
  app: BuildExamenMedicoPdfAppInput
  historiaGineco?: string | null
  inmunizaciones?: string | null
  somatometria: {
    peso?: string | null
    talla?: string | null
    imc?: string | null
    cintura?: string | null
    cadera?: string | null
    ta?: string | null
    fc?: string | null
    fr?: string | null
    temperatura?: string | null
  }
  agudezaVisual: {
    visionLejanaOD?: string | null
    visionLejanaOI?: string | null
    visionCercanaOD?: string | null
    visionCercanaOI?: string | null
    lejanaCorregidaOD?: string | null
    lejanaCorregidaOI?: string | null
    cercanaCorregidaOD?: string | null
    cercanaCorregidaOI?: string | null
    reflejos?: string | null
    ishihara?: string | null
    campimetria?: string | null
  }
  exploracion: {
    neurologico?: string | null
    cabeza?: string | null
    piel_y_faneras?: string | null
    oidos_cad?: string | null
    oidos_cai?: string | null
    ojos?: string | null
    boca_estado?: string | null
    boca_alineacion?: string | null
    nariz?: string | null
    faringe?: string | null
    cuello?: string | null
    torax?: string | null
    corazon?: string | null
    campos_pulmonares?: string | null
    abdomen?: string | null
    genitourinario?: string | null
    columna_vertebral?: string | null
    test_adam?: string | null
    ms_superiores?: string | null
    fuerza_muscular_daniels_sup?: string | null
    ms_inferiores?: string | null
    fuerza_muscular_daniels_inf?: string | null
    circulacion_venosa?: string | null
    arco_de_movilidad?: string | null
    tono_muscular?: string | null
    coordinacion?: string | null
    test_romberg?: string | null
    signo_bragard?: string | null
    prueba_finkelstein?: string | null
    signo_tinel?: string | null
    prueba_phanel?: string | null
    prueba_lasegue?: string | null
    presencia_quiste_sinovial?: string | null
    especificar_quiste?: string | null
  }
  /** Texto de impresión diagnóstica validada por el médico (no auto). */
  impresionDiagnostica: string
  /** Aptitud (decisión explícita del médico). */
  aptitud: string
  restricciones: string
  observacionesFinales: string
  notaCondicionamiento?: string | null
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
  }
  /** Slots por prueba persistidos en `physicalExamData`. */
  slots: {
    audiometria?: string | null
    espirometria?: string | null
    laboratorios?: string | null
    radiografia?: string | null
    examenMedico?: string | null
  }
  /** Resultados IA opcionales para alimentar las recomendaciones. */
  ia?: BuildExamenMedicoPdfIaInputs | null
  logoDataUrl: string | null
  /**
   * IMPL-20260826-08 (FND-20260826-03 / DEC-20260826-01 / BR-20260826-01):
   * Bloque consolidado por atención/cita. Lista los Events hermanos del
   * mismo `appointmentId + workerId` (incluyendo el actual, marcado como
   * `isCurrent=true`) con sus estudios y labs. Si se omite, el renderer
   * conserva el comportamiento legacy (un único Event).
   *
   * NO inventa hallazgos: cada bloque sólo refleja el snapshot del Event
   * correspondiente (studies + labs con status APLICADO/PENDIENTE).
   */
  consolidatedEvents?: Array<{
    eventId: string
    eventShortId: string
    isCurrent: boolean
    studies: Array<{
      serviceName: string
      extractedData: unknown | null
    }>
    labs: Array<{
      serviceName: string
      extractedData: unknown | null
    }>
  }>
}

// ──────────────────────────────────────────────────────────────────────────
// Builder principal
// ──────────────────────────────────────────────────────────────────────────

/**
 * Construye el payload completo para el PDF a partir de los datos crudos.
 *
 * Concentra:
 *   - Construcción del resumen ejecutivo de 9 campos (`buildExamSummary`).
 *   - Generación de recomendaciones auto-pobladas
 *     (`buildRecommendationsFromExam`) usando hallazgos del examen + IA.
 *   - Mapeo a la estructura de 4 secciones del PDF AMI.
 *
 * Importante: este builder es PURO y testeable. NO toca Prisma ni hace IO.
 */
export function buildExamenMedicoPdfData(
  input: BuildExamenMedicoPdfInput
): ExamenMedicoPDFData {
  // 1. Resumen ejecutivo de 9 campos
  const examSnapshot: ExamSnapshot = {
    estado_nutricional: input.somatometria?.imc
      ? deriveEstadoNutricionalFromImc(input.somatometria.imc)
      : null,
    agudeza_visual_resumen: deriveAgudezaVisualResumen(
      input.agudezaVisual?.visionLejanaOD,
      input.agudezaVisual?.visionLejanaOI
    ),
    salud_bucal: input.exploracion?.boca_estado ?? null,
    presion_arterial_resumen: derivePresionArterialResumen(
      input.somatometria?.ta
    ),
    examen_medico_texto: input.slots?.examenMedico ?? null,
    impresion_diagnostica: input.impresionDiagnostica ?? null,
    audiometria_texto: input.slots?.audiometria ?? null,
    espirometria_texto: input.slots?.espirometria ?? null,
    laboratorios_texto: input.slots?.laboratorios ?? null,
    radiografia_texto: input.slots?.radiografia ?? null,
  }
  const iaResults = input.ia
    ? {
        audiometria_resumen: input.ia.audiometriaClasificacion ?? null,
        espirometria_resumen: input.ia.espirometriaPatron ?? null,
      }
    : null
  const summary = buildExamSummary(examSnapshot, iaResults)

  // 2. Recomendaciones auto-pobladas
  const hallazgosExam: ExamForHallazgos = {
    estado_nutricional: examSnapshot.estado_nutricional,
    agudeza_visual_resumen: examSnapshot.agudeza_visual_resumen,
    salud_bucal: examSnapshot.salud_bucal,
    presion_arterial_resumen: examSnapshot.presion_arterial_resumen,
    examen_medico_texto: input.slots?.examenMedico ?? null,
    exploracion: {
      circulacion_venosa: input.exploracion?.circulacion_venosa ?? null,
    },
  }
  const hallazgosIa: IaResultsForHallazgos = {
    audiometria_clasificacion: input.ia?.audiometriaClasificacion ?? null,
    espirometria_patron: input.ia?.espirometriaPatron ?? null,
    radiografia_hallazgo: input.ia?.radiografiaHallazgo ?? null,
    laboratorio_out_of_range: input.ia?.laboratorioOutOfRange ?? null,
  }
  const recomendacionesTexto = buildRecommendationsFromExam(
    hallazgosExam,
    hallazgosIa
  )
  // `buildRecommendations` devuelve `1.- ... 2.- ...`; el PDF las itera
  // individualmente, así que partimos por el patrón numerado canónico.
  const recomendaciones = recomendacionesTexto
    .split(/\s*\d+\.\-\s+/)
    .map(r => r.trim())
    .filter(r => r.length > 0)

  // 3. Paciente (sección I)
  const paciente = {
    nombreCompleto: `${s(input.worker.firstName)} ${s(input.worker.lastName)}`.trim() || '—',
    fechaNacimiento: fechaFromDate(input.worker.dob ?? null) || null,
    edad: edadFromFechaNacimiento(input.worker.dob ?? null) || null,
    sexo: s(input.worker.sexo) || null,
    identidadGenero: s(input.worker.identidadGenero) || null,
    estadoCivil: s(input.worker.estadoCivil) || null,
    escolaridad: s(input.worker.escolaridad) || null,
    direccion: s(input.worker.direccion) || null,
    tipoSanguineo: s(input.worker.tipoSanguineo) || null,
    empresa: s(input.historiaOcupacional?.empresa ?? input.worker.empresa) || null,
    puesto: s(input.historiaOcupacional?.puesto ?? input.worker.puesto) || null,
    area: s(input.historiaOcupacional?.area ?? input.worker.area) || null,
    tipoExamen: s(input.worker.tipoExamen) || null,
    historiaOcupacional:
      s(input.historiaOcupacional?.narrativa) || null,
    riesgosTrabajo: s(input.historiaOcupacional?.riesgos) || null,
    epp: s(input.historiaOcupacional?.epp) || null,
  }

  return {
    folio: input.folio,
    signedAt: input.signedAt,
    status: input.status,
    paciente,
    ahf: {
      diabetes: s(input.ahf.diabetes) || null,
      hipertension: s(input.ahf.hipertension) || null,
      epilepsia: s(input.ahf.epilepsia) || null,
      cardiopatia: s(input.ahf.cardiopatia) || null,
      renales: s(input.ahf.renales) || null,
      asma: s(input.ahf.asma) || null,
      cancer: s(input.ahf.cancer) || null,
      mentales: s(input.ahf.mentales) || null,
      otras: s(input.ahf.otras) || null,
    },
    apnp: {
      alcohol: s(input.apnp.alcohol) || null,
      tabaco: s(input.apnp.tabaco) || null,
      drogas: s(input.apnp.drogas) || null,
      ejercicio: s(input.apnp.ejercicio) || null,
      alimentacion: s(input.apnp.alimentacion) || null,
      tratamientoMedicoActual: s(input.apnp.tratamientoMedicoActual) || null,
      tatuajes: s(input.apnp.tatuajes) || null,
    },
    app: s(input.app?.texto) || '',
    historiaGineco: s(input.historiaGineco) || null,
    inmunizaciones: s(input.inmunizaciones) || null,
    somatometria: {
      peso: s(input.somatometria?.peso) || null,
      talla: s(input.somatometria?.talla) || null,
      imc: s(input.somatometria?.imc) || null,
      cintura: s(input.somatometria?.cintura) || null,
      cadera: s(input.somatometria?.cadera) || null,
      ta: s(input.somatometria?.ta) || null,
      fc: s(input.somatometria?.fc) || null,
      fr: s(input.somatometria?.fr) || null,
      temperatura: s(input.somatometria?.temperatura) || null,
    },
    agudezaVisual: {
      visionLejanaOD: s(input.agudezaVisual?.visionLejanaOD) || null,
      visionLejanaOI: s(input.agudezaVisual?.visionLejanaOI) || null,
      visionCercanaOD: s(input.agudezaVisual?.visionCercanaOD) || null,
      visionCercanaOI: s(input.agudezaVisual?.visionCercanaOI) || null,
      lejanaCorregidaOD: s(input.agudezaVisual?.lejanaCorregidaOD) || null,
      lejanaCorregidaOI: s(input.agudezaVisual?.lejanaCorregidaOI) || null,
      cercanaCorregidaOD: s(input.agudezaVisual?.cercanaCorregidaOD) || null,
      cercanaCorregidaOI: s(input.agudezaVisual?.cercanaCorregidaOI) || null,
      reflejos: s(input.agudezaVisual?.reflejos) || null,
      ishihara: s(input.agudezaVisual?.ishihara) || null,
      campimetria: s(input.agudezaVisual?.campimetria) || null,
    },
    exploracion: {
      neurologico: s(input.exploracion?.neurologico) || null,
      cabeza: s(input.exploracion?.cabeza) || null,
      piel_y_faneras: s(input.exploracion?.piel_y_faneras) || null,
      oidos_cad: s(input.exploracion?.oidos_cad) || null,
      oidos_cai: s(input.exploracion?.oidos_cai) || null,
      ojos: s(input.exploracion?.ojos) || null,
      boca_estado: s(input.exploracion?.boca_estado) || null,
      boca_alineacion: s(input.exploracion?.boca_alineacion) || null,
      nariz: s(input.exploracion?.nariz) || null,
      faringe: s(input.exploracion?.faringe) || null,
      cuello: s(input.exploracion?.cuello) || null,
      torax: s(input.exploracion?.torax) || null,
      corazon: s(input.exploracion?.corazon) || null,
      campos_pulmonares: s(input.exploracion?.campos_pulmonares) || null,
      abdomen: s(input.exploracion?.abdomen) || null,
      genitourinario: s(input.exploracion?.genitourinario) || null,
      columna_vertebral: s(input.exploracion?.columna_vertebral) || null,
      test_adam: s(input.exploracion?.test_adam) || null,
      ms_superiores: s(input.exploracion?.ms_superiores) || null,
      fuerza_muscular_daniels_sup:
        s(input.exploracion?.fuerza_muscular_daniels_sup) || null,
      ms_inferiores: s(input.exploracion?.ms_inferiores) || null,
      fuerza_muscular_daniels_inf:
        s(input.exploracion?.fuerza_muscular_daniels_inf) || null,
      circulacion_venosa: s(input.exploracion?.circulacion_venosa) || null,
      arco_de_movilidad: s(input.exploracion?.arco_de_movilidad) || null,
      tono_muscular: s(input.exploracion?.tono_muscular) || null,
      coordinacion: s(input.exploracion?.coordinacion) || null,
      test_romberg: s(input.exploracion?.test_romberg) || null,
      signo_bragard: s(input.exploracion?.signo_bragard) || null,
      prueba_finkelstein: s(input.exploracion?.prueba_finkelstein) || null,
      signo_tinel: s(input.exploracion?.signo_tinel) || null,
      prueba_phanel: s(input.exploracion?.prueba_phanel) || null,
      prueba_lasegue: s(input.exploracion?.prueba_lasegue) || null,
      presencia_quiste_sinovial: formatQuisteDisplay({
        presencia_quiste_sinovial: input.exploracion?.presencia_quiste_sinovial,
        especificar_quiste: input.exploracion?.especificar_quiste,
      }) || null,
    },
    pruebasMusculo: {
      arcoMovilidad: s(input.exploracion?.arco_de_movilidad) || null,
      tonoMuscular: s(input.exploracion?.tono_muscular) || null,
      coordinacion: s(input.exploracion?.coordinacion) || null,
      testAdam: s(input.exploracion?.test_adam) || null,
      testRomberg: s(input.exploracion?.test_romberg) || null,
      bragard: s(input.exploracion?.signo_bragard) || null,
      finkelstein: s(input.exploracion?.prueba_finkelstein) || null,
      tinel: s(input.exploracion?.signo_tinel) || null,
      phanel: s(input.exploracion?.prueba_phanel) || null,
      lasegue: s(input.exploracion?.prueba_lasegue) || null,
      quisteSinovial: formatQuisteDisplay({
        presencia_quiste_sinovial: input.exploracion?.presencia_quiste_sinovial,
        especificar_quiste: input.exploracion?.especificar_quiste,
      }) || null,
    },
    impresionDiagnostica: s(input.impresionDiagnostica) || '',
    aptitud: s(input.aptitud) || '',
    restricciones: s(input.restricciones) || '',
    observacionesFinales: s(input.observacionesFinales) || '',
    recomendaciones,
    notaCondicionamiento: s(input.notaCondicionamiento) || null,
    medico: input.medico,
    summary,
    slots: {
      audiometria: s(input.slots?.audiometria) || null,
      espirometria: s(input.slots?.espirometria) || null,
      laboratorios: s(input.slots?.laboratorios) || null,
      radiografia: s(input.slots?.radiografia) || null,
      examenMedico: s(input.slots?.examenMedico) || null,
    },
    logoUrl: input.logoDataUrl ?? '',
    // IMPL-20260826-08: pasamos consolidado al output tal cual (el renderer
    // lo pinta o lo omite según presente). NO se aplica ninguna transformación.
    consolidatedEvents: input.consolidatedEvents ?? [],
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Derivadores ligeros (visibles, no inventan)
// ──────────────────────────────────────────────────────────────────────────

/**
 * IMC → estado nutricional (espejo de la lógica del formulario).
 * Devuelve string vacío si no se puede derivar (visibles, no defaults).
 */
function deriveEstadoNutricionalFromImc(imc: string | null | undefined): string {
  const n = parseFloat(s(imc))
  if (!Number.isFinite(n) || n <= 0) return ''
  if (n < 18.5) return 'BAJO PESO'
  if (n < 25) return 'NORMAL'
  if (n < 30) return 'SOBREPESO'
  return 'OBESIDAD'
}

/**
 * Visión lejana OD/OI → resumen canónico del PDF. Si ambas son `20/20` o
 * `20/25`, marca como `NORMAL`; si alguna es `20/40` o peor, marca como
 * `DISMINUIDA`; si no se puede determinar, devuelve '' (visible).
 */
function deriveAgudezaVisualResumen(
  od: string | null | undefined,
  oi: string | null | undefined
): string {
  const sv = (v: string | null | undefined): number | null => {
    const t = s(v)
    if (!t) return null
    const m = t.match(/^20\/(\d+)$/)
    if (!m) return null
    return parseInt(m[1], 10)
  }
  const a = sv(od)
  const b = sv(oi)
  if (a === null && b === null) return ''
  // Conservador: si alguno está peor que 20/30 → DISMINUIDA.
  const worst = Math.max(a ?? 30, b ?? 30)
  if (worst > 30) return 'DISMINUIDA'
  if (worst <= 25) return 'NORMAL'
  return 'BAJA AL MOMENTO DE LA TOMA'
}

/**
 * TA `120/80` → `NORMAL AL MOMENTO DE LA TOMA` / `ALTA` / `BAJA`.
 * Conservador: si sistólica ≥140 o diastólica ≥90 → ALTA. Si sistólica
 * ≤90 o diastólica ≤60 → BAJA. En cualquier otro caso (incluyendo
 * ausentes), devuelve ''.
 */
function derivePresionArterialResumen(ta: string | null | undefined): string {
  const t = s(ta)
  if (!t) return ''
  const m = t.match(/^(\d+)\s*\/\s*(\d+)/)
  if (!m) return ''
  const sist = parseInt(m[1], 10)
  const diast = parseInt(m[2], 10)
  if (!Number.isFinite(sist) || !Number.isFinite(diast)) return ''
  if (sist >= 140 || diast >= 90) return 'ALTA'
  if (sist <= 90 || diast <= 60) return 'BAJA'
  return 'NORMAL AL MOMENTO DE LA TOMA'
}

// ──────────────────────────────────────────────────────────────────────────
// Generador de PDF + persistencia
// ──────────────────────────────────────────────────────────────────────────

export interface GenerateExamenMedicoPdfResult {
  buffer: Buffer
  hash: string
  url: string | null
  absolutePath: string | null
}

export interface GenerateExamenMedicoPdfInput {
  data: ExamenMedicoPDFData
  eventId: string
}

/**
 * Genera el PDF validado del Examen Médico consolidado AMI.
 * Devuelve buffer + hash + url relativa (si la persistencia en disco
 * fue exitosa). Lanza excepción si la renderización falla; el caller
 * decide qué hacer (regenerar, persistir error, etc.).
 */
export async function generateExamenMedicoValidatedPdf(
  input: GenerateExamenMedicoPdfInput
): Promise<GenerateExamenMedicoPdfResult> {
  const buffer = await renderToBuffer(
    <ExamenMedicoValidatedPDF data={input.data} />
  )
  const hash = `sha256:${createHash('sha256').update(buffer).digest('hex')}`

  let url: string | null = null
  let absolutePath: string | null = null
  try {
    const dir = path.join(REPO_UPLOAD_DIR, 'examen-medico-pdfs')
    await mkdir(dir, { recursive: true })
    absolutePath = path.join(dir, `${input.eventId}.pdf`)
    await writeFile(absolutePath, buffer)
    url = `examen-medico-pdfs/${input.eventId}.pdf`
  } catch (err) {
    console.warn(
      '[IMPL-FEATURE-20260825-03] No se pudo persistir PDF validado de examen médico en disco:',
      err instanceof Error ? err.message : err
    )
  }

  return { buffer, hash, url, absolutePath }
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers exportados para tests V1
// ──────────────────────────────────────────────────────────────────────────

export const __test__ = {
  s,
  edadFromFechaNacimiento,
  fechaFromDate,
  joinPairs,
  deriveEstadoNutricionalFromImc,
  deriveAgudezaVisualResumen,
  derivePresionArterialResumen,
}