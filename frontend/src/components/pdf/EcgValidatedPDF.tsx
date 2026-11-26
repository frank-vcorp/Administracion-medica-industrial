/**
 * Informe validado oficial SME — ELECTROCARDIOGRAMA EN REPOSO.
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { SME_PDF_FOOTER } from '@/lib/brand-constants'
import type { PatientIdentificationPdf } from '@/lib/pdf/patient-identification'

const SME_PURPLE = '#592c82'
const SME_TEAL_BORDER = '#7cc0b9'

const styles = StyleSheet.create({
  page: {
    paddingTop: 34,
    paddingBottom: 68,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10.5,
    color: '#0f172a',
    lineHeight: 1.5,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 10,
  },
  logoImage: {
    width: 124,
    height: 48,
    objectFit: 'contain',
  },
  logoFallback: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  metaBlock: {
    marginBottom: 24,
  },
  metaLine: {
    fontSize: 10,
    fontWeight: 'bold',
    color: SME_PURPLE,
    marginBottom: 2,
  },
  studyTitleBlock: {
    alignItems: 'center',
    marginBottom: 22,
  },
  studyTypeHeading: {
    fontSize: 11,
    fontWeight: 'bold',
    color: SME_PURPLE,
    marginBottom: 3,
  },
  studyTitleMain: {
    fontSize: 14.5,
    fontWeight: 'bold',
    color: SME_PURPLE,
    letterSpacing: 0.3,
  },
  narrativeParagraph: {
    fontSize: 10.5,
    lineHeight: 1.55,
    color: '#0f172a',
    textAlign: 'justify',
    marginBottom: 26,
  },
  diagnosisHeading: {
    fontSize: 10.5,
    fontWeight: 'bold',
    color: SME_PURPLE,
    textAlign: 'center',
    marginBottom: 16,
  },
  diagnosisList: {
    marginBottom: 16,
  },
  diagnosisItem: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#0f172a',
    marginBottom: 4,
  },
  recBlock: {
    marginTop: 10,
    padding: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 0.75,
    borderColor: '#e2e8f0',
    borderRadius: 3,
  },
  recTitle: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: SME_PURPLE,
    marginBottom: 3,
  },
  recText: {
    fontSize: 9,
    color: '#334155',
    lineHeight: 1.4,
  },
  signatureArea: {
    marginTop: 42,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  signatureBox: {
    width: 240,
    alignItems: 'center',
  },
  signatureImage: {
    width: 155,
    height: 54,
    objectFit: 'contain',
    marginBottom: 3,
  },
  signatureLine: {
    width: 190,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    marginBottom: 4,
  },
  signatureMeta: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 1,
  },
  signatureSubDate: {
    fontSize: 7.5,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 36,
    right: 36,
    borderTopWidth: 1.25,
    borderTopColor: SME_TEAL_BORDER,
    paddingTop: 5,
    textAlign: 'center',
  },
  footerServices: {
    fontSize: 7,
    color: '#0f766e',
    marginBottom: 2,
  },
  footerAddress: {
    fontSize: 6.5,
    color: '#64748b',
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
  recommendations?: string | null
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
    timeZone: 'America/Mexico_City',
  })
}

export const EcgValidatedPDF = ({ data }: { data: EcgValidatedPDFData }) => {
  const doctorUpper = data.medico.fullName.trim().toUpperCase()
  const doctorLine = /^(DR\.|DRA\.|DR\(A\))/i.test(doctorUpper)
    ? doctorUpper
    : `DR(A). ${doctorUpper}`

  return (
    <Document
      title={`ECG-validado-${data.reviewId.slice(0, 8)}`}
      author={data.medico.fullName}
      subject="Electrocardiograma en Reposo validado por el médico"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.topBar} fixed>
          {data.logoUrl ? (
            // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image does not accept HTML alt prop
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.logoFallback}>SOLUCIONES MÉDICO EMPRESARIALES</Text>
          )}
        </View>

        <View style={styles.metaBlock}>
          <Text style={styles.metaLine}>
            PACIENTE: {data.patient.fullName.toUpperCase()}
          </Text>
          <Text style={styles.metaLine}>
            SEXO: {(data.patient.sexLabel || '—').toUpperCase()}
          </Text>
          <Text style={styles.metaLine}>
            EDAD: {(data.patient.ageLabel || '—').toUpperCase()}
          </Text>
          <Text style={styles.metaLine}>
            EMPRESA: {(data.patient.companyName || '—').toUpperCase()}
          </Text>
        </View>

        <View style={styles.studyTitleBlock}>
          <Text style={styles.studyTypeHeading}>TIPO DE ESTUDIO</Text>
          <Text style={styles.studyTitleMain}>
            {(data.studyName || 'ELECTROCARDIOGRAMA EN REPOSO').toUpperCase()}
          </Text>
        </View>

        <Text style={styles.narrativeParagraph}>{data.narrativeParagraph}</Text>

        <Text style={styles.diagnosisHeading}>DIAGNÓSTICO ELECTROCARDIOGRÁFICO:</Text>

        <View style={styles.diagnosisList}>
          {data.diagnosisItems.length === 0 ? (
            <Text style={styles.diagnosisItem}>1.- Sin impresión diagnóstica especificada.</Text>
          ) : (
            data.diagnosisItems.map((item, idx) => (
              <Text key={`dx-${idx}`} style={styles.diagnosisItem}>
                {idx + 1}.- {item}
              </Text>
            ))
          )}
        </View>

        {data.recommendations?.trim() ? (
          <View style={styles.recBlock}>
            <Text style={styles.recTitle}>OBSERVACIONES Y SEGUIMIENTO</Text>
            <Text style={styles.recText}>{data.recommendations.trim()}</Text>
          </View>
        ) : null}

        <View style={styles.signatureArea} wrap={false}>
          <View style={styles.signatureBox}>
            {data.medico.signatureImageUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer Image does not accept HTML alt prop
              <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
            ) : (
              <View style={styles.signatureLine} />
            )}
            <Text style={styles.signatureMeta}>{doctorLine}</Text>
            <Text style={styles.signatureMeta}>
              CED. PROF. {data.medico.professionalLicense}
            </Text>
            <Text style={styles.signatureMeta}>SOLUCIONES MEDICO EMPRESARIALES</Text>
            <Text style={styles.signatureSubDate}>
              Validado: {formatDate(data.signedAt)}
            </Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerServices}>
            Evaluaciones Médicas · Servicio de Personal Médico · Capacitación en salud · Ergonomía · Fisioterapia · Nutrición · Ambulancia
          </Text>
          <Text style={styles.footerAddress}>{SME_PDF_FOOTER}</Text>
        </View>
      </Page>
    </Document>
  )
}
