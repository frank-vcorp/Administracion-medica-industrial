/**
 * Plantilla PDF validada de Interpretación de Rayos X — formato institucional SME.
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { SME_PDF_FOOTER } from '@/lib/brand-constants'
import { formatRayosXLongDateEsMx } from '@/lib/clinical/rayos-x-report'

const SME_PURPLE = '#592c82'
const SME_TEAL_BORDER = '#7cc0b9'

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 68,
    paddingHorizontal: 46,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#0f172a',
    lineHeight: 1.45,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleSpacer: {
    width: 90,
  },
  docTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: 'bold',
    color: SME_PURPLE,
    letterSpacing: 0.4,
  },
  logoWrap: {
    width: 118,
    alignItems: 'flex-end',
  },
  logoImage: {
    width: 112,
    height: 44,
    objectFit: 'contain',
  },
  logoFallback: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  dateRow: {
    textAlign: 'right',
    fontSize: 9.5,
    color: '#1e293b',
    marginBottom: 10,
  },
  metaBlock: {
    marginBottom: 16,
  },
  metaLine: {
    fontSize: 10,
    fontWeight: 'bold',
    color: SME_PURPLE,
    marginBottom: 2,
  },
  findingsBlock: {
    marginBottom: 14,
  },
  paragraph: {
    fontSize: 10,
    lineHeight: 1.5,
    color: '#0f172a',
    marginBottom: 8,
    textIndent: 24,
    textAlign: 'justify',
  },
  sectionHeading: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 8,
    marginBottom: 8,
    textIndent: 24,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 5,
    paddingLeft: 10,
    paddingRight: 8,
  },
  bulletMark: {
    width: 14,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#0f172a',
    lineHeight: 1.4,
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
    fontSize: 8.5,
    color: '#334155',
    lineHeight: 1.35,
  },
  signatureArea: {
    marginTop: 28,
    alignItems: 'center',
  },
  signatureImage: {
    width: 145,
    height: 52,
    objectFit: 'contain',
    marginBottom: 3,
  },
  signatureLine: {
    width: 180,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 10,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 2,
  },
  signatureMeta: {
    fontSize: 9.5,
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 1,
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

export interface RayosXValidatedPDFData {
  reviewId: string
  signedAt: string | Date
  studyTypeLabel: string
  patientName: string
  companyName: string
  universalId?: string | null
  findingsParagraphs: string[]
  impressionItems: string[]
  recommendations?: string | null
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
    title?: string
  }
  logoUrl: string
}

export const RayosXValidatedPDF = ({ data }: { data: RayosXValidatedPDFData }) => (
  <Document
    title={`Interpretacion-Rayos-X-${data.universalId || data.reviewId.slice(0, 8)}`}
    author={data.medico.fullName}
    subject="Interpretación de Rayos X validada"
  >
    <Page size="LETTER" style={styles.page}>
      <View style={styles.topBar} fixed>
        <View style={styles.titleSpacer} />
        <Text style={styles.docTitle}>INTERPRETACIÓN DE RAYOS X</Text>
        <View style={styles.logoWrap}>
          {data.logoUrl ? (
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.logoFallback}>SOLUCIONES MÉDICO EMPRESARIALES</Text>
          )}
        </View>
      </View>

      <Text style={styles.dateRow}>{formatRayosXLongDateEsMx(data.signedAt)}</Text>

      <View style={styles.metaBlock}>
        <Text style={styles.metaLine}>NOMBRE DEL PACIENTE: {data.patientName}</Text>
        <Text style={styles.metaLine}>EMPRESA: {data.companyName}</Text>
        <Text style={styles.metaLine}>TIPO DE RADIOGRAFÍA: {data.studyTypeLabel}</Text>
      </View>

      <View style={styles.findingsBlock}>
        {data.findingsParagraphs.map((paragraph, idx) => (
          <Text key={`finding-${idx}`} style={styles.paragraph}>
            {paragraph}
          </Text>
        ))}
      </View>

      <View>
        <Text style={styles.sectionHeading}>IMPRESIÓN DIAGNÓSTICA:</Text>
        {data.impressionItems.map((item, idx) => (
          <View key={`imp-${idx}`} style={styles.bulletRow}>
            <Text style={styles.bulletMark}>•</Text>
            <Text style={styles.bulletText}>{item}</Text>
          </View>
        ))}
      </View>

      {data.recommendations?.trim() ? (
        <View style={styles.recBlock}>
          <Text style={styles.recTitle}>RECOMENDACIONES:</Text>
          <Text style={styles.recText}>{data.recommendations.trim()}</Text>
        </View>
      ) : null}

      <View style={styles.signatureArea}>
        {data.medico.signatureImageUrl ? (
          <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
        ) : (
          <View style={styles.signatureLine} />
        )}
        <Text style={styles.signatureName}>{data.medico.fullName}</Text>
        <Text style={styles.signatureMeta}>
          {data.medico.title || 'Médico Validador — Salud Ocupacional'}
        </Text>
        <Text style={styles.signatureMeta}>
          Ced. Prof. {data.medico.professionalLicense || '—'}
        </Text>
      </View>

      <View style={styles.footer} fixed>
        <Text style={styles.footerServices}>
          Evaluaciones Médicas • Servicio de Personal Médico • Capacitación en salud • Ergonomía • Fisioterapia • Nutrición • Ambulancia
        </Text>
        <Text style={styles.footerAddress}>{SME_PDF_FOOTER}</Text>
      </View>
    </Page>
  </Document>
)
