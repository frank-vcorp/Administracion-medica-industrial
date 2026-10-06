import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  buildPortalPreviewCookieValue,
  verifyPortalPreviewCookieValue,
} from '@/lib/portal-preview'

describe('portal-preview cookie', () => {
  const prev = process.env.NEXTAUTH_SECRET

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = 'test-secret-for-portal-preview'
  })

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = prev
  })

  it('firma y verifica companyId', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const raw = buildPortalPreviewCookieValue(id)
    expect(verifyPortalPreviewCookieValue(raw)).toBe(id)
  })

  it('rechaza firma alterada', () => {
    const id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const raw = buildPortalPreviewCookieValue(id)
    expect(verifyPortalPreviewCookieValue(raw.replace(/.$/, '0'))).toBeNull()
  })
})
