# Checkpoint de Arquitectura

- **ID:** `ARCH-20260327-07`
- **Fecha:** `2026-03-27`
- **Estado:** `Ajuste UX aplicado`
- **Artefacto relacionado:** `context/SPECs/SPEC_ARCH-20260327-01-WORKSPACE-IA-DOBLE-COLUMNA.md`

## Ajuste aplicado
- En modo workspace de expediente se eliminó la cabecera superior del AppShell que mostraba `Workspace de Papeleta` y `Modo enfocado por estudio`.
- La referencia de cuenta dejó de ocupar la cabecera superior y se movió al pie del menú lateral.
- El contenedor principal del workspace recibió padding más corto para que el contenido del estudio inicie antes.

## Motivo
- La combinación de cabecera global del shell, cabecera del evento y cabecera del workspace estaba consumiendo una fracción excesiva del viewport.
- En modo expediente la cabecera del shell no aporta suficiente valor para justificar esa altura.
- Reubicar la cuenta al sidebar mantiene acceso visual a la sesión sin competir con el contenido clínico.