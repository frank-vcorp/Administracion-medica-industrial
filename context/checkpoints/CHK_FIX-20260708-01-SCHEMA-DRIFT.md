# CHK_FIX-20260708-01 — Schema drift workers+appointments + sync _prisma_migrations

**ID:** FIX-20260708-01
**Implementado por:** INTEGRA
**Fecha de cierre:** 2026-07-08
**Rama:** `fix/20260708-schema-drift-sync`
**Commit:** `59d7579`

---

## Resumen

Drift detectado entre `schema.prisma` local y la DB de Railway que rompía el build de producción del 2026-07-07 17:25 (`workers.lastIdentityDocumentType does not exist`). Causa raíz: el sprint IMPL-20260519-10 (commit `8213211`, 2026-05-19) agregó 14 columnas al schema (4 en `workers` + 10 en `appointments`) pero **nunca generó la migración Prisma correspondiente**. Como las migraciones previas se aplicaron vía `prisma db execute` con SQL directo, la tabla `_prisma_migrations` quedó vacía y el drift pasó desapercibido por 50 días.

---

## Diagnóstico

| Verificación | Resultado |
|---|---|
| `prisma db pull` vs schema.prisma | 14 columnas faltantes detectadas |
| `SELECT FROM information_schema.columns` (Railway) | `workers` tiene 14 cols (esperadas: 18), `appointments` tiene 13 cols (esperadas: 23) |
| `SELECT FROM _prisma_migrations` | tabla NO EXISTE (vacía/corrupta) |
| `prisma migrate status` | reporta 23 migraciones como "no aplicadas" (falso negativo) |

**Columnas faltantes:**

`workers` (4):
- `lastIdentityDocumentType TEXT`
- `lastIdentityFrontFileUrl TEXT`
- `lastIdentityBackFileUrl TEXT`
- `lastIdentityVerifiedAt TIMESTAMP(3)`

`appointments` (10):
- `identityDocumentType`, `identityEvidenceMode`, `identityFrontFileUrl`, `identityBackFileUrl`
- `corroborationResult`, `identityVerifiedAt`, `identityVerifiedByUserId`
- `identityExceptionReason`, `identityExceptionComment`, `qrOperativo`

---

## Archivos creados

| # | Ruta | Tipo |
|---|------|------|
| 1 | `context/infra/06-migration-20260708-fix-schema-drift.sql` | nuevo (64 líneas, 100% aditivo) |
| 2 | `frontend/scripts/sync-prisma-migrations-railway.ts` | nuevo (250 líneas, idempotente) |

---

## Aplicación a Railway

```bash
# Paso 1: aplicar SQL aditivo
DATABASE_URL='postgresql://postgres:...@switchyard.proxy.rlwy.net:52016/railway' \
  npx prisma db execute --url "$DATABASE_URL" \
  --file ../context/infra/06-migration-20260708-fix-schema-drift.sql

# Paso 2: sincronizar _prisma_migrations
DATABASE_URL='...' npx tsx scripts/sync-prisma-migrations-railway.ts

# Paso 3: verificar
DATABASE_URL='...' npx prisma migrate status
```

**Resultado:**
```
=== Sync retroactivo de _prisma_migrations (Railway) ===
[1/4] Tabla _prisma_migrations:
  + Creando _prisma_migrations (estructura oficial Prisma 5+)...
  ✓ _prisma_migrations creada
[2/4] Analizando 23 migraciones contra Railway...
  ✓ 23/23 migraciones validadas como [applied]
[3/4] Registrando migraciones aplicadas en _prisma_migrations...
  ✓ 23/23 inserted
[4/4] Resumen:
  Total migraciones:    23
  Marcadas aplicadas:   23
  Omitidas (parcial/missing/error): 0
```

**`prisma migrate status` ahora reporta:**
```
Database schema is up to date!
```

---

## Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| Aplicación del SQL a Railway | ✅ 14 columnas agregadas |
| Introspección Prisma (`prisma db pull`) | ✅ Worker y Appointment ya tienen todas las columnas del schema |
| Runtime: `worker.findMany()` sin filtros | ✅ OK (1206ms) |
| Runtime: `worker.findMany()` con `lastIdentity*` | ✅ OK |
| Runtime: `appointment.findMany()` con `identity*` | ✅ OK |
| `prisma migrate status` | ✅ "Database schema is up to date!" |
| No se rompió código de SOFIA (ARCH-20260708-01) | ✅ SOFIA hizo cambios aditivos sobre un schema drift; el fix de drift los hace ejecutables |

---

## Notas de seguridad

- El script de sync usa **`gen_random_uuid()`** (PostgreSQL nativo) para los IDs de `_prisma_migrations`, evitando dependencias externas.
- El checksum es ficticio (`manual-railway-fix-<suffix>`) porque no hay hash SHA de los archivos originales; este es un workaround consciente para sincronización retroactiva. La próxima migración nueva que se aplique con `prisma migrate dev` tendrá su checksum real.
- Si una migración futura necesita ser re-aplicada manualmente, el script la detecta como "ya existe" y la deja como está.
- El script es **idempotente**: si se ejecuta dos veces, no duplica filas (UNIQUE constraint en `migration_name`).

---

## Próximo paso

Una vez que Vercel haga una nueva build (merge de `feature/arch-20260708-01-perfiles-paciente` o cualquier otro push a main), el error `workers.lastIdentityDocumentType does not exist` ya NO aparecerá porque las columnas existen en Railway y `_prisma_migrations` está sincronizada.

**Recomendación:** merge de esta rama a `main` antes o junto con el merge de SOFIA, para que el fix de drift quede trazado y respaldado.

---

## Estado de soft gates (INTEGRA)

| Gate | Estado |
|---|---|
| Compilación (Prisma generate) | ✅ |
| Testing (validación runtime contra Railway) | ✅ |
| Revisión (self-review) | ✅ |
| Documentación (este checkpoint + script reproducible) | ✅ |
| Push a origin | ⏸️ Esperando OK explícito de Frank |
| Merge a main | ⏸️ Esperando OK explícito de Frank |