/**
 * @file Ruta pública /auto-alta/[token] — renderiza el formulario extenso de auto-alta.
 * @id IMPL-20260623-03
 * @spec context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 *
 * Server component (Next.js 16+):
 *  - `params` es Promise; se hace `await params` antes de usar.
 *  - Llama `validateCompanySelfRegToken` (en service, no en actions, porque
 *    la ruta es pública y no pasa por NextAuth).
 *  - Si token inválido/expirado/cancelado: pasa `initial` con estado
 *    "NOT_FOUND" | "EXPIRED" | "CANCELLED" | "ALREADY_SUBMITTED" al
 *    `SelfRegistrationForm`, que ya renderiza su `InvalidTokenView`.
 *  - Si válido: pasa `initial` con status "ACTIVE" y carga catálogos
 *    (estados de México + claves CFDI) para que el form los muestre.
 */
import { notFound } from 'next/navigation'
import SelfRegistrationForm from '@/components/companies/SelfRegistrationForm'
import { validateCompanySelfRegToken, listEstadosMexico } from '@/services/company.service'
import { CFDI_USO_VALUES } from '@/lib/schemas/company-full-form'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

type FormInitial =
  | { status: 'ACTIVE'; expiresAt: string; openedCount: number }
  | { status: 'EXPIRED'; expiresAt?: string }
  | { status: 'ALREADY_SUBMITTED'; existingCompanyId?: string }
  | { status: 'CANCELLED' }
  | { status: 'NOT_FOUND' }

function mapTokenResultToInitial(
  result: Awaited<ReturnType<typeof validateCompanySelfRegToken>>,
  fallbackExpiresAt?: string
): FormInitial {
  if (result.ok) {
    return {
      status: 'ACTIVE',
      expiresAt:
        result.expiresAt instanceof Date
          ? result.expiresAt.toISOString()
          : String(result.expiresAt ?? fallbackExpiresAt ?? new Date().toISOString()),
      openedCount: typeof result.openedCount === 'number' ? result.openedCount : 1,
    }
  }
  switch (result.reason) {
    case 'ALREADY_SUBMITTED':
      return {
        status: 'ALREADY_SUBMITTED',
        existingCompanyId: result.submittedCompanyId ?? undefined,
      }
    case 'CANCELLED':
      return { status: 'CANCELLED' }
    case 'EXPIRED':
      return {
        status: 'EXPIRED',
        expiresAt:
          result.expiresAt instanceof Date
            ? result.expiresAt.toISOString()
            : (result.expiresAt as unknown as string | undefined) ?? fallbackExpiresAt,
      }
    case 'NOT_FOUND':
    case 'INVALID_TOKEN':
    default:
      return { status: 'NOT_FOUND' }
  }
}

export default async function AutoAltaPage({ params }: PageProps) {
  const { token } = await params

  if (!token || typeof token !== 'string' || token.length < 8) {
    notFound()
  }

  const result = await validateCompanySelfRegToken(token)
  const initial = mapTokenResultToInitial(result)

  // Cargamos catálogos solo cuando el token es válido; en estado inválido
  // el form muestra InvalidTokenView y no necesita los catálogos.
  let estados: { id: number; nombre: string }[] = []
  if (initial.status === 'ACTIVE') {
    const rawEstados = await listEstadosMexico()
    estados = rawEstados.map((e) => ({ id: e.id, nombre: e.nombre }))
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black">
              AMI
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-800 leading-none">
                Alta de Cliente — Auto-registro
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Tu solicitud será revisada por un vendedor antes de activarse.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
            Portal público
          </span>
        </div>
      </header>

      <main className="py-8">
        <SelfRegistrationForm
          token={token}
          source="TOKEN"
          initial={initial}
          estados={estados}
          cfdiOptions={CFDI_USO_VALUES}
        />
      </main>
    </div>
  )
}
