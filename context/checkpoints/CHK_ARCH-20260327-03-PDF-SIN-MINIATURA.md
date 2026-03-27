# Checkpoint de Arquitectura

- **ID:** `ARCH-20260327-03`
- **Fecha:** `2026-03-27`
- **Estado:** `Ajuste UX aplicado`
- **Artefacto relacionado:** `context/SPECs/SPEC_ARCH-20260327-01-WORKSPACE-IA-DOBLE-COLUMNA.md`

## Ajuste aplicado
- Se eliminó la miniatura embebida para archivos PDF dentro del panel documental.
- El bloque conserva el nombre del archivo y la acción para abrirlo en una pestaña nueva.
- La vista previa de imágenes se mantiene, porque sí aporta validación visual inmediata.

## Motivo
- El embed de PDF estaba funcionando como miniatura de bajo valor y consumía demasiada altura útil del workspace.
- Para revisión clínica es más eficiente reservar ese espacio a extracción, raw y prediagnóstico, y abrir el PDF completo cuando se requiera.