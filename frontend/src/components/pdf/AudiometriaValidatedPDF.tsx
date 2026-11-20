/**
 * PDF validado de Audiometría, en el formato institucional común.
 *
 * Los datos del estudio se componen aquí. Las gráficas no se redibujan:
 * son el recorte del audiograma del PDF que subió el usuario.
 *
 * El panel del médico no se arma aquí. Ahí siguen el índice de Fletcher,
 * su cálculo, el estado bilateral y la completitud documental.
 */
import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { SME_LEGAL_NAME, SME_PDF_FOOTER } from '@/lib/brand-constants'
import { PatientIdentificationPdfBlock } from '@/components/pdf/PatientIdentificationPdfBlock'
import type { AudiometriaFormatoReferencia } from '@/lib/audiometry-formato'
import type { PatientIdentificationPdf } from '@/lib/pdf/patient-identification'

const CONTENT_WIDTH = 584
const SOURCE_IMAGE_MAX_HEIGHT = 210

const styles = StyleSheet.create({
  page: {
    paddingTop: 14,
    paddingBottom: 48,
    paddingHorizontal: 14,
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#0f766e',
    paddingBottom: 4,
  },
  headerLeft: { flexDirection: 'column' },
  brand: { fontSize: 11, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 6, color: '#475569' },
  headerRight: { width: 110, alignItems: 'flex-end' },
  logoImage: { width: 110, height: 36, objectFit: 'contain' },
  logoFallback: {
    width: 110,
    height: 36,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    textAlign: 'center',
    paddingTop: 10,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  docTitle: { fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
  infoGrid: { flexDirection: 'row', marginBottom: 4, gap: 8 },
  infoCol: { flex: 1 },
  infoLine: { fontSize: 6.5, marginBottom: 1 },
  infoLabel: { fontWeight: 'bold', color: '#475569' },
  sourceWrap: { marginBottom: 4, alignItems: 'center' },
  sourceImage: { objectFit: 'contain' },
  missingCrop: { fontSize: 7, color: '#64748b', marginBottom: 4 },
  table: { borderWidth: 0.6, borderColor: '#334155', marginBottom: 4 },
  tableRow: { flexDirection: 'row' },
  th: {
    fontSize: 6,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 2,
    borderRightWidth: 0.4,
    borderBottomWidth: 0.6,
    borderColor: '#334155',
  },
  td: {
    fontSize: 7,
    textAlign: 'center',
    paddingVertical: 2,
    borderRightWidth: 0.4,
    borderColor: '#334155',
  },
  examLine: { flexDirection: 'row', marginBottom: 1 },
  examLabel: { width: 48, fontSize: 7, fontWeight: 'bold' },
  examValue: { flex: 1, fontSize: 7 },
  sectionLine: { flexDirection: 'row', marginTop: 2 },
  sectionLabel: { fontSize: 7, fontWeight: 'bold', marginRight: 3 },
  sectionValue: { flex: 1, fontSize: 7 },
  dxTitle: { textAlign: 'center', fontSize: 8, fontWeight: 'bold', marginTop: 3 },
  earTitle: { fontSize: 7, fontWeight: 'bold', marginTop: 2 },
  dxRow: { flexDirection: 'row' },
  dxCol: { flex: 1, paddingRight: 4 },
  dxLabel: { fontSize: 6, fontWeight: 'bold', color: '#475569' },
  dxValue: { fontSize: 7 },
  signatureArea: { marginTop: 6, flexDirection: 'row', justifyContent: 'flex-end' },
  signatureBox: { width: 200, alignItems: 'center' },
  signatureImage: { width: 100, height: 28, objectFit: 'contain', marginBottom: 2 },
  signatureBlank: { width: 100, height: 28, marginBottom: 2 },
  signatureName: { fontSize: 7, fontWeight: 'bold', textAlign: 'center' },
  signatureMeta: { fontSize: 6.5, textAlign: 'center', color: '#475569' },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 14,
    right: 14,
    textAlign: 'center',
    fontSize: 5.5,
    color: '#64748b',
    borderTopWidth: 0.6,
    borderTopColor: '#e2e8f0',
    paddingTop: 4,
    lineHeight: 1.35,
  },
})

export interface AudiometriaValidatedPDFData {
  reviewId: string
  signedAt: string | Date
  studyName: string
  studyType: string
  patient: PatientIdentificationPdf
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  doctorDiagnosis: string
  doctorNotes?: string | null
  frecuencias: number[]
  taOd: Record<number, number | null>
  taOi: Record<number, number | null>
  voOd: Record<number, number | null>
  voOi: Record<number, number | null>
  recomendacionesValidadas: string[]
  formato: AudiometriaFormatoReferencia
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
  }
  logoUrl: string
  /** Recorte del audiograma del PDF subido. No se redibuja. */
  sourceCropDataUrl?: string | null
  sourceCropAspectRatio?: number | null
}

function valor(texto: string | null | undefined): string {
  const limpio = texto?.trim()
  return limpio ? limpio : '—'
}

function celda(umbral: number | null | undefined): string {
  return typeof umbral === 'number' && Number.isFinite(umbral) ? String(umbral) : '—'
}

function InfoLine({ label, value }: { label: string; value: string | null }) {
  return (
    <Text style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label} </Text>
      {valor(value)}
    </Text>
  )
}

const COLS = [42, 58, 64, 64, 64, 120, 172]

export const AudiometriaValidatedPDF = ({
  data,
}: {
  data: AudiometriaValidatedPDFData
}) => {
  const formato = data.formato
  const aspect =
    data.sourceCropAspectRatio && data.sourceCropAspectRatio > 0
      ? data.sourceCropAspectRatio
      : null
  const imageHeight = aspect
    ? Math.min(SOURCE_IMAGE_MAX_HEIGHT, CONTENT_WIDTH / aspect)
    : SOURCE_IMAGE_MAX_HEIGHT

  return (
    <Document
      title={`Audiometria-${data.reviewId.slice(0, 8)}`}
      author={data.medico.fullName}
      subject="Estudio de audiometría validado"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header} fixed>
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

        <Text style={styles.docTitle}>Estudio de Audiometría</Text>

        <PatientIdentificationPdfBlock
          patient={data.patient}
          heading="Identificación del paciente"
        />

        <View style={styles.infoGrid}>
          <View style={styles.infoCol}>
            <InfoLine label="Nacimiento" value={formato.nacimiento} />
            <InfoLine label="Notas" value={formato.notasPaciente} />
          </View>
          <View style={styles.infoCol}>
            <InfoLine label="Fecha del estudio" value={formato.fechaEstudio} />
            <InfoLine label="Hora" value={formato.horaEstudio} />
            <InfoLine label="Notas de prueba" value={formato.notasPrueba} />
          </View>
          <View style={styles.infoCol}>
            <InfoLine label="Audiómetro" value={formato.audiometro} />
            <InfoLine label="Transductor" value={formato.transductor} />
            <InfoLine label="Número de serie" value={formato.numeroSerie} />
            <InfoLine label="Última calibración" value={formato.ultimaCalibracion} />
          </View>
        </View>

        {data.sourceCropDataUrl ? (
          <View style={styles.sourceWrap}>
            <Image
              style={[styles.sourceImage, { width: CONTENT_WIDTH, height: imageHeight }]}
              src={data.sourceCropDataUrl}
            />
          </View>
        ) : (
          <Text style={styles.missingCrop}>
            Audiograma del archivo fuente no disponible.
          </Text>
        )}

        <View style={styles.table}>
          <View style={styles.tableRow}>
            {[
              'OIDO',
              '500 Hz',
              '1000Hz',
              '2000 Hz',
              '3000 Hz',
              'Perdida por Oido',
              'Hipoacusia Bilateral Combinada',
            ].map((titulo, index) => (
              <Text key={titulo} style={[styles.th, { width: COLS[index] }]}>
                {titulo}
              </Text>
            ))}
          </View>
          <View style={styles.tableRow}>
            {[
              'OD',
              celda(data.taOd[500]),
              celda(data.taOd[1000]),
              celda(data.taOd[2000]),
              celda(data.taOd[3000]),
              formato.perdidaPorOidoOd ?? '—',
              formato.hipoacusiaBilateralCombinada ?? '—',
            ].map((texto, index) => (
              <Text key={`od-${index}`} style={[styles.td, { width: COLS[index] }]}>
                {texto}
              </Text>
            ))}
          </View>
          <View style={styles.tableRow}>
            {[
              'OI',
              celda(data.taOi[500]),
              celda(data.taOi[1000]),
              celda(data.taOi[2000]),
              celda(data.taOi[3000]),
              formato.perdidaPorOidoOi ?? '—',
              '',
            ].map((texto, index) => (
              <Text key={`oi-${index}`} style={[styles.td, { width: COLS[index] }]}>
                {texto}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.examLine}>
          <Text style={styles.examLabel}>FARINGE</Text>
          <Text style={styles.examValue}>{valor(formato.faringe)}</Text>
        </View>
        <View style={styles.examLine}>
          <Text style={styles.examLabel}>CAD</Text>
          <Text style={styles.examValue}>{valor(formato.cad)}</Text>
          <Text style={styles.examLabel}>CAI</Text>
          <Text style={styles.examValue}>{valor(formato.cai)}</Text>
        </View>
        <View style={styles.examLine}>
          <Text style={styles.examLabel}>MTD</Text>
          <Text style={styles.examValue}>{valor(formato.mtd)}</Text>
          <Text style={styles.examLabel}>MTI</Text>
          <Text style={styles.examValue}>{valor(formato.mti)}</Text>
        </View>

        <View style={styles.sectionLine}>
          <Text style={styles.sectionLabel}>DESCRIPCIÓN AUDIOMÉTRICA:</Text>
          <Text style={styles.sectionValue}>{formato.descripcionAudiometrica}</Text>
        </View>

        <Text style={styles.dxTitle}>DIAGNOSTICO AUDIOMETRICO</Text>
        <Text style={styles.earTitle}>Oído derecho</Text>
        <View style={styles.dxRow}>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>Nosológico</Text>
            <Text style={styles.dxValue}>{valor(formato.diagnosticoNosologicoOd)}</Text>
          </View>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>Etiológico</Text>
            <Text style={styles.dxValue}>{valor(formato.diagnosticoEtiologicoOd)}</Text>
          </View>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>Clasificación</Text>
            <Text style={styles.dxValue}>{valor(formato.clasificacionHipoacusiaOd)}</Text>
          </View>
        </View>
        <Text style={styles.earTitle}>Oído izquierdo</Text>
        <View style={styles.dxRow}>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>Nosológico</Text>
            <Text style={styles.dxValue}>{valor(formato.diagnosticoNosologicoOi)}</Text>
          </View>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>Etiológico</Text>
            <Text style={styles.dxValue}>{valor(formato.diagnosticoEtiologicoOi)}</Text>
          </View>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>Clasificación</Text>
            <Text style={styles.dxValue}>{valor(formato.clasificacionHipoacusiaOi)}</Text>
          </View>
        </View>

        <View style={styles.sectionLine}>
          <Text style={styles.sectionLabel}>RECOMENDACIONES:</Text>
          <Text style={styles.sectionValue}>{formato.recomendacionesTexto}</Text>
        </View>

        <View style={styles.signatureArea}>
          <View style={styles.signatureBox}>
            {data.medico.signatureImageUrl ? (
              <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
            ) : (
              <View style={styles.signatureBlank} />
            )}
            <Text style={styles.signatureName}>
              Realizó EM: {data.medico.fullName.toUpperCase()}
            </Text>
            <Text style={styles.signatureMeta}>
              Ced. Prof.: {valor(data.medico.professionalLicense)}
            </Text>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          {SME_PDF_FOOTER}
          {'\n'}Evaluaciones médicas · Outsourcing · Capacitación · Ergonomía · Fisioterapia · Nutrición
          {'\n'}Este documento es un reporte clínico validado por el médico firmante.
        </Text>
      </Page>
    </Document>
  )
}
