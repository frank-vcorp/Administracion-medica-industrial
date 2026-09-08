import { ReactNode } from 'react'
import { BrandLogo } from '@/components/BrandLogo'

export function PublicPortalChrome({
  title,
  titleAccent,
  subtitle,
  children,
}: {
  title: string
  titleAccent?: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#f9fafb] text-[#636569]">
      <header className="bg-white">
        <div className="border-t-2 border-[#592c82] border-b-[6px] border-b-[#00afaa]">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <BrandLogo className="h-14 w-auto max-h-14" />
            <span className="rounded-full bg-[#592c82]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-[#592c82]">
              Portal público
            </span>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-6 py-6">
          <h1 className="text-2xl font-bold leading-tight text-[#636569]">
            {title}
            {titleAccent ? (
              <>
                {' '}
                <span className="text-[#592c82]">{titleAccent}</span>
              </>
            ) : null}
          </h1>
          <p className="mt-2 text-sm text-[#636569]">{subtitle}</p>
        </div>
      </header>
      <main className="py-8">{children}</main>
    </div>
  )
}
