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
 *   - El PDF conserva explícitamente TRES secciones de contenido + una
 *     sección de identidad/firma:
 *       I.  Datos del estudio y paciente (NOM)
 *       II. Evidencia audiométrica por oído y frecuencia (Fuente)
 *       III. Impresión diagnóstica validada por el médico
 *       IV. Recomendaciones validadas (snapshot IA aceptado)
 *       V.  Notas clínicas
 *     + identidad (médico + cédula) + firma al final.
 *   - DEC-20260825-10 / BR-20260825-11 / FND-20260825-14 (rectificación
 *     Frank): la sección "Criterio audiométrico AMI (referencia)" —
 *     tablas de normalidad, patrón operativo, severidad y etiologías
 *     — fue RETIRADA del PDF. Esa referencia (información administrativa)
 *     vive ahora SÓLO en el panel clínico, dentro del acordeón nativo
 *     `<details>`/`<summary>` cerrado por defecto de
 *     `AudiometriaClinicalCriteriaPanel.tsx` (FND-20260825-13).
 *   - DEC-20260825-11 / BR-20260825-12 / FND-20260825-15 (rectificación
 *     Frank): la sección "Criterios audiométricos derivados" (PTA3,
 *     PTA fuente, criterio AMI, patrón, estado bilateral, completitud,
 *     advertencias) también fue RETIRADA del PDF. El PDF se enfoca
 *     ahora en datos del estudio, EVIDENCIA DOCUMENTAL (umbrales
 *     TA/VO por frecuencia y por oído), impresión del médico,
 *     recomendaciones validadas y notas. Los datos DERIVADOS (PTA3,
 *     criterio, patrón) viven SÓLO en el panel clínico audiométrico.
 *   - TA = vía aérea; VO = vía ósea (sólo si están visibles en el
 *     documento).
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
  /**
   * FND-20260825-15: el campo `criterios` (PTA3, PTA fuente, criterio
   * AMI, patrón, estado bilateral, completitud, advertencias) ya NO
   * forma parte del PDF. Esos datos viven únicamente en el panel
   * clínico audiométrico. El shape del PDF queda alineado con su
   * contenido: evidencia documental + impresión + recomendaciones +
   * notas + identidad/firma.
   */
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

// FND-20260825-14 / FND-20260825-15 — Retiro de las secciones "Criterio
// audiométrico AMI (referencia)" (DEC-20260825-10) y "Criterios
// audiométricos derivados" (DEC-20260825-11) del PDF. Las constantes
// `CRITERIO_AMI_LABEL`, `PATRON_AMI_LABEL` y `BILATERAL_LABEL` dejaron de
// ser usadas y se eliminaron. `formatDb` se conserva porque sigue
// dando formato a TA/VO en la sección II (evidencia documental).

// DEC-20260825-10 / DEC-20260825-11 — la sección IV de referencia AMI
// (FND-20260825-12) y la sección III "Criterios audiométricos derivados"
// (FND-20260825-15) fueron RETIRADAS del PDF por rectificación de Frank.
// Esa información (administrativa + derivada) vive SÓLO en el panel
// clínico audiométrico (`AudiometriaClinicalCriteriaPanel`). El PDF se
// concentra en: datos del estudio (I), evidencia documental fuente (II),
// impresión del médico (III), recomendaciones validadas (IV) y notas (V).
// Identidad + firma + cédula siguen al final.

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

      {/* DEC-20260825-10 — sección III "Criterios audiométricos
          DERIVADOS" RETIRADA del PDF (FND-20260825-15). Los datos
          derivados del paciente (PTA3, PTA fuente, criterio AMI,
          patrón, estado bilateral, completitud, advertencias) viven
          SÓLO en el panel clínico audiométrico. La sección II del
          PDF conserva la EVIDENCIA DOCUMENTAL del paciente (tabla
          TA/VO por frecuencia y por oído).

          Nota: la sección IV "Criterio audiométrico AMI (referencia)"
          — tablas administrativas de patrones operativos, severidad y
          etiologías — TAMBIÉN fue retirada en FND-20260825-14 (live
          sólo en el acordeón nativo del panel, FND-20260825-13). */}

      {/* III. IMPRESIÓN DIAGNÓSTICA VALIDADA */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          III. Impresión diagnóstica (validada por el médico)
        </Text>
        <View style={styles.verdictBox}>
          <Text style={styles.paragraph}>{data.doctorDiagnosis}</Text>
        </View>
      </View>

      {/* IV. RECOMENDACIONES VALIDADAS */}
      {data.recomendacionesValidadas.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IV. Recomendaciones validadas</Text>
          {data.recomendacionesValidadas.map((r, i) => (
            <Text key={i} style={styles.bulletItem}>
              • {r}
            </Text>
          ))}
        </View>
      ) : null}

      {/* V. NOTAS */}
      {data.doctorNotes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>V. Notas clínicas</Text>
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

// FND-20260825-15: `formatBool` ya NO se usa en este PDF (la sección
// "Criterios audiométricos derivados" se retiró). Se elimina la
// exportación que se conservaba por simetría con el PDF de Espirometría.
// Si una futura sección la necesita, volver a declarar la función.