# SPEC_ARCH-20260730-01 — ELIMINACIÓN MASIVA DE EMPRESAS (SUPERADMIN)

**ID:** ARCH-20260730-01
**Tipo:** Arquitectura + Implementación
**Prioridad:** P2
**Stack:** Next.js 16 (App Router) + Prisma + PostgreSQL
**Autor:** INTEGRA (2026-07-30)
**Origen:** Solicitud directa de Frank 2026-07-30 04:47 — "no tengo modals para eliminar empresas... con el fin de limpiar la base, quizás solo el superadministrador pueda usarlo"

---

## 1. Objetivo

Permitir que un **SUPERADMIN** elimine una o varias empresas desde la página `/companies` mediante un modal de confirmación con checkbox de aceptación y botón rojo. La eliminación debe:

- Ser real (hard delete) en PostgreSQL.
- Incluir las cascadas transitivas necesarias para no romper FKs.
- Estar protegida por doble validación: server-side (rol) + server-side (checkbox).
- Quedar registrada en `AuditLog` con `action='SOFT_HARD_DELETE'`.
- Ser **bloqueada** para ADMIN, VENDEDOR, COMPANY_CLIENT y demás roles.

## 2. Alcance

**Dentro:**
- Añadir `SUPERADMIN` al enum `UserRole` (Prisma schema + migración).
- Crear server action `deleteCompaniesAction(companyIds: string[])` con guard de rol.
- UI multi-select con checkbox por tarjeta + barra de acciones flotante.
- Modal de confirmación con tipado de razón opcional + checkbox "Entiendo que es irreversible" + botón rojo "Eliminar N empresas".
- Audit log.
- Migración Prisma nueva aplicable a Railway.

**Fuera del alcance:**
- Wipe total de la base (botón "borrar todo").
- Soft delete (`deletedAt`).
- Asignación masiva del rol SUPERADMIN (Frank lo hará manualmente vía SQL o seed).
- Cambios en backend FastAPI (no es necesario porque la lógica corre en server actions Next.js).

## 3. Modelo de datos

### 3.1 Enum `UserRole`

```prisma
enum UserRole {
  ADMIN
  RECEPTIONIST
  DOCTOR_GENERAL
  DOCTOR_VALIDATOR
  CAPTURIST
  COMPANY_CLIENT
  VENDEDOR
  // ARCH-20260730-01: nuevo rol con permiso de eliminación destructiva
  SUPERADMIN
}
```

### 3.2 Cascadas de Company

`Company` tiene relación con (mínimo): `Worker`, `Appointment`, `MedicalProfile`, `MedicalEvent` (billingCompanyId), `JobPosition`, `Project`, `LabOrder`, `User`, `CompanySellerHistory`, `CompanySelfRegistration`, `Branch` (allowedBranches M2M, defaultBranch N:1).

**Estado actual del schema (verificado 2026-07-30):**

| Modelo | `companyId` | onDelete |
|--------|-------------|----------|
| `User.companyId` | `String?` (nullable) | default SetNull |
| `Worker.companyId` | `String?` (nullable) | default SetNull |
| `MedicalProfile.companyId` | `String?` (nullable) | default SetNull |
| `MedicalEvent.billingCompanyId` | `String?` (nullable) | default SetNull |
| `Appointment.companyId` | `String` (**NOT NULL**) | default Restrict |
| `JobPosition.companyId` | `String` (**NOT NULL**) | default Restrict |
| `Project.companyId` | `String` (**NOT NULL**) | default Restrict |
| `LabOrder.companyId` | `String?` (nullable) | default SetNull |
| `CompanySellerHistory.companyId` | `String` (NOT NULL) | **`onDelete: Cascade`** ✅ |
| `CompanySelfRegistration` | `String?` (nullable) | default SetNull |

**Decisión arquitectónica:** Para los 3 FKs `NOT NULL` (`Appointment`, `JobPosition`, `Project`), la opción menos invasiva es **volverlos nullable** en la misma migración que añade `SUPERADMIN`. Esto:

- Preserva historia clínica (workers, appointments, projects se desvinculan, no se borran).
- No requiere borrado destructivo de citas/puestos/proyectos.
- Es una migración de una sola columna por modelo, sin pérdida de datos.

**Decisión final:** Volver nullable `Appointment.companyId`, `JobPosition.companyId`, `Project.companyId` en la migración.

### 3.3 Procedimiento de la transacción

Eliminar **primero las filas hijas** dentro de `prisma.$transaction(async (tx) => {...})` en este orden:

1. `CompanySellerHistory` (cascade automático)
2. `CompanySelfRegistration` (donde `companyId` o `targetCompanyId` coincida)
3. `allowedBranches` M2M: `prisma.company.update({where:{id}, data:{allowedBranches:{set:[]}}})`
4. `User.companyId = null` (usuarios vinculados)
5. `JobPosition.companyId = null` (tras nulificar)
6. `MedicalProfile.companyId = null`
7. `Worker.companyId = null`
8. `Appointment.companyId = null`
9. `MedicalEvent.billingCompanyId = null`
10. `Project.companyId = null`
11. `LabOrder.companyId = null`
12. **`Company.delete`** (último)

> Workers, profiles, appointments, etc. se desvinculan para preservar historia clínica.

### 3.4 AuditLog

```ts
await prisma.auditLog.create({
  data: {
    userId: session.user.id,
    action: 'COMPANIES_HARD_DELETE',
    entity: 'Company',  // NOTA: el modelo AuditLog usa `entity`, no `entityType`
    entityId: companyIds.join(','),
    details: {
      deletedCompanyIds: companyIds,
      deletedCompanyNames: companies.map((c) => c.name),
      companyCount: companyIds.length,
      reason: reason ?? null,
    },
  },
})
```

## 4. Backend / Server Actions

### 4.1 `deleteCompaniesAction(args: { companyIds: string[]; reason?: string })`

```ts
// src/actions/company.actions.ts
export async function deleteCompaniesAction(args: {
  companyIds: string[]
  reason?: string
}): Promise<{ ok: true; deletedCount: number } | { ok: false; code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'INVALID_INPUT' | 'INTERNAL_ERROR'; error: string }> {
  // 1. Sesión
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, code: 'UNAUTHENTICATED', error: 'Sin sesión' }

  // 2. Rol SUPERADMIN (único permiso)
  const role = (session.user as { role?: string }).role
  if (role !== 'SUPERADMIN') {
    return { ok: false, code: 'FORBIDDEN', error: 'Se requiere rol SUPERADMIN' }
  }

  // 3. Validación Zod
  if (!Array.isArray(args.companyIds) || args.companyIds.length === 0) {
    return { ok: false, code: 'INVALID_INPUT', error: 'IDs requeridos' }
  }
  if (args.companyIds.length > 100) {
    return { ok: false, code: 'INVALID_INPUT', error: 'Máximo 100 por operación' }
  }

  // 4. Servicio con transacción
  const result = await CompanyService.deleteCompanies({
    companyIds: args.companyIds,
    actorUserId: (session.user as { id: string }).id,
    reason: args.reason,
  })

  if (result.ok) {
    revalidatePath('/companies')
  }
  return result
}
```

### 4.2 `CompanyService.deleteCompanies`

```ts
// src/services/company.service.ts
export async function deleteCompanies(args: {
  companyIds: string[]
  actorUserId: string
  reason?: string
}) {
  // 1. Captura nombres previos para audit
  const companies = await prisma.company.findMany({
    where: { id: { in: args.companyIds } },
    select: { id: true, name: true }
  })
  if (companies.length === 0) {
    return { ok: false, code: 'NOT_FOUND', error: 'No se encontraron empresas' }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. CompanySellerHistory
      await tx.companySellerHistory.deleteMany({
        where: { companyId: { in: args.companyIds } }
      })
      // 2. CompanySelfRegistration (origen + target)
      await tx.companySelfRegistration.deleteMany({
        where: {
          OR: [
            { companyId: { in: args.companyIds } },
            { targetCompanyId: { in: args.companyIds } }
          ]
        }
      })
      // 3. allowedBranches M2M
      for (const id of args.companyIds) {
        await tx.company.update({
          where: { id },
          data: { allowedBranches: { set: [] } }
        })
      }
      // 4. User.companyId = null
      await tx.user.updateMany({
        where: { companyId: { in: args.companyIds } },
        data: { companyId: null }
      })
      // 5. JobPosition.companyId = null
      await tx.jobPosition.updateMany({
        where: { companyId: { in: args.companyIds } },
        data: { companyId: null }
      })
      // 6. MedicalProfile.companyId = null
      await tx.medicalProfile.updateMany({
        where: { companyId: { in: args.companyIds } },
        data: { companyId: null }
      })
      // 7. Worker.companyId = null
      await tx.worker.updateMany({
        where: { companyId: { in: args.companyIds } },
        data: { companyId: null }
      })
      // 8. Appointment.companyId = null
      await tx.appointment.updateMany({
        where: { companyId: { in: args.companyIds } },
        data: { companyId: null }
      })
      // 9. MedicalEvent.billingCompanyId = null
      await tx.medicalEvent.updateMany({
        where: { billingCompanyId: { in: args.companyIds } },
        data: { billingCompanyId: null }
      })
      // 10. Project.companyId = null
      await tx.project.updateMany({
        where: { companyId: { in: args.companyIds } },
        data: { companyId: null }
      })
      // 11. LabOrder.companyId = null
      await tx.labOrder.updateMany({
        where: { companyId: { in: args.companyIds } },
        data: { companyId: null }
      })
      // 12. Default branch FK release (defaultBranchId = null)
      await tx.company.updateMany({
        where: { id: { in: args.companyIds } },
        data: { defaultBranchId: null }
      })
      // 13. Delete Company
      await tx.company.deleteMany({
        where: { id: { in: args.companyIds } }
      })
      // 14. Audit log
      await tx.auditLog.create({
        data: {
          userId: args.actorUserId,
          action: 'COMPANIES_HARD_DELETE',
          entity: 'Company',
          entityId: args.companyIds.join(','),
          details: {
            deletedCompanyIds: args.companyIds,
            deletedCompanyNames: companies.map((c) => c.name),
            companyCount: companies.length,
            reason: args.reason ?? null,
          }
        }
      })
    })
    return { ok: true, deletedCount: companies.length }
  } catch (err) {
    console.error('[deleteCompanies] failed:', err)
    return { ok: false, code: 'INTERNAL_ERROR', error: (err as Error).message }
  }
}
```

## 5. UI

### 5.1 Página `/companies` — multi-select

Convertir la grilla actual de tarjetas (`CompanyCard`) en una grilla seleccionable:

- Cada tarjeta incluye un **checkbox** en la esquina superior izquierda (junto al emoji 🏢).
- Estado de selección se mantiene en `useState<Set<string>>` local del componente cliente.
- Header muestra contador: "N empresas seleccionadas".
- Cuando hay >= 1 selección, aparece una **barra flotante** (sticky bottom) con:
  - Texto: "N seleccionadas"
  - Botón rojo: "🗑 Eliminar"
  - Botón secundario: "Cancelar"

Si el usuario no es `SUPERADMIN`, los checkboxes se ocultan completamente (no se renderizan). Los `ADMIN`/`VENDEDOR`/`COMPANY_CLIENT` no ven la opción.

### 5.2 Modal de confirmación

Al hacer click en "Eliminar" se abre un modal controlado:

- **Título:** "Eliminar N empresas"
- **Lista:** nombres + RFCs de las empresas a eliminar (scrollable si > 5)
- **Advertencia** (rojo): "⚠️ Esta acción es IRREVERSIBLE. Se eliminarán las empresas y se desvincularán sus workers, appointments, projects, etc."
- **Input opcional:** "Razón de la eliminación (opcional, se registra en audit)"
- **Checkbox obligatorio:** "Entiendo que esto es irreversible y no se puede deshacer." — bloquea el botón rojo hasta marcarse.
- **Botón rojo:** "Eliminar N empresas"
- **Botón secundario:** "Cancelar"

### 5.3 Estructura de archivos

```
frontend/src/
  app/
    companies/
      page.tsx                                 (modificado — convierte a client-component solo la sección de grilla)
  components/
    companies/
      CompanySelectableGrid.tsx                (NUEVO — client-component con checkboxes y useState)
      DeleteCompaniesButton.tsx                (NUEVO — barra flotante + modal)
  actions/
    company.actions.ts                         (modificado — añade deleteCompaniesAction)
  services/
    company.service.ts                         (modificado — añade deleteCompanies)
  prisma/
    schema.prisma                              (modificado — añade SUPERADMIN al enum + vuelve nullable Appointment.companyId, JobPosition.companyId, Project.companyId)
    migrations/
      20260730000000_add_superadmin_role/      (NUEVO)
        migration.sql                           (ALTER TYPE UserRole ADD VALUE SUPERADMIN + ALTER TABLE appointments/job_positions/projects ALTER COLUMN companyId DROP NOT NULL)
backend/
  prisma/
    schema.prisma                              (modificado — espejo del frontend, debe quedar idéntico)
  types/
    next-auth.d.ts                             (sin cambios — UserRole ya viene de Prisma)
```

> **Schema espejo:** `backend/prisma/schema.prisma` es copia de `frontend/prisma/schema.prisma`. Modifica ambos con los mismos cambios.

> Nota: `/companies/page.tsx` ya es server-component. La grilla de tarjetas se debe extraer a un nuevo client-component `CompanySelectableGrid.tsx` para poder usar `useState`.

## 6. Seguridad

| Capa | Mecanismo |
|------|-----------|
| **1. UI** | Checkbox rojo deshabilitado hasta confirmar |
| **2. Server action** | `getServerSession()` + chequeo `role === 'SUPERADMIN'` |
| **3. Service** | Validación de array no vacío + max 100 + transacción atómica |
| **4. Audit** | `AuditLog` con `userId`, `entityId`, `details` |
| **5. Idempotencia** | `deleteMany` con `id IN [...]` es seguro de re-ejecutar (no falla en vacíos) |

## 7. Riesgos y edge cases

1. **Eliminación masiva accidental de DB productiva**: El checkbox de confirmación + el rol SUPERADMIN son la única barrera. Se probará manualmente con empresa de prueba.
2. **Race condition** entre el listado y la eliminación: poco probable (rol único SELECT-DELETE), pero el `revalidatePath` puede no refrescar la lista si la página está cacheada. Se usa `dynamic = 'force-dynamic'` ya presente.
3. **FKs no contempladas**: Si en el futuro se añaden nuevas tablas con FK a Company, la transacción fallará con error claro. Se documenta en `console.error`.
4. **Workers huérfanos**: workers quedan sin empresa (companyId=null). Esto es intencional — el historial clínico del trabajador se preserva.
5. **Self-registration duplicada**: dos `CompanySelfRegistration` apuntando a la misma empresa (campo `targetCompanyId`); la query `OR` los borra.

## 8. Plan de pruebas

### 8.1 Vitest unit

- `deleteCompanies` con companyIds vacíos → `INVALID_INPUT`
- `deleteCompanies` con 101 ids → `INVALID_INPUT`
- `deleteCompanies` con session.SUPERADMIN → `ok: true`, `deletedCount=N`, cascade aplicada
- Verifica que `AuditLog` se creó con `action='COMPANIES_HARD_DELETE'`
- Verifica que `Worker.companyId` quedó en null
- Verifica que `Appointment.companyId` quedó en null

### 8.2 Vitest componente

> **NOTA sobre Vitest:** El proyecto usa `environment: 'node'` en `vitest.config.ts` y NO tiene `jsdom` ni `@testing-library/react` instalado. Por simplicidad del baseline actual, este SPEC **NO requiere tests de componente** para la primera entrega. La UI se valida manualmente con Frank en staging. Si Frank en el futuro quiere tests de UI, abrirá un `IMPL-XXXX-XX-ADD-JSDOM-VITEST` separado.

- Los componentes cliente (`CompanySelectableGrid`, `DeleteCompaniesButton`) se verificarán manualmente.
- Validación con typecheck estricto + smoke test manual.

### 8.3 Manual (Frank)

- Crear 2 empresas de prueba
- Asignar 1 SUPERADMIN manualmente en BD (o seed)
- Login SUPERADMIN → /companies → seleccionar 2 → modal → confirmar
- Verificar que las 2 empresas desaparecen
- Verificar `SELECT * FROM "AuditLog" WHERE action='COMPANIES_HARD_DELETE';`

## 9. Definition of Done

- [ ] Migración `20260730000000_add_superadmin_role` aplicada en Railway.
- [ ] `pnpm typecheck` → 0 errores.
- [ ] `pnpm test` → todos verde (incluidos nuevos tests).
- [ ] `pnpm lint` → 0 errores.
- [ ] Smoke test manual en staging con una empresa de prueba.
- [ ] GEMINI revisión final (subagent_type='gemini') sin bloqueadores.
- [ ] Commit + push a `main` espera confirmación explícita de Frank.

## 10. Acciones manuales posteriores (Frank)

Una vez mergeado, Frank debe:
1. Ejecutar `UPDATE users SET role = 'SUPERADMIN' WHERE email = 'admin@sistema.com';` (o el usuario de su elección) en Railway.
2. Verificar login con ese usuario y que el botón aparece.
3. Realizar un smoke test de eliminación con una empresa de prueba.

> **Nota CRÍTICA:** No aplicar `UPDATE users SET role = 'SUPERADMIN'` a todos los ADMIN existentes. Eso es decisión de Frank.

## 11. NO HACER

- No commitear, pushear ni hacer PR sin OK explícito de Frank.
- No aplicar la migración a Railway sin OK de Frank.
- No usar `qodo` (sunset, usar GEMINI).
- No eliminar la tabla `companies` ni hacer DROP directo.
- No exponer el endpoint a roles distintos a SUPERADMIN.

## 12. Notas operativas para el agente implementador

- **pnpm:** en este entorno `pnpm` no está en PATH. Usar `corepack pnpm` (verificado: `corepack pnpm --version` → `11.13.0`).
- **Baseline:** `frontend/pnpm-workspace.yaml` tiene placeholders en `allowBuilds`. Si bloquea la instalación, **NO modificar el yaml** — escalar como IMPL separado. La instalación previa de `node_modules/` persiste; `typecheck`/`test`/`lint` deberían poder ejecutarse aunque `pnpm install` falle.
- **No aplicar la migración ni hacer commit** — Frank lo hace manualmente.
