# SPEC ARCH-20260624-02 — Link de auto-alta: URL pública + trazabilidad de emisor

**ID:** ARCH-20260624-02
**Fecha:** 2026-06-24
**Tipo:** FIX
**Relacionado:** IMPL-20260624-01 (núcleo auto-alta), SPEC_ARCH-20260624-01 (ruta pública sin token)
**Reportado por:** Frank (humano)

---

## 1. Contexto

Ayer (SPEC_ARCH-20260624-01) se agregó el flujo de auto-alta de prospectos con link público
(`/auto-alta/[token]`). El modal "Link de auto-alta generado" en `CompanyFormModal` muestra
un link que el vendedor/admin puede copiar y enviar al prospecto.

**Bug 1 (reportado):** El link generado sale con `http://localhost:3000/...` en lugar del
dominio público real de producción (Vercel). El prospecto no puede abrirlo.

**Bug 2 (solicitado):** El link no identifica al usuario staff que lo emitió. Se quiere
trazabilidad de "quién invitó a esta empresa" tanto en la URL (visible al prospecto y
para auditoría rápida) como en BD (ya existe `createdByUserId` en `CompanySelfRegistration`).

---

## 2. Causa raíz

### Bug 1 — Fallback a localhost en producción
`frontend/src/services/company.service.ts:144`:
```ts
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
```

- `NEXT_PUBLIC_BASE_URL` **no está definida** en el repo (grep no encuentra la env var en
  `.env*` ni en configuración de Vercel en este workspace).
- Vercel expone **auto-vars** que el código debería consumir como fallback:
  - `VERCEL_PROJECT_PRODUCTION_URL` → dominio custom configurado en producción (la que el
    humano quiere que se auto-detecte).
  - `VERCEL_URL` → hostname `*.vercel.app` (preview o fallback).
- El código actual ignora ambas y cae al fallback `localhost`.

### Bug 2 — `createdByUserId` ya se persiste, falta exponerlo en URL
- El action `generateCompanySelfRegLinkAction` (en `company.actions.ts:106-118`) **ya
  recibe el `userId` de la sesión** y lo pasa al service.
- El service (`company.service.ts:135-142`) **ya lo persiste** en
  `CompanySelfRegistration.createdByUserId`.
- **Falta** concatenar ese identificador al URL retornado (como query string `?ref=`)
  para que el prospecto y el admin lo vean de un vistazo.

---

## 3. Decisión de diseño

### 3.1 URL base — Jerarquía de resolución

Crear helper `getPublicBaseUrl()` en `frontend/src/lib/env/public-base-url.ts` con esta
prioridad (de mayor a menor):

| Prioridad | Fuente | Cuándo aplica |
|---|---|---|
| 1 | `process.env.NEXT_PUBLIC_BASE_URL` | Override manual (casos especiales, white-label futuro) |
| 2 | `process.env.VERCEL_PROJECT_PRODUCTION_URL` | Vercel auto: dominio custom de producción (lo que el humano pidió) |
| 3 | `process.env.VERCEL_URL` | Vercel auto: `*.vercel.app` (preview o sin dominio custom) |
| 4 | `'http://localhost:3000'` | Desarrollo local sin env var |

**Reglas:**
- `NEXT_PUBLIC_*` para que sea seguro embeber en código de cliente si más adelante la UI
  necesita construir URLs públicos (no aplica hoy, pero es buena práctica).
- Helper exportado como función pura y testeable (recibe opcionalmente `env` para tests).
- Sin trailing slash en el resultado (el llamador ya hace `.replace(/\/$/, '')`).
- **No** usar `headers()` (request-scoped); el helper debe funcionar en cualquier contexto
  (server action, route handler, build-time, tests).

### 3.2 Trazabilidad del emisor en URL

Formato: **`?ref=<userId>`** al final del URL, donde `<userId>` es el `id` del User de la
sesión que emitió el link.

**Justificación (ya validada con el humano):**
- Estándar de la industria (estilo UTM).
- No rompe la ruta principal `/auto-alta/[token]`.
- No contamina el token (que debe ser opaco y verificable por hash).
- La fuente de verdad legal sigue siendo `CompanySelfRegistration.createdByUserId` en BD.
  El `?ref=` es redundante pero útil para UX y auditoría rápida.

**Ejemplo de URL final:**
```
https://administracion-medica-industrial.vercel.app/auto-alta/Y3WOzGPreWUulyS2wxCQvg8KMkdcgOvGo7AaPYLmTP4?ref=u_abc123
```

**Comportamiento esperado:**
- Si la sesión tiene `user.id` → URL incluye `?ref=<userId>`.
- Si por algún motivo `createdByUserId` viene `null`/undefined (defensa en profundidad) →
  URL sin query string (no se añade `?ref=` vacío).
- El modal de UI (`CompanyFormModal.tsx`) **no requiere cambios**: ya muestra
  `setGeneratedUrl(result.url)`, automáticamente recibirá el nuevo formato.

### 3.3 Lo que NO cambia
- Modelo Prisma: `CompanySelfRegistration` ya tiene `createdByUserId`. **No requiere migración.**
- Estructura de carpetas: helper nuevo en `src/lib/env/`.
- Flujo público `/auto-alta/[token]/page.tsx`: no necesita parsear `?ref=` (solo es visual/UX).
- Endpoint público `/solicitar-alta`: no aplica (no hay emisor).

---

## 4. Plan de implementación

### 4.1 Archivos a crear
- `frontend/src/lib/env/public-base-url.ts` — helper `getPublicBaseUrl()` + tipos.
- `frontend/src/lib/env/public-base-url.test.ts` — unit tests del helper (4 escenarios:
  override manual, dominio custom Vercel, fallback `*.vercel.app`, localhost).

### 4.2 Archivos a modificar
- `frontend/src/services/company.service.ts`:
  - Importar `getPublicBaseUrl`.
  - Reemplazar línea 144 (`const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ...`).
  - En `generateCompanySelfRegLink` (línea 124-147): añadir `?ref=<userId>` al URL final
    si `createdByUserId` está presente.

### 4.3 Archivos a NO tocar (validar)
- `frontend/src/actions/company.actions.ts` (pasa userId correctamente, no requiere cambio).
- `frontend/src/components/CompanyFormModal.tsx` (muestra `result.url`, no requiere cambio).
- `frontend/src/app/auto-alta/[token]/page.tsx` (no parsea `?ref=`, sin cambios).
- `frontend/prisma/schema.prisma` (sin cambios — campo ya existe).

---

## 5. Criterios de aceptación

| # | Criterio | Cómo verificar |
|---|---|---|
| CA-1 | Helper `getPublicBaseUrl()` retorna `NEXT_PUBLIC_BASE_URL` cuando está definida | Unit test |
| CA-2 | Helper retorna `VERCEL_PROJECT_PRODUCTION_URL` cuando NO hay override y hay dominio custom | Unit test |
| CA-3 | Helper retorna `VERCEL_URL` cuando no hay override ni dominio custom | Unit test |
| CA-4 | Helper retorna `http://localhost:3000` en dev sin env vars | Unit test |
| CA-5 | Helper nunca retorna string con trailing slash | Unit test |
| CA-6 | `generateCompanySelfRegLink` retorna URL con `?ref=<userId>` cuando hay sesión | Unit test del service (mock prisma) |
| CA-7 | `generateCompanySelfRegLink` retorna URL **sin** `?ref=` cuando `createdByUserId` es null | Unit test del service |
| CA-8 | `CompanySelfRegistration.createdByUserId` sigue persistiéndose igual que antes (regresión) | Test E2E o unit del service |
| CA-9 | `pnpm typecheck` pasa | CI |
| CA-10 | `pnpm test` pasa (incluyendo nuevos tests) | CI |
| CA-11 | `pnpm lint` pasa | CI |
| CA-12 | Modal de UI muestra el nuevo formato de URL | Inspección manual en dev (build local con env vars) |

---

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| En Vercel `VERCEL_PROJECT_PRODUCTION_URL` podría no estar definida en algún plan/edge case | Fallback `VERCEL_URL` (siempre presente en deploys de Vercel) |
| Cambio de URL rompe links ya compartidos en chats/email | Aceptable: el link con localhost ya estaba roto. La BD mantiene token + hash, regenerar link es trivial |
| Query string `?ref=` se pierde al reenviar por WhatsApp | Aceptable: la trazabilidad legal está en BD (`createdByUserId`); `?ref=` es solo UX/visual |
| `NEXT_PUBLIC_BASE_URL` colisiona con un futuro dominio de staging | Documentar en `.env.example` que es override manual de producción |

---

## 7. Verificación post-deploy

1. Generar link de auto-alta como ADMIN/VENDEDOR en producción (`/companies`).
2. Verificar que el link resultante:
   - Empieza con `https://administracion-medica-industrial.vercel.app/` (o el dominio custom
     si ya está configurado).
   - Termina con `?ref=<userId>` donde `<userId>` coincide con el `id` del usuario en sesión.
3. Pegar el link en una pestaña incógnito: el formulario `/auto-alta/[token]` debe cargar
   correctamente.
4. Confirmar en Prisma Studio que `CompanySelfRegistration.createdByUserId` tiene el
   userId correcto.

---

## 8. Checklist de cierre (para SOFIA)

- [ ] Crear `frontend/src/lib/env/public-base-url.ts`
- [ ] Crear `frontend/src/lib/env/public-base-url.test.ts` con 4+ tests
- [ ] Modificar `frontend/src/services/company.service.ts`:
  - [ ] Importar helper
  - [ ] Reemplazar `baseUrl` por `getPublicBaseUrl()`
  - [ ] Añadir `?ref=<userId>` al URL cuando `createdByUserId` está presente
- [ ] Agregar/ajustar test del service que verifique el formato del URL retornado
- [ ] `pnpm typecheck` ✅
- [ ] `pnpm test` ✅
- [ ] `pnpm lint` ✅
- [ ] Self-review manual (plantilla al pie)
- [ ] Recomendar a INTEGRA invocar **GEMINI** (subagent_type='gemini') como segunda mano

---

## 9. Self-review obligatorio (sustituye a Qodo)

Antes de reportar como listo, SOFIA debe responder en su handoff:

- ¿El código refleja esta SPEC al 100%?
- ¿Los 4 escenarios del helper están cubiertos por tests?
- ¿El formato del URL con `?ref=` se valida en al menos un test?
- ¿Hay code smells evidentes (duplicación, magic strings, mutación indebida)?
- ¿Algún riesgo de regresión en el flujo público `/auto-alta/[token]` o `/solicitar-alta`?
- ¿Se rompió accidentalmente el path legacy o alguna ruta adyacente?
