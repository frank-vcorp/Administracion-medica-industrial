# SPEC ARCH-20260624-03 — Gestión de datos completos de empresa: link externo + edición interna

**ID:** ARCH-20260624-03
**Fecha:** 2026-06-24
**Tipo:** FEATURE
**Prereq:** ARCH-20260624-02 (link auto-alta con URL pública + `?ref=`, ya mergeado en `main`)

---

## 1. Contexto

El flujo de auto-alta actual (`ARCH-20260624-01`) solo cubre el caso **"prospecto nuevo se da de alta como empresa"**. Después del fix `ARCH-20260624-02` el link es funcional y trazable, pero falta resolver dos casos de uso reales reportados por el humano:

### Caso A — Empresas dadas de alta de forma manual antes de iniciar operaciones
Una empresa se registra manualmente (sin auto-alta) con datos mínimos (`name`, `rfc?`, `contactName?`). Con el tiempo, antes o al iniciar operaciones, necesita completar su ficha fiscal completa, datos de representante legal, RH, cuentas por pagar, referencias, etc. → debe poder hacerlo por **auto-servicio** vía link temporal generado por un vendedor/admin.

### Caso B — Edición interna por staff autorizado
El usuario reporta explícitamente: *"también deben poder modificarse los datos en el sistema por usuarios con el rol adecuado"*. ADMIN (validado con humano) debe poder editar datos completos desde la ficha `/companies/[id]` sin generar link externo.

Ambas vías coexisten y comparten el mismo modelo de datos (`Company.fiscalData`, `repLegalData`, etc., ya existentes en Prisma).

---

## 2. Decisiones validadas con el humano

| Pregunta | Respuesta |
|---|---|
| ¿Quién edita datos internos? | **Solo ADMIN** |
| ¿VENDEDOR qué puede hacer? | Solo generar links externos (auto-servicio de la empresa); no editar directamente |
| ¿Nivel de auditoría? | **Completa**: snapshot before/after de TODOS los campos editables (reusando `AuditLog` existente con `entity='Company'`) |

---

## 3. Cambios en modelo de datos

### 3.1 Migración Prisma

Añadir a `CompanySelfRegistration`:

```prisma
model CompanySelfRegistration {
  id                 String              @id @default(uuid())
  tokenHash          String              @unique
  channel            String?             @default("VENDOR_LINK")
  // 'VENDOR_LINK' | 'PUBLIC_DIRECT' | 'COMPANY_UPDATE' (NUEVO)
  targetCompanyId    String?             // NUEVO: FK opcional a Company
  targetCompany      Company?            @relation("CompanySelfRegTarget", fields: [targetCompanyId], references: [id])
  companyDraft       Json?
  uploadedFiles      Json                @default("[]")
  status             CompanySelfRegStatus @default(ACTIVE)
  expiresAt          DateTime
  openedCount        Int                 @default(0)
  submittedAt        DateTime?
  submittedCompanyId String?             @unique
  createdByUserId    String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  submittedCompany Company? @relation(fields: [submittedCompanyId], references: [id])
  createdBy        User?    @relation(fields: [createdByUserId], references: [id])

  @@index([targetCompanyId])  // NUEVO
  @@map("company_self_registrations")
}
```

Y en `Company` añadir la relación inversa:

```prisma
model Company {
  // ... campos existentes ...
  targetSelfRegistrations CompanySelfRegistration[] @relation("CompanySelfRegTarget")
  selfRegistrations      CompanySelfRegistration[]
  // ...
}
```

**Nota**: NO se crea tabla `CompanyAuditLog` nueva. Se reusa `AuditLog` (ya existe en el schema, línea 399) con:
- `entity = 'Company'`
- `action = 'UPDATE' | 'CREATE' | 'UPDATE_VIA_LINK'`
- `entityId = <companyId>`
- `details = { before: {...}, after: {...}, changes: [...] }`

### 3.2 Esquema Zod para update

`frontend/src/lib/schemas/company-update.ts` (NUEVO):
- `updateCompanySchema` con todos los campos editables del `Company` + sub-objetos (`fiscalData`, `repLegalData`, etc.)
- Validación por sección: `updateFiscalSchema`, `updateRepLegalSchema`, etc.
- Validación de RFC con el helper existente `assertRfcNotRegistered` (adaptado para update: solo verifica que no choque con OTRA Company)

---

## 4. Plan de implementación (dos sub-pasos ejecutables)

### Sub-paso A — Link externo "Completar datos completos"

#### Cambios en service `frontend/src/services/company.service.ts`

`generateCompanySelfRegLink` (línea 124) — nueva firma:

```ts
export async function generateCompanySelfRegLink(
  createdByUserId?: string | null,
  options?: {
    ttlHours?: number
    targetCompanyId?: string  // NUEVO
  }
): Promise<{...}>
```

Si `targetCompanyId` se pasa:
- Validar que la Company existe y NO está en estado `PENDIENTE_REVISION` (no debe tener auto-alta en curso)
- Validar que el usuario emisor es ADMIN o VENDEDOR
- `channel = 'COMPANY_UPDATE'`
- `targetCompanyId` se persiste en BD

`submitCompanySelfRegistrationCore` (línea 218) — nueva rama:

Si `reg.targetCompanyId` existe:
- Leer `Company` actual (snapshot para auditoría)
- Hacer `prisma.company.update({ where: { id: reg.targetCompanyId }, data: {...} })` en vez de `create`
- Validar concurrencia con optimistic locking: si `Company.updatedAt` cambió desde que el prospecto abrió el form → `409 CONFLICT`
- Crear `AuditLog` con `action='UPDATE_VIA_LINK'`, `details={ before, after, changes }`
- Marcar `CompanySelfRegistration.status = 'SUBMITTED'`, `submittedCompanyId = reg.targetCompanyId`

#### Cambios en action `frontend/src/actions/company.actions.ts`

Nueva action `generateCompanyDataCompletionLinkAction(companyId: string)`:
- Valida sesión ADMIN o VENDEDOR
- Valida que la Company existe y está en estado `HABILITADO` (no `PENDIENTE_REVISION`)
- Llama `CompanyService.generateCompanySelfRegLink(userId, { targetCompanyId: companyId })`
- Retorna `{ url, expiresAt }`

#### Cambios en UI `frontend/src/components/CompanyFormModal.tsx`

Nuevo botón visible solo cuando:
- El modal está en **modo edición** (`mode='edit'`, hay `existingCompany`)
- El usuario es ADMIN o VENDEDOR
- La Company NO está en `PENDIENTE_REVISION`

Botón: **"🔗 Generar link para que la empresa complete sus datos"**
Acción: invoca `generateCompanyDataCompletionLinkAction`, muestra modal con URL + `?ref=<userId>` + mensaje "Este enlace es válido por 168 horas y permite a la empresa completar o actualizar su información. Comparte el enlace de forma segura."

### Sub-paso B — Edición interna desde ficha

#### Nueva ruta `frontend/src/app/companies/[id]/edit/page.tsx`

- Página server component con `await params` (Next.js 16)
- Carga Company con `getCompanyById(id)`
- Verifica RBAC: solo ADMIN (rechaza con redirect a `/companies/[id]` si no)
- Renderiza `CompanyEditForm` con datos pre-llenados

#### Nueva action `updateCompanyAction(id: string, data: unknown)`

- Valida sesión y rol ADMIN
- Valida `updateCompanySchema`
- Optimistic locking: requiere `expectedUpdatedAt` para detectar ediciones concurrentes
- Si RFC cambió: valida unicidad contra OTRAS Company
- Transacción: snapshot before → `company.update` → `auditLog.create` con diff
- Si todo OK: `revalidatePath('/companies/[id]')`
- Si hay conflicto: retorna `{ ok: false, code: 'CONCURRENT_UPDATE' }`

#### Nuevo componente `frontend/src/components/companies/CompanyEditForm.tsx`

- Formulario con secciones (tabs o acordeón):
  1. Datos básicos (`name`, `rfc`, `address`, `contactName`, `email`, `phone`)
  2. Datos fiscales (`fiscalData`)
  3. Representante legal (`repLegalData`)
  4. RH (`rhData`)
  5. Cuentas por pagar (`cuentasPagarData`)
  6. Referencias (`referenciasData`)
- Botón "Guardar cambios" con confirmación si hay campos críticos modificados (RFC, razón social)
- Manejo de errores con UI states claros
- Hidden field con `expectedUpdatedAt` para optimistic locking

#### Botón en ficha `/companies/[id]/page.tsx`

- Visible solo si `session.user.role === 'ADMIN'`
- Botón "✏️ Editar datos completos" que navega a `/companies/[id]/edit`

---

## 5. Concurrencia y reglas de negocio

| Escenario | Comportamiento |
|---|---|
| Staff edita + Link externo activo simultáneamente | Si el staff guarda primero, el link externo recibe `409 CONFLICT` al submit. La empresa debe reabrir el link para ver los datos actualizados. |
| Link externo abierto antes de edición interna | El form público carga datos actuales al abrir (`/auto-alta/[token]` resuelve `targetCompanyId` y pre-carga). Si edición interna ocurre después, el submit externo detecta drift por `updatedAt`. |
| Staff intenta editar Company en PENDIENTE_REVISION | UI bloquea el botón "Editar" y muestra: "Empresa con auto-alta en curso. Espere a que el prospecto complete el alta." |
| Link externo para Company en PENDIENTE_REVISION | UI bloquea el botón "Generar link". La empresa debe primero resolver su auto-alta pendiente. |
| Mismo link usado 2 veces (replay) | `CompanySelfRegistration.status = SUBMITTED` después del primer submit → segundo intento retorna `ALREADY_SUBMITTED` (mismo path que prospecto nuevo). |

---

## 6. Criterios de aceptación

### Sub-A (link externo)

| # | Criterio |
|---|---|
| CA-A1 | `generateCompanySelfRegLink(userId, { targetCompanyId })` persiste `targetCompanyId` y `channel='COMPANY_UPDATE'` |
| CA-A2 | `generateCompanyDataCompletionLinkAction(companyId)` valida rol ADMIN/VENDEDOR y estado `HABILITADO` |
| CA-A3 | Submit externo con `targetCompanyId` hace UPDATE, no CREATE |
| CA-A4 | Submit externo con `targetCompanyId` genera `AuditLog` con before/after completo |
| CA-A5 | Submit externo con `targetCompanyId` detecta drift por `updatedAt` y retorna `409 CONFLICT` |
| CA-A6 | UI muestra botón solo en modo edición + rol adecuado + estado `HABILITADO` |
| CA-A7 | URL retornado incluye `?ref=<userId>` (heredado de `ARCH-20260624-02`) |

### Sub-B (edición interna)

| # | Criterio |
|---|---|
| CA-B1 | Ruta `/companies/[id]/edit` solo accesible para ADMIN |
| CA-B2 | `updateCompanyAction` valida `expectedUpdatedAt` (optimistic locking) |
| CA-B3 | `updateCompanyAction` genera `AuditLog` con snapshot before/after completo |
| CA-B4 | Cambio de RFC valida unicidad contra otras Company |
| CA-B5 | UI muestra botón "Editar" solo a ADMIN |
| CA-B6 | Concurrencia: si staff A y staff B editan al mismo tiempo, el segundo recibe error claro |
| CA-B7 | `revalidatePath` correcto en ficha tras update |

### Generales

| # | Criterio |
|---|---|
| CA-G1 | `pnpm typecheck` ✅ |
| CA-G2 | `pnpm test` ✅ (con tests nuevos) |
| CA-G3 | `pnpm lint` sin errores nuevos |
| CA-G4 | Migración Prisma aplicada sin romper seed ni relaciones existentes |
| CA-G5 | GEMINI auditoría APROBADO antes de merge |

---

## 7. Archivos esperados

### Nuevos
- `frontend/src/lib/schemas/company-update.ts` (Zod schemas)
- `frontend/src/lib/schemas/company-update.test.ts`
- `frontend/src/app/companies/[id]/edit/page.tsx`
- `frontend/src/components/companies/CompanyEditForm.tsx`
- `frontend/prisma/migrations/20260624XX_add_target_company_id_to_self_reg/` (migración)

### Modificados
- `frontend/prisma/schema.prisma` (+`targetCompanyId`, +relación, +index)
- `frontend/src/services/company.service.ts` (nueva opción `targetCompanyId`, nueva rama en `submitCompanySelfRegistrationCore`, helper de auditoría)
- `frontend/src/actions/company.actions.ts` (nueva action `generateCompanyDataCompletionLinkAction`, nueva action `updateCompanyAction`)
- `frontend/src/components/CompanyFormModal.tsx` (nuevo botón + sub-modal de link)
- `frontend/src/app/companies/[id]/page.tsx` (botón "Editar datos")
- `frontend/src/services/__tests__/company.service.test.ts` (tests nuevos)
- `PROYECTO.md` (entrada diaria)

---

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migración Prisma rompe `channel` enum | `channel` es `String?`, no enum. Solo validación. Sin riesgo. |
| Concurrencia: staff edita mientras empresa envía link | Optimistic locking + UI clara. Empresa re-abre link. |
| AuditLog crece mucho con snapshots grandes de `fiscalData` | Snapshots solo si hay cambios reales (diff antes/después). Indexar por `(companyId, createdAt)`. |
| Cambio accidental de RFC rompedor | Validación de unicidad + alerta visual al usuario si está modificando RFC. |
| RBAC se aplica correctamente | Doble gate: middleware + validación en server action. Test E2E con sesión de VENDEDOR que intenta editar. |

---

## 9. Micro-sprint sugerido (orden de implementación)

1. **Migración Prisma** (5 min): añadir `targetCompanyId`, generar migración, aplicar local
2. **Schemas Zod** (30 min): `company-update.ts` con validación por sección
3. **Service — Sub-A** (1h): `generateCompanySelfRegLink` con target + `submitCompanySelfRegistrationCore` con rama UPDATE + AuditLog + optimistic locking
4. **Service — Sub-B** (1h): `updateCompanyAction` en `company.service.ts` + AuditLog
5. **Actions** (30 min): ambas actions nuevas en `company.actions.ts`
6. **UI — Sub-A** (1h): botón en `CompanyFormModal` + sub-modal de URL
7. **UI — Sub-B** (2h): ruta `/edit`, `CompanyEditForm`, botón en ficha
8. **Tests** (2h): unit + integration para ambos sub-pasos
9. **GEMINI auditoría** antes de merge
10. **Checkpoint de cierre**

**Estimación total: 1 sesión completa de 8h o 2 micro-sprints.**

---

## 10. Checklist de cierre para SOFIA

- [ ] Migración Prisma aplicada y commiteada
- [ ] Schemas Zod con tests
- [ ] Service `generateCompanySelfRegLink` con opción `targetCompanyId`
- [ ] Service `submitCompanySelfRegistrationCore` con rama UPDATE + AuditLog + optimistic locking
- [ ] Service `updateCompany` con optimistic locking + AuditLog
- [ ] Action `generateCompanyDataCompletionLinkAction`
- [ ] Action `updateCompanyAction`
- [ ] UI botón en `CompanyFormModal` (solo modo edición + RBAC + estado HABILITADO)
- [ ] UI ruta `/companies/[id]/edit` + `CompanyEditForm`
- [ ] UI botón "Editar" en ficha `/companies/[id]`
- [ ] Tests unitarios + integration para ambos sub-pasos
- [ ] `pnpm typecheck` ✅
- [ ] `pnpm test` ✅
- [ ] `pnpm lint` ✅
- [ ] Self-review manual (10 puntos)
- [ ] GEMINI auditoría APROBADO

---

## 11. Self-review obligatorio para SOFIA

Antes de reportar como listo, responder en el handoff:

- ¿El código refleja la SPEC al 100%?
- ¿La migración Prisma es aditiva (no rompe schema actual)?
- ¿El optimistic locking funciona en ambos paths?
- ¿El AuditLog se genera con snapshot before/after completo en ambos paths?
- ¿El RBAC se aplica correctamente (ADMIN edita, VENDEDOR solo links, DOCTOR/RECEPCION ninguno)?
- ¿La UI bloquea correctamente empresas en PENDIENTE_REVISION?
- ¿Los tests cubren happy path + 409 CONFLICT + RBAC denegado + RFC duplicado?
- ¿Hay code smells evidentes?
- ¿Riesgo de regresión en flujo prospecto nuevo?
- ¿La SPEC requiere actualización post-implementación?

**NO pidas `qodo`** (sunset). Recomendar GEMINI como segunda mano antes de merge.
