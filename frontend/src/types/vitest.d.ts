/**
 * @file Declaraciones de tipos mínimas para Vitest (mientras se instala la dependencia).
 * @id IMPL-20260623-03
 *
 * Vitest NO está instalado en este proyecto a la fecha de cierre de Fase 6.
 * Este shim permite que `tsc --noEmit` pase sobre los tests existentes
 * sin necesidad de agregar la dependencia real. Cuando se instale `vitest`
 * (>=2.0), este archivo debe eliminarse para usar los tipos oficiales.
 */
declare module 'vitest' {
  export function describe(name: string, fn: () => void): void
  export function it(name: string, fn: () => void | Promise<void>): void
  // Compat: `it.only` y `it.skip` no se usan aquí, omitidos a propósito.
  type ExpectChain = {
    toBe: (expected: unknown) => void
    toEqual: (expected: unknown) => void
    toHaveLength: (n: number) => void
    toBeDefined: () => void
    toBeUndefined: () => void
    toContain: (value: unknown) => void
    toMatch: (re: RegExp | string) => void
    toBeGreaterThanOrEqual: (n: number) => void
    toBeTruthy: () => void
    toBeFalsy: () => void
    not: ExpectChain
  }
  export const expect: {
    (value: unknown): ExpectChain
  }
}

declare module 'vitest/config' {
  // Tipo mínimo para `defineConfig`. La forma completa la provee vitest real.
  export function defineConfig(config: unknown): unknown
}
