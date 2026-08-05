/**
 * @file Formulario público de auto-alta (10 secciones).
 * @id IMPL-20260623-02
 * @spec context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 * @id-mod IMPL-20260624-01
 * @spec-mod context/SPECs/SPEC_ARCH-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md
 * @id-mod-fix FIX-ARCH-20260624-05
 * (alineación con medicaindustrial.com/alta_de_cliente: domicilio interior/exterior,
 *  horarios De/A, contacto estructurado)
 *
 * Client component: renderiza el formulario para un token previamente validado
 * (source='TOKEN') o sin token (source='PUBLIC').
 *
 * - source='TOKEN':   key = companies/selfreg/{tokenHash[:8]}/{section}/{filename}
 *                     submit → submitCompanySelfRegistrationAction(token, payload)
 * - source='PUBLIC':  key = companies/public/{random8()}/{section}/{filename}
 *                     submit → submitPublicCompanySelfRegistrationAction(payload)
 *                     NO valida token (no hay); archivos NO se registran via
 *                     registerSelfRegFileAction (no hay CompanySelfRegistration
 *                     previa; el registro se crea en submit con channel=PUBLIC_DIRECT).
 *
 * Tamaños máximos por sección (cliente y servidor):
 *   - constanciaFiscal / identificacionRepLegal → 3 MB
 *   - comprobanteDomicilio → 2 MB
 *   - opinionSat → 4 MB
 *   - actaConstitutiva / otraDocumentacion → 10 MB
 */
'use client'

import { useRef, useState, useTransition } from 'react'
import {
  validateCompanySelfRegTokenAction,
  registerSelfRegFileAction,
  submitCompanySelfRegistrationAction,
  submitPublicCompanySelfRegistrationAction,
} from '@/actions/company.actions'
import { ALLOWED_DOCUMENT_EXTENSIONS, MAX_FILE_SIZE_2MB, MAX_FILE_SIZE_3MB, MAX_FILE_SIZE_4MB, MAX_FILE_SIZE_10MB, SAT_CFDI_USO_DESCRIPTIONS } from '@/lib/schemas/company-full-form'

type SeccionDoc = 'constanciaFiscal' | 'identificacionRepLegal' | 'comprobanteDomicilio' | 'opinionSat' | 'actaConstitutiva' | 'otraDocumentacion'

const SECCION_LIMITS: Record<SeccionDoc, number> = {
  constanciaFiscal: MAX_FILE_SIZE_3MB,
  identificacionRepLegal: MAX_FILE_SIZE_3MB,
  comprobanteDomicilio: MAX_FILE_SIZE_2MB,
  opinionSat: MAX_FILE_SIZE_4MB,
  actaConstitutiva: MAX_FILE_SIZE_10MB,
  otraDocumentacion: MAX_FILE_SIZE_10MB,
}

const SECCION_LABELS: Record<SeccionDoc, string> = {
  constanciaFiscal: 'Constancia de situación fiscal (RFC) *',
  identificacionRepLegal: 'Identificación oficial del representante legal *',
  comprobanteDomicilio: 'Comprobante de domicilio *',
  opinionSat: 'Opinión positiva del SAT (mes en curso) *',
  actaConstitutiva: 'Acta constitutiva *',
  otraDocumentacion: 'Otra documentación',
}

const SECCIONES_OBLIGATORIAS: SeccionDoc[] = [
  'constanciaFiscal',
  'identificacionRepLegal',
  'comprobanteDomicilio',
  'opinionSat',
  'actaConstitutiva',
]

type UploadedFile = {
  key: string
  fileUrl: string
  filename: string
  size: number
  mime: string
  extension: string
  seccion: SeccionDoc
}

interface InitialState {
  status: 'ACTIVE'
  expiresAt: string
  /**
   * FIX-20260624-10: Label formateado de expiresAt, pre-computado en el server
   * con timezone America/Mexico_City. Se pasa como string para evitar que el
   * client recalcule con `new Date().toLocaleString('es-MX')` y produzca un
   * string distinto por diferencia de timezone → React #418 hydration mismatch.
   */
  expiresAtLabel: string
  /**
   * FIX-20260624-10: Fecha inicial (YYYY-MM-DD UTC) pre-computada en el server.
   * Evita que `new Date().toISOString().slice(0,10)` en el useState initializer
   * diverja entre server y client si el render cruza medianoche UTC.
   */
  fecha: string
  openedCount: number
}

interface InvalidState {
  status: 'EXPIRED' | 'ALREADY_SUBMITTED' | 'CANCELLED' | 'NOT_FOUND'
  expiresAt?: string
  existingCompanyId?: string
}

/**
 * IMPL-20260624-01: Props del formulario.
 * - source='TOKEN'   → ruta /auto-alta/[token] (requiere token vigente).
 * - source='PUBLIC'  → ruta /solicitar-alta (sin token, sin auth).
 * Default 'TOKEN' para retrocompatibilidad con callers existentes.
 */
interface SelfRegistrationFormProps {
  token?: string
  source?: 'TOKEN' | 'PUBLIC'
  initial: InitialState | InvalidState
  estados: { id: number; nombre: string }[]
  cfdiOptions: readonly string[]
}

export default function SelfRegistrationForm({
  token,
  source = 'TOKEN',
  initial,
  estados,
  cfdiOptions,
}: SelfRegistrationFormProps) {
  // IMPL-20260624-01: Guard retrocompatible. En source='TOKEN' el token es obligatorio.
  if (source === 'TOKEN' && (!token || token.length < 8)) {
    console.warn('[SelfRegistrationForm] source=TOKEN requires a valid token prop')
    return
  }

  // IMPL-20260624-01: En modo PUBLIC, el form siempre se renderiza activo
  // (no hay token que validar). La página provee initial.status='ACTIVE'.
  if (source === 'PUBLIC') {
    return (
      <SelfRegistrationFormActive
        source="PUBLIC"
        initial={initial.status === 'ACTIVE' ? initial : { status: 'ACTIVE', expiresAt: '', expiresAtLabel: '', fecha: '', openedCount: 0 }}
        estados={estados}
        cfdiOptions={cfdiOptions}
      />
    )
  }

  if (initial.status !== 'ACTIVE') {
    return <InvalidTokenView state={initial} />
  }

  return (
    <SelfRegistrationFormActive
      source="TOKEN"
      token={token}
      initial={initial}
      estados={estados}
      cfdiOptions={cfdiOptions}
    />
  )
}

function InvalidTokenView({ state }: { state: InvalidState }) {
  const messages: Record<InvalidState['status'], { title: string; body: React.ReactNode }> = {
    EXPIRED: {
      title: 'Link expirado',
      body: (
        <p>Este enlace de auto-alta ya venció. Por favor, solicita uno nuevo al vendedor o administrador con el que estás en contacto.</p>
      ),
    },
    ALREADY_SUBMITTED: {
      title: 'Link ya utilizado',
      body: state.existingCompanyId ? (
        <p>
          Este enlace ya fue utilizado. Si necesitas revisar el estado de tu registro, contacta a tu vendedor.
        </p>
      ) : (
        <p>Este enlace ya fue utilizado.</p>
      ),
    },
    CANCELLED: {
      title: 'Link cancelado',
      body: <p>Este enlace fue cancelado por un administrador. Solicita uno nuevo.</p>,
    },
    NOT_FOUND: {
      title: 'Link inválido',
      body: <p>El enlace que abriste no existe o fue alterado. Verifica la URL.</p>,
    },
  }
  const m = messages[state.status]
  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
      <h1 className="text-2xl font-black text-slate-800">{m.title}</h1>
      <div className="mt-3 text-slate-600 text-sm">{m.body}</div>
    </div>
  )
}

function SelfRegistrationFormActive({
  token,
  source,
  initial,
  estados,
  cfdiOptions,
}: {
  token?: string
  source: 'TOKEN' | 'PUBLIC'
  initial: InitialState
  estados: { id: number; nombre: string }[]
  cfdiOptions: readonly string[]
}) {
  const [isPending, startTransition] = useTransition()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ companyId: string } | null>(null)
  const [uploads, setUploads] = useState<Record<SeccionDoc, UploadedFile | null>>({
    constanciaFiscal: null,
    identificacionRepLegal: null,
    comprobanteDomicilio: null,
    opinionSat: null,
    actaConstitutiva: null,
    otraDocumentacion: null,
  })
  const [uploading, setUploading] = useState<Record<SeccionDoc, boolean>>({
    constanciaFiscal: false,
    identificacionRepLegal: false,
    comprobanteDomicilio: false,
    opinionSat: false,
    actaConstitutiva: false,
    otraDocumentacion: false,
  })

  // IMPL-20260624-01: random8 estable para scope de storage público.
  // Se genera perezosamente en el primer upload para evitar IDs huérfanos
  // si el usuario nunca llega a subir un archivo.
  const publicScopeRef = useRef<string | null>(null)
  function getPublicScope(): string {
    if (!publicScopeRef.current) {
      // 6 bytes → 8 chars base64url (compatible con el scope del server).
      const arr = new Uint8Array(6)
      crypto.getRandomValues(arr)
      publicScopeRef.current = btoa(String.fromCharCode(...arr))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')
        .slice(0, 8)
    }
    return publicScopeRef.current
  }
  const [form, setForm] = useState({
    // Fiscal
    // FIX-20260624-10: usar initial.fecha pre-computado en server para evitar
    // divergencia con el client (cruce de medianoche UTC).
    fecha: initial.fecha,
    razonSocial: '',
    rfc: '',
    giro: '',
    // FIX-ARCH-20260624-05: domicilio en 3 campos (calle req, int/ext opt).
    domicilioCalle: '',
    domicilioInterior: '',
    domicilioExterior: '',
    colonia: '',
    estado: '',
    municipio: '',
    pais: 'México',
    cp: '',
    usoCFDI: 'G03',
    metodoPago: 'PUE',
    // Bancario
    banco: '',
    cuenta: '',
    // Rep Legal
    rep_nombre: '',
    rep_apellidos: '',
    rep_puesto: '',
    rep_telefono: '',
    rep_extension: '',
    rep_email: '',
    // RH
    rh_nombre: '',
    rh_apellidos: '',
    rh_puesto: '',
    rh_telefono: '',
    rh_extension: '',
    rh_email: '',
    // Cuentas por pagar
    cxp_nombre: '',
    cxp_apellidos: '',
    cxp_puesto: '',
    cxp_telefono: '',
    cxp_extension: '',
    cxp_email: '',
    // Facturación
    correoXml: '',
    correoComplemento: '',
    procesoFacturacion: '',
    // Entrega física — FIX-ARCH-20260624-05: rango horario De/A + contacto estructurado.
    dias: [] as string[],
    horaDe: '09',
    minutoDe: '00',
    horaA: '',
    // FIX-FRANK-20260731-01: hasta 3 referencias comerciales para solicitud de crédito.
    // Cada entrada tiene los 4 campos requeridos por ReferenciaComercialSchema.
    referencias: [
      { nombre: '', rfc: '', telefono: '', celular: '' },
      { nombre: '', rfc: '', telefono: '', celular: '' },
      { nombre: '', rfc: '', telefono: '', celular: '' },
    ] as Array<{ nombre: string; rfc: string; telefono: string; celular: string }>,
    minutoA: '',
    contactoRecibe: { nombre: '', telefono: '', celular: '' },
    // Términos
    terminos: false,
  })

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // FIX-FRANK-20260731-01: mutador específico para referencias[i].campo.
  function setReferencia(
    idx: 0 | 1 | 2,
    campo: 'nombre' | 'rfc' | 'telefono' | 'celular',
    valor: string,
  ) {
    setForm((f) => {
      const next = [...f.referencias]
      next[idx] = { ...next[idx], [campo]: valor }
      return { ...f, referencias: next }
    })
  }

  function validateFile(file: File, seccion: SeccionDoc): string | null {
    if (file.size > SECCION_LIMITS[seccion]) {
      return `Archivo excede ${(SECCION_LIMITS[seccion] / (1024 * 1024)).toFixed(0)} MB (Sección: ${SECCION_LABELS[seccion]})`
    }
    const ext = (file.name.split('.').pop() ?? '').toLowerCase()
    if (!ALLOWED_DOCUMENT_EXTENSIONS.includes(ext as (typeof ALLOWED_DOCUMENT_EXTENSIONS)[number])) {
      return `Extensión no permitida: .${ext}. Permitidas: ${ALLOWED_DOCUMENT_EXTENSIONS.join(', ')}`
    }
    return null
  }

  async function handleUpload(seccion: SeccionDoc, file: File) {
    const err = validateFile(file, seccion)
    if (err) {
      setSubmitError(err)
      return
    }
    setUploading((u) => ({ ...u, [seccion]: true }))
    setSubmitError(null)
    try {
      // IMPL-20260624-01: Branch según source.
      let key: string
      if (source === 'TOKEN') {
        if (!token) {
          setSubmitError('Token no disponible')
          return
        }
        // 1. Re-validar token antes de subir
        const tokenCheck = await validateCompanySelfRegTokenAction(token)
        if (!tokenCheck.ok) {
          setSubmitError(`Token no vigente: ${tokenCheck.reason}`)
          return
        }
        // 2. Subir a /api/v1/upload-only con scope companies/selfreg/{tokenHash[:8]}/
        const tokenHash = await getTokenHashFromClient(token)
        key = `companies/selfreg/${tokenHash.slice(0, 8)}/${seccion}/${file.name}`
      } else {
        // source='PUBLIC': scope companies/public/{random8}/
        key = `companies/public/${getPublicScope()}/${seccion}/${file.name}`
      }
      const fd = new FormData()
      fd.append('key', key)
      fd.append('file', file)
      const upRes = await fetch('/api/v1/upload-only', { method: 'POST', body: fd })
      if (!upRes.ok) {
        setSubmitError('No se pudo subir el archivo al bucket')
        return
      }
      const upJson = (await upRes.json()) as { file_url?: string; key?: string }
      const fileUrl = upJson.file_url ?? `/api/files/${key}`
      const ext = (file.name.split('.').pop() ?? '').toLowerCase()
      // IMPL-20260624-01: En modo PUBLIC no se llama registerSelfRegFileAction
      // (no hay CompanySelfRegistration previa; se crea en submit con channel=PUBLIC_DIRECT).
      if (source === 'TOKEN' && token) {
        const reg = await registerSelfRegFileAction(token, {
          key,
          filename: file.name,
          size: file.size,
          mime: file.type || 'application/octet-stream',
          section: seccion,
        })
        if (!reg.ok) {
          setSubmitError(`No se pudo registrar el archivo: ${reg.reason}`)
          return
        }
      }
      setUploads((u) => ({
        ...u,
        [seccion]: { key, fileUrl, filename: file.name, size: file.size, mime: file.type || 'application/octet-stream', extension: ext, seccion },
      }))
    } catch (e) {
      const err = e as Error
      setSubmitError(`Error subiendo: ${err.message}`)
    } finally {
      setUploading((u) => ({ ...u, [seccion]: false }))
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError(null)

    // Validaciones rápidas cliente
    for (const sec of SECCIONES_OBLIGATORIAS) {
      if (!uploads[sec]) {
        setSubmitError(`Falta documento obligatorio: ${SECCION_LABELS[sec]}`)
        return
      }
    }
    if (!form.terminos) {
      setSubmitError('Debes aceptar los términos y condiciones')
      return
    }

    const documentos = (Object.keys(uploads) as SeccionDoc[])
      .map((k) => uploads[k])
      .filter((v): v is UploadedFile => v !== null)
      .map((f) => ({
        nombre: f.filename,
        seccion: f.seccion,
        key: f.key,
        fileUrl: f.fileUrl,
        size: f.size,
        mime: f.mime,
        extension: f.extension,
      }))

    const payload = {
      fiscal: {
        fecha: new Date(form.fecha).toISOString(),
        razonSocial: form.razonSocial,
        rfc: form.rfc.toUpperCase().trim(),
        giro: form.giro,
        // FIX-ARCH-20260624-05: 3 campos para domicilio.
        domicilioCalle: form.domicilioCalle,
        domicilioInterior: form.domicilioInterior || undefined,
        domicilioExterior: form.domicilioExterior || undefined,
        colonia: form.colonia,
        estado: form.estado,
        municipio: form.municipio,
        pais: form.pais,
        cp: form.cp,
        usoCFDI: form.usoCFDI,
        metodoPago: form.metodoPago,
      },
      bancario:
        form.banco || form.cuenta
          ? { banco: form.banco, cuenta: form.cuenta }
          : undefined,
      repLegal: {
        nombre: form.rep_nombre,
        apellidos: form.rep_apellidos,
        puesto: form.rep_puesto,
        telefono: form.rep_telefono,
        extension: form.rep_extension,
        email: form.rep_email,
      },
      rh: {
        nombre: form.rh_nombre,
        apellidos: form.rh_apellidos,
        puesto: form.rh_puesto,
        telefono: form.rh_telefono,
        extension: form.rh_extension,
        email: form.rh_email,
      },
      cuentasPagar: {
        nombre: form.cxp_nombre,
        apellidos: form.cxp_apellidos,
        puesto: form.cxp_puesto,
        telefono: form.cxp_telefono,
        extension: form.cxp_extension,
        email: form.cxp_email,
      },
      facturacion: {
        correoXml: form.correoXml,
        correoComplemento: form.correoComplemento,
        procesoFacturacion: form.procesoFacturacion,
      },
      // FIX-ARCH-20260624-05: horarios De/A + contacto estructurado.
      entregaFisica: form.dias.length > 0
        ? {
            dias: form.dias,
            horaDe: form.horaDe,
            minutoDe: form.minutoDe,
            horaA: form.horaA || undefined,
            minutoA: form.minutoA || undefined,
            contactoRecibe: {
              nombre: form.contactoRecibe.nombre || undefined,
              telefono: form.contactoRecibe.telefono || undefined,
              celular: form.contactoRecibe.celular || undefined,
            },
          }
        : undefined,
      referencias: form.referencias.filter(
        (r) => r.nombre || r.rfc || r.telefono || r.celular,
      ) as Array<{ nombre: string; rfc?: string; telefono?: string; celular?: string }>,
      documentos,
      terminosAceptados: true as const,
    }

    startTransition(async () => {
      // IMPL-20260624-01: Branch según source.
      const result =
        source === 'PUBLIC'
          ? await submitPublicCompanySelfRegistrationAction(payload)
          : await submitCompanySelfRegistrationAction(token!, payload)
      if (result.ok) {
        setSuccess({ companyId: result.companyId })
      } else {
        if (result.code === 'RFC_DUPLICATE') {
          setSubmitError(
            `El RFC ${form.rfc} ya está registrado. Si crees que es un error, contacta a tu vendedor.`
          )
        } else {
          setSubmitError(result.error)
        }
      }
    })
  }

  if (success) {
    return (
      <div className="max-w-xl mx-auto bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center">
        <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl">✓</div>
        <h1 className="text-2xl font-black text-slate-800 mt-4">¡Registro recibido!</h1>
        <p className="text-slate-600 mt-2 text-sm">
          Hemos recibido tu información. Un vendedor revisará los datos y te contactará para finalizar el alta.
        </p>
        <p className="text-xs text-slate-400 mt-3">Folio interno: {success.companyId.slice(0, 8)}</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto space-y-6 pb-12">
      <header className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-2xl font-black text-slate-800">Alta de Cliente</h1>
        <p className="text-sm text-slate-500 mt-1">
          Completa las 10 secciones. El link expira el{' '}
          <strong>{initial.expiresAtLabel}</strong>.
        </p>
      </header>

      {/* Sección 1: Información Fiscal */}
      <Section title="1. Información General y Fiscal" required>
        <Field label="Razón Social *">
          <input required value={form.razonSocial} onChange={(e) => setField('razonSocial', e.target.value)} className={inputClass} />
        </Field>
        <Field label="RFC *">
          <input required value={form.rfc} onChange={(e) => setField('rfc', e.target.value.toUpperCase())} className={`${inputClass} font-mono uppercase`} maxLength={13} pattern="[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}" />
        </Field>
        <Field label="Giro de la empresa *" hint="Industria o actividad principal">
          <input required value={form.giro} onChange={(e) => setField('giro', e.target.value)} className={inputClass} />
        </Field>
        {/* FIX-ARCH-20260624-05: Domicilio Fiscal en 3 inputs (calle req + int/ext opt) */}
        <Field label="Domicilio Fiscal (calle y número) *" hint="Calle y número exterior">
          <input required value={form.domicilioCalle} onChange={(e) => setField('domicilioCalle', e.target.value)} className={inputClass} placeholder="Ej. Av. Industrias 1234" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número Interior (opcional)">
            <input value={form.domicilioInterior} onChange={(e) => setField('domicilioInterior', e.target.value)} className={inputClass} maxLength={50} placeholder="Ej. 5" />
          </Field>
          <Field label="Número Exterior (opcional)">
            <input value={form.domicilioExterior} onChange={(e) => setField('domicilioExterior', e.target.value)} className={inputClass} maxLength={50} placeholder="Ej. B" />
          </Field>
        </div>
        <Field label="Colonia *">
          <input required value={form.colonia} onChange={(e) => setField('colonia', e.target.value)} className={inputClass} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estado *">
            <select required value={form.estado} onChange={(e) => setField('estado', e.target.value)} className={inputClass}>
              <option value="">Seleccionar…</option>
              {estados.map((e) => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </Field>
          <Field label="Municipio *">
            <input required value={form.municipio} onChange={(e) => setField('municipio', e.target.value)} className={inputClass} />
          </Field>
        </div>
        <Field label="País *">
          <input required value={form.pais} onChange={(e) => setField('pais', e.target.value)} className={inputClass} />
        </Field>
        <Field label="CP * (5 dígitos)">
          <input required value={form.cp} onChange={(e) => setField('cp', e.target.value)} className={inputClass} maxLength={5} pattern="[0-9]{5}" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Uso de CFDI *">
            <select required value={form.usoCFDI} onChange={(e) => setField('usoCFDI', e.target.value)} className={inputClass}>
              {/* FIX-20260805-03: Mostrar "CÓDIGO — Descripción" para que prospectos
                  no fiscales entiendan qué clave SAT están eligiendo. El value
                  sigue siendo solo el código (compatibilidad con Zod enum). */}
              {cfdiOptions.map((c) => (
                <option key={c} value={c}>
                  {c} — {SAT_CFDI_USO_DESCRIPTIONS[c as keyof typeof SAT_CFDI_USO_DESCRIPTIONS] ?? c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Método de Pago *">
            <select required value={form.metodoPago} onChange={(e) => setField('metodoPago', e.target.value)} className={inputClass}>
              <option value="PUE">PUE — Pago en una sola exhibición</option>
              <option value="PPD">PPD — Pago en parcialidades o diferido</option>
            </select>
          </Field>
        </div>
      </Section>

      {/* Sección 2: Datos Bancarios */}
      <Section title="2. Datos Bancarios (opcional)">
        <Field label="Banco Ordenante">
          <input value={form.banco} onChange={(e) => setField('banco', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Número de Cuenta">
          <input value={form.cuenta} onChange={(e) => setField('cuenta', e.target.value)} className={inputClass} />
        </Field>
      </Section>

      {/* Sección 3: Rep Legal */}
      <PersonaSection
        title="3. Representante Legal"
        prefix="rep_"
        values={{
          nombre: form.rep_nombre,
          apellidos: form.rep_apellidos,
          puesto: form.rep_puesto,
          telefono: form.rep_telefono,
          extension: form.rep_extension,
          email: form.rep_email,
        }}
        onChange={(k, v) => setField(`rep_${k}` as keyof typeof form, v)}
      />

      {/* Sección 4: RH */}
      <PersonaSection
        title="4. Responsable RH / Seguridad / Compras"
        prefix="rh_"
        values={{
          nombre: form.rh_nombre,
          apellidos: form.rh_apellidos,
          puesto: form.rh_puesto,
          telefono: form.rh_telefono,
          extension: form.rh_extension,
          email: form.rh_email,
        }}
        onChange={(k, v) => setField(`rh_${k}` as keyof typeof form, v)}
      />

      {/* Sección 5: Cuentas por Pagar */}
      <PersonaSection
        title="5. Responsable Cuentas por Pagar"
        prefix="cxp_"
        values={{
          nombre: form.cxp_nombre,
          apellidos: form.cxp_apellidos,
          puesto: form.cxp_puesto,
          telefono: form.cxp_telefono,
          extension: form.cxp_extension,
          email: form.cxp_email,
        }}
        onChange={(k, v) => setField(`cxp_${k}` as keyof typeof form, v)}
      />

      {/* Sección 6: Facturación y Envío de XML */}
      <Section title="6. Facturación y Envío de XML" required>
        <Field label="Correo recepción XML *">
          <input type="email" required value={form.correoXml} onChange={(e) => setField('correoXml', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Correo recepción complemento de pago (opcional)">
          <input type="email" value={form.correoComplemento} onChange={(e) => setField('correoComplemento', e.target.value)} className={inputClass} />
        </Field>
        <Field label="Proceso de facturación (textarea)">
          <textarea value={form.procesoFacturacion} onChange={(e) => setField('procesoFacturacion', e.target.value)} className={inputClass} rows={3} />
        </Field>
      </Section>

      {/* Sección 7: Entrega Física — FIX-ARCH-20260624-05: rango horario De/A + contacto estructurado */}
      <Section title="7. Entrega Física (opcional)">
        <p className="text-xs text-slate-500 -mt-1">
          Días y horario en que se pueden recibir facturas físicas en el domicilio fiscal.
        </p>
        <Field label="Días de entrega">
          <div className="flex flex-wrap gap-2">
            {([
              ['L', 'Lun'],
              ['M', 'Mar'],
              ['X', 'Mié'],
              ['J', 'Jue'],
              ['V', 'Vie'],
              ['S', 'Sáb'],
              ['D', 'Dom'],
            ] as const).map(([code, label]) => {
              const checked = form.dias.includes(code)
              return (
                <label key={code} className={`cursor-pointer select-none px-3 py-1.5 rounded-lg text-xs font-bold border ${checked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.dias, code]
                        : form.dias.filter((d) => d !== code)
                      setField('dias', next)
                    }}
                    className="hidden"
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </Field>
        {/* FIX-ARCH-20260624-05: combos HH:MM "De" (req si hay días) + "A" (opt) */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Horario De: *" hint="Hora de inicio de recepción">
            <div className="flex items-center gap-2">
              <select
                required
                value={form.horaDe}
                onChange={(e) => setField('horaDe', e.target.value)}
                className={inputClass}
              >
                {Array.from({ length: 24 }, (_, h) => h.toString().padStart(2, '0')).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span className="text-slate-500 font-bold">:</span>
              <select
                required
                value={form.minutoDe}
                onChange={(e) => setField('minutoDe', e.target.value)}
                className={inputClass}
              >
                {Array.from({ length: 60 }, (_, m) => m.toString().padStart(2, '0')).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </Field>
          <Field label="Horario A: (opcional)" hint="Hora de cierre de recepción">
            <div className="flex items-center gap-2">
              <select
                value={form.horaA}
                onChange={(e) => setField('horaA', e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {Array.from({ length: 24 }, (_, h) => h.toString().padStart(2, '0')).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <span className="text-slate-500 font-bold">:</span>
              <select
                value={form.minutoA}
                onChange={(e) => setField('minutoA', e.target.value)}
                className={inputClass}
              >
                <option value="">—</option>
                {Array.from({ length: 60 }, (_, m) => m.toString().padStart(2, '0')).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </Field>
        </div>
        {/* FIX-ARCH-20260624-05: contacto estructurado (3 inputs) en lugar de textarea libre */}
        <div className="grid grid-cols-3 gap-3">
          <Field label="Contacto Recibe — Nombre">
            <input
              value={form.contactoRecibe.nombre}
              onChange={(e) => setField('contactoRecibe', { ...form.contactoRecibe, nombre: e.target.value })}
              className={inputClass}
              maxLength={255}
              placeholder="Ej. María García"
            />
          </Field>
          <Field label="Teléfono">
            <input
              value={form.contactoRecibe.telefono}
              onChange={(e) => setField('contactoRecibe', { ...form.contactoRecibe, telefono: e.target.value })}
              className={inputClass}
              maxLength={40}
              placeholder="Ej. 4421234500"
            />
          </Field>
          <Field label="Celular">
            <input
              value={form.contactoRecibe.celular}
              onChange={(e) => setField('contactoRecibe', { ...form.contactoRecibe, celular: e.target.value })}
              className={inputClass}
              maxLength={40}
              placeholder="Ej. 4425556677"
            />
          </Field>
        </div>
      </Section>

      {/* FIX-FRANK-20260731-01: Sección 8 — Crédito y Referencias Comerciales.
          Leyenda de contacto para solicitar crédito + 3 referencias comerciales
          (nombre, RFC, teléfono, celular). Es opcional llenar si NO requiere crédito;
          el filtro en el submit deja fuera entradas vacías. */}
      <Section title="8. Crédito y Referencias Comerciales (opcional)">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-2">
          <p className="font-semibold mb-1">Solicitudes de Crédito</p>
          <p>
            En caso de requerir crédito favor de comunicarse al{' '}
            <strong>442-480-05-48</strong> a la extensión <strong>102</strong> o al
            correo <strong>cuentasxcobrar@medicaindustrial.com</strong>.
          </p>
        </div>
        <p className="text-xs text-slate-500 -mt-1 mb-3">
          Favor de colocar 3 referencias comerciales en caso de solicitar crédito.
          Cada referencia requiere: nombre del contacto, RFC, teléfono y celular.
          Deja los campos vacíos si no aplica.
        </p>
        <div className="space-y-5">
          {form.referencias.map((r, idx) => (
            <div key={idx} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">
                Referencia #{idx + 1}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Field label="Nombre del contacto">
                  <input
                    value={r.nombre}
                    onChange={(e) => setReferencia(idx as 0 | 1 | 2, 'nombre', e.target.value)}
                    className={inputClass}
                    maxLength={255}
                    placeholder="Ej. Juan Pérez"
                  />
                </Field>
                <Field label="RFC">
                  <input
                    value={r.rfc}
                    onChange={(e) => setReferencia(idx as 0 | 1 | 2, 'rfc', e.target.value.toUpperCase())}
                    className={inputClass}
                    maxLength={13}
                    placeholder="XAXX010101000"
                  />
                </Field>
                <Field label="Teléfono">
                  <input
                    value={r.telefono}
                    onChange={(e) => setReferencia(idx as 0 | 1 | 2, 'telefono', e.target.value)}
                    className={inputClass}
                    maxLength={40}
                    placeholder="Ej. 4421234500"
                  />
                </Field>
                <Field label="Celular">
                  <input
                    value={r.celular}
                    onChange={(e) => setReferencia(idx as 0 | 1 | 2, 'celular', e.target.value)}
                    className={inputClass}
                    maxLength={40}
                    placeholder="Ej. 4425556677"
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Sección 9: Documentación Adjunta */}
      <Section title="9. Documentación Adjunta" required>
        <p className="text-xs text-slate-500 -mt-1">
          Formatos: gif, jpg, jpeg, png, pdf, doc, docx, zip.
        </p>
        {(['constanciaFiscal', 'identificacionRepLegal', 'comprobanteDomicilio', 'opinionSat', 'actaConstitutiva', 'otraDocumentacion'] as SeccionDoc[]).map((sec) => (
          <FileUploadField
            key={sec}
            seccion={sec}
            label={SECCION_LABELS[sec]}
            current={uploads[sec]}
            isUploading={uploading[sec]}
            onFile={(f) => handleUpload(sec, f)}
            onClear={() => setUploads((u) => ({ ...u, [sec]: null }))}
          />
        ))}
      </Section>

      {/* Sección 10: Términos */}
      <Section title="10. Términos y Condiciones" required>
        {/* FIX-FRANK-20260731-01: leyenda obligatoria visible ANTES del checkbox de aceptación. */}
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4">
          <p className="font-bold mb-2">Importante:</p>
          <p>
            Solo se podrá cancelar la factura dos días hábiles después de haber sido ingresada a
            revisión, en caso de solicitar cancelación posterior el cliente respetará los días de
            crédito en que se realizó la primera factura, en caso de no realizar el pago en tiempo y
            forma el cliente pagará el 5% de morosidad, el tener facturas pendiente de pago ocasiona
            que AMI SALUD RESPONSABLE SC opte por dejar de prestar los servicios o productos que
            le brinda hasta que se regularice en cuestión de pagos, autorizaciones pendientes y
            órdenes de compra no enviadas.
          </p>
        </div>
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.terminos}
            onChange={(e) => setField('terminos', e.target.checked)}
            className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          <span className="text-sm text-slate-700">
            Acepto los términos estipulados en la presente "Alta de Cliente"
          </span>
        </label>
      </Section>

      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
          ⚠️ {submitError}
        </div>
      )}

      <div className="sticky bottom-0 bg-white p-4 rounded-2xl border border-slate-200 shadow-lg flex justify-end gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-indigo-100 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50"
        >
          {isPending ? 'Enviando…' : 'Enviar solicitud de alta'}
        </button>
      </div>
    </form>
  )
}

const inputClass = 'w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3 rounded-lg text-sm transition-all outline-none'

function Section({ title, required, children }: { title: string; required?: boolean; children: React.ReactNode }) {
  return (
    <section className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider">{title}{required && <span className="text-red-500"> *</span>}</h2>
      {children}
    </section>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-bold text-slate-500 uppercase">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

function PersonaSection({
  title,
  values,
  onChange,
}: {
  title: string
  prefix: string
  values: { nombre: string; apellidos: string; puesto: string; telefono: string; extension: string; email: string }
  onChange: (k: 'nombre' | 'apellidos' | 'puesto' | 'telefono' | 'extension' | 'email', v: string) => void
}) {
  return (
    <Section title={title} required>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre *"><input required value={values.nombre} onChange={(e) => onChange('nombre', e.target.value)} className={inputClass} /></Field>
        <Field label="Apellidos *"><input required value={values.apellidos} onChange={(e) => onChange('apellidos', e.target.value)} className={inputClass} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Puesto *"><input required value={values.puesto} onChange={(e) => onChange('puesto', e.target.value)} className={inputClass} /></Field>
        <Field label="Teléfono *"><input required value={values.telefono} onChange={(e) => onChange('telefono', e.target.value)} className={inputClass} minLength={7} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ext. (opcional)"><input value={values.extension} onChange={(e) => onChange('extension', e.target.value)} className={inputClass} /></Field>
        <Field label="Email *"><input type="email" required value={values.email} onChange={(e) => onChange('email', e.target.value)} className={inputClass} /></Field>
      </div>
    </Section>
  )
}

function FileUploadField({
  seccion: _seccion, // IMPL-20260623-03 (Fase 7.1): reservado para futuros tags/agrupado por sección; no usado todavía.
  label,
  current,
  isUploading,
  onFile,
  onClear,
}: {
  seccion: SeccionDoc
  label: string
  current: UploadedFile | null
  isUploading: boolean
  onFile: (file: File) => void
  onClear: () => void
}) {
  // El eslint config del proyecto no respeta argsIgnorePattern, por lo que
  // prefijar con _ no basta: usamos `void` para marcar uso intencional y
  // satisfacer `@typescript-eslint/no-unused-vars`.
  void _seccion
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
      <div className="flex-1">
        <p className="text-sm font-bold text-slate-700">{label}</p>
        {current ? (
          <p className="text-xs text-emerald-600 mt-1">
            ✓ {current.filename} ({(current.size / 1024).toFixed(0)} KB)
          </p>
        ) : (
          <p className="text-xs text-slate-400 mt-1">Pendiente</p>
        )}
      </div>
      {current ? (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-red-500 hover:text-red-700 font-bold"
        >
          Quitar
        </button>
      ) : (
        <label className="cursor-pointer bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
          {isUploading ? 'Subiendo…' : 'Subir'}
          <input
            type="file"
            className="hidden"
            disabled={isUploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onFile(f)
              e.target.value = ''
            }}
          />
        </label>
      )}
    </div>
  )
}

// Helper: hashear token con Web Crypto (cliente)
async function getTokenHashFromClient(token: string): Promise<string> {
  const enc = new TextEncoder().encode(token)
  const buf = await crypto.subtle.digest('SHA-256', enc)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
