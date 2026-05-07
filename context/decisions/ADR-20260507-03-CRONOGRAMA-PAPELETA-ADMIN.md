# ADR-20260507-03 — Cronograma de Papeleta Admin con Tabla Dedicada

- ID: ARCH-20260507-08
- Fecha: 2026-05-07
- Agente: INTEGRA - Arquitecto
- Estado: Aprobado para planificacion

## Decision

La trazabilidad operativa reutilizable para papeleta se almacenara en una tabla dedicada tipo `PapeletaTimelineEntry`, asociada al evento medico, con visibilidad administrativa y orientacion a filtros, cronologia y metricas de cierre mensual.

## Contexto

La V1 de trazabilidad ligera ya publicada resolvio visibilidad inmediata dentro del workspace, pero no dejo una persistencia centralizada suficiente para auditoria operativa, consulta multiusuario ni analitica de fin de mes.

El problema no es solo mostrar contexto durante la atencion. El negocio necesita conservar una secuencia operativa consultable despues para responder preguntas como:

1. Cuanto tiempo duro cada tramo del proceso.
2. Donde se generaron cuellos de botella.
3. Que incidencias se repitieron por sede, area o estudio.
4. Que paso primero, que paso despues y quien lo registro.

## Alternativas consideradas

### 1. Mantener localStorage

Descartada porque:

1. No sirve para cierre mensual.
2. No es multiusuario.
3. No permite reporteo central.
4. Se pierde al cambiar de navegador o equipo.

### 2. Guardar un JSON en `MedicalEvent`

Aceptable solo como salida temporal, pero descartada como opcion principal porque:

1. Complica filtros y metricas agregadas.
2. Hace mas costosa la evolucion del cronograma.
3. Mezcla una bitacora creciente dentro del agregado principal del evento.
4. Debilita consultas operativas por tipo de movimiento, area o rango de fechas.

### 3. Crear tabla dedicada `PapeletaTimelineEntry`

Elegida porque:

1. Se alinea mejor con una bitacora cronologica real.
2. Facilita filtros por evento, estudio, area, tipo y fecha.
3. Permite visibilidad admin-only sin contaminar el flujo clinico general.
4. Abre el camino a metricas mensuales y reportes operativos.

## Consecuencias

### Positivas

1. El cronograma queda persistido y reutilizable.
2. Se puede construir panel admin con filtros y metricas.
3. La captura automatica y manual pueden convivir en una misma bitacora.
4. El modelo soporta crecimiento hacia SLA, trazabilidad por area y auditoria operativa.

### Costos

1. Requiere migracion Prisma.
2. Requiere capa de escritura de eventos del cronograma.
3. Requiere reglas claras de visibilidad administrativa.

## Regla arquitectonica

El cronograma debe vivir como capa operativa paralela al flujo clinico, no como reemplazo de los estados actuales de `EventTest` ni como nueva maquina obligatoria del piso clinico.

## Referencias

- context/SPECs/SPEC_ARCH-20260507-07-TRAZABILIDAD-LIGERA-SIN-CAMBIAR-FLUJO.md
- context/Juntas/MINUTA_VISITA_AMI_2026-04-17.md
- context/Juntas/SEGUIMIENTO_VISITA_AMI_2026-04-17.md