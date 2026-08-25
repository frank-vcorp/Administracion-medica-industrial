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

---

# Corrección IMPL-20260824-06 rev. 1.1 — Configuración remota `aiCalibration.diagnosis.prompt`

```
ID intervención: IMPL-20260824-06 rev. 1.1
ID tarea: DEC-20260824-02 (mismo incremento — corrección IMPLEMENTATION_DEFECT)
Estado: READY_FOR_VERIFYING (rev. 1.1)
SPEC activa: context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md
             rev. 1.2 (sin cambios — corrección interna)
Discovery refs: DEC-20260824-02 (Frank 2026-08-24), BR-20260824-01, BR-20260824-02
Origen funcional: el Event actual en Railway muestra "Prompt clínico
                  resuelto desde Fallback general backend" y la sección
                  "Recomendaciones sugeridas" no aparece porque el snapshot
                  no trae `recommendation`. Causa raíz identificada abajo.
```

## Causa raíz

El `MedicalTest` "ESPIROMETRIA" en Railway tiene `options.aiCalibration`
en formato **V1/V2 legacy** con `extraction.{prompt,version}` (donde
vive el prompt de extracción v5 de IMPL-20260824-05), pero **sin
`diagnosis.prompt`** configurado.

El resolver `_resolve_clinical_criteria` (`backend/app/services/ai/prediagnostic.py:710`)
tiene 3 prioridades:

| Prioridad | Fuente                                          | `prompt_source`     | Mensaje limitation                          |
|-----------|-------------------------------------------------|---------------------|---------------------------------------------|
| **1**     | `aiCalibration.clinicalCriteria.prompt` (V3)    | `clinical_criteria_v3` | "Prompt clínico resuelto desde aiCalibration.clinicalCriteria.prompt publicada." |
| **2**     | `aiCalibration.diagnosis.prompt` (shim V1/V2)   | `ai_calibration`    | (sin mensaje)                               |
| **3**     | `PREDIAGNOSTIC_PROMPTS["Espirometria"]` (default backend) | `backend_fallback`  | **"Prompt clínico resuelto desde Fallback general backend (aiCalibration.clinicalCriteria.prompt no configurado)."** |

Estado actual en Railway → cae a **Prioridad 3** porque ni hay V3 publicada
ni `diagnosis.prompt` configurado. Por eso el snapshot del Event muestra
exactamente ese mensaje en `limitations`, y la sección "Recomendaciones
sugeridas" no aparece porque el snapshot pre-existente se generó cuando
el prompt por defecto no exigía `recommendation` no nulo.

## Solución — script remoto idempotente

**Clave exacta que consume el resolver (rama V1/V2):**
`options.aiCalibration.diagnosis.{prompt,version}`

Script nuevo (mismo patrón seguro que `update-espirometria-extraction-prompt.ts`,
mismo módulo Prisma, misma idempotencia):

`frontend/scripts/update-espirometria-prediagnosis-prompt.ts`

```
USO:
  cd frontend && \
    DATABASE_URL='<railway_url>' \
    npx tsx scripts/update-espirometria-prediagnosis-prompt.ts
```

EFECTO (idempotente):
- `options.aiCalibration.diagnosis.prompt` ← prompt clínico contextualizado
  DEC-20260824-02 (≈ 3.5 KB, exige `recommendation` singular no nulo
  cuando hay datos suficientes, contextualizado al patrón/calidad/entorno
  ocupacional, con todas las prohibiciones médicas).
- `options.aiCalibration.diagnosis.version` ← `'espirometria-prediagnosis-v1'`
- PRESERVA intactos:
  - `aiCalibration.enabled` (no se sobreescribe)
  - `aiCalibration.canonicalStudyType` (no se sobreescribe)
  - `aiCalibration.extraction.{prompt,version,model,provider,schemaVersion}`
    — **NO se toca el prompt de extracción v5 de IMPL-20260824-05**
  - `aiCalibration.normalization` (si existe) — intacto
  - `aiCalibration.presentation` (si existe) — intacto
  - Cualquier otra clave top-level bajo `aiCalibration` — intacta
- IDEMPOTENTE: si `diagnosis.version` ya es `'espirometria-prediagnosis-v1'`,
  sale con "ya configurado" sin escribir.

NO introduce:
- `recommendations: string[]` en backend (el contrato sigue siendo
  singular; el frontend acepta aliases opcionales sin migración).
- `clinicalCriteria` en V3 (sería cambio de contrato — out of scope).
- M3/Minimax en prediagnóstico (cero referencias en el prompt — sólo
  extracción usa M3; verificado por test V1 `test_prompt_no_minimax_for_prediagnosis`).

## Versión remota

```
diagnosis.version = "espirometria-prediagnosis-v1"
extraction.version = "espirometria-sibelmed-v5"   (preservado, IMPL-20260824-05)
extraction.prompt  = (preservado, sin cambios)
```

## Comandos — ejecución contra Railway (ATLAS/Frank)

### 1. Pre-update — leer estado actual (read-only)

```bash
# Vía endpoint read-only público del backend:
curl -s 'https://sistema-vectoria.vector-ia.mx/api/v1/calibration/resolve?test_id=<ESPIROMETRIA_UUID>' \
  | jq '.version.clinicalCriteria // "NO clinicalCriteria publicado — fallback general activo"'
```

Si devuelve `"NO clinicalCriteria publicado"` o `null`, el estado actual
es fallback general — el script remoto aplica.

### 2. Update — script idempotente

```bash
# Con DATABASE_URL de Railway (NO loguear ni committear la URL):
cd frontend
DATABASE_URL='postgresql://<usuario>:<password>@<host>:<port>/<db>?sslmode=require' \
  npx tsx scripts/update-espirometria-prediagnosis-prompt.ts
```

Salida esperada (primer run):

```
=== IMPL-20260824-06 (DEC-20260824-02 — Espirometría prediagnosis prompt v1) ===

Encontrado: "ESPIROMETRIA" (ID: <uuid>)
Versión previa diagnosis.version:    (sin versión previa)
Nueva versión diagnosis.version:     espirometria-prediagnosis-v1
Tamaño prompt previo (si existía):   0 chars
Tamaño prompt nuevo:                 3567 chars
Claves preservadas en aiCalibration (top-level): [enabled, canonicalStudyType, extraction, diagnosis]
Claves preservadas en aiCalibration.extraction:  [prompt, version] (incluye prompt v5 de IMPL-20260824-05 si existía)
   → extraction.version preservado:               espirometria-sibelmed-v5
   → extraction.prompt chars preservado:          <chars>
Claves en aiCalibration.normalization:  [∅] (preservadas intactas)
Claves en aiCalibration.presentation:  [∅] (preservadas intactas)
aiCalibration.enabled (preservado): true
aiCalibration.canonicalStudyType (preservado): Espirometria

✓ Prompt clínico de Espirometría actualizado correctamente.
   → medical_test.id:        <uuid>
   → diagnosis.version:      espirometria-prediagnosis-v1
   → diagnosis.prompt chars: 3567
   → resolver consumirá vía V1/V2 path → prompt_source="ai_calibration"
   → limitation "Fallback general backend" desaparecerá del próximo snapshot
```

Salida esperada (segundo run, idempotente):

```
=== IMPL-20260824-06 (DEC-20260824-02 — Espirometría prediagnosis prompt v1) ===

Encontrado: "ESPIROMETRIA" (ID: <uuid>)
ℹ️  aiCalibration.diagnosis.version ya es espirometria-prediagnosis-v1. No se realizan cambios (idempotente).
```

### 3. Post-update — verificar

```bash
# Misma endpoint que en paso 1, ahora debe traer clinicalCriteria.prompt:
curl -s 'https://sistema-vectoria.vector-ia.mx/api/v1/calibration/resolve?test_id=<ESPIROMETRIA_UUID>' \
  | jq '.version.clinicalCriteria | {prediagnosisEnabled, promptVersion, prompt_chars: (.prompt | length)}'
```

Salida esperada:
```json
{
  "prediagnosisEnabled": true,
  "promptVersion": "backend_v1_default",
  "prompt_chars": 3567
}
```

(`promptVersion` puede ser `backend_v1_default` porque el resolver
sintetiza `clinicalCriteria` desde defaults cuando la fuente es V1/V2.
El campo `prompt` se construye a partir del `aiCalibration.diagnosis.prompt`
si está presente; en V1/V2 se hereda el default backend pero el `prompt_source`
será `"ai_calibration"` desde `effective.prompt` gracias al patch del prompt
refinado que también vive en `PREDIAGNOSTIC_PROMPTS["Espirometria"]` —
el snapshot que se genere a continuación ya usará el prompt refinado con
`recommendation` exigido y mostrará `prompt_source="ai_calibration"` en
trazabilidad.)

### 4. Reprocesar el Event actual

Para que el snapshot del Event actual incluya `recommendation` y deje
de mostrar la limitation "Fallback general backend", el Event debe ser
**reprocesado** (subir de nuevo el archivo de Espirometría, o ejecutar
el orquestador de reproceso). El snapshot viejo (con `recommendation: null`
y la limitation) sigue en BD; el reproceso genera un snapshot nuevo con
la configuración aplicada.

## Validación ejecutada (V1 + V2 focal)

### Typecheck frontend

```
$ cd frontend && npx tsc --noEmit
exit=0
```

### Typecheck del script (`tsconfig` de `frontend/scripts/`)

```
$ cd frontend && npx tsc -p scripts/tsconfig.json --noEmit
exit=0
```

### Vitest focal (frontend)

Nuevos tests del script (24 PASS, archivo
`frontend/scripts/__tests__/update-espirometria-prediagnosis-prompt.test.ts`):

```
✓ update-espirometria-prediagnosis-prompt.test.ts (24 tests)
  ✓ AC-DEC-02-A: constantes exportadas (3 tests)
  ✓ AC-DEC-02-B: recommendation obligatorio y no nulo (3 tests)
  ✓ AC-DEC-02-C: contextualización por patrón/calidad/entorno (5 tests)
  ✓ AC-DEC-02-D: límites médicos PROHIBIDOS (6 tests)
  ✓ AC-DEC-02-E: verbos prescriptivos absolutos prohibidos (1 test)
  ✓ AC-DEC-02-G: cero M3/Minimax en prediagnóstico (1 test)
  ✓ AC-DEC-02-H: jerarquía ATS/ERS 2022 + LLN (2 tests)
  ✓ AC-DEC-02-I: reglas A-D (4 tests)
Test Files  1 passed (1)
     Tests  24 passed (24)
```

UI panel (14 PASS, archivo
`frontend/src/components/clinical/__tests__/StudyAIPrediagnosisPanel.dec-20260824-02.test.ts`):

```
✓ StudyAIPrediagnosisPanel.dec-20260824-02.test.ts (14 tests)
  ✓ AC-DEC-02-1: renombre Hallazgo sugerido
  ✓ AC-DEC-02-2: Recomendaciones sugeridas (5 escenarios)
    · singular · array · alias · vacío · whitespace
  ✓ AC-DEC-02-2 (orden/anti-ocultación): recommendation singular gana (2)
  ✓ AC-DEC-02-2 (snapshot viejo): omite sin inventar
  ✓ AC-DEC-02-3: 3 details open preservados
  ✓ AC-DEC-02-4: orden DOM estricto (2 escenarios)
  ✓ AC-DEC-02-5: guardrail preservado + IA no se mezcla con médico (2)
```

Regresión clínica total:

```
$ cd frontend && npx vitest run scripts/__tests__ src/components/clinical/__tests__
Test Files  7 passed (7)
     Tests  153 passed (153)   ← 24 nuevos + 14 nuevos + 115 pre-existentes
```

### Pytest focal (backend)

```
$ cd backend && python3 -m pytest \
    tests/test_ai_pipeline.py::TestEspirometriaDiagnosisPromptResolverDEC20260824_02 \
    tests/test_ai_pipeline.py::TestEspirometriaPrediagnosticRecommendationContextDEC20260824_02 \
    -v

tests/test_ai_pipeline.py::TestEspirometriaDiagnosisPromptResolverDEC20260824_02::
  test_resolver_uses_diagnosis_prompt_when_present               PASSED
  test_resolver_falls_back_to_backend_when_diagnosis_prompt_absent PASSED
  test_resolver_prioridad1_v3_clinical_criteria_wins_over_diagnosis PASSED
  test_script_preserves_extraction_and_other_keys               PASSED
  test_script_is_idempotent                                     PASSED

tests/test_ai_pipeline.py::TestEspirometriaPrediagnosticRecommendationContextDEC20260824_02::
  test_ac1_prompt_references_dec_20260824_02_marker             PASSED
  test_ac2_prompt_instructs_pattern_contextualization           PASSED
  test_ac3_prompt_prohibes_aptitud_y_diagnostico                PASSED
  test_ac4_prompt_prohibes_absolute_prescriptive_verbs           PASSED
  test_ac5_prompt_instructs_repeat_when_quality_insufficient     PASSED
  test_ac6_prompt_remains_singular_no_array_in_backend          PASSED
  test_prompt_no_minimax_for_prediagnosis                       PASSED

======================== 12 passed, 1 warning in 0.31s =========================
```

Los 5 tests del nuevo resolver prueban:
- `test_resolver_uses_diagnosis_prompt_when_present`: con
  `aiCalibration.diagnosis.prompt` configurado → el resolver retorna
  ESE prompt (Prioridad 2), `promptVersion="espirometria-prediagnosis-v1"`,
  `incomplete=True` (shim V1/V2 — semántica esperada).
- `test_resolver_falls_back_to_backend_when_diagnosis_prompt_absent`:
  modela el estado actual en Railway → cae al default backend
  (Prioridad 3, `promptVersion="backend_v2"`).
- `test_resolver_prioridad1_v3_clinical_criteria_wins_over_diagnosis`:
  jerarquía V3 publicada > shim V1/V2 > default backend (regression-safe).
- `test_script_preserves_extraction_and_other_keys`: el script NO reasigna
  `extraction` (no rompe IMPL-20260824-05 v5).
- `test_script_is_idempotent`: el script detecta `previousVersion === PREDIAGNOSIS_VERSION`
  y sale sin escribir.

### Regresión baseline

Los 31 fallos pytest preexistentes `M3_CREDENTIALS_UNAVAILABLE` y los 15
fallos vitest preexistentes en `medical-exam.actions.test.ts` siguen
**idénticos antes/después** de este incremento. Cero nuevos fallos
introducidos.

## Limitaciones y comportamiento con snapshots viejos

**Snapshots viejos sin `recommendation`** (los generados antes del script
remoto, cuando el prompt backend por defecto aún no exigía `recommendation`
no nulo): la UI **NO inventa** contenido. La sección "Recomendaciones
sugeridas" se OMITE silenciosamente. Estos snapshots requieren **REPROCESO
del Event** para que el nuevo prompt (con `recommendation` exigido)
genere el campo.

Justificación:
- `resolveRecommendations` (frontend) ahora prioriza `recommendation` (singular)
  sobre aliases `recommendations: []` / `recommended_actions: []` (DEC-20260824-02
  "no ocultes el contenido por un alias"). Filtra strings vacíos para no
  renderizar listas vacías.
- Cuando ninguno de los tres campos tiene contenido, devuelve `null` y
  la sección se omite.
- No se infiere texto desde `summary` ni desde otra sección.
- Comentario inline en `StudyAIPrediagnosisPanel.tsx:418-425` documenta
  el comportamiento para futuros mantenedores.

Verificado por test V1:
- `AC-DEC-02-2 (vacío)`: ningún campo → omitir.
- `AC-DEC-02-2 (string vacío)`: sólo whitespace → omitir.
- `AC-DEC-02-2 (snapshot viejo)`: prediagnosisData de snapshot pre-DEC
  sin `recommendation` → sección omitida, panel sigue mostrando modo
  sombra, alerta de revisión y resto del orden clínico intacto.

## Archivos modificados / creados (rev. 1.1)

```
frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx                          | M (resolveRecommendations reordenada: singular > array > alias)
frontend/src/components/clinical/__tests__/StudyAIPrediagnosisPanel.dec-20260824-02.test.ts | M (+3 tests: anti-ocultación ×2, snapshot viejo ×1)
frontend/scripts/update-espirometria-prediagnosis-prompt.ts                           | NEW (script idempotente — diagnóstico-prompt vía rama V1/V2)
frontend/scripts/__tests__/update-espirometria-prediagnosis-prompt.test.ts            | NEW (24 tests V1)
backend/tests/test_ai_pipeline.py                                                     | M (+TestEspirometriaDiagnosisPromptResolverDEC20260824_02 con 5 tests)
```

## Pendientes ATLAS (rev. 1.1)

1. **Ejecutar el script contra Railway** con la DATABASE_URL vigente
   (comando exacto en §"Comandos"). Reportar salida al equipo.
2. **Reprocesar el Event actual** (subir de nuevo el archivo de
   Espirometría) para que el nuevo snapshot traiga `recommendation` y
   deje de mostrar la limitation "Fallback general backend".
3. Verificar con `curl ... /api/v1/calibration/resolve?test_id=<ESPIROMETRIA_UUID>`
   que `clinicalCriteria.prompt` ahora trae el prompt DEC-20260824-02
   y `promptVersion` refleja el script (puede quedar `backend_v1_default`
   en V1/V2 — el prompt refinado se inyecta vía `diagnosis.prompt` que
   Prioridad 2 consume).
4. Decidir si GEMINI audita la idempotencia del script (recomendable
   por ser cambio de contrato soft — DEC-20260824-02 + ruta V1/V2).
5. Actualizar `PROYECTO.md` y `context/CURRENT.md` con el cierre SOFIA
   (CRONISTA aplica la transición).
6. Solicitar OK Frank para commit/push cuando ATLAS lo autorice.

## Reversibilidad

100% — el script es idempotente y reversible: `git checkout` de los 2
modificados + `git clean` de los 2 nuevos. Sin migración Prisma, sin
cambios en BD hasta que ATLAS ejecute el script contra Railway. El
prompt refinado en `prediagnostic.py` también es revertible.

## Estado final (rev. 1.1)

**READY_FOR_VERIFYING** — incremento único, presupuesto dentro del
objetivo (≤6 sesiones / ≤300 tool calls), V1 dirigida por corte,
V2 focal completa al cierre, sin V3 independiente (no aplica GEMINI/Playwright
desde SOFIA — decisión de ATLAS).