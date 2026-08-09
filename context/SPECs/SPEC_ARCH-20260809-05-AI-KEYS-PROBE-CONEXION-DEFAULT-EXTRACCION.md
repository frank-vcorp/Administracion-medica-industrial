# SPEC_ARCH-20260809-05 — AI Keys: Probar conexión + Default de extracción global (vía UI)

- **ID:** `ARCH-20260809-05` *(confirmado por Frank; `01` reciclado descartado por colisión con el `ARCH-20260809-01` "Antecedentes sub-pestaña" ya cerrado — ver §13).*
- **Tipo:** Arquitectónica (L2/L3 — toca persistencia con migración aditiva y refactor de resolución de proveedor).
- **Estado:** CERRADA (decisiones de Frank consolidadas 2026-08-10; lista para implementar).
- **Autor:** INTEGRA (GLM-5.2).
- **Fecha:** 2026-08-09.
- **Origen:** Solicitud explícita de Frank sobre el módulo `/admin/ai-keys` existente.
- **Especifica sobre:** `SPEC_ARCH-20260809-03` (gestión runtime de API Keys) y `SPEC_ARCH-20260809-02` (selector multi-proveedor de extracción). **No las reemplaza**; las extiende.

---

## 0. Resumen

Dos features incrementales sobre la página `/admin/ai-keys` ya implementada (ARCH-20260809-03):

1. **Probar conexión:** botón por proveedor (Gemini, MiniMax M3, DR7/MedGemma) que usa la API key efectiva (BD o env según `AI_KEYS_FROM_DB_ENABLED`) y hace una llamada **real mínima** al endpoint del proveedor. Éxito → respuesta tipo "Hola!!". Fallo → mensaje **sanitizado** (sin key ni secretos, con código HTTP / tipo de error).
2. **Default de extracción global:** UI para elegir entre `gemini` y `m3` como proveedor de extracción por defecto del sistema (DR7 queda fuera — es clínico). La selección persiste en BD y el `ExtractorService._resolve_provider` la usa como paso 3 (en vez del hardcode `"gemini"` actual en `extractor.py:303`), respetando la precedencia override-payload > calibración-por-prueba > **default global**.

---

## 1. Contexto previo (no repetir aquí; referencias)

- **Modelo `AIProviderKey`** ya existe en ambos `schema.prisma` (`backend/prisma/schema.prisma:472-487`, espejo `frontend/prisma/schema.prisma:539-554`). Campos: `provider` único (`"m3"|"gemini"|"dr7"`), `keyCiphertext`/`keyNonce`/`keyTag`, `baseUrl`, `defaultModel`, `enabled`, `updatedBy`, `updatedAt`.
- **`KeyResolver`** ya existe (`backend/app/services/ai/keys.py`): `resolve(provider) -> KeyResolution(provider, apiKey, baseUrl, defaultModel, source, warning)` con precedencia BD→env según flag, caché TTL 60 s + invalidación en escritura. **El probe lo reutiliza tal cual** (prueba la key que efectivamente se usaría en producción).
- **Página `/admin/ai-keys`** ya existe (`frontend/src/app/admin/ai-keys/page.tsx`): server component, gate `isAdminLike` + `canEdit = isSuperAdmin(role)`, `dynamic = 'force-dynamic'`.
- **Componente `AIProviderKeyManager.tsx`** ya existe: una `ProviderCard` por proveedor con botones Rotar/Eliminar (solo SUPERADMIN). **El probe y el selector de default se añaden aquí**.
- **Server actions** ya existen en `frontend/src/actions/ai-keys.actions.ts` (`listAIProviderKeys`, `updateAIProviderKey`, `deleteAIProviderKey`) con guard `isSuperAdmin`/`isAdminLike` + header `x-ami-role`/`x-ami-userid` (patrón `maintenance.py:22`).
- **`ExtractorService._resolve_provider`** (`extractor.py:253-303`): precedencia actual = override-payload → `aiCalibration.extraction.provider` → **hardcode `"gemini"`**. **Esta SPEC cambia el paso 3** a "default global persistido en BD (con fallback `gemini` si no config/fallo)".
- **`GET /api/v2/ai/status`** (`main.py:607-673`): ya expone `extraction_provider_active:"gemini"` (hardcode), `m3_*`, `dr7_*`, `key_source`, `ai_keys_from_db_enabled`, `key_in_db`. **Se extiende** con `extraction_default_provider` y `extraction_default_provider_source`.
- **Constantes en `main.py:156-181`:** `GEMINI_API_KEY`, `GEMINI_MODEL_EXTRACTION` (default `"gemini-2.5-flash"`), `M3_API_KEY`/`M3_BASE_URL` (default `https://api.minimax.io/v1`)/`M3_DEFAULT_MODEL` (default `MiniMax-M3`), `DR7_API_KEY`/`DR7_BASE_URL` (default `https://dr7.ai/api/v1/medical/chat/completions`)/`DR7_MODEL` (default `medgemma-4b-it`).

---

## 2. Alcance

### In-scope
- Tabla Prisma nueva `AppConfig` (key→value genérico) + migración aditiva en ambos `schema.prisma`.
- Endpoint `POST /api/v2/admin/ai-keys/{provider}/probe` (backend FastAPI).
- Endpoints `GET/PUT /api/v2/admin/app-config/extraction-default-provider` (backend FastAPI).
- Server actions `probeAIProviderKey`, `getExtractionDefaultProvider`, `setExtractionDefaultProvider` (frontend, con Zod).
- UI: botón "Probar conexión" en cada `ProviderCard` + sección "Proveedor de extracción predeterminado" en `AIProviderKeyManager.tsx`.
- Refactor de `ExtractorService._resolve_provider` paso 3: leer default desde `AppConfig` (con caché TTL 60 s + invalidación en escritura, mismo patrón que `KeyResolver`).
- Extensión de `GET /api/v2/ai/status` con `extraction_default_provider` + `extraction_default_provider_source`.
- AuditLog: `action="extraction_default_provider_updated"`, `entity="AppConfig"`, `details={previous, current, source}` (sin secretos).
- Tests backend (pytest) + frontend (vitest).

### Out-of-scope
- Pruebas de inferencia clínica/extractiva real con documentos (el probe envía un prompt trivial "Hola", no procesa archivos).
- Selector de default por modelo (solo provider; el modelo default ya está en `AIProviderKey.defaultModel` y `_default_model_for`).
- Default de extracción para DR7 (es clínico por decisión de Frank).
- Rollback de `ENCRYPTION_KEY` (manual, ADR-03 §D2).
- Multi-tenant (single-tenant hoy).
- Rate limit distribuido (in-memory por proceso, aceptable single-replica Railway — ver §10 CB-9 de SPEC-03).
- Métricas/telemetría de probes (logging de latencia en audit log es opcional).

---

## 3. Modelo de datos

### 3.1 Decisión: tabla nueva `AppConfig` (key→value JSON genérica)

```prisma
// ARCH-20260809-05: configuración runtime editable por UI (sin redeploy).
// Tabla KV genérica — extensible para futuras settings (timeouts, defaults por capa, etc.).
// Una fila por clave. value es Json para soportar estructuras complejas.
model AppConfig {
  key        String   @id              // ej. "extraction_default_provider"
  value      Json                       // ej. {"provider":"gemini"}
  updatedBy  String?
  updatedAt  DateTime @updatedAt
  createdAt  DateTime @default(now())
  user       User?    @relation("AppConfigUpdater", fields: [updatedBy], references: [id], onDelete: SetNull)

  @@map("app_config")
}
```

**Clave canónica para este feature:** `"extraction_default_provider"` con `value = {"provider":"gemini"|"m3"}`.

**Migración:** seguir el patrón `IMPL-20260730-01` (migración `20260809NN_add_app_config`). Crear `backend/prisma/migrations/<timestamp>_add_app_config/migration.sql` + mantener **ambos** `schema.prisma` sincronizados. Aplicar vía `sync-prisma-migrations.ts` / `check-migrations-state.ts` (existentes). **No** seedear el row (ausencia = fallback a `"gemini"`, cero regresión).

**Back-relation en `User`:** añadir `appConfigUpdated AppConfig[] @relation("AppConfigUpdater")` (patrón de `AIProviderKeyUpdater`).

### 3.2 Alternativa rechazada: columna `isExtractionDefault Boolean` en `AIProviderKey`

Rechazada porque: (a) semánticamente rara (dr7 no es candidato a default de extracción → habría que validar y rechazar); (b) solo soporta un flag booleano, no es extensible; (c) acopla "noción de default global" al modelo por-proveedor de keys. `AppConfig` es más limpia y prepara el terreno para futuras settings runtime.

### 3.3 AuditLog (reutilización, sin migración)

Cada `PUT /app-config/extraction-default-provider` escribe en `audit_logs` (modelo `schema.prisma:453-465`):
- `action`: `"extraction_default_provider_updated"`
- `entity`: `"AppConfig"`
- `entityId`: `"extraction_default_provider"`
- `details`: `{ previous:"gemini"|"m3"|null, current:"gemini"|"m3", updatedBy, source:"ui" }`
- **Prohibido** loguear la key de ningún proveedor (este endpoint no toca keys, pero se documenta por consistencia).

---

## 4. Contrato de server actions (frontend, Zod en `frontend/src/actions/ai-keys.actions.ts`)

> Mismo guard que las existentes: `getServerSession(authOptions)` + `isSuperAdmin`/`isAdminLike` + header `x-ami-role`/`x-ami-userid` + `_backendBase()` + `cache:'no-store'` + sanity de no-filtrar secretos.

### 4.1 `probeAIProviderKey(input) -> ProbeResult`
- **Guard:** `isSuperAdmin(role)` obligatorio (decisión Frank: solo SUPERADMIN).
- **Zod input:** `{ provider: z.enum(['gemini','m3','dr7']) }`.
- **Llamada backend:** `POST {base}/api/v2/admin/ai-keys/{provider}/probe` (sin body).
- **Output tipado:**
  ```ts
  type ProbeResult =
    | { ok: true; provider: AIProvider; latencyMs: number; httpStatus: number; message: string }
    | { ok: false; provider: AIProvider; errorKind: ProbeErrorKind; message: string; httpStatus?: number }
  type ProbeErrorKind = 'not_configured' | 'decrypt_error' | 'auth' | 'timeout' | 'network' | 'http_4xx' | 'http_5xx' | 'parse' | 'rate_limited' | 'unknown'
  ```
- **Erros mapeados desde HTTP backend:** 403→`{ok:false,errorKind:'unknown',message:'Acceso denegado (solo SUPERADMIN)'}`; 429→`errorKind:'rate_limited'`; 503→`errorKind:'not_configured'`; otro→mensaje sanitizado del backend (`detail.slice(0,200)`).
- **Sanity client:** la response del backend **nunca** contiene la key; el server action no la loguea.

### 4.2 `getExtractionDefaultProvider() -> GetDefaultResult`
- **Guard:** `isAdminLike(role)` (ADMIN+SUPERADMIN pueden leer; consistente con `listAIProviderKeys`).
- **Llamada:** `GET {base}/api/v2/admin/app-config/extraction-default-provider`.
- **Output:** `{ ok: true; provider: 'gemini'|'m3'; source: 'db'|'default'; updatedAt?: string } | { ok:false; error:string }`.
  - `source:'default'` = sin row en BD → fallback `"gemini"` (no es error).

### 4.3 `setExtractionDefaultProvider(input) -> SetDefaultResult`
- **Guard:** `isSuperAdmin(role)` obligatorio.
- **Zod input:** `{ provider: z.enum(['gemini','m3']), expectedUpdatedAt: z.string().nullable().optional() }`.
- **Llamada:** `PUT {base}/api/v2/admin/app-config/extraction-default-provider` con body `{provider, expectedUpdatedAt}`.
- **Output:** `{ ok:true; provider:'gemini'|'m3'; source:'db'; updatedAt:string } | { ok:false; error:string }`.
- **Errores:** 403→"Solo SUPERADMIN"; 409→"Conflicto: la config fue modificada por otro usuario. Recarga y reintenta."; 400→mensaje del backend.
- **revalidate:** `revalidatePath('/admin/ai-keys')` tras éxito.

---

## 5. Contrato de endpoints backend (FastAPI, `backend/app/main.py`)

Base path bajo `/api/v2/admin/*`. Todos requieren header `x-ami-role` (defense-in-depth; el guard real es la server action NextAuth).

### 5.1 `POST /api/v2/admin/ai-keys/{provider}/probe`
- **Path param:** `provider` ∈ `{m3, gemini, dr7}` → si no, 400.
- **Roles backend:** `x-ami-role == "SUPERADMIN"` → 200; resto → 403.
- **Rate limit:** 1 probe por proveedor cada 30 s **por proceso** (in-memory, dict `{provider: last_ts}`). Si se excede → 429 `{ detail: "rate_limited", retryAfterSec: <int> }`. Documentar que es por-proceso (aceptable single-replica).
- **Lógica:**
  1. `resolution = KeyResolver.resolve(provider)` (respeta flag `AI_KEYS_FROM_DB_ENABLED`; flag off → env var, `source="env"`; flag on + BD → descifra, `source="db"`).
  2. Si `resolution.apiKey` vacío → 503 `{ detail:"not_configured", errorKind:"not_configured" }` (no hay key ni en env ni en BD).
  3. Llamar al endpoint mínimo del proveedor (ver §6) con **timeout 12 s**.
  4. Capturar cualquier excepción; sanitizar con `_sanitize_error` (patrón `main.py:583`) — **nunca** loguear la key ni el header Authorization.
  5. Mapear resultado a `ProbeResponse`.
- **Respuesta 200:**
  ```json
  { "ok": true, "provider":"m3", "latencyMs": 234, "httpStatus": 200, "message":"Hola!!" }
  ```
  o en fallo (200 también — el probe "falló" pero la API respondió):
  ```json
  { "ok": false, "provider":"m3", "errorKind":"auth", "httpStatus": 401, "message":"No autorizado (401)" }
  ```
  > Nota: el endpoint siempre responde 200 con el objeto `ProbeResponse`; los `errorKind` distinguen. Excepción: 403 (permisos), 429 (rate limit), 400 (provider inválido), 503 (not_configured) sí son códigos HTTP de error.
- **Prohibido:** loguear `resolution.apiKey`, el header `Authorization`, el ciphertext/nonce/tag, ni la URL con querystring `?key=` (Gemini manda la key en query — loguear solo el path sin query).

### 5.2 `GET /api/v2/admin/app-config/extraction-default-provider`
- **Roles backend:** `x-ami-role` ∈ `{ADMIN, SUPERADMIN}` → 200; resto → 403.
- **Respuesta 200:** `{ provider:"gemini"|"m3", source:"db"|"default", updatedAt:string|null }`.
  - `source:"default"` + `provider:"gemini"` cuando no hay row (fallback hardcoded).

### 5.3 `PUT /api/v2/admin/app-config/extraction-default-provider`
- **Roles backend:** `x-ami-role == "SUPERADMIN"` → 200; resto → 403.
- **Body (Pydantic):** `{ provider: Literal['gemini','m3'], expectedUpdatedAt: str | None }`.
- **Lógica:**
  1. Validar `provider` ∈ `{gemini, m3}` (dr7 rechazado → 400 `{"detail":"dr7 is clinical-only"}`).
  2. Optimistic locking: si `expectedUpdatedAt` presente y row existe con `updatedAt != expectedUpdatedAt` → 409 `{ detail:"conflict", currentUpdatedAt }`.
  3. Upsert `AppConfig` (`key="extraction_default_provider"`, `value={"provider":<p>}`, `updatedBy=<userId>`).
  4. AuditLog (`action="extraction_default_provider_updated"`, `entity="AppConfig"`, `entityId="extraction_default_provider"`, `details={previous,current,source:"ui"}`).
  5. Invalidar caché del default del extractor (ver §7).
  6. **No** loguear secretos (este endpoint no toca keys, pero se documenta).
- **Respuesta 200:** `{ provider, source:"db", updatedAt }`.

### 5.4 Extensión `GET /api/v2/ai/status`
- Añadir `extraction_default_provider: "gemini"|"m3"` (resuelto vía la misma caché del extractor) y `extraction_default_provider_source: "db"|"default"`.
- `extraction_provider_active` (línea 639) **pasa a ser dinámico** = `extraction_default_provider` (fuente única de verdad, decisión Frank). Mantiene el nombre por compat; su valor ahora refleja el default real persistido en BD (con fallback `"gemini"` si no hay row).

---

## 6. Diseño del probe por proveedor (endpoint mínimo + criterio de éxito)

Todos los probes envían un prompt trivial `"Hola"` (texto plano, no multimodal, no archivo) con `max_tokens` bajo para minimizar coste. La respuesta de éxito se normaliza a `"Hola!!"` (o el texto que devuelva el proveedor, truncado a 50 chars en `message`).

### 6.1 Gemini (REST Google, key en querystring)
- **Base URL default:** `https://generativelanguage.googleapis.com` (override por `AIProviderKey.baseUrl` o env `GEMINI_BASE_URL` si existe; sino default oficial).
- **Modelo default:** `AIProviderKey.defaultModel` o `GEMINI_MODEL_EXTRACTION` (`main.py:161`, default `"gemini-2.5-flash"`).
- **Llamada:** `POST {base}/v1beta/models/{model}:generateContent?key={API_KEY}` con body:
  ```json
  {"contents":[{"parts":[{"text":"Hola"}]}],"generationConfig":{"maxOutputTokens":16,"temperature":0}}
  ```
- **Éxito:** HTTP 200 + `candidates[0].content.parts[0].text` no vacío → `ok:true, message:<texto>`.
- **Errores:** 403/401 → `errorKind:"auth"`; 429 → `"rate_limited"` (cuota del proveedor, distinto del rate limit interno); 5xx → `"http_5xx"`; timeout → `"timeout"`; JSON malformado → `"parse"`.

### 6.2 MiniMax M3 (OpenAI-compatible)
- **Base URL default:** `AIProviderKey.baseUrl` o `M3_BASE_URL` (`main.py:178`, default `https://api.minimax.io/v1`).
- **Modelo default:** `AIProviderKey.defaultModel` o `M3_DEFAULT_MODEL` (`main.py:179`, default `MiniMax-M3`, case-sensitive).
- **Llamada:** `POST {base_url}/chat/completions` con header `Authorization: Bearer {API_KEY}` y body:
  ```json
  {"model":"<model>","messages":[{"role":"user","content":"Hola"}],"max_tokens":16,"temperature":0}
  ```
- **Éxito:** HTTP 200 + `choices[0].message.content` no vacío → `ok:true`.
- **Errores:** 401/403 → `"auth"`; 429 → `"rate_limited"`; 5xx → `"http_5xx"`; timeout → `"timeout"`.
- **Caso `m3_not_configured`:** si `resolution.apiKey` vacío → 503 `not_configured` (no se intenta la llamada).

### 6.3 DR7 / MedGemma (clínico, OpenAI-compatible)
- **Base URL default:** `AIProviderKey.baseUrl` o `DR7_BASE_URL` (`main.py:169`, default `https://dr7.ai/api/v1/medical/chat/completions`).
- **Modelo default:** `AIProviderKey.defaultModel` o `DR7_MODEL` (`main.py:170`, default `medgemma-4b-it`).
- **Llamada:** mismo patrón OpenAI que M3 (header `Authorization: Bearer {key}`, body con `model`, `messages`, `max_tokens:16`).
- **Éxito/errores:** mismo mapeo que M3.
- **Nota:** el probe **no** hace inferencia clínica (prompt trivial "Hola"). Solo verifica conectividad + validez de la key del proveedor clínico. `MEDGEMMA_ENABLED` no bloquea el probe (queremos poder probar la key aunque el flag clínico esté off).

### 6.4 Sanitización de errores (común a los 3)
- `message` siempre **genérico**: `"No autorizado (401)"`, `"Error de red"`, `"Timeout (12s)"`, `"Error HTTP 503 del proveedor"`. **Nunca** incluir el body completo de error del proveedor (puede contener eco de la key en algunos casos), ni la URL con `?key=`, ni el header `Authorization`.
- Usar helper `_sanitize_error(str(exc))` existente (`main.py:583`) para truncar y limpiar stack traces.

---

## 7. Resolución del default de extracción (cambio en `ExtractorService`)

### 7.1 `_resolve_provider` paso 3 (actual `extractor.py:302-303`)
- **Actual:** `return "gemini", override_model or self._default_model_for("gemini")`.
- **Nuevo:**
  1. `default_provider, _src = get_extraction_default_provider_sync()` → **solo lee caché** (variante síncrona, sin I/O ni bloqueo). La caché se mantiene caliente vía los mecanismos de §7.4 (priming en PUT + warmup en startup). Si la caché está vacía/stale → fallback `"gemini"` (degradación segura, **no** lectura bloqueante a BD). La consulta a `AppConfig` la hacen **únicamente** la variante async (`get_extraction_default_provider()`) y el priming/warmup — nunca el camino síncrono de extracción.
  2. `return default_provider, override_model or self._default_model_for(default_provider)`.
- **Precedencia intacta:** override-payload (paso 1) > `aiCalibration.extraction.provider` (paso 2) > **default global persistido** (paso 3, nuevo). El cambio **solo** afecta a corridas sin override ni calibración por-prueba — exactamente el caso "default del sistema" que Frank quiere controlar.
- **Errata ARCH-20260809-06 (2026-08-10):** la redacción original de §7.1 decía "lee caché (TTL 60 s) **o consulta AppConfig**". Eso inducía a pensar que la sync consultaría BD si la caché estaba stale. **No es así y no lo será:** el camino síncrono de extracción (`_resolve_provider`/`extract_by_type`) vive en handlers async con event loop corriendo (ver `main.py:845,1277`, `calibration.py:318`), donde una lectura síncrona bloqueante a Prisma provocaría `RuntimeError` o deadlock. La caché se mantiene caliente por construction (§7.4); la sync solo lee. Ver §7.5 para el comportamiento stale.

### 7.2 Caché del default
- La caché vive en el singleton `AppConfigStore._cache` (`app/services/ai/app_config.py`), no en el extractor (decisión de IMPL-20260809-09; el store ya implementa TTL 60 s + invalidación). El extractor delega en `get_extraction_default_provider_sync()`.
- **Errata ARCH-20260809-06:** la redacción original decía que el `PUT` llamaba `extractor.invalidate_default_provider()`. **Cambio:** el `PUT` **primea** la caché (escribe el valor nuevo directamente en `_cache[KEY] = (time.monotonic(), {"provider": <p>})`) tras commit, en vez de (o además de) `invalidate(KEY)`. Razonamiento: invalidar deja la caché vacía y la siguiente lectura síncrona (`_resolve_provider`/status) cae a fallback `"gemini"` silenciosamente hasta que algo recaliente (el GET async de la UI). Con priming, la siguiente extracción lee el valor nuevo **inmediatamente, sin latencia, sin I/O**. Ver §7.4.
- TTL 60 s garantiza convergencia en multi-réplica (aceptable, documentado). El priming del PUT converge dentro del proceso; el warmup de startup (§7.4) cura el cold-start tras restart.

### 7.3 Interacción con fallback M3→Gemini
- Si el default global es `"m3"` pero M3 no tiene key (ni BD ni env) → el dispatcher ya maneja `m3_not_configured` (`extractor.py:305+`) y cae a Gemini. **No cambia**. Documentar en `extraction_fallback_reason:"m3_not_configured"`.
- Si el default es `"gemini"` y Gemini no tiene key → error explícito existente (`ValueError("GEMINI_API_KEY no configurada")`). No se inventa key.

### 7.4 Mantenimiento de la caché — priming + warmup (errata ARCH-20260809-06)

> **Motivación:** QA-20260809-01 halló (AC-7/8/12 parciales) que el default global se queda stale tras `PUT` porque `get_extraction_default_provider_sync()` **solo lee caché** y el `PUT` solo `invalidate()`. Si nada recalienta la caché (el GET async de la UI), todas las extracciones caen a `"gemini"` silenciosamente **indefinidamente**, no solo hasta el TTL. Esto es una regresión funcional del feature, no un detalle. La cura no es hacer async el camino síncrono (opción A, superficie de regresión grande: `_resolve_provider`→`extract_by_type`→3 callers en `main.py` + 1 en `calibration.py` + ~30 tests), ni una lectura síncrona bloqueante a Prisma (opción B pura, técnicamente inviable desde handlers async con loop corriendo sin introducir psycopg2 paralelo o un thread con su propio loop — deadlock garantizado). La cura es **mantener la caché caliente por construcción** con dos mecanismos cooperativos que no tocan el camino síncrono:

- **(P) Priming en el `PUT`:** `admin_app_config.py` `put_extraction_default` tras el upsert exitoso, además de `invalidate(KEY)`, escribe el valor nuevo directamente: `_cache[EXTRACTION_DEFAULT_PROVIDER_KEY] = (time.monotonic(), {"provider": <provider>})`. Equivalentemente, añadir `AppConfigStore.prime(key, value)` que hace esto (helper limpio; los tests ya escriben directo en `_cache`, así que no es un patrón nuevo). Esto cura **"cambio por UI → siguiente extracción inmediata"** con cero latencia y cero I/O. Sigue valiendo el `invalidate(KEY)` por compatibilidad multi-réplica (la otra réplica no recibe el priming; converge por TTL 60 s — aceptable, documentado en §7.2).
- **(W) Warmup en startup:** `main.py` `lifespan`, tras `await connect_prisma_client()`, invocar `await get_extraction_default_provider()` (envuelto en try/except, logueando fallo como warning) para calentar la caché al arrancar. Esto cura **"restart → primera extracción"**. El warmup es best-effort: si Prisma no está listo o la tabla no existe, cae a fallback `"gemini"` (cero regresión — mismo comportamiento que sin warmup).
- **(Opcional, defensivo) Refresco periódico:** un task async periódico (cada TTL/2 ≈ 30 s, vía `asyncio.create_task` lanzado en el lifespan) llama `await get_extraction_default_provider()` para recalentar la caché. Cura **"TTL expira sin recalentamiento"** (caso: default configurado una vez y nunca más tocado durante >60 s). Es opcional porque con (P)+(W) la caché se mantiene caliente mientras haya PUTs periódicos; el refresco cierra el gap residual. Riesgo: nuevo punto de fallo (un task en background); mitigable: el task es best-effort, captura sus propias excepciones, y si muere la caché expira y cae a fallback `"gemini"` (degradación segura). **Decisión INTEGRA (ARCH-20260809-06): incluir (P)+(W) obligatoriamente; (R) marcarlo como follow-up opcional salvo evidencia de stale persistente en producción** (evita añadir estado global nuevo de entrada).

### 7.5 Comportamiento de la sync cuando la caché está stale (errata ARCH-20260809-06)

- `get_extraction_default_provider_sync()` **mantiene su contrato actual**: lee caché; si está vacía/stale/invalidada → retorna `(EXTRACTION_DEFAULT_PROVIDER_FALLBACK, "default")` = `("gemini", "default")`. **No añade lectura bloqueante a BD. No añade lock. No consulta Prisma.** Es degradación segura y cero regresión (mismo valor que antes de este feature).
- **No hay thundering herd:** la sync no hace I/O. Si 50 extracciones concurrentes ven caché stale, las 50 retornan `"gemini"` instantáneamente sin contención ni lectura BD. El thundering herd sería un problema **solo** en la opción B pura (lectura síncrona bloqueante: 50 threads leyendo BD simultáneamente), que **se descarta** por inviabilidad técnica (§7.4 motivación). Con (P)+(W) de §7.4, la caché casi nunca está stale; cuando lo está, la degradación es instantánea y sin I/O.
- **Red de seguridad (no recomendada salvo evidencia):** si en producción se observa stale persistente pese a (P)+(W) (ej. proceso que nunca recibe PUTs y el warmup falló), la única forma técnica limpia de añadir una lectura síncrona a BD como respaldo sería psycopg2 paralelo (driver síncrono) con `threading.Lock` para serializar las N concurrentes a una sola lectura + rellenar caché. **Over-engineering** para un caso que (P)+(W) ya cubre; no incluir de entrada.

---

## 8. UX (componente `AIProviderKeyManager.tsx`, client)

### 8.1 Botón "Probar conexión" en cada `ProviderCard`
- **Visibilidad:** solo si `canEdit` (SUPERADMIN). Decisión Frank: probe restringido a SUPERADMIN; no se abre a ADMIN.
- **Ubicación:** en la columna de acciones existente (`AIProviderKeyManager.tsx:199-217`), tercer botón debajo de Rotar/Eliminar. Label `"Probar conexión"`.
- **Estados por tarjeta:**
  - `idle` → botón habilitado.
  - `loading` → botón deshabilitado, texto `"Probando…"`, spinner.
  - `ok` → badge verde inline: `✓ OK · 234ms` + `message` (ej. `"Hola!!"`). Botón vuelve a habilitar.
  - `err` → badge rojo inline: `✗ {errorKind}` (ej. `✗ auth`) + tooltip con `message`. Botón habilitado para reintentar.
- **Cooldown client-side:** tras un probe, el botón muestra "Reintentar en {N}s" durante 30 s (espejo del rate limit backend). Usar `setInterval` con cleanup en `useEffect`.

### 8.2 Sección "Proveedor de extracción predeterminado"
- **Ubicación:** debajo del bloque de `ProviderCard` (dentro del `<div className="space-y-4">` principal), nueva sub-sección con `<h2>` propio.
- **Contenido:**
  - `<select>` o **radio buttons** entre `Gemini` y `MiniMax M3`. DR7 **no aparece** (nota: "DR7/MedGemma es clínico, no aplica como proveedor de extracción").
  - Botón `"Guardar"` (solo SUPERADMIN; disabled si no hay cambio vs. valor actual).
  - Muestra valor actual + `updatedAt` + `source` (badge `BD`/`default`).
- **Estados:** `loading` (cargando valor actual), `saving` (PUT en vuelo), `error` (mensaje inline).
- **Confirmación:** no requiere modal de confirmación (es reversible y de bajo riesgo). Tras guardar: badge verde "Guardado" + invalida caché (el backend ya invalida; la UI recarga el valor).

### 8.3 Accesibilidad básica
- Botones con `aria-label` descriptivo (ej. `aria-label="Probar conexión del proveedor MiniMax M3"`).
- Resultado del probe anunciado vía `aria-live="polite"` en un `<span role="status">`.
- `select`/radios con `<label>` asociado y `aria-describedby` apuntando a la nota sobre DR7.
- Focus visible (`focus:ring`) consistente con el resto del componente.
- Navegación por teclado funcional (botones y select son nativos).

### 8.4 Next.js 16
- La página `/admin/ai-keys` **no** tiene `params` dinámicos (ruta plana) → `await params` **no aplica** aquí. `dynamic = 'force-dynamic'` ya está (`page.tsx:16`) — mantener.
- Server actions nuevas: `'use server'`, sin `params`. Las llamadas desde el cliente (`AIProviderKeyManager`) usan el patrón existente (import directo + `await`).
- `revalidatePath('/admin/ai-keys')` tras `setExtractionDefaultProvider` (ya lo hacen las actions de PUT/DELETE de keys).

---

## 9. Compatibilidad y resguardos

- **Feature flag `AI_KEYS_FROM_DB_ENABLED`:** el probe lo respeta vía `KeyResolver.resolve` (prueba la key efectiva). No se añade flag nuevo para el probe.
- **Default de extracción sin flag:** la lectura del default desde `AppConfig` **no** está gateada por `AI_KEYS_FROM_DB_ENABLED` (es configuración independiente de las keys). Resguardo: si `AppConfig` no existe / row ausente / valor inválido → fallback `"gemini"` (comportamiento idéntico al actual, cero regresión).
- **Rollback:** si el feature de default global introduce un bug, Frank puede `DELETE FROM app_config WHERE key='extraction_default_provider'` → el extractor vuelve a `"gemini"` hardcoded. Reversible sin redeploy (la caché TTL 60 s converge).
- **No romper ARCH-20260809-02:** la precedencia override > calibración > default se mantiene. Los tests existentes (`test_ai_pipeline.py:1704+` con `extraction_provider_requested/used`) deben seguir pasando sin cambios (cuando no hay calibración ni override, ahora usarán el default global — los tests que asumían `"gemini"` deben actualizarse para setear el default explícito o mockear `AppConfig` ausente → fallback `"gemini"`).

---

## 10. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **Secretos en logs** | `_sanitize_error` en todas las excepciones; nunca loguear `Authorization`, `?key=`, ciphertext/nonce/tag, ni el body de error del proveedor (puede contener eco de key). Test de regresión: assert que el log del probe no contiene el valor de la key. |
| **Coste de pruebas accidentales** | Rate limit 1/30s/proveedor por proceso + permiso SUPERADMIN + `max_tokens:16`. Cada probe ≈ 16 tokens ≈ despreciable. Documentar que el probe hace llamadas reales (no mock). |
| **Rate limit del proveedor (429 externo)** | Mapear a `errorKind:"rate_limited"` distinto del rate limit interno. El mensaje no expone cuota. |
| **Timeouts** | 12 s server-side; `AbortController` 15 s client-side en el fetch de la server action. Mapear `asyncio.TimeoutError`/`httpx.ReadTimeout` → `errorKind:"timeout"`. |
| **Probe de DR7 toca endpoint clínico** | El probe **no** hace inferencia clínica (prompt trivial). Solo verifica conectividad. `MEDGEMMA_ENABLED` no bloquea el probe. Documentar. |
| **Default global = m3 sin key M3** | Dispatcher ya maneja `m3_not_configured` → fallback Gemini (`extraction_fallback_reason` reflejado). No requiere lógica nueva. |
| **Multi-réplica: caché default no invalidada en otra réplica** | TTL 60 s garantiza convergencia (aceptable, documentado — mismo criterio que `KeyResolver`). |
| **Race condition dos SUPERADMINs cambiando default** | Optimistic locking vía `expectedUpdatedAt` → 409 al segundo. |
| **`AppConfig` abusada para settings no-IA** | Documentar en ADR/comentario del modelo que es para settings runtime admin; no abusar para secrets (usar `AIProviderKey` para keys). |

---

## 11. Criterios de aceptación (verificables)

- **AC-1** Existe modelo `AppConfig` en ambos `schema.prisma` + migración aplicada; `check-migrations-state.ts` confirma tabla + PK + back-relation en `User`.
- **AC-2** `POST /ai-keys/m3/probe` con key válida en BD (flag on) → 200 `{ok:true, httpStatus:200, message:"<texto>"}`; el body de respuesta **no contiene** el valor de la key (test de regresión).
- **AC-3** `probe` con key inválida (mock 401) → 200 `{ok:false, errorKind:"auth", httpStatus:401, message:"No autorizado (401)"}`; el log del backend no contiene la key.
- **AC-4** `probe` sin key configurada (env vacío + BD sin row + flag on) → 503 `{detail:"not_configured"}`.
- **AC-5** Rate limit: dos `probe` seguidos del mismo proveedor en <30 s → el segundo 429 `{detail:"rate_limited", retryAfterSec}`.
- **AC-6** `probe` por ADMIN (`x-ami-role=ADMIN`) → 403. Server action sin sesión SUPERADMIN → error.
- **AC-7** `PUT /app-config/extraction-default-provider` con `{provider:"m3"}` → 200; la siguiente extracción sin override ni calibración usa M3 (`extraction_provider_requested="m3"`, `extraction_provider_used="m3"` en el snapshot, sin redeploy) **y sin necesidad de tocar la variante async** de `get_extraction_default_provider()` entre el PUT y la extracción. Esto valida el **priming** de §7.4: tras el PUT, `get_extraction_default_provider_sync()` retorna `("m3","db")` directamente desde la caché primeada.
- **AC-8** Tras `PUT` con `provider:"gemini"`, el default vuelve a Gemini; la caché del extractor se **primea** con el valor nuevo (test: cambiar default + correr extracción inmediatamente → usa el nuevo default, sin pasar por la versión async). La invalidación multi-réplica vía TTL 60 s se documenta por separado (no se testea en single-proceso).
- **AC-9** `PUT` con `provider:"dr7"` → 400 `{detail:"dr7 is clinical-only"}`.
- **AC-10** `PUT` con `expectedUpdatedAt` desactualizado → 409 con `currentUpdatedAt`.
- **AC-11** `GET /app-config/extraction-default-provider` sin row → 200 `{provider:"gemini", source:"default", updatedAt:null}`.
- **AC-12** `GET /api/v2/ai/status` expone `extraction_default_provider` + `extraction_default_provider_source`; `extraction_provider_active` es dinámico (= `extraction_default_provider`, fuente única de verdad).
- **AC-13** Cada `PUT` escribe `AuditLog` con `action="extraction_default_provider_updated"`, `details.previous/current` presentes y **sin** keys.
- **AC-14** UI: botón "Probar conexión" visible solo para SUPERADMIN; estados loading/ok/err renderizados correctamente (vitest del componente); cooldown 30 s client-side funcional.
- **AC-15** UI: selector de default entre Gemini y M3 (DR7 no aparece); al guardar, badge "Guardado" + valor actualizado; nota sobre DR7 clínico visible.
- **AC-16** Gates verdes: `pnpm/npm typecheck` 0 errores nuevos, `pnpm/npm test` (vitest) pasa, `pnpm/npm lint` 0 errores nuevos, `pytest backend/tests -v` pasa (con tests nuevos de probe + default + sanitización + permisos + audit).
- **AC-17** Tests existentes de ARCH-20260809-02 (`test_ai_pipeline.py:1704+`) siguen pasando (mockear `AppConfig` ausente → fallback `"gemini"` para los que asumían default gemini).

---

## 12. Gates de validación (obligatorios antes de DONE)

1. `pnpm typecheck` (o `npm run typecheck`) — 0 errores nuevos.
2. `pnpm test` (vitest) — pasa, con nuevos tests de: componente (estados probe, select default, cooldown), server actions (`probeAIProviderKey`, `getExtractionDefaultProvider`, `setExtractionDefaultProvider`), sanity de no-filtrar key.
3. `pnpm lint` — 0 errores nuevos.
4. `pytest backend/tests -v` — pasa, con nuevos tests:
   - probe por proveedor (mock httpx/requests con respuestas 200/401/timeout/5xx/429).
   - precedencia del default: override > calibración > AppConfig > fallback gemini.
   - invalidación de caché del default tras `PUT`.
   - permisos: 403 non-SUPERADMIN en probe y PUT app-config; 200 ADMIN en GET app-config.
   - sanitización: el log del probe no contiene la key; el body de respuesta del probe no contiene la key.
   - audit log del cambio de default (con `previous`/`current`, sin keys).
   - optimistic locking 409.
   - rate limit 429.
   - `dr7` rechazado como default (400).
5. Tests manuales (UI):
   - **M-1** Probe OK por cada proveedor (key válida en BD, flag on) → badge verde con `message`.
   - **M-2** Probe con key inválida (rotar a key falsa) → badge rojo `auth`, mensaje sanitizado sin key.
   - **M-3** Cambiar default a M3 → subir un documento sin calibración de proveedor → snapshot con `extraction_provider_requested="m3"`.
   - **M-4** Volver default a Gemini → siguiente extracción usa Gemini.
   - **M-5** ADMIN intenta probe → botón oculto/desactivado; via curl con `x-ami-role=ADMIN` → 403.
   - **M-6** Cooldown: dos probes seguidos → segundo botón muestra "Reintentar en Ns".
6. **Revisión final a GEMINI** (`subagent_type='gemini'`) como segunda mano de validación. **No pedir `qodo` (sunset).** Self-review manual en el reporte final de SOFIA: ¿refleja el código la SPEC? ¿code smells? ¿tests cubren edge cases? ¿riesgo de regresión en `_resolve_provider` y en el refactor de la caché del default?

---

## 13. Decisiones cerradas (Frank, 2026-08-10)

1. **ID de la tarea:** `ARCH-20260809-05` confirmado (siguiente libre tras 01 antecedentes, 02 selector M3, 03 gestión keys, 04 IMPL-02). Se descarta `01` reciclado por colisión con el `ARCH-20260809-01` "Antecedentes sub-pestaña" ya cerrado.

2. **Permiso del probe:** `SUPERADMIN` only. Consistente con PUT/DELETE de keys (evita abuso/coste). **No** se abre a ADMIN. Reflejado en §4.1, §5.1, §8.1 y AC-6.

3. **`extraction_provider_active` en status:** dinámico = `extraction_default_provider` (fuente única de verdad). Se descarta la opción de conservar literal `"gemini"` + campo aparte. Reflejado en §5.4 y AC-12.

4. **Errata ARCH-20260809-06 (2026-08-10, INTEGRA GLM-5.2):** la caché del default se mantiene caliente por **priming en el PUT** + **warmup en startup** (§7.4), no por invalidación + lectura síncrona a BD. Se descarta explícitamente (a) la opción A (async en todo el camino de extracción) por superficie de regresión y (b) la opción B pura (lectura síncrona bloqueante a Prisma desde el camino síncrono) por inviabilidad técnica (deadlock/RuntimeError en handlers async con loop corriendo). La variante síncrona `get_extraction_default_provider_sync()` mantiene su contrato solo-lectura; si la caché está stale → fallback `"gemini"` sin I/O ni thundering herd (§7.5). El refresco periódico (§7.4-R) queda como follow-up opcional. Reflejado en §7.1, §7.2, §7.4, §7.5, AC-7, AC-8.

---

## 14. Notas para SOFIA

- Verificar gestor de paquetes frontend (npm vs pnpm) — usar el que ya use el repo (ver `package.json`).
- `params`/`searchParams` en Next.js 16 son `Promise` → `await params` (regla del AGENTS.md del proyecto; no aplica aquí porque la ruta es plana, pero mantener `dynamic = 'force-dynamic'`).
- Mantener **ambos** `schema.prisma` sincronizados (frontend y backend espejo).
- No loguear keys, ciphertext, nonce, tag, header `Authorization`, ni URLs con `?key=` en ningún punto (probe ni app-config).
- Reutilizar `KeyResolver.resolve(provider)` en el probe (no descifrar manualmente).
- Reutilizar `_sanitize_error` (`main.py:583`) para todas las excepciones del probe.
- El refactor de `_resolve_provider` paso 3 es la parte de mayor riesgo de regresión; priorizar tests de "AppConfig ausente → fallback gemini (comportamiento idéntico al actual)".
- Tipos compartidos en `frontend/src/types/ai-keys.ts` (añadir `ProbeResult`, `ProbeErrorKind`, `GetDefaultResult`, `SetDefaultResult`).
- La caché del default del extractor sigue el **mismo patrón** que `KeyResolver` (TTL 60 s + invalidación en escritura); no inventar patrón nuevo.
