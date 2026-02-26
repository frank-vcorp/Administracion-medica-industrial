const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Check existing
  const branchCount = await prisma.branch.count()
  console.log(`Branches existentes: ${branchCount}`)
  
  if (branchCount === 0) {
    // Crear o encontrar tenant
    let tenant = await prisma.tenant.findFirst()
    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: { name: 'AMI - Administracion Medica Industrial' }
      })
      console.log(`✅ Tenant creado: ${tenant.id}`)
    } else {
      console.log(`  Tenant existente: ${tenant.id} - ${tenant.name}`)
    }

    const branch = await prisma.branch.create({
      data: {
        name: 'Sucursal Central AMI',
        address: 'Av. Industrial #100, Monterrey, NL',
        phone: '8181234567',
        tenantId: tenant.id,
      }
    })
    console.log(`✅ Branch creada: ${branch.id} - ${branch.name}`)
  }

  // Verify workers
  const workers = await prisma.worker.findMany({
    select: { id: true, firstName: true, lastName: true, universalId: true },
    orderBy: { createdAt: 'desc' }
  })
  console.log(`\nTrabajadores (${workers.length}):`)
  workers.forEach(w => console.log(`  ${w.universalId} - ${w.firstName} ${w.lastName}`))
  
  // Verify branches final
  const branches = await prisma.branch.findMany()
  console.log(`\nBranches (${branches.length}):`)
  branches.forEach(b => console.log(`  ${b.id} - ${b.name}`))
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect() })
