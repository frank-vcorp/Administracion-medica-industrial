# HANDOFF FIX-20260821-01 → SOFIA — Gate table-aware Espirometría + backfill determinista desde `parametros[]`

```
SPEC-HANDOFF
Origen: INTEGRA
ID tarea: FIX-20260821-01
SPEC activa: context/SPECs/SPEC_FIX-20260821-01-GATE-TABLEAWARE-ESPIROMETRIA.md v1.0 (READY)
ADR: (no se requiere ADR nuevo — cambio de contrato soft dentro de arquitectura existente; Fase 4 ARCH-20260820-01 ya cubrió el dominio "clinicalCriteria reemplaza hardcodeos backend"; este fix es una extensión interna que respeta ese contrato y prepara el camino a `requiredParams` V3 sin segundo ciclo)
Referencias funcionales:
  - FND-20260821-03 (E2E real Playwright expediente 8af728bf-f572-47c3-94b7-31aa9916a4b8)
  - DICTAMEN_FIX-20260821-01-E2E-MINIMAX-ESPIRO.md (DEBY, L2, causa raíz H3 CONFIRMADA, 5/5 hipótesis evaluadas)
  - ARCH-20260516-12 (extracción exhaustiva 6 bloques)
  - FIX-20260812-20 (guardrails backend extracción espirometría)
  - ARCH-20260820-01 Fases 3/4 (resolver V3 + clinicalCriteria; QUERY: por qué el gate no consulta `parametros[]`)
  - SPEC_ARCH-20260326-16 (separación extractiva/interpretativa)
Resultado: Pipeline V2 Espirometría deja de emitir AI_NON_CONCLUSIVE por "Parámetros mínimos faltantes: fev1, fvc" cuando `extracted_data.parametros[]` contiene filas FEV1/FVC; valor clínico enviado a DR7 = mejor maniobra (precedencia explícita). Otros tipos sin cambio. Label UI sin afirmar Gemini.
```

---

## Alcance de archivos/módulos

### Backend (Python — FastAPI)

| Archivo | Líneas | Cambio |
|---|---|---|
| `backend/app/services/ai/extractor.py` | `_normalize_espirometria_result` en `extractor.py:346-454` | Backfill determinista §4.1 + variantes sin sufijo §4.3 + mapeo `paciente`/`fecha_estudio` §4.4 |
| `backend/app/services/ai/extractor.py` | `_ESPIROMETRIA_CANONICAL_KEYS` en `extractor.py:150-155` | Ampliar frozenset con buckets equivalentes (o introducir normalización previa al lookup) |
| `backend/app/services/ai/extractor.py` | wrapper previo a `EspirometriaData(**result)` en `extractor.py:865-906` | Mapeo defensivo `paciente`/`fecha_estudio` desde sub-bloques |
| `backend/app/services/ai/prediagnostic.py` | `_check_minimum_params` en `prediagnostic.py:590-621` | Gate table-aware Espirometría: consultar `parametros[]` por key/label normalizado antes de declarar missing. Resto de tipos: comportamiento actual sin cambios |
| `backend/app/services/ai/prediagnostic.py` | constante `REQUIRED_PARAMS` en `prediagnostic.py:172-181` | **NO TOCAR** — el gate no se relaja, sólo cambia dónde busca |

### Backend (tests)

| Archivo | Cambio |
|---|---|
| `backend/tests/test_ai_pipeline.py` (o nuevo `test_fix_20260821_01_gate_tableaware.py`) | Nuevos tests AC-1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 4.1, 4.2, 5.1 |

### Frontend (TypeScript — Next.js)

| Archivo | Cambio |
|---|---|
| `frontend/src/components/.../PapeletaWorkspace.tsx` línea ~164 (`AI_PIPELINE_STAGES`) | Label deriva de `extraction_snapshot.audit.extraction_provider_used` o usa texto neutro. NO afirmar "Gemini" cuando el provider real es `m3` |

### Frontend (tests)

| Archivo | Cambio |
|---|---|
| Componente test de `PapeletaWorkspace` | AC-7.1: label no contiene "Gemini" cuando `extraction_provider_used == "m3"` |

### NO TOCAR (contratos protegidos)

- `backend/app/services/ai/prediagnostic.py` constante `REQUIRED_PARAMS` (`prediagnostic.py:172-181`)
- `backend/app/schemas/medical.py` `EspirometriaData` (`schemas/medical.py:205-212`)
- Endpoints V2: `/api/v2/studies/upload-and-analyze`, `/api/v2/ai/status`
- Schema Prisma y migraciones
- `frontend/src/actions/ai-prediagnosis.actions.ts:167-180` (no reenviar `medical_test_id`)
- `frontend/src/actions/calibration-v3.actions.ts:746-820` (gate `enabled` V3)
- `aiCalibration.extraction.enabled` flag (V1/V2 legacy)
- `context/datos AMI/**` (read-only)
- `ExtractionSnapshot 8fad6571-ccc1-4d12-9569-49b23037bd33` (inmutable, snapshot de producción del hallazgo)

---

## Contratos que cambian

1. `extracted_data` raíz de Espirometría: aditivo — nuevos campos `fev1`, `fvc`, `fev1_fvc_ratio`, `fev1_pct_ref`, `fvc_pct_ref` cuando se hace backfill desde `parametros[]`. Si ya existían, no se sobreescriben.
2. `extracted_data.es_interpretable` y `.completitud_documental` de Espirometría: corrección de falso negativo cuando hay FEV1/FVC en tabla.
3. `prediagnosis_snapshot.non_conclusive_reason` ya no emite `"Parámetros mínimos faltantes: fev1, fvc"` cuando las filas existen en tabla (sin cambiar el reason cuando sí faltan).
4. `AI_PIPELINE_STAGES` label: deriva de provider real o usa texto neutro.

## Contratos protegidos

Ver §"NO TOCAR" arriba. Resumen: ningún contrato público cambia de firma; ningún endpoint se altera; el schema Prisma queda intacto; el comportamiento de Audiometría/Laboratorio/Rayos_X/ECG/Somatometría/AgudezaVisual es idéntico.

---

## Criterios AC (verificables — todos testeables por construcción)

Ver SPEC §7. Resumen:

- **AC-1.1..1.3**: gate table-aware Espirometría (positivo Mejor fila, positivo estándar, negativa sin filas).
- **AC-2.1..2.5**: normalizador backfill (estándar sin sufijo, con sufijo, Mejor prioridad, calidad con keys bare, `paciente`/`fecha_estudio` desde sub-bloques).
- **AC-3.1**: determinismo bit-a-bit.
- **AC-4.1..4.2**: control regresión Audiometría + otros tipos.
- **AC-5.1**: selector de provider (`m3`) preservado.
- **AC-6.1**: E2E con `context/RD2026/ESPIROMETRIA.pdf` (mismo hash `sha256:6a94384d…de541` que el hallazgo).
- **AC-7.1**: label UI no afirma Gemini cuando provider es m3.

Comandos de validación:

```bash
# Backend unitarias (ejemplo)
pytest -q backend/tests/test_ai_pipeline.py::test_check_minimum_params_espirometry_tableaware_basic
pytest -q backend/tests/test_ai_pipeline.py::test_normalize_espirometry_backfill_mejor_priority
pytest -q backend/tests/test_ai_pipeline.py::test_check_minimum_params_audiometria_unchanged

# Suite completa
pytest -q backend/tests/

# Frontend
npm run typecheck
npx vitest run frontend/src/components/.../PapeletaWorkspace.test.tsx
npm run lint

# E2E (precondición: MEDGEMMA_ENABLED=true y DR7 accesible)
npm run test:e2e -- espirometry-gate-fix
```

---

## Casos borde (resumen)

Ver SPEC §6. Críticos:

- E1: Mejor FEV1 sin Mejor FVC → backfill mixto, gate pasa.
- E3/E4: filas vacías o ausentes → gate cae a AI_NON_CONCLUSIVE con mismo reason.
- E5: typo en key (`fevi1`) → backfill ignora, gate cae.
- E7: variantes nuevas (`mejorfev1` sin `_`) → normalización lower+strip.
- E8/E9: Audiometría/Laboratorio sin cambios.

---

## Validaciones detectadas

- `pytest` (backend, suite completa sin regresión)
- `npm run typecheck`, `npx vitest run`, `npm run lint` (frontend)
- `npx playwright test` o `npm run test:e2e` (E2E con DR7 mockeado o real)
- Hash de fixture preservado: `sha256:6a94384df2fe66b8a187a5009bc47ad92d87f4f93d8942e1b181de12325de541`
- Inspección visual del label UI (snapshot Playwright)

---

## Restricciones (límites innegociables)

1. **No publicar V3** de Espirometría. Permanece `draft`.
2. **No aplicar migración Prisma**. Cambios son código puro.
3. **No resolver el 422 de Examen Médico** (GEN-015) — fuera de alcance, queda para ATLAS.
4. **No reenviar `medical_test_id`** en `triggerStudyAIAnalysis`. Si Frank activa el resolver, el flag `enabled=false` bloquearía la IA.
5. **No cambiar `enabled` legacy** salvo que sea estrictamente necesario. Default: no tocar.
6. **No introducir fallback a Gemini**. Provider extractivo `m3/MiniMax-M3` es vigente.
7. **No persistir PII ni secretos**. No tocar `context/datos AMI/**`.
8. **No commit/push/staging/prod** sin autorización explícita de Frank (regla §11 INTEGRA).
9. **No romper contratos públicos** (`EspirometriaData`, `AIPrediagnosisResult`, endpoints V2).
10. **No tocar** `REQUIRED_PARAMS`, `prediagnostic.py:172-181`, ni el resolver V3.

---

## Dependencias

- `cryptography`, `pytest`, `pydantic`, `fastapi`, `prisma` — ya en stack actual.
- `next`, `react`, `vitest`, `playwright` — ya en stack actual.
- `MEDGEMMA_ENABLED=true` y DR7 (MedGemma-27b-it) accesible — precondición para AC-6.1 E2E.
- Fixture `context/RD2026/ESPIROMETRIA.pdf` ya presente con hash verificado.

---

## DoD

- AC-1.1, 1.2, 1.3 PASS.
- AC-2.1, 2.2, 2.3, 2.4, 2.5 PASS.
- AC-3.1 PASS.
- AC-4.1, 4.2 PASS.
- AC-5.1 PASS.
- AC-6.1 PASS (E2E real con fixture del hallazgo).
- AC-7.1 PASS.
- Gates backend: pytest 0 fallos nuevos, typecheck 0.
- Gates frontend: typecheck 0, vitest 0 fallos nuevos, lint 0 nuevos.
- GEMINI PASS o PASS_WITH_WARNINGS (auditoría obligatoria post-implementación, §15 INTEGRA).
- `context/datos AMI/**` intacto.
- `PROYECTO.md` y `context/CURRENT.md` actualizados.

---

## Prohibido inferir (decisiones que requieren escalamiento, no asumir)

1. **Precedencia de filas**: la SPEC fija "Mejor fila → estándar → max(m1,m2,m3)". Si durante implementación SOFIA detecta un caso donde M1 fijo es médicamente más correcto, **detenerse y escalar a ATLAS** — no relajar ni cambiar la precedencia sin consulta.
2. **`enabled` legacy V1/V2**: si la implementación revela que el flag `enabled=false` bloquea el gate table-aware (p. ej. porque el resolver corre en algún punto del camino), **detenerse y escalar a ATLAS** — no tocar el flag.
3. **Publicación de V3**: no intentar publicar el draft `espirometria-v3-draft.json`. Permanece `draft`.
4. **Migración de snapshots inmutables**: no intentar regenerar `ExtractionSnapshot 8fad6571-…` ni `prediagnosis_snapshot` v1 del hallazgo sin autorización Frank.
5. **Reenvío de `medical_test_id`**: no implementarlo como parte de este fix, aunque descubra que arreglaría el caso. Es decisión de Frank.

---

## Handoff operativo

- **Dueño siguiente:** ATLAS (INTEGRA devuelve a ATLAS; ATLAS activa sesión independiente de SOFIA).
- **Estado recomendado:** `READY_FOR_SOFIA`.
- **ID de tarea (backend):** `IMPL-20260821-01-FIX-GATE-TABLEAWARE-ESPIRO` (SOFIA asigna al implementar).
- **Tiempo estimado:** 2-4 h (cambios acotados, multi-archivo pero lógica densa; tests 6-8 archivos nuevos).
- **GEMINI:** obligatorio tras implementación (cambio de contrato soft, §15 INTEGRA).
- **Reversibilidad:** 100% (código puro, sin migración; revertir commit restaura estado pre-fix).