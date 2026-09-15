/**
 * Plantilla PDF validado de Campimetría — formato AMI 005-2018 (1 hoja carta).
 * @id IMPL-FEATURE-20260914-01
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { ISHIHARA_PLATES } from '@/schemas/clinical/campimetria-questionnaire.schema'

const styles = StyleSheet.create({
  page: {
    paddingTop: 14,
    paddingBottom: 22,
    paddingHorizontal: 18,
    fontFamily: 'Helvetica',
    fontSize: 6.5,
    color: '#0f172a',
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
  brand: { fontSize: 11, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 5.5, color: '#475569' },
  logoImage: { width: 72, height: 26, objectFit: 'contain' },
  title: {
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    flex: 1,
    paddingHorizontal: 6,
  },
  sectionBar: {
    fontSize: 6.5,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    paddingVertical: 2,
    paddingHorizontal: 3,
    marginTop: 2,
    marginBottom: 1,
    textTransform: 'uppercase',
  },
  gridRow: { flexDirection: 'row', marginBottom: 1 },
  gridLabel: { width: '22%', fontWeight: 'bold', paddingRight: 2 },
  gridValue: { width: '28%', paddingRight: 4 },
  gridLabelRight: { width: '22%', fontWeight: 'bold', paddingRight: 2 },
  gridValueRight: { width: '28%' },
  patientRow: { flexDirection: 'row', marginBottom: 1 },
  patientLabel: { fontWeight: 'bold', marginRight: 2 },
  patientValue: { marginRight: 10 },
  acuityRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 1, alignItems: 'baseline' },
  acuityEye: { fontWeight: 'bold', width: '18%' },
  acuityField: { marginRight: 6 },
  acuityFieldLabel: { fontWeight: 'bold' },
  table: { borderWidth: 0.75, borderColor: '#94a3b8', marginTop: 1 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1' },
  tableRowLast: { flexDirection: 'row' },
  tableHeadCell: {
    flex: 1,
    fontSize: 6,
    fontWeight: 'bold',
    paddingVertical: 1.5,
    paddingHorizontal: 2,
    textAlign: 'center',
    backgroundColor: '#e2e8f0',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  tableLabelCell: {
    width: '20%',
    fontSize: 6,
    fontWeight: 'bold',
    paddingVertical: 1,
    paddingHorizontal: 2,
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  tableDataCell: {
    flex: 1,
    fontSize: 5.8,
    paddingVertical: 1,
    paddingHorizontal: 2,
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  confrontacionRow: { flexDirection: 'row', marginTop: 1, gap: 6 },
  confrontacionCol: { flex: 1, alignItems: 'center' },
  confrontacionEye: { fontSize: 6, fontWeight: 'bold', textAlign: 'center', marginBottom: 1 },
  confrontacionText: { fontSize: 5.5, textAlign: 'center', marginBottom: 2, lineHeight: 1.2 },
  confrontacionImage: { width: '94%', height: 110, objectFit: 'contain' },
  ishiharaHint: { fontSize: 5.5, fontStyle: 'italic', marginTop: 1, marginBottom: 1 },
  ishiharaImage: { width: '100%', height: 20, objectFit: 'contain', marginBottom: 1 },
  ishiharaTable: { borderWidth: 0.75, borderColor: '#94a3b8' },
  ishiharaHead: {
    flex: 1,
    fontSize: 6,
    fontWeight: 'bold',
    paddingVertical: 1,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  ishiharaCell: {
    flex: 1,
    fontSize: 6,
    paddingVertical: 1,
    textAlign: 'center',
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  ishiharaEye: {
    width: 36,
    fontSize: 6,
    fontWeight: 'bold',
    paddingVertical: 1,
    paddingHorizontal: 2,
    borderRightWidth: 0.5,
    borderRightColor: '#cbd5e1',
  },
  clinicalBlock: { marginTop: 2, marginBottom: 1 },
  clinicalLabel: { fontWeight: 'bold', marginBottom: 0.5 },
  clinicalText: { fontSize: 6.5, lineHeight: 1.3 },
  signatureRow: {
    marginTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  signatureCol: { width: '30%', alignItems: 'center' },
  signatureTitle: { fontSize: 6, fontWeight: 'bold', marginBottom: 2 },
  signatureImage: { width: 90, height: 28, objectFit: 'contain' },
  signatureLine: {
    width: 90,
    borderBottomWidth: 0.75,
    borderBottomColor: '#0f172a',
    marginBottom: 2,
  },
  signatureName: { fontSize: 6.5, fontWeight: 'bold', textAlign: 'center' },
  signatureMeta: { fontSize: 5.5, textAlign: 'center', color: '#475569' },
  patientSignBox: { width: '28%', alignItems: 'center' },
  footer: {
    position: 'absolute',
    bottom: 10,
    right: 18,
    fontSize: 6,
    color: '#64748b',
  },
})

export interface CampimetriaValidatedPDFData {
  reviewId: string
  signedAt: string | Date
  formatCode: string
  studyName: string
  patient: {
    fullName: string
    companyName: string | null
    ageYears: number | null
    eventDate: string
  }
  antecedentes: {
    usoLentes: string
    tiempoLentes: string
    cirugiasOculares: string
    causaCirugia: string
    diabetes: string
    tiempoEvolutionDiabetes: string
    hipertension: string
    tiempoEvolutionHipertension: string
  }
  agudeza: {
    od: { lejanaSin: string; lejanaCon: string; cercanaSin: string; cercanaCon: string }
    oi: { lejanaSin: string; lejanaCon: string; cercanaSin: string; cercanaCon: string }
    pending: boolean
  }
  exploracionOd: Record<string, string>
  exploracionOi: Record<string, string>
  confrontacion: { od: string; oi: string }
  ishihara: {
    resultado: string
    od: Record<string, string>
    oi: Record<string, string>
  }
  impresionDiagnostica: string
  aptitud: string
  recomendaciones: string[]
  medico: {
    fullName: string
    professionalLicense: string
    signatureImageUrl: string
  }
  logoUrl: string
  confrontacionOdImage?: string | null
  confrontacionOiImage?: string | null
  ishiharaImage?: string | null
}

function v(s: string | null | undefined): string {
  const t = (s ?? '').trim()
  return t || '—'
}

function fmtDate(d: string | Date): string {
  const date = d instanceof Date ? d : new Date(d)
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

const EXPLORACION_ROWS: Array<{ key: string; label: string }> = [
  { key: 'movimientos', label: 'MOVIMIENTOS OCULARES:' },
  { key: 'reflejos', label: 'REFLEJOS PUPILARES:' },
  { key: 'pupilas', label: 'PUPILAS' },
  { key: 'conjuntiva', label: 'CONJUNTIVA:' },
  { key: 'esclera', label: 'ESCLERA:' },
  { key: 'fondo_de_ojo', label: 'FONDO DE OJO:' },
  {
    key: 'anexos',
    label: 'ANEXOS Y GLANDULAS DE MEIBOMIO, CONJUNTIVALES, LAGRIMAL:',
  },
]

function AcuityLine({
  eyeLabel,
  data,
}: {
  eyeLabel: string
  data: { lejanaSin: string; lejanaCon: string; cercanaSin: string; cercanaCon: string }
}) {
  return (
    <View style={styles.acuityRow}>
      <Text style={styles.acuityEye}>{eyeLabel}</Text>
      <Text style={styles.acuityField}>
        <Text style={styles.acuityFieldLabel}>SIN LENTES: </Text>
        {data.lejanaSin}
      </Text>
      <Text style={styles.acuityField}>
        <Text style={styles.acuityFieldLabel}>CON LENTES: </Text>
        {data.lejanaCon}
      </Text>
      <Text style={styles.acuityField}>
        <Text style={styles.acuityFieldLabel}>CERCANA SIN LENTES: </Text>
        {data.cercanaSin}
      </Text>
      <Text style={styles.acuityField}>
        <Text style={styles.acuityFieldLabel}>CERCANA CON LENTES: </Text>
        {data.cercanaCon}
      </Text>
    </View>
  )
}

export function CampimetriaValidatedPDF({ data }: { data: CampimetriaValidatedPDFData }) {
  const recomendacionesText =
    data.recomendaciones.length > 0 ? data.recomendaciones.join(', ') : '—'

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>AMI</Text>
            <Text style={styles.brandSub}>Salud en el Trabajo</Text>
          </View>
          <Text style={styles.title}>REPORTE DE EXAMEN VISUAL</Text>
          {data.logoUrl ? (
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.brand}>AMI</Text>
          )}
        </View>

        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>NOMBRE:</Text>
          <Text style={[styles.patientValue, { flex: 1 }]}>{data.patient.fullName.toUpperCase()}</Text>
          <Text style={styles.patientLabel}>EDAD:</Text>
          <Text style={styles.patientValue}>
            {data.patient.ageYears != null ? `${data.patient.ageYears} AÑOS` : '—'}
          </Text>
        </View>
        <View style={styles.patientRow}>
          <Text style={styles.patientLabel}>EMPRESA:</Text>
          <Text style={[styles.patientValue, { flex: 1 }]}>{v(data.patient.companyName)}</Text>
          <Text style={styles.patientLabel}>FECHA:</Text>
          <Text style={styles.patientValue}>{data.patient.eventDate}</Text>
        </View>

        <Text style={styles.sectionBar}>Antecedentes oftalmológicos de importancia</Text>
        <View style={styles.gridRow}>
          <Text style={styles.gridLabel}>USO DE LENTES:</Text>
          <Text style={styles.gridValue}>{data.antecedentes.usoLentes}</Text>
          <Text style={styles.gridLabelRight}>DESDE HACE CUANTO TIEMPO USA LENTES:</Text>
          <Text style={styles.gridValueRight}>{data.antecedentes.tiempoLentes}</Text>
        </View>
        <View style={styles.gridRow}>
          <Text style={styles.gridLabel}>CIRUGIAS OCULARES:</Text>
          <Text style={styles.gridValue}>{data.antecedentes.cirugiasOculares}</Text>
          <Text style={styles.gridLabelRight}>CAUSA DE LA CIRUGIA:</Text>
          <Text style={styles.gridValueRight}>{data.antecedentes.causaCirugia}</Text>
        </View>
        <View style={styles.gridRow}>
          <Text style={styles.gridLabel}>PADECE DIABETES:</Text>
          <Text style={styles.gridValue}>{data.antecedentes.diabetes}</Text>
          <Text style={styles.gridLabelRight}>TIEMPO DE EVOLUCION:</Text>
          <Text style={styles.gridValueRight}>{data.antecedentes.tiempoEvolutionDiabetes}</Text>
        </View>
        <View style={styles.gridRow}>
          <Text style={styles.gridLabel}>PADECE HIPERTENSION ARTERIAL:</Text>
          <Text style={styles.gridValue}>{data.antecedentes.hipertension}</Text>
          <Text style={styles.gridLabelRight}>TIEMPO DE EVOLUCION:</Text>
          <Text style={styles.gridValueRight}>{data.antecedentes.tiempoEvolutionHipertension}</Text>
        </View>

        <Text style={styles.sectionBar}>Agudeza visual</Text>
        {data.agudeza.pending ? (
          <Text style={styles.clinicalText}>PENDIENTE EN PAPELETA</Text>
        ) : (
          <>
            <AcuityLine eyeLabel="AGUDEZA VISUAL OJO DERECHO:" data={data.agudeza.od} />
            <AcuityLine eyeLabel="AGUDEZA VISUAL OJO IZQUIERDO:" data={data.agudeza.oi} />
          </>
        )}

        <View style={[styles.table, { marginTop: 3 }]}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableLabelCell, { backgroundColor: '#e2e8f0' }]} />
            <Text style={[styles.tableHeadCell, { flex: 1 }]}>OJO IZQUIERDO</Text>
            <Text style={[styles.tableHeadCell, { flex: 1, borderRightWidth: 0 }]}>OJO DERECHO</Text>
          </View>
          {EXPLORACION_ROWS.map((row, idx) => (
            <View
              key={row.key}
              style={idx === EXPLORACION_ROWS.length - 1 ? styles.tableRowLast : styles.tableRow}
            >
              <Text style={styles.tableLabelCell}>{row.label}</Text>
              <Text style={styles.tableDataCell}>{data.exploracionOi[row.key] ?? '—'}</Text>
              <Text style={[styles.tableDataCell, { borderRightWidth: 0 }]}>
                {data.exploracionOd[row.key] ?? '—'}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionBar}>Campimetria de confrontacion</Text>
        <View style={styles.confrontacionRow}>
          <View style={styles.confrontacionCol}>
            <Text style={styles.confrontacionEye}>OJO IZQUIERDO</Text>
            {data.confrontacionOiImage ? (
              <Image style={styles.confrontacionImage} src={data.confrontacionOiImage} />
            ) : null}
            <Text style={styles.confrontacionText}>{data.confrontacion.oi}</Text>
          </View>
          <View style={styles.confrontacionCol}>
            <Text style={styles.confrontacionEye}>OJO DERECHO</Text>
            {data.confrontacionOdImage ? (
              <Image style={styles.confrontacionImage} src={data.confrontacionOdImage} />
            ) : null}
            <Text style={styles.confrontacionText}>{data.confrontacion.od}</Text>
          </View>
        </View>

        <Text style={styles.sectionBar}>Prueba de Ishihara: {data.ishihara.resultado}</Text>
        <Text style={styles.ishiharaHint}>
          Favor de especificar en el recuadro el número referido por el paciente
        </Text>
        {data.ishiharaImage ? <Image style={styles.ishiharaImage} src={data.ishiharaImage} /> : null}
        <View style={styles.ishiharaTable}>
          <View style={styles.tableRow}>
            <Text style={styles.ishiharaEye}>OJO</Text>
            {ISHIHARA_PLATES.map(p => (
              <Text key={p.id} style={styles.ishiharaHead}>
                {p.displayExpected ?? p.expected}
              </Text>
            ))}
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.ishiharaEye}>OD</Text>
            {ISHIHARA_PLATES.map(p => (
              <Text key={p.id} style={styles.ishiharaCell}>
                {data.ishihara.od[p.id] || '—'}
              </Text>
            ))}
          </View>
          <View style={styles.tableRowLast}>
            <Text style={styles.ishiharaEye}>OI</Text>
            {ISHIHARA_PLATES.map(p => (
              <Text key={p.id} style={styles.ishiharaCell}>
                {data.ishihara.oi[p.id] || '—'}
              </Text>
            ))}
          </View>
        </View>

        <View style={styles.clinicalBlock}>
          <Text style={styles.clinicalLabel}>IMPRESION DIAGNOSTICA:</Text>
          <Text style={styles.clinicalText}>{data.impresionDiagnostica}</Text>
        </View>
        <View style={styles.clinicalBlock}>
          <Text style={styles.clinicalLabel}>APTITUD SEGÚN HALLAZGOS FÍSICOS</Text>
          <Text style={styles.clinicalText}>{data.aptitud}</Text>
        </View>
        <View style={styles.clinicalBlock}>
          <Text style={styles.clinicalLabel}>RECOMENDACIONES:</Text>
          <Text style={styles.clinicalText}>{recomendacionesText}</Text>
        </View>

        <View style={styles.signatureRow}>
          <View style={styles.signatureCol}>
            <Text style={styles.signatureTitle}>REALIZÓ EXAMEN</Text>
            <View style={styles.signatureLine} />
          </View>
          <View style={styles.signatureCol}>
            <Text style={styles.signatureTitle}>REVISÓ EXAMEN</Text>
            {data.medico.signatureImageUrl ? (
              <Image style={styles.signatureImage} src={data.medico.signatureImageUrl} />
            ) : (
              <View style={styles.signatureLine} />
            )}
            <Text style={styles.signatureName}>{data.medico.fullName}</Text>
            <Text style={styles.signatureMeta}>CED.PROF {data.medico.professionalLicense}</Text>
            <Text style={styles.signatureMeta}>{fmtDate(data.signedAt)}</Text>
          </View>
          <View style={styles.patientSignBox}>
            <Text style={styles.signatureTitle}>NOMBRE DEL PACIENTE</Text>
            <View style={styles.signatureLine} />
            <Text style={[styles.signatureName, { marginTop: 2 }]}>
              {data.patient.fullName.toUpperCase()}
            </Text>
          </View>
        </View>

        <Text style={styles.footer}>FORMATO: {data.formatCode}</Text>
      </Page>
    </Document>
  )
}
