/**
 * @fileoverview Plantilla PDF validado de Audiometría — IMPL-FEATURE-20260825-02.
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 *
 * GUARDRAILS:
 *   - NO copia el diagnóstico nosológico ni la recomendación textual del
 *     PDF AMI como salida de IA (SPEC §3). La impresión diagnóstica del
 *     PDF refleja la decisión del médico firmante (`doctorDiagnosis`),
 *     no el texto del documento fuente.
 *   - El PDF conserva explícitamente cuatro secciones:
 *       I.  Datos del estudio y paciente (NOM)
 *       II. Evidencia audiométrica por oído y frecuencia (Fuente)
 *       III. Criterios clínicos audiométricos (derivación AMI/sistema)
 *       IV. Impresión diagnóstica validada por el médico
 *       V.  Recomendaciones validadas (snapshot IA aceptado)
 *       VI. Notas clínicas
 *     + identidad (médico + cédula) + firma al final.
 *   - DEC-20260825-10 / BR-20260825-11 / FND-20260825-14 (rectificación
 *     Frank): la sección "Criterio audiométrico AMI (referencia)" —
 *     tablas de normalidad, patrón operativo, severidad y etiologías
 *     — fue RETIRADA del PDF. Esa referencia (información administrativa)
 *     vive ahora SÓLO en el panel clínico, dentro del acordeón nativo
 *     `<details>`/`<summary>` cerrado por defecto de
 *     `AudiometriaClinicalCriteriaPanel.tsx` (FND-20260825-13). El PDF
 *     se mantiene enfocado en trazabilidad clínica: evidencia, criterios
 *     DERIVADOS del paciente, impresión y firma del médico.
 *   - TA = vía aérea; VO = vía ósea (sólo si están visibles en el
 *     documento).
 *   - PTA3 calculado = (TA500+TA1000+TA2000)/3 se muestra con la
 *     ECUACIÓN, las TRES ENTRADAS, el resultado y la fuente del cálculo,
 *     junto con el `pta_fuente` (PTA del documento) por separado.
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#0f766e',
    paddingBottom: 8,
  },
  headerLeft: { flexDirection: 'column' },
  brand: { fontSize: 16, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 8, color: '#475569' },
  headerRight: { alignItems: 'flex-end', justifyContent: 'flex-start', width: 140 },
  logoImage: { width: 130, height: 48, objectFit: 'contain' },
  logoFallback: {
    width: 130,
    height: 48,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    textAlign: 'center',
    paddingTop: 14,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  docTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 4, color: '#0f172a' },
  docSubtitle: { fontSize: 9, color: '#475569', marginBottom: 14 },
  section: { marginBottom: 12 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    padding: 5,
    marginBottom: 6,
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 130, fontSize: 9, fontWeight: 'bold', color: '#475569' },
  value: { flex: 1, fontSize: 9, color: '#0f172a' },
  paragraph: { fontSize: 9, lineHeight: 1.5, color: '#0f172a', marginBottom: 4 },
  bulletItem: { fontSize: 9, marginLeft: 8, marginBottom: 2 },
  verdictBox: {
    padding: 8,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
    marginBottom: 6,
  },
  // Tabla de umbrales
  table: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  tableHeaderCell: { flex: 1, fontSize: 8, fontWeight: 'bold', color: '#0f172a' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  tableRowAlt: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 3,
    paddingHorizontal: 6,
  },
  tableCell: { flex: 1, fontSize: 8, color: '#0f172a' },
  // Firma
  signatureArea: { marginTop: 36, flexDirection: 'row', justifyContent: 'flex-end' },
  signatureBox: { width: 240, alignItems: 'center' },
  signatureImage: { width: 200, height: 70, objectFit: 'contain', marginBottom: 4 },
  signatureLine: { width: 200, borderBottomWidth: 1, borderBottomColor: '#0f172a', marginBottom: 4 },
  signatureName: { fontSize: 10, fontWeight: 'bold', color: '#0f172a' },
  signatureLicense: { fontSize: 9, color: '#475569' },
  signatureDate: { fontSize: 8, color: '#94a3b8', marginTop: 2 },
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 8,
    lineHeight: 1.4,
  },
})

export interface AudiometriaValidatedPDFData {
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
  /** Frecuencias presentes en el documento fuente (Hz). NO se inventan. */
  frecuencias: number[]
  /** TA por oído y frecuencia (dB). Ausentes → null. */
  taOd: Record<number, number | null>
  taOi: Record<number, number | null>
  /** VO por oído y frecuencia (dB). Ausentes → null. */
  voOd: Record<number, number | null>
  voOi: Record<number, number | null>
  /** Criterios audiométricos resueltos. */
  criterios: {
    ptaCalculadoOd: number | null
    ptaCalculadoOi: number | null
    ptaCompletoOd: boolean
    ptaCompletoOi: boolean
    ptaFuenteOd: number | null
    ptaFuenteOi: number | null
    criterioAmiOd: 'NORMAL' | 'ALTERADO' | 'NO_CONCLUYENTE'
    criterioAmiOi: 'NORMAL' | 'ALTERADO' | 'NO_CONCLUYENTE'
    patronOd: 'NORMAL' | 'GRAVES' | 'AGUDAS' | 'MIXTA' | 'NO_CONCLUYENTE'
    patronOi: 'NORMAL' | 'GRAVES' | 'AGUDAS' | 'MIXTA' | 'NO_CONCLUYENTE'
    bilateralEstado:
      | 'NORMAL_BILATERAL'
      | 'ALTERADO_BILATERAL'
      | 'ASIMETRIA'
      | 'NO_CONCLUYENTE'
    bilateralNota: string
    completitud:
      | 'suficiente'
      | 'parcial'
      | 'no_concluyente'
      | 'desconocida'
    advertencias: string[]
  }
  /** Recomendaciones validadas (snapshot IA aceptado). */
  recomendacionesValidadas: string[]
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

const formatDb = (v: number | null | undefined) => {
  if (typeof v !== 'number' || Number.isNaN(v)) return '—'
  return `${v} dB`
}

const formatBool = (v: boolean | null | undefined) => {
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  return '—'
}

const CRITERIO_AMI_LABEL: Record<
  'NORMAL' | 'ALTERADO' | 'NO_CONCLUYENTE',
  string
> = {
  NORMAL: 'Normal (≤ 25 dB)',
  ALTERADO: 'Alterado (> 25 dB)',
  NO_CONCLUYENTE: 'No concluyente',
}

const PATRON_AMI_LABEL: Record<
  'NORMAL' | 'GRAVES' | 'AGUDAS' | 'MIXTA' | 'NO_CONCLUYENTE',
  string
> = {
  NORMAL: 'Normal',
  GRAVES: 'Predomina en graves',
  AGUDAS: 'Predomina en agudas',
  MIXTA: 'Mixta (graves + agudas)',
  NO_CONCLUYENTE: 'No concluyente',
}

const BILATERAL_LABEL: Record<
  'NORMAL_BILATERAL' | 'ALTERADO_BILATERAL' | 'ASIMETRIA' | 'NO_CONCLUYENTE',
  string
> = {
  NORMAL_BILATERAL: 'Normal bilateral',
  ALTERADO_BILATERAL: 'Alterado bilateral',
  ASIMETRIA: 'Asimetría OD/OI',
  NO_CONCLUYENTE: 'No concluyente',
}

// DEC-20260825-10 — la sección IV de referencia del programa AMI vivió
// aquí como `AmiReferencePdfSection` (FND-20260825-12). Fue RETIRADA por
// rectificación de Frank: esa información administrativa vive SÓLO en el
// panel clínico (acordeón nativo en `AudiometriaClinicalCriteriaPanel`).
// El PDF se concentra en trazabilidad clínica: evidencia (II), criterios
// DERIVADOS del paciente (III), impresión del médico (IV), recomendaciones
// validadas (V) y notas (VI). Identidad + firma + cédula siguen al final.

export const AudiometriaValidatedPDF = ({
  data,
}: {
  data: AudiometriaValidatedPDFData
}) => (
  <Document
    title={`Audiometria-validada-${data.reviewId.slice(0, 8)}`}
    author={`Dr(a). ${data.medico.fullName}`}
    subject="Reporte de Audiometría validado por el médico"
  >
    <Page size="A4" style={styles.page}>
      {/* MEMBRETE SUPERIOR (capa NOM) */}
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
          {data.logoUrl ? (
            <Image style={styles.logoImage} src={data.logoUrl} />
          ) : (
            <Text style={styles.logoFallback}>AMI</Text>
          )}
        </View>
      </View>

      <Text style={styles.docTitle}>Reporte de Audiometría Validado</Text>
      <Text style={styles.docSubtitle}>
        Folio de revisión: {data.reviewId} · Estado:{' '}
        {data.doctorStatus === 'REVIEWED_ACCEPTED' ? 'Aceptado' : 'Editado'} ·
        Firmado: {formatDate(data.signedAt)}
      </Text>

      {/* I. DATOS DEL ESTUDIO Y PACIENTE */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>I. Datos del estudio y paciente</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Estudio:</Text>
          <Text style={styles.value}>{data.studyName}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Tipo:</Text>
          <Text style={styles.value}>{data.studyType}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Paciente:</Text>
          <Text style={styles.value}>{data.patient.fullName}</Text>
        </View>
        {data.patient.universalId ? (
          <View style={styles.row}>
            <Text style={styles.label}>ID paciente:</Text>
            <Text style={styles.value}>{data.patient.universalId}</Text>
          </View>
        ) : null}
        {data.patient.companyName ? (
          <View style={styles.row}>
            <Text style={styles.label}>Empresa:</Text>
            <Text style={styles.value}>{data.patient.companyName}</Text>
          </View>
        ) : null}
      </View>

      {/* II. EVIDENCIA AUDIOMÉTRICA (capa Fuente) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          II. Evidencia audiométrica por oído y frecuencia (fuente)
        </Text>
        {data.frecuencias.length === 0 ? (
          <Text style={styles.paragraph}>
            Sin umbrales detectados en el documento fuente.
          </Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHeaderCell}>Hz</Text>
              <Text style={styles.tableHeaderCell}>TA OD</Text>
              <Text style={styles.tableHeaderCell}>TA OI</Text>
              <Text style={styles.tableHeaderCell}>VO OD</Text>
              <Text style={styles.tableHeaderCell}>VO OI</Text>
            </View>
            {data.frecuencias.map((f, idx) => (
              <View
                key={f}
                style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlt}
              >
                <Text style={styles.tableCell}>{f}</Text>
                <Text style={styles.tableCell}>
                  {formatDb(data.taOd[f] ?? null)}
                </Text>
                <Text style={styles.tableCell}>
                  {formatDb(data.taOi[f] ?? null)}
                </Text>
                <Text style={styles.tableCell}>
                  {formatDb(data.voOd[f] ?? null)}
                </Text>
                <Text style={styles.tableCell}>
                  {formatDb(data.voOi[f] ?? null)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* III. CRITERIOS DERIVADOS DEL PACIENTE (capa AMI/sistema) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          III. Criterios audiométricos derivados (criterio AMI ≤ 25 dB)
        </Text>
        <View style={styles.row}>
          <Text style={styles.label}>PTA3 ecuación:</Text>
          <Text style={styles.value}>PTA3 = (TA500 + TA1000 + TA2000) / 3</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>PTA OD calculado:</Text>
          <Text style={styles.value}>
            {formatDb(data.criterios.ptaCalculadoOd)}
            {!data.criterios.ptaCompletoOd
              ? ' (incompleto: faltan TA500/TA1000/TA2000)'
              : ''}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>PTA OD fuente:</Text>
          <Text style={styles.value}>
            {formatDb(data.criterios.ptaFuenteOd)}
            {' '}
            {data.criterios.ptaFuenteOd === null ? '(no visible en formato)' : ''}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>PTA OI calculado:</Text>
          <Text style={styles.value}>
            {formatDb(data.criterios.ptaCalculadoOi)}
            {!data.criterios.ptaCompletoOi
              ? ' (incompleto: faltan TA500/TA1000/TA2000)'
              : ''}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>PTA OI fuente:</Text>
          <Text style={styles.value}>
            {formatDb(data.criterios.ptaFuenteOi)}
            {' '}
            {data.criterios.ptaFuenteOi === null ? '(no visible en formato)' : ''}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Criterio AMI OD:</Text>
          <Text style={styles.value}>
            {CRITERIO_AMI_LABEL[data.criterios.criterioAmiOd]} · patrón:{' '}
            {PATRON_AMI_LABEL[data.criterios.patronOd]}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Criterio AMI OI:</Text>
          <Text style={styles.value}>
            {CRITERIO_AMI_LABEL[data.criterios.criterioAmiOi]} · patrón:{' '}
            {PATRON_AMI_LABEL[data.criterios.patronOi]}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Estado bilateral:</Text>
          <Text style={styles.value}>
            {BILATERAL_LABEL[data.criterios.bilateralEstado]} —{' '}
            {data.criterios.bilateralNota}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Completitud:</Text>
          <Text style={styles.value}>{data.criterios.completitud}</Text>
        </View>
        {data.criterios.advertencias.length > 0 ? (
          <View style={styles.row}>
            <Text style={styles.label}>Advertencias:</Text>
            <Text style={styles.value}>
              {data.criterios.advertencias.join(' · ')}
            </Text>
          </View>
        ) : null}
      </View>

      {/* DEC-20260825-10 — sección IV "Criterio audiométrico AMI
          (referencia)" RETIRADA del PDF (FND-20260825-14). La
          referencia administrativa vive SÓLO en el panel clínico
          (acordeón nativo en AudiometriaClinicalCriteriaPanel).
          Saltamos directo de III (criterios DERIVADOS) a IV
          (impresión del médico). */}

      {/* 4. IMPRESIÓN DIAGNÓSTICA VALIDADA */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          IV. Impresión diagnóstica (validada por el médico)
        </Text>
        <View style={styles.verdictBox}>
          <Text style={styles.paragraph}>{data.doctorDiagnosis}</Text>
        </View>
      </View>

      {/* 5. RECOMENDACIONES VALIDADAS */}
      {data.recomendacionesValidadas.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>V. Recomendaciones validadas</Text>
          {data.recomendacionesValidadas.map((r, i) => (
            <Text key={i} style={styles.bulletItem}>
              • {r}
            </Text>
          ))}
        </View>
      ) : null}

      {/* 6. NOTAS */}
      {data.doctorNotes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VI. Notas clínicas</Text>
          <Text style={styles.paragraph}>{data.doctorNotes}</Text>
        </View>
      ) : null}

      {/* FIRMA */}
      <View style={styles.signatureArea}>
        <View style={styles.signatureBox}>
          {data.medico.signatureImageUrl ? (
            <Image
              style={styles.signatureImage}
              src={data.medico.signatureImageUrl}
            />
          ) : (
            <View style={styles.signatureLine} />
          )}
          <Text style={styles.signatureName}>Dr(a). {data.medico.fullName}</Text>
          <Text style={styles.signatureLicense}>
            Cédula profesional: {data.medico.professionalLicense}
          </Text>
          <Text style={styles.signatureDate}>
            Fecha y hora: {formatDate(data.signedAt)}
          </Text>
        </View>
      </View>

      {/* PIE INSTITUCIONAL AMI */}
      <Text style={styles.footer} fixed>
        Administración Médica Industrial — Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro — (442) 225-52-67 — www.medicaindustrial.com
        {'\n'}Evaluaciones médicas · Outsourcing · Capacitación · Ergonomía · Fisioterapia · Nutrición
        {'\n'}Este documento es un reporte clínico validado por el médico firmante. Queda prohibida su alteración o reproducción no autorizada.
      </Text>
    </Page>
  </Document>
)

// `formatBool` exportado por si se requiere en futuras secciones (no se
// usa actualmente; se conserva para simetría con el PDF de Espirometría).
export { formatBool }