import { readFileSync } from 'node:fs'
import path from 'node:path'

export type SodexoFieldGeo = {
  name: string
  type: string
  page: number
  x: number
  y: number
  w?: number
  h?: number
}

let cached: SodexoFieldGeo[] | null = null

export function loadSodexoFieldGeometry(): SodexoFieldGeo[] {
  if (cached) return cached
  const p = path.join(process.cwd(), 'resources/pdf/sodexo-field-geometry.json')
  cached = JSON.parse(readFileSync(p, 'utf8')) as SodexoFieldGeo[]
  return cached
}
