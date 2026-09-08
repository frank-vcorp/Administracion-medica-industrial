import Image from 'next/image'
import { BRANDING_LOGO_API_PATH, SME_BRAND_LINE } from '@/lib/brand-constants'

type BrandLogoProps = {
  /** Sidebar colapsada (solo icono). */
  collapsed?: boolean
  className?: string
}

/**
 * Logo SME — uso en shell, login y cualquier pantalla autenticada.
 */
export function BrandLogo({ collapsed = false, className = '' }: BrandLogoProps) {
  const width = collapsed ? 56 : 240
  const height = collapsed ? 56 : 72

  return (
    <Image
      src={BRANDING_LOGO_API_PATH}
      alt={SME_BRAND_LINE}
      width={width}
      height={height}
      className={`object-contain object-left ${className}`}
      priority
    />
  )
}
