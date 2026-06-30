/**
 * @file Ruta pública /solicitar-alta — formulario extenso SIN token, SIN auth.
 * @id IMPL-20260624-01
 * @spec context/SPECs/SPEC_ARCH-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md
 * @adr context/decisions/ADR-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md
 *
 * Server component estático. No usa params, searchParams ni getServerSession.
 * Renderiza el mismo SelfRegistrationForm que /auto-alta/[token], pero con
 * source='PUBLIC' para que el submit se haga vía submitPublicCompanySelfRegistrationAction
 * (sin validación de token) y la CompanySelfRegistration resultante se cree con
 * channel='PUBLIC_DIRECT'.
 *
 * Caso de uso: demo en vivo, landing page de marketing, captura de leads espontáneos.
 * El gatekeeper de fondo sigue siendo estado=PENDIENTE_REVISION: el cliente NO se
 * habilita hasta que un vendedor/admin lo revise.
 */
import SelfRegistrationForm from '@/components/companies/SelfRegistrationForm'
import { listEstadosMexico } from '@/services/company.service'
import { CFDI_USO_VALUES } from '@/lib/schemas/company-full-form'

export const dynamic = 'force-dynamic'

export default async function SolicitarAltaPage() {
  // Catálogos necesarios para el form (no dependen de token).
  const rawEstados = await listEstadosMexico()
  const estados = rawEstados.map((e) => ({ id: e.id, nombre: e.nombre }))

  // IMPL-20260624-01: initial sintético. expiresAt es un placeholder lejano;
  // el form lo muestra como "El link expira el..." (mismo copy que TOKEN).
  // En PUBLIC no hay expiración real; es solo para evitar "Invalid Date" en UI.
  //
  // FIX-20260624-10: Pre-computamos `expiresAtLabel` en el server con el timezone
  // del server (America/Mexico_City). Si lo calculáramos en el client con
  // `new Date().toLocaleString('es-MX')`, el browser usaría su timezone local
  // y produciría un string distinto → React #418 hydration mismatch.
  // Mismo motivo para `fecha`: la inicialización con `new Date()` en el client
  // puede divergir de la del server si cruza medianoche UTC.
  const initial = {
    status: 'ACTIVE' as const,
    expiresAt: '2099-12-31T23:59:59.000Z',
    expiresAtLabel: new Date('2099-12-31T23:59:59.000Z').toLocaleString('es-MX'),
    fecha: new Date().toISOString().slice(0, 10),
    openedCount: 0,
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
                Solicita tu Alta como Cliente
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Tu información será revisada por un ejecutivo antes de activar tu cuenta.
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-100">
            Portal público
          </span>
        </div>
      </header>

      <main className="py-8">
        <SelfRegistrationForm
          source="PUBLIC"
          initial={initial}
          estados={estados}
          cfdiOptions={CFDI_USO_VALUES}
        />
      </main>
    </div>
  )
}