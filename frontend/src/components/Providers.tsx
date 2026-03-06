/**
 * @intervention FIX-20260306-01
 * @see context/interconsultas/DICTAMEN_FIX-20260306-01.md
 */

'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

export default function Providers({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            {children}
        </SessionProvider>
    )
}
