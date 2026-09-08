import { z } from 'zod'

/** Valor persistido en AppConfig (`key = branding.logo`). */
export const BrandingLogoConfigSchema = z.object({
  fileKey: z.string().min(1).max(256),
  updatedAt: z.string().datetime(),
  originalFilename: z.string().max(255).optional(),
})

export type BrandingLogoConfig = z.infer<typeof BrandingLogoConfigSchema>

export const APP_CONFIG_BRANDING_LOGO_KEY = 'branding.logo'

export const BRANDING_LOGO_UPLOAD_KEY = 'branding/sme-logo'
