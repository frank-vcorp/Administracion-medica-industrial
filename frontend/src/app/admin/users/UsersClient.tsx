'use client'

import { createUser, updateUser } from "@/actions/user.actions"
import type { UserListItem } from "@/actions/user.actions"
import type { UserRole } from "@prisma/client"
import { useState } from "react"

type UsersClientProps = {
    initialUsers: UserListItem[]
}

const roles: Array<{ value: UserRole; label: string }> = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'RECEPTIONIST', label: 'Recepcionista' },
    { value: 'DOCTOR_GENERAL', label: 'Médico General' },
    { value: 'DOCTOR_VALIDATOR', label: 'Médico Validador' },
    { value: 'CAPTURIST', label: 'Capturista' },
    { value: 'COMPANY_CLIENT', label: 'Cliente de Empresa' },
    { value: 'VENDEDOR', label: 'Vendedor' },
]

export default function UsersClient({ initialUsers }: UsersClientProps) {
    const [editingUser, setEditingUser] = useState<UserListItem | null>(null)

    const handleUpdateUser = async (formData: FormData) => {
        await updateUser(formData)
        setEditingUser(null)
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Personal AMI (Usuarios)</h2>
                    <p className="text-sm text-slate-500">Gestión de médicos, recepcionistas y administradores.</p>
                </div>

                <label htmlFor="new-user-modal" className="cursor-pointer bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow flex items-center gap-2">
                    <span>+</span> Nuevo Usuario
                </label>
            </div>

            <input type="checkbox" id="new-user-modal" className="peer hidden" />
            <div className="fixed inset-0 bg-black/50 hidden peer-checked:flex items-center justify-center z-50 backdrop-blur-sm">
                <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold">Registrar Usuario</h3>
                        <label htmlFor="new-user-modal" className="cursor-pointer text-slate-400 hover:text-red-500 font-bold" aria-label="Cerrar modal">✕</label>
                    </div>
                    <form action={createUser} className="space-y-4">
                        <input name="fullName" placeholder="Nombre Completo" required className="w-full border p-2 rounded" />
                        <input type="email" name="email" placeholder="Correo Electrónico" required className="w-full border p-2 rounded" />
                        <input type="password" name="password" placeholder="Contraseña Temporal" required className="w-full border p-2 rounded" />
                        <select name="role" className="w-full border p-2 rounded" required defaultValue="">
                            <option value="">Selecciona un Rol</option>
                            {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                        </select>

                        <div className="flex justify-end pt-4">
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium">
                                Guardar Usuario
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            {editingUser && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="edit-user-title">
                    <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-4">
                            <h3 id="edit-user-title" className="text-lg font-bold">Editar Usuario</h3>
                            <button type="button" onClick={() => setEditingUser(null)} className="cursor-pointer text-slate-400 hover:text-red-500 font-bold" aria-label="Cerrar modal">✕</button>
                        </div>
                        <form action={handleUpdateUser} className="space-y-4">
                            <input type="hidden" name="id" value={editingUser.id} />
                            <input name="fullName" defaultValue={editingUser.fullName} placeholder="Nombre Completo" required className="w-full border p-2 rounded" />
                            <input type="email" name="email" defaultValue={editingUser.email} placeholder="Correo Electrónico" required className="w-full border p-2 rounded" />
                            <input type="password" name="password" placeholder="Nueva contraseña (opcional)" className="w-full border p-2 rounded" />
                            <select name="role" className="w-full border p-2 rounded" required defaultValue={editingUser.role}>
                                {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
                            </select>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                                <input type="checkbox" name="isActive" value="true" defaultChecked={editingUser.isActive} className="h-4 w-4 rounded border-slate-300" />
                                Usuario activo
                            </label>

                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setEditingUser(null)} className="border border-slate-200 text-slate-600 px-4 py-2 rounded shadow-sm hover:bg-slate-50 font-medium">
                                    Cancelar
                                </button>
                                <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 font-medium">
                                    Guardar cambios
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left text-sm text-slate-600">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500 font-semibold border-b border-slate-200">
                        <tr>
                            <th className="px-6 py-4">Nombre</th>
                            <th className="px-6 py-4">Correo</th>
                            <th className="px-6 py-4">Rol</th>
                            <th className="px-6 py-4">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {initialUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-medium text-slate-900">{user.fullName}</td>
                                <td className="px-6 py-4">{user.email}</td>
                                <td className="px-6 py-4"><span className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs font-semibold">{user.role}</span></td>
                                <td className="px-6 py-4">{user.isActive ? <span className="text-emerald-600 font-medium text-xs">Activo</span> : <span className="text-red-500 font-medium text-xs">Inactivo</span>}</td>
                                <td className="px-6 py-4 text-right">
                                    <button type="button" onClick={() => setEditingUser(user)} className="text-slate-400 hover:text-blue-600 font-medium text-xs">Editar</button>
                                </td>
                            </tr>
                        ))}
                        {initialUsers.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-400">No hay usuarios registrados.</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
