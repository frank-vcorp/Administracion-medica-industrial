import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { renderToStream } from '@react-pdf/renderer'
import { PatientHealthDictamenPDF } from '@/components/pdf/PatientHealthDictamenPDF'
import { readPatientHealthRecommendations } from '@/lib/clinical/dictamen-audience'
import { resolveStudiesFromEvent, summarizeExtractedData, resolveWorkerPersonalDetails } from '@/lib/dictamen-summary'
import { resolveSmeLogoDataUrl } from '@/lib/sme-brand'

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
  request: NextRequest,
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
          worker: {
            select: {
              firstName: true,
              lastName: true,
              universalId: true,
              dob: true,
              company: { select: { name: true } },
            },
          },
          exam: { select: { physicalExamData: true } },
          studies: { select: { serviceName: true, extractedData: true } },
          eventTests: {
            select: {
              testNameSnapshot: true,
              status: true,
              selectedOption: true,
              resultNotes: true,
              clinicalContext: true,
              test: { select: { name: true } },
              extractionSnapshots: {
                select: { structuredData: true },
              },
            },
          },
        },
      },
      validator: { select: { fullName: true, professionalLicense: true } },
    },
  })

  if (!verdict) {
    return new NextResponse('El dictamen aún no ha sido emitido.', { status: 404 })
  }

  const forceFresh =
    request.nextUrl.searchParams.get('fresh') === '1' ||
    request.nextUrl.searchParams.get('regenerate') === 'true'

  if (verdict.patientPdfUrl && !forceFresh) {
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

  // Regenerar en línea con diseño enriquecido
  const ped = (verdict.event.exam?.physicalExamData as Record<string, unknown> | null) ?? {}
  const personal = resolveWorkerPersonalDetails(ped, verdict.event.worker)

  const healthRecommendations =
    readPatientHealthRecommendations(ped) ||
    verdict.recommendations ||
    'Mantener estilos de vida saludables, alimentación balanceada y seguimiento médico preventivo.'

  const resolvedStudies = resolveStudiesFromEvent(
    verdict.event.studies,
    verdict.event.eventTests,
    ped,
  )

  const studiesForPatient = resolvedStudies.map((s) => ({
    serviceName: s.serviceName,
    findings: summarizeExtractedData(s.extractedData),
  }))

  const logoUrl = await resolveSmeLogoDataUrl()

  const stream = await renderToStream(
    <PatientHealthDictamenPDF
      data={{
        signedAt: verdict.signedAt ?? new Date(),
        eventId: verdict.eventId,
        verdictId: verdict.id,
        worker: {
          firstName: verdict.event.worker.firstName,
          lastName: verdict.event.worker.lastName,
          universalId: verdict.event.worker.universalId,
          companyName: verdict.event.worker.company?.name ?? null,
          age: personal.edad,
          gender: personal.sexo,
          position: personal.puesto,
        },
        healthRecommendations,
        validator: {
          fullName: verdict.validator?.fullName || 'Médico Validador',
          professionalLicense: verdict.validator?.professionalLicense || null,
        },
        studies: studiesForPatient,
        logoUrl,
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
