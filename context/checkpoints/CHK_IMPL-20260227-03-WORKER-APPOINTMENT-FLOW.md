# Checkpoint: Flujo Integrado Trabajador -> Cita

**ID:** IMPL-20260227-03-WORKER-APPOINTMENT-FLOW
**Fecha:** 2026-02-27
**Autor:** GitHub Copilot (SOFIA - Builder)

## Descripción del Cambio
Se implementó una comunicación directa entre el modal de creación de trabajadores (`WorkerFormModal`) y el modal de citas (`AppointmentFormModal`) mediante eventos de ventana.

### Cambios Realizados

1.  **WorkerFormModal.tsx:**
    -   Se reemplazó la redirección de página (`Link`) por un disparador de evento personalizado `open-appointment-modal`.
    -   El evento transporta el `workerId` y `branchId` (default) del trabajador recién creado.

2.  **AppointmentFormModal.tsx:**
    -   Se agregó un listener global para el evento `open-appointment-modal`.
    -   Se implementó lógica par abrir el modal automáticamente y **pre-seleccionar** al trabajador y su sucursal una vez que la lista de trabajadores se carga asíncronamente.
    -   Se convirtió el `select` de trabajadores en un componente controlado (`value={selectedWorker?.id || ''}`) para reflejar la selección programática.

## Justificación
Mejora significativa de UX: el usuario puede crear un trabajador y agenda su cita inmediatamente sin perder el contexto de la página actual ni tener que navegar o buscar nuevamente al trabajador en la lista.

## Validación
- [x] Modal de trabajador emite evento.
- [x] Modal de citas escucha evento y se abre (`isOpen=true`).
- [x] Se pre-selecciona el trabajador correcto en el dropdown.
- [x] Se pre-selecciona la sucursal correcta.
