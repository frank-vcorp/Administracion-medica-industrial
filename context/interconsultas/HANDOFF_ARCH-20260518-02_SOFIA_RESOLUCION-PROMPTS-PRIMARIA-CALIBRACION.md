# HANDOFF ARCH-20260518-02 -> SOFIA

## Contexto

El usuario detectó correctamente una deuda de arquitectura: mientras los prompts del backend sigan hardcodeados como mecanismo principal, la calibración por prueba no gobierna realmente el runtime.

## Objetivo

Hacer que la resolución de prompts use primero la calibración por prueba (`aiCalibration`) y deje el hardcode del backend como fallback mínimo general para todos los estudios.

## Fuente de Verdad

- `context/SPECs/SPEC_ARCH-20260518-02-RESOLUCION-PROMPTS-CALIBRACION-PRIMARIA-Y-FALLBACK-GENERAL.md`

## Alcance mínimo

1. Resolver prompts de extracción y clínica desde `aiCalibration` cuando existan.
2. Mantener fallback hardcodeado mínimo en backend solo si falta calibración válida.
3. Registrar en auditoría la fuente real del prompt usado.
4. Aplicar la política a todos los estudios.

## Restricciones

1. No romper estudios sin calibración aún cargada.
2. No simular `prompt_version` de calibración si en realidad corrió el fallback.
3. No dejar prompts específicos hardcodeados como fuente principal.

## Validación pedida

1. Probar un caso con calibración personalizada guardada y confirmar que esa versión corre realmente.
2. Probar un caso sin calibración y confirmar que entra el fallback general.
3. Confirmar que la auditoría distingue entre ambos caminos.