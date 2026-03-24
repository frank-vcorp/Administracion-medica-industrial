/**
 * IMPL-20260324-01
 * Seed local minimo para autenticacion de desarrollo.
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function upsertUser(email, password, fullName, role) {
  const hashedPassword = await bcrypt.hash(password, 10)

  return prisma.user.upsert({
    where: { email },
    update: {
      hashedPassword,
      fullName,
      role,
      isActive: true,
    },
    create: {
      email,
      hashedPassword,
      fullName,
      role,
      isActive: true,
    },
  })
}

async function main() {
  await upsertUser('admin@sistema.com', 'Admin@123', 'Administrador del Sistema', 'ADMIN')
  await upsertUser('recepcion@sistema.com', 'Recep@123', 'Recepcionista Central', 'RECEPTIONIST')
  await upsertUser('doctor@sistema.com', 'Doctor@123', 'Dr. Juan Garcia', 'DOCTOR_GENERAL')
  await upsertUser('validador@sistema.com', 'Valid@123', 'Dr. Carlos Perez (Validador)', 'DOCTOR_VALIDATOR')
  await upsertUser('captura@sistema.com', 'Captura@123', 'Capturista Clinico', 'CAPTURIST')

  console.log('Local auth users seeded')
}

main()
  .catch((error) => {
    console.error('Local auth seed failed', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })