/**
 * Seed idempotente: catálogo Examen Médico AMI / Sodexo / Flowserve + perfiles piloto.
 *
 * Uso:
 *   cd frontend && DATABASE_URL=... npx tsx prisma/seed-exam-variants.ts
 */
import { PrismaClient } from '@prisma/client'
import {
  EXAMEN_MEDICO_CATALOG_CODES,
  EXAMEN_MEDICO_CATALOG_NAMES,
} from '../src/lib/clinical/examen-medico-variant'

const prisma = new PrismaClient()

async function upsertTest(code: string, name: string, categoryId: string) {
  return prisma.medicalTest.upsert({
    where: { code },
    create: { code, name, categoryId },
    update: { name, categoryId },
  })
}

async function ensureProfile(name: string, testIds: string[], specialNotes?: string) {
  const existing = await prisma.medicalProfile.findFirst({ where: { name, companyId: null } })
  if (existing) {
    await prisma.profileTest.deleteMany({ where: { profileId: existing.id } })
    await prisma.medicalProfile.update({
      where: { id: existing.id },
      data: {
        specialNotes: specialNotes ?? null,
        tests: { create: testIds.map((testId) => ({ testId })) },
      },
    })
    return existing.id
  }
  const created = await prisma.medicalProfile.create({
    data: {
      name,
      companyId: null,
      specialNotes: specialNotes ?? null,
      tests: { create: testIds.map((testId) => ({ testId })) },
    },
  })
  return created.id
}

async function main() {
  let category = await prisma.testCategory.findFirst({
    where: { name: { in: ['Generales', 'Estudios Generales', 'GENERALES'] } },
  })
  if (!category) {
    category = await prisma.testCategory.create({ data: { name: 'Generales' } })
  }

  const ami = await upsertTest(
    EXAMEN_MEDICO_CATALOG_CODES.AMI,
    EXAMEN_MEDICO_CATALOG_NAMES.AMI,
    category.id,
  )
  const sodexo = await upsertTest(
    EXAMEN_MEDICO_CATALOG_CODES.SODEXO,
    EXAMEN_MEDICO_CATALOG_NAMES.SODEXO,
    category.id,
  )
  const flowserve = await upsertTest(
    EXAMEN_MEDICO_CATALOG_CODES.FLOWSERVE,
    EXAMEN_MEDICO_CATALOG_NAMES.FLOWSERVE,
    category.id,
  )

  const espiro = await prisma.medicalTest.findFirst({
    where: { name: { contains: 'espirom', mode: 'insensitive' } },
  })
  const audio = await prisma.medicalTest.findFirst({
    where: { name: { contains: 'audiomet', mode: 'insensitive' } },
  })

  const commonLabs = [espiro?.id, audio?.id].filter(Boolean) as string[]

  await ensureProfile('Paquete Examen Médico AMI Estándar', [ami.id, ...commonLabs])
  await ensureProfile(
    'Paquete Examen Médico Sodexo',
    [sodexo.id, ...commonLabs],
    'Formato REG-SO-01 Sodexo — seleccionar perfil al agendar cita.',
  )
  await ensureProfile(
    'Paquete Examen Médico Flowserve Ingreso',
    [flowserve.id, ...commonLabs],
    'Formato Flowserve EMI (incluye Cuestionario Nórdico Kuorinka en pestaña Flowserve).',
  )

  console.log('✅ Catálogo y perfiles de variantes examen médico listos')
  console.log(`   - ${ami.name} (${ami.code})`)
  console.log(`   - ${sodexo.name} (${sodexo.code})`)
  console.log(`   - ${flowserve.name} (${flowserve.code}) — incluye Kuorinka integrado`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
