# HANDOFF ARCH-20260514-01 a SOFIA — Alineacion de corroboracion con nombre e INE

- ID: ARCH-20260514-01
- Fecha: 2026-05-14
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion
- SPEC fuente: context/SPECs/SPEC_ARCH-20260514-01-ALINEACION-CORROBORACION-NOMBRE-INE.md

## Objetivo

Corregir el modal de corroboracion previo al check-in para que permita corroborar identidad y corregir nombre completo contra la INE, en vez de actuar principalmente como formulario de contacto.

## Hallazgo ya verificado

Implementacion actual observada:

1. `frontend/src/components/CorroborationModal.tsx` muestra nombre solo lectura
2. permite editar telefono y correo
3. no expone fecha de nacimiento para contraste operativo
4. no expone carga de INE frente/reverso
5. llama a `updateWorkerContactData()` en `frontend/src/actions/worker.actions.ts`, que explicitamente no toca identidad

## Correccion minima obligatoria

1. agregar campo editable para nombre corroborado
2. mostrar fecha de nacimiento en modo lectura
3. mantener telefono/correo solo como bloque secundario si decides conservarlos
4. agregar accion para persistir correccion de nombre con auditoria
5. confirmar check-in despues de aplicar la correccion, no antes

## Alcance recomendado de V1

### Minimo indispensable

1. corregir nombre completo
2. auditar nombre previo y nuevo
3. mantener check-in funcional

### Deseable si entra en el mismo slice sin abrir demasiado frente

1. upload opcional de INE frente
2. upload opcional de INE reverso
3. ligarlos al evento o a una entidad de corroboracion

## Restricciones

1. no abrir edicion libre de CURP, NSS, empresa, puesto ni datos clinicos
2. no hacer obligatoria la INE para completar el check-in
3. no convertir el modal en una pantalla pesada de mantenimiento maestro
4. no perder compatibilidad con el flujo actual de citas y creacion de evento

## Anclas reales

1. frontend/src/components/CorroborationModal.tsx
2. frontend/src/actions/worker.actions.ts
3. frontend/src/actions/appointment.actions.ts
4. frontend/src/app/appointments/page.tsx

## Criterios de aceptacion minimos

1. recepcion puede corregir el nombre antes del check-in
2. el modal muestra fecha de nacimiento para corroboracion visual
3. si el nombre cambia, queda auditoria
4. el flujo sigue siendo rapido cuando no hay discrepancia
5. contacto queda como secundario, no como foco principal de la corroboracion

## Nota de implementacion

La SPEC original `context/SPECs/SPEC_ARCH-20260507-12-CORROBORACION-IDENTIDAD-CHECK-IN.md` ya pedia esta capacidad. Este handoff existe para cerrar la desviacion real observada en produccion y alinear la UI con la intencion original.