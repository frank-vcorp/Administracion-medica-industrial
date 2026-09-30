/**
 * @file Suite de Playwright headless para LOTE-20260820-01 Unidad 4 (CommonJS).
 * @id IMPL-20260820-06 / LOTE-20260820-01 Unidad 4
 */
const { test, expect } = require('@playwright/test')
const { fileURLToPath } = require('node:url')
const path = require('node:path')
const fs = require('node:fs')

const HERE = __dirname
const EVIDENCE_DIR = path.resolve(HERE, '..')

const cases = [
  {
    name: 'audio-draft-empty',
    file: 'audio-draft-empty.html',
    expectText: ['Extracción clínica', 'V3 draft', 'Sin datos extraídos aún'],
    expectTags: ['data-status="draft"'],
  },
  {
    name: 'audio-tested-saavedra',
    file: 'audio-tested-saavedra.html',
    expectText: [
      'Vía aérea por frecuencia',
      'Oído derecho',
      'Oído izquierdo',
      'Campos fuente del formato',
      'faringe', 'cad', 'cai', 'mtd', 'mti',
      'Sin datos patológicos',
      '500', '1000', '2000', '3000', '4000', '6000', '8000',
      '10',
    ],
    expectTags: ['data-status="tested"'],
  },
  {
    name: 'espiro-draft-ob',
    file: 'espiro-draft-ob.html',
    expectText: [
      'Parámetros espirométricos',
      'FVC', 'FEV1', 'FEV1/FVC', 'FEF25-75',
      'SIBELMED W20s',
      'REF', 'LLN', '%REF M1',
      'Limitación DG-1',
    ],
    expectTags: ['data-status="draft"'],
  },
  {
    name: 'espiro-tested-hipotetico',
    file: 'espiro-tested-hipotetico.html',
    expectText: [
      'Parámetros espirométricos',
      'FVC', 'FEV1', 'FEV1/FVC', 'FEF25-75', 'PEF', 'FET', 'FEV6', 'FIVC',
      'M1', 'M2', 'M3', 'REF', 'LLN',
    ],
    expectTags: ['data-status="tested"', 'data-scenario="hipotetico"'],
  },
  {
    name: 'audio-non-conclusive',
    file: 'audio-non-conclusive.html',
    expectText: [
      'AI_NON_CONCLUSIVE',
      'parametros_minimos_faltantes',
      'no_concluyente',
    ],
    expectTags: ['data-ai-flag="AI_NON_CONCLUSIVE"'],
  },
]

for (const c of cases) {
  test(`renders ${c.name}`, async ({ page }) => {
    const url = `file://${path.join(HERE, c.file)}`
    await page.goto(url, { waitUntil: 'load' })

    const screenshotPath = path.join(EVIDENCE_DIR, `${c.name}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })

    // Genera un "snapshot" textual basado en el HTML renderizado (role-based)
    // Sustituye a page.accessibility.snapshot() removido en Playwright 1.58+.
    const domSnapshot = await page.evaluate(() => {
      function walk(node, depth = 0) {
        if (!node) return null
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent?.trim()
          if (!t) return null
          return { kind: 'text', depth, text: t }
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return null
        const el = node
        const role = el.getAttribute('role') || el.tagName.toLowerCase()
        const label = el.getAttribute('aria-label') || ''
        const dataTestId = el.getAttribute('data-testid') || ''
        const ownText = Array.from(el.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent?.trim())
          .filter(Boolean)
          .join(' ')
        const children = Array.from(el.childNodes)
          .map((n) => walk(n, depth + 1))
          .filter(Boolean)
        if (!children.length && !ownText && !label && !dataTestId) return null
        return {
          kind: 'element',
          role,
          label: label || undefined,
          dataTestId: dataTestId || undefined,
          ownText: ownText || undefined,
          depth,
          children,
        }
      }
      return walk(document.body)
    })
    const snapshotPath = path.join(EVIDENCE_DIR, `${c.name}.accessibility.txt`)
    fs.writeFileSync(snapshotPath, JSON.stringify(domSnapshot, null, 2))

    const bodyText = await page.textContent('body')
    for (const needle of c.expectText) {
      expect(bodyText, `expected text "${needle}" in ${c.name}`).toContain(needle)
    }

    for (const tag of c.expectTags) {
      const match = tag.match(/^data-([a-z0-9-]+)="([^"]*)"$/)
      if (!match) continue
      const [, key, val] = match
      const locator = page.locator(`[data-${key}="${val}"]`).first()
      await expect(locator, `expected data-${key}="${val}" in ${c.name}`).toBeAttached()
    }
  })
}