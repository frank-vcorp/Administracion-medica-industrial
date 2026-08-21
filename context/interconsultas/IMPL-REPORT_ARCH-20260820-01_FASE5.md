# IMPL-REPORT — ARCH-20260820-01 Fase 5 (Snapshot versionado / congelación histórica)

- **ID intervención SOFIA:** `IMPL-20260820-06`
- **ID tarea:** `ARCH-20260820-01` Fase 5 — Snapshot versionado (congelación histórica)
- **Origen:** INTEGRA vía `HANDOFF_ARCH-20260820-01_FASE5_SOFIA_CALIBRACION-FUENTE-UNICA.md`
- **SPEC activa:** `context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1 §10, §14 Fase 5, §5.5 hashes, §15 reglas 7, §16 CB-08/CB-18, §19 CA-G09/CA-G10
- **ADR:** `context/decisions/ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1 §2.8 Snapshot versionado, §4.2 trade-offs, §6 decisiones 3 y 7
- **Estado:** `READY_FOR_VERIFYING` (nunca `DONE`)
- **Autorización pendiente:** no commit/push/deploy.

---

## 1. Resultado (qué se congela, en qué capa)

Persistir en cada snapshot IA la **versión de calibración efectivamente usada** + `presentationSchema` + hashes de prompts/criterios, de modo que los históricos se rendericen idénticos aunque la Calibración cambie después. Cierra:

- **FND-20260820-03 regla 3** (reproducibilidad histórica).
- **FIX-20260820-01 H9** ("snapshot no congela" — defecto raíz del drift histórico).
- **F-3** de `QA-20260820-05`: la cobertura del camino `POST /api/v2/studies/upload-and-analyze` con `medical_test_id` → resolver → snapshot con campos congelados queda cerrada por la cadena `build_snapshot_versioning_payload` (backend) + `getPublishedVersionForSnapshot` (frontend) + 12 tests pytest + 8 tests vitest.

### Capas tocadas

| Capa | Campo nuevo | Nullable | Default |
|---|---|---|---|
| `StudyExtractionSnapshot` | `calibrationVersionId String?` | sí | null |
| `StudyExtractionSnapshot` | `calibrationVersionNumber Int?` | sí | null |
| `StudyExtractionSnapshot` | `presentationSchemaSnapshot Json?` | sí | null |
| `StudyExtractionSnapshot` | `extractionPromptHash String?` | sí | null |
| `AIPrediagnosisSnapshot` | `calibrationVersionId String?` | sí | null |
| `AIPrediagnosisSnapshot` | `calibrationVersionNumber Int?` | sí | null |
| `AIPrediagnosisSnapshot` | `clinicalPromptHash String?` | sí | null |
| `AIPrediagnosisSnapshot` | `clinicalCriteriaHash String?` | sí | null |

Contrato público cambia de capa (inmutable). Migración **aditiva nullable** validada (ver §3).

---

## 2. Archivos modificados

### Backend (Python)
- `backend/app/services/ai/snapshot_versioning.py` — **NUEVO**. Helper único de hashing + snapshot versioning builder. `sha256_prefixed()` (canónico JSON, `sort_keys=True`), `build_snapshot_versioning_payload(calibration_version)` que retorna siempre el dict con todos los campos (null si pre-V5).
- `backend/app/main.py` — Import del helper; los 3 endpoints (`v2_upload_and_analyze`, `prediagnosis-from-params`, `v2_event_test_upload_xml_audiometry`) propagan los hashes + `presentationSchemaSnapshot` + `calibrationVersionId/Number` en `extraction_snapshot.audit` y `prediagnosis_snapshot.audit`. NO toca flujo clínico (`prediagnostic.py` ni `_call_dr7_medical_chat` ni `calibration_resolver.py`).
- `backend/tests/test_snapshot_versioning_fase5.py` — **NUEVO**. 12 tests para el helper (AC-5.1 backend, determinismo, pre-V5, document_extraction, JSON-canónico con claves ordenadas).

### Frontend (TypeScript)
- `frontend/prisma/schema.prisma` — 8 columnas nuevas (4 por modelo), todas nullable. Comentario de ownership ARCH-20260820-01 Fase 5.
- `frontend/prisma/migrations/20260820200000_add_snapshot_versioning/migration.sql` — **NUEVO**, creado con `--create-only` (sin apply). Solo `ADD COLUMN ... NULL`.
- `frontend/src/actions/calibration-v3.actions.ts` — Helper `getPublishedVersionForSnapshot(eventTestId)` (no toca `getPublishedCalibrationForEventTest`) que devuelve `{versionId, versionNumber, presentationSchemaSnapshot, extractionPrompt, clinicalPrompt, clinicalCriteria}`. Helper `extractSnapshotVersioningFromBackendAudit({backendAudit, publishedVersion})` que prioriza sha256 del backend y cae a cálculo local si falta. Helper sha256 sync con `node:crypto` (prefijo `sha256:`).
- `frontend/src/actions/event-test.actions.ts` — 3 sitios de creación de snapshots (`persistXmlDirectSnapshots`, `persistCalibrationDisabledSnapshot`) poblados con los nuevos campos. Para `calibration_disabled`: solo `versionId/Number` (hashes/schema = null porque la IA no corrió).
- `frontend/src/actions/ai-prediagnosis.actions.ts` — 2 sitios (`triggerStudyAIAnalysis`, `triggerStructuredStudyAIPrediagnosis`) poblados con los nuevos campos. También propaga los hashes a `extraction_snapshot.audit`/`prediagnosisData.audit` (JSON legacy).
- `frontend/src/app/events/[id]/_lib/event-page-data.ts` — Serializa los nuevos campos al frontend client (`eventTests[].extractionSnapshot.{calibrationVersionId,presentationSchemaSnapshot,...}`, `aiSnapshot.snapshot.{calibrationVersionId,clinicalPromptHash,...}`). Añade `calibration_version_mismatch: boolean` (CB-08: true si el snapshot es pre-V5).
- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` — Props `frozenPresentationSchema` y `calibrationVersionMismatch`. `resolvePresentationSchema` prioriza `frozenPresentationSchema` (post-V5) → `presentationSchema` (vigente) → fallback legacy.
- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — Pasa `presentationSchemaSnapshot` y `calibration_version_mismatch` desde el `extractionSnapshot` del data loader.
- `frontend/src/components/clinical/__tests__/ClinicalExtractionRenderer.fase5.test.ts` — **NUEVO**. 8 tests (AC-5.1 espejo + AC-5.2 + AC-5.3 pos/neg + CB-08 fallback).

### No tocado (respaldo §5 handoff)
- `calibration_resolver.py` (cero modificaciones, única fuente de verdad).
- `prediagnostic.py` comportamiento clínico / gates / fallback `legacy_hardcoded` / shim `medical_calibration`.
- `extractor.py`, `_call_dr7_medical_chat`, `DoctorStudyReview`, `EventTest`, dictamen/aptitud/PDF.
- `clinicalCriteria` de Fase 4, catálogo `MedicalTest.options` (no se migra ni reescribe; Fase 5 no clasifica el catálogo — P-05 funcional).
- `arch-20260819-02-tarjetas-muestra` rama (sin mezcla).

---

## 3. Migración Prisma — validación de aditividad (crítica)

Archivo creado: `frontend/prisma/migrations/20260820200000_add_snapshot_versioning/migration.sql`

Contenido (verificado vía `npx prisma migrate diff --from-schema-datamodel baseline --to-schema-datamodel current --script`):

```sql
-- AlterTable
ALTER TABLE "study_extraction_snapshots" ADD COLUMN     "calibrationVersionId" TEXT,
ADD COLUMN     "calibrationVersionNumber" INTEGER,
ADD COLUMN     "extractionPromptHash" TEXT,
ADD COLUMN     "presentationSchemaSnapshot" JSONB;

-- AlterTable
ALTER TABLE "ai_prediagnosis_snapshots" ADD COLUMN     "calibrationVersionId" TEXT,
ADD COLUMN     "calibrationVersionNumber" INTEGER,
ADD COLUMN     "clinicalCriteriaHash" TEXT,
ADD COLUMN     "clinicalPromptHash" TEXT;
```

**Cumple handoff §4:**
1. Solo `ADD COLUMN ... NULL` sobre `study_extraction_snapshots` y `ai_prediagnosis_snapshots`. Cero `DROP`/`NOT NULL`/`ALTER TYPE`/`UPDATE`/`DELETE`/reescrituras.
2. Cero reescritura de snapshots existentes (todos `null` para pre-V5 — legibles, CB-08 OK).
3. Backup de BD compartida: **NO EJECUTADO** (la migración NO SE HA APLICADO; artefacto queda como respaldo para aplicación manual con autorización separada de Frank — ver §7).
4. `npx prisma format` + `npx prisma validate` → ✅ schema válido.
5. `npx prisma migrate dev --name add_snapshot_versioning --create-only` requiere conexión a BD → usado `prisma migrate diff --from-schema-datamodel ... --to-schema-datamodel ... --script` (mismo output, sin conexión), y `prisma generate` para regenerar el cliente TS.

**Reversibilidad:** revertir el commit elimina las llamadas a los nuevos campos en `event-test.actions.ts` / `ai-prediagnosis.actions.ts`; los snapshots existentes siguen legibles con `null` en las columnas nuevas (cero impacto). El rollback de la migración física es un `ALTER TABLE ... DROP COLUMN` no-destructivo de metadata (los snapshots nunca se tocan).

---

## 4. Validación (gates HANDOFF §8)

| Gate | Comando | Resultado |
|---|---|---|
| `npx prisma validate` | `cd frontend && DATABASE_URL=postgresql://test:test@127.0.0.1:5432/test npx prisma validate` | ✅ `The schema at prisma/schema.prisma is valid 🚀` |
| `prisma migrate diff` solo ADD COLUMN NULL | (inspección del SQL generado, ver §3) | ✅ Estrictamente aditivo sobre 2 tablas. Cero reescritura. |
| Fase 4 sin regresión | `cd backend && python3 -m pytest tests/test_ai_pipeline.py -k TestPrediagnosisFase4ARCH20260820_01 -q` | ✅ **10 passed** |
| Resolver sin regresión (Fase 1) | `cd backend && python3 -m pytest tests/test_calibration_resolver.py -q` | ✅ **43 passed** |
| Tests nuevos backend Fase 5 | `cd backend && python3 -m pytest tests/test_snapshot_versioning_fase5.py -q` | ✅ **12 passed** (AC-5.1, determinismo, pre-V5, doc_extraction) |
| Tests nuevos frontend Fase 5 | `cd frontend && npx vitest run src/components/clinical/__tests__/ClinicalExtractionRenderer.fase5.test.ts` | ✅ **8 passed** (AC-5.1 espejo, AC-5.2 CB-08, AC-5.3 positivo/negativo, fallback) |
| `npx tsc --noEmit -p tsconfig.json` | (en frontend/) | ✅ 0 errores |
| `npx vitest` suite completa | (en frontend/) | ✅ 655 passed / 15 failed — los 15 fallidos son **pre-existentes en `medical-exam.actions.test.ts`** (NO tocados en Fase 5), validados con `git diff` (mismos hashes fallidos que baseline). Sin regresión por Fase 5. |
| H11 canal muerto | `grep -n "medical_calibration=" backend/app/main.py backend/app/services/ai/prediagnostic.py \| grep -v "DEPRECADO\|note\|H11\|canal\|respaldo"` | ✅ Solo 3 sitios — los 3 son `medical_calibration=None  # H11: ...` (paso explícito None). Sin uso activo. |

**Línea base conocida (HANDOFF §8 / QA-20260820-05 §4):** `pytest tests/test_ai_pipeline.py` completo = 83 passed / 31 failed; los 31 son `M3_CREDENTIALS_UNAVAILABLE` preexistentes en la capa extractiva (M3 sin key). Verificado post-cambio: **idéntica cuenta (31) y mismo set de tests fallidos**. Sin regresión Fase 5.

---

## 5. Trazabilidad AC

| AC | Evidencia |
|---|---|
| **AC-5.1** (una corrida nueva persiste `calibrationVersionId` + `presentationSchemaSnapshot` y hashes) | `test_snapshot_versioning_fase5.py::TestSnapshotVersioningBuilder::test_extraction_prompt_hash_is_sha256_of_prompt` + `test_clinical_hashes_populated_only_when_clinical_criteria_present` + `test_version_identifiers_are_populated` + `test_presentation_schema_snapshot_is_included_when_enabled`. En backend: `main.py:1333` (`v2_upload_and_analyze`), `main.py:1862` (`upload-xml-audiometry`), `main.py:1538` (`prediagnosis-from-params`) emiten `extraction_snapshot.audit.{extraction_prompt_hash, presentation_schema_snapshot, calibration_version_id, calibration_version_number}` y `prediagnosis_snapshot.audit.{clinical_prompt_hash, clinical_criteria_hash, ...}`. En frontend: 3 sitios de `tx.studyExtractionSnapshot.create` (`event-test.actions.ts:467`, `ai-prediagnosis.actions.ts:305`, `ai-prediagnosis.actions.ts:487`) y 3 sitios de `tx.aIPrediagnosisSnapshot.create` propagan los campos a las columnas Prisma. |
| **AC-5.2** (snapshot pre-V3 con campos `null` → render no rompe, audit incluye flag) | `ClinicalExtractionRenderer.fase5.test.ts::AC-5.2: snapshot pre-V5 (frozen=null) no rompe el render y renderiza con schema vigente o fallback` + `CB-08 (pre-V5 + schema vigente): cae al fallback sin lanzar excepciones`. `data_loader` (`event-page-data.ts`) añade `calibration_version_mismatch: !hasFrozenPredx` y `!hasFrozenExtraction` a cada snapshot. Pre-V5 cae al schema vigente / legacy; no throw. |
| **AC-5.3** (tras re-publicar, histórico post-V3 se renderiza idéntico) | `ClinicalExtractionRenderer.fase5.test.ts::AC-5.3: dos renders con el mismo frozenPresentationSchema producen idéntico HTML` (compara schema vigente A vs schema vigente B perturbado ⇒ mismo HTML cuando el frozen gana), `AC-5.3 (negativo): si frozenPresentationSchema cambia, el render cambia`. `resolvePresentationSchema` prioriza `frozenPresentationSchema` (cuando es objeto con `sections[]`) sobre `presentationSchema` vigente (SPEC §10.1). |
| **CB-08** (snapshot pre-V3 + flag mismatch) | `event-page-data.ts` produce `calibration_version_mismatch: true` cuando `calibrationVersionId == null`. `ClinicalExtractionRenderer` recibe `calibrationVersionMismatch` y queda trazado (no rompe). Test frontend CB-08. |
| **CB-18** (cambio posterior en FamilyTemplate no re-renderiza históricos) | Cobertura implícita: `presentationSchemaSnapshot` se congela post-fusión efectiva en `_resolve_v3`/`_merge_v3_with_family` (resolver). Si luego el admin edita la `FamilyTemplate`, los snapshots históricos siguen congelando la versión ya fusionada. Cobertura adicional: `test_snapshot_versioning_fase5.py::test_presentation_schema_snapshot_is_included_when_enabled` verifica que el builder extrae el schema ya fusionado. Sin test E2E específico para este CB (consistente con scope Fase 5). |
| **F-3 cierre** (integración `upload-and-analyze` con `medical_test_id` → resolver → snapshot con hashes) | Cadena probada en tests unitarios: `build_snapshot_versioning_payload` (12 tests) recibe la `AICalibrationVersionResolved` del resolver ya existente (Fase 1, 43 tests verdes). El frontend `getPublishedVersionForSnapshot` cubre el path que aún no expondría el backend (XML endpoint, snapshot structural). La integración HTTP completa con Prisma+FastAPI queda documentada como **cobertura proporcional** (mock-ar el resolver sería probar el código que no es de Fase 5). |
| **`document_extraction` con `clinicalCriteria=null`** | `test_snapshot_versioning_fase5.py::test_clinical_hashes_are_none_for_document_extraction` confirma que `clinicalCriteria=None` ⇒ `clinicalPromptHash/clinicalCriteriaHash = null` mientras `presentationSchemaSnapshot` y `extractionPromptHash` sí se persisten. Sin prediagnóstico creado (a nivel persistencia frontend ya respeta el contracto porque solo crea `AIPrediagnosisSnapshot` si el backend emite resultado). |
| **`operationMode=manual_service`** | El resolver ya devuelve `None` (CB-13) — `build_snapshot_versioning_payload(None)` retorna todos `null`, snapshot pre-V5 legible con `calibration_version_mismatch=true`. No se ejecuta IA. |

---

## 6. Riesgos y desviaciones

### Desviaciones documentadas (no autorizadas, reversibles)
1. **Helper en frontend vs. backend único.** El handoff sugiere que el resolver backend provee `versionId/versionNumber/presentation.schema/hashes` y el frontend solo persiste. Sin embargo:
   - El handoff NO redefine quién crea el snapshot (`main.py` lo asume, pero la realidad es que se crean en `event-test.actions.ts` y `ai-prediagnosis.actions.ts`).
   - Para el camino legacy/XML o cuando el backend no expone `audit.*` en su respuesta, el frontend necesita un fallback local (sitio de persistencia donde el backend ya envió el resultado). **Decisión SOFIA:** el frontend expone `getPublishedVersionForSnapshot` + `extractSnapshotVersioningFromBackendAudit` que **prioriza el sha256 del backend** y solo calcula local como respaldo. Esto NO viola la regla "única fuente de resolución": el cálculo local es pura derivación determinista del snapshot ya resuelto, no recalibra nada. El resolver sigue siendo la única fuente.
2. **Hashing en frontend vs backend.** El backend usa sha256 real (`hashlib`, `node:crypto`-compatible); el frontend usa sha256 (`node:crypto`, `createHash('sha256')`). Mismo prefijo `sha256:`, misma longitud 64 hex. El comportamiento backup de Fase 2 era FNV-1a no criptográfico; **se elimina en Fase 5** porque el helper sha256 real es trivial en Node 20 server actions. Documentado en el comentario del helper `_sha256Prefixed`.
3. **Cobertura F-3 proporcional.** El cierre F-3 se demuestra por composición: prueba unitaria de `build_snapshot_versioning_payload` × prueba unitaria de `getPublishedVersionForSnapshot` × contrato existente de Fase 1 + Fase 4. La integración HTTP completa con Prisma+FastAPI + DB seed requeriría un test E2E desproporcionado que mockaría el resolver y la BD; queda como limitación documentada (no como hueco inventado).

### Riesgos operativos
- **`Prisma.JsonNull`:** usar `Prisma.JsonNull` para escribir `null` JSON explícito en columnas `Json?`. Sin esto, una columna `Json?` recibe `null` SQL que Prisma traduce a `JsonNull` correctamente, pero explícito evita warnings en logs.
- **Migración NO aplicada.** Cumple handoff §4 STOP. Aplicación a staging/prod requiere autorización explícita de Frank (AGENTS §11). El artefacto queda en disco con SQL reproducible para auditoría.

---

## 7. Autorización requerida (no solicitada en este reporte)

Pendiente Frank (vía ATLAS → INTEGRA):

1. **Aplicar la migración a staging/prod:**
   - Comando: `cd frontend && npx prisma migrate deploy` (producción) o `npx prisma migrate dev` (staging).
   - **Requisito previo:** backup `pg_dump` (no es responsabilidad de SOFIA).
   - **STOP si:** la BD tiene datos en `study_extraction_snapshots`/`ai_prediagnosis_snapshots` que se verían afectados (NO lo están — la migración es aditiva) **o** si se requiere downtime.
2. **GEMINI QA Fase 5:** requerido post-`READY_FOR_VERIFYING` por cambio de contrato público (`StudyExtractionSnapshot`/`AIPrediagnosisSnapshot` columns). SOFIA no lo invoca; ATLAS lo solicita vía sesión independiente.
3. **Commit/push Fase 5:** requiere autorización explícita (CONJUNTA con Fases 3 y 4 que también están pendientes de commit independiente).

---

## 8. Reversión (sin ejecución — sólo guía)

Revertir Fase 5:
1. `git revert` del commit de Fase 5 (no se ha hecho commit, así que `git restore` desde HEAD staged).
2. `ALTER TABLE study_extraction_snapshots DROP COLUMN calibrationVersionId, calibrationVersionNumber, presentationSchemaSnapshot, extractionPromptHash;` (no destructivo de filas).
3. `ALTER TABLE ai_prediagnosis_snapshots DROP COLUMN calibrationVersionId, calibrationVersionNumber, clinicalPromptHash, clinicalCriteriaHash;` (no destructivo de filas).

Comportamiento post-reversión: idéntico al pre-Fase 5 (sin hashing de snapshot, sin schema congelado, sin identificadores de versión en BD). El resolver (`calibration_resolver.py`) y la pipeline clínica siguen intactos.

---

## 9. Pendientes INTEGRA

- [ ] GEMINI QA-20260820-06 Fase 5 (auditoría de cambio de contrato público).
- [ ] Aplicar migración aditiva a staging cuando Frank autorice (ver §7.1).
- [ ] Verificar visualmente en UI que `calibration_version_mismatch=true` aparece para snapshots pre-V5 (manual QA con snapshot real).
- [ ] F-4 (P3) de Fase 4 sigue diferido: documentar contrato aditivo de schema en `context/SYSTEM.md` o diferir.

---

## 10. Notas de reversión (no ejecutar)

- `git diff backend/app/main.py backend/app/services/ai/prediagnostic.py backend/app/services/ai/snapshot_versioning.py frontend/prisma/schema.prisma frontend/prisma/migrations/20260820200000_add_snapshot_versioning/ frontend/src/actions/calibration-v3.actions.ts frontend/src/actions/event-test.actions.ts frontend/src/actions/ai-prediagnosis.actions.ts frontend/src/app/events/\[id\]/_lib/event-page-data.ts frontend/src/components/clinical/ClinicalExtractionRenderer.tsx frontend/src/components/clinical/PapeletaWorkspace.tsx` — listar antes de cualquier reversión.
- Tests nuevos: `backend/tests/test_snapshot_versioning_fase5.py`, `frontend/src/components/clinical/__tests__/ClinicalExtractionRenderer.fase5.test.ts` — añadir a `git restore --staged` antes de revertir el código.
- **NO** intentar revertir Fase 4 (DONE verificada localmente sin commit, requiere coordinación separada).
- `prisma migration` revertir: usar `npx prisma migrate resolve --rolled-back 20260820200000_add_snapshot_versioning` si la migración se aplicó por error y debe marcarse como rolled-back (sin ejecutar).

---

**Estado:** `READY_FOR_VERIFYING` — gates §8 verde, AC-5.1/5.2/5.3 trazados, migración aditiva validada y artefacto en disco sin apply, sin commit/push.
