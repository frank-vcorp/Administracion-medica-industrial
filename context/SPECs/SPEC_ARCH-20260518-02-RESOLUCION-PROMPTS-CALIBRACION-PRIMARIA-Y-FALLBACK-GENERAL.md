# SPEC ARCH-20260518-02: Resolución de Prompts con Calibración Primaria y Fallback General

- ID: ARCH-20260518-02
- Fecha: 2026-05-18
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260516-03-CALIBRACION-CONFIG-SOLO-DOS-PROMPTS.md
  - context/SPECs/SPEC_ARCH-20260516-02-CALIBRACION-V2-CASOS-REALES-AUDIO-ESPIRO.md
  - context/SPECs/SPEC_ARCH-20260516-12-ESPIROMETRIA-EXTRACCION-EXHAUSTIVA.md
  - context/SPECs/SPEC_ARCH-20260516-13-ESPIROMETRIA-PREDIAGNOSTICO-COHERENTE.md

## 1. Objetivo

Definir una arquitectura de resolución de prompts donde la configuración de calibración por prueba médica sea la fuente primaria de verdad y los prompts hardcodeados del backend queden relegados a un fallback mínimo, general y seguro para todos los estudios.

## 2. Problema Observado

- Hoy el backend mantiene prompts operativos embebidos en código.
- La plataforma ya cuenta con una capa de calibración por prueba (`aiCalibration`) pensada precisamente para gobernar prompts/versiones.
- Si el sistema sigue usando prompts hardcodeados como mecanismo principal, cambiar un prompt en calibración no garantiza que el runtime real use ese prompt.
- Eso rompe tres cosas:
  1. gobernanza
  2. trazabilidad
  3. confiabilidad de la calibración

## 3. Principio Arquitectónico

La regla general del sistema debe ser:

1. **Fuente primaria**: prompt configurado en `aiCalibration` para la prueba médica
2. **Fuente secundaria**: versión activa/promovida en la calibración de esa prueba
3. **Fallback técnico**: prompt hardcodeado mínimo y genérico solo si NO existe calibración válida

## 4. Regla de Resolución de Prompt

Para cualquier estudio y para cualquier capa del pipeline:

### A. Extracción documental

El sistema debe resolver el prompt así:

1. buscar configuración de calibración de la prueba
2. si existe `extraction.prompt` o equivalente válido, usarlo
3. si existe solo `extraction.promptVersion` pero el prompt resoluble está asociado en la estructura vigente, usarlo
4. si no existe calibración válida, usar el fallback hardcodeado general de extracción

### B. Prediagnóstico clínico

El sistema debe resolver el prompt así:

1. buscar configuración de calibración de la prueba
2. si existe `diagnosis.prompt` o equivalente válido, usarlo
3. si existe solo `diagnosis.promptVersion` pero el prompt resoluble está asociado en la estructura vigente, usarlo
4. si no existe calibración válida, usar el fallback hardcodeado general clínico

## 5. Regla del Hardcode

El hardcode del backend NO debe contener un prompt clínico/documental específico por estudio como fuente principal.

Debe quedar reducido a un fallback mínimo del tipo:

### Fallback general de extracción

Instrucción corta que indique al modelo:

1. si no hay calibración personalizada cargada, extraiga los datos estructurados visibles del documento según el tipo de estudio
2. use conocimiento documental general y criterios conservadores
3. no invente datos faltantes
4. preserve separación entre extracción documental e interpretación clínica

### Fallback general clínico

Instrucción corta que indique al modelo:

1. si no hay calibración clínica personalizada cargada, use conocimiento médico general del propio modelo
2. apoye el razonamiento en fuentes verificadas y oficiales cuando corresponda
3. use lenguaje prudente
4. no emita aptitud, dictamen final, tratamiento ni incapacidad
5. degrade a no concluyente si la información es insuficiente o conflictiva

## 6. Alcance

### Incluye

1. mover la lógica de resolución del prompt hacia `aiCalibration`
2. mantener prompts hardcodeados mínimos como fallback universal
3. aplicar esta regla a todos los estudios, no solo Audiometría o Espirometría
4. registrar en auditoría qué fuente de prompt se usó realmente

### No incluye

1. eliminar por completo el hardcode técnico
2. rediseñar toda la estructura V2 de calibración en la misma iteración
3. reescribir todos los prompts clínicos especializados en este corte

## 7. Trazabilidad Obligatoria

La auditoría y los snapshots deben registrar al menos:

1. `prompt_version` realmente usada
2. `prompt_source` o equivalente:
   - `ai_calibration`
   - `backend_fallback`
3. `calibration_source` o equivalente en clínica:
   - `medical_calibration`
   - `general_fallback`

Regla crítica:

No se debe reportar una `prompt_version` de calibración si en realidad corrió el fallback hardcodeado.

## 8. Contrato de Configuración Esperado

La calibración por prueba debe tender a algo como:

```json
{
  "enabled": true,
  "canonicalStudyType": "Espirometria",
  "extraction": {
    "enabled": true,
    "promptVersion": "extract-espiro-v5-ordenado",
    "prompt": "...prompt de extracción..."
  },
  "diagnosis": {
    "enabled": true,
    "promptVersion": "predx-espiro-v4-base-patron-ami",
    "prompt": "...prompt clínico..."
  }
}
```

Si el sistema necesita compatibilidad transitoria, puede conservar campos previos, pero la resolución efectiva debe priorizar el prompt configurado por calibración.

## 9. Criterios de Aceptación

1. Cambiar un prompt en calibración afecta el runtime real sin requerir deploy de backend.
2. El backend usa prompts hardcodeados solo cuando no exista calibración válida.
3. La auditoría distingue correctamente entre prompt de calibración y fallback.
4. La misma política aplica a todos los estudios.
5. El sistema conserva comportamiento seguro aunque una prueba todavía no tenga calibración personalizada.

## 10. Resultado Esperado

La plataforma deja de depender del código embebido como fuente real de prompts. La calibración se vuelve la fuente de verdad operativa y el backend conserva únicamente un fallback mínimo, general y seguro para garantizar continuidad del servicio cuando falte configuración específica.