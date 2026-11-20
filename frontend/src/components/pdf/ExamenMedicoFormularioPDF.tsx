/**
 * Formulario de examen médico ya contestado.
 * Misma hoja que EXAMEN MEDICO.pdf: barras, renglón etiqueta/valor
 * y el orden de las cuatro páginas. No es el resumen ni el dictamen.
 */
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { ExamenMedicoPDFData } from '@/components/pdf/ExamenMedicoValidatedPDF'
import { modulo1FromPhysicalExam } from '@/lib/clinical/modulo1-text'
import { SME_LEGAL_NAME, SME_PDF_FOOTER } from '@/lib/brand-constants'

const CYAN = '#2ec4d6'

const s = StyleSheet.create({
  page: {
    paddingTop: 22,
    paddingBottom: 36,
    paddingHorizontal: 28,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#0f172a',
  },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { fontSize: 9, fontWeight: 'bold', color: '#0f766e' },
  brandSub: { fontSize: 7, color: '#475569' },
  logo: { width: 88, height: 32, objectFit: 'contain' },
  title: { fontSize: 13, fontWeight: 'bold', textAlign: 'center', marginTop: 4, marginBottom: 2 },
  empresa: { fontSize: 8, textAlign: 'center', marginBottom: 4 },
  bar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: CYAN,
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 7,
    marginBottom: 3,
  },
  barText: { fontSize: 8, fontWeight: 'bold', textAlign: 'center', flex: 1 },
  barSide: { fontSize: 7, fontWeight: 'bold', width: 110, textAlign: 'right' },
  row: { flexDirection: 'row', marginBottom: 1 },
  cell: {
    flexDirection: 'row',
    borderBottomWidth: 0.4,
    borderBottomColor: '#94a3b8',
    paddingVertical: 1,
    paddingRight: 6,
    minHeight: 12,
  },
  cellGrow: { flex: 1 },
  lab: { fontSize: 7, fontWeight: 'bold', marginRight: 3 },
  val: { fontSize: 7, flex: 1 },
  note: { fontSize: 7, marginTop: 3, marginBottom: 2, lineHeight: 1.3 },
  footer: {
    position: 'absolute',
    bottom: 14,
    left: 28,
    right: 28,
    textAlign: 'center',
    fontSize: 6.5,
    color: '#64748b',
    borderTopWidth: 0.4,
    borderTopColor: '#cbd5e1',
    paddingTop: 4,
  },
  aptitudBox: { borderWidth: 0.8, borderColor: '#0f172a', marginTop: 6, alignSelf: 'center', width: 430 },
  aptitudLine: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#0f172a',
    minHeight: 16,
  },
  aptitudName: { flex: 1, fontSize: 7, fontWeight: 'bold', padding: 3 },
  aptitudMark: {
    width: 28,
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingTop: 2,
    borderLeftWidth: 0.5,
    borderLeftColor: '#0f172a',
  },
  signRow: { flexDirection: 'row', marginTop: 14, justifyContent: 'space-between' },
  sign: { width: '46%', alignItems: 'center' },
  signImage: { width: 120, height: 40, objectFit: 'contain', marginBottom: 2 },
})

const APTITUD = [
  'APTO',
  'APTO CONDICIONADO',
  'APTO CON RESTRICCIONES',
  'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO',
] as const

const APP_COLS: Array<Array<[string, string]>> = [
  [
    ['DIABETES', 'diabetes'],
    ['HAS', 'has'],
    ['CÁNCER', 'cancer'],
    ['CARDIOPATÍAS', 'cardiopatias'],
    ['BRONQUITIS', 'bronquitis'],
    ['NEUMONÍAS', 'neumonias'],
    ['TUBERCULOSIS', 'tuberculosis'],
    ['EXANTEMÁTICAS', 'exantematicas'],
    ['PSIQUIÁTRICAS', 'psiquiatricas'],
    ['TIFOIDEA', 'tifoidea'],
    ['COLITIS', 'colitis'],
    ['GASTRITIS', 'gastritis'],
  ],
  [
    ['ASMA', 'asma'],
    ['ALERGIAS', 'alergias'],
    ['PAROTIDITIS', 'parotiditis'],
    ['DERMATITIS', 'dermatitis'],
    ['VARICES', 'varices'],
    ['HEPATITIS', 'hepatitis'],
    ['RENALES', 'renales'],
    ['EPILEPSIA', 'epilepsia'],
    ['VÉRTIGO', 'vertigo'],
    ['DESMAYOS', 'desmayos'],
  ],
  [
    ['FRACTURAS', 'fracturas'],
    ['CIRUGÍAS', 'cirugias'],
    ['TRANSFUSIONES', 'transfusiones'],
    ['HERNIAS', 'hernias'],
    ['HEMORROIDES', 'hemorroides'],
    ['TRAUMATISMOS', 'traumatismos_craneales'],
    ['PAT. C. VERTEBRAL', 'pat_c_vertebral'],
    ['GINECOLÓGICOS', 'ginecologicos'],
    ['ENF. TRANS. SEXUAL', 'enf_trans_sexual'],
    ['ENDOCRINOPATÍAS', 'endocrinopatias'],
    ['MIGRAÑA', 'migrana'],
  ],
]

function show(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—'
  if (typeof value === 'object') return patologiaEstado(value)
  const text = String(value).trim()
  return text.length === 0 ? '—' : text
}

function patologiaEstado(raw: unknown): string {
  if (!raw || typeof raw !== 'object') return show(raw)
  const row = raw as {
    estado?: unknown
    detalle?: { especificacion?: unknown; observaciones?: unknown }
  }
  const estado = show(row.estado)
  const extra = [row.detalle?.especificacion, row.detalle?.observaciones]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join('. ')
  if (estado !== '—' && extra && estado.toUpperCase() === 'SI') return extra
  if (estado !== '—') return estado
  return extra || '—'
}

function rec(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

function Bar({ title, side }: { title: string; side?: string }) {
  return (
    <View style={s.bar}>
      <Text style={s.barText}>{title}</Text>
      {side ? <Text style={s.barSide}>{side}</Text> : null}
    </View>
  )
}

function Cell({
  label,
  value,
  grow = true,
}: {
  label: string
  value: unknown
  grow?: boolean
}) {
  return (
    <View style={grow ? [s.cell, s.cellGrow] : s.cell}>
      <Text style={s.lab}>{label}:</Text>
      <Text style={s.val}>{show(value)}</Text>
    </View>
  )
}

function Row({ cells }: { cells: Array<{ label: string; value: unknown }> }) {
  return (
    <View style={s.row}>
      {cells.map((cell) => (
        <Cell key={cell.label} label={cell.label} value={cell.value} />
      ))}
    </View>
  )
}

function Footer() {
  return (
    <Text style={s.footer} fixed>
      {SME_PDF_FOOTER}
    </Text>
  )
}

function Header({ data }: { data: ExamenMedicoPDFData }) {
  return (
    <View style={s.top}>
      <View>
        <Text style={s.brand}>{SME_LEGAL_NAME}</Text>
        <Text style={s.brandSub}>Medicina laboral</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        {data.logoUrl ? <Image style={s.logo} src={data.logoUrl} /> : null}
        <Text style={{ fontSize: 8, fontWeight: 'bold', marginTop: 2 }}>
          {show(data.paciente.tipoExamen)}
        </Text>
      </View>
    </View>
  )
}

export function ExamenMedicoFormularioPDF({ data }: { data: ExamenMedicoPDFData }) {
  const p = data.paciente
  const id = data.patientIdentification
  const e = data.exploracion
  const m = data.pruebasMusculo
  const np = rec(data.noPatologicos)
  const app = rec(data.patologicos)
  const m1 = modulo1FromPhysicalExam(rec(data.modulo1))
  const aptitud = (data.aptitud || '').trim().toUpperCase()
  const otrasApp = patologiaEstado(app.otras)
  const otrasLista = Array.isArray(app.otras_enfermedades)
    ? app.otras_enfermedades.map((item) => show(item)).filter((item) => item !== '—').join(', ')
    : ''

  return (
    <Document title="Examen medico contestado" author={data.medico.fullName}>
      <Page size="LETTER" style={s.page}>
        <Header data={data} />
        <Text style={s.title}>EXAMEN MEDICO</Text>
        <Text style={s.empresa}>EMPRESA: {show(p.empresa || id.companyName)}</Text>

        <Bar title="DATOS PERSONALES" side={`FECHA: ${show(id.attentionDate)}`} />
        <Row cells={[{ label: 'NOMBRE', value: p.nombreCompleto || id.fullName }, { label: 'EDAD', value: p.edad || id.ageLabel }]} />
        <Row cells={[{ label: 'SEXO', value: p.sexo || id.sexLabel }, { label: 'FECHA DE NACIMIENTO', value: p.fechaNacimiento || id.birthDateLabel }]} />
        <Row cells={[{ label: 'ESTADO CIVIL', value: p.estadoCivil }, { label: 'ESCOLARIDAD', value: p.escolaridad }]} />
        <Row cells={[{ label: 'DIRECCIÓN', value: p.direccion }, { label: 'GRUPO Y RH', value: p.tipoSanguineo || np.grupo_y_rh }]} />

        <Bar title="HISTORIA LABORAL" />
        <Row cells={[{ label: 'PUESTO', value: p.puesto }, { label: 'ÁREA', value: p.area || id.workAreaLabel }]} />
        <Row cells={[{ label: 'ANTIGÜEDAD EN EL ÁREA', value: id.tenureInAreaLabel }]} />
        <Row cells={[{ label: 'ÚLTIMOS EMPLEOS Y RIESGOS', value: p.historiaOcupacional }]} />
        <Row cells={[{ label: 'ACCIDENTES / ENFERMEDADES DE TRABAJO', value: p.riesgosTrabajo }]} />
        <Row cells={[{ label: 'EPP', value: p.epp }]} />

        <Bar title="ANTECEDENTES HEREDO-FAMILIARES" />
        <Row cells={[{ label: 'DIABETES', value: data.ahf.diabetes }, { label: 'HAS', value: data.ahf.hipertension }, { label: 'EPILEPSIA', value: data.ahf.epilepsia }]} />
        <Row cells={[{ label: 'CARDIOPATÍA', value: data.ahf.cardiopatia }, { label: 'RENALES', value: data.ahf.renales }, { label: 'ASMA', value: data.ahf.asma }]} />
        <Row cells={[{ label: 'CÁNCER', value: data.ahf.cancer }, { label: 'MENTALES', value: data.ahf.mentales }, { label: 'OTRAS', value: data.ahf.otras }]} />

        <Bar title="ANTECEDENTES PERSONALES NO PATOLÓGICOS Y TOXICOMANÍAS" />
        <Row cells={[{ label: 'ALCOHOL', value: np.alcohol ?? data.apnp.alcohol }, { label: 'EDAD DE COMIENZO', value: np.alcohol_edad_comienzo }, { label: 'FRECUENCIA', value: np.alcohol_frecuencia }]} />
        <Row cells={[{ label: '¿SUSPENDIDO?', value: np.alcohol_suspendido }, { label: 'TIEMPO SUSPENDIDO', value: np.alcohol_tiempo_suspendido }]} />
        <Row cells={[{ label: 'TABACO', value: np.tabaco ?? data.apnp.tabaco }, { label: 'EDAD DE COMIENZO', value: np.tabaco_edad_comienzo }, { label: 'CIGARROS/DÍA', value: np.tabaco_cigarros_dia }]} />
        <Row cells={[{ label: '¿SUSPENDIDO?', value: np.tabaco_suspendido }, { label: 'TIEMPO SUSPENDIDO', value: np.tabaco_tiempo_suspendido }, { label: 'FRECUENCIA', value: np.tabaco_frecuencia }]} />
        <Row cells={[{ label: 'DROGAS/ESTIMULANTES', value: np.drogas_estimulantes ?? data.apnp.drogas }, { label: 'ESPECIFIQUE', value: np.drogas_especifique }, { label: 'ÚLTIMO CONSUMO', value: np.drogas_ultimo_consumo }]} />
        <Row cells={[{ label: 'EJERCICIO', value: np.ejercicio ?? data.apnp.ejercicio }, { label: 'ESPECIFIQUE', value: np.ejercicio_especifique }, { label: 'FRECUENCIA', value: np.ejercicio_frecuencia }]} />
        <Row cells={[{ label: 'ALIMENTACIÓN', value: np.alimentacion ?? data.apnp.alimentacion }, { label: 'TATUAJES', value: data.apnp.tatuajes }]} />
        <Row cells={[{ label: 'TX. MÉDICO ACTUAL', value: data.apnp.tratamientoMedicoActual }]} />
        <Footer />
      </Page>

      <Page size="LETTER" style={s.page}>
        <Header data={data} />
        <Bar title="ANTECEDENTES PERSONALES PATOLÓGICOS" />
        <View style={{ flexDirection: 'row' }}>
          {APP_COLS.map((col, index) => (
            <View key={index} style={{ flex: 1, paddingRight: 4 }}>
              {col.map(([label, key]) => (
                <Cell key={key} label={label} value={patologiaEstado(app[key])} grow={false} />
              ))}
            </View>
          ))}
        </View>
        <Row cells={[{ label: 'OTRAS', value: otrasApp }, { label: 'ESPECIFIQUE', value: otrasLista || null }]} />

        <Bar title="ANTECEDENTES GINECOLÓGICOS" />
        <Row cells={[{ label: 'MENARCA', value: m1.m1_gine_menarca }, { label: 'FUM', value: m1.m1_gine_fum }, { label: 'I.V.S.', value: m1.m1_gine_ivs }]} />
        <Row cells={[{ label: 'RITMO', value: m1.m1_gine_ritmo }, { label: 'GESTA', value: m1.m1_gine_gesta }, { label: 'ABORTO', value: m1.m1_gine_aborto }]} />
        <Row cells={[{ label: 'PARTO', value: m1.m1_gine_parto }, { label: 'CESÁREA', value: m1.m1_gine_cesarea }, { label: 'D.O.C.', value: m1.m1_gine_doc }]} />
        <Row cells={[{ label: 'M.P.F.', value: m1.m1_gine_mpf || m1.m1_repro_mpf }, { label: 'F.UP./F.U.C.', value: m1.m1_gine_fup_uc }, { label: 'EXP. MAMARIA', value: m1.m1_gine_exp_mamaria }]} />
        {data.historiaGineco ? <Text style={s.note}>{data.historiaGineco}</Text> : null}

        <Bar title="INMUNIZACIONES" />
        <Row cells={[{ label: 'RUBÉOLA', value: m1.m1_vac_rubeola }, { label: 'SARAMPIÓN', value: m1.m1_vac_sarampion }, { label: 'TOXOIDE TETÁNICO', value: m1.m1_vac_toxoide }]} />
        <Row cells={[{ label: 'NEUMOCOCO', value: m1.m1_vac_neumococo }, { label: 'INFLUENZA', value: m1.m1_vac_influenza }, { label: 'HEPATITIS B', value: m1.m1_vac_hepatitisb }]} />
        <Row cells={[{ label: 'OTRA', value: m1.m1_vac_covid19 || m1.m1_vac_otras }]} />
        {!m1.m1_vac_rubeola && data.inmunizaciones ? <Text style={s.note}>{data.inmunizaciones}</Text> : null}

        <Bar title="SOMATOMETRÍA / SIGNOS VITALES" />
        <Row cells={[{ label: 'TA/mmHg', value: data.somatometria.ta }, { label: 'F.C. /min', value: data.somatometria.fc }, { label: 'F.R. /min', value: data.somatometria.fr }, { label: 'T', value: data.somatometria.temperatura }]} />
        <Row cells={[{ label: 'PESO / Kg', value: data.somatometria.peso }, { label: 'TALLA / m', value: data.somatometria.talla }, { label: 'IMC', value: data.somatometria.imc }, { label: 'SAT. O2 %', value: data.somatometria.saturacionOxigeno }]} />

        <Bar title="AGUDEZA VISUAL" />
        <Row cells={[{ label: 'LEJANA O.D.', value: data.agudezaVisual.visionLejanaOD }, { label: 'LEJANA O.I.', value: data.agudezaVisual.visionLejanaOI }, { label: 'REFLEJOS', value: data.agudezaVisual.reflejos }]} />
        <Row cells={[{ label: 'CERCANA O.D.', value: data.agudezaVisual.visionCercanaOD }, { label: 'CERCANA O.I.', value: data.agudezaVisual.visionCercanaOI }, { label: 'ISHIHARA', value: data.agudezaVisual.ishihara }]} />
        <Row cells={[{ label: 'LEJANA CORREGIDA O.D.', value: data.agudezaVisual.lejanaCorregidaOD }, { label: 'LEJANA CORREGIDA O.I.', value: data.agudezaVisual.lejanaCorregidaOI }, { label: 'CAMPIMETRÍA', value: data.agudezaVisual.campimetria }]} />
        <Row cells={[{ label: 'CERCANA CORREGIDA O.D.', value: data.agudezaVisual.cercanaCorregidaOD }, { label: 'CERCANA CORREGIDA O.I.', value: data.agudezaVisual.cercanaCorregidaOI }]} />
        <Footer />
      </Page>

      <Page size="LETTER" style={s.page}>
        <Header data={data} />
        <Bar title="EXPLORACIÓN FÍSICA GENERAL" />
        <Row cells={[{ label: 'NEUROLÓGICO', value: e.neurologico }]} />
        <Row cells={[{ label: 'CABEZA', value: e.cabeza }]} />
        <Row cells={[{ label: 'PIEL Y FANERAS', value: e.piel_y_faneras }]} />
        <Row cells={[{ label: 'OÍDOS C.A.D.', value: e.oidos_cad }, { label: 'C.A.I.', value: e.oidos_cai }]} />
        <Row cells={[{ label: 'OJOS', value: e.ojos }]} />
        <Row cells={[{ label: 'BOCA', value: e.boca_estado }, { label: 'ALINEACIÓN', value: e.boca_alineacion }]} />
        <Row cells={[{ label: 'NARIZ', value: e.nariz }]} />
        <Row cells={[{ label: 'FARINGE', value: e.faringe }]} />
        <Row cells={[{ label: 'CUELLO', value: e.cuello }]} />
        <Row cells={[{ label: 'TÓRAX', value: e.torax }]} />
        <Row cells={[{ label: 'CORAZÓN', value: e.corazon }]} />
        <Row cells={[{ label: 'CAMPOS PULMONARES', value: e.campos_pulmonares }]} />
        <Row cells={[{ label: 'ABDOMEN', value: e.abdomen }]} />
        <Row cells={[{ label: 'GENITOURINARIO', value: e.genitourinario }]} />
        <Row cells={[{ label: 'COLUMNA', value: e.columna_vertebral }]} />
        <Row cells={[{ label: 'TEST DE ADAM', value: m.testAdam }]} />
        <Row cells={[{ label: 'MMSS', value: e.ms_superiores }, { label: 'DANIELS SUP.', value: e.fuerza_muscular_daniels_sup }]} />
        <Row cells={[{ label: 'MMII', value: e.ms_inferiores }, { label: 'DANIELS INF.', value: e.fuerza_muscular_daniels_inf }]} />
        <Row cells={[{ label: 'CIRCULACIÓN VENOSA', value: e.circulacion_venosa }]} />
        <Row cells={[{ label: 'ARCO DE MOVILIDAD', value: m.arcoMovilidad }, { label: 'FINKELSTEIN', value: m.finkelstein }]} />
        <Row cells={[{ label: 'TONO MUSCULAR', value: m.tonoMuscular }, { label: 'TINEL', value: m.tinel }]} />
        <Row cells={[{ label: 'COORDINACIÓN', value: m.coordinacion }, { label: 'PHALEN', value: m.phanel }]} />
        <Row cells={[{ label: 'ROMBERG', value: m.testRomberg }, { label: 'LASEGUE', value: m.lasegue }]} />
        <Row cells={[{ label: 'BRAGARD', value: m.bragard }, { label: 'QUISTE SINOVIAL', value: m.quisteSinovial }]} />

        <Bar title="IMPRESIÓN DIAGNÓSTICA" />
        <Row cells={[{ label: 'ESTADO NUTRICIONAL', value: data.summary.estado_nutricional }, { label: 'AGUDEZA VISUAL', value: data.summary.agudeza_visual }]} />
        <Row cells={[{ label: 'SALUD BUCAL', value: data.summary.salud_bucal }, { label: 'PRESIÓN ARTERIAL', value: data.summary.presion_arterial }]} />
        <Row cells={[{ label: 'IMPRESIÓN', value: data.impresionDiagnostica }]} />
        <Footer />
      </Page>

      <Page size="LETTER" style={s.page}>
        <Header data={data} />
        <Bar title="APTITUD SEGÚN HALLAZGOS CLÍNICOS" />
        <Text style={s.note}>
          La aptitud puede cambiar según los estudios de gabinete que se realicen aparte del examen médico.
        </Text>
        <View style={s.aptitudBox}>
          {APTITUD.map((option) => (
            <View key={option} style={s.aptitudLine}>
              <Text style={s.aptitudName}>{option}</Text>
              <Text style={s.aptitudMark}>{aptitud === option ? 'X' : ''}</Text>
            </View>
          ))}
        </View>
        <Row cells={[{ label: 'RESTRICCIONES', value: data.restricciones }]} />
        <Row cells={[{ label: 'OBSERVACIONES', value: data.observacionesFinales }]} />

        <Bar title="RECOMENDACIONES" />
        <Text style={s.note}>{data.recomendaciones.filter(Boolean).join(' ') || '—'}</Text>

        <View style={s.signRow}>
          <View style={s.sign}>
            {data.medico.signatureImageUrl ? (
              <Image style={s.signImage} src={data.medico.signatureImageUrl} />
            ) : null}
            <Text style={{ fontSize: 8, fontWeight: 'bold', textAlign: 'center' }}>
              Realizó EM: {show(data.medico.fullName)}
            </Text>
            <Text style={{ fontSize: 8, textAlign: 'center' }}>
              Ced. Prof.: {show(data.medico.professionalLicense)}
            </Text>
          </View>
        </View>
        <Footer />
      </Page>
    </Document>
  )
}
