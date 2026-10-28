/** Prefill peso, talla y TA desde somatometría de la papeleta (O9-20). */

export type EspirometriaInheritedVitals = {
  peso_kg?: string
  talla_m?: string
  ta_sistolica?: string
  ta_diastolica?: string
}

export function inheritVitalsFromSomatometry(
  somatometry: Record<string, unknown> | null | undefined,
): EspirometriaInheritedVitals {
  const s = somatometry ?? {}
  const str = (k: string) => {
    const v = s[k]
    if (v == null || v === '') return undefined
    return String(v).trim() || undefined
  }
  return {
    peso_kg: str('peso_kg'),
    talla_m: str('talla_m'),
    ta_sistolica: str('ta_sistolica'),
    ta_diastolica: str('ta_diastolica'),
  }
}

export function mergeEspirometriaVitals(
  existing: EspirometriaInheritedVitals | null | undefined,
  inherited: EspirometriaInheritedVitals,
): EspirometriaInheritedVitals {
  const base = existing ?? {}
  return {
    peso_kg: base.peso_kg?.trim() || inherited.peso_kg,
    talla_m: base.talla_m?.trim() || inherited.talla_m,
    ta_sistolica: base.ta_sistolica?.trim() || inherited.ta_sistolica,
    ta_diastolica: base.ta_diastolica?.trim() || inherited.ta_diastolica,
  }
}
