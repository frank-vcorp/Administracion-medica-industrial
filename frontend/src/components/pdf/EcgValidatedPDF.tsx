/**
 * Informe validado de electrocardiograma en reposo (formato AMI / RD2026).
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 56,
    paddingHorizontal: 36,
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
    lineHeight: 1.45,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#7c3aed',
    paddingBottom: 8,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  brand: { fontSize: 11, fontWeight: 'bold', color: '#6d28d9' },
  brandSub: { fontSize: 6.5, color: '#64748b', marginTop: 1 },
  logoImage: { width: 100, height: 36, objectFit: 'contain' },
  logoFallback: {
    width: 100,
    height: 36,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    textAlign: 'center',
    paddingTop: 10,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6d28d9',
  },
  patientGrid: { marginBottom: 10 },
  patientRow: { flexDirection: 'row', marginBottom: 3 },
  patientLabel: { fontWeight: 'bold', width: 72, color: '#6d28d9' },
  patientValue: { flex: 1 },
  studyTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6d28d9',
    marginTop: 6,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  narrative: { marginBottom: 14, textAlign: 'justify' },
  dxTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6d28d9',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  dxItem: { marginBottom: 4, paddingLeft: 4 },
  signatureArea: { marginTop: 22, alignItems: 'center' },
  signatureImage: { width: 120, height: 36, objectFit: 'contain', marginBottom: 4 },
  signatureLine: {
    width: 200,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    marginBottom: 4,
  },
  signatureName: { fontSize: 9, fontWeight: 'bold', textAlign: 'center' },
  signatureMeta: { fontSize: 8, textAlign: 'center', color: '#475569', marginTop: 2 },
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 6,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    lineHeight: 1.35,
  },
})

export interface EcgValidatedPDFData {
  reviewId: string
  signedAt: string | Date
  patient: {
    fullName: string
    sexLabel: string
    ageLabel: string
    companyName: string
  }
  narrativeParagraph: string
  diagnosisItems: string[]
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
  }
  logoUrl: string
}

const formatGender = (g: string | null | undefined): string => {
  if (!g) return '—'
  const u = g.toUpperCase()
  if (u === 'M' || u === 'MALE' || u === 'MASCULINO') return 'Masculino'
  if (u === 'F' || u === 'FEMALE' || u === 'FEMENINO') return 'Femenino'
  return g
}

export const EcgValidatedPDF = ({ data }: { data: EcgValidatedPDFData }) => {
  const logoSrc = data.logoUrl

  return (
    <Document
      title={`ECG-${data.reviewId.slice(0, 8)}`}
      author={`Dr(a). ${data.medico.fullName}`}
      subject="Electrocardiograma en reposo validado"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.brand}>Administración Médica Industrial</Text>
            <Text style={styles.brandSub}>Salud para tu empresa®</Text>
            <Text style={styles.brandSub}>
              Evaluaciones médicas · Outsourcing · Capacitación · Ergonomía · Fisioterapia · Nutrición
            </Text>
          </View>
          {logoSrc ? (
            <Image style={styles.logoImage} src={logoSrc} />
          ) : (
            <Text style={styles.logoFallback}>AMI</Text>
          )}
        </View>

        <View style={styles.patientGrid}>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>PACIENTE:</Text>
            <Text style={styles.patientValue}>{data.patient.fullName}</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>SEXO:</Text>
            <Text style={styles.patientValue}>{formatGender(data.patient.sexLabel)}</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>EDAD:</Text>
            <Text style={styles.patientValue}>{data.patient.ageLabel}</Text>
          </View>
          <View style={styles.patientRow}>
            <Text style={styles.patientLabel}>EMPRESA:</Text>
            <Text style={styles.patientValue}>{data.patient.companyName}</Text>
          </View>
        </View>

        <Text style={styles.studyTitle}>Tipo de estudio: Electrocardiograma en reposo</Text>

        <Text style={styles.narrative}>{data.narrativeParagraph}</Text>

        <Text style={styles.dxTitle}>Diagnóstico electrocardiográfico:</Text>
        {data.diagnosisItems.map((item, idx) => (
          <Text key={`dx-${idx}`} style={styles.dxItem}>
            {idx + 1}.- {item}
          </Text>
        ))}

        <View style={styles.signatureArea}>
          {data.medico.signatureImageUrl ? (
            <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
          ) : (
            <View style={styles.signatureLine} />
          )}
          <Text style={styles.signatureName}>{data.medico.fullName.toUpperCase()}</Text>
          <Text style={styles.signatureMeta}>Ced. Prof. {data.medico.professionalLicense}</Text>
          <Text style={styles.signatureMeta}>AMI SALUD RESPONSABLE S.A. DE C.V.</Text>
        </View>

        <Text style={styles.footer} fixed>
          Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro — (442) 225-52-67 —
          www.medicaindustrial.com
          {'\n'}
          Este documento es un reporte clínico validado por el médico firmante. Queda prohibida su alteración o
          reproducción no autorizada.
        </Text>
      </Page>
    </Document>
  )
}
