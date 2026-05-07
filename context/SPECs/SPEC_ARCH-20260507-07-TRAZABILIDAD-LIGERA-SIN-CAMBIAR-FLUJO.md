# SPEC ARCH-20260507-07 — Trazabilidad Ligera sin Cambiar Flujo

- ID: ARCH-20260507-07
- Fecha: 2026-05-07
- Agente: INTEGRA - Arquitecto
- Estado: Planificado para implementacion

## Objetivo

Agregar una capa de trazabilidad operativa y visibilidad interna sobre la papeleta y el evento medico actual, sin modificar el flujo clinico vigente ni el orden operativo de atencion.

## Contexto

La visita de validacion presencial en AMI dejo un hallazgo consistente: el problema principal no parece ser la estructura general del flujo, sino la falta de visibilidad sobre lo ya realizado, lo pendiente, el siguiente paso y la trazabilidad entre estaciones.

Esto se observa especialmente en cuatro puntos:

1. El paciente no siempre entiende que pruebas siguen o cuanto falta.
2. Las areas internas no siempre comparten con suficiente claridad el estado real del proceso.
3. Existen tiempos muertos que hoy no quedan medidos ni explicados.
4. Hay pasos sensibles donde la operacion depende de memoria humana o de suposiciones.

## Restriccion principal

Esta SPEC no debe cambiar el flujo actual.

Eso significa:

1. No cambiar el orden de estaciones.
2. No rediseñar la navegacion principal del workspace clinico.
3. No alterar la logica ya implementada de Examen Medico.
4. No reemplazar la semantica actual de estados por estudio.
5. No forzar nuevas pantallas obligatorias para completar la atencion.

La solucion debe montarse encima del flujo existente como capa de observabilidad operativa.

## Problema actual

Hoy el sistema ya resuelve buena parte de la captura clinica y del workspace de estudios, pero aun carece de una bitacora operativa suficientemente visible para responder preguntas basicas durante la atencion:

1. Que ya se hizo.
2. Que falta.
3. En que area estuvo por ultima vez el paciente.
4. Cual es el siguiente paso sugerido.
5. Cuanto tiempo lleva esperando o en proceso.

## Propuesta funcional

### 1. Resumen de trazabilidad del evento

Agregar dentro del workspace del evento un bloque compacto y siempre visible con:

1. Ultimo movimiento registrado.
2. Siguiente paso sugerido.
3. Conteo de estudios pendientes vs completados.
4. Indicador de muestra tomada cuando aplique.

Este bloque no cambia el flujo. Solo aporta contexto.

### 2. Timeline operativo ligero

Agregar una linea o lista de eventos recientes del proceso, por ejemplo:

1. Recepcion confirmada.
2. Muestra de sangre tomada.
3. Somatometria completada.
4. Audiometria iniciada.
5. Examen medico en curso.

La timeline debe ser informativa, no bloqueante.

### 3. Registro de transiciones entre estaciones

Cada accion relevante ya existente debe dejar una marca visible de transicion operativa cuando sea viable, por ejemplo:

1. Inicio de estudio.
2. Muestra tomada.
3. Resultado registrado.
4. Estudio completado.

En V1 no se requiere modelar todo el hospital ni crear una maquina de estados compleja por estacion. Basta con reutilizar eventos operativos ya naturales del flujo.

### 4. Visibilidad cruzada entre areas

Cuando una accion importante ocurra en una parte del proceso, debe quedar visible para las demas areas sin necesidad de preguntar manualmente.

Casos prioritarios:

1. Si ya se tomo muestra biologica, el medico debe poder verlo.
2. Si somatometria o signos vitales ya se capturaron, debe quedar claro para quien entra despues.
3. Si un estudio ya tiene resultado cargado, debe verse sin abrir varias capas.

### 5. Incidencias operativas no bloqueantes

Agregar un mecanismo ligero para registrar incidencias de operacion sin alterar el flujo principal. Ejemplos iniciales:

1. Equipo no disponible.
2. Paciente en espera.
3. Muestra pendiente de repetir.
4. Requiere seguimiento manual.

Estas incidencias deben ser opcionales y visibles, no un nuevo cuello de botella.

### 6. Instrucciones contextuales en pasos sensibles

En estudios o estados donde suele haber ambiguedad operativa, mostrar textos de apoyo breves para el personal. Ejemplos:

1. Muestra de orina requiere indicacion explicita al paciente.
2. Audiometria requiere confirmacion operativa previa del equipo.

Estas instrucciones deben vivir como apoyo contextual, no como wizard ni como flujo nuevo.

## Alcance V1

La V1 debe concentrarse en trazabilidad visible y ligera dentro del evento actual.

Incluye:

1. Resumen de trazabilidad del evento.
2. Timeline operativa reciente.
3. Ultimo paso y siguiente paso sugerido.
4. Visibilidad cruzada de estados importantes ya existentes.
5. Incidencias operativas opcionales y simples.

No incluye en V1:

1. Reingenieria del flujo de piso clinico.
2. Rediseño completo de estaciones.
3. Motor complejo de SLA o analitica avanzada.
4. Modulo formal de mantenimiento de equipos.
5. Cambios de permisos o de roles.

## Regla de diseño

La trazabilidad debe nacer de acciones que el usuario ya realiza hoy.

Principio rector:

No pedir doble captura si el sistema puede inferir el avance desde una accion ya existente.

Ejemplos:

1. Si el usuario marca muestra tomada, eso ya debe alimentar la trazabilidad.
2. Si el usuario abre o inicia un estudio, eso puede registrar actividad operativa.
3. Si se guarda un formulario o se sube un archivo, eso debe reflejarse como avance.

## Diseño tecnico minimo

### Fuente de datos inicial

La V1 debe priorizar reutilizar datos ya existentes del evento y de sus estudios:

1. `EventTest.status`
2. Marcas de actualizacion disponibles
3. Snapshots ya guardados por estudio
4. Acciones existentes del workspace

Si hace falta una estructura nueva, debe ser minima y enfocada a timeline/incidencias, evitando una migracion amplia en la primera version.

### Posible estrategia tecnica

1. Construir un adaptador de trazabilidad a partir del `MedicalEvent` y sus `EventTests`.
2. Derivar `ultimoPaso` y `siguientePaso` a partir de estados existentes.
3. Agregar un bloque UI en el workspace con resumen y actividad reciente.
4. Registrar incidencias ligeras en una estructura simple, idealmente incremental y desacoplada.

## Archivos probables

- frontend/src/app/events/[id]/page.tsx
- frontend/src/components/clinical/PapeletaWorkspace.tsx
- frontend/src/actions/event-test.actions.ts
- frontend/src/services/medical-event.service.ts

## Criterios de aceptacion

1. El usuario puede ver, dentro del workspace actual, un resumen claro de avance del evento sin salir del flujo existente.
2. El sistema muestra el ultimo paso registrado y un siguiente paso sugerido sin volver obligatoria ninguna accion nueva.
3. La muestra tomada, la captura base y el avance de estudios relevantes son visibles de forma cruzada para las areas que entren despues.
4. La UI no agrega friccion ni obliga al usuario a navegar por nuevas pantallas para continuar trabajando.
5. El flujo actual de Examen Medico y la logica actual de estudios no se altera.
6. El sistema permite registrar al menos una incidencia operativa simple sin romper el flujo principal.

## Riesgos controlados

1. Si la trazabilidad intenta modelar demasiado detalle desde V1, puede terminar redisenando el flujo sin querer.
2. Si se introducen demasiados campos manuales, se generara doble captura y rechazo operativo.
3. Si el siguiente paso sugerido se vuelve demasiado rigido, podria ser interpretado como secuencia obligatoria cuando no siempre lo es.

## Criterio de exito

La mejora sera exitosa si AMI percibe mayor claridad sobre lo realizado, lo pendiente y el estado compartido del paciente, sin sentir que el sistema cambio su manera de trabajar.

## Referencias

- context/Juntas/MINUTA_VISITA_AMI_2026-04-17.md
- context/Juntas/SEGUIMIENTO_VISITA_AMI_2026-04-17.md
- context/SPECs/SPEC_ARCH-20260324-03-PAPELETA.md
- context/SPECs/SPEC_ARCH-20260507-06-MUESTRA-COMPARTIDA-POR-TIPO.md