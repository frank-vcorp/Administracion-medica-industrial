# Checkpoint: Soporte Multi-Sucursal en Citas

**ID:** IMPL-20260227-02-BRANCH-SUPPORT
**Fecha:** 2026-02-27
**Autor:** GitHub Copilot (SOFIA - Builder)

## Descripción del Cambio
Se implementó el soporte completo para múltiples sucursales en el módulo de Gestión de Citas (`/appointments`).

### Cambios Realizados

1.  **Filtrado en Agenda (`appointments/page.tsx`):**
    -   Se agregó un selector de sucursal en la cabecera.
    -   La vista de calendario ahora filtra las citas según la sucursal seleccionada.
    -   Persistencia de estado local para la sucursal activa.
    -   Pre-selección automática de la primera sucursal disponible.

2.  **Auto-selección en Creación de Cita (`AppointmentFormModal.tsx`):**
    -   Se actualizó la lógica para que al seleccionar un **Trabajador**, el sistema detecte automáticamente la sucursal predeterminada de su **Empresa**.
    -   El campo "Sucursal" se auto-completa, reduciendo errores humanos y clics.

3.  **Backend (`worker.actions.ts`):**
    -   Se optimizó `getWorkers()` para retornar también el `defaultBranchId` de la empresa asociada.

## Justificación
Cumplimiento de requerimiento de usuario para operar con múltiples sedes y simplificar el flujo de agendamiento vinculando trabajadores a sus sedes corporativas correspondientes.

## Validación
- [x] Selector de sucursal visible en `/appointments`.
- [x] Cambio de sucursal recarga la agenda (via `getAppointments` con filtro).
- [x] Modal de nueva cita auto-selecciona la sucursal al elegir trabajador.
