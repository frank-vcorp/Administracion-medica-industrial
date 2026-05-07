# HANDOFF DE IMPLEMENTACION

- ID: ARCH-20260507-08
- Fecha: 2026-05-07
- Agente origen: INTEGRA - Arquitecto
- Agente destino: SOFIA - Builder
- Estado: Listo para implementacion
- SPEC fuente: context/SPECs/SPEC_ARCH-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md

## Objetivo

Implementar un cronograma persistente de papeleta para uso administrativo, con tabla dedicada, captura automatica de movimientos base y captura manual de incidencias admin, sin alterar el flujo clinico vigente.

## Alcance obligatorio V1

### 1. Modelo persistente

Crear tabla nueva tipo `PapeletaTimelineEntry` asociada a `MedicalEvent`, con soporte para:

1. evento
2. estudio opcional
3. tipo de movimiento
4. area
5. titulo
6. descripcion opcional
7. fecha efectiva del movimiento
8. creador opcional
9. visibilidad `ADMIN_ONLY`
10. metadata JSON opcional

### 2. Escritura automatica

Registrar entradas del cronograma cuando ocurran acciones ya existentes, al menos para:

1. inicio de estudio
2. muestra tomada
3. resultado registrado
4. estudio completado

Si Examen Medico ya tiene un punto claro de guardado reusable, agregar tambien `MEDICAL_EXAM_SAVED`.

### 3. Escritura manual admin

Permitir que un administrador agregue incidencias manuales no bloqueantes al cronograma.

### 4. Vista admin-only

Agregar un panel o vista del cronograma dentro del evento accesible solo para administradores, con lectura cronologica y filtros locales basicos.

## Restricciones

1. No romper la logica actual de `EventTest.status`.
2. No cambiar el flujo de atencion.
3. No exponer el cronograma a roles no administrativos.
4. No volver obligatoria la captura manual del cronograma.
5. Mantener la implementacion acotada a V1 operativa.

## Anclas tecnicas probables

1. frontend/prisma/schema.prisma
2. frontend/src/actions/event-test.actions.ts
3. frontend/src/services/medical-event.service.ts
4. frontend/src/app/events/[id]/page.tsx
5. frontend/src/components/clinical/PapeletaWorkspace.tsx

## Criterios de aceptacion minimos

1. La migracion Prisma deja disponible la tabla de cronograma.
2. Al menos cuatro movimientos base se registran automaticamente.
3. Un admin puede crear al menos una incidencia manual.
4. El cronograma se muestra solo en vista admin.
5. El flujo clinico previo sigue funcionando sin friccion extra.

## Validacion esperada

1. Ejecutar migracion y validacion local si el entorno lo permite.
2. Si no hay toolchain local, dejar constancia explicita.
3. Ejecutar qodo self-review si esta disponible.
4. Generar checkpoint de implementacion con archivos tocados, validacion y riesgos.

## Nota para SOFIA

Prioriza el valor operativo real sobre la sofisticacion visual. Esta iteracion debe dejar persistencia, cronologia y visibilidad administrativa, no analitica avanzada.