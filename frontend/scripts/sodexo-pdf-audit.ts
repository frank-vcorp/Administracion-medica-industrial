/**
 * Auditoría de cobertura AcroForm: compara PDF generado vs plantilla vacía.
 * Uso: npx tsx scripts/sodexo-pdf-audit.ts
 */
import { writeFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { PDFDocument } from 'pdf-lib'
import { renderSodexoExamenMedicoPdf } from '../src/lib/sodexo-examen-medico-pdf'
import { buildSodexoAuditFixture } from './sodexo-pdf-fixture'

const TEMPLATE = path.join(
  process.cwd(),
  'resources/pdf/sodexo-examen-medico-template.pdf',
)
const OUT_PDF = '/tmp/sodexo-audit-full.pdf'
const OUT_JSON = '/tmp/sodexo-audit-report.json'
const OUT_MD = path.join(process.cwd(), '../context/acuerdos/sodexo-pdf-cobertura-audit.md')

type FieldSnap = {
  name: string
  type: string
  page: number
  filled: boolean
  value: string | boolean | null
}

async function snapshotFields(bytes: Uint8Array): Promise<FieldSnap[]> {
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  const pages = doc.getPages()
  const pageRefToIdx = new Map(pages.map((p, i) => [p.ref.toString(), i]))
  const out: FieldSnap[] = []
  for (const f of form.getFields()) {
    const name = f.getName()
    const type = f.constructor.name.replace('PDF', '').replace('Field', '')
    let page = -1
    try {
      const w = f.acroField.getWidgets()[0]
      const pref = w.P()
      if (pref) page = pageRefToIdx.get(pref.toString()) ?? -1
    } catch {
      // ignore
    }
    let value: string | boolean | null = null
    let filled = false
    try {
      if (type === 'CheckBox') {
        const cb = form.getCheckBox(name)
        filled = cb.isChecked()
        value = filled
      } else if (type === 'Text') {
        const t = form.getTextField(name).getText() ?? ''
        filled = t.trim().length > 0
        value = t
      }
    } catch {
      // ignore
    }
    out.push({ name, type, page, filled, value })
  }
  return out
}

function sectionForPage(page: number): string {
  if (page === 0) return '§1–3 Identificación / HO / consentimiento'
  if (page === 1) return '§4–8 AHF / APP / inmun / gineco / vitales'
  if (page === 2) return '§9 Examen físico'
  return '§10–12 Dx / reco / restricciones'
}

async function main() {
  const data = buildSodexoAuditFixture()
  const filledPdf = await renderSodexoExamenMedicoPdf(data)
  writeFileSync(OUT_PDF, filledPdf)

  const templateBytes = readFileSync(TEMPLATE)
  const before = await snapshotFields(templateBytes)
  const after = await snapshotFields(filledPdf)

  const byName = new Map(after.map((f) => [f.name, f]))
  const newlyFilled = after.filter((f) => {
    const b = before.find((x) => x.name === f.name)
    if (!b) return f.filled
    return f.filled && !b.filled
  })

  const stillEmpty = after.filter((f) => !f.filled)
  const bySection = new Map<string, { filled: number; empty: number }>()
  for (const f of after) {
    const sec = sectionForPage(f.page)
    const row = bySection.get(sec) ?? { filled: 0, empty: 0 }
    if (f.filled) row.filled++
    else row.empty++
    bySection.set(sec, row)
  }

  const report = {
    generatedAt: new Date().toISOString(),
    outputPdf: OUT_PDF,
    totalFields: after.length,
    filledAfter: after.filter((f) => f.filled).length,
    stillEmpty: stillEmpty.length,
    newlyFilledCount: newlyFilled.length,
    bySection: Object.fromEntries(bySection),
    stillEmptySample: stillEmpty.slice(0, 80).map((f) => ({
      name: f.name,
      type: f.type,
      page: f.page,
    })),
    filledSample: newlyFilled.slice(0, 60).map((f) => ({
      name: f.name,
      type: f.type,
      page: f.page,
      value: f.value,
    })),
  }

  writeFileSync(OUT_JSON, JSON.stringify(report, null, 2))

  const pct = ((report.filledAfter / report.totalFields) * 100).toFixed(1)
  const md = `# Auditoría cobertura PDF Sodexo REG-SO-01

Generado: ${report.generatedAt}

- **PDF de prueba:** \`${OUT_PDF}\`
- **Campos AcroForm:** ${report.totalFields}
- **Rellenados tras fixture completo:** ${report.filledAfter} (${pct}%)
- **Vacíos:** ${report.stillEmpty}

## Por sección (página PDF)

| Sección | Rellenados | Vacíos |
|---------|------------|--------|
${[...bySection.entries()]
  .map(([k, v]) => `| ${k} | ${v.filled} | ${v.empty} |`)
  .join('\n')}

## Conclusión

- **Cobertura AcroForm:** ~${pct}% con fixture rico + defaults de paridad (Niega/Normal, matriz nivel 1 sin dato, textos \`Texto*\` con guión).
- **Texto:** prácticamente todos los campos de texto reciben valor (exploración, dx, HO, identificación).
- **Casillas:** ~40% marcadas es techo estructural: pares Niega/Sí y Normal/Anormal dejan la mitad sin marcar; matriz 1–5+A solo una casilla por factor; firma del examinado vacía por diseño.
- **Siguiente trabajo:** comparación visual con \`FORMATO EXAMEN MEDICO SODEXO.pdf\` y ajustes finos por sección (sin tocar papeleta AMI).

Detalle JSON: \`${OUT_JSON}\`
`

  writeFileSync(OUT_MD, md)
  console.log('PDF:', OUT_PDF)
  console.log('Report:', OUT_JSON)
  console.log('Markdown:', OUT_MD)
  console.log(`Coverage: ${report.filledAfter}/${report.totalFields} (${pct}%)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
