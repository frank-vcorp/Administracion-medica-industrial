import { Text, View, StyleSheet } from '@react-pdf/renderer'
import {
  formatPdfGender,
  type PatientIdentificationPdf,
} from '@/lib/pdf/patient-identification'

const styles = StyleSheet.create({
  wrap: { marginBottom: 6 },
  heading: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f766e',
    marginBottom: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  box: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    backgroundColor: '#f8fafc',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  gridRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  cell: {
    flex: 1,
    paddingRight: 4,
  },
  cellLast: {
    flex: 1,
    paddingRight: 0,
  },
  cellText: { fontSize: 7.5, color: '#0f172a', lineHeight: 1.25 },
  cellLabel: { fontWeight: 'bold', color: '#475569', fontSize: 7 },
  vitalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    marginTop: 1,
    paddingTop: 2,
    borderTopWidth: 0.5,
    borderTopColor: '#e2e8f0',
  },
  vitalPart: { fontSize: 7, color: '#0f172a' },
  vitalLabel: { fontWeight: 'bold', color: '#475569' },
  vitalSep: { fontSize: 7, color: '#94a3b8', marginHorizontal: 2 },
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

function GridCell({
  label,
  value,
  last,
}: {
  label: string
  value: string
  last?: boolean
}) {
  return (
    <View style={last ? styles.cellLast : styles.cell}>
      <Text style={styles.cellText}>
        <Text style={styles.cellLabel}>{label} </Text>
        {value}
      </Text>
    </View>
  )
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
  const sexDisplay = patient.sexLabel ? formatPdfGender(patient.sexLabel) : '—'

  return (
    <View style={styles.wrap}>
      {heading ? <Text style={styles.heading}>{heading}</Text> : null}
      <View style={styles.box}>
        <View style={styles.gridRow}>
          <GridCell label="Paciente:" value={display(patient.fullName)} />
          <GridCell label="ID:" value={display(patient.universalId)} />
          <GridCell label="Empresa:" value={display(patient.companyName)} last />
        </View>
        <View style={styles.gridRow}>
          <GridCell label="Sexo:" value={sexDisplay} />
          <GridCell label="Edad:" value={display(patient.ageLabel)} />
          <GridCell label="Atención:" value={display(patient.attentionDate)} last />
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
