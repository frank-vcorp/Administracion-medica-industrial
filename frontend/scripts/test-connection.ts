import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
p.$queryRaw`SELECT 1 as ok, current_database() as db, version() as v`
  .then((r: any) => {
    console.log("✅ Conexión OK:", r);
    p.$disconnect();
  })
  .catch((e: any) => {
    console.error("❌ Error:", e.message);
    p.$disconnect();
  });