# SPEC ARCH-20260507-08 — Cronograma de Papeleta Admin Persistente

- ID: ARCH-20260507-08
- Fecha: 2026-05-07
- Agente: INTEGRA - Arquitecto
- Estado: Planificado para implementacion

## Objetivo

Crear un cronograma persistente de papeleta asociado al evento medico, visible solo para administradores, que permita reconstruir la secuencia operativa del proceso y reutilizarla para filtros, auditoria y metricas de cierre mensual.

## Contexto

La trazabilidad ligera V1 resolvio una necesidad de visibilidad inmediata en pantalla, pero no cubre la necesidad de persistencia operativa institucional.

AMI necesita una bitacora central de la papeleta que permita responder despues:

1. Que ocurrio durante la atencion.
2. En que orden ocurrio.
3. Quien registro cada movimiento.
4. Que incidencias se presentaron.
5. Cuanto tiempo transcurrio entre hitos relevantes.

Esta necesidad apunta a administracion operativa y control, no a modificar la experiencia clinica base.

## Restriccion principal

El cronograma no debe rediseñar el flujo clinico actual.

Eso implica:

1. No reemplazar `EventTest.status`.
2. No volver obligatoria una nueva secuencia de pasos.
3. No bloquear atencion por falta de captura manual del cronograma.
4. No mezclar la vista administrativa con la vista clinica general del usuario comun.

## Propuesta funcional

### 1. Nueva entidad persistente de cronograma

Agregar una tabla nueva tipo `PapeletaTimelineEntry` con, como minimo:

1. `id`
2. `eventId`
3. `eventTestId` opcional
4. `entryType`
5. `area`
6. `title`
7. `description` opcional
8. `occurredAt`
9. `createdById` opcional
10. `visibility` con base en `ADMIN_ONLY`
11. `metadata` JSON opcional
12. `createdAt`

### 2. Captura automatica de movimientos base

El sistema debe registrar automaticamente entradas del cronograma cuando ya ocurren acciones naturales del flujo, por ejemplo:

1. estudio iniciado
2. muestra tomada
3. resultado registrado
4. estudio completado
5. examen medico guardado

Principio rector:

No pedir doble captura cuando el sistema ya conoce el movimiento.

### 3. Captura manual de incidencias administrativas

Los administradores deben poder agregar entradas manuales no bloqueantes al cronograma, por ejemplo:

1. paciente en espera
2. equipo no disponible
3. reprogramacion interna
4. requiere seguimiento operativo

Estas entradas no deben alterar el flujo medico ni los estados funcionales del estudio.

### 4. Vista admin-only del cronograma

Agregar en la papeleta o en el workspace una vista exclusiva para administradores con:

1. linea de tiempo del evento
2. filtros por tipo de movimiento
3. filtros por area
4. filtros por estudio
5. resumen superior de hitos operativos

La vista no debe mostrarse a roles no administrativos.

### 5. Base para metricas mensuales

El cronograma debe quedar modelado de forma que despues permita medir:

1. tiempos entre hitos
2. volumen de incidencias por sede
3. eventos con mayor friccion operativa
4. movimientos por tipo y area

No es obligatorio construir el dashboard mensual en esta iteracion, pero el modelo debe dejarlo viable.

## Alcance V1 de esta SPEC

Incluye:

1. tabla nueva persistente
2. escritura automatica de movimientos base
3. escritura manual de incidencias admin
4. vista admin-only del cronograma del evento
5. lectura cronologica por evento con filtros locales basicos

No incluye todavia:

1. dashboard mensual completo
2. SLA avanzados
3. notificaciones
4. cronograma visible para todos los roles
5. modelado exhaustivo de todas las estaciones del piso clinico

## Regla de diseño

El cronograma debe ser util para administracion y analitica sin estorbar a quien esta atendiendo.

Por eso:

1. automatico primero
2. manual solo para excepciones
3. admin-only por defecto
4. desacoplado de la logica clinica principal

## Diseño tecnico minimo

### Modelo sugerido

Entidad sugerida: `PapeletaTimelineEntry`

Campos sugeridos:

1. `id: String`
2. `eventId: String`
3. `eventTestId: String?`
4. `entryType: PapeletaTimelineEntryType`
5. `area: String?`
6. `title: String`
7. `description: String?`
8. `occurredAt: DateTime`
9. `createdById: String?`
10. `visibility: TimelineVisibility`
11. `metadata: Json?`
12. `createdAt: DateTime`

Enums sugeridos:

1. `PapeletaTimelineEntryType`
2. `TimelineVisibility`

Valores iniciales recomendados:

`PapeletaTimelineEntryType`:

1. `CHECK_IN`
2. `STUDY_STARTED`
3. `SAMPLE_TAKEN`
4. `RESULT_REGISTERED`
5. `STUDY_COMPLETED`
6. `MEDICAL_EXAM_SAVED`
7. `INCIDENCE`
8. `MANUAL_NOTE`

`TimelineVisibility`:

1. `ADMIN_ONLY`

### Puntos de escritura probables

1. `frontend/src/actions/event-test.actions.ts`
2. guardado de Examen Medico
3. acciones relacionadas con muestra y resultado

### Puntos de lectura probables

1. `frontend/src/services/medical-event.service.ts`
2. `frontend/src/app/events/[id]/page.tsx`
3. componente admin nuevo bajo `frontend/src/components/clinical/`

## Archivos probables

- frontend/prisma/schema.prisma
- frontend/src/actions/event-test.actions.ts
- frontend/src/services/medical-event.service.ts
- frontend/src/app/events/[id]/page.tsx
- frontend/src/components/clinical/PapeletaWorkspace.tsx
- frontend/src/components/clinical/PapeletaCronogramaAdmin.tsx

## Criterios de aceptacion

1. Existe una tabla persistente para cronograma de papeleta por evento.
2. Las acciones operativas base generan entradas automaticas sin doble captura manual.
3. Un administrador puede agregar al menos una incidencia manual al cronograma.
4. El cronograma del evento puede leerse en orden cronologico dentro de una vista admin-only.
5. La funcionalidad no altera el flujo actual de estudios ni de Examen Medico.
6. El modelo deja viable construir metricas mensuales despues.

## Riesgos controlados

1. Si se intenta capturar todo manualmente, el cronograma sera rechazado operativamente.
2. Si se mezcla con la UI general del workspace, puede contaminar el flujo clinico diario.
3. Si la tabla nace demasiado abierta y sin convenciones de tipos, luego sera dificil medir.

## Criterio de exito

La mejora sera exitosa si administracion puede revisar una papeleta dias o semanas despues y entender que ocurrio, en que orden y con que incidencias, sin depender de memoria humana ni del navegador donde se atendio.

## Referencias

- context/decisions/ADR-20260507-03-CRONOGRAMA-PAPELETA-ADMIN.md
- context/SPECs/SPEC_ARCH-20260507-07-TRAZABILIDAD-LIGERA-SIN-CAMBIAR-FLUJO.md
- context/Juntas/MINUTA_VISITA_AMI_2026-04-17.md
- context/Juntas/SEGUIMIENTO_VISITA_AMI_2026-04-17.md