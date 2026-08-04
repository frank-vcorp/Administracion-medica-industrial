/**
 * @file /admin/mobile-units/new — Redirección al catálogo.
 * @id IMPL-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS
 *
 * IMPL-20260804-02: la creación de unidades ahora se hace vía
 * MobileUnitCreateModal desde /admin/mobile-units (botón "+ Nueva Unidad").
 * Esta ruta queda como redirección server-side para preservar deep-links
 * externos (Vercel bookmarks, emails, tests e2e que apunten aquí).
 */
import { redirect } from 'next/navigation'

export default function NewMobileUnitPage() {
  redirect('/admin/mobile-units')
}