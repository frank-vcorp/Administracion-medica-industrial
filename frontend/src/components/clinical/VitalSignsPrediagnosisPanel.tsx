'use client'

import {
  evaluateVitalSignsPrediagnosis,
  type VitalSignFinding,
  type VitalSignSeverity,
} from '@/lib/clinical/vital-signs-prediagnosis'

const severityStyles: Record<
  VitalSignSeverity,
  { box: string; badge: string; label: string }
> = {
  normal: {
    box: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    badge: 'bg-emerald-100 text-emerald-800',
    label: 'Sin alertas',
  },
  warning: {
    box: 'bg-amber-50 border-amber-200 text-amber-950',
    badge: 'bg-amber-100 text-amber-900',
    label: 'Atención',
  },
  alert: {
    box: 'bg-rose-50 border-rose-200 text-rose-950',
    badge: 'bg-rose-100 text-rose-900',
    label: 'Irregular',
  },
}

function FindingRow({ finding }: { finding: VitalSignFinding }) {
  const style = severityStyles[finding.severity]
  return (
    <li className="flex items-start gap-2 text-xs">
      <span
        className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded font-bold uppercase text-[10px] ${style.badge}`}
      >
        {finding.severity === 'normal' ? 'OK' : finding.severity === 'warning' ? '!' : '!!'}
      </span>
      <span>
        <strong>{finding.label}:</strong> {finding.detail}
      </span>
    </li>
  )
}

export interface VitalSignsPrediagnosisPanelProps {
  vitals: Record<string, string>
  sexo?: string | null
}

export function VitalSignsPrediagnosisPanel({
  vitals,
  sexo,
}: VitalSignsPrediagnosisPanelProps) {
  const result = evaluateVitalSignsPrediagnosis({
    ta_sistolica: vitals.ta_sistolica,
    ta_diastolica: vitals.ta_diastolica,
    fc_min: vitals.fc_min,
    temperatura: vitals.temperatura,
    fr_min: vitals.fr_min,
    perimetro_cintura: vitals.perimetro_cintura,
    perimetro_cadera: vitals.perimetro_cadera,
    sexo,
  })

  if (!result.hasData) {
    return (
      <div
        className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500"
        data-testid="vitals-prediagnosis-empty"
      >
        Captura al menos un signo vital para ver el prediagnóstico orientativo al momento de la toma.
      </div>
    )
  }

  const style = severityStyles[result.overall]
  const irregular = result.findings.filter(f => f.severity !== 'normal')
  const normals = result.findings.filter(f => f.severity === 'normal')

  return (
    <div
      className={`rounded-xl border px-4 py-3 ${style.box}`}
      data-testid="vitals-prediagnosis-panel"
      data-overall={result.overall}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-sm font-bold">Prediagnóstico orientativo</span>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${style.badge}`}>
          {style.label}
        </span>
      </div>
      <p className="text-[11px] opacity-80 mb-2">
        Referencia al momento de la toma (adulto en reposo). No sustituye criterio médico ni aptitud laboral.
      </p>
      <ul className="space-y-1.5">
        {(irregular.length > 0 ? irregular : normals).map(f => (
          <FindingRow key={f.id} finding={f} />
        ))}
      </ul>
      {irregular.length > 0 && normals.length > 0 && (
        <details className="mt-2 text-[11px] opacity-90">
          <summary className="cursor-pointer font-semibold">
            Ver parámetros dentro de rango ({normals.length})
          </summary>
          <ul className="mt-1 space-y-1">
            {normals.map(f => (
              <FindingRow key={f.id} finding={f} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
