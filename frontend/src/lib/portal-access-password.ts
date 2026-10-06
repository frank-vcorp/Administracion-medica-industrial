import { randomBytes } from 'node:crypto'

/** Contraseña temporal legible (12 chars, sin caracteres ambiguos). */
export function generateTemporaryPortalPassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(12)
  let out = ''
  for (let i = 0; i < 12; i++) {
    out += alphabet[bytes[i]! % alphabet.length]
  }
  return out
}

export function validatePortalPassword(password: string): string | null {
  if (password.length < 10) {
    return 'La contraseña debe tener al menos 10 caracteres.'
  }
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Use letras y números en la contraseña.'
  }
  return null
}
