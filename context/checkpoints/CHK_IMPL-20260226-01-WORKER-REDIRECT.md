# Checkpoint: Redirección de Flujo de Trabajador

**ID:** IMPL-20260226-01-WORKER-REDIRECT
**Fecha:** 2026-02-26
**Autor:** GitHub Copilot (SOFIA - Builder)

## Descripción del Cambio
Se modificó el flujo posterior a la creación exitosa de un trabajador (`WorkerFormModal.tsx`). Anteriormente, el sistema sugería ir a "Recepción" (`/reception`) para el check-in. A solicitud del usuario, ahora redirige al módulo de "Gestión de Citas" (`/appointments`) para agendar una consulta inmediatamente.

## Archivos Modificados
- `frontend/src/components/WorkerFormModal.tsx`: Se actualizó el componente `Link` en el modal de éxito.

## Justificación
Mejora de UX solicitada explícitamente para agilizar el proceso de agendamiento tras dar de alta un nuevo trabajador.

## Validación
- [x] Compilación estática (validada implícitamente por el editor).
- [x] Lógica de flujo: El modal de éxito ahora muestra "Agendar Consulta" y apunta a `/appointments`.
