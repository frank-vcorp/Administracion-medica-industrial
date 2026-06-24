# HANDOFF ARCH-20260623-03 FASE 6 a SOFIA — Cierre de 6 GAPs

- ID: ARCH-20260623-03 (Fase 6 / Cierre de GAPs)
- Fecha: 2026-06-23
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion (continuacion de Fase 1-5 ya entregadas)
- ADR: `context/decisions/ADR-20260623-02-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md`
- SPEC: `context/SPECs/SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md`
- Handoff previo: `context/interconsultas/HANDOFF_ARCH-20260623-03_SOFIA_CLIENTE-V2.md`
- Reporte de cierre previo: SOFIA entrego 80% (schema, migracion, seed, service, server actions, 4/5 componentes UI)

## Objetivo

Cerrar los **6 GAPs** identificados en el reporte de cierre de Fase 1-5 para llevar la implementacion al **100%** y dejar el modulo listo para segunda mano de validacion (GEMINI) y commit. **NO rehacer trabajo ya entregado.** Solo completar lo que falta.

## Contexto confirmado

1. Tu entrega previa esta intacta en el working tree (schema, migracion, seed, service, server actions, 4 componentes UI, modal mejorado). NO la toques salvo donde un GAP lo requiera.
2. Stack: Next.js 16.1.6 App Router, Prisma 5.22, PostgreSQL, NextAuth, Zod, Tailwind 4.
3. Componentes ya creados que vas a integrar: `CompanyStatusBadge`, `CompanySellerHistoryPanel`, `CompanyFullFormView`, `SelfRegistrationForm`.
4. Server actions ya exportadas que vas a consumir: `getCompanyById`, `getCompanySellerHistory`, `listActiveSellers`, `listEstadosMexico`, `changeCompanySeller`, `toggleCompanyEnabled`, `reviewAndEnableCompany`, `generateCompanySelfRegLink`, `validateCompanySelfRegToken`, `registerSelfRegFile`, `submitCompanySelfRegistration`.
5. Storage: `POST /api/v1/upload-only` operativo. Reutilizar tal cual.
6. Patron publico: token plano en retorno, hash SHA-256 en DB (replica `PrefilledInvitation`).

## Regla de trabajo (NO negociable)

- **NO modifiques** archivos de Fases 1-5 salvo donde un GAP lo indique explicitamente.
- **NO reintroduzcas** dependencias nuevas.
- **NO cambies** el schema Prisma (ya esta cerrado y migrado).
- **NO borres** archivos existentes.
- **NO** hacer commit, push ni PR.
- **NO** modifiques variables de entorno.

## Alcance exacto: cerrar 6 GAPs

### GAP-1 (ALTO) — Crear ruta publica `/auto-alta/[token]`

**Archivo a crear**: `frontend/src/app/auto-alta/[token]/page.tsx`

**Comportamiento**:

1. Server component (no `'use client'`). Recibe `params: Promise<{ token: string }>` (Next.js 16+: `await params`).
2. Llama `validateCompanySelfRegToken(token)` desde `@/actions/company.actions`.
3. Si token invalido, expirado o status !== `ACTIVE`: renderiza pantalla de error con mensaje claro (NO formulario).
4. Si valido: renderiza `<SelfRegistrationForm token={token} />` y `<CompanyStatusBadge>` en header.
5. Layout minimo: header con logo AMI + titulo "Alta de Cliente — Auto-registro" + texto "Tu solicitud sera revisada por un vendedor antes de activarse".

**Restricciones Next.js 16** (recordatorio, viene de AGENTS.md):

- `export default async function Page({ params }: { params: Promise<{ token: string }> })`.
- `const { token } = await params;` — nunca acceso sincronico.

### GAP-2 (ALTO) — Integrar paneles en ficha `/companies/[id]`

**Archivo a modificar**: `frontend/src/app/companies/[id]/page.tsx`

**Cambios**:

1. Server component existente. Despues de `getCompanyById(id)`, agregar `getCompanySellerHistory(id)` y `listActiveSellers()`.
2. Renderizar nueva seccion `<CompanySellerHistoryPanel history={history} />` debajo de los datos generales.
3. Renderizar `<CompanyFullFormView company={company} canEdit={session.user.role !== 'COMPANY_CLIENT' && company.estado === 'HABILITADO'} />` debajo del historial.
4. Boton "Cambiar vendedor": abre modal client-side con dropdown (`listActiveSellers`) que llama `changeCompanySeller`.
5. Toggle "Habilitado/Deshabilitado": solo visible si `session.user.role === 'ADMIN'`. Llama `toggleCompanyEnabled` con confirmacion.
6. Boton "Revisar y Habilitar" si `company.estado === 'PENDIENTE_REVISION'`: solo visible para vendedores o admin. Llama `reviewAndEnableCompany`.
7. Badge `<CompanyStatusBadge estado={company.estado} origen={company.origen} />` junto al titulo.

**Crear subcomponente client-side** nuevo: `frontend/src/components/companies/CompanyActionsPanel.tsx` (client component) que encapsula los botones y modales para mantener la page server-side pura.

### GAP-3 (MEDIO) — Filtros en `/companies`

**Archivo a modificar**: `frontend/src/app/companies/page.tsx`

**Cambios**:

1. Leer `searchParams: Promise<{ estado?: string; origen?: string; sellerId?: string; q?: string }>` (Next.js 16+: `await searchParams`).
2. Pasar filtros a `getCompanies` (o crear `listCompaniesWithFilters` si no existe — verificar en `company.service.ts`; si no, agregarla siguiendo patron existente).
3. UI: barra de filtros con 4 selects (estado, origen, vendedor, texto libre para name/rfc) + boton "Limpiar filtros".
4. Cada fila de empresa renderiza `<CompanyStatusBadge>`.

### GAP-4 (MEDIO) — Bloquear citas para clientes DESHABILITADOS

**Archivos a modificar**:

1. `frontend/src/services/company.service.ts` — agregar helper `isCompanyOperativa(companyId: string): Promise<boolean>` (verificar si ya existe; si no, crearla). Retorna `false` si `estado !== 'HABILITADO'`.
2. `frontend/src/actions/appointment.actions.ts` — en la server action de crear cita (buscar la funcion principal, probablemente `createAppointment` o similar), agregar validacion: si `companyId` provisto, llamar `isCompanyOperativa(companyId)` y retornar `{ success: false, error: 'CLIENTE_DESHABILITADO' }` si retorna `false`. NO usar `throw` — usar return estructurado consistente con el resto del archivo.

**Verificacion previa**: abre `appointment.actions.ts` y confirma nombre exacto de la funcion. Si hay varias (create bulk, create single), aplica a todas.

### GAP-5 (MEDIO) — Scripts `typecheck` y `test` en `package.json`

**Archivo a modificar**: `frontend/package.json`

**Cambios**:

1. Verificar scripts existentes en `"scripts"`. Si NO existe `"typecheck"`, agregar `"typecheck": "tsc --noEmit"`.
2. Si NO existe `"test"`, agregar `"test": "vitest run"` (verificar que `vitest` este en `devDependencies`; si no, agregarlo: `"vitest": "^2.0.0"` y un `frontend/vitest.config.ts` minimo).
3. Si `vitest` no existe, **NO instalar** dependencias — solo dejar el script listo y documentar el GAP en tu self-review. La instalacion la hara INTEGRA tras tu cierre.

### GAP-6 (MEDIO) — Tests unitarios minimos

**Archivos a crear**:

1. `frontend/vitest.config.ts` (si no existe) — configuracion minima para TS + path alias `@/`.
2. `frontend/src/lib/schemas/__tests__/company-full-form.test.ts` — tests Zod cubriendo:
   - RFC valido mexicano (`XAXX010101000`)
   - RFC invalido (caracteres especiales) → falla
   - CP invalido (no 5 digitos) → falla
   - Email invalido → falla
   - `terminosAceptados` debe ser `true` literal → `false` falla
   - Payload completo valido → pasa
   - Tamano maximo de archivo excedido → falla
3. `frontend/src/services/__tests__/company.service.test.ts` — tests unitarios de helpers puros (sin DB):
   - `hashToken(plain)` produce SHA-256 deterministico
   - `hashToken` retorna 64 caracteres hex
   - Si existe `isCompanyOperativa` con logica pura extraible, testear su validacion de estado
4. **NO** mockear Prisma. Solo testear funciones puras (hash, mapeos, Zod). Tests de integracion con DB quedan fuera de este corte.

## Orden de ejecucion obligatorio

1. GAP-5 primero (scripts) — habilita validaciones para GAP-6.
2. GAP-6 (tests) — ejecuta `pnpm test` y verifica que pasen los tests puros.
3. GAP-1 (ruta publica) — desbloquea flujo end-to-end.
4. GAP-2 (integracion ficha) — usa el mismo `SelfRegistrationForm` que validaste en GAP-1.
5. GAP-3 (filtros) — depende de GAP-2 para usar `CompanyStatusBadge`.
6. GAP-4 (bloqueo citas) — independiente, pero hazlo ultimo para no romper tests de citas existentes si los hay.

## Validaciones obligatorias antes de cerrar

```bash
cd frontend && pnpm typecheck
cd frontend && pnpm test
cd frontend && pnpm lint   # si existe script
```

**Las 3 deben pasar limpio.** Si `pnpm test` falla por falta de `vitest` en dependencias, documentalo en self-review y no lo reportes como completado.

Si `pnpm typecheck` reporta errores por tipos faltantes en componentes ya entregados (Fases 1-5), corrigelos en este pase **solo si son errores de tipo derivados de tu trabajo nuevo** (GAPs 1-6). NO toques logica existente salvo para ajustar tipos.

## Self-review manual (NO uses qodo, esta sunset)

Incluye en tu reporte final:

1. ¿Los 6 GAPs quedaron cerrados completamente? (verifica archivo por archivo)
2. ¿Hay code smells introducidos (componentes nuevos >300 lineas, logica de negocio en UI)?
3. ¿Los tests cubren los 5 edge cases minimos de la SPEC original? Lista cuales SÍ y cuales NO.
4. ¿Riesgo de regresion en `Appointment` por el bloqueo de clientes DESHABILITADOS? (PIENSA: si existian clientes DESHABILITADOS antes — NO deberia haber ninguno porque es campo nuevo — pero si los hay por data legacy, la regla aplicaria retroactivamente.)
5. ¿`pnpm typecheck`, `pnpm test`, `pnpm lint` pasaron limpio? Reporta el output literal de los 3.

## Segunda mano de validacion (REGLAS INTEGRA)

Al cerrar tu implementacion, **sugiere a INTEGRA** invocar a GEMINI (`subagent_type='gemini'`) como segunda mano de validacion antes de marcar como commit-ready. NO invoques a GEMINI tu mismo; solo sugiérelo en tu reporte final.

## Reporte final (estructura obligatoria)

Al terminar, devuelve a INTEGRA:

- **Resumen 1-2 lineas** de lo implementado en esta Fase 6.
- **Archivos creados/modificados** en esta Fase 6 (lista exacta con paths; NO listes los de Fases 1-5).
- **Resultado literal de validaciones** (`pnpm typecheck`, `pnpm test`, `pnpm lint` — output exacto, no resumas).
- **Resultado del self-review manual** (5 preguntas).
- **GAPs cerrados** vs **GAPs parcialmente cerrados / abiertos**.
- **Riesgos o desviaciones** respecto a esta Fase 6.
- **Sugerencia explicita** de invocar a GEMINI como segunda mano.

NO ejecutes commit, push ni PR. NO borres archivos existentes. NO modifiques variables de entorno.

## Regla global INTEGRA sobre cierre de subagentes

Tu reporte final llega a INTEGRA, NO al usuario humano. INTEGRA se encargara de notificar al usuario con el formato visual apropiado y esperar OK explicito antes de commit/push. Tu responsabilidad termina al entregar el reporte estructurado.
