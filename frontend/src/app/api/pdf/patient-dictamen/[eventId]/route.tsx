import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'

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
      event: { include: { worker: { select: { universalId: true } } } },
    },
  })

  if (!verdict?.patientPdfUrl) {
    return new NextResponse('El dictamen de salud para el paciente aún no está disponible.', {
      status: 404,
    })
  }

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
    return new NextResponse('No se pudo resolver el dictamen del paciente.', { status: 502 })
  }

  return new NextResponse('Dictamen del paciente no encontrado.', { status: 404 })
}
