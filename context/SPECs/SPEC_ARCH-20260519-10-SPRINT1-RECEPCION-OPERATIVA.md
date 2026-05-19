# SPEC ARCH-20260519-10 — Sprint 1 Recepcion Operativa

- ID: ARCH-20260519-10
- Fecha: 2026-05-19
- Agente: INTEGRA - Arquitecto
- Estado: Lista para revision previa a implementacion
- Basada en:
  - context/SPECs/SPEC_ARCH-20260507-11-QR-IDENTIFICACION-OPERATIVA-MINIMA.md
  - context/SPECs/SPEC_ARCH-20260507-12-CORROBORACION-IDENTIDAD-CHECK-IN.md
  - context/SPECs/SPEC_ARCH-20260514-01-ALINEACION-CORROBORACION-NOMBRE-INE.md

## Objetivo

Cerrar el primer sprint operativo derivado de la visita AMI y del backlog reciente de recepcion, integrando en un solo corte:

1. QR operativo minimo para recaptura en estaciones o equipos
2. corroboracion visual obligatoria de identidad antes del check-in, con comentario operativo obligatorio cuando no pueda completarse normalmente
3. captura persistente de identificacion oficial valida, privilegiando INE frente cuando aplique, y reverso opcional
4. persistencia de evidencia en la cita actual y referencia de ultima identificacion valida utilizable en el perfil del trabajador
5. trazabilidad administrativa suficiente sin redisenar el flujo clinico posterior

## Contexto

La visita operativa a AMI confirmo dos fricciones concretas en recepcion:

1. existe recaptura manual de datos basicos en estaciones o equipos
2. la identidad del paciente necesita corroborarse formalmente antes del ingreso

El sistema ya cuenta con anclas funcionales existentes para resolver este corte sin abrir nuevo dominio:

1. la cita como ancla operativa de recepcion
2. el trabajador como maestro del dato de identidad corregido
3. la auditoria existente para registrar cambios y corroboracion
4. la persistencia de archivos ya disponible para guardar evidencia

Esta SPEC no redefine el flujo medico. Solo endurece y formaliza la capa administrativa de recepcion previa al check-in.

## Problema a resolver

Hoy el sistema ya puede:

1. generar expediente y QR de cita
2. cargar la cita para corroboracion
3. permitir correccion basica de nombre
4. hacer check-in y crear evento medico

Pero todavia quedan brechas operativas:

1. el QR actual responde al flujo de cita/check-in, no al uso minimo de recaptura en estaciones
2. la corroboracion no exige evidencia persistente obligatoria
3. no existe regla formal de identificacion oficial valida, comentario operativo obligatorio y continuidad del flujo sin bloqueo
4. la ultima identificacion valida reutilizable no queda disponible como referencia resumida en el trabajador

## Alcance de este sprint

### Si entra

1. QR operativo minimo con nombre completo y fecha de nacimiento
2. visualizacion del QR operativo en el pase o ticket de cita y en la vista de cita de agenda
3. corroboracion visual obligatoria previa al check-in
4. captura persistente de identificacion oficial valida en la cita actual
5. comentario operativo obligatorio cuando no se pueda capturar evidencia normal
6. correccion controlada del nombre completo
7. persistencia de evidencia en la cita actual
8. actualizacion del trabajador con referencia a la ultima identificacion valida disponible para reutilizacion
9. registro de auditoria suficiente de la corroboracion

### No entra

1. OCR de INE
2. validacion contra fuentes oficiales externas
3. edicion libre de telefono, correo, empresa, puesto, CURP, NSS o datos clinicos
4. rediseno de agenda
5. integracion nativa con equipos medicos
6. obligatoriedad del reverso del documento
7. nuevo modelo de dominio exclusivo para corroboracion si las anclas actuales bastan

## Regla operativa

1. la recepcionista debe realizar corroboracion visual antes de cerrar el check-in
2. la evidencia normal esperada es una identificacion oficial valida, privilegiando INE frente cuando aplique
3. el reverso del documento puede capturarse, pero no bloquea el ingreso
4. si no hay documento, falla la camara o la evidencia no puede capturarse, el sistema permite continuar con comentario operativo obligatorio
5. si existe discrepancia, recepcion debe documentar el caso, dejar comentario operativo y no bloquear el check-in
6. no hay OCR ni extraccion automatica en esta version

## Propuesta funcional

### 1. QR operativo minimo

Se generara un QR adicional al QR actual de cita/check-in, orientado a recaptura rapida en estaciones o equipos.

Payload minimo:

1. nombre completo
2. fecha de nacimiento en formato `YYYY-MM-DD`

Ejemplo:

```text
AMI|NOMBRE=MARIA ELENA GOMEZ LOPEZ|FN=1987-03-22
```

Reglas:

1. no incluir datos clinicos
2. no incluir CURP, NSS ni resultados
3. no volver obligatorio el uso del scanner para atender

### 2. Corroboracion obligatoria previa al check-in

Antes de cerrar el check-in, recepcion debe pasar por el modal de corroboracion y completar:

1. validacion visual del nombre contra la identificacion presentada
2. visualizacion de fecha de nacimiento como dato de contraste
3. captura de identificacion oficial valida presentada por el paciente
4. captura opcional del reverso del documento
5. si no puede capturarse el documento, registro de comentario operativo obligatorio

### 2.1 Documento aceptable

Para este sprint, la regla funcional sera:

1. se acepta identificacion oficial valida
2. si el documento presentado es INE, debe privilegiarse esa evidencia como referencia principal
3. la SPEC no limita la operacion exclusivamente a INE

### 2.2 Comentario operativo obligatorio

Si la corroboracion no puede completarse en condiciones normales, recepcion puede continuar dejando comentario operativo obligatorio.

Casos ejemplo:

1. el paciente no trae identificacion en ese momento
2. la captura falla por camara, red o dispositivo
3. la evidencia queda inutilizable en ese intento

En estos casos debe registrarse:

1. motivo de excepcion
2. comentario libre de recepcion
3. fecha y hora

El comentario permite operar, pero no debe pasar silencioso.

### 3. Correccion controlada del nombre

Se mantiene el principio ya definido:

1. solo el nombre completo puede corregirse desde recepcion
2. no se abre mantenimiento maestro del trabajador
3. la correccion se aplica al trabajador y queda auditada
4. si la discrepancia no puede resolverse de inmediato, recepcion deja comentario y continua sin bloquear

### 4. Persistencia de evidencia

La evidencia debe comportarse asi:

1. la evidencia del documento presentado se persiste dentro de la cita actual como evidencia del ingreso
2. si el documento es INE, debe quedar documentado explicitamente como tal
3. el reverso, si existe, tambien se persiste dentro de la cita actual
4. al cerrar la corroboracion, el perfil del trabajador conserva referencia a la ultima identificacion valida disponible para reutilizacion
5. si la evidencia reutilizada sigue siendo la misma, puede reusarse como ultima valida y evitar recaptura innecesaria
6. la cita sigue siendo la fuente de verdad del acto de corroboracion de ese ingreso

### 5. Trazabilidad

Debe registrarse mediante anclas existentes:

1. cita corroborada
2. trabajador asociado
3. usuario que realizo la corroboracion
4. fecha y hora
5. nombre previo
6. nombre confirmado
7. tipo de documento capturado o reutilizado
8. presencia de frente del documento
9. presencia de reverso del documento
10. existencia o no de comentario operativo por excepcion o discrepancia
11. comentario operativo cuando exista discrepancia o excepcion

## Diseno tecnico minimo

## Principio rector

Usar anclas existentes. No abrir una nueva entidad de corroboracion si la cita, el trabajador, la auditoria y la infraestructura actual de archivos resuelven el caso.

### Anclas a reutilizar

1. cita para persistir la evidencia del ingreso actual
2. trabajador para conservar referencia a la ultima identificacion valida disponible
3. `AuditLog` para la traza administrativa del cambio y de la corroboracion
4. flujo actual de agenda/corroboracion ya montado en UI

### Implementacion esperada

1. extender la cita con referencias suficientes para archivos del documento usado en ese ingreso
2. extender el trabajador con referencia resumida a la ultima identificacion valida disponible
3. registrar en auditoria la corroboracion, cualquier correccion de nombre y cualquier excepcion
4. extender el modal actual de corroboracion en vez de sustituirlo por un flujo nuevo
5. soportar decision de reutilizar evidencia previa cuando siga siendo la misma y operativamente valida

### Decision explicita

No se aprueba crear una entidad nueva tipo `IdentityCorroboration` en esta fase, salvo que durante implementacion aparezca una limitacion tecnica real y demostrable.

## Archivos probables

- frontend/prisma/schema.prisma
- frontend/src/actions/appointment.actions.ts
- frontend/src/actions/worker.actions.ts
- frontend/src/components/CorroborationModal.tsx
- frontend/src/app/appointments/page.tsx
- frontend/src/lib/audit.ts

## Apendice tecnico minimo

Este apendice existe para evitar ambiguedad de implementacion. No redefine el objetivo funcional; solo fija el contrato minimo que SOFIA debe respetar.

### 1. Contrato minimo de datos

#### 1.1 Campos minimos nuevos en Appointment

La cita debe extenderse con campos suficientes para persistir la evidencia del ingreso actual y el resultado operativo de corroboracion.

Campos minimos esperados:

1. `identityDocumentType` nullable
2. `identityFrontFileUrl` nullable
3. `identityBackFileUrl` nullable
4. `identityVerifiedAt` nullable
5. `identityVerifiedByUserId` nullable
6. `identityExceptionReason` nullable
7. `identityExceptionComment` nullable
8. `identityEvidenceMode` nullable

Contrato semantico:

1. `identityDocumentType`: tipo de documento usado o reutilizado
2. `identityFrontFileUrl`: evidencia frontal del ingreso actual o referencia persistida utilizada
3. `identityBackFileUrl`: evidencia posterior si existe
4. `identityVerifiedAt`: fecha y hora del cierre administrativo de corroboracion
5. `identityVerifiedByUserId`: usuario que realizo la corroboracion
6. `identityExceptionReason`: motivo clasificado cuando no pueda capturarse evidencia normal o exista discrepancia material
7. `identityExceptionComment`: comentario libre obligatorio cuando exista excepcion o discrepancia
8. `identityEvidenceMode`: `NEW_CAPTURE`, `REUSED_PREVIOUS`, `EXCEPTION_WITHOUT_CAPTURE`

#### 1.2 Campos minimos nuevos en Worker

El trabajador solo debe conservar referencia resumida a la ultima evidencia valida reutilizable.

Campos minimos esperados:

1. `lastIdentityDocumentType` nullable
2. `lastIdentityFrontFileUrl` nullable
3. `lastIdentityBackFileUrl` nullable
4. `lastIdentityVerifiedAt` nullable

Contrato semantico:

1. estos campos no reemplazan la evidencia por cita
2. solo representan la ultima evidencia valida disponible para reutilizacion operativa
3. si la cita actual reutiliza la misma evidencia, estos campos no requieren nueva recaptura

### 2. Catalogos controlados

Para evitar texto libre inconsistente, la implementacion debe usar catalogos minimos cerrados.

#### 2.1 Tipos de documento permitidos

V1 debe soportar como minimo:

1. `INE`
2. `PASAPORTE`
3. `LICENCIA`
4. `OTRA_IDENTIFICACION_OFICIAL`

#### 2.2 Motivos de excepcion permitidos

V1 debe soportar como minimo:

1. `SIN_DOCUMENTO_PRESENTE`
2. `FALLA_CAMARA_O_DISPOSITIVO`
3. `EVIDENCIA_NO_LEGIBLE`
4. `DISCREPANCIA_DE_IDENTIDAD`
5. `OTRO`

#### 2.3 Resultado operativo de corroboracion

V1 debe distinguir como minimo:

1. `VERIFIED_WITHOUT_CHANGES`
2. `VERIFIED_WITH_NAME_CORRECTION`
3. `VERIFIED_WITH_REUSED_EVIDENCE`
4. `VERIFIED_WITH_EXCEPTION`

### 3. Frontera transaccional

La corroboracion ampliada ya no debe quedar repartida como secuencia implicita de pasos separados.

La implementacion debe resolver un solo server action orquestador para cierre de recepcion, por ejemplo:

1. validar datos del modal
2. decidir si hay recaptura, reutilizacion o excepcion
3. persistir evidencia y metadatos en cita
4. actualizar referencia de ultima evidencia valida en trabajador cuando corresponda
5. corregir nombre del trabajador si aplica
6. registrar auditoria estructurada
7. ejecutar `checkInAppointment()` o su equivalente interno dentro del mismo flujo de cierre

Regla:

1. no dejar a cliente la responsabilidad de coordinar varias acciones criticas sin frontera clara
2. si se conserva `checkInAppointment()` como accion separada, debe ser invocada por una nueva accion orquestadora de recepcion y no directamente desde el modal final

### 4. Convivencia de los dos QR

La implementacion debe mantener contratos separados para evitar regresiones.

#### 4.1 QR actual

1. sigue siendo QR de cita/check-in
2. conserva su payload actual y su procesamiento actual
3. no se modifica su parser para mezclarlo con el QR operativo minimo

#### 4.2 QR operativo minimo

1. es un segundo QR distinto
2. no se usa para hacer check-in automatico
3. solo sirve para recaptura operativa externa
4. no debe pasar por el parser JSON del QR actual

#### 4.3 Punto minimo de render en V1

Para evitar ambiguedad de UI, V1 debe mostrar el QR operativo minimo en:

1. pase o ticket de cita
2. vista de cita en agenda donde ya existe el pase operativo

Se difiere a otra iteracion mostrarlo en papeleta o evento clinico si no es necesario en este sprint.

### 5. Regla minima de reutilizacion

Para esta V1, una evidencia previa puede reutilizarse si y solo si:

1. el paciente presenta el mismo documento en recepcion
2. la recepcionista confirma visualmente que corresponde al mismo paciente
3. la imagen previa es legible y suficiente para operacion

Si cualquiera de esos tres puntos falla, la recepcion debe:

1. recapturar evidencia nueva
2. o continuar con comentario operativo obligatorio si tampoco puede capturarse

### 6. UI minima del modal de corroboracion

El modal actual debe ampliarse con cinco superficies claras:

1. selector controlado de tipo de documento
2. bloque de evidencia actual de la cita
3. bloque de ultima evidencia valida del trabajador con opcion explicita de reutilizar
4. bloque de comentario operativo con motivo y comentario obligatorio
5. resumen final de resultado de corroboracion antes de confirmar

La UI no debe dejar estas decisiones en texto libre disperso.

### 7. Auditoria estructurada minima

El registro en auditoria debe incluir, como minimo, este payload estructurado:

1. `appointmentId`
2. `workerId`
3. `documentType`
4. `evidenceMode`
5. `corroborationResult`
6. `previousFullName`
7. `confirmedFullName`
8. `exceptionReason` nullable
9. `exceptionComment` nullable
10. `frontCaptured` boolean
11. `backCaptured` boolean
12. `reusedPreviousEvidence` boolean

### 8. Criterio tecnico de aprobacion

La implementacion solo se considerara alineada con esta SPEC si cumple simultaneamente:

1. contratos de datos minimos en cita y trabajador
2. accion orquestadora clara para cierre de recepcion
3. separacion estricta entre QR de check-in y QR operativo minimo
4. catalogos cerrados para documento, excepcion y resultado
5. superficie UI minima para reutilizacion y comentario operativo obligatorio

## Criterios de aceptacion

1. existe un QR operativo minimo con nombre completo y fecha de nacimiento
2. el QR debe mostrarse en el pase o ticket de cita y en la vista de cita de agenda sin bloquear la atencion
3. recepcion realiza corroboracion visual previa antes del check-in
4. el sistema permite capturar identificacion oficial valida y documentarla en la cita actual
5. si el documento es INE, queda documentado explicitamente; el reverso sigue siendo opcional
6. recepcion puede corregir solo el nombre completo
7. la evidencia del ingreso queda persistida en la cita actual
8. el trabajador conserva referencia a la ultima identificacion valida disponible
9. si no puede capturarse evidencia o existe discrepancia material, se registra comentario operativo con motivo y el check-in no queda bloqueado
10. la accion deja auditoria suficiente de usuario, fecha, cambio, tipo de documento, presencia de evidencia y comentario si aplica
11. el flujo clinico posterior no se modifica por este corte

## Riesgos controlados

1. si se guarda solo en trabajador, se pierde trazabilidad por cita
2. si se guarda solo en cita, se pierde reutilizacion operativa de la ultima evidencia valida
3. si no existe comentario operativo obligatorio, la recepcion queda expuesta a bloqueos innecesarios o a opacidad administrativa
4. si se abre edicion general del trabajador en recepcion, se degrada la gobernanza del dato maestro
5. si se vuelve obligatorio tambien el reverso en V1, puede subir friccion innecesaria

## Criterio de exito

El sprint sera exitoso si recepcion puede corroborar visualmente la identidad, capturar o reutilizar evidencia valida, corregir discrepancias basicas de nombre, documentar excepciones con comentario sin bloquear el ingreso y dejar trazabilidad administrativa fuerte antes del check-in, usando el dominio existente y sin invadir el flujo clinico posterior.

## Referencias

- context/Juntas/MINUTA_VISITA_AMI_2026-04-17.md
- context/Juntas/SEGUIMIENTO_VISITA_AMI_2026-04-17.md
- context/SPECs/SPEC_ARCH-20260507-11-QR-IDENTIFICACION-OPERATIVA-MINIMA.md
- context/SPECs/SPEC_ARCH-20260507-12-CORROBORACION-IDENTIDAD-CHECK-IN.md
- context/SPECs/SPEC_ARCH-20260514-01-ALINEACION-CORROBORACION-NOMBRE-INE.md