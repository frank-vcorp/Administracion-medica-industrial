const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('\n=== USUARIOS CREADOS ===');
  const users = await prisma.user.findMany({
    select: {
      email: true,
      fullName: true,
      role: true,
      companyId: true,
      company: { select: { name: true } }
    }
  });
  
  users.forEach(u => {
    console.log(`${u.email} | ${u.fullName} | Rol: ${u.role} | Empresa: ${u.company?.name || 'SISTEMA'}`);
  });

  console.log('\n=== EMPRESAS CREADAS ===');
  const companies = await prisma.company.findMany({
    select: { id: true, name: true, rfc: true },
  });
  
  companies.forEach(c => {
    console.log(`${c.name} | RFC: ${c.rfc} | ID: ${c.id}`);
  });

  console.log('\n=== USUARIOS POR EMPRESA (MULTI-TENANT) ===');
  for (const company of companies) {
    const userCount = await prisma.user.count({
      where: { companyId: company.id }
    });
    console.log(`${company.name}: ${userCount} usuarios CLIENT`);
  }

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
