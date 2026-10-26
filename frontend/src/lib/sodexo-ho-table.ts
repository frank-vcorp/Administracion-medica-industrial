/**
 * §3 Historia ocupacional Sodexo — filas de empleo y columnas de la matriz de riesgo.
 */
import type { SodexoExtensionData } from '@/schemas/clinical/examen-medico-variant.schema'

export type SodexoHoFila = NonNullable<SodexoExtensionData['historia_ocupacional_filas']>[number]
export type SodexoMatrizColumn = '1' | '2' | '3' | '4' | '5' | 'A'

export const SODEXO_MATRIZ_COLUMNS: SodexoMatrizColumn[] = ['1', '2', '3', '4', '5', 'A']

export const HO_EMPTY_ROW: SodexoHoFila = {
  empresa_area: '',
  empresa: '',
  ocupacion: '',
  anios: '',
  meses: '',
  tiempo: '',
  examen_ingreso: false,
  examen_periodico: false,
  examen_retiro: false,
  examen_no: false,
  rt: null,
  secuelas: null,
  indemnizado: null,
  indemnizado_fecha: '',
  es_actual: false,
  agentes_riesgo: '',
}

export function hoRowHasContent(row: SodexoHoFila | undefined): boolean {
  if (!row) return false
  const empresa = row.empresa_area?.trim() || row.empresa?.trim()
  return Boolean(
    empresa ||
      row.ocupacion?.trim() ||
      row.anios?.trim() ||
      row.meses?.trim() ||
      row.tiempo?.trim() ||
      row.examen_ingreso ||
      row.examen_periodico ||
      row.examen_retiro ||
      row.examen_no ||
      row.rt ||
      row.secuelas ||
      row.indemnizado ||
      row.indemnizado_fecha?.trim(),
  )
}

/** Normaliza filas legacy (empresa/tiempo/agentes) al modelo del impreso. */
export function normalizeHoFila(raw: SodexoHoFila): SodexoHoFila {
  const empresa_area = raw.empresa_area?.trim() || raw.empresa?.trim() || ''
  let anios = raw.anios?.trim() || ''
  let meses = raw.meses?.trim() || ''
  if (!anios && !meses && raw.tiempo?.trim()) {
    const m = raw.tiempo.match(/(\d+)\s*a(?:ño|nos)?(?:\s*(\d+)\s*m(?:es|eses)?)?/i)
    if (m) {
      anios = m[1] ?? ''
      meses = m[2] ?? ''
    } else {
      anios = raw.tiempo.trim()
    }
  }
  return {
    ...HO_EMPTY_ROW,
    ...raw,
    empresa_area,
    empresa: empresa_area,
    anios,
    meses,
  }
}

export type HoTableUi = { historico: SodexoHoFila[]; actual: SodexoHoFila }

export function hoTableForUi(value: SodexoExtensionData): HoTableUi {
  const stored = (value.historia_ocupacional_filas ?? []).map(normalizeHoFila)
  const actualMarked = stored.find((r) => r.es_actual)
  const historicoAll = stored.filter((r) => !r.es_actual)
  const historicoWithContent = historicoAll.filter(hoRowHasContent)

  if (actualMarked) {
    const historico = historicoAll.slice(0, 5)
    if (historico.length === 0) historico.push({ ...HO_EMPTY_ROW })
    return {
      historico,
      actual: { ...HO_EMPTY_ROW, ...actualMarked, es_actual: true },
    }
  }

  /** Una sola fila guardada sin `es_actual` → empleo actual (fila «Actual» del impreso). */
  if (historicoWithContent.length === 1 && historicoAll.length === 1) {
    return {
      historico: [{ ...HO_EMPTY_ROW }],
      actual: { ...HO_EMPTY_ROW, ...historicoWithContent[0], es_actual: true },
    }
  }

  const historico = historicoAll.slice(0, 5)
  if (historico.length === 0) historico.push({ ...HO_EMPTY_ROW })
  return {
    historico,
    actual: { ...HO_EMPTY_ROW, es_actual: true },
  }
}

export function commitHoTable(value: SodexoExtensionData, ui: HoTableUi): SodexoExtensionData {
  const hist = ui.historico.map(normalizeHoFila).slice(0, 5)
  const actual = normalizeHoFila({ ...ui.actual, es_actual: true })
  const merged = [...hist, actual]
  if (merged.every((r) => !hoRowHasContent(r))) {
    return { ...value, historia_ocupacional_filas: null }
  }
  return { ...value, historia_ocupacional_filas: merged }
}

export type MatrizColumnHeader = {
  key: SodexoMatrizColumn
  title: string
  subtitle: string
  active: boolean
}

export function matrizColumnHeaders(ui: HoTableUi): MatrizColumnHeader[] {
  const cols: MatrizColumnHeader[] = []
  for (let i = 0; i < 5; i++) {
    const key = String(i + 1) as SodexoMatrizColumn
    const row = ui.historico[i]
    const active = hoRowHasContent(row)
    const label = row?.empresa_area?.trim() || row?.empresa?.trim() || ''
    cols.push({
      key,
      title: key,
      subtitle: active ? label || `Empleo ${key}` : '—',
      active,
    })
  }
  const aActive = hoRowHasContent(ui.actual)
  const aLabel = ui.actual.empresa_area?.trim() || ui.actual.empresa?.trim() || ''
  cols.push({
    key: 'A',
    title: 'A',
    subtitle: aActive ? aLabel || 'Actual' : '—',
    active: aActive,
  })
  return cols
}

/** Columna de matriz para fila histórica (índice 0-based) o Actual. */
export function matrizColumnForHoRow(row: SodexoHoFila, historicoIndex: number): SodexoMatrizColumn | null {
  if (row.es_actual) return 'A'
  if (historicoIndex < 0 || historicoIndex > 4) return null
  return String(historicoIndex + 1) as SodexoMatrizColumn
}

export function normalizeMatrizFactorValue(
  raw: unknown,
): SodexoMatrizColumn[] {
  if (Array.isArray(raw)) {
    return raw.filter((c): c is SodexoMatrizColumn =>
      SODEXO_MATRIZ_COLUMNS.includes(c as SodexoMatrizColumn),
    )
  }
  const s = String(raw ?? '').trim().toUpperCase()
  if (SODEXO_MATRIZ_COLUMNS.includes(s as SodexoMatrizColumn)) {
    return [s as SodexoMatrizColumn]
  }
  return []
}

export function matrizFactorColumns(
  matriz: SodexoExtensionData['matriz_factores'],
  factorId: string,
): SodexoMatrizColumn[] {
  if (!matriz || typeof matriz !== 'object') return []
  return normalizeMatrizFactorValue((matriz as Record<string, unknown>)[factorId])
}

export function toggleMatrizFactorColumn(
  matriz: SodexoExtensionData['matriz_factores'],
  factorId: string,
  col: SodexoMatrizColumn,
  checked: boolean,
): SodexoExtensionData['matriz_factores'] {
  const base = { ...((matriz ?? {}) as Record<string, SodexoMatrizColumn[]>) }
  const current = normalizeMatrizFactorValue(base[factorId])
  const next = checked
    ? [...new Set([...current, col])]
    : current.filter((c) => c !== col)
  if (next.length === 0) delete base[factorId]
  else base[factorId] = next
  return Object.keys(base).length ? base : null
}
