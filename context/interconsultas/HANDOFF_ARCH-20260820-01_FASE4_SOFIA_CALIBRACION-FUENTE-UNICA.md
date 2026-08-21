# SPEC-HANDOFF Fase 4 — ARCH-20260820-01 (SOFIA)

- **Origen:** INTEGRA
- **ID tarea:** `ARCH-20260820-01` Fase 4
- **SPEC activa:** `context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1 (§14 Fase 4, §7, §9.1, §12, §15 reglas 5-6)
- **ADR:** `context/decisions/ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1 (§2.6, §2.10)
- **Referencias funcionales:** `DEC-20260820-01`, `DEC-20260820-02`, `BR-20260820-01`, `FND-20260820-01/02/03/04`, `FIX-20260820-01` (H1/H7/H11)
- **Predecesores:** Fase 1 DONE (`22ba048`), Fase 2 DONE (`0cce88f`), Fase 3 DONE verificada localmente sin commit (QA-20260820-04 PASS_WITH_WARNINGS)
- **Estado:** `READY_FOR_SOFIA` (encadenamiento Fases 1-7 autorizado por Frank 2026-08-20 14:20 CST; commit/push por fase requieren autorización explícita separada)
- **QA obligatoria:** GEMINI post-implementación (cambio de contrato público `generate_prediagnosis` + capa clínica)

---

## 1. Resultado

`generate_prediagnosis` deja de leer las constantes de módulo (`REQUIRED_PARAMS`, `CONFIDENCE_THRESHOLDS`, `PREDIAGNOSIS_SUPPORTED_TYPES`, `PREDIAGNOSTIC_PROMPTS`) como fuente primaria y consume el bloque `clinicalCriteria` de la versión V3 **resuelta** por `CalibrationResolver`. El resolver se conecta en `main.py` **en proceso** (no vía HTTP). Cuando el resolver devuelve `None`, los hardcodeos permanecen como **fallback explícito y trazado** (`calibration_source="legacy_hardcoded"`). Se elimina el canal muerto `medical_calibration` (H11). Los hardcodeos **no se eliminan** (Fase 7).

## 2. Alcance de archivos/módulos

- `backend/app/services/ai/prediagnostic.py` — `generate_prediagnosis` gana parámetro `calibration_version`; lectura de `clinicalCriteria`; fallback `legacy_hardcoded`; eliminación de `_build_calibration_context` y del canal `medical_calibration`.
- `backend/app/main.py` — resolver vía `test_id` (MedicalTest) en los 3 callers de `generate_prediagnosis` (líneas ~1258 `v2_upload_and_analyze`, ~1382 `v2_prediagnosis_from_params`, ~1630 endpoint XML audiometría); deprecar `ai_calibration_json` (aceptar con warning); eliminar `medical_calibration`.
- `backend/tests/test_ai_pipeline.py` — extender con V3 resuelta, fallback, `enabled=false`.
- **Wiring mínimo de contrato (frontend, 1 campo):** `frontend/src/actions/event-test.actions.ts` debe enviar `medical_test_id` (id del `MedicalTest` del EventTest, ya disponible en el helper `getPublishedCalibrationForEventTest` de Fase 3) en el FormData hacia `upload-and-analyze`. No es alcance funcional nuevo; es la conexión del contrato backend.

## 3. Contratos que cambian

1. `generate_prediagnosis(study_type, extracted_data, calibration_version: Optional[AICalibrationVersionResolved] = None)`. Se retiran los parámetros `ai_calibration` y `medical_calibration` del flujo principal (ver §6 para compat transitoria).
2. Form de `POST /api/v2/studies/upload-and-analyze`: nuevo campo opcional `medical_test_id` (MedicalTest UUID). `ai_calibration_json` queda deprecado (se acepta con warning, no se elimina).
3. `AIPrediagnosisResult.calibration_source` admite nuevos valores: `published_v3`, `calibration_disabled`, `legacy_hardcoded` (reemplaza `general_fallback`/`medical_calibration`). `audit.legacy_hardcoded_reason` ∈ {`no_published_version`, `published_disabled`, `field_definitions_incomplete`} (SPEC §12.1).
4. `prompt_source` admite `clinical_criteria_v3` (V3 resuelta) además de `backend_fallback`/`ai_calibration` legacy.

## 4. Contratos protegidos (NO tocar)

- Constantes hardcodeadas y `PrediagnosticService.PREDIAGNOSTIC_PROMPTS` **se conservan** como fallback (no se eliminan hasta Fase 7).
- Capa clínica DR7/MedGemma (`_call_dr7_medical_chat`, `_resolve_dr7_config`): intacta. Gemini NO se usa en prediagnóstico.
- `CalibrationResolver`, `AICalibrationVersionResolved`, `calibration_resolver.py`: no se modifican (sólo se consumen vía `get_default_resolver().resolve(row, "published")`).
- Extracción (`main.py` PASO 1/2, `ExtractorService`) y renderers clínicos frontend: no se tocan.
- `PREDIAGNOSIS_SUPPORTED_TYPES` sigue gobernando el fallback `prediagnosisEnabled` cuando el resolver devuelve `None`.
- Endpoint HTTP `GET /api/v1/calibration/resolve` y consumidores Fase 3 (`getPublishedCalibrationForEventTest`): no se tocan.

## 5. Criterios AC (SPEC §14 Fase 4) — testeables

- **AC-4.1:** `generate_prediagnosis` recibe `calibration_version` resuelta y lee `requiredParams`, `confidenceThreshold`, `prediagnosisEnabled`, `prompt` desde `calibration_version.clinicalCriteria` (no desde constantes de módulo). Verifiable con test unitario que inyecta una `AICalibrationVersionResolved` sintética con `clinicalCriteria` propio y asevera `prompt_source=="clinical_criteria_v3"` y uso del `prompt`/`confidenceThreshold` inyectados.
- **AC-4.2:** si `calibration_version is None`, el comportamiento cae a hardcodeados actuales con `calibration_source=="legacy_hardcoded"` y `legacy_hardcoded_reason` poblado. Verifiable: llamar `generate_prediagnosis(study_type, data)` sin `calibration_version` y aseverar los campos de trazabilidad.
- **AC-4.3:** `main.py:1258` ya no pasa `medical_calibration` (canal muerto H11 eliminado); `_build_calibration_context` removido o no referenciado. Verifiable: `grep -n "medical_calibration" backend/app/main.py backend/app/services/ai/prediagnostic.py` → sin usos activos (solo comentarios/docstring permitidos si se documenta la remoción).
- **AC-4.4:** con `calibration_version.enabled=false` O `clinicalCriteria.prediagnosisEnabled=false` → `generate_prediagnosis` retorna `AI_NON_CONCLUSIVE` con `non_conclusive_reason="calibration_disabled"` **sin llamar a DR7** (`_call_dr7_medical_chat` no se invoca). Verifiable con mock del modelo.
- **AC-4.5 (derivado de §7.2):** un `MedicalTest` con `operationMode=document_extraction` produce `clinicalCriteria=None` → el prediagnóstico no se invoca o cae a fallback; no se sintetiza `clinicalCriteria` indebido.

## 6. Decisiones técnicas de INTEGRA (vinculantes)

1. **Resolver en proceso, no HTTP:** `main.py` debe importar y usar `get_default_resolver()` y llamar `resolve(test_row, "published")` tras `test_row = await prisma.medicaltest.find_unique(where={"id": medical_test_id})`. **No** se invoca `GET /api/v1/calibration/resolve`. Consecuencia: F-3 (auth del endpoint HTTP) **no se reabre** en Fase 4 — el endpoint sigue siendo una superficie separada, sin nuevos consumidores en el pipeline.
2. **`ai_calibration_json` deprecado, no eliminado:** el campo se acepta con warning en `upload-and-analyze`; si `medical_test_id` está presente, la resolución desde DB gana. Si `medical_test_id` falta → `calibration_version=None` → fallback `legacy_hardcoded` (comportamiento actual preservado).
3. **Transición de firma:** migrar los 3 callers de `generate_prediagnosis` en `main.py` a `calibration_version`. `ai_calibration`/`medical_calibration` se retiran del flujo principal. Si algún test o caller backend no migrable referencia `ai_calibration`, mantener un shim deprecado con warning, pero el flujo principal debe pasar por `calibration_version`.
4. **Umbral y mínimos desde `clinicalCriteria`:** `requiredParams` (default fallback `REQUIRED_PARAMS[study_type]`), `confidenceThreshold` (default fallback `CONFIDENCE_THRESHOLDS[study_type]`), `prediagnosisEnabled` (default fallback `study_type ∈ PREDIAGNOSIS_SUPPORTED_TYPES`) se resuelven desde `calibration_version.clinicalCriteria` si está presente; si no, constantes de módulo como fallback.
5. **`calibration_source` de prediagnóstico:** `published_v3` (resuelto + habilitado), `calibration_disabled` (enabled=false o prediagnosisEnabled=false), `legacy_hardcoded` (resolver None). Mantener `prompt_source` coherente (`clinical_criteria_v3` vs `backend_fallback`).

## 7. Casos borde

- **CB-01:** `MedicalTest` sin `aiCalibration` → resolver `None` → fallback hardcoded trazado.
- **CB-02 / AC-4.4:** `enabled=false` (V1/V2 adaptado/V3) → `calibration_disabled`, sin DR7.
- **CB-13:** `operationMode=manual_service` → resolver `None` → fallback (no IA).
- **CB-14:** `document_extraction` → `clinicalCriteria=None` → no prediagnóstico desde V3.
- **CB-11:** JSON corrupto → resolver `None` + log → fallback.
- **F-3 (no reabierto):** endpoint `/resolve` no gana consumidores en Fase 4; cierre documental de Fase 3 sigue vigente.

## 8. Validaciones detectadas

| Comando | Salida esperada |
|---|---|
| `cd backend && python3 -m pytest tests/test_ai_pipeline.py -v` | PASS (AC-4.1/4.2/4.4) |
| `cd backend && python3 -m pytest tests/test_calibration_resolver.py -v` | 43/43 (sin regresión Fase 1) |
| `cd frontend && npm run typecheck` | 0 errores |
| `grep -n "medical_calibration" backend/app/main.py backend/app/services/ai/prediagnostic.py` | sin usos activos (AC-4.3) |

## 9. Restricciones

1. No eliminar constantes hardcodeadas ni `PREDIAGNOSTIC_PROMPTS` (Fase 7).
2. No invocar el endpoint HTTP `/resolve` desde el pipeline backend.
3. No tocar producción/auth/secrets; no migraciones de esquema en Fase 4.
4. No mezclar con `arch-20260819-02-tarjetas-muestra`.
5. WIP=1; no paralelizar con otras fases de ARCH-20260820-01.
6. No tocar `CalibrationResolver`/`calibration_resolver.py`.

## 10. Dependencias

- Disponibles: `calibration_resolver.py` (`CalibrationResolver`, `get_default_resolver`, `AICalibrationVersionResolved`), `app.services.prisma_client.get_prisma_client`, `prisma.medicaltest.find_unique`.
- No nuevas env vars, no nuevas dependencias.

## 11. DoD

- AC-4.1 a AC-4.5 con evidencia (pytest + typecheck).
- Contratos protegidos intactos (grep/verificación de firma).
- `PROYECTO.md`/`context/CURRENT.md` con una sola representación de Fase 4 (estado delegado).
- Reporte `READY_FOR_VERIFYING` a INTEGRA; GEMINI QA Fase 4 tras gates.

## 12. Prohibido inferir

1. No decidir rol de publicación ni auth del endpoint (ADR §7.1, Frank) — no aplica a Fase 4 (resolver en proceso).
2. No eliminar hardcodeos antes de Fase 7.
3. No sintetizar `clinicalCriteria` para `document_extraction`.
4. No asumir `canonicalStudyType`/`operationMode` no confirmados (DEC-20260820-02).
5. No cambiar el enrutamiento DR7/MedGemma de la capa clínica.