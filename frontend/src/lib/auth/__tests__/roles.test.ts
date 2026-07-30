/**
 * @file Tests unitarios del helper de roles (FIX-20260730-02).
 * @id FIX-20260730-02
 * @spec context/SPECs/SPEC_FIX-20260730-02-SUPERADMIN-INHERITS-ADMIN.md §4.3
 *
 * Cubre los 11 casos de SPEC §4.3:
 *   - isAdminLike('SUPERADMIN')    → true
 *   - isAdminLike('ADMIN')         → true
 *   - isAdminLike('VENDEDOR')      → false
 *   - isAdminLike('COMPANY_CLIENT')→ false
 *   - isAdminLike(null/undefined/'') → false
 *   - isSellerLike('SUPERADMIN')   → true
 *   - isSellerLike('ADMIN')        → true
 *   - isSellerLike('VENDEDOR')     → true
 *   - isSellerLike('COMPANY_CLIENT') → false
 *   - isSuperAdmin('SUPERADMIN')   → true
 *   - isSuperAdmin('ADMIN')        → false
 */
/// <reference types="vitest/globals" />

import { isAdminLike, isSellerLike, isSuperAdmin } from '@/lib/auth/roles'

describe('isAdminLike', () => {
  it('SUPERADMIN tiene permisos de admin (hereda de ADMIN)', () => {
    expect(isAdminLike('SUPERADMIN')).toBe(true)
  })

  it('ADMIN tiene permisos de admin', () => {
    expect(isAdminLike('ADMIN')).toBe(true)
  })

  it('VENDEDOR NO tiene permisos de admin', () => {
    expect(isAdminLike('VENDEDOR')).toBe(false)
  })

  it('COMPANY_CLIENT NO tiene permisos de admin', () => {
    expect(isAdminLike('COMPANY_CLIENT')).toBe(false)
  })

  it('null, undefined y string vacío NO tienen permisos de admin', () => {
    expect(isAdminLike(null)).toBe(false)
    expect(isAdminLike(undefined)).toBe(false)
    expect(isAdminLike('')).toBe(false)
  })
})

describe('isSellerLike', () => {
  it('SUPERADMIN tiene permisos de vendedor (hereda de ADMIN y VENDEDOR)', () => {
    expect(isSellerLike('SUPERADMIN')).toBe(true)
  })

  it('ADMIN tiene permisos de vendedor', () => {
    expect(isSellerLike('ADMIN')).toBe(true)
  })

  it('VENDEDOR tiene permisos de vendedor', () => {
    expect(isSellerLike('VENDEDOR')).toBe(true)
  })

  it('COMPANY_CLIENT NO tiene permisos de vendedor', () => {
    expect(isSellerLike('COMPANY_CLIENT')).toBe(false)
  })
})

describe('isSuperAdmin', () => {
  it('SUPERADMIN tiene permisos destructivos exclusivos', () => {
    expect(isSuperAdmin('SUPERADMIN')).toBe(true)
  })

  it('ADMIN NO tiene permisos destructivos exclusivos (separación de poderes)', () => {
    expect(isSuperAdmin('ADMIN')).toBe(false)
  })
})