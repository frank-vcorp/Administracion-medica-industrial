# SPEC ARCH-20260514-01 — Alineacion de Corroboracion de Identidad con correccion de nombre e INE

- ID: ARCH-20260514-01
- Fecha: 2026-05-14
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementacion
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260507-12-CORROBORACION-IDENTIDAD-CHECK-IN.md
  - frontend/src/components/CorroborationModal.tsx
  - frontend/src/actions/worker.actions.ts

## Objetivo

Corregir la desviacion entre la especificacion de corroboracion de identidad y la UI real del check-in para que recepcion pueda corregir el nombre completo contra la INE y adjuntar evidencia ligera, en lugar de limitarse solo a telefono y correo.

## Hallazgo verificado

La especificacion previa ya establecia que durante la corroboracion se debia poder:

1. corregir el nombre completo
2. visualizar fecha de nacimiento
3. adjuntar INE frente
4. adjuntar INE reverso

Sin embargo, la implementacion actual observada en `frontend/src/components/CorroborationModal.tsx` muestra:

1. nombre solo en lectura
2. telefono editable
3. correo editable
4. sin campos ni flujo para INE frente o reverso
5. sin trazabilidad explicita de correccion de identidad

Ademas, `frontend/src/actions/worker.actions.ts` contiene una accion `updateWorkerContactData()` descrita y limitada a datos de contacto seguros, lo que confirma que el flujo actual no resuelve la necesidad de identidad definida en la SPEC original.

## Decision de arquitectura

La fuente de verdad vigente se ratifica asi:

1. la corroboracion previa al check-in es principalmente de identidad, no de contacto
2. el nombre completo debe poder corregirse de forma controlada cuando la INE no coincide con el registro
3. telefono y correo pueden seguir siendo editables como capacidad secundaria, pero no deben desplazar el objetivo principal del modal
4. la evidencia INE frente y reverso queda como adjunto opcional de V1 si el slice lo permite sin volver pesado el ingreso

## Alcance aprobado

Incluye:

1. mostrar nombre actual registrado
2. agregar campo editable de nombre completo corroborado
3. mostrar fecha de nacimiento en modo lectura para contraste con la INE
4. permitir confirmar el check-in con o sin cambio de nombre
5. dejar trazabilidad del nombre previo y del nuevo nombre cuando exista correccion
6. incorporar, si el slice lo permite, adjuntos opcionales para INE frente y reverso

No incluye:

1. OCR de INE
2. validacion oficial contra fuentes externas
3. edicion abierta del resto de datos maestros del trabajador
4. hacer obligatoria la carga de INE para todos los ingresos

## Reglas obligatorias

1. no abrir edicion libre de CURP, NSS, empresa, puesto ni datos clinicos
2. el cambio de nombre debe quedar auditado con valor previo, valor nuevo, usuario y timestamp
3. el check-in no debe bloquearse si no se adjunta INE
4. si no hay cambio de nombre, el flujo debe seguir siendo rapido
5. el modal debe comunicar explicitamente que la corroboracion se hace contra identificacion presentada

## Diseno tecnico minimo

### UI

El modal de corroboracion debe priorizar estos elementos:

1. nombre registrado actual
2. campo editable `nombre corroborado`
3. fecha de nacimiento visible
4. bloque secundario de contacto
5. bloque opcional de adjuntos `INE frente` y `INE reverso`

### Acciones

Se autoriza separar responsabilidades en acciones distintas:

1. accion para actualizar contacto seguro
2. accion para corregir identidad minima del trabajador o del evento
3. accion o helper de auditoria para registrar la corroboracion

### Persistencia recomendada

Si se busca el corte mas corto:

1. actualizar `firstName` y `lastName` del trabajador a partir del nombre corroborado
2. guardar auditoria con nombre previo y nombre nuevo
3. dejar adjuntos INE ligados al evento si ya existe infraestructura de uploads

Si se busca mejor trazabilidad:

1. modelar una entidad de corroboracion asociada al evento
2. conservar tanto el nombre previo como el corroborado sin perder historico

## Archivos probables

1. frontend/src/components/CorroborationModal.tsx
2. frontend/src/actions/worker.actions.ts
3. frontend/src/actions/appointment.actions.ts
4. frontend/prisma/schema.prisma si se crea entidad de corroboracion
5. frontend/src/lib/audit.ts o equivalente

## Criterios de aceptacion

1. recepcion puede corregir el nombre completo desde el modal de corroboracion antes del check-in
2. la fecha de nacimiento se muestra como dato de contraste en la corroboracion
3. telefono y correo, si permanecen editables, quedan subordinados al flujo de identidad y no como objetivo principal del modal
4. el sistema registra auditoria cuando el nombre cambia
5. el flujo de check-in no se rompe ni se vuelve mas pesado para casos sin discrepancia
6. si entra la carga de INE en este slice, queda como opcional y claramente separada en frente y reverso

## Criterio de exito

La correccion sera exitosa cuando el modal de corroboracion deje de ser un formulario de contacto y vuelva a cumplir su funcion original: verificar identidad y corregir el nombre contra la INE sin bloquear la operacion.