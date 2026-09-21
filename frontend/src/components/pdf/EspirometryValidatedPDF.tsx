/**
 * Plantilla PDF validado de Espirometría — 1 hoja carta.
 * Tabla y metadatos desde extracción; gráficas pegadas del PDF fuente.
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { EspirometryAmiSectionData } from '@/lib/espirometry-ami-section'
import { formatAmiSectionMl } from '@/lib/espirometry-ami-section'
import type { EspirometryPdfExtractionView } from '@/lib/espirometry-pdf-extraction'
import { SME_LOGO_FALLBACK_TEXT } from '@/lib/brand-constants'

const styles = StyleSheet.create({
  page: {
    paddingTop: 12,
    paddingBottom: 48,
    paddingHorizontal: 16,
    fontFamily: 'Helvetica',
    fontSize: 6.5,
    color: '#000000',
    lineHeight: 1.25,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    borderBottomWidth: 0.75,
    borderBottomColor: '#0f766e',
    paddingBottom: 3,
  },
  brand: { fontSize: 10, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 5.5, color: '#475569' },
  logoImage: { width: 72, height: 26, objectFit: 'contain' },
  title: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 4,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 1 },
  metaItem: { marginRight: 8, marginBottom: 1 },
  metaLabel: { fontWeight: 'bold' },
  sectionTitle: {
    fontSize: 7,
    fontWeight: 'bold',
    marginTop: 3,
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  table: { borderWidth: 0.75, borderColor: '#94a3b8', marginBottom: 2 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' },
  tableRowLast: { flexDirection: 'row' },
  tableHead: {
    flex: 1,
    fontSize: 5.5,
    fontWeight: 'bold',
    paddingVertical: 1,
    paddingHorizontal: 1,
    textAlign: 'center',
    backgroundColor: '#e2e8f0',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  tableParamHead: {
    width: '16%',
    fontSize: 5.5,
    fontWeight: 'bold',
    paddingVertical: 1,
    paddingHorizontal: 1,
    backgroundColor: '#e2e8f0',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  tableCell: {
    flex: 1,
    fontSize: 5.5,
    paddingVertical: 1,
    paddingHorizontal: 1,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  tableParamCell: {
    width: '16%',
    fontSize: 5.5,
    paddingVertical: 1,
    paddingHorizontal: 1,
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  graphsImage: { width: '100%', height: 118, objectFit: 'contain', marginVertical: 2 },
  metricsLine: { fontSize: 6.5, marginBottom: 1, lineHeight: 1.3 },
  metricsLabel: { fontWeight: 'bold' },
  block: { marginTop: 2, marginBottom: 1 },
  blockLabel: { fontWeight: 'bold', marginBottom: 0.5 },
  blockText: { fontSize: 6.5, lineHeight: 1.35 },
  signatureRow: {
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureLeft: { flex: 1 },
  signatureRight: { width: 120, alignItems: 'center' },
  signatureImage: { width: 90, height: 32, objectFit: 'contain' },
  footerRule: {
    position: 'absolute',
    bottom: 36,
    left: 16,
    right: 16,
    borderTopWidth: 0.75,
    borderTopColor: '#0f766e',
    paddingTop: 3,
  },
  footer: {
    position: 'absolute',
    bottom: 8,
    left: 16,
    right: 16,
    fontSize: 5.5,
    color: '#0f766e',
    lineHeight: 1.25,
  },
  footerTagline: {
    position: 'absolute',
    bottom: 10,
    right: 16,
    fontSize: 8,
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
  extractionView: EspirometryPdfExtractionView
  /** Gráficas recortadas del PDF fuente (flujo-volumen + volumen-tiempo). */
  graphsCropDataUrl?: string | null
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
  }
  logoUrl: string
}

function MetaGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  if (items.length === 0) return null
  return (
    <View style={styles.metaRow}>
      {items.map((item, idx) => (
        <Text key={`${item.label}-${idx}`} style={styles.metaItem}>
          <Text style={styles.metaLabel}>{item.label}: </Text>
          {item.value}
        </Text>
      ))}
    </View>
  )
}

function ParametersTable({ rows }: { rows: EspirometryPdfExtractionView['parametros'] }) {
  if (rows.length === 0) {
    return (
      <Text style={styles.blockText}>
        Tabla de parámetros no disponible en la extracción.
      </Text>
    )
  }

  return (
    <View style={styles.table}>
      <View style={styles.tableRow}>
        <Text style={styles.tableParamHead}>PARÁMETRO</Text>
        <Text style={styles.tableHead}>M1</Text>
        <Text style={styles.tableHead}>%REF</Text>
        <Text style={styles.tableHead}>M2</Text>
        <Text style={styles.tableHead}>%REF</Text>
        <Text style={styles.tableHead}>M3</Text>
        <Text style={styles.tableHead}>%REF</Text>
        <Text style={styles.tableHead}>REF</Text>
        <Text style={[styles.tableHead, { borderRightWidth: 0 }]}>LLN</Text>
      </View>
      {rows.map((row, idx) => (
        <View
          key={`${row.label}-${idx}`}
          style={idx === rows.length - 1 ? styles.tableRowLast : styles.tableRow}
        >
          <Text style={styles.tableParamCell}>{row.label}</Text>
          <Text style={styles.tableCell}>{row.m1}</Text>
          <Text style={styles.tableCell}>{row.m1Pct}</Text>
          <Text style={styles.tableCell}>{row.m2}</Text>
          <Text style={styles.tableCell}>{row.m2Pct}</Text>
          <Text style={styles.tableCell}>{row.m3}</Text>
          <Text style={styles.tableCell}>{row.m3Pct}</Text>
          <Text style={styles.tableCell}>{row.ref}</Text>
          <Text style={[styles.tableCell, { borderRightWidth: 0 }]}>{row.lln}</Text>
        </View>
      ))}
    </View>
  )
}

function AmiMetricsLines({ ami }: { ami: EspirometryAmiSectionData }) {
  const pruebas =
    ami.pruebasAceptables !== null && ami.pruebasAceptables !== undefined
      ? String(ami.pruebasAceptables)
      : '—'

  return (
    <View>
      <Text style={styles.metricsLine}>
        <Text style={styles.metricsLabel}>Repetibilidad FVC: </Text>
        {formatAmiSectionMl(ami.repetibilidadFvcMl)}
        <Text style={styles.metricsLabel}> FEV1: </Text>
        {formatAmiSectionMl(ami.repetibilidadFev1Ml)}
      </Text>
      <Text style={styles.metricsLine}>
        <Text style={styles.metricsLabel}>Pico Maximo: </Text>
        {ami.picoMaximo ?? '—'}
        <Text style={styles.metricsLabel}> Forma Triangular: </Text>
        {ami.formaTriangular ?? '—'}
        <Text style={styles.metricsLabel}> Libre de artefactos: </Text>
        {ami.libreArtefactos ?? '—'}
        <Text style={styles.metricsLabel}> Meseta: </Text>
        {ami.meseta ?? '—'}
        <Text style={styles.metricsLabel}> Tiempo: </Text>
        {ami.tiempo ?? '—'}
      </Text>
      <Text style={styles.metricsLine}>
        <Text style={styles.metricsLabel}>Repetibilidad FVC {'<'} 200: </Text>
        {ami.repetibilidadFvcMenor200 ?? '—'}
        <Text style={styles.metricsLabel}> Repetibilidad FEV1 {'<'} 200: </Text>
        {ami.repetibilidadFev1Menor200 ?? '—'}
      </Text>
      <Text style={styles.metricsLine}>
        <Text style={styles.metricsLabel}>#Pruebas aceptables: </Text>
        {pruebas}
        <Text style={styles.metricsLabel}> Criterios para Dx: </Text>
        {ami.criteriosParaDx ?? '—'}
        <Text style={styles.metricsLabel}> Calidad: </Text>
        {ami.calidad ?? '—'}
      </Text>
    </View>
  )
}

export const EspirometryValidatedPDF = ({ data }: { data: EspirometryValidatedPDFData }) => {
  const recomendacionesText =
    data.recomendacionesValidadas.length > 0
      ? data.recomendacionesValidadas.join(' ')
      : '—'
  const logoSrc = data.logoUrl
  const extraction = data.extractionView

  return (
    <Document
      title={`Espirometria-${data.reviewId.slice(0, 8)}`}
      author={`Dr(a). ${data.medico.fullName}`}
      subject="Estudio de Espirometría validado"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>AMI</Text>
            <Text style={styles.brandSub}>Salud en el Trabajo</Text>
          </View>
          <Text style={styles.title}>ESTUDIO DE ESPIROMETRIA</Text>
          {logoSrc ? (
            <Image style={styles.logoImage} src={logoSrc} />
          ) : (
            <Text style={styles.brand}>{SME_LOGO_FALLBACK_TEXT}</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Paciente</Text>
        <MetaGrid
          items={[
            { label: 'Nombre', value: data.patient.fullName },
            ...extraction.paciente.filter(row => row.label !== 'Nombre'),
          ]}
        />

        {(extraction.estudio.length > 0 || extraction.condiciones.length > 0) && (
          <>
            <Text style={styles.sectionTitle}>Estudio y condiciones</Text>
            <MetaGrid items={[...extraction.estudio, ...extraction.condiciones]} />
          </>
        )}

        <Text style={styles.sectionTitle}>Informe de FVC</Text>
        <ParametersTable rows={extraction.parametros} />
        {extraction.repetibilidadAtsErs ? (
          <Text style={styles.metricsLine}>
            <Text style={styles.metricsLabel}>Repetibilidad ATS/ERS: </Text>
            {extraction.repetibilidadAtsErs}
          </Text>
        ) : null}

        {data.graphsCropDataUrl ? (
          <Image style={styles.graphsImage} src={data.graphsCropDataUrl} />
        ) : (
          <Text style={[styles.blockText, { color: '#64748b', marginVertical: 2 }]}>
            Gráficas no disponibles — ver PDF fuente en el módulo de pruebas clínicas.
          </Text>
        )}

        <AmiMetricsLines ami={data.amiSection} />

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
