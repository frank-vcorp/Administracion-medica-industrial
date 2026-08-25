/**
 * @fileoverview Plantilla PDF validado de Espirometría — IMPL-FEATURE-20260825-01.
 * @id IMPL-FEATURE-20260825-01
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * GUARDRAIL: este PDF NO copia el texto fuente del documento de Espirometría
 * como IA. Usa la versión validada por el médico (`reviewerDiagnosis`,
 * `reviewerNotes`) y los campos estructurados del snapshot (criterios de
 * repetibilidad FVC/FEV1, recomendaciones validadas). El modo sombra clínica
 * se mantiene hasta la aceptación; el PDF refleja la decisión humana.
 *
 * Membrete y pie institucional AMI vienen de la SPEC. Logo se incrusta como
 * `Image` desde URL remota pública; si @react-pdf no puede resolverla en
 * el entorno de generación, el componente cae a texto "AMI" sin romper el
 * render. El consumidor debe manejar `renderToBuffer` y persistir el PDF
 * para entregas subsecuentes (no se regenera en cada descarga si ya existe
 * en disco).
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a' },
  // Membrete superior
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#0f766e',
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'column' },
  brand: { fontSize: 16, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 8, color: '#475569' },
  headerRight: { alignItems: 'flex-end', justifyContent: 'flex-start', width: 140 },
  logoImage: { width: 130, height: 48, objectFit: 'contain' },
  logoFallback: {
    width: 130,
    height: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    textAlign: 'center',
    paddingTop: 14,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  // Títulos
  docTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#0f172a' },
  docSubtitle: { fontSize: 9, color: '#475569', marginBottom: 14 },
  // Secciones
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    padding: 5,
    marginBottom: 6,
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 130, fontSize: 9, fontWeight: 'bold', color: '#475569' },
  value: { flex: 1, fontSize: 9, color: '#0f172a' },
  paragraph: { fontSize: 9, lineHeight: 1.5, color: '#0f172a', marginBottom: 4 },
  bulletItem: { fontSize: 9, marginLeft: 8, marginBottom: 2 },
  // Caja impresión / recomendaciones
  verdictBox: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
    marginBottom: 6,
  },
  // Firma
  signatureArea: { marginTop: 36, flexDirection: 'row', justifyContent: 'flex-end' },
  signatureBox: { width: 240, alignItems: 'center' },
  signatureImage: { width: 200, height: 70, objectFit: 'contain', marginBottom: 4 },
  signatureLine: { width: 200, borderBottomWidth: 1, borderBottomColor: '#0f172a', marginBottom: 4 },
  signatureName: { fontSize: 10, fontWeight: 'bold', color: '#0f172a' },
  signatureLicense: { fontSize: 9, color: '#475569' },
  signatureDate: { fontSize: 8, color: '#94a3b8', marginTop: 2 },
  // Pie
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    lineHeight: 1.4,
  },
})

export interface EspirometryValidatedPDFData {
  /** ID de la revisión médica (folio) */
  reviewId: string
  /** Fecha/hora de la firma (ISO o Date) */
  signedAt: string | Date
  /** Nombre del estudio */
  studyName: string
  /** Tipo de estudio (canonical: 'Espirometria') */
  studyType: string
  /** Paciente */
  patient: {
    fullName: string
    universalId?: string | null
    companyName?: string | null
  }
  /** Estado de la revisión que genera este PDF */
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  /** Diagnóstico del médico (validado) */
  doctorDiagnosis: string
  /** Notas adicionales del médico */
  doctorNotes?: string | null
  /** Criterios de repetibilidad (presentación clínica: textos, NO copiados
   *  del PDF fuente) */
  repetibilidad?: {
    fvc?: { diferenciaMl?: number | null; cumple?: boolean | null; maniobrasValidas?: number | null }
    fev1?: { diferenciaMl?: number | null; cumple?: boolean | null; maniobrasValidas?: number | null }
    umbralMl?: number | null
    fuente?: 'extracted' | 'derived' | null
  } | null
  /** Recomendaciones validadas por el médico (texto que el médico acepta o edita).
   *  Es distinto del campo IA `recommendation`; representa las recomendaciones
   *  que el médico considera válidas para esta papeleta. */
  recomendacionesValidadas: string[]
  /** Identidad congelada del médico (snapshot del perfil al momento de la revisión) */
  medico: {
    fullName: string
    professionalLicense: string
    /** Data-URL o URL servible por la app */
    signatureImageUrl: string
  }
  /** Logo AMI (URL pública canónica; si falla, mostrar texto) */
  logoUrl: string
}

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

const formatBool = (v: boolean | null | undefined) => {
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  return '—'
}

const formatMl = (v: number | null | undefined) => {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return `${v} ml`
}

const formatNumber = (v: number | null | undefined) => {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return String(v)
}

export const EspirometryValidatedPDF = ({ data }: { data: EspirometryValidatedPDFData }) => (
  <Document
    title={`Espirometria-validada-${data.reviewId.slice(0, 8)}`}
    author={`Dr(a). ${data.medico.fullName}`}
    subject="Reporte de Espirometría validado por el médico"
  >
    <Page size="A4" style={styles.page}>
      {/* MEMBRETE SUPERIOR */}
      <View style={styles.header} fixed>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Administración Médica Industrial</Text>
          <Text style={styles.brandSub}>Evaluaciones médicas · Outsourcing · Capacitación</Text>
          <Text style={styles.brandSub}>Ergonomía · Fisioterapia · Nutrición</Text>
        </View>
        <View style={styles.headerRight}>
          {data.logoUrl ? (
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.logoFallback}>AMI</Text>
          )}
        </View>
      </View>

      <Text style={styles.docTitle}>Reporte de Espirometría Validado</Text>
      <Text style={styles.docSubtitle}>
        Folio de revisión: {data.reviewId} · Estado:{' '}
        {data.doctorStatus === 'REVIEWED_ACCEPTED' ? 'Aceptado' : 'Editado'} · Firmado:{' '}
        {formatDate(data.signedAt)}
      </Text>

      {/* 1. DATOS DEL ESTUDIO Y PACIENTE */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>I. Datos del estudio y paciente</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Estudio:</Text>
          <Text style={styles.value}>{data.studyName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tipo:</Text>
          <Text style={styles.value}>{data.studyType}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Paciente:</Text>
          <Text style={styles.value}>{data.patient.fullName}</Text>
        </View>
        {data.patient.universalId ? (
          <View style={styles.row}>
            <Text style={styles.label}>ID paciente:</Text>
            <Text style={styles.value}>{data.patient.universalId}</Text>
          </View>
        ) : null}
        {data.patient.companyName ? (
          <View style={styles.row}>
            <Text style={styles.label}>Empresa:</Text>
            <Text style={styles.value}>{data.patient.companyName}</Text>
          </View>
        ) : null}
      </View>

      {/* 2. CRITERIOS DE REPETIBILIDAD */}
      {data.repetibilidad ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. Criterios de repetibilidad (AMI ≤ 150 ml)</Text>
          <View style={styles.row}>
            <Text style={styles.label}>FVC — diferencia:</Text>
            <Text style={styles.value}>{formatMl(data.repetibilidad.fvc?.diferenciaMl ?? null)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>FVC — cumple ≤ {data.repetibilidad.umbralMl ?? 150} ml:</Text>
            <Text style={styles.value}>{formatBool(data.repetibilidad.fvc?.cumple ?? null)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>FVC — maniobras válidas:</Text>
            <Text style={styles.value}>{formatNumber(data.repetibilidad.fvc?.maniobrasValidas ?? null)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>FEV1 — diferencia:</Text>
            <Text style={styles.value}>{formatMl(data.repetibilidad.fev1?.diferenciaMl ?? null)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>FEV1 — cumple ≤ {data.repetibilidad.umbralMl ?? 150} ml:</Text>
            <Text style={styles.value}>{formatBool(data.repetibilidad.fev1?.cumple ?? null)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>FEV1 — maniobras válidas:</Text>
            <Text style={styles.value}>{formatNumber(data.repetibilidad.fev1?.maniobrasValidas ?? null)}</Text>
          </View>
        </View>
      ) : null}

      {/* 3. IMPRESIÓN DIAGNÓSTICA VALIDADA */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>III. Impresión diagnóstica (validada por el médico)</Text>
        <View style={styles.verdictBox}>
          <Text style={styles.paragraph}>{data.doctorDiagnosis}</Text>
        </View>
      </View>

      {/* 4. RECOMENDACIONES VALIDADAS */}
      {data.recomendacionesValidadas.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IV. Recomendaciones validadas</Text>
          {data.recomendacionesValidadas.map((r, i) => (
            <Text key={i} style={styles.bulletItem}>• {r}</Text>
          ))}
        </View>
      ) : null}

      {/* 5. NOTAS */}
      {data.doctorNotes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>V. Notas clínicas</Text>
          <Text style={styles.paragraph}>{data.doctorNotes}</Text>
        </View>
      ) : null}

      {/* FIRMA */}
      <View style={styles.signatureArea}>
        <View style={styles.signatureBox}>
          {data.medico.signatureImageUrl ? (
            <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
          ) : (
            <View style={styles.signatureLine} />
          )}
          <Text style={styles.signatureName}>Dr(a). {data.medico.fullName}</Text>
          <Text style={styles.signatureLicense}>Cédula profesional: {data.medico.professionalLicense}</Text>
          <Text style={styles.signatureDate}>Fecha y hora: {formatDate(data.signedAt)}</Text>
        </View>
      </View>

      {/* PIE INSTITUCIONAL AMI */}
      <Text style={styles.footer} fixed>
        Administración Médica Industrial — Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro — (442) 225-52-67 — www.medicaindustrial.com
        {'\n'}Evaluaciones médicas · Outsourcing · Capacitación · Ergonomía · Fisioterapia · Nutrición
        {'\n'}Este documento es un reporte clínico validado por el médico firmante. Queda prohibida su alteración o reproducción no autorizada.
      </Text>
    </Page>
  </Document>
)
