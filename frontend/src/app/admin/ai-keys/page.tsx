/**
 * @file Página admin para gestión runtime de API Keys IA.
 * @id IMPL-20260809-06 — ARCH-20260809-03
 * @spec context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md
 *
 * Server component: gate SUPERADMIN client-side. ADMIN llega al listado
 * mascareado sin botones de edición/borrado (controlado en el componente).
 * middleware.ts ya aplica isAdminLike a /admin/* (ADMIN+SUPERADMIN pasan).
 */
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { isAdminLike, isSuperAdmin } from '@/lib/auth/roles'
import AIProviderKeyManager from '@/components/admin/AIProviderKeyManager'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function AdminAIKeysPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    redirect('/login')
  }
  const role = session.user.role
  if (!isAdminLike(role)) {
    redirect('/')
  }

  const canEdit = isSuperAdmin(role)

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">API Keys de Proveedores IA</h1>
        <p className="text-sm text-gray-600 mt-1">
          Gestiona las claves de los proveedores de IA (Gemini, MiniMax M3, DR7/MedGemma).
          Las claves se cifran con AES-256-GCM antes de persistirse en la base de datos.
          La rotación toma efecto en producción sin redeploy cuando la feature flag
          <code className="mx-1 px-1 bg-gray-100 rounded text-xs">AI_KEYS_FROM_DB_ENABLED</code>
          está activa.
        </p>
        {!canEdit && (
          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-900">
            Tu rol (ADMIN) sólo permite <strong>ver</strong> el estado mascareado de las claves.
            Solo SUPERADMIN puede insertar, rotar o eliminar claves desde esta UI.
          </div>
        )}
      </header>

      <AIProviderKeyManager canEdit={canEdit} />
    </div>
  )
}