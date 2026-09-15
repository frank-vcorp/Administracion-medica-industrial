import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const flow = await prisma.medicalTest.findUnique({ where: { code: 'GEN-EM-FLO' } })
  if (!flow) throw new Error('GEN-EM-FLO not found — run seed-exam-variants.ts')

  const evt = await prisma.medicalEvent.findFirst({
    where: { status: { in: ['IN_PROGRESS', 'CHECKED_IN', 'VALIDATING'] } },
    orderBy: { createdAt: 'desc' },
    include: { eventTests: true },
  })
  if (!evt) throw new Error('No active event found')

  const old = evt.eventTests.find((t) => /examen med/i.test(t.testNameSnapshot))
  if (old) {
    await prisma.eventTest.update({
      where: { id: old.id },
      data: { testId: flow.id, testNameSnapshot: flow.name },
    })
    console.log('Updated event', evt.id, 'test', old.id, '→', flow.name)
  } else {
    await prisma.eventTest.create({
      data: {
        eventId: evt.id,
        testId: flow.id,
        testNameSnapshot: flow.name,
        status: 'PENDING',
      },
    })
    console.log('Created Flowserve eventTest on', evt.id)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
