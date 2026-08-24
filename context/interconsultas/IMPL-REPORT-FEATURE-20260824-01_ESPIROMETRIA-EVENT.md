# IMPL-REPORT — FEATURE-20260824-01 (rev. 1.3 — IMPLEMENTATION_DEFECT)

- **ID intervención:** `IMPL-20260824-01` (rev. 1.3 — IMPLEMENTATION_DEFECT dentro de la misma SPEC y sesión)
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` rev. 1.2
- **Regla:** `BR-20260824-01` — umbral AMI de repetibilidad ≤150 ml
- **Estado:** `READY_FOR_VERIFYING`
- **Origen del delta:** usuario volvió a probar el Event tras commit `740229e`; el panel mostró `—` para FVC/FEV1/#Pruebas/Sí/No aunque la tabla clínica sí mostraba los valores porcentuales. Causa raíz: el panel buscaba filas exactas `key === "fvc_l"`/`"fev1_l"` y campos `m1`/`m2`/`m3`/`unidad`, pero el renderer/schema real (`extraction-presentation-schemas.ts`) usa aliases `m1_value`/`m2_value`/`m3_value`/`unit`/`ref_value`/`lln_value`, y el extractor puede entregar labels/claves no canónicas.

## Corrección

### rev. 1.2 (base)

La evidencia visual mostró que Events sólo presentaba notas de calidad. El panel ahora recibe `extractedData` completo y calcula desde `parametros[]`:

- Diferencia entre los dos valores FVC más altos, en ml.
- Diferencia entre los dos valores FEV1 más altos, en ml.
- Cumplimiento si la diferencia es **≤150 ml (0.15 L)**.
- Número de maniobras válidas disponibles.

Para `context/RD2026/ESPIROMETRIA.pdf` los resultados son:

- FVC: **30.00 ml**.
- FEV1: **40.00 ml**.
- Ambos cumplen el umbral AMI.
- Pruebas aceptables: **3**.

Los criterios cualitativos sólo se muestran cuando el payload los proporciona; no se infieren desde la tabla numérica.

### rev. 1.3 (IMPLEMENTATION_DEFECT — sin ampliar alcance)

Cierra los huecos que mostraban `—` cuando el payload real no usa la forma exacta del extractor:

1. **Resolución de filas FVC/FEV1 robusta** — `findRowByKey(parametros, canonicalKey, normalizedLabel)`:
   - (a) Intenta clave canónica `fvc_l`/`fev1_l` exacta (case-insensitive), **excluyendo** filas `Mejor FVC`/`Mejor FEV1` (por `label` que empieza con `mejor` o por `key` que empieza con `mejor_`). La fila canónica estándar es la fuente primaria para top-2 entre M1/M2/M3.
   - (b) Si no hay match por clave, fallback por `label` normalizado (`FVC`/`FEV1`), también excluyendo `Mejor X`.
   - (c) Último recurso (defensa): fila con clave canónica aunque sea `Mejor X` (caso raro en que el extractor sólo entregue la fila resumen).
2. **Aliases de maniobras** — `collectManeuverValues` lee cada maniobra desde `m1`/`m2`/`m3` (extractor) **y** `m1_value`/`m2_value`/`m3_value` (renderer/schema), con precedencia del alias corto (`m1`) si ambos están presentes (consistente con el resto del backend). Mezcla defensiva soportada.
3. **Aliases de unidad** — `readRowUnit` lee desde `unidad` (extractor) **o** `unit` (renderer/schema), case-insensitive. Acepta `L` y `l`.
4. **Top-2 y umbral AMI ≤150 ml** preservados idénticos al rev. 1.2 (BR-20260824-01).
5. **Extras extraídos siguen ganando sobre cálculo** — `calidad.repetibilidad_fvc_ml`/`fev1_ml` y `calidad.repetibilidad_<x>_menor_150` siguen teniendo precedencia (sin cambios).

No se cambian criterios cualitativos, no se cambian placeholders, no se cambian contratos públicos, no se cambia el flujo de extracción, no se cambia el `extraction-presentation-schemas.ts` (la columna `key`/`unit`/`m*_value` ya estaba como contrato del renderer — ahora el panel la consume además de la forma del extractor).

## Archivos

### Modificados

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx`
  - Tipo `EspirometriaParametrosRow` ampliado con `unit`, `m1_value`/`m2_value`/`m3_value`.
  - `findRowByKey` → 3 niveles (canónica sin Mejor → label sin Mejor → fallback con Mejor).
  - `isMejorRow(row)` helper (defensa por `label` o por `key` que empiecen con `mejor`/`mejor_`).
  - `collectManeuverValues` → pares `(m1, m1_value)`, `(m2, m2_value)`, `(m3, m3_value)` con precedencia del alias extractor.
  - `readRowUnit(row)` helper (`unidad` o `unit`, normalizado a lowercase + trim).
  - Llamadores en `resolveCriteria`: `findRowByKey(parametros, "fvc_l", "FVC")` y `findRowByKey(parametros, "fev1_l", "FEV1")`.
  - Comentarios de cabecera actualizados a rev. 1.3.
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` — 10 tests nuevos en suite "rev. 1.3 aliases renderer/schema".

### Sin cambios (protegidos)

- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — sigue cableando `extractedData` al panel (rev. 1.2 intacto).
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx` — sigue con las tres secciones `details open`.
- `frontend/src/components/clinical/extraction-presentation-schemas.ts` — **NO modificado**: el schema ya tenía las columnas `unit`/`m1_value`/etc.; el panel ahora las entiende además de las del extractor.
- Backend, Prisma, migraciones, calibración publicada — **NO modificados** (IMPLEMENTATION_DEFECT puro frontend).
- `extractedData`, `fuente_texto_crudo`, modo sombra clínica, revisión médica, renderer de Audiometría — **NO modificados**.

## Contratos

- **Cambian (delta soft, dentro del mismo SPEC):**
  - `EspirometriaParametrosRow` (tipo TS interno): aditivo — campos opcionales `unit`, `m1_value`/`m2_value`/`m3_value`. No es contrato público.
  - Comportamiento del panel:
    - Antes rev. 1.3: payload con `key` no canónica o con `m1_value`/`unit` → panel mostraba `—` aunque la tabla clínica mostrase los valores.
    - Después rev. 1.3: mismas formas + aliases → panel muestra FVC/FEV1/#Pruebas/Sí/No.
- **Protegidos (NO TOCADOS):**
  - `extracted_data` raíz del snapshot backend — sin cambios.
  - `calidad`/`parametros` del payload — sin cambios (el panel sólo los lee; no los modifica).
  - Endpoints V2, schema Prisma, migraciones — sin cambios.
  - Estudio Audiometría y otros tipos — comportamiento idéntico.
  - `extraction-presentation-schemas.ts` — sin cambios (la columna `key`/`unit`/`m*_value` ya estaba como contrato del renderer; el panel la entiende ahora además de la forma del extractor).

## Validación

| Gate | Comando | Resultado |
|---|---|---|
| Frontend typecheck focal | `cd frontend && npx tsc --noEmit` | **PASS** 0 errores |
| Frontend vitest focal nuevo | `cd frontend && npx vitest run src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS 45/45** (35 rev. 1.2 + 10 rev. 1.3) |
| Frontend vitest suite | `cd frontend && npx vitest run` | **0 regresiones nuevas**: 15 fallos preexistentes en `medical-exam.actions.test.ts` (idénticos a baseline rev. 1.2) |
| Frontend lint focal | `cd frontend && npx eslint src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts` | **PASS** 0 errores / 0 warnings |
| Frontend build | `cd frontend && npx next build` | **SUCCESS** (✓ Compiled successfully en 23.0s) |

## Trazabilidad AC (FEATURE-20260824-01 SPEC §7)

- **AC-1** (presencia del bloque): PASS — sigue vigente en rev. 1.3, validado con fixture completa (`extraction-espirometria-rd2026.json` + `EXTRACTED_ALIASED`).
- **AC-2** (FVC 30 ml, FEV1 40 ml): PASS — verificado en dos formas:
  - Forma del extractor (`m1`/`m2`/`m3`/`unidad`) — test "AC-2: muestra FVC 30.00 ml y FEV1 40.00 ml calculados desde parametros[] (PDF Sibelmed)".
  - Forma del renderer/schema (`m1_value`/`m2_value`/`m3_value`/`unit`) — test "Soporta m1_value/m2_value/m3_value con key canónica y unit (sin m1/m2/m3/unidad)".
- **AC-3** (3 pruebas aceptables y calidad A): PASS — verificado en ambas formas + alias-safe (extraído gana).
- **AC-4** (Justificación/Limitaciones/Fuentes clínicas abiertas): PASS — sigue vigente (sin cambios en `StudyAIPrediagnosisPanel.tsx`).
- **AC-5** (payload parcial sin inflar): PASS — los nuevos tests cubren tanto el alias-only (FVC+FEV1 sólo con `_value`/`unit`) como el extractor-only (FVC+FEV1 sólo con `m1`/`unidad`) y el parcial (sin FVC/FEV1) — todos sin `—` inventado para los cualitativos.
- **AC-6** (Audiometría intacta): PASS — sin cambios. `hasRenderableEspirometriaCriteria` con payload de Audio sigue retornando `false`.
- **AC-7** (typecheck/tests focales): PASS — ver tabla arriba.

## Trazabilidad FND rev. 1.3 (cierre IMPLEMENTATION_DEFECT)

- **FND-1.3.A** (resolución de filas no canónicas): `test "Fallback por label "FVC"/"FEV1" cuando key canónica está ausente (extractor entrega sólo label)"` — verifica fallback por label normalizado.
- **FND-1.3.B** (exclusión `Mejor X`): `test "Si coexisten filas "Mejor FVC"/"FVC", la fila estándar gana para el cálculo"` — verifica que la fila estándar gana y la "Mejor X" no infla ni falsea el diff.
- **FND-1.3.C** (defensa "Mejor X" sin estándar): `test "FVC/FEV1 no se prefieren cuando la única fila es "Mejor FVC" / "Mejor FEV1""` — verifica fallback defensivo (paso 3) con `Mejor X` aislado; el panel NO queda huérfano.
- **FND-1.3.D** (aliases renderer/schema): `test "Soporta m1_value/m2_value/m3_value con key canónica y unit (sin m1/m2/m3/unidad)"` — verifica el shape real de `extraction-presentation-schemas.ts` y que FVC 30.00, FEV1 40.00, Sí/Sí, 3 se muestran sin `—`.
- **FND-1.3.E** (mezcla de aliases): `test "Soporta mezcla de aliases (m1/m2/m3 + m1_value/m2_value/m3_value) en la misma fila"` — verifica precedencia de alias extractor con fallback a `_value`.
- **FND-1.3.F** (unidad `L`/`l`): tests `test "Acepta unit="l" (minúscula) como L para conversión a ml"` y `test "Acepta unit="L" (mayúscula) como L para conversión a ml"`.
- **FND-1.3.G** (no "—" para FVC/FEV1/#Pruebas con aliases): `test "El panel NO muestra "—" para FVC/FEV1/#Pruebas cuando el payload usa aliases renderer/schema"` — verifica el síntoma reportado por Frank.

## Riesgos y desviaciones

- **Riesgo clínico (nulo):** no se cambian los datos extraídos, no se cambia la fórmula de repetibilidad, no se cambia el umbral AMI (150 ml sigue siendo BR-20260824-01), no se promueve `impresion_diagnostica_texto`/`recomendaciones_texto` a salida IA. Sólo se amplía la lectura del payload.
- **Riesgo de falso positivo en cálculo (mitigado):** `Mejor FVC`/`Mejor FEV1` se excluyen explícitamente del cálculo (su `m1=m2=m3` por definición colapsa el diff a 0). Esto preserva la integridad del cálculo sin impedir la presentación de esas filas en la tabla clínica.
- **Riesgo de regresión (bajo):** los 35 tests previos de rev. 1.2 siguen verdes sin cambios; los 10 nuevos sólo añaden cobertura de aliases. No hay tests que dependan de que el panel devuelva `null` cuando el payload trae `_value`/`unit`.
- **Riesgo de contrato (nulo):** el `extraction-presentation-schemas.ts` ya tenía las columnas `unit`/`m1_value`/etc. — el panel ahora también las entiende, sin modificar el renderer.
- **Cobertura de privacidad:** sin cambios. El panel sigue siendo presentación pura sobre `extractedData`; no introduce logging de PII ni `dangerouslySetInnerHTML`.

## Requiere GEMINI

**No.** Es un cambio de comportamiento interno del panel (resolución de filas + lectura de aliases) sin cambio de contrato público observable para el médico. La interfaz visible y el cálculo son idénticos para el caso canónico del extractor (rev. 1.2); el cambio sólo cubre el caso adicional del renderer/schema shape. La auditoría GEMINI del rev. 1.2 sigue vigente para la corrección del bug original.

## Requiere DEBY

**No.** No hay bug reproducible fuera del scope FEATURE-20260824-01. El diagnóstico de Frank apuntaba al renderer/schema y al extractor no canónico — ambos atendidos por el delta.

## Pendientes ATLAS

1. **Verificación de gates completos:** INTEGRA reejecuta pytest completo + vitest completo + build (focal ya verde; falta auditoría independiente si se requiere).
2. **E2E manual** con `context/RD2026/ESPIROMETRIA.pdf` cargado en un estudio `Espirometria` (V3 published o `draft`) en entorno dev/staging — precondición `DATABASE_URL` accesible. Verifica que el panel muestra FVC 30.00 ml, FEV1 40.00 ml, Sí/Sí, 3 (sin `—` para esos campos) y que el resto del layout (orden §4, secciones IA abiertas, texto fuente) sigue idéntico a rev. 1.2.
3. **No requiere OK Frank para commit/push** dentro de esta sesión — sin autorización explícita no se commitea, pushea, despliega.

## Notas de reversión

- Cambios son código puro (2 archivos modificados); sin migración ni cambio de schema ni de contrato público.
- Revertir el commit del fix (si Frank lo autoriza) restaura el comportamiento rev. 1.2: filas `key === "fvc_l"`/`"fev1_l"` exactas con `m1`/`m2`/`m3`/`unidad` siguen funcionando; filas con aliases `_value`/`unit` vuelven a mostrar `—`.
- 100% reversible.

## Estado

**READY_FOR_VERIFYING.** WIP=0, sesión SOFIA cerrada. Entrega a ATLAS → INTEGRA verifica → GEMINI confirma si requiere → ATLAS pide OK Frank.

---

# IMPL-REPORT — mini-corte (operación exacta visible)

- **ID intervención:** `IMPL-20260824-01` (mini-corte presentacional sobre rev. 1.3, mismo incremento)
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-01-ESPIROMETRIA-EVENT-CRITERIOS.md` rev. 1.2 (sin cambio de SPEC; sólo presentación de auditoría en UI)
- **Estado:** `READY_FOR_VERIFYING`

## Cambio

Debajo de cada celda numérica (`Repetibilidad FVC` / `Repetibilidad FEV1`) se renderiza una línea pequeña con la operación exacta usada por el helper:

```
FVC: (2.33 − 2.30) × 1000 = 30.00 ml
FEV1: (2.15 − 2.11) × 1000 = 40.00 ml
```

- Sin cambio de fórmula ni de umbral (sigue siendo BR-20260824-01 ≤ 150 ml).
- El helper ya calculado (`computeRepetibilidadFromRow`) ahora también devuelve `topTwoNative: [number, number] | null` con los 2 valores más altos en la unidad nativa.
- Si la fila no existe, la unidad no es `'l'`, o hay <2 maniobras válidas → `topTwoNative = null` → la línea muestra `—` sin inventar.
- Atributos `data-testid` añadidos para E2E Playwright: `repetibilidad-fvc-operacion`, `repetibilidad-fev1-operacion`.

## Archivos modificados

- `frontend/src/components/clinical/EspirometriaClinicalCriteriaPanel.tsx`:
  - `RepetibilidadCalc`: añadido `topTwoNative: [number, number] | null`.
  - `computeRepetibilidadFromRow`: devuelve también los 2 valores más altos cuando la unidad es `'l'`.
  - `ResolvedCriteria`: añadido `fvcTopTwoNative` / `fev1TopTwoNative`.
  - Nuevo sub-componente `RepetibilidadOperationLine` que formatea la operación con unicode `−` (U+2212) y `×` (U+00D7).
  - JSX del bloque "Repetibilidad numérica": inserta `RepetibilidadOperationLine` debajo de cada `NumberCell` FVC/FEV1.
- `frontend/src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts`: nuevas aserciones (4 casos):
  1. Operación visible exacta con payload Sibelmed: `FVC: (2.33 − 2.30) × 1000 = 30.00 ml` y `FEV1: (2.15 − 2.11) × 1000 = 40.00 ml`.
  2. Sin `parametros[]` (sólo extraído en `calidad`) → líneas presentes con `—`.
  3. Una sola maniobra → bloque de repetibilidad no se renderiza → líneas de operación ausentes.
  4. Unidad ≠ `'l'` (ej. `l/s`) → `topTwoNative = null` → no se mezcla unidad.

## Validación

- **typecheck:** PASS — `npx tsc --noEmit`.
- **tests focales (V1):** PASS — 52/52 (49 panel + 3 IA).
- Sin cambio de contratos ni de snapshot. Sin commit/push.

## Estado

**READY_FOR_VERIFYING.** Sin pendientes para ATLAS distintos del gate V3 Playwright ya documentado en rev. 1.3.
