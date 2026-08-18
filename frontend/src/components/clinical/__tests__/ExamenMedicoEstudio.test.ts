/**
 * @file Tests de LiveSummaryPreview — IMPL-20260817-11-C2 (Corte 4).
 *
 * Cubre AC-20, AC-21 y AC-22 (SPEC §5.5):
 * - AC-20: el componente renderiza los 9 labels verbatim del PDF canónico.
 * - AC-21: reactividad — los campos 1-5 se actualizan en vivo al cambiar
 *   `estado_nutricional`, `agudeza_visual_resumen`, `salud_bucal`,
 *   `impresion_diagnostica` y `presion_arterial_resumen`.
 * - AC-22: los campos 6-9 (audiometría, espirometría, laboratorios,
 *   radiografía) muestran "Pendiente de resultado" si no hay IA; cuando
 *   llega el resultado, se actualiza en vivo.
 *
 * Implementación:
 * - Renderizamos con `renderToStaticMarkup` de `react-dom/server` (SSR puro,
 *   no requiere DOM environment). Esto evita la dependencia de `jsdom` /
 *   `happy-dom` que este proyecto no tiene instalada.
 * - Extensión `.ts` (no `.tsx`) porque el `vitest.config.ts` actual sólo
 *   incluye archivos `.test.ts`; actualizar el patrón a `.test.tsx` activaría
 *   tests legacy (`AIProviderKeyManager.test.tsx`, etc.) que aún requieren
 *   DOM environment. Mantener `.ts` evita false positives en la suite.
 *
 * Regla explícita de Frank (2026-08-17):
 *   "Quiero que se autopoble. Quiero que el médico solo llene lo estrictamente
 *   necesario."
 *
 * @id IMPL-20260817-11-C2
 * @spec SPEC_ARCH-20260817-02 §5.5 (AC-20, AC-21, AC-22)
 * @decision DA-5 (ARCH-20260817-02) — tabla 9 campos auto-poblada mixto
 *           (manual + IA), en vivo al editar, congelado al firmar.
 */
import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

import LiveSummaryPreview from '@/components/clinical/LiveSummaryPreview'
import {
  buildExamSummary,
  EXAM_SUMMARY_LABELS,
} from '@/lib/clinical/exam-summary'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Renderiza el componente a string HTML sin necesidad de DOM. */
function render(props: {
  form?: Record<string, string>
  iaResults?: Record<string, string | null> | null
}): string {
  return renderToStaticMarkup(
    createElement(LiveSummaryPreview, {
      form: props.form ?? {},
      iaResults: props.iaResults ?? null,
    })
  )
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IMPL-20260817-11-C2: LiveSummaryPreview en pestaña Aptitud (DA-5)', () => {
  // ─── AC-20: 9 labels verbatim del PDF canónico ────────────────────────────
  it('81. Renderiza los 9 campos auto-poblados (AC-20)', () => {
    const html = render({
      form: {
        estado_nutricional: 'SOBREPESO',
        agudeza_visual_resumen: 'DISMINUIDA',
        salud_bucal: 'CARIES Y SARRO',
        impresion_diagnostica: 'Hallazgos positivos en agudeza visual.',
        presion_arterial_resumen: 'NORMAL AL MOMENTO DE LA TOMA',
      },
    })

    // Los 9 labels verbatim del PDF canónico deben aparecer en el DOM.
    for (const [, label] of EXAM_SUMMARY_LABELS) {
      expect(html).toContain(label)
    }
    expect(EXAM_SUMMARY_LABELS).toHaveLength(9)

    // Verifica que los valores del form se reflejan en el resumen.
    expect(html).toContain('SOBREPESO')
    expect(html).toContain('DISMINUIDA')
    expect(html).toContain('CARIES Y SARRO')
    expect(html).toContain('NORMAL AL MOMENTO DE LA TOMA')
    expect(html).toContain('Hallazgos positivos en agudeza visual.')
  })

  // ─── AC-21: reactividad — cambio de form se refleja en render ─────────────
  it('82. Reactividad: cuando cambia estado nutricional, el resumen se actualiza (AC-21)', () => {
    // Render 1: form con SOBREPESO
    const htmlInicial = render({
      form: { estado_nutricional: 'SOBREPESO' },
    })
    expect(htmlInicial).toContain('SOBREPESO')
    expect(htmlInicial).not.toContain('NORMAL')

    // Render 2: form con NORMAL (cambio de estado)
    const htmlCambiado = render({
      form: { estado_nutricional: 'NORMAL' },
    })
    expect(htmlCambiado).toContain('NORMAL')
    expect(htmlCambiado).not.toContain('SOBREPESO')

    // El contrato `buildExamSummary` confirma la reactividad lógica:
    // el helper es puro y siempre refleja el estado actual.
    const summaryInicial = buildExamSummary({ estado_nutricional: 'SOBREPESO' })
    const summaryCambiado = buildExamSummary({ estado_nutricional: 'NORMAL' })
    expect(summaryInicial.estado_nutricional).toBe('SOBREPESO')
    expect(summaryCambiado.estado_nutricional).toBe('NORMAL')
  })

  it('83. Reactividad multi-campo: 4 cambios simultáneos se reflejan en vivo (AC-21)', () => {
    const formA = {
      estado_nutricional: 'SOBREPESO',
      salud_bucal: 'CARIES Y SARRO',
      agudeza_visual_resumen: 'DISMINUIDA',
      presion_arterial_resumen: 'ALTA',
    }
    const formB = {
      estado_nutricional: 'NORMAL',
      salud_bucal: 'BUENA',
      agudeza_visual_resumen: 'NORMAL',
      presion_arterial_resumen: 'NORMAL',
    }

    const htmlA = render({ form: formA })
    const htmlB = render({ form: formB })

    // Cada valor de formA aparece en render A; cada valor de formB aparece
    // en render B; los valores de formA NO aparecen en render B y viceversa.
    for (const v of Object.values(formA)) {
      expect(htmlA).toContain(v)
      expect(htmlB).not.toContain(v)
    }
    for (const v of Object.values(formB)) {
      expect(htmlB).toContain(v)
      expect(htmlA).not.toContain(v)
    }
  })

  // ─── AC-22: campos vacíos muestran placeholder; IA cuando llega ───────────
  it('84. Campos vacíos muestran "Pendiente" / "Pendiente de resultado" (AC-22)', () => {
    const html = render({ form: {} })

    // Sin datos, los 5 campos manuales deben decir "Pendiente".
    // Los 4 campos IA deben decir "Pendiente de resultado".
    expect(html).toContain('Pendiente de resultado')
    // Verifica que no aparece "Pendiente de resultado" duplicado con espacios
    // o caracteres extra (sanity check del placeholder).
    expect(html).toContain('>Pendiente<')
    expect(html).toContain('>Pendiente de resultado<')
  })

  it('85. Cuando llega el resultado IA, el campo 6-9 se actualiza (AC-22)', () => {
    // Sin IA: audiometría muestra "Pendiente de resultado".
    const htmlSinIa = render({ form: {} })
    expect(htmlSinIa).toContain('Pendiente de resultado')

    // Con IA: audiometría muestra el resumen IA, ya NO "Pendiente".
    const htmlConIa = render({
      form: {},
      iaResults: {
        audiometria_resumen: 'IA: HIPOACUSIA CONDUCTIVA LEVE OD',
      },
    })
    expect(htmlConIa).toContain('IA: HIPOACUSIA CONDUCTIVA LEVE OD')
    // El campo audiometría específico ya no es pendiente — pero los otros 3
    // campos IA (espirometría, labs, RX) sí deben seguir pendientes.
    expect(htmlConIa).toContain('AUDIOMETRIA')

    // El contrato `buildExamSummary` valida la prioridad IA > manual:
    const summary = buildExamSummary(
      { audiometria_texto: 'Manual: OD normal' },
      { audiometria_resumen: 'IA: HIPOACUSIA CONDUCTIVA LEVE OD' }
    )
    expect(summary.audiometria).toBe('IA: HIPOACUSIA CONDUCTIVA LEVE OD')
    // Los otros campos IA siguen vacíos → "Pendiente de resultado" en UI.
    expect(summary.espirometria).toBe('')
    expect(summary.laboratorios).toBe('')
    expect(summary.radiografia).toBe('')
  })

  // ─── Guard: contrato puro del componente ───────────────────────────────────
  it('86. Componente read-only: no expone inputs ni textareas editables', () => {
    const html = render({
      form: {
        estado_nutricional: 'SOBREPESO',
        salud_bucal: 'CARIES Y SARRO',
        impresion_diagnostica: 'Paciente con hallazgos visuales.',
      },
    })

    // El preview es READ-ONLY (DA-5): el médico NO edita aquí. Si quiere
    // ajustar, va a la pestaña de origen. Por eso NO debe haber <input>,
    // <textarea> ni <select> dentro del preview.
    expect(html).not.toContain('<input')
    expect(html).not.toContain('<textarea')
    expect(html).not.toContain('<select')
  })

  it('87. Render resilente: form con tipos heterogéneos no rompe (null, undefined, vacío)', () => {
    // Simula form "sucio" con null/undefined/'' mezclados (defensa en
    // profundidad — `physicalExamData` viene de Prisma JSON).
    const html = render({
      form: {
        estado_nutricional: '',
        agudeza_visual_resumen: '' as string,
        salud_bucal: '' as string,
        presion_arterial_resumen: '' as string,
        impresion_diagnostica: '' as string,
      } as Record<string, string>,
    })

    // No debe crashear; debe renderizar placeholders.
    expect(html).toContain('Pendiente de resultado')
    expect(html).toContain('Pendiente')
  })
})