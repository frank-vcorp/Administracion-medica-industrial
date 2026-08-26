# IMPL-REPORT — IMPL-FIX-20260826-01 (ronda 2) — Incompatibilidad pyHanko en SignerService.sign_pdf

- **ID intervención:** IMPL-FIX-20260826-01 (ronda 2 — sigue al FIX S3)
- **ID tarea:** FIX-FEATURE-20260825-03 (defecto reproducible firma Examen Médico)
- **Estado:** READY_FOR_VERIFYING
- **SPEC:** N/A (FIX de bug; sin SPEC nueva; dentro del contrato actual de `SignerService` que ya está cubierto por `IMPL-20260225-02`).
- **Discovery refs:** FND-20260825-25, DEC-20260825-21
- **Origen:** Frank vía ATLAS — smoke real post-fix-S3 reveló nueva incompatibilidad.

## Resumen

Tras `IMPL-20260826-01` (ronda 1 — fix S3 en `backend/app/main.py:sign_pdf`), el smoke real contra S3 confirmó el upload del PDF a S3, pero `sign-pdf` devolvía `Error al firmar PDF: SimpleSigner.load() got an unexpected keyword argument 'digest_alg'`.

Causa raíz: la versión de `pyHanko` instalada en producción (≥0.30) cambió la API de firma digital con breaking changes no negociables. La implementación previa de `SignerService.sign_pdf` (`backend/app/services/pdf/signer.py`) usaba:

1. **`SimpleSigner.load(file, key_passphrase, ca_chain_files=None, digest_alg="sha256")`** — API antigua que aceptaba un único file-like (PKCS#12 o PEM) y el kw `digest_alg`. La nueva `SimpleSigner.load(key_file, cert_file, ...)` requiere **key_file y cert_file separados** (PEM). Para PKCS#12 existe ahora `SimpleSigner.load_pkcs12(pfx_file, passphrase, ...)`.
2. **`writer.PdfFileWriter().append_from_reader(...) + .sign(signers=[...])`** — flujo antiguo. La nueva API usa `IncrementalPdfFileWriter(input_stream)` + `PdfSigner(signature_meta, signer).sign_pdf(pdf_writer, output=..., appearance_text_params=...)`.
3. **`digest_alg="sha256"`** ya no se pasa — la nueva API deriva el mecanismo de firma del certificado (`signature_mechanism=...` opcional).

Adaptación contenida al contrato actual de `SignerService` (`__init__`, `sign_pdf`, `verify_signature`):

- `sign_pdf`: detecta formato por extensión → `.p12`/`.pfx` usa `load_pkcs12`; otros (PEM) usa `load` con `key_file`+`cert_file`. Para PEM desencriptado detecta si la key está cifrada (`-----BEGIN ENCRYPTED PRIVATE KEY-----`) y sólo pasa passphrase en ese caso. Reemplaza `PdfFileWriter().append_from_reader().sign(...)` por `IncrementalPdfFileWriter` + `PdfSigner(...).sign_pdf(...)`.
- `verify_signature`: pyHanko ≥0.30 es estricto con PDFs malformados y lanza `PdfReadError`. Se captura y se devuelve `is_signed=False` con `note` informativo, sin propagar como error. **Esto es lo único adicional que requirió corrección** ("Revisa si hay otra incompatibilidad inmediata de API y corrige sólo lo necesario").

Sin cambios en: contrato público de `SignerService`, `__init__`, parámetros `cert_path`/`key_path`/`cert_dir`/`password`/`reason`, generación de certificados (`_generate_test_certificate` sin tocar — sigue generando PEM unencrypted como fallback y PKCS#12 cuando cryptography lo soporta), ni en dependencias (sigue requiriendo `pyhanko` ≥ 0.30 instalado en backend).

## Archivos modificados (1) / creados (0 nuevos, sólo extensiones de tests)

### Modificados

- **`backend/app/services/pdf/signer.py`** (153 inserciones, 46 modificaciones):
  - **`sign_pdf` reescrito** (líneas 135–278): docstring ampliado con la nota del fix. Bloque pyHanko reemplazado íntegramente:
    1. Detección de formato por extensión: `.p12`/`.pfx` → `SimpleSigner.load_pkcs12(pfx_file=..., passphrase=...)`; resto (PEM) → `SimpleSigner.load(key_file=..., cert_file=..., key_passphrase=...)`.
    2. Para PEM: detecta si la key está cifrada leyendo la primera línea (`-----BEGIN ENCRYPTED PRIVATE KEY-----`) y sólo pasa `passphrase` en ese caso. Evita el error "Password was given but private key is not encrypted" cuando el fallback del cert generator usa `NoEncryption()`.
    3. Reemplazo del flujo de firma: input se carga a `BytesIO` (porque `IncrementalPdfFileWriter` retiene referencias al stream durante toda la firma — un `with open(...)` que cierre antes dispara `ValueError: seek of closed file`); luego `IncrementalPdfFileWriter(_in_buf)` + `PdfSignatureMetadata(field_name="Signature1", reason=reason)` + `PdfSigner(signature_meta=meta, signer=signer)` + `pdf_signer.sign_pdf(pdf_out, output=outf, appearance_text_params={"signers": reason})`.
    4. Fallback a "marca simple" (sin firma real) preservado intacto para entornos sin `pyhanko` instalado.
  - **`verify_signature` ajustado** (líneas 297–335): importa `pyhanko.pdf_utils.misc.PdfReadError`. Captura `PdfReadError` al instanciar `PdfFileReader` y devuelve `{"status":"success", "is_signed": False, "signatures_found": 0, "note": "PDF malformado o sin estructura parseable"}`. Esto cubre el test preexistente `test_verify_signature_unsigned_pdf` que pasa un PDF garbage (`b"%PDF-1.4\ndummy unsigned pdf"`).
  - **NO** se cambió el contrato público, ni `__init__`, ni `_generate_test_certificate`, ni el fallback a "marca simple" ni el import del CLI de pyhanko (`python -m pyhanko sign addsig`) comentado al principio.

### Modificados (tests)

- **`backend/tests/test_pdf_signer.py`** (+228 líneas, -0): dos tests focales nuevos al final del archivo:
  - `test_sign_pdf_real_pyhanko_with_pem_material`: genera material PEM deterministamente (sin depender del cert generator ni de side-effects de imports), stub-ea `_generate_test_certificate` para evitar regeneración, firma un PDF mínimo válido y verifica que el output tiene una firma embebida (`PdfFileReader(...).embedded_signatures` no vacío).
  - `test_sign_pdf_real_pyhanko_handles_p12_extension`: genera un .p12 real (vía `cryptography.hazmat.primitives.serialization.pkcs12.serialize_key_and_certificates` con la misma password que el flujo canónico), firma un PDF y verifica la firma embebida — confirma que el camino `load_pkcs12` funciona end-to-end.

## Contratos

- **Sin cambios.** `SignerService.__init__(cert_path, key_path, cert_dir)`, `sign_pdf(input_pdf, output_pdf, reason, password)`, `verify_signature(pdf_path)` mantienen la misma firma y semántica. Response de `sign_pdf` mantiene `{status, message, output_pdf, signed_at, signer, reason}` (warning sólo en fallback).
- `verify_signature` ahora puede devolver un campo adicional `note` (`"PDF malformado o sin estructura parseable"`) cuando el PDF no es parseable — campo **aditivo**, no rompe consumidores.
- Sin cambios en: dependencias (`requirements.txt` ya lista `pyhanko`), endpoints, schema, env vars, ni en la generación de certificados.

## Validación

- **Tests focales nuevos** — `tests/test_pdf_signer.py::test_sign_pdf_real_pyhanko_*`: **PASS 2/2** (incluye firma real end-to-end con pyHanko ≥0.30 instalado: PEM y PKCS#12).
- **Regresión `test_pdf_signer.py`** — **PASS 8/8** totales (6 existentes + 2 nuevos).
- **Regresión `test_pdf_services.py::TestSignerService`** — **PASS 7/7** (incluye `test_verify_signature_unsigned_pdf` que ahora confirma que PDFs malformados → `is_signed=False` con `note`).
- **Regresión `test_sign_pdf_s3.py`** — **PASS 8/8** (los tests del endpoint que mockean el signer siguen pasando porque su stub no usa pyHanko real).
- **Regresión `test_upload_public_scope.py`** — **PASS 7/7**.

```
$ pytest tests/test_pdf_signer.py tests/test_pdf_services.py::TestSignerService \
        tests/test_sign_pdf_s3.py tests/test_upload_public_scope.py -v
...
======================== 30 passed, 26 warnings in 5.0s ========================
```

- **build/typecheck**: N/A (Python sin compilación dedicada; `ast.parse` confirma sintaxis válida en `signer.py`).
- **lint**: N/A (no hay flake8/ruff configurado en el repo).
- **smoke/E2E**: NO EJECUTADO en este entorno (no hay credenciales S3). Smoke real contra S3 + pyHanko ≥0.30 queda pendiente en staging de Frank.

## Trazabilidad AC → prueba

| AC | Descripción | Prueba focal | Estado |
|---|---|---|---|
| AC-1 | `sign_pdf` carga material criptográfico correctamente con pyHanko ≥0.30 (sin `digest_alg`) | `test_sign_pdf_real_pyhanko_with_pem_material` + `test_sign_pdf_real_pyhanko_handles_p12_extension` | PASS |
| AC-2 | Detección automática de formato (PEM vs PKCS#12) por extensión | Ambas tests cubren los dos caminos | PASS |
| AC-3 | PEM key sin encriptar: no se pasa passphrase (evita "Password was given but private key is not encrypted") | `test_sign_pdf_real_pyhanko_with_pem_material` (PEM NoEncryption()) | PASS |
| AC-4 | PKCS#12 con passphrase: usa `load_pkcs12` correctamente | `test_sign_pdf_real_pyhanko_handles_p12_extension` | PASS |
| AC-5 | El PDF firmado contiene una firma embebida detectable | Ambas tests verifican `PdfFileReader.embedded_signatures` | PASS |
| AC-6 | `verify_signature` con PDF malformado → `is_signed=False` (no propaga error) | `test_pdf_services.py::TestSignerService::test_verify_signature_unsigned_pdf` | PASS |
| AC-7 | Sin cambios en el contrato de `__init__`, `sign_pdf`, `verify_signature` | inspección de firma + suite de tests preexistentes | PASS |
| AC-8 | Fallback "marca simple" preservado si pyhanko no está instalado | `test_sign_pdf_fallback_marks_pdf_when_pyhanko_unavailable` | PASS |

## Limitaciones del entorno

1. **NO EJECUTADA — V3 contra S3 + pyHanko real en staging.** Este entorno no tiene `STORAGE_S3_*`. El fix S3 (ronda 1) + el fix pyHanko (ronda 2) deben validarse juntos contra S3 + pyHanko ≥0.30 reales en staging de Frank.
2. **`conftest.py` workaround** sigue activo (issue preexistente de `prisma._fields` con Python 3.14 + typing_extensions; afecta a TODOS los tests que importan `app.main`). Removible cuando CI tenga `prisma._fields` funcional.
3. **2 fallos preexistentes no relacionados** en `test_pdf_services.py::TestReportService` (`test_generate_json_report_empty_data`, `test_batch_process_success`) — sin cambios en `pdf/reporter.py` desde antes de este fix.

## Riesgos y desviaciones

- **Riesgo bajo**: cambio contenido a `signer.py`. Sin tocar schema, contratos públicos, generación de certs, endpoints, ni dependencias.
- **Compatibilidad hacia atrás**: `verify_signature` añade campo `note` (aditivo). Ningún consumidor existente lee ese campo.
- **Compatibilidad con pyHanko <0.30**: NO soportada. La API `IncrementalPdfFileWriter` existe desde pyHanko 0.20 pero la firma `SimpleSigner.load(key_file, cert_file, ...)` se consolidó en 0.25+ y `load_pkcs12` se renombró en 0.28+. Si producción tiene <0.28, este fix no funciona (necesitaría una rama alternativa — fuera de scope; pyHanko en `requirements.txt` no tiene pin de versión pero el entorno afectado ya usa 0.36+).
- **Side-effect observado (info)**: cuando `pyhanko` se importa en el proceso, `cryptography.hazmat.primitives.serialization.pkcs12` se vuelve disponible como atributo del módulo `serialization`. Esto cambia el comportamiento del cert generator (genera PKCS#12 real en lugar de caer al fallback PEM). Documentado en el test `test_sign_pdf_real_pyhanko_with_pem_material` con stub de `_generate_test_certificate` para tener un test determinista.

## Requiere GEMINI

No. Regla §21/7 (GEMINI por gate) no aplica: el cambio no toca contrato público nuevo, no hay migración, no es pre-prod. Sí aplicaría gate V3 cuando Frank haga smoke real contra S3 + pyHanko ≥0.30 — pero eso es decisión de ATLAS, no de SOFIA.

## Requiere DEBY

No. Síntoma reproducible con causa raíz identificada (lectura directa de la API de pyHanko instalado) y fix unitario aplicado. Sin crash/race/leak. Un solo intento convergió (15/15 tests signer pasan).

## Pendientes ATLAS

- Ejecutar V3 smoke real contra S3 + pyHanko ≥0.30 en staging (procedimiento: subir PDF vía `upload-only` con `key=dictamen-test.pdf`; firmar vía `sign-pdf` con `input_pdf=dictamen-test.pdf`; verificar que `signature_hash` empieza con `sha256:`, que `output_pdf==dictamen-test-signed.pdf`, que el bucket contiene el PDF firmado, y que `verify_signature` lo reconoce como firmado).
- Decidir si extender el mismo tratamiento a `/api/v1/verify-signature` para producción (también lee sólo de UPLOAD_DIR local, fuera de scope aquí).
- Si ATLAS prefiere, eliminar `backend/tests/conftest.py` cuando CI tenga `prisma._fields` funcional.

## Notas de reversión

- `git checkout backend/app/services/pdf/signer.py backend/tests/test_pdf_signer.py` revierte el fix completo.
- Sin migraciones, sin cambios de config, sin secretos nuevos. Reversión limpia.
