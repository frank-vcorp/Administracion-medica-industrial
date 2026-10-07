import { getPortalWorkerDetail } from '@/actions/portal.actions'
import { getPortalPageCompany } from '@/lib/portal-access'
import Link from 'next/link'

function maskNationalId(raw: string | null | undefined): string {
  if (!raw?.trim()) return '—'
  const digits = raw.replace(/\D/g, '')
  if (digits.length <= 4) return '****'
  return `****${digits.slice(-4)}`
}

export default async function PortalWorkerDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  try {
    await getPortalPageCompany()
  } catch {
    return <div className="p-8 text-red-600">Error: No hay sesión válida.</div>
  }

  const result = await getPortalWorkerDetail(id)
  if (!result.success || !result.worker) {
    return (
      <div className="p-8 text-center text-slate-500">
        <p>{result.error ?? 'Trabajador no encontrado'}</p>
        <Link href="/portal/events" className="text-blue-600 text-sm font-medium mt-4 inline-block">
          ← Volver a expedientes
        </Link>
      </div>
    )
  }

  const w = result.worker

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl mx-auto">
      <div>
        <Link href="/portal/events" className="text-sm text-blue-600 font-medium hover:underline">
          ← Expedientes
        </Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-2">
          {w.lastName}, {w.firstName}
        </h1>
        <p className="text-sm text-slate-500 font-mono">ID {w.universalId}</p>
      </div>

      <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Perfil e identificación</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Perfil médico habitual</dt>
            <dd className="font-semibold text-slate-900">{w.medicalProfile?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">CURP / ID</dt>
            <dd className="font-mono text-slate-800">{maskNationalId(w.nationalId)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Correo</dt>
            <dd>{w.email ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Teléfono</dt>
            <dd>{w.phone ?? '—'}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-2 pt-2">
          {w.lastIdentityFrontFileUrl ? (
            <a
              className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
              href={`/api/portal/worker-documents/${w.id}?part=identity-front`}
              target="_blank"
              rel="noopener noreferrer"
            >
              INE (frente)
            </a>
          ) : null}
          {w.lastIdentityBackFileUrl ? (
            <a
              className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100"
              href={`/api/portal/worker-documents/${w.id}?part=identity-back`}
              target="_blank"
              rel="noopener noreferrer"
            >
              INE (reverso)
            </a>
          ) : null}
          {w.lastInformedConsentPdfUrl ? (
            <a
              className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100"
              href={`/api/portal/worker-documents/${w.id}?part=consent`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Consentimiento informado
            </a>
          ) : null}
          {!w.lastIdentityFrontFileUrl &&
            !w.lastInformedConsentPdfUrl && (
              <p className="text-xs text-slate-400">Sin documentos de identidad/consentimiento archivados.</p>
            )}
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-5 pt-5 pb-2">
          Citas y atenciones
        </h2>
        <ul className="divide-y divide-slate-100">
          {w.appointments.map((apt) => (
            <li key={apt.id} className="px-5 py-4 text-sm space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono font-bold text-slate-800">{apt.expedientId ?? 'Sin folio'}</span>
                <span className="text-slate-500 text-xs">
                  {new Date(apt.scheduledAt).toLocaleString('es-MX', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </div>
              <p className="text-slate-600">
                Perfil: <strong>{apt.serviceProfile?.name ?? '—'}</strong> · Estado cita: {apt.status}
              </p>
              <div className="flex flex-wrap gap-2">
                {apt.identityFrontFileUrl && (
                  <a
                    className="text-[10px] font-bold text-blue-700 underline"
                    href={`/api/portal/appointments/${apt.id}/document?part=identity-front`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    INE cita
                  </a>
                )}
                {apt.informedConsentPdfUrl && (
                  <a
                    className="text-[10px] font-bold text-emerald-800 underline"
                    href={`/api/portal/appointments/${apt.id}/document?part=consent`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Consentimiento cita
                  </a>
                )}
                {apt.medicalEvents.map((ev) => (
                  <Link
                    key={ev.id}
                    href="/portal/events"
                    className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded"
                  >
                    Atención {new Date(ev.createdAt).toLocaleDateString('es-MX')} ({ev.status})
                  </Link>
                ))}
              </div>
            </li>
          ))}
          {w.appointments.length === 0 && (
            <li className="px-5 py-8 text-center text-slate-400 text-sm">Sin citas registradas.</li>
          )}
        </ul>
      </section>
    </div>
  )
}
