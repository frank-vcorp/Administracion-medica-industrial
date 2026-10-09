import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { CertificadoMedicoPayload } from '@/schemas/clinical/certificado-medico.schema'
import {
  buildAntecedentesNarratives,
  buildVitalesLine,
} from '@/lib/clinical/certificado-medico-narrative'

const styles = StyleSheet.create({
  page: { padding: 44, fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a', lineHeight: 1.45 },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 8,
    marginBottom: 14,
  },
  brand: { fontSize: 11, fontWeight: 'bold', textAlign: 'center' },
  sub: { fontSize: 9, color: '#64748b', textAlign: 'center', marginTop: 2 },
  title: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginVertical: 12, letterSpacing: 0.5 },
  paragraph: { fontSize: 10, textAlign: 'justify', marginBottom: 10 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', marginTop: 6, marginBottom: 4 },
  footer: { marginTop: 28, fontSize: 10, textAlign: 'center' },
  footerBrand: { marginTop: 16, fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
})

export interface CertificadoMedicoPdfPatient {
  nombre: string
  edad: string | null
  sexo: string | null
  domicilio: string | null
  identificacionTipo: string
  identificacionFolio: string | null
  horaAtencion: string | null
}

export interface CertificadoMedicoPdfInput {
  lugarFecha: string
  patient: CertificadoMedicoPdfPatient
  certificado: CertificadoMedicoPayload
}

function v(s: string | null | undefined, fallback = '—'): string {
  return s?.trim() ? s.trim() : fallback
}

export function CertificadoMedicoPDF({ data }: { data: CertificadoMedicoPdfInput }) {
  const { patient: p, certificado: c, lugarFecha } = data
  const narr = buildAntecedentesNarratives(c.antecedentes)
  const vitales = buildVitalesLine(c.signos_vitales)
  const titulo = c.medico_titulo?.trim() || 'Médico General'
  const uni = c.medico_universidad?.trim()
  const credenciales = uni
    ? `${titulo} por la ${uni} con cédula profesional ${v(c.medico_cedula)}`
    : `${titulo} con cédula profesional ${v(c.medico_cedula)}`

  const hora = p.horaAtencion ? ` a la hora ${p.horaAtencion}` : ''

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={{ fontSize: 10, marginBottom: 8 }}>{lugarFecha}</Text>
        <Text style={styles.title}>CERTIFICADO MÉDICO LABORAL</Text>

        <Text style={styles.paragraph}>
          El que suscribe {c.medico_nombre} que se acredita como {credenciales} por medio de la
          presente hago constar que el paciente {p.nombre} de {v(p.edad, '—')} años de edad, del
          sexo {v(p.sexo, '—')} con domicilio en {v(p.domicilio, '—')}, presentando como
          identificación {p.identificacionTipo}
          {p.identificacionFolio ? ` ${p.identificacionFolio}` : ''}, acude a nuestras
          instalaciones y es atendido{hora} de la presente fecha, encontrando lo siguiente:
        </Text>

        <Text style={styles.sectionTitle}>I. Antecedentes heredo familiares:</Text>
        <Text style={styles.paragraph}>{narr.heredoFamiliares}</Text>

        <Text style={styles.sectionTitle}>II. Antecedentes personales patológicos:</Text>
        <Text style={styles.paragraph}>{narr.patologicos}</Text>

        <Text style={styles.sectionTitle}>III. Antecedentes personales no patológicos:</Text>
        <Text style={styles.paragraph}>{narr.noPatologicos}</Text>

        <Text style={styles.sectionTitle}>IV. Somatometría y signos vitales:</Text>
        <Text style={styles.paragraph}>{vitales}</Text>

        <Text style={styles.sectionTitle}>V. Exploración física:</Text>
        <Text style={styles.paragraph}>{c.exploracion_fisica}</Text>

        <Text style={styles.sectionTitle}>
          VI. Integración diagnóstica y dictamen:
        </Text>
        <Text style={styles.paragraph}>
          Habiendo examinado al paciente, éste se encuentra con diagnóstico de{' '}
          {c.integracion_diagnostica} {c.dictamen_laboral_texto}
        </Text>

        <Text style={styles.paragraph}>
          Se expide el presente certificado médico laboral para los fines que al interesado
          convengan.
        </Text>

        <View style={styles.footer}>
          <Text>{c.medico_nombre}</Text>
          <Text>Ced. Prof. {c.medico_cedula}</Text>
        </View>
        <Text style={styles.footerBrand}>Soluciones Médico Empresariales</Text>
        <Text style={styles.sub}>Medicina Laboral</Text>
      </Page>
    </Document>
  )
}
