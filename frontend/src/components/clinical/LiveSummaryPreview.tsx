/**
 * @file Preview en vivo del resumen ejecutivo del reporte de aptitud.
 *
 * **Regla explícita de Frank (2026-08-17):** *"Quiero que se autopoble. Quiero
 * que el médico solo llene lo estrictamente necesario."*
 *
 * `LiveSummaryPreview` renderiza los **9 campos** del PDF canónico
 * (`REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf`) EN VIVO, en la pestaña
 * "Impresión y Aptitud" del examen médico, **arriba del selector de aptitud**
 * para que el médico vea primero qué se va a poblar antes de firmar.
 *
 * - Recibe `form` (snapshot del examen físico) + `iaResults` (opcional).
 * - Delega el cálculo a `buildExamSummary` (IMPL-20260817-09-C1).
 * - Es **read-only**: el médico NO edita aquí; si quiere ajustar un valor,
 *   va a las pestañas de origen y el preview se re-arma en el siguiente render.
 * - Reactividad: como `form` viene del state del padre (`useState` /
 *   `useReducer`), cualquier cambio en el padre re-renderiza este componente
 *   automáticamente. Sin recarga, sin efecto extra.
 *
 * @id IMPL-20260817-11-C1
 * @spec SPEC_ARCH-20260817-02 §5.5 (AC-20, AC-21, AC-22)
 * @decision DA-5 (ARCH-20260817-02) — tabla 9 campos auto-poblada mixto
 *           (manual + IA), en vivo al editar, congelado al firmar.
 */
import {
  buildExamSummary,
  EXAM_SUMMARY_LABELS,
  type ExamSnapshot,
  type IaResults,
  type ExamSummary,
} from '@/lib/clinical/exam-summary'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LiveSummaryPreviewProps {
  /** Snapshot del examen físico (`physicalExamData`) — campos manuales 1-5. */
  form: Record<string, string>
  /** Resultados IA disponibles (campos 6-9). Opcional. */
  iaResults?: IaResults | null
}

// ─── Helpers de presentación ──────────────────────────────────────────────────

/** Mapea `form` (claves de `physicalExamData`) al `ExamSnapshot` esperado. */
function formToSnapshot(form: Record<string, string>): ExamSnapshot {
  return {
    estado_nutricional: form.estado_nutricional ?? null,
    agudeza_visual_resumen: form.agudeza_visual_resumen ?? null,
    salud_bucal: form.salud_bucal ?? null,
    presion_arterial_resumen: form.presion_arterial_resumen ?? null,
    // IMPL-20260817-12-C1: preferir el slot nuevo `examen_medico_texto`
    // sobre el campo legacy `impresion_diagnostica` (DA-1 compat).
    examen_medico_texto: form.examen_medico_texto ?? null,
    impresion_diagnostica: form.impresion_diagnostica ?? null,
  }
}

/**
 * Decide el placeholder visible cuando un campo del resumen viene vacío.
 * Los campos 6-9 (IA) muestran "Pendiente de resultado" (voz pasiva: aún
 * no hay resultado). Los campos 1-5 (manuales) muestran "Pendiente" (voz
 * activa: el médico aún no captura).
 */
function placeholderFor(key: keyof ExamSummary): string {
  const iaFields: ReadonlyArray<keyof ExamSummary> = [
    'audiometria',
    'espirometria',
    'laboratorios',
    'radiografia',
  ]
  return iaFields.includes(key) ? 'Pendiente de resultado' : 'Pendiente'
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function LiveSummaryPreview({
  form,
  iaResults,
}: LiveSummaryPreviewProps) {
  const summary = buildExamSummary(formToSnapshot(form), iaResults ?? null)

  return (
    <div
      data-testid="live-summary-preview"
      data-implementacion="IMPL-20260817-11-C1"
      className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Resumen ejecutivo (auto-poblado)
        </p>
        <span className="text-[10px] text-slate-400 italic">
          9 campos · live · read-only
        </span>
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed">
        Estos campos se auto-poblan desde el examen y los resultados IA. Para
        ajustar, edita en la pestaña de origen — el resumen se actualiza en
        vivo.
      </p>

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {EXAM_SUMMARY_LABELS.map(([key, label]) => {
          const value = summary[key]
          const isEmpty = value.trim() === ''
          // `examen_medico` suele ser texto diagnóstico largo → 2 cols.
          const isWide = key === 'examen_medico'
          return (
            <div
              key={key}
              data-testid={`live-summary-field-${key}`}
              className={`flex flex-col gap-0.5 ${isWide ? 'md:col-span-2' : ''}`}
            >
              <dt className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {label}
              </dt>
              <dd
                data-testid={`live-summary-value-${key}`}
                className={
                  isEmpty
                    ? 'text-slate-400 italic text-xs'
                    : 'text-slate-800 font-medium'
                }
              >
                {isEmpty ? placeholderFor(key) : value}
              </dd>
            </div>
          )
        })}
      </dl>

      <p className="text-[10px] text-slate-500 pt-1 border-t border-slate-100">
        ✓ Estos campos se auto-poblan desde el examen. Si necesitas ajustar
        algo, edita en la pestaña de origen.
      </p>
    </div>
  )
}