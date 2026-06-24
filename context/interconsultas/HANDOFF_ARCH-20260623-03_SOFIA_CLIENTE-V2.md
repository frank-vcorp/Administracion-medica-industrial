# HANDOFF ARCH-20260623-03 a SOFIA — Ficha Cliente v2 (Vendedor, Historial, Link Público)

- ID: ARCH-20260623-03
- Fecha: 2026-06-23
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion
- ADR: `context/decisions/ADR-20260623-02-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md`
- SPEC: `context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md`

## Objetivo

Reemplazar el modal basico `CompanyFormModal.tsx` por una ficha de cliente corporativa con:

1. Asignacion de vendedor (`User.role = VENDEDOR`) con historial append-only.
2. Checkbox de habilitado (`estado = PENDIENTE_REVISION | HABILITADO | DESHABILITADO`).
3. Link publico de auto-alta para prospectos, con flujo de revision por vendedor antes de habilitar.
4. Persistencia de las 10 secciones del formulario fiscal/bancario/contacto/documentos.

## Contexto confirmado

1. Stack: Next.js 16.1.6 App Router, Prisma 5.22, PostgreSQL, NextAuth, Zod, Tailwind 4.
2. `Company` actual tiene 11 campos basicos; el modal solo captura 5.
3. `UserRole` enum: ADMIN, RECEPTIONIST, DOCTOR_GENERAL, DOCTOR_VALIDATOR, CAPTURIST, COMPANY_CLIENT. **NO** existe `VENDEDOR`.
4. Storage ya operativo: Railway Bucket S3-compatible (`t3.storageapi.dev`), con endpoint `POST /api/v1/upload-only` que sube y devuelve `file_url = /api/files/{key}` (ver SPEC `ARCH-20260513-15`). **Reutilizar tal cual**.
5. Patron de link publico: `PrefilledInvitation` con `tokenHash` SHA-256 + `expiresAt` + `status`. Replicar exactamente.
6. Backend Python en `backend/app/main.py` no requiere cambios; los archivos del link publico se suben al bucket con scope dedicado.

## Decisiones de arquitectura ya tomadas (no revertir)

1. Ampliar `Company` con campos opcionales (`sellerId`, `origen`, `estado`, `enabledAt`, `enabledByUserId`) + JSON para datos extensos. **NO** romper compatibilidad con `Worker.companyId`, `Appointment.companyId`, `Project.companyId`, etc.
2. Crear modelo `CompanySellerHistory` (append-only) — nunca borrar filas.
3. Agregar `VENDEDOR` al enum `UserRole` **al final** sin reordenar valores existentes.
4. Crear modelo `CompanySelfRegistration` con `tokenHash` (nunca plano), `expiresAt`, `status`, `submittedCompanyId`.
5. Mismo modelo `Company` para auto-alta y manual; diferenciarlos con `origen = AUTO_ALTA | MANUAL`.
6. Estados: `PENDIENTE_REVISION` (no aparece en citas/proyectos), `HABILITADO` (operativo), `DESHABILITADO` (datos persisten, no se elimina).
7. Migracion de datos: clientes existentes quedan `origen=MANUAL`, `estado=HABILITADO`, `enabledAt=NOW()`.
8. Catálogos seedeados: `estados_mexico` (32 entidades), `usoCFDI` (catalogo SAT), `metodoPago` (PUE|PPD).

## Acciones obligatorias (orden de ejecucion)

### Fase 1 — Schema Prisma

1. En `frontend/prisma/schema.prisma`:
   - Agregar enum `UserRole` valor: `VENDEDOR` (al final).
   - Agregar enum `CompanyStatus`, `CompanyOrigin`, `CompanySelfRegStatus`, `CfdiUso`.
   - Agregar a `model Company` los campos nuevos (ver SPEC seccion "Modelo de datos") + relaciones `seller`, `enabledBy`, `sellerHistory`, `selfRegistrations`.
   - Agregar a `model User` relaciones inversas: `sellerCompanies`, `enabledCompanies`, `sellerHistoryPrevious`, `sellerHistoryNew`, `sellerHistoryChangedBy`, `createdSelfRegistrations`.
   - Crear `model CompanySellerHistory`, `model CompanySelfRegistration`, `model EstadoMexico`.
2. Crear migracion: `pnpm prisma migrate dev --name company_v2_vendedor_historial_link_publico`.
3. Verificar SQL generado: defaults correctos, FKs, indices `@@index([companyId, changedAt])` y `@@unique([tokenHash])`.

### Fase 2 — Seed

4. En `frontend/prisma/seed.ts`:
   - Seedear 32 estados de Mexico.
   - Seedear catalogo SAT de `usoCFDI` (al menos los 20 principales; documentar fuente).
   - Crear 1 vendedor demo: `vendedor.demo@ami.local` con rol `VENDEDOR`, `isActive=true`.
   - No tocar seeds existentes.

### Fase 3 — Server actions y service

5. En `frontend/src/services/company.service.ts`:
   - Agregar helper `hashToken(plain: string): string` (SHA-256 con `crypto.subtle` o `node:crypto`).
   - `changeCompanySeller(companyId, newSellerId, changedByUserId, reason?)` — **transaccion Prisma**: UPDATE Company.sellerId + INSERT CompanySellerHistory.
   - `generateCompanySelfRegLink(createdByUserId?, ttlHours=168)` — genera token plano, hashea, INSERT CompanySelfRegistration, devuelve `{token, url, expiresAt}`. **Token plano solo en este retorno, nunca persistirlo**.
   - `validateCompanySelfRegToken(token)` — hashea, busca por `tokenHash`, valida `status=ACTIVE` y `expiresAt>NOW`, incrementa `openedCount`.
   - `uploadSelfRegFile(token, file, section)` — reusa `POST /api/v1/upload-only` con key `companies/selfreg/{tokenHash[:8]}/{section}/{filename}`.
   - `submitCompanySelfRegistration(token, payload)` — valida Zod (schema `CompanyFullFormPayloadSchema` en SPEC), crea Company con `origen=AUTO_ALTA, estado=PENDIENTE_REVISION`, marca `CompanySelfRegistration.status=SUBMITTED, submittedCompanyId=company.id`.
   - `reviewAndEnableCompany(companyId, reviewerUserId, options)` — transaccion: UPDATE Company.estado=HABILITADO, enabledAt, enabledByUserId, sellerId (de options o self), INSERT CompanySellerHistory inicial.
   - `toggleCompanyEnabled(companyId, enabledByUserId, enabled)` — solo admin. UPDATE + AuditLog.
6. En `frontend/src/actions/company.actions.ts`:
   - Re-exportar nuevas funciones como server actions con `'use server'`.
   - `revalidatePath('/companies')` y `revalidatePath('/companies/[id]')` despues de mutaciones.

### Fase 4 — UI

7. Reemplazar `frontend/src/components/CompanyFormModal.tsx`:
   - Agregar campo "Vendedor" (select con usuarios `role=VENDEDOR && isActive=true`).
   - Agregar checkbox "Habilitado" (default true).
   - Pasar nuevos campos en FormData a `createCompany` actualizado.
8. Crear `frontend/src/components/companies/CompanySellerHistoryPanel.tsx`:
   - Timeline cronologico con: vendedor anterior (avatar+nombre), flecha, vendedor nuevo, fecha/hora relativa (`Intl.RelativeTimeFormat`), usuario que cambio (badge), motivo opcional.
   - Recibe `companyId`, hace fetch server-side en server component o via hook.
9. Crear `frontend/src/components/companies/CompanyFullFormView.tsx`:
   - Render readonly de las 10 secciones (segun SPEC).
   - Si `company.estado === 'HABILITADO'` y usuario es vendedor/admin: boton "Editar" que abre form inline.
10. Crear `frontend/src/components/companies/SelfRegistrationForm.tsx`:
    - Renderiza las 10 secciones.
    - Subida de archivos por seccion con validacion de tamano cliente (3/2/4/10 MB segun tipo).
    - Submit unico que llama `submitCompanySelfRegistration`.
11. Crear `frontend/src/components/companies/CompanyStatusBadge.tsx`:
    - Badge visual segun estado (color) y origen (icono).
12. Crear `frontend/src/app/auto-alta/[token]/page.tsx`:
    - **Sin auth**. Server component que valida token; si invalido/expirado, renderiza mensaje de error.
    - Renderiza `<SelfRegistrationForm token={token} />`.
13. Modificar `frontend/src/app/companies/[id]/page.tsx`:
    - Integrar `<CompanySellerHistoryPanel />`.
    - Integrar `<CompanyFullFormView />`.
    - Boton "Asignar/Cambiar vendedor" (modal con dropdown de vendedores activos).
    - Boton toggle habilitado (solo admin, con confirm).
    - Mostrar `<CompanyStatusBadge />`.
14. Modificar `frontend/src/app/companies/page.tsx`:
    - Agregar filtros: estado, origen, vendedor.
    - Badges por empresa en cada fila.

### Fase 5 — Validaciones

15. Validacion Zod consolidada en `frontend/src/lib/schemas/company-full-form.ts`:
    - Exportar `CompanyFullFormPayloadSchema` segun SPEC.
    - Validar tamano de archivos en servidor (no solo cliente).

## Reglas de seguridad obligatorias

1. Token plano NUNCA persiste en DB ni en logs. Solo `tokenHash` (SHA-256).
2. Archivos del link publico suben con key dedicada: `companies/selfreg/{tokenHash[:8]}/{section}/{filename}` para permitir limpieza manual si el prospecto nunca envia.
3. Server actions validan sesion excepto `submitCompanySelfRegistration` y `validateCompanySelfRegToken`.
4. `changeCompanySeller` rechaza si vendedor destino esta `isActive=false`.
5. `toggleCompanyEnabled` solo admin (verificar `session.user.role === 'ADMIN'`).
6. Validacion Zod obligatoria en TODAS las server actions; cliente solo valida UX.

## Punto de entrada real

1. `frontend/prisma/schema.prisma`
2. `frontend/prisma/seed.ts`
3. `frontend/src/services/company.service.ts`
4. `frontend/src/actions/company.actions.ts`
5. `frontend/src/components/CompanyFormModal.tsx`
6. `frontend/src/components/companies/` (3 archivos nuevos)
7. `frontend/src/app/companies/[id]/page.tsx`
8. `frontend/src/app/companies/page.tsx`
9. `frontend/src/app/auto-alta/[token]/page.tsx` (nuevo)
10. `frontend/src/lib/schemas/company-full-form.ts` (nuevo)

## Entregables minimos

1. Migracion Prisma aplicada sin error en dev.
2. Seed funcional con vendedor demo y catalogos.
3. Modal mejorado con vendedor y habilitado.
4. Link publico genera, abre, acepta envio, crea Company en `PENDIENTE_REVISION`.
5. Vendedor puede revisar/habilitar, asignarse a si mismo.
6. Historial de vendedor visible en ficha con cronologia correcta.
7. Filtros en `/companies` funcionales.
8. Checkpoint tecnico con: comandos ejecutados, archivos modificados, evidencia de captura.

## Validacion minima obligatoria

```bash
cd frontend && pnpm typecheck
cd frontend && pnpm test
cd frontend && pnpm lint
```

**Smoke test manual**:

1. Login admin → crear empresa rapida con vendedor demo → verificar badge `HABILITADO | MANUAL` en `/companies`.
2. Cambiar vendedor desde ficha → nueva fila en historial con `changedBy=admin_id`.
3. Login vendedor → "Generar link de auto-alta" → copiar URL.
4. Ventana incognito → abrir link → llenar 10 secciones con archivos reales (PDFs pequenos) → enviar.
5. Login vendedor en `/companies?estado=PENDIENTE_REVISION` → abrir prospecto → editar si requiere → asignar vendedor (si mismo) → habilitar.
6. Verificar ficha del prospecto muestra `HABILITADO | AUTO_ALTA`, historial con entrada inicial.
7. Deshabilitar desde admin → intentar crear `Appointment` con `companyId=ese` → bloqueado.

## No resolver en este corte

1. Notificaciones automaticas al vendedor cuando llega `PENDIENTE_REVISION`.
2. Wizard multi-step con guardado parcial (submit atomico en V1).
3. Multi-pais (solo Mexico en V1).
4. Aprobacion de doble factor.
5. Limpieza automatica de archivos huerfanos del bucket (dejar a operacion).
6. Edicion de catalogos SAT desde UI (seed estatico en V1).

## Segunda mano de validacion (REGLAS INTEGRA)

Antes de reportar como listo:

1. `pnpm typecheck` debe pasar limpio.
2. `pnpm test` debe pasar limpio.
3. `pnpm lint` debe pasar limpio (si existe script).

NO pidas `qodo` (esta sunset). En su lugar, incluye en tu reporte final un self-review manual:

1. ¿El codigo refleja la SPEC al pie de la letra?
2. ¿Hay code smells evidentes (componentes >300 lineas, logica de negocio en UI, falta de tipos)?
3. ¿Los tests cubren los edge cases listados en la SPEC (token expirado, RFC duplicado, vendedor inactivo, tamano de archivo)?
4. ¿Hay riesgo de regresion en `Worker`, `Appointment`, `Project`, `MedicalEvent` por agregar campos a `Company`?

Al cerrar, sugiere a INTEGRA invocar a GEMINI (`subagent_type='gemini'`) como segunda mano de validacion antes de marcar como commit-ready.
