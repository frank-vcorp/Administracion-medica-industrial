/**
 * @file Seed idempotente de las 6 unidades móviles de AMI.
 * @id IMPL-20260711-01 — Módulo de Unidades Móviles (ARCH-20260711-01).
 * @backup context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md
 *
 * Ejecutar con:
 *   - Local: npx tsx prisma/seed-mobile-units.ts
 *   - Railway: railway run npx tsx prisma/seed-mobile-units.ts
 *
 * Inserta (o actualiza) 6 unidades operativas con nombres genéricos,
 * placas placeholder y capacity 30-50 pacientes/día.
 * Idempotente: usa upsert por `name` (único).
 */
import { PrismaClient, MobileUnitStatus } from "@prisma/client";

const prisma = new PrismaClient();

interface SeedUnit {
  name: string;
  plate: string;
  capacity: number;
}

const SEED_UNITS: SeedUnit[] = [
  { name: "Unidad Móvil 1", plate: "ABC-123", capacity: 50 },
  { name: "Unidad Móvil 2", plate: "DEF-456", capacity: 50 },
  { name: "Unidad Móvil 3", plate: "GHI-789", capacity: 40 },
  { name: "Unidad Móvil 4", plate: "JKL-012", capacity: 40 },
  { name: "Unidad Móvil 5", plate: "MNO-345", capacity: 30 },
  { name: "Unidad Móvil 6", plate: "PQR-678", capacity: 30 },
];

async function seedMobileUnits(): Promise<void> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const unit of SEED_UNITS) {
    const existing = await prisma.mobileUnit.findUnique({
      where: { name: unit.name },
    });

    if (!existing) {
      await prisma.mobileUnit.create({
        data: {
          name: unit.name,
          plate: unit.plate,
          capacity: unit.capacity,
          status: MobileUnitStatus.ACTIVA,
        },
      });
      created++;
    } else {
      // Idempotente: si los valores ya coinciden, no tocamos. Si difieren,
      // actualizamos plate/capacity pero respetamos status e imageUrl existentes.
      const needsUpdate =
        existing.plate !== unit.plate || existing.capacity !== unit.capacity;
      if (needsUpdate) {
        await prisma.mobileUnit.update({
          where: { id: existing.id },
          data: { plate: unit.plate, capacity: unit.capacity },
        });
        updated++;
      } else {
        skipped++;
      }
    }
  }

  console.log(
    `📦 Mobile Units seed: ${created} creadas, ${updated} actualizadas, ${skipped} sin cambios (esperadas ${SEED_UNITS.length})`
  );
}

async function main(): Promise<void> {
  await seedMobileUnits();
}

main()
  .catch((err: unknown) => {
    console.error("❌ Error durante seed de unidades móviles:", err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
