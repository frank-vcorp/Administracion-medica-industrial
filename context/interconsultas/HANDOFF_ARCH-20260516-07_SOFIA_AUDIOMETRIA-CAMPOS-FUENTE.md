# HANDOFF ARCH-20260516-07 -> SOFIA

## Contexto
El usuario detectó correctamente que el extractor de Audiometría todavía deja fuera campos visibles del formato clínico real. La revisión del código confirma que hoy el prompt y el schema solo capturan frecuencias + metadata mínima.

## Objetivo
Extender la extracción de Audiometría para capturar campos fuente visibles del formato diagnóstico, manteniendo la separación entre extracción documental e interpretación clínica IA.

## Fuente de Verdad
- `context/SPECs/SPEC_ARCH-20260516-07-AUDIOMETRIA-EXTRACCION-CAMPOS-FUENTE-DIAGNOSTICOS.md`

## Campos objetivo
- `faringe`
- `cad`
- `cai`
- `mtd`
- `mti`

## Restricciones
- No mezclar estos campos con el prediagnóstico.
- Ignorar la descripción audiométrica escrita en el formato; no debe extraerse ni persistirse.
- Mantener compatibilidad con snapshots viejos.

## Validación pedida
- Probar con una Audiometría del formato AMI que sí traiga esos campos.
- Confirmar que los valores capturados renderizan correctamente.
- Generar checkpoint.