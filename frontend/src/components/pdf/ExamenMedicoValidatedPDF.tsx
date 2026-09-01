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
  /** Estado de la revisión que origina este PDF (REVIEWED_ACCEPTED o
   *  REVIEWED_EDITED) o 'SIGNED' si viene del `MedicalVerdict.signedAt`. */
  status: 'SIGNED' | 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'

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
    tatuajes?: string | null
  }

  // II. Antecedentes y mediciones
  app: string
  /** Historia gineco-obstétrica cuando aplique (concatenación). */
  historiaGineco?: string | null
  /** Inmunizaciones (concatenación). */
  inmunizaciones?: string | null
  /** Somatometría / signos vitales (peso/talla/IMC/cintura/cadera/TA/FC/FR/T). */
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
const statusLabel = (s: ExamenMedicoPDFData['status']) => {
  if (s === 'SIGNED') return 'Firmado'
  if (s === 'REVIEWED_ACCEPTED') return 'Aceptado'
  return 'Editado'
}

// ─── Componente ───────────────────────────────────────────────────────────────

export const ExamenMedicoValidatedPDF = ({ data }: { data: ExamenMedicoPDFData }) => (
  <Document
    title={`ExamenMedico-AMI-${data.folio.slice(0, 8)}`}
    author={`Dr(a). ${data.medico.fullName}`}
    subject="Reporte de Examen Médico consolidado AMI"
  >
    {/* ═════════════════════════════════════════════════════════════════════
        PÁGINA 1 — Identificación e historia
        ═════════════════════════════════════════════════════════════════════ */}
    <Page size="A4" style={styles.page}>
      {/* MEMBRETE SUPERIOR */}
      <View style={styles.header} fixed>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Administración Médica Industrial</Text>
          <Text style={styles.brandSub}>
            Evaluaciones médicas · Outsourcing · Capacitación
          </Text>
          <Text style={styles.brandSub}>
            Ergonomía · Fisioterapia · Nutrición
          </Text>
        </View>
        <View style={styles.headerRight}>
          {data.logoUrl ? (
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.logoFallback}>AMI</Text>
          )}
        </View>
      </View>

      <Text style={styles.docTitle}>Reporte de Examen Médico — AMI</Text>
      <Text style={styles.docSubtitle}>
        Folio: {data.folio} · Estado: {statusLabel(data.status)} · Firmado:{' '}
        {formatDate(data.signedAt)}
      </Text>

      {/* I. IDENTIFICACIÓN E HISTORIA */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          I. Identificación del paciente e historia ocupacional
        </Text>

        <Text style={styles.subTitle}>Paciente</Text>
        <View style={styles.grid2}>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Nombre:</Text>
              <Text style={styles.value}>{v(data.paciente.nombreCompleto)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>F. nacimiento:</Text>
              <Text style={styles.value}>{v(data.paciente.fechaNacimiento)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Edad:</Text>
              <Text style={styles.value}>{v(data.paciente.edad)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Sexo:</Text>
              <Text style={styles.value}>{v(data.paciente.sexo)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Identidad género:</Text>
              <Text style={styles.value}>{v(data.paciente.identidadGenero)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Estado civil:</Text>
              <Text style={styles.value}>{v(data.paciente.estadoCivil)}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Escolaridad:</Text>
              <Text style={styles.value}>{v(data.paciente.escolaridad)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Dirección:</Text>
              <Text style={styles.value}>{v(data.paciente.direccion)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tipo sanguíneo:</Text>
              <Text style={styles.value}>{v(data.paciente.tipoSanguineo)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Empresa:</Text>
              <Text style={styles.value}>{v(data.paciente.empresa)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Puesto:</Text>
              <Text style={styles.value}>{v(data.paciente.puesto)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Área:</Text>
              <Text style={styles.value}>{v(data.paciente.area)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Tipo de examen:</Text>
          <Text style={styles.value}>{v(data.paciente.tipoExamen)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Historia ocupacional:</Text>
          <Text style={styles.value}>{v(data.paciente.historiaOcupacional)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Riesgos de trabajo:</Text>
          <Text style={styles.value}>{v(data.paciente.riesgosTrabajo)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>EPP:</Text>
          <Text style={styles.value}>{v(data.paciente.epp)}</Text>
        </View>

        <Text style={styles.subTitle}>Antecedentes heredofamiliares</Text>
        <View style={styles.grid2}>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Diabetes:</Text>
              <Text style={styles.value}>{v(data.ahf.diabetes)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Hipertensión:</Text>
              <Text style={styles.value}>{v(data.ahf.hipertension)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Epilepsia:</Text>
              <Text style={styles.value}>{v(data.ahf.epilepsia)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Cardiopatía:</Text>
              <Text style={styles.value}>{v(data.ahf.cardiopatia)}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Renales:</Text>
              <Text style={styles.value}>{v(data.ahf.renales)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Asma:</Text>
              <Text style={styles.value}>{v(data.ahf.asma)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Cáncer:</Text>
              <Text style={styles.value}>{v(data.ahf.cancer)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Mentales / Otras:</Text>
              <Text style={styles.value}>
                {v(data.ahf.mentales)} / {v(data.ahf.otras)}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.subTitle}>Antecedentes personales no patológicos (toxicomanías)</Text>
        <View style={styles.grid2}>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Alcoholismo:</Text>
              <Text style={styles.value}>{v(data.apnp.alcohol)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tabaquismo:</Text>
              <Text style={styles.value}>{v(data.apnp.tabaco)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Drogas:</Text>
              <Text style={styles.value}>{v(data.apnp.drogas)}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Ejercicio:</Text>
              <Text style={styles.value}>{v(data.apnp.ejercicio)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Alimentación:</Text>
              <Text style={styles.value}>{v(data.apnp.alimentacion)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tatuajes:</Text>
              <Text style={styles.value}>{v(data.apnp.tatuajes)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* PIE */}
      <Text style={styles.footer} fixed>
        Administración Médica Industrial — Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro — (442) 225-52-67 — www.medicaindustrial.com
        {'\n'}Evaluaciones médicas · Outsourcing · Capacitación · Ergonomía · Fisioterapia · Nutrición
        {'\n'}Este documento es un reporte clínico consolidado firmado por el médico evaluador. Queda prohibida su alteración o reproducción no autorizada.
      </Text>
    </Page>

    {/* ═════════════════════════════════════════════════════════════════════
        PÁGINA 2 — Antecedentes y mediciones
        ═════════════════════════════════════════════════════════════════════ */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header} fixed>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Administración Médica Industrial</Text>
          <Text style={styles.brandSub}>II. Antecedentes y mediciones</Text>
        </View>
        <View style={styles.headerRight}>
          {data.logoUrl ? (
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.logoFallback}>AMI</Text>
          )}
        </View>
      </View>

      {/* APP */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Antecedentes personales patológicos</Text>
        <View style={styles.verdictBox}>
          <Text style={styles.paragraph}>{v(data.app)}</Text>
        </View>
      </View>

      {/* GO + Inmunizaciones */}
      <View style={styles.grid2}>
        <View style={[styles.gridCol, { paddingRight: 8 }]}>
          <Text style={styles.subTitle}>
            {String(data.paciente.sexo ?? '')
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .toLowerCase()
              .startsWith('m')
              ? 'Antecedentes reproductivos'
              : 'Historia gineco-obstétrica'}
          </Text>
          <Text style={styles.paragraph}>{v(data.historiaGineco)}</Text>
        </View>
        <View style={styles.gridCol}>
          <Text style={styles.subTitle}>Inmunizaciones</Text>
          <Text style={styles.paragraph}>{v(data.inmunizaciones)}</Text>
        </View>
      </View>

      {/* Somatometría / Signos vitales */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Somatometría y signos vitales</Text>
        <View style={styles.grid2}>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Peso (kg):</Text>
              <Text style={styles.value}>{v(data.somatometria.peso)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Talla (m):</Text>
              <Text style={styles.value}>{v(data.somatometria.talla)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>IMC:</Text>
              <Text style={styles.value}>{v(data.somatometria.imc)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Cintura (cm):</Text>
              <Text style={styles.value}>{v(data.somatometria.cintura)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Cadera (cm):</Text>
              <Text style={styles.value}>{v(data.somatometria.cadera)}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Tensión arterial:</Text>
              <Text style={styles.value}>{v(data.somatometria.ta)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>FC (lpm):</Text>
              <Text style={styles.value}>{v(data.somatometria.fc)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>FR (rpm):</Text>
              <Text style={styles.value}>{v(data.somatometria.fr)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Temperatura (°C):</Text>
              <Text style={styles.value}>{v(data.somatometria.temperatura)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Agudeza visual y pruebas complementarias */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Agudeza visual y pruebas complementarias</Text>
        <View style={styles.grid2}>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Visión lejana OD:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.visionLejanaOD)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Visión lejana OI:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.visionLejanaOI)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Visión cercana OD:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.visionCercanaOD)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Visión cercana OI:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.visionCercanaOI)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Lejana correg. OD:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.lejanaCorregidaOD)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Lejana correg. OI:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.lejanaCorregidaOI)}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Cercana correg. OD:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.cercanaCorregidaOD)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Cercana correg. OI:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.cercanaCorregidaOI)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Reflejos:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.reflejos)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Ishihara:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.ishihara)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Campimetría:</Text>
              <Text style={styles.value}>{v(data.agudezaVisual.campimetria)}</Text>
            </View>
          </View>
        </View>
      </View>

      <Text style={styles.footer} fixed>
        Administración Médica Industrial — Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro — (442) 225-52-67 — www.medicaindustrial.com
        {'\n'}Este documento es un reporte clínico consolidado firmado por el médico evaluador. Queda prohibida su alteración o reproducción no autorizada.
      </Text>
    </Page>

    {/* ═════════════════════════════════════════════════════════════════════
        PÁGINA 3 — Exploración
        ═════════════════════════════════════════════════════════════════════ */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header} fixed>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Administración Médica Industrial</Text>
          <Text style={styles.brandSub}>III. Exploración física</Text>
        </View>
        <View style={styles.headerRight}>
          {data.logoUrl ? (
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.logoFallback}>AMI</Text>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exploración general y por aparatos</Text>
        <View style={styles.grid2}>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Neurológico:</Text>
              <Text style={styles.value}>{v(data.exploracion.neurologico)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Cabeza:</Text>
              <Text style={styles.value}>{v(data.exploracion.cabeza)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Piel y faneras:</Text>
              <Text style={styles.value}>{v(data.exploracion.piel_y_faneras)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Oídos CAD:</Text>
              <Text style={styles.value}>{v(data.exploracion.oidos_cad)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Oídos CAI:</Text>
              <Text style={styles.value}>{v(data.exploracion.oidos_cai)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Ojos:</Text>
              <Text style={styles.value}>{v(data.exploracion.ojos)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Boca (estado):</Text>
              <Text style={styles.value}>{v(data.exploracion.boca_estado)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Boca (alineación):</Text>
              <Text style={styles.value}>{v(data.exploracion.boca_alineacion)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Nariz:</Text>
              <Text style={styles.value}>{v(data.exploracion.nariz)}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Faringe:</Text>
              <Text style={styles.value}>{v(data.exploracion.faringe)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Cuello:</Text>
              <Text style={styles.value}>{v(data.exploracion.cuello)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tórax:</Text>
              <Text style={styles.value}>{v(data.exploracion.torax)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Corazón:</Text>
              <Text style={styles.value}>{v(data.exploracion.corazon)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Campos pulm.:</Text>
              <Text style={styles.value}>{v(data.exploracion.campos_pulmonares)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Abdomen:</Text>
              <Text style={styles.value}>{v(data.exploracion.abdomen)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Genitourinario:</Text>
              <Text style={styles.value}>{v(data.exploracion.genitourinario)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Columna:</Text>
              <Text style={styles.value}>{v(data.exploracion.columna_vertebral)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Circulación venosa:</Text>
              <Text style={styles.value}>{v(data.exploracion.circulacion_venosa)}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.subTitle}>Extremidades</Text>
        <View style={styles.grid2}>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>MMSS:</Text>
              <Text style={styles.value}>{v(data.exploracion.ms_superiores)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Fuerza (Daniels sup):</Text>
              <Text style={styles.value}>
                {v(data.exploracion.fuerza_muscular_daniels_sup)}
              </Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>MMII:</Text>
              <Text style={styles.value}>{v(data.exploracion.ms_inferiores)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Fuerza (Daniels inf):</Text>
              <Text style={styles.value}>
                {v(data.exploracion.fuerza_muscular_daniels_inf)}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pruebas musculoesqueléticas</Text>
        <View style={styles.grid2}>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Arco de movilidad:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.arcoMovilidad)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Tono muscular:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.tonoMuscular)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Coordinación:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.coordinacion)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Test de Adam:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.testAdam)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Test de Romberg:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.testRomberg)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Signo Bragard:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.bragard)}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Finkelstein:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.finkelstein)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Signo Tinel:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.tinel)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Phanel:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.phanel)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Lasegue:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.lasegue)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Quiste sinovial:</Text>
              <Text style={styles.value}>{v(data.pruebasMusculo.quisteSinovial)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Impresión diagnóstica del médico (referencia visible) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          Impresión diagnóstica del médico (validada)
        </Text>
        <View style={styles.verdictBox}>
          <Text style={styles.paragraph}>{v(data.impresionDiagnostica)}</Text>
        </View>
      </View>

      <Text style={styles.footer} fixed>
        Administración Médica Industrial — Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro — (442) 225-52-67 — www.medicaindustrial.com
        {'\n'}Este documento es un reporte clínico consolidado firmado por el médico evaluador. Queda prohibida su alteración o reproducción no autorizada.
      </Text>
    </Page>

    {/* ═════════════════════════════════════════════════════════════════════
        PÁGINA 4 — Dictamen (aptitud / recomendaciones / firma)
        ═════════════════════════════════════════════════════════════════════ */}
    <Page size="A4" style={styles.page}>
      <View style={styles.header} fixed>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Administración Médica Industrial</Text>
          <Text style={styles.brandSub}>IV. Dictamen de aptitud laboral</Text>
        </View>
        <View style={styles.headerRight}>
          {data.logoUrl ? (
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.logoFallback}>AMI</Text>
          )}
        </View>
      </View>

      {/* Resumen ejecutivo de 9 campos (referencia consolidada) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen ejecutivo (auto-poblado)</Text>
        <View style={styles.grid2}>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Estado nutricional:</Text>
              <Text style={styles.value}>{v(data.summary.estado_nutricional)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Agudeza visual:</Text>
              <Text style={styles.value}>{v(data.summary.agudeza_visual)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Salud bucal:</Text>
              <Text style={styles.value}>{v(data.summary.salud_bucal)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Examen médico:</Text>
              <Text style={styles.value}>{v(data.summary.examen_medico)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Presión arterial:</Text>
              <Text style={styles.value}>{v(data.summary.presion_arterial)}</Text>
            </View>
          </View>
          <View style={styles.gridCol}>
            <View style={styles.row}>
              <Text style={styles.label}>Audiometría:</Text>
              <Text style={styles.value}>{v(data.summary.audiometria)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Espirometría:</Text>
              <Text style={styles.value}>{v(data.summary.espirometria)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Laboratorios:</Text>
              <Text style={styles.value}>{v(data.summary.laboratorios)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>Radiografía:</Text>
              <Text style={styles.value}>{v(data.summary.radiografia)}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Aptitud */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aptitud laboral</Text>
        <View style={styles.verdictBox}>
          <Text style={[styles.paragraph, { fontWeight: 'bold', fontSize: 10 }]}>
            {v(data.aptitud)}
          </Text>
        </View>
      </View>

      {/* Restricciones y observaciones finales */}
      <View style={styles.grid2}>
        <View style={[styles.gridCol, { paddingRight: 8 }]}>
          <Text style={styles.subTitle}>Restricciones</Text>
          <View style={styles.verdictBox}>
            <Text style={styles.paragraph}>{v(data.restricciones)}</Text>
          </View>
        </View>
        <View style={styles.gridCol}>
          <Text style={styles.subTitle}>Observaciones finales</Text>
          <View style={styles.verdictBox}>
            <Text style={styles.paragraph}>{v(data.observacionesFinales)}</Text>
          </View>
        </View>
      </View>

      {/* Recomendaciones */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recomendaciones</Text>
        {data.recomendaciones.length === 0 ? (
          <Text style={[styles.paragraph, styles.missing]}>—</Text>
        ) : (
          data.recomendaciones.map((r, i) => (
            <Text key={i} style={styles.bulletItem}>
              {i + 1}.- {r}
            </Text>
          ))
        )}
      </View>

      {/* Nota de condicionamiento por estudios paraclínicos */}
      {data.notaCondicionamiento ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Nota de condicionamiento (estudios paraclínicos)
          </Text>
          <View style={styles.verdictBox}>
            <Text style={styles.paragraph}>{v(data.notaCondicionamiento)}</Text>
          </View>
        </View>
      ) : null}

      {/* Slots de estudios (referencia trazable) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estudios complementarios (slots)</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Audiometría:</Text>
          <Text style={styles.value}>{v(data.slots.audiometria)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Espirometría:</Text>
          <Text style={styles.value}>{v(data.slots.espirometria)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Laboratorios:</Text>
          <Text style={styles.value}>{v(data.slots.laboratorios)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Radiografía:</Text>
          <Text style={styles.value}>{v(data.slots.radiografia)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Examen físico:</Text>
          <Text style={styles.value}>{v(data.slots.examenMedico)}</Text>
        </View>
      </View>

      {/* IMPL-20260826-08: Hallazgos de la Atención/Cita (consolidado por
          Event hermanos del mismo appointmentId + workerId). Sólo se
          renderiza si `consolidatedEvents` está presente y tiene > 0
          elementos. NO inventa resultados: cada bloque sólo refleja el
          snapshot del Event correspondiente. */}
      {data.consolidatedEvents && data.consolidatedEvents.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            HALLAZGOS DE LA ATENCIÓN/CITA (EVENTS HERMANOS)
          </Text>
          <Text style={styles.sectionTitle}>
            Estudios auxiliares de los Events del trabajador ligados a la
            misma cita. Sólo se muestran los datos disponibles en cada
            Event; los faltantes aparecen como PENDIENTE sin inventar
            resultados.
          </Text>
          {data.consolidatedEvents.map((block) => {
            const blockEntries: Array<{
              serviceName: string
              extractedData: unknown | null
            }> = [
              ...(block.studies ?? []),
              ...(block.labs ?? []),
            ]
            return (
              <View
                key={block.eventId}
                style={{
                  marginBottom: 8,
                  paddingLeft: 10,
                  paddingTop: 4,
                  paddingBottom: 4,
                  borderLeftWidth: 2,
                  borderLeftColor: block.isCurrent ? '#0f172a' : '#cbd5e1',
                }}
                wrap={false}
              >
                <Text style={{ fontSize: 9, fontWeight: 'bold' }}>
                  • Event {block.eventShortId}
                  {block.isCurrent && (
                    <Text style={{ color: '#166534' }}>  [ACTUAL]</Text>
                  )}
                </Text>
                {blockEntries.length === 0 ? (
                  <Text style={{ fontSize: 8, color: '#64748b', fontStyle: 'italic' }}>
                    Sin estudios auxiliares registrados para este Event.
                  </Text>
                ) : (
                  blockEntries.map((s, sIdx) => {
                    const hasData =
                      s.extractedData !== null &&
                      s.extractedData !== undefined &&
                      typeof s.extractedData === 'object' &&
                      !Array.isArray(s.extractedData) &&
                      Object.keys(s.extractedData as Record<string, unknown>).length > 0
                    return (
                      <Text
                        key={`${block.eventId}-${s.serviceName}-${sIdx}`}
                        style={{ fontSize: 8, marginLeft: 14 }}
                      >
                        – {s.serviceName}:{' '}
                        <Text
                          style={{
                            color: hasData ? '#166534' : '#92400e',
                            fontWeight: 'bold',
                          }}
                        >
                          {hasData ? 'APLICADO' : 'PENDIENTE'}
                        </Text>
                      </Text>
                    )
                  })
                )}
              </View>
            )
          })}
        </View>
      )}

      {/* FIRMA */}
      <View style={styles.signatureArea}>
        <View style={styles.signatureBox}>
          {data.medico.signatureImageUrl ? (
            <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
          ) : (
            <View style={styles.signatureLine} />
          )}
          <Text style={styles.signatureName}>Dr(a). {v(data.medico.fullName)}</Text>
          <Text style={styles.signatureLicense}>
            Cédula profesional: {v(data.medico.professionalLicense)}
          </Text>
          <Text style={styles.signatureDate}>
            Fecha y hora: {formatDate(data.signedAt)}
          </Text>
        </View>
      </View>

      <Text style={styles.footer} fixed>
        Administración Médica Industrial — Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro — (442) 225-52-67 — www.medicaindustrial.com
        {'\n'}Evaluaciones médicas · Outsourcing · Capacitación · Ergonomía · Fisioterapia · Nutrición
        {'\n'}Este documento es un reporte clínico consolidado firmado por el médico evaluador. Queda prohibida su alteración o reproducción no autorizada.
      </Text>
    </Page>
  </Document>
)