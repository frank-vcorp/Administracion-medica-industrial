'use server'

import { getServerSession } from 'next-auth'
import { revalidatePath } from 'next/cache'
import { authOptions } from '@/auth'
import { isSuperAdmin } from '@/lib/auth/roles'
import {
  previewOperationalCleanup,
  runOperationalCleanup,
  type OperationalCleanupPreview,
} from '@/services/operational-cleanup.service'

type ActionError = {
  ok: false
  code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'INTERNAL_ERROR'
  error: string
}

function assertSuperAdmin(): Promise<
  | { ok: true; userId: string }
  | ActionError
> {
  return getServerSession(authOptions).then((session) => {
    if (!session?.user?.id) {
      return { ok: false, code: 'UNAUTHENTICATED', error: 'Sin sesión' }
    }
    const role = (session.user as { role?: string }).role
    if (!isSuperAdmin(role)) {
      return {
        ok: false,
        code: 'FORBIDDEN',
        error: 'Solo SUPERADMIN puede ejecutar esta limpieza',
      }
    }
    return { ok: true, userId: session.user.id }
  })
}

export async function previewOperationalCleanupAction(): Promise<
  | { ok: true; preview: OperationalCleanupPreview }
  | ActionError
> {
  const gate = await assertSuperAdmin()
  if (!gate.ok) return gate

  const preview = await previewOperationalCleanup()
  return { ok: true, preview }
}

export async function runOperationalCleanupAction(args?: {
  confirmation?: string
}): Promise<
  | {
      ok: true
      deletedWorkers: number
      deletedCompanies: number
      after: OperationalCleanupPreview
    }
  | ActionError
> {
  const gate = await assertSuperAdmin()
  if (!gate.ok) return gate

  if (args?.confirmation !== 'LIMPIAR DATOS OPERATIVOS') {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      error: 'Confirmación inválida. Escribe exactamente: LIMPIAR DATOS OPERATIVOS',
    }
  }

  const result = await runOperationalCleanup({
    actorUserId: gate.userId,
    reason: 'admin-settings-operational-cleanup',
  })

  if (!result.ok) {
    return { ok: false, code: 'INTERNAL_ERROR', error: result.error }
  }

  revalidatePath('/workers')
  revalidatePath('/companies')
  revalidatePath('/publico-general')
  revalidatePath('/validation')
  revalidatePath('/reception')
  revalidatePath('/events')
  revalidatePath('/appointments')

  return {
    ok: true,
    deletedWorkers: result.deletedWorkers,
    deletedCompanies: result.deletedCompanies,
    after: result.after,
  }
}
