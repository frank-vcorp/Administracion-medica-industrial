# FIX-20260812-20 — Espirometría no extrae datos numéricos (tabla FVC/FEV1/M1/M2/M3/REF/LLN)

- **ID:** FIX-20260812-20
- **Tipo:** Bug extractor (capa extractiva)
- **Severidad:** Alta — dato clínico crítico ausente en producción
- **Fecha:** 2026-08-12
- **Estado:** LISTO PARA COMMIT (Frank decide)
- **Modelo ejecutor:** glm-5.2 (alibaba-token-plan) — familia barata distinta, clase DEBY
- **Archivos afectados:** `backend/app/services/ai/extractor.py`, `backend/tests/test_ai_pipeline.py`

## 1. Síntoma reportado por Frank (producción)

PDF `context/RD2026/ESPIROMETRIA.pdf` (Reporte Sibelmed W20s de PEÑA PATRICIO
MARBELLA, 18-03-2025). El sistema:

- ✅ Reconoce el documento como Espirometría (no lo confunde con Audiometría).
- ✅ Extrae metadatos del paciente (nombre, sexo, edad, talla, peso, IMC, etc.).
- ❌ **NO extrae la tabla de parámetros FVC/FEV1/M1/M2/M3/REF/LLN** (dato clínico crítico).
- ❌ Prediagnóstico IA retorna "Parámetros mínimos faltantes: fev1, fvc" y marca
  "No concluyente — revisión obligatoria".

## 2. Causa raíz

El extractor estaba incompleto para Espirometría. Solo Audiometría tenía flujo
especializado con guardrails backend (`_AUDIOMETRIA_BACKEND_GUARDRAILS`,
`_build_audiometria_extraction_prompt`, `_normalize_audiometria_result`,
dispatch en `extract_by_type`). Espirometría **nunca recibió el mismo
tratamiento**: caía al `_build_extraction_prompt` genérico + schema
`EspirometriaData`, sin guía específica de qué estructura tabular retornar.

Los schemas Pydantic exhaustivos (`EspirometriaParamRow`,
`EspirometriaPacienteDetalle`, `EspirometriaEstudio`, `EspirometriaCondiciones`,
`EspirometriaCalidad`, `EspirometriaGraficas`) ya existían en
`backend/app/schemas/medical.py:107-255` pero el extractor **no los usaba** — el
LLM no recibía instrucción de poblar los 6 bloques canónicos ni la tabla
M1/M2/M3/REF/LLN.

**Gap de simetría con Audiometría (ARCH-20260518-17):** Audiometría resolvía el
mismo problema de "tabla numérica no extraída" inyectando guardrails backend que
fuerzan al LLM a respetar celdas y frecuencias canónicas. Espirometría necesitaba
el mismo patrón.

## 3. Cambios aplicados

### 3.1 `backend/app/services/ai/extractor.py` (+173 / -1 líneas)

**Parte A — Constantes guardrails (tras `_AUDIOMETRIA_BACKEND_GUARDRAILS`):**
- `_ESPIROMETRIA_CANONICAL_KEYS`: frozenset de claves canónicas a las que debe
  mapear el `key` de cada fila del cuadro FVC. Incluye variantes ortográficas
  válidas (`fef2575_l_s` / `fef25_75_l_s`) para no flagar falsos positivos.
- `_ESPIROMETRIA_BACKEND_GUARDRAILS`: string de guardrails inyectado antes del
  bloque de calibración. Fuerza al LLM a tratar la tabla INFORME DE FVC como
  fuente primaria, respetar celdas (null si vacía, sin desplazamiento), mapear a
  los 6 bloques canónicos y calcular `completitud_documental`.

**Parte B — `_build_espirometria_extraction_prompt(self, study_specific_prompt)`:**
Variante de `_build_extraction_prompt` que inyecta los guardrails backend entre la
base universal y el bloque de calibración. Espejo exacto del flujo de Audiometría.
**Respeta ARCH-20260518-03:** el `study_specific_prompt` sigue siendo el de
aiCalibration (los guardrails se inyectan *alrededor*, no lo reemplazan).

**Parte C — Despacho en `extract_by_type`:**
```python
if doc_type == "Audiometria":
    prompt = self._build_audiometria_extraction_prompt(prompt)
elif doc_type == "Espirometria":                       # ← nuevo
    prompt = self._build_espirometria_extraction_prompt(prompt)
else:
    prompt = self._build_extraction_prompt(prompt)
```
Y en la rama de parseo, antes de `EspirometriaData(**result)`:
```python
result = self._normalize_espirometria_result(result)
```

**Parte D — `_normalize_espirometria_result(self, result)`:**
Post-procesamiento backend (espejo de `_normalize_audiometria_result`):
1. Coerce valores numéricos de `parametros` a float; conserva label/unidad/key
   como str; omite entradas no-dict.
2. Deriva `completitud_documental` (raíz + bloque `calidad`) desde el conteo de
   parámetros principales con valores de maniobra (≥6 suficiente, 3-5 parcial,
   <3 no_concluyente) si quedó null.
3. Deriva `es_interpretable` (legacy raíz) si quedó null: True solo si hay filas
   `fev1_l` y `fvc_l` con al menos un valor de maniobra.
4. Anota filas con `key` no canónico en `notas_calidad` (raíz + bloque calidad)
   como `SOSPECHA_MAPEO`.

### 3.2 `backend/tests/test_ai_pipeline.py` (+2 tests)

En `TestEspirometriaExhaustiva_20260516_12_13`:

- `test_espirometria_usa_prompt_con_guardrails_backend_FIX_20260812_20`:
  verifica que `extract_by_type(..., "Espirometria")` construye el prompt con los
  guardrails de espirometría (`"GUARDRAILS ESPECÍFICOS PARA ESPIROMETRÍA"` +
  `"INFORME DE FVC"`), NO con los de Audiometría, y que el bloque de calibración
  aiCalibration sigue presente.
- `test_espirometria_json_exhaustivo_valida_schemas_y_normalizer_FIX_20260812_20`:
  un JSON con 11 filas de parámetros (escala real Sibelmed W20s) valida contra los
  schemas Pydantic tras el normalizador; verifica derivación de
  `completitud_documental`="suficiente", `es_interpretable`=True, conservación de
  fila no canónica y anotación `SOSPECHA_MAPEO`.

Ambos tests usan `extraction_provider_override="gemini"` para capturar el prompt
real vía mock de `call_gemini` sin depender del provider por defecto del entorno
(robustez frente a la fragilidad M3-sin-key documentada en §5).

## 4. Validaciones ejecutadas

| Validación | Resultado |
|---|---|
| `python3 -m py_compile backend/app/services/ai/extractor.py` | ✅ OK (sin errores de sintaxis) |
| Tests nuevos sobre extractor **original** (stash) | ❌ 2 failed (confirman que validan el fix) |
| Tests nuevos sobre extractor **fixeado** | ✅ 2 passed |
| Archivo completo con fix | 31 failed, 73 passed |
| Archivo completo baseline (stash, sin fix, con tests nuevos) | 33 failed, 71 passed |
| **Diferencia neta** | **−2 failures, +2 passes** (mis 2 tests; cero regresiones) |
| Extracción con PDF real `context/RD2026/ESPIROMETRIA.pdf` | ⏳ Pendiente — Frank valida en deploy |

**Nota sobre los 31 failures preexistentes:** todos son del entorno de test
local (provider por defecto = m3 vía AppConfig, sin `M3_API_KEY`, así que
`_call_with_dispatch` lanza `ExtractionAuthError` antes de llegar al mock de
`call_gemini`). Afectan a Audiometría y Espirometría por igual y **son
idénticos con y sin mi cambio**. No son causados por FIX-20260812-20.

**Limitación de PDF:** el modelo ejecutor (glm-5.2) no soporta lectura de PDF
como input. La estructura del PDF se tomó del enunciado de la tarea (tabla
INFORME DE FVC con columnas Parámetro/M1/M2/M3/REF/LLN) y de los schemas
Pydantic ya definidos. La validación end-to-end con el PDF real queda pendiente
de Frank en el deploy (donde M3 sí tiene key configurada).

## 5. Tests añadidos (resumen)

```
tests/test_ai_pipeline.py:
  + test_espirometria_usa_prompt_con_guardrails_backend_FIX_20260812_20
  + test_espirometria_json_exhaustivo_valida_schemas_y_normalizer_FIX_20260812_20
```

Los 4 tests previos de espirometría (743, 771, 1060, 1164) mantienen su
contrato: no se modifica el schema Pydantic ni el selector multi-proveedor.

## 6. Riesgos residuales

1. **Calidad real de la extracción con M3 Vision:** los guardrails fuerzan la
   estructura, pero la calidad final depende de que M3 Vision lea bien la tabla
   del PDF Sibelmed. Solo validable en el deploy con key M3 configurada.
2. **Variante ortográfica de `key`:** se incluyó `fef25_75_l_s` junto a
   `fef2575_l_s` para evitar falsos positivos. Si el LLM emite otra grafía
   canónica no listada, se anotará como `SOSPECHA_MAPEO` (no rompe, pero puede
   generar ruido en `notas_calidad`). Ampliar el frozenset si aparecen nuevas
   variantes canónicas reales.
3. **Tests previos frágiles al entorno:** los 4 tests de espirometría existentes
   no usan `extraction_provider_override` y fallan cuando el provider por defecto
   es m3 sin key. No es regresión de este FIX, pero convendría endurecerlos en
   un FIX posterior para que usen override explícito (como hacen mis 2 tests
   nuevos).
4. **Sin cambiar schema ni selector:** confirmado — no se modifica
   `EspirometriaData` ni `_resolve_provider`/`_call_with_dispatch`/keys.

## 7. Cumplimiento de FIXs/ARCHs previos

| Referencia | Cumplido | Nota |
|---|---|---|
| FIX-20260812-14/15/16/17/18 | ✅ | No se toca `_resolve_provider`, `_call_with_dispatch`, keys ni singletons |
| FIX-20260812-12 (no degradar a Gemini) | ✅ | No se toca el fallback |
| ARCH-20260518-03 (prompts solo de aiCalibration) | ✅ | Guardrails se inyectan *alrededor* del prompt de aiCalibration, no lo reemplazan |
| ARCH-20260518-17 (post-procesamiento backend) | ✅ | `_normalize_espirometria_result` es post-procesador backend, espejo de audiometría |
| ARCH-20260809-02 (selector multi-proveedor) | ✅ | Intacto |
| ARCH-20260516-12 (extracción exhaustiva 6 bloques) | ✅ | Los guardrails fuerzan poblar los 6 bloques ya definidos en el schema |

## 8. Próximo paso sugerido

Frank despliega y sube `context/RD2026/ESPIROMETRIA.pdf` al endpoint de
extracción. Verificar que `extracted_data.parametros[]` contenga las filas
FVC/FEV1/FEV1-FVC/FEF25-75/etc. con valores M1/M2/M3/REF/LLN, y que
`calidad.completitud_documental` = "suficiente". Si la tabla sigue vacía,
escalvar a DEBY (causa probable: M3 Vision no leer la tabla — requeriría
preprocesamiento de imagen o re-entrenamiento del prompt de aiCalibration, no
código backend).
