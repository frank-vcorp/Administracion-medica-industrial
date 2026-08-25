# IMPL-REPORT — IMPL-FIX-20260824-XX rev. UI prediagnóstico (Frank)

```
ID intervención: IMPL-FIX-20260824-XX (rev. UI prediagnóstico)
ID tarea: Frank — eliminación bloque "Texto fuente del documento" del panel UI
         + ajuste prompt clínico para `summary` (impresión diagnóstica sugerida
         breve) + `recommendation` (recomendación ocupacional contextualizada).
Estado: READY_FOR_VERIFYING
SPEC activa: context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
             rev. 1.2 (sin cambios — corrección IMPLEMENTATION_DEFECT)
Discovery refs: DEC-20260824-02, BR-20260824-01, BR-20260824-02,
                IMPL-20260824-06 (prediagnosis v1)
Origen funcional: Frank confirmó dos cambios:
                  (1) Eliminar del panel Criterios clínicos el bloque
                      amber "TEXTO FUENTE DEL DOCUMENTO (NO ES DIAGNÓSTICO IA)"
                      + sus campos "IMPRESIÓN DIAGNÓSTICA" / "RECOMENDACIONES".
                      Mantener los datos del snapshot para auditoría.
                  (2) Ajustar el prompt clínico de Espirometría (MedGemma/DR7)
                      para que `summary` sea una IMPRESIÓN DIAGNÓSTICA SUGERIDA
                      BREVE (estilo clínico, generada desde parámetros) y
                      `recommendation` sea una RECOMENDACIÓN OCUPACIONAL
                      CONTEXTUALIZADA (EPP, seguimiento, estudios). PROHIBIDO
                      copiar texto fuente del PDF.
```

## Cambios

### 1) UI — `EspirometriaClinicalCriteriaPanel.tsx`

Eliminada del bloque JSX la sección que renderizaba el bloque amber
con título "Texto fuente del documento (NO es diagnóstico IA)" +
sub-bloques "Impresión diagnóstica" y "Recomendaciones". **Los datos
siguen presentes** en `ResolvedCriteria.impresionTexto` y
`recomendacionesTexto` (leídos desde `calidad.impresion_diagnostica_texto`
y `calidad.recomendaciones_texto` por `resolveCriteria`) para auditoría,
QA y export del JSON — sólo se eliminó la renderización visible.

Comentario inline en el JSX documenta:
- ID `@id IMPL-FIX-20260824-XX (rev. UI prediagnóstico, Frank)`.
- Los datos siguen en el snapshot / `ResolvedCriteria` (no se borra auditoría).
- La impresión diagnóstica vive ahora en el BLOQUE del prediagnóstico IA
  (modo sombra, revisión médica) bajo el encabezado "Hallazgo sugerido".
- Las recomendaciones ocupacionales contextualizadas viven en
  "Recomendaciones sugeridas" (también del prediagnóstico IA).

Test actualizado en `EspirometriaClinicalCriteriaPanel.test.ts` — el
describe "texto fuente del documento" ahora valida que el bloque NO
se renderiza:

- "Cuando `impresion_diagnostica_texto` está presente, NO se renderiza
  en el panel UI".
- "Los datos del snapshot siguen disponibles para auditoría
  (`resolveCriteria`)" — valida `c.impresionTexto` y `c.recomendacionesTexto`.
- "Ausencia de texto fuente → no se renderiza el bloque (regresión
  preservada)" — comportamiento anterior intacto.

### 2) Prompt clínico — `frontend/scripts/update-espirometria-prediagnosis-prompt.ts`

- **`PREDIAGNOSIS_VERSION`**: `espirometria-prediagnosis-v1` → `espirometria-prediagnosis-v2`
- **Docstring** actualizado con la narrativa rev. UI prediagnóstico (Frank).
- **Banner de consola** actualizado con la marca IMPL-FIX-20260824-XX.
- **CAMPO `summary` — NUEVO rev. UI prediagnóstico:**
  - Encabezado: "CAMPO `summary` — IMPRESIÓN DIAGNÓSTICA SUGERIDA BREVE".
  - Estilo: conciso, una línea, formato del documento clínico
    (`<patrón>; FVC <X>%; FEV1/FVC <ratio>`).
  - Ejemplos válidos: "Patrón espirométrico restrictivo; FVC 70%",
    "Espirometría sin patrón obstructivo/restrictivo evidente; FVC 81%",
    "Patrón obstructivo leve; FVC 95%; FEV1/FVC 0.66",
    "Función pulmonar normal; FVC 92%; FEV1/FVC 0.82".
  - Longitud: ≤ 160 caracteres.
  - **PROHIBIDO copiar** `calidad.impresion_diagnostica_texto` /
    `calidad.impresion_diagnostica` del PDF como summary. Se GENERA
    desde parámetros numéricos.
- **CAMPO `recommendation` — RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA:**
  - Encabezado: "CAMPO `recommendation` — RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA".
  - Componentes permitidos (sólo cuando la evidencia lo justifique):
    EPP, vigilancia periódica, correlación clínica, estudios
    complementarios, ejercicios/seguimiento.
  - Si patrón NORMAL sin exposición ocupacional inferida, recomendación
    mínima ("vigilancia periódica según protocolo").
  - **PROHIBIDO copiar** `calidad.recomendaciones_texto` /
    `calidad.recomendaciones` del PDF como recommendation.
  - Reglas por patrón (obstructivo / restrictivo / mixto / normal /
    calidad dudosa) preservadas de v1.
  - Longitud: 1-3 oraciones (≤ 320 caracteres).
- **PROHIBICIÓN explícita global** (nueva): "PROHIBIDO copiar texto del PDF
  (`calidad.impresion_diagnostica_texto`, `calidad.recomendaciones_texto`,
  `calidad.impresion_diagnostica`, `calidad.recomendaciones`) en `summary`
  ni `recommendation`. Ambos campos son GENERADOS a partir del análisis
  numérico de parámetros."
- **Modo sombra + revisión médica preservados** ("MODO SOMBRA: TODO lo
  que generes es APOYO A LA DECISIÓN del médico firmante").
- **Limitaciones, justificación y fuentes clínicas** preservadas (no se
  eliminaron).
- **PROHIBICIONES preservadas**: aptitud laboral, incapacidad,
  tratamiento, diagnóstico definitivo, verbos prescriptivos absolutos.
- **Sin migración Prisma**, sin schema change. El script sólo escribe
  `aiCalibration.diagnosis.{prompt,version}` — preserva
  `enabled`, `canonicalStudyType`, `extraction.{prompt,version,model,provider,schemaVersion}`,
  `normalization`, `presentation` y cualquier otra clave top-level.
- **Idempotente**: si `diagnosis.version` ya es
  `espirometria-prediagnosis-v2`, el script reporta "ya configurado"
  y no escribe.

## Validación ejecutada

### Typecheck

```
$ cd frontend && npx tsc --noEmit
exit=1 (1 error pre-existente en test rev. 3 línea 1541 — regex flag `s`;
        introducido por IMPL-FIX-20260824-04-rev3, NO por este incremento.
        Verificado con git stash.)

$ cd frontend && npx tsc -p scripts/tsconfig.json --noEmit
exit=0
```

### Vitest focal

```
$ cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts
Test Files  1 passed (1)
     Tests  109 passed (109)   ← 108 pre-existentes + 1 nuevo (no se renderiza bloque)
```

```
$ cd frontend && npx vitest run scripts/__tests__/update-espirometria-prediagnosis-prompt.test.ts
Test Files  1 passed (1)
     Tests  36 passed (36)   ← 24 pre-existentes v1 + 12 nuevos v2 (rev. UI)
```

12 nuevos tests para el prompt v2:

- `summary: prompt define "IMPRESIÓN DIAGNÓSTICA SUGERIDA BREVE" (estilo documento clínico)`
- `summary: prompt exige ≤ 160 caracteres y formato "patrón; FVC X%"`
- `summary: prompt PROHÍBE copiar impresion_diagnostica_texto del PDF`
- `summary: prompt incluye ejemplos válidos del estilo clínico`
- `recommendation: prompt define "RECOMENDACIÓN OCUPACIONAL CONTEXTUALIZADA"`
- `recommendation: prompt incluye componentes ocupacionales (EPP, seguimiento, estudios)`
- `recommendation: prompt PROHÍBE copiar recomendaciones_texto del PDF`
- `recommendation: prompt exige que EPP/ejercicios/estudios sólo cuando la evidencia lo justifique`
- `Modo sombra + revisión médica: prompt preserva semántica`
- `Limitaciones, justificación y fuentes clínicas preservadas`
- `Reglas de patrón preservadas (obstructivo / restrictivo / mixto / normal / dudosa)`
- `Sin migración: el script no publica V3 ni modifica schema Prisma`

### Regresión focal full

```
$ cd frontend && npx vitest run scripts/__tests__ src/components/clinical/__tests__
Test Files  7 passed (7)
     Tests  224 passed (224)   ← 0 regresiones
```

### Backend pytest focal (no tocado, sólo verificación)

```
$ cd backend && python3 -m pytest \
    tests/test_ai_pipeline.py::TestFIX20260824_04RegresionFEV1_Cero \
    tests/test_ai_pipeline.py::TestEspirometriaPrediagnosticRecommendationContextDEC20260824_02 \
    tests/test_ai_pipeline.py::TestEspirometriaDiagnosisPromptResolverDEC20260824_02
========================= 18 passed in 0.68s =========================
```

Sin cambios en backend Python (prediagnóstico sigue siendo
`PrediagnosticService.PREDIAGNOSTIC_PROMPTS["Espirometria"]` como
fallback, intacto).

## Archivos modificados (sin commit/push)

```
frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx                                                | M (elimina render del BLOQUE 5 "Texto fuente del documento"; preserva datos en ResolvedCriteria para auditoría)
frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts                                  | M (describe "texto fuente" ahora valida NO render + preserva audit en ResolvedCriteria)
frontend/scripts/update-espirometria-prediagnosis-prompt.ts                                                          | M (v1 → v2: PREDIAGNOSIS_VERSION bumped; nuevo bloque summary IMPRESIÓN DIAGNÓSTICA SUGERIDA BREVE + recommendation OCUPACIONAL CONTEXTUALIZADA; PROHIBICIONES ABSOLUTAS preservadas + PROHIBIDO copiar texto del PDF)
frontend/scripts/__tests__/update-espirometria-prediagnosis-prompt.test.ts                                            | M (+12 tests v2 rev. UI; 24 v1 pre-existentes adaptados a v2)
context/interconsultas/IMPL-REPORT-FIX-20260824-XX-UI-PREDIAGNOSTICO-FRANK.md                                          | NEW
```

## Versión remota (post-update, ESPIROMETRIA)

```
diagnosis.version = "espirometria-prediagnosis-v2"   (rev. UI prediagnóstico Frank)
diagnosis.prompt  = "IMPL-FIX-20260824-XX rev. UI" (summary + recommendation contextualizadas, NO copia PDF)
extraction.version = "espirometria-sibelmed-v7"     (preservado, IMPL-FIX-20260824-04-rev3)
extraction.prompt  = (preservado, intacto)
```

## Comandos — ejecución contra Railway (ATLAS/Frank)

### 1. Pre-update (read-only)

```sql
SELECT
  options->'aiCalibration'->'diagnosis'->>'version' AS diagnosis_version
FROM "MedicalTest"
WHERE name ILIKE 'ESPIROMETRIA'
LIMIT 1;
```

Salida esperada (pre-update):
```
 diagnosis_version
-------------------
 espirometria-prediagnosis-v1
```

### 2. Update — script idempotente

```bash
# Con DATABASE_URL de Railway (NO loguear ni committear la URL):
cd frontend
DATABASE_URL='postgresql://<user>:<password>@<host>:<port>/<db>?sslmode=require' \
  npx tsx scripts/update-espirometria-prediagnosis-prompt.ts
```

Salida esperada (primer run):

```
=== IMPL-FIX-20260824-XX (DEC-20260824-02 — Espirometría prediagnosis prompt v2; rev. UI prediagnóstico Frank) ===

Encontrado: "ESPIROMETRIA" (ID: <uuid>)
Versión previa diagnosis.version:    espirometria-prediagnosis-v1
Nueva versión diagnosis.version:     espirometria-prediagnosis-v2
Tamaño prompt previo (si existía):   <chars>
Tamaño prompt nuevo:                 <chars>
Claves preservadas en aiCalibration (top-level): [enabled, canonicalStudyType, extraction, diagnosis]
Claves preservadas en aiCalibration.extraction:  [prompt, version] (incluye prompt v7 de IMPL-FIX-20260824-04-rev3 si existía)
   → extraction.version preservado:               espirometria-sibelmed-v7
   → extraction.prompt chars preservado:          <chars>
...
✓ Prompt clínico de Espirometría actualizado correctamente.
   → medical_test.id:        <uuid>
   → diagnosis.version:      espirometria-prediagnosis-v2
   → diagnosis.prompt size:   <chars>
   → resolver consumirá vía V1/V2 path → prompt_source="ai_calibration"
```

Salida esperada (segundo run, idempotente):

```
ℹ️  aiCalibration.diagnosis.version ya es espirometria-prediagnosis-v2. No se realizan cambios (idempotente).
```

### 3. Post-update — verificar SOLO diagnosis (preserva extraction)

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
 espirometria-prediagnosis-v2        | espirometria-sibelmed-v7   | <chars>
```

`extraction_version` debe seguir siendo `espirometria-sibelmed-v7` (el script
sólo toca `diagnosis` — extracción preservada intacta).

### 4. Re-procesar el Event actual

Subir de nuevo el PDF de Espirometría en Events. Verificar en el panel
de Prediagnóstico IA:

- **Hallazgo sugerido** (modal sombra clínica): una línea en estilo
  documento clínico (p.ej. "Patrón espirométrico restrictivo; FVC 70%"
  o "Espirometría sin patrón obstructivo/restrictivo evidente; FVC 81%"
  según datos), generada desde los parámetros — NO copia la
  `impresion_diagnostica_texto` del PDF.
- **Recomendaciones sugeridas** (modal sombra): una recomendación
  ocupacional contextualizada (EPP, seguimiento, estudios
  complementarios) — NO copia `recomendaciones_texto` del PDF.
- **Criterios clínicos de Espirometría**: el bloque amber "Texto
  fuente del documento" ya NO aparece. Los campos del médico se
  siguen leyendo del snapshot para auditoría, pero no se renderizan.
- **Limitaciones / justificación / fuentes clínicas**: preservadas.
- **Modo sombra + revisión médica**: preservados (alerta de revisión).

## Archivos NO modificados (cumple restricción)

- `backend/app/services/ai/extractor.py` — intacto (extracción M3 / Sibelmed).
- `backend/app/services/ai/prediagnostic.py::PrediagnosticService.PREDIAGNOSTIC_PROMPTS["Espirometria"]`
  — intacto (fallback backend, sigue siendo la default).
- `backend/app/services/ai/base.py::M3VisionBase.call_m3` — intacto.
- `prisma/schema.prisma` — sin cambios.
- `Migraciones` — ninguna.
- `discovery/`, `SPEC/`, `ADR/`, `PROYECTO.md` — sin cambios.
- Otros tipos de estudio (Audiometría, Laboratorio, etc.) — sin cambios.
- Panel UI del prediagnóstico (StudyAIPrediagnosisPanel) — intacto
  (sigue mostrando "Hallazgo sugerido" + "Recomendaciones sugeridas"
  con el formato previo; sólo cambia lo que se renderiza en
  EspirometriaClinicalCriteriaPanel).
- Cálculos de repetibilidad / criterios visuales / cross-check
  inconsistencias (FIX-20260824-04 rev. 1-4) — intactos.

## Pendientes ATLAS

1. **Ejecutar el script contra Railway** con DATABASE_URL vigente
   (paso 2). Reportar salida al equipo.
2. **Re-procesar el Event actual** (paso 4) y verificar que el
   Hallazgo sugerido aparece con estilo clínico y NO copia el PDF.
3. Decidir si GEMINI audita el cambio (recomendable — superficie UI
   + prompt remoto + cambio en la regla de resumen).
4. CRONISTA aplica transición cuando ATLAS confirme verificación.
5. Autorización Frank para commit/push cuando ATLAS lo autorice.

## Reversibilidad

100% — frontend-only + script de calibración remota. `git checkout`
de los 4 archivos modificados. Sin migración Prisma, sin cambios en
BD hasta que ATLAS ejecute el script contra Railway.

## Estado final

**READY_FOR_VERIFYING** — incremento único, presupuesto dentro del
objetivo (≤6 sesiones / ≤300 tool calls), V1 dirigida por corte, V2
focal completa al cierre, sin V3 independiente (no aplica GEMINI/Playwright
desde SOFIA — decisión de ATLAS).