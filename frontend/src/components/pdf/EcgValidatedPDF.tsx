/**
 * Informe validado de electrocardiograma — mismo formato visual que
 * Audiometría / reportes clínicos AMI (membrete teal, secciones numeradas).
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { PatientIdentificationPdfBlock } from '@/components/pdf/PatientIdentificationPdfBlock'
import type { PatientIdentificationPdf } from '@/lib/pdf/patient-identification'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a' },
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
  docTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#0f172a' },
  docSubtitle: { fontSize: 9, color: '#475569', marginBottom: 14 },
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
  bulletItem: { fontSize: 9, marginLeft: 8, marginBottom: 3 },
  verdictBox: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
    marginBottom: 6,
  },
  signatureArea: { marginTop: 36, flexDirection: 'row', justifyContent: 'flex-end' },
  signatureBox: { width: 240, alignItems: 'center' },
  signatureImage: { width: 200, height: 70, objectFit: 'contain', marginBottom: 4 },
  signatureLine: { width: 200, borderBottomWidth: 1, borderBottomColor: '#0f172a', marginBottom: 4 },
  signatureName: { fontSize: 10, fontWeight: 'bold', color: '#0f172a' },
  signatureLicense: { fontSize: 9, color: '#475569' },
  signatureDate: { fontSize: 8, color: '#94a3b8', marginTop: 2 },
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

export interface EcgValidatedPDFData {
  reviewId: string
  signedAt: string | Date
  studyName: string
  studyType: string
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  patient: PatientIdentificationPdf
  narrativeParagraph: string
  diagnosisItems: string[]
  doctorNotes?: string | null
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
  }
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

export const EcgValidatedPDF = ({ data }: { data: EcgValidatedPDFData }) => (
  <Document
    title={`ECG-validado-${data.reviewId.slice(0, 8)}`}
    author={`Dr(a). ${data.medico.fullName}`}
    subject="Reporte de Electrocardiograma validado por el médico"
  >
    <Page size="A4" style={styles.page}>
      <View style={styles.header} fixed>
        <View style={styles.headerLeft}>
          <Text style={styles.brand}>Administración Médica Industrial</Text>
          <Text style={styles.brandSub}>
            Evaluaciones médicas · Outsourcing · Capacitación
          </Text>
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

      <Text style={styles.docTitle}>Reporte de Electrocardiograma Validado</Text>

      <PatientIdentificationPdfBlock
        patient={data.patient}
        heading="Identificación del paciente"
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>I. Interpretación del trazado</Text>
        <Text style={styles.paragraph}>{data.narrativeParagraph}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          II. Diagnóstico electrocardiográfico (validado por el médico)
        </Text>
        {data.diagnosisItems.length === 0 ? (
          <View style={styles.verdictBox}>
            <Text style={styles.paragraph}>—</Text>
          </View>
        ) : (
          data.diagnosisItems.map((item, idx) => (
            <Text key={`dx-${idx}`} style={styles.bulletItem}>
              {idx + 1}. {item}
            </Text>
          ))
        )}
      </View>

      {data.doctorNotes?.trim() ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. Notas clínicas</Text>
          <Text style={styles.paragraph}>{data.doctorNotes.trim()}</Text>
        </View>
      ) : null}

      <View style={styles.signatureArea}>
        <View style={styles.signatureBox}>
          {data.medico.signatureImageUrl ? (
            <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
          ) : (
            <View style={styles.signatureLine} />
          )}
          <Text style={styles.signatureName}>Dr(a). {data.medico.fullName}</Text>
          <Text style={styles.signatureLicense}>
            Cédula profesional: {data.medico.professionalLicense}
          </Text>
          <Text style={styles.signatureDate}>Fecha y hora: {formatDate(data.signedAt)}</Text>
        </View>
      </View>

      <Text style={styles.footer} fixed>
        Administración Médica Industrial — Circuito del Mesón #135, Col. Del Prado, C.P. 76030,
        Santiago de Querétaro — (442) 225-52-67 — www.medicaindustrial.com
        {'\n'}Evaluaciones médicas · Outsourcing · Capacitación · Ergonomía · Fisioterapia ·
        Nutrición
        {'\n'}Este documento es un reporte clínico validado por el médico firmante. Queda
        prohibida su alteración o reproducción no autorizada.
      </Text>
    </Page>
  </Document>
)
