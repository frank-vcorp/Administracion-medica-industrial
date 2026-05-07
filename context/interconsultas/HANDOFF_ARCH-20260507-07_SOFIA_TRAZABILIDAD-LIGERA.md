# HANDOFF DE IMPLEMENTACION

- ID: ARCH-20260507-07
- Fecha: 2026-05-07
- Agente origen: INTEGRA - Arquitecto
- Agente destino: SOFIA - Builder
- Estado: Listo para implementacion
- SPEC fuente: context/SPECs/SPEC_ARCH-20260507-07-TRAZABILIDAD-LIGERA-SIN-CAMBIAR-FLUJO.md

## Objetivo

Implementar una capa de trazabilidad operativa ligera dentro del workspace actual del evento, reutilizando checkpoints y acciones ya existentes, sin cambiar el flujo clinico ni agregar friccion operativa.

## Contexto funcional

La necesidad nace de la visita de validacion presencial en AMI y no apunta a redisenar el proceso, sino a volverlo visible.

El sistema actual ya tiene un workspace funcional de estudios y ya registra senales utiles:

1. estados por `EventTest`
2. acciones de muestra tomada
3. uploads por estudio
4. formularios estructurados como Examen Medico
5. datos serializados del evento y sus estudios

La implementacion debe aprovechar esas senales para mostrar mejor:

1. que ya se hizo
2. que falta
3. cual fue el ultimo paso visible
4. cual es el siguiente paso sugerido

## Alcance obligatorio V1

### 1. Resumen de trazabilidad del evento

Agregar dentro del workspace actual un bloque compacto con:

1. ultimo movimiento registrado
2. siguiente paso sugerido
3. conteo de estudios completados vs pendientes
4. indicador de muestra tomada cuando exista evidencia en el evento

### 2. Timeline operativa ligera

Agregar una lista compacta de eventos recientes derivados de acciones ya existentes, por ejemplo:

1. estudio iniciado
2. muestra tomada
3. resultado registrado
4. examen medico guardado

No crear una maquina de estados nueva. La timeline debe derivarse primero de datos ya existentes.

### 3. Visibilidad cruzada

Hacer visible dentro del workspace que ciertos hitos ya ocurrieron, especialmente:

1. muestra biologica ya tomada
2. captura base ya realizada cuando aplique
3. estudios con resultado ya cargado

### 4. Incidencia operativa minima

Agregar soporte V1 para registrar al menos una incidencia simple y no bloqueante, visible dentro del workspace. Ejemplos validos:

1. equipo no disponible
2. paciente en espera

Si para esta primera iteracion conviene dejarlo limitado a una estructura minima en memoria persistida dentro de un campo JSON ya existente o similar, es aceptable, siempre que no fuerce migracion amplia.

## Restricciones

1. No cambiar el flujo actual.
2. No reordenar estaciones.
3. No tocar la logica funcional ya aprobada de Examen Medico.
4. No convertir el siguiente paso sugerido en una secuencia obligatoria.
5. No introducir capturas manuales redundantes si la informacion puede inferirse de acciones ya existentes.
6. Evitar migracion Prisma en V1 salvo necesidad extrema y claramente justificada.

## Anclas tecnicas probables

Trabajar primero sobre estas superficies:

1. frontend/src/components/clinical/PapeletaWorkspace.tsx
2. frontend/src/app/events/[id]/page.tsx
3. frontend/src/services/medical-event.service.ts
4. frontend/src/actions/event-test.actions.ts

Si hace falta un componente nuevo para el bloque de trazabilidad, mantenerlo acotado bajo `frontend/src/components/clinical/`.

## Estrategia sugerida

1. Construir un adaptador local de trazabilidad basado en `eventTests` y sus estados actuales.
2. Derivar `ultimoMovimiento`, `siguientePasoSugerido` y `resumenOperativo` sin cambiar estados existentes.
3. Renderizar un bloque visible de trazabilidad en el workspace actual.
4. Si la incidencia operativa requiere persistencia, resolverlo con la opcion menos invasiva posible.

## Criterios de aceptacion minimos

1. Dentro del workspace actual se ve un resumen claro del avance del evento.
2. El usuario puede ver ultimo movimiento y siguiente paso sugerido sin abrir nuevas pantallas.
3. La UI deja mas visible que estudios o hitos ya ocurrieron, especialmente muestra tomada y resultados registrados.
4. La experiencia sigue sintiendose como el mismo flujo actual.
5. La implementacion no rompe la logica reciente de muestra compartida ni la de Examen Medico.

## Validacion esperada

1. Ejecutar validacion local disponible si el entorno lo permite.
2. Si no hay toolchain local, dejar constancia explicita.
3. Ejecutar qodo self-review si esta disponible.
4. Generar checkpoint de implementacion con archivos tocados, validacion y riesgos.

## Nota para SOFIA

Prioriza una V1 pequena y visible. Si aparecen opciones de scope mayor, no las absorbas dentro de esta iteracion. La meta es observabilidad operativa ligera, no rediseno del flujo.