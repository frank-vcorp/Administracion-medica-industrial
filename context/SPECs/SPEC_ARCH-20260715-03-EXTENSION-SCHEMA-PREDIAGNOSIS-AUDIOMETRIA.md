# SPEC ARCH-20260715-03 — Extensión Schema Pydantic para Campos Derivados de Audiometría

## Contexto

La SPEC ARCH-20260715-02 sincronizó el prompt clínico de Audiometría con `predx-audiometria-v2-derivado`, el cual genera 3 bloques derivados en el JSON de output:

1. `resumen_por_oido` — PTA, status, severity, pattern y basis por oído
2. `resumen_bilateral` — status global, lateralidad, simetría, nota
3. `clasificacion_hipoacusia` — clasificación por oído y bilateral con confianza

**Problema detectado:** Estos campos NO están declarados en `AIPrediagnosisResult` (schema Pydantic en `backend/app/schemas/medical.py`). Pydantic V2 los ignora silenciosamente (`extra='ignore'` por defecto), por lo que MedGemma los genera pero **la UI no los recibe**.

## Objetivo

Extender el schema `AIPrediagnosisResult` para que los 3 campos derivados de Audiometría fluyan desde el backend al frontend, permitiendo que la papeleta los renderice.

## Alcance

### ✅ INCLUYE

1. Agregar 3 campos opcionales a `AIPrediagnosisResult`:
   - `resumen_por_oido: Optional[Dict[str, Any]] = None`
   - `resumen_bilateral: Optional[Dict[str, Any]] = None`
   - `clasificacion_hipoacusia: Optional[Dict[str, Any]] = None`

2. Validar que los tests existentes sigan pasando

3. Documentar en checkpoint

### ❌ NO INCLUYE

- Modificar el renderer frontend (se hará en SPEC posterior si es necesario)
- Cambiar la lógica de `generate_prediagnosis()`
- Modificar otros schemas Pydantic
- Agregar validación estricta de estructura interna de los dicts (son flexibles)

## Especificación Técnica

### Archivo: `backend/app/schemas/medical.py`

**Cambio:** Agregar 3 campos opcionales a la clase `AIPrediagnosisResult`.

**Ubicación:** Después del campo `recommendation` (o al final de los campos existentes).

**Código a agregar:**

```python
# ARCH-20260715-03: Campos derivados de Audiometría (predx-audiometria-v2-derivado)
# Opcionales porque solo aplican a Audiometría; otros estudios no los generan.
resumen_por_oido: Optional[Dict[str, Any]] = None
resumen_bilateral: Optional[Dict[str, Any]] = None
clasificacion_hipoacusia: Optional[Dict[str, Any]] = None
```

**Nota:** Se usa `Dict[str, Any]` en lugar de modelos Pydantic anidados porque:
1. La estructura interna puede variar entre estudios
2. No queremos sobre-especificar en V1
3. El frontend los consumirá como JSON genérico
4. Mantiene compatibilidad con otros estudios que no generan estos campos

### Ejemplo de Estructura Esperada

```python
{
  "resumen_por_oido": {
    "oido_derecho": {
      "pta": 13,
      "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES",
      "severity": "NORMAL",
      "pattern": "SIN_PATRON_PATOLOGICO_CLARO",
      "basis": ["250=15", "500=20", "1000=10", "2000=10"]
    },
    "oido_izquierdo": { ... }
  },
  "resumen_bilateral": {
    "status": "AUDICION_BILATERAL_DENTRO_DE_LIMITES_NORMALES",
    "laterality": "BILATERAL",
    "symmetry": "SIN_ASIMETRIA_CLINICAMENTE_RELEVANTE",
    "note": "..."
  },
  "clasificacion_hipoacusia": {
    "right": "NO_APLICA",
    "left": "NO_APLICA",
    "bilateral": "NO_APLICA",
    "confidence": 0.78
  }
}
```

## Criterios de Aceptación

1. ✅ Los 3 campos están declarados en `AIPrediagnosisResult` como `Optional[Dict[str, Any]] = None`
2. ✅ Los tests existentes siguen pasando (61/61)
3. ✅ mypy no reporta errores
4. ✅ Los campos son opcionales — otros estudios no se ven afectados
5. ✅ Checkpoint documentado

## Validaciones Obligatorias

```bash
# 1. Sintaxis Python
python -m py_compile backend/app/schemas/medical.py

# 2. mypy
python -m mypy backend/app/schemas/medical.py

# 3. Tests de pipeline IA
cd backend && python -m pytest tests/test_ai_pipeline.py -v

# 4. Tests completos (si existen)
cd backend && python -m pytest tests/ -v
```

## Notas para Sofia

- **NO modifiques** la lógica de `generate_prediagnosis()` ni otros métodos
- **NO toques** otros schemas Pydantic
- **Solo agrega** los 3 campos opcionales a `AIPrediagnosisResult`
- **Usa** `Optional[Dict[str, Any]] = None` para mantener compatibilidad
- **Importa** `Any` desde `typing` si no está ya importado

## Archivos Afectados

1. `backend/app/schemas/medical.py` — agregar 3 campos opcionales a `AIPrediagnosisResult`

## Archivos NO Afectados

- `backend/app/services/ai/prediagnostic.py` — no se modifica
- `backend/app/services/ai/extractor.py` — no se modifica
- Frontend — no se modifica en esta SPEC (se hará en SPEC posterior si es necesario)

## Metadata

- **ID:** ARCH-20260715-03
- **Fecha:** 2026-07-15
- **Autor:** INTEGRA (Arquitecto de Soluciones)
- **Implementa:** SOFIA (Constructora Principal)
- **Prioridad:** Alta
- **Estimación:** 30 minutos
- **Dependencia:** ARCH-20260715-02 (ya completada)
