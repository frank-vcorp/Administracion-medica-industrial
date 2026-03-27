# Checkpoint de Arquitectura

- **ID:** `ARCH-20260327-02`
- **Fecha:** `2026-03-27`
- **Estado:** `Micro-ajustes aplicados sobre implementación de SOFIA`
- **Artefacto relacionado:** `context/SPECs/SPEC_ARCH-20260327-01-WORKSPACE-IA-DOBLE-COLUMNA.md`

## Ajustes aplicados
- Se amplió el canvas principal del evento para que el layout bifurcado aproveche mejor el ancho disponible en desktop.
- Se fijó la columna derecha del workspace documental en desktop con comportamiento sticky para mantener visible el visor y el panel raw durante el scroll de la columna operativa.

## Motivo
- El layout doble columna ya estaba implementado, pero el ancho máximo del contenedor general seguía limitando el beneficio visual.
- La columna de evidencia perdía utilidad si desaparecía durante el scroll de la revisión médica y del prediagnóstico.

## Riesgo
- Bajo. No se altera lógica clínica, persistencia ni contratos de datos.
- El ajuste se limita a layout y ergonomía de revisión.