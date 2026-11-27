import { Document, Page, Text, View, StyleSheet, Image, pdf } from '@react-pdf/renderer'
import type { CertificadoMedicoPayload } from '@/schemas/clinical/certificado-medico.schema'
import { buildAntecedentesNarratives } from '@/lib/clinical/certificado-medico-narrative'
import { SME_LEGAL_NAME, SME_PDF_FOOTER } from '@/lib/brand-constants'

const styles = StyleSheet.create({
  page: {
    paddingTop: 24,
    paddingBottom: 28,
    paddingHorizontal: 32,
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#0f172a',
    backgroundColor: '#ffffff',
  },
  // Membrete superior institucional
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: '#0f766e',
    paddingBottom: 6,
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'column',
    maxWidth: '58%',
  },
  logoImage: {
    width: 125,
    height: 38,
    objectFit: 'contain',
    marginBottom: 2,
  },
  logoFallback: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#0f766e',
    letterSpacing: 0.5,
  },
  brandSub: {
    fontSize: 6.8,
    color: '#475569',
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  docTitleBadge: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f766e',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  headerMeta: {
    fontSize: 7.2,
    color: '#334155',
    marginTop: 1.5,
  },
  headerMetaBold: {
    fontSize: 7.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  draftBanner: {
    borderWidth: 1,
    borderColor: '#d97706',
    backgroundColor: '#fffbeb',
    color: '#92400e',
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 6,
    fontSize: 7.5,
    fontWeight: 'bold',
    textAlign: 'center',
    borderRadius: 3,
  },
  // Ficha de paciente / médico
  infoCard: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 4,
    padding: 5,
    marginBottom: 5,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  infoCol: {
    flexDirection: 'row',
  },
  infoLabel: {
    fontSize: 7.2,
    fontWeight: 'bold',
    color: '#475569',
  },
  infoValue: {
    fontSize: 7.2,
    color: '#0f172a',
    marginLeft: 3,
  },
  introNotice: {
    fontSize: 7.2,
    color: '#475569',
    fontStyle: 'italic',
    lineHeight: 1.25,
    marginBottom: 4,
  },
  // Secciones clínicas
  section: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 7.5,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9',
    borderLeftWidth: 3,
    borderLeftColor: '#0f766e',
    paddingVertical: 1.8,
    paddingHorizontal: 5,
    color: '#0f172a',
    marginBottom: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  sectionContent: {
    fontSize: 7.4,
    color: '#1e293b',
    lineHeight: 1.3,
    textAlign: 'justify',
  },
  // Cuadrícula métrica de signos vitales
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginBottom: 2,
  },
  vitalCell: {
    width: '24.2%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 3.5,
  },
  vitalLabel: {
    fontSize: 6.2,
    fontWeight: 'bold',
    color: '#64748b',
    textTransform: 'uppercase',
  },
  vitalValue: {
    fontSize: 7.2,
    fontWeight: 'bold',
    color: '#0f172a',
    marginTop: 0.5,
  },
  vitalsExtraRow: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 3,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  // Recuadro de dictamen
  verdictCard: {
    borderWidth: 1.2,
    borderRadius: 4,
    padding: 5,
    marginTop: 3,
    marginBottom: 3,
  },
  verdictHeader: {
    fontSize: 8,
    fontWeight: 'bold',
    marginBottom: 1.5,
    letterSpacing: 0.4,
  },
  verdictText: {
    fontSize: 7.6,
    lineHeight: 1.25,
    fontWeight: 'bold',
  },
  legalDisclaimer: {
    fontSize: 6.8,
    color: '#64748b',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2.5,
    marginBottom: 4,
  },
  // Área de firma
  signatureContainer: {
    marginTop: 6,
    alignItems: 'center',
  },
  signatureLine: {
    width: 170,
    borderTopWidth: 1,
    borderTopColor: '#0f172a',
    marginBottom: 2,
  },
  signatureName: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  signatureCedula: {
    fontSize: 7.2,
    color: '#475569',
    marginTop: 0.5,
  },
  signatureTitle: {
    fontSize: 6.8,
    color: '#64748b',
    marginTop: 0.5,
  },
  // Pie de página fijo
  footer: {
    position: 'absolute',
    bottom: 12,
    left: 32,
    right: 32,
    borderTopWidth: 0.5,
    borderTopColor: '#cbd5e1',
    paddingTop: 3,
    fontSize: 6.3,
    color: '#94a3b8',
    textAlign: 'center',
  },
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
  isDraft?: boolean
  patient: CertificadoMedicoPdfPatient
  certificado: CertificadoMedicoPayload
  logoUrl?: string | null
  folio?: string | null
}

function v(s: string | null | undefined, fallback = '—'): string {
  return s?.trim() ? s.trim() : fallback
}

export function CertificadoMedicoPDF({ data }: { data: CertificadoMedicoPdfInput }) {
  const { patient: p, certificado: c, lugarFecha, logoUrl, folio } = data
  const narr = buildAntecedentesNarratives(c.antecedentes)
  const sv = c.signos_vitales ?? {}
  const titulo = c.medico_titulo?.trim() || 'Médico General'
  const uni = c.medico_universidad?.trim()
  const credenciales = uni ? `${titulo} (${uni})` : titulo

  const taDisplay =
    sv.ta_sistolica?.trim() && sv.ta_diastolica?.trim()
      ? `${sv.ta_sistolica}/${sv.ta_diastolica}`
      : v(sv.ta_sistolica) !== '—'
        ? v(sv.ta_sistolica)
        : v(sv.ta_diastolica)

  const imcDisplay = sv.imc?.trim()
    ? `${sv.imc} kg/m²${sv.complexion?.trim() ? ` (${sv.complexion})` : ''}`
    : '—'

  // Estilo y color de la tarjeta de dictamen
  const dictamen = c.dictamen_laboral ?? 'APTO'
  const isApto = dictamen === 'APTO'
  const isConObs = dictamen === 'CON_OBSERVACIONES'
  const isNoApto = dictamen === 'NO_APTO'

  const verdictCardStyle = [
    styles.verdictCard,
    isApto
      ? { borderColor: '#059669', backgroundColor: '#ecfdf5', color: '#065f46' }
      : isConObs
        ? { borderColor: '#d97706', backgroundColor: '#fffbeb', color: '#92400e' }
        : isNoApto
          ? { borderColor: '#dc2626', backgroundColor: '#fef2f2', color: '#991b1b' }
          : { borderColor: '#0f766e', backgroundColor: '#f0fdfa', color: '#0f766e' },
  ]

  const dictamenTitulo = isApto
    ? 'DICTAMEN: APTO PARA ACTIVIDADES LABORALES'
    : isConObs
      ? 'DICTAMEN: APTO CON OBSERVACIONES'
      : isNoApto
        ? 'DICTAMEN: NO APTO PARA ACTIVIDADES LABORALES'
        : `DICTAMEN: ${dictamen}`

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* MEMBRETE INSTITUCIONAL */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {logoUrl ? (
              <Image style={styles.logoImage} src={logoUrl} />
            ) : (
              <Text style={styles.logoFallback}>{SME_LEGAL_NAME}</Text>
            )}
            <Text style={styles.brandSub}>Servicios de Salud Ocupacional y Medicina del Trabajo</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.docTitleBadge}>Certificado Médico Laboral</Text>
            {folio && (
              <Text style={styles.headerMeta}>
                Folio: <Text style={styles.headerMetaBold}>{folio}</Text>
              </Text>
            )}
            <Text style={styles.headerMeta}>{lugarFecha}</Text>
            {p.horaAtencion && (
              <Text style={styles.headerMeta}>Hora de atención: {p.horaAtencion}</Text>
            )}
          </View>
        </View>

        {data.isDraft && (
          <Text style={styles.draftBanner}>
            VISTA PREVIA EN BORRADOR — DOCUMENTO SIN CIERRE DEFINITIVO
          </Text>
        )}

        {/* FICHA TÉCNICA PACIENTE Y MÉDICO */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <View style={[styles.infoCol, { flex: 2 }]}>
              <Text style={styles.infoLabel}>PACIENTE:</Text>
              <Text style={[styles.infoValue, { fontWeight: 'bold' }]}>{p.nombre}</Text>
            </View>
            <View style={[styles.infoCol, { flex: 1 }]}>
              <Text style={styles.infoLabel}>EDAD:</Text>
              <Text style={styles.infoValue}>{p.edad ? `${p.edad} años` : '—'}</Text>
            </View>
            <View style={[styles.infoCol, { flex: 1 }]}>
              <Text style={styles.infoLabel}>SEXO:</Text>
              <Text style={styles.infoValue}>{v(p.sexo)}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <View style={[styles.infoCol, { flex: 2 }]}>
              <Text style={styles.infoLabel}>IDENTIFICACIÓN:</Text>
              <Text style={styles.infoValue}>
                {p.identificacionTipo} {p.identificacionFolio ? `(${p.identificacionFolio})` : ''}
              </Text>
            </View>
            <View style={[styles.infoCol, { flex: 2 }]}>
              <Text style={styles.infoLabel}>DOMICILIO:</Text>
              <Text style={styles.infoValue}>{v(p.domicilio)}</Text>
            </View>
          </View>

          <View style={[styles.infoRow, { marginBottom: 0 }]}>
            <View style={[styles.infoCol, { flex: 2 }]}>
              <Text style={styles.infoLabel}>MÉDICO QUE CERTIFICA:</Text>
              <Text style={styles.infoValue}>{c.medico_nombre}</Text>
            </View>
            <View style={[styles.infoCol, { flex: 1 }]}>
              <Text style={styles.infoLabel}>CÉDULA:</Text>
              <Text style={styles.infoValue}>{v(c.medico_cedula)}</Text>
            </View>
            <View style={[styles.infoCol, { flex: 1.5 }]}>
              <Text style={styles.infoLabel}>TÍTULO:</Text>
              <Text style={styles.infoValue}>{credenciales}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.introNotice}>
          Hago constar que habiendo practicado la valoración médica ocupacional al paciente arriba
          citado en nuestras instalaciones, se obtuvieron los siguientes hallazgos clínicos:
        </Text>

        {/* I. ANTECEDENTES HEREDOFAMILIARES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>I. Antecedentes Heredofamiliares</Text>
          <Text style={styles.sectionContent}>{narr.heredoFamiliares}</Text>
        </View>

        {/* II. ANTECEDENTES PERSONALES PATOLÓGICOS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>II. Antecedentes Personales Patológicos</Text>
          <Text style={styles.sectionContent}>{narr.patologicos}</Text>
        </View>

        {/* III. ANTECEDENTES PERSONALES NO PATOLÓGICOS */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>III. Antecedentes Personales No Patológicos</Text>
          <Text style={styles.sectionContent}>{narr.noPatologicos}</Text>
        </View>

        {/* IV. SOMATOMETRÍA Y SIGNOS VITALES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>IV. Somatometría y Signos Vitales</Text>
          <View style={styles.vitalsGrid}>
            <View style={styles.vitalCell}>
              <Text style={styles.vitalLabel}>Peso</Text>
              <Text style={styles.vitalValue}>{v(sv.peso_kg)} kg</Text>
            </View>
            <View style={styles.vitalCell}>
              <Text style={styles.vitalLabel}>Talla</Text>
              <Text style={styles.vitalValue}>{v(sv.talla_m)} m</Text>
            </View>
            <View style={styles.vitalCell}>
              <Text style={styles.vitalLabel}>I.M.C.</Text>
              <Text style={styles.vitalValue}>{imcDisplay}</Text>
            </View>
            <View style={styles.vitalCell}>
              <Text style={styles.vitalLabel}>Presión Arterial</Text>
              <Text style={styles.vitalValue}>{taDisplay} mmHg</Text>
            </View>
            <View style={styles.vitalCell}>
              <Text style={styles.vitalLabel}>Frec. Cardíaca</Text>
              <Text style={styles.vitalValue}>{v(sv.fc_min)} lpm</Text>
            </View>
            <View style={styles.vitalCell}>
              <Text style={styles.vitalLabel}>Frec. Respiratoria</Text>
              <Text style={styles.vitalValue}>{v(sv.fr_min)} rpm</Text>
            </View>
            <View style={styles.vitalCell}>
              <Text style={styles.vitalLabel}>Temperatura</Text>
              <Text style={styles.vitalValue}>{v(sv.temperatura)} °C</Text>
            </View>
            <View style={styles.vitalCell}>
              <Text style={styles.vitalLabel}>Sat. Oxígeno</Text>
              <Text style={styles.vitalValue}>{v(sv.spo2_pct)} %</Text>
            </View>

            <View style={styles.vitalsExtraRow}>
              <Text style={{ fontSize: 6.8, color: '#334155' }}>
                <Text style={{ fontWeight: 'bold' }}>Agudeza Visual:</Text> Lejana: {v(sv.agudeza_vl)}
                {sv.agudeza_vlc && sv.agudeza_vlc !== 'NO APLICA' ? ` | Con lentes: ${sv.agudeza_vlc}` : ''}
                {sv.agudeza_vc && sv.agudeza_vc !== 'NO APLICA' ? ` | Cercana: ${sv.agudeza_vc}` : ''}
                {sv.agudeza_vcc && sv.agudeza_vcc !== 'NO APLICA' ? ` | Cercana c/lentes: ${sv.agudeza_vcc}` : ''}
              </Text>
            </View>
          </View>
        </View>

        {/* V. EXPLORACIÓN FÍSICA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>V. Exploración Física</Text>
          <Text style={styles.sectionContent}>
            {v(c.exploracion_fisica, 'Sin alteraciones evidentes al momento del examen.')}
          </Text>
        </View>

        {/* VI. INTEGRACIÓN DIAGNÓSTICA */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VI. Integración Diagnóstica</Text>
          <Text style={styles.sectionContent}>
            {v(c.integracion_diagnostica, 'Clínicamente sano al momento de la valoración.')}
          </Text>
        </View>

        {/* VII. DICTAMEN DE APTITUD LABORAL Y FIRMA (NO DIVISIBLE) */}
        <View wrap={false}>
          <View style={verdictCardStyle}>
            <Text style={styles.verdictHeader}>{dictamenTitulo}</Text>
            <Text style={styles.verdictText}>
              {v(c.dictamen_laboral_texto, 'Apto para realizar actividades laborales.')}
            </Text>
          </View>

          <Text style={styles.legalDisclaimer}>
            Se expide el presente certificado médico laboral a petición del interesado para los
            fines legales y laborales que a su derecho convengan.
          </Text>

          <View style={styles.signatureContainer}>
            <View style={styles.signatureLine} />
            <Text style={styles.signatureName}>{c.medico_nombre}</Text>
            <Text style={styles.signatureCedula}>Cédula Profesional: {v(c.medico_cedula)}</Text>
            <Text style={styles.signatureTitle}>{credenciales}</Text>
          </View>
        </View>

        {/* PIE DE PÁGINA INSTITUCIONAL FIJO */}
        <Text style={styles.footer} fixed>
          {SME_LEGAL_NAME} — {SME_PDF_FOOTER}
        </Text>
      </Page>
    </Document>
  )
}

export async function renderCertificadoMedicoToMemory(
  data: CertificadoMedicoPdfInput,
): Promise<Buffer> {
  const blob = await pdf(<CertificadoMedicoPDF data={data} />).toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
