# Checkpoint de Arquitectura

- **ID:** `ARCH-20260327-04`
- **Fecha:** `2026-03-27`
- **Estado:** `Ajuste UX aplicado`
- **Artefacto relacionado:** `context/SPECs/SPEC_ARCH-20260327-01-WORKSPACE-IA-DOBLE-COLUMNA.md`

## Ajuste aplicado
- Se restauró el visor embebido para PDFs dentro del panel documental.
- El `iframe` ahora abre el PDF con parámetros para ocultar paneles laterales y priorizar el área del documento.
- Se conserva el enlace para abrir en pestaña nueva y se mantiene la vista previa de imágenes.

## Motivo
- El problema real no era el PDF embebido en sí, sino la columna lateral de miniaturas del visor nativo.
- Para revisión clínica conviene conservar el documento visible dentro del workspace, pero sin desperdiciar ancho en navegación lateral del PDF.