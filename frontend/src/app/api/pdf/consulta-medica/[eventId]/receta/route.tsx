import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { pdf } from '@react-pdf/renderer'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { ConsultaMedicaRecetaPDF } from '@/lib/consulta-medica-pdf'
import { loadConsultaMedicaPdfInput } from '@/lib/consulta-medica-pdf-data'

const CLINICAL_ROLES = new Set([
  'SUPERADMIN',
  'ADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'RECEPTIONIST',
  'CAPTURIST',
])

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (!CLINICAL_ROLES.has(session.user.role ?? '')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { eventId } = await params
  const loaded = await loadConsultaMedicaPdfInput(eventId)
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.message }, { status: loaded.status })
  }

  const prescriptorUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { fullName: true, professionalLicense: true, signatureImageUrl: true },
  })
  const storedName = loaded.data.consulta.medico_nombre.trim()
  const sessionName = prescriptorUser?.fullName?.trim() || session.user.fullName || session.user.name || ''
  const filledBySession = !storedName || storedName === 'Médico' || storedName === sessionName
  const storedLicense = loaded.data.consulta.medico_cedula.trim()
  const data = {
    ...loaded.data,
    prescriptor: {
      nombre: filledBySession ? sessionName || storedName || 'Médico' : storedName,
      cedula:
        storedLicense && storedLicense !== '—'
          ? storedLicense
          : filledBySession
            ? prescriptorUser?.professionalLicense?.trim() || '—'
            : storedLicense || '—',
      firmaUrl: filledBySession ? prescriptorUser?.signatureImageUrl ?? null : null,
    },
  }

  const blob = await pdf(<ConsultaMedicaRecetaPDF data={data} />).toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  const filename = `Receta-${eventId.slice(0, 8)}.pdf`
  return new NextResponse(Buffer.from(arrayBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
