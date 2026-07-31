/**
 * @file Formulario de edición interna de Company — solo ADMIN (ARCH-20260624-03).
 * @id IMPL-20260624-03
 * @backup context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md
 *
 * Client component: renderiza formulario con secciones (basicos, fiscal, repLegal,
 * rh, cuentasPagar, referencias). Optimistic locking via hidden `expectedUpdatedAt`.
 *
 * Manejo de errores:
 *   - CONCURRENT_UPDATE → toast "Los datos fueron actualizados por otro usuario. Recarga la página."
 *   - RFC_DUPLICATE → mensaje en el formulario.
 *   - INVALID_PAYLOAD → detalle de validación.
 *
 * Confirmación si se modifica el campo RFC: "¿Estás seguro? El RFC es identificador fiscal único."
 */
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCompanyAction } from '@/actions/company.actions'

interface CompanyEditFormProps {
  company: {
    id: string
    name: string
    rfc: string | null
    address: string | null
    contactName: string | null
    email: string | null
    phone: string | null
    fiscalData: unknown
    repLegalData: unknown
    rhData: unknown
    cuentasPagarData: unknown
    referenciasData: unknown
    documentosAdjuntos: unknown
    updatedAt: string
  }
  catalogos: {
    estados: { id: number; nombre: string }[]
    cfdiOptions: readonly string[]
    metodoPagoOptions: readonly string[]
  }
}

// Helpers de parseo seguro (idem CompanyFullFormView)
function safeParse<T extends Record<string, unknown>>(value: unknown): T | null {
  if (!value || typeof value !== 'object') return null
  return value as T
}

function asArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>
  return []
}

export default function CompanyEditForm({ company, catalogos }: CompanyEditFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [rfcTouched, setRfcTouched] = useState(false)

  // Parsing seguro de las secciones Json
  const fiscal = safeParse<Record<string, unknown>>(company.fiscalData) ?? {}
  const repLegal = safeParse<Record<string, unknown>>(company.repLegalData) ?? {}
  const rh = safeParse<Record<string, unknown>>(company.rhData) ?? {}
  const cxp = safeParse<Record<string, unknown>>(company.cuentasPagarData) ?? {}
  const referencias = asArray(company.referenciasData)

  // Estado del formulario
  const [basic, setBasic] = useState({
    name: company.name,
    rfc: company.rfc ?? '',
    address: company.address ?? '',
    contactName: company.contactName ?? '',
    email: company.email ?? '',
    phone: company.phone ?? '',
  })

  const [fiscalForm, setFiscalForm] = useState({
    fecha: (fiscal.fecha as string) ?? new Date().toISOString().slice(0, 10),
    razonSocial: (fiscal.razonSocial as string) ?? company.name,
    rfc: (fiscal.rfc as string) ?? company.rfc ?? '',
    giro: (fiscal.giro as string) ?? '',
    // FIX-FRANK-20260731-06: domicilio se compone de 3 campos desde
    // FIX-ARCH-20260624-05 (domicilioCalle + Interior + Exterior). El form
    // legacy usaba un solo campo 'domicilio'. Se mantiene compat: si la
    // empresa tiene datos en 'domicilio' (empresas creadas antes del fix),
    // se toman como calle + 'sin interior/exterior'.
    domicilioCalle:
      (fiscal.domicilioCalle as string) ??
      (fiscal.domicilio as string) ??
      '',
    domicilioInterior: (fiscal.domicilioInterior as string) ?? '',
    domicilioExterior: (fiscal.domicilioExterior as string) ?? '',
    colonia: (fiscal.colonia as string) ?? '',
    estado: (fiscal.estado as string) ?? '',
    municipio: (fiscal.municipio as string) ?? '',
    pais: (fiscal.pais as string) ?? 'México',
    cp: (fiscal.cp as string) ?? '',
    usoCFDI: (fiscal.usoCFDI as string) ?? 'G03',
    metodoPago: (fiscal.metodoPago as string) ?? 'PUE',
  })

  const [repLegalForm, setRepLegalForm] = useState({
    nombre: (repLegal.nombre as string) ?? '',
    apellidos: (repLegal.apellidos as string) ?? '',
    puesto: (repLegal.puesto as string) ?? '',
    telefono: (repLegal.telefono as string) ?? '',
    extension: (repLegal.extension as string) ?? '',
    email: (repLegal.email as string) ?? '',
  })

  const [rhForm, setRhForm] = useState({
    nombre: (rh.nombre as string) ?? '',
    apellidos: (rh.apellidos as string) ?? '',
    puesto: (rh.puesto as string) ?? '',
    telefono: (rh.telefono as string) ?? '',
    extension: (rh.extension as string) ?? '',
    email: (rh.email as string) ?? '',
  })

  const [cxpForm, setCxpForm] = useState({
    nombre: (cxp.nombre as string) ?? '',
    apellidos: (cxp.apellidos as string) ?? '',
    puesto: (cxp.puesto as string) ?? '',
    telefono: (cxp.telefono as string) ?? '',
    extension: (cxp.extension as string) ?? '',
    email: (cxp.email as string) ?? '',
  })

  const [refsForm, setRefsForm] = useState<Array<{ nombre: string; rfc?: string; telefono?: string; celular?: string }>>(
    referencias.length > 0
      ? referencias.map((r) => ({
          nombre: (r.nombre as string) ?? '',
          rfc: (r.rfc as string) ?? '',
          telefono: (r.telefono as string) ?? '',
          celular: (r.celular as string) ?? '',
        }))
      : [{ nombre: '' }]
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Confirmación si se modificó el RFC
    if (rfcTouched && basic.rfc !== (company.rfc ?? '')) {
      const ok = confirm(
        `¿Estás seguro de cambiar el RFC de "${company.rfc ?? '(vacío)'}" a "${basic.rfc}"? El RFC es identificador fiscal único y este cambio se registrará en auditoría.`
      )
      if (!ok) return
    }

    startTransition(async () => {
      const result = await updateCompanyAction(company.id, {
        expectedUpdatedAt: company.updatedAt,
        basic: {
          name: basic.name,
          rfc: basic.rfc.trim() || null,
          address: basic.address || null,
          contactName: basic.contactName || null,
          email: basic.email || null,
          phone: basic.phone || null,
        },
        fiscalData: fiscalForm,
        repLegalData: repLegalForm,
        rhData: rhForm,
        cuentasPagarData: cxpForm,
        referenciasData: refsForm
          .filter((r) => r.nombre.trim() !== '')
          .map((r) => ({
            nombre: r.nombre,
            rfc: r.rfc || undefined,
            telefono: r.telefono || undefined,
            celular: r.celular || undefined,
          })),
      })

      if (result.ok) {
        setSuccess('Datos actualizados correctamente. Redirigiendo…')
        // Pequeño delay para mostrar el mensaje
        setTimeout(() => router.push(`/companies/${company.id}`), 800)
      } else {
        if (result.code === 'CONCURRENT_UPDATE') {
          setError(
            'Los datos fueron actualizados por otro usuario. Recarga la página para ver la versión más reciente.'
          )
        } else if (result.code === 'RFC_DUPLICATE') {
          setError(
            `El RFC ${basic.rfc} ya está registrado en otra empresa. Si crees que es un error, contacta al administrador.`
          )
        } else if (result.code === 'FORBIDDEN') {
          setError('No tienes permisos para editar esta empresa.')
        } else {
          setError(result.error || 'No se pudieron guardar los cambios.')
        }
      }
    })
  }

  const inputClass =
    'w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-2.5 rounded-lg text-sm transition-all outline-none'

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pb-12">
      {/* Hidden: expectedUpdatedAt para optimistic locking */}
      <input type="hidden" name="expectedUpdatedAt" value={company.updatedAt} />

      {/* Sección: Datos básicos */}
      <Section title="Datos básicos">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Razón Social *">
            <input
              required
              value={basic.name}
              onChange={(e) => setBasic({ ...basic, name: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="RFC">
            <input
              value={basic.rfc}
              onChange={(e) => {
                setBasic({ ...basic, rfc: e.target.value.toUpperCase() })
                setRfcTouched(true)
              }}
              className={`${inputClass} font-mono uppercase`}
              maxLength={13}
            />
          </Field>
          <Field label="Contacto">
            <input
              value={basic.contactName}
              onChange={(e) => setBasic({ ...basic, contactName: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={basic.email}
              onChange={(e) => setBasic({ ...basic, email: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={basic.phone}
              onChange={(e) => setBasic({ ...basic, phone: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Dirección" full>
            <input
              value={basic.address}
              onChange={(e) => setBasic({ ...basic, address: e.target.value })}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      {/* Sección: Datos fiscales */}
      <Section title="1. Información fiscal">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Razón Social *">
            <input
              required
              value={fiscalForm.razonSocial}
              onChange={(e) => setFiscalForm({ ...fiscalForm, razonSocial: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="RFC *">
            <input
              required
              value={fiscalForm.rfc}
              onChange={(e) =>
                setFiscalForm({ ...fiscalForm, rfc: e.target.value.toUpperCase() })
              }
              className={`${inputClass} font-mono uppercase`}
              maxLength={13}
            />
          </Field>
          <Field label="Giro *" full>
            <input
              required
              value={fiscalForm.giro}
              onChange={(e) => setFiscalForm({ ...fiscalForm, giro: e.target.value })}
              className={inputClass}
            />
          </Field>
          {/* FIX-FRANK-20260731-06: domicilio de 3 campos
              (Calle req + Interior opt + Exterior opt) según FIX-ARCH-20260624-05.
              Reemplaza al input único legacy que se vaciaba al editar. */}
          <Field label="Domicilio Fiscal (Calle y número) *" full>
            <input
              required
              value={fiscalForm.domicilioCalle}
              onChange={(e) => setFiscalForm({ ...fiscalForm, domicilioCalle: e.target.value })}
              className={inputClass}
              placeholder="Calle y número exterior"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 col-span-full md:col-span-2">
            <Field label="Número Interior (opcional)">
              <input
                value={fiscalForm.domicilioInterior}
                onChange={(e) => setFiscalForm({ ...fiscalForm, domicilioInterior: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Número Exterior (opcional)">
              <input
                value={fiscalForm.domicilioExterior}
                onChange={(e) => setFiscalForm({ ...fiscalForm, domicilioExterior: e.target.value })}
                className={inputClass}
              />
            </Field>
          </div>
          <Field label="Colonia *" full>
            <input
              required
              value={fiscalForm.colonia}
              onChange={(e) => setFiscalForm({ ...fiscalForm, colonia: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="Estado *">
            <select
              required
              value={fiscalForm.estado}
              onChange={(e) => setFiscalForm({ ...fiscalForm, estado: e.target.value })}
              className={inputClass}
            >
              <option value="">Seleccionar…</option>
              {catalogos.estados.map((e) => (
                <option key={e.id} value={e.nombre}>
                  {e.nombre}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Municipio *">
            <input
              required
              value={fiscalForm.municipio}
              onChange={(e) => setFiscalForm({ ...fiscalForm, municipio: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="País *">
            <input
              required
              value={fiscalForm.pais}
              onChange={(e) => setFiscalForm({ ...fiscalForm, pais: e.target.value })}
              className={inputClass}
            />
          </Field>
          <Field label="CP * (5 dígitos)">
            <input
              required
              value={fiscalForm.cp}
              onChange={(e) => setFiscalForm({ ...fiscalForm, cp: e.target.value })}
              className={inputClass}
              maxLength={5}
              pattern="[0-9]{5}"
            />
          </Field>
          <Field label="Uso de CFDI *">
            <select
              required
              value={fiscalForm.usoCFDI}
              onChange={(e) => setFiscalForm({ ...fiscalForm, usoCFDI: e.target.value })}
              className={inputClass}
            >
              {catalogos.cfdiOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Método de Pago *">
            <select
              required
              value={fiscalForm.metodoPago}
              onChange={(e) => setFiscalForm({ ...fiscalForm, metodoPago: e.target.value })}
              className={inputClass}
            >
              {catalogos.metodoPagoOptions.map((m) => (
                <option key={m} value={m}>
                  {m === 'PUE' ? 'PUE — Pago en una sola exhibición' : 'PPD — Pago en parcialidades o diferido'}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* Sección: Representante Legal */}
      <PersonaSection
        title="3. Representante Legal"
        values={repLegalForm}
        onChange={(k, v) => setRepLegalForm({ ...repLegalForm, [k]: v })}
        inputClass={inputClass}
      />

      {/* Sección: RH */}
      <PersonaSection
        title="4. RH / Seguridad / Compras"
        values={rhForm}
        onChange={(k, v) => setRhForm({ ...rhForm, [k]: v })}
        inputClass={inputClass}
      />

      {/* Sección: Cuentas por Pagar */}
      <PersonaSection
        title="5. Cuentas por Pagar"
        values={cxpForm}
        onChange={(k, v) => setCxpForm({ ...cxpForm, [k]: v })}
        inputClass={inputClass}
      />

      {/* Sección: Referencias */}
      <Section title="8. Referencias comerciales (máx. 3)">
        <div className="space-y-3">
          {refsForm.map((r, i) => (
            <div
              key={i}
              className="border border-slate-200 rounded-lg p-3 grid grid-cols-1 md:grid-cols-4 gap-2"
            >
              <Field label="Nombre">
                <input
                  value={r.nombre}
                  onChange={(e) => {
                    const next = [...refsForm]
                    next[i] = { ...next[i], nombre: e.target.value }
                    setRefsForm(next)
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="RFC">
                <input
                  value={r.rfc ?? ''}
                  onChange={(e) => {
                    const next = [...refsForm]
                    next[i] = { ...next[i], rfc: e.target.value.toUpperCase() }
                    setRefsForm(next)
                  }}
                  className={`${inputClass} font-mono uppercase`}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  value={r.telefono ?? ''}
                  onChange={(e) => {
                    const next = [...refsForm]
                    next[i] = { ...next[i], telefono: e.target.value }
                    setRefsForm(next)
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="Celular">
                <input
                  value={r.celular ?? ''}
                  onChange={(e) => {
                    const next = [...refsForm]
                    next[i] = { ...next[i], celular: e.target.value }
                    setRefsForm(next)
                  }}
                  className={inputClass}
                />
              </Field>
            </div>
          ))}
          {refsForm.length < 3 && (
            <button
              type="button"
              onClick={() => setRefsForm([...refsForm, { nombre: '' }])}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
            >
              + Agregar referencia
            </button>
          )}
        </div>
      </Section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-lg text-sm">
          ✓ {success}
        </div>
      )}

      <div className="sticky bottom-0 bg-white p-4 rounded-2xl border border-slate-200 shadow-lg flex justify-end gap-2">
        <button
          type="button"
          onClick={() => router.push(`/companies/${company.id}`)}
          disabled={isPending}
          className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-lg text-sm font-bold"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg shadow-indigo-100 disabled:opacity-50"
        >
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

// --------------------------------------------------------------------------
// Sub-componentes
// --------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{title}</h2>
      {children}
    </section>
  )
}

function Field({
  label,
  children,
  full,
}: {
  label: string
  children: React.ReactNode
  full?: boolean
}) {
  return (
    <div className={`space-y-1 ${full ? 'md:col-span-2' : ''}`}>
      <label className="text-[10px] font-bold text-slate-500 uppercase">{label}</label>
      {children}
    </div>
  )
}

function PersonaSection({
  title,
  values,
  onChange,
  inputClass,
}: {
  title: string
  values: { nombre: string; apellidos: string; puesto: string; telefono: string; extension: string; email: string }
  onChange: (k: 'nombre' | 'apellidos' | 'puesto' | 'telefono' | 'extension' | 'email', v: string) => void
  inputClass: string
}) {
  return (
    <Section title={title}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nombre *">
          <input required value={values.nombre} onChange={(e) => onChange('nombre', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Apellidos *">
          <input required value={values.apellidos} onChange={(e) => onChange('apellidos', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Puesto *">
          <input required value={values.puesto} onChange={(e) => onChange('puesto', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Teléfono *">
          <input required value={values.telefono} onChange={(e) => onChange('telefono', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Extensión (opcional)">
          <input value={values.extension} onChange={(e) => onChange('extension', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Email *">
          <input required type="email" value={values.email} onChange={(e) => onChange('email', e.target.value)} className={inputClass} />
        </Field>
      </div>
    </Section>
  )
}