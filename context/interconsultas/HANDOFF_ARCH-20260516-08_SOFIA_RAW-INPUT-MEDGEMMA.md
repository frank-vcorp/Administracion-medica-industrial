# HANDOFF ARCH-20260516-08 -> SOFIA

## Contexto
El usuario pidió explícitamente un cuadro RAW para revisar qué le llega a MedGemma. La revisión técnica confirma que hoy solo persistimos la salida clínica (`prediagnosisData`), pero no el input exacto enviado al modelo.

## Objetivo
Implementar persistencia y visualización del RAW de entrada clínica a MedGemma/Gemini text-only en la papeleta.

## Fuente de Verdad
- `context/SPECs/SPEC_ARCH-20260516-08-RAW-INPUT-MEDGEMMA-EN-PAPELETA.md`

## Alcance mínimo
- Persistir un `input_debug` estructurado dentro del snapshot clínico con:
  - `study_type`
  - `extracted_data`
  - `medical_calibration` o resumen equivalente
  - `clinical_provider`
  - `clinical_model_used`
- Mostrarlo en un panel colapsable `RAW de entrada clínica`

## Alcance deseable
- Persistir también `rendered_prompt` y mostrarlo en el mismo panel o en uno técnico adicional.

## Restricciones
- No guardar secretos ni credenciales.
- No romper snapshots viejos.
- No alterar la salida clínica actual.

## Validación pedida
- Procesar una Audiometría real.
- Confirmar que la papeleta muestra el RAW de entrada clínica.
- Confirmar que el panel deja ver qué payload llegó a MedGemma.
- Generar checkpoint.