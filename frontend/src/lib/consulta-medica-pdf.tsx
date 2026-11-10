import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import { SME_BRAND_LINE, SME_LEGAL_NAME, SME_LOGO_FALLBACK_TEXT } from '@/lib/brand-constants'
import {
  buildDiagnosticoRecetaDisplay,
  SME_PDF_FOOTER,
} from '@/lib/clinical/consulta-receta-pdf-format'
import { CONSULTA_ANTECEDENTES_RUBROS } from '@/lib/clinical/consulta-antecedentes-resumen'
import { formatProximaCitaLine } from '@/lib/clinical/consulta-seguimiento'
import {
  TIPO_CONSULTA_LABELS,
  TIPO_INCAPACIDAD_CONSULTA_LABELS,
  type ConsultaMedicaPayload,
  type RecetaLinea,
  type TipoConsultaValue,
} from '@/schemas/clinical/consulta-medica.schema'

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a' },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 10,
    marginBottom: 16,
  },
  brand: { fontSize: 14, fontWeight: 'bold' },
  sub: { fontSize: 9, color: '#64748b', marginTop: 4 },
  title: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 120, fontSize: 9, color: '#475569', fontWeight: 'bold' },
  value: { flex: 1, fontSize: 10 },
  block: { marginBottom: 12 },
  paragraph: { fontSize: 10, lineHeight: 1.45, textAlign: 'justify' },
  footer: { marginTop: 24, fontSize: 9, color: '#64748b' },
  signature: { width: 140, height: 56, objectFit: 'contain', marginTop: 8 },
  signBlock: { marginTop: 28, alignItems: 'flex-start' },
  signName: { marginTop: 4, fontSize: 11, fontWeight: 'bold' },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', padding: 6, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 6 },
  colMed: { width: '28%' },
  colDosis: { width: '24%' },
  colFreq: { width: '24%' },
  colDur: { width: '24%' },
})

const recetaStyles = StyleSheet.create({
  page: { padding: 36, paddingBottom: 72, fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#0d9488',
    paddingBottom: 10,
  },
  headerLeft: { flex: 1, paddingRight: 12 },
  brand: { fontSize: 15, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 8, color: '#475569', marginTop: 3, lineHeight: 1.35 },
  headerRight: { width: 132, alignItems: 'flex-end' },
  logoImage: { width: 128, height: 46, objectFit: 'contain' },
  logoFallback: {
    width: 128,
    height: 46,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
    textAlign: 'center',
    paddingTop: 14,
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0f766e',
  },
  docTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0f766e',
    letterSpacing: 1.2,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    fontSize: 8,
    color: '#64748b',
  },
  fechaLegal: {
    fontSize: 10,
    color: '#0f172a',
    marginBottom: 12,
    lineHeight: 1.45,
    textAlign: 'right',
    fontStyle: 'italic',
  },
  patientCard: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 10,
    marginBottom: 14,
    backgroundColor: '#f8fafc',
  },
  patientTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f766e',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 108, fontSize: 9, fontWeight: 'bold', color: '#475569' },
  value: { flex: 1, fontSize: 9, color: '#0f172a' },
  rpTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f766e',
    marginBottom: 8,
    marginTop: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#0d9488',
    paddingVertical: 7,
    paddingHorizontal: 6,
  },
  tableHeaderText: { fontSize: 8, fontWeight: 'bold', color: '#ffffff' },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    paddingVertical: 7,
    paddingHorizontal: 6,
    backgroundColor: '#ffffff',
  },
  tableRowAlt: { backgroundColor: '#f0fdfa' },
  colMed: { width: '32%' },
  colPres: { width: '14%' },
  colDosis: { width: '18%' },
  colFreq: { width: '18%' },
  colDur: { width: '18%' },
  cell: { fontSize: 9, color: '#0f172a', lineHeight: 1.35 },
  emptyRx: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
    borderRadius: 4,
    fontSize: 9,
    color: '#64748b',
    textAlign: 'center',
  },
  indicaciones: {
    marginTop: 12,
    padding: 10,
    backgroundColor: '#fffbeb',
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  indicacionesTitle: { fontSize: 9, fontWeight: 'bold', color: '#92400e', marginBottom: 4 },
  paragraph: { fontSize: 9, lineHeight: 1.5, color: '#0f172a' },
  signatureArea: { marginTop: 28, flexDirection: 'row', justifyContent: 'flex-end' },
  signatureBox: { width: 260, alignItems: 'center' },
  signatureImage: { width: 200, height: 64, objectFit: 'contain', marginBottom: 4 },
  signatureLine: {
    width: 200,
    borderBottomWidth: 1,
    borderBottomColor: '#0f172a',
    marginBottom: 6,
    height: 48,
  },
  signName: { fontSize: 10, fontWeight: 'bold', color: '#0f172a', textAlign: 'center' },
  signLicense: { fontSize: 9, color: '#475569', marginTop: 2, textAlign: 'center' },
  signRole: { fontSize: 8, color: '#64748b', marginTop: 4, textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
    lineHeight: 1.35,
  },
})

export interface ConsultaMedicaPdfPatient {
  nombre: string
  telefono?: string | null
  sexo?: string | null
  edad?: string | null
  empresa?: string | null
  departamento?: string | null
  fecha: string
  /** «Sucursal …, a 9 de noviembre de 2026» */
  fechaLegal?: string
  lugar?: string
  folio?: string
}

export interface ConsultaMedicaPrescriptor {
  nombre: string
  cedula: string
  firmaUrl?: string | null
}

export interface ConsultaMedicaPdfInput {
  patient: ConsultaMedicaPdfPatient
  consulta: ConsultaMedicaPayload
  prescriptor?: ConsultaMedicaPrescriptor
  logoUrl?: string
}

function v(s: string | null | undefined): string {
  return s?.trim() ? s.trim() : '—'
}

function taDisplay(sv: ConsultaMedicaPayload['signos_vitales']): string {
  const s = sv.ta_sistolica?.trim()
  const d = sv.ta_diastolica?.trim()
  if (s && d) return `${s}/${d}`
  return s || d || '—'
}

export function ConsultaMedicaNotaPDF({ data }: { data: ConsultaMedicaPdfInput }) {
  const { patient, consulta: c } = data
  const tipo =
    TIPO_CONSULTA_LABELS[c.tipo_consulta as TipoConsultaValue] ?? c.tipo_consulta

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>CONSULTA MÉDICA</Text>
          <Text style={styles.sub}>Soluciones Médico Empresariales · Medicina Laboral</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.title}>IDENTIFICACIÓN</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Nombre:</Text>
            <Text style={styles.value}>{patient.nombre}</Text>
          </View>
          {patient.telefono ? (
            <View style={styles.row}>
              <Text style={styles.label}>Teléfono:</Text>
              <Text style={styles.value}>{patient.telefono}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Sexo / Edad:</Text>
            <Text style={styles.value}>
              {v(patient.sexo)} · {v(patient.edad)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Empresa:</Text>
            <Text style={styles.value}>{v(patient.empresa)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha:</Text>
            <Text style={styles.value}>{patient.fecha}</Text>
          </View>
          {patient.departamento ? (
            <View style={styles.row}>
              <Text style={styles.label}>Depto:</Text>
              <Text style={styles.value}>{patient.departamento}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.title}>SIGNOS VITALES</Text>
          <Text style={styles.paragraph}>
            TA: {taDisplay(c.signos_vitales)} mmHg · FC: {v(c.signos_vitales.fc_min)}/min · T°:{' '}
            {v(c.signos_vitales.temperatura)} · Peso: {v(c.signos_vitales.peso_kg)} kg · Talla:{' '}
            {v(c.signos_vitales.talla_m)} m · IMC: {v(c.signos_vitales.imc)} · Complexión:{' '}
            {v(c.signos_vitales.complexion)}
          </Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.title}>MOTIVO DE LA CONSULTA</Text>
          <Text style={styles.paragraph}>{c.motivo_consulta}</Text>
        </View>

        {c.antecedentes_consulta &&
        CONSULTA_ANTECEDENTES_RUBROS.some(({ key }) =>
          String(c.antecedentes_consulta?.[key] ?? '').trim(),
        ) ? (
          <View style={styles.block}>
            <Text style={styles.title}>ANTECEDENTES PERSONALES</Text>
            {CONSULTA_ANTECEDENTES_RUBROS.map(({ key, label }) => {
              const text = String(c.antecedentes_consulta?.[key] ?? '').trim()
              if (!text) return null
              return (
                <View key={key} style={{ marginBottom: 6 }}>
                  <Text style={styles.label}>{label}:</Text>
                  <Text style={styles.paragraph}>{text}</Text>
                </View>
              )
            })}
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.title}>EXPLORACIÓN FÍSICA</Text>
          <Text style={styles.paragraph}>{c.exploracion_fisica}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.title}>DIAGNÓSTICO</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Diagnóstico CIE-10:</Text>
            <Text style={styles.value}>{c.diagnostico_unificado}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>¿Requiere incapacidad?:</Text>
            <Text style={styles.value}>{c.otorga_incapacidad}</Text>
          </View>
          {c.otorga_incapacidad === 'SI' ? (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Tipo:</Text>
                <Text style={styles.value}>
                  {c.tipo_incapacidad
                    ? TIPO_INCAPACIDAD_CONSULTA_LABELS[c.tipo_incapacidad]
                    : '—'}
                </Text>
              </View>
              {c.tipo_incapacidad === 'INTERNA_SME' ? (
                <View style={styles.row}>
                  <Text style={styles.label}>Días (interna SME):</Text>
                  <Text style={styles.value}>{String(c.dias_incapacidad ?? 0)}</Text>
                </View>
              ) : null}
            </>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Diagnóstico específico:</Text>
            <Text style={styles.value}>{c.diagnostico_especifico}</Text>
          </View>
        </View>

        {c.material_medico?.trim() ? (
          <View style={styles.block}>
            <Text style={styles.title}>MATERIAL MÉDICO UTILIZADO</Text>
            <Text style={styles.paragraph}>{c.material_medico}</Text>
          </View>
        ) : null}

        {c.indicaciones_generales?.trim() || formatProximaCitaLine(c) ? (
          <View style={styles.block}>
            <Text style={styles.title}>TRATAMIENTO / INDICACIONES</Text>
            {c.indicaciones_generales?.trim() ? (
              <Text style={styles.paragraph}>{c.indicaciones_generales}</Text>
            ) : null}
            {formatProximaCitaLine(c) ? (
              <Text style={styles.paragraph}>
                Próxima cita de seguimiento: {formatProximaCitaLine(c)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text>Tipo de consulta: {tipo}</Text>
          <Text>
            Realizó: {c.medico_nombre} · Ced. Prof.: {c.medico_cedula}
          </Text>
        </View>
      </Page>
    </Document>
  )
}

export function ConsultaMedicaRecetaPDF({ data }: { data: ConsultaMedicaPdfInput }) {
  const { patient, consulta: c, prescriptor, logoUrl } = data
  const lineas: RecetaLinea[] = c.receta_lineas ?? []
  const medicoNombre = prescriptor?.nombre?.trim() || c.medico_nombre
  const medicoCedula = prescriptor?.cedula?.trim() || c.medico_cedula
  const firmaUrl = prescriptor?.firmaUrl?.trim() || ''
  const diagnostico = buildDiagnosticoRecetaDisplay(c)
  const fechaLugar =
    patient.fechaLegal?.trim() ||
    (patient.lugar && patient.fecha
      ? `${patient.lugar}, a ${patient.fecha}`
      : patient.fecha)

  return (
    <Document
      title={`Receta-${patient.folio ?? 'consulta'}`}
      author={`Dr(a). ${medicoNombre}`}
      subject="Receta médica — medicina laboral"
    >
      <Page size="A4" style={recetaStyles.page}>
        <View style={recetaStyles.header} fixed>
          <View style={recetaStyles.headerLeft}>
            <Text style={recetaStyles.brand}>{SME_LEGAL_NAME}</Text>
            <Text style={recetaStyles.brandSub}>{SME_BRAND_LINE}</Text>
            <Text style={recetaStyles.brandSub}>
              Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro
            </Text>
            <Text style={recetaStyles.brandSub}>Tel. (442) 225-52-67 · www.medicaindustrial.com</Text>
          </View>
          <View style={recetaStyles.headerRight}>
            {logoUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image style={recetaStyles.logoImage} src={logoUrl} />
            ) : (
              <Text style={recetaStyles.logoFallback}>{SME_LOGO_FALLBACK_TEXT}</Text>
            )}
          </View>
        </View>

        <Text style={recetaStyles.docTitle}>Receta médica</Text>

        <View style={recetaStyles.metaRow}>
          <Text>Folio: {v(patient.folio)}</Text>
          <Text>Fecha de emisión: {patient.fecha}</Text>
        </View>

        <Text style={recetaStyles.fechaLegal}>{fechaLugar}</Text>

        <View style={recetaStyles.patientCard}>
          <Text style={recetaStyles.patientTitle}>Datos del paciente</Text>
          <View style={recetaStyles.row}>
            <Text style={recetaStyles.label}>Nombre:</Text>
            <Text style={recetaStyles.value}>{patient.nombre}</Text>
          </View>
          <View style={recetaStyles.row}>
            <Text style={recetaStyles.label}>Edad / sexo:</Text>
            <Text style={recetaStyles.value}>
              {v(patient.edad)} · {v(patient.sexo)}
            </Text>
          </View>
          {patient.telefono ? (
            <View style={recetaStyles.row}>
              <Text style={recetaStyles.label}>Teléfono:</Text>
              <Text style={recetaStyles.value}>{patient.telefono}</Text>
            </View>
          ) : null}
          <View style={recetaStyles.row}>
            <Text style={recetaStyles.label}>Empresa:</Text>
            <Text style={recetaStyles.value}>{v(patient.empresa)}</Text>
          </View>
          <View style={recetaStyles.row}>
            <Text style={recetaStyles.label}>Diagnóstico:</Text>
            <Text style={recetaStyles.value}>{diagnostico}</Text>
          </View>
        </View>

        <View style={recetaStyles.row}>
          <Text style={recetaStyles.label}>Médico tratante:</Text>
          <Text style={recetaStyles.value}>{medicoNombre}</Text>
        </View>
        <View style={recetaStyles.row}>
          <Text style={recetaStyles.label}>Cédula profesional:</Text>
          <Text style={recetaStyles.value}>{v(medicoCedula)}</Text>
        </View>

        <Text style={recetaStyles.rpTitle}>Rp. / Prescripción</Text>

        {lineas.length > 0 ? (
          <View>
            <View style={recetaStyles.tableHeader}>
              <Text style={[recetaStyles.colMed, recetaStyles.tableHeaderText]}>Medicamento</Text>
              <Text style={[recetaStyles.colPres, recetaStyles.tableHeaderText]}>Present.</Text>
              <Text style={[recetaStyles.colDosis, recetaStyles.tableHeaderText]}>Dosis</Text>
              <Text style={[recetaStyles.colFreq, recetaStyles.tableHeaderText]}>Frecuencia</Text>
              <Text style={[recetaStyles.colDur, recetaStyles.tableHeaderText]}>Duración</Text>
            </View>
            {lineas.map((line, i) => (
              <View
                key={i}
                style={
                  i % 2 === 1
                    ? [recetaStyles.tableRow, recetaStyles.tableRowAlt]
                    : recetaStyles.tableRow
                }
              >
                <Text style={[recetaStyles.colMed, recetaStyles.cell]}>{line.medicamento}</Text>
                <Text style={[recetaStyles.colPres, recetaStyles.cell]}>
                  {v(line.presentacion)}
                </Text>
                <Text style={[recetaStyles.colDosis, recetaStyles.cell]}>{line.dosis}</Text>
                <Text style={[recetaStyles.colFreq, recetaStyles.cell]}>{line.frecuencia}</Text>
                <Text style={[recetaStyles.colDur, recetaStyles.cell]}>{line.duracion}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={recetaStyles.emptyRx}>
            Sin medicamentos prescritos en esta consulta. Indique tratamiento en la pestaña Medicamento
            antes de imprimir.
          </Text>
        )}

        {c.indicaciones_generales?.trim() || formatProximaCitaLine(c) ? (
          <View style={recetaStyles.indicaciones}>
            {c.indicaciones_generales?.trim() ? (
              <>
                <Text style={recetaStyles.indicacionesTitle}>Indicaciones generales</Text>
                <Text style={recetaStyles.paragraph}>{c.indicaciones_generales}</Text>
              </>
            ) : null}
            {formatProximaCitaLine(c) ? (
              <Text style={recetaStyles.paragraph}>
                Próxima cita de seguimiento: {formatProximaCitaLine(c)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={recetaStyles.signatureArea}>
          <View style={recetaStyles.signatureBox}>
            {firmaUrl ? (
              // eslint-disable-next-line jsx-a11y/alt-text
              <Image src={firmaUrl} style={recetaStyles.signatureImage} />
            ) : (
              <View style={recetaStyles.signatureLine} />
            )}
            <Text style={recetaStyles.signName}>Dr(a). {medicoNombre}</Text>
            <Text style={recetaStyles.signLicense}>Cédula profesional: {v(medicoCedula)}</Text>
            <Text style={recetaStyles.signRole}>Médico responsable del tratamiento</Text>
          </View>
        </View>

        <Text style={recetaStyles.footer} fixed>
          {SME_PDF_FOOTER}
          {'\n'}
          Documento generado electrónicamente por {SME_LEGAL_NAME}. Válido con firma autógrafa del
          médico tratante.
        </Text>
      </Page>
    </Document>
  )
}
