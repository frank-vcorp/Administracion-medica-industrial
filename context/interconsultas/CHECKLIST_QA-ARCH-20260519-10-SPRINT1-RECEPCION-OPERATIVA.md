# CHECKLIST QA — Sprint 1 Recepción Operativa

- ID: DOC-20260519-01
- Fecha: 2026-05-19
- Basado en: `context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md`
- Implementación: `context/checkpoints/CHK_IMPL-20260519-10.md`
- Dictamen QA: `context/interconsultas/DICTAMEN_INFRA-20260519-02-QA-SPRINT1-RECEPCION-OPERATIVA.md`

## Prerrequisitos

1. La base PostgreSQL del entorno está disponible.
2. El schema Prisma ya fue sincronizado con los nuevos campos del sprint.
3. El usuario de prueba tiene acceso a agenda/recepción.
4. Existe al menos una cita pendiente con trabajador asociado.

## Casos QA Manual

### 1. QR actual de check-in sigue funcionando

1. Abrir una cita existente con QR actual.
2. Escanear o procesar el QR de check-in existente.
3. Confirmar que el check-in se completa sin usar el QR operativo.
4. Validar que no hay regresión en el flujo previo.

### 2. QR operativo mínimo se muestra separado

1. Abrir el ticket o pase de una cita.
2. Confirmar que existe una sección separada para QR operativo.
3. Validar que el QR operativo no reemplaza al QR actual de check-in.
4. Revisar también la vista de cita en agenda.

### 3. Captura nueva de identificación

1. Abrir el modal de corroboración.
2. Seleccionar un tipo de identificación oficial válida.
3. Capturar frente.
4. Capturar reverso opcionalmente.
5. Cerrar recepción.
6. Confirmar que el check-in continúa y no muestra errores.

### 4. Reutilización de última identificación válida

1. Usar un trabajador que ya tenga evidencia previa válida.
2. Abrir el modal de corroboración.
3. Elegir reutilizar evidencia previa.
4. Cerrar recepción.
5. Confirmar que el check-in continúa y queda trazabilidad correcta.

### 5. Comentario operativo obligatorio sin captura normal

1. Abrir el modal de corroboración.
2. Elegir continuidad sin captura normal.
3. Intentar guardar sin motivo o sin comentario.
4. Confirmar que el sistema exige los datos obligatorios.
5. Completar motivo y comentario.
6. Confirmar que el check-in continúa sin bloqueo.

### 6. Corrección controlada de nombre

1. Abrir una cita con discrepancia de nombre.
2. Corregir únicamente el nombre completo.
3. Cerrar recepción.
4. Confirmar que el trabajador quedó actualizado.
5. Confirmar que la trazabilidad y el resultado de corroboración quedaron registrados.

### 7. Never-block

1. Repetir el caso de comentario operativo obligatorio.
2. Verificar que, aun sin captura normal, el flujo no bloquea el check-in.
3. Confirmar que el sistema registra comentario y motivo.

## Criterio de Salida

1. El QR actual no presenta regresión.
2. El QR operativo aparece en los puntos definidos.
3. Los tres modos del modal funcionan.
4. La evidencia del ingreso queda asociada a la cita.
5. La última identificación válida queda disponible para reutilización.
6. El comentario operativo obligatorio permite continuar sin bloqueo.
7. No aparecen errores de runtime asociados a columnas faltantes.
