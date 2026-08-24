# IMPL-REPORT — IMPL-20260824-04 (BR-20260824-02 — Espirometría: gráficas claras → inferencia visual v4)

- **ID intervención:** `IMPL-20260824-04`
- **ID tarea:** BR-20260824-02
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` rev. 1.2 (sin cambios — sólo capa de prompt de extracción)
- **Discovery refs:** `discovery/BUSINESS-RULES.md` §BR-20260824-02 (Inferencia visual de criterios de calidad desde las gráficas)
- **Origen funcional:** BR-20260824-02 confirmado por Frank el 2026-08-24 — las gráficas del PDF Sibelmed son suficientemente claras para inferir criterios.
- **Estado:** `READY_FOR_VERIFYING`
- **Alcance:** script de mantenimiento del prompt de extracción en Railway + tests focales V1. Sin schema Prisma, sin migración, sin commit/push.

## Cambio

### 1) `frontend/scripts/update-espirometria-extraction-prompt.ts` — prompt v4

- Bump de versión: `espirometria-sibelmed-v3` → `espirometria-sibelmed-v4`.
- Tamaño del prompt: 5601 chars → **8206 chars** (+2605; +46.5%).
- Nuevos apartados (BR-20260824-02):
  - **INFERENCIA VISUAL DE CRITERIOS DE CALIDAD** — instrucción explícita de
    usar las curvas flujo-volumen y volumen-tiempo para inferir los 7
    criterios visuales (`pico_maximo`, `forma_triangular`,
    `libre_artefactos`, `meseta`, `tiempo`, `criterios_para_dx`,
    `calidad`). Dominios de salida explícitos: `"SI" | "NO" | null` (booleanos)
    y `"A" | "B" | "C" | "D" | "F" | null` (`calidad` global).
  - **REFERENCIA VISUAL (criterios ATS/ERS inferidos de las curvas)** — guía
    de qué aspecto de la curva justifica cada SI/NO.
  - **ETIQUETA OBLIGATORIA** — los 7 criterios son `CRITERIOS DERIVADOS
    VISUALMENTE DE LAS GRÁFICAS`; NO son texto escrito por el médico, NO
    son diagnóstico IA, NO sustituyen la revisión médica ocupacional.
  - **PROHIBICIONES ABSOLUTAS** (4 reglas numeradas):
    1. NUNCA inventar SI/NO/A/B/C/D/F si la curva no permite inferencia
       clara → `null` cuando ilegible, cortada, con leyendas no visibles o
       maniobras indistinguibles.
    2. NUNCA derivar los 7 visuales desde la tabla numérica — sólo desde
       las curvas legibles.
    3. NUNCA inventar impresión diagnóstica o recomendaciones — son
       TEXTO FUENTE del documento médico.
    4. NO modificar el cálculo numérico de repetibilidad FVC/FEV1 en ml —
       eso es responsabilidad del panel (top-2 sobre m1/m2/m3 × 1000, umbral
       AMI ≤ 150 ml, BR-20260824-01).
  - **TEXTO FUENTE DEL MÉDICO** — el panel lee
    `calidad.impresion_diagnostica_texto` y `calidad.recomendaciones_texto`
    (con sufijo `_texto`); el prompt v3 sólo emitía los nombres sin sufijo
    (`impresion_diagnostica`/`recomendaciones`). v4 publica **ambos** nombres
    en el JSON skeleton y pide POBLARLOS con el mismo valor cuando esté
    visible (defensa de aliases — fix de integración con el panel).
  - **REGLAS CRÍTICAS (resumen)** — recapitulación de las 4 reglas críticas.

- Apartados **preservados del v3** (sin cambio de contrato):
  - `FUENTE PRIMARIA (DATOS NUMÉRICOS)` — la tabla "INFORME DE FVC" sigue
    siendo la fuente numérica primaria; las 6 celdas por fila se conservan
    bit-a-bit (no desplazamiento M1→M2 ni mezcla de %REF con otra maniobra).
  - `ALIASES PARA REPETIBILIDAD Y ACEPTABILIDAD` — `repetibilidad_fvc_menor_150`,
    `repetibilidad_fev1_menor_150`, `pruebas_aceptables` cualitativos
    Sí/No (umbral AMI ≤ 150 ml). El extractor NO calcula ml aquí.
  - `COMPATIBILIDAD HISTÓRICA` — `repetibilidad_ats_ers_fvc`,
    `repetibilidad_ats_ers_fev1`, `es_interpretable`, `completitud_documental`,
    `repetibilidad_fvc_ml`, `repetibilidad_fev1_ml`, `notas_calidad`.

- Estructura del script:
  - Constantes `EXTRACTION_VERSION` y `NEW_EXTRACTION_PROMPT` ahora son
    `export const` para que los tests V1 puedan importarlas sin ejecutar la
    BD.
  - Invocación `main()` envuelta en una guarda entry-point
    (`fileURLToPath(import.meta.url) === process.argv[1]`) para que los tests
    puedan importar el módulo sin disparar la conexión Prisma.

### 2) `frontend/scripts/__tests__/update-espirometria-extraction-prompt.test.ts` — nuevo

28 tests en 6 `describe`s que cubren todos los AC del BR-20260824-02:

- **AC-1 — Inferencia visual desde gráficas (5 tests)** — versión v4, curvas
  flujo-volumen y volumen-tiempo mencionadas, 7 claves visuales presentes
  en el JSON skeleton, dominios de salida declarados explícitamente.
- **AC-2 + AC-7 — `null` para gráfica no legible + simulador de
  comportamiento (6 tests)** — el prompt contiene la prohibición explícita
  de inventar, más un simulador determinista que aplica las reglas del
  prompt a escenarios de legibilidad (gráfica totalmente ilegible → 7
  nulls; gráfica clara con todos los criterios → SI/SI/SI/SI/SI/SI/A;
  parcialmente legible con 1 criterio ambiguo → 1 null + calidad B;
  2 criterios ilegibles → calidad null; 2 NO → calidad C).
- **AC-3 — Etiquetado como derivado visual (2 tests)** — la cadena
  `CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS` aparece; el prompt
  afirma explícitamente que NO son texto del médico ni diagnóstico IA.
- **AC-4 — Repetibilidad FVC/FEV1 sigue siendo del panel (3 tests)** —
  el prompt documenta que el cálculo en ml es del panel, referencia
  BR-20260824-01 y 150 ml/0.15 L, y prohíbe al extractor multiplicar
  unidades.
- **AC-5 — No inventar impresión/recomendaciones (3 tests)** — marca
  `impresion_diagnostica*` y `recomendaciones*` como TEXTO FUENTE;
  contiene la prohibición `NUNCA inventes ... impresion_diagnostica ...
  recomendaciones`.
- **AC-6 — Aliases de texto fuente para el panel (4 tests)** — el JSON
  skeleton incluye `impresion_diagnostica_texto` y `recomendaciones_texto`
  (que el panel lee), conserva los nombres históricos sin sufijo, e
  instruye `POBLAR AMBOS` con el mismo valor.
- **Regresión: claves históricas preservadas (2 tests)** — las 10 claves
  históricas siguen en el skeleton; las filas FVC y FEV1 siguen siendo
  la fuente numérica primaria.
- **Contrato del script (3 tests)** — `EXTRACTION_VERSION` sigue la
  convención `espirometria-sibelmed-vN` y es estrictamente `v4`; el prompt
  es una cadena no vacía > 3000 chars.

### 3) `frontend/vitest.config.ts` — include path

- `include` ampliado de
  `['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts']`
  a
  `['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts', 'scripts/__tests__/**/*.test.ts']`
  para que `npx vitest run` (y el `pnpm test`) recoja los tests del
  directorio de scripts.

## Archivos

### Modificados

- `frontend/scripts/update-espirometria-extraction-prompt.ts` (+128 / −85 líneas)
  - Prompt v3 (5601 chars) → prompt v4 (8206 chars).
  - Versión `espirometria-sibelmed-v3` → `espirometria-sibelmed-v4`.
  - `EXTRACTION_VERSION` y `NEW_EXTRACTION_PROMPT` exportados para tests V1.
  - Guarda entry-point alrededor de `main()` para que el módulo sea
    importable sin ejecutar el side-effect contra la BD.
- `frontend/vitest.config.ts` (+3 / −1 líneas)
  - `include` añade `scripts/__tests__/**/*.test.ts`.

### Nuevos

- `frontend/scripts/__tests__/update-espirometria-extraction-prompt.test.ts`
  — 28 tests focales V1 (no requieren red ni BD).

### Sin cambios (protegidos por contrato)

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx`
  — el panel ya lee las 7 claves visuales en `calidad.*` y los alias
  `_texto` para el bloque de texto fuente. Sólo verifica que el JSON
  skeleton del prompt publique los alias correctos (`AC-6`).
- `frontend/src/components/clinical/extraction-presentation-schemas.ts` —
  sin cambios.
- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — sin cambios.
- `backend/app/services/ai/extractor.py`,
  `backend/app/services/ai/prediagnostic.py` — sin cambios. La fórmula de
  repetibilidad (top-2 sobre `m1`/`m2`/`m3`, ×1000, umbral AMI ≤ 150 ml)
  sigue siendo del panel frontend; el extractor NO calcula ml.
- `prisma/schema.prisma`, migraciones, endpoints — sin cambios.
- `extraction-presentation-schemas.ts` (renderer/schema) — sin cambios.

## Contratos

- **Cambia (delta soft, dentro de la misma SPEC FEATURE-20260824-01):**
  - Prompt de extracción para Espirometría: v3 → v4. No es contrato público
    observable para Frank; es directriz interna al LLM. El snapshot
    persistido (`extracted_data`) sigue siendo el mismo contrato.
  - Aliases en `calidad.*` del payload: el prompt ahora publica AMBOS
    nombres (`impresion_diagnostica_texto` + `impresion_diagnostica`,
    `recomendaciones_texto` + `recomendaciones`). El panel consume
    cualquiera de los dos sin cambios; no es contrato público nuevo.
- **Protegidos (NO TOCADOS):**
  - `extracted_data.parametros[]` raíz — sin cambios (sigue siendo la
    fuente para el cálculo de repetibilidad en panel).
  - `calidad.repetibilidad_fvc_ml`/`fev1_ml` — sin cambios (panel sigue
    usando extraído > calculado).
  - Endpoints V1/V2, schema Prisma, migraciones — sin cambios.
  - Estudio Audiometría y otros tipos — comportamiento idéntico.
  - Cálculo de repetibilidad y umbral AMI ≤ 150 ml — sin cambios.

## Validación

| Gate | Comando | Resultado |
|---|---|---|
| Frontend scripts typecheck | `cd frontend && pnpm run typecheck:scripts` | **PASS** 0 errores |
| Frontend full typecheck | `cd frontend && pnpm run typecheck` | **PASS** 0 errores |
| Frontend vitest focal — prompt v4 | `cd frontend && npx vitest run scripts/__tests__/update-espirometria-extraction-prompt.test.ts` | **PASS 28/28** |
| Frontend vitest focal — panel espirometría (regresión) | `cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS 56/56** (sin regresión) |
| Frontend vitest suite completa | `cd frontend && npx vitest run` | **15 failed, 783 passed** — los 15 fallos son pre-existentes en `medical-exam.actions.test.ts` (idénticos al baseline; no atribuibles) |

Ejecución contra Railway (producción) — verificación de la regla BR-20260824-02 desplegada:

```text
=== IMPL-20260824-04 (BR-20260824-02 — Espirometría inferencia visual v4) ===

Encontrado: "ESPIROMETRIA" (ID: 273bb1ef-0973-4f92-b762-e6a54cd98852)
Versión previa extraction.version: espirometria-sibelmed-v3
Nueva versión extraction.version:  espirometria-sibelmed-v4
Tamaño prompt previo:  5601 chars
Tamaño prompt nuevo:   8206 chars
Claves preservadas en aiCalibration (top-level): [enabled, diagnosis, extraction, canonicalStudyType]
Claves preservadas en aiCalibration.extraction:  [model, prompt, version, provider, schemaVersion]
Claves en aiCalibration.prediagnostico: [∅] (preservadas, sin creación)
Claves en aiCalibration.normalization:  [∅] (preservadas, sin creación)

Prompt de extracción actualizado correctamente.
   → medical_test.id:        273bb1ef-0973-4f92-b762-e6a54cd98852
   → extraction.version:     espirometria-sibelmed-v4
   → extraction.prompt size: 8206 chars
```

Verificación del contenido remoto del prompt v4 (queries puntuales a la BD vía `railway run`):

```text
ID:                          273bb1ef-0973-4f92-b762-e6a54cd98852
Name:                        ESPIROMETRIA
extraction.version:          espirometria-sibelmed-v4
extraction.prompt size:      8206
aiCalibration keys:          [enabled, diagnosis, extraction, canonicalStudyType]
extraction keys:             [model, prompt, version, provider, schemaVersion]

--- PROMPT CHECKS (todas true) ---
BR-20260824-02                true
flujo-volumen                 true
volumen-tiempo                true
pico_maximo                   true
forma_triangular              true
libre_artefactos              true
meseta                        true
tiempo                        true
criterios_para_dx             true
calidad                       true
CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS  true
impresion_diagnostica_texto   true   ← alias del panel agregado
recomendaciones_texto         true   ← alias del panel agregado
BR-20260824-01 (AMI 150 ml)   true
```

## Trazabilidad BR-20260824-02

| Regla BR-20260824-02 | Test / evidencia |
|---|---|
| Inferir visualmente `pico_maximo`, `forma_triangular`, `libre_artefactos`, `meseta`, `tiempo`, `criterios_para_dx`, `calidad` desde las curvas | tests AC-1 (5) |
| Devolver SI/NO o A/B/C/D/F sólo cuando la curva permita inferencia clara | tests AC-2 + simulador (6): "El prompt contiene la prohibición explícita de inventar SI/NO/A/B/C/D/F cuando la curva no permite inferencia clara" + "Simulación: gráfica completamente ilegible → null para los 7 campos visuales" |
| Devolver `null` si la curva es ilegible/ambigua | tests AC-2 (5 escenarios del simulador, incluido el caso ilegible total) |
| Etiquetar como criterio derivado de la gráfica (no texto del médico ni diagnóstico IA) | tests AC-3 (2): cadena `CRITERIOS DERIVADOS VISUALMENTE DE LAS GRÁFICAS` + afirmación explícita |
| Repetibilidad FVC/FEV1 sigue siendo responsabilidad del panel (umbral AMI ≤ 150 ml) | tests AC-4 (3): documentación en prompt + referencia a BR-20260824-01/150 ml + prohibición de multiplicar unidades |
| No inventar impresión diagnóstica/recomendaciones | tests AC-5 (3): marca como TEXTO FUENTE + prohibición `NUNCA inventes` |
| Aliases para el panel (`impresion_diagnostica_texto`/`recomendaciones_texto`) | tests AC-6 (4): ambos en skeleton + nombres históricos preservados + instrucción POBLAR AMBOS |

## Riesgos y desviaciones

- **Riesgo clínico (nulo):** no se cambian los datos extraídos en el caso
  canónico (FVC/FEV1 con M1/M2/M3 poblados), no se cambia la fórmula de
  repetibilidad, no se cambia el umbral AMI (150 ml sigue siendo
  BR-20260824-01), no se promueve texto del médico a diagnóstico IA. El
  cambio sólo afecta cómo el LLM interpreta las curvas para los 7 criterios
  visuales: ahora permite inferencia visual explícita (antes la regla v3 los
  pedía "transcritos" desde banderas Sí/No visibles en el reporte).
- **Riesgo de regresión en paneles (mitigado):** los 56 tests del panel
  siguen verdes sin cambios. El cambio del prompt no agrega claves nuevas
  en `calidad`; sólo ajusta las reglas de cuándo poblar las 7 visuales
  existentes.
- **Riesgo de regresión en otros estudios (nulo):** el script modifica
  únicamente el `MedicalTest` con `name === 'ESPIROMETRIA'`
  (case-insensitive); otros tipos de estudio (Audiometría, etc.) intactos.
- **Riesgo de privacidad (nulo):** el script no imprime ni loguea PII;
  sólo lee `MedicalTest.options` y persiste `extraction.prompt` +
  `extraction.version`.
- **Riesgo de contrato (nulo):** el cambio en aliases
  (`impresion_diagnostica_texto` + `impresion_diagnostica`) es aditivo — el
  panel lee cualquiera. No rompe consumidores existentes.
- **Encoding menor (cosmético):** la salida de consola del script muestra
  `�` en lugar de `∅` para la lista de claves en `normalization` cuando se
  ejecuta dentro de `railway run`. Es una diferencia de encoding del
  terminal remoto; la operación de persistencia usa el carácter Unicode
  correcto (`∅` = U+2205). No afecta a la BD.

## Requiere GEMINI

**No.** Es un cambio de prompt (reglas internas al LLM) sin modificación de
contrato público observable para el médico: el panel UI, el cálculo de
repetibilidad, los alias del payload y el esquema Prisma quedan idénticos.
La auditoría GEMINI del rev. 1.4 (FEATURE-20260824-01) sigue vigente.

## Requiere DEBY

**No.** No hay bug reproducible runtime fuera del scope BR-20260824-02.
Es un cambio de capa prompt, sin ciclo DEBY→SOFIA necesario.

## Pendientes ATLAS

1. **Verificación de gates focales:** PASS (typecheck 0 errores, vitest
   focal 28/28 + panel 56/56 sin regresión, vitest suite con 15 fallos
   pre-existentes idénticos al baseline).
2. **Verificación de despliegue Railway:** la versión remota
   `extraction.version` ya quedó actualizada a `espirometria-sibelmed-v4`
   (8206 chars). El backend NO requiere redeploy para que el nuevo prompt
   entre en vigor la próxima vez que el extractor corra; `aiCalibration`
   se lee directamente desde la BD en cada solicitud.
3. **V3 independiente (Playwright):** opcional — el cambio no afecta al UI;
   sólo cambia el comportamiento del LLM upstream. Si ATLAS decide validar
   el cambio con `context/RD2026/ESPIROMETRIA.pdf` (gráficas claras),
   debería ver que `calidad.pico_maximo`/`forma_triangular`/etc. ahora
   pueden poblarse con SI/NO desde la inferencia visual del LLM, en lugar
   de quedar `null` por falta de bandera textual.
4. **Sin autorización de Frank:** no se hace commit, push, PR ni deploy.
   El delta queda en el working tree, listo para revisión y posterior OK
   de Frank.

## Notas de reversión

- Cambios son código puro (1 archivo de prompt modificado, 1 test nuevo,
  1 línea de `vitest.config.ts`) + 1 fila modificada en la BD Railway
  (`medical_test.options.aiCalibration.extraction.{prompt,version}`).
- Revertir el commit (cuando Frank lo autorice) restaura el prompt v3 con
  `git checkout -- frontend/scripts/update-espirometria-extraction-prompt.ts
  frontend/vitest.config.ts && rm -rf frontend/scripts/__tests__/`, y
  reejecuta el script v3 contra Railway para restaurar
  `extraction.version = 'espirometria-sibelmed-v3'`. Cero cambios de
  schema, contratos, frontend UI ni backend.
- 100% reversible.

## Estado

**READY_FOR_VERIFYING.** WIP=0, sesión SOFIA cerrada. Entrega a ATLAS →
INTEGRA verifica → GEMINI confirma si requiere → ATLAS pide OK Frank.

---

## Resumen de comandos validados

```bash
# Frontend scripts typecheck
cd frontend && pnpm run typecheck:scripts
# → PASS 0 errores

# Frontend full typecheck
cd frontend && pnpm run typecheck
# → PASS 0 errores

# Vitest focal — nuevo test prompt v4 (28 tests, V1)
cd frontend && npx vitest run scripts/__tests__/update-espirometria-extraction-prompt.test.ts
# → PASS 28/28

# Vitest focal — panel espirometría (regresión)
cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts
# → PASS 56/56

# Vitest suite completa (regresión baseline)
cd frontend && npx vitest run
# → 15 failed (pre-existentes en medical-exam.actions.test.ts), 783 passed
#   (+28 nuevos PASS por tests prompt v4; 0 nuevos fallos)

# Ejecución contra Railway (producción) — bump v3 → v4
cd frontend && railway run --service Postgres bash -c 'DATABASE_URL="$DATABASE_PUBLIC_URL" npx tsx scripts/update-espirometria-extraction-prompt.ts'
# → versión previa: espirometria-sibelmed-v3 (5601 chars)
# → versión nueva:  espirometria-sibelmed-v4 (8206 chars)
# → ID: 273bb1ef-0973-4f92-b762-e6a54cd98852
# → top-level preservado: [enabled, diagnosis, extraction, canonicalStudyType]
# → extraction.* preservado: [model, prompt, version, provider, schemaVersion]
# → prediagnostico / normalization: ∅ (sin creación)
```
