# IMPL-REPORT — Fix L1 de F-1 (QA-20260820-05) sobre ARCH-20260820-01 Fase 4

- **ID intervención:** `IMPL-20260820-05`
- **ID tarea:** `ARCH-20260820-01` Fase 4 — `clinicalCriteria` reemplaza hardcodeos en backend
- **Origen:** F-1 (P2 Media) de `context/reviews/QA-20260820-05-ARCH-20260820-01-Fase4.md`
- **Tipo:** Fix L1 (corrección de cobertura de test, no toca producto ni contratos)
- **Estado:** `READY_FOR_VERIFYING`
- **SPEC activa:** `context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1 (§14 Fase 4, AC-4.3)
- **ADR:** `context/decisions/ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1
- **Handoff consumido:** `context/interconsultas/HANDOFF_ARCH-20260820-01_FASE4_SOFIA_CALIBRACION-FUENTE-UNICA.md` §6.3 (Transición de firma — autoriza shim deprecado en callers no migrables)
- **QA consumido:** `context/reviews/QA-20260820-05-ARCH-20260820-01-Fase4.md` §3 F-1, §4 (validaciones independientes), §9 (gate siguiente)

---

## 1. Alcance del fix

Único cambio autorizado: el test `test_AC_4_3b_medical_calibration_no_aparece_en_main_prediagnosis_callers` en `backend/tests/test_ai_pipeline.py`.

No se modificaron: `backend/app/main.py`, `backend/app/services/ai/prediagnostic.py`, `backend/app/schemas/medical.py`, `frontend/src/actions/event-test.actions.ts`, `context/SPECs/*`, `context/decisions/*`, `context/interconsultas/*`, `PROYECTO.md`. Verificado con `git status -s` + `git diff HEAD -- backend/app/main.py` (cambios en `main.py` son los de IMPL-20260820-04 ya en working tree, **anteriores** a esta intervención; este fix sólo añade hunks al test).

## 2. Diagnóstico (lo que el test afirmaba vs realidad)

El test original buscaba la sub-cadena `medical_calibration=` **en la misma línea** que abría la llamada a `prediagnostic_svc.generate_prediagnosis(`. En `main.py:1491-1497` la llamada es multi-línea:

```python
prediagnosis = prediagnostic_svc.generate_prediagnosis(   # línea 1491 — abre call
    study_type,
    extracted_data,
    calibration_version=calibration_version,
    ai_calibration=ai_calibration,
    medical_calibration=medical_calibration,  # DEPRECADO Fase 4   # línea 1496 — kwarg
)
```

El calificador `medical_calibration=` está en línea contigua (1496), no en la misma línea que abre el call (1491). El test pasaba por construcción aunque 1 de 3 callers (`v2_prediagnosis_from_params`) **sí** pasa `medical_calibration=` como kwarg al servicio.

## 3. Cambios aplicados

### 3.1 Archivo modificado

- `backend/tests/test_ai_pipeline.py` — `test_AC_4_3b_medical_calibration_no_aparece_en_main_prediagnosis_callers` (líneas 3012-3100).

### 3.2 Estrategia del fix (cumple condición real AC-4.3)

Reemplazo del grep single-line por análisis AST multi-línea (`ast.parse` + `ast.walk`) que:

1. Localiza **todas** las llamadas a `prediagnostic_svc.generate_prediagnosis(...)` en `main.py` (cualquier forma, multi-línea).
   - Filtra por `Call.func.attr == "generate_prediagnosis"` y `Call.func.value.id == "prediagnostic_svc"` (variable local).
2. Para cada call, captura la lista de kwargs y el bloque fuente `call.lineno..call.end_lineno`.
3. Si la llamada pasa `medical_calibration=` como kwarg:
   - Si el bloque contiene un marcador de shim autorizado por handoff §6.3 (`DEPRECADO`, `DEPRECATED`, `COMPAT`, `§6.3`, `Fase 4`, `shim`) → clasifica como `documented_shims` (permitido).
   - Si el bloque **no** contiene marcador → clasifica como `active_callers` (regresión).
4. `assert active_callers == []` — falla si algún caller pasa `medical_calibration=` sin documentar el shim.
5. NO se asume que `documented_shims` deba ser ≥1: si una iteración futura retira el último shim, el test seguirá pasando (condición "no existe uso activo en callers principales").

### 3.3 Marcadores de shim autorizados

Definidos como tupla `_SHIM_MARKERS = ("DEPRECADO", "DEPRECATED", "COMPAT", "§6.3", "Fase 4", "shim")`. Coinciden con el lenguaje del handoff Fase 4 §6.3 ("shim deprecado con warning") y con el comentario real observado en `main.py:1496` (`# DEPRECADO Fase 4`).

### 3.4 Comportamiento esperado

| Estado del código | Antes del fix | Después del fix |
|---|---|---|
| Línea 1496 con `# DEPRECADO Fase 4` (estado actual) | PASS (engañoso) | **PASS** (correcto) |
| Línea 1496 sin marcador (regresión) | PASS (falso negativo) | **FAIL** con mensaje accionable listando callers activos |
| Todos los callers migran (Fase 5+) y nadie pasa `medical_calibration=` | PASS | **PASS** (condición "no existe uso activo" se cumple) |

Verificación manual de detección de regresión ejecutada (no commiteada): eliminado temporalmente el marcador `# DEPRECADO Fase 4` en `main.py:1496`, test falla con mensaje correcto identificando el caller activo y sus 6 líneas fuente. Marcador restaurado antes de cerrar este reporte.

## 4. Validación

### 4.1 Comando y resultados

| Comando | Entorno | Exit | Resultado |
|---|---|---|---|
| `cd backend && python3 -m py_compile tests/test_ai_pipeline.py` | local (Python 3.14.4) | 0 | 0 errores de sintaxis |
| `cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestPrediagnosisFase4ARCH20260820_01::test_AC_4_3b_medical_calibration_no_aparece_en_main_prediagnosis_callers -v` | local | 0 | **1 passed** |
| `cd backend && python3 -m pytest tests/test_ai_pipeline.py::TestPrediagnosisFase4ARCH20260820_01 -v` | local | 0 | **10/10 passed** (suite Fase 4 completa) |
| `cd backend && python3 -m pytest tests/test_calibration_resolver.py -v` | local | 0 | **43/43 passed** (sin regresión Fase 1) |
| `cd backend && python3 -m pytest tests/test_ai_pipeline.py -v` (suite completa) | local | 0 | **83 passed / 31 failed** — idéntico al baseline QA-20260820-05 §4. Los 31 fallos son preexistentes `M3_CREDENTIALS_UNAVAILABLE` (no atribuibles al fix). |
| AST walk sobre `main.py` (script ad-hoc) | local | — | **3 callers** identificados correctamente (1310, 1491, 1753); 1 con `medical_calibration=` (1496), todos los demás sin el kwarg. |

### 4.2 Trazabilidad AC ↔ fix

| AC | Criterio original | Cómo lo cubre el test corregido |
|---|---|---|
| **AC-4.3** | `medical_calibration` retirado del flujo principal; `_build_calibration_context` removido | `test_AC_4_3` (stub retorna `""`) **+** `test_AC_4_3b` (AST multi-línea: ningún caller activo sin marcador de shim) **+** `main.py:1496` con `# DEPRECADO Fase 4` (shim documentado, autorizado por handoff §6.3) |

## 5. Riesgos y desviaciones

- **Cambios accidentales:** ninguno. `git diff HEAD -- backend/app/main.py` muestra únicamente los hunks previos de IMPL-20260820-04; este fix sólo añade hunks al test. Verificado.
- **Falsa robustez del test:** la tupla `_SHIM_MARKERS` es deliberadamente laxa (`DEPRECADO`/`COMPAT`/`shim` en cualquier casing). Un test más estricto podría exigir el marcador exacto `# DEPRECADO Fase 4` en la línea del kwarg, pero eso acoplaría el test a la versión de la SPEC. Se prefiere laxa.
- **Detección de regresión:** validada empíricamente eliminando el marcador `# DEPRECADO Fase 4` en `main.py:1496` (test falla con mensaje accionable) y restaurándolo (test pasa).
- **Otros hallazgos QA (F-2/F-3/F-4, todos P3):** fuera del alcance del fix L1 de F-1. F-2/F-3/F-4 permanecen como riesgos aceptados pendientes de decisión de INTEGRA/Frank.

## 6. Pendientes / gates

- **No se commiteó, no se pusheó, no se hizo PR.** Cambios en working tree únicamente (consistente con handoff §10 + AGENTS §11).
- **Pendiente INTEGRA:** re-ejecutar auditoría focal o aceptar fix con la suite actual.
- **Pendiente ATLAS:** confirmar a Frank si autoriza commit/push de Fase 4 (incluyendo este fix) tras cierre del gate QA.
- **CRONISTA:** no aplicar transición de estado global sin OK explícito de Frank (silencio ≠ aprobación).

## 7. Resumen ejecutivo

Fix L1 del único hallazgo P2 (F-1) de QA-20260820-05 aplicado. Cambio mínimo y reversible: 1 test, 0 archivos de producto, 0 contratos. Cobertura real del AC-4.3 ahora detecta regresiones (un caller `medical_calibration=` sin marcador `# DEPRECADO`/`COMPAT`/`Fase 4`/`§6.3`/`shim` falla el test). Estado: `READY_FOR_VERIFYING`.

## 8. Notas de reversión

Reversión trivial: `git checkout HEAD -- backend/tests/test_ai_pipeline.py` (sólo este archivo). El fix es aditivo sobre la lógica del test (no cambia `main.py`, ni `prediagnostic.py`, ni el schema público), por lo que revertir el test sólo restaura el grep single-line anterior (PASS engañoso para Fase 4 actual; mismo comportamiento previo a este fix).
