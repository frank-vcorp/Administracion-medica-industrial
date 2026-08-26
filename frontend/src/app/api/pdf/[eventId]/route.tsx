import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { renderToStream } from '@react-pdf/renderer'
import { MedicalDictamenPDF } from "@/components/pdf/MedicalDictamenPDF"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

/**
 * @fileoverview Endpoint autenticado para descargar el PDF de dictamen
 *   médico consolidado (legacy `MedicalDictamenPDF`).
 *
 * @id IMPL-FEATURE-20260825-03 / FND-20260825-18 / P1-2 (QA-20260825-03) / ronda 8
 * @finding discovery/FINDINGS.md FND-20260825-18
 * @finding discovery/FINDINGS.md FND-20260825-25
 * @decision discovery/DECISIONS.md DEC-20260825-21
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-22
 *
 * Esta ruta sirve el dictamen reducido que consume el portal corporativo
 * (`MedicalDictamenPDF`, plantilla con identificación + dictamen +
  recomendaciones + firma). NO expone la historia clínica completa (esa
 * vive en `/api/pdf/examen-medico/[eventId]`, gated por rol clínico).
 *
 * Comportamiento (P1-2 + FND-20260825-25):
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
 *  - Si el dictamen está firmado, `MedicalVerdict.pdfUrl` contiene la
 *    `signedKey` (basename). Resolvemos el archivo vía
 *    `GET /api/files/{key}` del backend (redirección 302 a URL
 *    presigned en S3 o stream local). Esto elimina la dependencia del
 *    filesystem Vercel (`<process.cwd()>/../uploads`, read-only en
 *    producción — FND-20260825-25).
 *  - Si NO hay `pdfUrl` firmado, regeneramos el PDF en línea con
 *    `renderToStream(<MedicalDictamenPDF />)` (sin tocar disco).
 *  - Filename: `Dictamen-<universalId>.pdf` (sin cambios).
 */

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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

        // Si el dictamen está firmado, resolverlo vía `/api/files/{key}` del
        // backend (FND-20260825-25 / DEC-20260825-21). El backend hace 302
        // a S3 presigned (si S3 está habilitado) o sirve el stream local.
        // Esto evita que el frontend Vercel toque filesystem.
        if (verdict.pdfUrl) {
            try {
                // Construimos la URL al backend usando SOLO el basename para
                // evitar path traversal (`/api/files/{key:path}` matchea
                // cualquier path; basename(path) mantiene la defensa).
                const signedKey = basenameSafe(verdict.pdfUrl)
                const backendFileUrl = `${BACKEND_URL}/api/files/${encodeURIComponent(signedKey)}`

                const backendResponse = await fetch(backendFileUrl, {
                    method: 'GET',
                    redirect: 'manual', // queremos propagar el 302 al cliente
                })

                if (backendResponse.status === 302 || backendResponse.status === 301) {
                    // El backend redirige a S3 (o a otra URL interna).
                    const location = backendResponse.headers.get('location')
                    if (!location) {
                        return new NextResponse(
                            'El backend no devolvió URL de redirección.',
                            { status: 502 }
                        )
                    }
                    // Construimos una URL absoluta (Location puede ser path
                    // relativo si el backend está en el mismo origen).
                    const absoluteLocation = location.startsWith('http')
                        ? location
                        : `${BACKEND_URL}${location}`
                    return NextResponse.redirect(absoluteLocation, 302)
                }

                if (backendResponse.ok) {
                    // El backend sirvió el stream localmente (no S3).
                    // Re-emitimos con el Content-Disposition correcto.
                    const arrayBuf = await backendResponse.arrayBuffer()
                    const body = new Uint8Array(arrayBuf)
                    return new NextResponse(body, {
                        status: 200,
                        headers: {
                            'Content-Type': 'application/pdf',
                            'Content-Disposition': `inline; filename="Dictamen-${verdict.event.worker.universalId}.pdf"`,
                            'Cache-Control': 'private, max-age=300',
                        },
                    })
                }

                // El backend devolvió 404 / 503 / 5xx. NO hacemos fallback a
                // filesystem local (FND-20260825-25) — propagamos el error.
                return new NextResponse(
                    `No se pudo resolver el archivo firmado: ${backendResponse.statusText || backendResponse.status}`,
                    { status: 502 }
                )
            } catch (proxyErr) {
                console.error(
                    'Error proxy /api/files/{key}:',
                    proxyErr,
                )
                return new NextResponse(
                    'No se pudo contactar al backend para resolver el dictamen firmado.',
                    { status: 502 }
                )
            }
        }

        // Si NO hay pdfUrl firmado, regeneramos el PDF en línea desde el
        // snapshot (no toca disco).
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

/**
 * Defensa contra path traversal: devuelve SOLO el basename del path,
 * removiendo cualquier prefijo de directorio. Si el resultado es
 * vacío, devuelve 'invalid-key'. El backend (`/api/files/{key}`)
 * también valida con `realpath`; este es un segundo anillo de defensa.
 */
function basenameSafe(input: string): string {
    if (typeof input !== 'string') return 'invalid-key'
    // Tomar la última parte después de '/' o '\\'.
    const parts = input.split(/[\\/]/).filter(Boolean)
    const last = parts[parts.length - 1] ?? ''
    if (last.length === 0 || last.includes('..') || last.includes('\0')) {
        return 'invalid-key'
    }
    return last
}