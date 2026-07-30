# Checkpoint IMPL-20260715-03 — Extensión Schema AIPrediagnosisResult (Audiometría)

**ID tarea:** IMPL-20260715-03
**SPEC:** `context/SPECs/SPEC_ARCH-20260715-03-EXTENSION-SCHEMA-PREDIAGNOSIS-AUDIOMETRIA.md`
**Implementa:** SOFIA (Constructora Principal)
**Fecha:** 2026-07-15
**Estado:** ✅ Soft Gates 1, 2, 3, 4 validados — pendiente 2ª mano (GEMINI) y OK humano

---

## Resumen

Se extendió `AIPrediagnosisResult` en `backend/app/schemas/medical.py` con 3 campos opcionales
(`resumen_por_oido`, `resumen_bilateral`, `clasificacion_hipoacusia`) tipados como `Optional[Dict[str, Any]] = None`.

El cambio es estrictamente aditivo y forward-compatible: ningún campo existente fue renombrado,
eliminado ni modificado. Los estudios que no son Audiometría no se ven afectados porque los 3 campos
son `Optional` y default `None`.

## Archivos Modificados

| Archivo | Líneas | Cambio |
|---------|--------|--------|
| `backend/app/schemas/medical.py` | ~526-540 (insert) | 3 campos opcionales nuevos en `AIPrediagnosisResult` |

**Solo 1 archivo tocado.** Ningún otro schema (`AudiometriaData`, `EspirometriaData`,
`CampimetriaData`, etc.) fue modificado, en cumplimiento del Alcance de la SPEC.

## Diff de Referencia

```python
# ARCH-20260715-03: Campos derivados de Audiometría (predx-audiometria-v2-derivado).
# Opcionales porque solo aplican a Audiometría; otros estudios no los generan.
# Se usa Dict[str, Any] y no modelos anidados para no sobre-especificar en V1
# y mantener compatibilidad con estudios donde estos bloques no existen.
resumen_por_oido: Optional[Dict[str, Any]] = Field(
    default=None,
    description="Audiometría: PTA, status, severity, pattern y basis por oído (OD/OI)."
)
resumen_bilateral: Optional[Dict[str, Any]] = Field(
    default=None,
    description="Audiometría: status global, lateralidad, simetría y nota clínica bilateral."
)
clasificacion_hipoacusia: Optional[Dict[str, Any]] = Field(
    default=None,
    description="Audiometría: clasificación de hipoacusia por oído y bilateral con confianza."
)
```

## Validaciones Ejecutadas

| Validación | Comando | Resultado |
|------------|---------|-----------|
| Sintaxis | `python3 -m py_compile backend/app/schemas/medical.py` | `PY_COMPILE_OK` |
| Typecheck | `python3 -m mypy backend/app/schemas/medical.py` | `Success: no issues found in 1 source file` |
| Tests IA pipeline | `pytest tests/test_ai_pipeline.py -v` | **61/61 PASSED** |
| Suite completa | `pytest tests/ -v` (excluyendo `test_pdf_ebook_writer.py` por dependencia `matplotlib` no instalada en el entorno) | **231/236 PASSED** (5 fallos preexistentes, todos `ModuleNotFoundError: No module named 'matplotlib'`) |

### Detalle de fallos preexistentes (NO son regresión)

```
tests/test_pdf_services.py::TestReportService::test_generate_json_report_empty_data   -> matplotlib
tests/test_pdf_services.py::TestReportService::test_batch_process_success             -> matplotlib
tests/test_reports.py::test_generar_reporte_masivo_both                              -> matplotlib
tests/test_reports.py::test_generar_reporte_masivo_ebook                              -> matplotlib
tests/test_reports.py::test_generar_reporte_masivo_legacy_pdf                         -> matplotlib
```

Verificado: las 5 fallas se originan en `import matplotlib` dentro de `app/services/reports/pdf_ebook_writer.py:80`,
**anterior al cambio** y ajeno a `medical.py`. No bloquean esta tarea; se recomienda instalarlas via `pip install -r backend/requirements.txt`
cuando se necesite trabajar el flujo PDF Ebook (IMPL-20260701-01).

## Smoke Test Funcional (ad-hoc)

```python
from app.schemas.medical import AIPrediagnosisResult
import json

# Compatibilidad: estudios no-Audiometría
r1 = AIPrediagnosisResult(summary="x", confidence=0.5)
assert r1.resumen_por_oido is None
assert r1.resumen_bilateral is None
assert r1.clasificacion_hipoacusia is None
# OK 1: compatibilidad — campos None por defecto

# Audiometría con bloques derivados
r2 = AIPrediagnosisResult(
    summary="Audiometría normal bilateral",
    confidence=0.85,
    resumen_por_oido={...}, resumen_bilateral={...}, clasificacion_hipoacusia={...},
)
# OK 2: campos Audiometría se aceptan como Dict[str, Any]
# JSON serializable: True
```

## Self-Review Manual (Gate 2 y 3)

| # | Criterio | Resultado |
|---|----------|-----------|
| 1 | ¿Los 3 campos están declarados correctamente como `Optional[Dict[str, Any]] = None`? | ✅ Sí, todos usan `Field(default=None, description=...)`. |
| 2 | ¿Los tests existentes siguen pasando? | ✅ 61/61 en `test_ai_pipeline.py`. 231/236 en la suite completa; los 5 fallos son `ModuleNotFoundError: matplotlib` (preexistentes). |
| 3 | ¿mypy no reporta errores? | ✅ `Success: no issues found in 1 source file`. |
| 4 | ¿Los campos son opcionales — otros estudios no se ven afectados? | ✅ Default `None`. Sin Audiometría, los 3 campos quedan `null` en JSON sin afectar el resto del schema. |
| 5 | ¿Hay riesgo de romper la serialización JSON? | ✅ No. `Dict[str, Any]` es serializable trivialmente; smoke test confirma `model_dump()` y `json.dumps()` funcionan. |

### Code smells / consideraciones

- Decisión `Dict[str, Any]` vs modelo Pydantic anidado: justificada en §"Especificación Técnica" de la SPEC
  (estructura variable, no sobre-especificar en V1, flexibilidad para el frontend).
- Posición de los campos: insertados tras `non_conclusive_reason` y antes del bloque de trazabilidad
  (`calibration_source`, `clinical_provider`, etc.). Mantiene cohesión temática (resultado clínico interpretativo)
  y evita fragmentar el bloque de trazabilidad.
- No se importó nada nuevo: `Any`, `Dict`, `Optional` ya estaban en línea 10.

## Riesgos y Desviaciones

**Riesgos identificados:** Ninguno en el scope del schema.

**Desviaciones vs SPEC:** Ninguna. La SPEC proponía `= None` sin `Field`; SOFIA agregó `Field(default=None, description=...)`
para mantener consistencia con el resto de la clase (`recommendation`, `non_conclusive_reason`,
`calibration_source` y demás campos opcionales usan `Field` con descripción). Esto no altera el contrato
ni la compatibilidad — es solo un enriquecimiento descriptivo que mejora la auto-documentación.

## PR / Commit

- **Commit ID sugerido:** `IMPL-20260715-03`
- **Mensaje de commit (ES):**
  ```
  feat(schemas): agrega campos derivados de audiometría al prediagnóstico IA
  ```
- **Cuerpo sugerido:**
  ```
  - Extiende AIPrediagnosisResult con resumen_por_oido, resumen_bilateral
    y clasificacion_hipoacusia (tipados Optional[Dict[str, Any]] = None).
  - Sin backwards-compatibility break: campos son opcionales.
  - Implementa SPEC ARCH-20260715-03 sobre prompt predx-audiometria-v2-derivado.
  - ID: IMPL-20260715-03
  ```

## Próximo Paso Recomendado a INTEGRA

1. Invocar a **GEMINI** (`subagent_type='gemini'`) como 2ª mano de validación (reemplazo de Qodo, sunset).
2. Tras OK de GEMINI y del humano, commitear con el mensaje sugerido arriba.
3. SPEC posterior debería ocuparse del renderer frontend para los 3 bloques (papeleta Audiometría).
