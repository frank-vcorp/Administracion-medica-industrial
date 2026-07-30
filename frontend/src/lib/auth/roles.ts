/**
 * @file Helper centralizado de autorización por rol.
 * @id FIX-20260730-02 — SUPERADMIN hereda permisos de ADMIN
 * @spec context/SPECs/SPEC_FIX-20260730-02-SUPERADMIN-INHERITS-ADMIN.md
 *
 * Una sola fuente de verdad para "¿este rol puede hacer X?". Refactor de las
 * 24 comprobaciones inline que duplicaban `role === 'ADMIN'` o
 * `role !== 'ADMIN' && role !== 'VENDEDOR'` por todo el frontend.
 *
 * Jerarquía (de mayor a menor privilegio):
 *
 *   SUPERADMIN ⊃ ADMIN ⊃ VENDEDOR ⊃ RECEPTIONIST, DOCTOR_*, CAPTURIST, COMPANY_CLIENT
 *
 * SUPERADMIN hereda **todos** los permisos de ADMIN (más las acciones
 * destructivas de IMPL-20260730-01). ADMIN NO hereda los permisos destructivos
 * de SUPERADMIN — la separación de poderes se preserva.
 */

import type { UserRole } from '@prisma/client'

/** Roles con privilegios administrativos (sidebar admin, edición de empresas, etc.). SUPERADMIN hereda todos los permisos de ADMIN. */
export const ADMIN_LIKE_ROLES: readonly UserRole[] = ['SUPERADMIN', 'ADMIN']

/** Roles con permisos de gestión comercial (vendedor, admin, super). */
export const SELLER_LIKE_ROLES: readonly UserRole[] = ['SUPERADMIN', 'ADMIN', 'VENDEDOR']

/** ¿Tiene el rol permisos de admin o superior? (SUPERADMIN o ADMIN) */
export function isAdminLike(role: UserRole | string | null | undefined): boolean {
  if (!role) return false
  return (ADMIN_LIKE_ROLES as readonly string[]).includes(role)
}

/** ¿Tiene el rol permisos de vendedor o superior? (SUPERADMIN, ADMIN o VENDEDOR) */
export function isSellerLike(role: UserRole | string | null | undefined): boolean {
  if (!role) return false
  return (SELLER_LIKE_ROLES as readonly string[]).includes(role)
}

/** ¿Tiene el rol permisos destructivos exclusivos? (sólo SUPERADMIN) */
export function isSuperAdmin(role: UserRole | string | null | undefined): boolean {
  return role === 'SUPERADMIN'
}