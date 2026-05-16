# SPEC ARCH-20260507-12 - Corroboracion de Identidad en Check-In

- ID: ARCH-20260507-12
- Fecha: 2026-05-07
- Agente: INTEGRA - Arquitecto
- Estado: Backlog futuro, no implementar aun

## Objetivo

Agregar un paso de corroboracion de identidad en recepcion al momento del check-in para permitir:

1. corregir el nombre completo cuando el dato registrado no coincide con la identificacion presentada
2. capturar evidencia visual de INE frente
3. capturar evidencia visual de INE reverso
4. dejar trazabilidad de quien hizo la corroboracion y cuando

La mejora debe resolver la necesidad operativa observada en sitio sin redisenar el flujo clinico actual.

## Contexto

Durante la validacion operativa se identifico que recepcion necesita verificar la identidad del paciente al llegar a la cita.

Hoy el check-in es directo: se localiza a la persona y se crea el evento medico. Sin embargo, no existe todavia un paso formal de corroboracion que permita corregir de forma controlada discrepancias basicas de identidad ni adjuntar evidencia documental ligera.

La necesidad principal detectada es:

1. el nombre debe poder corregirse cuando la recepcion detecta una discrepancia
2. no todos los demas datos deben quedar editables en ese momento
3. conviene poder adjuntar foto frontal y posterior de la INE como evidencia operativa

## Restriccion principal

La corroboracion no debe convertir el check-in en un proceso pesado ni bloquear la operacion diaria.

Eso implica:

1. no abrir edicion libre de todos los datos del trabajador
2. no hacer obligatoria la captura de INE en la primera version
3. no impedir el check-in si no hay camara o si la INE no esta disponible
4. no mezclar evidencia operativa con datos clinicos del expediente

## Propuesta funcional

### 1. Paso de corroboracion previo al check-in

Antes de confirmar el check-in, recepcion debe poder revisar un panel corto de corroboracion con:

1. nombre actual registrado
2. campo editable de nombre completo corroborado
3. fecha de nacimiento solo visible en esta fase, no editable en V1
4. espacio para adjuntar INE frente
5. espacio para adjuntar INE reverso

### 2. Edicion controlada del nombre

Solo el nombre completo debe poder ajustarse en esta iteracion.

No deben abrirse en esta fase:

1. empresa
2. puesto
3. telefono
4. CURP
5. NSS
6. datos clinicos

### 3. Evidencia documental ligera

La captura de INE debe quedar como evidencia operativa opcional, con dos caras separadas:

1. INE frente
2. INE reverso

El sistema debe permitir operar aunque la evidencia no se capture en todos los casos.

### 4. Trazabilidad de la corroboracion

Cuando recepcion modifique el nombre o agregue evidencia, debe quedar registro de:

1. usuario que corroboro
2. fecha y hora
3. valor previo del nombre
4. valor nuevo del nombre
5. presencia o ausencia de evidencia frontal y posterior

### 5. Sin impacto en el flujo clinico

La corroboracion debe vivir en recepcion como capa administrativa previa al check-in, sin modificar:

1. estados clinicos posteriores
2. flujo de estudios
3. logica de Examen Medico

## Alcance propuesto para una futura V1

Incluye:

1. paso de corroboracion visual en check-in
2. edicion controlada del nombre completo
3. carga opcional de INE frente y reverso
4. registro de auditoria de la corroboracion
5. persistencia de evidencia ligada al evento o a un bloque de corroboracion asociado

No incluye todavia:

1. OCR de INE
2. extraccion automatica de datos desde la credencial
3. validacion oficial de identidad contra fuentes externas
4. edicion masiva de datos del trabajador
5. obligatoriedad institucional de subir INE en todos los casos

## Regla de diseno

La recepcion debe poder corregir lo minimo necesario para operar bien, sin convertirse en una pantalla de mantenimiento maestro del trabajador.

Principios:

1. corregir solo lo indispensable
2. evidencia opcional primero
3. auditoria siempre
4. cero friccion clinica adicional

## Diseno tecnico minimo

### Opcion funcional recomendada

Modelar una capa de corroboracion de identidad asociada al evento de check-in con:

1. `eventId`
2. `workerId`
3. `previousFullName`
4. `confirmedFullName`
5. `ineFrontFileId` opcional
6. `ineBackFileId` opcional
7. `verifiedByUserId`
8. `verifiedAt`

### Alternativa simplificada

Si se requiere una primera implementacion mas corta, podria:

1. actualizar nombre del trabajador
2. guardar auditoria con valor previo y valor nuevo
3. adjuntar archivos al evento

La decision final debe favorecer trazabilidad y bajo riesgo de regresion.

### Puntos probables de implementacion

1. `frontend/src/components/CheckInModal.tsx`
2. `frontend/src/actions/appointment.actions.ts`
3. servicios o acciones de upload existentes
4. esquema Prisma si se define una entidad especifica de corroboracion

## Archivos probables

- frontend/src/components/CheckInModal.tsx
- frontend/src/actions/appointment.actions.ts
- frontend/prisma/schema.prisma
- frontend/src/lib/audit.ts
- frontend/src/components/clinical/

## Criterios de aceptacion

1. recepcion puede corregir el nombre completo durante corroboracion previa al check-in
2. recepcion puede adjuntar INE frente y reverso de forma opcional
3. la accion deja trazabilidad de usuario, fecha y cambios realizados
4. no se habilita edicion libre de todos los datos del trabajador
5. el flujo actual de check-in y piso clinico no queda bloqueado por esta mejora

## Riesgos controlados

1. si se abre edicion general de datos en recepcion, se degrada la gobernanza del dato maestro
2. si la evidencia se vuelve obligatoria demasiado pronto, se puede frenar la operacion
3. si no se guarda el valor previo del nombre, se pierde trazabilidad de la correccion

## Criterio de exito

La mejora sera exitosa si recepcion puede resolver discrepancias basicas de identidad en el momento del check-in, dejando evidencia y auditoria suficientes, sin volver mas lento el ingreso del paciente.

## Referencias

- frontend/src/components/CheckInModal.tsx
- frontend/src/actions/appointment.actions.ts
- context/Juntas/MINUTA_VISITA_AMI_2026-04-17.md
- context/SPECs/SPEC_ARCH-20260507-11-QR-IDENTIFICACION-OPERATIVA-MINIMA.md