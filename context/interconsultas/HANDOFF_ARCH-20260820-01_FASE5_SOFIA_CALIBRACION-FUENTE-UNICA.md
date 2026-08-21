# SPEC-HANDOFF — ARCH-20260820-01 Fase 5 (Snapshot versionado / congelación histórica)

- **Origen:** INTEGRA
- **ID tarea:** `ARCH-20260820-01` Fase 5 — Snapshot versionado (congelación histórica)
- **ID intervención SOFIA:** a asignar por SOFIA (`IMPL-20260820-06`)
- **SPEC activa:** `context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1 (§10 Snapshot/versionado histórico, §14 Fase 5, §5.5 hashes, §15 reglas 7, §16 CB-08/CB-18, CA-G09/CA-G10)
- **ADR:** `context/decisions/ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1 (§2.8 Snapshot versionado, §4.2 trade-offs, §6 decisiones 3 y 7)
- **Referencias funcionales:** `DEC-20260820-01`, `FND-20260820-03` (versión histórica mutable P1), `BR-20260820-01` (paridad), `FIX-20260820-01` H9
- **Predecesores:** Fase 1 DONE (`22ba048`), Fase 2 DONE (`0cce88f`), Fase 3 DONE (verificado local, QA-20260820-04), Fase 4 DONE (verificado local, QA-20260820-05 + fix F-1 `IMPL-20260820-05`). HEAD = `0cce88f`; Fases 3 y 4 en árbol de trabajo sin commit.
- **Estado al salir de SOFIA:** `READY_FOR_VERIFYING` (nunca `DONE`). Sin commit/push/deploy.

---

## 1. Resultado

Persistir en cada snapshot de IA la versión de calibración efectivamente usada, de modo que los históricos se rendericen de forma **idéntica** aunque la Calibración cambie después (re-publicación o edición de familia). Esto satisface FND-20260820-03 (regla 3) y cierra el defecto H9 ("snapshot no congela").

Dos efectos verificables:
1. Toda corrida **nueva** post-Fase 5 congela la identidad de la versión publicada + el schema de presentación + hashes de prompts/criterios.
2. Un snapshot **pre-V3** (sin datos) se renderiza con el resolver actual + flag `calibration_version_mismatch=true` en `audit`, sin romperse.

## 2. Alcance de archivos/módulos

| Archivo | Cambio |
|---|---|
| `frontend/prisma/schema.prisma` | 2 modelos: `StudyExtractionSnapshot` (línea 708) y `AIPrediagnosisSnapshot` (línea 737). Añadir columnas **nullable aditivas** (ver §4). |
| Migración Prisma | Nueva migración aditiva `add_snapshot_versioning` generada con `--create-only`; **solo** `ADD COLUMN ... NULL`. |
| `backend/app/main.py` | Al persistir `StudyExtractionSnapshot` y `AIPrediagnosisSnapshot`, escribir los nuevos campos desde la `calibration_version` resuelta (ya disponible desde Fase 4 en los callers de `generate_prediagnosis` y en la resolución de `upload-and-analyze` / `upload-xml-audiometry`). |
| `backend/app/services/ai/prediagnostic.py` | (mínimo) exponer/retornar los hashes (`clinical_prompt_hash`, `clinical_criteria_hash`) en `AIPrediagnosisResult` o en el debug para que `main.py` los persista. **No** cambiar el contrato de comportamiento de Fase 4. |
| `backend/app/services/ai/calibration_resolver.py` | **NO tocar.** Solo proveer los datos ya existentes del objeto resuelto (`versionId`, `versionNumber`, `presentation.schema`, hashes si los expone). Si el objeto resuelto hoy no expone hashes de prompt, computarlos en la capa de persistencia sin modificar el resolver. |
| `frontend/src/app/events/[id]/_lib/event-page-data.ts` | Al cargar históricos, resolver `presentation_schema_snapshot` congelado (si existe) en vez de consultar la calibración vigente. |
| `frontend/src/components/clinical/PapeletaWorkspace.tsx` y `ClinicalExtractionRenderer.tsx` | Usar el snapshot congelado al renderizar históricos post-V3; para pre-V3, render actual + `calibration_version_mismatch=true`. |
| `backend/tests/` | Tests nuevos para AC-5.1/5.2/5.3 (ver §6). Integración de `upload-and-analyze` con `medical_test_id` → resolver → snapshot (cierra F-3 de QA-20260820-05). |

**No tocar:** `calibration_resolver.py`, capa de extracción (`ExtractorService`, `PASO 1/2`), capa clínica DR7 (`_call_dr7_medical_chat`), `DoctorStudyReview`, `EventTest`, dictamen/aptitud/PDF, `clinicalCriteria` de Fase 4, catálogo `MedicalTest.options`.

## 3. Contratos que cambian

1. **`StudyExtractionSnapshot`** — columnas nuevas (todas `nullable`, sin `@default`):
   - `calibrationVersionId String?` (versión `published` usada; `null` = pre-V3)
   - `calibrationVersionNumber Int?`
   - `presentationSchemaSnapshot Json?` (copia inmutable del `StudyPresentationSchema` efectivo, **ya fusionado** con familia si aplica)
   - `extractionPromptHash String?` (`sha256:` del prompt de extracción usado)

2. **`AIPrediagnosisSnapshot`** — columnas nuevas (todas `nullable`):
   - `calibrationVersionId String?`
   - `calibrationVersionNumber Int?`
   - `clinicalPromptHash String?` (`sha256:` del prompt clínico usado)
   - `clinicalCriteriaHash String?` (`sha256:` del JSON canónico de `clinicalCriteria`)

> **Resolución de contrato por INTEGRA (§10.1 ↔ §14 simetría):** los identificadores de versión viven en **ambos** modelos (para poder regenerar un prediagnóstico desde el snapshot con la versión congelada, SPEC §10.2); `presentationSchemaSnapshot` + `extractionPromptHash` viven en la capa extractiva (`StudyExtractionSnapshot`), y `clinicalPromptHash` + `clinicalCriteriaHash` en la capa interpretativa (`AIPrediagnosisSnapshot`). Si SOFIA detecta ambigüedad adicional, la resuelve con este criterio de capa y lo reporta (no bloquea).

## 4. Migración Prisma — ADITIVA (crítica de seguridad operativa)

Reglas **no negociables** en la migración:

1. **Solo `ADD COLUMN ... NULL`.** Está **prohibido** cualquier `DROP`, `NOT NULL`, `ALTER TYPE`, `SET DEFAULT` no-null, reescritura de tabla (`ALTER ... TYPE`/`USING`), o `UPDATE`/`DELETE` de datos en la migración.
2. **Cero reescritura de snapshots existentes.** Los snapshots pre-V3 conservan `null` en los campos nuevos (SPEC §10.2: legibles con `calibration_version_mismatch=true`). No se re-congela retroactivamente.
3. **Validación de aditividad antes de cualquier apply:**
   - `npx prisma format` + `npx prisma validate` (schema válido).
   - `npx prisma migrate dev --name add_snapshot_versioning --create-only` → inspeccionar el SQL generado y confirmar que **solo** contiene `ADD COLUMN` con tipos nullable sobre `study_extraction_snapshots` y `ai_prediagnosis_snapshots`.
   - `npx prisma migrate diff --from-schema-datasource ... --to-schema ... ` como doble verificación de que el diff es estrictamente aditivo.
4. **Backup antes de aplicar a cualquier BD compartida:** registro de backup (Railway snapshot / `pg_dump`) previo, y verificación de restauración. La migración local en entorno de desarrollo no exige backup de producción, pero sí confirmación de que el diff es aditivo.

**Detenerse (STOP) y devolver handoff/BLOCKED ante:**
- Aplicar la migración a **staging o producción** → requiere **autorización explícita separada de Frank** (AGENTS §11). SOFIA nunca ejecuta `prisma migrate deploy` sobre entornos compartidos. SPEC §14 Fase 5 exige "migración aplicada en staging" únicamente como validación posterior autorizada, no como parte de la implementación.
- Cualquier necesidad de alterar datos existentes o hacer la migración no-aditiva.
- Cualquier hallazgo de irreversibilidad (p. ej. si Prisma propone una operación de reescritura por un type mismatch).
- Duda sobre `--create-only` vs `--apply`: preferir siempre `--create-only` + revisión del SQL; nunca aplicar ciego.

## 5. Contratos protegidos (no modificar)

- `backend/app/services/ai/calibration_resolver.py` — única fuente de resolución (cero toques).
- Comportamiento de `generate_prediagnosis` (Fase 4): `clinicalCriteria`, gate `enabled`/`prediagnosisEnabled`, fallback `legacy_hardcoded`, shim `medical_calibration` deprecado (handoff Fase 4 §6.3).
- Inmutabilidad de snapshots: una corrida nueva crea una versión nueva; jamás sobrescribe payload clínico previo (`schema.prisma:700-704`).
- `DoctorStudyReview`, dictamen, aptitud, descargables, auth, secretos.
- `MedicalTest.options.aiCalibration` y `operationMode` (no se migran ni reescriben; Fase 5 no clasifica el catálogo).

## 6. Criterios AC (verificables) — SPEC §14 Fase 5

| AC | Criterio | Evidencia esperada |
|---|---|---|
| **AC-5.1** | Una corrida nueva persiste `calibrationVersionId` + `calibrationVersionNumber` + `presentationSchemaSnapshot` (y hashes) en el snapshot correspondiente. | Test backend: dado un `MedicalTest` con V3 `published`, al correr `generate_prediagnosis` el snapshot creado tiene `calibration_version_id` no nulo y `presentation_schema_snapshot` igual al schema de la versión resuelta. |
| **AC-5.2** | Un snapshot pre-V3 (campos `null`) se renderiza con el resolver actual + `calibration_version_mismatch=true` en `audit`; no rompe. | Test: snapshot sin `calibration_version_id` → el render no lanza; el audit incluye el flag. |
| **AC-5.3** | Tras re-publicar una nueva versión de una prueba (o editar la plantilla de familia), un histórico post-V3 se renderiza idéntico (no cambia). | Test E2E/contract: generar snapshot con V3 v1 → re-publicar v2 → render histórico → comparar árbol HTML/estructura idéntico al render de v1 (E2E-HISTORICAL-01, SPEC §13.2/§13.3). |

**Cobertura complementaria (cerrar F-3 de QA-20260820-05, P3):** test de integración del camino `POST /api/v2/studies/upload-and-analyze` con `medical_test_id` (Prisma mock o fixture in-memory) → resolver → `generate_prediagnosis` → snapshot con campos congelados poblados. Si el alcance del test de integración resulta desproporcionado, reportarlo como limitación documentada (no inventar cobertura).

## 7. Casos borde

- **CB-08:** snapshot pre-V3 (campos `null`) → render con resolver actual + `calibration_version_mismatch=true`. No se rompe.
- **CB-18:** cambio posterior en una `FamilyTemplate` (añadir analito) → los snapshots históricos no se re-renderizan (congelaron la versión efectiva fusionada, no referencias a plantilla).
- **Re-publicación:** `superseded`/nueva `published` no alteran snapshots existentes; solo afectan corridas nuevas.
- **`document_extraction` con `clinicalCriteria=null`:** el snapshot de extracción congela `presentationSchemaSnapshot` + `extractionPromptHash`; el de prediagnóstico no se crea (no hay prediagnóstico); `clinicalCriteriaHash`/`clinicalPromptHash` solo aplican a `clinical_interpretation`.
- **`operationMode=manual_service`:** no hay corrda de IA, por tanto no hay snapshot que congelar (resolver devuelve `None`).
- **Generación de hash:** si el objeto resuelto no trae hash precalculado, `sha256:` del JSON canónico del campo (SPEC §5.5); nunca almacenar el texto del prompt duplicado en el snapshot.

## 8. Validaciones detectadas y salida esperada

| Comando | Esperado |
|---|---|
| `npx prisma validate` | schema válido (0 errores) |
| `npx prisma migrate diff ...` (diff aditivo) | solo `ADD COLUMN ... NULL` |
| `cd backend && python3 -m pytest tests/test_ai_pipeline.py -k "TestPrediagnosisFase4ARCH20260820_01"` | **10 passed** (sin regresión Fase 4) |
| `cd backend && python3 -m pytest tests/test_calibration_resolver.py` | **43 passed** (sin regresión Fase 1) |
| `cd backend && python3 -m pytest <tests nuevos Fase 5>` | AC-5.1/5.2/5.3 PASS |
| `cd frontend && npx tsc --noEmit -p tsconfig.json` | 0 errores |
| `cd frontend && npx vitest` (o `npm test`) | verde (tests nuevos incluidos) |

**Línea base conocida (no confundir con regresión):** `pytest tests/test_ai_pipeline.py` completo = 83 passed / 31 failed; los 31 son `M3_CREDENTIALS_UNAVAILABLE` preexistentes en la capa extractiva (M3 sin key), idénticos al baseline de QA-20260820-05 §4.

## 9. Restricciones

- Migración **aditiva nullable** únicamente (zero `DROP`/`NOT NULL`/reescritura).
- Sin commit/push/deploy. Cambios solo en árbol de trabajo (el árbol ya contiene Fases 3 y 4 sin commit; **no** incluir archivos externos a Fase 5 en ningún commit futuro; no hacer `git add -A`).
- **Backup** previo a aplicar migración en cualquier entorno compartido.
- **Detenerse** ante staging/prod, irrevocabilidad, o cualquier decisión no cubierta.
- GEMINI es **obligatorio** para Fase 5 (cambio de schema/migración); SOFIA no lo invoca, INTEGRA lo solicita vía ATLAS tras `READY_FOR_VERIFYING`.

## 10. Dependencias

- Fase 4 DONE (verificado local): `generate_prediagnosis` ya recibe `calibration_version` y expone `calibration_source`; los callers de `main.py` ya resuelven V3 en proceso.
- Resolver de Fase 1 disponible (`get_default_resolver().resolve(row, "published")`).
- Sin dependencia de P-01/P-02/P-04/P-05/P-06 (catálogo de familias, retención, rol de publicación) — son decisiones funcionales diferidas, no bloquean la mecánica de congelación.

## 11. DoD (lectura de SOFIA)

- [x] AC-5.1/5.2/5.3 con evidencia reproducible.
- [x] Migración aditiva validada (validate + diff solo `ADD ... NULL`).
- [x] Sin regresión: 10/10 Fase 4, 43/43 resolver, typecheck 0, vitest verde.
- [x] No commit/push/deploy; no tocar archivos fuera del alcance §2.
- [x] Reporte con rutas/líneas/comandos; estado `READY_FOR_VERIFYING`.
- [x] Backup/dry-run documentado; any apply a entorno compartido = STOP + autorización.

## 12. Prohibido inferir

- Aplicar migración a staging/prod, o ejecutar `prisma migrate deploy` en perfil no-local.
- Reescribir/re-congelar snapshots pre-V3 existentes.
- Convertir columnas en `NOT NULL` o borrar datos.
- Cambiar el comportamiento clínico de Fase 4 (gates, fallbacks, shims).
- Clasificar `operationMode`/`familyTemplateId` del catálogo (pertenece a P-05, no a Fase 5).
- Inventar contenido de prompts, hashes o schemas; todo se deriva de la versión resuelta.