/**
 * CLI para la misma limpieza que Configuración → Limpieza de datos operativos.
 *
 *   npx tsx scripts/cleanup-operational-clinical-data.ts --dry-run
 *   npx tsx scripts/cleanup-operational-clinical-data.ts --execute
 */
import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import {
  previewOperationalCleanup,
  runOperationalCleanup,
} from '../src/services/operational-cleanup.service'

const FRONTEND_DIR = path.resolve(__dirname, '..')

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eqIdx = line.indexOf('=')
    if (eqIdx <= 0) continue
    const key = line.slice(0, eqIdx).trim()
    let value = line.slice(eqIdx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function dbHostRedacted(): string {
  const url = process.env.DATABASE_URL ?? ''
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, 'http:'))
    return u.hostname
  } catch {
    return '(url inválida)'
  }
}

async function main(): Promise<void> {
  loadEnvFile(path.join(FRONTEND_DIR, '.env.local'))
  loadEnvFile(path.join(FRONTEND_DIR, '.env.production.local'))
  loadEnvFile(path.join(FRONTEND_DIR, '.env'))

  const execute =
    process.argv.includes('--execute') && !process.argv.includes('--dry-run')

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL no definida.')
  }

  const prisma = new PrismaClient()
  const preview = await previewOperationalCleanup()

  console.log('--- cleanup-operational-clinical-data ---')
  console.log(`DB host: ${dbHostRedacted()}`)
  console.log(`Modo: ${execute ? 'EXECUTE' : 'DRY-RUN'}`)
  console.log(preview)

  if (!execute) {
    console.log('\nDry-run completo. Ejecuta con --execute para aplicar.')
    await prisma.$disconnect()
    return
  }

  const admin = await prisma.user.findFirst({
    where: { role: 'SUPERADMIN', isActive: true },
    select: { id: true, email: true },
  })
  if (!admin) throw new Error('No hay SUPERADMIN activo.')

  const result = await runOperationalCleanup({
    actorUserId: admin.id,
    reason: 'cleanup-operational-clinical-data.ts',
  })
  if (!result.ok) throw new Error(result.error)
  console.log('Resultado:', result)
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
