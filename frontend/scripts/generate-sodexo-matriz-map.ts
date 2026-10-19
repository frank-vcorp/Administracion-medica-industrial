/**
 * Regenera `sodexo-pdf-matriz-map.generated.ts` desde geometría + orden REG-SO-01.
 * Uso: npx tsx scripts/generate-sodexo-matriz-map.ts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

type Geo = { name: string; type: string; page: number; x: number; y: number }

const FACTORS = [
  ['calor', 'neblinas', 'incendio', 'atencion_publico'],
  ['frio', 'humos', 'explosion', 'monotonia'],
  ['alta_iluminacion', 'polvos', 'sentado_prolongado', 'sobrecarga'],
  ['baja_iluminacion', 'liquidos', 'de_pie_prolongado', 'psicosocial_laboral'],
  ['presion', 'gases', 'movimientos_repetitivos', 'turnos'],
  ['rad_no_ionizante', 'vapores', 'levantamiento_cargas', 'alto_ritmo_laboral'],
  ['rad_ionizante', 'contacto', 'cont_electrico_directo', 'conflicto_interpersonal'],
  ['ruido', 'producto_quimico', 'cont_electrico_indirecto', 'ergonomico_fq'],
  ['vibracion', 'quimico', 'carga_estatica', 'monotonia_psicosocial'],
] as const

const ROW_Y = [214, 206, 198, 190, 182, 173, 165, 158, 150]
const BANDS: readonly [number, number][] = [[228, 320], [378, 453], [520, 592]]

const geoPath = path.join(process.cwd(), 'resources/pdf/sodexo-field-geometry.json')
const g = JSON.parse(readFileSync(geoPath, 'utf8')) as Geo[]
const cbs = g.filter(
  (f) => f.page === 0 && f.type === 'CheckBox' && f.y > 145 && f.y < 230,
)

function levels(y: number, band: readonly [number, number]): string[] | null {
  const boxes = cbs
    .filter((f) => Math.abs(f.y - y) <= 2 && f.x >= band[0] && f.x <= band[1])
    .sort((a, b) => a.x - b.x)
    .map((f) => f.name)
  return boxes.length === 6 ? boxes : null
}

/** Intentos (y, bandIndex) por celda (ri, ci) — calibrado al layout REG-SO-01. */
function candidates(ri: number, ci: number): [number, number][] {
  const y = ROW_Y[ri]
  const y1 = ROW_Y[ri + 1]
  const y2 = ROW_Y[ri + 2]
  const y_1 = ROW_Y[ri - 1]
  const out: [number, number][] = []
  if (ci === 0) {
    out.push([y, 0], [y_1, 0], [y1, 0], [y, 1], [175, 0], [156, 0])
  } else if (ci === 1) {
    out.push([y, 1], [y1, 1], [y_1, 1], [y, 0], [163, 1], [171, 1])
  } else if (ci === 2) {
    out.push([y1, 1], [y, 1], [y1, 0], [y, 2], [192, 2], [180, 2])
  } else {
    out.push([y, 2], [y1, 2], [y_1, 2], [y1, 1], [155, 2])
  }
  return out.filter(([yy]) => yy !== undefined && Number.isFinite(yy))
}

const map: Record<string, readonly string[]> = {}
const usedKeys = new Set<string>()

for (let ri = 0; ri < 9; ri++) {
  for (let ci = 0; ci < 4; ci++) {
    const id = FACTORS[ri][ci]
    let found: string[] | null = null
    for (const [yy, bi] of candidates(ri, ci)) {
      const lv = levels(yy, BANDS[bi])
      if (!lv) continue
      const sig = lv.join('|')
      if (usedKeys.has(sig) && ci < 3) continue
      found = lv
      usedKeys.add(sig)
      break
    }
    if (!found) {
      for (const [yy, bi] of candidates(ri, ci)) {
        const lv = levels(yy, BANDS[bi])
        if (lv) {
          found = lv
          break
        }
      }
    }
    if (found) map[id] = found
  }
}

const outPath = path.join(process.cwd(), 'src/lib/sodexo-pdf-matriz-map.generated.ts')
const body = `/** Auto-generado — npx tsx scripts/generate-sodexo-matriz-map.ts */\nexport const SODEXO_MATRIZ_FACTOR_LEVELS_GENERATED: Record<string, readonly string[]> = ${JSON.stringify(map, null, 2)} as const\n`
writeFileSync(outPath, body)
console.log('Wrote', outPath, 'keys', Object.keys(map).length, '/', 36)
