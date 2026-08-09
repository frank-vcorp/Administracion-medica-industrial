# ADR-20260809-03 — Gestión runtime de API Keys de proveedores IA vía UI (sin env vars ni redeploys)

- **Estado:** Aceptada
- **Fecha:** 2026-08-09
- **Autor:** INTEGRA (Muse Spark 1.1)
- **Origen:** Escalamiento ATLAS M3 desde necesidad explícita de Frank: endpoint UI para insertar API keys de proveedores IA (M3, Gemini, DR7/MedGemma) sin tocar env vars ni redeploys.
- **SPEC asociada:** `context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md`
- **Predecesoras:** ADR-20260809-02 (selector multi-proveedor Gemini + M3), ADR-20260203-02 (AI Pipeline), ADR-20260603 (migración clínica DR7)
- **Reversibilidad:** Total. Feature flag `AI_KEYS_FROM_DB_ENABLED` (default `false`) deja el comportamiento en env-var-only sin tocar producción. Ver §9 Rollout.

---

## 1. Contexto y problema

Hoy las API keys de los tres proveedores IA se leen **únicamente desde variables de entorno al boot del backend** (`backend/app/main.py:149-173` y `backend/app/services/ai/prediagnostic.py:38-44`). Rotar una key exige editar el env del servicio (Railway) y **redeploy**, con ventana de indisponibilidad y dependencia de un humano con acceso a consola. Frank quiere gestionarlas desde la UI sin redeploys.

### 1.1 Hallazgo crítico — patrón actual de lectura de keys (interconsulta DEBY sustituida por lectura focalizada INTEGRA)

> **Nota de proceso:** la SPEC encargaba una interconsulta previa a DEBY (`task` con `subagent_type='debugger'`) para verificar el patrón de lectura. En esta sesión **no está provisionado el mecanismo `task` ni existe CLI `kilo`**; `agent_manager` queda descartado por §14.7 (solo para fan-out visible pedido explícitamente por Frank). INTEGRA ejecutó entonces una lectura focalizada —lo indispensable para la decisión arquitectónica, no duplicación de ATLAS— sobre `base.py`, `prediagnostic.py`, `extractor.py` y `main.py`. SOFIA debe **re-verificar** este patrón en su baseline (Fact-Forcing Protocol) antes de implementar.

El patrón actual es **caché en construcción / carga de módulo, NO dinámico por llamada**:

| Componente | Línea | Patrón | Implicación rotación |
|---|---|---|---|
| `GeminiBase.__init__` | `base.py:112` | `self.api_key = api_key or _read_env_var("GEMINI_API_KEY")` | Cachea al construir |
| `M3VisionBase.__init__` | `base.py:406-416` | `self.api_key/base_url/model = … or _read_env_var(…)` | Cachea al construir |
| `FeatherlessVisionBase.__init__` | `base.py:250-260` | idem | Cachea al construir |
| `prediagnostic.py` constantes de módulo | `prediagnostic.py:38-44` | `DR7_API_KEY = os.environ.get(...)` a nivel módulo | Evalúa **una vez al importar** |
| `main.py` constantes de módulo | `main.py:149-173` | `GEMINI_API_KEY = _read_env_var(...)` a nivel módulo | Evalúa una vez al boot |
| `main.py` construcción de servicios | `main.py:257-259` | `DocumentClassifierService(api_key=GEMINI_API_KEY, …)` | Pasa la constante cacheada |
| `extractor.py` checks de capacidad | `extractor.py:308-360` | `os.environ.get("M3_API_KEY")` fresco en cada check | Pero las instancias `M3VisionBase`/`GeminiBase` ya tienen la key cacheada en `__init__` |

**Conclusión decisiva:** con la arquitectura actual, rotar una key en BD **NO tomaría efecto sin reinicio del proceso**. La implementación debe introducir un `KeyResolver` que las services consulten en cada llamada (con caché TTL corto + invalidación en escritura), y refactorizar los `__init__` y las constantes de módulo. Sin este refactor, el requisito "rotación inmediata sin reinicio" (punto 9 del brief) es imposible.

---

## 2. Decisiones

### D1 — Persistencia: modelo dedicado `AIProviderKey` (no tabla plana ni `SystemConfig` KV)

**Decisión:** tabla dedicada `AIProviderKey` con un row por proveedor (`m3`, `gemini`, `dr7`), campos `keyCiphertext`, `keyNonce`, `keyTag` (AES-GCM), `baseUrl`, `defaultModel`, `enabled`, `updatedBy`, `updatedAt`.

**Rationale frente a alternativas:**
- *Campo único por proveedor en una `SystemConfig` KV:* acopla settings no relacionados, dificulta auditoría por-row, mezcla TTLs de caché distintos. Rechazado.
- *Tabla plana sin modelo dedicado:* misma crítica. Rechazado.
- *Modelo dedicado:* una fila por proveedor → upsert atómico, auditoría precisa (`entityId = provider`), invalidación de caché por proveedor, extensión trivial a futuros proveedores. **Aceptado.**

### D2 — Cifrado: AES-256-GCM con `ENCRYPTION_KEY` env var (no plaintext, no KMS externo)

**Decisión:** AES-256-GCM (cifrado autenticado) usando `cryptography.hazmat.primitives.ciphers.aead.AESGCM`. Nonce aleatorio de 12 bytes por cifrado, almacenado junto al ciphertext. `ENCRYPTION_KEY` es un env var de 32 bytes (base64) que **solo existe en el backend**; la UI jamás ve ni maneja la key descifrada.

**Comparativa de riesgos:**

| Alternativa | Confidencialidad | Integridad | Coste/op | Complejidad | Veredicto |
|---|---|---|---|---|---|
| Plaintext + access control estricto | Baja (dump de BD filtra keys) | N/A | Mínimo | Mínima | ❌ Rechazado |
| **AES-256-GCM + env var key** | Alta | Alta (auth tag) | Bajo | Baja | ✅ **Aceptado** |
| Fernet (AES-128-CBC+HMAC) | Media-Alta | Alta | Bajo | Baja | ⚠️ Segunda opción (128 bits) |
| Vault / KMS externo (AWS, GCP, HashiCorp) | Muy alta | Muy alta | Alto | Alta (nuevo servicio, secreto de bootstrap, rotación de credencial de acceso) | ❌ Overkill para single-tenant Railway Postgres |
| SOPS + git-crypt | Alta | Alta | Medio | Alta (acceso a repo en runtime) | ❌ No encaja en runtime editable |

**Rotación de `ENCRYPTION_KEY`:** procedimiento documentado (no automático): (1) generar nueva key, (2) leer todas las filas con la key vieja, (3) descifrar + recifrar con la nueva, (4) actualizar env var, (5) reiniciar. Es evento raro y manual; queda fuera del scope de este ADR como acción automatizada.

### D3 — Precedencia runtime: BD gana si existe y está habilitada; env var como fallback

**Decisión:** `KeyResolver.resolve(provider)` retorna, en orden:
1. Si `AI_KEYS_FROM_DB_ENABLED != "true"` → retorna env var (flag apagado = comportamiento actual, cero riesgo).
2. Si flag encendido y existe row `AIProviderKey` con `enabled=true` y descifrado exitoso → retorna key de BD (`key_source = "db"`).
3. Si flag encendido pero no hay row / está deshabilitada / descifrado falla → retorna env var (`key_source = "env"`, con flag de advertencia según caso).

**Rationale:** permite despliegue incremental sin perder la config actual (producción sigue con env vars hasta que Frank pueble la BD vía UI). Nunca hay un "agujero" donde ninguna fuente tenga la key si la env var sigue presente.

### D4 — Permisos: PUT/DELETE solo SUPERADMIN; GET (listado mascareado) ADMIN_LIKE

**Decisión:**
- `PUT /api/v2/admin/ai-keys/{provider}` y `DELETE` → **solo SUPERADMIN**.
- `GET /api/v2/admin/ai-keys` (listado con `keySuffix`, nunca la key completa) → **ADMIN y SUPERADMIN** (`isAdminLike`).

**Justificación:** Frank no especificó rol; se interpreta lo más conservador para la acción destructiva (edición/borrado de secretos) = SUPERADMIN (alineado con `IMPL-20260730-01` delete-companies). El listado mascareado se abre a ADMIN porque ver *por qué* la IA está degradada (key presente/ausente) es útil para diagnóstico operativo y de bajo riesgo (solo últimos 4 chars). Frank puede bajarlo después si prefiere SUPERADMIN también para GET.

**Mecanismo:** el guard real vive en la **server action** (NextAuth session → `isSuperAdmin(session.user.role)`). El backend FastAPI hace defense-in-depth con el header `x-ami-role` (patrón existente en `maintenance.py:22`, `mobile_units.py:23`). Se documenta la frontera de confianza: Vercel→Railway es el límite de red; el header es de confianza porque solo el frontend autenticado lo setea.

### D5 — Audit trail: reutilizar `AuditLog` existente, sin loguear la key completa

**Decisión:** cada `PUT`/`DELETE` escribe un `AuditLog` con `action="ai_key_updated"`, `entity="AIProviderKey"`, `entityId=<provider>`, `details={ provider, updatedBy, maskedKeySuffix, source:"ui", fieldsChanged:[...] }`. **Nunca** se loguea la key completa ni el ciphertext. `maskedKeySuffix` = últimos 4 caracteres para identificación visual (ej. `…a9f3`).

### D6 — Rotación inmediata sin reinicio: `KeyResolver` con caché TTL + invalidación en escritura

**Decisión:** `KeyResolver` mantiene caché en memoria por proveedor con TTL de 60 s (evita hit de BD + descifrado por cada inferencia). El endpoint `PUT`/`DELETE` invoca `resolver.invalidate(provider)` tras commit → la siguiente inferencia ve la key nueva de inmediato (no espera 60 s). Las services (`M3VisionBase`, `GeminiBase`, `PrediagnosticService`) consultan al resolver **al inicio de cada `call_*`**, no en `__init__`.

**Rationale:** TTL+invalidación combina bajo coste (no golpea la BD por inferencia) con rotación inmediata (la invalidación la dispara la escritura). Si solo tuviera TTL sin invalidación, habría hasta 60 s de latencia de rotación; si solo invalidación sin TTL, BD por cada llamada (caro). Ambos = óptimo.

### D7 — Trazabilidad: `key_source` en metadatos de auditoría de cada corrida IA

**Decisión:** extender el dict de auditoría de extracción/prediagnóstico (el `extraction_snapshot.audit` / `AIAuditMetadata`) con `key_source: "env" | "db"` y, en casos de fallback por error, `key_resolution_warning` (enum: `flag_off`, `db_unavailable`, `decrypt_error`, `row_missing`). Permite depurar "¿de dónde se tomó la key en esta corrida?".

### D8 — Reversibilidad: feature flag `AI_KEYS_FROM_DB_ENABLED` (default `false`)

**Decisión:** env var `AI_KEYS_FROM_DB_ENABLED` controla si el resolver consulta la BD. Default `false` → comportamiento idéntico al actual (env-var-only). El flag es el interruptor maestro del rollout; permite desplegar todo el código (resolver, endpoints, UI) sin riesgo y activar cuando Frank lo decida.

---

## 3. Alternativas consideradas y descartadas

1. **Solo env vars (status quo):** no cumple requisito de Frank (redeploy obligatorio). Descartado.
2. **Env vars + rotación por redeploy programado:** no resuelve "sin redeploys". Descartado.
3. **KMS/Vault externo:** operativamente costoso para single-tenant; añade secreto de bootstrap (bootstrapping problem); Frank pidió evitar complejidad externa. Descartado (reabrible si el sistema crece a multi-tenant con requisitos de compliance).
4. **Plaintext en BD:** inaceptable para secretos. Descartado.
5. **Cifrado simétrico sin auth tag (AES-CBC puro):** sin integridad (tampering indetectable). GCM preferido.
6. **Rotación sin refactor de `__init__`:** imposible; las services cachean la key. El refactor es obligatorio (D6).

---

## 4. Consecuencias

**Positivas:**
- Rotación de keys en producción sin redeploy ni acceso a consola Railway.
- Auditoría por cambio de key con trazabilidad de quién/cuándo.
- Trazabilidad de fuente de key por corrida (`key_source`).
- Despliegue incremental seguro (flag off = cero cambio).

**Negativas / costes:**
- Refactor de `base.py` (`__init__` → resolver en `call_*`), `prediagnostic.py` (constantes de módulo → llamadas al resolver), `extractor.py`, `main.py` (construcción de servicios).
- Nuevo env var `ENCRYPTION_KEY` que **sí requiere un deploy inicial** para existir (excepción puntual al "sin redeploys" — una sola vez, para habilitar el cifrado; luego las keys rotan por UI sin más redeploys).
- Mayor superficie de prueba (cifrado roundtrip, precedencia, permisos, fallbacks).
- Confianza en el header `x-ami-role` para el guard backend (mitigada con guard real en server action).

**Riesgos residuales:**
- Compromiso de `ENCRYPTION_KEY`: expone todas las keys de BD. Mitigación: rotación manual documentada (§D2) + acceso restringido al env Railway.
- Bug en el refactor del resolver que rompa la lectura de env vars: mitigado por feature flag off y suite de tests de precedencia.

---

## 5. Supuestos

- El backend FastAPI corre en un solo proceso (o pocos) en Railway; la invalidación de caché en memoria es suficiente. Si el backend escala a múltiples réplicas, la invalidación debe propagarse (TTL de 60 s ya cubre la convergencia; aceptable).
- `cryptography` (lib Python) está o puede estar en `backend/requirements.txt`.
- La frontera de red Vercel→Railway es de confianza para el header `x-ami-role` (consistente con el modelo actual).

---

## 6. Conformidad con políticas

- §14 INTEGRA no escribe código: este ADR es markdown de decisión. La implementación se delega a SOFIA.
- No toca producción, auth, ni infraestructura sensible sin aprobación humana: el rollout es opt-in vía flag (default off).
- Trazabilidad: AuditLog + `key_source` en cada corrida.
