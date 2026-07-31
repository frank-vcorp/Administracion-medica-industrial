/**
 * @file Vista completa (read-only) de las 10 secciones del formulario extenso.
 * @id IMPL-20260623-02
 * @fix  FIX-FRANK-20260731-07 — vista read-only con mejor jerarquía visual.
 *
 * Si la Company está HABILITADO, el vendedor/admin puede editar desde
 * /companies/[id]/edit. En PENDIENTE_REVISION, se renderiza en modo revisión.
 *
 * Layout por sección:
 *   - Header con icono + título + descripción breve.
 *   - Grid de campos en 2 columnas (responsive: 1 col en móvil).
 *   - Cada campo: label pequeño uppercase + valor prominent.
 *   - Valores vacíos: placeholder "—" en gris claro.
 *   - Domicilio descompuesto en Calle + Int + Ext (FIX-ARCH-20260624-05).
 */
import type { Company, CompanyStatus } from '@prisma/client'

function safeParse<T extends Record<string, unknown>>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null
  return value as T
}

function ValueCell({
  label,
  value,
  mono = false,
  className = '',
}: {
  label: string
  value: unknown
  mono?: boolean
  className?: string
}) {
  let display: React.ReactNode
  if (value === null || value === undefined || value === '') {
    display = <span className="text-slate-300 font-normal">—</span>
  } else if (mono) {
    display = <span className="font-mono text-xs">{String(value)}</span>
  } else {
    display = String(value)
  }
  return (
    <div className={`bg-slate-50/60 rounded-lg px-4 py-3 border border-slate-100 ${className}`}>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-sm font-semibold text-slate-800 break-words">{display}</p>
    </div>
  )
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description?: string
  icon: string
  children: React.ReactNode
}) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="flex items-start gap-3 px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-transparent">
        <span className="text-2xl leading-none mt-0.5" aria-hidden>
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-black text-slate-800 leading-tight">{title}</h3>
          {description && (
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          )}
        </div>
      </header>
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
    </section>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="col-span-2 text-center py-8 text-sm text-slate-400 italic">
      {message}
    </div>
  )
}

/** Une los componentes del domicilio en un string legible. */
function buildDomicilio(fiscal: Record<string, unknown>): string | null {
  const calle = (fiscal.domicilioCalle as string | undefined) ?? (fiscal.domicilio as string | undefined)
  const exterior = fiscal.domicilioExterior as string | undefined
  const interior = fiscal.domicilioInterior as string | undefined
  if (!calle) return null
  const parts = [calle.trim()]
  if (exterior) parts.push(`Ext. ${exterior.trim()}`)
  if (interior) parts.push(`Int. ${interior.trim()}`)
  return parts.join(' · ')
}

export default function CompanyFullFormView({
  company,
  mode = 'readonly',
}: {
  company: Pick<
    Company,
    | 'estado'
    | 'fiscalData'
    | 'repLegalData'
    | 'rhData'
    | 'cuentasPagarData'
    | 'referenciasData'
    | 'documentosAdjuntos'
    | 'origen'
  >
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
  void editable // flag reservado para editor inline futuro

  return (
    <div className="space-y-5">
      {/* 1. Información general y fiscal */}
      <Section
        title="Información General y Fiscal"
        description="Datos legales y de identificación ante el SAT"
        icon="🏛️"
      >
        {fiscal ? (
          <>
            <ValueCell label="Razón Social" value={fiscal.razonSocial} />
            <ValueCell label="RFC" value={fiscal.rfc} mono />
            <ValueCell label="Giro de la empresa" value={fiscal.giro} />
            <ValueCell
              label="Domicilio Fiscal"
              value={buildDomicilio(fiscal)}
              className="md:col-span-2"
            />
            <ValueCell label="Colonia" value={fiscal.colonia} />
            <ValueCell label="Código Postal" value={fiscal.cp} mono />
            <ValueCell label="Estado" value={fiscal.estado} />
            <ValueCell label="Municipio" value={fiscal.municipio} />
            <ValueCell label="País" value={(fiscal.pais as string) ?? 'México'} />
            <ValueCell
              label="Uso de CFDI"
              value={fiscal.usoCFDI}
              mono
            />
            <ValueCell
              label="Método de Pago"
              value={fiscal.metodoPago}
              mono
            />
          </>
        ) : (
          <EmptyState message="No se ha capturado información fiscal." />
        )}
      </Section>

      {/* 2. Datos bancarios (placeholder — no se muestra el JSON en read-only actualmente) */}

      {/* 3. Representante Legal */}
      <Section
        title="Representante Legal"
        description="Persona que firma legalmente por la empresa"
        icon="✍️"
      >
        {repLegal ? (
          <>
            <ValueCell
              label="Nombre completo"
              value={`${(repLegal.nombre as string) ?? ''} ${(repLegal.apellidos as string) ?? ''}`.trim()}
              className="md:col-span-2"
            />
            <ValueCell label="Puesto" value={repLegal.puesto} />
            <ValueCell label="Teléfono" value={repLegal.telefono} mono />
            <ValueCell label="Extensión" value={repLegal.extension} mono />
            <ValueCell
              label="Email"
              value={repLegal.email}
              className="md:col-span-2"
            />
          </>
        ) : (
          <EmptyState message="No capturado." />
        )}
      </Section>

      {/* 4. RH / Seguridad / Compras */}
      <Section
        title="Responsable de RH, Seguridad o Compras"
        description="Persona que gestiona la operación con AMI"
        icon="👥"
      >
        {rh ? (
          <>
            <ValueCell
              label="Nombre completo"
              value={`${(rh.nombre as string) ?? ''} ${(rh.apellidos as string) ?? ''}`.trim()}
              className="md:col-span-2"
            />
            <ValueCell label="Puesto" value={rh.puesto} />
            <ValueCell label="Teléfono" value={rh.telefono} mono />
            <ValueCell label="Extensión" value={rh.extension} mono />
            <ValueCell label="Email" value={rh.email} className="md:col-span-2" />
          </>
        ) : (
          <EmptyState message="No capturado." />
        )}
      </Section>

      {/* 5. Cuentas por pagar */}
      <Section
        title="Responsable de Cuentas por Pagar"
        description="Persona que gestiona los pagos a AMI"
        icon="💳"
      >
        {cxp ? (
          <>
            <ValueCell
              label="Nombre completo"
              value={`${(cxp.nombre as string) ?? ''} ${(cxp.apellidos as string) ?? ''}`.trim()}
              className="md:col-span-2"
            />
            <ValueCell label="Puesto" value={cxp.puesto} />
            <ValueCell label="Teléfono" value={cxp.telefono} mono />
            <ValueCell label="Extensión" value={cxp.extension} mono />
            <ValueCell label="Email" value={cxp.email} className="md:col-span-2" />
          </>
        ) : (
          <EmptyState message="No capturado." />
        )}
      </Section>

      {/* 8. Referencias comerciales (de la ficha extendida) */}
      {refs && refs.length > 0 && (
        <Section
          title="Referencias Comerciales"
          description={`${refs.length} referencia${refs.length === 1 ? '' : 's'} para solicitud de crédito`}
          icon="🤝"
        >
          {refs.map((r, i) => (
            <ValueCell
              key={i}
              label={`Referencia #${i + 1}`}
              value={(r.nombre as string) ?? ''}
              className="md:col-span-2"
            />
          ))}
          {refs.map((r, i) => (
            <ValueCell
              key={`rfc-${i}`}
              label={`RFC Ref. ${i + 1}`}
              value={(r.rfc as string) ?? ''}
              mono
            />
          ))}
          {refs.map((r, i) => (
            <ValueCell
              key={`tel-${i}`}
              label={`Teléfono Ref. ${i + 1}`}
              value={(r.telefono as string) ?? ''}
              mono
            />
          ))}
          {refs.map((r, i) => (
            <ValueCell
              key={`cel-${i}`}
              label={`Celular Ref. ${i + 1}`}
              value={(r.celular as string) ?? ''}
              mono
            />
          ))}
        </Section>
      )}

      {/* 9. Documentación adjunta */}
      {docs && docs.length > 0 && (
        <Section
          title="Documentación Adjunta"
          description={`${docs.length} archivo${docs.length === 1 ? '' : 's'} subido${docs.length === 1 ? '' : 's'}`}
          icon="📎"
        >
          <ul className="md:col-span-2 space-y-2">
            {docs.map((d, i) => {
              const fileUrl =
                (d.fileUrl as string) ?? (d.key ? `/api/files/${d.key}` : '#')
              const sizeKb = Math.round(((d.size as number) ?? 0) / 1024)
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 bg-slate-50/60 rounded-lg px-4 py-2.5 border border-slate-100 hover:border-indigo-300 transition-colors"
                >
                  <span className="text-lg" aria-hidden>
                    📄
                  </span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 underline truncate block"
                    >
                      {d.nombre as string}
                    </a>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">
                      {(d.extension as string) ?? '—'} · {sizeKb} KB
                    </p>
                  </div>
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
