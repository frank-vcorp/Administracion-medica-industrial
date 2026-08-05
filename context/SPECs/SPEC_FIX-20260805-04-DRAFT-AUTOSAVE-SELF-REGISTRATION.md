# SPEC FIX-20260805-04 — Draft Autosave (persistencia navegador) para Self-Registration Form

**Fecha:** 2026-08-05
**Estado:** READY
**ID:** FIX-20260805-04
**Origen:** Escalamiento ATLAS M3 (FIX-20260805-04 pendiente) desde necesidad explícita de Frank.
**Prioridad:** P2 (mejora UX, no bloquea operación; previene pérdida de datos en form público de 30+ campos)
**ADR relacionadas:** `context/decisions/ADR-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md` (riesgo #4 storage huérfano — sigue fuera de este corte)
**SPEC predecesoras:** `SPEC_ARCH-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md`, `SPEC_ARCH-20260623-03-CLIENTE-V2-VENDEDOR-HISTORIAL-LINK-PUBLICO.md`

---

## 1. Objetivo

Agregar persistencia de navegador (draft autosave) al formulario público de auto-alta de empresa, de modo que un prospecto que cierre la pestaña/navegador, cambie de ventana o sufra un cierre inesperado pueda continuar donde se quedó al reabrir el formulario.

**Necesidad verbatim de Frank:** *"agrega persistencia al menos del navegador por si no completan los datos, cambia de venta, se les cierra, etc"*.

## 2. Contexto técnico

- **Stack:** Next.js 16.1.6 App Router + Prisma + Railway Postgres + Vercel.
- **Componente afectado:** `frontend/src/components/companies/SelfRegistrationForm.tsx` (1048 líneas, client component, ver líneas 116-932).
- **Dos rutas que lo consumen:**
  - `/auto-alta/[token]` → `frontend/src/app/auto-alta/[token]/page.tsx` (server component, `await params` Next.js 16+, ver líneas 88-89) → pasa `source="TOKEN"`.
  - `/solicitar-alta` → `frontend/src/app/solicitar-alta/page.tsx` (server component, ver líneas 23-44) → pasa `source="PUBLIC"` con `initial.status='ACTIVE'` sintético (placeholder 2099).
- **Estado actual del form (ver SelfRegistrationForm.tsx):**
  - Líneas 243-306: `useState` único `form` con ~30 campos (fiscal, bancario, rep_legal, rh, cxp, facturación, entregaFisica, referencias[3], terminos).
  - Líneas 209-216: `useState` separado `uploads` con metadatos de 6 secciones de archivos ya subidos a S3 (`Record<SeccionDoc, UploadedFile | null>`).
  - Líneas 217-224: `useState` `uploading` (flags por sección).
  - Líneas 206-208: `isPending`, `submitError`, `success`.
  - Líneas 226-242: `publicScopeRef` (useRef) — random8 generado perezosamente para scope de storage público. Para TOKEN se usa `tokenHash.slice(0,8)` (ver líneas 359-360).
  - Líneas 308-310: `setField` helper.
  - Líneas 313-323: `setReferencia` helper.
  - Líneas 336-401: `handleUpload` — sube a `/api/v1/upload-only` con key `companies/selfreg/{tokenHash[:8]}/{seccion}/{filename}` (TOKEN) o `companies/public/{random8}/{seccion}/{filename}` (PUBLIC).
  - Líneas 403-523: `handleSubmit` — arma payload (ver líneas 432-503) y llama server action según `source`.
  - Líneas 525-536: vista de `success` (regresa early antes del form).
- **Server actions:** `submitCompanySelfRegistrationAction(token, payload)` y `submitPublicCompanySelfRegistrationAction(payload)` en `frontend/src/actions/company.actions.ts` (no se modifican).
- **NO toca:** schema Prisma, migraciones, backend Python, server actions, server components (páginas), ADR-20260624-01.

## 3. Decisiones arquitectónicas (resueltas por INTEGRA)

### D1 — Storage: `localStorage`
- Frank pidió explícitamente cubrir el caso "se les cierra" = cierre completo del navegador.
- `sessionStorage` no persiste tras cierre completo del navegador (solo entre pestañas de la misma sesión).
- `localStorage` persiste tras cierre completo. **Decisión: `localStorage`.**
- **Riesgo XSS aceptado y mitigado:** los datos fiscales (RFC, domicilio, teléfonos) en localStorage son vulnerables a XSS. Mitigaciones: (a) es un form público donde el prospecto ingresa SUS PROPIOS datos, no datos de terceros; (b) el draft se elimina al submit exitoso; (c) TTL 30d limpiar automáticamente; (d) no se persisten archivos binarios, solo metadatos; (e) el proyecto ya usa `dangerouslySetInnerHTML` prohibido por AGENTS.md (verificar que el form no lo use — ver líneas 538-931, confirmar no usa).

### D2 — Alcance: Opción B (recomendada por ATLAS, validada por INTEGRA)
- A (mínima ~50 líneas) no maneja uploads metadata, ni TTL, ni versionado → riesgo de drafts rotos en futuro.
- **B (~150 líneas):** A + manejo de uploads metadata + banner modal bloqueante + TTL 30d + versionado schema + keys separadas. **Decisión: Opción B.**
- C (premium ~300 líneas): B + cleanup S3 + cifrado AES cliente + telemetría. **Descartada:** cifrado AES con passphrase del usuario = UX pésima para form público que se descarta al submit. Telemetría de abandono = scope creep. Cleanup S3 al expirar = backend, tarea separada.

### D3 — UX del banner: Opción B (modal bloqueante con preview)
- A (banner persistente no bloqueante): el prospecto podría no verlo.
- **B (modal bloqueante al cargar con preview):** fuerza la decisión, muestra qué se recuperaría, permite "Continuar" o "Empezar de nuevo". Patrón estándar (LinkedIn, Google Forms). **Decisión: Opción B.**
- C (toast con botón): fugaz, el prospecto puede perderlo.
- D (cargar automáticamente sin preguntar): peligroso si el prospecto empezó con datos erróneos.

### D4 — TTL: 30 días
- Frank mencionó "clientes que tardan en completar formularios". Procesos B2B de alta de empresa son lentos (RFC, representante legal, referencias, etc.).
- 7 días muy corto. "Indefinido hasta submit" = riesgo de localStorage lleno de drafts zombies.
- **Decisión: 30 días.** Al cargar el draft, si `Date.now() - savedAt > 30 * 24 * 3600 * 1000`, descartar silenciosamente y no restaurar.

### D5 — Multi-form: Keys separadas por `source` + `scope`
- Un prospecto que usa el link del vendedor (`/auto-alta/[token]`) NO debe ver el draft de un prospecto que usó el link público (`/solicitar-alta`).
- Riesgo real: PC compartido en feria de negocios, oficina, cibercafé.
- **Decisión: keys separadas.** Key compuesta por `source` + `scope`:
  - `TOKEN`: scope = `tokenHash.slice(0,8)` (mismo hash que ya se usa para storage S3, ver SelfRegistrationForm.tsx líneas 359-360).
  - `PUBLIC`: scope = `publicScopeRef.current` (mismo random8 que ya se genera para storage S3, ver líneas 226-242).
- Esto asegura que drafts de diferentes prospectos/links no colisionen.

### D6 — Manejo de uploads en draft: solo metadatos, re-vincular al submit
- Los archivos ya están en S3 vinculados al scope (`companies/selfreg/{tokenHash[:8]}/` o `companies/public/{random8}/`).
- Al restaurar el draft, los metadatos (`key`, `fileUrl`, `filename`, `size`, `mime`, `extension`, `seccion`) se mantienen y se re-vinculan al submit.
- **NO re-subir al submit** (UX pésima — el prospecto ya subió los archivos).
- **NO limpiar S3 al expirar el draft** (eso es backend, tarea separada; ya documentado en ADR-20260624-01 riesgo #4 como "cron de limpieza (fuera de este corte) o scope dedicado que admin puede purgar").
- **Decisión: solo metadatos en draft; al restaurar, los archivos siguen en S3 y se re-vinculan al submit.**

## 4. Alcance (Incluido / Excluido)

### Incluido
1. Hook `useSelfRegDraft` con lógica de persistencia (debounced autosave + restore + clear).
2. Utilidades puras `self-reg-draft.ts` (key generation, serialización, TTL check, version check) — separadas para testabilidad.
3. Modal `DraftRestoreModal` bloqueante con preview de campos recuperados.
4. Integración en `SelfRegistrationForm.tsx`: restore al mount, autosave debounced en cada cambio de `form`/`uploads`, cleanup al submit exitoso, cleanup al descartar.
5. Versionado de schema del draft (`version: 1`).
6. TTL 30 días con descarte silencioso.
7. Keys separadas por `source` + `scope`.
8. Tests unitarios de utilidades (`self-reg-draft.test.ts`).

### Excluido (explícito)
- Cifrado AES en cliente (UX no justificada para form público).
- Telemetría de abandono (scope creep).
- Cleanup de archivos huérfanos en S3 al expirar draft (backend, tarea separada — ver ADR-20260624-01 riesgo #4).
- Multi-paso con guardado parcial server-side (la V1 sigue siendo submit atómico).
- Sincronización cross-device (requiere backend; fuera de alcance).

## 5. Archivos a tocar (estimado 5)

| # | Archivo | Acción | Estimado |
|---|---|---|---|
| 1 | `frontend/src/lib/self-reg-draft.ts` | NUEVO | ~80 líneas |
| 2 | `frontend/src/lib/hooks/useSelfRegDraft.ts` | NUEVO | ~60 líneas |
| 3 | `frontend/src/components/companies/DraftRestoreModal.tsx` | NUEVO | ~70 líneas |
| 4 | `frontend/src/components/companies/SelfRegistrationForm.tsx` | MODIFICAR | +~40 líneas (integración hook + modal + cleanup) |
| 5 | `frontend/src/lib/__tests__/self-reg-draft.test.ts` | NUEVO | ~100 líneas (tests unitarios) |

**Total estimado:** ~350 líneas (dentro de Opción B ±10%).

## 6. Contrato técnico

### 6.1 `frontend/src/lib/self-reg-draft.ts` (utilidades puras)

Tipos y funciones exportadas (NO es código de producción aquí; es contrato para SOFIA):

```ts
// Versión del schema del draft. Si se agrega un campo al form en el futuro,
// bumpar a 2. Al cargar, si draft.version !== CURRENT_VERSION, descartar.
export const DRAFT_SCHEMA_VERSION = 1 as const

// TTL en ms (30 días).
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000

// Debounce para autosave (no escribir en cada keystroke).
export const DRAFT_SAVE_DEBOUNCE_MS = 800

// Estructura del draft persistido en localStorage.
export interface SelfRegDraft {
  version: 1
  savedAt: number  // epoch ms (Date.now())
  source: 'TOKEN' | 'PUBLIC'
  scope: string    // tokenHash8 o publicScope8 — para validar consistencia al restore
  form: Record<string, unknown>      // todo el objeto `form` del useState
  uploads: Record<string, unknown> | null  // todo el objeto `uploads` del useState (solo metadatos)
}

// Genera la key de localStorage compuesta por source + scope.
// Ej: 'ami:selfreg:draft:v1:TOKEN:a1b2c3d4'
//     'ami:selfreg:draft:v1:PUBLIC:e5f6g7h8'
export function buildDraftKey(source: 'TOKEN' | 'PUBLIC', scope: string): string

// Serializa el draft a JSON y lo guarda en localStorage.
// Try/catch around setItem: si localStorage lleno o bloqueado, no romper.
// Retorna true si se guardó, false si falló (log warn, no throw).
export function saveDraft(key: string, draft: SelfRegDraft): boolean

// Lee y parsea el draft de localStorage.
// Try/catch around getItem + JSON.parse: si corrupto, retorna null.
// Si savedAt + TTL < now, retorna null y limpia la entry (removeItem).
export function loadDraft(key: string): SelfRegDraft | null

// Elimina el draft de localStorage (submit exitoso o "Empezar de nuevo").
export function clearDraft(key: string): void
```

### 6.2 `frontend/src/lib/hooks/useSelfRegDraft.ts` (hook React)

```ts
interface UseSelfRegDraftOptions {
  source: 'TOKEN' | 'PUBLIC'
  scope: string  // tokenHash8 o publicScope8
  form: typeof form  // el estado del form
  uploads: typeof uploads  // el estado de uploads
  enabled?: boolean  // default true; false desactiva autosave (ej. tras success)
}

interface UseSelfRegDraftResult {
  savedDraft: SelfRegDraft | null  // draft cargado al mount (null si no hay o expiró)
  isRestored: boolean  // true si el usuario eligió "Continuar"
  dismissRestore: () => void  // usuario eligió "Empezar de nuevo" → clearDraft + isRestored=false
  acceptRestore: () => void  // usuario eligió "Continuar" → isRestored=true (el form ya se hidrató)
  clearOnSubmit: () => void  // cleanup tras submit exitoso
}

export function useSelfRegDraft(options: UseSelfRegDraftOptions): UseSelfRegDraftResult
```

**Comportamiento:**
- Al mount: `loadDraft(key)` → si hay draft y no expiró y version coincide, exponer en `savedDraft`. Si no, `savedDraft=null`.
- Effect debounced (`DRAFT_SAVE_DEBOUNCE_MS`=800ms) sobre `[form, uploads]`: si `enabled` y `isRestored` (no restaurar antes de aceptar — evita sobreescribir draft viejo con form vacío antes de que el usuario decida), serializar y `saveDraft`.
- **Importante orden de effects:** el autosave NO debe dispararse antes de que el usuario decida restaurar. Si hay `savedDraft` pendiente, el autosave espera hasta `acceptRestore` o `dismissRestore`.
- `clearOnSubmit` llama a `clearDraft(key)`.

### 6.2.1 Aclaración de semántica de `isRestored` (ADDENDUM FIX-20260805-04-VERIFY)

**Origen:** Auditoría GEMINI RECHAZADA (B1+B2) detectó contradicción interna en §6.2. Resuelto por INTEGRA el 2026-08-05.

**Contradición detectada:**
- Línea de contrato: `dismissRestore: () => void // ... isRestored=false` (lectura literal → tras dismiss, `isRestored=false`).
- Comportamiento esperado (§6.2 líneas 180-181): "el autosave espera hasta `acceptRestore` **o** `dismissRestore`" → implica que tras cualquiera de los dos, el autosave está activo.

Estas dos afirmaciones son incompatibles: si tras dismiss `isRestored=false` y el gate de autosave es `enabled && isRestored`, el autosave queda desactivado permanentemente (B2). Esto contradice §1 (objetivo: persistir) y §8 criterios #1 (autosave tras 800ms) y #14 (scope estable desde primer keystroke).

**Semántica corregida (autoritativa):**

`isRestored` significa **"el usuario ya tomó una decisión sobre el restore"** (no "aceptó restaurar"). Es un gate de "decisión tomada", no de "aceptación".

Transiciones canónicas:
| Evento | `isRestored` resultante | Estado del form | Autosave |
|---|---|---|---|
| Mount sin draft (scope resuelto, no hay savedDraft) | `true` | vacío (default del useState) | ✅ activo |
| Mount con draft pendiente (savedDraft != null, scope resuelto) | `false` (esperar decisión) | vacío hasta decisión | ❌ bloqueado (evita sobreescribir draft viejo con form vacío) |
| `acceptRestore` | `true` | hidratado desde draft | ✅ activo |
| `dismissRestore` | `true` (FIX B2) | vacío (draft eliminado) | ✅ activo |
| Mount con `scope === ''` (TOKEN async no resuelto) | `false` (no decidir aún) | vacío | ❌ bloqueado hasta que scope se resuelva |
| `clearOnSubmit` (submit exitoso) | indiferente (form se desmonta via `success`) | — | hook deshabilitado via `enabled=false` |

**Gate canónico del autosave:** `enabled && isRestored` = "habilitado Y el usuario ya decidió (o no había draft que decidir)".

**Corolario B1 (ruta TOKEN, scope async):** el mount effect NO debe setear `isRestored=true` mientras `scope === ''`. Cuando `scope` se resuelve async (SHA-256 via `crypto.subtle.digest`), el effect re-corre (deps `[key]`) y ahí decide. Si aparece un draft tras la resolución, `isRestored` debe quedar `false` (re-abrir el gate de decisión) para que el modal se muestre. Esto evita la destrucción silenciosa del draft del usuario a los ~800ms.

**Corolario B2 (post-dismiss):** `dismissRestore` debe setear `isRestored=true` (no `false`). El form queda vacío (draft eliminado por `clearDraft`) y el autosave arranca limpio desde el primer keystroke posterior.

**Nota a SOFIA:** esta aclaración NO cambia la firma del hook ni el contrato de tipos. Solo precisa el comportamiento de `isRestored` y los efectos. Cualquier implementación que deje `isRestored=false` tras `dismissRestore` es un BUG (B2), no una decisión de diseño.

### 6.3 `frontend/src/components/companies/DraftRestoreModal.tsx`

```tsx
interface DraftRestoreModalProps {
  draft: SelfRegDraft
  onContinue: () => void  // acceptRestore
  onStartFresh: () => void  // dismissRestore
}
```

- Modal bloqueante (overlay fijo, no cerrable con click outside ni Esc — decisión explícita para forzar elección).
- Muestra preview legible de los campos recuperados (no el JSON crudo): contar cuántas secciones tienen datos (ej. "3 de 10 secciones con datos"), listar nombres de archivos subidos (`filename` por sección).
- Dos botones: "Continuar donde me quedé" (primario, indigo) y "Empezar de nuevo" (secundario, slate).

### 6.4 Integración en `SelfRegistrationForm.tsx`

**En `SelfRegistrationFormActive` (líneas 193-932):**

1. **Importar** hook, modal y utilidades.
2. **Calcular scope:** ya disponible — para TOKEN: `tokenHash.slice(0,8)` (ver líneas 359-360, extraer a useMemo); para PUBLIC: `publicScopeRef.current` (ver líneas 226-242). **Nota:** el scope para PUBLIC se genera perezosamente en el primer upload. Para el draft, si aún no hay scope (usuario no ha subido nada), usar un scope estable derivado de una ref generada al mount (mismo random8 que se usaría para S3). Esto asegura que el draft persista desde el primer keystroke, no solo desde el primer upload.
3. **Llamar hook:**
   ```ts
   const draftApi = useSelfRegDraft({ source, scope, form, uploads, enabled: !success })
   ```
4. **Aplicar restore:** si `draftApi.savedDraft && !draftApi.isRestored`, renderizar `<DraftRestoreModal>`. Al aceptar, hidratar `form` y `uploads` desde el draft (vía `setForm`/`setUploads` en el callback `acceptRestore`, o exponer el draft y que el componente lo aplique). **Decisión:** el hook expone `savedDraft` y el componente aplica los valores en `acceptRestore` callback para mantener el hook puro.
5. **Cleanup al submit exitoso:** en `handleSubmit` (líneas 505-522), dentro del bloque `if (result.ok)`, antes de `setSuccess`, llamar `draftApi.clearOnSubmit()`.
6. **No restaurar si token inválido:** el guard ya existe (líneas 124-127, 142-144). Si `initial.status !== 'ACTIVE'`, el form no se renderiza activo, así que el hook no se invoca y el draft queda en localStorage hasta TTL. Aceptable.

## 7. Casos borde

| # | Caso | Comportamiento esperado |
|---|---|---|
| 1 | Token expira mientras hay draft | Form muestra `InvalidTokenView`, draft queda en localStorage hasta TTL. Nuevo link → nuevo tokenHash → nueva key → draft viejo huérfano hasta TTL. |
| 2 | Prospecto usó link público y luego link de vendedor | Keys distintas, no colisionan. |
| 3 | Usuario re-sube archivo que ya está en draft | Draft se actualiza con nuevo metadato; archivo viejo queda huérfano en S3 (aceptable, ya es el caso hoy). |
| 4 | `localStorage` lleno (QuotaExceededError) | `saveDraft` retorna false, log warn, no romper. El form sigue funcionando sin persistencia. |
| 5 | Draft corrupto (JSON inválido) | `loadDraft` retorna null, no restaurar, continuar vacío. Opcional: `clearDraft` para limpiar la entry corrupta. |
| 6 | Version mismatch (draft v1 cargado con schema v2 futuro) | `loadDraft` retorna null (descartar silenciosamente), no restaurar. |
| 7 | Scope mismatch (draft de PUBLIC cargado en TOKEN) | La key incluye `source`, así que no puede pasar por key normal. Si pasa por edición manual de localStorage, validar `draft.source === source && draft.scope === scope` al restore; si mismatch, descartar. |
| 8 | Submit falla (no ok) | NO limpiar draft. El usuario puede reintentar. |
| 9 | Submit exitoso pero `setSuccess` ya cambió el render | El cleanup debe pasar antes o en el momento del `setSuccess`. Orden: `clearOnSubmit()` → `setSuccess()`. |
| 10 | SSR / hydration | El draft se lee en `useEffect` (client-side), no en `useState` initializer. Primer render = estado vacío (igual que hoy). Evita hydration mismatch (problema #418 ya documentado para `expiresAtLabel`/`fecha`). |
| 11 | Usuario cierra modal con Esc | Modal NO cerrable con Esc ni click outside — debe elegir un botón explícito. |
| 12 | Prospecto reabre form en otro navegador | No sincroniza cross-device (fuera de alcance). Cada navegador tiene su propio draft. |
| 13 | `publicScopeRef` aún no generado al primer keystroke | Generar random8 estable al mount (no perezosamente) para que el draft tenga scope desde el primer cambio. El `publicScopeRef` actual (líneas 226-242) se genera perezosamente en el primer upload; para el draft se necesita antes. **Decisión:** inicializar `publicScopeRef` al mount del componente activo (no perezoso) para PUBLIC. Verificar que esto no rompa el comportamiento existente de S3 (debe usar el mismo valor). |

## 8. Criterios de aceptación (verificables)

1. **Autosave:** tras 800ms de inactividad tras un cambio en cualquier campo de `form` o `uploads`, existe una entry en `localStorage` con key `ami:selfreg:draft:v1:{source}:{scope}` y valor JSON parseable con `version: 1`, `savedAt` reciente, `source`, `scope`, `form` y `uploads`.
2. **Restore al mount:** al reabrir el form (cerrar tab/navegador y reabrir URL), si hay draft no expirado con version y scope coincidentes, se muestra `DraftRestoreModal` bloqueante.
3. **Continuar:** al presionar "Continuar donde me quedé", los campos del form y los metadatos de uploads se hidratan desde el draft y el modal desaparece.
4. **Empezar de nuevo:** al presionar "Empezar de nuevo", el draft se elimina de localStorage y el form queda vacío.
5. **Cleanup al submit exitoso:** tras un submit exitoso (server action retorna `ok: true`), la entry de localStorage se elimina. Verificable con `localStorage.getItem(key) === null` tras el success.
6. **No cleanup al submit fallido:** tras un submit fallido, la entry persiste.
7. **TTL 30 días:** si `Date.now() - draft.savedAt > 30 * 24 * 3600 * 1000`, `loadDraft` retorna null y la entry se elimina (removeItem).
8. **Version mismatch:** si se edita manualmente el draft a `version: 99`, `loadDraft` retorna null (descartar silenciosamente).
9. **Keys separadas:** draft guardado en `/auto-alta/[token]` NO aparece al abrir `/solicitar-alta` (y viceversa).
10. **No hydration mismatch:** primer render del form (antes del effect de restore) es idéntico al actual (estado vacío). El modal aparece tras el mount, no antes.
11. **localStorage lleno:** si `localStorage.setItem` lanza `QuotaExceededError`, el form sigue funcionando sin persistencia (no crashea).
12. **Draft corrupto:** si se edita manualmente el JSON a inválido, el form abre vacío sin crashear.
13. **No persiste archivos binarios:** el draft solo contiene metadatos (`key`, `fileUrl`, `filename`, `size`, `mime`, `extension`, `seccion`), nunca `File`/`Blob`/datos binarios.
14. **Scope estable para PUBLIC desde primer keystroke:** el draft se guarda desde el primer cambio de campo, no solo desde el primer upload.

## 9. Definition of Done (DoD)

- [ ] Los 5 archivos listados en §5 están implementados y commiteados (sin commit/push — espera OK Frank).
- [ ] Criterios 1-14 de §8 verificados.
- [ ] `pnpm typecheck` (o `npm run typecheck`) → 0 errores.
- [ ] `pnpm test` (o `npm test -- --run`) → verde, incluye nuevos tests de `self-reg-draft.test.ts`.
- [ ] `pnpm lint` (o `npm run lint`) → 0 errores.
- [ ] Prueba E2E manual: llenar 5 campos → cerrar tab → reabrir → verificar modal de restore → "Continuar" → campos hidratados.
- [ ] Prueba E2E manual: llenar 5 campos → submit exitoso → verificar `localStorage.getItem(key) === null`.
- [ ] Prueba E2E manual: editar draft en DevTools a `savedAt` viejo (>30d) → reabrir → verificar que NO se restaura y se elimina.
- [ ] Prueba E2E manual: draft en `/auto-alta/[token]` NO aparece en `/solicitar-alta`.
- [ ] Self-review SOFIA: ¿El código refleja la SPEC? ¿Hay code smells? ¿Los tests cubren edge cases? ¿Riesgo de regresión?
- [ ] Auditoría GEMINI (subagent_type='gemini') como segunda mano de validación (Qodo está sunset).

## 10. Validaciones obligatorias (handoff a SOFIA)

```bash
cd frontend && npm run typecheck
cd frontend && npm test -- --run
cd frontend && npm run lint
```

Si los scripts usan `pnpm`, usar `pnpm` en su lugar. Detectar el gestor del proyecto (`package.json` → `packageManager` field o presencia de `pnpm-lock.yaml`).

## 11. Riesgos y mitigaciones

| Riesgo | Prob | Impacto | Mitigación |
|---|---|---|---|
| XSS roba datos fiscales del draft | Medio | Medio | Form público con datos propios del prospecto; cleanup al submit; TTL 30d; no archivos binarios. Aceptado. |
| `server action` cambia payload shape → draft viejo falla al submit | Bajo | Alto | Versionado del draft (`version: 1`); al cambiar payload, bumpar version y descartar drafts viejos. |
| Performance: serializar 30 campos en cada cambio | Medio | Bajo | Debounce 800ms obligatorio. |
| `publicScopeRef` cambia de perezoso a eager → archivos S3 huérfanos si usuario nunca sube pero se generó scope | Bajo | Bajo | El scope solo se genera al mount del form activo, no al cargar la página. Si el form nunca se monta (InvalidTokenView), no se genera. El scope existe solo en cliente, no crea entry en S3 hasta que se suba un archivo. |
| Hydration mismatch | Bajo | Medio | Draft se lee en `useEffect`, no en `useState` initializer. Primer render idéntico al actual. |
| localStorage quota excedida | Bajo | Bajo | `saveDraft` try/catch, no romper. |

## 12. Out of scope (explícito)

- Cifrado AES en cliente (UX no justificada).
- Telemetría de abandono.
- Cleanup de archivos huérfanos en S3 al expirar draft (backend, tarea separada — ADR-20260624-01 riesgo #4).
- Sincronización cross-device.
- Multi-paso server-side.
- Cambios en schema Prisma, backend, server actions, server components (páginas).

## 13. Referencias

- `frontend/src/components/companies/SelfRegistrationForm.tsx` — componente a modificar (líneas 116-932).
- `frontend/src/app/auto-alta/[token]/page.tsx` — ruta con token (líneas 88-89 `await params`).
- `frontend/src/app/solicitar-alta/page.tsx` — ruta pública (líneas 23-44 `initial` sintético).
- `context/decisions/ADR-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md` — riesgo #4 storage huérfano (fuera de este corte).
- `context/SPECs/SPEC_ARCH-20260624-01-RUTA-PUBLICA-SIN-TOKEN.md` — SPEC predecesora.
- Origen: escalamiento ATLAS M3 (FIX-20260805-04 pendiente).
