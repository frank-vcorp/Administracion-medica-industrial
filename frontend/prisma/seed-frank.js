const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
    console.log('Iniciando Demo: Francisco Saavedra...')

    // 0. Clean slate (optional, or just add to existing) - We'll add new unique data

    // 1. Alta de Empresa
    const company = await prisma.company.create({
        data: {
            name: 'Corporativo Saavedra S.A. de C.V.',
            rfc: 'SAA260101',
            contactName: 'Lic. Francisco Saavedra',
            email: 'admin@saavedra.com'
        }
    })
    console.log('✅ Empresa Creada:', company.name)

    // 2. Alta de Sucursal (Ensure one exists)
    let branch = await prisma.branch.findFirst({ where: { name: 'Matriz Demo' } })
    if (!branch) {
        const tenant = await prisma.tenant.findFirst() || await prisma.tenant.create({ data: { name: 'AMI Default' } })
        branch = await prisma.branch.create({
            data: { name: 'Matriz Demo', address: 'Av. Vallarta 500', tenantId: tenant.id }
        })
    }

    // 3. Alta de Trabajador (Francisco Saavedra)
    const worker = await prisma.worker.create({
        data: {
            firstName: 'Francisco',
            lastName: 'Saavedra',
            universalId: 'FS-001-CEO', // Unique ID
            email: 'frank@saavedra.com',
            phone: '524421717886', // Direct WhatsApp
            companyId: company.id
        }
    })
    console.log('✅ Trabajador Registrado:', worker.firstName, worker.lastName)

    // 4. Agendar Cita (Check-in inmediato)
    const event = await prisma.medicalEvent.create({
        data: {
            workerId: worker.id,
            branchId: branch.id,
            status: 'IN_PROGRESS', // Ya pasó recepción, está en estudios
            checkInDate: new Date()
        }
    })
    console.log('✅ Cita Generada. Folio:', event.id)

    // 5. Simular Estudios (Para que tenga algo que validar)
    await prisma.studyRecord.create({
        data: {
            eventId: event.id,
            serviceName: 'Audiometría Tonal',
            isCompleted: true,
            aiPrediction: 'Normal'
        }
    })

    console.log('🚀 Demo Lista para Visualización')
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect())
