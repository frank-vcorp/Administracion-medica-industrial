/**
 * @fileoverview Catálogo de órganos, adjetivos clínicos y generador del formato narrativo
 * para la sección de Exploración Física del Certificado Médico.
 */

export interface AdjetivoOpcion {
  id: string
  label: string
  texto: string
  esNormal?: boolean
}

export interface OrganoDef {
  id: string
  nombre: string
  icono: string
  opciones: AdjetivoOpcion[]
}

export const ORGANOS_ADJETIVOS: OrganoDef[] = [
  {
    id: 'general',
    nombre: 'Estado general',
    icono: '👤',
    opciones: [
      {
        id: 'orientado_hidratado',
        label: 'Consciente, orientado e hidratado',
        texto: 'consciente, orientado en espacio, tiempo, persona y situación, con buen estado de hidratación',
        esNormal: true,
      },
      {
        id: 'deshidratado',
        label: 'Subhidratado',
        texto: 'consciente y orientado, con mucosas orales subhidratadas',
      },
      {
        id: 'ansioso',
        label: 'Facies de ansiedad',
        texto: 'consciente, orientado, con facies de ligera ansiedad',
      },
    ],
  },
  {
    id: 'craneo',
    nombre: 'Cráneo',
    icono: '🧠',
    opciones: [
      {
        id: 'normocefalo',
        label: 'Normocéfalo sin alteraciones',
        texto: 'Cráneo normocéfalo sin hundimientos ni exostosis',
        esNormal: true,
      },
      {
        id: 'cicatriz_craneo',
        label: 'Cicatriz en cráneo',
        texto: 'Cráneo con presencia de cicatriz antigua',
      },
      {
        id: 'hematoma',
        label: 'Contusión / Hematoma',
        texto: 'Cráneo con contusión o hematoma leve',
      },
    ],
  },
  {
    id: 'ojos',
    nombre: 'Ojos / Pupilas',
    icono: '👁️',
    opciones: [
      {
        id: 'pupilas_normales',
        label: 'Pupilas isocóricas normorreflécticas',
        texto: 'ojos con reflejo fotomotor y consensual conservado, pupilas isocóricas normorreflécticas, conjuntivas y escleras sin alteraciones',
        esNormal: true,
      },
      {
        id: 'pterigion',
        label: 'Pterigión',
        texto: 'presencia de pterigión que respeta área pupilar',
      },
      {
        id: 'lentes_armazon',
        label: 'Usa lentes',
        texto: 'portador de lentes de armazón para corrección visual',
      },
      {
        id: 'conjuntivitis',
        label: 'Hiperemia / Irritación',
        texto: 'ligera hiperemia conjuntival bilateral',
      },
    ],
  },
  {
    id: 'oidos',
    nombre: 'Oídos',
    icono: '👂',
    opciones: [
      {
        id: 'permeables',
        label: 'Conductos permeables',
        texto: 'oídos de características normales con conductos auditivos permeables sin alteraciones',
        esNormal: true,
      },
      {
        id: 'tapon_cerumen',
        label: 'Tapón de cerumen',
        texto: 'conducto auditivo con presencia de tapón de cerumen',
      },
      {
        id: 'hipoacusia',
        label: 'Hipoacusia aparente',
        texto: 'hipoacusia aparente a la exploración acústica',
      },
    ],
  },
  {
    id: 'nariz',
    nombre: 'Nariz',
    icono: '👃',
    opciones: [
      {
        id: 'permeable',
        label: 'Fosas permeables',
        texto: 'nariz con fosas nasales y mucosa permeables sin secreciones patológicas',
        esNormal: true,
      },
      {
        id: 'desviacion_septal',
        label: 'Desviación septal',
        texto: 'presencia de desviación septal nasal',
      },
      {
        id: 'rinitis',
        label: 'Rinitis / Congestión',
        texto: 'mucosa nasal congestiva sugestiva de rinitis',
      },
    ],
  },
  {
    id: 'boca',
    nombre: 'Boca / Dentadura',
    icono: '👄',
    opciones: [
      {
        id: 'completa_sin_caries',
        label: 'Completa sin caries ni sarro',
        texto: 'cavidad oral hidratada, dentadura completa sin datos de caries ni sarro, faringe sin alteraciones',
        esNormal: true,
      },
      {
        id: 'caries',
        label: 'Caries dental',
        texto: 'cavidad oral con presencia de caries dental',
      },
      {
        id: 'sarro',
        label: 'Sarro / Placa bacteriana',
        texto: 'presencia de sarro y placa dentobacteriana',
      },
      {
        id: 'edentulo',
        label: 'Edéntulo parcial',
        texto: 'edentulismo parcial sin afección funcional',
      },
      {
        id: 'protesis',
        label: 'Prótesis dental',
        texto: 'portador de prótesis dental',
      },
    ],
  },
  {
    id: 'cuello',
    nombre: 'Cuello',
    icono: '🦒',
    opciones: [
      {
        id: 'cilindrico_movil',
        label: 'Cilíndrico, móvil, sin adenopatías',
        texto: 'cuello cilíndrico, móvil, sin masas ni adenopatías palpables',
        esNormal: true,
      },
      {
        id: 'contractura_cuello',
        label: 'Contractura muscular',
        texto: 'cuello con contractura muscular paravertebral leve',
      },
      {
        id: 'masa_adenopatia',
        label: 'Adenopatía / Masa',
        texto: 'palpación de adenopatía en región cervical',
      },
    ],
  },
  {
    id: 'torax',
    nombre: 'Tórax / Cardiopulmonar',
    icono: '🫁',
    opciones: [
      {
        id: 'mesomorfico_normal',
        label: 'Mesomórfico, cardiopulmonar normal',
        texto: 'tórax mesomórfico con movimientos de amplexión y amplexación normales, auscultación cardiopulmonar sin alteraciones ni ruidos agregados',
        esNormal: true,
      },
      {
        id: 'sibilancias',
        label: 'Estertores / Sibilancias',
        texto: 'auscultación pulmonar con presencia de estertores o sibilancias espiratorias',
      },
      {
        id: 'arritmia',
        label: 'Arritmia auscultada',
        texto: 'ruidos cardiacos con extrasístoles o arritmia detectable',
      },
    ],
  },
  {
    id: 'abdomen',
    nombre: 'Abdomen',
    icono: '🩹',
    opciones: [
      {
        id: 'blando_no_doloroso',
        label: 'Globoso, depresible, no doloroso',
        texto: 'abdomen globoso, blando, depresible, no doloroso a la palpación, sin visceromegalias ni masas palpables',
        esNormal: true,
      },
      {
        id: 'doloroso_palpacion',
        label: 'Doloroso a palpación',
        texto: 'abdomen doloroso a la palpación profunda',
      },
      {
        id: 'cicatriz_quirurgica',
        label: 'Cicatriz quirúrgica',
        texto: 'abdomen con cicatriz quirúrgica antigua',
      },
      {
        id: 'hernia',
        label: 'Hernia umbilical / inguinal',
        texto: 'presencia de hernia reducible a la maniobra de Valsalva',
      },
    ],
  },
  {
    id: 'columna',
    nombre: 'Columna vertebral',
    icono: '🦴',
    opciones: [
      {
        id: 'alineada_sin_dolor',
        label: 'Alineada, arcos de movilidad completos',
        texto: 'columna vertebral alineada con arcos de movilidad conservados, sin dolor a la palpación de apófisis espinosas ni contractura',
        esNormal: true,
      },
      {
        id: 'contractura_lumbar',
        label: 'Contractura lumbar',
        texto: 'columna con contractura muscular paravertebral lumbar',
      },
      {
        id: 'escoliosis',
        label: 'Escoliosis leve',
        texto: 'asimetría postural con escoliosis leve',
      },
    ],
  },
  {
    id: 'extremidades',
    nombre: 'Extremidades',
    icono: '🦵',
    opciones: [
      {
        id: 'integras_sin_edema',
        label: 'Íntegras, eutróficas, sin edema',
        texto: 'extremidades íntegras, eutróficas, llenado capilar inmediato, sin edema',
        esNormal: true,
      },
      {
        id: 'edema',
        label: 'Edema maleolar',
        texto: 'presencia de edema maleolar bilateral leve',
      },
      {
        id: 'varices',
        label: 'Várices en miembros inferiores',
        texto: 'presencia de trayectos varicosos en miembros inferiores',
      },
      {
        id: 'limitacion_movilidad',
        label: 'Movilidad limitada',
        texto: 'limitación en arcos de movilidad articular',
      },
    ],
  },
  {
    id: 'neurologico',
    nombre: 'Fuerza / Reflejos',
    icono: '⚡',
    opciones: [
      {
        id: 'daniels_5',
        label: 'Daniels 5/5, reflejos normales',
        texto: 'fuerza muscular en escala de Daniels 5/5 en cuatro extremidades, sensibilidad y reflejos osteotendinosos conservados',
        esNormal: true,
      },
      {
        id: 'daniels_4',
        label: 'Fuerza disminuida (Daniels 4/5)',
        texto: 'fuerza muscular en escala de Daniels 4/5',
      },
    ],
  },
  {
    id: 'romberg_tandem',
    nombre: 'Romberg y Marcha tándem',
    icono: '🚶',
    opciones: [
      {
        id: 'romberg_negativo',
        label: 'Romberg negativo, marcha normal',
        texto: 'pruebas cerebelosas dedo-nariz y talón-rodilla negativas, prueba de Romberg negativa, marcha talón-punta (tándem) normal y estable',
        esNormal: true,
      },
      {
        id: 'romberg_positivo',
        label: 'Romberg positivo',
        texto: 'prueba de Romberg positiva con lateropulsión',
      },
      {
        id: 'marcha_claudicante',
        label: 'Marcha claudicante',
        texto: 'marcha claudicante con compensación antiálgica',
      },
    ],
  },
  {
    id: 'piel',
    nombre: 'Piel y anexos',
    icono: '🎨',
    opciones: [
      {
        id: 'sin_lesiones',
        label: 'Sin lesiones aparentes',
        texto: 'piel y tegumentos sin lesiones ni alteraciones aparentes',
        esNormal: true,
      },
      {
        id: 'tatuajes',
        label: 'Tatuajes visibles',
        texto: 'presencia de tatuajes visibles',
      },
      {
        id: 'cicatrices_visibles',
        label: 'Cicatrices visibles',
        texto: 'presencia de cicatrices dérmicas antiguas',
      },
      {
        id: 'dermatitis',
        label: 'Dermatitis / Eccema',
        texto: 'presencia de lesiones eritematosas sugestivas de dermatitis',
      },
    ],
  },
]

export type OrganosAdjetivosState = Record<
  string,
  {
    selectedIds: string[]
    notaLibre: string
  }
>

export function buildDefaultOrganosAdjetivosState(): OrganosAdjetivosState {
  const state: OrganosAdjetivosState = {}
  for (const organo of ORGANOS_ADJETIVOS) {
    const normalOpt = organo.opciones.find((o) => o.esNormal) ?? organo.opciones[0]
    state[organo.id] = {
      selectedIds: normalOpt ? [normalOpt.id] : [],
      notaLibre: '',
    }
  }
  return state
}

export function buildExploracionNarrativaDesdeAdjetivos(
  state: OrganosAdjetivosState,
  antecedentes?: Record<string, unknown> | null,
): string {
  const np = antecedentes?.no_patologicos as Record<string, unknown> | undefined
  const hasTattoos = String(np?.tatuajes ?? '').toUpperCase() === 'SI'
  const espTattoos = typeof np?.tatuajes_especifique === 'string' && np.tatuajes_especifique.trim()

  const partes: string[] = []

  // 1. General
  const stGeneral = state.general
  const generalOpt = ORGANOS_ADJETIVOS.find((o) => o.id === 'general')?.opciones.find(
    (opt) => stGeneral?.selectedIds?.includes(opt.id),
  )
  const generalText = generalOpt ? generalOpt.texto : 'consciente, orientado en cuatro esferas con buen estado de hidratación'
  partes.push(`Se encuentra paciente ${generalText}.`)

  // 2. Cabeza, Ojos, Oídos, Nariz, Boca, Cuello
  const cabezaPartes: string[] = []

  const getOrganoText = (id: string): string => {
    const st = state[id]
    const organoDef = ORGANOS_ADJETIVOS.find((o) => o.id === id)
    if (!organoDef || !st) return ''
    const textos: string[] = []
    for (const optId of st.selectedIds || []) {
      const opt = organoDef.opciones.find((o) => o.id === optId)
      if (opt) textos.push(opt.texto)
    }
    if (st.notaLibre?.trim()) {
      textos.push(st.notaLibre.trim())
    }
    return textos.join(', ')
  }

  const craneo = getOrganoText('craneo')
  if (craneo) cabezaPartes.push(`${craneo}.`)

  const ojos = getOrganoText('ojos')
  if (ojos) cabezaPartes.push(`Ojos con ${ojos}.`)

  const oidos = getOrganoText('oidos')
  if (oidos) cabezaPartes.push(`Oídos: ${oidos}.`)

  const nariz = getOrganoText('nariz')
  if (nariz) cabezaPartes.push(`Nariz: ${nariz}.`)

  const boca = getOrganoText('boca')
  if (boca) cabezaPartes.push(`Cavidad oral: ${boca}.`)

  const cuello = getOrganoText('cuello')
  if (cuello) cabezaPartes.push(`Cuello: ${cuello}.`)

  if (cabezaPartes.length > 0) {
    partes.push(cabezaPartes.join(' '))
  }

  // 3. Tórax
  const torax = getOrganoText('torax')
  if (torax) partes.push(`Tórax: ${torax}.`)

  // 4. Abdomen
  const abdomen = getOrganoText('abdomen')
  if (abdomen) partes.push(`Abdomen: ${abdomen}.`)

  // 5. Columna
  const columna = getOrganoText('columna')
  if (columna) partes.push(`Columna: ${columna}.`)

  // 6. Extremidades
  const ext = getOrganoText('extremidades')
  if (ext) partes.push(`Extremidades: ${ext}.`)

  // 7. Fuerza y reflejos
  const neuro = getOrganoText('neurologico')
  if (neuro) partes.push(`Fuerza muscular: ${neuro}.`)

  // 8. Piel
  let piel = getOrganoText('piel')
  if (hasTattoos) {
    const tatDesc = espTattoos ? `presencia de múltiples tatuajes en ${espTattoos}` : 'presencia de tatuajes'
    if (piel.includes('sin lesiones ni alteraciones aparentes') || !piel) {
      piel = `Piel y tegumentos con ${tatDesc}.`
    } else {
      piel = `Piel y tegumentos: ${piel}, con ${tatDesc}.`
    }
  } else if (!piel) {
    piel = 'Piel y tegumentos sin lesiones aparentes.'
  } else {
    piel = `Piel y tegumentos: ${piel}.`
  }
  partes.push(piel)

  // 9. Romberg y tándem
  const romberg = getOrganoText('romberg_tandem')
  if (romberg) partes.push(`${romberg}.`)

  partes.push('Resto de la exploración física sin alteraciones relevantes.')

  return partes.join(' ')
}
