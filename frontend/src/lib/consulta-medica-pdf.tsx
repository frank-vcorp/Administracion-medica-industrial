import { Document, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  TIPO_CONSULTA_LABELS,
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

export interface ConsultaMedicaPdfPatient {
  nombre: string
  telefono?: string | null
  sexo?: string | null
  edad?: string | null
  empresa?: string | null
  departamento?: string | null
  fecha: string
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

        <View style={styles.block}>
          <Text style={styles.title}>EXPLORACIÓN FÍSICA</Text>
          <Text style={styles.paragraph}>{c.exploracion_fisica}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.title}>DIAGNÓSTICO</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Diagnóstico unificado CIE:</Text>
            <Text style={styles.value}>{c.diagnostico_unificado}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Incapacidad:</Text>
            <Text style={styles.value}>{c.otorga_incapacidad}</Text>
          </View>
          {c.otorga_incapacidad === 'SI' ? (
            <>
              <View style={styles.row}>
                <Text style={styles.label}>Días:</Text>
                <Text style={styles.value}>{String(c.dias_incapacidad ?? 0)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Pase de salida:</Text>
                <Text style={styles.value}>{c.pase_salida ?? 'NO'}</Text>
              </View>
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

        {c.indicaciones_generales?.trim() ? (
          <View style={styles.block}>
            <Text style={styles.title}>TRATAMIENTO / INDICACIONES</Text>
            <Text style={styles.paragraph}>{c.indicaciones_generales}</Text>
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
  const { patient, consulta: c, prescriptor } = data
  const lineas: RecetaLinea[] = c.receta_lineas ?? []
  const medicoNombre = prescriptor?.nombre?.trim() || c.medico_nombre
  const medicoCedula = prescriptor?.cedula?.trim() || c.medico_cedula
  const firmaUrl = prescriptor?.firmaUrl?.trim() || ''

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brand}>RECETA MÉDICA</Text>
          <Text style={styles.sub}>Soluciones Médico Empresariales · Medicina laboral</Text>
        </View>

        <View style={styles.block}>
          <View style={styles.row}>
            <Text style={styles.label}>Médico:</Text>
            <Text style={styles.value}>{medicoNombre}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Cédula profesional:</Text>
            <Text style={styles.value}>{v(medicoCedula)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Paciente:</Text>
            <Text style={styles.value}>{patient.nombre}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Edad / sexo:</Text>
            <Text style={styles.value}>
              {v(patient.edad)} · {v(patient.sexo)}
            </Text>
          </View>
          {patient.telefono ? (
            <View style={styles.row}>
              <Text style={styles.label}>Teléfono:</Text>
              <Text style={styles.value}>{patient.telefono}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Empresa:</Text>
            <Text style={styles.value}>{v(patient.empresa)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Fecha:</Text>
            <Text style={styles.value}>{patient.fecha}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Diagnóstico:</Text>
            <Text style={styles.value}>{v(c.diagnostico_especifico)}</Text>
          </View>
        </View>

        <Text style={styles.title}>Rp.</Text>

        {lineas.length > 0 ? (
          <View style={styles.block}>
            <View style={styles.tableHeader}>
              <Text style={styles.colMed}>Medicamento</Text>
              <Text style={styles.colDosis}>Dosis</Text>
              <Text style={styles.colFreq}>Frecuencia</Text>
              <Text style={styles.colDur}>Duración</Text>
            </View>
            {lineas.map((line, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colMed}>
                  {line.medicamento}
                  {line.presentacion?.trim() ? ` (${line.presentacion})` : ''}
                </Text>
                <Text style={styles.colDosis}>{line.dosis}</Text>
                <Text style={styles.colFreq}>{line.frecuencia}</Text>
                <Text style={styles.colDur}>{line.duracion}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.paragraph}>Sin medicamentos prescritos en esta consulta.</Text>
        )}

        {c.indicaciones_generales?.trim() ? (
          <View style={styles.block}>
            <Text style={styles.title}>INDICACIONES</Text>
            <Text style={styles.paragraph}>{c.indicaciones_generales}</Text>
          </View>
        ) : null}

        <View style={styles.signBlock}>
          {firmaUrl ? (
            // Imagen de react-pdf, no un <img> HTML.
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={firmaUrl} style={styles.signature} />
          ) : null}
          <Text style={styles.signName}>{medicoNombre}</Text>
          <Text>Cédula profesional: {v(medicoCedula)}</Text>
          <Text style={styles.footer}>Firma de quien capturó la consulta o tenía la sesión abierta.</Text>
        </View>
      </Page>
    </Document>
  )
}
