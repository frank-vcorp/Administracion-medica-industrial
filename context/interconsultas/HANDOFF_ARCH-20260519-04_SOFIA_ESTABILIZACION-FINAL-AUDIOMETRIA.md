# HANDOFF ARCH-20260519-04 → SOFIA

## Objetivo

Ejecutar el slice A de estabilización final de Audiometría en frontend, sin tocar backend.

## Problema acotado

Con el commit `9346708` la UI ya volvió a mostrar la tabla bilateral, pero siguen tres defectos visuales:

1. El payload vigente trae `pta` y el schema todavía privilegia `pta_visible`.
2. `notas_calidad` puede llegar como string plano, arreglo o estructura con `descripcion`.
3. El orden clínico de frecuencias debe incluir `125` y `1500`, no dejar `125` al final como extra.

## Corrección mínima esperada

1. Compatibilizar PTA para `pta` y `pta_visible`.
2. Compatibilizar `notas_calidad` para string, arreglo y objeto.
3. Actualizar `preferredOrder` bilateral al orden completo del formato real.
4. Mantener compatibilidad con snapshots históricos ya renderizados.

## Validación mínima

- `tsc --noEmit` en `frontend/`
- Verificación local de que el slice no rompe tipos

## Restricciones

- No tocar backend.
- No tocar prediagnóstico.
- Mantener el cambio en 1-2 archivos si es posible.