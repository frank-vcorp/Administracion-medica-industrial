/**
 * @file Seed maestro: tests + labs + auth + catálogos base.
 * @id FIX-20260708-02 — DB limpia, oportunidad de flujo completo desde cero.
 *
 * Ejecutar: DATABASE_URL=... npx tsx frontend/prisma/seed-master.ts
 *
 * Orden de inserción (respetando FKs):
 *  1. estados_mexico (catálogo base)
 *  2. test_categories (6 categorías)
 *  3. medical_tests (15-20 estudios típicos AMI)
 *  4. lab_departments (3 deptos: HEM, QUI, MIC)
 *  5. lab_process_areas (5 áreas con FK a deptos)
 *  6. lab_units (10 unidades)
 *  7. lab_samples (5 tipos de muestra)
 *  8. lab_containers (5 recipientes)
 *  9. lab_methods (5 métodos analíticos)
 * 10. lab_classifications (5 clasificaciones)
 * 11. lab_indications (5 indicaciones)
 * 12. tenant (1 matriz)
 * 13. branch (1 matriz)
 * 14. users (7 usuarios de prueba con diferentes roles)
 *
 * Idempotente: usa upsert en todo lo que tiene unique constraints.
 */
import { PrismaClient, LabUnitSystem, UserRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

// NOTA: estados_mexico se aplica con `npx prisma db execute --file context/infra/06-seed-estados-mexico.sql`
// porque $executeRawUnsafe no soporta múltiples statements.

// ─────────────────────────────────────────────────────────────────
// 2. TEST CATEGORIES (6 categorías canónicas AMI)
// ─────────────────────────────────────────────────────────────────
async function seedTestCategories(): Promise<number> {
  const categories = [
    { name: "Estudios Generales", description: "Examen médico general, signos vitales, somatometría" },
    { name: "Estudios de Gabinete", description: "Rayos X, electrocardiograma, espirometría, audiometría" },
    { name: "Laboratorio", description: "Biometría hemática, química sanguínea, perfiles, uroanálisis" },
    { name: "Toxicología", description: "Drogas de abuso, alcohol, metales pesados" },
    { name: "Cardiología", description: "ECG, prueba de esfuerzo, Holter" },
    { name: "Oftalmología", description: "Agudeza visual, campimetría, fondo de ojo" },
  ];
  for (const c of categories) {
    await prisma.testCategory.upsert({
      where: { id: `cat-${slug(c.name)}` }, // upsert con id determinístico
      create: { id: `cat-${slug(c.name)}`, ...c },
      update: { name: c.name, description: c.description },
    }).catch(async () => {
      // Si el id ya existe con datos distintos, intentar update por nombre
      const existing = await prisma.testCategory.findFirst({ where: { name: c.name } });
      if (!existing) {
        await prisma.testCategory.create({ data: c });
      }
    });
  }
  const count = await prisma.testCategory.count();
  console.log(`  ✓ test_categories: ${count} registros`);
  return count;
}

// ─────────────────────────────────────────────────────────────────
// 3. MEDICAL TESTS (estudios típicos AMI, 17 registros)
// ─────────────────────────────────────────────────────────────────
async function seedMedicalTests(): Promise<number> {
  const tests = [
    // Generales
    { code: "MED-01", name: "Examen Médico General", categoryName: "Estudios Generales" },
    { code: "GEN-01", name: "Somatometría (Peso, Talla, Signos Vitales)", categoryName: "Estudios Generales" },
    // Gabinete
    { code: "AUDIO-01", name: "Audiometría Tonal", categoryName: "Estudios de Gabinete" },
    { code: "ESPIRO-01", name: "Espirometría", categoryName: "Estudios de Gabinete" },
    { code: "RX-TX-01", name: "Radiografía de Tórax", categoryName: "Estudios de Gabinete" },
    { code: "RX-COL-01", name: "Radiografía de Columna Lumbosacra", categoryName: "Estudios de Gabinete" },
    // Laboratorio
    { code: "LAB-BH", name: "Biometría Hemática Completa", categoryName: "Laboratorio" },
    { code: "LAB-QS", name: "Química Sanguínea (QS6)", categoryName: "Laboratorio" },
    { code: "LAB-PL", name: "Perfil Lipídico", categoryName: "Laboratorio" },
    { code: "LAB-EGO", name: "Examen General de Orina (EGO)", categoryName: "Laboratorio" },
    { code: "LAB-TP", name: "Tiempo de Protrombina (TP)", categoryName: "Laboratorio" },
    { code: "LAB-TPT", name: "Tiempos de Protrombina y Tromboplastina", categoryName: "Laboratorio" },
    // Toxicología
    { code: "TOX-DROGAS-5", name: "Drogas de Abuso (Panel 5)", categoryName: "Toxicología" },
    { code: "TOX-ALCOHOL", name: "Alcohol en Sangre", categoryName: "Toxicología" },
    // Cardiología
    { code: "CARD-ECG", name: "Electrocardiograma (ECG)", categoryName: "Cardiología" },
    // Oftalmología
    { code: "OFT-AV", name: "Agudeza Visual", categoryName: "Oftalmología" },
    { code: "OFT-CAMP", name: "Campimetría", categoryName: "Oftalmología" },
  ];

  for (const t of tests) {
    const category = await prisma.testCategory.findFirst({
      where: { name: t.categoryName },
    });
    if (!category) {
      console.warn(`  ⚠ Categoría no encontrada: ${t.categoryName}, saltando ${t.code}`);
      continue;
    }
    await prisma.medicalTest.upsert({
      where: { code: t.code },
      create: {
        code: t.code,
        name: t.name,
        categoryId: category.id,
      },
      update: {
        name: t.name,
        categoryId: category.id,
      },
    });
  }
  const count = await prisma.medicalTest.count();
  console.log(`  ✓ medical_tests: ${count} registros`);
  return count;
}

// ─────────────────────────────────────────────────────────────────
// 4-8. LAB CATALOGS (43 items, mismos del Slice A NOVA)
// ─────────────────────────────────────────────────────────────────
async function seedLabCatalogs(): Promise<void> {
  // Departments
  const depts = [
    { code: "HEM", name: "Hematología" },
    { code: "QUI", name: "Química Clínica" },
    { code: "MIC", name: "Microbiología" },
  ];
  for (const d of depts) {
    await prisma.labDepartment.upsert({
      where: { code: d.code },
      create: d,
      update: { name: d.name },
    });
  }
  console.log(`  ✓ lab_departments: ${depts.length}`);

  // Process Areas (con FK a deptos)
  const areas = [
    { code: "HEMATO", name: "Hematología", deptCode: "HEM" },
    { code: "QUIMICA", name: "Química Clínica", deptCode: "QUI" },
    { code: "MICRO", name: "Microbiología", deptCode: "MIC" },
    { code: "INMUNO", name: "Inmunología", deptCode: null },
    { code: "URO", name: "Uroanálisis", deptCode: "HEM" },
  ];
  for (const a of areas) {
    const dept = a.deptCode
      ? await prisma.labDepartment.findUnique({ where: { code: a.deptCode } })
      : null;
    await prisma.labProcessArea.upsert({
      where: { code: a.code },
      create: { code: a.code, name: a.name, departmentId: dept?.id ?? null },
      update: { name: a.name, departmentId: dept?.id ?? null },
    });
  }
  console.log(`  ✓ lab_process_areas: ${areas.length}`);

  // Units
  const units: Array<{ symbol: string; name: string; system: LabUnitSystem }> = [
    { symbol: "mg/dL", name: "Miligramos por decilitro", system: LabUnitSystem.CONVENTIONAL },
    { symbol: "g/dL", name: "Gramos por decilitro", system: LabUnitSystem.CONVENTIONAL },
    { symbol: "mmol/L", name: "Milimoles por litro", system: LabUnitSystem.SI },
    { symbol: "%", name: "Porcentaje", system: LabUnitSystem.CONVENTIONAL },
    { symbol: "U/L", name: "Unidades por litro", system: LabUnitSystem.SI },
    { symbol: "U/mL", name: "Unidades por mililitro", system: LabUnitSystem.SI },
    { symbol: "ng/dL", name: "Nanogramos por decilitro", system: LabUnitSystem.CONVENTIONAL },
    { symbol: "pg/mL", name: "Picogramos por mililitro", system: LabUnitSystem.CONVENTIONAL },
    { symbol: "cel/uL", name: "Células por microlitro", system: LabUnitSystem.SI },
    { symbol: "mEq/L", name: "Miliequivalentes por litro", system: LabUnitSystem.SI },
  ];
  for (const u of units) {
    await prisma.labUnit.upsert({
      where: { symbol: u.symbol },
      create: u,
      update: { name: u.name, system: u.system },
    });
  }
  console.log(`  ✓ lab_units: ${units.length}`);

  // Samples
  const samples = [
    { code: "SANGRE", name: "Sangre", preservation: "Refrigerada 4°C", minVolume: "5 mL" },
    { code: "ORINA", name: "Orina", preservation: "Refrigerada 4°C", minVolume: "10 mL" },
    { code: "HECES", name: "Heces", preservation: "Refrigerada 4°C", minVolume: "5 g" },
    { code: "ESPUTO", name: "Esputo", preservation: "Refrigerada 4°C", minVolume: "5 mL" },
    { code: "EXUDADO", name: "Exudado", preservation: "Ambiente", minVolume: "2 mL" },
  ];
  for (const s of samples) {
    await prisma.labSample.upsert({
      where: { code: s.code },
      create: s,
      update: { name: s.name, preservation: s.preservation, minVolume: s.minVolume },
    });
  }
  console.log(`  ✓ lab_samples: ${samples.length}`);

  // Containers
  const containers = [
    { code: "Tubo Lila", name: "Tubo tapa lila (EDTA)", color: "#9b59b6", cap: "Tapa lila" },
    { code: "Tubo Rojo", name: "Tubo tapa roja (sin aditivo)", color: "#e74c3c", cap: "Tapa roja" },
    { code: "Frasco Estéril", name: "Frasco estéril para urocultivo", color: "#ffffff", cap: "Tapa rosca" },
    { code: "Contenedor Copro", name: "Contenedor para coproparasitoscopio", color: "#f1c40f", cap: "Tapa rosca" },
    { code: "Hisopo", name: "Hisopo estéril", color: "#ecf0f1", cap: "Tubo con medio" },
  ];
  for (const c of containers) {
    await prisma.labContainer.upsert({
      where: { code: c.code },
      create: c,
      update: { name: c.name, color: c.color, cap: c.cap },
    });
  }
  console.log(`  ✓ lab_containers: ${containers.length}`);

  // Methods
  const methods = [
    { code: "QUIMICA_SECA", name: "Química seca", principle: "Reacción colorimétrica en capa seca" },
    { code: "ELISA", name: "ELISA", principle: "Inmunoensayo enzimático" },
    { code: "HEMATIMETRIA", name: "Hematimetría", principle: "Impedancia eléctrica + dispersión láser" },
    { code: "MICROSCOPIA", name: "Microscopía", principle: "Observación directa al microscopio" },
    { code: "INMUNOCROM", name: "Inmunocromatografía", principle: "Flujo lateral con anticuerpos marcados" },
  ];
  for (const m of methods) {
    await prisma.labMethod.upsert({
      where: { code: m.code },
      create: m,
      update: { name: m.name, principle: m.principle },
    });
  }
  console.log(`  ✓ lab_methods: ${methods.length}`);

  // Classifications
  const classifications = [
    { code: "NORMAL", name: "Normal", color: "#27ae60", sortOrder: 1 },
    { code: "PATRON_A", name: "Patrón A", color: "#f39c12", sortOrder: 2 },
    { code: "PATRON_B", name: "Patrón B", color: "#e67e22", sortOrder: 3 },
    { code: "CRITICO", name: "Crítico", color: "#c0392b", sortOrder: 4 },
    { code: "INDETERMINADO", name: "Indeterminado", color: "#7f8c8d", sortOrder: 5 },
  ];
  for (const c of classifications) {
    await prisma.labClassification.upsert({
      where: { code: c.code },
      create: c,
      update: { name: c.name, color: c.color, sortOrder: c.sortOrder },
    });
  }
  console.log(`  ✓ lab_classifications: ${classifications.length}`);

  // Indications
  const indications = [
    { code: "AYUNO_8H", text: "Ayuno de 8 horas" },
    { code: "AYUNO_12H", text: "Ayuno de 12 horas" },
    { code: "PRIMERA_ORINA", text: "Primera orina de la mañana" },
    { code: "SIN_PREP", text: "Sin preparación especial" },
    { code: "ORINA_24H", text: "Recolección de orina de 24 horas" },
  ];
  for (const i of indications) {
    await prisma.labIndication.upsert({
      where: { code: i.code },
      create: i,
      update: { text: i.text },
    });
  }
  console.log(`  ✓ lab_indications: ${indications.length}`);
}

// ─────────────────────────────────────────────────────────────────
// 12. TENANT
// ─────────────────────────────────────────────────────────────────
async function seedTenant(): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: "tenant-ami-default" },
    create: { id: "tenant-ami-default", name: "AMI Default", config: {} },
    update: { name: "AMI Default" },
  });
  console.log(`  ✓ tenants: 1 (AMI Default)`);
}

// ─────────────────────────────────────────────────────────────────
// 13. BRANCH (Matriz)
// ─────────────────────────────────────────────────────────────────
async function seedBranch(): Promise<void> {
  const branch = await prisma.branch.upsert({
    where: { id: "branch-matriz" },
    create: {
      id: "branch-matriz",
      name: "Matriz Querétaro",
      address: "Av. 5 de Febrero 1234, Querétaro, QRO",
      phone: "4421234567",
      tenantId: "tenant-ami-default",
    },
    update: { name: "Matriz Querétaro", address: "Av. 5 de Febrero 1234, Querétaro, QRO" },
  });
  console.log(`  ✓ branches: 1 (${branch.name})`);
}

// ─────────────────────────────────────────────────────────────────
// 14. USERS (7 usuarios con diferentes roles)
// ─────────────────────────────────────────────────────────────────
async function seedUsers(): Promise<void> {
  const users = [
    {
      email: "admin@ami.com",
      hashedPassword: await hash("Admin@123", 10),
      fullName: "Administrador del Sistema",
      role: UserRole.ADMIN,
      isActive: true,
    },
    {
      email: "recepcion@ami.com",
      hashedPassword: await hash("Recep@123", 10),
      fullName: "Recepcionista Matriz",
      role: UserRole.RECEPTIONIST,
      isActive: true,
    },
    {
      email: "doctor@ami.com",
      hashedPassword: await hash("Doctor@123", 10),
      fullName: "Dr. Juan García (Médico General)",
      role: UserRole.DOCTOR_GENERAL,
      isActive: true,
    },
    {
      email: "validador@ami.com",
      hashedPassword: await hash("Valid@123", 10),
      fullName: "Dr. Carlos Pérez (Validador)",
      role: UserRole.DOCTOR_VALIDATOR,
      isActive: true,
    },
    {
      email: "capturista@ami.com",
      hashedPassword: await hash("Capt@123", 10),
      fullName: "Capturista de Datos",
      role: UserRole.CAPTURIST,
      isActive: true,
    },
    {
      email: "vendedor@ami.com",
      hashedPassword: await hash("Vendor@123", 10),
      fullName: "Vendedor Comercial",
      role: UserRole.VENDEDOR,
      isActive: true,
    },
  ];

  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: u,
      update: {
        fullName: u.fullName,
        role: u.role,
        isActive: u.isActive,
      },
    });
  }
  console.log(`  ✓ users: ${users.length} creados/actualizados`);
  console.log(`\n  🔑 Credenciales de acceso:`);
  console.log(`     ADMIN:          admin@ami.com / Admin@123`);
  console.log(`     RECEPCIONISTA:  recepcion@ami.com / Recep@123`);
  console.log(`     DOCTOR:         doctor@ami.com / Doctor@123`);
  console.log(`     VALIDADOR:      validador@ami.com / Valid@123`);
  console.log(`     CAPTURISTA:     capturista@ami.com / Capt@123`);
  console.log(`     VENDEDOR:       vendedor@ami.com / Vendor@123`);
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function slug(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== INICIO: Seed maestro AMI (FIX-20260708-02) ===\n");
  const t0 = Date.now();

  console.log("[1/4] Catálogos base:");
  const estadosCount = await prisma.estadoMexico.count();
  console.log(`  ✓ estados_mexico: ${estadosCount} registros (aplicado previamente con prisma db execute)`);

  console.log("\n[2/4] Tests médicos:");
  await seedTestCategories();
  await seedMedicalTests();

  console.log("\n[3/4] Catálogos LIS:");
  await seedLabCatalogs();

  console.log("\n[4/4] Infraestructura y usuarios:");
  await seedTenant();
  await seedBranch();
  await seedUsers();

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n=== FIN: Seed maestro completado en ${elapsed}s ===`);
}

main()
  .catch((e) => {
    console.error("❌ ERROR FATAL:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });