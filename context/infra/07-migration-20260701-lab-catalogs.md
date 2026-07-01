# Migración IMPL-20260630-06 — Slice A NOVA Catálogos LIS

**Fecha:** 2026-07-01
**ID:** IMPL-20260630-06
**Origen:** Commit merge `d53f3c3` (branch `feature/lab-slice-a-catalogs`)
**Complejidad:** baja — solo crea 9 tablas nuevas + 2 enums + 8 columnas opcionales en tablas existentes.

---

## Resumen

| Cambio | Cantidad | Tipo |
|---|---|---|
| Enums nuevos | 2 | `LabUnitSystem`, `LabRole` |
| Tablas nuevas | 9 | `lab_units`, `lab_samples`, `lab_containers`, `lab_methods`, `lab_process_areas`, `lab_departments`, `lab_classifications`, `lab_indications`, `lab_signatures` + 1 join table `_LabContainerDefaultFor` |
| Columnas en `users` | 2 | `labRole` (LabRole), `novaMedicoClave` (TEXT) |
| Columnas en `companies` | 2 | `novaConvenioId` (TEXT), `discountPolicyId` (TEXT) |
| Columnas en `medical_tests` | 6 | `novaClave` (TEXT), `labMethodId`, `labSampleId`, `labProcessAreaId` (FKs), `daysToResult` (INT), `isProfile` (BOOL default false), `isPackage` (BOOL default false) |
| Índices únicos | 9 | uno por cada tabla nueva (`code`/`symbol`/`userId`) |
| Índices secundarios | 8 | para búsquedas por código |

**Total:** 266 líneas SQL, todas no-breaking (todo es aditivo, defaults seguros).

---

## ⚠️ Prerrequisitos antes de aplicar

1. **Verificar que `railway` CLI está autenticado**: `railway whoami`
2. **Verificar servicio destino**: `railway status` debe mostrar `Administracion-medica-industrial` con la env `DATABASE_URL` apuntando a producción.
3. **Backup preventivo** (opcional pero recomendado):
   ```bash
   railway run --service 'Administracion-medica-industrial' \
     pg_dump "$DATABASE_URL" > context/infra/backup-pre-slice-a-$(date +%Y%m%d).sql
   ```

---

## 🚀 Aplicar la migración en Railway (método estándar)

### Opción A — Prisma nativo (recomendado)

```bash
cd "/mnt/Datos/Proyectos 2.0/Administracion Medica Industrial/Administracion-medica-industrial/frontend"

railway run --service 'Administracion-medica-industrial' \
  npx prisma migrate deploy
```

**Qué hace:** Prisma lee `frontend/prisma/migrations/`, detecta `20260701000000_add_lab_catalogs` no aplicada, la ejecuta, y la registra en `_prisma_migrations`.

**Output esperado:**
```
3 migrations found in prisma/migrations
- 20260701000000_add_lab_catalogs
Running migrations...
Database migrated successfully.
```

### Opción B — Sync manual con SQL standalone

Si `prisma migrate deploy` falla por algún motivo (timeout, lock, permisos), aplicar el SQL directo:

```bash
cd "/mnt/Datos/Proyectos 2.0/Administracion Medica Industrial/Administracion-medica-industrial/frontend"

# 1. Aplicar SQL con psql
railway run --service 'Administracion-medica-industrial' \
  psql "$DATABASE_URL" -f prisma/migrations/20260701000000_add_lab_catalogs/migration.sql

# 2. Registrar como aplicada en _prisma_migrations
railway run --service 'Administracion-medica-industrial' \
  npx tsx scripts/sync-prisma-migrations-lab-catalogs.ts
```

### Opción C — Aplicar desde archivo en `context/infra/`

```bash
cd "/mnt/Datos/Proyectos 2.0/Administracion Medica Industrial/Administracion-medica-industrial"

railway run --service 'Administracion-medica-industrial' \
  psql "$DATABASE_URL" -f context/infra/07-migration-20260701-lab-catalogs.sql

railway run --service 'Administracion-medica-industrial' \
  npx tsx frontend/scripts/sync-prisma-migrations-lab-catalogs.ts
```

---

## ✅ Verificación post-aplicación

### 1. Confirmar que las tablas existen

```bash
railway run --service 'Administracion-medica-industrial' \
  psql "$DATABASE_URL" -c "
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE 'lab_%'
    ORDER BY table_name;
  "
```

**Salida esperada (10 filas):**
```
    table_name
------------------
 _LabContainerDefaultFor
 lab_classifications
 lab_containers
 lab_departments
 lab_indications
 lab_methods
 lab_process_areas
 lab_samples
 lab_signatures
 lab_units
```

### 2. Confirmar enums

```bash
railway run --service 'Administracion-medica-industrial' \
  psql "$DATABASE_URL" -c "
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname IN ('LabUnitSystem', 'LabRole')
    ORDER BY t.typname, e.enumsortorder;
  "
```

**Salida esperada:**
```
    typname     |   enumlabel
---------------+-----------------
 LabRole       | LAB_RECEPTIONIST
 LabRole       | LAB_ANALYST
 LabRole       | LAB_VALIDATOR
 LabRole       | LAB_ADMIN
 LabUnitSystem | SI
 LabUnitSystem | CONVENTIONAL
```

### 3. Confirmar columnas extendidas

```bash
railway run --service 'Administracion-medica-industrial' \
  psql "$DATABASE_URL" -c "
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE (table_name = 'users' AND column_name IN ('labRole','novaMedicoClave'))
       OR (table_name = 'companies' AND column_name IN ('novaConvenioId','discountPolicyId'))
       OR (table_name = 'medical_tests' AND column_name IN ('novaClave','labMethodId','labSampleId','labProcessAreaId','daysToResult','isProfile','isPackage'))
    ORDER BY table_name, column_name;
  "
```

### 4. Confirmar migración registrada en `_prisma_migrations`

```bash
railway run --service 'Administracion-medica-industrial' \
  npx tsx frontend/scripts/check-migrations-state.ts
```

**Salida esperada:** entrada `20260701000000_add_lab_catalogs` con `finished=1`, `rolled_back=0`.

### 5. Confirmar seed (opcional)

```bash
railway run --service 'Administracion-medica-industrial' \
  npx prisma db seed
```

**Salida esperada:** `✅ seedLabCatalogs: 10+5+5+5+5+5+5+3 = 43 items insertados/actualizados` + `✅ Seed OK`.

### 6. Verificación final vía app

```bash
curl -s -b cookies.txt \
  'https://administracion-medica-industrial-production.up.railway.app/api/v1/lab/catalogs?mod=unidades&draw=1&start=0&length=10' \
  | head -200
```

**Salida esperada:** JSON `{"draw":1,"recordsTotal":10,"recordsFiltered":10,"data":[{"id":"...","symbol":"mg/dL",...},...]}`

---

## 🔄 Rollback (si algo falla)

El SQL generado es no-breaking. Para revertir:

```bash
# 1. Borrar tablas en orden inverso (respetando FKs)
railway run --service 'Administracion-medica-industrial' psql "$DATABASE_URL" <<EOF
DROP TABLE IF EXISTS "_LabContainerDefaultFor";
DROP TABLE IF EXISTS "lab_signatures";
DROP TABLE IF EXISTS "lab_indications";
DROP TABLE IF EXISTS "lab_classifications";
DROP TABLE IF EXISTS "lab_process_areas";
DROP TABLE IF EXISTS "lab_departments";
DROP TABLE IF EXISTS "lab_methods";
DROP TABLE IF EXISTS "lab_containers";
DROP TABLE IF EXISTS "lab_samples";
DROP TABLE IF EXISTS "lab_units";
DROP TYPE IF EXISTS "LabRole";
DROP TYPE IF EXISTS "LabUnitSystem";

ALTER TABLE "users" DROP COLUMN IF EXISTS "labRole";
ALTER TABLE "users" DROP COLUMN IF EXISTS "novaMedicoClave";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "discountPolicyId";
ALTER TABLE "companies" DROP COLUMN IF EXISTS "novaConvenioId";
ALTER TABLE "medical_tests" DROP COLUMN IF EXISTS "daysToResult";
ALTER TABLE "medical_tests" DROP COLUMN IF EXISTS "isPackage";
ALTER TABLE "medical_tests" DROP COLUMN IF EXISTS "isProfile";
ALTER TABLE "medical_tests" DROP COLUMN IF EXISTS "labMethodId";
ALTER TABLE "medical_tests" DROP COLUMN IF EXISTS "labProcessAreaId";
ALTER TABLE "medical_tests" DROP COLUMN IF EXISTS "labSampleId";
ALTER TABLE "medical_tests" DROP COLUMN IF EXISTS "novaClave";
EOF

# 2. Limpiar registro de migración
railway run --service 'Administracion-medica-industrial' psql "$DATABASE_URL" -c "
  DELETE FROM _prisma_migrations WHERE migration_name = '20260701000000_add_lab_catalogs';
"
```

---

## 📋 Checklist de aplicación

- [ ] Backup preventivo ejecutado
- [ ] `prisma migrate deploy` aplicado (o SQL + sync manual)
- [ ] 10 tablas nuevas presentes (`\dt lab_*`)
- [ ] 2 enums presentes (`SELECT * FROM pg_type WHERE typname IN ('LabUnitSystem','LabRole')`)
- [ ] 8 columnas extendidas presentes (en users/companies/medical_tests)
- [ ] `_prisma_migrations` registra `20260701000000_add_lab_catalogs` con finished=1
- [ ] Seed ejecutado (`prisma db seed`) → 43 items
- [ ] Smoke test del API: `GET /api/v1/lab/catalogs?mod=unidades` retorna 10 unidades
- [ ] Smoke test del UI: `/admin/lab/catalogs?mod=unidades` muestra tabla editable
- [ ] Verificar que `/admin/services` existente sigue intacto

---

## 📞 Si algo sale mal

| Síntoma | Acción |
|---|---|
| `prisma migrate deploy` retorna timeout | Reintentar; si persiste, usar Opción B (SQL + sync manual) |
| `permission denied` en `CREATE TYPE` | El usuario DB no tiene permisos; contactar admin Railway |
| `_prisma_migrations` tiene conflicto de PK | Limpiar entrada duplicada con `DELETE WHERE migration_name = '...' AND id != (correcto)` |
| API retorna 500 tras migración | Reiniciar servicio Railway: `railway up --detach` |
| `/admin/lab/catalogs` no aparece en sidebar | Verificar que el deploy de Vercel incluye el commit `d53f3c3` |

---

## 🔗 Referencias

- SQL standalone: `context/infra/07-migration-20260701-lab-catalogs.sql`
- SQL Prisma: `frontend/prisma/migrations/20260701000000_add_lab_catalogs/migration.sql`
- Script sync: `frontend/scripts/sync-prisma-migrations-lab-catalogs.ts`
- Checkpoint: `context/checkpoints/CHK_ARCH-20260630-02-SLICE-A.md`
- SPEC: `context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md`