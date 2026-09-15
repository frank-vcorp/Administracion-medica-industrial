/**
 * Plantilla PDF validado de Campimetría — formato AMI 005-2018.
 * @id IMPL-FEATURE-20260914-01
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { ISHIHARA_PLATES } from '@/schemas/clinical/campimetria-questionnaire.schema'

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Helvetica', fontSize: 8, color: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#0f766e',
    paddingBottom: 6,
  },
  brand: { fontSize: 14, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 7, color: '#475569' },
  logoImage: { width: 110, height: 40, objectFit: 'contain' },
  title: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  row2: { flexDirection: 'row', marginBottom: 2 },
  label: { width: 90, fontWeight: 'bold' },
  value: { flex: 1 },
  sectionTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    padding: 3,
    marginTop: 6,
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  twoCol: { flexDirection: 'row', gap: 8 },
  col: { flex: 1 },
  colTitle: { fontSize: 8, fontWeight: 'bold', textAlign: 'center', marginBottom: 3 },
  cell: { fontSize: 7, lineHeight: 1.35, marginBottom: 2 },
  image: { width: '100%', height: 70, objectFit: 'contain', marginVertical: 4 },
  table: { borderWidth: 1, borderColor: '#cbd5e1', marginTop: 4 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  tableHead: { flex: 1, fontSize: 7, fontWeight: 'bold', padding: 2, textAlign: 'center' },
  tableCell: { flex: 1, fontSize: 7, padding: 2, textAlign: 'center' },
  summary: {
    marginTop: 8,
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  block: { marginTop: 6, fontSize: 8, lineHeight: 1.4 },
  signatureRow: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  signatureBox: { width: 200, alignItems: 'center' },
  signatureImage: { width: 160, height: 50, objectFit: 'contain' },
  signatureLine: { width: 160, borderBottomWidth: 1, borderBottomColor: '#0f172a', marginBottom: 3 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 28,
    right: 28,
    textAlign: 'right',
    fontSize: 7,
    color: '#64748b',
  },
})

export interface CampimetriaValidatedPDFData {
  reviewId: string
  signedAt: string | Date
  formatCode: string
  studyName: string
  patient: {
    fullName: string
    companyName: string | null
    ageYears: number | null
    eventDate: string
  }
  antecedentes: {
    usoLentes: string
    tiempoLentes: string
    cirugiasOculares: string
    causaCirugia: string
    diabetes: string
    hipertension: string
  }
  agudeza: {
    od: { lejanaSin: string; lejanaCon: string; cercanaSin: string; cercanaCon: string }
    oi: { lejanaSin: string; lejanaCon: string; cercanaSin: string; cercanaCon: string }
    pending: boolean
  }
  exploracionOd: Record<string, string>
  exploracionOi: Record<string, string>
  confrontacion: { od: string; oi: string }
  ishihara: {
    resultado: string
    od: Record<string, string>
    oi: Record<string, string>
  }
  resumenClinico: string
  impresionDiagnostica: string
  aptitud: string
  recomendaciones: string[]
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
  }
  logoUrl: string
  confrontacionOdImage?: string | null
  confrontacionOiImage?: string | null
  ishiharaImage?: string | null
}

function v(s: string | null | undefined): string {
  const t = (s ?? '').trim()
  return t || '—'
}

function fmtDate(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d)
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function CampimetriaValidatedPDF({ data }: { data: CampimetriaValidatedPDFData }) {
  const exploracionFields: Array<{ key: string; label: string }> = [
    { key: 'movimientos', label: 'MOVIMIENTOS OCULARES' },
    { key: 'reflejos', label: 'REFLEJOS PUPILARES' },
    { key: 'pupilas', label: 'PUPILAS' },
    { key: 'conjuntiva', label: 'CONJUNTIVA' },
    { key: 'esclera', label: 'ESCLERA' },
    { key: 'fondo_de_ojo', label: 'FONDO DE OJO' },
    { key: 'anexos', label: 'ANEXOS Y GLÁNDULAS' },
  ]

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>AMI</Text>
            <Text style={styles.brandSub}>Salud en el Trabajo</Text>
          </View>
          {data.logoUrl ? (
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.brand}>AMI</Text>
          )}
        </View>

        <Text style={styles.title}>REPORTE DE EXAMEN VISUAL</Text>
        <Text style={{ fontSize: 10, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 }}>
          {data.patient.fullName.toUpperCase()}
        </Text>

        <View style={styles.row2}>
          <Text style={styles.label}>NOMBRE:</Text>
          <Text style={styles.value}>{data.patient.fullName}</Text>
        </View>
        <View style={styles.row2}>
          <Text style={styles.label}>EMPRESA:</Text>
          <Text style={styles.value}>{v(data.patient.companyName)}</Text>
        </View>
        <View style={styles.row2}>
          <Text style={styles.label}>EDAD:</Text>
          <Text style={styles.value}>
            {data.patient.ageYears != null ? `${data.patient.ageYears} AÑOS` : '—'}
          </Text>
          <Text style={[styles.label, { width: 50, marginLeft: 8 }]}>FECHA:</Text>
          <Text style={styles.value}>{data.patient.eventDate}</Text>
        </View>

        <Text style={styles.sectionTitle}>Antecedentes oftalmológicos de importancia</Text>
        <View style={styles.row2}>
          <Text style={styles.label}>USO DE LENTES:</Text>
          <Text style={styles.value}>{data.antecedentes.usoLentes}</Text>
        </View>
        <View style={styles.row2}>
          <Text style={styles.label}>DESDE CUÁNTO:</Text>
          <Text style={styles.value}>{data.antecedentes.tiempoLentes}</Text>
        </View>
        <View style={styles.row2}>
          <Text style={styles.label}>CIRUGÍAS OCULARES:</Text>
          <Text style={styles.value}>{data.antecedentes.cirugiasOculares}</Text>
        </View>
        <View style={styles.row2}>
          <Text style={styles.label}>CAUSA CIRUGÍA:</Text>
          <Text style={styles.value}>{data.antecedentes.causaCirugia}</Text>
        </View>
        <View style={styles.row2}>
          <Text style={styles.label}>PADECE DIABETES:</Text>
          <Text style={styles.value}>{data.antecedentes.diabetes}</Text>
        </View>
        <View style={styles.row2}>
          <Text style={styles.label}>PADECE HTA:</Text>
          <Text style={styles.value}>{data.antecedentes.hipertension}</Text>
        </View>

        <Text style={styles.sectionTitle}>Agudeza visual</Text>
        {data.agudeza.pending ? (
          <Text style={styles.cell}>PENDIENTE EN PAPELETA</Text>
        ) : (
          <View style={styles.twoCol}>
            <View style={styles.col}>
              <Text style={styles.colTitle}>OJO DERECHO</Text>
              <Text style={styles.cell}>LEJANA SIN LENTES: {data.agudeza.od.lejanaSin}</Text>
              <Text style={styles.cell}>LEJANA CON LENTES: {data.agudeza.od.lejanaCon}</Text>
              <Text style={styles.cell}>CERCANA SIN LENTES: {data.agudeza.od.cercanaSin}</Text>
              <Text style={styles.cell}>CERCANA CON LENTES: {data.agudeza.od.cercanaCon}</Text>
            </View>
            <View style={styles.col}>
              <Text style={styles.colTitle}>OJO IZQUIERDO</Text>
              <Text style={styles.cell}>LEJANA SIN LENTES: {data.agudeza.oi.lejanaSin}</Text>
              <Text style={styles.cell}>LEJANA CON LENTES: {data.agudeza.oi.lejanaCon}</Text>
              <Text style={styles.cell}>CERCANA SIN LENTES: {data.agudeza.oi.cercanaSin}</Text>
              <Text style={styles.cell}>CERCANA CON LENTES: {data.agudeza.oi.cercanaCon}</Text>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Exploración oftalmológica</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.colTitle}>OJO DERECHO</Text>
            {exploracionFields.map(f => (
              <Text key={f.key} style={styles.cell}>
                {f.label}: {data.exploracionOd[f.key] ?? '—'}
              </Text>
            ))}
          </View>
          <View style={styles.col}>
            <Text style={styles.colTitle}>OJO IZQUIERDO</Text>
            {exploracionFields.map(f => (
              <Text key={f.key} style={styles.cell}>
                {f.label}: {data.exploracionOi[f.key] ?? '—'}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Campimetría de confrontación</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.cell}>OD: {data.confrontacion.od}</Text>
            {data.confrontacionOdImage ? (
              <Image style={styles.image} src={data.confrontacionOdImage} />
            ) : null}
          </View>
          <View style={styles.col}>
            <Text style={styles.cell}>OI: {data.confrontacion.oi}</Text>
            {data.confrontacionOiImage ? (
              <Image style={styles.image} src={data.confrontacionOiImage} />
            ) : null}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Prueba de Ishihara — {data.ishihara.resultado}</Text>
        {data.ishiharaImage ? <Image style={styles.image} src={data.ishiharaImage} /> : null}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <Text style={styles.tableHead}>OJO</Text>
            {ISHIHARA_PLATES.map(p => (
              <Text key={p.id} style={styles.tableHead}>
                {p.displayExpected ?? p.expected}
              </Text>
            ))}
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>OD</Text>
            {ISHIHARA_PLATES.map(p => (
              <Text key={p.id} style={styles.tableCell}>
                {data.ishihara.od[p.id] || '—'}
              </Text>
            ))}
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.tableCell}>OI</Text>
            {ISHIHARA_PLATES.map(p => (
              <Text key={p.id} style={styles.tableCell}>
                {data.ishihara.oi[p.id] || '—'}
              </Text>
            ))}
          </View>
        </View>

        <Text style={styles.summary}>{data.resumenClinico}</Text>

        <View style={styles.block}>
          <Text style={{ fontWeight: 'bold' }}>IMPRESIÓN DIAGNÓSTICA:</Text>
          <Text>{data.impresionDiagnostica}</Text>
        </View>
        <View style={styles.block}>
          <Text style={{ fontWeight: 'bold' }}>APTITUD SEGÚN HALLAZGOS FÍSICOS</Text>
          <Text>{data.aptitud}</Text>
        </View>
        {data.recomendaciones.length > 0 && (
          <View style={styles.block}>
            <Text style={{ fontWeight: 'bold' }}>RECOMENDACIONES:</Text>
            {data.recomendaciones.map((r, i) => (
              <Text key={i}>• {r}</Text>
            ))}
          </View>
        )}

        <View style={styles.signatureRow}>
          <View style={styles.signatureBox}>
            <Text style={{ fontSize: 7, marginBottom: 4 }}>REALIZÓ EXAMEN</Text>
          </View>
          <View style={styles.signatureBox}>
            <Text style={{ fontSize: 7, marginBottom: 4 }}>REVISÓ EXAMEN</Text>
            {data.medico.signatureImageUrl ? (
              <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
            ) : (
              <View style={styles.signatureLine} />
            )}
            <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{data.medico.fullName}</Text>
            <Text style={{ fontSize: 7 }}>CED. PROF. {data.medico.professionalLicense}</Text>
            <Text style={{ fontSize: 7, color: '#64748b' }}>{fmtDate(data.signedAt)}</Text>
          </View>
        </View>

        <Text style={styles.footer}>FORMATO: {data.formatCode}</Text>
      </Page>
    </Document>
  )
}
