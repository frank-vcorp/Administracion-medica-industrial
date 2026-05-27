# SPEC: Slice B — Recepción por Project para Sin Cita Empresarial

**ID:** ARCH-20260527-12  
**Fecha:** 2026-05-27  
**Estado:** LISTA PARA IMPLEMENTACION  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta  
**SPEC madre:** `context/SPECs/SPEC_ARCH-20260527-10-ADMISION-TRES-FLUJOS-Y-CONVERGENCIA-A-EVENT.md`  
**Depende de:**
- `context/SPECs/SPEC_ARCH-20260519-11-ALTA-MASIVA-TRABAJADORES.md`
- `context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md`
- `context/SPECs/SPEC_ARCH-20260519-16-CALENDARIO-PROYECTOS-VISITAS.md`
- `context/SPECs/SPEC_ARCH-20260527-11-SLICE-A-TRAZABILIDAD-CONVERGENCIA-EVENT.md`

---

## 1. Objetivo

Convertir `Project` + `ProjectWorker` en un **carril operativo real de recepción** para el flujo de sin cita empresarial con pre-registro previo, permitiendo ver quién ya está cargado, quién ya llegó, quién ya ingresó al workspace clínico y quién sigue pendiente, sin pasar por agenda normal ni crear citas artificiales.

Este slice solo cubre el caso **2A — Sin cita empresarial con pre-registro previo**. No cubre todavía el alta rápida del mismo día.

---

## 2. Problema puntual

Hoy el frente `Project` ya resolvió dos capas importantes:

1. calendario operativo de campañas o visitas médicas;
2. alta masiva de trabajadores asociados al proyecto.

Pero sigue faltando la capa crítica de recepción:

1. no existe una cola operativa por proyecto;
2. no se ve quién ya llegó físicamente;
3. no se ve quién ya fue ingresado al workspace clínico;
4. no existe check-in contextual desde proyecto hacia `MedicalEvent`;
5. recepción sigue obligada a usar ingreso directo genérico o agenda para casos que ya deberían vivir en carril masivo empresarial.

---

## 3. Alcance

### Sí entra

1. Extender `ProjectWorker` con estado de recepción mínimo.
2. Mostrar un panel de recepción por proyecto dentro de la superficie de proyectos existente.
3. Listar trabajadores del proyecto con su estado operativo.
4. Permitir marcar llegada e ingreso al workspace clínico desde el proyecto.
5. Crear `MedicalEvent` contextualizado al proyecto para el trabajador seleccionado.
6. Reutilizar el workspace clínico actual sin cambios estructurales posteriores.

### No entra

1. Alta rápida del mismo día para trabajadores aún no registrados.
2. Admisión externa sin empresa.
3. Rediseño general de `/reception`.
4. Generación de `Appointment` derivada.
5. Reasignación masiva de sucursal o cambios de capacidad.
6. Edición inline del trabajador dentro del panel operativo.

---

## 4. Decisión de Diseño

### Regla principal

El proyecto deja de ser solo calendario administrativo y pasa a ser también **contenedor operativo de recepción** para campañas empresariales ya cargadas.

### Regla de convergencia

Desde el panel de proyecto, recepción debe poder abrir un `MedicalEvent` para un trabajador pre-registrado sin pasar por `Appointment`.

### Regla de contención

Este slice no crea una ruta nueva tipo `/projects/[id]/reception` si no es estrictamente necesaria. La opción preferida es reutilizar la superficie actual de `/projects` con panel contextual, drawer o modal operativo.

---

## 5. Evolución de Modelo

`ProjectWorker` debe evolucionar de join table simple a join table operativa.

### Campos nuevos obligatorios

1. `receptionStatus`
2. `arrivedAt`
3. `eventId`

### Catálogo mínimo de `receptionStatus`

1. `PENDING` — cargado al proyecto pero aún no recibido
2. `ARRIVED` — ya llegó físicamente a recepción
3. `CHECKED_IN` — ya se creó `MedicalEvent`

### Reglas

1. Todo `ProjectWorker` histórico debe quedar compatible con default `PENDING`.
2. `eventId` es opcional y solo existe cuando el trabajador ya fue ingresado a clínica.
3. `arrivedAt` es opcional y se llena al marcar llegada.

---

## 6. Flujo Operativo Esperado

### Caso cubierto: visita o campaña ya pre-registrada

1. Usuario entra a `/projects`.
2. Selecciona un proyecto activo o próximo.
3. Abre panel de recepción del proyecto.
4. Ve listado de trabajadores vinculados a ese proyecto.
5. Para cada trabajador puede:
   - dejarlo en pendiente
   - marcarlo como llegado
   - ingresarlo a clínica
6. Al ingresar a clínica:
   - se crea `MedicalEvent`
   - `intakeSource = PROJECT_PRE_REGISTERED`
   - `projectId` queda ligado al evento
   - `billingCompanyId` debe tomar la empresa del proyecto si el modelo ya lo permite
   - `ProjectWorker.receptionStatus = CHECKED_IN`
   - `ProjectWorker.eventId` apunta al evento creado
7. El usuario puede abrir el evento clínico resultante y continuar por el mismo workspace común.

---

## 7. Superficie Técnica Esperada

### Archivo ancla inicial

`frontend/src/components/ProjectsCalendar.tsx`

### Archivos exactos a crear o modificar

1. `frontend/prisma/schema.prisma`
2. `frontend/prisma/migrations/[timestamp]_project_worker_reception_queue/`
3. `frontend/src/actions/project.actions.ts`
4. `frontend/src/components/ProjectsCalendar.tsx`
5. `frontend/src/actions/event.actions.ts`

### Máximo de archivos permitidos

Máximo 5 superficies de código más la migración Prisma indicada arriba. Si necesitas abrir un sexto archivo funcional o una ruta nueva de detalle, detente.

---

## 8. Contrato de Acciones

### 8.1 Nueva query operativa en `project.actions.ts`

Debe existir una action para obtener el tablero de recepción de un proyecto, incluyendo como mínimo:

1. id y nombre del proyecto
2. empresa
3. sucursal o `unitRef`
4. trabajadores vinculados
5. `receptionStatus`
6. `arrivedAt`
7. `eventId` si existe

### 8.2 Mutación: marcar llegada

Debe existir una mutación acotada que:

1. reciba `projectId` y `workerId`
2. actualice `receptionStatus = ARRIVED`
3. llene `arrivedAt = now()` si estaba vacío
4. no cree evento todavía

### 8.3 Mutación: ingreso clínico desde proyecto

Debe existir una mutación acotada que:

1. reciba `projectId` y `workerId`
2. valide que el vínculo `ProjectWorker` exista
3. cree `MedicalEvent`
4. setee `intakeSource = PROJECT_PRE_REGISTERED`
5. setee `projectId`
6. setee `billingCompanyId` con la empresa del proyecto si aplica
7. actualice `ProjectWorker.receptionStatus = CHECKED_IN`
8. guarde `eventId`
9. devuelva el `eventId` para navegación inmediata

### 8.4 Regla de idempotencia mínima

Si `ProjectWorker.eventId` ya existe, la acción de ingreso clínico no debe crear un segundo evento. Debe devolver el ya existente.

---

## 9. Diseño de UI mínimo

### 9.1 Entrada al panel operativo

En la tarjeta o fila del proyecto debe existir una acción visible de `Recepción` o `Ver cola`.

### 9.2 Contenido mínimo del panel

Para cada trabajador mostrar:

1. nombre completo
2. empresa implícita por proyecto
3. estado de recepción
4. hora de llegada si existe
5. acción contextual según estado

### 9.3 Acciones por fila

1. `Marcar llegada` cuando esté en `PENDING`
2. `Ingresar a clínica` cuando esté en `PENDING` o `ARRIVED`
3. `Abrir evento` cuando ya esté en `CHECKED_IN`

### 9.4 Métricas mínimas del panel

Mostrar contadores:

1. Pendientes
2. Llegados
3. Ingresados

No se pide drag-and-drop ni tablero kanban completo en este slice.

---

## 10. Validaciones y Reglas de Negocio

1. Solo roles de operación ya autorizados en proyectos/recepción pueden usar este panel.
2. No se debe crear `Appointment` como paso intermedio.
3. No se debe perder el vínculo con `Project` al crear el evento.
4. No se debe permitir más de un `MedicalEvent` activo por `ProjectWorker` dentro de este slice.
5. Si el proyecto no tiene `branchId`, la acción debe usar la sucursal operativa ya definida por el proyecto o detenerse con error legible. No inventar sucursal silenciosa.

---

## 11. Criterios de Aceptación

1. Un proyecto con trabajadores cargados puede abrir una cola operativa de recepción.
2. Cada `ProjectWorker` muestra su estado de recepción.
3. Recepción puede marcar llegada sin crear evento.
4. Recepción puede ingresar a clínica desde proyecto sin crear cita.
5. El ingreso crea un `MedicalEvent` reutilizando el workspace clínico existente.
6. El vínculo entre evento y proyecto queda preservado.
7. El mismo trabajador no genera eventos duplicados desde el proyecto.

---

## 12. Validación Esperada

Validación exacta del slice:

1. `cd frontend && pnpm exec prisma validate`
2. `cd frontend && pnpm exec eslint src/actions/project.actions.ts src/actions/event.actions.ts src/components/ProjectsCalendar.tsx`

Validación manual mínima:

1. abrir proyecto con trabajadores importados;
2. marcar uno como llegado;
3. ingresarlo a clínica;
4. confirmar que aparece evento creado y que abre `/events/[id]`.

---

## 13. Condición de Detención

Si para resolver este slice se vuelve necesario:

1. abrir flujo de alta rápida del mismo día;
2. rediseñar `/reception` completo;
3. tocar `Appointment`;
4. tocar admisión externa;
5. abrir un sexto archivo funcional o una ruta nueva de detalle;

SOFIA debe detenerse y devolver `BLOQUEO DE CONTEXTO`.

---

## 14. Ejecución para SOFIA

### Datos existentes a reutilizar

1. `Project`
2. `ProjectWorker`
3. `ProjectsCalendar`
4. `BulkWorkerImportModal`
5. `MedicalEvent`
6. `events/[id]`

### Datos faltantes a crear

1. estado operativo en `ProjectWorker`
2. query operativa del proyecto
3. mutación de llegada
4. mutación de ingreso clínico contextual por proyecto

### Condición explícita

No explorar “qué más debería hacer Project”. Solo cerrar recepción para pre-registrados.