'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  createCompany,
  getBranches,
} from '@/actions/admin.actions'
import {
  listActiveSellersAction,
  generateCompanySelfRegLinkAction,
  generateCompanyDataCompletionLinkAction,
} from '@/actions/company.actions'
import { isSellerLike } from '@/lib/auth/roles'

/**
 * @file Modal de creación rápida de empresa + generador de link de auto-alta.
 * @id IMPL-20260623-02 / IMPL-20260624-03
 * @backup context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md
 *
 * IMPL-20260624-03 (ARCH-20260624-03) Sub-A: en modo edición (mode='edit' +
 * existingCompany presente), muestra el botón "🔗 Generar link para que la
 * empresa complete sus datos". El botón se renderiza solo si:
 *  - El usuario es ADMIN o VENDEDOR.
 *  - La Company NO está en PENDIENTE_REVISION.
 *
 * Firma retrocompatible: si no se pasan props, el modal funciona como creación
 * rápida (comportamiento previo). Los nuevos props son opcionales.
 */
export default function CompanyFormModal(props?: {
  existingCompany?: {
    id: string
    name: string
    estado: 'HABILITADO' | 'PENDIENTE_REVISION' | 'DESHABILITADO'
  } | null
  mode?: 'create' | 'edit'
  role?: string | null
}) {
    const existingCompany = props?.existingCompany
    const mode = props?.mode ?? 'create'
    const role = props?.role ?? null
    const showCompletionLinkButton =
      mode === 'edit' &&
      existingCompany != null &&
      existingCompany.estado !== 'PENDIENTE_REVISION' &&
      isSellerLike(role)

    const [isOpen, setIsOpen] = useState(false)
    const [isPending, startTransition] = useTransition()
    const [successData, setSuccessData] = useState<{ success: boolean, company?: { id: string, name: string } } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [branches, setBranches] = useState<{ id: string, name: string }[]>([])
    const [sellers, setSellers] = useState<{ id: string, fullName: string, email: string }[]>([])
    const [sellerId, setSellerId] = useState<string>('')
    const [enabled, setEnabled] = useState<boolean>(true)
    const [selfRegLink, setSelfRegLink] = useState<string | null>(null)
    const [selfRegCopied, setSelfRegCopied] = useState<boolean>(false)
    const [completionLinkUrl, setCompletionLinkUrl] = useState<string | null>(null)
    const [completionLinkExpiresAt, setCompletionLinkExpiresAt] = useState<string | null>(null)
    const [completionLinkError, setCompletionLinkError] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        if (isOpen) {
            getBranches().then((data) => setBranches(data))
            listActiveSellersAction().then((data) => setSellers(data))
        }
    }, [isOpen])

    async function handleSubmit(formData: FormData) {
        startTransition(async () => {
            setError(null)
            try {
                // El modal rápido sigue delegando al createCompany existente (admin.actions)
                // que sólo guarda los 5 campos básicos. La asignación de vendedor y
                // habilitado se aplican después vía updateCompany extendido (vía modal de edición).
                formData.set('sellerId', sellerId)
                formData.set('enabled', enabled ? 'true' : 'false')
                const result = (await createCompany(formData)) as {
                    success: boolean
                    company?: { id: string, name: string }
                    error?: string
                }
                if (result.success) {
                    setSuccessData(result)
                    router.refresh()
                } else {
                    setError(result.error || 'Error al guardar')
                }
            } catch {
                setError('Error de conexión')
            }
        })
    }

    async function handleGenerateLink() {
        startTransition(async () => {
            try {
                const result = await generateCompanySelfRegLinkAction(168)
                if (result.ok) {
                    setSelfRegLink(result.url)
                    setSelfRegCopied(false)
                } else {
                    setError(result.error || 'No se pudo generar el link')
                }
            } catch {
                setError('Error generando link de auto-alta')
            }
        })
    }

    /**
     * IMPL-20260624-03 (ARCH-20260624-03) Sub-A: genera link para que la
     * empresa complete sus datos completos a través de un portal externo.
     */
    async function handleGenerateCompletionLink() {
        if (!existingCompany) return
        startTransition(async () => {
            setCompletionLinkError(null)
            try {
                const result = await generateCompanyDataCompletionLinkAction(existingCompany.id, 168)
                if (result.ok) {
                    setCompletionLinkUrl(result.url)
                    setCompletionLinkExpiresAt(
                    result.expiresAt instanceof Date
                      ? result.expiresAt.toISOString()
                      : String(result.expiresAt ?? '')
                  )
                } else {
                    setCompletionLinkError(result.error || 'No se pudo generar el link')
                }
            } catch {
                setCompletionLinkError('Error generando link de completar datos')
            }
        })
    }

    function copyLink(url: string, setCopied: (b: boolean) => void) {
        if (!url) return
        navigator.clipboard.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        })
    }

    if (successData) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in duration-300">
                <div className="bg-white p-8 rounded-[2rem] shadow-2xl max-w-sm w-full text-center space-y-6">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-4xl animate-bounce">
                        🏢
                    </div>
                    <div>
                        <h3 className="text-2xl font-black text-slate-800">¡Empresa Registrada!</h3>
                        <p className="text-slate-500 mt-2 text-sm font-medium">El convenio ha sido creado exitosamente.</p>
                    </div>
                    <div className="space-y-3 pt-2">
                        <Link
                            href="/workers"
                            className="block w-full bg-slate-900 hover:bg-black text-white py-3 rounded-xl font-bold transition-all hover:scale-[1.02]"
                        >
                            ➕ Registrar Trabajadores
                        </Link>
                        <button
                            onClick={() => { setSuccessData(null); setIsOpen(false); }}
                            className="block w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold transition-all"
                        >
                            Ver Directorio
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={handleGenerateLink}
                disabled={isPending}
                className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                title="Genera un link público de auto-alta (168h)"
            >
                🔗 Link Auto-Alta
            </button>
            {/* IMPL-20260624-03 (ARCH-20260624-03) Sub-A: botón visible solo en modo edición + RBAC + estado HABILITADO */}
            {showCompletionLinkButton && (
                <button
                    type="button"
                    onClick={handleGenerateCompletionLink}
                    disabled={isPending}
                    className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                    title="Genera un link para que la empresa complete sus datos completos"
                >
                    🔗 Generar link para que la empresa complete sus datos
                </button>
            )}
            <button
                onClick={() => setIsOpen(true)}
                className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-xl text-sm font-bold transition-all shadow-lg shadow-slate-200 flex items-center gap-2"
            >
                <span className="text-lg">+</span> Nueva Empresa
            </button>

            {selfRegLink && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full space-y-4">
                        <h3 className="text-lg font-black text-slate-800">Link de auto-alta generado</h3>
                        <p className="text-sm text-slate-600">
                            Comparte este link con el prospecto. Expira en 168 horas (7 días).
                            El token se mostrará solo esta vez.
                        </p>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 break-all text-xs font-mono text-slate-700">
                            {selfRegLink}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => copyLink(selfRegLink, setSelfRegCopied)}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold text-sm"
                            >
                                {selfRegCopied ? '✓ Copiado' : 'Copiar link'}
                            </button>
                            <button
                                onClick={() => setSelfRegLink(null)}
                                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-bold text-sm"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* IMPL-20260624-03 (ARCH-20260624-03) Sub-A: modal con URL para completar datos */}
            {completionLinkUrl && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
                    <div className="bg-white p-6 rounded-2xl shadow-2xl max-w-lg w-full space-y-4">
                        <h3 className="text-lg font-black text-slate-800">Link para completar datos generado</h3>
                        <p className="text-sm text-slate-600">
                            Este enlace es válido por 168 horas y permite a la empresa completar o
                            actualizar su información. Comparte el enlace de forma segura.
                        </p>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 break-all text-xs font-mono text-slate-700">
                            {completionLinkUrl}
                        </div>
                        {completionLinkExpiresAt && (
                            <p className="text-[10px] text-slate-500">
                                Expira: {new Date(completionLinkExpiresAt).toLocaleString('es-MX')}
                            </p>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={() => copyLink(completionLinkUrl, () => {})}
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-bold text-sm"
                            >
                                Copiar link
                            </button>
                            <button
                                onClick={() => {
                                    setCompletionLinkUrl(null)
                                    setCompletionLinkExpiresAt(null)
                                }}
                                className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg font-bold text-sm"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {completionLinkError && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-xs">
                    ⚠️ {completionLinkError}
                </div>
            )}

            {isOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-indigo-500"></div>

                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-slate-800">Registrar Convenio</h3>
                                <p className="text-[10px] text-slate-400 uppercase font-extrabold tracking-widest mt-1">Nuevo Cliente Corporativo</p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-full">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>

                        <form action={handleSubmit} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Razón Social</label>
                                <input name="name" placeholder="Ej: Aceros del Norte S.A." required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none" />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">RFC / Tax ID</label>
                                <input name="rfc" placeholder="ABC010101XYZ" required className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none uppercase font-mono" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Contacto</label>
                                    <input name="contactName" placeholder="Nombre" className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Email</label>
                                    <input name="email" placeholder="email@ejemplo.com" type="email" className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none" />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Sucursal Predeterminada</label>
                                <select name="defaultBranchId" className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none">
                                    <option value="">Seleccionar Sucursal...</option>
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>{b.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Vendedor asignado</label>
                                <select
                                    name="sellerIdSelect"
                                    value={sellerId}
                                    onChange={(e) => setSellerId(e.target.value)}
                                    className="w-full bg-slate-50 border-none ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 p-3.5 rounded-xl text-sm transition-all outline-none"
                                >
                                    <option value="">Sin asignar (asignar después)</option>
                                    {sellers.map((s) => (
                                        <option key={s.id} value={s.id}>{s.fullName}</option>
                                    ))}
                                </select>
                                {sellers.length === 0 && (
                                    <p className="text-[10px] text-slate-400 ml-1 mt-1">
                                        No hay usuarios con rol VENDEDOR activos. Créalos desde el módulo de Usuarios.
                                    </p>
                                )}
                            </div>

                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    name="enabledCheckbox"
                                    checked={enabled}
                                    onChange={(e) => setEnabled(e.target.checked)}
                                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-xs font-bold text-slate-600">Empresa habilitada</span>
                                <span className="text-[10px] text-slate-400">(desmarcar para dejar pendiente)</span>
                            </label>

                            {error && <p className="text-xs text-red-500 font-bold bg-red-50 p-3 rounded-lg border border-red-100 animate-shake">⚠️ {error}</p>}

                            <button
                                type="submit"
                                disabled={isPending}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 mt-4"
                            >
                                {isPending ? 'Procesando...' : 'Guardar y Continuar →'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
