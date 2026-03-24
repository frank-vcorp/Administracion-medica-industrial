/**
 * @file Admin Perfiles Médicos — Ruta oficial: /admin/profiles
 * @description Pantalla de gestión de MedicalProfile. Reemplaza la lógica
 *   de ServiceProfile/Baterías. Única vía de administración de perfiles.
 * @id IMPL-20260324-01
 * @see ARCH-20260324-23 — Unificación lógica de perfiles
 */
import { getMedicalProfiles, getMedicalTests } from '@/actions/medical-profiles'
import MedicalProfilesManager from './MedicalProfilesManager'

export const dynamic = 'force-dynamic'

export default async function AdminProfilesPage() {
  const [profiles, availableTests] = await Promise.all([
    getMedicalProfiles(),
    getMedicalTests(),
  ])

  return (
    <MedicalProfilesManager
      profiles={profiles}
      availableTests={availableTests}
    />
  )
}

