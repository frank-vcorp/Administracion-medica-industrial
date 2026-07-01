/**
 * @file Utilidades de validación de contacto (teléfono, email)
 * @id IMPL-20260630-01
 * @description Reglas anti-relleno y anti-patrón para alta de trabajadores/pacientes
 * 
 * Patrones rechazados:
 * - Teléfono: secuencias consecutivas (1234567890), dígito repetido (1111111111)
 * - Email: local-part con patrones obvios de test/relleno
 */

import { z } from 'zod'

// ─────────────────────────────────────────────────────────────────────────────
// Constantes de patrones rechazados
// ─────────────────────────────────────────────────────────────────────────────

/** Secuencias consecutivas ascendentes/descendentes (ej: 1234567890, 0987654321) */
const CONSECUTIVE_SEQUENCES = [
  '0123456789',
  '1234567890',
  '2345678901',
  '3456789012',
  '4567890123',
  '5678901234',
  '6789012345',
  '7890123456',
  '8901234567',
  '9012345678',
  '9876543210',
  '8765432109',
  '7654321098',
  '6543210987',
  '5432109876',
  '4321098765',
  '3210987654',
  '2109876543',
  '1098765432',
  '0987654321',
]

/** Dígito repetido 10 veces (ej: 1111111111, 2222222222) */
const REPEATED_DIGIT_PATTERNS = [
  '0000000000', '1111111111', '2222222222', '3333333333', '4444444444',
  '5555555555', '6666666666', '7777777777', '8888888888', '9999999999',
]

/** Patrones comunes de relleno en email local-part (solo obvios) */
const EMAIL_FILLER_PATTERNS = [
  /^test\d*$/i,
  /^demo\d*$/i,
  /^example\d*$/i,
  /^sample\d*$/i,
  /^fake\d*$/i,
  /^dummy\d*$/i,
  /^placeholder\d*$/i,
  /^temp\d*$/i,
  /^aaaa+$/i,
  /^bbb+$/i,
  /^cccc+$/i,
  /^xxxx+$/i,
  /^zzzz+$/i,
  /^123+$/,
  /^abc+$/i,
  /^qwe+$/i,
  /^asd+$/i,
  /^zxc+$/i,
]

/** Dominios de email temporales/falsos conocidos + dominios bloqueados por negocio */
const TEMP_EMAIL_DOMAINS = [
  'tempmail.com', 'temp-mail.org', 'guerrillamail.com', 'mailinator.com',
  '10minutemail.com', 'throwawaymail.com', 'fakeinbox.com', 'trashmail.com',
  'yopmail.com', 'maildrop.cc', 'dispostable.com', 'getnada.com',
  'tempail.com', 'emailondeck.com', 'mintemail.com', 'spamgourmet.com',
  'medicaindustrial.com', 'medicaindustrial.com.mx',
]

// ─────────────────────────────────────────────────────────────────────────────
// Funciones de validación de teléfono
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza un teléfono: solo dígitos, sin espacios, guiones, paréntesis, +, etc.
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

/**
 * Verifica si el teléfono normalizado contiene secuencias consecutivas
 */
function hasConsecutiveSequence(normalized: string): boolean {
  if (normalized.length < 10) return false
  // Ventana deslizante de 10 dígitos para detectar sub-secuencias
  for (let i = 0; i <= normalized.length - 10; i++) {
    const window = normalized.slice(i, i + 10)
    if (CONSECUTIVE_SEQUENCES.includes(window)) return true
  }
  return false
}

/**
 * Verifica si el teléfono normalizado es un dígito repetido
 */
function isRepeatedDigit(normalized: string): boolean {
  if (normalized.length < 10) return false
  return REPEATED_DIGIT_PATTERNS.some(p => normalized.includes(p))
}

/**
 * Valida un número de teléfono mexicano (10 dígitos)
 * Rechaza: secuencias consecutivas, dígito repetido, longitud incorrecta
 */
export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const normalized = normalizePhone(phone)

  if (normalized.length !== 10) {
    return { valid: false, error: 'El teléfono debe tener 10 dígitos' }
  }

  if (hasConsecutiveSequence(normalized)) {
    return { valid: false, error: 'El teléfono no puede ser una secuencia numérica consecutiva (ej: 1234567890)' }
  }

  if (isRepeatedDigit(normalized)) {
    return { valid: false, error: 'El teléfono no puede ser un dígito repetido (ej: 1111111111)' }
  }

  // Validación básica: no empezar con 0 (en México los números móviles empiezan 2-9)
  // Comentado por si hay números fijos válidos que empiecen con otras zonas
  // if (normalized[0] === '0') {
  //   return { valid: false, error: 'El teléfono no puede empezar con 0' }
  // }

  return { valid: true }
}

/**
 * Formatea teléfono mexicano para display: (XX) XXXX-XXXX o +52 1 (XX) XXXX-XXXX
 */
export function formatPhoneDisplay(phone: string): string {
  const normalized = normalizePhone(phone)
  if (normalized.length === 10) {
    return `(${normalized.slice(0, 2)}) ${normalized.slice(2, 6)}-${normalized.slice(6)}`
  }
  if (normalized.length === 13 && normalized.startsWith('521')) {
    // Formato con código de país México +52 1 (celular)
    return `+52 1 (${normalized.slice(3, 5)}) ${normalized.slice(5, 9)}-${normalized.slice(9)}`
  }
  if (normalized.length === 12 && normalized.startsWith('52')) {
    return `+52 (${normalized.slice(2, 4)}) ${normalized.slice(4, 8)}-${normalized.slice(8)}`
  }
  return phone // fallback: devuelve original si no coincide
}

// ─────────────────────────────────────────────────────────────────────────────
// Funciones de validación de email
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida email con reglas anti-relleno
 * - Formato RFC5322 básico (via regex)
 * - Rechaza local-part con patrones de test/demo/fake
 * - Rechaza dominios temporales conocidos
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim().toLowerCase()

  // RFC5322 simplificado pero práctico
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Formato de email inválido' }
  }

  const [localPart, domain] = trimmed.split('@')

  // Verificar patrones de relleno en local-part
  for (const pattern of EMAIL_FILLER_PATTERNS) {
    if (pattern.test(localPart)) {
      return { valid: false, error: 'El email parece ser de prueba o relleno. Usa un email real.' }
    }
  }

  // Verificar dominio temporal
  if (TEMP_EMAIL_DOMAINS.includes(domain)) {
    return { valid: false, error: 'No se permiten emails de dominios temporales/desechables' }
  }

  // Verificar local-part muy corto (menos de 3 chars suele ser sospechoso)
  if (localPart.length < 3) {
    return { valid: false, error: 'La parte local del email es muy corta' }
  }

  // Verificar local-part solo números (patrón común de relleno)
  if (/^\d+$/.test(localPart)) {
    return { valid: false, error: 'El email no puede ser solo números' }
  }

  // Verificar local-part con patrón repetitivo (aaa, bbb, etc)
  if (/^(.)\1{2,}$/.test(localPart)) {
    return { valid: false, error: 'El email tiene un patrón repetitivo en la parte local' }
  }

  return { valid: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Esquemas Zod reutilizables
// ─────────────────────────────────────────────────────────────────────────────

/** Esquema Zod para teléfono mexicano válido (10 dígitos, sin patrones de relleno) */
export const PhoneSchema = z
  .string()
  .min(1, 'Teléfono requerido')
  .superRefine((val, ctx) => {
    const result = validatePhone(val)
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || 'Teléfono inválido',
      })
    }
  })
  .transform((val) => normalizePhone(val))

/** Esquema Zod para teléfono opcional (permite string vacío) */
export const OptionalPhoneSchema = z
  .union([z.string(), z.undefined()])
  .optional()
  .superRefine((val, ctx) => {
    if (!val) return
    const result = validatePhone(val)
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || 'Teléfono inválido',
      })
    }
  })
  .transform((val) => (val ? normalizePhone(val) : undefined))

/** Esquema Zod para email válido con anti-relleno */
export const EmailSchema = z
  .string()
  .min(1, 'Email requerido')
  .email('Formato de email inválido')
  .superRefine((val, ctx) => {
    const result = validateEmail(val)
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || 'Email inválido',
      })
    }
  })
  .transform((val) => val.trim().toLowerCase())

/** Esquema Zod para email opcional */
export const OptionalEmailSchema = z
  .union([z.string(), z.undefined()])
  .optional()
  .superRefine((val, ctx) => {
    if (!val) return
    const result = validateEmail(val)
    if (!result.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: result.error || 'Email inválido',
      })
    }
  })
  .transform((val) => (val ? val.trim().toLowerCase() : undefined))

// ─────────────────────────────────────────────────────────────────────────────
// Esquema combinado para datos de contacto
// ─────────────────────────────────────────────────────────────────────────────

export const ContactDataSchema = z.object({
  phone: PhoneSchema,
  email: EmailSchema,
})

export const OptionalContactDataSchema = z.object({
  phone: OptionalPhoneSchema,
  email: OptionalEmailSchema,
})

// ─────────────────────────────────────────────────────────────────────────────
// Tipos inferidos
// ─────────────────────────────────────────────────────────────────────────────

export type PhoneValidationResult = ReturnType<typeof validatePhone>
export type EmailValidationResult = ReturnType<typeof validateEmail>
export type ContactData = z.infer<typeof ContactDataSchema>
export type OptionalContactData = z.infer<typeof OptionalContactDataSchema>