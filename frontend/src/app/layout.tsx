/**
 * @fileoverview Root Layout — delega chrome a AppShell
 * @author SOFIA - Builder
 * @id IMPL-20260324-01
 * @backup context/checkpoints/CHK_IMPL-20260324-01.md
 * FIX REFERENCE: FIX-20260324-01 — sidebar/header ocultos en /login; nav filtrada por rol
 */
import { ReactNode } from 'react'
import Providers from '@/components/Providers'
import AppShell from '@/components/AppShell'

import './globals.css'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  )
}
 
