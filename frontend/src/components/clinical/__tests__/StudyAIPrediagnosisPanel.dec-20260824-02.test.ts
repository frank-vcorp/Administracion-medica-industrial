/**
 * Tests focales (V1) para StudyAIPrediagnosisPanel — DEC-20260824-02
 * (IMPL-20260824-06): orden clínico del prediagnóstico IA.
 *
 * Cubre:
 *   - AC-DEC-02-1: la sección visible del resumen se llama "Hallazgo sugerido"
 *     (renombre visual, no de contrato — el campo `summary` sigue siendo el
 *     mismo).
 *   - AC-DEC-02-2: existe una sección "Recomendaciones sugeridas" ANTES de
 *     la confianza. Soporta `recommendation` singular, `recommendations` array
 *     y `recommended_actions` array. Si el snapshot no trae ninguno, la
 *     sección se OMITE (no se inventa contenido en frontend).
 *   - AC-DEC-02-3: las tres secciones de evidencia (Justificación, Limitaciones,
 *     Fuentes clínicas) siguen iniciando con `details open`.
 *   - AC-DEC-02-4: el orden DOM final del panel clínico es
 *       Hallazgo sugerido → Recomendaciones sugeridas → Confianza →
 *       Limitaciones → Justificación → Fuentes clínicas
 *     (sin contar cabeceras, guardrail, ni alertas clínicas).
 *   - AC-DEC-02-5: modo sombra clínica y alerta de revisión médica se
 *     preservan intactos (no se mezclan con la impresión del médico).
 *
 * Implementación: SSR puro con `renderToStaticMarkup` (sin DOM environment).
 * Consistente con `ClinicalExtractionRenderer.fase5.test.ts` y con
 * `StudyAIPrediagnosisPanel.open-details.test.ts`.
 *
 * @id IMPL-20260824-06
 * @backup discovery/DECISIONS.md (DEC-20260824-02) + SPEC
 *          context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
 *          (mismo SPEC activa — corrección IMPLEMENTATION_DEFECT).
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

function buildSnapshot(prediagnosisData: Record<string, unknown>) {
  return {
    ...SNAPSHOT_BASE,
    prediagnosisData,
    doctorReviews: [],
  }
}

function baseProps(prediagnosisData: Record<string, unknown>) {
  return {
    prediagnosisSnapshotId: 'snap-1',
    snapshot: buildSnapshot(prediagnosisData),
    reviewerUserId: 'doc-1',
    eventId: 'evt-1',
  }
}

const FULL_PREDIAGNOSIS = {
  summary: 'Patrón compatible con obstrucción leve. Repetibilidad AMI dentro de criterio.',
  confidence: 0.72,
  clinical_state: 'AI_PENDING_REVIEW',
  justification: [
    'FEV1/FVC 0.66 (LLN 0.72) — debajo del límite inferior.',
    'FEV1 78% del predicho — obstrucción leve.',
  ],
  clinical_basis: [],
  citations: [
    {
      source_id: 'ATS-ERS-2022',
      title: 'ATS/ERS 2022 — Standardization of Spirometry',
      section: 'Tabla 1',
    },
  ],
  limitations: [
    'Sin valores LLN específicos por etnia/edad/sexo.',
  ],
  red_flags: [],
  // Contrato vigente: `recommendation` singular contextualizado.
  recommendation:
    'Correlacionar con espirometría previa, considerar prueba broncodilatadora y reforzar EPP respiratorio si hay exposición a polvos.',
  non_conclusive_reason: null,
  calibration_source: 'medical_calibration',
  clinical_model_used: 'medgemma-4b-it',
  clinical_provider: 'featherless',
}

function indexOfSection(html: string, marker: string): number {
  return html.indexOf(marker)
}

describe('StudyAIPrediagnosisPanel — DEC-20260824-02 / IMPL-20260824-06', () => {
  it('AC-DEC-02-1: la sección del resumen se llama "Hallazgo sugerido" (no "Sugerencia IA")', () => {
    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, baseProps(FULL_PREDIAGNOSIS))
    )
    // El resumen sigue presente (es texto del snapshot).
    expect(html).toContain(FULL_PREDIAGNOSIS.summary)
    // Renombre visual aplicado.
    expect(html).toContain('Hallazgo sugerido')
    // La etiqueta vieja NO debe aparecer como encabezado.
    expect(html).not.toContain('>Sugerencia IA<')
  })

  it('AC-DEC-02-2: existe sección "Recomendaciones sugeridas" cuando hay `recommendation` singular', () => {
    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, baseProps(FULL_PREDIAGNOSIS))
    )
    expect(html).toContain('Recomendaciones sugeridas (1)')
    expect(html).toContain(FULL_PREDIAGNOSIS.recommendation)
    // La sección se renderiza en su bloque distinguible.
    expect(html).toContain('data-testid="prediagnosis-section-recomendaciones"')
    // Subtítulo de apoyo a la decisión, no prescriptivo.
    expect(html).toContain(
      'Sugerencias de apoyo a la decisión; no sustituyen indicación médica, diagnóstico definitivo ni dictamen de aptitud.'
    )
  })

  it('AC-DEC-02-2 (array): acepta `recommendations: string[]` cuando el snapshot lo aporta', () => {
    const html = renderToStaticMarkup(
      createElement(
        StudyAIPrediagnosisPanel,
        baseProps({
          ...FULL_PREDIAGNOSIS,
          recommendation: null,
          recommendations: [
            'Correlacionar con espirometría previa.',
            'Considerar prueba broncodilatadora.',
            'Reforzar EPP respiratorio si hay exposición ocupacional.',
          ],
        })
      )
    )
    expect(html).toContain('Recomendaciones sugeridas (3)')
    expect(html).toContain('Correlacionar con espirometría previa.')
    expect(html).toContain('Considerar prueba broncodilatadora.')
    expect(html).toContain(
      'Reforzar EPP respiratorio si hay exposición ocupacional.'
    )
  })

  it('AC-DEC-02-2 (alias): acepta `recommended_actions` como alias compatible', () => {
    const html = renderToStaticMarkup(
      createElement(
        StudyAIPrediagnosisPanel,
        baseProps({
          ...FULL_PREDIAGNOSIS,
          recommendation: null,
          recommendations: null,
          recommended_actions: ['Acción A ocupacional.', 'Acción B ocupacional.'],
        })
      )
    )
    expect(html).toContain('Recomendaciones sugeridas (2)')
    expect(html).toContain('Acción A ocupacional.')
    expect(html).toContain('Acción B ocupacional.')
  })

  it('AC-DEC-02-2 (orden/anti-ocultación): `recommendation` singular NO se oculta por alias `recommendations: []` vacío', () => {
    // DEC-20260824-02: "no ocultes el contenido por un alias".
    // Si el snapshot trae `recommendation` válido Y `recommendations: []`
    // (array vacío como alias), el singular DEBE ganar. Antes del fix esto
    // podía renderizar "Recomendaciones sugeridas (0)".
    const html = renderToStaticMarkup(
      createElement(
        StudyAIPrediagnosisPanel,
        baseProps({
          ...FULL_PREDIAGNOSIS,
          recommendations: [],
          recommended_actions: [],
          recommendation: 'Correlacionar con espirometría previa.',
        })
      )
    )
    expect(html).toContain('Recomendaciones sugeridas (1)')
    expect(html).toContain('Correlacionar con espirometría previa.')
    expect(html).not.toContain('Recomendaciones sugeridas (0)')
  })

  it('AC-DEC-02-2 (orden/anti-ocultación 2): `recommendation` singular gana sobre alias con strings vacíos', () => {
    // Si `recommendations: ["", "  "]` y `recommendation: "X"` → debe ganar singular.
    const html = renderToStaticMarkup(
      createElement(
        StudyAIPrediagnosisPanel,
        baseProps({
          ...FULL_PREDIAGNOSIS,
          recommendations: ['', '   ', ''],
          recommendation: 'Repetir el estudio con técnica adecuada.',
        })
      )
    )
    expect(html).toContain('Recomendaciones sugeridas (1)')
    expect(html).toContain('Repetir el estudio con técnica adecuada.')
    expect(html).not.toContain('Recomendaciones sugeridas (3)')
  })

  it('AC-DEC-02-2 (vacío): si el snapshot no trae ninguna recomendación, la sección se OMITE', () => {
    const html = renderToStaticMarkup(
      createElement(
        StudyAIPrediagnosisPanel,
        baseProps({
          ...FULL_PREDIAGNOSIS,
          recommendation: null,
          recommendations: null,
          recommended_actions: null,
        })
      )
    )
    expect(html).not.toContain('Recomendaciones sugeridas')
    expect(html).not.toContain('data-testid="prediagnosis-section-recomendaciones"')
  })

  it('AC-DEC-02-2 (snapshot viejo): snapshot pre-DEC-20260824-02 sin recommendation → sección omitida, no se inventa', () => {
    // Documenta la regla: snapshots viejos sin `recommendation` requieren
    // REPROCESO del Event. El frontend NO infiere desde `summary` ni desde
    // otra sección. La sección se omite silenciosamente.
    const OLD_SNAPSHOT = {
      summary: 'Sugerencia IA de prueba (snapshot viejo sin recommendation).',
      confidence: 0.5,
      clinical_state: 'AI_PENDING_REVIEW',
      justification: ['Razón histórica 1', 'Razón histórica 2'],
      clinical_basis: [],
      citations: [],
      limitations: ['Limitación histórica.'],
      red_flags: [],
      recommendation: null,
      // Alias ausentes o nulos — no deben inventar contenido.
      recommendations: null,
      recommended_actions: null,
      non_conclusive_reason: null,
      calibration_source: 'medical_calibration',
      clinical_model_used: 'medgemma-1.5',
      clinical_provider: 'gemini',
    }

    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, baseProps(OLD_SNAPSHOT))
    )

    // El panel sigue mostrando todo lo demás (modo sombra, etc.).
    expect(html).toContain('Prediagnóstico IA')
    expect(html).toContain('Hallazgo sugerido')
    expect(html).toContain('Modo sombra clínica')
    // Pero la sección de recomendaciones NO aparece — no se inventa.
    expect(html).not.toContain('Recomendaciones sugeridas')
    expect(html).not.toContain('data-testid="prediagnosis-section-recomendaciones"')
    // El resto del panel (orden clínico) sigue intacto.
    expect(html).toContain('data-testid="prediagnosis-section-hallazgo"')
    expect(html).toContain('data-testid="prediagnosis-section-confianza"')
  })

  it('AC-DEC-02-2 (string vacío): strings vacíos o whitespace se ignoran, no se renderiza la sección', () => {
    const html = renderToStaticMarkup(
      createElement(
        StudyAIPrediagnosisPanel,
        baseProps({
          ...FULL_PREDIAGNOSIS,
          recommendation: '   ',
          recommendations: [],
        })
      )
    )
    expect(html).not.toContain('Recomendaciones sugeridas')
  })

  it('AC-DEC-02-3: Justificación, Limitaciones y Fuentes clínicas inician con `details open`', () => {
    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, baseProps(FULL_PREDIAGNOSIS))
    )
    const openDetailsMatches = html.match(/<details[^>]*\sopen\b/g) ?? []
    expect(openDetailsMatches.length).toBeGreaterThanOrEqual(3)
    // Testids presentes en cada sección.
    expect(html).toContain('data-testid="prediagnosis-section-limitaciones"')
    expect(html).toContain('data-testid="prediagnosis-section-justificacion"')
    expect(html).toContain('data-testid="prediagnosis-section-fuentes"')
  })

  it('AC-DEC-02-4: orden DOM final = Hallazgo → Recomendaciones → Confianza → Limitaciones → Justificación → Fuentes', () => {
    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, baseProps(FULL_PREDIAGNOSIS))
    )

    const idxHallazgo = indexOfSection(html, 'data-testid="prediagnosis-section-hallazgo"')
    const idxRecomendaciones = indexOfSection(
      html,
      'data-testid="prediagnosis-section-recomendaciones"'
    )
    const idxConfianza = indexOfSection(html, 'data-testid="prediagnosis-section-confianza"')
    const idxLimitaciones = indexOfSection(
      html,
      'data-testid="prediagnosis-section-limitaciones"'
    )
    const idxJustificacion = indexOfSection(
      html,
      'data-testid="prediagnosis-section-justificacion"'
    )
    const idxFuentes = indexOfSection(html, 'data-testid="prediagnosis-section-fuentes"')

    // Todas presentes
    expect(idxHallazgo).toBeGreaterThanOrEqual(0)
    expect(idxRecomendaciones).toBeGreaterThanOrEqual(0)
    expect(idxConfianza).toBeGreaterThanOrEqual(0)
    expect(idxLimitaciones).toBeGreaterThanOrEqual(0)
    expect(idxJustificacion).toBeGreaterThanOrEqual(0)
    expect(idxFuentes).toBeGreaterThanOrEqual(0)

    // Y en el orden clínico exigido por DEC-20260824-02
    expect(idxHallazgo).toBeLessThan(idxRecomendaciones)
    expect(idxRecomendaciones).toBeLessThan(idxConfianza)
    expect(idxConfianza).toBeLessThan(idxLimitaciones)
    expect(idxLimitaciones).toBeLessThan(idxJustificacion)
    expect(idxJustificacion).toBeLessThan(idxFuentes)
  })

  it('AC-DEC-02-4 (sin recomendación): el orden clínico se mantiene aunque la sección de recomendaciones se omita', () => {
    const html = renderToStaticMarkup(
      createElement(
        StudyAIPrediagnosisPanel,
        baseProps({
          ...FULL_PREDIAGNOSIS,
          recommendation: null,
          recommendations: null,
          recommended_actions: null,
        })
      )
    )
    const idxHallazgo = indexOfSection(html, 'data-testid="prediagnosis-section-hallazgo"')
    const idxConfianza = indexOfSection(html, 'data-testid="prediagnosis-section-confianza"')
    const idxLimitaciones = indexOfSection(
      html,
      'data-testid="prediagnosis-section-limitaciones"'
    )
    const idxJustificacion = indexOfSection(
      html,
      'data-testid="prediagnosis-section-justificacion"'
    )
    const idxFuentes = indexOfSection(html, 'data-testid="prediagnosis-section-fuentes"')

    expect(idxRecomendaciones_in_html(html)).toBe(-1)
    expect(idxHallazgo).toBeLessThan(idxConfianza)
    expect(idxConfianza).toBeLessThan(idxLimitaciones)
    expect(idxLimitaciones).toBeLessThan(idxJustificacion)
    expect(idxJustificacion).toBeLessThan(idxFuentes)
  })

  it('AC-DEC-02-5: preserva guardrail "Modo sombra clínica" y alerta de revisión médica', () => {
    const html = renderToStaticMarkup(
      createElement(StudyAIPrediagnosisPanel, baseProps(FULL_PREDIAGNOSIS))
    )
    expect(html).toContain('Modo sombra clínica')
    expect(html).toContain(
      'Este análisis es apoyo a la decisión. No autoriza diagnóstico final, dictamen ni aptitud laboral.'
    )
    expect(html).toContain('El médico debe revisar y validar.')
    // Cabecera de prediagnóstico preservada
    expect(html).toContain('Prediagnóstico IA')
  })

  it('AC-DEC-02-5: la sección de revisión médica del médico NO se mezcla con la IA', () => {
    const html = renderToStaticMarkup(
      createElement(
        StudyAIPrediagnosisPanel,
        {
          ...baseProps(FULL_PREDIAGNOSIS),
          existingReview: {
            id: 'rev-1',
            doctorStatus: 'REVIEWED_EDITED',
            doctorDiagnosis: 'Diagnóstico médico real escrito por el doctor.',
            doctorNotes: 'Nota médica.',
            createdAt: new Date('2026-08-24T00:00:00Z'),
          },
        }
      )
    )
    // La recomendación IA es la IA, no el diagnóstico médico.
    expect(html).toContain(FULL_PREDIAGNOSIS.recommendation)
    expect(html).toContain('Diagnóstico médico real escrito por el doctor.')
    expect(html).toContain('Revisión médica registrada')
    expect(html).toContain('EDITED')
  })
})

// Helper para verificar ausencia/presencia de la sección de recomendaciones.
// Devuelve -1 si NO aparece.
function idxRecomendaciones_in_html(html: string): number {
  return html.indexOf('data-testid="prediagnosis-section-recomendaciones"')
}