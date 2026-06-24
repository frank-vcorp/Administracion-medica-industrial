/**
 * @file Configuración mínima de Vitest para tests unitarios puros.
 * @id IMPL-20260623-03
 *
 * NOTA: Vitest NO está en devDependencies de este proyecto a la fecha de
 * cierre de Fase 6. La instalación queda pendiente para INTEGRA.
 * Este archivo solo define la config de alias `@` y entorno Node.
 * Una vez instalado `vitest` (>=2.0), `pnpm test` ejecutará los tests.
 */
import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts'],
    globals: false,
  },
})
