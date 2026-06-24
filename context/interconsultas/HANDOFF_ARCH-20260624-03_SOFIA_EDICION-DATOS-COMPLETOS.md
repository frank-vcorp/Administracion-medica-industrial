# HANDOFF ARCH-20260624-03 → SOFIA — Gestión de datos completos de empresa (link externo + edición interna)

**Origen:** INTEGRA
**Destino:** SOFIA
**SPEC:** `context/SPECs/SPEC_ARCH-20260624-03-EDICION-DATOS-COMPLETOS-EMPRESA.md`
**Prioridad:** Alta (feature de negocio con dos vías validadas por el humano)
**Prereq:** `ARCH-20260624-02` (ya mergeado en `main`, commit `18bba39`)

---

## ⚠️ CRÍTICO — Procedimiento de migración a Railway

**NO usar `prisma migrate deploy` en build de Vercel.** Ese enfoque fue revertido en `FIX-20260624-02/03/04` porque falla por drift entre el schema local y el remoto.

**El patrón vigente (FIX-20260624-05)** es:
1. Crear la migración Prisma localmente con `prisma migrate dev`.
2. **Crear un script SQL idempotente** en `context/infra/` que aplique el cambio aditivo manualmente en Railway.
3. **Sincronizar `_prisma_migrations`** para que Prisma no intente reaplicar la migración.
4. El humano lo ejecuta en **Railway Dashboard → Postgres → Query**.
5. (Opcional) Actualizar el script consolidado `context/infra/apply-pending-migrations-railway.sql` si aplica.

**Si no haces este paso, el código fallará en producción** porque el campo `targetCompanyId` no existirá en la tabla `company_self_registrations` de Railway.

Ver archivos de referencia:
- `context/infra/apply-pending-migrations-railway.sql` (script consolidado vigente, FIX-20260624-05)
- `context/infra/01-migration-20260527.sql` (ejemplo de migración idempotente por separado)
- `context/infra/03-migration-20260623b-and-20260624.sql` (ejemplo de migración + sync de `_prisma_migrations`)

---

---

## TL;DR

Implementar **dos vías** para que las empresas (especialmente las dadas de alta de forma manual) puedan completar/actualizar sus datos completos:

1. **Sub-A — Link externo**: botón "Generar link para que la empresa complete sus datos" en `CompanyFormModal` (modo edición). Reusa `generateCompanySelfRegLink` con nueva opción `targetCompanyId`. La empresa abre `/auto-alta/[token]`, completa el form, al enviar hace **UPDATE** a la Company existente en vez de crear nueva.

2. **Sub-B — Edición interna**: nueva ruta `/companies/[id]/edit` + nueva action `updateCompanyAction`. **Solo ADMIN** puede editar. Genera `AuditLog` con snapshot before/after completo.

Decisiones validadas con el humano:
- Roles edición interna: **Solo ADMIN** (VENDEDOR solo genera links)
- Auditoría: **Completa** (snapshot before/after de TODOS los campos)

---

## Cambios concretos

### 1. Migración Prisma local

`frontend/prisma/schema.prisma`:

```prisma
model CompanySelfRegistration {
  id                 String              @id @default(uuid())
  tokenHash          String              @unique
  channel            String?             @default("VENDOR_LINK")
  // NUEVO:
  targetCompanyId    String?
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

Y en `Company`:

```prisma
model Company {
  // ... campos existentes ...
  targetSelfRegistrations CompanySelfRegistration[] @relation("CompanySelfRegTarget")
  selfRegistrations      CompanySelfRegistration[]
  // ...
}
```

Generar migración: `npx prisma migrate dev --name add_target_company_id_to_self_reg`

### 1.1 Script SQL idempotente para Railway (OBLIGATORIO)

Crear archivo `context/infra/05-migration-20260624-target-company-self-reg.sql` con el SQL aditivo equivalente a la migración Prisma. Estructura mínima (basada en `context/infra/apply-pending-migrations-railway.sql`):

```sql
-- =====================================================================
-- MIGRACIÓN ARCH-20260624-03: targetCompanyId en company_self_registrations
-- =====================================================================
-- ID: ARCH-20260624-03
-- Fecha: 2026-06-24
-- Autor: SOFIA
-- Prereq: ARCH-20260624-02 mergeado en main
--
-- PROPÓSITO:
--   Añadir campo targetCompanyId (FK opcional a companies) a
--   company_self_registrations para soportar la vía de "completar
--   datos de empresa existente" vía link externo.
--
-- INSTRUCCIONES:
--   1. Railway Dashboard → Postgres → Query.
--   2. Pegar este script completo.
--   3. Ejecutar (Run).
--   4. Verificar tabla de resultados al final.
-- =====================================================================

-- 1. ALTER TABLE company_self_registrations (idempotente)
ALTER TABLE "company_self_registrations"
  ADD COLUMN IF NOT EXISTS "targetCompanyId" TEXT;

-- 2. Índice
CREATE INDEX IF NOT EXISTS "company_self_registrations_targetCompanyId_idx"
  ON "company_self_registrations"("targetCompanyId");

-- 3. Foreign key (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'company_self_registrations_targetCompanyId_fkey'
      AND table_name = 'company_self_registrations'
  ) THEN
    ALTER TABLE "company_self_registrations"
      ADD CONSTRAINT "company_self_registrations_targetCompanyId_fkey"
      FOREIGN KEY ("targetCompanyId") REFERENCES "companies"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Sincronizar _prisma_migrations (CRÍTICO)
--     Nombre debe coincidir EXACTAMENTE con el de la migración Prisma local
INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "started_at", "applied_steps_count")
VALUES (
  gen_random_uuid()::text,
  'manual-railway-fix',
  NOW(),
  '<TIMESTAMP>_add_target_company_id_to_self_reg',  -- ⚠️ usar el nombre EXACTO de la migración Prisma generada
  NOW(),
  1
)
ON CONFLICT ("migration_name") DO UPDATE SET
  "finished_at" = NOW(),
  "rolled_back_at" = NULL,
  "applied_steps_count" = 1;

-- 5. Verificación final
SELECT
  (SELECT EXISTS (SELECT FROM information_schema.columns
                  WHERE table_schema = 'public'
                    AND table_name = 'company_self_registrations'
                    AND column_name = 'targetCompanyId')) AS "targetCompanyId_existe",
  (SELECT EXISTS (SELECT FROM information_schema.table_constraints
                  WHERE constraint_name = 'company_self_registrations_targetCompanyId_fkey'
                    AND table_name = 'company_self_registrations')) AS "FK_targetCompanyId_existe",
  (SELECT EXISTS (SELECT FROM pg_indexes
                  WHERE schemaname = 'public'
                    AND tablename = 'company_self_registrations'
                    AND indexname = 'company_self_registrations_targetCompanyId_idx')) AS "idx_targetCompanyId_existe",
  (SELECT EXISTS (SELECT FROM "_prisma_migrations"
                  WHERE "migration_name" = '<TIMESTAMP>_add_target_company_id_to_self_reg'
                    AND "finished_at" IS NOT NULL
                    AND "rolled_back_at" IS NULL)) AS "migracion_marcada_como_aplicada",
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'company_self_registrations'
            AND column_name = 'targetCompanyId') = 1
    THEN 'OK - El campo targetCompanyId está listo'
    ELSE 'INCOMPLETO - Revisar errores arriba'
  END AS "estado";
```

⚠️ **Importante**: el nombre de la migración en el INSERT de `_prisma_migrations` debe coincidir **EXACTAMENTE** con el nombre del directorio generado por `prisma migrate dev` en `frontend/prisma/migrations/`. Verificar con `ls frontend/prisma/migrations/`.

### 1.2 Entregable al cerrar (adicional)

Cuando termines la implementación, antes de reportar como listo a INTEGRA:
- Crea el script SQL idempotente en `context/infra/`.
- Verifica que el checksum y nombre de migración coincidan con lo generado por Prisma.
- Incluye en el reporte final el **path completo del script** y la **instrucción exacta** que el humano debe ejecutar en Railway Query.
- NO ejecutes el script tú mismo — eso lo hace Frank manualmente en Railway.

---

**NO** se crea tabla `CompanyAuditLog` nueva. Se reusa `AuditLog` existente con `entity='Company'`, `action='UPDATE'|'CREATE'|'UPDATE_VIA_LINK'`, `details={ before, after, changes }`.

### 2. Schemas Zod

`frontend/src/lib/schemas/company-update.ts` (NUEVO):

```ts
import { z } from 'zod'

// Reusar helper de RFC
const rfcRegex = /^[A-Z&Ñ]{3,4}\d{6}[A-Z0-9]{3}$/

export const updateCompanyBasicSchema = z.object({
  name: z.string().min(1).max(200),
  rfc: z.string().regex(rfcRegex, 'RFC inválido').nullable().optional(),
  address: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
})

export const updateFiscalSchema = z.object({
  razonSocial: z.string().min(1),
  rfc: z.string().regex(rfcRegex),
  domicilio: z.string(),
  colonia: z.string().nullable().optional(),
  municipio: z.string(),
  estado: z.string(),
  cp: z.string().regex(/^\d{5}$/),
  pais: z.string().default('México'),
  regimenFiscal: z.string(),
  // ... más campos según el form existente
}).passthrough() // permite campos extra del form

export const updateRepLegalSchema = z.object({ /* ... */ }).passthrough()
export const updateRhSchema = z.object({ /* ... */ }).passthrough()
export const updateCuentasPagarSchema = z.object({ /* ... */ }).passthrough()
export const updateReferenciasSchema = z.object({ /* ... */ }).passthrough()

export const updateCompanySchema = z.object({
  expectedUpdatedAt: z.string().datetime(), // para optimistic locking
  basic: updateCompanyBasicSchema.partial().optional(),
  fiscalData: updateFiscalSchema.optional(),
  repLegalData: updateRepLegalSchema.optional(),
  rhData: updateRhSchema.optional(),
  cuentasPagarData: updateCuentasPagarSchema.optional(),
  referenciasData: updateReferenciasSchema.optional(),
})

export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
```

Tests en `frontend/src/lib/schemas/company-update.test.ts`: casos válidos + RFC inválido + CP inválido + expectedUpdatedAt faltante.

### 3. Service — `frontend/src/services/company.service.ts`

#### 3.1 `generateCompanySelfRegLink` — nueva firma con opciones

```ts
export async function generateCompanySelfRegLink(
  createdByUserId?: string | null,
  options?: {
    ttlHours?: number
    targetCompanyId?: string  // NUEVO
  }
): Promise<{...}>
```

Si `options?.targetCompanyId` está presente:
- Validar `await prisma.company.findUnique({ where: { id: targetCompanyId } })` → lanzar si no existe
- Validar que `company.estado !== 'PENDIENTE_REVISION'` → lanzar `Error('TARGET_COMPANY_PENDING')`
- Persistir `targetCompanyId` y `channel = 'COMPANY_UPDATE'`

#### 3.2 `submitCompanySelfRegistrationCore` — nueva rama

Si `reg.targetCompanyId` está presente (en vez del path actual de `create`):

```ts
// 1. Leer Company actual (snapshot before)
const before = await tx.company.findUnique({
  where: { id: reg.targetCompanyId }
})
if (!before) return { ok: false, code: 'TARGET_COMPANY_GONE', error: 'Company ya no existe' }

// 2. Optimistic locking
if (before.updatedAt.toISOString() !== expectedUpdatedAt) {
  return { ok: false, code: 'CONCURRENT_UPDATE', error: 'Datos desactualizados' }
}

// 3. Validar RFC duplicado si cambió
if (payload.fiscal.rfc !== before.rfc) {
  await assertRfcNotRegistered(payload.fiscal.rfc, reg.targetCompanyId)
}

// 4. UPDATE (no CREATE)
const updated = await tx.company.update({
  where: { id: reg.targetCompanyId },
  data: { /* merge payload */ }
})

// 5. AuditLog
await tx.auditLog.create({
  data: {
    userId: reg.createdByUserId,
    action: 'UPDATE_VIA_LINK',
    entity: 'Company',
    entityId: reg.targetCompanyId,
    details: { before, after: updated, sourceRef: reg.id },
    ipAddress: await getClientIp(),
  }
})

return { ok: true, companyId: reg.targetCompanyId }
```

**Importante**: el `expectedUpdatedAt` se debe pasar en el payload o como query param del token (decisión de UX).

#### 3.3 Nueva función `updateCompany`

```ts
export async function updateCompany(
  companyId: string,
  data: UpdateCompanyInput,
  context: { userId: string; ipAddress?: string | null }
): Promise<
  | { ok: true; company: Company }
  | { ok: false; code: 'NOT_FOUND' | 'CONCURRENT_UPDATE' | 'RFC_DUPLICATE' | 'INVALID_PAYLOAD'; error: string }
> {
  return prisma.$transaction(async (tx) => {
    // 1. Leer before
    const before = await tx.company.findUnique({ where: { id: companyId } })
    if (!before) return { ok: false, code: 'NOT_FOUND', error: 'Company no encontrada' }

    // 2. Optimistic locking
    if (before.updatedAt.toISOString() !== data.expectedUpdatedAt) {
      return { ok: false, code: 'CONCURRENT_UPDATE', error: 'Datos desactualizados' }
    }

    // 3. Validar RFC duplicado
    if (data.basic?.rfc && data.basic.rfc !== before.rfc) {
      await assertRfcNotRegistered(data.basic.rfc, companyId)
    }

    // 4. Update
    const after = await tx.company.update({
      where: { id: companyId },
      data: {
        ...(data.basic ?? {}),
        fiscalData: data.fiscalData ?? undefined,
        repLegalData: data.repLegalData ?? undefined,
        rhData: data.rhData ?? undefined,
        cuentasPagarData: data.cuentasPagarData ?? undefined,
        referenciasData: data.referenciasData ?? undefined,
      }
    })

    // 5. AuditLog con diff
    await tx.auditLog.create({
      data: {
        userId: context.userId,
        action: 'UPDATE',
        entity: 'Company',
        entityId: companyId,
        details: {
          before,
          after,
          changes: computeChanges(before, after), // helper que diff campos
        },
        ipAddress: context.ipAddress ?? null,
      }
    })

    return { ok: true, company: after }
  })
}
```

Helper `computeChanges(before, after)` simple: recorrer keys y devolver array `{ field, before, after }` solo donde difieren.

### 4. Actions — `frontend/src/actions/company.actions.ts`

#### 4.1 Nueva action `generateCompanyDataCompletionLinkAction`

```ts
export async function generateCompanyDataCompletionLinkAction(
  companyId: string,
  ttlHours = 168
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, code: 'UNAUTHENTICATED', error: 'Sin sesión' }
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN' && role !== 'VENDEDOR') {
    return { ok: false, code: 'FORBIDDEN', error: 'Rol insuficiente' }
  }

  const result = await CompanyService.generateCompanySelfRegLink(
    (session.user as { id: string }).id,
    { ttlHours, targetCompanyId: companyId }
  )
  return { ok: true, ...result }
}
```

#### 4.2 Nueva action `updateCompanyAction`

```ts
export async function updateCompanyAction(
  companyId: string,
  data: unknown
) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return { ok: false, code: 'UNAUTHENTICATED', error: 'Sin sesión' }
  const role = (session.user as { role?: string }).role
  if (role !== 'ADMIN') {
    return { ok: false, code: 'FORBIDDEN', error: 'Solo ADMIN puede editar datos completos' }
  }

  const parsed = updateCompanySchema.safeParse(data)
  if (!parsed.success) {
    return { ok: false, code: 'INVALID_PAYLOAD', error: parsed.error.message }
  }

  const result = await CompanyService.updateCompany(
    companyId,
    parsed.data,
    { userId: (session.user as { id: string }).id, ipAddress: await getClientIp() }
  )

  if (result.ok) {
    revalidatePath(`/companies/${companyId}`)
    revalidatePath(`/companies/${companyId}/edit`)
    revalidatePath('/companies')
  }

  return result
}
```

### 5. UI — Sub-A: botón en `CompanyFormModal`

En `frontend/src/components/CompanyFormModal.tsx`, añadir (visible solo en modo edición + ADMIN/VENDEDOR + estado HABILITADO):

```tsx
{existingCompany && existingCompany.estado === 'HABILITADO' &&
 (session?.user.role === 'ADMIN' || session?.user.role === 'VENDEDOR') && (
  <div className="border-t pt-4 mt-4">
    <button
      type="button"
      onClick={async () => {
        const r = await generateCompanyDataCompletionLinkAction(existingCompany.id)
        if (r.ok) setCompletionLinkUrl(r.url)
      }}
      className="..."
    >
      🔗 Generar link para que la empresa complete sus datos
    </button>
    {completionLinkUrl && <LinkDisplayModal url={completionLinkUrl} />}
  </div>
)}
```

### 6. UI — Sub-B: edición interna

#### 6.1 Nueva ruta `frontend/src/app/companies/[id]/edit/page.tsx`

```tsx
import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCompanyById } from '@/services/company.service'
import CompanyEditForm from '@/components/companies/CompanyEditForm'

export default async function CompanyEditPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params  // Next.js 16
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'ADMIN') {
    redirect(`/companies/${id}`)
  }

  const company = await getCompanyById(id)
  if (!company) redirect('/companies')

  return <CompanyEditForm company={company} />
}
```

#### 6.2 Nuevo componente `CompanyEditForm.tsx`

- Form con secciones (tabs o acordeón)
- Hidden field con `expectedUpdatedAt = company.updatedAt.toISOString()`
- Botón "Guardar cambios" con `useTransition`
- Manejo de errores: `CONCURRENT_UPDATE` → toast "Los datos fueron actualizados por otro usuario. Recarga la página."
- Si el form toca `rfc` → alert de confirmación "¿Estás seguro? El RFC es identificador fiscal único."

#### 6.3 Botón en ficha `/companies/[id]/page.tsx`

```tsx
{session?.user.role === 'ADMIN' && (
  <Link href={`/companies/${company.id}/edit`}>
    <button>✏️ Editar datos completos</button>
  </Link>
)}
```

### 7. Tests

#### 7.1 Tests del schema Zod (`company-update.test.ts`)
- RFC válido / inválido / null
- CP 5 dígitos / 6 dígitos / vacío
- expectedUpdatedAt faltante → error
- payload completo válido

#### 7.2 Tests del service (`company.service.test.ts`)

**Sub-A:**
- `generateCompanySelfRegLink(userId, { targetCompanyId })` persiste correctamente
- Submit externo con `targetCompanyId` hace UPDATE (no CREATE)
- Submit externo detecta drift `updatedAt` → `CONCURRENT_UPDATE`
- Submit externo genera AuditLog con `action='UPDATE_VIA_LINK'`
- Submit externo rechaza si `targetCompanyId` no existe → `TARGET_COMPANY_GONE`
- Submit externo rechaza si RFC choca con otra Company

**Sub-B:**
- `updateCompany` aplica cambios correctos
- `updateCompany` detecta drift → `CONCURRENT_UPDATE`
- `updateCompany` rechaza RFC duplicado
- `updateCompany` genera AuditLog con snapshot before/after completo
- `updateCompany` reusa `AuditLog` (no crea tabla nueva)

#### 7.3 Tests de actions (`company.actions.test.ts` si existe, o inline)

- `generateCompanyDataCompletionLinkAction`: ADMIN OK, VENDEDOR OK, DOCTOR RECHAZADO
- `updateCompanyAction`: ADMIN OK, VENDEDOR RECHAZADO, payload inválido RECHAZADO

#### 7.4 Tests E2E (Playwright)

- ADMIN edita Company, ve toast de éxito, ve AuditLog generado
- VENDEDOR intenta editar → bloqueado por redirect
- Concurrencia: dos admins editan a la vez → el segundo ve error de conflicto

---

## Validaciones obligatorias antes de cerrar

```
1. pnpm typecheck
2. pnpm test
3. pnpm lint (si existe script)
4. npx prisma migrate dev (generar migración)
5. npx prisma format (si existe script)
```

**NO pidas `qodo`** (sunset). Self-review manual en tu reporte final (10 preguntas de la sección 11 de la SPEC).

### Validación extra de migración a Railway

En tu reporte final debes confirmar:
- [ ] ¿La migración Prisma local fue generada en `frontend/prisma/migrations/<TIMESTAMP>_add_target_company_id_to_self_reg/`?
- [ ] ¿El script SQL idempotente fue creado en `context/infra/0X-migration-<FECHA>-target-company-self-reg.sql`?
- [ ] ¿El nombre de la migración insertado en `_prisma_migrations` coincide **EXACTAMENTE** con el directorio Prisma?
- [ ] ¿Las 3 sentencias (ALTER TABLE, CREATE INDEX, ADD CONSTRAINT) son idempotentes (usan `IF NOT EXISTS` o `EXISTS()`)?
- [ ] ¿La verificación final retorna 4 booleanos TRUE?
- [ ] ¿El script NO se ejecutó por ti, solo quedó listo para Frank?

---

## Archivos esperados al cerrar

### Nuevos
- `frontend/prisma/migrations/<TIMESTAMP>_add_target_company_id_to_self_reg/` (generado por Prisma)
- `context/infra/0X-migration-<FECHA>-target-company-self-reg.sql` (script idempotente para Railway)
- `frontend/src/lib/schemas/company-update.ts`
- `frontend/src/lib/schemas/company-update.test.ts`
- `frontend/src/app/companies/[id]/edit/page.tsx`
- `frontend/src/components/companies/CompanyEditForm.tsx`

### Modificados
- `frontend/prisma/schema.prisma`
- `frontend/src/services/company.service.ts` (~+150 líneas)
- `frontend/src/services/__tests__/company.service.test.ts` (+8 tests mínimo)
- `frontend/src/actions/company.actions.ts` (+2 actions)
- `frontend/src/components/CompanyFormModal.tsx` (botón nuevo)
- `frontend/src/app/companies/[id]/page.tsx` (botón Editar)

---

## Verificación post-implementación

1. **Migración local**: `npx prisma migrate dev` aplica sin errores. `npx prisma studio` muestra `targetCompanyId` en `CompanySelfRegistration`.
2. **Migración Railway**: Frank corre el script `context/infra/0X-migration-<FECHA>-target-company-self-reg.sql` en Railway Query. La verificación final debe retornar 4 booleanos TRUE y estado 'OK'.
3. **Link externo**: como ADMIN, abrir `/companies`, editar una empresa HABILITADA, click en botón nuevo. URL retornado tiene `?ref=<userId>`. Pegar en ventana incógnito, completar form. Verificar que la Company se actualizó, no se creó una nueva. Verificar AuditLog con `action='UPDATE_VIA_LINK'`.
4. **Edición interna**: como ADMIN, ir a `/companies/<id>`, click "Editar". Modificar un campo, guardar. Verificar cambio. Verificar AuditLog con `action='UPDATE'`.
5. **RBAC**: como VENDEDOR, intentar acceder a `/companies/<id>/edit` → redirect a `/companies/<id>`. Como ADMIN, mismo path → form visible.
6. **Concurrencia**: editar en dos pestañas a la vez, guardar en la primera, intentar guardar en la segunda → error claro.

---

## ⚠️ Después del merge: Frank aplica la migración en Railway

Una vez que INTEGRA apruebe el merge y el push a `origin/main`:

1. Frank abre Railway Dashboard → servicio Postgres → Query.
2. Pega el contenido de `context/infra/0X-migration-<FECHA>-target-company-self-reg.sql`.
3. Ejecuta (Run).
4. Verifica que la tabla final retorna 4 booleanos TRUE + estado 'OK'.
5. Refresca `/workers` y `/companies` en el navegador.
6. Reporta a INTEGRA que la migración está aplicada.

**Sin este paso, el código de `ARCH-20260624-03` fallará en producción** con errores tipo:
- `Unknown column 'targetCompanyId' in 'where clause'`
- `Foreign key constraint failed on the field: 'targetCompanyId'`

---

**Decisión de merge sigue siendo de INTEGRA tras segunda mano de GEMINI.**
