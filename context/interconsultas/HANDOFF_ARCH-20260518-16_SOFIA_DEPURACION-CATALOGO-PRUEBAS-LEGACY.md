# HANDOFF ARCH-20260518-16 a SOFIA - Depuración de Catálogo de Pruebas Legacy

## Objetivo

Quitar del catálogo visible las pruebas legacy no vigentes sin borrar registros históricos.

## Hallazgo confirmado

El catálogo sigue mostrando entradas que ya no deberían operar como pruebas seleccionables generales:

- Somatometría (Peso, Talla, Signos Vitales)
- Agudeza Visual

## Requisitos

1. No hacer hard delete de `MedicalTest`.
2. Ocultar o excluir del catálogo visible esas pruebas legacy.
3. Mantener trazabilidad histórica y relaciones previas.
4. Conservar visibles `Examen Médico` y `Audiometría`.
5. Aplicar la solución más pequeña y segura posible.

## Hipótesis local

La superficie visible del catálogo se alimenta de `getMedicalTests()` sin filtro de vigencia/visibilidad. La corrección mínima probable será agregar un filtro explícito de catálogo visible o un flag persistente de selección.

## Validación mínima esperada

- verificación enfocada de la lista de catálogo después del cambio
- validación de que perfiles/historial no se rompen

## Referencias

- `frontend/src/actions/medical-profiles.ts`
- `frontend/prisma/schema.prisma`
- `context/SPECs/SPEC_ARCH-20260518-16-DEPURACION-CATALOGO-PRUEBAS-LEGACY.md`