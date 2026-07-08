# Migración IMPL-20260707-16 — Slice C LabResult + ciclo de vida

**Fecha:** 2026-07-08
**ID:** IMPL-20260707-16
**Origen:** Merge commit `d37e4c2` (branch `feature/lab-slice-c-results`)
**Complejidad:** media — 3 enums + 4 modelos + back-relations + 1 columna en LabOrderItem.

## Resumen

| Cambio | Cantidad | Tipo |
|---|---|---|
| Enums nuevos | 3 | `LabResultStatus`, `LabAnalyteDataType`, `LabSex` |
| Modelos nuevos | 4 | `lab_analytes`, `lab_reference_ranges`, `lab_results`, `lab_result_audits` |
| Tabla join | 1 | `_LabOrderItemToEventTest` (implícita via columna `eventTestId`) |
| Columnas nuevas en tablas existentes | 1 | `eventTestId` en `lab_order_items` |
| Índices únicos | 4 | uno por cada modelo nuevo |
| Índices secundarios | 12 | para búsqueda por FK, status, analyteId |
| Foreign keys nuevas | 11 | relaciones a `medical_tests`, `lab_analytes`, `lab_results`, `lab_order_items`, `event_tests`, `lab_units`, `users` |
| Back-relations | 8 | a `MedicalTest`, `EventTest`, `LabOrderItem`, `LabUnit`, `User` (×5) |

**Total:** 137 líneas SQL, todas no-breaking (todo es aditivo, defaults seguros).

## Aplicar en Railway (método recomendado)

### Opción A — Prisma nativo (preferido)

```bash
cd "/mnt/Datos/Proyectos 2.0/Administracion Medica Industrial/Administracion-medica-industrial/frontend"

railway run --service 'Administracion-medica-industrial' \
  npx prisma migrate deploy
```

### Opción B — SQL standalone

```bash
railway service link Postgres
railway run --service 'Administracion-medica-industrial' \
  psql "$DATABASE_URL" -f "/mnt/Datos/Proyectos 2.0/Administracion Medica Industrial/Administracion-medica-industrial/context/infra/09-migration-20260708-lab-results.sql"
```

## Verificación post-aplicación

```sql
-- 1. Las 4 tablas nuevas deben existir
SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name LIKE 'lab_%'
ORDER BY table_name;
-- Esperadas: lab_analytes, lab_reference_ranges, lab_result_audits, lab_results

-- 2. Los 3 enums deben existir
SELECT t.typname FROM pg_type t
WHERE t.typname IN ('LabResultStatus', 'LabAnalyteDataType', 'LabSex');

-- 3. La columna eventTestId en lab_order_items
SELECT column_name FROM information_schema.columns
WHERE table_name='lab_order_items' AND column_name='eventTestId';

-- 4. Migración registrada
SELECT migration_name, finished_at IS NOT NULL AS finished
FROM _prisma_migrations
WHERE migration_name = '20260707120000_add_lab_results';
```

## Conexión con papeleta AMI

Este slice introduce la integración bidireccional:
- `LabOrder.medicalEventId` (ya existía desde Slice B) — vincula orden a papeleta
- `LabOrderItem.eventTestId` (NUEVO) — vincula cada estudio del LabOrder a un examen específico de la papeleta (EventTest)
- `LabResult.eventTestId` (NUEVO) — vincula cada resultado a un examen específico

Esto permite que:
1. En `/events/[id]` (papeleta), ver LabOrders y LabResults asociados
2. En `/lab/reception`, seleccionar MedicalEvent para prellenar workerId
3. En `/lab/results`, filtrar por paciente y ver resultados de sus papeletas

Refs: SPEC_IMPL-20260707-SLICE-C-RESULTADOS.md §3
