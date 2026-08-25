# IMPL-REPORT — AMI-ESPIROMETRIA-v1 (Frank confirmado)

```
ID intervención: AMI-ESPIROMETRIA-v1
ID tarea: Frank — complementar el prompt clínico de Espirometría
         (MedGemma/DR7) con el flujo clínico AMI extraído de la presentación
         `context/datos AMI/DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` como
         fuente prioritaria al inicio.
Estado: READY_FOR_VERIFYING
SPEC activa: context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
             rev. 1.2 (sin cambios — corrección IMPLEMENTATION_DEFECT)
Discovery refs: DEC-20260824-02, BR-20260824-01, BR-20260824-02,
                IMPL-FIX-20260824-XX rev. UI prediagnóstico (Frank)
Origen funcional: Frank confirmó integrar el algoritmo AMI (DETERMINAR
                  EL PATRÓN ESPIROMÉTRICO) como referencia prioritaria
                  del prompt clínico de prediagnóstico de Espirometría
                  (MedGemma/DR7), sin perder guardrails ni el contrato
                  JSON actual.
```

## Cambios

### Único cambio: `frontend/scripts/update-espirometria-prediagnosis-prompt.ts`

- **`PREDIAGNOSIS_VERSION`**: `espirometria-prediagnosis-v2` → `espirometria-prediagnosis-v3`.
- **Docstring** actualizado con la marca `AMI-ESPIROMETRIA-v1` y `@backup` apuntando al PPTX fuente.
- **Banner de consola** actualizado: `AMI-ESPIROMETRIA-v1 (DEC-20260824-02 — Espirometría prediagnosis prompt v3; AMI primero + rev. UI Frank)`.
- **Prompt v3** reorganizado con **AMI como fuente prioritaria al inicio**:

  ```
  === 1) CRITERIOS AMI (FUENTE PRIORITARIA) ===
  PASO 1: Aceptabilidad y repetibilidad (gate de entrada)
  PASO 2: FEV1/FVC vs LIN → obstructivo / FVC vs 80% → normal o restrictivo
  PASO 3: Graduación obstrucción con FEV1% (70-100 leve / 60-69 moderada / 50-59 mod. grave / 35-49 grave / <35 muy grave)
  PASO 4: Broncodilatador > 200 ml Y > 12% (normaliza → hiperreactividad; no normaliza → obstrucción crónica)
  PASO 5: FVC baja NO confirma restricción → TLC/pletismografía

  === 2) DATOS DEL ESTUDIO ===
  {extracted_json}

  === 3) JERARQUÍA DE EVIDENCIA ===
  ... (preservada de v2)

  === 4) REFERENCIA SECUNDARIA ATS/ERS 2022 ===
  (NO desplaza al AMI — complementar)

  === 5) REGLAS DE SÍNTESIS CRÍTICAS — PROHIBICIONES ABSOLUTAS ===
  REGLA A-D (preservadas, alineadas con AMI)

  === 6) SALIDA JSON ===
  CAMPO `summary` — IMPRESIÓN DIAGNÓSTICA SUGERIDA BREVE (estilo documento clínico)
  CAMPO `recommendation` — RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA
  (preservadas de v2, sólo se referencian pasos AMI)

  === 7) LIMITES MÉDICOS OBLIGATORIOS (GUARDRAILS — MODO SOMBRA) ===
  PROHIBIDO aptitud / incapacidad / tratamiento / dictamen / diagnóstico definitivo
  PROHIBIDO copiar texto del PDF como summary/recommendation
  PROHIBIDO verbos prescriptivos absolutos
  Modo sombra + revisión médica
  ```

- **Citations** ahora incluyen `AMI-DETERMINAR-PATRON-2024` (fuente prioritaria) + ATS/ERS 2022 + NOM-022-STPS-2015 (no se eliminan).
- **Justification skeleton** cita "AMI paso 2", "AMI paso 3" etc. para que el LLM aprenda a referenciar los pasos.
- **Tamaño prompt**: ~9.5 KB (vs 9.6 KB en v2 — sin overhead; sólo reorganización + AMI).
- **Contrato JSON intacto**: misma estructura `{summary, confidence, clinical_state, justification, clinical_basis, citations, limitations, red_flags, recommendation, non_conclusive_reason}`.
- **Sin cambios** en:
  - `backend/app/services/ai/prediagnostic.py::PrediagnosticService.PREDIAGNOSTIC_PROMPTS["Espirometria"]`
    (fallback backend hardcoded — preservado como `backend_v2` por el resolver).
  - `backend/app/services/ai/base.py::M3VisionBase.call_m3` (extracción M3 intacta).
  - `backend/app/services/ai/extractor.py` (extracción Sibelmed intacta).
  - `prisma/schema.prisma` (sin migración).
  - `extraction.version` de la calibración (preservada en `v7` IMPL-FIX-20260824-04).
- **Idempotencia preservada**: si `diagnosis.version` ya es `espirometria-prediagnosis-v3`, el script reporta "ya configurado" y no escribe.
- **Script sólo toca `diagnosis`**: preserva `extraction.{prompt,version,model,provider,schemaVersion}` y todas las demás claves top-level de `aiCalibration` (igual que v2).

## Validación ejecutada

### Typecheck

```
$ cd frontend && npx tsc -p scripts/tsconfig.json --noEmit
exit=0
```

```
$ cd frontend && npx tsc --noEmit
exit=1 (1 error pre-existente línea 1541 del panel test rev. 3 — regex flag `s`;
        introducido por IMPL-FIX-20260824-04-rev3, NO por este incremento.
        Verificado con git stash.)
```

### Vitest focal

```
$ cd frontend && npx vitest run scripts/__tests__/update-espirometria-prediagnosis-prompt.test.ts
Test Files  1 passed (1)
     Tests  48 passed (48)   ← 36 pre-existentes v2 + 12 nuevos AMI-ESPIROMETRIA-v1
```

**12 nuevos tests para AMI-ESPIROMETRIA-v1** (bloque "AMI-ESPIROMETRIA-v1 flujo AMI prioritario"):
1. AMI como fuente prioritaria (aparece ANTES de ATS/ERS 2022).
2. PASO 1: aceptabilidad/repetibilidad + bajar confianza + REPETIR.
3. PASO 2: FEV1/FVC < LIN → obstructivo; FVC > 80% → normal; FVC ≤ 80% → restrictivo.
4. PASO 3: gradación FEV1% (70-100, 60-69, 50-59, 35-49, <35) con etiquetas completas.
5. PASO 4: broncodilatador >200 ml Y >12% + hiperreactividad vs obstrucción crónica.
6. PASO 5: FVC baja NO confirma restricción + TLC/pletismografía.
7. ATS/ERS 2022 como REFERENCIA SECUNDARIA (no desplazado por AMI).
8. Orden del prompt v3: AMI → datos → salida → guardrails.
9. Modo sombra + alerta de revisión médica preservados.
10. Citations incluye `AMI-DETERMINAR-PATRON-2024` (fuente prioritaria).
11. Justification cita "AMI paso N" explícitamente.
12. Sin migración Prisma (`PREDIAGNOSIS_VERSION` es `espirometria-prediagnosis-v\d+`).

### Regresión focal full

```
$ cd frontend && npx vitest run scripts/__tests__ src/components/clinical/__tests__
Test Files  7 passed (7)
     Tests  236 passed (236)   ← 0 regresiones
```

### Backend pytest focal (verificación, sin cambios)

```
$ cd backend && python3 -m pytest \
    tests/test_ai_pipeline.py::TestFIX20260824_04RegresionFEV1_Cero \
    tests/test_ai_pipeline.py::TestEspirometriaDiagnosisPromptResolverDEC20260824_02
========================= 11 passed in 0.52s =========================
```

Sin cambios en backend Python (prediagnóstico fallback intacto).

## Archivos modificados (sin commit/push)

```
frontend/scripts/update-espirometria-prediagnosis-prompt.ts                          | M (v2 → v3: PREDIAGNOSIS_VERSION bumped; AMI como fuente prioritaria al inicio; orden estricto AMI → datos → salida → guardrails)
frontend/scripts/__tests__/update-espirometria-prediagnosis-prompt.test.ts          | M (+12 tests AMI-ESPIROMETRIA-v1; 36 pre-existentes v2 adaptados a v3)
context/interconsultas/IMPL-REPORT-AMI-ESPIROMETRIA-v1-AMI-FIRST-PREDX.md              | NEW
```

## Versión remota (post-update, ESPIROMETRIA)

```
diagnosis.version  = "espirometria-prediagnosis-v3"   (AMI-ESPIROMETRIA-v1, Frank confirmado)
diagnosis.prompt   = "AMI primero (DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx) → datos → salida → guardrails"
extraction.version = "espirometria-sibelmed-v7"     (preservado, IMPL-FIX-20260824-04-rev3)
extraction.prompt  = (preservado, intacto)
```

## Comandos — ejecución contra Railway (ATLAS/Frank)

### 1. Pre-update (read-only)

```sql
SELECT
  options->'aiCalibration'->'diagnosis'->>'version' AS diagnosis_version,
  options->'aiCalibration'->'extraction'->>'version' AS extraction_version
FROM "MedicalTest"
WHERE name ILIKE 'ESPIROMETRIA'
LIMIT 1;
```

Salida esperada (pre-update):
```
 diagnosis_version                  | extraction_version
-------------------------------------+-----------------------
 espirometria-prediagnosis-v2        | espirometria-sibelmed-v7
```

### 2. Update — script idempotente (sólo toca `diagnosis`, preserva `extraction`)

```bash
# Con DATABASE_URL de Railway (NO loguear ni committear la URL):
cd frontend
DATABASE_URL='postgresql://<user>:<password>@<host>:<port>/<db>?sslmode=require' \
  npx tsx scripts/update-espirometria-prediagnosis-prompt.ts
```

Salida esperada (primer run):

```
=== AMI-ESPIROMETRIA-v1 (DEC-20260824-02 — Espirometría prediagnosis prompt v3; AMI primero + rev. UI Frank) ===

Encontrado: "ESPIROMETRIA" (ID: <uuid>)
Versión previa diagnosis.version:    espirometria-prediagnosis-v2
Nueva versión diagnosis.version:     espirometria-prediagnosis-v3
Tamaño prompt previo (si existía):   9703 chars
Tamaño prompt nuevo:                 9720 chars
Claves preservadas en aiCalibration (top-level): [enabled, canonicalStudyType, extraction, diagnosis]
Claves preservadas en aiCalibration.extraction:  [prompt, version] (incluye prompt v7 de IMPL-FIX-20260824-04-rev3 si existía)
   → extraction.version preservado:               espirometria-sibelmed-v7
   → extraction.prompt chars preservado:          <chars>

✓ Prompt clínico de Espirometría actualizado correctamente.
   → medical_test.id:        <uuid>
   → diagnosis.version:      espirometria-prediagnosis-v3
   → diagnosis.prompt size:   9720 chars
   → resolver consumirá vía V1/V2 path → prompt_source="ai_calibration"
```

Salida esperada (segundo run, idempotente):

```
ℹ️  aiCalibration.diagnosis.version ya es espirometria-prediagnosis-v3. No se realizan cambios (idempotente).
```

### 3. Post-update — verificar (sólo diagnosis, extracción preservada)

```sql
SELECT
  options->'aiCalibration'->'diagnosis'->>'version' AS diagnosis_version,
  options->'aiCalibration'->'extraction'->>'version' AS extraction_version,
  LENGTH(options->'aiCalibration'->'diagnosis'->>'prompt') AS diagnosis_chars
FROM "MedicalTest"
WHERE name ILIKE 'ESPIROMETRIA'
LIMIT 1;
```

Salida esperada:
```
 diagnosis_version                  | extraction_version        | diagnosis_chars
-------------------------------------+----------------------------+-----------------
 espirometria-prediagnosis-v3        | espirometria-sibelmed-v7   | 9720
```

`extraction_version` debe seguir siendo `espirometria-sibelmed-v7` (preservado intacto).

### 4. Re-procesar el Event actual

Subir de nuevo el PDF de Espirometría en Events. Verificar en el panel de Prediagnóstico IA:

- **Hallazgo sugerido**: ahora sigue el flujo AMI primero (paso 1 → 5), con justificación que cita "AMI paso N".
- **Recomendaciones sugeridas**: mantiene "RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA" (EPP, seguimiento, estudios complementarios cuando la evidencia lo justifique).
- **Limitaciones + fuentes clínicas**: preservadas.
- **Modo sombra + alerta de revisión médica**: preservados.
- **Criterios clínicos de Espirometría**: el bloque "Texto fuente del documento" sigue sin aparecer (rev. UI Frank previa).

## Archivos NO modificados (cumple restricción)

- `backend/app/services/ai/extractor.py` — intacto.
- `backend/app/services/ai/prediagnostic.py::PrediagnosticService.PREDIAGNOSTIC_PROMPTS["Espirometria"]`
  — intacto (fallback backend).
- `backend/app/services/ai/base.py::M3VisionBase.call_m3` — intacto.
- `prisma/schema.prisma` — sin cambios.
- `Migraciones` — ninguna.
- `discovery/`, `SPEC/`, `ADR/`, `PROYECTO.md` — sin cambios.
- Otros tipos de estudio (Audiometría, Laboratorio, etc.) — sin cambios.
- `extraction.version` en la calibración (v7 IMPL-FIX-20260824-04-rev3) — preservada.

## Pendientes ATLAS

1. **Ejecutar el script contra Railway** con DATABASE_URL vigente
   (paso 2). Reportar salida al equipo.
2. **Re-procesar el Event actual** (paso 4) y verificar que el
   Hallazgo sugerido cita los pasos AMI.
3. Decidir si GEMINI audita el cambio (recomendable — superficie UI
   + prompt remoto + reorganización con AMI como prioridad).
4. CRONISTA aplica transición cuando ATLAS confirme verificación.
5. Autorización Frank para commit/push cuando ATLAS lo lo autorice.

## Reversibilidad

100% — frontend-only + script de calibración remota. `git checkout`
de los 2 archivos modificados. Sin migración Prisma, sin cambios en
BD hasta que ATLAS ejecute el script contra Railway.

## Estado final

**READY_FOR_VERIFYING** — incremento único, presupuesto dentro del
objetivo (≤6 sesiones / ≤300 tool calls), V1 dirigida por corte, V2
focal completa al cierre, sin V3 independiente (no aplica GEMINI/Playwright
desde SOFIA — decisión de ATLAS).