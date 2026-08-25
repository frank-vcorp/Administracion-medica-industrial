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
 *   - El PDF diferencia explícitamente tres capas:
 *       I.  Datos del estudio y paciente (NOM)
 *       II. Evidencia audiométrica por oído y frecuencia (Fuente)
 *       III. Criterios clínicos audiométricos (AMI + sistema)
 *       IV. Criterio audiométrico AMI (referencia) — FND-20260825-12
 *       V.  Impresión diagnóstica validada por el médico
 *       VI. Recomendaciones validadas (snapshot IA aceptado)
 *       VII. Notas clínicas
 *   - TA = vía aérea; VO = vía ósea (sólo si están visibles en el
 *     documento).
 *   - PTA3 calculado = (TA500+TA1000+TA2000)/3 se muestra con la
 *     ECUACIÓN, las TRES ENTRADAS, el resultado y la fuente del cálculo,
 *     junto con el `pta_fuente` (PTA del documento) por separado.
 *   - FND-20260825-12 (FND-/BR-/DEC-/20260825-12): la nueva sección IV
 *     reproduce la TABLA DE REFERENCIA del programa audiométrico AMI
 *     (normalidad, patrones operativos, severidad, etiologías). Es
 *     información administrativa SEPARADA del resultado derivado (III) y
 *     de la decisión médica (V). NO convierte la referencia en
 *     diagnóstico automático: el clínico consulta la tabla al emitir
 *     la impresión diagnóstica.
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import {
  AMI_NORMALIDAD_DB,
  AMI_PATRONES_REFERENCIA,
  AMI_SEVERIDAD_REFERENCIA,
  AMI_ETIOLOGIAS_REFERENCIA,
} from '@/components/clinical/AudiometriaClinicalCriteriaPanel'

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
  // FND-20260825-12 — estilos de la sección de referencia AMI.
  referenceBox: {
    borderWidth: 1,
    borderColor: '#94a3b8',
    borderRadius: 4,
    padding: 6,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  referenceTag: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  referenceIntro: {
    fontSize: 8,
    color: '#334155',
    marginBottom: 4,
    lineHeight: 1.4,
  },
  referenceBlockTitle: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
    marginTop: 3,
  },
  referenceTableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  referenceTableHeaderCell: { flex: 1, fontSize: 7, fontWeight: 'bold', color: '#0f172a' },
  referenceTableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  referenceTableCell: { flex: 1, fontSize: 7, color: '#0f172a' },
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

// ──────────────────────────────────────────────────────────────────────────
// FND-20260825-12 — `AmiReferencePdfSection`
//
// Bloque del PDF que reproduce la TABLA DE REFERENCIA del programa
// audiométrico AMI. Está SEPARADA del resultado derivado (sección III
// arriba) y de la decisión médica (sección V abajo). Es información
// administrativa que el clínico y el programa consultan al emitir la
// impresión diagnóstica. NO es diagnóstico automático.
//
// Fuente única de verdad: las constantes `AMI_*_REFERENCIA` viven en
// `AudiometriaClinicalCriteriaPanel.tsx` para que panel clínico y PDF
// compartan la misma tabla (mismo hash si las tablas referenciadas no
// cambian).
// ──────────────────────────────────────────────────────────────────────────

const AmiReferencePdfSection = () => (
  <View style={styles.section} wrap={false}>
    <Text style={styles.sectionTitle}>
      IV. Criterio audiométrico AMI (referencia)
    </Text>
    <View style={styles.referenceBox}>
      <Text style={styles.referenceTag}>REFERENCIA OPERATIVA</Text>
      <Text style={styles.referenceIntro}>
        Tabla administrativa del programa audiométrico AMI. Esta sección
        es de CONSULTA: el resultado derivado del paciente está en la
        sección III y la impresión diagnóstica en la sección V, ambas
        firmadas por el médico tratante.
      </Text>

      <Text style={styles.referenceBlockTitle}>1. Normalidad</Text>
      <Text style={styles.referenceIntro}>
        Umbral AMI: PTA ≤ {AMI_NORMALIDAD_DB} dB HL → Normal.
      </Text>

      <Text style={styles.referenceBlockTitle}>
        2. Patrón nosológico operativo
      </Text>
      <View style={styles.table}>
        <View style={styles.referenceTableHeader}>
          <Text style={styles.referenceTableHeaderCell}>Patrón</Text>
          <Text style={styles.referenceTableHeaderCell}>Frecuencias</Text>
          <Text style={styles.referenceTableHeaderCell}>Descripción</Text>
        </View>
        {AMI_PATRONES_REFERENCIA.map(p => (
          <View key={p.id} style={styles.referenceTableRow}>
            <Text style={styles.referenceTableCell}>{p.etiqueta}</Text>
            <Text style={styles.referenceTableCell}>
              {p.frecuenciasOperativas}
            </Text>
            <Text style={styles.referenceTableCell}>{p.descripcion}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.referenceBlockTitle}>
        3. Severidad (por peor PTA, dB HL)
      </Text>
      <View style={styles.table}>
        <View style={styles.referenceTableHeader}>
          <Text style={styles.referenceTableHeaderCell}>Categoría</Text>
          <Text style={styles.referenceTableHeaderCell}>Rango</Text>
          <Text style={styles.referenceTableHeaderCell}>Descripción</Text>
        </View>
        {AMI_SEVERIDAD_REFERENCIA.map(s => (
          <View key={s.id} style={styles.referenceTableRow}>
            <Text style={styles.referenceTableCell}>{s.etiqueta}</Text>
            <Text style={styles.referenceTableCell}>{s.rangoDB}</Text>
            <Text style={styles.referenceTableCell}>{s.descripcion}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.referenceBlockTitle}>
        4. Categorías etiológicas AMI
      </Text>
      <View style={styles.table}>
        <View style={styles.referenceTableHeader}>
          <Text style={styles.referenceTableHeaderCell}>Categoría</Text>
          <Text style={[styles.referenceTableHeaderCell, { flex: 2 }]}>
            Nota administrativa
          </Text>
        </View>
        {AMI_ETIOLOGIAS_REFERENCIA.map(e => (
          <View key={e.id} style={styles.referenceTableRow}>
            <Text style={styles.referenceTableCell}>{e.etiqueta}</Text>
            <Text
              style={[styles.referenceTableCell, { flex: 2 }]}
            >
              {e.nota}
            </Text>
          </View>
        ))}
      </View>
    </View>
  </View>
)

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

      {/* 1. DATOS DEL ESTUDIO Y PACIENTE */}
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

      {/* 2. EVIDENCIA AUDIOMÉTRICA (capa Fuente) */}
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

      {/* 3. CRITERIOS AUDIOMÉTRICOS (capa AMI / Derivada) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          III. Criterios audiométricos (criterio AMI ≤ 25 dB)
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

      {/* FND-20260825-12 — IV. Criterio audiométrico AMI (referencia).
          Sección explícita y legible que muestra la TABLA DE REFERENCIA
          del programa audiométrico AMI. Es información administrativa
          SEPARADA del resultado derivado (sección III) y de la decisión
          médica (sección V). El médico y el programa consultan esta tabla
          al emitir la impresión diagnóstica; NO convierte la referencia
          en diagnóstico automático. */}
      <AmiReferencePdfSection />

      {/* 5. IMPRESIÓN DIAGNÓSTICA VALIDADA */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          V. Impresión diagnóstica (validada por el médico)
        </Text>
        <View style={styles.verdictBox}>
          <Text style={styles.paragraph}>{data.doctorDiagnosis}</Text>
        </View>
      </View>

      {/* 6. RECOMENDACIONES VALIDADAS */}
      {data.recomendacionesValidadas.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VI. Recomendaciones validadas</Text>
          {data.recomendacionesValidadas.map((r, i) => (
            <Text key={i} style={styles.bulletItem}>
              • {r}
            </Text>
          ))}
        </View>
      ) : null}

      {/* 7. NOTAS */}
      {data.doctorNotes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VII. Notas clínicas</Text>
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