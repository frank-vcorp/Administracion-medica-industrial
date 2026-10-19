/**
 * PDF Sodexo REG-SO-01 (plantilla AcroForm). Distinto del entregable clínico
 * AMI en `/api/pdf/examen-medico/[eventId]`.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import { deliverExamenMedicoPdf } from '@/app/api/pdf/examen-medico/[eventId]/route'

const CLINICAL_ROLES = new Set<string>([
  'SUPERADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new NextResponse('No autenticado', { status: 401 })
  }
  if (!CLINICAL_ROLES.has(session.user.role)) {
    return new NextResponse(
      'Sin permisos para descargar el PDF Sodexo del examen médico.',
      { status: 403 },
    )
  }
  const { eventId } = await params
  if (!eventId) {
    return new NextResponse('eventId requerido', { status: 400 })
  }
  return deliverExamenMedicoPdf(eventId, 'sodexo')
}
