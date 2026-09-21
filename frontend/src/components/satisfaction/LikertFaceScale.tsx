'use client'

const FACES = ['😞', '😕', '😐', '🙂', '😄']

type Props = {
  label: string
  value: number | null
  onChange: (value: number) => void
  disabled?: boolean
}

export function LikertFaceScale({ label, value, onChange, disabled }: Props) {
  return (
    <fieldset className="space-y-2" role="group" aria-label={label}>
      <legend className="text-sm font-semibold text-slate-800">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {FACES.map((face, index) => {
          const score = index + 1
          const selected = value === score
          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              onClick={() => onChange(score)}
              aria-label={`${score} de 5`}
              className={`flex h-12 w-12 items-center justify-center rounded-xl border text-xl transition ${
                selected
                  ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-200'
                  : 'border-slate-200 bg-white hover:border-violet-200'
              } disabled:opacity-50`}
            >
              {face}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

export function LikertDotScale({ label, value, onChange, disabled }: Props) {
  return (
    <fieldset className="space-y-2" role="group" aria-label={label}>
      <legend className="text-sm font-semibold text-slate-800">{label}</legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((score) => {
          const selected = value === score
          return (
            <button
              key={score}
              type="button"
              disabled={disabled}
              onClick={() => onChange(score)}
              aria-label={`${score} de 5`}
              className={`h-10 w-10 rounded-full border text-sm font-bold transition ${
                selected
                  ? 'border-violet-600 bg-violet-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-violet-300'
              } disabled:opacity-50`}
            >
              {score}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
