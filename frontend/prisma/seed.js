const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Seeding database...')

    // 1. Tenant
    const tenant = await prisma.tenant.create({
        data: { name: 'AMI Corporativo' }
    })

    // 2. Companies
    await prisma.company.create({
        data: { name: 'Tesla Giga Monterrey', rfc: 'TES240101', contactName: 'Elon M.', email: 'elon@tesla.com', phone: '555-0000' }
    })
    await prisma.company.create({
        data: { name: 'Ternium', rfc: 'TER990101', contactName: 'Ing. Perez', email: 'rh@ternium.com' }
    })

    // 3. Branches
    await prisma.branch.create({
        data: { name: 'Sucursal Apodaca', address: 'Parque Industrial #1', tenantId: tenant.id, phone: '811-222-3333', managerName: 'Dr. House' }
    })

    // 4. Services
    await prisma.service.create({
        data: { name: 'Audiometría Tonal', code: 'AUD-001', category: 'Medical', price: 450.00 }
    })
    await prisma.service.create({
        data: { name: 'Química Sanguínea (6)', code: 'LAB-QS6', category: 'Lab', price: 280.00 }
    })

    console.log('Seeding complete!')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
