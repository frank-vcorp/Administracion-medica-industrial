const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
  // Crear empresa de prueba
  const company = await prisma.company.create({
    data: {
      name: 'Servicios Robles S.A. de C.V.',
      rfc: 'SRO200101ABC',
      address: 'Av. Constituyentes 123, Querétaro, Qro.',
      phone: '442-123-4567',
      email: 'contacto@serviciosrobles.com',
      estado: 'HABILITADO',
    }
  });
  console.log('✓ Company creada:', company.name);

  // Crear 5 workers de prueba
  const workers = [
    { name: 'Juan', lastName: 'Pérez García', dob: '1990-05-15' },
    { name: 'María', lastName: 'López Hernández', dob: '1985-08-22' },
    { name: 'Carlos', lastName: 'Martínez Ruiz', dob: '1992-11-10' },
    { name: 'Ana', lastName: 'García Torres', dob: '1988-03-30' },
    { name: 'Luis', lastName: 'Rodríguez Sánchez', dob: '1995-07-18' },
  ];

  for (const w of workers) {
    await prisma.worker.create({
      data: {
        company: { connect: { id: company.id } },
        firstName: w.name,
        lastName: w.lastName,
        dob: new Date(w.dob),
        universalId: `UNI-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        nationalId: `CURP-${w.lastName.substr(0, 4).toUpperCase()}900101`,
        email: `${w.name.toLowerCase()}.${w.lastName.toLowerCase()}@serviciosrobles.com`.replace(/ /g, ''),
        phone: `442-${Math.floor(Math.random() * 9000000) + 1000000}`,
      }
    });
  }
  console.log('✓ 5 Workers creados');

  // Crear proyecto de visita médica
  const project = await prisma.project.create({
    data: {
      name: 'Visita Médica Anual 2026',
      company: { connect: { id: company.id } },
      startDate: new Date('2026-07-15'),
      endDate: new Date('2026-07-20'),
      status: 'CONFIRMED',
      notes: 'Examen médico anual para todos los trabajadores',
    }
  });
  console.log('✓ Proyecto creado:', project.name);

  // Asociar workers al proyecto
  const allWorkers = await prisma.worker.findMany({ where: { company: { id: { equals: company.id } } } });
  for (const worker of allWorkers) {
    await prisma.projectWorker.create({
      data: {
        projectId: project.id,
        workerId: worker.id,
        receptionStatus: 'PENDING',
      }
    });
  }
  console.log(`✓ ${allWorkers.length} Workers asociados al proyecto`);

  console.log('\n=== Datos de prueba creados exitosamente ===');
  console.log('Empresa:', company.name);
  console.log('Workers:', allWorkers.length);
  console.log('Proyecto:', project.name);
  
  await prisma.$disconnect();
}

seed().catch(console.error);
