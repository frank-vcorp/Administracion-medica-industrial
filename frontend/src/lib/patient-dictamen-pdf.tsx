import { renderToBuffer } from '@react-pdf/renderer'
import {
  PatientHealthDictamenPDF,
  type PatientHealthDictamenPdfData,
} from '@/components/pdf/PatientHealthDictamenPDF'
import { dictamenBackendUrl, sanitizeEventId } from '@/lib/dictamen-pdf'

export function patientDictamenInputFileName(eventId: string, nowMs: number): string {
  return `dictamen-paciente-${sanitizeEventId(eventId)}-${nowMs}.pdf`
}

export function patientDictamenSignedFileName(eventId: string): string {
  return `dictamen-paciente-${sanitizeEventId(eventId)}-signed.pdf`
}

export async function renderPatientHealthDictamenToMemory(
  data: PatientHealthDictamenPdfData,
): Promise<Buffer> {
  return renderToBuffer(<PatientHealthDictamenPDF data={data} />)
}

export async function uploadAndSignPdfOnBackend(input: {
  pdfBuffer: Buffer
  inputFileName: string
  expectedSignedFileName: string
  reason: string
}): Promise<{ success: boolean; signedKey?: string; signatureHash?: string; error?: string }> {
  const backendUrl = dictamenBackendUrl()
  const formData = new FormData()
  formData.append(
    'file',
    new Blob([new Uint8Array(input.pdfBuffer)], { type: 'application/pdf' }),
    input.inputFileName,
  )
  formData.append('key', input.inputFileName)

  let uploadResponse: Response
  try {
    uploadResponse = await fetch(`${backendUrl}/api/v1/upload-only`, {
      method: 'POST',
      body: formData,
    })
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'No se pudo contactar al backend',
    }
  }

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json().catch(() => ({}))
    return {
      success: false,
      error:
        (errorData as { error?: string }).error ??
        `Error al subir PDF (${uploadResponse.status})`,
    }
  }

  const uploadResult = await uploadResponse.json().catch(() => ({}))
  if ((uploadResult as { status?: string }).status === 'error') {
    return {
      success: false,
      error:
        (uploadResult as { error?: string }).error ??
        (uploadResult as { message?: string }).message ??
        'Upload rechazado',
    }
  }

  let signResponse: Response
  try {
    signResponse = await fetch(`${backendUrl}/api/v1/sign-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input_pdf: input.inputFileName,
        output_pdf: input.expectedSignedFileName,
        reason: input.reason,
        password: process.env.PDF_SIGN_PASSWORD || 'default1234',
      }),
    })
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'No se pudo contactar al firmador',
    }
  }

  if (!signResponse.ok) {
    const errorData = await signResponse.json().catch(() => ({}))
    return {
      success: false,
      error:
        (errorData as { error?: string }).error ??
        `Error del firmador (${signResponse.status})`,
    }
  }

  const result = await signResponse.json()
  if ((result as { status?: string }).status !== 'success') {
    return {
      success: false,
      error:
        (result as { error?: string }).error ??
        (result as { message?: string }).message ??
        'Firma rechazada',
    }
  }

  const signedKey =
    typeof (result as { output_pdf?: string }).output_pdf === 'string' &&
    (result as { output_pdf: string }).output_pdf.length > 0
      ? (result as { output_pdf: string }).output_pdf
      : input.expectedSignedFileName

  return {
    success: true,
    signedKey,
    signatureHash:
      typeof (result as { signature_hash?: string }).signature_hash === 'string'
        ? (result as { signature_hash: string }).signature_hash
        : signedKey,
  }
}
