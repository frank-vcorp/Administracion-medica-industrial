/**
 * Plantilla PDF validado de Espirometría — layout AMI híbrido.
 * Parte superior: recorte fiel del PDF del espirómetro (tabla + gráficas).
 * Parte inferior: bloque AMI generado (calidad, impresión, recomendaciones, firma).
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { EspirometryAmiSectionData } from '@/lib/espirometry-ami-section'
import { formatAmiSectionMl } from '@/lib/espirometry-ami-section'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#000000',
    paddingBottom: 72,
  },
  sourceImage: {
    width: '100%',
    objectFit: 'contain',
  },
  amiBlock: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  metricItem: {
    flexDirection: 'row',
    marginRight: 12,
    marginBottom: 2,
  },
  metricLabel: {
    fontWeight: 'bold',
    marginRight: 4,
  },
  metricValue: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minWidth: 36,
    paddingBottom: 1,
  },
  sectionHeading: {
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    fontSize: 10,
  },
  paragraph: {
    lineHeight: 1.45,
    marginBottom: 6,
  },
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 16,
    paddingHorizontal: 28,
  },
  signatureLeft: {
    flex: 1,
  },
  signatureRight: {
    width: 180,
    alignItems: 'center',
  },
  signatureImage: {
    width: 160,
    height: 60,
    objectFit: 'contain',
  },
  footerRule: {
    position: 'absolute',
    bottom: 48,
    left: 28,
    right: 28,
    borderTopWidth: 1,
    borderTopColor: '#0f766e',
    paddingTop: 6,
  },
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 28,
    right: 28,
    fontSize: 7,
    color: '#0f766e',
    lineHeight: 1.35,
  },
  footerTagline: {
    position: 'absolute',
    bottom: 18,
    right: 28,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f766e',
  },
})

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
  /** Recorte PNG (data URL) de la zona superior del PDF Sibelmed */
  sourceCropDataUrl?: string | null
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

function MetricItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  )
}

function AmiMetrics({ ami }: { ami: EspirometryAmiSectionData }) {
  return (
    <View>
      <View style={styles.metricsRow}>
        <MetricItem
          label="Repetibilidad FVC:"
          value={formatAmiSectionMl(ami.repetibilidadFvcMl)}
        />
        <MetricItem label="FEV1:" value={formatAmiSectionMl(ami.repetibilidadFev1Ml)} />
      </View>
      <View style={styles.metricsRow}>
        <MetricItem label="Pico Maximo:" value={ami.picoMaximo ?? '—'} />
        <MetricItem label="Forma Triangular:" value={ami.formaTriangular ?? '—'} />
        <MetricItem label="Libre de artefactos:" value={ami.libreArtefactos ?? '—'} />
        <MetricItem label="Meseta:" value={ami.meseta ?? '—'} />
        <MetricItem label="Tiempo:" value={ami.tiempo ?? '—'} />
      </View>
      <View style={styles.metricsRow}>
        <MetricItem
          label="Repetibilidad FVC < 200:"
          value={ami.repetibilidadFvcMenor200 ?? '—'}
        />
        <MetricItem
          label="Repetibilidad FEV1 < 200:"
          value={ami.repetibilidadFev1Menor200 ?? '—'}
        />
      </View>
      <View style={styles.metricsRow}>
        <MetricItem
          label="#Pruebas aceptables:"
          value={
            ami.pruebasAceptables !== null && ami.pruebasAceptables !== undefined
              ? String(ami.pruebasAceptables)
              : '—'
          }
        />
        <MetricItem label="Criterios para Dx:" value={ami.criteriosParaDx ?? '—'} />
        <MetricItem label="Calidad:" value={ami.calidad ?? '—'} />
      </View>
    </View>
  )
}

export const EspirometryValidatedPDF = ({ data }: { data: EspirometryValidatedPDFData }) => {
  const recomendacionesText =
    data.recomendacionesValidadas.length > 0
      ? data.recomendacionesValidadas.join(' ')
      : '—'

  return (
    <Document
      title={`Espirometria-${data.reviewId.slice(0, 8)}`}
      author={`Dr(a). ${data.medico.fullName}`}
      subject="Estudio de Espirometría validado"
    >
      <Page size="LETTER" style={styles.page}>
        {data.sourceCropDataUrl ? (
          <Image style={styles.sourceImage} src={data.sourceCropDataUrl} />
        ) : (
          <View style={{ padding: 28 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold' }}>ESTUDIO DE ESPIROMETRIA</Text>
            <Text style={{ fontSize: 8, color: '#64748b', marginTop: 4 }}>
              (Recorte del equipo no disponible — ver archivo fuente en la papeleta)
            </Text>
          </View>
        )}

        <View style={styles.amiBlock}>
          <AmiMetrics ami={data.amiSection} />

          <Text style={styles.sectionHeading}>IMPRESIÓN DIAGNÓSTICA:</Text>
          <Text style={styles.paragraph}>{data.doctorDiagnosis}</Text>

          <Text style={styles.sectionHeading}>RECOMENDACIONES:</Text>
          <Text style={styles.paragraph}>{recomendacionesText}</Text>

          {data.doctorNotes ? (
            <>
              <Text style={styles.sectionHeading}>NOTAS:</Text>
              <Text style={styles.paragraph}>{data.doctorNotes}</Text>
            </>
          ) : null}
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureLeft}>
            <Text>
              Realizó EM: {data.medico.fullName.toUpperCase()}
            </Text>
            <Text>Ced. Prof.: {data.medico.professionalLicense}</Text>
          </View>
          <View style={styles.signatureRight}>
            {data.medico.signatureImageUrl ? (
              <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
            ) : null}
          </View>
        </View>

        <View style={styles.footerRule} fixed />
        <Text style={styles.footer} fixed>
          Evaluaciones médicas / Outsourcing de Personal Médico / Capacitación en Salud y Seguridad /
          Evaluaciones Ergonómicas / Fisioterapia / Nutrición{'\n'}
          Circuito del Mesón #135 Col. Del Prado C.P 76030{'\n'}
          (442) 225-52-67 www.medicaindustrial.com
        </Text>
        <Text style={styles.footerTagline} fixed>
          Salud que produce ®
        </Text>
      </Page>
    </Document>
  )
}
