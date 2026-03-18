'use client'
/**
 * Panel de Sucursales Permitidas por Empresa — Checkboxes multi-sucursal
 * @description Permite marcar qué sucursales tiene autorizadas una empresa cliente.
 *              Guarda mediante updateCompanyAllowedBranches (set completo).
 * @id IMPL-20260318-09
 */
import { useState, useTransition } from 'react'
import { updateCompanyAllowedBranches } from '@/actions/company.actions'

interface Branch {
    id: string
    name: string
}

interface AllowedBranchesPanelProps {
    companyId: string
    allBranches: Branch[]
    /** IDs de sucursales actualmente permitidas para esta empresa */
    initialAllowedIds: string[]
}

export default function AllowedBranchesPanel({
    companyId,
    allBranches,
    initialAllowedIds,
}: AllowedBranchesPanelProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set(initialAllowedIds))
    const [isPending, startTransition] = useTransition()
    const [saved, setSaved] = useState(false)
    const [error, setError] = useState<string | null>(null)

    function toggle(branchId: string) {
        setSelected(prev => {
            const next = new Set(prev)
            if (next.has(branchId)) {
                next.delete(branchId)
            } else {
                next.add(branchId)
            }
            return next
        })
        setSaved(false)
    }

    function handleSave() {
        setError(null)
        setSaved(false)
        startTransition(async () => {
            const result = await updateCompanyAllowedBranches(companyId, Array.from(selected))
            if (result.success) {
                setSaved(true)
            } else {
                setError(result.error || 'Error al guardar')
            }
        })
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-base font-bold text-slate-800">Sucursales Permitidas</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Selecciona las sucursales a las que esta empresa puede enviar trabajadores.
                        Si ninguna está marcada, el modal de citas usará todas como fallback.
                    </p>
                </div>
                <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    🏥
                </div>
            </div>

            {allBranches.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No hay sucursales registradas en el sistema.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {allBranches.map(branch => {
                        const isChecked = selected.has(branch.id)
                        return (
                            <label
                                key={branch.id}
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all select-none ${
                                    isChecked
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggle(branch.id)}
                                    className="w-4 h-4 accent-blue-600 flex-shrink-0"
                                />
                                <span className={`text-sm font-bold ${isChecked ? 'text-blue-800' : 'text-slate-700'}`}>
                                    {branch.name}
                                </span>
                            </label>
                        )
                    })}
                </div>
            )}

            <div className="flex items-center gap-3 pt-2">
                <button
                    onClick={handleSave}
                    disabled={isPending || allBranches.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                >
                    {isPending ? 'Guardando...' : 'Guardar Sucursales'}
                </button>
                {saved && (
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100">
                        ✓ Guardado
                    </span>
                )}
                {error && (
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                        ⚠️ {error}
                    </span>
                )}
            </div>
        </div>
    )
}
