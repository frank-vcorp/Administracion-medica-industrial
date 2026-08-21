/**
 * Tests del contrato Fase 5 — Snapshot versionado histórico en
 * ClinicalExtractionRenderer + helper `getPublishedVersionForSnapshot` +
 * extractor de hashes del audit del backend.
 *
 * SPEC ARCH-20260820-01 v1.1 §10 (Snapshot/versionado), §14 Fase 5
 * (AC-5.1 / AC-5.2 / AC-5.3), §7.4 (no romper pre-V5).
 *
 * Cobertura:
 *  - AC-5.1 (espejo): `getPublishedVersionForSnapshot` + `extractSnapshotVersioningFromBackendAudit`
 *    devuelven los campos congelados cuando el backend expone hashes en el audit.
 *  - AC-5.2: un snapshot pre-V5 (todos los campos congelados = null) no rompe
 *    el renderer y expone `calibration_version_mismatch=true` en el payload.
 *  - AC-5.3: dos renders del ClinicalExtractionRenderer con el mismo set de
 *    datos congelados producen idéntico HTML estructuralmente, aún cuando
 *    cambien los prompt/schema vigentes (frozen gana por contrato §10.1).
 *  - CB-08/CB-18: el frozen snapshot NO se re-renderiza cuando la
 *    calibración vigente cambia.
 *
 * Implementación:
 *  - SSR puro con `renderToStaticMarkup` (sin DOM environment). Consistente
 *    con `ExamenMedicoEstudio.test.ts` y evita acoplar a `jsdom`.
 *  - Extensión `.ts` (no `.tsx`): mantener el patrón del proyecto para no
 *    activar otros tests del suite que requieren DOM.
 *
 * @id ARCH-20260820-01 Fase 5
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import ClinicalExtractionRenderer from '../ClinicalExtractionRenderer'
// FIX-20260820-01-VERCEL-BUILD: helper síncrono vive ahora en el módulo
// compartido; getPublishedVersionForSnapshot se mantiene en el actions file.
import { getPublishedVersionForSnapshot } from '@/actions/calibration-v3.actions'
import { extractSnapshotVersioningFromBackendAudit } from '@/lib/calibration-v3-shared'
import { createHash } from 'node:crypto'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FAKE_EXTRACTED = {
  oido_derecho: { '500': 15, '1000': 20, '2000': 25 },
  oido_izquierdo: { '500': 10, '1000': 15, '2000': 20 },
  completitud_documental: 'suficiente',
  resumen_clinico: 'Compatible con audición dentro de límites normales.',
  resumen_clinico_alt: 'Texto de la versión alternativa re-publicada.',
}

const FAKE_FROZEN_SCHEMA = {
  studyType: 'Audiometria',
  sections: [
    {
      kind: 'keyValue',
      title: 'Umbrales OD',
      fields: ['500', '1000'],
      sourceKey: 'oido_derecho',
    },
    {
      kind: 'note',
      title: 'Resumen Clínico',
      source: 'resumen_clinico',
    },
  ],
}

const FAKE_DIFFERENT_SCHEMA = {
  studyType: 'Audiometria',
  sections: [
    {
      kind: 'note',
      title: 'Nota alternativa',
      source: 'resumen_clinico_alt',
    },
  ],
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

// ---------------------------------------------------------------------------
// AC-5.1 (espejo frontend): extractSnapshotVersioningFromBackendAudit
// ---------------------------------------------------------------------------

describe('ARCH-20260820-01 Fase 5 — extractSnapshotVersioningFromBackendAudit', () => {
  it('AC-5.1: prioriza los hashes emitidos por el backend sobre el cálculo local', () => {
    const backendAudit = {
      extraction_prompt_hash: 'sha256:backendhashedvalue',
      clinical_prompt_hash: 'sha256:clinbackendvalue',
      clinical_criteria_hash: 'sha256:criteriabackendvalue',
      presentation_schema_snapshot: { sections: [{ kind: 'note' }] },
      calibration_version_id: 'cal-v3-backend',
      calibration_version_number: 7,
    }
    const publishedVersion = {
      versionId: 'cal-v3-published',
      versionNumber: 5,
      presentationSchemaSnapshot: FAKE_FROZEN_SCHEMA,
      extractionPrompt: 'texto prompt local',
      clinicalPrompt: 'texto clínico local',
      clinicalCriteria: { prompt: 'local criteria', requiredParams: ['a'] },
    }

    const versioning = extractSnapshotVersioningFromBackendAudit({
      backendAudit,
      publishedVersion,
    })

    expect(versioning.extractionPromptHash).toBe('sha256:backendhashedvalue')
    expect(versioning.clinicalPromptHash).toBe('sha256:clinbackendvalue')
    expect(versioning.clinicalCriteriaHash).toBe('sha256:criteriabackendvalue')
    expect(versioning.calibrationVersionId).toBe('cal-v3-backend')
    expect(versioning.calibrationVersionNumber).toBe(7)
    expect(versioning.presentationSchemaSnapshot).toEqual({ sections: [{ kind: 'note' }] })
  })

  it('AC-5.1: fallback calcula sha256 local cuando el backend no expone hashes', () => {
    const publishedVersion = {
      versionId: 'cal-v3-pub-1',
      versionNumber: 1,
      presentationSchemaSnapshot: FAKE_FROZEN_SCHEMA,
      extractionPrompt: 'PROMPT DE EXTRACCIÓN ÚNICO',
      clinicalPrompt: 'PROMPT CLÍNICO',
      clinicalCriteria: {
        prompt: 'PROMPT CLÍNICO',
        requiredParams: ['oido_derecho'],
        confidenceThreshold: 0.55,
      },
    }

    const versioning = extractSnapshotVersioningFromBackendAudit({
      backendAudit: {},
      publishedVersion,
    })

    expect(versioning.calibrationVersionId).toBe('cal-v3-pub-1')
    expect(versioning.calibrationVersionNumber).toBe(1)
    expect(versioning.extractionPromptHash).toBe(
      `sha256:${sha256Hex('PROMPT DE EXTRACCIÓN ÚNICO')}`,
    )
    expect(versioning.clinicalPromptHash).toBe(
      `sha256:${sha256Hex('PROMPT CLÍNICO')}`,
    )
    expect(versioning.clinicalCriteriaHash).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(versioning.presentationSchemaSnapshot).toEqual(FAKE_FROZEN_SCHEMA)
  })

  it('AC-5.1: pre-V5 / sin publishedVersion ni audit devuelve todos los campos null', () => {
    const versioning = extractSnapshotVersioningFromBackendAudit({
      backendAudit: null,
      publishedVersion: null,
    })

    expect(versioning).toEqual({
      calibrationVersionId: null,
      calibrationVersionNumber: null,
      presentationSchemaSnapshot: null,
      extractionPromptHash: null,
      clinicalPromptHash: null,
      clinicalCriteriaHash: null,
    })
  })
})

// ---------------------------------------------------------------------------
// AC-5.2 + AC-5.3: Render del ClinicalExtractionRenderer con/sin frozen
// ---------------------------------------------------------------------------

describe('ARCH-20260820-01 Fase 5 — ClinicalExtractionRenderer con snapshot congelado', () => {
  it('AC-5.2: snapshot pre-V5 (frozen=null) no rompe el render y renderiza con schema vigente o fallback', () => {
    // Pre-V5: sin frozenPresentationSchema. Esperamos que el componente NO
    // lance excepciones y devuelva HTML estructuralmente válido (cae al
    // fallback legacy `getStudySchema("Audiometria")`).
    const html = renderToStaticMarkup(
      createElement(ClinicalExtractionRenderer, {
        extractedData: FAKE_EXTRACTED,
        missingFields: null,
        version: 1,
        studyType: 'Audiometria',
        presentationSchema: null,
        frozenPresentationSchema: null,
        calibrationVersionMismatch: true,
      }),
    )

    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(0)
    // El render produce algo: contenedor principal y la etiqueta de estudio.
    expect(html).toContain('Extracción clínica')
    expect(html).toContain('Audiometria')
  })

  it('AC-5.3: dos renders con el mismo frozenPresentationSchema producen idéntico HTML', () => {
    // AC-5.3: tras re-publicar una versión, el histórico congelado debe
    // renderizar idéntico. Aquí validamos la simetría: con el mismo
    // `frozenPresentationSchema`, dos renders (uno con `presentationSchema`
    // vigente "perturbado") son estructuralmente iguales.
    const renderOnce = (varyingVigenteSchema: unknown) =>
      renderToStaticMarkup(
        createElement(ClinicalExtractionRenderer, {
          extractedData: FAKE_EXTRACTED,
          missingFields: null,
          version: 1,
          studyType: 'Audiometria',
          presentationSchema: varyingVigenteSchema as any,
          frozenPresentationSchema: FAKE_FROZEN_SCHEMA,
        }),
      )

    const htmlVigenteA = renderOnce(FAKE_FROZEN_SCHEMA)
    const htmlVigenteB = renderOnce(FAKE_DIFFERENT_SCHEMA)
    expect(htmlVigenteA).toBe(htmlVigenteB)
    expect(htmlVigenteA).toContain('Umbrales OD')
    expect(htmlVigenteA).toContain('Resumen Clínico')
    // El schema "perturbado" NO debe filtrarse al render.
    expect(htmlVigenteA).not.toContain('Nota alternativa')
  })

  it('AC-5.3 (negativo): si frozenPresentationSchema cambia, el render cambia', () => {
    // El negativo: confirma que congelar realmente importa. Si dos snapshots
    // tienen distintas versiones congeladas, el render es distinto.
    const htmlFrozenV1 = renderToStaticMarkup(
      createElement(ClinicalExtractionRenderer, {
        extractedData: FAKE_EXTRACTED,
        missingFields: null,
        version: 1,
        studyType: 'Audiometria',
        frozenPresentationSchema: FAKE_FROZEN_SCHEMA,
      }),
    )
    const htmlFrozenV2 = renderToStaticMarkup(
      createElement(ClinicalExtractionRenderer, {
        extractedData: FAKE_EXTRACTED,
        missingFields: null,
        version: 1,
        studyType: 'Audiometria',
        frozenPresentationSchema: FAKE_DIFFERENT_SCHEMA,
      }),
    )
    expect(htmlFrozenV1).not.toBe(htmlFrozenV2)
    expect(htmlFrozenV1).toContain('Umbrales OD')
    expect(htmlFrozenV2).toContain('Nota alternativa')
  })

  it('AC-5.3 con `studyType=Audiometria` y frozen con `keyValue` rows: renderiza la sección clínica', () => {
    // El renderer debe propagar el schema frozen a sus secciones internas.
    const html = renderToStaticMarkup(
      createElement(ClinicalExtractionRenderer, {
        extractedData: FAKE_EXTRACTED,
        missingFields: null,
        version: 1,
        studyType: 'Audiometria',
        frozenPresentationSchema: FAKE_FROZEN_SCHEMA,
      }),
    )
    expect(html).toContain('Umbrales OD')
    expect(html).toContain('500')
    expect(html).toContain('15')
  })

  it('CB-08 (pre-V5 + schema vigente): cae al fallback sin lanzar excepciones', () => {
    // El snapshot pre-V5 (frozen=null) delega al schema vigente del catálogo
    // (que también es null en este test) y finalmente al fallback legacy
    // `getStudySchema(studyType)`. Verificamos que el render sigue produciendo
    // HTML válido sin throw.
    expect(() =>
      renderToStaticMarkup(
        createElement(ClinicalExtractionRenderer, {
          extractedData: FAKE_EXTRACTED,
          missingFields: null,
          version: 1,
          studyType: 'Audiometria',
          presentationSchema: null,
          frozenPresentationSchema: null,
          calibrationVersionMismatch: true,
        }),
      ),
    ).not.toThrow()
  })
})
