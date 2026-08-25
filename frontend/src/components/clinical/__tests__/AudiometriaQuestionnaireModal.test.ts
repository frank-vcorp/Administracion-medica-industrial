/**
 * @file Tests focales (V1) para el modal del cuestionario de Audiometría
 *   (FEATURE-20260825-02) — render SSR puro con `renderToStaticMarkup`.
 *
 * Cubre:
 *   - AC-1: el modal muestra todas las secciones de antecedentes auditivos,
 *     exploración física (faringe/CAD/CAI/MTD/MTI), metadatos y observaciones.
 *   - AC-2: campos condicionales NO aparecen mientras la respuesta padre
 *     no es Sí.
 *   - AC-3: el botón distingue entre "Guardar cuestionario" (nuevo) y
 *     "Guardar cambios" (edición).
 *
 * @id IMPL-FEATURE-20260825-02
 * @backup context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import AudiometriaQuestionnaireModal from '../AudiometriaQuestionnaireModal'
import { AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION } from '@/schemas/clinical/audiometria-questionnaire.schema'

const NOOP = () => undefined

const NO_CONTEXT = null

const EDIT_CONTEXT = {
  schemaVersion: AUDIOMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  capturedAt: '2026-08-25T14:00:00.000Z',
  consentimiento: 'SI' as const,
  antecedentes: {
    audiometria_previa: 'SI' as const,
    audiometria_previa_rango: 'MAS_5_ANIOS' as const,
    dificultad_auditiva: 'NO' as const,
  },
  exploracionFisica: {
    faringe: { estado: 'NORMAL' as const },
    cad: { estado: 'ALTERADO' as const, observacion: 'cerumen' },
    cai: { estado: 'NORMAL' as const },
    mtd: { estado: 'NORMAL' as const },
    mti: { estado: 'NORMAL' as const },
  },
}

describe('AudiometriaQuestionnaireModal — render', () => {
  it('AC-1: renderiza todas las secciones y el botón "Guardar cuestionario" cuando no hay contexto', () => {
    const html = renderToStaticMarkup(
      createElement(AudiometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: NO_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    expect(html).toContain('Cuestionario de Audiometría')
    expect(html).toContain('data-testid="audiometria-questionnaire-modal"')
    // Datos del formato.
    expect(html).toContain('Patient ID')
    expect(html).toContain('Consentimiento')
    expect(html).toContain('Responsable de captura')
    expect(html).toContain('Responsable médico')
    // Antecedentes.
    expect(html).toContain('Audiometría previa')
    expect(html).toContain('Dificultad auditiva')
    expect(html).toContain('Exposición a ruido laboral')
    expect(html).toContain('Exposición recreativa')
    expect(html).toContain('Explosión o trauma')
    expect(html).toContain('Infecciones')
    expect(html).toContain('Tinnitus')
    expect(html).toContain('Medicamentos ototóxicos')
    // Exploración física.
    expect(html).toContain('Faringe')
    expect(html).toContain('CAD')
    expect(html).toContain('CAI')
    expect(html).toContain('MTD')
    expect(html).toContain('MTI')
    // Botón guardar (modo nuevo).
    expect(html).toContain('Guardar cuestionario')
    expect(html).toContain('data-testid="audiometria-questionnaire-save"')
  })

  it('AC-1: el botón cambia a "Guardar cambios" en modo edición', () => {
    const html = renderToStaticMarkup(
      createElement(AudiometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: EDIT_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    expect(html).toContain('Editar cuestionario de Audiometría')
    expect(html).toContain('Guardar cambios')
  })

  it('AC-2: muestra el campo condicional de rango cuando audiometria_previa=SI', () => {
    const html = renderToStaticMarkup(
      createElement(AudiometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: EDIT_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    expect(html).toContain('data-testid="audiometria-previa-rango"')
    expect(html).toMatch(/value="MAS_5_ANIOS"/)
  })

  it('AC-2: NO muestra sub-campos condicionales cuando la respuesta padre no es Sí', () => {
    const html = renderToStaticMarkup(
      createElement(AudiometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: NO_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    // Sin respuestas Sí, ningún sub-campo condicional aparece.
    expect(html).not.toContain('data-testid="audiometria-previa-rango"')
    expect(html).not.toContain('data-testid="audiometria-expo-laboral-tipo-INDUSTRIAL"')
    expect(html).not.toContain('data-testid="audiometria-infecciones-tipo-OTITIS_MEDIA"')
  })

  it('AC-1: tiene role="dialog" y aria-modal para accesibilidad', () => {
    const html = renderToStaticMarkup(
      createElement(AudiometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: NO_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('data-testid="audiometria-questionnaire-cancel"')
  })
})