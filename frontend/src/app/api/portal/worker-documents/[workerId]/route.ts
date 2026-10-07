import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { assertPortalWorkerAccess } from '@/lib/portal-event-access'
import { resolveBackendFileUrl } from '@/lib/zip-cierre-clinico'

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const ALLOWED_PARTS = new Set(['identity-front', 'identity-back', 'consent'])

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workerId: string }> },
) {
  try {
    const { workerId } = await params
    const part = request.nextUrl.searchParams.get('part') ?? ''
    if (!ALLOWED_PARTS.has(part)) {
      return new NextResponse('part inválido', { status: 400 })
    }

    await assertPortalWorkerAccess(workerId)

    const worker = await prisma.worker.findUnique({
      where: { id: workerId },
      select: {
        lastIdentityFrontFileUrl: true,
        lastIdentityBackFileUrl: true,
        lastInformedConsentPdfUrl: true,
      },
    })
    if (!worker) return new NextResponse('No encontrado', { status: 404 })

    let fileUrl: string | null | undefined
    if (part === 'identity-front') fileUrl = worker.lastIdentityFrontFileUrl
    else if (part === 'identity-back') fileUrl = worker.lastIdentityBackFileUrl
    else fileUrl = worker.lastInformedConsentPdfUrl

    if (!fileUrl?.trim()) {
      return new NextResponse('Documento no disponible', { status: 404 })
    }

    const target = resolveBackendFileUrl(fileUrl.trim(), BACKEND_URL.replace(/\/$/, ''))
    if (!target) return new NextResponse('URL de documento inválida', { status: 404 })
    return NextResponse.redirect(target, 302)
  } catch {
    return new NextResponse('Sin permiso', { status: 403 })
  }
}
