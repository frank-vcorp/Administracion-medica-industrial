# SPEC ARCH-20260715-05 — Recalibración Audiometría para Gráficas Audiométricas

## Contexto

Los PDFs reales del audiómetro contienen **gráficas de audiograma** con curvas de vía aérea, no tablas numéricas explícitas. El formato incluye:

- Gráficas con ejes: dB HL (-10 a 120) vs Frecuencia (125, 250, 500, 1K, 2K, 4K, 8K Hz)
- Símbolos estándar: ○ (círculo rojo) = Oído Derecho, × (equis azul) = Oído Izquierdo
- Tabla resumen con PTA calculado (en algunos PDFs)
- Metadatos: paciente, empresa, fechas, creador

**Problema:** El prompt de extracción actual está diseñado para tablas numéricas, no para gráficas. Los guardrails dicen "La tabla de umbrales tonales es la fuente primaria", pero en el formato real no hay tabla, solo gráficas.

## Objetivo

Recalibrar el prompt de extracción de Audiometría para que Gemini 2.5 Pro interprete correctamente gráficas audiométricas y extraiga los valores de las curvas.

## Alcance

### ✅ INCLUYE

1. **Rediseñar prompt de extracción** para interpretar gráficas audiométricas
2. **Mantener compatibilidad** con PDFs que tienen tablas numéricas
3. **Validar con caso real** (PDF RD2026/AUDIOMETRIA.pdf)
4. **Ajustar guardrails** para permitir extracción desde gráficas
5. **Documentar hallazgos** en checkpoint

###  NO INCLUYE

- Modificar el schema de presentación
- Cambiar la lógica de normalización post-extracción
- Modificar el prompt clínico de prediagnóstico (ya está sincronizado)
- Cambiar el panel de calibración

## Especificación Técnica

### Prompt de Extracción Objetivo

**Nuevo prompt para `aiCalibration.extraction.prompt` de Audiometría:**

```markdown
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
1. Las **gráficas son la fuente primaria** de datos numéricos
2. Si existe una tabla agregada, úsala para **validar** los valores extraídos de las gráficas
3. Si hay discrepancia entre gráfica y tabla, **prioriza la gráfica**
4. Captura TODAS las frecuencias visibles en la gráfica (no solo las de la tabla)
5. NO inventes valores para frecuencias ausentes en la gráfica

CAMPOS DE SALIDA ESPERADOS

```json
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
```

REGLAS DE CALIDAD

1. `completitud_documental`:
   - "suficiente" → ≥6 frecuencias con valor por oído
   - "parcial" → 3-5 frecuencias con valor por oído
   - "no_concluyente" → <3 frecuencias con valor por oído

2. Si la gráfica es ilegible o los símbolos no son claros:
   - Marca `completitud_documental` como "no_concluyente"
   - Agrega en `notas_calidad`: "Gráfica ilegible o símbolos no identificables"

3. NO copies el diagnóstico textual del documento (ej. "Hipoacusia Leve")
   - Ese texto fue agregado después por el médico
   - Tu tarea es SOLO extraer valores numéricos de las gráficas/tablas
```

### Archivo a Modificar

**Configuración en DB:** `aiCalibration.extraction.prompt` para Audiometría

**Opción 1 (recomendada):** Actualizar vía panel de calibración (`/admin/services/[id]/calibration`)

**Opción 2 (fallback):** Actualizar vía script SQL directo en la DB

### Validación con Caso Real

**PDF de prueba:** `context/RD2026/AUDIOMETRIA.pdf`

**Criterios de aceptación:**

1. ✅ Extrae valores de vía aérea para OD y OI
2. ✅ Identifica correctamente las frecuencias presentes (500, 1000, 2000, 3000)
3. ✅ NO inventa valores para frecuencias ausentes
4. ✅ Captura PTA si está disponible
5. ✅ Marca `completitud_documental` como "parcial" (4 frecuencias)
6. ✅ NO copia el diagnóstico textual del documento

## Criterios de Aceptación

1. ✅ Prompt de extracción actualizado para interpretar gráficas audiométricas
2. ✅ Compatibilidad mantenida con PDFs de tablas numéricas
3. ✅ Validación con PDF real (RD2026/AUDIOMETRIA.pdf) pasa todos los criterios
4. ✅ TypeScript compila sin errores
5. ✅ Tests existentes siguen pasando
6. ✅ Checkpoint documentado

## Validaciones Obligatorias

```bash
# Backend
cd backend && python -m pytest tests/test_ai_pipeline.py -v -k audiometria

# Frontend
cd frontend && pnpm typecheck
```

## Notas para Sofia

- **NO modifiques** el prompt clínico de prediagnóstico (ya está sincronizado)
- **NO cambies** la lógica de normalización post-extracción
- **SÍ actualiza** el prompt de extracción en la DB vía panel de calibración
- **Valida** con el PDF real `context/RD2026/AUDIOMETRIA.pdf`
- **Documenta** los hallazgos en checkpoint

## Archivos Afectados

1. Configuración en DB: `aiCalibration.extraction.prompt` para Audiometría (vía panel de calibración)

## Archivos NO Afectados

- `backend/app/services/ai/extractor.py` — no se modifica
- `backend/app/services/ai/prediagnostic.py` — no se modifica
- `backend/app/schemas/medical.py` — no se modifica
- Frontend — no se modifica

## Metadata

- **ID:** ARCH-20260715-05
- **Fecha:** 2026-07-15
- **Autor:** INTEGRA (Arquitecto de Soluciones)
- **Implementa:** SOFIA (Constructora Principal)
- **Prioridad:** Alta
- **Estimación:** 1-2 horas
- **PDF de referencia:** `context/RD2026/AUDIOMETRIA.pdf`
