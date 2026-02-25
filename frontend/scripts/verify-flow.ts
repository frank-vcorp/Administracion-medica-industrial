import { PrismaClient, EventStatus } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
    console.log('🧪 Starting Medical Flow Verification...')

    // 1. Setup Data (Tenant, Branch, User)
    const tenant = await prisma.tenant.create({ data: { name: 'AMI Global' } })
    const branch = await prisma.branch.create({
        data: { name: 'Sucursal Centro', tenantId: tenant.id }
    })
    const doctor = await prisma.user.create({
        data: {
            email: `doc${Date.now()}@ami.com`,
            hashedPassword: await hash('test123', 10),
            fullName: 'Dr. House'
        }
    })

    // Reuse existing worker or create new
    const worker = await prisma.worker.create({
        data: {
            firstName: 'Maria', lastName: 'Lopez', universalId: `U-${Date.now()}`
        }
    })

    // 2. CHECK-IN (Create Event)
    console.log('🏥 Patient Check-in...')
    const event = await prisma.medicalEvent.create({
        data: {
            workerId: worker.id,
            branchId: branch.id,
            status: EventStatus.CHECKED_IN,
            checkInDate: new Date()
        }
    })
    console.log('✅ Event Created:', event.id)

    // 3. ADD STUDY (Non-linear Step)
    console.log('🧪 Adding Audiometry Result...')
    const study = await prisma.studyRecord.create({
        data: {
            eventId: event.id,
            serviceName: 'Audiometría Tonal',
            fileUrl: '/uploads/audio_123.pdf'
        }
    })
    console.log('✅ Study Added:', study.id)

    // 4. VALIDATION (Verdict)
    console.log('👨‍⚕️ Doctor Validation...')
    const verdict = await prisma.medicalVerdict.create({
        data: {
            eventId: event.id,
            finalDiagnosis: 'Hipoacusia leve derecha.',
            validatorId: doctor.id
        }
    })
    console.log('✅ Verdict Signed:', verdict.finalDiagnosis)

    // 5. Verify Full Structure
    const fullEvent = await prisma.medicalEvent.findUnique({
        where: { id: event.id },
        include: { studies: true, verdict: true }
    })

    if (fullEvent?.studies.length === 1 && fullEvent?.verdict) {
        console.log('🎉 Full Cycle Verified!')
    } else {
        console.error('❌ Cycle Failed')
    }
}

main()
    .catch(e => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
