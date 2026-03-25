# CHK_IMPL-20260324-07 — Corte A1 Backend-Safe: Portal de Prellenado

**ID Intervención:** `IMPL-20260324-07`
**Fecha:** 2026-03-24
**Agente:** SOFIA - Builder
**SPECs base:** ARCH-20260324-09, ARCH-20260324-08, ARCH-20260324-04
**Branch:** main (cambios sin commitear)

---

## 🎯 Objetivo del Corte

Implementar la capa de datos y lógica backend mínima para el portal de prellenado del Examen Médico, sin abrir rutas públicas ni alterar el flujo clínico existente.

---

## ✅ Entregables

### 1. Modelo de datos — `prisma/schema.prisma`
- **Enum `PrefilledStatus`**: 7 estados según SPEC (NOT_GENERATED, INVITATION_ACTIVE, OPENED, PARTIAL, SUBMITTED, EXPIRED, CANCELLED)
- **Modelo `PrefilledInvitation`**: campos de token hasheado, expiración, metadata de canal, openedCount, payload module1Data (JSON), relaciones con Appointment y User
- **Relaciones agregadas**: `Appointment.prefilledInvitation` (1:1) y `User.generatedInvitations` (1:N)

### 2. Migración — `prisma/migrations/20260324010000_add_prefilled_invitation/`
- SQL manual para crear `CREATE TYPE "PrefilledStatus"` e tabla `prefilled_invitations`
- Índices únicos en `appointmentId` y `tokenHash`
- FKs a `appointments` y `users`
- Aplicada con `prisma db execute` y registrada con `prisma migrate resolve --applied`

### 3. Schema Zod — `src/schemas/clinical/prefilled.schema.ts`
- `DatosPersonalesModulo1Schema`: campos declarativos del trabajador
- `HistoriaLaboralSchema`: historia laboral y exposición a riesgos
- `Module1DataSchema`: composición de las 7 secciones del Módulo 1, reutilizando `HeredoFamiliaresSchema`, `NoPatologicosSchema`, `PatologicosSchema` (history.schema.ts) y `ReproductivosInmunizacionesSchema` (exam.schema.ts)
- `GenerateInvitationInputSchema` y `SaveModule1InputSchema` para validación de inputs

### 4. Server Actions — `src/actions/prefilled-invitation.actions.ts`
| Función | Acceso | Descripción |
|---------|--------|-------------|
| `generateInvitation(rawInput)` | Staff autenticado | Genera token aleatorio (32 bytes base64url), hashea con SHA-256, invalida token anterior de la misma cita, crea nuevo registro. Devuelve token plano UNA sola vez. |
| `getInvitationStatus(appointmentId)` | Staff autenticado | Estado actual de invitación para recepción. Auto-expira si vencida. |
| `validatePublicToken(plainToken)` | Sin sesión (portal público futuro) | Valida token, incrementa openedCount, devuelve datos mínimos sin IDs internos. |
| `savePartialModule1(plainToken, rawData)` | Sin sesión (portal público futuro) | Guarda avance parcial, establece status PARTIAL. |
| `submitModule1(plainToken, rawData)` | Sin sesión (portal público futuro) | Envío final, establece SUBMITTED + submittedAt. Bloquea modificaciones posteriores. |

### 5. Fix menor — `src/app/layout.tsx`
- Wrapping de `<AppShell>` con `<Suspense>` para resolver error de build preexistente (`useSearchParams` sin Suspense en Next.js 16.1.6, detectado al invalidar caché del build)

---

## 🔐 Seguridad
- Token plano: `crypto.randomBytes(32).toString('base64url')` — no derivable, no predecible
- Solo el hash SHA-256 se almacena en DB (`tokenHash`)
- Token devuelto UNA sola vez en `generateInvitation`
- Validación de expiración en CADA request del portal
- `validatePublicToken` no expone IDs internos consecutivos ni datos clínicos del médico
- Scope de portal estrictamente limitado por token
- Transacción atómica garantiza que nunca hay dos tokens activos simultáneos para la misma cita

---

## 📊 Alcance de archivos (CORTE A1)

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `frontend/prisma/schema.prisma` | Modificado | Enum + modelo + relaciones |
| `frontend/prisma/migrations/20260324010000_add_prefilled_invitation/migration.sql` | Nuevo | Migración SQL manual |
| `frontend/src/schemas/clinical/prefilled.schema.ts` | Nuevo | Zod schemas del Módulo 1 |
| `frontend/src/actions/prefilled-invitation.actions.ts` | Nuevo | Server actions backend |
| `frontend/src/app/layout.tsx` | Modificado (mínimo) | Suspense fix preexistente |

**Total: 5 archivos** ✅ — dentro del límite de 5 adicionales a los previstos.

---

## 🚦 Soft Gates

| Gate | Estado | Evidencia |
|------|--------|-----------|
| Gate 1 — Compilación | ✅ PASS | `pnpm build` completado sin errores |
| Gate 2 — Testing | ⏳ PENDIENTE | No hay tests unitarios para actions; se delegará a Corte A2 |
| Gate 3 — Revisión | ✅ OK | `qodo self-review` ejecutado |
| Gate 4 — Documentación | ✅ OK | Checkpoint generado; JSDoc en archivos nuevos |

---

## 🔗 Relación con Cortes futuros

- **Corte A2**: Rutas públicas del portal (`/portal/prefilled/[token]`)
- **Corte A3**: UI de recepción (bloque de acciones: WhatsApp, Copiar, QR, Tableta)
- **Corte A4**: Vista médico dentro de papeleta con estado de prellenado visible

---

## ⚠️ Decisiones documentadas

1. **Migración manual**: Se usó `prisma db execute` + `migrate resolve --applied` en lugar de `migrate dev` porque existe drift entre la DB y el historial de migraciones locales. No se reset la DB para preservar datos.
2. **Schema DRY**: El Module1DataSchema REUTILIZA schemas existentes de `history.schema.ts` y `exam.schema.ts` para las secciones 3-7. Solo se crearon schemas nuevos para `datos_personales` e `historia_laboral`.
3. **Suspense en layout.tsx**: El error de build fue preexistente (AppShell usa `useSearchParams`) y se detectó al invalidar la caché del build. La corrección es mínima y no modifica AppShell.tsx.
