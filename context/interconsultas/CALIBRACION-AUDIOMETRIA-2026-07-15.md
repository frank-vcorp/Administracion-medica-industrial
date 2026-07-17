# CALIBRACION-AUDIOMETRIA-2026-07-15 — Documento de Respaldo

## Estado

Documento consolidado con la calibración vigente de Audiometría a partir de 2026-07-15.
Incluye los tres componentes operativos: extracción, prediagnóstico clínico y presentación.

---

## 1. Contexto y Cambio de Enfoque

### Problema detectado

Los PDFs reales del audiómetro (software DD65 V2) **contienen gráficas de audiograma**, no tablas numéricas explícitas. Los elementos que aparecen en los PDFs son:

| Elemento | Fuente | ¿Es confiable? |
|---|---|---|
| Gráficas de audiograma (curvas tono puro) | Audiómetro (fuente primaria) | ✅ Sí |
| Tabla resumen con PTA | Audiómetro | ✅ Sí |
| Tabla de 4 frecuencias (500, 1000, 2000, 3000) | Agregada después por médico | ️ Incompleta |
| Diagnóstico textual ("Hipoacusia Leve", etc.) | Agregado después por médico | ❌ No usar para extracción |
| Faringe, CAD, CAI, MTD, MTI | Examen médico, no audiometría | ️ Contexto secundario |

### Decisión arquitectónica (ARCH-20260715-05)

**Las gráficas son la fuente primaria** de datos numéricos. La tabla de 4 frecuencias se usa solo para validación cruzada. El diagnóstico textual NO se usa para extracción numérica.

---

## 2. Prompt de Extracción (Vigente)

**Versión:** `extract-audio-graficas-v1`
**Proveedor:** Gemini 2.5 Pro
**Ubicación:** `aiCalibration.extraction.prompt` en `MedicalTest.options` para Audiometría

```
REGLAS ESPECÍFICAS PARA EXTRACCIÓN DE AUDIOGRAMAS

Este documento contiene gráficas de audiometría (audiogramas) con curvas de vía aérea.

EXTRACCIÓN DE VALORES DESDE GRÁFICAS

1. Identifica los ejes de la gráfica:
   - Eje Y (vertical): dB HL (decibeles de nivel de audición), rango típico -10 a 120
   - Eje X (horizontal): Frecuencia en Hz (125, 250, 500, 1K, 2K, 4K, 8K)

2. Identifica los símbolos de cada oído:
   - ○ (círculo, típicamente rojo) = Oído Derecho (OD)
   - × (equis, típicamente azul) = Oído Izquierdo (OI)
   - Si hay vía ósea: < (corchete izquierdo) = OD, > (corchete derecho) = OI

3. Extrae los valores de umbral para cada frecuencia visible en la gráfica:
   - Lee el valor de dB HL donde cada símbolo intersecta cada frecuencia
   - Si un símbolo no está presente en una frecuencia, usa null
   - NO inventes valores para frecuencias donde no hay símbolo visible

4. Si hay tabla resumen con PTA (Promedio de Tonos Puros):
   - Captura el PTA reportado para cada oído
   - El PTA típicamente promedia 500, 1000, 2000 Hz

5. Frecuencias canónicas esperadas: 250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz
   - Si la gráfica muestra frecuencias adicionales (125, 750, 1500, 3000), captúralas
   - Si la gráfica solo muestra 4 frecuencias (500, 1000, 2000, 3000), captura solo esas

COMPATIBILIDAD CON TABLAS NUMÉRICAS AGREGADAS

Algunos PDFs contienen tablas numéricas agregadas después del estudio (no generadas por el audiómetro). Estas tablas:
- Típicamente solo incluyen 4 frecuencias (500, 1000, 2000, 3000 Hz)
- Son incompletas (faltan 250, 4000, 6000, 8000 Hz)
- Pueden usarse como validación cruzada con las gráficas

Reglas:
1. Las gráficas son la fuente primaria de datos numéricos
2. Si existe una tabla agregada, úsala para validar los valores extraídos de las gráficas
3. Si hay discrepancia entre gráfica y tabla, prioriza la gráfica
4. Captura TODAS las frecuencias visibles en la gráfica (no solo las de la tabla)
5. NO inventes valores para frecuencias ausentes en la gráfica

CAMPOS DE SALIDA ESPERADOS

{
  "oido_derecho": {
    "va": {
      "250": null,
      "500": 15,
      "1000": 10,
      "2000": 15,
      "3000": 20,
      "4000": null,
      "6000": null,
      "8000": null
    },
    "pta": 13
  },
  "oido_izquierdo": {
    "va": {
      "250": null,
      "500": 10,
      "1000": 5,
      "2000": 15,
      "3000": 30,
      "4000": null,
      "6000": null,
      "8000": null
    },
    "pta": 15
  },
  "frecuencias_detectadas": ["500", "1000", "2000", "3000"],
  "completitud_documental": "parcial",
  "notas_calidad": "Gráfica audiométrica con 4 frecuencias visibles. PTA calculado automáticamente."
}

REGLAS DE CALIDAD

1. completitud_documental:
   - "suficiente" → ≥6 frecuencias con valor por oído
   - "parcial" → 3-5 frecuencias con valor por oído
   - "no_concluyente" → <3 frecuencias con valor por oído

2. Si la gráfica es ilegible o los símbolos no son claros:
   - Marca completitud_documental como "no_concluyente"
   - Agrega en notas_calidad: "Gráfica ilegible o símbolos no identificables"

3. NO copies el diagnóstico textual del documento (ej. "Hipoacusia Leve")
   - Ese texto fue agregado después por el médico
   - Tu tarea es SOLO extraer valores numéricos de las gráficas/tablas
```

---

## 3. Prompt Clínico de Prediagnóstico (Vigente)

**Versión:** `predx-audiometria-v2-derivado`
**Proveedor:** MedGemma (vía DR7.ai)
**Ubicación:** `backend/app/services/ai/prediagnostic.py` → `PREDIAGNOSTIC_PROMPTS["Audiometria"]`

**Referencia completa:** `context/interconsultas/PROMPTS_DOC-20260518-02-AUDIOMETRIA.md`

### Resumen del prompt clínico

- Genera síntesis clínica derivada de los parámetros extraídos
- NO copia la narrativa diagnóstica del documento fuente
- Produce 3 bloques derivados:
  - `resumen_por_oido` (PTA, status, severity, pattern, basis por oído)
  - `resumen_bilateral` (status global, lateralidad, simetría, nota)
  - `clasificacion_hipoacusia` (right, left, bilateral, confidence)
- Lenguaje prudente: "compatible con", "sugiere", "requiere correlación clínica"
- Prohibido: aptitud laboral, dictamen, incapacidad, tratamiento

### Umbrales de referencia (ISO 1999 / NOM-011-STPS)

| Severidad | Rango (dB) |
|---|---|
| Normal | ≤ 25 |
| Leve | 26–40 |
| Moderada | 41–60 |
| Severa | 61–80 |
| Profunda | > 80 |

### Patrones

| Patrón | Descripción |
|---|---|
| Conductivo | Peor en graves (250–500 Hz), mejor en agudos |
| Neurosensorial | Peor en agudos (4000–8000 Hz), mejor en graves |
| Mixto | Elevación en todas las frecuencias con distintas magnitudes |

---

## 4. Schema de Presentación (Vigente)

**Archivo:** `frontend/src/components/clinical/extraction-presentation-schemas.ts`
**ID:** `IMPL-20260518-14`, realineado `IMPL-20260519-02`

### Secciones configuradas para Audiometría

| # | Tipo | Título | Campos |
|---|---|---|---|
| 1 | keyValue | Paciente | nombre_completo, identificacion, sexo, edad_anios, fecha_nacimiento, notas, empresa, puesto |
| 2 | keyValue | Estudio | fecha_estudio, hora_estudio, tipo_reporte, equipo_modelo, transductor, ultima_calibracion, equipo_numero_serie, numero_serie_sistema |
| 3 | keyValue | Resumen técnico | completitud_documental |
| 4 | note | Notas de calidad | notas_calidad.descripcion |
| 5 | keyValue | PTA Oído Derecho | pta_visible |
| 6 | keyValue | PTA Oído Izquierdo | pta_visible |
| 7 | keyValue | Condiciones | cabina, equipo, tecnico, observaciones, PTA_general |
| 8 | bilateralFrequency | Vía aérea por frecuencia | 125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000 Hz |
| 9 | bilateralFrequency | Vía ósea por frecuencia | 125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000 Hz |
| 10 | bilateralFrequency | Separación por frecuencia | 125, 250, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000 Hz |
| 11 | keyValue | Campos fuente del formato | faringe, cad, cai, mtd, mti |

---

## 5. Schema Pydantic Extendido

**Archivo:** `backend/app/schemas/medical.py`
**ID:** `ARCH-20260715-03`

Campos opcionales agregados a `AIPrediagnosisResult`:

```python
resumen_por_oido: Optional[Dict[str, Any]] = None
resumen_bilateral: Optional[Dict[str, Any]] = None
clasificacion_hipoacusia: Optional[Dict[str, Any]] = None
```

---

## 6. Casos de Prueba Conocidos

### Caso 1: Gráfica con 4 frecuencias (formato real del audiómetro)

**PDF:** `context/RD2026/AUDIOMETRIA.pdf`
**Paciente:** MARBELLA, PEÑA PATRICIO
**Fecha:** 18/03/2025

**Datos esperados de extracción:**
- OD: 500=0, 1000=5, 2000=0, 3000=10 → PTA=5
- OI: 500=0, 1000=5, 2000=0, 3000=5 → PTA=4
- completitud_documental: "parcial" (4 frecuencias)

**Resultado clínico esperado:**
- Audición bilateral dentro de límites normales
- Sin patrón patológico claro
- Recomendación: seguimiento anual

### Caso 2: Tabla con diagnóstico contradictorio

**PDF:** `context/PACIENTES/161745 - CERVANTES CELEDON DAMIAN RX0001/`
**Paciente:** CERVANTES CELEDON DAMIAN
**Fecha:** 23/12/2025

**Datos de tabla:**
- OD: 500=15, 1000=15, 2000=10, 3000=20
- OI: 500=10, 1000=5, 2000=15, 3000=30
- Descripción: "CAÍDA DEL UMBRAL DE AUDICIÓN BILATERAL EN 4000 HZ"
- Diagnóstico del documento: Hipoacusia Neurosensorial Bilateral Leve

**Nota:** Los umbrales de la tabla son ≤ 25 dB (normales), pero el diagnóstico dice hipoacusia. La caída en 4000 Hz está en la gráfica, no en la tabla.

---

## 7. Guardrails Backend (No editables vía calibración)

**Archivo:** `backend/app/services/ai/extractor.py`
**Constante:** `_AUDIOMETRIA_BACKEND_GUARDRAILS`

```
GUARDRAILS ESPECÍFICOS PARA AUDIOMETRÍA (BACKEND — NO MODIFICAR VÍA CALIBRACIÓN)
1. La tabla de umbrales tonales (vía aérea VA) es la fuente primaria de datos numéricos.
   La descripción narrativa del diagnóstico NO es fuente de valores de umbral.
2. Cada celda de la tabla corresponde a UNA frecuencia específica. Si una celda está vacía
   o ilegible, usa null — NUNCA desplaces el valor de la columna adyacente para completar el hueco.
3. Frecuencias canónicas aceptadas: 250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz.
   No incluyas 125 Hz a menos que aparezca EXPLÍCITAMENTE como columna de la tabla en el documento.
4. Si una frecuencia no está visible en la tabla, omite esa clave del dict — no uses 0 ni la inventes.
5. frecuencias_detectadas: registra SOLO las frecuencias con valor numérico visible en la tabla.
6. completitud_documental (calcula tú mismo antes de responder):
   - "suficiente"     → ≥6 frecuencias con valor por oído en la tabla
   - "parcial"        → 3-5 frecuencias con valor por oído
   - "no_concluyente" → <3 frecuencias con valor por oído
```

---

## 8. Post-procesamiento (Normalización)

**Archivo:** `backend/app/services/ai/extractor.py`
**Método:** `_normalize_audiometria_result()`

Acciones automáticas después de la extracción:
1. Normaliza claves a str y valores a int, descartando nulos
2. Deriva `frecuencias_detectadas` desde las claves reales si el LLM lo omitió
3. Deriva `completitud_documental` desde el conteo de frecuencias si quedó null
4. Anota sospecha de corrimiento en `notas_calidad` cuando hay frecuencias fuera del conjunto canónico

---

## 9. Historial de Cambios

| ID | Fecha | Cambio |
|---|---|---|
| ARCH-20260513-01 | 2026-05-13 | V1: contratos canónicos, calibración médica, modo sombra |
| ARCH-20260516-02 | 2026-05-16 | V2: casos reales, precedencia tabla > gráfica |
| ARCH-20260518-02 | 2026-05-18 | Resolución de prompts: calibración como fuente primaria |
| ARCH-20260518-14 | 2026-05-18 | Renderer clínico con schema bilateral |
| ARCH-20260518-15 | 2026-05-18 | Prompt clínico derivado `predx-audiometria-v2-derivado` |
| ARCH-20260519-02 | 2026-05-19 | Realineación renderer con payload real (va/vo/pta) |
| ARCH-20260519-04 | 2026-05-19 | Estabilización final de audiometría |
| ARCH-20260603-01 | 2026-06-03 | Migración clínica a DR7.ai / MedGemma |
| ARCH-20260715-01 | 2026-07-15 | Limpieza paneles raw de papeleta |
| ARCH-20260715-02 | 2026-07-15 | Sincronización prompt clínico con v2-derivado |
| ARCH-20260715-03 | 2026-07-15 | Extensión schema Pydantic con campos derivados |
| ARCH-20260715-04 | 2026-07-15 | Upload de PDFs de prueba en módulo de calibración |
| ARCH-20260715-05 | 2026-07-15 | Recalibración para gráficas audiométricas (formato real) |
| ARCH-20260715-06 | 2026-07-15 | Extracción directa desde XML de audiómetro DD65 V2 |

---

## 10. Extracción Directa desde XML (ARCH-20260715-06)

### Flujo de Prioridad

1. **XML disponible** → Parser directo (valores exactos, sin IA)
2. **Solo PDF** → IA con prompt calibrado (valores aproximados ±5 dB)
3. **Ambos disponibles** → XML es ground truth, PDF se valida contra XML

### Parser XML

**Archivo:** `backend/app/services/audiometry_xml_parser.py`

El audiómetro DD65 V2 exporta archivos XML con estructura `LocalSession` que contiene:
- Datos del paciente (Patient)
- Sesiones con audiogramas (Sessions > Session > Actions > Action)
- Puntos de medición (TonePoint con Intensity1=dB y Freq1=Hz)

**Identificación de oídos:**
- `SignalOutput1=ACL` → Oído Izquierdo (Air Conduction Left)
- `SignalOutput1=ACR` → Oído Derecho (Air Conduction Right)
- `SignalOutput1=BCL` → Oído Izquierdo (Bone Conduction Left)
- `SignalOutput1=BCR` → Oído Derecho (Bone Conduction Right)

**Ventajas:**
- Exactitud 100% (valores exactos del audiómetro)
- Velocidad: <100ms vs 5-10s con IA
- Costo: no consume tokens de IA para extracción
- Confiabilidad: sin dependencia de prompts calibrados

### Endpoint Modificado

**Archivo:** `backend/app/api/v1/calibration.py`

El endpoint `POST /api/v1/calibration/upload` ahora acepta:
- Archivos PDF (flujo existente con IA)
- Archivos XML (nuevo flujo con parser directo)

Para archivos XML de audiometría:
- No requiere prompt de extracción configurado
- No consume tokens de IA para extracción
- Solo usa IA para prediagnóstico clínico (si está configurado)
- Respuesta incluye `data_source: "xml_direct"`

### Especificación Completa

**Archivo:** `context/SPECs/SPEC_ARCH-20260715-06-EXTRACCION-DIRECTA-XML-AUDIOMETRO.md`

---

## 11. Notas de Gobernanza

1. Faringe, CAD, CAI, MTD y MTI son campos fuente documentales opcionales del examen médico.
2. La descripción audiométrica del formato NO debe copiarse al output clínico.
3. El renderer no calcula diagnóstico clínico; solo presenta el bloque que produce MedGemma.
4. Los PDFs reales del audiómetro contienen gráficas, no tablas. La tabla de 4 frecuencias es agregada después.
5. El diagnóstico textual es agregado por el médico, no por el audiómetro.
6. La vía ósea se evalúa en el examen médico, no en la audiometría del audiómetro.
