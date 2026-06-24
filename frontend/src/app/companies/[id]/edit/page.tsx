/**
 * @file Página de edición interna de Company — solo ADMIN (ARCH-20260624-03).
 * @id IMPL-20260624-03
 * @backup context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md
 *
 * Server component (Next.js 16+): `params` es Promise; se hace `await params`.
 *
 * RBAC: si el usuario no es ADMIN, redirige a la ficha de la Company.
 * Si la Company no existe, redirige a /companies.
 *
 * Carga la Company con `getCompanyById` (incluye sucursales) y la pasa al
 * `CompanyEditForm` con datos pre-llenados para edición.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { getCompanyById, listEstadosMexico } from '@/services/company.service'
import { CFDI_USO_VALUES, METODO_PAGO_VALUES } from '@/lib/schemas/company-full-form'
import CompanyEditForm from '@/components/companies/CompanyEditForm'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function CompanyEditPage({ params }: PageProps) {
  const { id } = await params

  // RBAC: solo ADMIN puede editar datos completos internamente.
  // VENDEDOR puede generar links externos pero NO editar directamente.
  const session = await getServerSession(authOptions)
  const role = (session?.user?.role as string | undefined) ?? null
  if (!session?.user || role !== 'ADMIN') {
    // Redirige a la ficha de la Company para no romper navegación.
    redirect(`/companies/${id}`)
  }

  const company = await getCompanyById(id)
  if (!company) redirect('/companies')

  const estadosRaw = await listEstadosMexico().catch(() => [])
  const estados = estadosRaw.map((e) => ({ id: e.id, nombre: e.nombre }))

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/companies" className="hover:text-slate-800 transition-colors">
          Empresas Cliente
        </Link>
        <span>›</span>
        <Link href={`/companies/${id}`} className="hover:text-slate-800 transition-colors">
          {company.name}
        </Link>
        <span>›</span>
        <span className="text-slate-800 font-medium">Editar datos completos</span>
      </nav>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              ✏️ Editar datos completos
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Modifica los datos de la empresa. Los cambios se registran en el log de auditoría con snapshot completo.
            </p>
          </div>
          <Link
            href={`/companies/${id}`}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm font-bold"
          >
            ← Volver a la ficha
          </Link>
        </div>
      </div>

      <CompanyEditForm
        company={{
          id: company.id,
          name: company.name,
          rfc: company.rfc,
          address: company.address,
          contactName: company.contactName,
          email: company.email,
          phone: company.phone,
          fiscalData: company.fiscalData,
          repLegalData: company.repLegalData,
          rhData: company.rhData,
          cuentasPagarData: company.cuentasPagarData,
          referenciasData: company.referenciasData,
          documentosAdjuntos: company.documentosAdjuntos,
          updatedAt:
            (company as unknown as { updatedAt: Date | string }).updatedAt instanceof Date
              ? (company as unknown as { updatedAt: Date }).updatedAt.toISOString()
              : String((company as unknown as { updatedAt: string }).updatedAt ?? ''),
        }}
        catalogos={{
          estados,
          cfdiOptions: CFDI_USO_VALUES,
          metodoPagoOptions: METODO_PAGO_VALUES,
        }}
      />
    </div>
  )
}