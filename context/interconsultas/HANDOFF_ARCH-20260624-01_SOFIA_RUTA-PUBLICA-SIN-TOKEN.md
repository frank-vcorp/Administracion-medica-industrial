# HANDOFF ARCH-20260624-01 a SOFIA — Ruta pública sin token para auto-alta

- ID: ARCH-20260624-01
- Fecha: 2026-06-24
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion
- ADR: `context/decisions/ADR-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md`
- SPEC: `context/SPECs/SPEC_ARCH-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md`

## Objetivo

Agregar una **segunda ruta pública** además de `/auto-alta/[token]`:

- **Nueva**: `/solicitar-alta` — pública directa, sin token, sin auth.
- **Existente**: `/auto-alta/[token]` — sin cambios funcionales, sigue funcionando idéntico.

Ambas usan el mismo `SelfRegistrationForm` (con prop `source` discriminador) y crean `Company` con `origen=AUTO_ALTA, estado=PENDIENTE_REVISION`. La diferencia es solo cómo se accede y cómo se trackea el origen.

## Contexto confirmado

1. El módulo Ficha Cliente v2 (IMPL-20260623-03) ya está implementado y commiteado en `main` (commit `ba1cfd3`).
2. Stack: Next.js 16.1.6 App Router, Prisma 5.22, PostgreSQL, NextAuth, Zod, Tailwind 4.
3. `SelfRegistrationForm.tsx` ya existe y maneja 10 secciones + subida de archivos. Solo hay que agregar prop `source`.
4. `submitCompanySelfRegistration` ya existe. Hay que refactorizar para soportar ambos paths.
5. `CompanySelfRegistration` ya tiene `tokenHash`, `status`, `submittedCompanyId`. Hay que agregar `channel` opcional.
6. Storage del bucket Railway reutilizado. Scope dedicado: `companies/public/{random8}/` para nuevo path.

## Reglas duras

1. NO eliminar ni romper `/auto-alta/[token]`. La ruta con token sigue intacta.
2. NO introducir captcha, rate limiting ni auth adicional en este corte.
3. NO crear tabla nueva. Solo agregar columna opcional `channel` a `CompanySelfRegistration`.
4. NO romper flujos existentes. Refactor retrocompatible: `channel='VENDOR_LINK'` por default.
5. NO exponer tokens en HTML ni logs.
6. NO modificar archivos fuera de los 10 listados en SPEC sección "Archivos de implementación".
7. NO commit, push ni PR (deja working tree limpio para commit final).

## Alcance exacto (orden de ejecución)

### T1 — Migración Prisma

1. En `frontend/prisma/schema.prisma`, agregar a `model CompanySelfRegistration`:
   ```prisma
   channel  String?  @default("VENDOR_LINK")
   ```
2. Crear migración: `cd frontend && npx prisma migrate dev --name company_self_reg_channel`.
3. Verificar SQL generado: ALTER TABLE con DEFAULT 'VENDOR_LINK'.

### T2 — Refactor service

En `frontend/src/services/company.service.ts`:

1. Renombrar `submitCompanySelfRegistration` actual a `submitCompanySelfRegistrationCore(source: 'TOKEN' | 'PUBLIC', payload: CompanyFullFormPayload, token?: string)` (función interna).
2. Crear wrapper público `submitCompanySelfRegistration(token: string, payload)` que valida token y llama al core con `source='TOKEN'`.
3. Crear nuevo wrapper público `submitPublicCompanySelfRegistration(payload)` que llama al core con `source='PUBLIC'`, sin validación de token.
4. En el core, después de crear Company con `origen=AUTO_ALTA, estado=PENDIENTE_REVISION`:
   - Si `source='TOKEN'`: actualiza `CompanySelfRegistration` existente (busca por `tokenHash`).
   - Si `source='PUBLIC'`: crea nuevo `CompanySelfRegistration` con `channel='PUBLIC_DIRECT'`, `createdByUserId=null`, `tokenHash='public-' + randomUUID()`, `status='SUBMITTED'`, `expiresAt=NOW + 168h` (placeholder), `submittedCompanyId=company.id`.
5. Cuando `source='PUBLIC'`, registrar `AuditLog` con `action='COMPANY_PUBLIC_SELF_REG_SUBMITTED'`, `entity='Company'`, `entityId=company.id`, `details={source, companyName, rfc}`. La IP se obtiene del request via Next.js `headers()` (ver helper abajo).
6. Para storage de archivos:
   - `source='TOKEN'`: scope `companies/selfreg/{tokenHash[:8]}/` (existente).
   - `source='PUBLIC'`: scope `companies/public/{random8()}/`. El `random8` se genera una sola vez por submit y se guarda en `CompanySelfRegistration.tokenHash` con prefijo `public-` (reutiliza el campo).

Helper para IP:
```ts
import { headers } from 'next/headers'
async function getClientIp(): Promise<string | null> {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null
}
```

### T3 — Server actions

En `frontend/src/actions/company.actions.ts`:

1. Agregar nueva server action pública:
   ```ts
   export async function submitPublicCompanySelfRegistration(payload: CompanyFullFormPayload) {
     'use server'
     // NO auth check
     const result = await CompanyService.submitPublicCompanySelfRegistration(payload)
     revalidatePath('/companies')
     return result
   }
   ```
2. La server action existente `submitCompanySelfRegistration` se mantiene idéntica en su signatura pública (compatibilidad).
3. NO requiere cambios en otras server actions.

### T4 — Nueva ruta `/solicitar-alta`

Crear `frontend/src/app/solicitar-alta/page.tsx`:

- Server component (no `'use client'`).
- Sin `params` ni `searchParams` (ruta estática).
- Render directo:
  ```tsx
  <div className="min-h-screen ...">
    <header>
      <h1>Solicita tu Alta como Cliente</h1>
      <p>Tu información será revisada por un ejecutivo antes de activar tu cuenta.</p>
    </header>
    <SelfRegistrationForm source="PUBLIC" />
  </div>
  ```
- NO `await params`. NO `getServerSession`. NO `validateCompanySelfRegToken`.

### T5 — Refactor `SelfRegistrationForm.tsx`

En `frontend/src/components/companies/SelfRegistrationForm.tsx`:

1. Agregar prop al interface:
   ```ts
   interface SelfRegistrationFormProps {
     token?: string
     source: 'TOKEN' | 'PUBLIC'
   }
   ```
2. En el submit handler:
   ```ts
   const result = source === 'PUBLIC'
     ? await submitPublicCompanySelfRegistration(payload)
     : await submitCompanySelfRegistration(token!, payload)
   ```
3. Validar que `token` esté presente si `source='TOKEN'`; log warning si falta.
4. UI sin cambios; solo cambia el endpoint server-side.

### T6 — Actualizar `/auto-alta/[token]/page.tsx`

En `frontend/src/app/auto-alta/[token]/page.tsx`:

- Cambiar `<SelfRegistrationForm token={token} />` a `<SelfRegistrationForm token={token} source="TOKEN" />`.

### T7 — Badge de origen

Crear `frontend/src/components/companies/CompanyOriginBadge.tsx` (o actualizar `CompanyStatusBadge.tsx`):

- Recibe `channel: 'VENDOR_LINK' | 'PUBLIC_DIRECT' | null`.
- Render:
  - `VENDOR_LINK` → "Link de Vendedor" (badge índigo)
  - `PUBLIC_DIRECT` → "Solicitud Web Pública" (badge azul claro)
  - `null` → "Alta Manual" (badge gris)

En `frontend/src/app/companies/[id]/page.tsx`, agregar el badge junto al título (después del `CompanyStatusBadge`).

### T8 — Actualizar schema Zod (opcional)

En `frontend/src/lib/schemas/company-full-form.ts`:

- Agregar campo opcional `channel` al payload (default `'VENDOR_LINK'` o `'PUBLIC_DIRECT'` según source).
- Si source='PUBLIC', forzar `channel='PUBLIC_DIRECT'`.

## Validaciones obligatorias

```bash
cd frontend && npm run typecheck
cd frontend && npm test -- --run
cd frontend && npm run lint
```

Criterio de cierre:
- typecheck: 0 errores totales.
- test: 15/15 pasan (o más si agregas tests nuevos; al menos 1 test para `submitPublicCompanySelfRegistration`).
- lint módulo: 0 warnings nuevos en los archivos tocados.

Reporta **output literal completo** de cada comando.

## Validación de no-regresión

```bash
# Verificar que /auto-alta/[token] sigue funcionando
# (no se puede automatizar completamente; documentar en self-review que NO tocaste el flujo)
git diff frontend/src/components/companies/SelfRegistrationForm.tsx | grep -A 5 "source"
```

El refactor debe ser retrocompatible: cualquier llamada existente con `<SelfRegistrationForm token="..." />` debe seguir funcionando (TypeScript puede quejarse por falta de `source`; agrega default `source='TOKEN'` en destructuring).

## Tests sugeridos (mínimo)

Crear `frontend/src/services/__tests__/company.service.public.test.ts`:

- Test que `submitPublicCompanySelfRegistration` crea Company con `origen=AUTO_ALTA, estado=PENDIENTE_REVISION`.
- Test que crea `CompanySelfRegistration` con `channel='PUBLIC_DIRECT'`.
- Test que NO requiere token.

Si hay tiempo, agregar test de Zod para el campo `channel`.

## Self-review (5 preguntas)

1. ¿La ruta `/solicitar-alta` queda accesible sin auth? Verifica ausencia de `getServerSession`, `redirect`, etc.
2. ¿`/auto-alta/[token]` sigue funcionando idéntico? Pega el diff de `SelfRegistrationForm.tsx` mostrando retrocompatibilidad.
3. ¿La migración agrega `channel` con default correcto? Pega el SQL generado.
4. ¿`AuditLog` se registra en submit público? Pega el código.
5. Output literal de las 3 validaciones.

## Reporte final (estructura obligatoria)

- Resumen 1-2 líneas.
- Archivos modificados/creados (lista exacta; NO listes archivos del commit `ba1cfd3`).
- Output literal completo de `npm run typecheck`, `npm test -- --run`, `npm run lint`.
- Self-review 5 preguntas.
- Sugerencia explícita de invocar a GEMINI como segunda mano.

NO invocar a GEMINI tú mismo. NO commit, push ni PR.

## Regla global INTEGRA

Tu reporte final llega a INTEGRA, NO al usuario humano. INTEGRA notificará al usuario con formato visual y esperará OK explícito antes de commit/push.