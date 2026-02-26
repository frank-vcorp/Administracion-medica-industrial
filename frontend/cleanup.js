const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Count events
  const events = await prisma.medicalEvent.findMany({
    include: { worker: true, studies: true, labs: true },
    orderBy: { createdAt: 'desc' }
  })
  console.log(`Total eventos: ${events.length}`)
  events.forEach(e => console.log(`  ${e.id.slice(0,8)} - ${e.worker?.firstName} ${e.worker?.lastName} - ${e.status} - studies:${e.studies.length} labs:${e.labs.length}`))

  // Keep only the most recent event, delete the rest
  if (events.length > 1) {
    const keep = events[0]
    const deleteIds = events.slice(1).map(e => e.id)
    
    // Delete related records first
    await prisma.studyRecord.deleteMany({ where: { eventId: { in: deleteIds } } })
    await prisma.labRecord.deleteMany({ where: { eventId: { in: deleteIds } } })
    await prisma.medicalVerdict.deleteMany({ where: { eventId: { in: deleteIds } } })
    await prisma.medicalEvent.deleteMany({ where: { id: { in: deleteIds } } })
    
    console.log(`\n✅ Eliminados ${deleteIds.length} eventos duplicados. Conservado: ${keep.id.slice(0,8)}`)
  }
  
  // Verify final state
  const remaining = await prisma.medicalEvent.findMany({ include: { worker: true } })
  console.log(`\nEventos restantes: ${remaining.length}`)
  remaining.forEach(e => console.log(`  ${e.id} - ${e.worker?.firstName} ${e.worker?.lastName} - ${e.status}`))
}

main().then(() => prisma.$disconnect()).catch(e => { console.error(e); prisma.$disconnect() })
