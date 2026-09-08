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
import { PublicPortalChrome } from '@/components/PublicPortalChrome'
import { validateCompanySelfRegToken, listEstadosMexico } from '@/services/company.service'
import { CFDI_USO_VALUES } from '@/lib/schemas/company-full-form'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

type FormInitial =
  | {
      status: 'ACTIVE'
      expiresAt: string
      /**
       * FIX-20260624-10: Pre-computado en server con timezone America/Mexico_City
       * para evitar hydration mismatch (#418) por diferencia de timezone entre
       * server (UTC) y client (browser TZ) al usar toLocaleString.
       */
      expiresAtLabel: string
      /**
       * FIX-20260624-10: Fecha inicial YYYY-MM-DD (UTC) pre-computada en server.
       */
      fecha: string
      openedCount: number
    }
  | { status: 'EXPIRED'; expiresAt?: string }
  | { status: 'ALREADY_SUBMITTED'; existingCompanyId?: string }
  | { status: 'CANCELLED' }
  | { status: 'NOT_FOUND' }

function mapTokenResultToInitial(
  result: Awaited<ReturnType<typeof validateCompanySelfRegToken>>,
  fallbackExpiresAt?: string
): FormInitial {
  if (result.ok) {
    const expiresAtIso =
      result.expiresAt instanceof Date
        ? result.expiresAt.toISOString()
        : String(result.expiresAt ?? fallbackExpiresAt ?? new Date().toISOString())
    return {
      status: 'ACTIVE',
      expiresAt: expiresAtIso,
      expiresAtLabel: new Date(expiresAtIso).toLocaleString('es-MX'),
      fecha: new Date().toISOString().slice(0, 10),
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
    <PublicPortalChrome
      title="Alta de Cliente —"
      titleAccent="Auto-registro"
      subtitle="Tu solicitud será revisada por un vendedor antes de activarse."
    >
      <SelfRegistrationForm
        token={token}
        source="TOKEN"
        initial={initial}
        estados={estados}
        cfdiOptions={CFDI_USO_VALUES}
      />
    </PublicPortalChrome>
  )
}
