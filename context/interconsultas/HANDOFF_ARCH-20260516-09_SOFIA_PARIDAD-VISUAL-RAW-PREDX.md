# HANDOFF ARCH-20260516-09 -> SOFIA

## Contexto
El usuario ya tiene datos `input_debug`, pero no percibe el panel RAW clínico porque hoy quedó como `details` blanco y discreto dentro del card de prediagnóstico. El RAW de extracción sí es claramente visible por su bloque técnico oscuro y abierto.

## Objetivo
Dar paridad visual al `RAW de entrada clínica` respecto al `RAW de extracción`.

## Fuente de Verdad
- `context/SPECs/SPEC_ARCH-20260516-09-RAW-PREDIAGNOSTICO-PARIDAD-VISUAL.md`

## Alcance mínimo
- Ajustar `StudyPrediagnosisRawPanel` para que use el mismo lenguaje visual técnico del panel `StudyExtractionRawPanel`.
- Mantener contenido actual (`input_debug`, calibration, prompt) y compatibilidad con snapshots viejos.

## Restricciones
- No tocar persistencia.
- No tocar lógica clínica.
- No eliminar el contenido técnico ya expuesto.

## Validación pedida
- Verificar visualmente con una Audiometría reciente que el panel ya se identifique como cuadro RAW equivalente al de extracción.
- Generar checkpoint.