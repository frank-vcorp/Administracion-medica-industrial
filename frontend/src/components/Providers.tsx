/**
 * @intervention FIX-20260306-01
 * @see context/interconsultas/DICTAMEN_FIX-20260306-01.md
 */

'use client'

import { SessionProvider } from 'next-auth/react'
import type { Session } from 'next-auth'
import { ReactNode } from 'react'
import GlobalSentenceCaseBlur from '@/components/GlobalSentenceCaseBlur'
import GlobalSpellCheck from '@/components/GlobalSpellCheck'
import SpellcheckOnboardingModal from '@/components/SpellcheckOnboardingModal'

/**
 * @intervention ARCH-20260326-02
 * @see context/checkpoints/CHK_ARCH-20260326-02.md
 */
export default function Providers({ children, session }: { children: ReactNode; session: Session | null }) {
    return (
        <SessionProvider session={session}>
            <GlobalSpellCheck />
            <GlobalSentenceCaseBlur />
            <SpellcheckOnboardingModal />
            {children}
        </SessionProvider>
    )
}
