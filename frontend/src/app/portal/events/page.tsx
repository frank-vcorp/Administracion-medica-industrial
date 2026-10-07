import { getCompanyEventsHistory } from '@/actions/portal.actions'
import PortalEventsFilterBar from '@/components/portal/PortalEventsFilterBar'
import PortalEventDownloads from '@/components/portal/PortalEventDownloads'
import { getPortalPageCompany } from '@/lib/portal-access'
import { portalEventResolution } from '@/lib/portal-event-display'
import Link from 'next/link'

function normalizeDateParam(raw: string | undefined): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return ''
  return raw
}

export default async function PortalEventsPage(props: {
  searchParams: Promise<{ from?: string; to?: string; q?: string }>
}) {
  const searchParams = await props.searchParams
  const dateFrom = normalizeDateParam(searchParams.from)
  const dateTo = normalizeDateParam(searchParams.to)
  const workerQuery = (searchParams.q ?? '').trim().slice(0, 80)

  let companyName: string
  try {
    ;({ company: { name: companyName } } = await getPortalPageCompany())
  } catch {
    return <div className="p-8 text-red-600">Error: No hay sesión válida.</div>
  }

  const result = await getCompanyEventsHistory({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    workerQuery: workerQuery || undefined,
  })
  const events = result.success ? (result.events ?? []) : []
  const filtersActive = Boolean(dateFrom || dateTo || workerQuery)

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Expedientes y dictámenes</h1>
          <p className="text-sm text-slate-500">
            {companyName} — folio de papeleta, perfil aplicado y descargas disponibles.
          </p>
        </div>
      </div>

      <PortalEventsFilterBar initialFrom={dateFrom} initialTo={dateTo} initialQuery={workerQuery} />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-600 min-w-[880px]">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="px-4 py-3">Fecha</th>
              <th className="px-4 py-3">Folio papeleta</th>
              <th className="px-4 py-3">Trabajador</th>
              <th className="px-4 py-3">Perfil exámenes</th>
              <th className="px-4 py-3">Resolución</th>
              <th className="px-4 py-3 text-right">Descargas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {events.map((event) => {
              const hasVerdict = Boolean(event.verdict)
              const aptitud =
                (event.verdict?.event?.exam?.physicalExamData as { aptitud?: string | null } | null)
                  ?.aptitud ?? null
              const resolution = portalEventResolution({
                status: event.status,
                hasVerdict,
                aptitud,
                finalDiagnosis: event.verdict?.finalDiagnosis ?? null,
              })
              const expedientId =
                event.appointment?.expedientId ?? event.worker.universalId ?? event.id.slice(0, 8)
              const profileName =
                event.appointment?.serviceProfile?.name ?? '—'

              return (
                <tr key={event.id} className="hover:bg-slate-50 transition-colors align-top">
                  <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {new Date(event.createdAt).toLocaleDateString('es-MX')}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{expedientId}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/portal/workers/${event.worker.id}`}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {event.worker.lastName}, {event.worker.firstName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-700 max-w-[160px]">{profileName}</td>
                  <td className="px-4 py-3">
                    <span className={resolution.className}>{resolution.label}</span>
                  </td>
                  <td className="px-4 py-3">
                    <PortalEventDownloads
                      eventId={event.id}
                      eventTests={event.eventTests}
                      hasVerdict={hasVerdict}
                      dictamenReady={Boolean(event.verdict?.signedAt)}
                    />
                  </td>
                </tr>
              )
            })}
            {events.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-10 text-center text-slate-400">
                  {filtersActive
                    ? 'No hay expedientes con los filtros seleccionados.'
                    : 'Aún no hay expedientes registrados.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400 text-center">
        Solo se muestran entregables autorizados para su empresa. Los iconos en gris indican estudios aún
        en proceso.
      </p>
    </div>
  )
}
