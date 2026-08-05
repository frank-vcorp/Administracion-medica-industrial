/**
 * @file Playwright globalSetup: carga .env y ejecuta seed-e2e antes de los tests.
 * @id IMPL-20260804-05 — O1 (CIERRE)
 *
 * - Carga .env.local / .env desde frontend/ (si existen) para tener DATABASE_URL
 *   y NEXTAUTH_SECRET disponibles en el proceso del seed.
 * - Ejecuta `tsx scripts/seed-e2e.ts` en un subproceso (no en el proceso actual)
 *   para que el PrismaClient del seed no contamine el contexto de Playwright.
 */
import { spawnSync } from 'node:child_process'
import * as path from 'node:path'
import * as fs from 'node:fs'

// FIX IMPL-20260804-06 R7: paths absolutos basados en __dirname para no depender
// de process.cwd(). Permite ejecutar Playwright desde la raíz del repo.
const FRONTEND_DIR = path.resolve(__dirname, '..')

// Carga mínima de .env sin dependencias externas (parse KEY=VALUE).
function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  const content = fs.readFileSync(filePath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx <= 0) continue
    const key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1).trim()
    // Strip surrounding quotes if present
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) {
      process.env[key] = value
    }
  }
}

export default async function globalSetup(): Promise<void> {
  // Prioridad: .env.local > .env
  loadEnvFile(path.join(FRONTEND_DIR, '.env.local'))
  loadEnvFile(path.join(FRONTEND_DIR, '.env'))

  if (!process.env.DATABASE_URL) {
    throw new Error(
      '[global-setup] DATABASE_URL no definida. Crea frontend/.env o frontend/.env.local.'
    )
  }

  console.log('[global-setup] Ejecutando scripts/seed-e2e.ts…')
  // cwd se fija explícitamente al directorio del frontend para que
  // tsx resuelva correctamente la importación @prisma/client y la ruta
  // relativa al schema.prisma.
  const result = spawnSync('npx', ['tsx', 'scripts/seed-e2e.ts'], {
    cwd: FRONTEND_DIR,
    env: process.env,
    stdio: 'inherit',
    encoding: 'utf8',
  })
  if (result.status !== 0) {
    throw new Error(
      `[global-setup] seed-e2e.ts falló con status=${result.status ?? 'null'}`
    )
  }
  console.log('[global-setup] ✅ Seed E2E completado')
}
