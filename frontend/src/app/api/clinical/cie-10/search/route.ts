import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import { withApiErrors } from '@/lib/api-handler'
import { searchCie10Catalog } from '@/lib/clinical/cie-10-catalog'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CLINICAL_ROLES = new Set([
  'SUPERADMIN',
  'ADMIN',
  'DOCTOR_GENERAL',
  'DOCTOR_VALIDATOR',
  'RECEPTIONIST',
  'CAPTURIST',
])

export const GET = withApiErrors('GET /api/clinical/cie-10/search', async (req: NextRequest) => {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !CLINICAL_ROLES.has(session.user.role ?? '')) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limitRaw = parseInt(req.nextUrl.searchParams.get('limit') ?? '25', 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 50) : 25

  const results = searchCie10Catalog(q, limit).map((entry) => ({
    code: entry.code,
    description: entry.description,
  }))

  return NextResponse.json({ results })
})
