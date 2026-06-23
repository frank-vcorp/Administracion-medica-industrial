/**
 * @fileoverview Layout paralelo para rutas /demo/* — sin chrome de AMI
 * @id IMPL-20260623-02
 * @backup context/interconsultas/HANDOFF_ARCH-20260623-02_SOFIA_DEMO-UMM-REPORTS.md
 *
 * Las rutas /demo/* son públicas (ver middleware.ts y AppShell.tsx) y se
 * renderizan sin sidebar/header de AMI. Este layout solo aporta el fondo
 * base; las páginas internas (e.g. /demo/reports) ya incluyen su propio
 * banner "DEMO MODE" y contenido.
 */
import { ReactNode } from 'react'

export const metadata = {
  title: 'Demo Reportes Masivos UMM | AMI',
  description: 'Demo navegable del Módulo de Reportes Masivos (datos estáticos).',
  robots: 'noindex, nofollow',
}

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      {children}
    </div>
  )
}
