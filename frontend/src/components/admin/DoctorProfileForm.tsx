/**
 * @fileoverview Formulario client para el perfil médico (cédula + firma).
 * @id IMPL-FEATURE-20260825-01
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Accesible para SUPERADMIN / DOCTOR_GENERAL / DOCTOR_VALIDADOR. La
 * server action `updateCurrentDoctorProfile` es la fuente de verdad para
 * la validación (Zod). Aquí se hace validación cliente espejo sólo para
 * UX inmediata, pero el schema se importa para mantener un solo contrato.
 *
 * La firma se sube como imagen (PNG/JPEG) y se convierte a data-URL antes
 * de enviar al servidor. No añadimos dependencia de SignaturePad para
 * mantener el incremento mínimo y reversible (la SPEC no exige captura
 * digital en pantalla; basta con subir una imagen preexistente).
 */
'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import {
  getCurrentDoctorProfile,
  updateCurrentDoctorProfile,
  type DoctorProfileResult,
} from '@/actions/doctor-profile.actions'
import { doctorProfileSchema } from '@/schemas/clinical/doctor-profile.schema'

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024 // 2 MB

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result === 'string') resolve(result)
      else reject(new Error('El lector devolvió un resultado no string'))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Error al leer el archivo'))
    reader.readAsDataURL(file)
  })
}

export default function DoctorProfileForm() {
  const [profile, setProfile] = useState<DoctorProfileResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [professionalLicense, setProfessionalLicense] = useState('')
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await getCurrentDoctorProfile()
      if (cancelled) return
      if (!res.success) {
        setError(res.error)
        setLoading(false)
        return
      }
      setProfile(res.profile)
      setFullName(res.profile.fullName)
      setProfessionalLicense(res.profile.professionalLicense ?? '')
      setSignaturePreview(res.profile.signatureImageUrl)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSignatureFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
      setError('La firma debe ser PNG o JPEG.')
      return
    }
    if (file.size > MAX_SIGNATURE_BYTES) {
      setError('La firma no puede pesar más de 2 MB.')
      return
    }
    try {
      const dataUrl = await readFileAsDataUrl(file)
      setSignaturePreview(dataUrl)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo leer la imagen')
    }
  }

  const handleClearSignature = () => {
    setSignaturePreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    const payload = {
      fullName: fullName.trim(),
      professionalLicense: professionalLicense.trim(),
      signatureImageUrl: signaturePreview ?? '',
    }
    const parsed = doctorProfileSchema.safeParse(payload)
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Datos inválidos')
      return
    }

    startTransition(async () => {
      const res = await updateCurrentDoctorProfile({
        fullName: parsed.data.fullName,
        professionalLicense: parsed.data.professionalLicense ?? '',
        signatureImageUrl: parsed.data.signatureImageUrl ?? '',
      })
      if (!res.success) {
        setError(res.error)
        return
      }
      setProfile(res.profile)
      setSuccessMsg('Perfil actualizado.')
    })
  }

  if (loading) {
    return (
      <div className="text-sm text-slate-500" data-testid="doctor-profile-loading">
        Cargando perfil…
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
        {error ?? 'No se pudo cargar el perfil.'}
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5"
      data-testid="doctor-profile-form"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Correo (sólo lectura)
          </label>
          <input
            type="email"
            value={profile.email}
            readOnly
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-500"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">
            Rol (sólo lectura)
          </label>
          <input
            type="text"
            value={profile.role}
            readOnly
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          Nombre completo *
        </label>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Nombre(s) Apellido Paterno Apellido Materno"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-none"
          data-testid="doctor-profile-fullName"
          required
        />
        <p className="text-[11px] text-slate-400 mt-1">
          Aparecerá en el membrete y pie de firma del PDF validado de Espirometría.
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          Cédula profesional
        </label>
        <input
          type="text"
          value={professionalLicense}
          onChange={(e) => setProfessionalLicense(e.target.value)}
          placeholder="Ej. 1234567 o AE123456-7"
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 outline-none"
          data-testid="doctor-profile-license"
        />
        <p className="text-[11px] text-slate-400 mt-1">
          4–20 caracteres (letras, dígitos, guion, espacio).
        </p>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">
          Firma autógrafa (PNG/JPEG, ≤2 MB)
        </label>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg"
          onChange={handleSignatureFile}
          className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100"
          data-testid="doctor-profile-signature-input"
        />
        {signaturePreview ? (
          <div className="mt-3 flex items-start gap-3">
            <img
              src={signaturePreview}
              alt="Vista previa de firma"
              className="h-16 max-w-[200px] object-contain border border-slate-200 rounded bg-white p-1"
            />
            <button
              type="button"
              onClick={handleClearSignature}
              className="text-xs text-red-600 hover:text-red-800 underline"
            >
              Quitar firma
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-amber-700 mt-1">
            ⚠️ Sin firma cargada. No podrás generar PDF validado de Espirometría hasta registrar una.
          </p>
        )}
      </div>

      {error && (
        <p
          className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2"
          data-testid="doctor-profile-error"
        >
          {error}
        </p>
      )}
      {successMsg && (
        <p
          className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2"
          data-testid="doctor-profile-success"
        >
          {successMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full md:w-auto py-2 px-6 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        data-testid="doctor-profile-submit"
      >
        {isPending ? 'Guardando…' : 'Guardar perfil'}
      </button>
    </form>
  )
}
