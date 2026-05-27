# SPEC: Slice A — Trazabilidad de Convergencia a Event

**ID:** ARCH-20260527-11  
**Fecha:** 2026-05-27  
**Estado:** LISTA PARA IMPLEMENTACION  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta  
**SPEC madre:** `context/SPECs/SPEC_ARCH-20260527-10-ADMISION-TRES-FLUJOS-Y-CONVERGENCIA-A-EVENT.md`

---

## 1. Objetivo

Implementar el primer slice técnico derivado del marco de admisión para que todo `MedicalEvent` preserve de forma explícita su **origen de ingreso** y, cuando aplique, su vínculo opcional con `Project`, sin alterar todavía los flujos de citas, alta masiva ni admisión externa.

Este slice no abre nuevas puertas de entrada. Solo deja lista la **trazabilidad estructural mínima** para que los siguientes slices operativos converjan en la misma entidad clínica sin perder procedencia.

---

## 2. Problema puntual

Hoy `MedicalEvent` ya es la ancla del workspace clínico, pero no puede responder de forma estructurada:

1. si provino de una cita programada;
2. si provino de un flujo empresarial masivo;
3. si provino de ingreso externo sin cita;
4. si está asociado a un `Project`;
5. qué usuario realizó la admisión.

Esto impide que la convergencia de los tres flujos sea auditable y vuelve más costosos los siguientes slices, porque todavía no existe una superficie de datos estable para consumir esa procedencia.

---

## 3. Alcance

### Sí entra

1. Extender `MedicalEvent` con metadatos explícitos de admisión.
2. Persistir esos metadatos al crear eventos nuevos.
3. Mantener compatibilidad con eventos existentes sin romper lectura actual.
4. Mostrar la procedencia mínima en recepción.
5. Mostrar la procedencia mínima en la vista del evento clínico.

### No entra

1. Crear el carril operativo por `Project`.
2. Cambiar `ProjectWorker`.
3. Cambiar la UX de `Appointment`.
4. Implementar admisión externa sin empresa.
5. Rediseñar check-in, corroboración o el workspace clínico.

---

## 4. Decisión de Modelo

`MedicalEvent` debe incorporar los siguientes campos nuevos:

### 4.1 `intakeSource`

Tipo: `String` o `enum` Prisma, según la opción más barata y consistente para el slice.

Catálogo obligatorio inicial:

1. `APPOINTMENT`
2. `PROJECT_PRE_REGISTERED`
3. `PROJECT_SAME_DAY`
4. `EXTERNAL_WALK_IN`
5. `DIRECT_RECEPTION`

**Decisión del slice:** se permite `DIRECT_RECEPTION` como valor transitorio para compatibilizar el `CheckInModal` actual, que hoy crea `MedicalEvent` directo sin contexto adicional.

### 4.2 `projectId`

Tipo: `String?`

Uso:

1. `null` para eventos de cita o ingreso directo.
2. valor presente solo si el evento se originó dentro de una visita o campaña modelada por `Project`.

### 4.3 `intakeCreatedByUserId`

Tipo: `String?`

Uso:

1. guardar el usuario que realizó la admisión si existe sesión disponible;
2. no bloquear si el flujo actual no puede resolverlo todavía;
3. permitir `null` para datos históricos y compatibilidad.

---

## 5. Reglas de Persistencia

### Regla 1

Todo `MedicalEvent` nuevo debe persistir `intakeSource`.

### Regla 2

Los eventos creados desde el flujo actual de recepción manual (`CheckInModal`) deben guardarse con:

1. `intakeSource = DIRECT_RECEPTION`
2. `projectId = null`
3. `appointmentId = null`

### Regla 3

Los eventos creados desde check-in de cita deben seguir preservando `appointmentId` y deben mapearse a:

1. `intakeSource = APPOINTMENT`

### Regla 4

No se deben migrar uno por uno los eventos históricos con inferencia compleja. El slice debe ser barato y seguro.

Regla de compatibilidad para históricos:

1. si el evento ya tiene `appointmentId`, la UI puede mostrar “Programado” como fallback visual;
2. si no tiene `appointmentId` ni `intakeSource`, la UI puede mostrar “Ingreso legado”;
3. no se exige backfill destructivo de datos viejos en esta fase.

---

## 6. Superficie Técnica Esperada

### Archivo ancla inicial

`frontend/prisma/schema.prisma`

### Archivos exactos a crear o modificar

1. `frontend/prisma/schema.prisma`
2. `frontend/prisma/migrations/[timestamp]_add_intake_trace_to_medical_event/`
3. `frontend/src/actions/event.actions.ts`
4. `frontend/src/app/reception/page.tsx`
5. `frontend/src/app/events/[id]/page.tsx`

### Máximo de archivos permitidos

Máximo 5 superficies de código más la migración Prisma indicada arriba. Si necesitas tocar un sexto archivo funcional, detente.

---

## 7. Diseño de UI mínimo

### 7.1 Recepción

En las tarjetas del tablero de recepción debe mostrarse una etiqueta pequeña de origen legible.

Mapa mínimo esperado:

1. `APPOINTMENT` → `Programado`
2. `PROJECT_PRE_REGISTERED` → `Proyecto`
3. `PROJECT_SAME_DAY` → `Proyecto hoy`
4. `EXTERNAL_WALK_IN` → `Externo`
5. `DIRECT_RECEPTION` → `Recepción`
6. faltante legado → `Legado`

### 7.2 Vista del evento

En la página del evento debe mostrarse un bloque mínimo de contexto administrativo con:

1. origen de ingreso;
2. proyecto si existe;
3. cita asociada si existe.

No se pide rediseño. Solo visibilidad operativa mínima.

---

## 8. Detalle de Implementación Esperado

### 8.1 Prisma

Agregar campos opcionales en `MedicalEvent`:

1. `intakeSource`
2. `projectId`
3. `intakeCreatedByUserId`

Y relaciones mínimas necesarias para que Prisma compile si `projectId` o `intakeCreatedByUserId` se modelan con FK.

### 8.2 `event.actions.ts`

`createEvent(formData)` debe:

1. obtener sesión cuando sea posible;
2. persistir `intakeSource = DIRECT_RECEPTION` por defecto;
3. guardar `intakeCreatedByUserId` cuando el usuario esté autenticado;
4. no romper el flujo actual del modal.

### 8.3 Compatibilidad con citas

Si existe un flujo ya consolidado que crea `MedicalEvent` desde cita en otro archivo, este slice debe dejar explícito el valor `APPOINTMENT` en esa creación solo si el archivo ya es alcanzable dentro del límite. Si no cabe dentro del slice sin abrir más archivos, la UI debe usar fallback por `appointmentId` y documentarse como deuda inmediata del Slice B.

**Decisión de contención:** no abrir más de 5 archivos por perseguir exhaustividad. Primero cerrar el contrato mínimo de datos.

---

## 9. Criterios de Aceptación

1. `MedicalEvent` soporta persistencia explícita de origen de ingreso.
2. El flujo manual actual de recepción crea eventos con `DIRECT_RECEPTION` sin romperse.
3. La recepción muestra procedencia visible para eventos nuevos.
4. La vista del evento muestra procedencia visible y contexto opcional de cita/proyecto.
5. Los eventos históricos siguen abriendo sin error.
6. La migración Prisma compila y no obliga backfill riesgoso.

---

## 10. Validación Esperada

Validación exacta del slice:

1. `cd frontend && pnpm exec prisma validate`
2. `cd frontend && pnpm exec eslint src/actions/event.actions.ts src/app/reception/page.tsx src/app/events/[id]/page.tsx`

Validación manual mínima:

1. crear ingreso desde `CheckInModal`;
2. verificar badge de origen en recepción;
3. abrir el evento y confirmar que muestra procedencia sin romper el workspace.

---

## 11. Condición de Detención

Si para resolver este slice se vuelve necesario:

1. rediseñar `Appointment`;
2. tocar `ProjectWorker`;
3. abrir un sexto archivo funcional;
4. introducir más de una ruta nueva;

SOFIA debe detenerse y devolver `BLOQUEO DE CONTEXTO`.

---

## 12. Handoff previsto

Este slice está autorizado para implementación directa por SOFIA bajo restricción estricta de alcance.