/**
 * Plantilla PDF validado de Espirometría — 1 hoja carta.
 * Gráficas del informe fuente (flujo-volumen + volumen-tiempo) + bloque clínico AMI.
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { EspirometryAmiSectionData } from '@/lib/espirometry-ami-section'
import { formatAmiSectionMl } from '@/lib/espirometry-ami-section'

const styles = StyleSheet.create({
  page: {
    paddingTop: 14,
    paddingBottom: 52,
    paddingHorizontal: 14,
    fontFamily: 'Helvetica',
    fontSize: 7,
    color: '#0f172a',
    lineHeight: 1.3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#0f766e',
    paddingBottom: 6,
  },
  headerLeft: { flexDirection: 'column' },
  brand: { fontSize: 11, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 6, color: '#475569' },
  headerRight: { alignItems: 'flex-end', justifyContent: 'flex-start', width: 110 },
  logoImage: { width: 110, height: 40, objectFit: 'contain' },
  logoFallback: {
    width: 110,
    height: 40,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    textAlign: 'center',
    paddingTop: 12,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  docTitle: { fontSize: 10, fontWeight: 'bold', marginBottom: 2, color: '#0f172a' },
  docSubtitle: { fontSize: 6.5, color: '#475569', marginBottom: 6 },
  sourceWrap: {
    marginHorizontal: -14,
    marginBottom: 4,
  },
  sourceImage: {
    width: '100%',
    objectFit: 'contain',
  },
  clinicalPanel: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 0.75,
    borderTopColor: '#cbd5e1',
  },
  metricsGrid: {
    flexDirection: 'row',
    marginBottom: 4,
    gap: 8,
  },
  metricsCol: {
    flex: 1,
  },
  metricRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  metricLabel: {
    width: '52%',
    fontWeight: 'bold',
    fontSize: 6.5,
  },
  metricValue: {
    flex: 1,
    fontSize: 6.5,
  },
  block: {
    marginTop: 4,
    marginBottom: 2,
  },
  blockLabel: {
    fontWeight: 'bold',
    fontSize: 7,
    marginBottom: 2,
  },
  blockText: {
    fontSize: 7,
    lineHeight: 1.4,
  },
  signatureRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureLeft: { flex: 1 },
  signatureRight: { width: 120, alignItems: 'center' },
  signatureImage: { width: 90, height: 32, objectFit: 'contain' },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 14,
    right: 14,
    textAlign: 'center',
    fontSize: 5.5,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    lineHeight: 1.35,
  },
})

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

export interface EspirometryValidatedPDFData {
  reviewId: string
  signedAt: string | Date
  studyName: string
  studyType: string
  patient: {
    fullName: string
    universalId?: string | null
    companyName?: string | null
  }
  doctorStatus: 'REVIEWED_ACCEPTED' | 'REVIEWED_EDITED'
  doctorDiagnosis: string
  doctorNotes?: string | null
  recomendacionesValidadas: string[]
  amiSection: EspirometryAmiSectionData
  /** Recorte de gráficas del informe fuente (sin tabla, cabecera ni marca Sibelmed). */
  sourceCropDataUrl?: string | null
  /** Ancho/alto de las gráficas — para calcular altura a todo el ancho de carta. */
  sourceCropAspectRatio?: number | null
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
  }
  logoUrl: string
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  )
}

function AmiMetricsGrid({ ami }: { ami: EspirometryAmiSectionData }) {
  const pruebas =
    ami.pruebasAceptables !== null && ami.pruebasAceptables !== undefined
      ? String(ami.pruebasAceptables)
      : '—'

  return (
    <View style={styles.metricsGrid}>
      <View style={styles.metricsCol}>
        <MetricRow label="Repetibilidad FVC:" value={formatAmiSectionMl(ami.repetibilidadFvcMl)} />
        <MetricRow label="Repetibilidad FEV1:" value={formatAmiSectionMl(ami.repetibilidadFev1Ml)} />
        <MetricRow label="Pico Maximo:" value={ami.picoMaximo ?? '—'} />
        <MetricRow label="Forma Triangular:" value={ami.formaTriangular ?? '—'} />
        <MetricRow label="Libre de artefactos:" value={ami.libreArtefactos ?? '—'} />
      </View>
      <View style={styles.metricsCol}>
        <MetricRow label="Meseta:" value={ami.meseta ?? '—'} />
        <MetricRow label="Tiempo:" value={ami.tiempo ?? '—'} />
        <MetricRow label="Repetibilidad FVC < 200:" value={ami.repetibilidadFvcMenor200 ?? '—'} />
        <MetricRow label="Repetibilidad FEV1 < 200:" value={ami.repetibilidadFev1Menor200 ?? '—'} />
        <MetricRow label="#Pruebas aceptables:" value={pruebas} />
        <MetricRow label="Criterios para Dx:" value={ami.criteriosParaDx ?? '—'} />
        <MetricRow label="Calidad:" value={ami.calidad ?? '—'} />
      </View>
    </View>
  )
}

const LETTER_WIDTH_PT = 612
const SOURCE_IMAGE_MAX_HEIGHT_PT = 280

export const EspirometryValidatedPDF = ({ data }: { data: EspirometryValidatedPDFData }) => {
  const recomendacionesText =
    data.recomendacionesValidadas.length > 0
      ? data.recomendacionesValidadas.join(' ')
      : '—'
  const logoSrc = data.logoUrl
  const sourceImageHeight =
    data.sourceCropAspectRatio && data.sourceCropAspectRatio > 0
      ? Math.min(SOURCE_IMAGE_MAX_HEIGHT_PT, LETTER_WIDTH_PT / data.sourceCropAspectRatio)
      : 340

  return (
    <Document
      title={`Espirometria-${data.reviewId.slice(0, 8)}`}
      author={`Dr(a). ${data.medico.fullName}`}
      subject="Estudio de Espirometría validado"
    >
      <Page size="LETTER" style={styles.page}>
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
            {logoSrc ? (
              <Image style={styles.logoImage} src={logoSrc} />
            ) : (
              <Text style={styles.logoFallback}>SME</Text>
            )}
          </View>
        </View>

        <Text style={styles.docTitle}>Estudio de Espirometría Validado</Text>
        <Text style={styles.docSubtitle}>
          Folio de revisión: {data.reviewId} · Estado:{' '}
          {data.doctorStatus === 'REVIEWED_ACCEPTED' ? 'Aceptado' : 'Editado'} ·
          Firmado: {formatDate(data.signedAt)}
        </Text>

        <View style={styles.sourceWrap}>
          {data.sourceCropDataUrl ? (
            <Image
              style={[styles.sourceImage, { height: sourceImageHeight }]}
              src={data.sourceCropDataUrl}
            />
          ) : (
            <Text style={[styles.blockText, { color: '#64748b', paddingHorizontal: 14 }]}>
              Informe del equipo no disponible — ver PDF fuente en el módulo de pruebas clínicas.
            </Text>
          )}
        </View>

        <View style={styles.clinicalPanel}>
          <AmiMetricsGrid ami={data.amiSection} />

          <View style={styles.block}>
            <Text style={styles.blockLabel}>IMPRESIÓN DIAGNÓSTICA:</Text>
            <Text style={styles.blockText}>{data.doctorDiagnosis}</Text>
          </View>

          <View style={styles.block}>
            <Text style={styles.blockLabel}>RECOMENDACIONES:</Text>
            <Text style={styles.blockText}>{recomendacionesText}</Text>
          </View>

          {data.doctorNotes ? (
            <View style={styles.block}>
              <Text style={styles.blockLabel}>NOTAS:</Text>
              <Text style={styles.blockText}>{data.doctorNotes}</Text>
            </View>
          ) : null}

          <View style={styles.signatureRow}>
            <View style={styles.signatureLeft}>
              <Text>Realizó EM: {data.medico.fullName.toUpperCase()}</Text>
              <Text>Ced. Prof.: {data.medico.professionalLicense}</Text>
            </View>
            <View style={styles.signatureRight}>
              {data.medico.signatureImageUrl ? (
                <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
              ) : null}
            </View>
          </View>
        </View>

        <Text style={styles.footer} fixed>
          Administración Médica Industrial — Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro — (442) 225-52-67 — www.medicaindustrial.com
          {'\n'}Evaluaciones médicas · Outsourcing · Capacitación · Ergonomía · Fisioterapia · Nutrición
          {'\n'}Este documento es un reporte clínico validado por el médico firmante. Queda prohibida su alteración o reproducción no autorizada.
        </Text>
      </Page>
    </Document>
  )
}
