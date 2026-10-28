#!/usr/bin/env node
/**
 * Genera frontend/resources/clinical/cie-10-es.json desde verasativa/CIE-10 (español).
 * Fuente: https://github.com/verasativa/CIE-10 — codes.json (nivel ≥ 3, códigos seleccionables).
 */
import { writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SOURCE_URL =
  'https://raw.githubusercontent.com/verasativa/CIE-10/master/codes.json'
const OUT = join(dirname(fileURLToPath(import.meta.url)), '../resources/clinical/cie-10-es.json')

const res = await fetch(SOURCE_URL)
if (!res.ok) {
  console.error('No se pudo descargar codes.json:', res.status, res.statusText)
  process.exit(1)
}

const rawText = await res.text()
const sourceSha256 = createHash('sha256').update(rawText).digest('hex')
const data = JSON.parse(rawText)

if (!Array.isArray(data)) {
  console.error('codes.json inválido: se esperaba un arreglo')
  process.exit(1)
}

const entries = data
  .filter((row) => typeof row?.level === 'number' && row.level >= 3)
  .map((row) => ({
    code: String(row.code ?? '').trim(),
    description: String(row.description ?? '').trim(),
  }))
  .filter((row) => row.code.length > 0 && row.description.length > 0)

entries.sort((a, b) => a.code.localeCompare(b.code, 'en', { sensitivity: 'base' }))

writeFileSync(OUT, JSON.stringify(entries))

console.log(JSON.stringify({ count: entries.length, out: OUT, sourceSha256 }, null, 2))
