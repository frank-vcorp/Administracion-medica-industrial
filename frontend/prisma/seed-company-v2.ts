/**
 * @file Seed: Ficha Cliente v2 (ARCH-20260623-03)
 * @id IMPL-20260623-02
 * @backup context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md
 *
 * Seeds:
 *   1. 32 estados de México (catálogo INEGI)
 *   2. 1 vendedor demo: vendedor.demo@ami.local (rol VENDEDOR, isActive=true)
 *
 * NOTA: El catálogo de usoCFDI está modelado como enum Prisma (CfdiUso),
 * por lo que no requiere filas en una tabla adicional. La fuente de los
 * valores es el catálogo SAT c_ClaveUso (publicado por el SAT en su
 * portal de facturación electrónica, vigente desde 2022). Los valores
 * sembrados cubren las claves más comunes para clientes corporativos
 * (adquisiciones G01-G03, servicios B01-B20, por definir P01, sin
 * efectos fiscales S01, pagos CP01, nómina CN01).
 *
 * Uso:
 *   cd frontend && npx ts-node prisma/seed-company-v2.ts
 *
 *   O vía package.json:
 *   cd frontend && npm run seed:company-v2
 */

import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

// Catálogo INEGI de las 32 entidades federativas de México.
// Fuente: INEGI - Marco Geoestadístico Nacional.
const ESTADOS_MEXICO: { id: number; nombre: string }[] = [
  { id: 1, nombre: 'Aguascalientes' },
  { id: 2, nombre: 'Baja California' },
  { id: 3, nombre: 'Baja California Sur' },
  { id: 4, nombre: 'Campeche' },
  { id: 5, nombre: 'Coahuila de Zaragoza' },
  { id: 6, nombre: 'Colima' },
  { id: 7, nombre: 'Chiapas' },
  { id: 8, nombre: 'Chihuahua' },
  { id: 9, nombre: 'Ciudad de México' },
  { id: 10, nombre: 'Durango' },
  { id: 11, nombre: 'Guanajuato' },
  { id: 12, nombre: 'Guerrero' },
  { id: 13, nombre: 'Hidalgo' },
  { id: 14, nombre: 'Jalisco' },
  { id: 15, nombre: 'México' },
  { id: 16, nombre: 'Michoacán de Ocampo' },
  { id: 17, nombre: 'Morelos' },
  { id: 18, nombre: 'Nayarit' },
  { id: 19, nombre: 'Nuevo León' },
  { id: 20, nombre: 'Oaxaca' },
  { id: 21, nombre: 'Puebla' },
  { id: 22, nombre: 'Querétaro' },
  { id: 23, nombre: 'Quintana Roo' },
  { id: 24, nombre: 'San Luis Potosí' },
  { id: 25, nombre: 'Sinaloa' },
  { id: 26, nombre: 'Sonora' },
  { id: 27, nombre: 'Tabasco' },
  { id: 28, nombre: 'Tamaulipas' },
  { id: 29, nombre: 'Tlaxcala' },
  { id: 30, nombre: 'Veracruz de Ignacio de la Llave' },
  { id: 31, nombre: 'Yucatán' },
  { id: 32, nombre: 'Zacatecas' },
]

async function seedEstadosMexico() {
  console.log('🌱 Seed: estados de México (32 entidades)...')
  for (const estado of ESTADOS_MEXICO) {
    await prisma.estadoMexico.upsert({
      where: { id: estado.id },
      update: { nombre: estado.nombre },
      create: { id: estado.id, nombre: estado.nombre, municipios: [] },
    })
  }
  console.log(`  ✓ ${ESTADOS_MEXICO.length} estados cargados`)
}

async function seedVendedorDemo() {
  console.log('🌱 Seed: vendedor demo...')
  const email = 'vendedor.demo@ami.local'
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    if (existing.role !== 'VENDEDOR') {
      await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'VENDEDOR', isActive: true },
      })
      console.log(`  ✓ Usuario existente promovido a VENDEDOR: ${email}`)
    } else {
      console.log(`  ⊘ Vendedor demo ya existe: ${email}`)
    }
    return
  }
  await prisma.user.create({
    data: {
      email,
      hashedPassword: await hash('Vendedor@123', 10),
      fullName: 'Vendedor Demo AMI',
      role: 'VENDEDOR',
      isActive: true,
    },
  })
  console.log(`  ✓ Vendedor demo creado: ${email} / Vendedor@123`)
}

async function main() {
  console.log('🧬 Seed: Ficha Cliente v2 (IMPL-20260623-02)')
  await seedEstadosMexico()
  await seedVendedorDemo()
  console.log('🎉 Seed de Ficha Cliente v2 completado')
}

main()
  .catch((e) => {
    console.error('❌ Error en seed de Ficha Cliente v2:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
