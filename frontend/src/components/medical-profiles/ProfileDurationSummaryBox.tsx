'use client'

import {
  calculateProfileDuration,
  CONTROL_DESK_MODES,
  controlDeskModeLabel,
  formatMinutesLabel,
  type ControlDeskMode,
  type ProfileDurationTestInput,
} from '@/lib/profile-duration'

export function ProfileDurationSummaryBox({
  selectedTests,
  controlDeskMode,
  onControlDeskModeChange,
  extraRxProjections,
  onExtraRxProjectionsChange,
  durationOverride,
  onDurationOverrideChange,
}: {
  selectedTests: readonly ProfileDurationTestInput[]
  controlDeskMode: ControlDeskMode
  onControlDeskModeChange: (mode: ControlDeskMode) => void
  extraRxProjections: number
  onExtraRxProjectionsChange: (count: number) => void
  durationOverride: string
  onDurationOverrideChange: (value: string) => void
}) {
  const trimmedOverride = durationOverride.trim()
  const parsedOverride =
    trimmedOverride !== '' && Number.isFinite(Number(trimmedOverride)) && Number(trimmedOverride) >= 0
      ? Math.round(Number(trimmedOverride))
      : null

  const breakdown = calculateProfileDuration({
    tests: selectedTests,
    controlDeskMode,
    extraRxProjections,
    durationOverrideMinutes: parsedOverride,
  })

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
      <input type="hidden" name="controlDeskMode" value={controlDeskMode} />
      <input type="hidden" name="extraRxProjections" value={String(extraRxProjections)} />
      <input type="hidden" name="durationOverrideMinutes" value={trimmedOverride} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold text-teal-900">
            Duración estimada en clínica
          </p>
          <p className="text-[11px] text-teal-800/80">
            Pruebas ({breakdown.testsMinutes} min) + Mesa de control ({breakdown.controlDeskMinutes} min)
            {breakdown.extraRxMinutes > 0
              ? ` + RX extra (${breakdown.extraRxMinutes} min)`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {breakdown.isManualOverride && (
            <span className="rounded-full bg-amber-100 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Manual
            </span>
          )}
          <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-black text-white">
            {formatMinutesLabel(breakdown.effectiveDurationMinutes)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block text-xs">
          <span className="font-semibold text-slate-600">
            Mesa de control
            {controlDeskMode === 'AUTO' && (
              <span className="ml-1 font-normal text-teal-700">
                (Auto: +{breakdown.controlDeskMinutes} min)
              </span>
            )}
          </span>
          <select
            value={controlDeskMode}
            onChange={(e) => onControlDeskModeChange(e.target.value as ControlDeskMode)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
          >
            {CONTROL_DESK_MODES.map((m) => (
              <option key={m} value={m}>
                {controlDeskModeLabel(m)}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs">
          <span className="font-semibold text-slate-600">
            Proyecciones RX extra (+5 min c/u)
          </span>
          <input
            type="number"
            min={0}
            max={20}
            value={extraRxProjections}
            onChange={(e) =>
              onExtraRxProjectionsChange(Math.max(0, Math.min(20, Math.floor(Number(e.target.value) || 0))))
            }
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
          />
        </label>

        <label className="block text-xs">
          <span className="flex items-center justify-between font-semibold text-slate-600">
            <span>Ajuste manual (min)</span>
            {trimmedOverride !== '' && (
              <button
                type="button"
                onClick={() => onDurationOverrideChange('')}
                className="text-[10px] font-medium text-teal-700 underline"
              >
                Usar auto
              </button>
            )}
          </span>
          <input
            type="number"
            min={0}
            max={1440}
            placeholder={`Auto (${breakdown.calculatedDurationMinutes} min)`}
            value={durationOverride}
            onChange={(e) => onDurationOverrideChange(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
          />
        </label>
      </div>

      {breakdown.undefinedTestsCount > 0 && (
        <p className="text-[11px] text-slate-500">
          {breakdown.undefinedTestsCount} prueba{breakdown.undefinedTestsCount === 1 ? '' : 's'} seleccionada{breakdown.undefinedTestsCount === 1 ? '' : 's'} no tiene{breakdown.undefinedTestsCount === 1 ? '' : 'n'} duración teórica definida (suma 0 min).
        </p>
      )}
    </div>
  )
}
