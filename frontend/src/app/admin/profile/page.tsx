/**
 * Ruta legada: el perfil con firma vive en `/profile` (fuera de `/admin/*`
 * para que médicos no admin puedan editarlo). Redirige a la pantalla actual.
 */
import { redirect } from 'next/navigation'

export default function LegacyAdminProfileRedirect() {
  redirect('/profile')
}
