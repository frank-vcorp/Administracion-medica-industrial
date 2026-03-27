# Checkpoint de Arquitectura

- **ID:** `ARCH-20260327-06`
- **Fecha:** `2026-03-27`
- **Estado:** `Ajuste UX aplicado`
- **Artefacto relacionado:** `context/SPECs/SPEC_ARCH-20260327-01-WORKSPACE-IA-DOBLE-COLUMNA.md`

## Ajuste aplicado
- La cabecera interna del workspace dejó de repetir el nombre del trabajador.
- El nombre queda como fuente única en la cabecera global del evento.
- La cabecera interna ahora funciona como barra operativa del workspace y conserva contexto secundario: puesto, empresa, perfil y progreso.

## Motivo
- En la vista actual el nombre del trabajador aparecía dos veces en franjas consecutivas, generando redundancia visual y desperdicio de atención.
- Unificar la identidad principal en una sola cabecera mejora claridad y limpia el inicio del workspace sin perder contexto operativo.