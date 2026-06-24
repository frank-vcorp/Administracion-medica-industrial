# SPEC ARCH-20260624-01 — Ruta pública adicional sin token para auto-alta

**ID:** ARCH-20260624-01
**Fecha:** 2026-06-24
**Estado:** Planificado
**ADR:** `context/decisions/ADR-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md`

## Objetivo

Agregar una segunda ruta pública para auto-alta de clientes, sin token, además de `/auto-alta/[token]`. Esta nueva ruta es para casos donde se necesita captura directa (demos, landing pages, leads espontáneos) sin gatekeeper de token.

## Contexto funcional

El módulo Ficha Cliente v2 (IMPL-20260623-03) ya tiene implementada `/auto-alta/[token]` con token + expiración. El usuario solicitó una URL pública adicional sin token (`quiero una url publica sin token adicional a lo de la specificacion`).

Casos de uso de la nueva ruta:
- Demo en vivo a prospecto (vendedor abre URL en navegador sin tener que generar link).
- Landing page de marketing con botón "Solicita tu alta".
- Captura de leads desde sitio web corporativo.
- Botón directo desde email signature o tarjeta de presentación.

## Alcance

### Funcional

#### Nueva ruta `/solicitar-alta`

- Server component `frontend/src/app/solicitar-alta/page.tsx`.
- **Sin auth**. Sin validación de token.
- Renderiza `<SelfRegistrationForm source="PUBLIC" />` directamente.
- Layout: header con logo AMI + título "Solicita tu Alta como Cliente" + subtítulo "Tu información será revisada por un ejecutivo antes de activar tu cuenta".
- Sin validación de token, expiración ni tracking de aperturas.

#### Server action actualizada

Refactor `submitCompanySelfRegistration` para soportar dos paths:

```ts
// Path 1: con token (existente, sin cambios funcionales)
submitCompanySelfRegistration(token: string, payload: CompanyFullFormPayload)

// Path 2: público sin token (nuevo)
submitPublicCompanySelfRegistration(payload: CompanyFullFormPayload)
```

Internamente:
- `submitCompanySelfRegistration`: valida token, busca `CompanySelfRegistration` por `tokenHash`, status=ACTIVE, expiresAt>NOW.
- `submitPublicCompanySelfRegistration`: omite validación de token. Crea `CompanySelfRegistration` con `channel='PUBLIC_DIRECT'`, `createdByUserId=null`, `status=SUBMITTED`, `submittedAt=NOW`.

Ambas llaman internamente a `submitCompanySelfRegistrationCore(source, payload, token?)` que:
1. Valida payload con `CompanyFullFormPayloadSchema`.
2. Verifica RFC no duplicado (`assertRfcNotRegistered`).
3. Sube archivos al bucket (scope `companies/public/{random8}/` si PUBLIC; `companies/selfreg/{tokenHash[:8]}/` si TOKEN).
4. Crea `Company` con `origen=AUTO_ALTA, estado=PENDIENTE_REVISION, sellerId=null`.
5. Crea/actualiza `CompanySelfRegistration` con `channel` apropiado.
6. Registra `AuditLog` con IP del cliente.
7. Retorna `{ success: true, companyId }` o error con código estable.

#### Cambios en modelo de datos

Agregar campo opcional a `CompanySelfRegistration`:

```prisma
model CompanySelfRegistration {
  // ... campos existentes ...
  channel  String?  @default("VENDOR_LINK")  // 'VENDOR_LINK' | 'PUBLIC_DIRECT'
}
```

Migración aditiva con default `'VENDOR_LINK'` para retrocompatibilidad.

#### Cambios en `SelfRegistrationForm.tsx`

Agregar prop opcional:

```ts
interface SelfRegistrationFormProps {
  token?: string              // presente si source='TOKEN'
  source: 'TOKEN' | 'PUBLIC'  // default 'TOKEN'
}
```

Si `source='PUBLIC'`, el form envía vía `submitPublicCompanySelfRegistration(payload)`.
Si `source='TOKEN'`, envía vía `submitCompanySelfRegistration(token, payload)` (existente).

Comportamiento UI idéntico en ambos casos; solo cambia el endpoint server-side.

#### Badge en ficha del cliente

En `frontend/src/components/companies/CompanyStatusBadge.tsx` (o nuevo `CompanyOriginBadge.tsx`):

- Si `company.origen='AUTO_ALTA'` y `submittedCompany.channel='PUBLIC_DIRECT'` → badge "Solicitud Web Pública" (color azul claro).
- Si `company.origen='AUTO_ALTA'` y `submittedCompany.channel='VENDOR_LINK'` → badge "Link de Vendedor" (color índigo).
- Si `company.origen='MANUAL'` → badge "Alta Manual" (color gris).

#### AuditLog para submits públicos

En `submitCompanySelfRegistrationCore`, cuando `source='PUBLIC'`:

```ts
await prisma.auditLog.create({
  data: {
    action: 'COMPANY_PUBLIC_SELF_REG_SUBMITTED',
    entity: 'Company',
    entityId: company.id,
    ipAddress: <ip del cliente>,
    details: { source: 'PUBLIC', companyName: company.name, rfc: company.rfc }
  }
})
```

## Modelo de datos (delta)

```sql
-- Migración: agregar columna channel
ALTER TABLE company_self_registrations
ADD COLUMN "channel" TEXT DEFAULT 'VENDOR_LINK';

-- Backfill: registros existentes quedan con 'VENDOR_LINK' por default
-- (no requiere UPDATE explícito)
```

## Arquitectura técnica

### Frontend

| Ruta | Tipo | Auth | Renderiza |
|---|---|---|---|
| `/solicitar-alta` | Server component | NO | `<SelfRegistrationForm source="PUBLIC" />` |
| `/auto-alta/[token]` | Server component | NO | `<SelfRegistrationForm source="TOKEN" token={token} />` |

### Backend

- `submitCompanySelfRegistrationCore(source, payload, token?)` — función interna compartida.
- `submitCompanySelfRegistration(token, payload)` — wrapper server action que valida token y llama al core.
- `submitPublicCompanySelfRegistration(payload)` — wrapper server action público que llama al core con `source='PUBLIC'`.

Ambas server actions registradas en `frontend/src/actions/company.actions.ts` con `'use server'`.

## Validaciones Zod (sin cambios)

`CompanyFullFormPayloadSchema` se mantiene idéntico. La diferencia entre TOKEN y PUBLIC es solo cómo se accede y cómo se trackea el origen.

## Edge cases

| # | Caso | Comportamiento |
|---|---|---|
| 1 | Visitante abre `/solicitar-alta` y abandona sin enviar | Sin impacto (no se crea nada hasta submit). Archivos en scope `companies/public/{random8}/` quedan huérfanos hasta limpieza manual. |
| 2 | RFC duplicado en submit público | `assertRfcNotRegistered` retorna error `RFC_DUPLICATE`. UI muestra link a `/companies/[id]` del existente. |
| 3 | Múltiples submits del mismo visitante | Cada uno crea un `Company` nuevo. Sin rate limiting V1 (riesgo controlado). |
| 4 | Vendedor ve en `/companies?estado=PENDIENTE_REVISION` submissions de ambas fuentes | Sin distinción visual en el filtro V1; badge en ficha individual. |
| 5 | Cliente habilitado desde origen público | Funciona idéntico al de link; vendedor sigue el mismo flujo. |
| 6 | Token existente en `/auto-alta/[token]` sigue funcionando | No se toca esa ruta. Refactor retrocompatible. |
| 7 | IP logging en submit público | Siempre se registra IP en `AuditLog`. Sin PII adicional. |

## Archivos de implementación (≤10)

1. `frontend/prisma/schema.prisma` — agregar `channel` opcional a `CompanySelfRegistration`.
2. `frontend/prisma/migrations/20260624_company_self_reg_channel/migration.sql` — nueva migración.
3. `frontend/src/app/solicitar-alta/page.tsx` — nueva ruta pública (NUEVO).
4. `frontend/src/services/company.service.ts` — refactor con `submitCompanySelfRegistrationCore`.
5. `frontend/src/actions/company.actions.ts` — nueva server action pública.
6. `frontend/src/components/companies/SelfRegistrationForm.tsx` — prop `source` y llamada condicional.
7. `frontend/src/app/auto-alta/[token]/page.tsx` — pasar `source='TOKEN'` explícito.
8. `frontend/src/components/companies/CompanyStatusBadge.tsx` o nuevo `CompanyOriginBadge.tsx` — diferenciar origen.
9. `frontend/src/lib/schemas/company-full-form.ts` — agregar `channel` opcional al payload.
10. `frontend/src/services/company.service.ts` — helper `getClientIp(request)` para AuditLog.

## Validación

```bash
cd frontend && npm run typecheck
cd frontend && npm test -- --run
cd frontend && npm run lint
```

**Smoke test manual**:

1. Sin sesión, abrir `http://localhost:3000/solicitar-alta` → renderiza formulario.
2. Llenar 10 secciones + 5 documentos → enviar → ver mensaje "Tu solicitud está en revisión".
3. Login vendedor → `/companies?estado=PENDIENTE_REVISION` → ver nuevo cliente con badge "Solicitud Web Pública".
4. Abrir ficha del cliente → historial de vendedor vacío (no hubo asignación previa) → habilitar.
5. Verificar que `/auto-alta/[token]` sigue funcionando con link generado por admin.
6. Verificar `AuditLog` tiene registro con `action='COMPANY_PUBLIC_SELF_REG_SUBMITTED'` e IP.

## Riesgos controlados

1. **Abuso/spam**: Mitigación V1 = estado PENDIENTE_REVISION. Mitigación futura = captcha + rate limit.
2. **Storage huérfano**: Archivos en `companies/public/{random8}/` quedan sin submit. Limpieza manual por admin.
3. **Email no verificado**: Email del prospecto puede ser incorrecto. Vendedor corrige al revisar.

## Referencias

- `context/decisions/ADR-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md`
- `context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md`
- `frontend/src/app/auto-alta/[token]/page.tsx` — ruta con token (no se elimina).
- `frontend/src/components/companies/SelfRegistrationForm.tsx` — formulario base.