# SPEC ARCH-20260730-01 — Módulo Sucursales Completo (CRUD + Configurar)

**ID:** ARCH-20260730-01
**Fecha:** 2026-07-30
**Autor:** INTEGRA (Muse Spark 1.1)
**Estado:** DRAFT — pendiente OK Frank (ask-frank.sh enviado 2026-07-30 21:45 CEST, sin respuesta, timeout)
**Origen:** ATLAS M3 reportó `/branches` con botón "Configurar" sin handler y CRUD incompleto
**Raíz verificada:** `frontend/` (Next.js 16.1.6 App Router, TS, Prisma, PostgreSQL)
**Baseline:** `src/app/branches/page.tsx` 115 líneas, `src/actions/admin.actions.ts` 97-125 solo `getBranches`+`createBranch`

---

## 1. Resumen

Completar módulo Sucursales para que "Configurar" sea funcional. Alcance: esquema + actions con Zod server-side + UI lista + detalle/edición + desactivación segura + asignación a empresas (vía `allowedBranches` existente). Sin hard-codear tenant.

## 2. Contexto técnico (evidencia leída)

### Modelo actual `Branch` (prisma/schema.prisma:90-112)
```
id uuid, name string, address string?, phone string?, managerName string?,
tenantId fk Tenant, hourlyCapacity Int default 15,
openingTime String default "07:00", closingTime "17:00",
createdAt, updatedAt,
relations: appointments[], companies[] (defaultBranch inverse), allowedByCompanies M2M, events[], workers[], projects[]
```
- No tiene `isActive`, `enabledAt`, `defaultCompanyId`.
- `tenantId` obligatorio, `getBranches()` filtra por primer `Tenant` (anti-pattern pero vigente).
- `Appointment.branchId` NOT NULL (obligatorio), `MedicalEvent.branchId` NOT NULL, `Worker.branchId` nullable, `Project.branchId` nullable.

### Dependientes que romperían si se borra
- `appointment.actions.ts:166` filtro `branchId`
- `project.actions.ts:90-92` include branch
- `medical-event.service.ts:18,36` include branch
- `company.service.ts` usa `defaultBranch` + `allowedBranches`
- E2E `tests/flujo-completo.spec.ts` usa `select[name="branchId"]` en appointmentForm.

### UI actual
- `src/app/branches/page.tsx` es Server Component que lista `BranchCard`.
- Modal creación con peer-checkbox CSS hack (`input#new-branch-modal`).
- `BranchCard` botón `<button>Configurar</button>` sin `onClick`, sin `href`.

## 3. Decisiones arquitectónicas (resuelven ambigüedades §PROBLEMA)

> Todas marcadas [PROPUESTA] hasta OK explícito de Frank. Razonamiento basado en evidencia, no inferencia libre.

### 3.1 Tenant vs Company — [PROPUESTA A] Tenant-wide compartida
**Evidencia:**
- Schema: `Branch` tiene `tenantId`, NO `companyId`. `Company` tiene `allowedBranches` M2M + `defaultBranchId`. Esto modela pool compartido tenant-wide.
- `getBranches()` actual ya implementa tenant-wide.
- Cambiar a company-specific requeriría migración breaking (añadir `companyId` + backfill + borrar M2M) y rompería `Project.branchId` opcional.

**Decisión propuesta:**
- Mantener **tenant-wide** como fuente de verdad. `Company.allowedBranches` controla visibilidad por empresa.
- `getBranches()` debe evolucionar a `getBranches({ includeInactive?, companyId? })` filtrando por tenant actual (helper `getCurrentTenant()` = first tenant por ahora, TODO multi-tenant futuro).
- Documentar en DoR: si Frank quiere company-specific más adelante, se haría como `Branch.scope = TENANT | COMPANY` o tabla `BranchCompanyPolicy`, no rompiendo existente.

### 3.2 Alcance de "Configurar" — [PROPUESTA A] 2 fases
**Fase 1 — MVP (esta SPEC):**
- Editar datos básicos: `name, address, phone, managerName`.
- Editar operativos: `openingTime, closingTime, hourlyCapacity`.
- Ver métricas de uso: conteo de `appointments` (últimos 30d), `events`, `workers`, `projects`, `allowedByCompanies`.
- Toggle activo/inactivo (soft disable).
- Asignación rápida de empresas permitidas (lista `allowedByCompanies` editable, reutiliza `updateCompanyAllowedBranches` inverso).

**Fase 2 — opcional (fuera de MVP, PROYECTO.md BACKLOG):**
- Usuarios asignados por sucursal (si se añade `User.branchId` M2M).
- Unidades móviles por sucursal (ya `MobileUnit` existe pero sin `branchId`).
- Horarios especiales / feriados (nueva tabla `BranchSpecialSchedule`).

**Rationale:** El usuario dijo "no puedo configurarla" refiriéndose al botón muerto. El fix mínimo que desbloquea es editar básicos+horarios. Asignación de empresas ya existe en `/companies` pero conviene espejarlo en `/branches/[id]` para UX.

### 3.3 Eliminación — [PROPUESTA A] Soft-disable + hard delete bloqueado si tiene dependencias
**Evidencia:**
- `Appointment.branchId` y `MedicalEvent.branchId` son NOT NULL con FK restrict. Hard delete fallaría en BD.
- Patrón existente `Company.estado` con `HABILITADO/DESHABILITADO` y `enabledAt` sugiere preferencia por soft.
- IMPL-20260730-01 (empresas) introdujo `companyId nullable` en `Appointment/Project/JobPosition` para preservar historia clínica tras hard delete con justificación SUPERADMIN. No se quiere repetir ese costo para Branch.

**Decisión propuesta:**
- Añadir campo `isActive Boolean @default(true)` (+ `@map` + índice) a `Branch`. Opcional `disabledAt DateTime?` + `disabledByUserId`.
- Action `toggleBranchActiveAction(branchId, isActive)` → soft disable/enable, solo ADMIN_LIKE (isAdminLike).
- Action `deleteBranchAction(branchId)` → hard delete SOLO si:
  - `isActive = false` **y**
  - `count(appointments)=0 && count(events)=0 && count(workers where branchId=branchId)=0 && count(projects where branchId=branchId)=0 && count(allowedByCompanies)=0 && count(companies where defaultBranchId=branchId)=0`
  - RBAC: solo ADMIN_LIKE, opcional SUPERADMIN si Frank quiere.
  - Si tiene dependencias → retornar `code: 'HAS_DEPENDENCIES'` con detalle de conteos, UI muestra "Desactiva primero..."

Esto preserva integridad sin migraciones nullables masivas.

## 4. Modelo de datos propuesto (delta)

### 4.1 Migración Prisma
```prisma
model Branch {
  // existentes...
  isActive      Boolean  @default(true)
  disabledAt    DateTime?
  disabledByUserId String?
  disabledBy    User? @relation("BranchDisabledBy", fields: [disabledByUserId], references: [id])
  // índices
  @@index([tenantId, isActive])
  @@index([name])
}
model User {
  // añadir
  disabledBranches Branch[] @relation("BranchDisabledBy")
}
```

Alternativa mínima si se quiere evitar relación User: solo `isActive + disabledAt`.

No se añade `companyId` a Branch en esta fase.

### 4.2 Decisiones de migración
- Migration name: `20260730000001_add_branch_is_active` o siguiente timestamp.
- Debe aplicarse en Railway vía `npx prisma migrate deploy` (helper existente `scripts/sync-prisma-migrations.ts`).
- Backfill: todas existentes `isActive=true`.

## 5. Contratos de actions (server actions, `src/actions/branch.actions.ts` nuevo)

Separar de `admin.actions.ts` para no mezclar concerns. `admin.actions.ts` queda como fachada re-exportando o deprecated.

### 5.1 `getBranches(filters?)`
- Input: `{ includeInactive?: boolean (default false), search?: string, companyId?: string }`
- Auth: `requireSession()` (cualquier rol autenticado puede listar; FE ya es solo ADMIN).
- Logic: resolve `tenant = await prisma.tenant.findFirst()` (TODO centralizar en `lib/tenant.ts`), `where: { tenantId, ...(includeInactive?{}:{isActive:true}), ...(search?{name:{contains:search,mode:'insensitive'}}:{}), ...(companyId?{allowedByCompanies:{some:{id:companyId}}}:{}) }`, order `createdAt desc`.
- Output: `Branch[]` con `_count` de `appointments, events, workers, projects, allowedByCompanies, companies (default)`.
- Next.js 16: no params aquí.
- Revalidación: none.

### 5.2 `getBranchById(id)`
- Zod: `z.string().uuid()`.
- Incluye: `_count` + `allowedByCompanies: {id,name,rfc}` + `companies (defaultBranch inverse)` + `tenant`.
- Si no existe → `throw NotFound` o `{ok:false,code:'NOT_FOUND'}` (decidir convención; alineado con `company.actions` que retorna `{ok:false}`; proponer `{ok:boolean}` pattern).
- Auth: session required.

### 5.3 `createBranch(data: FormData | object)`
- Zod schema `branchCreateSchema`:
  - `name: z.string().min(2).max(100)`
  - `address: z.string().max(200).optional().or(z.literal(''))`
  - `phone: z.string().max(20).optional().or(z.literal('')).refine(phoneRegex)` (opcional)
  - `managerName: z.string().max(100).optional()`
  - `openingTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/)`
  - `closingTime: same`
  - refine `openingTime < closingTime`
  - `hourlyCapacity: z.coerce.number().int().min(1).max(100)` (100 = límite racional, configurable)
- Auth: `isAdminLike(role)` → FORBIDDEN si no.
- Logic: `tenant = first`, `prisma.branch.create({data:{... , tenantId}})`; `revalidatePath('/branches')`; audit log `CREATE Branch`.
- Output: `{ok:true, branch}` / `{ok:false,code,error}`.

### 5.4 `updateBranch(id, data)`
- Zod: `branchUpdateSchema = branchCreateSchema.partial()` + `expectedUpdatedAt?` opcional para optimistic locking (propuesto, paridad con `updateCompanyFull`).
- Auth: ADMIN_LIKE.
- Logic: find exists, check `isActive` (permitir editar incluso inactiva), opcional check `updatedAt` match if `expectedUpdatedAt` provided, update, `revalidatePath('/branches')` + `/branches/${id}`, audit `UPDATE` con diff.
- Validation extra: si `name` cambia, check unique per tenant? Propuesto `where:{tenantId, name}` uniqueness en lógica (no constraint DB única global para permitir homónimos entre tenants futuros).

### 5.5 `toggleBranchActiveAction(id, isActive)`
- Input `id uuid`, `isActive boolean`.
- Auth ADMIN_LIKE.
- Logic: if disabling → set `isActive=false, disabledAt=now(), disabledByUserId=session.user.id`; if enabling → `isActive=true, disabledAt=null, disabledByUserId=null`.
- Guard: si `isActive=false` y `branch` es `defaultBranch` de alguna company que está `HABILITADO`, permitir pero advertir (no bloquear). UI muestra warning.
- Revalidate.

### 5.6 `deleteBranchAction(id)`
- Auth ADMIN_LIKE (o SUPERADMIN si Frank elige opción más estricta).
- Logic: transaction:
  1. `prisma.branch.findUnique({include:{_count:{select:{appointments:true, events:true, workers:true, projects:true, allowedByCompanies:true, companies:true}}}})`
  2. Si any count >0 → return `{ok:false, code:'HAS_DEPENDENCIES', details:counts}`
  3. Si `isActive=true` → return `{ok:false, code:'MUST_DISABLE_FIRST'}`
  4. `prisma.branch.delete({where:{id}})`
  5. `revalidatePath('/branches')`, audit `DELETE`.
- Output `{ok:true}` | error.

### 5.7 `updateBranchAllowedCompanies(branchId, companyIds[])`
- Inverso de `updateCompanyAllowedBranches`.
- Zod: `companyIds: z.array(z.string().uuid()).max(200)` (límite racional).
- Auth ADMIN_LIKE.
- Logic: `prisma.branch.update({where:{id:branchId}, data:{allowedByCompanies:{set: companyIds.map(id=>({id}))}}})`, revalidate both `/branches` and `/companies`.

### 5.8 `getBranchUsageStats(branchId)` (helper read-only para UI)
- Returns counts by last 30d appointments, events last 30d, workers total, projects total.
- No mutation.

## 6. Validaciones Zod (server-side obligatorias)

Crear `src/lib/schemas/branch.ts`:
- `timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/`
- `phoneRegex` laxa: `/^[+\d\s()-]{7,20}$/`
- `branchCreateSchema` como arriba.
- `branchUpdateSchema = branchCreateSchema.partial().extend({expectedUpdatedAt: z.string().datetime().optional()})`
- Tests unitarios en `src/lib/schemas/__tests__/branch.test.ts` (paridad con `company-update.test.ts` existente).

## 7. Rutas UI (Next.js 16.1.6 App Router)

### 7.1 `/branches` lista (refactor de `page.tsx` existente)
- Convertir `BranchCard` a componente cliente `BranchCardClient` que recibe `branch` con `_count`.
- Botón "Configurar" → `<Link href={`/branches/${branch.id}`}>` (no botón muerto).
- Mantener modal "Nueva Sucursal" pero migrar de peer-checkbox hack a `Dialog` o `Client Component` con `useState` (paridad con `CompanyFormModal`).
- Filtro: `?includeInactive=true` (searchParams es Promise en Next 16 → `await searchParams`).
- Badges: Activa/Inactiva + conteos.
- Acción rápida: toggle activo/inactivo desde lista (solo ADMIN).

### 7.2 `/branches/[id]/page.tsx` — detalle + configuración
- **Next 16 compat:** `params` es Promise: `const {id} = await params`.
- Server component que llama `getBranchById(id)`.
- Si no existe → `notFound()` o UI error (no fail silente).
- Tabs:
  - **General** (editable): `BranchEditForm` (client component) con Zod client-side (UX) + server action `updateBranch`.
  - **Operación**: horarios, capacity, toggle activo, delete guardado.
  - **Empresas**: lista `allowedByCompanies` + `companies (defaultBranch)` + selector multi para asignar (usa `updateBranchAllowedCompanies`).
  - **Uso**: stats de `appointments/events/workers/projects` (últimos 30d).
- Header con breadcrumb `<Link href="/branches">← Sucursales</Link>`.
- Audit: mostrar `createdAt`, `updatedAt`, `disabledAt`.

### 7.3 `/branches/[id]/edit` (opcional, si se quiere ruta separada)
- Alternativa: editar inline en detalle. Propuesta: **no crear ruta extra**, usar form en tab General de detalle para reducir duplicación.

### 7.4 Componentes nuevos (src/app/branches/_components/ o src/components/branches/)
- `BranchCard.tsx` (presentacional)
- `BranchFormModal.tsx` (create + edit reutilizable)
- `BranchEditForm.tsx` (client, con `react-hook-form + zodResolver`)
- `BranchDeleteGuardModal.tsx` (muestra conteos dependencias, confirma desactivar primero)
- `BranchCompanyAssignment.tsx` (multi-select de empresas)
- `BranchStatusBadge.tsx`

### 7.5 Permisos UI
- Lista visible para ADMIN, RECEPTIONIST, VENDEDOR? Actual `page.tsx` no tiene guard. Propuesta: `requireAdminOrReceptionist()` para lista, ADMIN_LIKE para mutate (paridad con `project.actions.ts`).
- Botones mutantes ocultos si `!isAdminLike`.

## 8. Seguridad & Auditoría

- Todas actions con `getServerSession(authOptions)` + `isAdminLike` para mutate.
- Zod server-side obligatorio (no confiar en client).
- `logAudit` en `CREATE/UPDATE/DELETE/TOGGLE` con `userId`, `branchId`, `details: {before, after, counts}`.
- No `console.log` de objetos completos en prod (usar `id`).
- No `dangerouslySetInnerHTML`.
- Rated limit? Fuera de alcance MVP.

## 9. Validaciones disponibles y gates

- `pnpm typecheck` (0 errores esperado)
- `pnpm test` (vitest) — añadir tests para `branch.actions` y schemas
- `pnpm lint`
- `pnpm build` local (Next 16)
- Manual: probar `/branches` lista, crear, configurar, toggle, intentar borrar con dependencias (debe bloquear), borrar sin dependencias (debe permitir tras desactivar).

## 10. Plan de implementación derivable a SOFIA (orden de PRs)

> WIP=1 por PR, sin preguntar al humano para delegar (IDL §4.5). Cada PR con SPEC corta refenciando este doc + validación detectable.

### PR-1 — Schema + Zod + Actions base (estimado 2-3h)
- **Objetivo:** Añadir `isActive`, `disabledAt`, `disabledByUserId` + migración + `branch.actions.ts` con `getBranches`, `getBranchById`, `createBranch`, `updateBranch`, `toggleBranchActive`, `deleteBranch` + Zod schemas.
- **Archivos:** `prisma/schema.prisma`, `prisma/migrations/...`, `src/lib/schemas/branch.ts`, `src/actions/branch.actions.ts`, `src/lib/tenant.ts` (helper `getCurrentTenantId()`), `src/lib/auth/roles.ts` (reusa isAdminLike).
- **Validaciones:** `pnpm prisma validate`, `typecheck`, `vitest` de schemas.
- **DoD:** Actions con `{ok,code}` y audit, Zod server-side, revalidatePath.

### PR-2 — UI Lista refactorizada + Fix botón Configurar (estimado 2h)
- **Objetivo:** `/branches/page.tsx` usa nuevas actions, `BranchCard` con Link a detalle, modal nueva sucursal con client state, toggle rápido.
- **Archivos:** `src/app/branches/page.tsx`, `src/app/branches/_components/BranchCard.tsx`, `BranchFormModal.tsx`, `BranchStatusBadge.tsx`.
- **Validaciones:** Build ok, lint, manual lista.
- **DoD:** Botón Configurar lleva a `/branches/[id]`, lista muestra activa/inactiva + counts, crear funciona con Zod.

### PR-3 — Detalle /branches/[id] + edición + asignación empresas (estimado 3-4h)
- **Objetivo:** Página detalle con tabs General/Operación/Empresas/Uso, formulario edición, asignación `allowedCompanies`.
- **Archivos:** `src/app/branches/[id]/page.tsx`, `_components/BranchEditForm.tsx`, `BranchCompanyAssignment.tsx`, `BranchDeleteGuardModal.tsx`, `src/actions/branch.actions.ts` (añadir `updateBranchAllowedCompanies`, `getBranchUsageStats`), `src/services/company.service.ts` (si falta list).
- **Compat:** `await params` obligatorio.
- **DoD:** Editar básicos/horarios/capacity funciona, toggle activo/inactivo, asignación empresas persiste, stats visibles, error state si id no existe.

### PR-4 — Delete guard + tests + E2E fix (estimado 2h)
- **Objetivo:** Implementar borrado bloqueado con conteos, tests unitarios, arreglar E2E selector `branchId`.
- **Archivos:** `src/actions/branch.actions.ts` (delete), `_components/BranchDeleteGuardModal.tsx`, `src/lib/schemas/__tests__/branch.test.ts`, `src/actions/__tests__/branch.actions.test.ts` (mock prisma), `tests/flujo-completo.spec.ts` (si necesita branchId dinámico de `getBranches`).
- **DoD:** No se puede borrar con dependencias (muestra conteos), se puede borrar tras desactivar + sin dependencias, tests verde, E2E no roto.

### PR Futuro (BACKLOG, fuera de esta SPEC)
- Horarios especiales (`BranchSpecialSchedule`), usuarios por sucursal, unidades móviles por sucursal, calendario de ocupación por sucursal (ya hay `hourlyCapacity` pero no `Appointment` schedule validation contra capacity).

## 11. Riesgos

- **R1 — Primer tenant hack:** `getBranches()` usa `findFirst()` sin order. Si hay >1 tenant, resultado indeterminado. Mitigación: crear helper `getCurrentTenant()` centralizado + log warning si >1.
- **R2 — Capacidad vs citas reales:** `hourlyCapacity` existe pero no se valida al crear `Appointment`. No introducir validación en este lote (sería breaking). Dejar TODO.
- **R3 — M2M CompanyAllowedBranches sin índice explícito:** Prisma lo maneja pero `set` masivo puede ser costoso. Limitar a 200 companies por branch en Zod.
- **R4 — UI peer-checkbox legacy:** Modal actual usa CSS hack que rompe accesibilidad. Migrar a Dialog controlado evita bugs focus trap.
- **R5 — Hard delete con FK:** Si se olvida bloqueo, migración puede fallar en prod. Mitigar con check `counts` + test que intente delete con dependencias y espere `HAS_DEPENDENCIES`.
- **R6 — Next 16 `params` Promise:** Si SOFIA olvida `await params`, build falla. Checklist en PR-3: verificar `await params` y `await searchParams`.

## 12. Archivos que se tocarán (estimado)

- `prisma/schema.prisma` (+ isActive)
- `prisma/migrations/20260730000001_add_branch_is_active/migration.sql`
- `src/lib/schemas/branch.ts` (nuevo)
- `src/lib/schemas/__tests__/branch.test.ts` (nuevo)
- `src/actions/branch.actions.ts` (nuevo, fachada limpia)
- `src/actions/admin.actions.ts` (opcional re-export deprecated, o mantener getBranches legacy)
- `src/app/branches/page.tsx` (refactor)
- `src/app/branches/[id]/page.tsx` (nuevo)
- `src/app/branches/_components/*` (nuevos)
- `src/lib/tenant.ts` (nuevo helper)
- `src/actions/__tests__/branch.actions.test.ts` (nuevo)
- `tests/flujo-completo.spec.ts` (posible ajuste selector branch)
- `src/lib/auth/roles.ts` (reuso, no cambios)
- `context/checkpoints/` + `context/audits/` si se hace baseline.

## 13. DoR y DoD para SOFIA

**DoR:**
- [x] ID ARCH-20260730-01
- [x] Resultado: Configurar funcional
- [x] SPEC esta ruta
- [x] Criterios verificables (ver §9 y PR DoD)
- [x] Dependencias: `prisma`, `@prisma/client`, `zod`, `next-auth`
- [x] Validación detectable: typecheck, vitest, lint, build, manual por tab
- [x] Sin decisiones bloqueantes — 3 propuestas marcadas pendiente OK pero no bloquean MVP (se implementa A por defecto, reversible con migración inversa).

**DoD:**
- [ ] Criterios aceptados con evidencia: lista, detalle, editar, toggle, delete bloqueado.
- [ ] Gates: typecheck 0, vitest verde, lint 0.
- [ ] Revisión SOFIA reportada.
- [ ] GEMINI segunda mano (no trivial) antes de DONE.
- [ ] PROYECTO.md con transición `READY→IN_PROGRESS→VERIFYING→DONE`.

## 14. Pregunta mínima al humano (estado 2026-07-30 21:45)

Se envió vía `ask-frank.sh` con ID ARCH-20260730-01:
1. Tenant-wide vs Company-specific → propuesta Tenant-wide (evidencia schema).
2. Alcance Configurar → propuesta datos básicos+horarios+empresas permitidas (Fase 1), resto BACKLOG.
3. Eliminación → propuesta soft-disable + hard delete solo sin dependencias + tras desactivar.

Frank aún no responde (gateway activo, sesión ausente probable). Se avanza con propuesta A para no bloquear, reversible.

---

## ANEXO — Interfaces TypeScript propuestas (pseudocódigo, no código productivo)

```ts
type BranchWithCounts = Branch & {
  _count: {
    appointments:number; events:number; workers:number;
    projects:number; allowedByCompanies:number; companies:number;
  }
}
type BranchDetail = Branch & {
  allowedByCompanies: {id:string; name:string; rfc:string|null}[];
  companies: {id:string; name:string}[]; // defaultBranch inverse
  _count: ...
}
```

## ANEXO — Ejemplo Zod (pseudocódigo)

```
branchCreateSchema = {
  name: string 2-100,
  address?: string max200,
  phone?: string regex phone,
  managerName?: string max100,
  openingTime: timeRegex,
  closingTime: timeRegex,
  hourlyCapacity: int 1-100
} refine opening<closing
```
