/**
 * @file Vista completa (read-only) de las 10 secciones del formulario extenso.
 * @id IMPL-20260623-02
 *
 * Si la Company está HABILITADO, el vendedor/admin puede editar.
 * En PENDIENTE_REVISION, se renderiza en modo revisión.
 */
import type { Company, CompanyStatus } from '@prisma/client'

function safeParse<T extends Record<string, unknown>>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null
  return value as T
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <dt className="text-xs font-bold text-slate-400 uppercase min-w-[140px]">{label}</dt>
      <dd className="text-sm text-slate-700 font-medium break-words">{value || '—'}</dd>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">{title}</h3>
      <dl className="space-y-1">{children}</dl>
    </section>
  )
}

export default function CompanyFullFormView({
  company,
  mode = 'readonly',
}: {
  company: Pick<Company, 'estado' | 'fiscalData' | 'repLegalData' | 'rhData' | 'cuentasPagarData' | 'referenciasData' | 'documentosAdjuntos' | 'origen'>
  mode?: 'readonly' | 'review' | 'editable'
}) {
  const fiscal = safeParse<Record<string, unknown>>(company.fiscalData)
  const repLegal = safeParse<Record<string, unknown>>(company.repLegalData)
  const rh = safeParse<Record<string, unknown>>(company.rhData)
  const cxp = safeParse<Record<string, unknown>>(company.cuentasPagarData)
  const refs = Array.isArray(company.referenciasData)
    ? (company.referenciasData as unknown as Array<Record<string, unknown>>)
    : null
  const docs = Array.isArray(company.documentosAdjuntos)
    ? (company.documentosAdjuntos as unknown as Array<Record<string, unknown>>)
    : null

  const editable = mode === 'editable' || (mode === 'review' && company.estado === 'PENDIENTE_REVISION')
  void editable // flag de control: editable se respetará al integrar editor inline

  return (
    <div className="space-y-4">
      <Section title="1. Información general y fiscal">
        {fiscal ? (
          <>
            <Row label="Razón Social" value={fiscal.razonSocial as string} />
            <Row label="RFC" value={<span className="font-mono">{fiscal.rfc as string}</span>} />
            <Row label="Giro" value={fiscal.giro as string} />
            {/* FIX-ARCH-20260624-05: compat con DB legacy (campo `domicilio` plano) */}
            <Row
              label="Domicilio (calle y número)"
              value={[
                (fiscal.domicilioCalle as string | undefined) ?? (fiscal.domicilio as string | undefined),
                fiscal.domicilioExterior as string | undefined,
                fiscal.domicilioInterior as string | undefined,
              ]
                .filter(Boolean)
                .join(' ') || '—'}
            />
            <Row label="Colonia" value={fiscal.colonia as string} />
            <Row label="Estado" value={fiscal.estado as string} />
            <Row label="Municipio" value={fiscal.municipio as string} />
            <Row label="País" value={(fiscal.pais as string) ?? 'México'} />
            <Row label="CP" value={fiscal.cp as string} />
            <Row label="Uso de CFDI" value={fiscal.usoCFDI as string} />
            <Row label="Método de Pago" value={fiscal.metodoPago as string} />
          </>
        ) : (
          <p className="text-sm text-slate-500">No se ha capturado información fiscal.</p>
        )}
      </Section>

      <Section title="3. Representante legal">
        {repLegal ? (
          <>
            <Row label="Nombre" value={`${repLegal.nombre as string} ${repLegal.apellidos as string}`} />
            <Row label="Puesto" value={repLegal.puesto as string} />
            <Row label="Teléfono" value={repLegal.telefono as string} />
            <Row label="Ext." value={repLegal.extension as string} />
            <Row label="Email" value={repLegal.email as string} />
          </>
        ) : (
          <p className="text-sm text-slate-500">No capturado.</p>
        )}
      </Section>

      <Section title="4. RH / Seguridad / Compras">
        {rh ? (
          <>
            <Row label="Nombre" value={`${rh.nombre as string} ${rh.apellidos as string}`} />
            <Row label="Puesto" value={rh.puesto as string} />
            <Row label="Teléfono" value={rh.telefono as string} />
            <Row label="Email" value={rh.email as string} />
          </>
        ) : (
          <p className="text-sm text-slate-500">No capturado.</p>
        )}
      </Section>

      <Section title="5. Cuentas por pagar">
        {cxp ? (
          <>
            <Row label="Nombre" value={`${cxp.nombre as string} ${cxp.apellidos as string}`} />
            <Row label="Puesto" value={cxp.puesto as string} />
            <Row label="Teléfono" value={cxp.telefono as string} />
            <Row label="Email" value={cxp.email as string} />
          </>
        ) : (
          <p className="text-sm text-slate-500">No capturado.</p>
        )}
      </Section>

      {refs && refs.length > 0 && (
        <Section title="8. Referencias comerciales">
          {refs.map((r, i) => (
            <div key={i} className="border border-slate-100 rounded-lg p-3 mb-2">
              <p className="text-sm font-bold text-slate-700">{r.nombre as string}</p>
              <Row label="RFC" value={r.rfc as string} />
              <Row label="Teléfono" value={r.telefono as string} />
              <Row label="Celular" value={r.celular as string} />
            </div>
          ))}
        </Section>
      )}

      {docs && docs.length > 0 && (
        <Section title="9. Documentación adjunta">
          <ul className="space-y-1">
            {docs.map((d, i) => {
              const fileUrl = (d.fileUrl as string) ?? (d.key ? `/api/files/${d.key}` : '#')
              return (
                <li key={i} className="text-sm">
                  <a
                    href={fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 underline"
                  >
                    {d.nombre as string}
                  </a>
                  <span className="text-xs text-slate-400 ml-2">
                    ({d.extension as string}, {Math.round(((d.size as number) ?? 0) / 1024)} KB)
                  </span>
                </li>
              )
            })}
          </ul>
        </Section>
      )}
    </div>
  )
}

export type CompanySectionStatus = CompanyStatus
