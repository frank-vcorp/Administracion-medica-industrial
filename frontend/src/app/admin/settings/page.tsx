import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { isAdminLike } from '@/lib/auth/roles'
import BrandingLogoManager from '@/components/admin/BrandingLogoManager'

export const dynamic = 'force-dynamic'

export default async function AdminSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/login')
  if (!isAdminLike(session.user.role)) redirect('/')

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Configuración</h1>
        <p className="text-sm text-slate-500 mt-1">
          Ajustes generales del sistema sin redeploy.
        </p>
      </header>

      <BrandingLogoManager />
    </div>
  )
}
