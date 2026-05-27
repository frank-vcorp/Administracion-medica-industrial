# SPEC: Slice D — Admisión Externa sin Empresa

**ID:** ARCH-20260527-14  
**Fecha:** 2026-05-27  
**Estado:** LISTA PARA IMPLEMENTACION  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta  
**SPEC madre:** `context/SPECs/SPEC_ARCH-20260527-10-ADMISION-TRES-FLUJOS-Y-CONVERGENCIA-A-EVENT.md`  
**Depende de:**
- `context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md`
- `context/SPECs/SPEC_ARCH-20260527-11-SLICE-A-TRAZABILIDAD-CONVERGENCIA-EVENT.md`

---

## 1. Objetivo

Habilitar un carril de **admisión externa sin empresa** para personas que llegan por laboratorio, estudio puntual o atención espontánea, permitiendo buscarlas o crearlas como `Worker` con `companyId = null` y crear su `MedicalEvent` directo sin pasar por `Appointment`, sin forzar empresa falsa y sin contaminar `Project`.

---

## 2. Problema puntual

El dominio actual ya tolera trabajadores sin empresa, pero la capa operativa todavía está sesgada a contexto empresarial:

1. el formulario de cita obliga empresa;
2. el flujo programado usa `Appointment.companyId` obligatorio;
3. el modal actual de recepción solo admite seleccionar un trabajador ya existente;
4. si llega una persona externa nueva, recepción hoy tendría que inventar empresa o salir del flujo para registrarla.

Eso vuelve torpe un caso real de negocio: persona externa no afiliada a empresa que llega directamente por atención o estudio.

---

## 3. Decisión de Arquitectura

### Regla principal

El carril externo **no** debe pasar por `Project` y **no** debe forzar `Appointment`.

### Regla de convergencia

La admisión externa crea `MedicalEvent` directo con:

1. `intakeSource = EXTERNAL_WALK_IN`
2. `appointmentId = null`
3. `billingCompanyId = null` por defecto

### Regla de identidad

El externo sigue siendo `Worker`, no se crea un modelo separado de paciente externo.

### Regla de negocio

La ausencia de empresa no impide atención clínica. Empresa y facturación son preocupaciones distintas.

---

## 4. Alcance

### Sí entra

1. Búsqueda de persona externa existente por nombre.
2. Alta mínima de persona externa nueva.
3. Selección explícita de sucursal.
4. Creación de `MedicalEvent` directo desde recepción.
5. Persistencia con `intakeSource = EXTERNAL_WALK_IN`.
6. Reutilización del workspace clínico actual.

### No entra

1. Cobro o facturación.
2. Convenios empresariales especiales.
3. Generación de cita para externos.
4. Integración con Project.
5. Rediseño completo del módulo de recepción.
6. Campos clínicos o formularios preconsulta adicionales.

---

## 5. Flujo Operativo Esperado

### Caso A — Externo ya existente

1. Usuario abre `Ingreso externo` desde recepción.
2. Busca por nombre a la persona.
3. La selecciona.
4. Elige sucursal.
5. Confirma ingreso.
6. El sistema crea `MedicalEvent` directo.
7. La persona entra al mismo workspace clínico que cualquier otro ingreso.

### Caso B — Externo nuevo

1. Usuario abre `Ingreso externo` desde recepción.
2. No encuentra a la persona en búsqueda.
3. Captura alta mínima.
4. Elige sucursal.
5. Confirma ingreso.
6. El sistema crea `Worker` con `companyId = null`.
7. Luego crea `MedicalEvent` con origen externo.

---

## 6. Datos mínimos de alta externa

Campos mínimos aprobados:

1. `Nombre(s)` — obligatorio
2. `Apellido(s)` — obligatorio
3. `Fecha de nacimiento` — opcional pero recomendada
4. `Teléfono` — opcional
5. `Correo` — opcional
6. `CURP o ID nacional` — opcional

### Reglas

1. `companyId` debe persistirse como `null`.
2. `jobPositionId` debe quedar `null` por defecto.
3. No se debe exigir perfil médico desde admisión externa en este slice.
4. Si luego se requiere estudio inicial, se resolverá en slice posterior o dentro del workspace clínico existente.

---

## 7. Reglas de Duplicidad

### Regla mínima

Antes de crear externo nuevo, se debe verificar si ya existe una persona coincidente por:

1. nombre + apellido + DOB si DOB viene presente;
2. nombre + apellido como advertencia si DOB no está disponible.

### Resultado esperado

1. si la coincidencia es suficientemente fuerte, recepción debe reutilizar el `Worker` existente;
2. si la coincidencia es ambigua, mostrar advertencia pero permitir crear si el usuario decide continuar;
3. no bloquear toda admisión por falta de DOB.

---

## 8. Superficie Técnica Esperada

### Archivo ancla inicial

`frontend/src/components/CheckInModal.tsx`

### Archivos exactos a crear o modificar

1. `frontend/src/components/CheckInModal.tsx`
2. `frontend/src/actions/event.actions.ts`
3. `frontend/src/actions/worker.actions.ts`
4. `frontend/src/app/reception/page.tsx`
5. `frontend/src/app/events/[id]/page.tsx`

### Máximo de archivos permitidos

Máximo 5 archivos funcionales. Si necesitas tocar Prisma, `Appointment`, rutas nuevas o `Project`, detente.

---

## 9. Estrategia de Implementación Preferida

La implementación preferida es evolucionar `CheckInModal` hacia una selección explícita de dos variantes:

1. `Ingreso de trabajador existente`
2. `Ingreso externo`

### Variante existente

Se conserva para no romper operación actual.

### Variante externa

Debe permitir:

1. búsqueda simple de persona
2. alta mínima inline si no existe
3. selección de sucursal
4. confirmación de ingreso

No se crea un módulo separado si el mismo modal puede absorber el cambio sin volverse inusable.

---

## 10. Contrato de Acciones

### 10.1 Búsqueda de externos

Debe existir una query ligera reutilizable o derivada para buscar trabajadores sin empresa o con coincidencias por nombre.

### 10.2 Alta mínima de externo

Debe existir una mutación acotada que:

1. reciba datos mínimos de persona;
2. cree `Worker` con `companyId = null`;
3. devuelva el `workerId`.

Puede ser una variante de `createWorker` o una nueva action mínima, pero no debe romper el flujo empresarial actual.

### 10.3 Ingreso externo a clínica

Debe existir una mutación acotada que:

1. reciba `workerId` y `branchId`;
2. cree `MedicalEvent`;
3. setee `intakeSource = EXTERNAL_WALK_IN`;
4. setee `appointmentId = null`;
5. setee `billingCompanyId = null` salvo lógica futura explícita;
6. devuelva `eventId`.

---

## 11. Diseño de UI mínimo

### 11.1 Recepción

Desde recepción debe existir acceso visible a `Ingreso externo`.

### 11.2 Dentro del modal

Debe poder verse claramente:

1. búsqueda de persona existente;
2. bloque de alta mínima si no existe;
3. selección de sucursal;
4. confirmación de ingreso.

### 11.3 Vista del evento

La página del evento debe reflejar de forma legible que el origen fue `Externo`.

No se pide rediseño visual amplio; solo continuidad operativa.

---

## 12. Reglas de Negocio

1. Nunca asignar empresa falsa para admitir un externo.
2. Nunca crear `Project` para un externo.
3. No crear `Appointment` solo para cumplir con el modelo actual.
4. El externo debe poder entrar a clínica con el mismo workspace común que los otros flujos.
5. Si luego se requiere facturación o convenio, eso se resolverá en un frente separado.

---

## 13. Criterios de Aceptación

1. Recepción puede ingresar a una persona externa sin empresa.
2. Si la persona no existe, puede crearla con alta mínima.
3. El sistema crea `Worker` con `companyId = null`.
4. El sistema crea `MedicalEvent` con `intakeSource = EXTERNAL_WALK_IN`.
5. El ingreso externo cae al mismo workspace clínico existente.
6. No se crean citas ni proyectos para resolver este caso.

---

## 14. Validación Esperada

Validación exacta del slice:

1. `cd frontend && pnpm exec eslint src/components/CheckInModal.tsx src/actions/event.actions.ts src/actions/worker.actions.ts src/app/reception/page.tsx src/app/events/[id]/page.tsx`

Validación manual mínima:

1. abrir recepción;
2. elegir ingreso externo;
3. crear externo nuevo;
4. confirmar que abre evento clínico válido;
5. verificar badge/contexto de origen externo.

---

## 15. Condición de Detención

Si para resolver este slice se vuelve necesario:

1. tocar Prisma schema;
2. volver opcional `Appointment.companyId`;
3. crear ruta nueva dedicada;
4. tocar `Project` o `ProjectWorker`;
5. abrir un sexto archivo funcional;

SOFIA debe detenerse y devolver `BLOQUEO DE CONTEXTO`.

---

## 16. Ejecución para SOFIA

### Datos existentes a reutilizar

1. `CheckInModal`
2. `createEvent()`
3. `createWorker()`
4. `Worker.companyId` nullable
5. workspace clínico por `MedicalEvent`

### Datos faltantes a crear

1. variante de ingreso externo
2. alta mínima inline
3. creación de evento externo con sucursal explícita

### Condición explícita

No abrir facturación, citas ni Project. El slice termina cuando el externo entra al workspace clínico común.