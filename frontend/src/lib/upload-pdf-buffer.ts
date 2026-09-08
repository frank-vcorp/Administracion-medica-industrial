/**
 * Sube un PDF al backend Railway/S3 vía POST /api/v1/upload-only.
 */
export async function uploadPdfBuffer(
  buffer: Buffer,
  key: string,
): Promise<{ success: true; key: string } | { success: false; error: string }> {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' })
  const formData = new FormData()
  formData.append('file', blob, key.split('/').pop() ?? 'document.pdf')
  formData.append('key', key)

  try {
    const res = await fetch(`${backendUrl}/api/v1/upload-only`, {
      method: 'POST',
      body: formData,
    })
    const body = (await res.json().catch(() => null)) as { status?: string; error?: string } | null
    if (!res.ok || body?.status === 'error') {
      return {
        success: false,
        error: body?.error || `Error al subir PDF (${res.status})`,
      }
    }
    return { success: true, key }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error de red al subir PDF',
    }
  }
}
