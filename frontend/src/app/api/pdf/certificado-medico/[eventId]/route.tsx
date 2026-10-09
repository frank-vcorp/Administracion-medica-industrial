import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { pdf } from '@react-pdf/renderer'
import { authOptions } from '@/auth'
import { CertificadoMedicoPDF } from '@/lib/certificado-medico-pdf'
import { loadCertificadoMedicoPdfInput } from '@/lib/certificado-medico-pdf-data'

const CLINICAL_ROLES = new Set(['SUPERADMIN', 'DOCTOR_GENERAL', 'DOCTOR_VALIDATOR', 'ADMIN'])

export async function GET(
  request: NextRequest,
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
  const eventTestId = request.nextUrl.searchParams.get('eventTestId') ?? ''
  const loaded = await loadCertificadoMedicoPdfInput(eventId, eventTestId)
  if (!loaded.ok) {
    return NextResponse.json({ error: loaded.message }, { status: loaded.status })
  }

  const blob = await pdf(<CertificadoMedicoPDF data={loaded.data} />).toBlob()
  const arrayBuffer = await blob.arrayBuffer()
  const filename = `CertificadoMedico-${eventTestId.slice(0, 8)}.pdf`
  return new NextResponse(Buffer.from(arrayBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
    },
  })
}
