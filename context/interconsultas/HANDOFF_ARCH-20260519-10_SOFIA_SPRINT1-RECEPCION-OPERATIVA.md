# HANDOFF ARCH-20260519-10 a SOFIA — Sprint 1 Recepcion Operativa

- ID: ARCH-20260519-10
- Fecha: 2026-05-19
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion
- SPEC fuente: context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md
- Dictamenes de validacion:
  - context/interconsultas/DICTAMEN_FIX-20260519-03.md
  - context/interconsultas/DICTAMEN_FIX-20260519-04.md
  - context/interconsultas/DICTAMEN_FIX-20260519-05.md

## Objetivo

Implementar el Sprint 1 de recepcion operativa reutilizando anclas existentes del sistema y respetando la SPEC vigente sin abrir una nueva entidad de corroboracion.

El corte integra:

1. QR operativo minimo para recaptura en estaciones o equipos
2. corroboracion visual de identidad previa al check-in
3. captura persistente de identificacion oficial valida en la cita
4. reutilizacion de ultima identificacion valida disponible en trabajador cuando siga siendo la misma
5. comentario operativo obligatorio cuando no pueda capturarse evidencia normal o exista discrepancia material

## Decisiones cerradas

1. se acepta identificacion oficial valida, no solo INE
2. si el documento presentado es INE, debe privilegiarse y documentarse explicitamente
3. el reverso del documento es opcional en V1
4. nunca se debe bloquear el check-in por falta de captura normal
5. si no puede capturarse evidencia o existe discrepancia material, recepcion deja comentario operativo obligatorio
6. la evidencia del ingreso vive en la cita actual
7. el trabajador conserva referencia a la ultima identificacion valida reutilizable
8. no se crea entidad nueva tipo `IdentityCorroboration`
9. el QR actual de check-in y el QR operativo minimo son contratos distintos

## Alcance exacto

### Persistencia

1. extender `Appointment` con los campos minimos definidos en la SPEC para evidencia y resultado operativo
2. extender `Worker` con los campos minimos definidos en la SPEC para referencia a ultima identificacion valida
3. registrar auditoria estructurada del cierre de recepcion

### UI y flujo de recepcion

1. ampliar el modal actual `CorroborationModal`
2. agregar selector controlado de tipo de documento
3. agregar captura frontal del documento presentado
4. agregar captura opcional del reverso
5. mostrar bloque de ultima evidencia valida del trabajador con opcion explicita de reutilizar
6. agregar bloque de comentario operativo con motivo y comentario obligatorio cuando corresponda
7. cerrar recepcion desde una accion orquestadora unica, no desde coordinacion dispersa en cliente

### QR dual

1. conservar intacto el QR actual de cita/check-in
2. agregar QR operativo minimo separado, sin reutilizar el parser JSON del QR actual
3. renderizar el QR operativo minimo en:
   - pase o ticket de cita
   - vista de cita en agenda

## Restricciones

1. no abrir edicion libre de telefono, correo, empresa, puesto, CURP, NSS ni datos clinicos como foco del sprint
2. no convertir el modal en mantenimiento maestro del trabajador
3. no introducir OCR ni validacion contra fuentes externas
4. no mezclar el QR operativo minimo con el flujo de check-in automatico actual
5. no crear nueva entidad de corroboracion salvo limitacion tecnica real y demostrable; si aparece, regresar con INTEGRA

## Anclas reales

1. frontend/prisma/schema.prisma
2. frontend/src/actions/appointment.actions.ts
3. frontend/src/actions/worker.actions.ts
4. frontend/src/components/CorroborationModal.tsx
5. frontend/src/app/appointments/page.tsx
6. frontend/src/lib/audit.ts

## Contratos minimos a respetar

### Appointment

Debe soportar como minimo:

1. tipo de documento usado o reutilizado
2. evidencia frontal del ingreso actual
3. evidencia posterior si existe
4. fecha/hora de corroboracion
5. usuario que realizo la corroboracion
6. motivo cuando no haya captura normal o exista discrepancia material
7. comentario operativo obligatorio en esos casos
8. modo de evidencia: captura nueva, reutilizacion o continuidad sin captura normal

### Worker

Debe soportar como minimo:

1. ultimo tipo de documento valido disponible
2. ultima evidencia frontal valida disponible
3. ultima evidencia posterior valida disponible si existe
4. fecha de ultima corroboracion valida utilizable

## Frontera transaccional esperada

Se espera una accion orquestadora de cierre de recepcion que haga en un mismo flujo:

1. validacion del modal
2. decision de captura nueva, reutilizacion o comentario operativo
3. persistencia en cita
4. actualizacion resumida en trabajador cuando corresponda
5. correccion de nombre si aplica
6. auditoria estructurada
7. cierre de check-in usando `checkInAppointment()` o equivalente interno

## Catalogos minimos cerrados

### Tipos de documento

1. `INE`
2. `PASAPORTE`
3. `LICENCIA`
4. `OTRA_IDENTIFICACION_OFICIAL`

### Motivos cuando no hay captura normal o existe discrepancia

1. `SIN_DOCUMENTO_PRESENTE`
2. `FALLA_CAMARA_O_DISPOSITIVO`
3. `EVIDENCIA_NO_LEGIBLE`
4. `DISCREPANCIA_DE_IDENTIDAD`
5. `OTRO`

### Resultado de corroboracion

1. `VERIFIED_WITHOUT_CHANGES`
2. `VERIFIED_WITH_NAME_CORRECTION`
3. `VERIFIED_WITH_REUSED_EVIDENCE`
4. `VERIFIED_WITH_COMMENT`

## Validacion minima esperada

1. el QR actual de check-in sigue funcionando sin regresion
2. el nuevo QR operativo minimo se muestra en ticket/pase y en agenda
3. recepcion puede capturar evidencia nueva o reutilizar la ultima valida
4. si no hay captura normal, el comentario operativo permite continuar sin bloqueo
5. si cambia el nombre, queda auditoria y el trabajador se actualiza
6. la cita guarda la evidencia del ingreso actual
7. el trabajador conserva referencia a la ultima identificacion valida

## Nota final

La SPEC ya fue revisada por DEBY y quedo apta para handoff de implementacion. Implementa siguiendo la SPEC fuente vigente y este handoff. Si aparece una limitacion que obligue a cambiar modelo, reabre con INTEGRA antes de expandir el alcance.
