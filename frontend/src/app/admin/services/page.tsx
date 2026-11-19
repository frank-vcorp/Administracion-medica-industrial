/**
 * @fileoverview Catálogo de pruebas con filtrado por categoría, duración teórica (min) y estado de calibración IA
 * @id ARCH-20260325-01
 * @backup context/checkpoints/CHK_ARCH-20260325-01.md
 */
import Link from "next/link"
import {
    createMedicalTest,
    getMedicalTestsWithCalibration,
    getTestCategories,
} from "@/actions/medical-profiles"
import { MedicalServicesCatalogTable } from "@/components/admin/MedicalServicesCatalogTable"
import { getMedicalTestCalibrationStatus } from "@/lib/clinical/calibration-status"

async function createMedicalTestFormAction(formData: FormData): Promise<void> {
    'use server'

    const result = await createMedicalTest(formData)
    if (!result.success) {
        throw new Error(result.error)
    }
}

// searchParams es Promise en Next.js 16 (App Router)
export default async function AdminServicesPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; status?: string }>
}) {
    const { category, status } = await searchParams
    const [allTests, categories] = await Promise.all([
        getMedicalTestsWithCalibration(),
        getTestCategories(),
    ])

    const enrichedTests = allTests.map((test) => ({
        ...test,
        calibration: getMedicalTestCalibrationStatus(test.options),
    }))

    const totalCalibrated = enrichedTests.filter((t) => t.calibration.kind === 'calibrated').length
    const totalPending = enrichedTests.filter((t) => t.calibration.needsCalibration).length
    const totalManual = enrichedTests.filter((t) => t.calibration.kind === 'manual_service').length

    const byCategory = category
        ? enrichedTests.filter((test) => test.categoryId === category)
        : enrichedTests

    const tests =
        status === 'pending'
            ? byCategory.filter((t) => t.calibration.needsCalibration)
            : status === 'calibrated'
              ? byCategory.filter((t) => t.calibration.kind === 'calibrated')
              : byCategory

    const categoryTabs = [
        { value: '', label: 'Todas las pruebas' },
        ...categories.map((testCategory) => ({
            value: testCategory.id,
            label: testCategory.name,
        })),
    ]

    function buildFilterHref(nextCategory?: string, nextStatus?: string) {
        const params = new URLSearchParams()
        if (nextCategory) params.set('category', nextCategory)
        if (nextStatus) params.set('status', nextStatus)
        const qs = params.toString()
        return qs ? `/admin/services?${qs}` : '/admin/services'
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center gap-4 flex-wrap">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Catálogo de pruebas</h2>
                    <p className="text-sm text-slate-500">
                        Estudios clínicos, laboratorio y gabinete con su duración teórica en clínica. Los prompts IA se configuran y leen únicamente desde aquí.
                    </p>
                </div>

                <label htmlFor="new-service-modal" className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2">
                    <span>+</span> Nueva prueba
                </label>
            </div>

            {/* Resumen de estado de calibración IA */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Pruebas calibradas</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{totalCalibrated}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Listas con prompts activos en base de datos.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Faltan por calibrar</p>
                    <p className="text-2xl font-bold text-rose-700 mt-1">{totalPending}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Sin calibración completa o con borrador pendiente de publicar.</p>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                    <p className="text-xs text-slate-500">Servicios manuales sin IA</p>
                    <p className="text-2xl font-bold text-slate-700 mt-1">{totalManual}</p>
                    <p className="text-xs text-slate-400 mt-0.5">No requieren prompts de extracción ni prediagnóstico.</p>
                </div>
            </div>

            {/* Filtros por estado de calibración */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-medium text-slate-500 mr-1">Estado de calibración:</span>
                {[
                    { key: '', label: `Todas (${byCategory.length})` },
                    {
                        key: 'pending',
                        label: `Faltan por calibrar (${byCategory.filter((t) => t.calibration.needsCalibration).length})`,
                    },
                    {
                        key: 'calibrated',
                        label: `Calibradas (${byCategory.filter((t) => t.calibration.kind === 'calibrated').length})`,
                    },
                ].map((tab) => {
                    const isActive = (status ?? '') === tab.key
                    return (
                        <Link
                            key={tab.key || 'all-status'}
                            href={buildFilterHref(category, tab.key)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                                isActive
                                    ? 'bg-violet-600 text-white border-violet-600'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}
                        >
                            {tab.label}
                        </Link>
                    )
                })}
            </div>

            {/* Tabs de filtrado por categoría */}
            <div className="flex gap-2 flex-wrap">
                {categoryTabs.map((cat) => {
                    const isActive = (category ?? '') === cat.value
                    return (
                        <Link
                            key={cat.value}
                            href={buildFilterHref(cat.value, status)}
                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                                isActive
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}
                        >
                            {cat.label}
                        </Link>
                    )
                })}
            </div>

            {/* Modal — Nueva prueba */}
            <input type="checkbox" id="new-service-modal" className="peer hidden" />
            <div className="fixed inset-0 bg-black/50 hidden peer-checked:flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Registrar prueba</h3>
                        <label htmlFor="new-service-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold">✕</label>
                    </div>
                    <form action={createMedicalTestFormAction} className="space-y-4">
                        <input name="name" placeholder="Nombre (ej. Audiometría tonal)" required className="w-full border p-2 rounded" />
                        <div className="grid grid-cols-2 gap-4">
                            <input name="code" placeholder="Código interno (ej. AUD-01)" required className="w-full border p-2 rounded" />
                            <select name="categoryId" className="w-full border p-2 rounded" required>
                                <option value="">Categoría</option>
                                {categories.map((testCategory) => (
                                    <option key={testCategory.id} value={testCategory.id}>
                                        {testCategory.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="new-theoretical-duration" className="block text-xs font-semibold text-slate-600 mb-1">
                                Duración teórica (min)
                            </label>
                            <input
                                id="new-theoretical-duration"
                                type="number"
                                name="theoreticalDurationMinutes"
                                min={0}
                                max={480}
                                step={1}
                                placeholder="Opcional (ej. 15, 30)"
                                className="w-full border p-2 rounded text-sm"
                            />
                        </div>
                        {categories.length === 0 && (
                            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                                No hay categorías configuradas. Debes dar de alta al menos una categoría en la base de datos para registrar pruebas.
                            </p>
                        )}

                        <div className="flex justify-end pt-4">
                            <button type="submit" disabled={categories.length === 0} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                                Guardar prueba
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <MedicalServicesCatalogTable
                tests={tests}
                categories={categories}
                activeCategoryId={category}
                activeStatusFilter={status}
            />
        </div>
    )
}
