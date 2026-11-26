import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { renderToStream } from '@react-pdf/renderer'
import { PatientHealthDictamenPDF } from '@/components/pdf/PatientHealthDictamenPDF'
import { readPatientHealthRecommendations } from '@/lib/clinical/dictamen-audience'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const CLINICAL_ROLES = new Set(['SUPERADMIN', 'DOCTOR_GENERAL', 'DOCTOR_VALIDATOR'])

function basenameSafe(input: string): string {
  if (typeof input !== 'string') return 'invalid-key'
  const parts = input.split(/[\\/]/).filter(Boolean)
  const last = parts[parts.length - 1] ?? ''
  if (last.length === 0 || last.includes('..') || last.includes('\0')) {
    return 'invalid-key'
  }
  return last
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('No autenticado', { status: 401 })
  }
  if (!CLINICAL_ROLES.has(session.user.role as string)) {
    return new NextResponse('Sin permisos para este documento.', { status: 403 })
  }

  const { eventId } = await params
  if (!eventId) {
    return new NextResponse('eventId requerido', { status: 400 })
  }

  const verdict = await prisma.medicalVerdict.findUnique({
    where: { eventId },
    include: {
      event: {
        include: {
          worker: { select: { firstName: true, lastName: true, universalId: true } },
          exam: { select: { physicalExamData: true } },
        },
      },
      validator: { select: { fullName: true } },
    },
  })

  if (!verdict) {
    return new NextResponse('El dictamen aún no ha sido emitido.', { status: 404 })
  }

  if (verdict.patientPdfUrl) {
    const signedKey = basenameSafe(verdict.patientPdfUrl)
    const backendFileUrl = `${BACKEND_URL}/api/files/${encodeURIComponent(signedKey)}`

    try {
      const backendResponse = await fetch(backendFileUrl, { method: 'GET', redirect: 'manual' })
      if (backendResponse.status === 302 || backendResponse.status === 301) {
        const location = backendResponse.headers.get('location')
        if (location) {
          return NextResponse.redirect(location)
        }
      }
      if (backendResponse.ok) {
        const buf = await backendResponse.arrayBuffer()
        return new NextResponse(buf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="Salud-${verdict.event.worker.universalId}.pdf"`,
          },
        })
      }
    } catch {
      // Si falla la conexión con el backend, regenerar en línea abajo
    }
  }

  // Fallback: Regenerar en línea si no hay patientPdfUrl o el backend falló
  const ped = (verdict.event.exam?.physicalExamData as Record<string, unknown> | null) ?? null
  const healthRecommendations =
    readPatientHealthRecommendations(ped) ||
    verdict.recommendations ||
    'Mantener estilos de vida saludables, alimentación balanceada y seguimiento médico preventivo.'

  const stream = await renderToStream(
    <PatientHealthDictamenPDF
      data={{
        signedAt: verdict.signedAt ?? new Date(),
        eventId: verdict.eventId,
        worker: {
          firstName: verdict.event.worker.firstName,
          lastName: verdict.event.worker.lastName,
          universalId: verdict.event.worker.universalId,
        },
        healthRecommendations,
        validator: {
          fullName: verdict.validator?.fullName || 'Médico Validador',
        },
        verdictId: verdict.id,
      }}
    />,
  )

  return new NextResponse(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="Salud-${verdict.event.worker.universalId}.pdf"`,
    },
  })
}
