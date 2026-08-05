/**
 * @file Modal bloqueante para restaurar draft de SelfRegistrationForm.
 * @id FIX-20260805-04
 * @spec context/SPECs/SPEC_FIX-20260805-04-DRAFT-AUTOSAVE-SELF-REGISTRATION.md
 *
 * Decisión D3: bloqueante, sin cerrar con Esc ni click outside — fuerza
 * elección explícita del usuario (caso borde #11).
 */
'use client'

import { useMemo } from 'react'

import type { SelfRegDraft } from '@/lib/self-reg-draft'

interface DraftRestoreModalProps {
  draft: SelfRegDraft
  onContinue: () => void
  onStartFresh: () => void
}

/**
 * FIX B3: Determina si un valor arbitrario es "no vacío" para el preview.
 * Recursivo: para arrays de objetos (caso `referencias` que contiene 3
 * sub-objetos vacíos por default), se considera no-vacío solo si ALGUN
 * sub-objeto tiene al menos un valor de string no-vacío. La versión
 * anterior contaba arrays de objetos como "con datos" siempre
 * (typeof {} !== 'string').
 */
function hasNonEmptyValue(v: unknown): boolean {
  if (v === undefined || v === null) return false
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'boolean') return v === true
  if (Array.isArray(v)) return v.some(hasNonEmptyValue)
  if (typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).some(hasNonEmptyValue)
  }
  return false
}

/**
 * FIX B3 (Opción A): Defaults puros del useState inicial del
 * SelfRegistrationFormActive. No son informativos del progreso del
 * prospecto, así que se excluyen del preview "X de N secciones con datos".
 *
 * Estructura: { fieldName: defaultValue } para distinguir el default de
 * un valor que el usuario eligió. Si el campo tiene OTRO valor, la sección
 * correspondiente SÍ cuenta.
 *
 * Mantener sincronizado con los defaults en `SelfRegistrationForm.tsx`
 * (líneas ~243-306 del useState `form`).
 */
const FORM_DEFAULT_VALUES: Readonly<Record<string, unknown>> = {
  usoCFDI: 'G03',
  metodoPago: 'PUE',
  pais: 'México',
  horaDe: '09',
}

/**
 * ¿El campo es un default puro del form (no user-entered)?
 */
function isFieldDefault(field: string, value: unknown): boolean {
  const def = FORM_DEFAULT_VALUES[field]
  if (def === undefined) return false
  return def === value
}

/**
 * Cuenta cuántas "secciones" del form tienen al menos un valor no-vacío
 * introducido por el usuario (excluyendo defaults puros del useState — B3).
 *
 * Lista enumerada según campos del SelfRegistrationFormActive.
 */
function summarizeForm(form: Record<string, unknown>): { filled: number; total: number } {
  // Sub-secciones semánticas del form (coinciden con secciones en el archivo
  // SelfRegistrationForm.tsx). Cada sub-sección cuenta como "con datos" si
  // alguno de sus campos tiene valor introducido por el usuario.
  const groups: Array<{ name: string; fields: string[] }> = [
    { name: 'Información fiscal', fields: ['razonSocial', 'rfc', 'giro', 'domicilioCalle', 'colonia', 'estado', 'municipio', 'cp', 'usoCFDI', 'metodoPago'] },
    { name: 'Datos bancarios', fields: ['banco', 'cuenta'] },
    { name: 'Representante legal', fields: ['rep_nombre', 'rep_apellidos', 'rep_puesto', 'rep_telefono', 'rep_email'] },
    { name: 'Recursos Humanos', fields: ['rh_nombre', 'rh_apellidos', 'rh_puesto', 'rh_telefono', 'rh_email'] },
    { name: 'Cuentas por pagar', fields: ['cxp_nombre', 'cxp_apellidos', 'cxp_puesto', 'cxp_telefono', 'cxp_email'] },
    { name: 'Facturación', fields: ['correoXml', 'correoComplemento', 'procesoFacturacion'] },
    { name: 'Entrega física', fields: ['dias', 'horaDe', 'horaA', 'contactoRecibe'] },
    { name: 'Referencias comerciales', fields: ['referencias'] },
    { name: 'Términos', fields: ['terminos'] },
    { name: 'País', fields: ['pais'] },
  ]
  let filled = 0
  for (const g of groups) {
    const any = g.fields.some((f) => {
      const v = form[f]
      // FIX B3: si el campo tiene su default puro, no cuenta como
      // progreso del usuario (pero si tiene OTRO valor, sí cuenta).
      if (FORM_DEFAULT_VALUES[f] !== undefined && isFieldDefault(f, v)) {
        return false
      }
      return hasNonEmptyValue(v)
    })
    if (any) filled += 1
  }
  return { filled, total: groups.length }
}

function summarizeUploads(uploads: Record<string, unknown> | null): Array<{ seccion: string; filename: string }> {
  if (!uploads) return []
  const out: Array<{ seccion: string; filename: string }> = []
  for (const [seccion, value] of Object.entries(uploads)) {
    if (!value) continue
    const v = value as { filename?: string } | null
    if (v && typeof v.filename === 'string' && v.filename.length > 0) {
      out.push({ seccion, filename: v.filename })
    }
  }
  return out
}

export function DraftRestoreModal({ draft, onContinue, onStartFresh }: DraftRestoreModalProps) {
  const formSummary = useMemo(() => summarizeForm(draft.form), [draft.form])
  const uploadsList = useMemo(() => summarizeUploads(draft.uploads), [draft.uploads])
  const savedAtLabel = useMemo(() => {
    try {
      return new Date(draft.savedAt).toLocaleString('es-MX', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }, [draft.savedAt])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="draft-restore-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      // Bloqueante: sin onClick de dismiss. Sin handler de keydown (Esc no cierra).
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6">
        <h2 id="draft-restore-title" className="text-xl font-black text-slate-800">
          Tienes un borrador guardado
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Detectamos un borrador de un intento previo{savedAtLabel ? ` (${savedAtLabel})` : ''}. ¿Quieres continuar donde te quedaste o empezar de nuevo?
        </p>

        <div className="mt-4 bg-slate-50 rounded-lg p-4 text-sm text-slate-700 space-y-2">
          <div>
            <strong>{formSummary.filled}</strong> de {formSummary.total} secciones con datos.
          </div>
          {uploadsList.length > 0 && (
            <div>
              <div className="font-bold text-slate-800">Archivos subidos:</div>
              <ul className="list-disc list-inside">
                {uploadsList.map((u) => (
                  <li key={u.seccion}>
                    <span className="text-slate-500">{u.seccion}:</span> {u.filename}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            type="button"
            onClick={onStartFresh}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
          >
            Empezar de nuevo
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="px-4 py-2 rounded-lg text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Continuar donde me quedé
          </button>
        </div>
      </div>
    </div>
  )
}