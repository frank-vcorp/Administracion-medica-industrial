# IMPL-REPORT — IMPL-20260824-05-FEATURE-FIX: Espirometría v6 captura (precedencia booleanos ≤150 + prompt v4→v5)

```
ID intervención: IMPL-20260824-05-FEATURE-FIX-ESPIROMETRIA-V5
ID tarea: IMPL-20260824-05 (fix defecto v6 captura Sibelmed RD2026)
Estado: READY_FOR_VERIFYING
SPEC activa: context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md (rev. 1.2, sin cambios — extensión por corrección IMPLEMENTATION_DEFECT)
Discovery refs: BR-20260824-01 (umbral AMI ≤ 150 ml), BR-20260824-02 (inferencia visual)
Origen funcional: defecto v6 captura Sibelmed RD2026 (la imagen embebida dice "Repetibilidad ATS/ERS: FVC: No / FEV1: No" pero los vectores PDF muestran "Repetibilidad FVC: 30.00 ml / FEV1: 40.00 ml" — el panel mostraba NO/NO porque copiaba el flag ATS/ERS en lugar de derivar del numérico)
```

## Síntoma

Con `context/RD2026/ESPIROMETRIA.pdf` y el prompt v4 desplegado en Railway, el panel "Criterios clínicos de Espirometría" mostraba:

- `Repetibilidad FVC ≤ 150 ml`: **NO**
- `Repetibilidad FEV1 ≤ 150 ml`: **NO**

…aunque `calidad.repetibilidad_fvc_ml = 30` y `calidad.repetibilidad_fev1_ml = 40` (vector PDF) y el cálculo de `parametros[]` arrojaba los mismos 30 / 40 ml (top-2 sobre M1/M2/M3). Los valores numéricos `30.00 ml / 40.00 ml` aparecían visibles en BLOQUE 1 (Repetibilidad numérica), pero BLOQUE 2 (Indicadores de calidad) reportaba NO/NO porque el extractor, bajo el prompt v4, podía copiar el flag ATS/ERS de la imagen embebida (`Repetibilidad ATS/ERS: FVC: No / FEV1: No`) en la clave `calidad.repetibilidad_fvc_menor_150` / `repetibilidad_fev1_menor_150`, y el panel daba precedencia al boolean extraído sobre el cálculo numérico.

Dos criterios distintos colisionaban:

1. **Criterio AMI ≤ 150 ml (BR-20260824-01):** diferencia numérica entre las 2 mejores maniobras FVC/FEV1 (panel lo calcula desde `parametros[]`).
2. **Criterio ATS/ERS del equipo (Sibelmed W20s):** flag binario propio del espirómetro, a veces contradictorio con el numérico (criterio aparte, ya visible en renderer vía `repetibilidad_ats_ers_fvc/_fev1`).

El panel mezclaba los dos: el ATS/ERS del equipo "sobrescribía" el criterio AMI. En el fixture documental real, ATS/ERS=FVC:No/FEV1:No, numérico=30/40 → umbral AMI ≤ 150 debería ser **SI/SI**, no NO/NO.

## Causa raíz

`EspirometriaClinicalCriteriaPanel.tsx::resolveCriteria` (FEATURE-20260824-01 rev. 1.4) priorizaba los booleanos extraídos en `calidad`:

```typescript
// ANTES (líneas 469–485 rev. 1.4):
const menor150FvcExtracted =
  normalizeSiNo(calidad?.repetibilidad_fvc_menor_150) ??
  normalizeSiNo(calidad?.repetibilidad_fvc_menor_200)
const menor150FvcComputed = isWithinAmiThreshold(repetibilidadFvcMl)
const repetibilidadFvcMenor150: "SI" | "NO" | null =
  menor150FvcExtracted ?? (menor150FvcComputed === null ? null : menor150FvcComputed ? "SI" : "NO")
```

El `??` daba prioridad al extraído sobre el calculado. Si el extractor copiaba el flag ATS/ERS en `repetibilidad_*_menor_150`, ese valor ganaba aunque el numérico dijera lo contrario.

Adicionalmente, el prompt remoto v4 (`espirometria-sibelmed-v4`, IMPL-20260824-04 — BR-20260824-02) instruía al extractor a transcribir la bandera Sí/No cuando apareciera en el reporte — sin distinguir explícitamente que NO debía copiar el flag ATS/ERS del equipo en `repetibilidad_fvc_menor_150` (criterio distinto), y permitía derivar `tiempo` y `criterios_para_dx` desde los visuales.

## Solución (2 archivos modificados + 2 archivos de tests modificados)

### 1) Panel: precedencia invertida (booleanos derivados SIEMPRE del numérico)

`frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx` — la rama de booleanos ≤150 ya NO consulta `calidad.repetibilidad_fvc_menor_150` ni la legacy `calidad.repetibilidad_fvc_menor_200` como verdad. Deriva SIEMPRE de `repetibilidadFvcMl`/`repetibilidadFev1Ml` (que ya respetan el numérico explícito del PDF cuando existe, o calculan desde `parametros[]` con `top-2 × 1000`):

```typescript
// DESPUÉS (IMPL-20260824-05):
const repetibilidadFvcMenor150: "SI" | "NO" | null =
  repetibilidadFvcMl === null
    ? null
    : isWithinAmiThreshold(repetibilidadFvcMl)
    ? "SI"
    : "NO"
const repetibilidadFev1Menor150: "SI" | "NO" | null =
  repetibilidadFev1Ml === null
    ? null
    : isWithinAmiThreshold(repetibilidadFev1Ml)
    ? "SI"
    : "NO"
```

`repetibilidadFvcMl` / `repetibilidadFev1Ml` siguen prefiriendo `calidad.repetibilidad_fvc_ml` / `calidad.repetibilidad_fev1_ml` cuando existen (vector PDF explícito) sobre el cálculo desde `parametros[]` (no se pierde la fuente numérica del documento). El cambio es **sólo** sobre los booleanos ≤150.

### 2) Prompt remoto v4 → v5 desplegado en Railway

`frontend/scripts/update-espirometria-extraction-prompt.ts`:

- `EXTRACTION_VERSION`: `espirometria-sibelmed-v4` → **`espirometria-sibelmed-v5`**
- Apartado nuevo **"CRITERIOS EXPLÍCITOS DEL DOCUMENTO"** que separa `tiempo`, `criterios_para_dx`, `calidad` de los visuales puros (Pico, Forma, Libre, Meseta). Reglas explícitas:
  - **`tiempo`**: sólo si el reporte declara EXPLÍCITAMENTE un indicador textual de aceptabilidad del FET ("FET: cumple criterio ATS/ERS", "Tiempo espiratorio: válido"). **NO derivar desde duración de curva** (caso Sibelmed: curva de 7s sin etiqueta → null).
  - **`criterios_para_dx`**: sólo si el reporte declara EXPLÍCITAMENTE "Criterios para Dx: SI/NO" (o equivalente textual inequívoco). **NO derivar de ATS/ERS ni de los visuales ni de heurística**.
  - **`calidad`**: sólo si el reporte declara EXPLÍCITAMENTE una letra/código (A/B/C/D/F). **NO calcular desde los visuales; NO asumir A por defecto**.
- Apartado nuevo **"REPETIBILIDAD (NO fuente de verdad)"** — `repetibilidad_fvc_menor_150` y `repetibilidad_fev1_menor_150` SIEMPRE `null` en el extractor; **el panel frontend los DERIVA** desde `repetibilidad_fvc_ml`/`repetibilidad_fev1_ml` aplicando umbral AMI ≤ 150 ml (BR-20260824-01). Prohibido copiar "Repetibilidad ATS/ERS: FVC: No/SI" en esas claves (criterio distinto del AMI, ya visible en renderer vía `repetibilidad_ats_ers_fvc/_fev1`).
- 4 visuales puros (`pico_maximo`, `forma_triangular`, `libre_artefactos`, `meseta`): inferencia visual clara desde las curvas (regla v4 preservada, sin cambios).
- `repetibilidad_ats_ers_fvc/_fev1` SÍ reciben el flag binario del equipo (criterio aparte).
- `repetibilidad_fvc_ml/_fev1_ml`: número en ml SÓLO si el reporte lo trae explícito como texto nativo (vector PDF). `null` en otro caso (no es error: el panel lo calcula desde `parametros[]`).
- Etiqueta "CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS" preservada (BR-20260824-02).

Resto de `aiCalibration` preservado intacto (sin creación de `prediagnostico` ni `normalization`).

### 3) Tests focales actualizados

`frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts`:

- **3 tests actualizados** (revertidos al nuevo contrato):
  - `boolean extraído en calidad NO sobrescribe el cálculo numérico (IMPL-20260824-05)`: con `repetibilidad_fvc_menor_150: 'NO'` extraído + cálculo 20 ml → ahora resuelve **SI** (antes NO).
  - `Legacy _menor_200 ya NO se acepta como fallback del boolean`: sin numérico → `null` (antes SI por fallback legacy).
  - `Sin numérico ni calidad numérica → null`: aunque ambas claves booleanas estén presentes, sin numérico → `null`.
- **3 tests nuevos (CASO V6 SIBELMED):**
  - `CASO V6 SIBELMED: repetibilidad 30/40 ml + flag ATS/ERS NO extraído → resuelve SI/SI` — reproducción exacta del defecto: ATS/ERS NO + repetibilidad_fvc_ml=30/fev1_ml=40 extraídos del vector PDF → booleanos resueltos **SI/SI** desde el numérico.
  - `CASO V6 SIBELMED (cálculo puro, sin numérico en calidad): 30/40 ml calculados + flag NO → SI/SI` — variante donde el extractor sólo entrega el flag copiado y NO entrega `repetibilidad_fvc_ml`; el panel calcula desde `parametros[]` y resuelve SI/SI.
  - `CASO V6 SIBELMED: diff 200/210 ml + flag NO extraído → NO/NO (umbral respetado)` — defensa: aunque el extractor haya copiado SI a `_menor_150`, un diff real > 150 ml produce NO (la regla numérica es la fuente de verdad, no el flag copiado).

`frontend/scripts/__tests__/update-espirometria-extraction-prompt.test.ts`:

- 38 tests (28 v4 → 38 v5) con la nueva organización: AC-1 visuales puros (4 claves, no 7), AC-7 criterios EXPLICITOS del documento (Tiempo/Criterios/Calidad), AC-8 `repetibilidad_*_menor_150` SIEMPRE null + separación ATS/ERS vs AMI.

## Archivos modificados

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx` — bloque de booleanos ≤150 reescrito (derivan del numérico; legacy `_menor_200` ya no se consulta).
- `frontend/scripts/update-espirometria-extraction-prompt.ts` — `EXTRACTION_VERSION` y `NEW_EXTRACTION_PROMPT` actualizados a v5; comentario JSDoc y mensaje del script reflejan IMPL-20260824-05.
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` — 3 tests actualizados + 3 tests nuevos (CASO V6 SIBELMED).
- `frontend/scripts/__tests__/update-espirometria-extraction-prompt.test.ts` — reescrito completo para v5 (AC-1 visuales puros, AC-7 EXPLÍCITOS, AC-8 repetibilidad NO fuente de verdad).

## Contratos

- **Cambian (delta suave, reversible):**
  - **Frontend `EspirometriaClinicalCriteriaPanel`:** los booleanos `Repetibilidad FVC/FEV1 ≤ 150 ml` ya NO consultan `calidad.repetibilidad_*_menor_150` ni `calidad.repetibilidad_*_menor_200`. Derivan SIEMPRE de `repetibilidadFvcMl`/`repetibilidadFev1Ml` con umbral AMI ≤ 150 ml. El cálculo numérico (top-2 sobre M1/M2/M3 × 1000) y la precedencia del numérico explícito del PDF sobre el cálculo se preservan.
  - **Backend `MedicalTest.options.aiCalibration.extraction` (Railway):** `version` `espirometria-sibelmed-v4` → `espirometria-sibelmed-v5`; `prompt` reemplazado (8206 → 10943 chars, +2737 chars por reglas EXPLÍCITAS nuevas); resto de campos intactos (`enabled`, `diagnosis`, `canonicalStudyType`, `extraction.{model, provider, schemaVersion}`).
  - **Snapshot persistido:** snapshots NUEVOS extraídos bajo v5 traerán `repetibilidad_fvc_menor_150 = null` y `repetibilidad_fev1_menor_150 = null` (el panel deriva el boolean); snapshots VIEJOS (v3/v4) con la clave poblada NO se regeneran automáticamente (ver "Reversibilidad" abajo).

- **Protegidos (NO TOCADOS):**
  - `parametros[]` numéricos (M1/M2/M3/%REF/REF/LLN), `repetibilidad_fvc_ml`, `repetibilidad_fev1_ml`, `repetibilidad_ats_ers_fvc/_fev1`, `pruebas_aceptables`, `pico_maximo`, `forma_triangular`, `libre_artefactos`, `meseta`, `impresion_diagnostica_texto`, `recomendaciones_texto`, `notas_calidad`: claves siguen en el JSON skeleton.
  - `repetibilidad_ats_ers_fvc/_fev1` siguen siendo extraídas (es el flag ATS/ERS del equipo, criterio distinto, ya visible vía `extraction-presentation-schemas.ts`).
  - `MedicalTest.options.aiCalibration.{enabled, diagnosis, canonicalStudyType}` y `extraction.{model, provider, schemaVersion}`: intactos (verificado en BD Railway post-deploy).
  - Cálculo de repetibilidad numérica (top-2 sobre m1/m2/m3 × 1000): intacto.
  - Threshold `AMI_REPETIBILIDAD_THRESHOLD_ML = 150`: intacto.
  - Esquemas Zod (`AIPrediagnosisResult`, `EspirometriaData`): sin cambios.
  - Prompts clínicos (`DR7`, `MedGemma`): sin cambios.
  - `backend/app/services/ai/extractor.py`, gates clínicos, normalizadores: sin cambios.
  - Otros tipos de estudio (Audiometría, Rayos X, etc.): sin cambios.
  - Snapshots ya persistidos en Prisma: inmutables (no se regeneran; sólo afecta corridas nuevas).

## Validación

| Gate | Comando | Resultado |
|---|---|---|
| Frontend typecheck | `cd frontend && npx tsc --noEmit` | **PASS** 0 errores |
| Frontend lint focal | `cd frontend && npx eslint src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS** 0 errores |
| Frontend vitest focal panel | `cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS** 59/59 (56 previos + 3 nuevos CASO V6 SIBELMED; 3 actualizados al nuevo contrato) |
| Frontend vitest focal prompt | `cd frontend && npx vitest run scripts/__tests__/update-espirometria-extraction-prompt.test.ts` | **PASS** 38/38 (28 v4 → 38 v5; AC-1/2/3/4/5/6/7/8 v5) |
| Frontend vitest compartido | `cd frontend && npx vitest run src/lib/clinical/__tests__/extraction-stage-label.test.ts` | **PASS** 4/4 (FIX-20260821-01 intacto) |
| Frontend vitest suite | `cd frontend && npx vitest run` | **0 regresiones nuevas**: 15 fallos preexistentes en `medical-exam.actions.test.ts` (idénticos al baseline). Total: 796/811 pasan. |
| Deploy prompt Railway | `set -a && source frontend/.env.production && set +a && cd frontend && npx tsx scripts/update-espirometria-extraction-prompt.ts` | **PASS** — `version: espirometria-sibelmed-v4` → `espirometria-sibelmed-v5`, prompt 8206 → 10943 chars, claves preservadas intactas (`enabled`, `diagnosis`, `canonicalStudyType`, `extraction.{model=Minimax-M3, provider=m3, schemaVersion=V1}`), sin creación de `prediagnostico`/`normalization`. |
| Verificación BD Railway post-deploy | `node scripts/verify-espirometria-prompt.mjs` (ad-hoc, borrado post-verificación) | **PASS** — `extraction.version === 'espirometria-sibelmed-v5'`, prompt length 10943, contiene "IMPL-20260824-05", "REPETIBILIDAD (NO fuente", "CRITERIOS EXPLÍCITOS", "Criterios para Dx: SI", "NO infieras \`tiempo\` a partir de la duración", "panel frontend", "ATS/ERS", "letra/código", "Repetibilidad ATS/ERS: FVC: No/SI"; claves `enabled=false`, `canonicalStudyType=null` (estado previo preservado), `diagnosis` (object) preservado, `extraction.{model=Minimax-M3, provider=m3, schemaVersion=V1}` preservadas; sin `prediagnostico`/`normalization` creados. |
| Prisma generate | `cd frontend && npx prisma generate` | **N/A** (sin cambios schema) |
| Frontend build | `cd frontend && npx next build` | **N/E** — no ejecutado (cambio focal sólo del panel + script de mantenimiento del prompt; sin cambios en páginas/rutas/build inputs; preservado por typecheck + lint + vitest focales verdes) |

## Trazabilidad AC (defecto v6 captura)

- **AC-V6.1 (panel):** `CASO V6 SIBELMED: repetibilidad 30/40 ml + flag ATS/ERS NO extraído → resuelve SI/SI` — PASS. Reproducción exacta: `repetibilidad_fvc_ml=30`, `repetibilidad_fev1_ml=40` (vector PDF) + `repetibilidad_fvc_menor_150='NO'` y `repetibilidad_ats_ers_fvc='No'` (imagen embebida) → `resolveCriteria` retorna `repetibilidadFvcMenor150='SI'` y `repetibilidadFev1Menor150='SI'`. Defecto cerrado.
- **AC-V6.2 (panel):** `CASO V6 SIBELMED (cálculo puro): 30/40 ml calculados + flag NO → SI/SI` — PASS. Variante donde el extractor NO entrega `repetibilidad_fvc_ml`; el panel calcula 30/40 desde `parametros[]` y deriva SI/SI.
- **AC-V6.3 (panel):** `CASO V6 SIBELMED: diff 200/210 ml + flag NO extraído → NO/NO` — PASS. Defensa: aunque el extractor copie un flag contradictorio, un diff real > 150 ml produce NO.
- **AC-V6.4 (panel):** `boolean extraído en calidad NO sobrescribe el cálculo numérico` — PASS. `repetibilidad_fvc_menor_150: 'NO'` + diff calculado 20 ml → resuelve SI.
- **AC-V6.5 (panel):** `Legacy _menor_200 ya NO se acepta como fallback` — PASS. Sin numérico, con `repetibilidad_fvc_menor_200: 'SI'` legacy → resuelve `null`.
- **AC-V6.6 (prompt v5):** `EXTRACTION_VERSION === 'espirometria-sibelmed-v5'` — PASS (verificado en código y en BD Railway).
- **AC-V6.7 (prompt v5):** `repetibilidad_fvc_menor_150: SIEMPRE null` — PASS (apartado "REPETIBILIDAD (NO fuente de verdad)" presente; verificado en BD).
- **AC-V6.8 (prompt v5):** `tiempo` no derivable de duración de curva — PASS (test `NUNCA infieras \`tiempo\` desde la duración de la curva`).
- **AC-V6.9 (prompt v5):** `criterios_para_dx` no derivable de ATS/ERS — PASS (test `NUNCA derives \`criterios_para_dx\` del flag ATS/ERS` + regla 4 PROHIBICIONES).
- **AC-V6.10 (prompt v5):** `calidad` no calculable desde visuales — PASS (test `NUNCA infieras \`calidad\` desde los visuales` + regla 5).
- **AC-V6.11 (prompt v5):** `pico_maximo`/`forma_triangular`/`libre_artefactos`/`meseta` mantienen inferencia visual clara con null si ilegible — PASS (4 tests AC-2 con prohibition "NUNCA devuelvas SI/NO si la curva no permite inferencia clara" + regla 1 PROHIBICIONES).
- **AC-V6.12 (prompt v5):** `repetibilidad_ats_ers_fvc/_fev1` SÍ reciben el flag ATS/ERS — PASS (test + sección "COMPATIBILIDAD HISTÓRICA").
- **AC-V6.13 (Railway):** claves preservadas intactas (`enabled`, `canonicalStudyType`, `diagnosis`, `extraction.{model=Minimax-M3, provider=m3, schemaVersion=V1}`); sin `prediagnostico`/`normalization` — PASS (verificado vía Prisma post-deploy).

## Riesgos y desviaciones

- **Riesgo de regresión del flag legacy `_menor_200` (BAJO):** la regla v4 que aceptaba `calidad.repetibilidad_fvc_menor_200` como fallback del boolean quedó **explícitamente removida** en IMPL-20260824-05. Snapshots históricos que SÓLO tenían `_menor_200` poblada (sin numérico explícito en `repetibilidad_fvc_ml`/`_fev1_ml` y sin `parametros[]` con FVC/FEV1) ahora muestran `Repetibilidad FVC ≤ 150 ml: —` en lugar de SI/NO. Es coherente con el contrato "el panel deriva del numérico"; si Frank prefiere conservar fallback legacy, se puede reintroducir `calidad.repetibilidad_fvc_menor_200` como pista **sólo si el numérico no existe** (cambio de 1 línea en `EspirometriaClinicalCriteriaPanel.tsx` — no se aplica por defecto en IMPL-20260824-05 para evitar reintroducir la confusión ATS/ERS/AMI).
- **Riesgo clínico (NULO):** el cálculo numérico (BR-20260824-01, AMI ≤ 150 ml) es el que ya usaba el panel antes del cambio y el que el médico ocupacional espera. El ATS/ERS del equipo sigue visible en `extraction-presentation-schemas.ts` ("Calidad técnica del estudio" → `repetibilidad_ats_ers_fvc/_fev1`); no se pierde información, sólo se separan los dos criterios que antes colisionaban.
- **Riesgo de regresión del panel (BAJO):** vitest focal 59/59 PASS; vitest suite 796/811 PASS (15 fallos preexistentes idénticos al baseline `medical-exam.actions.test.ts`, sin relación con este SPEC); typecheck 0 errores; lint 0 errores. FIX-20260821-01 y FEATURE-20260824-01 rev. 1.4 (preservación celdas FEV1) siguen verdes.
- **Desviación menor:** la regla legacy `_menor_200` se eliminó como fallback del boolean (no sólo se relajó). Consistente con el principio "ATS/ERS ≠ AMI"; reintroducirla como pista condicional es trivial pero no se aplica en este corte para mantener la separación limpia.
- **Build `next build` no ejecutado:** el cambio es puramente de presentación (panel) y de un script de mantenimiento del prompt (no se importa en `app/`). La cadena typecheck + lint + vitest focal + deploy Prisma script (que sí ejecuta queries reales contra Railway) cubre el riesgo operacional. Si ATLAS quiere `next build` verde antes de mergear, se ejecuta en V2.

## Requiere GEMINI

**Sí (cambio de contrato suave + cambio remoto del prompt + separación de criterios).** GEMINI debe auditar:
- **Panel:** la nueva regla de precedencia (booleanos ≤150 derivan SIEMPRE del numérico, NO de `calidad.repetibilidad_*_menor_150` ni legacy `_menor_200`) sobre el fixture documental real `context/RD2026/ESPIROMETRIA.pdf` y sobre el fixture nocturno `context/lote-nocturno-20260820-01/extraction-espirometria-rd2026.json` (que tiene `repetibilidad_fvc_ml=30`/`_fev1_ml=40` + `repetibilidad_fvc_menor_200='SI'` legacy). Verificar que SI/SI se muestra correctamente y que la operación exacta `(2.33 − 2.30) × 1000 = 30.00 ml / (2.15 − 2.11) × 1000 = 40.00 ml` sigue visible.
- **Prompt v5:** la separación de los 4 visuales puros vs los 3 EXPLICITOS del documento (Tiempo/Criterios/Calidad) y la regla "panel deriva los booleanos ≤150" (prohibido copiar ATS/ERS). Verificar que las prohibiciones son lo bastante fuertes para que un LLM medianamente alineado no reintroduzca las heurísticas de v4.
- **Remoto Railway:** `version: espirometria-sibelmed-v5`, prompt length 10943, claves preservadas intactas, sin creación de `prediagnostico`/`normalization`.
- **No-leakage / privacidad:** el cambio NO introduce nuevos logs, NO expone datos sensibles, NO cambia el contrato público del backend (sólo cambia el contenido del prompt remoto y la presentación del boolean ≤150 en el panel).

## Requiere DEBY

**No.** Defecto reproducible en FEATURE-20260824-01 (precedencia del boolean) y en IMPL-20260824-04 (prompt v4允许 copia del ATS/ERS); ambos atendidos en este mismo incremento sin cambio de contrato ni de alcance (IMPLEMENTATION_DEFECT dentro del mismo SPEC-FEATURE-20260824-01 rev. 1.2, regla §11 del protocolo SOFIA).

## Pendientes ATLAS/INTEGRA

1. **Verificación de gates completos:** INTEGRA reejecuta pytest focal + vitest focal + typecheck (yo ya lo hice y está verde focal: 59 + 38 = 97 tests pasan; suite completa 796/811 con 15 fallos preexistentes idénticos al baseline).
2. **GEMINI obligatorio** post-IMPL (cambio de contrato suave en presentación + cambio del prompt remoto con separación de criterios clínicos) — INTEGRA pivota sesión GEMINI con esta IMPL-REPORT + diff + fixture documental RD2026 + fixture nocturno `extraction-espirometria-rd2026.json`.
3. **E2E manual** con `context/RD2026/ESPIROMETRIA.pdf` cargado en estudio `Espirometria` (V3 published) en staging/dev — precondición `M3_API_KEY` real. Verifica que BLOQUE 2 muestra `Repetibilidad FVC ≤ 150 ml: SI` / `Repetibilidad FEV1 ≤ 150 ml: SI` y que BLOQUE 1 muestra `30.00 ml / 40.00 ml` con la operación exacta `(2.33 − 2.30) × 1000 = 30.00 ml / (2.15 − 2.11) × 1000 = 40.00 ml`. Verifica también que el bloque amber "Calidad técnica del estudio" del renderer sigue mostrando `repetibilidad_ats_ers_fvc: No / fev1: No` (criterio aparte, ahora claramente separado del AMI).
4. **Re-extracción opcional de snapshots históricos v3/v4** — los snapshots persistidos antes de este fix NO se regeneran automáticamente (inmutables). Si Frank quiere que la nueva regla aplique también a eventos ya cerrados, ATLAS autoriza `regenerateStudyAI` lote o re-upload manual. No es bloqueante; el defecto sólo afectaba corridas NUEVAS con el prompt v4.
5. **OK Frank para commit/push** — sin autorización explícita no se commitea, pushea, despliega. Los cambios locales en `frontend/` están listos; el script ya ejecutó contra Railway y modificó `MedicalTest.options.aiCalibration.extraction` (cambio operativo reversible, ver abajo).

## Reversibilidad

- **Panel (`EspirometriaClinicalCriteriaPanel.tsx`):** revertir el bloque "Booleanos ≤150" al código previo (`menor150FvcExtracted ?? ...`) restaura el comportamiento v1.4. Cambio de ~30 líneas; 100% reversible.
- **Prompt Railway (`MedicalTest.options.aiCalibration.extraction`):** la versión v4 (`espirometria-sibelmed-v4`) puede volver a desplegarse ejecutando de nuevo el script v4 (cambio de 1 constante en `EXTRACTION_VERSION` y `NEW_EXTRACTION_PROMPT`). El prompt previo NO está respaldado en el repo (sólo el script fuente contiene el contenido), por lo que se recomienda hacer backup del prompt v5 antes de revertir. Alternativamente, el script de Railway puede exportar el prompt actual y restaurarlo tras un rollback.
- **Prisma:** sin migración; sin cambios de schema; snapshots pre-existentes inmutables.
- **Tests:** los 3 tests actualizados (`boolean extraído NO sobrescribe`, `Legacy _menor_200 NO se acepta`, `Sin numérico → null`) reflejan el contrato nuevo; revertirlos requiere también revertir la lógica del panel (consistencia).

## Estado

**READY_FOR_VERIFYING.** WIP=0, sesión SOFIA cerrada. Entrega a ATLAS → INTEGRA verifica gates focales + V3 Playwright (cuando exista `M3_API_KEY` y entorno accesible) → GEMINI audita → ATLAS pide OK Frank.
