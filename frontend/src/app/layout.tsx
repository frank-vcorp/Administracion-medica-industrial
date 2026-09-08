/**
 * @fileoverview Root Layout — delega chrome a AppShell
 * @author SOFIA - Builder
 * @id IMPL-20260324-01
 * @backup context/checkpoints/CHK_IMPL-20260324-01.md
 * FIX REFERENCE: FIX-20260324-01 — sidebar/header ocultos en /login; nav filtrada por rol
 */
import { ReactNode, Suspense } from 'react'
import { Inter } from 'next/font/google'
import { getServerSession } from 'next-auth'
import Providers from '@/components/Providers'
import AppShell from '@/components/AppShell'
import { authOptions } from '@/auth'

import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
})

/**
 * @intervention ARCH-20260326-02
 * @see context/checkpoints/CHK_ARCH-20260326-02.md
 * ARCH-20260908-01 — Inter + paleta AMI institucional
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions)

  return (
    <html lang="es" className={inter.className}>
      <body className="min-h-screen bg-ami-surface text-ami-gray">
        <Providers session={session}>
          {/* Suspense requerido por useSearchParams en AppShell — IMPL-20260324-07 */}
          <Suspense>
            <AppShell>{children}</AppShell>
          </Suspense>
        </Providers>
      </body>
    </html>
  )
}
 
