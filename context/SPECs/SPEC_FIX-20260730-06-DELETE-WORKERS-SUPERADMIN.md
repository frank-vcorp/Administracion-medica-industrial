# SPEC_FIX-20260730-06 — ELIMINACIÓN MASIVA DE PACIENTES/TRABAJADORES (SUPERADMIN)

**ID:** FIX-20260730-06
**Tipo:** Fix arquitectónico
**Prioridad:** P1
**Stack:** Next.js 16 (App Router) + Prisma + PostgreSQL + Vercel Hobby
**Autor:** INTEGRA (2026-07-30)
**Dependencia:** ARCH-20260730-01 (eliminación masiva de empresas), FIX-20260730-05-H3 (timeout-resilient deletion)
**Estado:** READY para SOFIA

---

## 1. Problema

Frank necesita eliminar pacientes (Workers) con todo su historial clínico de forma masiva. El patrón base es el mismo que `deleteCompanies` (ARCH-20260730-01 + FIX-20260730-05-H3): chunks de 5 con `$transaction` independiente por chunk, timeout-resilient, audit log por chunk, UI multi-select con modal de confirmación.

**Diferencia clave vs Companies:** Para Companies se hizo "soft cascade" (desvincular, preservar historia clínica). Para Workers se quiere **hard delete total**: paciente + TODO su historial (appointments, medical events, lab orders, resultados, etc.).

---

## 2. Decisiones de Frank (confirmadas)

1. **Hard delete total** — paciente + TODO su historial (cascade a appointments, medical events, lab orders, resultados, etc.).
2. **Solo SUPERADMIN** (mismo RBAC que deleteCompanies).
3. **Reutilizar modelo `Worker`** (no crear `Patient` nuevo).
4. **Migración Prisma:** cambiar TODAS las FKs hacia Worker de `Restrict` → `Cascade` para permitir el hard delete.
5. **Razón opcional** en modal (igual que empresas).
6. **Audit logs antiguos:** se preservan (no tienen FK a Worker, solo `details` JSON con snapshot).

---

## 3. Análisis de impacto de la migración

### 3.1 Inventario completo de FKs hacia Worker

| Modelo | Campo | onDelete actual | Acción requerida |
|--------|-------|-----------------|------------------|
| `Appointment` | `workerId` | implicit Restrict | → **Cascade** |
| `ClinicalHistory` | `workerId` | implicit Restrict | → **Cascade** |
| `MedicalEvent` | `workerId` | implicit Restrict | → **Cascade** |
| `ProjectWorker` | `workerId` | implicit Restrict | → **Cascade** |
| `LabOrder` | `workerId` | **explicit Restrict** | → **Cascade** |
| `WorkerReportEmail` | `workerId` | **explicit Cascade** | ✅ ya Cascade, sin cambio |

**Nota:** `PaymentRecord.workerId` NO es FK (solo `String` con índice). No requiere migración.

### 3.2 Cadena transitive de cascadas

Cuando se borra un Worker, las cascadas se propagan:

```
Worker (delete)
├── Appointment (Cascade) ← NUEVO
│   └── PrefilledInvitation (Cascade) ← NUEVO
├── ClinicalHistory (Cascade) ← NUEVO
├── MedicalEvent (Cascade) ← NUEVO
│   ├── EventTest (Cascade) ← NUEVO
│   │   ├── StudyExtractionSnapshot (ya Cascade ✅)
│   │   │   └── AIPrediagnosisSnapshot (Cascade) ← NUEVO
│   │   │       └── DoctorStudyReview (Cascade) ← NUEVO
│   │   ├── LabResult (SetNull ✅)
│   │   └── LabOrderItem (SetNull ✅)
│   ├── LabRecord (Cascade) ← NUEVO
│   ├── StudyRecord (Cascade) ← NUEVO
│   ├── MedicalExam (Cascade) ← NUEVO
│   ├── MedicalVerdict (Cascade) ← NUEVO
│   ├── PapeletaTimelineEntry (ya Cascade ✅)
│   ├── PaymentRecord (ya Cascade ✅)
│   └── ProjectWorker (SetNull ✅)
├── ProjectWorker (Cascade) ← NUEVO
├── LabOrder (Cascade) ← NUEVO
│   ├── LabOrderItem (ya Cascade ✅)
│   │   └── LabResult (ya Cascade ✅)
│   │       └── LabResultAudit (ya Cascade ✅)
│   ├── LabTraceEvent (ya Cascade ✅)
│   ├── LabCashMovement (ya Cascade ✅)
│   └── Courtesy (ya Cascade ✅)
└── WorkerReportEmail (ya Cascade ✅)
```

### 3.3 Migración requerida

**Nombre:** `20260730180000_worker_cascade_delete/migration.sql`

**Contenido exacto:**

```sql
-- FIX-20260730-06: Cambiar FKs hacia Worker de Restrict → Cascade
-- para permitir hard delete de pacientes con todo su historial.

-- 1. Appointment.workerId → Cascade
ALTER TABLE "appointments" DROP CONSTRAINT "appointments_workerId_fkey";
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- 2. ClinicalHistory.workerId → Cascade
ALTER TABLE "clinical_histories" DROP CONSTRAINT "clinical_histories_workerId_fkey";
ALTER TABLE "clinical_histories" ADD CONSTRAINT "clinical_histories_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- 3. MedicalEvent.workerId → Cascade
ALTER TABLE "medical_events" DROP CONSTRAINT "medical_events_workerId_fkey";
ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- 4. ProjectWorker.workerId → Cascade
ALTER TABLE "project_workers" DROP CONSTRAINT "project_workers_workerId_fkey";
ALTER TABLE "project_workers" ADD CONSTRAINT "project_workers_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- 5. LabOrder.workerId → Cascade (ya era Restrict explícito)
ALTER TABLE "lab_orders" DROP CONSTRAINT "lab_orders_workerId_fkey";
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_workerId_fkey"
  FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE;

-- 6. PrefilledInvitation.appointmentId → Cascade (transitivo desde Appointment)
ALTER TABLE "prefilled_invitations" DROP CONSTRAINT "prefilled_invitations_appointmentId_fkey";
ALTER TABLE "prefilled_invitations" ADD CONSTRAINT "prefilled_invitations_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE;

-- 7. MedicalEvent → EventTest (transitivo)
ALTER TABLE "event_tests" DROP CONSTRAINT "event_tests_eventId_fkey";
ALTER TABLE "event_tests" ADD CONSTRAINT "event_tests_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- 8. MedicalEvent → LabRecord (transitivo)
ALTER TABLE "lab_records" DROP CONSTRAINT "lab_records_eventId_fkey";
ALTER TABLE "lab_records" ADD CONSTRAINT "lab_records_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- 9. MedicalEvent → StudyRecord (transitivo)
ALTER TABLE "study_records" DROP CONSTRAINT "study_records_eventId_fkey";
ALTER TABLE "study_records" ADD CONSTRAINT "study_records_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- 10. MedicalEvent → MedicalExam (transitivo)
ALTER TABLE "medical_exams" DROP CONSTRAINT "medical_exams_eventId_fkey";
ALTER TABLE "medical_exams" ADD CONSTRAINT "medical_exams_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- 11. MedicalEvent → MedicalVerdict (transitivo)
ALTER TABLE "medical_verdicts" DROP CONSTRAINT "medical_verdicts_eventId_fkey";
ALTER TABLE "medical_verdicts" ADD CONSTRAINT "medical_verdicts_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "medical_events"("id") ON DELETE CASCADE;

-- 12. EventTest → StudyExtractionSnapshot (ya Cascade, verificar)
-- StudyExtractionSnapshot.eventTestId → EventTest ya es Cascade ✅

-- 13. StudyExtractionSnapshot → AIPrediagnosisSnapshot (transitivo)
ALTER TABLE "ai_prediagnosis_snapshots" DROP CONSTRAINT "ai_prediagnosis_snapshots_extractionSnapshotId_fkey";
ALTER TABLE "ai_prediagnosis_snapshots" ADD CONSTRAINT "ai_prediagnosis_snapshots_extractionSnapshotId_fkey"
  FOREIGN KEY ("extractionSnapshotId") REFERENCES "study_extraction_snapshots"("id") ON DELETE CASCADE;

-- 14. AIPrediagnosisSnapshot → DoctorStudyReview (transitivo)
ALTER TABLE "doctor_study_reviews" DROP CONSTRAINT "doctor_study_reviews_prediagnosisSnapshotId_fkey";
ALTER TABLE "doctor_study_reviews" ADD CONSTRAINT "doctor_study_reviews_prediagnosisSnapshotId_fkey"
  FOREIGN KEY ("prediagnosisSnapshotId") REFERENCES "ai_prediagnosis_snapshots"("id") ON DELETE CASCADE;
```

**Aplicación:**
- **Frontend (Railway):** `cd frontend && npx prisma migrate deploy`
- **Backend (Railway):** El backend no corre migraciones (solo genera cliente Python). Pero el schema espejo debe actualizarse para que el cliente Python tenga las relaciones correctas.

### 3.4 Schema espejo (backend)

`backend/prisma/schema.prisma` debe modificarse idénticamente para las FKs de Worker. **Nota:** el backend schema está significativamente detrás del frontend (no tiene WorkerReportEmail, LabResult, LabTraceEvent, LabCashMovement, Courtesy, MobileUnit, MaintenanceRecord). Para este FIX, solo actualizamos las FKs de Worker y sus cascadas transitivas. Frank debe decidir en un IMPL separado si trae el backend schema al día completo.

### 3.5 Audit logs

`AuditLog` NO tiene FK hacia Worker. Solo tiene `userId → User`. Los audit logs que mencionan un worker en su campo `details` (JSON) se preservan intactos. No se rompe nada.

**Decisión:** Preservar audit logs antiguos. El `details` JSON contiene el snapshot del worker como texto. No hay FK que nulificar.

---

## 4. Alcance

### Dentro
- Migración Prisma: 14 ALTERs (FKs Worker + transitivas) → Cascade
- `WorkerService.deleteWorkers` (nuevo en `frontend/src/services/worker.service.ts`)
- `deleteWorkersAction` (nuevo en `frontend/src/actions/worker.actions.ts`)
- `WorkerSelectableGrid` (nuevo en `frontend/src/components/workers/WorkerSelectableGrid.tsx`)
- `DeleteWorkersButton` (nuevo en `frontend/src/components/workers/DeleteWorkersButton.tsx`)
- Modificar `/workers/page.tsx` para integrar selección + botón
- Tests unit: `worker.service.delete.test.ts` (12 casos)
- Schema espejo backend (solo FKs Worker)

### Fuera (NO TOCAR)
- `vercel.json`
- Route Handlers nuevos
- Backend FastAPI (solo schema espejo, no lógica)
- Otras rutas de workers (`/workers/[id]`, `/portal/workers`)

---

## 5. Diseño

### 5.1 `worker.service.ts` — `deleteWorkers`

```ts
// frontend/src/services/worker.service.ts

const DELETE_CHUNK_SIZE = 5

/**
 * FIX-20260730-06: Elimina (hard delete) un conjunto de Workers con todo su historial.
 * Cascade a nivel DB maneja la propagación (Appointment, MedicalEvent, LabOrder, etc.).
 *
 * Atomicidad por-chunk: el lote se divide en chunks de DELETE_CHUNK_SIZE workers;
 * cada chunk se procesa en su propio prisma.$transaction. Si un chunk falla
 * (timeout Vercel), los chunks previos ya quedaron commitidos.
 *
 * Solo permitido para rol SUPERADMIN — la RBAC se valida en la server action.
 */
export async function deleteWorkers(args: {
  workerIds: string[]
  actorUserId: string
  reason?: string
}): Promise<
  | { ok: true; deletedCount: number; deletedWorkerIds: string[] }
  | { ok: false; code: 'INVALID_INPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR'; error: string }
> {
  const workerIds = Array.isArray(args.workerIds) ? args.workerIds : []
  if (workerIds.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', error: 'workerIds requerido (array no vacío)' }
  }

  // Snapshot de nombres pre-delete para audit log
  const workers = await prisma.worker.findMany({
    where: { id: { in: workerIds } },
    select: { id: true, firstName: true, lastName: true, universalId: true },
  })
  if (workers.length === 0) {
    return { ok: false, code: 'NOT_FOUND', error: 'No se encontraron trabajadores con esos IDs' }
  }

  const nameById = new Map(
    workers.map((w) => [w.id, `${w.firstName} ${w.lastName}`] as const)
  )
  const deletedIds: string[] = []

  try {
    for (let i = 0; i < workerIds.length; i += DELETE_CHUNK_SIZE) {
      const chunk = workerIds.slice(i, i + DELETE_CHUNK_SIZE)
      const chunkNames = chunk.map((id) => nameById.get(id) ?? null)

      await prisma.$transaction(
        async (tx) => {
          // Cascade DB maneja todo: Appointment, ClinicalHistory, MedicalEvent,
          // LabOrder, ProjectWorker, WorkerReportEmail + transitivos.
          for (const workerId of chunk) {
            await tx.worker.delete({ where: { id: workerId } })
          }

          // Audit log por chunk
          await tx.auditLog.create({
            data: {
              userId: args.actorUserId,
              action: 'WORKERS_HARD_DELETE',
              entity: 'Worker',
              entityId: chunk.join(','),
              details: {
                deletedWorkerIds: chunk,
                deletedWorkerNames: chunkNames,
                workerCount: chunk.length,
                reason: args.reason ?? null,
              } as Prisma.InputJsonValue,
            },
          })
        },
        { timeout: 30000, maxWait: 10000 }
      )

      deletedIds.push(...chunk)
    }

    return { ok: true, deletedCount: deletedIds.length, deletedWorkerIds: deletedIds }
  } catch (err) {
    console.error('[deleteWorkers] failed:', err)
    return {
      ok: false,
      code: 'INTERNAL_ERROR',
      error: (err as Error).message ?? 'Error desconocido',
    }
  }
}
```

**Nota:** Como todas las FKs ahora son Cascade, el service es mucho más simple que `deleteCompanies`. No necesitamos 14 ops por worker — solo `tx.worker.delete()` y la DB hace el resto.

### 5.2 `worker.actions.ts` — `deleteWorkersAction`

```ts
// frontend/src/actions/worker.actions.ts

/**
 * FIX-20260730-06: Elimina (hard delete) un conjunto de trabajadores.
 * RBAC: SOLO SUPERADMIN.
 */
export async function deleteWorkersAction(args: {
  workerIds: string[]
  reason?: string
}): Promise<
  | { ok: true; deletedCount: number; deletedWorkerIds: string[] }
  | {
      ok: false
      code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'NOT_FOUND' | 'INTERNAL_ERROR'
      error: string
    }
> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return { ok: false, code: 'UNAUTHENTICATED', error: 'Sin sesión' }
  }
  const role = (session.user as { role?: string }).role
  if (role !== 'SUPERADMIN') {
    return {
      ok: false,
      code: 'FORBIDDEN',
      error: 'Se requiere rol SUPERADMIN para eliminar trabajadores',
    }
  }

  if (!Array.isArray(args.workerIds) || args.workerIds.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', error: 'workerIds requerido (array no vacío)' }
  }

  const result = await WorkerService.deleteWorkers({
    workerIds: args.workerIds,
    actorUserId: (session.user as { id: string }).id,
    reason: args.reason,
  })

  if (result.ok) {
    revalidatePath('/workers')
  }
  return result
}
```

### 5.3 `WorkerSelectableGrid.tsx`

Mismo patrón que `CompanySelectableGrid.tsx` pero adaptado a Worker:

```tsx
// frontend/src/components/workers/WorkerSelectableGrid.tsx
'use client'

export interface SelectableWorker {
  id: string
  firstName: string
  lastName: string
  universalId: string
  email: string | null
  phone: string | null
  company: { name: string } | null
  jobPosition: { name: string } | null
}

interface Props {
  workers: SelectableWorker[]
  selectable: boolean // true solo para SUPERADMIN
  selectedIds: Set<string>
  onSelectionChange: (
    next: Set<string>,
    meta: { selectedNames: Array<{ id: string; fullName: string; universalId: string }> }
  ) => void
}

// Render: tabla con checkboxes (no tarjetas, porque workers se listan en tabla)
// Checkbox en primera columna, solo visible si selectable=true
// onSelectionChange eleva al padre los IDs + nombres completos
```

**Nota:** La página `/workers` usa `WorkersTable` (tabla, no tarjetas). El `WorkerSelectableGrid` reemplaza/extiende `WorkersTable` añadiendo checkboxes. Alternativamente, se puede modificar `WorkersTable` directamente para soportar selección condicional.

**Decisión:** Crear `WorkerSelectableGrid` como wrapper que renderiza `WorkersTable` con checkboxes añadidos. Esto preserva el layout existente.

### 5.4 `DeleteWorkersButton.tsx`

Mismo patrón que `DeleteCompaniesButton.tsx`:

```tsx
// frontend/src/components/workers/DeleteWorkersButton.tsx
'use client'

interface Props {
  selectedNames: Array<{ id: string; fullName: string; universalId: string }>
  onClearSelection: () => void
}

// Barra inferior fija + modal de confirmación
// Modal incluye:
//   - Lista de trabajadores a eliminar (nombre + universalId)
//   - Advertencia roja: "IRREVERSIBLE. Se eliminará el paciente y TODO su historial clínico."
//   - Input opcional de razón
//   - Checkbox obligatorio "Entiendo que es irreversible"
//   - Botón rojo "Eliminar N pacientes"
// try/catch + router.refresh() para timeout resilience
```

### 5.5 Modificación de `/workers/page.tsx`

```tsx
// frontend/src/app/workers/page.tsx
export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'

export default async function WorkersPage(props: { searchParams: Promise<{ edit?: string }> }) {
  const session = await getServerSession(authOptions)
  const isSuperAdmin = session?.user?.role === 'SUPERADMIN'

  // ... cargar workers, companies, jobPositions, branches ...

  return (
    <div className="space-y-8 pb-12">
      {/* Header existente */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Listado de pacientes</h2>
          <p className="text-sm text-slate-500 font-medium">Gestión integral de empleados y afiliaciones.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <BulkWorkerImportModal ... />
          <BulkClinicWalkInImportModal ... />
          <WorkerFormModal ... />
        </div>
      </div>

      {/* WorkerSelectableGrid reemplaza WorkersTable */}
      <WorkersPageClient
        workers={workers.value}
        companies={companies.value}
        jobPositions={jobPositions.value}
        initialEditWorkerId={searchParams.edit}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  )
}
```

**Nota:** `WorkersPageClient` es un nuevo client-component que envuelve `WorkerSelectableGrid` + `DeleteWorkersButton` + estado de selección. Esto es necesario porque la página es server-component y la selección requiere `useState`.

---

## 6. Tests esperados

### 6.1 Unit: `worker.service.delete.test.ts`

**12 casos de prueba:**

1. **Array vacío** → `INVALID_INPUT`
2. **IDs no existentes** → `NOT_FOUND`
3. **1 worker** → 1 `$transaction`, 1 audit log, worker + cascade eliminados
4. **3 workers** → 1 `$transaction`, 1 audit log
5. **5 workers** → 1 `$transaction`, 1 audit log (chunk exacto)
6. **6 workers** → 2 `$transaction` (5+1), 2 audit logs
7. **10 workers** → 2 `$transaction` (5+5), 2 audit logs
8. **11 workers** → 3 `$transaction` (5+5+1), 3 audit logs
9. **25 workers** → 5 `$transaction`, 5 audit logs
10. **Error en chunk 2** → chunk 1 persistido, chunk 2 no
11. **Cascade verification:** al borrar worker, sus `appointments`, `medicalEvents`, `labOrders`, `clinicalHistory`, `projectWorkers` también desaparecen
12. **Audit log preservation:** los audit logs antiguos del worker NO se borran (no tienen FK a Worker)

### 6.2 Manual (Frank)

- Crear 2 workers de prueba con appointments + lab orders
- Login SUPERADMIN → /workers → seleccionar 2 → modal → confirmar
- Verificar que los 2 workers desaparecen
- Verificar `SELECT * FROM "AuditLog" WHERE action='WORKERS_HARD_DELETE';`
- Verificar que appointments, medical events, lab orders del worker también se borraron

---

## 7. Criterios de aceptación

- [ ] Migración `20260730180000_worker_cascade_delete` aplicada en Railway (frontend)
- [ ] Schema espejo backend actualizado (solo FKs Worker)
- [ ] `WorkerService.deleteWorkers` implementado con chunks de 5
- [ ] `deleteWorkersAction` con RBAC SUPERADMIN
- [ ] `WorkerSelectableGrid` con checkboxes solo visibles para SUPERADMIN
- [ ] `DeleteWorkersButton` con modal de confirmación + razón opcional + checkbox irreversible
- [ ] `/workers/page.tsx` integrado con selección
- [ ] `pnpm typecheck` → 0 errores
- [ ] `pnpm test` → todos verde (incluidos 12 tests nuevos)
- [ ] `pnpm lint` → 0 errores
- [ ] Smoke test manual en staging con worker de prueba
- [ ] GEMINI revisión final sin bloqueadores

---

## 8. Riesgos

### 8.1 Migración destructiva

La migración cambia FKs de Restrict → Cascade. Si se aplica en producción con workers que tienen LabOrders, esos LabOrders se borrarán cuando se borre el worker. **Esto es intencional** (Frank lo confirmó), pero requiere:

- **Backup pre-migración:** `pg_dump` de tablas `lab_orders`, `medical_events`, `appointments` antes de aplicar la migración.
- **Ventana de mantenimiento:** aplicar en horario de bajo tráfico.

### 8.2 Implicaciones regulatorias

Hard delete de historia clínica puede tener implicaciones regulatorias en México (LFEA, NOM-004-SSA2-2012). **Frank debe confirmar** que es aceptable para su caso de uso. Si hay requisito de preservación, se necesita soft delete en lugar de hard delete.

### 8.3 Backend schema desincronizado

El backend schema está significativamente detrás del frontend. Actualizamos solo las FKs de Worker. Frank debe decidir si trae el backend al día completo en un IMPL separado.

### 8.4 Timeout en chunks grandes

Con cascade DB, cada `tx.worker.delete()` puede tardar más si el worker tiene mucho historial. Con 5 workers por chunk y timeout de 30s, debería haber margen. Si no, reducir `DELETE_CHUNK_SIZE` a 3.

---

## 9. Archivos a modificar/crear

| Archivo | Acción |
|---------|--------|
| `frontend/prisma/schema.prisma` | Modificar: FKs Worker → Cascade + transitivas |
| `frontend/prisma/migrations/20260730180000_worker_cascade_delete/migration.sql` | Crear: 14 ALTERs |
| `frontend/src/services/worker.service.ts` | Modificar: añadir `deleteWorkers` |
| `frontend/src/actions/worker.actions.ts` | Modificar: añadir `deleteWorkersAction` |
| `frontend/src/components/workers/WorkerSelectableGrid.tsx` | Crear: tabla con checkboxes |
| `frontend/src/components/workers/DeleteWorkersButton.tsx` | Crear: barra + modal |
| `frontend/src/components/workers/WorkersPageClient.tsx` | Crear: client-component wrapper |
| `frontend/src/app/workers/page.tsx` | Modificar: integrar selección + isSuperAdmin |
| `frontend/src/services/__tests__/worker.service.delete.test.ts` | Crear: 12 tests |
| `backend/prisma/schema.prisma` | Modificar: espejo FKs Worker |

**Total:** 10 archivos (4 crear, 6 modificar)

---

## 10. NO hacer

- NO commitear ni pushear sin OK explícito de Frank
- NO aplicar migración a Railway sin OK de Frank
- NO usar `qodo` (sunset, usar GEMINI)
- NO crear modelo `Patient` nuevo — reutilizar `Worker`
- NO tocar `vercel.json`
- NO añadir Route Handlers nuevos
- NO cambiar la signature de actions existentes
- NO eliminar audit logs antiguos (preservar)

---

## 11. Self-review (para SOFIA)

- [ ] ¿El código refleja la SPEC?
- [ ] ¿Los tests cubren chunks 1, 2, error en chunk N?
- [ ] ¿La migración incluye TODAS las FKs transitivas necesarias?
- [ ] ¿El schema espejo backend quedó sincronizado para FKs Worker?
- [ ] ¿Los checkboxes solo se renderizan para SUPERADMIN?
- [ ] ¿El modal lista los trabajadores a eliminar con nombre + universalId?
- [ ] ¿El try/catch + router.refresh() está en DeleteWorkersButton?
- [ ] ¿Se preservan los audit logs antiguos?

---

## 12. Decisiones pendientes de Frank

1. **¿Ruta destino?** La página actual es `/workers` (no `/admin/workers`). ¿Confirmas que el botón va ahí?
2. **¿Backend FastAPI se actualiza completo?** El schema espejo está detrás. ¿Solo actualizamos FKs Worker o traemos todo al día?
3. **¿Implicaciones regulatorias?** ¿Confirmas que hard delete de historia clínica es aceptable para tu caso de uso (LFEA, NOM-004)?
4. **¿Modal lista impacto?** ¿El modal debe mostrar counts de appointments/lab orders/medical events que se van a borrar, o solo los nombres de los workers?
5. **¿Backup pre-migración?** ¿Frank hará `pg_dump` antes de aplicar la migración en producción?

---

## 13. Reporte esperado de SOFIA

- 10 archivos modificados/creados con líneas finales
- Resultado de los 4 gates (typecheck, test, lint, git diff --check)
- Output de la migración generada
- Self-review completo
- Recomendación de GEMINI para segunda mano de validación antes de merge
