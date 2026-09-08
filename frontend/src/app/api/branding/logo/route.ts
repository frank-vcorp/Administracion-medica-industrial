import { NextResponse } from 'next/server'
import { resolveBrandingLogoBytes } from '@/lib/ami-brand'

export const dynamic = 'force-dynamic'

/** Logo institucional — público (login + PDFs vía data-URL en server). */
export async function GET() {
  const { buffer, mime, cacheKey } = await resolveBrandingLogoBytes()
  if (!buffer) {
    return new NextResponse('Logo no disponible', { status: 404 })
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': mime,
      'Cache-Control': 'public, max-age=300',
      ETag: `"${cacheKey}"`,
    },
  })
}
