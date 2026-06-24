/**
 * @file Helper: resolución de URL base pública.
 * @id IMPL-20260624-02 (SPEC ARCH-20260624-02)
 *
 * Resuelve la URL base pública con fallback jerárquico:
 *   1. NEXT_PUBLIC_BASE_URL              (override manual)
 *   2. VERCEL_PROJECT_PRODUCTION_URL     (auto: dominio custom de producción en Vercel)
 *   3. VERCEL_URL                        (auto: *.vercel.app preview o fallback)
 *   4. 'http://localhost:3000'           (dev)
 *
 * Nunca retorna string con trailing slash.
 * Función pura (acepta `env` opcional) para ser testeable sin tocar `process.env`.
 *
 * Notas de diseño:
 * - No usa `headers()`: debe funcionar en server action, build-time y tests
 *   sin necesidad de un request context.
 * - `NEXT_PUBLIC_*` en el nombre del primer env para que sea seguro embeber
 *   en código de cliente si más adelante la UI necesita construir URLs públicos
 *   (no aplica hoy, pero es buena práctica).
 */

/**
 * Tipo del objeto de env. Coincide con `process.env` en tiempo de ejecución;
 * se acota a un `Record<string, string | undefined>` para tests deterministas.
 */
export type EnvLike = Record<string, string | undefined>

/**
 * Resuelve la URL base pública según la jerarquía documentada.
 *
 * @param env Opcional. Defaults a `process.env`. Tests pasan un objeto literal.
 * @returns URL base pública sin trailing slash.
 */
export function getPublicBaseUrl(env: EnvLike = process.env): string {
  const candidate =
    env.NEXT_PUBLIC_BASE_URL ||
    env.VERCEL_PROJECT_PRODUCTION_URL ||
    env.VERCEL_URL ||
    'http://localhost:3000'
  return candidate.replace(/\/$/, '')
}
