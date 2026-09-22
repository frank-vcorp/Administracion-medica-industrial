/** Skeleton mientras carga la papeleta (/events/[id]). */
export default function EventPageLoading() {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4 px-3 py-6 md:px-4 animate-pulse">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 rounded bg-slate-200" />
            <div className="h-3 w-72 max-w-full rounded bg-slate-100" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-8 w-24 rounded-lg bg-slate-100" />
          <div className="h-8 w-24 rounded-lg bg-slate-100" />
          <div className="h-8 w-32 rounded-lg bg-slate-100" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="h-[420px] rounded-xl border border-slate-200 bg-white p-3">
          <div className="mb-3 h-4 w-32 rounded bg-slate-200" />
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 rounded-lg bg-slate-100" />
            ))}
          </div>
        </div>
        <div className="h-[420px] rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
          <div className="h-full min-h-[200px] rounded-lg bg-slate-50" />
        </div>
      </div>
      <p className="text-center text-xs font-medium text-slate-400">Cargando papeleta…</p>
    </div>
  )
}
