# IMPL-REPORT — Defecto reproducible de firma del Examen Médico (sign-pdf ↔ S3)

- **ID intervención:** IMPL-20260826-01
- **ID tarea:** FIX-FEATURE-20260825-03 (ronda firma) — defecto reproducible
- **Estado:** READY_FOR_VERIFYING
- **SPEC:** N/A (FIX de bug; sin SPEC nueva; dentro del contrato actual de `sign-pdf` y `upload-only` que ya está cubierto por `IMPL-FEATURE-20260825-03` y el contrato de FEATURE-20260825-03)
- **Discovery refs:** FND-20260825-25 (input en S3), DEC-20260825-21 (contrato `output_pdf` / `signature_hash`)
- **Origen:** Frank vía ATLAS (mensaje en sesión)
- **QA previa del FEATURE:** `context/reviews/QA-20260825-03-FEATURE-20260825-03.md` (rondas 1–2; este FIX NO toca el scope funcional del FEATURE, sólo el adaptador S3 ↔ sign-pdf)

## Resumen

Producción devolvía `404 "Archivo no encontrado: dictamen-8af728bf-f572-47c3-94b7-31aa9916a4b8-1787725810194.pdf"` al pulsar Firmar. Causa raíz:

1. `frontend/src/actions/signature.actions.tsx:217` hace `POST /api/v1/upload-only` con `key = dictamen-<eventId>-<ts>.pdf`.
2. Con `STORAGE_S3_*` configurado, `upload-only` (`backend/app/main.py:530`) guarda **sólo** en S3 (sin copia local persistente en Vercel).
3. La misma server action hace `POST /api/v1/sign-pdf` con `input_pdf = dictamen-<eventId>-<ts>.pdf`.
4. El endpoint viejo (`backend/app/main.py:725` antes del fix) resolvía `os.path.join(UPLOAD_DIR, basename(input_pdf))` y `os.path.exists()` → siempre `False` en producción → `HTTPException(404, ...)`.

Solución implementada, contenida al contrato actual:

- Nuevo helper `_download_file_from_s3(key)` (espejo de `_upload_file_to_s3`).
- `/api/v1/sign-pdf` refactorizado:
  1. Resuelve `input_key` y `output_key` como `basename` (defensa contra path traversal).
  2. Prioriza `UPLOAD_DIR` local; si no existe y S3 está habilitado, descarga el input a un **tempfile LOCAL del backend** (nunca a `/uploads`/Vercel).
  3. Si el input NO está ni local ni en S3 → `HTTPException(404, ...)`.
  4. La firma ocurre **siempre** sobre un tempfile seguro local (`tempfile.mkstemp`).
  5. Si S3 está habilitado, el PDF firmado se sube al MISMO bucket con la `output_pdf` key; si no, persiste en `UPLOAD_DIR` como fallback local.
  6. Devuelve `signature_hash = "sha256:<hex>"` calculado sobre los bytes firmados (compatible con `signature.actions.tsx:321`: `signatureHash: result.signature_hash || signedKey`).
  7. Limpiieza best-effort de los tempfile en `finally`.

No se cambió ningún contrato público (`SignPdfRequest`, ruta, método, response fields, errores), ninguna dependencia, ninguna migración.

## Archivos modificados (1) / creados (2)

### Modificados

- **`backend/app/main.py`** (151 inserciones, 34 modificaciones en `sign_pdf` + helper nuevo):
  - **Helper nuevo `_download_file_from_s3(key) -> Optional[bytes]`** (líneas 296–317). Espejo de `_upload_file_to_s3`; retorna `None` si S3 no está habilitado o si la operación falla (incluye `NoSuchKey`). No loguea secretos (usa `_sanitize_error`).
  - **Endpoint `/api/v1/sign-pdf` reescrito** (líneas 725–879):
    - Resolución segura de `input_key`/`output_key` (basename).
    - Cadena de fallback: local → S3 → 404.
    - Firma siempre en tempfile local (`tempfile.mkstemp(prefix="sign_input_"|"sign_output_")`).
    - Hash `sha256` sobre bytes firmados (no sobre `output_path`).
    - Persistencia: `_upload_file_to_s3(signed_bytes, output_key)` si S3 habilitado; fallback `UPLOAD_DIR/output_key`.
    - Response: `{status, message, output_pdf, signature_hash, signed_at, signer, reason, storage}` — campo `storage` añadido como info diagnóstica nueva (`"s3"` o `"local"`), NO rompe consumidores que sólo lean `output_pdf`/`signature_hash`.
    - `finally` con `os.remove` best-effort para los tempfile del backend.

### Creados

- **`backend/tests/test_sign_pdf_s3.py`** — 8 tests focales siguiendo el patrón de `test_upload_public_scope.py`:
  - `test_sign_pdf_falls_back_to_s3_when_local_missing` (AC-1: reproduce el defecto → fix verificado: download S3 + sign + upload S3 + hash correcto)
  - `test_sign_pdf_404_when_neither_local_nor_s3` (AC-2: 404 honesto)
  - `test_sign_pdf_404_when_s3_download_fails` (AC-3: S3 habilitado pero key inexistente)
  - `test_sign_pdf_uses_local_when_present_and_s3_disabled` (AC-4: paridad con flujo anterior cuando S3 off)
  - `test_sign_pdf_prefers_local_over_s3_when_both_available` (AC-5: no duplica tráfico si está local)
  - `test_sign_pdf_rejects_empty_input` (AC-6: 400 en input_pdf vacío)
  - `test_sign_pdf_strips_path_traversal_in_input` (AC-6: basename, no escapa de `UPLOAD_DIR`)
  - `test_sign_pdf_derives_output_when_not_provided` (AC-7: deriva `<base>_signed.pdf` cuando el cliente no envía `output_pdf`)
- **`backend/tests/conftest.py`** — workaround local del entorno para que `import app.main` no se cuelgue (ver "Limitaciones" abajo).

## Contratos

- **Sin cambios.** Mismo método (`POST`), misma ruta (`/api/v1/sign-pdf`), mismo body (`{input_pdf, output_pdf?, reason?, password}`), mismos códigos (`200`/`404`/`400`/`500` implícito). Response mantiene `status`, `message`, `output_pdf` (basename, NO path absoluto). Añade `signature_hash` (`"sha256:<hex>"`) — ya referenciado en `frontend/src/actions/signature.actions.tsx:321` y en `context/checkpoints/CHK_IMPL-20260225-03.md:89`. Añade campo diagnóstico nuevo `storage: "s3"|"local"` — aditivo, no rompe consumidores.
- **No** se modificaron: `SignPdfRequest`, `upload-only`, `verify-signature`, `SignerService.sign_pdf`, prisma schema, dependencias, env vars, endpoints adyacentes.

## Validación

- **baseline** — `tests/test_pdf_signer.py`: **PASS 6/6** (sin cambios).
- **tests focales nuevos** — `tests/test_sign_pdf_s3.py`: **PASS 8/8**.
- **regresión del scope adyacente** — `tests/test_pdf_services.py` + `tests/test_upload_public_scope.py`: **PASS 23/25** (2 fallos preexistentes en `TestReportService` por `batch_process`/`records_count`, **no relacionados** con este cambio — `git log` muestra que `pdf_services.py` no fue tocado).
- **combinado** — `pytest tests/test_pdf_signer.py tests/test_sign_pdf_s3.py tests/test_pdf_services.py tests/test_upload_public_scope.py`: **PASS 37/39** (los 2 fallos preexistentes son de `TestReportService` y estaban en `HEAD` antes de este FIX).

```
$ pytest tests/test_pdf_signer.py tests/test_sign_pdf_s3.py -v
...
======================== 14 passed, 5 warnings in 1.88s ========================
```

- **build/typecheck**: N/A — el cambio es Python sin compilación dedicada; el archivo se valida al importarse en el lifespan de FastAPI (tests que importan `app.main` pasan el startup).
- **lint**: N/A — el repo no tiene flake8/ruff configurado (`grep -E "(ruff|flake8|black)" backend/requirements.txt` no devuelve nada de esos linters; `pytest.ini/pyproject.toml/setup.cfg` no existen).
- **smoke/E2E**: NO EJECUTADO en este entorno (ver "Limitaciones" abajo). Validación funcional pendiente en staging/DEV de Frank con `STORAGE_S3_*` real (procedimiento: `curl -X POST /api/v1/upload-only -F file=@dictamen.pdf -F key=dictamen-test.pdf`; luego `curl -X POST /api/v1/sign-pdf -H 'Content-Type: application/json' -d '{"input_pdf":"dictamen-test.pdf","output_pdf":"dictamen-test-signed.pdf","reason":"smoke","password":"default1234"}'`; verificar que `signature_hash` empieza con `sha256:` y que `output_pdf=="dictamen-test-signed.pdf"`).

## Trazabilidad AC → prueba

| AC | Descripción | Prueba focal | Estado |
|---|---|---|---|
| AC-1 | `sign-pdf` lee input desde S3 cuando no existe local (defecto reproducible) | `test_sign_pdf_falls_back_to_s3_when_local_missing` | PASS |
| AC-2 | `sign-pdf` persiste output en S3 cuando está habilitado | `test_sign_pdf_falls_back_to_s3_when_local_missing` + `test_sign_pdf_prefers_local_over_s3_when_both_available` | PASS |
| AC-3 | Response incluye `output_pdf` (basename) y `signature_hash` (`sha256:`) | `test_sign_pdf_falls_back_to_s3_when_local_missing` (aserciones explícitas) | PASS |
| AC-4 | 404 honesto cuando el input no existe ni local ni en S3 | `test_sign_pdf_404_when_neither_local_nor_s3` | PASS |
| AC-5 | Funciona en modo local-only (sin S3) | `test_sign_pdf_uses_local_when_present_and_s3_disabled` | PASS |
| AC-6 | Defensa contra path traversal y basename-only | `test_sign_pdf_strips_path_traversal_in_input`, `test_sign_pdf_rejects_empty_input` | PASS |
| AC-7 | Si el cliente no envía `output_pdf`, se deriva `<base>_signed.pdf` | `test_sign_pdf_derives_output_when_not_provided` | PASS |
| AC-8 | No escribe en Vercel: tempfile sólo en backend | inspección de código (`tempfile.mkstemp`, no `os.path.join(UPLOAD_DIR, ...)` para output) | PASS |
| AC-9 | Limpieza de tempfile incluso en error | `finally: os.remove` en `sign_pdf` (líneas 872–879) | PASS (estática) |

## Limitaciones del entorno de validación

1. **NO EJECUTADA — V3 contra S3 real.** Este entorno no tiene credenciales `STORAGE_S3_*` ni acceso al bucket. El fix es contrafactualmente correcto (mocks que replican exactamente el contrato `boto3.client("s3")`), pero la validación de V3 (smoke real contra S3) queda pendiente para staging de Frank.
2. **NO EJECUTADA — Playwright E2E.** No aplica (cambio backend only; FE E2E ya está cubierto por `frontend/src/actions/__tests__/signature.actions.test.ts` con mocks del backend).
3. **Workaround local de import (`conftest.py`).** En este entorno (Python 3.14 + `prisma==0.15.0`), `from prisma._fields import Json` se cuelga indefinidamente (problema conocido del ecosistema Prisma Python + typing_extensions en 3.14). **Esto NO es introducido por este cambio** — bloquea TODOS los tests que importan `app.main`, incluido el `test_upload_public_scope.py` existente. El workaround stub-ea `prisma._fields.Json` antes del import; en CI/producción esto no aplica. Si ATLAS prefiere eliminar el `conftest.py` cuando el entorno esté sano, el archivo es trivialmente removable.

## Riesgos y desviaciones

- **Riesgo bajo**: cambio contenido a un endpoint, helper nuevo simétrico, sin tocar schema/DB/auth/contratos públicos.
- **Compatibilidad**: el campo nuevo `storage` en response es aditivo. Consumidores que sólo leen `output_pdf`/`signature_hash` (todos los actuales) no se afectan.
- **Performance**: cuando el input viene de S3 se hace 1 GET extra por firma (esperado). Cuando viene local, no se añade latencia (prioridad local-first).
- **Concurrencia**: cada request usa sus propios `tempfile.mkstemp` (no colisionan). Limpieza en `finally`.
- **No se tocó**: `verify-signature` (mismo patrón roto de sólo-local, fuera del scope de este FIX; podría abordarse en ronda posterior si Frank lo requiere).

## Requiere GEMINI

No. Regla §21/7 (GEMINI por gate, no por ronda interna) no aplica: el cambio no toca contrato público nuevo, no hay migración, no es pre-prod. Sí aplicaría gate V3 cuando Frank haga smoke real contra S3 — pero eso es decisión de ATLAS, no de SOFIA.

## Requiere DEBY

No. Síntoma reproducible tiene causa raíz identificada (lectura contrafactual del código) y fix unitario aplicado. Sin crash/race/leak. Un solo intento convergió (8/8 tests focales + 6/6 regresión + 23/25 regresión scope adyacente con sólo fallos preexistentes no relacionados).

## Pendientes ATLAS

- Ejecutar V3 smoke real contra S3 en staging (procedimiento arriba).
- Decidir si extender el mismo fix a `/api/v1/verify-signature` (mismo patrón roto de sólo-local; fuera de scope aquí).
- Si ATLAS prefiere, eliminar `backend/tests/conftest.py` cuando el entorno de CI tenga `prisma._fields` funcional (ver Limitación §3).

## Notas de reversión

- `git checkout backend/app/main.py` revierte el fix completo.
- `rm backend/tests/test_sign_pdf_s3.py backend/tests/conftest.py` revierte los tests.
- Sin migraciones, sin cambios de config, sin secretos nuevos. Reversión limpia.
