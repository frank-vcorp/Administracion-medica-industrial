/**
 * @file Tests focales (V1) para el modal del cuestionario de Espirometría
 *   (FEATURE-20260824-02) — render SSR puro con `renderToStaticMarkup`.
 *
 * Cubre:
 *   - AC-1: el modal muestra todas las secciones (Sí/No para cada
 *     antecedente, exploración física, observaciones).
 *   - AC-2: campos condicionales NO aparecen mientras la respuesta padre
 *     no es Sí.
 *   - AC-3: el botón distingue entre "Guardar cuestionario" (nuevo) y
 *     "Guardar cambios" (edición).
 *
 * @id IMPL-FEATURE-20260824-02
 * @backup context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md
 */

import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import EspirometriaQuestionnaireModal from '../EspirometriaQuestionnaireModal'
import { ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION } from '@/schemas/clinical/espirometria-questionnaire.schema'

const NOOP = () => undefined

const NO_CONTEXT = null

const EDIT_CONTEXT = {
  schemaVersion: ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION,
  capturedAt: '2026-08-24T10:00:00.000Z',
  antecedentes: {
    espirometria_previa: 'SI' as const,
    espirometria_previa_rango: 'MAS_5_ANIOS' as const,
    fuma_o_fumo: 'NO' as const,
    embarazo: 'NO_APLICA' as const,
  },
  exploracionFisica: {
    vias_respiratorias_superiores: { estado: 'NORMAL' as const },
    torax: { estado: 'ALTERADO' as const, observacion: 'sibilancias' },
    pulmones: { estado: 'NORMAL' as const },
  },
}

describe('EspirometriaQuestionnaireModal — render', () => {
  it('AC-1: renderiza todas las secciones y el botón "Guardar cuestionario" cuando no hay contexto', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: NO_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    expect(html).toContain('Cuestionario de Espirometría')
    expect(html).toContain('data-testid="espirometria-questionnaire-modal"')
    // Secciones de antecedentes (al menos una palabra clave por bloque).
    expect(html).toContain('Espirometría previa')
    expect(html).toContain('Dificultad para respirar')
    expect(html).toContain('humos, vapores')
    expect(html).toContain('Fuma o fumó')
    expect(html).toContain('cardiaca/pulmonar')
    expect(html).toContain('Embarazo')
    expect(html).toContain('inhalador')
    expect(html).toContain('últimos tres meses')
    // Exploración física.
    expect(html).toContain('Vías respiratorias superiores')
    expect(html).toContain('Tórax')
    expect(html).toContain('Pulmones')
    // Botón guardar (modo nuevo).
    expect(html).toContain('Guardar cuestionario')
    expect(html).toContain('data-testid="espirometria-questionnaire-save"')
  })

  it('AC-1: el botón cambia a "Guardar cambios" en modo edición', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: EDIT_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    expect(html).toContain('Editar cuestionario de Espirometría')
    expect(html).toContain('Guardar cambios')
  })

  it('AC-2: muestra el campo condicional de rango cuando espirometria_previa=SI', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: EDIT_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    // El campo "espirometria-previa-rango" sólo se renderiza cuando hay un Sí previo.
    expect(html).toContain('data-testid="espirometria-previa-rango"')
    // Y debe venir preseleccionado con el valor del contexto.
    expect(html).toMatch(/value="MAS_5_ANIOS"/)
  })

  it('AC-2: NO muestra sub-campos condicionales cuando la respuesta padre no es Sí', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: NO_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    // El campo "espirometria-previa-rango" sólo aparece si hay Sí previo.
    expect(html).not.toContain('data-testid="espirometria-previa-rango"')
    // El campo "exposicion-tipo" sólo aparece si exposición=Sí.
    expect(html).not.toContain('data-testid="exposicion-tipo-POLVOS"')
    // El campo "cigarrillos" sólo aparece si fuma=Sí.
    expect(html).not.toContain('data-testid="cigarrillos"')
  })

  it('AC-2: muestra el campo de observación en exploración cuando el estado es ALTERADO', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: EDIT_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    // El campo "exploracion-torax-observacion" sólo aparece cuando
    // torax.estado === 'ALTERADO'.
    expect(html).toContain('id="exploracion-torax-observacion"')
  })

  it('AC-UI: el botón Cancelar y el botón guardar están presentes y tienen data-testid', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: NO_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    expect(html).toContain('data-testid="espirometria-questionnaire-cancel"')
    expect(html).toContain('data-testid="espirometria-questionnaire-save"')
  })

  it('AC-UI: el modal tiene role="dialog" y aria-modal="true"', () => {
    const html = renderToStaticMarkup(
      createElement(EspirometriaQuestionnaireModal, {
        eventTestId: 'et-1',
        eventId: 'ev-1',
        initialContext: NO_CONTEXT,
        onClose: NOOP,
        onSaved: NOOP,
      }),
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
  })
})
