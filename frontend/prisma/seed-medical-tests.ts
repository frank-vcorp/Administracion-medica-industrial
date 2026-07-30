/**
 * @file Seed de catálogo completo de pruebas médicas desde Excel
 * @description Limpia y recrea test_categories y medical_tests con los datos del archivo
 *              "Nombres de pruebas en perfiles.xlsx"
 * @id IMPL-20260715-01
 * 
 * Ejecutar con: npx tsx prisma/seed-medical-tests.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// DATOS DEL EXCEL
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { code: "LABORATORIO", name: "Laboratorio", description: "Pruebas de laboratorio clínico" },
  { code: "GENERALES", name: "Generales", description: "Servicios médicos generales" },
  { code: "IMAGEN", name: "Imagen", description: "Estudios de imagen y radiología" },
  { code: "AMBULANCIA", name: "Ambulancia", description: "Servicios de ambulancia y urgencia" },
];

const LAB_TESTS = [
  "25- OH HIDRO VITAMINA D",
  "ÁCIDO HIPURICO EN ORINA",
  "ÁCIDO METIL HIPÚRICO",
  "ÁCIDO ÚRICO",
  "ALBUMINA",
  "ALCOHOL EN SANGRE",
  "ALUMINIO EN SANGRE",
  "ANALISIS BACTERIOLOGICO INERTES",
  "ANALISIS BACTERIOLOGICO AGUA",
  "ANALISIS BACTERIOLOGICO ALIMENTOS",
  "ANTICUERPOS DE HEPATITIS A",
  "ANTICUERPOS DE HEPATITIS B",
  "ANTICUERPOS DE HEPATITIS C",
  "ANTIGENO DE SUPERFICIE HEPATITIS B",
  "ANTIGENO PROSTATICO ESPECIAL TOTAL",
  "ANTIGENO PROSTATICO LIBRE",
  "BENCENO EN ORINA",
  "BIOMETRIA HEMATICA COMPLETA",
  "COLINESTERASA",
  "COPROCULTIVO",
  "COPROLOGICO",
  "COPROPARASITOSCOPICO 1",
  "COPROPARASITOSCOPICO 2",
  "COPROPARASITOSCOPICO 3",
  "CORTISOL",
  "CREATININA",
  "CROMO EN ORINA",
  "CROMO EN SANGRE",
  "EXAMEN GENERAL DE ORINA",
  "ELECTROLITOS SERICOS 3",
  "ELECTROLITOS SÉRICOS 6",
  "EXUDADO FARINGEO",
  "FACTOR REUMATOIDE",
  "MICROBIOLOGICO DE MANOS Y UÑAS",
  "GLUCOSA SERICA",
  "GLUCOSA CAPILAR",
  "GRUPO SANGUINEO Y FACTOR RH",
  "HEMOGLOBINA GLICOSILADA",
  "HIERRO EN SANGRE",
  "INSULINA",
  "HIDROXIDO DE POTASIO (KOH)",
  "METABOLITOS EN SANGRE DE ANFETAMINA",
  "METABOLITOS EN SANGRE DE COCAINA",
  "METABOLITOS EN SANGRE DE THC",
  "METILFENIDATO",
  "NIQUEL EN SANGRE",
  "NIVELES SERICOS DE ACIDO VALPROICO",
  "PERFIL DE HIERRO",
  "PERFIL HEPATICO 1",
  "PERFIL GINECOLOGICO IV",
  "PERFIL HORMONAL",
  "PERFIL LIPIDICO",
  "PERFIL PROSTATICO",
  "PERFIL TRIGLICERIDOS GLUCOSA COLESTEROL",
  "PERFIL TIROIDEO",
  "PERFIL HEPATICO",
  "PERFIL CARDIACO",
  "PRUEBA ESPECIAL",
  "PIE ORINA",
  "PIE SANGRE",
  "PLOMO EN SANGRE",
  "PRUEBA DE ANTICUERPOS IGM E IGG COVID",
  "PRUEBA DE ANTIGENO COVID",
  "PRUEBA INFLUENZA Y COVID",
  "PRUEBA RAPIDA DE INFLUENZA A Y B",
  "QUÍMICA SANGUÍNEA DE 3",
  "QUÍMICA SANGUÍNEA DE 4",
  "QUÍMICA SANGUÍNEA DE 5",
  "QUÍMICA SANGUÍNEA DE 6",
  "QUÍMICA SANGUÍNEA DE 7",
  "QUÍMICA SANGUÍNEA DE 8",
  "QUÍMICA SANGUÍNEA DE 10",
  "QUÍMICA SANGUÍNEA DE 12",
  "QUÍMICA SANGUÍNEA DE 16",
  "QUÍMICA SANGUÍNEA DE 18",
  "QUÍMICA SANGUÍNEA DE 24",
  "QUÍMICA SANGUÍNEA DE 27",
  "QUÍMICA SANGUÍNEA DE 30",
  "QUÍMICA SANGUÍNEA DE 36",
  "QUÍMICA SANGUÍNEA DE 38",
  "QUÍMICA SANGUÍNEA DE 45",
  "REACCIONES FEBRILES",
  "SANGRE OCULTA EN HECES",
  "SELENIO EN SUERO",
  "SOMATOMEDINA C",
  "TGO",
  "TGP",
  "TIEMPOS DE COAGULACION",
  "TIEMPO DE PROTOMBINA (TP)",
  "TIEMPO DE TROMBOPLASTINA (TPT)",
  "TOLUENO EN ORINA",
  "TOXICOLOGICO 3",
  "TOXICOLOGICOS 5",
  "TOXICOLOGICO 6",
  "TRIGLICERIDOS",
  "TSH(HORMONA ESTIMULANTE DE TIROIDES)",
  "UREA",
  "UROCULTIVO CON ANTIBIOGRAMA",
  "VDRL",
  "VSG",
  "XILENO EN ORINA",
  "ZINC EN SANGRE",
];

const GENERAL_TESTS = [
  "AGUDEZA VISUAL",
  "APLICACIÓN DE INYECCIÓN",
  "AUDIOMETRIA",
  "CAMPIMETRIA",
  "CERTIFICADO MEDICO",
  "CONSULTA DE NUTRICIÓN",
  "CONSULTA DE PSICOLOGIA",
  "CONSULTA FISIOTERAPIA",
  "CONSULTA MÉDICA",
  "CURACIÓN MÉDICA",
  "CUESTIONARIO NORDICO",
  "ELECTROCARDIOGRAMA",
  "ESPIROMETRIA",
  "ESPIROMETRIA CON BRONCODILATADOR",
  "EXAMEN MEDICO",
  "EXAMEN MUSCULOESQUELÉTICO",
  "INSUMO MÉDICO",
  "LAVADO OCULAR",
  "LAVADO OTICO",
  "REVALORACION",
  "SCORE CARDIOVASCULAR",
  "SUTURA POR PUNTO",
  "VACUNA DE HEPATITIS",
  "VACUNA INFLUENZA A Y B",
  "VACUNA TETANOS",
  "VALORACION ANTROPOMETRICA",
  "VALORACION POSTURAL",
  "CANALIZACION CON CATETER VENOSO",
];

const IMAGEN_TESTS = [
  "MASTOGRAFIA",
  "RX DE COLUMNA LUMBOSACRA AP Y LATERAL",
  "USG MAMARIO",
  "RX ABDOMEN",
  "RX DE HOMBRO AP Y LAT",
  "RX DE CODO AP Y LAT",
  "RX DE BRAZO AP Y LAT",
  "RX DE ANTEBRAZO AP Y LAT",
  "RX DE MUÑECA AP",
  "RX DE MANO AP Y OBLICUA",
  "RX DE DEDO AP, LAT Y OBLICUA",
  "TELE DE TORAX",
  "RX DE TORAX AP Y LAT",
  "RX DE COLUMNA CERVICAL AP Y LAT",
  "RX DE RODILLA AP Y LAT",
  "RX DE TOBILLO AP Y LAT",
  "RX DE PIE AP, LAT Y OBLICUA",
  "RX PROYECCION DE URGENCIA",
  "RX DE CARA AP Y LAT",
];

const AMBULANCIA_TESTS = [
  "AMBULANCIA TRASLADO A CLÍNICA AMI",
  "AMBULANCIA TRASLADO EXTERNO",
  "ATENCION MEDICA",
  "URGENCIA MEDICA",
];

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIONES AUXILIARES
// ─────────────────────────────────────────────────────────────────────────────

function generateCode(categoryPrefix: string, index: number): string {
  return `${categoryPrefix}-${String(index).padStart(3, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SEED PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

async function seedMedicalTests(): Promise<void> {
  console.log("🧹 Limpiando datos existentes...");

  // Limpiar en orden para evitar errores de foreign keys
  await prisma.labResult.deleteMany();
  await prisma.labAnalyte.deleteMany();
  await prisma.labOrderItem.deleteMany();
  await prisma.profileTest.deleteMany();
  await prisma.eventTest.deleteMany();
  await prisma.medicalTest.deleteMany();
  await prisma.testCategory.deleteMany();

  console.log("✅ Datos existentes eliminados");

  console.log("📝 Creando categorías...");
  const categoryMap = new Map<string, string>();

  for (const cat of CATEGORIES) {
    const created = await prisma.testCategory.create({
      data: {
        name: cat.name,
        description: cat.description,
      },
    });
    categoryMap.set(cat.code, created.id);
    console.log(`  ✓ ${cat.name}`);
  }

  console.log("🔬 Insertando pruebas de LABORATORIO...");
  const labCategoryId = categoryMap.get("LABORATORIO")!;
  for (let i = 0; i < LAB_TESTS.length; i++) {
    await prisma.medicalTest.create({
      data: {
        code: generateCode("LAB", i + 1),
        name: LAB_TESTS[i],
        categoryId: labCategoryId,
      },
    });
  }
  console.log(`  ✓ ${LAB_TESTS.length} pruebas de laboratorio`);

  console.log("🏥 Insertando servicios GENERALES...");
  const generalCategoryId = categoryMap.get("GENERALES")!;
  for (let i = 0; i < GENERAL_TESTS.length; i++) {
    await prisma.medicalTest.create({
      data: {
        code: generateCode("GEN", i + 1),
        name: GENERAL_TESTS[i],
        categoryId: generalCategoryId,
      },
    });
  }
  console.log(`  ✓ ${GENERAL_TESTS.length} servicios generales`);

  console.log("📷 Insertando estudios de IMAGEN...");
  const imagenCategoryId = categoryMap.get("IMAGEN")!;
  for (let i = 0; i < IMAGEN_TESTS.length; i++) {
    await prisma.medicalTest.create({
      data: {
        code: generateCode("IMG", i + 1),
        name: IMAGEN_TESTS[i],
        categoryId: imagenCategoryId,
      },
    });
  }
  console.log(`  ✓ ${IMAGEN_TESTS.length} estudios de imagen`);

  console.log("🚑 Insertando servicios de AMBULANCIA...");
  const ambulanciaCategoryId = categoryMap.get("AMBULANCIA")!;
  for (let i = 0; i < AMBULANCIA_TESTS.length; i++) {
    await prisma.medicalTest.create({
      data: {
        code: generateCode("AMB", i + 1),
        name: AMBULANCIA_TESTS[i],
        categoryId: ambulanciaCategoryId,
      },
    });
  }
  console.log(`  ✓ ${AMBULANCIA_TESTS.length} servicios de ambulancia`);

  const totalTests =
    LAB_TESTS.length + GENERAL_TESTS.length + IMAGEN_TESTS.length + AMBULANCIA_TESTS.length;
  console.log(`\n✅ Seed completado: ${totalTests} pruebas en 4 categorías`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EJECUCIÓN
// ─────────────────────────────────────────────────────────────────────────────

seedMedicalTests()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
