/** Razón social / marca principal en UI, PDFs y correos. */
export const SME_LEGAL_NAME = 'Soluciones Medico Empresariales'

/** Marca clínica — minuta AMI-SR F-017 #1. */
export const SME_BRAND_LINE = `${SME_LEGAL_NAME} / Medicina Laboral`

export const SME_PDF_FOOTER = `${SME_LEGAL_NAME} — Circuito del Mesón #135, Col. Del Prado, C.P. 76030, Santiago de Querétaro — (442) 225-52-67 — www.medicaindustrial.com`

export const SME_LOGO_FALLBACK_TEXT = 'SME'

export const SME_LOGO_FILENAME = 'SOLUCIONES MEDICO EMPRESRIALES-06.png'

export const SME_LOGO_PUBLIC_PATH = `/branding/${encodeURIComponent(SME_LOGO_FILENAME)}`

export const BRANDING_LOGO_API_PATH = '/api/branding/logo'

/** @deprecated Usar `BRANDING_LOGO_API_PATH`. */
export const AMI_LOGO_URL = BRANDING_LOGO_API_PATH
