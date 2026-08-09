# SPEC_ARCH-20260809-03 — Gestión runtime de API Keys de IA vía UI (sin env vars ni redeploys)

- **ID:** ARCH-20260809-03
- **Tipo:** Arquitectónica (L3)
- **Estado:** READY (cumple DoR)
- **Autor:** INTEGRA (Muse Spark 1.1)
- **Fecha:** 2026-08-09
- **ADR:** `context/decisions/ADR-20260809-03-GESTION-API-KEYS-IA-RUNTIME.md`
- **Origen:** Escalamiento ATLAS M3 desde necesidad explícita de Frank.
- **Handoff SOFIA:** `context/interconsultas/HANDOFF_ARCH-20260809-03_SOFIA_MANAGE-AI-API-KEYS.md`

---

## 0. Resumen ejecutivo

Endpoint UI + backend para insertar/rotar/borrar API keys de los proveedores IA (M3, Gemini, DR7/MedGemma) sin tocar env vars ni redeploys. Las keys se cifran en BD (AES-256-GCM), el backend las lee vía un `KeyResolver` (caché TTL 60 s + invalidación en escritura) que consulta la BD si existe y cae a env var como fallback. Feature flag `AI_KEYS_FROM_DB_ENABLED` (default `false`) hace el rollout opt-in y reversible. Solo SUPERADMIN edita; ADMIN ve listado mascareado.

---

## 1. Estado actual de lectura de keys (interconsulta DEBY — sustituida por lectura focalizada INTEGRA)

> **Nota de proceso:** la SPEC encargaba interconsulta previa a DEBY vía `task` con `subagent_type='debugger'`. En esta sesión **no está provisionado el mecanismo `task` ni existe CLI `kilo`**. `agent_manager` queda descartado por §14.7 (solo fan-out visible pedido explícitamente). INTEGRA ejecutó lectura focalizada sobre `base.py`, `prediagnostic.py`, `extractor.py`, `main.py`. **SOFIA debe re-verificar este patrón en su baseline (Fact-Forcing) antes de implementar.**

| Componente | Línea | Patrón | Cachea en |
|---|---|---|---|
| `GeminiBase.__init__` | `base.py:112` | `self.api_key = api_key or _read_env_var("GEMINI_API_KEY")` | `__init__` |
| `M3VisionBase.__init__` | `base.py:406-416` | `self.api_key/base_url/model = … or _read_env_var(…)` | `__init__` |
| `FeatherlessVisionBase.__init__` | `base.py:250-260` | idem | `__init__` |
| `prediagnostic.py` | `prediagnostic.py:38-44` | `DR7_API_KEY = os.environ.get(...)` constante de módulo | import |
| `main.py` | `main.py:149-173` | constantes de módulo `GEMINI_API_KEY`, `M3_API_KEY`, `DR7_API_KEY` | boot |
| `main.py` construcción | `main.py:257-259` | servicios construidos con `api_key=<constante>` | boot |
| `extractor.py` | `extractor.py:308-360` | `os.environ.get("M3_API_KEY")` fresco en checks de capacidad | (pero la instancia ya cacheó en `__init__`) |

**Conclusión:** rotación runtime **no toma efecto sin reinicio** en la arquitectura actual. El `KeyResolver` + refactor de los `__init__`/constantes es **condición necesaria** del requisito "rotación inmediata sin reinicio" (§AC-7).

---

## 2. Alcance

### In-scope
- Modelo Prisma `AIProviderKey` + migración.
- `KeyResolver` backend (cifrado AES-256-GCM, precedencia BD→env, caché TTL 60 s + invalidación).
- Refactor de `GeminiBase`, `M3VisionBase`, `FeatherlessVisionBase`, `PrediagnosticService`, `ExtractorService` para leer keys vía resolver en cada llamada.
- Endpoints FastAPI `GET/PUT/DELETE /api/v2/admin/ai-keys`.
- UI `/admin/ai-keys` + server actions con guard SUPERADMIN.
- `key_source` en metadatos de auditoría de cada corrida IA.
- Extensión de `GET /api/v2/ai/status` con `key_source` por proveedor.
- Feature flag `AI_KEYS_FROM_DB_ENABLED`.
- Tests backend (pytest) + frontend (vitest) + tests manuales.

### Out-of-scope
- Migración automática de env vars a BD (no se auto-puebla; Frank puebla vía UI cuando active el flag).
- Integración con KMS/Vault externo.
- Rotación automática de `ENCRYPTION_KEY` (manual, documentada en ADR §D2).
- Gestión de keys por tenant multi-empresa (single-tenant hoy).

---

## 3. Modelo de datos

### 3.1 Prisma — `AIProviderKey` (tabla `ai_provider_keys`)

```prisma
model AIProviderKey {
  id            String   @id @default(uuid())
  provider      String   @unique           // "m3" | "gemini" | "dr7"
  keyCiphertext Bytes                       // AES-256-GCM ciphertext
  keyNonce      Bytes                       // 12-byte nonce (reusable para decrypt)
  keyTag        Bytes                       // 16-byte GCM auth tag
  baseUrl       String?                     // override opcional de la base URL
  defaultModel  String?                     // override opcional del modelo default
  enabled       Boolean  @default(true)
  updatedBy     String?                     // userId del SUPERADMIN que editó
  updatedAt    DateTime @updatedAt
  user          User?    @relation(fields: [updatedBy], references: [id])

  @@map("ai_provider_keys")
}
```

> Agregar `@@index` por `provider` solo si se prevé lookup por no-unique; `@unique` ya crea índice. SOFIA: verificar que `User` tenga la back-relation `aiProviderKeys AIProviderKey[]` (campo nuevo en `model User`).

**Migración:** seguir el patrón de `IMPL-20260730-01` (migración `20260730000000_add_superadmin_role`): crear `backend/prisma/migrations/<timestamp>_add_ai_provider_key/migration.sql` + mantener sincronizados **ambos** `backend/prisma/schema.prisma` y `frontend/prisma/schema.prisma`. Aplicar vía el flujo existente (`sync-prisma-migrations.ts` / `check-migrations-state.ts`). No tocar datos existentes.

### 3.2 Reutilización de `AuditLog` (sin migración)

Cada `PUT`/`DELETE` escribe en `audit_logs` (modelo ya existe, `schema.prisma:451-463`):
- `action`: `"ai_key_updated"` (PUT) | `"ai_key_deleted"` (DELETE)
- `entity`: `"AIProviderKey"`
- `entityId`: `<provider>` (ej. `"m3"`)
- `details`: `{ provider, updatedBy, maskedKeySuffix, source:"ui", fieldsChanged:["apiKey","baseUrl"?,"defaultModel"?], previousUpdatedAt? }`
- **Prohibido** loguear la key completa, el ciphertext, el nonce o el tag.

---

## 4. Cifrado

- Algoritmo: **AES-256-GCM** vía `cryptography.hazmat.primitives.ciphers.aead.AESGCM`.
- Key: env var `ENCRYPTION_KEY` (32 bytes, base64). Solo backend.
- Nonce: 12 bytes aleatorios por cifrado (`os.urandom(12)`), almacenado en `keyNonce`.
- Auth tag: 16 bytes, almacenado en `keyTag`.
- Módulo: `backend/app/services/ai/keys.py` (nuevo) con funciones `encrypt_key(plaintext, master_key) -> (ciphertext, nonce, tag)` y `decrypt_key(ciphertext, nonce, tag, master_key) -> plaintext` y clase `KeyResolver`.
- **Nunca** la key descifrada sale del proceso backend ni se loguea.

---

## 5. `KeyResolver` — contrato y comportamiento

```python
class KeyResolver:
    def resolve(self, provider: str) -> KeyResolution: ...
    def invalidate(self, provider: str) -> None: ...  # llamado por PUT/DELETE tras commit
```

`KeyResolution` = `dataclass(provider, apiKey, baseUrl, defaultModel, source, warning?)` donde:
- `source`: `"env" | "db"`
- `warning`: `None | "flag_off" | "db_unavailable" | "decrypt_error" | "row_missing" | "row_disabled"`

### 5.1 Algoritmo `resolve(provider)`
1. Si `AI_KEYS_FROM_DB_ENABLED != "true"` → retornar env var (`source="env"`, `warning="flag_off"`). **Comportamiento idéntico al actual.**
2. Si flag on: leer caché en memoria (TTL 60 s). Si hay entrada fresca → retornarla.
3. Si no: consultar `AIProviderKey` por `provider`.
   - Sin row → env var (`source="env"`, `warning="row_missing"`).
   - `enabled=false` → env var (`source="env"`, `warning="row_disabled"`).
   - `enabled=true` → descifrar. Si descifrado lanza (`InvalidTag`/cualquier excepción) → env var (`source="env"`, `warning="decrypt_error"`), **y loguear** el error (sin exponer la key).
   - Descifrado OK → (`source="db"`, sin warning).
4. Llenar caché con el resultado (incluso los fallback, para no reconsultar BD en cada inferencia dentro del TTL).
5. Si la BD misma lanza (conexión caída) → env var (`source="env"`, `warning="db_unavailable"`).

### 5.2 Invalidación
- `PUT`/`DELETE` llaman `resolver.invalidate(provider)` tras commit de BD → elimina la entrada de caché → la siguiente `resolve` reconsulta BD.

### 5.3 Refactor de services (condición necesaria para rotación inmediata — ver §1)
- `GeminiBase`/`M3VisionBase`/`FeatherlessVisionBase`: al inicio de **cada** `call_*` (ej. `call_gemini`, `call_m3`, `call_featherless_vision`), llamar `self._refresh_keys()` que, si hay un resolver inyectado, sobrescribe `self.api_key/base_url/model` desde `resolver.resolve(...)`. Si no hay resolver (tests legacy), conservar el comportamiento `__init__`.
- `PrediagnosticService`: convertir las constantes de módulo (`prediagnostic.py:38-44`) a propiedades/lecturas que pasen por el resolver en cada uso (DR7_API_KEY, DR7_BASE_URL, DR7_MODEL, MEDGEMMA_ENABLED). Mantener los defaults hardcode como fallback del env var.
- `ExtractorService`: los checks de capacidad (`extractor.py:308-360`) y la construcción de instancias M3/Gemini deben usar el resolver.
- `main.py:257-259`: construir los servicios **sin** pasar `api_key=<constante>` (dejar que el resolver lo provea en cada llamada), o pasar el resolver al constructor. El endpoint `/api/v2/ai/status` ya lee fresco (`_read_env_var`) — extender para reflejar `key_source`.

---

## 6. Contrato de endpoints (FastAPI)

Base path: `/api/v2/admin/ai-keys`. Todos requieren header `x-ami-role` (defense-in-depth; el guard real es la server action NextAuth).

### 6.1 `GET /api/v2/admin/ai-keys`
- **Roles backend:** `x-ami-role` ∈ `{ADMIN, SUPERADMIN}` → 200; resto → 403.
- **Respuesta 200:** `{ providers: [ { provider, present, keySuffix|null, baseUrl, defaultModel, source, updatedAt, enabled } ] }`
  - `present`: booleano (hay key en BD y descifró OK).
  - `keySuffix`: últimos 4 chars de la key descifrada (para identificación visual), o `null` si `present=false`.
  - `source`: `"env" | "db"` (de dónde toma el resolver *ahora*).
  - **Nunca** la key completa.
- Lista siempre los 3 proveedores canónicos (`m3`, `gemini`, `dr7`), rellenando con `present:false` si no hay row.

### 6.2 `PUT /api/v2/admin/ai-keys/{provider}`
- **Roles backend:** `x-ami-role == "SUPERADMIN"` → 200; resto → 403.
- **Path param:** `provider` ∈ `{m3, gemini, dr7}` → si no, 400.
- **Body (JSON, Zod-equivalente en backend con Pydantic):** `{ apiKey: string (no vacío, máx 512), baseUrl?: string (URL), defaultModel?: string (máx 128), expectedUpdatedAt?: string (ISO, optimistic locking) }`
- **Lógica:**
  1. Si `ENCRYPTION_KEY` ausente o inválida → 503 `{ detail: "ENCRYPTION_KEY no configurada; no se pueden almacenar secretos" }`.
  2. Validar `apiKey` no vacío.
  3. Si `expectedUpdatedAt` presente y el row existe con `updatedAt != expectedUpdatedAt` → 409 `{ detail: "conflict", currentUpdatedAt }` (race condition).
  4. Cifrar `apiKey` (AES-256-GCM, nonce aleatorio).
  5. Upsert en `AIProviderKey` (`provider`, `keyCiphertext`, `keyNonce`, `keyTag`, `baseUrl`, `defaultModel`, `enabled=true`, `updatedBy=<userId del header o claim>`).
  6. Escribir `AuditLog` (`action="ai_key_updated"`, `entityId=provider`, `details` con `maskedKeySuffix` = últimos 4).
  7. `resolver.invalidate(provider)`.
  8. **No** loguear la key completa.
- **Respuesta 200:** `{ provider, present:true, keySuffix, updatedAt, source:"db" }`.

### 6.3 `DELETE /api/v2/admin/ai-keys/{provider}`
- **Roles backend:** `x-ami-role == "SUPERADMIN"` → 200; resto → 403.
- **Lógica:** delete del row `AIProviderKey` por `provider`. Si no existe → 404. Escribir `AuditLog` (`action="ai_key_deleted"`). `resolver.invalidate(provider)`.
- **Efecto runtime:** la siguiente `resolve` retorna env var (`source="env"`, `warning="row_missing"`). No elimina la env var (sigue como fallback).
- **Respuesta 200:** `{ provider, present:false, source:"env" }`.

### 6.4 Extensión `GET /api/v2/ai/status` (sin cambios de contrato público, solo campos nuevos)
- Añadir `key_source`: `{ m3: "env"|"db", gemini: "env"|"db", dr7: "env"|"db" }` y `ai_keys_from_db_enabled: <bool>`. Mantener los `*_key_present` booleanos existentes (`main.py:630-634`) por compatibilidad.

---

## 7. Frontend — UI y server actions

### 7.1 Server actions (`frontend/src/actions/ai-keys.actions.ts`, nuevo)
- `listAIProviderKeys()` — server action; valida sesión NextAuth + `isSuperAdmin(role) || isAdminLike(role)` (ADMIN puede listar); llama `GET /api/v2/admin/ai-keys` con header `x-ami-role`.
- `updateAIProviderKey({ provider, apiKey, baseUrl?, defaultModel? })` — server action; **`isSuperAdmin(role)`** obligatorio (si no → throw 403); llama `PUT`.
- `deleteAIProviderKey({ provider })` — server action; **`isSuperAdmin`** obligatorio; llama `DELETE`.
- **Nunca** retornar la key completa al cliente (el backend ya no la expone).

### 7.2 Página UI (`frontend/src/app/admin/ai-keys/page.tsx`, nuevo)
- Ruta bajo `/admin/*` → `middleware.ts` ya aplica `isAdminLike` (ADMIN+SUPERADMIN llegan a la página).
- La página renderiza un **gate SUPERADMIN** client-side: si `role !== 'SUPERADMIN'` muestra "Solo SUPERADMIN puede gestionar API keys" (los botones de editar/borrar se ocultan para ADMIN; ADMIN solo ve el listado mascareado).
- Componente `AIProviderKeyManager.tsx` (nuevo, client): por cada proveedor, tarjeta con:
  - Estado actual: `present` (badge), `keySuffix` (mascareado `••••••••abcd`), `source` (env/db), `baseUrl`, `defaultModel`, `updatedAt`.
  - Edición: input `type="password"` para la nueva key, input opcional `baseUrl`, input opcional `defaultModel`, **campo de confirmación** (segundo input password) que debe coincidir.
  - Botón "Guardar" (SUPERADMIN) y "Eliminar" (SUPERADMIN, con confirmación modal).
  - Next.js 16: `params`/`searchParams` son `Promise` — usar `await params` (regla del AGENTS.md del proyecto, no reportar como error).

### 7.3 Navegación
- Añadir enlace "API Keys IA" en el sidebar admin, **visible solo para SUPERADMIN** (render condicional con `isSuperAdmin(role)`). ADMIN no ve el enlace (aunque pueda llegar por URL, el gate de la página lo contiene).

### 7.4 Roles helper
- Reutilizar `frontend/src/lib/auth/roles.ts` (`isSuperAdmin`, `isAdminLike`) — sin cambios.

---

## 8. Política de seguridad

1. La key descifrada **nunca** sale del proceso backend, ni en logs, ni en respuestas HTTP, ni en `console.log`.
2. `maskedKeySuffix` = últimos 4 chars únicamente.
3. `ENCRYPTION_KEY` debe existir antes de cualquier `PUT`; si no, 503.
4. Guard real: server action con sesión NextAuth + `isSuperAdmin`. Backend: `x-ami-role` header (defense-in-depth).
5. Auditoría: cada cambio en `AuditLog` con `userId`, `ipAddress` (si disponible), `maskedKeySuffix`.
6. No se loguea el ciphertext, nonce, tag ni la key.
7. Rota `ENCRYPTION_KEY` solo con procedimiento manual documentado (ADR §D2).
8. `MEDGEMMA_ENABLED` + `DR7_API_KEY` (capa clínica) sigue su lógica actual; el resolver solo cambia **de dónde** se lee la key, no el flujo de habilitación.

---

## 9. Criterios de aceptación (≥10, verificables)

- **AC-1** Existe modelo `AIProviderKey` en ambos `schema.prisma` y migración aplicada; `check-migrations-state.ts` confirma tabla + índices.
- **AC-2** `KeyResolver.resolve("m3")` con flag off retorna env var y `source="env"`; con flag on y row presente retorna BD y `source="db"`.
- **AC-3** Cifrado roundtrip: `encrypt_key(k) → (c,n,t) → decrypt_key(c,n,t) == k`; descifrar con nonce/tag alterados lanza y el resolver cae a env var con `warning="decrypt_error"`.
- **AC-4** `PUT` por usuario no-SUPERADMIN (`x-ami-role="ADMIN"`) → 403. Server action sin sesión SUPERADMIN → throw.
- **AC-5** `GET` por ADMIN → 200 con `keySuffix` mascareado; **nunca** retorna la key completa (test de regresión: el body de respuesta no contiene el valor de la key insertada).
- **AC-6** Tras `PUT` de key M3 vía UI, la siguiente corrida de extracción usa M3 con `key_source="db"` (sin reinicio del proceso). Test manual + test de invalidación de caché.
- **AC-7** Tras `DELETE` de key M3, la siguiente corrida cae a env var (`source="env"`) si la env var existe, o a fallback Gemini si no.
- **AC-8** `ENCRYPTION_KEY` ausente → `PUT` retorna 503; `resolve` retorna env var con `warning="flag_off"` (no crashea).
- **AC-9** Cada `PUT`/`DELETE` escribe un `AuditLog` con `action`, `entity="AIProviderKey"`, `entityId=provider`, `details.maskedKeySuffix` presente y `details` **sin** la key completa.
- **AC-10** `key_source` aparece en `extraction_snapshot.audit` y en `GET /api/v2/ai/status` por proveedor.
- **AC-11** Race condition: `PUT` con `expectedUpdatedAt` desactualizado → 409 con `currentUpdatedAt`.
- **AC-12** Provider desconocido en path (`/ai-keys/openai`) → 400.
- **AC-13** Confirmación doble: la UI exige que el segundo input de key coincida con el primero antes de habilitar "Guardar" (test vitest del componente).
- **AC-14** Gates verdes: `pnpm/npm typecheck` 0 errores nuevos, `pnpm/npm test` (vitest) pasa, `pnpm/npm lint` 0 errores nuevos, `pytest backend/tests -v` pasa.

---

## 10. Casos borde

- **CB-1 Key corrupta / tag manipulado:** `decrypt_key` lanza → resolver cae a env var con `warning="decrypt_error"`, loguea el error (sin key), la inferencia no se cae.
- **CB-2 `ENCRYPTION_KEY` ausente:** `PUT` → 503; `resolve` → env var con `warning="flag_off"`.
- **CB-3 BD caída en runtime:** `resolve` captura excepción de Prisma → env var con `warning="db_unavailable"`.
- **CB-4 Race condition entre dos SUPERADMINs:** optimistic locking vía `expectedUpdatedAt` → el segundo recibe 409. Sin `expectedUpdatedAt` → last-write-wins (documentado, aceptable).
- **CB-5 Flag off pero BD tiene keys:** resolver ignora BD (flag es el gate); comportamiento = env-var-only.
- **CB-6 Env var ausente y BD sin row:** resolver retorna `None`/vacío → la service lanza su `ValueError` existente ("GEMINI_API_KEY no configurada"). No se inventa key.
- **CB-7 `provider` vacío o no canónico en path:** 400.
- **CB-8 `apiKey` vacío en `PUT`:** 400 (usar `DELETE` para limpiar).
- **CB-9 Múltiples réplicas del backend (escala horizontal):** la invalidación de caché es por-proceso; el TTL de 60 s garantiza convergencia. Aceptable (no se implementa pub/sub de invalidación en este corte).
- **CB-10 Compromiso de `ENCRYPTION_KEY`:** procedimiento manual de rotación (ADR §D2); fuera del scope automatizar.
- **CB-11 Frontend sin sesión:** `middleware.ts` redirige a `/login`; server action lanza sin sesión.
- **CB-12 ADMIN que llega a `/admin/ai-keys` por URL directa:** la página muestra el listado mascareado pero oculta los botones de editar/borrar (gate client + server action).
- **CB-13 Rotación de `ENCRYPTION_KEY` con rows existentes:** descifrado falla para todos → todos caen a env var con `warning="decrypt_error"` hasta recifrar (procedimiento manual). No hay pérdida de servicio si env vars siguen presentes.

---

## 11. Gates de validación (obligatorios antes de DONE)

1. `pnpm typecheck` (o `npm run typecheck`) — 0 errores nuevos.
2. `pnpm test` (vitest) — pasa, con nuevos tests de acciones y componente.
3. `pnpm lint` — 0 errores nuevos.
4. `pytest backend/tests -v` — pasa, con nuevos tests:
   - cifrado roundtrip + tamper detection
   - precedencia BD>env (flag on/off)
   - permisos (403 non-SUPERADMIN en PUT/DELETE; 200 ADMIN en GET)
   - audit log escrito + sin key en details
   - `key_source` en metadatos
   - `ENCRYPTION_KEY` ausente → 503 PUT + fallback env
   - optimistic locking 409
   - invalidación de caché tras PUT
5. Tests manuales (ver §12).
6. **Revisión final a GEMINI** (`subagent_type='gemini'`) como segunda mano de validación. **No pedir `qodo` (sunset).** Self-review manual en el reporte final de SOFIA: ¿refleja el código la SPEC? ¿code smells? ¿tests cubren edge cases? ¿riesgo de regresión en el refactor del resolver?

---

## 12. Tests manuales (UI)

- **M-1** Insertar key M3 válida vía UI (SUPERADMIN) → `GET /api/v2/ai/status` muestra `m3_key_present:true` y `key_source.m3="db"`; subir un documento de prueba → la corrida usa M3 (verificar `extraction_provider_used="m3"` y `key_source="db"` en el snapshot).
- **M-2** Borrar key M3 vía UI → siguiente extracción cae a env var (si `M3_API_KEY` en env) o a fallback Gemini (si no).
- **M-3** Intentar `PUT` con sesión ADMIN (no SUPERADMIN) → la server action lanza 403 / el botón está oculto; via curl con `x-ami-role=ADMIN` → 403.
- **M-4** `ENCRYPTION_KEY` ausente (reiniciar backend sin ella) → `PUT` UI muestra error 503; las extracciones siguen funcionando con env vars.
- **M-5** Confirmación doble: escribir dos keys distintas en los inputs → "Guardar" deshabilitado.

---

## 13. Plan de rollout

- **Fase 0 (este entregable):** ADR + SPEC + handoff. Sin código.
- **Fase 1:** schema migration + `KeyResolver` + refactor de services. Feature flag **OFF** → cero cambio de comportamiento. GEMINI audita. Deploy. (El flag off garantiza que aunque haya bugs en el resolver, producción sigue leyendo env vars.)
- **Fase 2:** Endpoints + UI + server actions. Flag sigue **OFF**. GEMINI audita. Deploy.
- **Fase 3:** Frank setea `AI_KEYS_FROM_DB_ENABLED=true` + puebla una key de prueba (ej. M3) vía UI → validar M-1..M-5. Si hay problema → flag off (reversibilidad inmediata).
- **Fase 4:** rotación completa de todas las keys por UI; las env vars quedan como fallback documentado (no se eliminan en este corte).

---

## 14. Trazabilidad de IDs

- ADR: `ADR-20260809-03`
- SPEC: `SPEC_ARCH-20260809-03`
- Handoff: `HANDOFF_ARCH-20260809-03`
- Próximos: `IMPL-20260809-NN` (SOFIA), `QA-20260809-NN` (GEMINI).

---

## 15. Notas para SOFIA

- Verificar gestor de paquetes frontend (npm vs pnpm) — usar el que ya use el repo (ver `package.json`).
- `params`/`searchParams` en Next.js 16 son `Promise` → `await params` (regla del AGENTS.md del proyecto; no reportar como error).
- Mantener **ambos** `schema.prisma` sincronizados.
- No loguear keys, ciphertext, nonce ni tag en ningún punto.
- El refactor del resolver es la parte de mayor riesgo de regresión; priorizar tests de precedencia y de "comportamiento idéntico con flag off".
