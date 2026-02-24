const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Seeding Relational Data...')

    // 1. Get existing company or create one
    let company = await prisma.company.findFirst({ where: { name: 'Tesla Giga Monterrey' } })
    if (!company) {
        company = await prisma.company.create({ data: { name: 'Tesla Giga Monterrey', rfc: 'TES24' } })
    }

    // 2. Get existing branch
    let branch = await prisma.branch.findFirst()
    if (!branch) {
        const tenant = await prisma.tenant.create({ data: { name: 'Default Tenant' } })
        branch = await prisma.branch.create({ data: { name: 'Sede Central', tenantId: tenant.id } })
    }

    // 3. Create Worker Linked to Company
    const worker = await prisma.worker.create({
        data: {
            firstName: 'Ricardo',
            lastName: 'Montoya',
            universalId: 'R-MONTOYA-001',
            email: 'ricardo@tesla.com',
            companyId: company.id
        }
    })
    console.log('Worker Created:', worker.firstName)

    // 4. Create Event Linked to Worker
    const event = await prisma.medicalEvent.create({
        data: {
            workerId: worker.id,
            branchId: branch.id,
            status: 'SCHEDULED',
            checkInDate: new Date()
        }
    })
    console.log('Event Created for Worker:', worker.firstName)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
