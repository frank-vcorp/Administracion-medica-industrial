# SPEC ARCH-20260715-02 — Recalibración Audiometría con Caso Real

## Contexto

Se identificó un caso real de audiometría que expone problemas de calibración:

**PDF de referencia:** `context/PACIENTES/161745 - CERVANTES CELEDON DAMIAN RX0001/CERVANTES CELEDON DAMIAN-161745-23-12-2025_04_18_14_3333.pdf`

### Problema detectado

El PDF contiene una **contradicción interna**:

1. **Tabla numérica** (4 frecuencias):
   - OD: 15, 15, 10, 20 dB (todos ≤ 25 dB → NORMAL)
   - OI: 10, 5, 15, 30 dB (todos ≤ 25 dB → NORMAL)

2. **Descripción textual:** "CAÍDA DEL UMBRAL DE AUDICIÓN BILATERAL EN 4000 HZ"

3. **Diagnóstico del documento:** Hipoacusia Neurosensorial Bilateral Leve

**La contradicción:** Los umbrales de la tabla son normales, pero el diagnóstico dice hipoacusia. Esto se debe a que la tabla solo muestra 4 frecuencias (500, 1000, 2000, 3000), mientras que la caída en 4000 Hz está en la gráfica (no en la tabla).

### Implicaciones

- El extractor debe capturar **SOLO** los valores de la tabla numérica (4 frecuencias)
- El sistema NO debe inventar valores para 4000 Hz aunque el texto lo mencione
- El prediagnóstico debe ser **prudente**: los datos de la tabla sugieren audición normal, pero la completitud es parcial
- El sistema NO debe copiar el diagnóstico del documento ("Hipoacusia Leve"), sino generar una síntesis derivada basada en los parámetros extraídos

## Objetivo

Recalibrar Audiometría en las 3 capas:

1. **Extracción:** Ajustar prompt para capturar correctamente tablas con frecuencias limitadas
2. **Presentación:** Validar que el schema visual renderice correctamente 4 frecuencias
3. **Prediagnóstico:** Sincronizar fallback backend con prompt objetivo documentado

## Alcance

### ✅ INCLUYE

1. **Analizar extracción actual** del PDF de referencia
2. **Ajustar prompt de extracción** si es necesario (reglas de tablas incompletas)
3. **Sincronizar prompt clínico** de Audiometría al fallback backend (`prediagnostic.py`)
4. **Validar con caso real** en el panel de calibración
5. **Documentar hallazgos** en checkpoint

### ❌ NO INCLUYE

- Modificar el schema de presentación (ya funciona correctamente)
- Cambiar la lógica de normalización post-extracción
- Modificar el panel de calibración
- Cambiar el flujo de papeleta

## Especificación Técnica

### Fase 1: Diagnóstico de Extracción Actual

**Acción:** Ejecutar extracción del PDF de referencia usando el prompt actual configurado en `aiCalibration.extraction.prompt` para Audiometría.

**Preguntas a responder:**
1. ¿Qué frecuencias extrae actualmente?
2. ¿Captura correctamente los 4 valores por oído?
3. ¿Inventa valores para 4000 Hz?
4. ¿Marca `completitud_documental` como "parcial"?
5. ¿Captura los campos fuente (faringe, CAD, CAI, MTD, MTI)?

**Si no hay prompt configurado:** Documentar que falla con `EXTRACTION_PROMPT_NOT_CONFIGURED` y proceder a Fase 2.

### Fase 2: Ajuste de Prompt de Extracción

**Si la extracción actual tiene problemas**, ajustar `aiCalibration.extraction.prompt` para Audiometría con estas reglas específicas:

```markdown
REGLAS ESPECÍFICAS PARA TABLAS DE AUDIOMETRÍA

1. La tabla de umbrales tonales (vía aérea VA) es la FUENTE PRIMARIA de datos numéricos.
   Captura EXACTAMENTE las frecuencias y valores visibles en la tabla.

2. Si la tabla tiene menos de 8 frecuencias canónicas (250, 500, 1000, 2000, 3000, 4000, 6000, 8000):
   - Captura SOLO las frecuencias presentes en la tabla
   - NO inventes valores para frecuencias ausentes
   - Marca `completitud_documental` como "parcial" si hay 3-5 frecuencias
   - Marca `completitud_documental` como "no_concluyente" si hay <3 frecuencias

3. Si el documento menciona frecuencias en texto descriptivo (ej. "caída en 4000 Hz")
   pero NO están en la tabla numérica:
   - NO las captures como valores de umbral
   - Puedes mencionarlas en `notas_calidad` como contexto documental
   - NO las uses para calcular PTA

4. Valores nulos: Si una celda de la tabla está vacía o ilegible, usa null.
   NUNCA desplaces el valor de la columna adyacente.

5. Campos fuente documentales (faringe, CAD, CAI, MTD, MTI):
   - Captúralos si están visibles
   - Son contexto secundario, NO base de interpretación audiométrica
```

### Fase 3: Sincronización de Prompt Clínico

**Acción:** Actualizar `PREDIAGNOSTIC_PROMPTS["Audiometria"]` en `backend/app/services/ai/prediagnostic.py` con el contenido de `predx-audiometria-v2-derivado` documentado en `context/interconsultas/PROMPTS_DOC-20260518-02-AUDIOMETRIA.md`.

**Cambios específicos:**

1. Agregar campos de output al JSON esperado:
   - `resumen_por_oido` (con PTA, status, severity, pattern, basis por oído)
   - `resumen_bilateral` (status, laterality, symmetry, note)
   - `clasificacion_hipoacusia` (right, left, bilateral, confidence)

2. Agregar reglas específicas:
   - No copiar narrativa diagnóstica del documento fuente
   - Usar PTA por oído si viene extraído; si no, estimar solo si hay frecuencias suficientes
   - Considerar audición normal cuando umbrales ≤ 25 dB en frecuencias disponibles
   - Si `completitud_documental` es "parcial" o "no_concluyente", reducir confianza y declarar limitaciones

3. Mantener umbrales de referencia ISO 1999:
   - Normal: ≤ 25 dB
   - Leve: 26-40 dB
   - Moderada: 41-60 dB
   - Severa: 61-80 dB
   - Profunda: > 80 dB

**Prompt objetivo:** Ver sección "Prompt Clínico Final" en `PROMPTS_DOC-20260518-02-AUDIOMETRIA.md`

### Fase 4: Validación con Caso Real

**Acción:** Procesar el PDF de referencia en el panel de calibración (`/admin/services/[id]/calibration` para Audiometría).

**Criterios de aceptación:**

1. ✅ Extracción captura exactamente 4 frecuencias por oído (500, 1000, 2000, 3000)
2. ✅ NO inventa valores para 4000 Hz
3. ✅ `completitud_documental` = "parcial"
4. ✅ Prediagnóstico genera `resumen_por_oido` con PTA calculado
5. ✅ Prediagnóstico genera `resumen_bilateral` con status prudente
6. ✅ Prediagnóstico NO copia el diagnóstico del documento ("Hipoacusia Leve")
7. ✅ Prediagnóstico declara limitaciones por completitud parcial
8. ✅ Presentación visual renderiza correctamente las 4 frecuencias

### Fase 5: Documentación

**Checkpoint:** Generar `context/checkpoints/CHK_ARCH-20260715-02-RECALIBRACION-AUDIOMETRIA.md` con:
- Hallazgos de la extracción actual
- Cambios realizados en prompts
- Resultados de validación con caso real
- Recomendaciones para futuros casos

## Criterios de Aceptación Globales

1. ✅ Extracción del PDF de referencia es correcta (4 frecuencias, sin invención)
2. ✅ Prompt clínico de fallback backend sincronizado con documento objetivo
3. ✅ Prediagnóstico genera bloques derivados (`resumen_por_oido`, `resumen_bilateral`, `clasificacion_hipoacusia`)
4. ✅ Validación con caso real pasa todos los criterios de Fase 4
5. ✅ TypeScript compila sin errores
6. ✅ Checkpoint documentado

## Validaciones Obligatorias

```bash
# Backend
cd backend && python -m pytest tests/test_ai_pipeline.py -v

# Frontend
cd frontend && pnpm typecheck && pnpm build --filter frontend
```

## Notas para Sofia

- **NO modifiques** el schema de presentación (ya funciona)
- **NO cambies** la lógica de normalización post-extracción
- **SÍ sincroniza** el prompt clínico al fallback backend
- **SÍ ajusta** el prompt de extracción si es necesario (documenta cambios)
- **Valida** con el PDF de referencia en el panel de calibración

## Archivos Afectados

1. `backend/app/services/ai/prediagnostic.py` — sincronizar prompt clínico de Audiometría
2. (Opcional) Configuración en DB de `aiCalibration.extraction.prompt` para Audiometría — ajustar si es necesario

## Archivos NO Afectados

- `frontend/src/components/clinical/extraction-presentation-schemas.ts` — schema de presentación no se modifica
- `backend/app/services/ai/extractor.py` — lógica de normalización no se modifica
- Panel de calibración — no se modifica

## Metadata

- **ID:** ARCH-20260715-02
- **Fecha:** 2026-07-15
- **Autor:** INTEGRA (Arquitecto de Soluciones)
- **Implementa:** SOFIA (Constructora Principal)
- **Prioridad:** Alta
- **Estimación:** 2-3 horas
- **PDF de referencia:** `context/PACIENTES/161745 - CERVANTES CELEDON DAMIAN RX0001/CERVANTES CELEDON DAMIAN-161745-23-12-2025_04_18_14_3333.pdf`
