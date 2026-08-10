# DICTAMEN TÉCNICO: Prisma Python 0.15 no serializa `bytes` para BYTEA — writer AI keys 500ea y reader cae a env var

- **ID:** FIX-20260810-02
- **Fecha:** 2026-08-10
- **Solicitante:** INTEGRA / Frank (tras FIX-20260810-01)
- **Estado:** ✅ VALIDADO (conf >=95%, evidencia en logs de producción + código verificado)
- **Nivel:** L1 (2 archivos productivos, 10 líneas, sin cambio de contrato público)

## A. Análisis de Causa Raíz

**Síntoma:** `PUT /api/v2/admin/ai-keys/{provider}` → 500; UI lista keys con warning `decrypt_error`; probe surfacea `ERROR_KIND_DECRYPT_ERROR`.

**Hallazgo forense (verificado contra código actual + logs Railway):**

1. **Escritura rota** — `backend/app/api/v2/admin_ai_keys.py:253-277` pasa `bytes` crudos de AES-GCM a `prisma.aiproviderkey.create/update`. El serializer JSON de prisma-client-py 0.15.0 (`_builder.py:826`) no serializa `bytes` → `TypeError: Type <class 'bytes'> not serializable` → 500. Coincide 1:1 con el log de producción.
2. **Lectura rota** — `backend/app/services/ai/keys.py:322-324` y `admin_ai_keys.py:80-82` hacen `bytes(row.keyCiphertext)`. El log de producción muestra `descifrado falló (TypeError)`: la única forma de que `bytes(x)` lance TypeError es que `x` sea `str` sin encoding → **Prisma Python devuelve los campos `Bytes` como base64 `str`, NO bytes crudos**. El comentario IMPL-20260809-08 ("Prisma devuelve BYTEA como bytes crudos") es falso.
3. **Historial git** — `d7dc40a` (IMPL-20260809-07) ya aplicó el fix base64 correcto. `2942cb8` (IMPL-20260809-08) lo revirtió basándose en una premisa errónea ("Prisma almacena la representación ASCII del base64"). Eso contradice el contrato documentado de Prisma (la API expone Bytes como base64; el engine decodifica a bytes reales al almacenar) y la traza de producción. Los tests no lo detectaron porque **los mocks codifican la misma premisa falsa** (autoconsistentes pero infieles al cliente real): `test_admin_ai_keys.py:88,107` fuerza `bytes(...)` en el store y `test_ai_keys.py:83-85` crea rows con bytes crudos.
4. **Probe** — `probe.py:396-401` surfacea `resolution.warning == "decrypt_error"`; es consecuencia del punto 2, no un bug independiente.
5. **AppConfig NO afectado** — migración `20260809223443_add_app_config` crea `app_config` con `TEXT`/`JSONB`/`TIMESTAMP` únicamente (cero BYTEA); `app_config.py` solo toca `row.value` (Json). Confirmado: fuera del alcance del bug.
6. **Frontend no afectado** — `frontend/src/actions/ai-keys.actions.ts:401` solo usa `keyCiphertext` como guard anti-leak del body; nunca lee el ciphertext.

**Causa raíz:** contrato de serialización de prisma-client-py 0.15.0 para columnas `Bytes` = **base64 string en ambas direcciones** (write: str base64 → engine decodifica a BYTEA; read: BYTEA → str base64). El código actual viola el contrato en write (bytes) y en read (`bytes(str)` → TypeError).

## B. Justificación de la Solución (quick-fix exacto, 10 líneas)

Restaurar el patrón de `d7dc40a` (ya demostrado), con el fix de lectura incluido. `base64.b64decode` acepta `str` y `bytes` ASCII, por lo que la lectura es tolerante si alguna versión futura devolviera bytes.

### Archivo 1: `backend/app/api/v2/admin_ai_keys.py`

```diff
@@ imports (línea ~16) @@
 from __future__ import annotations
 
+import base64
 from datetime import datetime, timezone

@@ upsert_ai_key, tras línea 249 (key_suffix = ...) @@
     ciphertext, nonce, tag = encrypt_key(api_key, master_key)
     key_suffix = api_key[-4:] if len(api_key) >= 4 else api_key
+    # FIX-20260810-02: prisma-client-py 0.15 no serializa bytes para BYTEA;
+    # requiere base64 str (el engine decodifica a bytes al almacenar).
+    ciphertext = base64.b64encode(ciphertext).decode("ascii")
+    nonce = base64.b64encode(nonce).decode("ascii")
+    tag = base64.b64encode(tag).decode("ascii")
```
Los dicts `create`/`update` (líneas 253-277) quedan intactos: reutilizan las variables ya recodificadas.

```diff
@@ _key_suffix_from_row, líneas 78-84 @@
-        # IMPL-20260809-08: BYTEA almacena ciphertext crudo (bytes), no base64.
+        # FIX-20260810-02: Prisma Python devuelve BYTEA como base64 str.
         plaintext = decrypt_key(
-            bytes(row.keyCiphertext),
-            bytes(row.keyNonce),
-            bytes(row.keyTag),
+            base64.b64decode(row.keyCiphertext),
+            base64.b64decode(row.keyNonce),
+            base64.b64decode(row.keyTag),
             mk,
         )
```

### Archivo 2: `backend/app/services/ai/keys.py` (ya importa `base64`, línea 22)

```diff
@@ resolve(), líneas 318-326 @@
             try:
-                # IMPL-20260809-08 (fix): Prisma Python devuelve BYTEA como bytes crudos.
-                # admin_ai_keys.py ahora pasa los bytes de ciphertext directamente (sin b64).
+                # FIX-20260810-02: Prisma Python devuelve BYTEA como base64 str;
+                # decodificar antes de pasar a decrypt_key.
                 api_key = decrypt_key(
-                    bytes(row.keyCiphertext),
-                    bytes(row.keyNonce),
-                    bytes(row.keyTag),
+                    base64.b64decode(row.keyCiphertext),
+                    base64.b64decode(row.keyNonce),
+                    base64.b64decode(row.keyTag),
                     master_key,
                 )
```

Únicos 2 sitios con `bytes(row.*` en `backend/app` (grep verificado). Sin migración, sin schema change, sin toque a AppConfig.

### Lectura vs escritura — análisis de mismatch (pregunta 2)

- **Writer actual:** bytes crudos (roto en el serializer; nunca escribió nada en producción).
- **Reader actual:** espera bytes crudos (roto con TypeError porque Prisma devuelve str).
- **No hay mismatch writer↔reader entre sí** (ambos asumen bytes), pero **ambos están rotos contra el contrato real de Prisma** (base64 str en ambas direcciones). El fix corrige los dos lados simétricamente: write b64encode ↔ read b64decode. El fix de escritura NO agrava la lectura: la deja igual de rota que hoy hasta aplicar el fix de lectura incluido aquí; ambos deben desplegarse juntos en el mismo commit.
- **Rows legacy (gemini, dr7 — insertadas vía psycopg2 directo como bytes crudos, según commit 2942cb8):** Prisma leerá el BYTEA y devolverá base64 str de esos bytes → `b64decode` → bytes crudos originales → `decrypt_key` OK. **Siguen descifrables tras el fix** — confirmado por el código del reader corregido y por tu prueba psycopg2 (ct+tag descifra limpio). No se requiere backfill ni re-inserción.

### Plan de rollback (pregunta 4)

**Seguro.** El fix solo cambia serialización en capa de aplicación:
- Revertir el commit vuelve al estado roto de hoy (PUT 500 + read fallback a env), sin pérdida ni corrupción de datos.
- Rows escritas bajo el fix quedan en BYTEA como bytes reales (el engine decodifica el base64); bajo código revertido el reader falla igual que hoy (TypeError → fallback env var, degradación controlada ya existente) y vuelven a ser legibles al re-aplicar el fix.
- Riesgo residual (bajo): si la premisa de 2942cb8 fuera cierta y el engine guardara ASCII de base64 sin decodificar (contradice docs de Prisma y la traza), el primer PUT+GET lo revelaría inmediatamente (keySuffix null + probe decrypt_error). Mitigación: smoke test post-deploy obligatorio (abajo) y revert trivial.

## C. Tests (pregunta 5)

Los mocks actuales replican la premisa falsa; hay que hacerlos fieles al contrato Prisma:

1. **`test_admin_ai_keys.py:81-116` (`_RepoMock.create/update`):** eliminar coerción `bytes(...)`; almacenar `data[f]` tal cual (str base64) y añadir guard que imite al serializer real:
   ```python
   for f in ("keyCiphertext", "keyNonce", "keyTag"):
       if isinstance(data[f], bytes):
           raise TypeError(f"Type {type(data[f])} not serializable")  # imita _builder.py:826
   ```
   Este guard ES la regresión de producción: si alguien vuelve a pasar bytes, el test falla con el mismo error de Railway.
2. **`test_ai_keys.py:74-91` (`_make_db_row`):** campos como base64 str: `row.keyCiphertext = base64.b64encode(ct).decode("ascii")` (id. nonce/tag).
3. **`test_ai_keys.py:290` (corrupción):** `row.keyCiphertext = base64.b64encode(bytes(b ^ 0xFF for b in base64.b64decode(row.keyCiphertext))).decode("ascii")`.
4. **Test nuevo de regresión:** `test_put_stores_base64_and_roundtrip_resolve` — PUT → assert de que el store recibió `str` (no bytes) decodificable al ciphertext esperado → GET devuelve `keySuffix` correcto → `resolver.resolve()` con flag on retorna `source="db"` con la key descifrada.

Gates: `pytest backend/tests/test_ai_keys.py backend/tests/test_admin_ai_keys.py backend/tests/test_ai_probe.py` (35+ tests AI). Failures pre-existentes en test_pdf_services/test_reports no relacionados.

## D. Orden de despliegue (pregunta 6)

1. Aplicar fix (2 archivos) + actualización de tests.
2. `pytest` verde en los 3 archivos de arriba.
3. Commit: `fix(ai-keys): FIX-20260810-02 - base64 para BYTEA en writer y reader de AIProviderKey` → push. Railway está conectado al repo: **redeploy automático, sin migración ni paso manual**.
4. **Smoke post-deploy (obligatorio, ~2 min):** PUT key m3 vía UI → 200; GET listado → `keySuffix` no-null en los 3 proveedores; probe m3/gemini/dr7 → sin `decrypt_error`; verificar en logs que NO reaparece `Type <class 'bytes'> not serializable`.
5. Si el smoke falla → `git revert` + push (rollback seguro, ver §B).

## E. Autocrítica contra SPEC

- SPEC ARCH-20260809-03 §6.2 (PUT cifra y guarda): el fix restaura el cumplimiento; el contrato HTTP no cambia.
- CB-1/CB-2/CB-3 (degradación a env var): intactos; el `except Exception` del resolver sigue cubriendo InvalidTag y cualquier anomalía.
- Seguridad: no se loguea key ni ciphertext; `base64.b64encode` no es cifrado pero el material ya está cifrado (AES-GCM) antes de codificarse.
- Principio del Cañón y la Mosca: 10 líneas, patrón ya demostrado en d7dc40a, cero refactor.

**Nota:** el solicitante pidió explícitamente solo dictamen (no aplicar parche). Fix listo para aplicar como L1 en cuanto se autorice.
