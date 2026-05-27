# SPEC: Admisión de Tres Flujos y Convergencia Unificada a Event

**ID:** ARCH-20260527-10  
**Fecha:** 2026-05-27  
**Estado:** LISTA PARA IMPLEMENTACION INCREMENTAL  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta  
**Depende de:**
- ARCH-20260519-10 — Recepción Operativa
- ARCH-20260519-11 — Alta Masiva de Trabajadores
- ARCH-20260519-12 — Entidad Project
- ARCH-20260506-07 — Agenda AMI basada en datos reales

---

## 1. Contexto y Problema

AMI ya tiene base funcional para citas programadas, recepción y workspace clínico por `MedicalEvent`, pero la operación real no entra por una sola puerta.

Hoy conviven o se vislumbran tres formas de ingreso:

1. **Programado empresarial** — trabajador ligado a empresa con cita previa.
2. **Sin cita empresarial** — trabajadores de empresa que llegan sin usar agenda normal, ya sea con pre-registro previo o con alta de lote el mismo día.
3. **Sin cita externo** — persona no afiliada a empresa que llega por laboratorio, estudio puntual o atención espontánea.

La discusión operativa ya dejó claro que el error sería crear tres workspaces clínicos distintos. La variación está en **admisión**, no en la ejecución clínica posterior.

El repositorio confirma además esta situación actual:

1. `MedicalEvent` ya es la ancla común del workspace clínico.
2. `Appointment` solo cubre bien el flujo programado empresarial y hoy exige `companyId` obligatorio.
3. `Project` + `ProjectWorker` ya resuelven buena parte del pre-registro masivo empresarial.
4. `Worker.companyId` ya admite `null`, por lo que el dominio puede representar pacientes externos, aunque la UI operativa aún no los trate como ciudadanos de primera clase.

---

## 2. Objetivo

Definir una arquitectura operativa de admisión con **tres flujos de entrada** que convergen de forma obligatoria al mismo workspace clínico basado en `MedicalEvent`, preservando trazabilidad de origen sin duplicar el flujo médico posterior.

---

## 3. Decisión Marco

### Regla principal

**Alta distinta, ejecución clínica unificada.**

Los tres flujos deben terminar creando o reutilizando el mismo tipo de entidad clínica de trabajo: `MedicalEvent`.

### Consecuencia funcional

1. No se crearán workspaces clínicos separados por origen.
2. La recepción podrá tener puertas de entrada distintas.
3. Una vez creado el `MedicalEvent`, el paciente seguirá el mismo recorrido operativo:
   - Sala de espera
   - Consultorio
   - Validación
   - Papeleta / estudios / dictamen

---

## 4. Definición de los Tres Flujos

### Flujo 1 — Programado empresarial

**Cuándo aplica**
- El trabajador pertenece a una empresa.
- Ya existe cita previa.
- La agenda normal sí representa bien el caso.

**Anclas existentes**
- `Appointment`
- corroboración de recepción
- `checkInAppointment()`
- `MedicalEvent` ligado a `appointmentId`

**Estado actual**
- Ya existe como flujo base operativo.

### Flujo 2 — Sin cita empresarial

**Cuándo aplica**
- El ingreso sí pertenece a una empresa.
- La agenda normal no es el carril correcto por volumen o dinámica operativa.

**Subflujo 2A — Con pre-registro previo**
- Los trabajadores ya fueron cargados por alta masiva.
- Ya existe `Project`.
- Los trabajadores ya están ligados mediante `ProjectWorker`.

**Subflujo 2B — Sin pre-registro previo**
- Llegan varios trabajadores de empresa sin haber sido cargados antes.
- Recepción debe poder crear un `Project` del día o reutilizar uno abierto.
- Recepción debe poder dar de alta en lote y luego atender desde la misma cola operativa.

**Estado actual**
- 2A tiene base fuerte ya implementada por `Project` + alta masiva.
- 2B todavía no está formalizado como flujo operativo completo.

### Flujo 3 — Sin cita externo

**Cuándo aplica**
- La persona no pertenece a una empresa cliente.
- Llega por laboratorio, estudio puntual o atención espontánea.

**Regla de dominio**
- No se debe obligar empresa falsa.
- No se debe reutilizar `Project` para externos.
- Debe poder existir `Worker` con `companyId = null`.

**Estado actual**
- El dominio lo permite.
- La capa de admisión/citas todavía no lo trata correctamente.

---

## 5. Contrato de Convergencia hacia Event

Esta sección congela el contrato operativo exacto que todos los flujos deben respetar.

### 5.1 Entidad de convergencia obligatoria

Los tres flujos deben desembocar en un `MedicalEvent`.

### 5.2 Campos mínimos garantizados al momento de converger

Todo flujo que termine en atención clínica debe crear un `MedicalEvent` con al menos:

1. `workerId`
2. `branchId`
3. `status = CHECKED_IN`
4. `checkInDate = now()`

### 5.3 Campos condicionales según origen

1. `appointmentId`
   - **Obligatorio** para Flujo 1.
   - **Nulo** para Flujo 2 y Flujo 3, salvo que en una fase futura se decida generar cita derivada explícita.

2. `billingCompanyId`
   - **Esperado** en Flujo 1 y Flujo 2 cuando la empresa es conocida y corresponde facturación empresarial.
   - **Nulo** por defecto en Flujo 3, salvo convenio posterior.

### 5.4 Contexto de origen que no debe perderse

Aunque todos converjan al mismo workspace, el sistema debe preservar la procedencia del ingreso.

Se define el catálogo operativo mínimo de origen:

1. `APPOINTMENT`
2. `PROJECT_PRE_REGISTERED`
3. `PROJECT_SAME_DAY`
4. `EXTERNAL_WALK_IN`

### 5.5 Requisito de trazabilidad adicional

La convergencia no queda completa si el `MedicalEvent` no puede responder:

1. de qué puerta de admisión provino;
2. si venía de un `Appointment` o de un `Project`;
3. si fue un externo sin empresa;
4. quién realizó la admisión.

Por lo tanto, el primer slice técnico derivado de esta SPEC debe agregar persistencia explícita de procedencia para `MedicalEvent` y, cuando aplique, referencia opcional a `Project`.

---

## 6. Reglas de Enrutamiento Operativo

### Regla 1 — Programado empresarial

Si existe cita previa y el caso no rompe la agenda, entra por Flujo 1.

### Regla 2 — Sin cita empresarial individual o muy bajo volumen

Si llega 1 o 2 trabajadores de empresa sin cita y la operación lo tolera, se puede permitir ingreso por carril simplificado, pero la meta de producto no es forzar agenda para todo caso aislado.

### Regla 3 — Sin cita empresarial masivo

Si llega grupo empresarial que ya no cabe de forma natural en la agenda normal, entra por Flujo 2.

Ejemplos típicos:
- campaña empresarial
- visita en planta
- bloque de 10 trabajadores no pre-registrados
- visita corporativa con perfil homogéneo

### Regla 4 — Sin cita externo

Si la persona no pertenece a empresa cliente y llega por estudio o laboratorio, entra por Flujo 3.

---

## 7. Qué Cambia y Qué No Cambia

### Cambia en admisión

1. La puerta de entrada.
2. La necesidad o no de `Appointment`.
3. La necesidad o no de `Project`.
4. La obligatoriedad o no de empresa.
5. La forma de capturar al paciente/trabajador.

### No cambia después de crear Event

1. El workspace clínico.
2. La vista de `events/[id]`.
3. El circuito sala → consultorio → validación.
4. La persistencia de examen médico, laboratorios, estudios y dictamen.
5. La lógica clínica posterior al check-in.

---

## 8. Diseño de Superficies

### Superficies existentes que se reutilizan

1. `/appointments`
2. `/reception`
3. `/events/[id]`
4. `/projects`
5. `CheckInModal`
6. acciones de creación de `MedicalEvent`

### Superficies nuevas o extendidas requeridas

1. **Recepción: selector explícito de puerta de entrada**
   - Programado empresarial
   - Sin cita empresarial
   - Sin cita externo

2. **Carril operativo por Project**
   - para atender pre-registrados
   - para alta rápida del mismo día

3. **Admisión externa sin empresa**
   - búsqueda o alta mínima de persona externa
   - selección de sucursal
   - selección de estudio o servicio inicial cuando aplique

---

## 9. Cambios de Modelo Requeridos

### 9.1 `MedicalEvent`

Se aprueba extender `MedicalEvent` con trazabilidad explícita de origen.

Campos mínimos esperados en SPEC hija:

1. `intakeSource` o equivalente
2. `projectId` opcional
3. referencia al usuario de admisión si no basta con auditoría existente

### 9.2 `ProjectWorker`

Para cerrar bien Flujo 2, `ProjectWorker` debe evolucionar de simple join table a join table operativa.

Campos esperados en SPEC hija:

1. estado de recepción
2. hora de llegada opcional
3. referencia al `MedicalEvent` cuando ya ingresó

### 9.3 `Appointment`

No debe seguir siendo la entidad obligatoria para cualquier ingreso.

La SPEC hija de Flujo 3 debe decidir de forma explícita una de estas dos rutas:

1. permitir `Appointment` sin empresa para externos, o
2. permitir admisión externa directa a `MedicalEvent` sin pasar por `Appointment`

**Decisión preliminar de arquitectura:** para Flujo 3 se prefiere ingreso directo a `MedicalEvent` y no forzar una cita artificial.

---

## 10. Criterios de Aceptación de la Arquitectura Marco

1. Quedan definidos sin ambigüedad los tres flujos de admisión.
2. Queda congelado que los tres convergen al mismo `MedicalEvent`.
3. Queda congelado que `Appointment` no es requisito universal para toda atención.
4. Queda congelado que `Project` aplica al carril empresarial masivo y no al externo.
5. Queda congelado que el flujo clínico posterior no se duplica por origen.
6. Quedan definidos los slices hijos necesarios para implementación incremental.

---

## 11. Slices Hijos Derivados

Esta SPEC **no debe implementarse como un mega-cambio único**. Se divide en slices hijos.

### Slice A — Trazabilidad de convergencia a Event

Objetivo:
- extender `MedicalEvent` para preservar origen y contexto de admisión.

### Slice B — Recepción por Project para sin cita empresarial

Objetivo:
- convertir `Project` + `ProjectWorker` en cola operativa de llegada y check-in.

### Slice C — Alta rápida empresarial el mismo día

Objetivo:
- permitir que recepción cree o reutilice proyecto del día y registre lote ad hoc.

### Slice D — Admisión externa sin empresa

Objetivo:
- permitir ingreso de externos sin empresa falsa y sin contaminar `Project`.

---

## 12. Ejecución para SOFIA

Esta SPEC marco no autoriza implementación total en un solo handoff. SOFIA solo debe ser invocada por slice hijo.

### Archivo ancla inicial
- `frontend/prisma/schema.prisma`

### Datos existentes a reutilizar
- `MedicalEvent`
- `Appointment`
- `Project`
- `ProjectWorker`
- `Worker`
- `/reception`
- `/events/[id]`

### Datos faltantes a crear
- metadatos de procedencia en `MedicalEvent`
- estados operativos en `ProjectWorker`
- superficie de admisión externa

### Archivos exactos a modificar por slice
- Se definirán en la SPEC hija correspondiente.

### Máximo de archivos permitidos
- Máximo 5 a 7 archivos por slice.

### Validación exacta esperada
- compilación Prisma
- typecheck del slice
- validación manual de convergencia a `/events/[id]`

### Condición de detención si falta contexto
- Si un slice hijo no define explícitamente si crea `Appointment` o ingresa directo a `MedicalEvent`, SOFIA debe detenerse por `BLOQUEO DE CONTEXTO`.

---

## 13. Decisión Final

AMI no necesita tres módulos clínicos distintos. Necesita tres puertas de admisión distintas con una sola pista clínica a partir de `MedicalEvent`.