import { createHash, randomBytes } from 'crypto'
import prisma from '@/lib/prisma'

const INVITATION_MIN_TTL_HOURS = 6
const INVITATION_MAX_TTL_DAYS = 30

export type PrefilledChannel = 'WHATSAPP' | 'LINK' | 'QR' | 'TABLET'

/**
 * Calcula la vigencia del enlace de prellenado:
 * - Mínimo 6 horas desde `now`.
 * - Si hay cita programada (`scheduledAt`), extiende hasta `scheduledAt + 6h`
 *   con tope de 30 días desde `now`.
 */
export function resolvePrefillInvitationExpiresAt(
  scheduledAt?: Date | null,
  now: Date = new Date(),
): Date {
  const minMs = now.getTime() + INVITATION_MIN_TTL_HOURS * 60 * 60 * 1000
  const maxMs = now.getTime() + INVITATION_MAX_TTL_DAYS * 24 * 60 * 60 * 1000
  if (!scheduledAt) {
    return new Date(minMs)
  }
  const scheduledEndMs =
    scheduledAt.getTime() + INVITATION_MIN_TTL_HOURS * 60 * 60 * 1000
  return new Date(Math.min(Math.max(minMs, scheduledEndMs), maxMs))
}

export function resolvePublicAppBaseUrl(): string {
  const base =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  return base.replace(/\/$/, '')
}

export function hashPrefillToken(plainToken: string): string {
  return createHash('sha256').update(plainToken).digest('hex')
}

export async function createOrReplacePrefilledInvitationForAppointment(args: {
  appointmentId: string
  generatedById: string
  scheduledAt?: Date | null
  channel?: PrefilledChannel | null
}): Promise<{ plainToken: string; prefillUrl: string; expiresAt: Date }> {
  const plainToken = randomBytes(32).toString('base64url')
  const tokenHash = hashPrefillToken(plainToken)
  const expiresAt = resolvePrefillInvitationExpiresAt(args.scheduledAt)

  await prisma.$transaction(async (tx) => {
    await tx.prefilledInvitation.upsert({
      where: { appointmentId: args.appointmentId },
      create: {
        appointmentId: args.appointmentId,
        tokenHash,
        expiresAt,
        status: 'INVITATION_ACTIVE',
        channel: args.channel ?? null,
        generatedById: args.generatedById,
        module1Data: undefined,
        openedCount: 0,
        submittedAt: null,
      },
      update: {
        tokenHash,
        expiresAt,
        status: 'INVITATION_ACTIVE',
        channel: args.channel ?? null,
        generatedById: args.generatedById,
        module1Data: undefined,
        openedCount: 0,
        submittedAt: null,
      },
    })
  })

  return {
    plainToken,
    prefillUrl: `${resolvePublicAppBaseUrl()}/prefill/${plainToken}`,
    expiresAt,
  }
}
