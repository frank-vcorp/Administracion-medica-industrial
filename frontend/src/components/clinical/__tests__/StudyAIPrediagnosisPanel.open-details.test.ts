/**
 * @file Tests focales (V1) para StudyAIPrediagnosisPanel — cambio UI FEATURE-20260824-01
 *   y UX adjust FND-20260825-13.
 *
 * Cubre AC-4: Justificación, Limitaciones y Fuentes clínicas deben existir
 * con el contrato IA intacto y modo sombra clínica preservado.
 *
 * UX FND-20260825-13: las tres secciones inician COLAPSADAS (sin atributo
 * `open`) — Frank. Antes iniciaban desplegadas (`details open`). El contenido
 * sigue presente en el DOM (el navegador sólo lo oculta hasta expandir) y el
 * médico puede desplegarlo manualmente. El contrato IA no cambia.
 *
 * Implementación: SSR puro con `renderToStaticMarkup` (sin DOM environment).
 * Consistente con `ClinicalExtractionRenderer.fase5.test.ts`.
 *
 * @id IMPL-20260824-01 / FND-20260825-13
 * @backup context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import StudyAIPrediagnosisPanel from '../StudyAIPrediagnosisPanel'

const SNAPSHOT_BASE = {
  id: 'snap-1',
  version: 1,
  clinicalState: 'AI_PENDING_REVIEW',
  createdAt: new Date('2026-08-24T00:00:00Z'),
  isSuperseded: false,
}

describe('StudyAIPrediagnosisPanel — FND-20260825-13 details cerrados por defecto', () => {
  it('Justificación, Limitaciones y Fuentes clínicas inician COLAPSADAS (sin atributo open)', () => {
    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, {
        prediagnosisSnapshotId: 'snap-1',
        snapshot: {
          ...SNAPSHOT_BASE,
          prediagnosisData: {
            summary: 'Sugerencia IA de prueba.',
            confidence: 0.7,
            clinical_state: 'AI_PENDING_REVIEW',
            justification: [
              'FEV1/FVC ratio bajo respecto a la referencia.',
              'Tres maniobras aceptables con criterios ATS/ERS cumplidos.',
            ],
            clinical_basis: [],
            citations: [
              {
                source_id: 'ATS-ERS-2022',
                title: 'ATS/ERS 2022 — Standardization of Spirometry',
                section: 'Quality criteria',
              },
            ],
            limitations: [
              'Documento sin sello ni firma del médico responsable.',
            ],
            red_flags: [],
            recommendation: null,
            non_conclusive_reason: null,
            calibration_source: 'medical_calibration',
            clinical_model_used: 'medgemma-1.5',
            clinical_provider: 'gemini',
          },
          doctorReviews: [],
        },
        reviewerUserId: 'doc-1',
        eventId: 'evt-1',
      })
    )

    // Cabecera y guardrail presentes (contrato IA intacto)
    expect(html).toContain('Prediagnóstico IA')
    expect(html).toContain('Modo sombra clínica')

    // Resumen IA y confianza siguen presentes
    expect(html).toContain('Sugerencia IA de prueba.')

    // FND-20260825-13: ningún `<details open>` debe quedar en el HTML
    // de estas tres secciones — todas inician colapsadas.
    const openDetailsMatches = html.match(/<details[^>]*\sopen\b/g) ?? []
    expect(openDetailsMatches.length).toBe(0)

    // Texto sigue presente en el DOM aunque esté colapsado (accesible al
    // expandir). El navegador lo muestra al pulsar el `<summary>`.
    expect(html).toContain('FEV1/FVC ratio bajo respecto a la referencia.')
    expect(html).toContain('Documento sin sello ni firma del médico responsable.')
    expect(html).toContain('ATS/ERS 2022 — Standardization of Spirometry')

    // El `<summary>` queda como trigger accesible por teclado y screen reader.
    expect(html).toContain('Limitaciones (1)')
    expect(html).toContain('Justificación (2 razones)')
    expect(html).toContain('Fuentes clínicas (1)')

    // data-testid intactos para V3 / Playwright / auditorías de regresión.
    expect(html).toContain('data-testid="prediagnosis-section-limitaciones"')
    expect(html).toContain('data-testid="prediagnosis-section-justificacion"')
    expect(html).toContain('data-testid="prediagnosis-section-fuentes"')
  })

  it('Mantiene guardrail "Modo sombra clínica" y no convierte secciones en diagnóstico final', () => {
    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, {
        prediagnosisSnapshotId: 'snap-1',
        snapshot: {
          ...SNAPSHOT_BASE,
          prediagnosisData: {
            summary: 'X',
            confidence: 0.5,
            clinical_state: 'AI_PENDING_REVIEW',
            justification: ['razón A', 'razón B'],
            clinical_basis: [],
            citations: [],
            limitations: ['limit 1'],
            red_flags: [],
            recommendation: null,
            non_conclusive_reason: null,
            calibration_source: 'medical_calibration',
            clinical_model_used: 'medgemma-1.5',
            clinical_provider: 'gemini',
          },
          doctorReviews: [],
        },
        reviewerUserId: 'doc-1',
        eventId: 'evt-1',
      })
    )

    expect(html).toContain(
      'Este análisis es apoyo a la decisión. No autoriza diagnóstico final, dictamen ni aptitud laboral.'
    )
    expect(html).toContain('El médico debe revisar y validar.')
  })

  it('Sin contenido en justification/limitations/citations: no se renderizan <details> vacíos', () => {
    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, {
        prediagnosisSnapshotId: 'snap-1',
        snapshot: {
          ...SNAPSHOT_BASE,
          prediagnosisData: {
            summary: 'X',
            confidence: 0.5,
            clinical_state: 'AI_PENDING_REVIEW',
            justification: [],
            clinical_basis: [],
            citations: [],
            limitations: [],
            red_flags: [],
            recommendation: null,
            non_conclusive_reason: null,
            calibration_source: 'medical_calibration',
            clinical_model_used: 'medgemma-1.5',
            clinical_provider: 'gemini',
          },
          doctorReviews: [],
        },
        reviewerUserId: 'doc-1',
        eventId: 'evt-1',
      })
    )

    // El panel principal se renderiza, pero ninguna sección details debe existir
    expect(html).toContain('Prediagnóstico IA')
    const openDetailsMatches = html.match(/<details[^>]*\sopen\b/g) ?? []
    expect(openDetailsMatches.length).toBe(0)
    // Etiquetas de las secciones NO aparecen si no hay datos
    expect(html).not.toContain('Justificación (')
    expect(html).not.toContain('Limitaciones (')
    expect(html).not.toContain('Fuentes clínicas (')
  })
})