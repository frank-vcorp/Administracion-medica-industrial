# HANDOFF ARCH-20260516-06 -> SOFIA

## Contexto
El usuario confirmó que el problema relevante no es la observabilidad del snapshot, sino que el prediagnóstico IA no está entregando recomendación clínica visible. La revisión del código confirma la causa raíz:
- el prompt clínico actual restringe recomendaciones
- `AIPrediagnosisResult` no tiene campo `recommendation`
- la UI no renderiza ninguna recomendación

## Objetivo
Agregar recomendación clínica breve, prudente y visible al prediagnóstico IA, empezando por Audiometría y respetando guardrails.

## Fuente de Verdad
- `context/SPECs/SPEC_ARCH-20260516-06-PREDIAGNOSTICO-CON-RECOMENDACION-CLINICA.md`

## Alcance
- Extender schema clínico con campo de recomendación
- Ajustar prompts clínicos para producirlo
- Renderizarlo en la tarjeta del prediagnóstico
- Mantener compatibilidad con snapshots viejos que no lo traigan

## Restricciones
- No emitir aptitud laboral
- No emitir dictamen final
- No emitir tratamiento prescriptivo
- No tocar extractor documental

## Regla Específica para Audiometría
Si la audiometría es normal, la recomendación debe sonar a seguimiento/correlación/vigilancia preventiva; no debe sonar a tratamiento ni a aptitud.

## Validación Solicitada
- Ejecutar validación acotada del slice tocado
- Probar con una Audiometría normal
- Confirmar que la tarjeta muestra recomendación visible
- Generar checkpoint