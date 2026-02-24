const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Updating Francisco Saavedra Phone...')

    const worker = await prisma.worker.update({
        where: { universalId: 'FS-001-CEO' },
        data: { phone: '524421717886' }
    })

    console.log('✅ Updated:', worker.firstName, worker.phone)
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
