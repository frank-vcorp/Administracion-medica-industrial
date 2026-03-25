## 📋 SPEC HIJA: Examen Médico Universal con Obligación Condicionada por Perfil

**ID:** `ARCH-20260325-01`
**Padre:** `ARCH-20260324-03`, `ARCH-20260324-04`, `ARCH-20260324-08`, `ARCH-20260324-09`
**Objetivo:** Garantizar que el estudio `Examen Médico` exista siempre dentro de toda papeleta del evento, pero que solo bloquee el avance a validación cuando el perfil médico asignado al puesto/cita lo exija explícitamente.

### 🎯 Decisión de Producto

- `Examen Médico` es estructural y debe aparecer en toda papeleta.
- La condición `obligatorio` no depende de su mera presencia en la papeleta, sino del perfil médico asignado a la cita.
- El sistema no debe bloquear el trabajo temprano del evento por este motivo.
- El bloqueo debe ocurrir únicamente al intentar pasar de `IN_PROGRESS` a `VALIDATING`.

### 🧠 Regla de Negocio Aprobada

#### 1. Presencia universal
- Al hacer check-in de una cita y crear el `MedicalEvent`, la papeleta debe contener siempre un `EventTest` correspondiente a `Examen Médico`.
- Si el perfil ya incluye `Examen Médico`, no debe duplicarse.
- Si el perfil no lo incluye, el sistema debe agregarlo de todas formas como estudio disponible dentro de la papeleta.

#### 2. Obligación derivada del perfil
- `Examen Médico` se considera `obligatorio por perfil` cuando el `MedicalProfile` asignado a la cita contiene dicho estudio dentro de sus `ProfileTest`.
- Si el perfil no lo contiene, `Examen Médico` sigue visible en la papeleta pero se considera `opcional`.
- Esta obligatoriedad debe derivarse del perfil asignado, no de una nueva bandera persistida en base de datos para esta iteración.

#### 3. Momento correcto del bloqueo
- No se debe impedir abrir la papeleta.
- No se debe impedir navegar entre estudios.
- No se debe impedir guardar borradores del Examen Médico.
- Sí se debe impedir el cambio de estado del evento a `VALIDATING` cuando el perfil exige `Examen Médico` y este aún no está resuelto.

#### 4. Definición de “resuelto”
- Para esta iteración, `Examen Médico` requerido se considera resuelto únicamente cuando su `EventTest` está en estado `COMPLETED`.
- Estados como `PENDING`, `IN_PROGRESS`, `SAMPLE_TAKEN` o `RESULT_REGISTERED` no son suficientes para permitir el paso a `VALIDATING`.
- Si el examen es opcional, cualquiera de esos estados, incluido `PENDING`, no debe bloquear el avance del evento.

### ✅ Criterios de Aceptación

#### A. Creación de la papeleta en check-in
- Toda nueva papeleta creada desde `checkInAppointment()` contiene un estudio `Examen Médico`.
- Si el perfil ya lo trae, la papeleta conserva una sola instancia del estudio.
- Si el perfil no lo trae, la papeleta lo agrega como estudio adicional sin alterar el resto de pruebas del perfil.
- La creación no requiere migración Prisma ni cambios de esquema.

#### B. Detección de obligatoriedad
- El detalle del evento debe conocer si `Examen Médico` es obligatorio a partir del perfil asociado a la cita.
- Esa información debe quedar disponible para la UI del workspace y para la validación server-side.
- La detección debe usar una regla estable y reutilizable de identificación de `Examen Médico`, preferentemente centralizada en un helper compartido y no repetida en múltiples componentes.

#### C. UX en la papeleta
- El estudio `Examen Médico` debe mostrar una señal visual clara cuando sea obligatorio por perfil.
- La señal puede ser badge, etiqueta o texto auxiliar, pero debe verse tanto en el resumen del estudio como en su vista activa si aplica.
- Si el examen es opcional, la UI no debe comunicarlo como bloqueo.
- El usuario puede abrir el estudio, guardar borradores y completarlo igual que hoy.

#### D. Gate de avance a validación
- Al intentar pasar el evento a `VALIDATING`, el sistema valida en servidor si `Examen Médico` es obligatorio por perfil.
- Si es obligatorio y no está `COMPLETED`, la transición debe rechazarse con un mensaje claro para el usuario.
- El mensaje debe indicar que no se puede finalizar estudios porque el `Examen Médico` requerido aún no está completado.
- Si el examen es opcional o ya está completado, la transición continúa sin cambios.

#### E. Integridad y seguridad de la regla
- La validación no debe depender solo del cliente.
- Aunque alguien intente invocar la acción desde fuera de la UI, el servidor debe impedir `IN_PROGRESS -> VALIDATING` cuando el requisito no esté cumplido.
- La implementación no debe introducir duplicados de `EventTest` para `Examen Médico`.

### 🛠️ Diseño Técnico Aprobado

#### 1. Sin migración de base de datos
- No agregar columna nueva en `MedicalProfile`, `EventTest` o `MedicalEvent` en esta iteración.
- La obligatoriedad se deduce dinámicamente del perfil asignado a la cita.

#### 2. Estrategia de creación del `EventTest`
- En `frontend/src/actions/appointment.actions.ts`, antes de `createMany`, construir la lista final de pruebas asegurando la presencia única de `Examen Médico`.
- Si ya existe en `appointmentSnapshot.serviceProfile.tests`, reutilizar esa entrada.
- Si no existe, agregar un `EventTest` extra con `testNameSnapshot: 'Examen Médico'`.
- Si existe un `MedicalTest` canónico para `Examen Médico`, se puede usar su `testId`; si no, se permite crear la entrada con `testId: null`, preservando el comportamiento actual basado en `testNameSnapshot`.

#### 3. Derivación centralizada
- Crear un helper reutilizable para identificar si un test corresponde a `Examen Médico` por nombre normalizado.
- Ese helper debe usarse al menos en:
  - creación de `EventTest`
  - serialización del evento para la pantalla `events/[id]`
  - validación del salto a `VALIDATING`
  - señales visuales del workspace

#### 4. Validación server-side del cambio de estado
- La autoridad del gate debe vivir en la capa server-side del cambio de estado, no solo en `EventFlowController`.
- Al pedir `updateEventStatus(id, 'VALIDATING')`, el servidor debe cargar:
  - `appointment.serviceProfile.tests`
  - `eventTests`
- Debe determinar:
  - si `Examen Médico` es obligatorio por perfil
  - si existe el `EventTest` correspondiente
  - si su estado actual es `COMPLETED`
- Si falla cualquiera de esas condiciones para un examen requerido, debe lanzar error controlado.

#### 5. Feedback en cliente
- `EventFlowController` debe capturar el error del gate y mostrarlo sin romper la vista.
- La UI no debe quedarse en loading silencioso.
- El texto de error debe ser directo y operacional.

### 📂 Scope de Implementación para SOFIA

- `frontend/src/actions/appointment.actions.ts`
- `frontend/src/actions/medical-event.actions.ts` o `frontend/src/services/medical-event.service.ts`
- `frontend/src/app/events/[id]/page.tsx`
- `frontend/src/components/EventFlowController.tsx`
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- Helper nuevo sugerido: `frontend/src/lib/clinical/examen-medico.ts`

### 🚫 Fuera de Alcance

- Agregar nueva configuración persistente tipo checkbox `requiere examen médico` en admin de perfiles.
- Cambiar esquema Prisma.
- Crear estados nuevos como `SKIPPED`, `WAIVED` u `OPTIONAL`.
- Bloquear otros estudios de la papeleta con la misma lógica.
- Reescribir el portal de prellenado.

### 🧪 Validación Esperada

#### Caso 1. Perfil con Examen Médico
1. Crear cita con perfil que incluya `Examen Médico`.
2. Hacer check-in.
3. Verificar que la papeleta contiene una sola instancia de `Examen Médico`.
4. Intentar pasar a `VALIDATING` sin completar el estudio.
5. Confirmar bloqueo con mensaje claro.
6. Completar `Examen Médico`.
7. Confirmar que ahora sí permite pasar a `VALIDATING`.

#### Caso 2. Perfil sin Examen Médico
1. Crear cita con perfil que no incluya `Examen Médico`.
2. Hacer check-in.
3. Verificar que la papeleta igualmente contiene `Examen Médico`.
4. Sin completar ese estudio, intentar pasar a `VALIDATING`.
5. Confirmar que el avance sí está permitido.

#### Caso 3. No duplicación
1. Crear cita con perfil que sí incluya `Examen Médico`.
2. Hacer check-in.
3. Confirmar que no se crean dos `EventTest` del mismo estudio.

### ✅ Checklist de Entrega para SOFIA

- [ ] `Examen Médico` aparece en toda papeleta creada por check-in.
- [ ] No se duplica cuando ya venía en el perfil.
- [ ] La obligatoriedad se deriva del perfil asignado.
- [ ] El detalle del evento serializa esa condición para la UI.
- [ ] La UI muestra indicador de `obligatorio por perfil`.
- [ ] El servidor bloquea `VALIDATING` si el examen requerido no está `COMPLETED`.
- [ ] El cliente muestra el mensaje de error del gate.
- [ ] No se introducen cambios de esquema Prisma.
- [ ] Se valida el comportamiento con los 3 casos descritos.

### 🤝 Handoff Aprobado

SOFIA debe implementar esta SPEC con enfoque mínimo, sin expandir alcance, y ejecutar revisión final sobre diff para verificar:

- consistencia del helper de identificación de `Examen Médico`
- no duplicación en `checkInAppointment()`
- enforcement server-side real del gate a `VALIDATING`
- señalización visual suficiente en la papeleta
