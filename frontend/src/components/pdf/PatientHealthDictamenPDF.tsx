import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { SME_BRAND_LINE } from '@/lib/brand-constants'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: { fontSize: 10, color: '#64748b', marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    backgroundColor: '#ecfdf5',
    padding: 6,
    marginBottom: 10,
    color: '#065f46',
  },
  row: { flexDirection: 'row', marginBottom: 6 },
  label: { width: 120, fontSize: 9, color: '#64748b', fontWeight: 'bold' },
  value: { flex: 1, fontSize: 10, color: '#0f172a' },
  body: { fontSize: 10, color: '#1e293b', lineHeight: 1.45 },
  disclaimer: {
    marginTop: 24,
    fontSize: 8,
    color: '#64748b',
    lineHeight: 1.35,
  },
  signatureArea: { marginTop: 32, alignItems: 'center' },
  signatureLine: {
    width: 220,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    marginBottom: 6,
  },
  signatureName: { fontSize: 10, fontWeight: 'bold' },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
})

export type PatientHealthDictamenPdfData = {
  signedAt: string | Date
  eventId: string
  worker: { firstName: string; lastName: string; universalId: string }
  healthRecommendations: string
  validator: { fullName: string }
  verdictId: string
}

export function PatientHealthDictamenPDF({ data }: { data: PatientHealthDictamenPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Recomendaciones de salud</Text>
        <Text style={styles.subtitle}>{SME_BRAND_LINE}</Text>

        <View>
          <Text style={styles.sectionTitle}>Información del paciente</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nombre:</Text>
            <Text style={styles.value}>
              {data.worker.firstName} {data.worker.lastName}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>ID paciente:</Text>
            <Text style={styles.value}>{data.worker.universalId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha:</Text>
            <Text style={styles.value}>
              {new Date(data.signedAt).toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={styles.sectionTitle}>Recomendaciones para su bienestar</Text>
          <Text style={styles.body}>{data.healthRecommendations}</Text>
        </View>

        <Text style={styles.disclaimer}>
          Este documento contiene orientaciones de salud personal. No incluye dictamen de aptitud
          ocupacional ni criterios de la empresa contratante. Para dudas clínicas, consulte a su
          médico tratante.
        </Text>

        <View style={styles.signatureArea}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureName}>Dr. {data.validator.fullName}</Text>
          <Text style={{ fontSize: 8, color: '#64748b' }}>Médico responsable</Text>
        </View>

        <Text style={styles.footer}>
          Documento confidencial para el paciente · Folio {data.eventId.slice(0, 8).toUpperCase()} ·{' '}
          {data.verdictId.slice(0, 8)}
        </Text>
      </Page>
    </Document>
  )
}
