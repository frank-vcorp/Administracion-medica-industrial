/**
 * Script para crear usuarios de prueba con diferentes roles
 * @id IMPL-20260225-01
 * 
 * Uso: npx ts-node prisma/seed-auth.ts
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

export default async function main() {
  console.log('🌱 Creando usuarios de prueba para autenticación...')

  // Obtener o crear empresas de prueba
  const company1 = await prisma.company.findFirst() || await prisma.company.create({
    data: {
      name: 'Empresa Test A',
      rfc: 'EST000000ABC',
      email: 'admin@empresa-a.com',
      address: 'Calle Principal 123',
    }
  })

  const company2Existing = await prisma.company.findMany({
    take: 2,
    skip: 1,
  })
  
  const company2 = company2Existing[0] || await prisma.company.create({
    data: {
      name: 'Empresa Test B',
      rfc: 'TEST000000XYZ',
      email: 'admin@empresa-b.com',
      address: 'Avenida Secundaria 456',
    }
  })

  console.log(`✓ Empresas de prueba creadas/encontradas: ${company1.name}, ${company2.name}`)

  // Crear usuarios con diferentes roles
  const users = [
    // ADMIN
    {
      email: 'admin@sistema.com',
      hashedPassword: await hash('Admin@123', 10),
      fullName: 'Administrador del Sistema',
      role: 'ADMIN' as const,
      isActive: true,
      companyId: null,
    },
    // RECEPTIONIST
    {
      email: 'recepcion@sistema.com',
      hashedPassword: await hash('Recep@123', 10),
      fullName: 'Recepcionista Central',
      role: 'RECEPTIONIST' as const,
      isActive: true,
      companyId: null,
    },
    // DOCTOR_GENERAL
    {
      email: 'doctor@sistema.com',
      hashedPassword: await hash('Doctor@123', 10),
      fullName: 'Dr. Juan García',
      role: 'DOCTOR_GENERAL' as const,
      isActive: true,
      companyId: null,
    },
    // DOCTOR_VALIDATOR
    {
      email: 'validador@sistema.com',
      hashedPassword: await hash('Valid@123', 10),
      fullName: 'Dr. Carlos Pérez (Validador)',
      role: 'DOCTOR_VALIDATOR' as const,
      isActive: true,
      companyId: null,
    },
    // CAPTURIST
    {
      email: 'capturist@sistema.com',
      hashedPassword: await hash('Capt@123', 10),
      fullName: 'Capturista de Datos',
      role: 'CAPTURIST' as const,
      isActive: true,
      companyId: null,
    },
    // CLIENT at Company 1
    {
      email: 'portal@empresa-a.com',
      hashedPassword: await hash('Client@123', 10),
      fullName: 'Roberto López (Portal Empresa A)',
      role: 'COMPANY_CLIENT' as const,
      isActive: true,
      companyId: company1.id,
    },
    // CLIENT at Company 2
    {
      email: 'portal@empresa-b.com',
      hashedPassword: await hash('Client@456', 10),
      fullName: 'María García (Portal Empresa B)',
      role: 'COMPANY_CLIENT' as const,
      isActive: true,
      companyId: company2.id,
    },
  ]

  for (const userData of users) {
    // Evitar duplicados
    const existing = await prisma.user.findUnique({
      where: { email: userData.email }
    })

    if (existing) {
      console.log(`⊘ Usuario ya existe: ${userData.email}`)
      continue
    }

    await prisma.user.create({
      data: userData
    })
    console.log(`✓ Usuario creado: ${userData.email} (${userData.role})`)
  }

  console.log('\n🎉 Usuarios de prueba creados exitosamente!')
  console.log('\nCredenciales de prueba:')
  console.log('─────────────────────────────────────────')
  console.log('ADMIN:           admin@sistema.com / Admin@123')
  console.log('RECEPTIONIST:    recepcion@sistema.com / Recep@123')
  console.log('DOCTOR:          doctor@sistema.com / Doctor@123')
  console.log('VALIDATOR:       validador@sistema.com / Valid@123')
  console.log('CAPTURIST:       capturist@sistema.com / Capt@123')
  console.log('CLIENT (Empresa A): portal@empresa-a.com / Client@123')
  console.log('CLIENT (Empresa B): portal@empresa-b.com / Client@456')
  console.log('─────────────────────────────────────────\n')
}

main()
  .catch(e => {
    console.error('❌ Error al crear usuarios:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
