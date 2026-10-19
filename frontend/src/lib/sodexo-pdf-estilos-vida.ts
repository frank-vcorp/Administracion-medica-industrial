/**
 * §8 Estilos de vida — tabaco, alcohol y drogas (casillas REG-SO-01).
 */
import type { PdfForm } from '@/lib/sodexo-pdf-acroform'
import { sodexoSetCheck, sodexoSetText } from '@/lib/sodexo-pdf-acroform'

function norm(raw: string | null | undefined): string {
  return (raw ?? '').trim().toUpperCase()
}

function mapNegadoSi(raw: string | null | undefined): 'no' | 'si' | null {
  const u = norm(raw)
  if (!u || u === 'NEGADO' || u === 'NO') return 'no'
  if (u === 'SI' || u.startsWith('SI')) return 'si'
  return null
}

/** Bloque principal §8 (y ~248–258). */
const TABACO_NO = 'Check Box545'
const TABACO_SI = 'Check Box546'
const TABACO_EVENTUAL = 'Check Box547'
const TABACO_HABITUAL = 'Check Box548'
const TABACO_COMPULSIVO = 'Check Box549'

const ALCOHOL_NO = 'Check Box550'
const ALCOHOL_SI = 'Check Box551'
const ALCOHOL_OCASIONAL = 'Check Box559'

const DROGAS_NO = 'Check Box556'
const DROGAS_SI = 'Check Box557'

/** Años de hábito / exfumador (y ~674). */
const TABACO_ANIOS_1_5 = 'Check Box340'
const TABACO_ANIOS_6_10 = 'Check Box338'
const TABACO_ANIOS_11_20 = 'Check Box336'
const TABACO_ANIOS_MAS_20 = 'Check Box334'
const EXFUMADOR = 'Check Box342'

function markTabacoIntensity(form: PdfForm, raw: string) {
  const u = norm(raw)
  if (u.includes('EVENTUAL') || u.includes('<5')) sodexoSetCheck(form, TABACO_EVENTUAL, true)
  if (u.includes('HABITUAL') || u.includes('6-10') || u.includes('6 A 10')) {
    sodexoSetCheck(form, TABACO_HABITUAL, true)
  }
  if (u.includes('COMPULSIV') || u.includes('11')) sodexoSetCheck(form, TABACO_COMPULSIVO, true)
  if (u.includes('EXFUMADOR') || u.includes('EXFUM')) sodexoSetCheck(form, EXFUMADOR, true)
  if (/\b1-5\b|\b1 A 5\b/.test(u)) sodexoSetCheck(form, TABACO_ANIOS_1_5, true)
  if (/\b6-10\b|\b6 A 10\b/.test(u)) sodexoSetCheck(form, TABACO_ANIOS_6_10, true)
  if (/\b11-20\b/.test(u)) sodexoSetCheck(form, TABACO_ANIOS_11_20, true)
  if (u.includes('>20') || u.includes('MAS DE 20')) sodexoSetCheck(form, TABACO_ANIOS_MAS_20, true)
}

export function fillSodexoEstilosVida(
  form: PdfForm,
  apnp: {
    tabaco?: string | null
    alcohol?: string | null
    drogas?: string | null
  },
  _estilosExt?: unknown,
) {
  const tabRaw = apnp.tabaco ?? ''
  const tab = mapNegadoSi(tabRaw)
  if (tab === 'no') sodexoSetCheck(form, TABACO_NO, true)
  else if (tab === 'si') {
    sodexoSetCheck(form, TABACO_SI, true)
    markTabacoIntensity(form, tabRaw)
  }

  const alcRaw = apnp.alcohol ?? ''
  const alc = mapNegadoSi(alcRaw)
  if (alc === 'no') sodexoSetCheck(form, ALCOHOL_NO, true)
  else if (alc === 'si') {
    sodexoSetCheck(form, ALCOHOL_SI, true)
    if (norm(alcRaw).includes('OCASIONAL')) sodexoSetCheck(form, ALCOHOL_OCASIONAL, true)
    else if (alcRaw.trim()) sodexoSetText(form, 'Ocasional', alcRaw)
  }

  const drog = mapNegadoSi(apnp.drogas)
  if (drog === 'no') sodexoSetCheck(form, DROGAS_NO, true)
  else if (drog === 'si') {
    sodexoSetCheck(form, DROGAS_SI, true)
    sodexoSetText(form, 'Tipo de droga', apnp.drogas ?? '')
  }
}
