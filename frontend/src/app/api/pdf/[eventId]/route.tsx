import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { renderToStream } from '@react-pdf/renderer'
import { MedicalDictamenPDF } from "@/components/pdf/MedicalDictamenPDF"
import { readFile } from "fs/promises"
import { join } from "path"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

/**
 * @fileoverview Endpoint autenticado para descargar el PDF de dictamen
 *   médico consolidado (legacy `MedicalDictamenPDF`).
 *
 * @id IMPL-FEATURE-20260825-03 / FND-20260825-18 / P1-2 (QA-20260825-03)
 * @finding discovery/FINDINGS.md FND-20260825-18
 *
 * Esta ruta sirve el dictamen reducido que consume el portal corporativo
 * (`MedicalDictamenPDF`, plantilla con identificación + dictamen +
  recomendaciones + firma). NO expone la historia clínica completa (esa
 * vive en `/api/pdf/examen-medico/[eventId]`, gated por rol clínico).
 *
 * Comportamiento (P1-2 fix):
 *  - Sesión activa OBLIGATORIA (antes: ruta pública).
 *  - Autorización por OBJETO (IDOR fix, paridad con las rutas
 *    `/api/pdf/espirometry|examen-medico`):
 *      · SUPERADMIN: cualquier Event.
 *      · DOCTOR_GENERAL / DOCTOR_VALIDATOR: cualquier Event (la papeleta
 *        es la unidad de trabajo del médico).
 *      · COMPANY_CLIENT: sólo el Event cuyo `worker.companyId ===
 *        session.user.companyId` (gate de privacidad portal — el portal
 *        ya filtra por empresa en `getMedicalDictamPDF`).
 *      · Cualquier otro rol: 403.
 *  - Si el dictamen ya fue firmado y persistido en disco, se sirve desde
 *    disco. Si no, se regenera en línea desde el snapshot.
 *  - Filename: `Dictamen-<universalId>.pdf` (sin cambios).
 */

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        // FND-20260825-18 / P1-2: sesión obligatoria + scope por objeto.
        const session = await getServerSession(authOptions)
        if (!session?.user?.id) {
            return new NextResponse('No autenticado', { status: 401 })
        }
        const role = session.user.role
        const userCompanyId = session.user.companyId ?? null

        const { eventId } = await params
        if (!eventId) {
            return new NextResponse('eventId requerido', { status: 400 })
        }

        const isClinical =
            role === 'SUPERADMIN' ||
            role === 'DOCTOR_GENERAL' ||
            role === 'DOCTOR_VALIDATOR'
        const isCompanyClient = role === 'COMPANY_CLIENT'

        // Cualquier rol que NO sea clínico ni COMPANY_CLIENT queda fuera.
        if (!isClinical && !isCompanyClient) {
            return new NextResponse(
                'Sin permisos para descargar el PDF del dictamen.',
                { status: 403 }
            )
        }

        // Fetch verdict and fully linked entities (worker, company, validator)
        const verdict = await prisma.medicalVerdict.findUnique({
            where: { eventId },
            include: {
                event: {
                    include: {
                        worker: { include: { company: true } },
                        studies: true,
                        labs: true
                    }
                },
                validator: true
            }
        })

        if (!verdict) {
            return new NextResponse("El dictamen aún no ha sido emitido.", { status: 404 })
        }

        // COMPANY_CLIENT: el portal corporativo sólo recibe el dictamen de
        // eventos cuyo trabajador pertenece a SU propia empresa (gate de
        // privacidad portal, paridad con `getMedicalDictamPDF`). Si la
        // empresa no coincide → 403 y NO se filtran datos.
        if (isCompanyClient) {
            const workerCompanyId = verdict.event.worker.companyId ?? null
            if (workerCompanyId !== userCompanyId) {
                return new NextResponse(
                    'Sin permisos para descargar este dictamen.',
                    { status: 403 }
                )
            }
        }

        // Si el dictamen ya fue firmado, devolver el PDF firmado desde el disco
        if (verdict.pdfUrl) {
            try {
                const uploadDir = join(process.cwd(), '../uploads')
                const filePath = join(uploadDir, verdict.pdfUrl)
                const fileBuffer = await readFile(filePath)

                return new NextResponse(fileBuffer, {
                    headers: {
                        'Content-Type': 'application/pdf',
                        'Content-Disposition': `inline; filename="${verdict.pdfUrl}"`
                    }
                })
            } catch (fsError) {
                console.error("Error reading signed PDF from disk, falling back to generation:", fsError)
                // Fallback to generation if file is missing
            }
        }

        const data = {
            id: verdict.id,
            eventId: verdict.eventId,
            signedAt: verdict.signedAt,
            finalDiagnosis: verdict.finalDiagnosis,
            recommendations: verdict.recommendations || undefined,
            worker: {
                firstName: verdict.event.worker.firstName,
                lastName: verdict.event.worker.lastName,
                universalId: verdict.event.worker.universalId
            },
            company: {
                name: verdict.event.worker.company?.name || 'Clínica AMI'
            },
            validator: {
                fullName: verdict.validator?.fullName || 'Médico Validador'
            },
            studies: verdict.event.studies.map(s => ({
                serviceName: s.serviceName,
                extractedData: s.extractedData
            })),
            labs: verdict.event.labs.map(l => ({
                serviceName: l.serviceName,
                extractedData: l.extractedData
            }))
        }

        const stream = await renderToStream(<MedicalDictamenPDF data={data} />)

        // Force browser to download instead of inline view by using Content-Disposition attachment if necessary
        return new NextResponse(stream as unknown as ReadableStream, {
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `inline; filename="Dictamen-${verdict.event.worker.universalId}.pdf"`
            }
        })

    } catch (error) {
        console.error("PDF Generation Error:", error)
        return new NextResponse("Error interno al generar el documento PDF.", { status: 500 })
    }
}