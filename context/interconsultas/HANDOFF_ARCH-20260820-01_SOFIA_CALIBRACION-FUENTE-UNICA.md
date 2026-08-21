# HANDOFF_ARCH-20260820-01_SOFIA_CALIBRACION-FUENTE-UNICA

- **Origen:** INTEGRA
- **ID tarea:** `ARCH-20260820-01` (Calibración como fuente única)
- **SPEC activa:** `context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md` (v1.1)
- **ADR:** `context/decisions/ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md` (v1.1)
- **Referencias funcionales:** `DEC-20260820-01`, `DEC-20260820-02`, `FND-20260820-01/02/03/04`, `BR-20260820-01`, `FIX-20260820-01`
- **Estado del handoff:** `ACTIVE` (Fases 1-7 autorizadas secuencialmente por Frank 2026-08-20 14:20 CST)
- **Fecha de preparación:** 2026-08-20
- **Autorización vigente:** Frank, 2026-08-20 14:20 CST — autorización explícita para ejecutar Fases 1-7 una tras otra, con auditoría GEMINI y gates por fase.

---

## ✅ AUTORIZACIÓN VIGENTE (Fase 2 — encadenamiento Fases 1-7)

**Alcance autorizado:** Fases 1-7 secuenciales según SPEC §14. Frank autorizó explícitamente 2026-08-20 14:20 CST ejecutar todas las fases una tras otra **sin pedir confirmación entre fases**, con gates (typecheck/tests/lint) y auditoría GEMINI por fase. Cada fase debe completar sus gates + GEMINI QA antes de abrir la siguiente.

**Estado de fases:**
- **Fase 1:** DONE — commit `22ba048` en `main`; GEMINI `QA-20260820-02` APROBADO_CON_OBSERVACIONES (43/43 tests). 4 observaciones P3 (F-1/F-2/F-4 = cleanup no bloqueante; F-3 cerrada en Fase 3).
- **Fase 2:** DONE — commit `0cce88f` en `main`; GEMINI `QA-20260820-03` PASS_WITH_WARNINGS (41 tests, P2 cerrados tras rework).
- **Fase 3:** DONE (verificado localmente, sin commit/push) — GEMINI `QA-20260820-04` PASS_WITH_WARNINGS (AC-3.1–3.4 PASS, 62/62 vitest, 43/43 pytest, 0 bloqueadores; F-3 cierre documental válido).
- **Fase 4:** READY — delegación vía `context/interconsultas/HANDOFF_ARCH-20260820-01_FASE4_SOFIA_CALIBRACION-FUENTE-UNICA.md`.
- **Fases 5-7:** READY (se encadenan automáticamente tras gates + GEMINI de la fase previa).

**Análisis de dependencias bloqueantes (ADR §7) para Fase 2 — resueltas con propuestas INTEGRA (§11):**
Las decisiones pendientes del ADR §7 afectan Fase 2 (publicación), pero NO bloquean porque el handoff §11 ya las resolvió con propuestas INTEGRA reversibles:
- §7.1 (rol publicación) → propuesta INTEGRA: gate con `SUPERADMIN` por defecto, configurable. SOFIA implementa el gate con `SUPERADMIN`.
- §7.2 (retención versiones) → propuesta INTEGRA: conservar últimas 20 `superseded` (mismo límite que `saveAICalibrationV2`), configurable.
- §7.3 (corte V1/V2) → el adaptador y los fallbacks hardcodeados permanecen hasta Fase 7; no se eliminan.
- §7.4 (granularidad `enabled`) → propuesta INTEGRA: global + flags por capa.
- §7.7-§7.9 (catálogo FamilyTemplate, asignación `operationMode`, modelo registry) → Fase 2 implementa el contrato y la mecánica de herencia; `familyTemplateId=null` para todas las pruebas hasta decisión funcional (§11.6).

**DoR de implementación Fase 2:** CUMPLIDA (SPEC v1.1 activa §14 Fase 2, AC-2.1 a AC-2.6 verificables, dependencias disponibles `frontend/src/types/calibration.ts:116-156` + `frontend/src/actions/medical-profiles.ts:654-830` + `AICalibrationEditor.tsx`, comandos `npm run typecheck` + vitest detectados, sin decisiones bloqueantes).

**Observaciones P3 del QA-20260820-02 que aplican a Fase 2:**
- **F-4 (operation_mode frágil):** `_resolve_v3` no recibe `operation_mode` explícito desde `_resolve_with_explicit_mode` (`calibration_resolver.py:595-629 → 631-690`). Frank pidió "mejorar antes de fases posteriores". **INTEGRA incluye F-4 como cleanup dirigido en el alcance de Fase 2** (cambio menor <10 líneas en `calibration_resolver.py`: pasar `operation_mode` explícito como parámetro a `_resolve_v3` para eliminar la dependencia frágil de la heurística). Es robustez previa a Fase 3 (cuando Events consume el resolver). No rompe AC-1.x (tests existentes siguen pasando).
- **F-3 (auth heredada):** `/resolve` sin `Depends(...)` de auth. **Se cierra en Fase 3** (cuando Events consume el resolver), NO en Fase 2. Fase 2 no toca el endpoint backend.

INTEGRA invoca `task` con `subagent_type='sofia'` SOBRE FASE 2 de este handoff con autorización explícita vigente de Frank. El encadenamiento a Fases 3-7 es automático tras gates + GEMINI.

---

## 1. Resultado

Implementar el contrato `aiCalibration` V3 con estados de publicación, un `CalibrationResolver` como única fuente runtime, adaptador V1/V2→V3, clasificación operativa `operationMode` (`manual_service`/`document_extraction`/`clinical_interpretation`) en el catálogo `MedicalTest`, herencia por `familyTemplate`+`overrides` para laboratorio, congelación de snapshots históricos, paridad de UI entre Calibración y Events, y degradación progresiva de hardcodeos clínicos. **Sin tocar producción, auth ni secrets. Sin mezclar `arch-20260819-02-tarjetas-muestra`.**

> **Primera delegación (alcance acotado):** SOFIA implementa primero el **clasificador `operationMode` + resolver + adaptador V1/V2** (Fase 1 de la SPEC). **No se tocan aún los formularios clínicos** (`PapeletaWorkspace`, `ClinicalExtractionRenderer`, `StudyAIPrediagnosisPanel`, papeleta, dictamen, aptitud ni descargables) **ni la rama `arch-20260819-02-tarjetas-muestra`**. Esas fases se delegan después, secuencialmente, tras validar Fase 1.

## 2. Alcance de archivos/módulos (por fase)

### Fase 1 — Clasificador `operationMode` + Resolver + adaptador V1/V2  ⬅️ PRIMERA DELEGACIÓN
- **Nuevo:** `backend/app/services/ai/calibration_resolver.py` (incluye inferencia de `operationMode` SPEC §11.3)
- **Modificar:** `backend/app/api/v1/calibration.py` (exponer `GET /api/v1/calibration/resolve`)
- **Tests:** `backend/tests/test_calibration_resolver.py` (nuevo)
- **Contrato leído (no migrado físicamente):** `MedicalTest.options.operationMode` + `MedicalTest.options.aiCalibration`
- **AC propios:** SPEC §14 Fase 1 (AC-1.1 a AC-1.5), incluyendo AC-1.4 (inferencia de las 4 ramas de §11.3, **nunca Audiometría**) y AC-1.5 (`clinicalCriteria=null` para `document_extraction`).
- **Fuera de alcance de esta delegación:** formularios clínicos, `PapeletaWorkspace`, `ClinicalExtractionRenderer`, `StudyAIPrediagnosisPanel`, editor V3, gates de publicación, snapshots, Events frontend, `arch-20260819-02-tarjetas-muestra`.

### Fase 2 — Contrato V3 + estados + publicación + editor condicional por `operationMode`
- **Modificar:** `frontend/src/types/calibration.ts` (tipos V3 con `operationMode`, `familyTemplateId`, `overrides`)
- **Nuevo:** `frontend/src/actions/calibration-v3.actions.ts` (`saveAICalibrationV3`, `publishAICalibrationV3` con gates G0-G9)
- **Modificar:** `frontend/src/components/calibration/AICalibrationEditor.tsx` (editor V3 condicional por modo; sin `clinicalCriteria` para `document_extraction`; oculto para `manual_service`)
- **Tests vitest asociados**

### Fase 3 — Gate `enabled` + routing por canonicalStudyType (Events frontend)
- **Modificar:** `frontend/src/actions/event-test.actions.ts`
- **Modificar:** `frontend/src/lib/study-ai.ts` (heurística → fallback trazado)
- **Modificar:** `frontend/src/actions/ai-prediagnosis.actions.ts`
- **Modificar:** `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx:500` (eliminar default `Audiometria`)
- **Tests vitest asociados**

### Fase 4 — `clinicalCriteria` reemplaza hardcodeos en backend
- **Modificar:** `backend/app/services/ai/prediagnostic.py` (leer del resolver; eliminar canal `medical_calibration`)
- **Modificar:** `backend/app/main.py` (pasar versión resuelta a `generate_prediagnosis`; deprecar `ai_calibration_json` del form)
- **Tests:** `backend/tests/test_ai_pipeline.py` (extender)

### Fase 5 — Snapshot versionado (congelación histórica)
- **Migración Prisma aditiva:** campos nullable en `StudyExtractionSnapshot` y `AIPrediagnosisSnapshot` (`calibrationVersionId`, `calibrationVersionNumber`, `presentationSchemaSnapshot`, `extractionPromptHash`, `clinicalPromptHash`, `clinicalCriteriaHash`).
- **Modificar:** `backend/app/main.py` (persistir campos al generar snapshot)
- **Modificar:** `frontend/src/components/clinical/PapeletaWorkspace.tsx` (usar snapshot congelado al renderizar histórico)
- **Modificar:** `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` (aceptar schema congelado del snapshot)
- **Tests:** E2E histórico

### Fase 6 — Paridad de UI + editor de presentation.schema
- **Modificar:** `frontend/src/components/calibration/CalibrationTestResults.tsx` (toggle JSON + renderer clínico)
- **Modificar:** `frontend/src/components/calibration/PresentationSchemaPanel.tsx` (visor → editor persistente)
- **Modificar:** `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx` (integrar renderer)
- **Tests:** Playwright E2E-PARITY-01

### Fase 7 (final) — Eliminación de hardcodeos
- **Condición de entrada:** (a) todas las pruebas `clinical_interpretation` + `document_extraction` del catálogo tienen V3 `published`; Y (b) el clasificador `operationMode` clasifica el catálogo completo (sin `requires_review`).
- **Modificar/Eliminar:** `backend/app/services/ai/prediagnostic.py` (constantes y `PREDIAGNOSTIC_PROMPTS`)
- **Modificar/Eliminar:** `frontend/src/components/clinical/extraction-presentation-schemas.ts` (schemas hardcodeados)
- **Tests:** E2E full de todas las pruebas con IA + verificación de que pruebas `manual_service` no disparan IA

## 3. Contratos que cambian

- `MedicalTest.options.operationMode`: nuevo campo de catálogo (`manual_service` | `document_extraction` | `clinical_interpretation`) que determina capacidades de IA y existencia del editor (DEC-20260820-02).
- `MedicalTest.options.aiCalibration`: estructura V3 (nueva raíz con `schemaVersion`, `currentPublishedVersionId`, `familyTemplateId`, `draft`, `publishedVersions[]`, `legacyV1V2Snapshot`). V1/V2 legibles vía adaptador.
- `AICalibrationVersion` (inmutable post-publish): nueva estructura con `clinicalCriteria` (sólo `clinical_interpretation`) que reemplaza `REQUIRED_PARAMS`, `CONFIDENCE_THRESHOLDS`, `PREDIAGNOSIS_SUPPORTED_TYPES`, `PREDIAGNOSTIC_PROMPTS`.
- `FamilyTemplate` + `overrides`: nueva mecánica de herencia para laboratorio (familia → panel/estudio → analitos). El resolver fusiona `defaults`+`overrides`; el snapshot congela la versión efectiva (FND-20260820-04).
- `CalibrationResolver`: nuevo servicio backend, único lector autorizado de `aiCalibration`, consciente de `operationMode` y de `familyTemplate`.
- `StudyExtractionSnapshot` + `AIPrediagnosisSnapshot`: 6 campos nullable nuevos para congelación histórica.
- `extraction_snapshot.audit.calibration_source`: nuevos valores `calibration_disabled`, `legacy_hardcoded`, `legacy_heuristic` (reemplazan el ambiguo `general_fallback`).

## 4. Contratos protegidos

- **No se modifica** el contrato público de `PapeletaWorkspace.tsx:186-216` (`getPersistedPresentationSchema`) — solo se asegura que siempre llega el published.
- **No se modifica** el contrato `ClinicalExtractionRenderer` (props ya aceptan `presentationSchema?`).
- **No se modifican** los prompts clínicos hardcodeados existentes durante las fases 1-6 (se conservan como fallback).
- **No se rompe** `saveAICalibration` ni `saveAICalibrationV2` en fases tempranas (se marcan deprecadas en JSDoc).
- **No se toca** el flujo clínico de dictamen, aptitud ni descargables.
- **No se tocan los formularios clínicos** en la primera delegación (Fase 1): `PapeletaWorkspace`, `ClinicalExtractionRenderer`, `StudyAIPrediagnosisPanel` quedan intactos hasta su fase.
- **No se toca** auth, secrets, ni producción.
- **No se mezcla** con `arch-20260819-02-tarjetas-muestra`.
- **No se muestra editor de calibración IA** para `MedicalTest` con `operationMode=manual_service` (DEC-20260820-02).

## 5. Criterios AC (resumen; ver SPEC §19)

CA-G01 a CA-G21 (detallados en la SPEC). Cada fase tiene sus AC propios (SPEC §14). La primera delegación (Fase 1) cubre AC-1.1 a AC-1.5, incluida la inferencia de `operationMode` (CA-G19).

## 6. Casos borde

Ver SPEC §16 (CB-01 a CB-12).

## 7. Validaciones detectadas

- `pytest backend/tests/test_calibration_resolver.py -v` (Fase 1) — incluye inferencia de `operationMode` de las 4 ramas de SPEC §11.3 (nunca Audiometría)
- `pytest backend/tests/test_ai_pipeline.py -v` (Fase 4)
- `npm run typecheck` (0 errores)
- `npm test` (vitest verde)
- `npm run lint` (0 errores nuevos)
- Playwright E2E-PARITY-01 (Fase 6)
- Playwright E2E-HISTORICAL-01 (Fase 5)
- `GET /api/v1/calibration/resolve?test_id=X&state=published` (Fase 1) — retorna V3 resuelto con `operationMode` efectivo o `null`

## 8. Restricciones

1. **No implementar fuera de las fases aprobadas por Frank.**
2. **No eliminar hardcodeos antes de Fase 7** (riesgo de regresión clínica).
3. **No tocar producción sin autorización explícita** (migración de Fase 5 es aditiva; requiere permiso para staging).
4. **No mezclar con `arch-20260819-02-tarjetas-muestra`.**
5. **WIP=1 por fase** (dependencias internas entre archivos de la misma fase).
6. **No paralelizar fases** (F2 depende de F1; F3/F4 dependen de F2; F5 depende de F4; F6 depende de F3; F7 depende de todas).
7. **Solicitar revisión a GEMINI** (`subagent_type='gemini'`) como segunda mano de validación tras cada fase no trivial (toca contrato público, >200 líneas, infraestructura).
8. **Sin commit/push/PR sin OK explícito de Frank.**
9. **Primera delegación = sólo Fase 1 (clasificador + resolver + adaptador).** No tocar formularios clínicos ni la rama de tarjetas de muestra hasta su fase.
10. **No inferir `Audiometria`/`clinical_interpretation` por defecto** para pruebas sin `operationMode` confirmado; en duda, `manual_service`+`requires_review` (DEC-20260820-02, anti-patrón H3).

## 9. Dependencias

- **Disponibles ya:** `MedicalTest.options` JSON, `StudyExtractionSnapshot`, `AIPrediagnosisSnapshot`, `ClinicalExtractionRenderer`, `StudyAIPrediagnosisPanel`, `extraction-presentation-schemas.ts`, `prediagnostic.py`.
- **Nuevas a crear:** `calibration_resolver.py`, `calibration-v3.actions.ts`, migración aditiva Prisma (Fase 5).
- **Env vars:** no se requieren nuevas (no se toca auth ni secrets).

## 10. DoD

- Criterios CA-G01 a CA-G21 verificados con evidencia.
- Gates §20 aprobados.
- Self-review SOFIA + GEMINI por fase.
- `PROYECTO.md` con una sola representación de `ARCH-20260820-01`.
- Sin commits/push/PR sin OK explícito de Frank.

## 11. Prohibido inferir

1. **Rol de publicación** (decisión Frank, ADR §7.1). Mientras no se confirme, SOFIA debe implementar el gate con `SUPERADMIN` por defecto (propuesta INTEGRA) y dejarlo configurable.
2. **Política de retención de versiones** (decisión Frank, ADR §7.2). Mientras no se confirme, SOFIA debe conservar las últimas 20 `superseded` (mismo límite que `saveAICalibrationV2` actual) y dejarlo configurable.
3. **Corte de soporte V1/V2** (decisión Frank, ADR §7.3). Mientras no se confirme, el adaptador y los fallbacks hardcodeados permanecen.
4. **Granularidad de `enabled`** (decisión Frank, ADR §7.4). Propuesta INTEGRA: global + flags por capa.
5. **Mezcla con `arch-20260819-02-tarjetas-muestra`** — prohibido inferir que se puede mezclar.
6. **Catálogo de `FamilyTemplate`s** (decisión funcional/ATLAS, ADR §7.7, FND-20260820-04) — qué familias de laboratorio existen, qué analitos base, qué schemas tabulares. SOFIA implementa el contrato y la mecánica de herencia; **no inventa** el contenido del catálogo de plantillas. Mientras no se confirme, `familyTemplateId=null` para todas las pruebas.
7. **Asignación de `operationMode` al catálogo existente** (decisión funcional/ATLAS, ADR §7.8, DEC-20260820-02) — la clasificación definitiva de las ~130 entradas + ~174 estudios de lab. SOFIA implementa la **inferencia conservadora** del adaptador (SPEC §11.3); no decide la clasificación final. En duda, `manual_service`+`requires_review`.
8. **Default a `Audiometria`/`clinical_interpretation`** — prohibido inferir. Una prueba sin `operationMode` confirmado cae a `manual_service`+`requires_review`, nunca a interpretación clínica (DEC-20260820-02).

## 12. Próximo paso (INTEGRA) — Encadenamiento autónomo Fases 1-7

**Fase 1: DONE** (commit `22ba048`, GEMINI QA-20260820-02 APROBADO_CON_OBSERVACIONES, 43/43 tests).

**Fase 2: IN_PROGRESS (delegación activa a SOFIA en este handoff).**
1. Delegar Fase 2 (contrato V3 + estados `draft/tested/published/superseded/disabled` + `saveAICalibrationV3`/`publishAICalibrationV3` con gates G0-G9 + editor condicional por `operationMode` + cleanup dirigido F-4) a SOFIA vía `task` con `subagent_type='sofia'` (WIP=1).
2. Recibir IMPL-REPORT; verificar AC-2.1 a AC-2.6 + AC-1.x siguen pasando (F-4 no rompe Fase 1).
3. GEMINI audit Fase 2 (fase no trivial: toca contrato público V3 + gates de publicación + editor condicional).
4. Con GEMINI PASS/PASS_WITH_WARNINGS + gates verdes (typecheck 0, vitest verde, lint 0 nuevos), commit de fase y **continuar automáticamente a Fase 3** (Frank autorizó encadenamiento sin confirmación entre fases).

**Fase 3:** gate `enabled` + routing por `canonicalStudyType` (Events frontend). **Cierra observación F-3 (auth del endpoint `/resolve`) antes de conectar Events.**
**Fase 4:** `clinicalCriteria` reemplaza hardcodeos en backend; conectar sin romper defaults V1/V2. **READY y delegada vía `HANDOFF_ARCH-20260820-01_FASE4_SOFIA_CALIBRACION-FUENTE-UNICA.md`** (consumir el resolver en proyecto, no el endpoint HTTP `/resolve`; F-3 NO se reabre para Fase 4).
**Fase 5:** migración Prisma aditiva (snapshot versionado). **Gate de validación/backup antes de ejecutarse** — si la política considera la migración no reversible o requiere aprobación adicional, detener y reportar blocker específico.
**Fase 6:** paridad de UI + editor de `presentation.schema`.
**Fase 7 (final):** eliminación de hardcodeos (solo si catálogo clasificado + V3 publicada).

**Restricciones del encadenamiento (vigentes):**
- No eliminar hardcodeos antes de Fase 7; usar fallback trazado.
- Fase 3 debe cerrar F-3 (auth endpoint) antes de conectar Events.
- Fase 5 requiere gate de validación/backup; detener si migración no reversible o requiere aprobación.
- No desplegar producción sin autorización específica; el lote autoriza código/commits/pushes, no deploy productivo.
- Mantener formularios clínicos y rama `arch-20260819-02-tarjetas-muestra` fuera de alcance.
- Si una fase falla, corregir dentro de esa fase; no avanzar.
- No mezclar las tarjetas de muestra.
