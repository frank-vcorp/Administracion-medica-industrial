/**
 * @fileoverview PDF «ESTUDIO DE AUDIOMETRIA» — una hoja tamaño carta.
 *
 * Reproduce los bloques del formato de referencia (gráficas de ambos
 * oídos, datos del paciente y del equipo, tabla 500–3000 Hz, exploración,
 * descripción, diagnóstico nosológico / etiológico / clasificación,
 * recomendaciones, firma y membrete).
 *
 * La impresión que imprime el médico es la que él aceptó o editó. La
 * etiología sólo aparece cuando el estudio la trae escrita: no se infiere.
 *
 * El panel del médico no se arma aquí. Ahí siguen el índice de Fletcher,
 * su cálculo, el estado bilateral y la completitud documental.
 */
import { Circle, Document, Image, Line, Page, Svg, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { AudiometriaFormatoReferencia } from '@/lib/audiometry-formato'
import type { PatientIdentificationPdf } from '@/lib/pdf/patient-identification'

const CONTENT_WIDTH = 572

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
    paddingBottom: 78,
    paddingHorizontal: 20,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#0f172a',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logoSlot: { width: 88 },
  logoImage: { width: 84, height: 36, objectFit: 'contain' },
  logoFallback: {
    width: 84,
    height: 36,
    borderWidth: 1,
    borderColor: '#0f766e',
    textAlign: 'center',
    paddingTop: 10,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  docTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: 'bold',
  },
  infoRow: { flexDirection: 'row', marginBottom: 4, gap: 8 },
  infoCol: { flex: 1 },
  infoHeading: {
    fontSize: 7.5,
    fontWeight: 'bold',
    backgroundColor: '#c4a35a',
    color: '#1c1917',
    paddingVertical: 2,
    paddingHorizontal: 4,
    marginBottom: 2,
  },
  infoLine: { fontSize: 7, marginBottom: 1, lineHeight: 1.25 },
  infoLabel: { fontWeight: 'bold' },
  graphWrap: { marginBottom: 4, alignItems: 'center' },
  sourceImage: { objectFit: 'contain' },
  chartRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chartCard: { width: 278 },
  chartTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
    backgroundColor: '#c4a35a',
    paddingVertical: 2,
    marginBottom: 2,
  },
  table: { borderWidth: 0.6, borderColor: '#334155', marginBottom: 4 },
  tableRow: { flexDirection: 'row' },
  th: {
    fontSize: 6.5,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 2,
    paddingHorizontal: 1,
    borderRightWidth: 0.4,
    borderBottomWidth: 0.6,
    borderColor: '#334155',
  },
  td: {
    fontSize: 7.5,
    textAlign: 'center',
    paddingVertical: 2,
    borderRightWidth: 0.4,
    borderColor: '#334155',
  },
  examLine: { flexDirection: 'row', marginBottom: 2, alignItems: 'flex-end' },
  examLabel: { width: 52, fontSize: 8, fontWeight: 'bold' },
  examValue: {
    flex: 1,
    fontSize: 8,
    borderBottomWidth: 0.4,
    borderBottomColor: '#334155',
    paddingBottom: 1,
    marginRight: 8,
  },
  sectionLine: { flexDirection: 'row', marginTop: 3, marginBottom: 2 },
  sectionLabel: { fontSize: 8, fontWeight: 'bold', marginRight: 4 },
  sectionValue: { flex: 1, fontSize: 8 },
  dxTitle: {
    textAlign: 'center',
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 4,
    marginBottom: 2,
  },
  earTitle: { fontSize: 8, fontWeight: 'bold', marginTop: 2, marginBottom: 1 },
  dxRow: { flexDirection: 'row', marginBottom: 2 },
  dxCol: { flex: 1, paddingRight: 4 },
  dxLabel: { fontSize: 6.5, fontWeight: 'bold' },
  dxValue: { fontSize: 8 },
  signatureRow: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signatureText: { alignItems: 'center' },
  signatureName: { fontSize: 9, fontWeight: 'bold' },
  signatureLicense: { fontSize: 8, marginTop: 1 },
  signatureImage: { width: 110, height: 36, objectFit: 'contain', marginLeft: 12 },
  footer: {
    position: 'absolute',
    bottom: 10,
    left: 20,
    right: 20,
  },
  footerImage: { width: CONTENT_WIDTH, height: 72, objectFit: 'contain' },
  footerServices: { fontSize: 7, color: '#5f8f95', textAlign: 'center', marginBottom: 2 },
  footerContacts: { fontSize: 7.5, color: '#5f8f95', textAlign: 'center' },
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
  /** Pie de la referencia: teléfono, amisaludresponsable.com y redes. */
  footerImageUrl?: string | null
  sourceCropDataUrl?: string | null
  sourceCropAspectRatio?: number | null
}

const EJE_FRECUENCIAS = [125, 250, 500, 1000, 2000, 4000, 8000]
const DB_MIN = -10
const DB_MAX = 120

function dbY(db: number, top: number, height: number): number {
  const t = (db - DB_MIN) / (DB_MAX - DB_MIN)
  return top + t * height
}

function freqX(freq: number, left: number, width: number): number {
  const min = Math.log2(125)
  const max = Math.log2(8000)
  const t = (Math.log2(freq) - min) / (max - min)
  return left + Math.min(1, Math.max(0, t)) * width
}

function puntosDe(
  mapa: Record<number, number | null>,
): Array<{ freq: number; db: number }> {
  return Object.entries(mapa)
    .map(([hz, db]) => ({ freq: Number(hz), db }))
    .filter(
      (punto): punto is { freq: number; db: number } =>
        Number.isFinite(punto.freq) &&
        punto.freq > 0 &&
        typeof punto.db === 'number' &&
        Number.isFinite(punto.db),
    )
    .sort((a, b) => a.freq - b.freq)
}

function AudiogramaTrazado({
  titulo,
  mapa,
  simbolo,
}: {
  titulo: string
  mapa: Record<number, number | null>
  simbolo: 'od' | 'oi'
}) {
  const width = 270
  const height = 132
  const left = 22
  const top = 8
  const plotW = width - 30
  const plotH = height - 22
  const puntos = puntosDe(mapa)
  const color = simbolo === 'od' ? '#dc2626' : '#2563eb'
  const niveles = [-10, 0, 20, 40, 60, 80, 100, 120]

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>{titulo}</Text>
      <Svg width={width} height={height}>
        {niveles.map((db) => (
          <Line
            key={`h-${db}`}
            x1={left}
            y1={dbY(db, top, plotH)}
            x2={left + plotW}
            y2={dbY(db, top, plotH)}
            stroke="#cbd5e1"
            strokeWidth={0.4}
          />
        ))}
        {EJE_FRECUENCIAS.map((freq) => (
          <Line
            key={`v-${freq}`}
            x1={freqX(freq, left, plotW)}
            y1={top}
            x2={freqX(freq, left, plotW)}
            y2={top + plotH}
            stroke="#cbd5e1"
            strokeWidth={0.4}
          />
        ))}
        <Line x1={left} y1={top} x2={left} y2={top + plotH} stroke="#334155" strokeWidth={0.7} />
        <Line
          x1={left}
          y1={top + plotH}
          x2={left + plotW}
          y2={top + plotH}
          stroke="#334155"
          strokeWidth={0.7}
        />
        {puntos.slice(1).map((punto, index) => {
          const previo = puntos[index]
          return (
            <Line
              key={`l-${punto.freq}`}
              x1={freqX(previo.freq, left, plotW)}
              y1={dbY(previo.db, top, plotH)}
              x2={freqX(punto.freq, left, plotW)}
              y2={dbY(punto.db, top, plotH)}
              stroke={color}
              strokeWidth={1}
            />
          )
        })}
        {puntos.map((punto) => {
          const x = freqX(punto.freq, left, plotW)
          const y = dbY(punto.db, top, plotH)
          if (simbolo === 'od') {
            return (
              <Circle
                key={`p-${punto.freq}`}
                cx={x}
                cy={y}
                r={2.4}
                stroke={color}
                strokeWidth={0.9}
                fill="#ffffff"
              />
            )
          }
          return (
            <Line
              key={`p-${punto.freq}`}
              x1={x - 2.4}
              y1={y - 2.4}
              x2={x + 2.4}
              y2={y + 2.4}
              stroke={color}
              strokeWidth={0.9}
            />
          )
        })}
        {simbolo === 'oi'
          ? puntos.map((punto) => {
              const x = freqX(punto.freq, left, plotW)
              const y = dbY(punto.db, top, plotH)
              return (
                <Line
                  key={`x2-${punto.freq}`}
                  x1={x - 2.4}
                  y1={y + 2.4}
                  x2={x + 2.4}
                  y2={y - 2.4}
                  stroke={color}
                  strokeWidth={0.9}
                />
              )
            })
          : null}
      </Svg>
    </View>
  )
}

function InfoLine({ label, value }: { label: string; value: string | null }) {
  return (
    <Text style={styles.infoLine}>
      <Text style={styles.infoLabel}>{label} </Text>
      {value?.trim() ? value : '—'}
    </Text>
  )
}

function celda(valor: number | null | undefined): string {
  return typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : '—'
}

const COLS = [42, 58, 62, 62, 62, 110, 176]

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
  let imageWidth = CONTENT_WIDTH
  let imageHeight = 240
  if (aspect) {
    imageHeight = imageWidth / aspect
    if (imageHeight > 300) {
      imageHeight = 300
      imageWidth = imageHeight * aspect
    }
  }

  return (
    <Document
      title={`Estudio-de-audiometria-${data.reviewId.slice(0, 8)}`}
      author={data.medico.fullName}
      subject="Estudio de audiometría"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <View style={styles.logoSlot}>
            {data.logoUrl ? (
              <Image style={styles.logoImage} src={data.logoUrl} />
            ) : (
              <Text style={styles.logoFallback}>SME</Text>
            )}
          </View>
          <Text style={styles.docTitle}>ESTUDIO DE AUDIOMETRIA</Text>
          <View style={styles.logoSlot} />
        </View>

        {data.sourceCropDataUrl ? null : (
          <View style={styles.infoRow}>
            <View style={styles.infoCol}>
              <Text style={styles.infoHeading}>Información del Paciente</Text>
              <InfoLine label="Identificación" value={formato.identificacion} />
              <InfoLine label="Nombre" value={data.patient.fullName} />
              <InfoLine label="Nacimiento" value={formato.nacimiento} />
              <InfoLine label="Sexo" value={formato.sexo} />
              <InfoLine label="Notas" value={formato.notasPaciente} />
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoHeading}>Información de la Prueba</Text>
              <InfoLine label="Fecha" value={formato.fechaEstudio} />
              <InfoLine label="Hora" value={formato.horaEstudio} />
              <Text style={[styles.infoHeading, { marginTop: 4 }]}>Notas de Prueba</Text>
              <Text style={styles.infoLine}>
                {formato.notasPrueba?.trim() ? formato.notasPrueba : '—'}
              </Text>
            </View>
            <View style={styles.infoCol}>
              <Text style={styles.infoHeading}>Información del Sistema</Text>
              <InfoLine label="Audiómetro" value={formato.audiometro} />
              <InfoLine label="Transductor" value={formato.transductor} />
              <InfoLine label="Número de serie" value={formato.numeroSerie} />
              <InfoLine label="Última calibración" value={formato.ultimaCalibracion} />
            </View>
          </View>
        )}

        {data.sourceCropDataUrl ? (
          <View style={styles.graphWrap}>
            <Image
              style={[styles.sourceImage, { width: imageWidth, height: imageHeight }]}
              src={data.sourceCropDataUrl}
            />
          </View>
        ) : (
          <View style={styles.chartRow}>
            <AudiogramaTrazado titulo="Audiograma Oído Derecho" mapa={data.taOd} simbolo="od" />
            <AudiogramaTrazado titulo="Audiograma Oído Izquierdo" mapa={data.taOi} simbolo="oi" />
          </View>
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
            ].map((valor, index) => (
              <Text key={`od-${index}`} style={[styles.td, { width: COLS[index] }]}>
                {valor}
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
            ].map((valor, index) => (
              <Text
                key={`oi-${index}`}
                style={[styles.td, { width: COLS[index], borderBottomWidth: 0 }]}
              >
                {valor}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.examLine}>
          <Text style={styles.examLabel}>FARINGE</Text>
          <Text style={styles.examValue}>{formato.faringe ?? '—'}</Text>
        </View>
        <View style={styles.examLine}>
          <Text style={styles.examLabel}>CAD:</Text>
          <Text style={styles.examValue}>{formato.cad ?? '—'}</Text>
          <Text style={styles.examLabel}>CAI:</Text>
          <Text style={styles.examValue}>{formato.cai ?? '—'}</Text>
        </View>
        <View style={styles.examLine}>
          <Text style={styles.examLabel}>MTD:</Text>
          <Text style={styles.examValue}>{formato.mtd ?? '—'}</Text>
          <Text style={styles.examLabel}>MTI:</Text>
          <Text style={styles.examValue}>{formato.mti ?? '—'}</Text>
        </View>

        <View style={styles.sectionLine}>
          <Text style={styles.sectionLabel}>DESCRIPCIÓN AUDIOMÉTRICA:</Text>
          <Text style={styles.sectionValue}>{formato.descripcionAudiometrica}</Text>
        </View>

        <Text style={styles.dxTitle}>DIAGNOSTICO AUDIOMETRICO</Text>
        <Text style={styles.earTitle}>OÍDO DERECHO:</Text>
        <View style={styles.dxRow}>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>DIAGNOSTICO NOSOLOGICO:</Text>
            <Text style={styles.dxValue}>{formato.diagnosticoNosologicoOd ?? '—'}</Text>
          </View>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>DIAGNOSTICO ETIOLOGICO:</Text>
            <Text style={styles.dxValue}>{formato.diagnosticoEtiologicoOd ?? '—'}</Text>
          </View>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>CLASIFICACION HIPOACUSIA:</Text>
            <Text style={styles.dxValue}>{formato.clasificacionHipoacusiaOd ?? '—'}</Text>
          </View>
        </View>
        <Text style={styles.earTitle}>OÍDO IZQUIERDO:</Text>
        <View style={styles.dxRow}>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>DIAGNOSTICO NOSOLOGICO:</Text>
            <Text style={styles.dxValue}>{formato.diagnosticoNosologicoOi ?? '—'}</Text>
          </View>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>DIAGNOSTICO ETIOLOGICO:</Text>
            <Text style={styles.dxValue}>{formato.diagnosticoEtiologicoOi ?? '—'}</Text>
          </View>
          <View style={styles.dxCol}>
            <Text style={styles.dxLabel}>CLASIFICACION HIPOACUSIA:</Text>
            <Text style={styles.dxValue}>{formato.clasificacionHipoacusiaOi ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.sectionLine}>
          <Text style={styles.sectionLabel}>RECOMENDACIONES:</Text>
          <Text style={styles.sectionValue}>{formato.recomendacionesTexto}</Text>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureText}>
            <Text style={styles.signatureName}>
              Realizó EM: {data.medico.fullName.toUpperCase()}
            </Text>
            <Text style={styles.signatureLicense}>
              Ced. Prof.: {data.medico.professionalLicense}
            </Text>
          </View>
          {data.medico.signatureImageUrl ? (
            <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
          ) : null}
        </View>

        <View style={styles.footer} fixed>
          {data.footerImageUrl ? (
            <Image style={styles.footerImage} src={data.footerImageUrl} />
          ) : (
            <View>
              <Text style={styles.footerServices}>
                Evaluaciones Médicas • Servicio de Personal Médico • Capacitación en salud • Ergonomía • Fisioterapia • Nutrición • Ambulancia
              </Text>
              <Text style={styles.footerContacts}>
                (442) 480 0548    amisaludresponsable.com    AMISaludResponsable    @amisaludresponsable    amisaludresponsable
              </Text>
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}
