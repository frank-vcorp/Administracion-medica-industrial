/**
 * Formulario de examen médico ya contestado.
 * Preguntas y respuestas de la captura. No es el resumen de una hoja
 * ni el dictamen final.
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ExamenMedicoPDFData } from '@/components/pdf/ExamenMedicoValidatedPDF'
import { SME_LEGAL_NAME, SME_PDF_FOOTER } from '@/lib/brand-constants'

const s = StyleSheet.create({
  page: {
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 28,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#0f172a',
  },
  title: { fontSize: 12, fontWeight: 'bold', textAlign: 'center', marginBottom: 6 },
  head: { fontSize: 9, fontWeight: 'bold', marginTop: 6, marginBottom: 3, color: '#0f766e' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', marginBottom: 2, paddingRight: 6 },
  q: { fontSize: 7, fontWeight: 'bold', color: '#475569' },
  a: { fontSize: 8 },
  wide: { width: '100%', marginBottom: 3 },
  signRow: { flexDirection: 'row', marginTop: 12, justifyContent: 'space-between' },
  sign: { width: '46%', alignItems: 'center' },
  signImage: { width: 120, height: 40, objectFit: 'contain' },
})

function val(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const text = String(value).trim()
  return text.length === 0 ? '—' : text
}

function Qa({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string | number | null | undefined
  wide?: boolean
}) {
  return (
    <View style={wide ? s.wide : s.cell}>
      <Text style={s.q}>{label}</Text>
      <Text style={s.a}>{val(value)}</Text>
    </View>
  )
}

function Header({ data }: { data: ExamenMedicoPDFData }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
      <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#0f766e' }}>{SME_LEGAL_NAME}</Text>
      {data.logoUrl ? <Image style={{ width: 70, height: 26, objectFit: 'contain' }} src={data.logoUrl} /> : null}
    </View>
  )
}

export function ExamenMedicoFormularioPDF({ data }: { data: ExamenMedicoPDFData }) {
  const p = data.paciente
  const id = data.patientIdentification
  const e = data.exploracion
  const m = data.pruebasMusculo
  return (
    <Document title="Examen medico contestado" author={data.medico.fullName}>
      <Page size="LETTER" style={s.page}>
        <Header data={data} />
        <Text style={s.title}>EXAMEN MEDICO</Text>
        <Text style={{ fontSize: 8, textAlign: 'center', marginBottom: 6 }}>
          {val(p.empresa || id.companyName)} · {val(p.tipoExamen)} · {val(id.attentionDate)}
        </Text>
        <Text style={s.head}>DATOS PERSONALES</Text>
        <View style={s.grid}>
          <Qa label="Nombre" value={p.nombreCompleto || id.fullName} wide />
          <Qa label="Sexo" value={p.sexo || id.sexLabel} />
          <Qa label="Edad" value={p.edad || id.ageLabel} />
          <Qa label="Fecha de nacimiento" value={p.fechaNacimiento || id.birthDateLabel} />
          <Qa label="Estado civil" value={p.estadoCivil} />
          <Qa label="Escolaridad" value={p.escolaridad} />
          <Qa label="Tipo sanguíneo" value={p.tipoSanguineo} />
          <Qa label="Dirección" value={p.direccion} wide />
          <Qa label="Empresa" value={p.empresa || id.companyName} />
          <Qa label="Puesto" value={p.puesto} />
          <Qa label="Área" value={p.area || id.workAreaLabel} />
          <Qa label="Antigüedad en el área" value={id.tenureInAreaLabel} />
        </View>
        <Text style={s.head}>HISTORIA LABORAL</Text>
        <Qa label="Historia ocupacional" value={p.historiaOcupacional} wide />
        <Qa label="Riesgos de trabajo" value={p.riesgosTrabajo} wide />
        <Qa label="EPP" value={p.epp} wide />
        <Text style={s.head}>ANTECEDENTES HEREDOFAMILIARES</Text>
        <View style={s.grid}>
          <Qa label="Diabetes" value={data.ahf.diabetes} />
          <Qa label="Hipertensión" value={data.ahf.hipertension} />
          <Qa label="Epilepsia" value={data.ahf.epilepsia} />
          <Qa label="Cardiopatía" value={data.ahf.cardiopatia} />
          <Qa label="Renales" value={data.ahf.renales} />
          <Qa label="Asma" value={data.ahf.asma} />
          <Qa label="Cáncer" value={data.ahf.cancer} />
          <Qa label="Mentales" value={data.ahf.mentales} />
          <Qa label="Otras" value={data.ahf.otras} />
        </View>
        <Text style={s.head}>NO PATOLÓGICOS Y TOXICOMANÍAS</Text>
        <View style={s.grid}>
          <Qa label="Alcohol" value={data.apnp.alcohol} />
          <Qa label="Tabaco" value={data.apnp.tabaco} />
          <Qa label="Drogas" value={data.apnp.drogas} />
          <Qa label="Ejercicio" value={data.apnp.ejercicio} />
          <Qa label="Alimentación" value={data.apnp.alimentacion} />
          <Qa label="Tatuajes" value={data.apnp.tatuajes} />
          <Qa label="Tratamiento médico actual" value={data.apnp.tratamientoMedicoActual} wide />
        </View>
        <Text style={{ position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#64748b' }}>
          {SME_PDF_FOOTER}
        </Text>
      </Page>

      <Page size="LETTER" style={s.page}>
        <Header data={data} />
        <Text style={s.head}>ANTECEDENTES PERSONALES PATOLÓGICOS</Text>
        <Qa label="Patológicos" value={data.app} wide />
        <Qa label="Inmunizaciones" value={data.inmunizaciones} wide />
        <Qa label="Historia gineco-obstétrica" value={data.historiaGineco} wide />
        <Text style={s.head}>SOMATOMETRÍA Y SIGNOS VITALES</Text>
        <View style={s.grid}>
          <Qa label="Peso (kg)" value={data.somatometria.peso} />
          <Qa label="Talla (m)" value={data.somatometria.talla} />
          <Qa label="IMC" value={data.somatometria.imc} />
          <Qa label="TA (mmHg)" value={data.somatometria.ta} />
          <Qa label="FC /min" value={data.somatometria.fc} />
          <Qa label="FR /min" value={data.somatometria.fr} />
          <Qa label="Temperatura (°C)" value={data.somatometria.temperatura} />
          <Qa label="Sat. oxígeno (%)" value={data.somatometria.saturacionOxigeno} />
        </View>
        <Text style={s.head}>AGUDEZA VISUAL</Text>
        <View style={s.grid}>
          <Qa label="Visión lejana OD" value={data.agudezaVisual.visionLejanaOD} />
          <Qa label="Visión lejana OI" value={data.agudezaVisual.visionLejanaOI} />
          <Qa label="Visión cercana OD" value={data.agudezaVisual.visionCercanaOD} />
          <Qa label="Visión cercana OI" value={data.agudezaVisual.visionCercanaOI} />
          <Qa label="Lejana corregida OD" value={data.agudezaVisual.lejanaCorregidaOD} />
          <Qa label="Lejana corregida OI" value={data.agudezaVisual.lejanaCorregidaOI} />
          <Qa label="Cercana corregida OD" value={data.agudezaVisual.cercanaCorregidaOD} />
          <Qa label="Cercana corregida OI" value={data.agudezaVisual.cercanaCorregidaOI} />
          <Qa label="Reflejos" value={data.agudezaVisual.reflejos} />
          <Qa label="Ishihara" value={data.agudezaVisual.ishihara} />
          <Qa label="Campimetría" value={data.agudezaVisual.campimetria} />
        </View>
        <Text style={{ position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#64748b' }}>
          {SME_PDF_FOOTER}
        </Text>
      </Page>

      <Page size="LETTER" style={s.page}>
        <Header data={data} />
        <Text style={s.head}>EXPLORACIÓN FÍSICA</Text>
        <View style={s.grid}>
          <Qa label="Neurológico" value={e.neurologico} wide />
          <Qa label="Cabeza" value={e.cabeza} />
          <Qa label="Piel y faneras" value={e.piel_y_faneras} />
          <Qa label="Oídos CAD" value={e.oidos_cad} />
          <Qa label="Oídos CAI" value={e.oidos_cai} />
          <Qa label="Ojos" value={e.ojos} />
          <Qa label="Boca" value={e.boca_estado} />
          <Qa label="Alineación dental" value={e.boca_alineacion} />
          <Qa label="Nariz" value={e.nariz} />
          <Qa label="Faringe" value={e.faringe} />
          <Qa label="Cuello" value={e.cuello} />
          <Qa label="Tórax" value={e.torax} />
          <Qa label="Corazón" value={e.corazon} />
          <Qa label="Campos pulmonares" value={e.campos_pulmonares} />
          <Qa label="Abdomen" value={e.abdomen} />
          <Qa label="Genitourinario" value={e.genitourinario} />
          <Qa label="Columna" value={e.columna_vertebral} />
          <Qa label="Circulación venosa" value={e.circulacion_venosa} />
          <Qa label="MMSS" value={e.ms_superiores} />
          <Qa label="Fuerza Daniels sup." value={e.fuerza_muscular_daniels_sup} />
          <Qa label="MMII" value={e.ms_inferiores} />
          <Qa label="Fuerza Daniels inf." value={e.fuerza_muscular_daniels_inf} />
        </View>
        <Text style={s.head}>PRUEBAS</Text>
        <View style={s.grid}>
          <Qa label="Arco de movilidad" value={m.arcoMovilidad} />
          <Qa label="Tono muscular" value={m.tonoMuscular} />
          <Qa label="Coordinación" value={m.coordinacion} />
          <Qa label="Test de Adam" value={m.testAdam} />
          <Qa label="Romberg" value={m.testRomberg} />
          <Qa label="Bragard" value={m.bragard} />
          <Qa label="Finkelstein" value={m.finkelstein} />
          <Qa label="Tinel" value={m.tinel} />
          <Qa label="Phalen" value={m.phanel} />
          <Qa label="Lasegue" value={m.lasegue} />
          <Qa label="Quiste sinovial" value={m.quisteSinovial} />
        </View>
        <Text style={s.head}>IMPRESIÓN DIAGNÓSTICA</Text>
        <View style={s.grid}>
          <Qa label="Estado nutricional" value={data.summary.estado_nutricional} />
          <Qa label="Agudeza visual" value={data.summary.agudeza_visual} />
          <Qa label="Salud bucal" value={data.summary.salud_bucal} />
          <Qa label="Presión arterial" value={data.summary.presion_arterial} />
          <Qa label="Impresión" value={data.impresionDiagnostica} wide />
        </View>
        <Text style={{ position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#64748b' }}>
          {SME_PDF_FOOTER}
        </Text>
      </Page>

      <Page size="LETTER" style={s.page}>
        <Header data={data} />
        <Text style={s.head}>APTITUD SEGÚN HALLAZGOS CLÍNICOS</Text>
        <Qa label="Aptitud" value={data.aptitud} wide />
        <Qa label="Restricciones" value={data.restricciones} wide />
        <Qa label="Observaciones" value={data.observacionesFinales} wide />
        <Qa
          label="Recomendaciones"
          value={data.recomendaciones.filter(Boolean).join(' ')}
          wide
        />
        <View style={s.signRow}>
          <View style={s.sign}>
            {data.medico.signatureImageUrl ? (
              <Image style={s.signImage} src={data.medico.signatureImageUrl} />
            ) : null}
            <Text style={{ fontSize: 8, fontWeight: 'bold', textAlign: 'center' }}>
              Realizó EM: {val(data.medico.fullName)}
            </Text>
            <Text style={{ fontSize: 8, textAlign: 'center' }}>
              Ced. Prof.: {val(data.medico.professionalLicense)}
            </Text>
          </View>
        </View>
        <Text style={{ position: 'absolute', bottom: 16, left: 28, right: 28, fontSize: 7, color: '#64748b' }}>
          {SME_PDF_FOOTER}
        </Text>
      </Page>
    </Document>
  )
}
