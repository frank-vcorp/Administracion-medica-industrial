# SPEC ARCH-20260516-03 — Capa de configuración de calibración reducida a dos prompts

- ID: ARCH-20260516-03
- Fecha: 2026-05-16
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md
  - context/SPECs/SPEC_ARCH-20260513-01-CALIBRACION-V1-AUDIOMETRIA-ESPIROMETRIA.md
  - context/SPECs/SPEC_ARCH-20260516-02-CALIBRACION-V2-CASOS-REALES-AUDIO-ESPIRO.md

## Objetivo

Simplificar la capa de configuración del panel de calibración para que por prueba médica solo capture el mínimo operativo necesario para el pipeline actual:

1. prompt/version de extracción documental para Gemini
2. prompt/version de diagnóstico clínico para MedGemma

## Problema actual

El formulario actual de calibración mezcla demasiadas preocupaciones en una sola capa:

1. activación general
2. tipo canónico
3. schemaVersion de extracción
4. targetFields manuales
5. promptVersion de diagnóstico
6. requiresDoctorCalibration

Esto genera tres problemas:

1. induce a capturar campos que en realidad deben salir del documento o del renderer del panel de estudios
2. empuja a modelar manualmente contratos documentales complejos en un formulario que no está diseñado para eso
3. no refleja con claridad el pipeline real: Gemini extrae, MedGemma interpreta/prediagnostica/recomienda

## Decisión de arquitectura

La capa de configuración visible del panel debe reducirse al mínimo y representar solo dos prompts por prueba:

1. **Extracción**
   - proveedor esperado: Gemini
   - dato editable principal: `promptVersion` o `extractPromptVersion`

2. **Diagnóstico clínico**
   - proveedor esperado: MedGemma
   - dato editable principal: `promptVersion` o `clinicalPromptVersion`

La configuración puede conservar únicamente campos de soporte mínimos:

1. `enabled`
2. `canonicalStudyType`

## Regla operativa

La calibración NO debe seguir capturando desde este formulario:

1. listas de campos objetivo complejas
2. flags que no alteran la gobernanza real del pipeline
3. pseudo-contratos clínicos que deben vivir en los prompts o en el renderer del panel de estudios

## Alcance aprobado

Incluye:

1. simplificar la UI de configuración para mostrar solo las dos capas de prompt
2. ajustar la persistencia `aiCalibration` para que el formulario guarde solo el mínimo necesario
3. mantener compatibilidad razonable con configuraciones previas ya guardadas
4. dejar explícito en la UI qué capa corresponde a Gemini y cuál a MedGemma

No incluye:

1. rediseño completo del versionado V2 de fieldDefinitions
2. eliminación del historial o de la promoción de campos candidatos
3. rediseño del renderer del panel de estudios en esta misma iteración

## Contrato objetivo de configuración

La forma objetivo visible del formulario debe tender a algo equivalente a:

```json
{
  "enabled": true,
  "canonicalStudyType": "Audiometria",
  "extraction": {
    "promptVersion": "extract-audio-gemini-v2"
  },
  "diagnosis": {
    "promptVersion": "predx-audio-medgemma-v2"
  }
}
```

Si se requieren nombres internos de compatibilidad, puede conservarse `schemaVersion` para extracción, pero la UI debe expresarlo como prompt/version de extracción y no como modelado de campos.

## Reglas de UX

1. la sección de Extracción debe indicar claramente que corresponde a Gemini
2. la sección de Diagnóstico clínico debe indicar claramente que corresponde a MedGemma
3. deben desaparecer del formulario visible los campos manuales `targetFields` y `requiresDoctorCalibration`
4. el usuario debe poder entender que el panel configura prompts, no contratos documentales completos

## Criterios de aceptación

1. el formulario de configuración visible ya no solicita `targetFields`
2. el formulario de configuración visible ya no solicita `requiresDoctorCalibration`
3. la calibración se entiende y guarda como dos prompts/versiones por prueba
4. la UI deja explícita la asociación de capas: Gemini para extracción, MedGemma para diagnóstico clínico
5. no se rompe la persistencia básica de `aiCalibration` ni la carga de configuraciones previas

## Criterio de éxito

La iteración será exitosa cuando el usuario pueda entrar al panel de calibración de una prueba y configurar solo las dos cosas que realmente gobiernan el pipeline operativo: el prompt de extracción documental y el prompt de diagnóstico clínico, sin ruido de campos que no pertenecen a esta capa.