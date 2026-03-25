/**
 * @fileoverview Catálogo de Pruebas con filtrado por categoría
 * @id ARCH-20260325-01
 * @backup context/checkpoints/CHK_ARCH-20260325-01.md
 */
import Link from "next/link"
import {
    createMedicalTest,
    getMedicalTests,
    getTestCategories,
} from "@/actions/medical-profiles"

// searchParams es Promise en Next.js 16 (App Router)
export default async function AdminServicesPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string }>
}) {
    const { category } = await searchParams
    const [allTests, categories] = await Promise.all([
        getMedicalTests(),
        getTestCategories(),
    ])
    const tests = category
        ? allTests.filter((test) => test.categoryId === category)
        : allTests
    const categoryTabs = [
        { value: '', label: 'Todas las pruebas' },
        ...categories.map((testCategory) => ({
            value: testCategory.id,
            label: testCategory.name,
        })),
    ]

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Catálogo de Pruebas</h2>
                    <p className="text-sm text-slate-500">Estudios clínicos, laboratorio y gabinete disponibles.</p>
                </div>

                <label htmlFor="new-service-modal" className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2">
                    <span>+</span> Nueva Prueba
                </label>
            </div>

            {/* Tabs de filtrado por categoría */}
            <div className="flex gap-2 flex-wrap">
                {categoryTabs.map((cat) => {
                    const isActive = (category ?? '') === cat.value
                    return (
                        <Link
                            key={cat.value}
                            href={cat.value ? `/admin/services?category=${cat.value}` : '/admin/services'}
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

            {/* Modal — Nueva Prueba */}
            <input type="checkbox" id="new-service-modal" className="peer hidden" />
            <div className="fixed inset-0 bg-black/50 hidden peer-checked:flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Registrar Prueba</h3>
                        <label htmlFor="new-service-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold">✕</label>
                    </div>
                    <form action={createMedicalTest} className="space-y-4">
                        <input name="name" placeholder="Nombre (ej. Audiometría Tonal)" required className="w-full border p-2 rounded" />
                        <div className="grid grid-cols-2 gap-4">
                            <input name="code" placeholder="Código Interno (ej. AUD-01)" required className="w-full border p-2 rounded" />
                            <select name="categoryId" className="w-full border p-2 rounded" required>
                                <option value="">Categoría</option>
                                {categories.map((testCategory) => (
                                    <option key={testCategory.id} value={testCategory.id}>
                                        {testCategory.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {categories.length === 0 && (
                            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
                                No hay categorías configuradas. Debes dar de alta al menos una categoría en la base de datos para registrar pruebas.
                            </p>
                        )}

                        <div className="flex justify-end pt-4">
                            <button type="submit" disabled={categories.length === 0} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
                                Guardar Prueba
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Código</th>
                            <th className="px-6 py-4">Prueba</th>
                            <th className="px-6 py-4">Categoría</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {tests.map((test) => (
                            <tr key={test.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-mono text-slate-400 text-xs">{test.code}</td>
                                <td className="px-6 py-4 font-medium text-slate-900">{test.name}</td>
                                <td className="px-6 py-4 text-slate-500">{test.category.name}</td>
                                <td className="px-6 py-4 text-right">
                                    <button className="text-slate-400 hover:text-blue-600 font-medium text-xs">
                                        Editar
                                    </button>
                                </td>
                            </tr>
                        ))}
                        {tests.length === 0 && (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                    {category
                                        ? 'No hay pruebas en la categoría seleccionada.'
                                        : 'Aún no hay pruebas registradas en el catálogo.'}
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
