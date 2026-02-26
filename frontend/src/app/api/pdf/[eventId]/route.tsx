import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { renderToStream } from '@react-pdf/renderer'
import { MedicalDictamenPDF } from "@/components/pdf/MedicalDictamenPDF"
import { readFile } from "fs/promises"
import { join } from "path"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ eventId: string }> }
) {
    try {
        const { eventId } = await params

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
