# IMPL-REPORT — IMPL-20260824-06 (DEC-20260824-02): Orden clínico del Prediagnóstico IA

```
ID intervención: IMPL-20260824-06
ID tarea: DEC-20260824-02 (Orden clínico del Prediagnóstico IA de Espirometría)
Estado: READY_FOR_VERIFYING
SPEC activa: context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
             rev. 1.2 (sin cambios — corrección IMPLEMENTATION_DEFECT dentro
             de la misma SPEC y sesión, extendida a UI + prompt clínico)
Discovery refs: DEC-20260824-02 (Frank 2026-08-24), BR-20260824-01, BR-20260824-02
Origen funcional: Frank confirmó el orden clínico del panel de Prediagnóstico
                  IA — hallazgo accionable primero, evidencia después.
```

## Cambios autorizados por la DEC

### 1) UI — `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`

**Renombre visual (sin cambiar contrato):** la etiqueta "Sugerencia IA" pasa
a **"Hallazgo sugerido"**. El campo `summary` del snapshot sigue siendo el
mismo — sólo cambia el encabezado visible.

**Nueva sección "Recomendaciones sugeridas"** (orden clínico DEC-20260824-02):
- Aparece **antes** de "Confianza del modelo".
- Soporta el contrato vigente (`recommendation: string`) **y** dos alias
  opcionales futuros (`recommendations: string[]`,
  `recommended_actions: string[]`), sin migración ni ruptura de snapshots.
- Helper interno `resolveRecommendations(predxData)` unifica los tres
  formatos y devuelve `null` si el snapshot no aporta ninguno — la sección
  se omite por completo (no se inventa contenido en frontend).
- Subtítulo obligatorio: "Sugerencias de apoyo a la decisión; no sustituyen
  indicación médica, diagnóstico definitivo ni dictamen de aptitud."
- Renderiza como `<p>` cuando hay 1 sola recomendación y como `<ul>` cuando
  hay varias.

**Orden DOM final del panel clínico (DEC-20260824-02):**

```
Modo sombra clínica (guardrail)
Alertas clínicas (red flags, si existen)
1. Hallazgo sugerido                     [data-testid="…hallazgo"]
2. Recomendaciones sugeridas             [data-testid="…recomendaciones"]
3. Confianza del modelo                  [data-testid="…confianza"]
4. Limitaciones  (details open)          [data-testid="…limitaciones"]
5. Justificación   (details open)        [data-testid="…justificacion"]
6. Fuentes clínicas (details open)       [data-testid="…fuentes"]
Revisión médica registrada (si existe)
```

**Preservado intacto:** modo sombra clínica, alerta de revisión médica,
cabecera `Prediagnóstico IA`, las tres secciones de evidencia iniciando
desplegadas, separación IA vs impresión del médico.

### 2) Backend — `backend/app/services/ai/prediagnostic.py` (prompt Espirometría)

Apartado `CAMPO \`recommendation\`` del prompt `"Espirometria"` extendido
con reglas de contenido **contextualizado** por patrón/calidad/entorno
ocupacional:

- **Patrón OBSTRUCTIVO**: correlación con espirometría previa, vigilancia
  periódica según severidad y exposición, prueba broncodilatadora si no
  hay datos post-BD.
- **Patrón sugestivo de RESTRICCIÓN**: correlación con espirometría previa,
  consideración de pletismografía/TLC para confirmación (no afirmar
  restricción definitiva).
- **Patrón MIXTO**: describir la ambigüedad, recomendar repetición con
  técnica adecuada y valoración médica.
- **Función NORMAL**: vigilancia espirométrica periódica según protocolo
  ocupacional + EPP respiratorio si hay exposición a polvos, humos,
  vapores o alergenos.
- **Calidad DUDOSA**: recomendar **repetir el estudio** con técnica
  adecuada antes de cualquier sugerencia clínica.

**Límites médicos obligatorios (nunca violar):**
- PROHIBIDO declarar aptitud laboral, incapacidad, tratamiento
  farmacológico ni dictamen final.
- PROHIBIDO usar verbos prescriptivos absolutos ("debe", "deberá").
- PROHIBIDO afirmar diagnóstico definitivo — sólo lenguaje prudente
  ("compatible con", "sugiere evaluación de", "requiere correlación").
- Si calidad insuficiente, recomendación PRINCIPAL es repetir.

**Contrato backend intacto:** `recommendation` sigue siendo SINGULAR.
Los alias `recommendations` / `recommended_actions` se admiten sólo en el
frontend para compat futura, sin promoción en backend.

### 3) Garantía: Minimax (M3) NO se usa para prediagnóstico

`grep` sobre `backend/app/services/ai/prediagnostic.py`:
- `clinical_provider = "dr7"` (default) o `"featherless"` (fallback si DR7
  no disponible). Capa clínica = MedGemma/DR7.
- M3/Minimax aparece únicamente en `extractor.py` (capa de extracción).
- Test V1 `test_prompt_no_minimax_for_prediagnosis` rechaza strings
  `"m3"`, `"minimax"`, `provider="m3"`, `clinical_provider="m3"`.

Esto cumple la regla DEC-20260824-02: "Minimax extrae; prediagnóstico
clínico usa proveedor clínico existente."

### 4) Calibración remota — no se requiere script nuevo

El prompt refinado vive en `PrediagnosticService.PREDIAGNOSTIC_PROMPTS`
(`backend/app/services/ai/prediagnostic.py`), el mismo lugar donde ya
viven todos los prompts prediagnósticos. Si en el futuro hay una
calibración V3 publicada con `clinicalCriteria.prompt`, el resolver V3
de `calibration_resolver.py` la prefiere sobre el default — no hay
nueva superficie de contrato. El patrón seguro existente de scripts
remotos (`update-espirometria-extraction-prompt.ts`,
`update-audiometria-extraction-prompt.ts`) aplica a `aiCalibration.extraction`
(no a prediagnóstico). NO se introduce script nuevo en este incremento
— sería un nuevo contrato de mantenimiento y excede el alcance DEC-20260824-02.

## Validación ejecutada (V1 dirigida + V2 focal)

### Typecheck frontend
```
$ cd frontend && npx tsc --noEmit
exit=0
```
0 errores. Tipo nuevo `recommendations?: string[] | null`,
`recommended_actions?: string[] | null` declarado correctamente en
`AIPrediagnosisData`.

### Vitest focal (frontend) — DOM order + label/content + regresión clínica

`src/components/clinical/__tests__/StudyAIPrediagnosisPanel.dec-20260824-02.test.ts`
(NEW, 11 tests) — cubre:
- AC-DEC-02-1: renombre visual "Hallazgo sugerido" / no aparece "Sugerencia IA"
- AC-DEC-02-2: sección `Recomendaciones sugeridas` con `recommendation` singular
- AC-DEC-02-2 (array): acepta `recommendations: string[]`
- AC-DEC-02-2 (alias): acepta `recommended_actions: string[]`
- AC-DEC-02-2 (vacío): si no hay ninguno, la sección se omite (no inventa)
- AC-DEC-02-2 (whitespace): strings vacíos/blanco se ignoran
- AC-DEC-02-3: 3 `<details open>` preservados (Limitaciones, Justificación, Fuentes)
- AC-DEC-02-4: **orden DOM estricto** Hallazgo → Recomendaciones → Confianza → Limitaciones → Justificación → Fuentes
- AC-DEC-02-4 (sin rec): orden clínico se mantiene aunque la sección de recs se omita
- AC-DEC-02-5: guardrail "Modo sombra clínica" + alerta revisión preservados
- AC-DEC-02-5: impresión del médico NO se mezcla con IA

```
$ cd frontend && npx vitest run \
    src/components/clinical/__tests__/StudyAIPrediagnosisPanel.dec-20260824-02.test.ts \
    src/components/clinical/__tests__/StudyAIPrediagnosisPanel.open-details.test.ts
✓ src/components/clinical/__tests__/StudyAIPrediagnosisPanel.open-details.test.ts (3 tests) 27ms
✓ src/components/clinical/__tests__/StudyAIPrediagnosisPanel.dec-20260824-02.test.ts (11 tests) 50ms
Test Files  2 passed (2)
     Tests  14 passed (14)
```

Regresión clínica: `npx vitest run src/components/clinical/__tests__` →
**88 tests passed (5 archivos)**, 0 regresiones (incluye
`EspirometriaClinicalCriteriaPanel.test.ts` 59/59,
`ClinicalExtractionRenderer.fase5.test.ts` 8/8,
`ExamenMedicoEstudio.test.ts` 7/7).

Regresión scripts calibración: `npx vitest run scripts/__tests__` →
**38 tests passed** (`update-espirometria-extraction-prompt.test.ts`).

### Pytest focal (backend) — prompt Espirometría contextualizado

`tests/test_ai_pipeline.py::TestEspirometriaPrediagnosticRecommendationContextDEC20260824_02`
(NEW, 7 tests):
- AC-1: prompt referencia explícita DEC-20260824-02 / IMPL-20260824-06
- AC-2: reglas por patrón (obstructivo, restrictivo, mixto, normal, calidad
  dudosa) + EPP + pletismografía/TLC
- AC-3: PROHIBIDO aptitud/incapacidad/tratamiento/dictamen + lenguaje
  prudente obligatorio
- AC-4: prohibición del verbo prescriptivo absoluto "debe"
- AC-5: "repetir" instrucción cuando calidad insuficiente
- AC-6: contrato sigue siendo `recommendation` singular
- **Garantía M3**: cero referencias a `m3`, `Minimax`,
  `provider="m3"`, `clinical_provider="m3"` en `prediagnostic.py`

```
$ cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestEspirometriaPrediagnosticRecommendationContextDEC20260824_02 -v
========================= 7 passed, 1 warning in 1.34s =========================
```

## Trazabilidad AC → prueba/evidencia

| AC DEC-20260824-02                                  | Prueba focal V1                                    | Resultado |
|------------------------------------------------------|----------------------------------------------------|-----------|
| Renombre "Hallazgo sugerido"                         | dec-20260824-02.test.ts › AC-DEC-02-1             | PASS      |
| "Recomendaciones sugeridas" antes de Confianza       | dec-20260824-02.test.ts › AC-DEC-02-2 (×4)         | PASS      |
| Contrato `recommendation` singular preservado        | dec-20260824-02.test.ts › AC-DEC-02-2 (vacío)     | PASS      |
| Acepta aliases `recommendations` / `recommended_actions` | dec-20260824-02.test.ts › AC-DEC-02-2 (array/alias) | PASS      |
| 3 secciones evidencia inician `details open`          | dec-20260824-02.test.ts › AC-DEC-02-3             | PASS      |
| Orden DOM clínico estricto                            | dec-20260824-02.test.ts › AC-DEC-02-4 (×2)        | PASS      |
| Modo sombra clínica + alerta revisión preservados     | dec-20260824-02.test.ts › AC-DEC-02-5 (×2)        | PASS      |
| Prompt Espirometría: contextualización por patrón    | backend pytest › test_ac2                          | PASS      |
| Prompt Espirometría: límites médicos PROHIBIDO        | backend pytest › test_ac3                          | PASS      |
| Prompt Espirometría: sin verbos prescriptivos         | backend pytest › test_ac4                          | PASS      |
| Prompt Espirometría: repetir cuando calidad dudosa    | backend pytest › test_ac5                          | PASS      |
| Contrato backend singular sin promoción array         | backend pytest › test_ac6                          | PASS      |
| M3/Minimax NO se usa para prediagnóstico              | backend pytest › test_prompt_no_minimax_for_prediagnosis | PASS |
| Typecheck frontend                                    | `tsc --noEmit` exit=0                              | PASS      |
| Regresión clínica completa                            | vitest 88/88 + scripts 38/38 + pytest 7/7 nuevos   | PASS      |

## Archivos modificados / creados

```
backend/app/services/ai/prediagnostic.py                              |  +40 líneas (apartado CAMPO `recommendation` Espirometría)
backend/tests/test_ai_pipeline.py                                     | +106 líneas (TestEspirometriaPrediagnosticRecommendationContextDEC20260824_02)
frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx        | +88 -34 (renombre, sección Recomendaciones, reorden Limitaciones/Justificación)
frontend/src/components/clinical/__tests__/StudyAIPrediagnosisPanel.dec-20260824-02.test.ts | NEW (11 tests V1)
```

Sin cambios en:
- `prisma/schema.prisma` / migraciones (0)
- `discovery/` (DEC ya escrita por ATLAS/Frank — DEC-20260824-02 confirmed)
- `context/SPECs/` (SPEC-FEATURE-20260824-01 sigue activa rev 1.2)
- `PROYECTO.md` (no se actualiza — lo aplica CRONISTA tras verificación)
- Lockfiles (package-lock.json, pnpm-lock.yaml) — sin nuevas deps
- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx` y demás paneles adyacentes — sin cambios
- Scripts remotos de calibración — sin cambios (la regla de decisión no los requiere para prediagnóstico)

## Riesgos y desviaciones

- **Riesgo bajo**: el prompt Espirometría cambia reglas de contenido pero
  NO toca `recommendation` schema ni los nombres de campo. Snapshots
  viejos siguen siendo válidos. La salida textual del modelo puede ser
  ligeramente más larga o más contextualizada — se mantiene en ≤ 320
  caracteres y se renderiza dentro del bloque `Recomendaciones sugeridas`
  existente.
- **Sin migración Prisma**, **sin cambio de contrato público**,
  **sin deploy**, **sin commit/push** — espera verificación INTEGRA +
  autorización Frank.
- **NO se invoca GEMINI ni DEBY** desde esta sesión. Cambios UI suaves
  (sin schema, sin migración, sin auth, sin billing). El cambio del
  prompt es interno reversible; GEMINI puede auditarlo si ATLAS lo
  requiere en gate, pero no es obligatorio.
- **Subtítulos médicos** del bloque de recomendaciones son copy estático
  no generado por IA — refuerza el modo sombra clínica y no se mezcla
  con la impresión del médico.

## Pendientes ATLAS

- Verificación V2 completa focal (vitest 14/14 + pytest 7/7 nuevos +
  regresión clínica).
- Decide si GEMINI audita este cambio (recomendable por tocar prompt
  clínico, aunque sea interno reversible — DEC-20260824-02 es directiva
  funcional, no contrato nuevo).
- Decide si requiere V3 Playwright (cambio UI) — recomendable con un
  snapshot de Espirometría cargado.
- Actualizar `PROYECTO.md` y `context/CURRENT.md` con la entrada del
  cierre SOFIA (CRONISTA aplica la transición).
- Solicitar OK Frank para commit/push cuando ATLAS lo autorice.

## Reversibilidad

100% — los 4 archivos modificados/creados pueden volver a su estado
anterior con `git checkout` de los 2 modificados + `git clean` del nuevo
test file. Sin migraciones Prisma, sin cambios en BD, sin deploy, sin
publicación V3. El prompt Espirometría es default del backend; ningún
snapshot persistido en BD cambia de contenido al revertir.

## Estado final

**READY_FOR_VERIFYING** — incremento único, presupuesto dentro del
objetivo (≤6 sesiones / ≤300 tool calls), V1 dirigida por corte,
V2 focal completa al cierre, sin V3 independiente (no aplica GEMINI/Playwright
desde SOFIA — decisión de ATLAS).