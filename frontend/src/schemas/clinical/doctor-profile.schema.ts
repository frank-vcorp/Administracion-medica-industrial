/**
 * @fileoverview Schema Zod del perfil médico editable por Superadmin/Doctor.
 * @id IMPL-FEATURE-20260825-01
 * @backup context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md
 *
 * Sigue el patrón `z.string().trim()` usado por el resto de schemas
 * clínicos del proyecto (no se inventa convención nueva). Validación
 * server-side OBLIGATORIA: la UI muestra el mismo error pero la fuente
 * de verdad es este schema.
 *
 * Reglas:
 *  - `fullName`: 3–120 caracteres tras trim. Requerido: aparece en el
 *    membrete/firma del PDF validado.
 *  - `professionalLicense` (cédula profesional): 4–20 caracteres alfanuméricos
 *    (se acepta guion y espacios para cédulas con formato "123456-7" o
 *    "AE123456"). Opcional — pero el PDF validado requiere al menos un
 *    valor no vacío; la server action bloquea la generación de PDF si la
 *    cédula quedó vacía (el médico debe completar perfil antes de aceptar/
 *    editar una revisión).
 *  - `signatureImageUrl`: data URL o ruta relativa servible por la app.
 *    Opcional en el schema (el médico puede dejar la firma pendiente) pero
 *    requerido por la acción para generar PDF.
 */
import { z } from 'zod'

/**
 * Cédula profesional mexicana / equivalente.
 * Acepta letras, dígitos, guion y espacio; longitud 4–20.
 * Rechaza caracteres especiales que no se usan en cédulas reales.
 */
const professionalLicenseSchema = z
  .string()
  .trim()
  .max(20, 'La cédula no puede exceder 20 caracteres')
  .regex(
    /^[A-Za-z0-9 \-]{4,20}$/,
    'Cédula inválida (use letras, dígitos, guion o espacio; 4–20 caracteres)',
  )
  .optional()
  .or(z.literal(''))

/**
 * URL o data-URL de la firma autógrafa. Acepta:
 *  - data:image/png;base64,... (captura desde canvas/firma digital)
 *  - data:image/jpeg;base64,...
 *  - /uploads/signatures/<file>.<ext> (ruta servida por la app)
 *  - https://... (URL absoluta)
 *
 * Limitamos longitud total para evitar payloads absurdos (5 MB de imagen
 * base64 ≈ 6.7 MB de texto). 7 000 000 chars cubre hasta ~5 MB binarios.
 */
const signatureImageUrlSchema = z
  .string()
  .trim()
  .max(7_000_000, 'La firma es demasiado pesada (>5 MB aprox.)')
    .refine(
      (v) =>
        v === '' ||
        v.startsWith('data:image/') ||
        v.startsWith('/uploads/') ||
        v.startsWith('https://'),
      'La firma debe ser una data-URL de imagen, una ruta /uploads/... o una URL https',
    )
  .optional()
  .or(z.literal(''))

export const doctorProfileSchema = z.object({
  fullName: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120, 'Máximo 120 caracteres'),
  professionalLicense: professionalLicenseSchema,
  signatureImageUrl: signatureImageUrlSchema,
})

export type DoctorProfileInput = z.infer<typeof doctorProfileSchema>

/**
 * Validación server-side adicional para confirmar que el médico tiene
 * los datos mínimos para que se genere un PDF validado. Se usa en la
 * acción que crea el PDF (no en la edición del perfil). Devuelve null
 * si está OK; un mensaje legible en caso contrario.
 */
export function validateDoctorProfileForPdf(input: {
  fullName?: string | null
  professionalLicense?: string | null
  signatureImageUrl?: string | null
}): string | null {
  const name = (input.fullName ?? '').trim()
  if (name.length < 3) {
    return 'El médico debe tener un nombre completo (≥3 caracteres) registrado en su perfil antes de emitir un PDF validado.'
  }
  const license = (input.professionalLicense ?? '').trim()
  if (license.length < 4) {
    return 'El médico debe registrar su cédula profesional (≥4 caracteres) en su perfil antes de emitir un PDF validado.'
  }
  const sig = (input.signatureImageUrl ?? '').trim()
  if (sig.length === 0) {
    return 'El médico debe registrar su firma autógrafa en su perfil antes de emitir un PDF validado.'
  }
  return null
}
