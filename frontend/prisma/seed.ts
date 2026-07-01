/**
 * @file Seed idempotente para los 8 catálogos LIS (Slice A).
 * @id IMPL-20260630-06 — Slice A NOVA absorción (ARCH-20260630-02).
 * @backup context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
 *
 * Ejecutar con: `npx prisma db seed` (configurado en package.json).
 * Inserta/actualiza 43 ítems demo en 8 entidades (LabUnit, LabSample,
 * LabContainer, LabMethod, LabDepartment, LabProcessArea, LabClassification,
 * LabIndication). Seguro de correr múltiples veces.
 *
 * NOTA: este archivo usa el cliente Prisma del frontend para sembrar
 * las tablas LIS (lab_units, lab_samples, etc.) del schema compartido.
 */
import { PrismaClient, LabUnitSystem } from "@prisma/client";

const prisma = new PrismaClient();

async function seedLabCatalogs(): Promise<void> {
  // -------------------------------------------------------------------------
  // 10 Unidades
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 5 Muestras
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 5 Recipientes
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 5 Métodos
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 3 Departamentos (primero, porque LabProcessArea los referencia)
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 5 Lugares de proceso
  // -------------------------------------------------------------------------
  const areas: Array<{ code: string; name: string; deptCode: string | null }> = [
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

  // -------------------------------------------------------------------------
  // 5 Clasificaciones
  // -------------------------------------------------------------------------
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

  // -------------------------------------------------------------------------
  // 5 Indicaciones
  // -------------------------------------------------------------------------
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

  console.log(
    "✅ seedLabCatalogs: 10 unidades + 5 muestras + 5 recipientes + 5 métodos + 5 áreas + 5 clasificaciones + 5 indicaciones + 3 departamentos = 43 items insertados/actualizados"
  );
}

seedLabCatalogs()
  .then(async () => {
    await prisma.$disconnect();
    console.log("✅ Seed OK");
  })
  .catch(async (e) => {
    console.error("❌ Seed error:", e);
    await prisma.$disconnect();
    process.exit(1);
  });