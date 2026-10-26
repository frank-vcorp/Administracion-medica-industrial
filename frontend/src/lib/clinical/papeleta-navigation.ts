/** Secciones persistibles del formulario Examen Médico (outer + inner tabs). */
export type ExamenMedicoNavSection =
  | 'somatometria'
  | 'signos_vitales'
  | 'agudeza_visual'
  | 'examen_medico'
  | 'antecedentes'
  | 'exploracion'
  | 'extension'
  | 'impresion'

export type ExamenMedicoOuterTab =
  | 'somatometria'
  | 'signos_vitales'
  | 'agudeza_visual'
  | 'examen_medico'

export type ExamenMedicoInnerTab =
  | 'antecedentes'
  | 'exploracion'
  | 'extension'
  | 'impresion'

const OUTER_SECTIONS = new Set<ExamenMedicoNavSection>([
  'somatometria',
  'signos_vitales',
  'agudeza_visual',
  'examen_medico',
])

const INNER_SECTIONS = new Set<ExamenMedicoNavSection>([
  'antecedentes',
  'exploracion',
  'extension',
  'impresion',
])

export function parseExamenMedicoNavSection(
  raw: string | null | undefined,
): { outerTab: ExamenMedicoOuterTab; innerTab: ExamenMedicoInnerTab } | null {
  if (!raw || typeof raw !== 'string') return null
  const section = raw.trim() as ExamenMedicoNavSection
  if (INNER_SECTIONS.has(section)) {
    return { outerTab: 'examen_medico', innerTab: section as ExamenMedicoInnerTab }
  }
  if (OUTER_SECTIONS.has(section)) {
    return {
      outerTab: section as ExamenMedicoOuterTab,
      innerTab: 'antecedentes',
    }
  }
  return null
}

export function examenMedicoNavSectionFromTabs(
  outerTab: ExamenMedicoOuterTab,
  innerTab: ExamenMedicoInnerTab,
): ExamenMedicoNavSection {
  if (outerTab === 'examen_medico') return innerTab
  return outerTab
}

/** Actualiza query string de la papeleta sin perder `view` ni otros params. */
export function patchPapeletaSearchParams(
  current: URLSearchParams,
  patch: {
    eventTest?: string | null
    emSection?: string | null
  },
): URLSearchParams {
  const next = new URLSearchParams(current.toString())
  if (patch.eventTest === null) {
    next.delete('eventTest')
  } else if (patch.eventTest) {
    next.set('eventTest', patch.eventTest)
  }
  if (patch.emSection === null) {
    next.delete('emSection')
  } else if (patch.emSection) {
    next.set('emSection', patch.emSection)
  }
  return next
}
