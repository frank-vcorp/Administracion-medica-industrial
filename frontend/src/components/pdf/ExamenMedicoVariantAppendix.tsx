import { Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { ExamenMedicoPDFData } from '@/components/pdf/ExamenMedicoValidatedPDF'
import {
  INTERROGATORIO_SISTEMAS,
  NORDICO_REGIONES,
  NORDICO_REGION_LABELS,
  type FlowserveExtensionData,
  type SodexoExtensionData,
} from '@/schemas/clinical/examen-medico-variant.schema'

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#0f172a' },
  title: { fontSize: 12, fontWeight: 'bold', marginBottom: 8, color: '#0f766e' },
  sectionTitle: {
    fontSize: 9,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    padding: 4,
    marginBottom: 4,
    marginTop: 8,
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: '38%', fontWeight: 'bold', color: '#475569' },
  value: { width: '62%' },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    padding: 4,
    marginTop: 4,
  },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', padding: 3 },
  colRegion: { width: '28%', fontSize: 8 },
  colAnswer: { width: '24%', fontSize: 8, textAlign: 'center' },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    textAlign: 'center',
    fontSize: 6,
    color: '#94a3b8',
  },
})

const v = (s?: string | null) => (s?.trim() ? s.trim() : '—')
const siNo = (s?: string | null) => (s === 'SI' ? 'Sí' : s === 'NO' ? 'No' : '—')

function FieldRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{v(value)}</Text>
    </View>
  )
}

export function ExamenMedicoVariantAppendixPages({ data }: { data: ExamenMedicoPDFData }) {
  if (!data.variant || data.variant === 'AMI') return null

  if (data.variant === 'FLOWSERVE') {
    const ext = data.variantExtensions?.FLOWSERVE as FlowserveExtensionData | undefined
    if (!ext) return null
    return (
      <>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Anexo Flowserve — Examen Médico</Text>
        <Text style={styles.sectionTitle}>Identificación complementaria</Text>
        <FieldRow label="Área" value={ext.area} />
        <FieldRow label="Alergias" value={ext.alergias} />
        <FieldRow label="Religión" value={ext.religion} />
        <FieldRow label="Contacto emergencia" value={ext.contacto_emergencia} />
        <FieldRow label="Celular emergencia" value={ext.celular_emergencia} />

        <Text style={styles.sectionTitle}>Higiene y estilo de vida</Text>
        <FieldRow label="Baño (× sem)" value={ext.higiene_bano} />
        <FieldRow label="Aseo bucal" value={ext.higiene_aseo_bucal} />
        <FieldRow label="Cambio de ropa" value={ext.higiene_cambio_ropa} />
        <FieldRow label="Alimentación" value={ext.alimentacion_nivel} />
        <FieldRow label="Actividad física" value={ext.actividad_fisica_frecuencia} />
        <FieldRow label="Tipo actividad" value={ext.actividad_fisica_tipo} />
        <FieldRow label="Sat O₂ %" value={ext.sat_o2} />

        <Text style={styles.sectionTitle}>Test de Ruffier</Text>
        <FieldRow label="FC inicial" value={ext.ruffier_fc_inicial} />
        <FieldRow label="FC flexiones" value={ext.ruffier_fc_flexiones} />
        <FieldRow label="FC al minuto" value={ext.ruffier_fc_minuto} />
        <FieldRow label="Resultado" value={ext.ruffier_resultado} />
        <FieldRow label="Nivel de salud" value={ext.nivel_salud} />

        <Text style={styles.sectionTitle}>Interrogatorio por aparatos y sistemas</Text>
        {INTERROGATORIO_SISTEMAS.map((s) => {
          const row = ext.interrogatorio?.[s]
          return (
            <FieldRow
              key={s}
              label={s.replace(/_/g, ' ')}
              value={
                row?.estado === 'CON_SINTOMAS'
                  ? `CON SÍNTOMAS — ${row.especifique ?? ''}`
                  : 'SIN SÍNTOMAS'
              }
            />
          )
        })}

        <Text style={styles.sectionTitle}>Declaración</Text>
        <Text>{v(ext.declaracion_protesta)}</Text>

        <Text style={styles.footer} fixed>
          Anexo Flowserve · Administración Médica Industrial
        </Text>
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Cuestionario Nórdico Kuorinka — Flowserve</Text>
        <Text style={{ fontSize: 8, marginBottom: 8, color: '#64748b' }}>
          Molestias musculoesqueléticas (dolor, molestia, hormigueo o entumecimiento) por región.
        </Text>
        <View style={styles.tableHeader}>
          <Text style={[styles.colRegion, { fontWeight: 'bold' }]}>Región</Text>
          <Text style={[styles.colAnswer, { fontWeight: 'bold' }]}>12 meses</Text>
          <Text style={[styles.colAnswer, { fontWeight: 'bold' }]}>Imp. trabajo</Text>
          <Text style={[styles.colAnswer, { fontWeight: 'bold' }]}>7 días</Text>
        </View>
        {NORDICO_REGIONES.map((region) => {
          const row = ext.cuestionario_nordico?.[region]
          return (
            <View key={region} style={styles.tableRow}>
              <Text style={styles.colRegion}>{NORDICO_REGION_LABELS[region]}</Text>
              <Text style={styles.colAnswer}>{siNo(row?.sintomas_12m)}</Text>
              <Text style={styles.colAnswer}>{siNo(row?.impidio_trabajo_12m)}</Text>
              <Text style={styles.colAnswer}>{siNo(row?.sintomas_7d)}</Text>
            </View>
          )
        })}
        <Text style={styles.footer} fixed>
          Cuestionario Nórdico · Anexo Flowserve · Administración Médica Industrial
        </Text>
      </Page>
      </>
    )
  }

  const ext = data.variantExtensions?.SODEXO as SodexoExtensionData | undefined
  if (!ext) return null
  const epp = [
    ext.epp_casco && 'Casco',
    ext.epp_mascarilla && 'Mascarilla',
    ext.epp_lentes && 'Lentes',
    ext.epp_botas && 'Botas',
    ext.epp_guantes && 'Guantes',
    ext.epp_faja && 'Faja',
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.title}>Anexo Sodexo (REG-SO-01) — Examen Médico</Text>
      <Text style={styles.sectionTitle}>Tipo de examen y contacto</Text>
      <FieldRow label="Tipo examen" value={ext.tipo_examen} />
      <FieldRow label="Contacto emergencia" value={ext.contacto_emergencia} />
      <FieldRow label="Teléfono emergencia" value={ext.telefono_emergencia} />

      <Text style={styles.sectionTitle}>Actividades</Text>
      <FieldRow label="Cargo" value={ext.actividades_cargo} />
      <FieldRow label="Fecha ingreso" value={ext.fecha_ingreso_actividades} />
      <FieldRow label="Antigüedad" value={ext.antiguedad_actividades} />
      <FieldRow label="Tipo actividad" value={ext.tipo_actividad} />

      <Text style={styles.sectionTitle}>EPP</Text>
      <FieldRow label="Elementos" value={epp || '—'} />

      <Text style={styles.sectionTitle}>Matriz de riesgos / observaciones</Text>
      <Text>{v(ext.matriz_riesgos_observaciones)}</Text>

      <Text style={styles.sectionTitle}>Declaración bajo protesta</Text>
      <Text>{v(ext.declaracion_protesta_nombre)}</Text>

      <Text style={styles.footer} fixed>
        Anexo Sodexo · PROPIEDAD DE SALUD OCUPACIONAL SODEXO MÉXICO SA DE CV
      </Text>
    </Page>
  )
}
