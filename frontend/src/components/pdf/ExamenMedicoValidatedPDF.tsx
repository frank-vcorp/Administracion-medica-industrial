/**
 * @fileoverview Plantilla PDF validada del Examen Médico consolidado (AMI,
 * 4 páginas/secciones). Reutiliza `buildExamSummary`, `MedicalVerdict`,
 * `physicalExamData`, los slots independientes por prueba y la identidad
 * congelada del médico (`validatorSnapshot*`).
 *
 * @id IMPL-FEATURE-20260825-03
 * @backup context/SPECs/SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md
 * @adr context/decisions/ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md
 *
 * Estructura AMI (SPEC §2, conservada como 4 bloques secuenciales):
 *   I.  Identificación e historia (paciente, empresa, puesto, AHF, APNP).
 *   II. Antecedentes y mediciones (APP, GO, inmunizaciones, somatometría,
 *       signos vitales, agudeza visual, reflejos, Ishihara, campimetría).
 *   III. Exploración (general, neurológica, cabeza/piel/oídos/ojos/boca/
 *        nariz/faringe/cuello/tórax/corazón/pulmones/abdomen/GU/columna/
 *        extremidades, pruebas musculoesqueléticas, impresión diagnóstica
 *        del médico).
 *   IV. Dictamen (aptitud, restricciones, observaciones, recomendaciones,
 *        nota de condicionamiento, médico/cédula/fecha/membrete/firma).
 *
 * Guardrails:
 *   - NO duplica captura: los campos se leen del perfil clínico + Event +
 *     `physicalExamData` + slots por prueba. Faltantes se renderizan como
 *     `—` (visibles, nunca defaults silenciosos).
 *   - Aptitud, impresión, restricciones y observaciones son DECISIÓN
 *     EXPLÍCITA del médico autenticado. El PDF usa la versión validada
 *     persistida en `MedicalVerdict` + `physicalExamData`. NO se
 *     auto-decidaptitud ni se firma sin médico autenticado.
 *   - Datos faltantes → visibles como `—` o `Pendiente`, NO se inventan.
 *   - El membrete AMI incluye logo remoto con fallback "AMI" si la red
 *     falla (mismo patrón de Espirometría/Audiometría validadas).
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { ExamenMedicoVariantAppendixPages } from '@/components/pdf/ExamenMedicoVariantAppendix'
import type { PatientIdentificationPdf } from '@/lib/pdf/patient-identification'
import { SME_LEGAL_NAME, SME_PDF_FOOTER } from '@/lib/brand-constants'

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0f172a',
  },
  // Membrete superior
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#0f766e',
    paddingBottom: 6,
  },
  headerLeft: { flexDirection: 'column' },
  brand: { fontSize: 14, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 7, color: '#475569' },
  headerRight: { alignItems: 'flex-end', width: 130 },
  logoImage: { width: 120, height: 44, objectFit: 'contain' },
  logoFallback: {
    width: 120,
    height: 44,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    textAlign: 'center',
    paddingTop: 13,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  // Títulos
  docTitle: { fontSize: 13, fontWeight: 'bold', marginBottom: 2, color: '#0f172a' },
  docSubtitle: { fontSize: 8, color: '#475569', marginBottom: 10 },
  // Secciones
  section: { marginBottom: 10 },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    padding: 4,
    marginBottom: 4,
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f766e',
    marginTop: 4,
    marginBottom: 2,
  },
  row: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 120, fontSize: 8, fontWeight: 'bold', color: '#475569' },
  value: { flex: 1, fontSize: 8, color: '#0f172a' },
  paragraph: { fontSize: 8, lineHeight: 1.4, color: '#0f172a', marginBottom: 3 },
  bulletItem: { fontSize: 8, marginLeft: 8, marginBottom: 1 },
  // Caja impresión / recomendaciones
  verdictBox: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 3,
    backgroundColor: '#f8fafc',
    marginBottom: 4,
  },
  // Firma
  signatureArea: { marginTop: 18, flexDirection: 'row', justifyContent: 'flex-end' },
  signatureBox: { width: 220, alignItems: 'center' },
  signatureImage: { width: 180, height: 60, objectFit: 'contain', marginBottom: 3 },
  signatureLine: {
    width: 180,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    marginBottom: 3,
  },
  signatureName: { fontSize: 9, fontWeight: 'bold', color: '#0f172a' },
  signatureLicense: { fontSize: 8, color: '#475569' },
  signatureDate: { fontSize: 7, color: '#94a3b8', marginTop: 1 },
  // Pie
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 6,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    lineHeight: 1.3,
  },
  // Bloque de resumen (4 columnas)
  grid2: { flexDirection: 'row', flexWrap: 'wrap' },
  gridCol: { width: '50%', paddingRight: 6 },
  // Tag para faltantes
  missing: { color: '#94a3b8', fontStyle: 'italic' },
})

// ─── Tipos públicos ───────────────────────────────────────────────────────────

/** Resumen ejecutivo de 9 campos (mismo tipo que `buildExamSummary`). */
export interface ExamSummaryForPdf {
  estado_nutricional: string
  agudeza_visual: string
  salud_bucal: string
  examen_medico: string
  presion_arterial: string
  audiometria: string
  espirometria: string
  laboratorios: string
  radiografia: string
}

export interface ExamenMedicoPDFData {
  /** Folio (id del verdict o review) */
  folio: string
  /** Fecha/hora de emisión del PDF */
  signedAt: string | Date
  /** Consentimiento informado firmado en check-in (recepción). */
  informedConsentSignedAt?: string | Date | null
  /** Estado de la revisión que origina este PDF (REVIEWED_ACCEPTED o
   *  REVIEWED_EDITED) o 'SIGNED' si viene del `MedicalVerdict.signedAt`. */
  status: 'SIGNED' | 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'

  /** Bloque estándar (mismos campos que PDFs por estudio). */
  patientIdentification: PatientIdentificationPdf

  // I. Identificación e historia
  paciente: {
    nombreCompleto: string
    fechaNacimiento?: string | null
    edad?: string | null
    sexo?: string | null
    identidadGenero?: string | null
    estadoCivil?: string | null
    escolaridad?: string | null
    direccion?: string | null
    tipoSanguineo?: string | null
    empresa?: string | null
    puesto?: string | null
    area?: string | null
    tipoExamen?: string | null
    historiaOcupacional?: string | null
    riesgosTrabajo?: string | null
    epp?: string | null
  }
  /** Antecedentes heredofamiliares (campos principales). */
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
  /** Antecedentes personales no patológicos + toxicomanías. */
  apnp: {
    alcohol?: string | null
    tabaco?: string | null
    drogas?: string | null
    ejercicio?: string | null
    alimentacion?: string | null
    tratamientoMedicoActual?: string | null
    tatuajes?: string | null
  }
  /** Snapshot no patológicos (prefill §8 Sodexo). */
  noPatologicos?: Record<string, unknown> | null

  // II. Antecedentes y mediciones
  app: string
  /** Snapshot estructurado APP (PatologicosSchema) para PDF Sodexo §5. */
  patologicos?: Record<string, unknown> | null
  /** Módulo 1 / vacunas para proyección PDF Sodexo §6 (solo lectura). */
  modulo1?: Record<string, unknown> | null
  /** Historia gineco-obstétrica cuando aplique (concatenación). */
  historiaGineco?: string | null
  /** Inmunizaciones (concatenación). */
  inmunizaciones?: string | null
  /** Somatometría / signos vitales (peso/talla/IMC/SpO2/TA/FC/FR/T). */
  somatometria: {
    peso?: string | null
    talla?: string | null
    imc?: string | null
    saturacionOxigeno?: string | null
    ta?: string | null
    fc?: string | null
    fr?: string | null
    temperatura?: string | null
  }
  /** Agudeza visual y pruebas complementarias. */
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

  // III. Exploración
  /** Exploración general/neurológica + cabeza/piel/oídos/ojos/boca/nariz/
   *  faringe/cuello/tórax/corazón/pulmones/abdomen/GU/columna/extremidades. */
  exploracion: Record<string, string | null | undefined>
  /** Pruebas musculoesqueléticas (combos ZIN). */
  pruebasMusculo: {
    arcoMovilidad?: string | null
    tonoMuscular?: string | null
    coordinacion?: string | null
    testAdam?: string | null
    testRomberg?: string | null
    bragard?: string | null
    finkelstein?: string | null
    tinel?: string | null
    phanel?: string | null
    lasegue?: string | null
    quisteSinovial?: string | null
  }
  /** Impresión diagnóstica del médico (validada). */
  impresionDiagnostica: string

  // IV. Dictamen
  aptitud: string
  restricciones: string
  observacionesFinales: string
  recomendaciones: string[]
  /** Nota de condicionamiento por estudios paraclínicos (cuando aplica). */
  notaCondicionamiento?: string | null
  /** Identidad congelada del médico (snapshot del perfil al firmar). */
  medico: {
    fullName: string
    professionalLicense: string
    /** Data-URL o URL servible por la app */
    signatureImageUrl: string
  }
  /** Resumen ejecutivo de 9 campos auto-poblado (referencia visible). */
  summary: ExamSummaryForPdf
  /** Slots de estudios (referencia en III/IV — tomados del `physicalExamData`). */
  slots: {
    audiometria?: string | null
    espirometria?: string | null
    laboratorios?: string | null
    radiografia?: string | null
    examenMedico?: string | null
  }
  /** Logo AMI (URL pública canónica). Si falla, fallback texto "AMI". */
  logoUrl: string
  /**
   * IMPL-20260826-08 (FND-20260826-03 / DEC-20260826-01 / BR-20260826-01):
   * Bloque consolidado por atención/cita. Lista los Events hermanos
   * del mismo `appointmentId + workerId` (incluyendo el actual, marcado
   * como `isCurrent=true`) con sus estudios y labs.
   */
  consolidatedEvents?: Array<{
    eventId: string
    eventShortId: string
    isCurrent: boolean
    studies: Array<{ serviceName: string; extractedData: unknown | null }>
    labs: Array<{ serviceName: string; extractedData: unknown | null }>
  }>
  /** Historia laboral de esta cita (empleos, puestos, riesgos). */
  historiaLaboral?: Record<string, unknown> | null
  /** Variante corporativa del examen médico (AMI | SODEXO | FLOWSERVE). */
  variant?: 'SME' | 'SODEXO' | 'FLOWSERVE' | 'AMI'
  variantExtensions?: {
    FLOWSERVE?: Record<string, unknown>
    SODEXO?: Record<string, unknown>
  }
}

// ─── Helpers de presentación ──────────────────────────────────────────────────

const formatDate = (d: string | Date) => {
  const date = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Renderiza un valor; si está vacío, muestra `—` (visible, nunca inventado). */
const v = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return '—'
  const s = String(val).trim()
  return s.length === 0 ? '—' : s
}

/** Etiqueta del estado de la revisión/dictamen. */
// ─── Reporte de una hoja (formato de aptitud) ───────────────────────────────

const APTITUD_OPCIONES = [
  'APTO',
  'APTO CONDICIONADO',
  'APTO CON RESTRICCIONES',
  'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO',
] as const

const reportStyles = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 36,
    paddingHorizontal: 32,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#0f172a',
  },
  title: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  idRow: { flexDirection: 'row', marginBottom: 2 },
  idLabel: { width: 118, fontSize: 8, fontWeight: 'bold' },
  idValue: { flex: 1, fontSize: 8 },
  idSplit: { flex: 1, flexDirection: 'row' },
  rule: {
    borderBottomWidth: 0.6,
    borderBottomColor: '#94a3b8',
    marginVertical: 6,
  },
  study: { fontSize: 8, lineHeight: 1.35, marginBottom: 4 },
  studyLabel: { fontWeight: 'bold' },
  sectionHead: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
  },
  aptitudRow: { flexDirection: 'row', alignItems: 'stretch' },
  aptitudTable: { width: '58%', borderWidth: 0.8, borderColor: '#0f172a' },
  aptitudLine: {
    flexDirection: 'row',
    borderBottomWidth: 0.6,
    borderBottomColor: '#0f172a',
    minHeight: 18,
  },
  aptitudName: { flex: 1, fontSize: 7.5, fontWeight: 'bold', padding: 3 },
  aptitudMark: {
    width: 36,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingTop: 3,
    borderLeftWidth: 0.6,
    borderLeftColor: '#0f172a',
  },
  restrictBox: {
    width: '42%',
    borderWidth: 0.8,
    borderColor: '#0f172a',
    borderLeftWidth: 0,
    padding: 4,
    fontSize: 7.5,
    lineHeight: 1.3,
  },
  blockTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 2,
  },
  pairGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  pairCell: { width: '50%', fontSize: 7.5, marginBottom: 1 },
  reco: { fontSize: 8, lineHeight: 1.35, marginTop: 2 },
  sign: { marginTop: 16, alignItems: 'center' },
  signImage: { width: 140, height: 48, objectFit: 'contain', marginBottom: 2 },
  signName: { fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  signMeta: { fontSize: 8, textAlign: 'center', marginTop: 1 },
})

function filled(val: string | null | undefined): string | null {
  const s = (val ?? '').trim()
  if (!s || s === '—' || s === '-') return null
  return s
}

function studyLine(label: string, value: string | null | undefined) {
  const text = filled(value)
  if (!text) return null
  return { label, text }
}

export const ExamenMedicoValidatedPDF = ({ data }: { data: ExamenMedicoPDFData }) => {
  const id = data.patientIdentification
  const p = data.paciente
  const examParts = [
    filled(data.summary.estado_nutricional) ? `ESTADO NUTRICIONAL: ${data.summary.estado_nutricional}` : null,
    filled(data.summary.agudeza_visual) ? `AGUDEZA VISUAL: ${data.summary.agudeza_visual}` : null,
    filled(data.summary.salud_bucal) ? `SALUD BUCAL: ${data.summary.salud_bucal}` : null,
    filled(data.summary.presion_arterial) ? `PRESION ARTERIAL: ${data.summary.presion_arterial}` : null,
  ].filter((x): x is string => Boolean(x))
  const impresion = filled(data.impresionDiagnostica) || filled(data.summary.examen_medico)
  const examBody = [examParts.join(', '), impresion].filter(Boolean).join('. ')
  const studies = [
    studyLine('AUDIOMETRIA', data.slots.audiometria || data.summary.audiometria),
    studyLine('ESPIROMETRIA', data.slots.espirometria || data.summary.espirometria),
    studyLine('LABORATORIOS', data.slots.laboratorios || data.summary.laboratorios),
    studyLine('RADIOGRAFIA', data.slots.radiografia || data.summary.radiografia),
  ].filter((x): x is { label: string; text: string } => Boolean(x))
  const aptitud = (data.aptitud || '').trim().toUpperCase()
  const restricciones = filled(data.restricciones)
  const observaciones = filled(data.observacionesFinales)
  const recomendaciones = data.recomendaciones.filter((r) => filled(r))

  return (
    <Document
      title={`Reporte de Examen Medico ${(data.folio || '').slice(0, 8)}`}
      author={data.medico?.fullName || 'Médico Evaluador'}
      subject="Reporte de examen medico (aptitud)"
    >
      <Page size="LETTER" style={reportStyles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brand}>{SME_LEGAL_NAME}</Text>
            <Text style={styles.brandSub}>Evaluaciones médicas · Outsourcing · Capacitación</Text>
            <Text style={styles.brandSub}>Ergonomía · Fisioterapia · Nutrición</Text>
          </View>
          <View style={styles.headerRight}>
            {data.logoUrl ? (
              <Image style={styles.logoImage} src={data.logoUrl} />
            ) : (
              <Text style={styles.logoFallback}>SME</Text>
            )}
          </View>
        </View>

        <Text style={reportStyles.title}>REPORTE DE EXAMEN MEDICO</Text>

        <View style={reportStyles.idRow}>
          <Text style={reportStyles.idLabel}>NOMBRE:</Text>
          <Text style={reportStyles.idValue}>{v(p.nombreCompleto || id.fullName)}</Text>
        </View>
        <View style={reportStyles.idRow}>
          <View style={reportStyles.idSplit}>
            <Text style={reportStyles.idLabel}>SEXO:</Text>
            <Text style={reportStyles.idValue}>{v(p.sexo || id.sexLabel)}</Text>
          </View>
          <View style={reportStyles.idSplit}>
            <Text style={[reportStyles.idLabel, { width: 52 }]}>EDAD:</Text>
            <Text style={reportStyles.idValue}>{v(p.edad || id.ageLabel)}</Text>
          </View>
          <View style={reportStyles.idSplit}>
            <Text style={[reportStyles.idLabel, { width: 70 }]}>EMPRESA:</Text>
            <Text style={reportStyles.idValue}>{v(p.empresa || id.companyName)}</Text>
          </View>
        </View>
        <View style={reportStyles.idRow}>
          <View style={reportStyles.idSplit}>
            <Text style={reportStyles.idLabel}>FECHA:</Text>
            <Text style={reportStyles.idValue}>{v(id.attentionDate)}</Text>
          </View>
          <View style={reportStyles.idSplit}>
            <Text style={[reportStyles.idLabel, { width: 92 }]}>TIPO DE EXAMEN:</Text>
            <Text style={reportStyles.idValue}>{v(p.tipoExamen)}</Text>
          </View>
        </View>
        <View style={reportStyles.idRow}>
          <Text style={reportStyles.idLabel}>PUESTO:</Text>
          <Text style={reportStyles.idValue}>{v(p.puesto)}</Text>
        </View>

        <Text style={reportStyles.blockTitle}>SOMATOMETRÍA</Text>
        <View style={reportStyles.pairGrid}>
          <Text style={reportStyles.pairCell}>Peso: {v(data.somatometria.peso)} kg</Text>
          <Text style={reportStyles.pairCell}>Talla: {v(data.somatometria.talla)} m</Text>
          <Text style={reportStyles.pairCell}>IMC: {v(data.somatometria.imc)}</Text>
          <Text style={reportStyles.pairCell}>TA: {v(data.somatometria.ta)} mmHg</Text>
          <Text style={reportStyles.pairCell}>FC: {v(data.somatometria.fc)} /min</Text>
          <Text style={reportStyles.pairCell}>FR: {v(data.somatometria.fr)} /min</Text>
          <Text style={reportStyles.pairCell}>Temp: {v(data.somatometria.temperatura)} °C</Text>
          <Text style={reportStyles.pairCell}>Sat. O2: {v(data.somatometria.saturacionOxigeno)} %</Text>
        </View>

        <Text style={reportStyles.blockTitle}>ANTECEDENTES HEREDOFAMILIARES</Text>
        <View style={reportStyles.pairGrid}>
          <Text style={reportStyles.pairCell}>Diabetes: {v(data.ahf.diabetes)}</Text>
          <Text style={reportStyles.pairCell}>Hipertensión: {v(data.ahf.hipertension)}</Text>
          <Text style={reportStyles.pairCell}>Epilepsia: {v(data.ahf.epilepsia)}</Text>
          <Text style={reportStyles.pairCell}>Cardiopatía: {v(data.ahf.cardiopatia)}</Text>
          <Text style={reportStyles.pairCell}>Renales: {v(data.ahf.renales)}</Text>
          <Text style={reportStyles.pairCell}>Asma: {v(data.ahf.asma)}</Text>
          <Text style={reportStyles.pairCell}>Cáncer: {v(data.ahf.cancer)}</Text>
          <Text style={reportStyles.pairCell}>Mentales: {v(data.ahf.mentales)}</Text>
          <Text style={reportStyles.pairCell}>Otras: {v(data.ahf.otras)}</Text>
        </View>

        <Text style={reportStyles.blockTitle}>AGUDEZA VISUAL</Text>
        <View style={reportStyles.pairGrid}>
          <Text style={reportStyles.pairCell}>Lejana OD: {v(data.agudezaVisual.visionLejanaOD)}</Text>
          <Text style={reportStyles.pairCell}>Lejana OI: {v(data.agudezaVisual.visionLejanaOI)}</Text>
          <Text style={reportStyles.pairCell}>Cercana OD: {v(data.agudezaVisual.visionCercanaOD)}</Text>
          <Text style={reportStyles.pairCell}>Cercana OI: {v(data.agudezaVisual.visionCercanaOI)}</Text>
          <Text style={reportStyles.pairCell}>Lejana corr. OD: {v(data.agudezaVisual.lejanaCorregidaOD)}</Text>
          <Text style={reportStyles.pairCell}>Lejana corr. OI: {v(data.agudezaVisual.lejanaCorregidaOI)}</Text>
          <Text style={reportStyles.pairCell}>Cercana corr. OD: {v(data.agudezaVisual.cercanaCorregidaOD)}</Text>
          <Text style={reportStyles.pairCell}>Cercana corr. OI: {v(data.agudezaVisual.cercanaCorregidaOI)}</Text>
          <Text style={reportStyles.pairCell}>Ishihara: {v(data.agudezaVisual.ishihara)}</Text>
          <Text style={reportStyles.pairCell}>Campimetría: {v(data.agudezaVisual.campimetria)}</Text>
          <Text style={reportStyles.pairCell}>Reflejos: {v(data.agudezaVisual.reflejos)}</Text>
        </View>

        <View style={reportStyles.rule} />

        <Text style={reportStyles.study}>
          <Text style={reportStyles.studyLabel}>EXAMEN MEDICO: </Text>
          {examBody || '—'}
        </Text>
        {studies.map((row) => (
          <Text key={row.label} style={reportStyles.study}>
            <Text style={reportStyles.studyLabel}>{row.label}: </Text>
            {row.text}
          </Text>
        ))}

        <View style={reportStyles.rule} />
        <Text style={reportStyles.sectionHead}>DICTAMEN DE APTITUD</Text>
        <View style={reportStyles.aptitudRow}>
          <View style={reportStyles.aptitudTable}>
            {APTITUD_OPCIONES.map((opcion, index) => (
              <View
                key={opcion}
                style={[
                  reportStyles.aptitudLine,
                  index === APTITUD_OPCIONES.length - 1 ? { borderBottomWidth: 0 } : {},
                ]}
              >
                <Text style={reportStyles.aptitudName}>{opcion}</Text>
                <Text style={reportStyles.aptitudMark}>
                  {aptitud === opcion ? 'XXX' : ''}
                </Text>
              </View>
            ))}
          </View>
          <Text style={reportStyles.restrictBox}>{restricciones || ''}</Text>
        </View>

        <Text style={[reportStyles.sectionHead, { marginTop: 8 }]}>
          OBSERVACIONES / COMENTARIOS / RECOMENDACIONES
        </Text>
        {observaciones ? <Text style={reportStyles.reco}>{observaciones}</Text> : null}
        {recomendaciones.length > 0 ? (
          <Text style={reportStyles.reco}>
            {recomendaciones.map((item, i) => `${i + 1}.- ${item}`).join(' ')}
          </Text>
        ) : null}
        {!observaciones && recomendaciones.length === 0 ? (
          <Text style={reportStyles.reco}>—</Text>
        ) : null}

        <View style={reportStyles.sign}>
          {data.medico?.signatureImageUrl ? (
            <Image style={reportStyles.signImage} src={data.medico.signatureImageUrl} />
          ) : null}
          <Text style={reportStyles.signName}>
            Realizó EM: {(data.medico?.fullName || '').trim().toUpperCase() || '—'}
          </Text>
          <Text style={reportStyles.signMeta}>
            Ced. Prof.: {v(data.medico?.professionalLicense)}
          </Text>
        </View>

        <Text style={styles.footer} fixed>
          {SME_PDF_FOOTER}
        </Text>
      </Page>
      <ExamenMedicoVariantAppendixPages data={data} />
    </Document>
  )
}
