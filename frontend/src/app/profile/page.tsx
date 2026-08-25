/**
 * @fileoverview Página /profile — gestión del perfil médico.
 * @id IMPL-FEATURE-20260825-01 / QA-20260825-01 P1-B
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Acceso: SUPERADMIN / DOCTOR_GENERAL / DOCTOR_VALIDATOR.
 *
 * QA-20260825-01 P1-B: movido FUERA de `/admin/*` porque el middleware
 * rechaza cualquier path `/admin/*` para roles no-admin (sólo
 * SUPERADMIN/ADMIN), y los DOCTOR_* necesitan registrar cédula/firma
 * para poder emitir PDF. La ruta `/profile` NO está bloqueada por el
 * middleware; el gate de rol vive aquí + en la server action como
 * defensa redundante.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { redirect } from 'next/navigation'
import DoctorProfileForm from '@/components/admin/DoctorProfileForm'

export const dynamic = 'force-dynamic'

export default async function DoctorProfilePage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    redirect('/login')
  }
  const role = session.user.role
  if (
    role !== 'SUPERADMIN' &&
    role !== 'DOCTOR_GENERAL' &&
    role !== 'DOCTOR_VALIDATOR'
  ) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-800">Perfil médico</h1>
        <p className="text-sm text-slate-500">
          Configura tu nombre completo, cédula profesional y firma autógrafa. Esta
          información aparece en el PDF validado de Espirometría al aceptar o editar
          una revisión de prediagnóstico IA.
        </p>
      </header>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <DoctorProfileForm />
      </div>

      <div className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
        <strong className="text-slate-700">Privacidad:</strong> la firma autógrafa
        se guarda como data-URL en tu perfil y se congela en cada revisión médica
        que emitas, de modo que el PDF descargable mantiene tu identidad aunque
        cambies el perfil después.
      </div>
    </div>
  )
}
