import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { SME_BRAND_LINE, SME_LEGAL_NAME } from '@/lib/brand-constants'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica' },
  membrete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#0f172a',
  },
  membreteBrand: {
    flexDirection: 'column',
    maxWidth: '65%',
  },
  membreteLogo: {
    height: 40,
    width: 160,
    objectFit: 'contain',
    marginBottom: 6,
  },
  membreteLogoFallback: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 6,
  },
  membreteBrandTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#0f172a',
    letterSpacing: 0.8,
  },
  membreteBrandSubtitle: {
    fontSize: 9,
    color: '#475569',
    marginTop: 2,
  },
  membreteBrandSystem: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 2,
    fontStyle: 'italic',
  },
  membreteFolio: {
    alignItems: 'flex-end',
  },
  membreteFolioLabel: {
    fontSize: 7,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  membreteFolioValue: {
    fontSize: 10,
    color: '#0f172a',
    fontWeight: 'bold',
    marginTop: 2,
  },
  membreteFolioDate: {
    fontSize: 8,
    color: '#475569',
    marginTop: 4,
  },
  section: {
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginBottom: 6,
    color: '#0f172a',
  },
  headerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  headerCell: {
    width: '50%',
    flexDirection: 'row',
    marginBottom: 4,
  },
  headerCellThird: {
    width: '33.33%',
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#475569',
  },
  value: {
    flex: 1,
    fontSize: 8.5,
    color: '#0f172a',
  },
  studyRow: {
    marginBottom: 7,
    paddingLeft: 8,
  },
  studyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  studyName: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  studyBadge: {
    fontSize: 7,
    fontWeight: 'bold',
    color: '#047857',
    marginLeft: 6,
  },
  studyFindings: {
    fontSize: 8.5,
    color: '#334155',
    lineHeight: 1.35,
    paddingLeft: 8,
  },
  recommendationsBox: {
    padding: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
  },
  recommendationsText: {
    fontSize: 8.5,
    color: '#0f172a',
    lineHeight: 1.45,
  },
  disclaimer: {
    marginTop: 14,
    fontSize: 7.5,
    color: '#64748b',
    lineHeight: 1.35,
  },
  signatureArea: {
    marginTop: 22,
    alignItems: 'center',
  },
  signatureLine: {
    width: 200,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  signatureRole: {
    fontSize: 8,
    color: '#475569',
  },
  signatureLicense: {
    fontSize: 7.5,
    color: '#64748b',
    marginTop: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 7,
    color: '#94a3b8',
    textAlign: 'center',
  },
})

export type PatientHealthDictamenStudy = {
  serviceName: string
  findings: string
}

export type PatientHealthDictamenPdfData = {
  signedAt: string | Date
  eventId: string
  verdictId: string
  worker: {
    firstName: string
    lastName: string
    universalId: string
    companyName?: string | null
    age?: number | null
    gender?: string | null
    position?: string | null
  }
  healthRecommendations: string
  validator: {
    fullName: string
    professionalLicense?: string | null
  }
  studies?: PatientHealthDictamenStudy[] | null
  logoUrl?: string | null
}

export function PatientHealthDictamenPDF({ data }: { data: PatientHealthDictamenPdfData }) {
  const folio = `REC-${data.eventId.slice(0, 8).toUpperCase()}-${data.verdictId.slice(0, 8).toUpperCase()}`
  const dateFormatted = new Date(data.signedAt).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const shortDateFormatted = new Date(data.signedAt).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* MEMBRETE */}
        <View style={styles.membrete}>
          <View style={styles.membreteBrand}>
            {data.logoUrl ? (
              <Image style={styles.membreteLogo} src={data.logoUrl} />
            ) : (
              <Text style={styles.membreteLogoFallback}>SME</Text>
            )}
            <Text style={styles.membreteBrandTitle}>RECOMENDACIONES DE SALUD Y BIENESTAR</Text>
            <Text style={styles.membreteBrandSubtitle}>{SME_BRAND_LINE}</Text>
            <Text style={styles.membreteBrandSystem}>
              {SME_LEGAL_NAME} · Orientación preventiva de salud
            </Text>
          </View>
          <View style={styles.membreteFolio}>
            <Text style={styles.membreteFolioLabel}>Folio</Text>
            <Text style={styles.membreteFolioValue}>{folio}</Text>
            <Text style={[styles.membreteFolioLabel, { marginTop: 6 }]}>Fecha de emisión</Text>
            <Text style={styles.membreteFolioDate}>{dateFormatted}</Text>
            <Text style={[styles.membreteFolioLabel, { marginTop: 6 }]}>Tipo de documento</Text>
            <Text style={styles.membreteFolioDate}>Informativo para el paciente</Text>
          </View>
        </View>

        {/* I. DATOS DEL TRABAJADOR Y EMPRESA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. DATOS DEL PACIENTE / TRABAJADOR</Text>
          <View style={styles.headerGrid}>
            <View style={styles.headerCell}>
              <Text style={[styles.label, { width: 65 }]}>Nombre:</Text>
              <Text style={styles.value}>
                {data.worker.firstName} {data.worker.lastName}
              </Text>
            </View>
            <View style={styles.headerCell}>
              <Text style={[styles.label, { width: 50 }]}>Fecha:</Text>
              <Text style={styles.value}>{shortDateFormatted}</Text>
            </View>
            <View style={styles.headerCellThird}>
              <Text style={[styles.label, { width: 40 }]}>Sexo:</Text>
              <Text style={styles.value}>{data.worker.gender || '—'}</Text>
            </View>
            <View style={styles.headerCellThird}>
              <Text style={[styles.label, { width: 40 }]}>Edad:</Text>
              <Text style={styles.value}>
                {data.worker.age ? `${data.worker.age} años` : '—'}
              </Text>
            </View>
            <View style={styles.headerCellThird}>
              <Text style={[styles.label, { width: 50 }]}>Puesto:</Text>
              <Text style={styles.value}>{data.worker.position || '—'}</Text>
            </View>
            <View style={styles.headerCell}>
              <Text style={[styles.label, { width: 65 }]}>Empresa:</Text>
              <Text style={styles.value}>{data.worker.companyName || '—'}</Text>
            </View>
            <View style={styles.headerCell}>
              <Text style={[styles.label, { width: 65 }]}>ID Paciente:</Text>
              <Text style={styles.value}>{data.worker.universalId}</Text>
            </View>
          </View>
        </View>

        {/* II. ESTUDIOS REALIZADOS Y HALLAZGOS CLÍNICOS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. ESTUDIOS REALIZADOS Y HALLAZGOS CLÍNICOS</Text>
          {data.studies && data.studies.length > 0 ? (
            data.studies.map((study, idx) => (
              <View key={`${study.serviceName}-${idx}`} style={styles.studyRow}>
                <View style={styles.studyHeader}>
                  <Text style={styles.studyName}>• {study.serviceName}</Text>
                  <Text style={styles.studyBadge}>APLICADO</Text>
                </View>
                <Text style={styles.studyFindings}>
                  <Text style={{ fontWeight: 'bold' }}>Hallazgos: </Text>
                  {study.findings}
                </Text>
              </View>
            ))
          ) : (
            <Text style={[styles.studyFindings, { fontStyle: 'italic', color: '#64748b' }]}>
              Sin estudios paraclínicos adicionales registrados para este evento.
            </Text>
          )}
        </View>

        {/* III. RECOMENDACIONES MÉDICAS Y DE BIENESTAR */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. RECOMENDACIONES MÉDICAS Y DE BIENESTAR</Text>
          <View style={styles.recommendationsBox}>
            <Text style={styles.recommendationsText}>{data.healthRecommendations}</Text>
          </View>
        </View>

        {/* DISCLAIMER */}
        <Text style={styles.disclaimer}>
          Este documento contiene orientaciones de salud preventiva e individual orientadas a su
          bienestar. No incluye dictamen de aptitud ocupacional ni criterios de contratación de la
          empresa. Para dudas clínicas específicas, acuda a valoración con su médico tratante o
          especialista indicado.
        </Text>

        {/* FIRMA */}
        <View style={styles.signatureArea}>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureName}>Dr. {data.validator.fullName}</Text>
          <Text style={styles.signatureRole}>Médico Responsable SME</Text>
          {data.validator.professionalLicense ? (
            <Text style={styles.signatureLicense}>
              Céd. Prof.: {data.validator.professionalLicense}
            </Text>
          ) : null}
        </View>

        {/* FOOTER */}
        <Text style={styles.footer}>
          Documento confidencial para el paciente · Folio {folio} · {SME_LEGAL_NAME}
        </Text>
      </Page>
    </Document>
  )
}
