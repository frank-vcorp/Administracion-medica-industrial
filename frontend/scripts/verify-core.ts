import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
    console.log('🧪 Starting Core Verification...')

    // 1. Create a Company
    const companyName = `Test Corp ${Date.now()}`
    console.log(`Creating Company: ${companyName}`)
    const company = await prisma.company.create({
        data: {
            name: companyName,
            rfc: 'XAXX010101000'
        }
    })
    console.log('✅ Company Created:', company.id)

    // 2. Create a Worker
    const uid = `U-${Date.now()}`
    console.log(`Creating Worker with UID: ${uid}`)
    const worker = await prisma.worker.create({
        data: {
            firstName: 'Juan',
            lastName: 'Perez',
            universalId: uid,
            companyId: company.id
        }
    })
    console.log('✅ Worker Created:', worker.id)

    // 3. Verify Relation
    const fetchedWorker = await prisma.worker.findUnique({
        where: { id: worker.id },
        include: { company: true }
    })

    if (fetchedWorker?.company?.id === company.id) {
        console.log('✅ Relation Verified: Worker linked to Company')
    } else {
        console.error('❌ Relation Logic Failed')
    }

    // 4. Update Worker (Non-linear edit test)
    console.log('Testing Non-linear Edit (Update Phone)...')
    const updatedWorker = await prisma.worker.update({
        where: { id: worker.id },
        data: { phone: '555-1234' }
    })
    console.log('✅ Worker Updated:', updatedWorker.phone)

    console.log('🎉 Verification Complete!')
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
