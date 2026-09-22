import { Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  formatPdfGender,
  type PatientIdentificationPdf,
} from '@/lib/pdf/patient-identification'

const styles = StyleSheet.create({
  wrap: { marginBottom: 10 },
  heading: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#0f766e',
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  box: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  row: { flexDirection: 'row', marginBottom: 3 },
  label: { width: 118, fontSize: 8.5, fontWeight: 'bold', color: '#475569' },
  value: { flex: 1, fontSize: 8.5, color: '#0f172a' },
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginTop: 2,
    gap: 2,
  },
  vitalPart: { fontSize: 7.5, color: '#0f172a' },
  vitalLabel: { fontWeight: 'bold', color: '#475569' },
  vitalSep: { fontSize: 7.5, color: '#94a3b8', marginHorizontal: 2 },
})

function display(value: string | null | undefined): string {
  const t = value?.trim()
  return t && t !== '—' ? t : '—'
}

type Props = {
  patient: PatientIdentificationPdf
  /** Título sobre el recuadro; omitir si el padre ya numeró la sección. */
  heading?: string | null
}

function VitalPart({ label, value }: { label: string; value: string }) {
  return (
    <Text style={styles.vitalPart}>
      <Text style={styles.vitalLabel}>{label}</Text>
      {value}
    </Text>
  )
}

/**
 * Bloque estándar de identificación del paciente (mismos campos en todos los PDF).
 */
export function PatientIdentificationPdfBlock({ patient, heading }: Props) {
  return (
    <View style={styles.wrap}>
      {heading ? <Text style={styles.heading}>{heading}</Text> : null}
      <View style={styles.box}>
        <View style={styles.row}>
          <Text style={styles.label}>Paciente:</Text>
          <Text style={styles.value}>{display(patient.fullName)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>ID expediente:</Text>
          <Text style={styles.value}>{display(patient.universalId)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Empresa:</Text>
          <Text style={styles.value}>{display(patient.companyName)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Sexo:</Text>
          <Text style={styles.value}>
            {patient.sexLabel ? formatPdfGender(patient.sexLabel) : '—'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Edad:</Text>
          <Text style={styles.value}>{display(patient.ageLabel)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Fecha de atención:</Text>
          <Text style={styles.value}>{display(patient.attentionDate)}</Text>
        </View>
        <View style={styles.vitalsRow}>
          <VitalPart label="Peso: " value={display(patient.weightLabel)} />
          <Text style={styles.vitalSep}>·</Text>
          <VitalPart label="Talla: " value={display(patient.heightLabel)} />
          <Text style={styles.vitalSep}>·</Text>
          <VitalPart label="T°: " value={display(patient.temperatureLabel)} />
          <Text style={styles.vitalSep}>·</Text>
          <VitalPart label="FC: " value={display(patient.heartRateLabel)} />
          <Text style={styles.vitalSep}>·</Text>
          <VitalPart label="TA: " value={display(patient.bloodPressureLabel)} />
        </View>
      </View>
    </View>
  )
}
