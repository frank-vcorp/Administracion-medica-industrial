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

/** Arma la URL de la papeleta a partir del query actual. */
export function buildPapeletaUrl(
  pathname: string,
  search: string,
  patch: {
    eventTest?: string | null
    emSection?: string | null
  },
): string {
  const next = patchPapeletaSearchParams(
    new URLSearchParams(search.startsWith('?') ? search.slice(1) : search),
    patch,
  )
  const qs = next.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

/** Lee el query real del navegador. En el servidor usa el valor que mandó Next. */
export function readPapeletaQueryParam(
  name: 'eventTest' | 'emSection',
  fallback: string | null = null,
): string | null {
  if (typeof window === 'undefined') return fallback
  return new URLSearchParams(window.location.search).get(name)
}

/**
 * Deja el estudio activo en la URL sin pedir de nuevo el expediente.
 * `router.replace` vuelve a ejecutar el server component y, con varios
 * estudios, el cambio de papeleta se siente trabado.
 */
export function replacePapeletaQuery(patch: {
  eventTest?: string | null
  emSection?: string | null
}): void {
  if (typeof window === 'undefined') return
  const url = buildPapeletaUrl(window.location.pathname, window.location.search, patch)
  window.history.replaceState(window.history.state, '', url)
}
