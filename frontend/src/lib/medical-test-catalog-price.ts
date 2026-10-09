/**
 * Precio público sugerido desde MedicalTest.options (misma convención que lab).
 * No hay columna `price` en Prisma; ops puede setear `options.price` o `options.basePrice`.
 */

export function readCatalogPriceFromOptions(options: unknown): number {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    return 0
  }
  const opts = options as Record<string, unknown>
  const raw =
    typeof opts.price === 'number'
      ? opts.price
      : typeof opts.basePrice === 'number'
        ? opts.basePrice
        : 0
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}
