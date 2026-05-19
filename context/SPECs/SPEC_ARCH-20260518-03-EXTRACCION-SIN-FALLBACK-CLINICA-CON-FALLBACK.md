# SPEC ARCH-20260518-03: Extracción sin Fallback y Clínica con Fallback General

- ID: ARCH-20260518-03
- Fecha: 2026-05-18
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260518-02-RESOLUCION-PROMPTS-CALIBRACION-PRIMARIA-Y-FALLBACK-GENERAL.md
  - context/SPECs/SPEC_ARCH-20260516-03-CALIBRACION-CONFIG-SOLO-DOS-PROMPTS.md
  - context/SPECs/SPEC_ARCH-20260516-12-ESPIROMETRIA-EXTRACCION-EXHAUSTIVA.md
  - context/SPECs/SPEC_ARCH-20260516-13-ESPIROMETRIA-PREDIAGNOSTICO-COHERENTE.md

## 1. Objetivo

Corregir y precisar la arquitectura de resolución de prompts del pipeline IA:

1. la extracción documental debe depender exclusivamente de la calibración personalizada de la prueba
2. la capa clínica puede usar calibración personalizada como fuente principal y fallback general prudente como red de seguridad
3. la salida clínica debe seguir preservando de forma obligatoria `justification`, `citations` y `limitations`

## 2. Corrección de la Hipótesis Anterior

La SPEC `ARCH-20260518-02` dejó una hipótesis intermedia donde extracción y clínica compartían la idea de fallback general. Esa formulación ya no representa correctamente la operación deseada.

La regla corregida es:

### Extracción

1. **Fuente única**: prompt de extracción configurado en la capa de calibración de la prueba
2. **Sin fallback**: no debe existir prompt hardcodeado de respaldo para extracción
3. **Si falta configuración**: la corrida debe bloquearse o fallar explícitamente como error de configuración

### Clínica

1. **Fuente principal**: prompt clínico configurado en la calibración de la prueba
2. **Fallback permitido**: prompt clínico general prudente, mínimo y seguro, solo si falta calibración clínica válida

## 3. Principio Arquitectónico

### A. Extracción es calibration-driven

La extracción documental depende del contrato documental exacto gobernado desde la superficie de calibración. Si el sistema permite prompts de extracción fuera de esa superficie, se rompe la gobernanza de layouts, campos y trazabilidad.

Regla operativa:

1. resolver `extraction.prompt` desde `aiCalibration`
2. si no existe, devolver error explícito de configuración
3. no usar hardcode específico ni fallback genérico en backend para extracción

### B. Clínica es calibration-driven con fallback general

La interpretación clínica puede operar con calibración específica cuando exista, y en ausencia de esta usar una base prudente general del modelo, siempre bajo guardrails explícitos.

Regla operativa:

1. resolver `diagnosis.prompt` desde `aiCalibration`
2. si no existe calibración clínica válida, usar fallback clínico general
3. registrar de forma explícita cuál camino se usó realmente

## 4. Contrato Clínico Ya Vigente y que Debe Preservarse

Se confirma que la salida clínica estructurada ya exige en el schema:

1. `justification`
2. `citations`
3. `limitations`

Ancla técnica verificada:

- `backend/app/schemas/medical.py` → `AIPrediagnosisResult`

Esto implica que cualquier resolución futura de prompts clínicos debe seguir produciendo obligatoriamente:

1. resumen prudente
2. justificación basada en parámetros
3. citas clínicas trazables
4. limitaciones explícitas
5. recommendation cuando aplique según el estudio

## 5. Regla del Hardcode

### Extracción

El backend no debe conservar prompts específicos ni genéricos de extracción como mecanismo de continuidad. La continuidad operativa de extracción depende de tener la prueba correctamente calibrada.

Resultado esperado si falta configuración:

- error explícito tipo `EXTRACTION_PROMPT_NOT_CONFIGURED`
- o bloqueo equivalente bien trazado

### Clínica

El backend puede conservar únicamente un fallback clínico general mínimo que indique al modelo:

1. usar conocimiento médico general prudente
2. apoyarse en fuentes verificadas y oficiales cuando corresponda
3. no emitir aptitud, dictamen final, incapacidad ni tratamiento
4. degradar a no concluyente si la información es insuficiente o conflictiva
5. producir siempre `justification`, `citations` y `limitations`

## 6. Trazabilidad Obligatoria

La auditoría y los snapshots deben registrar:

### Extracción

1. `prompt_version` realmente usada
2. `prompt_source = ai_calibration`

Si falta prompt de extracción válido, no debe inventarse una versión de respaldo.

### Clínica

1. `prompt_version` realmente usada
2. `prompt_source`:
   - `ai_calibration`
   - `backend_fallback`
3. `calibration_source`:
   - `medical_calibration`
   - `general_fallback`

## 7. Alcance

### Incluye

1. quitar el concepto de fallback para extracción
2. mantener fallback general solo para clínica
3. garantizar que la salida clínica siga preservando `justification`, `citations` y `limitations`
4. aplicar la política a todos los estudios

### No incluye

1. redefinir todos los prompts clínicos por estudio en esta misma SPEC
2. rediseñar de cero la estructura V2 de calibración

## 8. Criterios de Aceptación

1. Un estudio sin prompt de extracción configurado no corre extracción y falla explícitamente como error de configuración.
2. Un estudio con prompt de extracción configurado usa exactamente esa configuración sin depender de hardcode backend.
3. Si falta prompt clínico configurado, el sistema puede seguir operando mediante fallback clínico general prudente.
4. La salida clínica sigue incluyendo `justification`, `citations` y `limitations`.
5. La auditoría distingue con honestidad cuándo corrió calibración y cuándo corrió fallback clínico.

## 9. Resultado Esperado

La extracción queda completamente gobernada por la calibración de la prueba y deja de depender del backend embebido. La clínica conserva resiliencia operativa mediante un fallback general prudente, sin perder el contrato clínico estructurado ya vigente.