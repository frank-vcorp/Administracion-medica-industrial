# Analisis de cambios derivados de la visita AMI 2026-04-17

**ID:** DOC-20260519-01  
**Fecha:** 2026-05-19  
**Base principal:** [MINUTA_VISITA_AMI_2026-04-17.md](./MINUTA_VISITA_AMI_2026-04-17.md)  
**Complemento:** [SEGUIMIENTO_VISITA_AMI_2026-04-17.md](./SEGUIMIENTO_VISITA_AMI_2026-04-17.md)

## Objetivo

Dejar documentado, con criterio ejecutivo y trazable, que cambios se realizaron o se formalizaron a partir de la visita presencial a AMI del 17 de abril de 2026, y cual fue la justificacion operativa de cada uno.

## Lectura ejecutiva

La visita no revelo que el sistema careciera de base funcional. Lo que confirmo fue una brecha entre la plataforma ya construida y la operacion real observada en sitio: tiempos muertos, baja visibilidad del flujo, trazabilidad insuficiente entre areas, fricciones de recepcion y desalineacion del lenguaje clinico-operativo.

Desde esa visita, el repositorio muestra tres tipos de respuesta:

1. cambios ya implementados en el sistema
2. cambios ya formalizados en SPEC y backlog ejecutivo
3. pendientes que siguen abiertos porque requieren una iteracion posterior o datos adicionales de AMI

## Hallazgos base de la visita

Los hallazgos mas relevantes observados en sitio fueron:

1. falta de explicacion inicial al paciente sobre motivo, estudios, orden y tiempo estimado
2. tiempos muertos altos entre estaciones y regresos repetidos a sala de espera
3. baja visibilidad del flujo y de lo que ya estaba hecho o faltaba por hacer
4. trazabilidad interna insuficiente entre recepcion, enfermeria, laboratorio y medico
5. falla operativa en audiometria por equipo no listo
6. instrucciones logisticas incompletas para la muestra de orina
7. percepcion general de descoordinacion operativa aun con baja afluencia

Estos puntos quedaron asentados en [MINUTA_VISITA_AMI_2026-04-17.md](./MINUTA_VISITA_AMI_2026-04-17.md) y resumidos como linea de mejora en [SEGUIMIENTO_VISITA_AMI_2026-04-17.md](./SEGUIMIENTO_VISITA_AMI_2026-04-17.md).

## Cambios ya realizados

### 1. Cronograma admin persistente de papeleta

**Estado actual:** implementado y documentado como cierre operativo.  
**Evidencia:** [PROYECTO.md](../../PROYECTO.md), [CHK_ARCH-20260507-12-CIERRE-SESION.md](../checkpoints/CHK_ARCH-20260507-12-CIERRE-SESION.md), [SPEC_ARCH-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md](../SPECs/SPEC_ARCH-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md)

**Que se hizo**
- Se dejo operativo en produccion un cronograma persistente de papeleta con migracion remota aplicada.
- Se incorporo una base institucional para registrar y reconstruir hitos operativos del evento medico.

**Justificacion**
- La visita exhibio que no siempre era visible que ya se habia realizado y que seguia pendiente.
- El caso de la muestra de orina y la pregunta posterior del medico mostraron que la trazabilidad entre areas no era suficientemente clara.
- El cronograma no resuelve por si solo toda la experiencia del paciente, pero si ataca el problema estructural de visibilidad y rastreo operativo.

### 2. Depuracion del catalogo legacy para ocultar Somatometria y Agudeza Visual como pruebas generales aisladas

**Estado actual:** implementado de forma minima no destructiva.  
**Evidencia:** [PROYECTO.md](../../PROYECTO.md), [CHK_IMPL-20260518-16-DEPURACION-CATALOGO.md](../checkpoints/CHK_IMPL-20260518-16-DEPURACION-CATALOGO.md)

**Que se hizo**
- Se ocultaron del catalogo visible las pruebas legacy `GEN-01` y `GEN-02` para que dejen de aparecer como opciones generales seleccionables.
- No se eliminaron registros historicos ni relaciones existentes.

**Justificacion**
- La visita y el analisis posterior reforzaron que Somatometria, Signos Vitales y Agudeza Visual no deben sentirse como piezas ajenas al flujo medico real.
- Mantenerlas visibles como pruebas generales aisladas perpetuaba una semantica que AMI no reconoce como propia en operacion.

## Cambios formalizados a partir de la visita, pero no cerrados aun en implementacion

### 3. QR operativo minimo para reducir recaptura en estaciones y equipos

**Estado actual:** formalizado como backlog futuro, no implementado aun.  
**Evidencia:** [PROYECTO.md](../../PROYECTO.md), [SPEC_ARCH-20260507-11-QR-IDENTIFICACION-OPERATIVA-MINIMA.md](../SPECs/SPEC_ARCH-20260507-11-QR-IDENTIFICACION-OPERATIVA-MINIMA.md)

**Que se definio**
- Un QR minimo con nombre completo y fecha de nacimiento como ayuda operativa.
- Su uso seria no bloqueante y orientado a disminuir recaptura manual en estaciones o equipos.

**Justificacion**
- La visita confirmo friccion de recepcion y de continuidad operativa entre pasos.
- La solucion correcta no era cargar mas datos clinicos en el flujo, sino reducir trabajo repetitivo donde solo se necesita identificacion basica.

### 4. Corroboracion de identidad en check-in

**Estado actual:** formalizado como backlog futuro; ademas se detecto desviacion entre la SPEC y la UI vigente.  
**Evidencia:** [PROYECTO.md](../../PROYECTO.md), [SPEC_ARCH-20260507-12-CORROBORACION-IDENTIDAD-CHECK-IN.md](../SPECs/SPEC_ARCH-20260507-12-CORROBORACION-IDENTIDAD-CHECK-IN.md), [PROYECTO.md](../../PROYECTO.md)

**Que se definio**
- Agregar un paso corto de corroboracion antes del check-in para poder corregir nombre completo y, opcionalmente, adjuntar evidencia ligera de INE.
- Mantener auditoria de quien hizo la corroboracion y cuando.

**Justificacion**
- La visita mostro que recepcion si participa como punto de validacion operativa, pero el sistema seguia muy directo hacia el check-in.
- La correccion buscada no era abrir mantenimiento maestro del trabajador, sino resolver la friccion real observada en sitio con minimo impacto sobre la operacion.

### 5. Reintegracion de Somatometria, Signos Vitales y Agudeza Visual dentro de Examen Medico

**Estado actual:** reabierto y formalizado en SPEC; no aparece como implementado al cierre de este documento.  
**Evidencia:** [SPEC_ARCH-20260506-06-SOMATOMETRIA-DENTRO-EXAMEN-MEDICO.md](../SPECs/SPEC_ARCH-20260506-06-SOMATOMETRIA-DENTRO-EXAMEN-MEDICO.md), [PROYECTO.md](../../PROYECTO.md)

**Que se definio**
- Corregir la arquitectura visible para que Somatometria, Signos Vitales y Agudeza Visual vivan como pestañas internas del Examen Medico.
- Evitar que el medico sienta que debe salir del examen para capturar o revisar datos base del dictamen.

**Justificacion**
- La visita y el analisis clinico-operativo posterior mostraron que la separacion previa, aunque tecnicamente valida, no reflejaba bien la practica real de AMI.
- El problema ya no era de persistencia, sino de ubicacion funcional y experiencia clinica.

### 6. Agenda AMI basada en datos reales para capacidad, sobrecupo y flujo sin cita

**Estado actual:** formalizada en SPEC para implementacion gradual; no cerrada como modulo productizado.  
**Evidencia:** [SPEC_ARCH-20260506-07-AGENDA-AMI-DATOS-REALES.md](../SPECs/SPEC_ARCH-20260506-07-AGENDA-AMI-DATOS-REALES.md), [ANALISIS_INSUMOS_AMI_2026-05-06_POSIBLES-AVANCES.md](./ANALISIS_INSUMOS_AMI_2026-05-06_POSIBLES-AVANCES.md)

**Que se definio**
- Tomar la agenda real de AMI como insumo para evolucionar de agenda generica a agenda operativa.
- Analizar capacidad por sede, horas pico, sobrecupo y regla base para flujo sin cita o atencion masiva.

**Justificacion**
- La visita y la junta previa dejaron claro que la agenda existente no era suficiente para representar la dinamica real de AMI.
- La percepcion de espera, los regresos a sala y la necesidad de continuidad operativa mostraron que la agenda debia aterrizarse con datos reales y no solo con supuestos tecnicos.

### 7. Modulo base de Equipos, Calibracion y Mantenimiento

**Estado actual:** formalizado en SPEC para discovery estructurado; no implementado como modulo productivo.  
**Evidencia:** [SPEC_ARCH-20260506-08-EQUIPOS-CALIBRACION-MANTENIMIENTO.md](../SPECs/SPEC_ARCH-20260506-08-EQUIPOS-CALIBRACION-MANTENIMIENTO.md), [ANALISIS_INSUMOS_AMI_2026-05-06_POSIBLES-AVANCES.md](./ANALISIS_INSUMOS_AMI_2026-05-06_POSIBLES-AVANCES.md)

**Que se definio**
- Abrir un frente formal para modelar inventario tecnico, calibracion, mantenimiento preventivo y relacion con sedes o unidades moviles.
- Dejar lista la base funcional para semaforizacion de vigencias y visibilidad operativa.

**Justificacion**
- El incidente de audiometria en la visita no fue un detalle aislado de atencion; evidencio una falla de preparacion operativa de equipo.
- Esa observacion justifico que equipos y mantenimiento dejaran de verse como tema secundario y pasaran a backlog estructurado.

## Lo que sigue pendiente respecto a la visita

Aunque hubo cambios reales y formalizaciones relevantes, al corte actual siguen pendientes varios frentes originados en la visita:

1. una explicacion inicial clara al paciente sobre motivo, estudios, orden y tiempo estimado
2. una capa visible para el paciente o para operacion que muestre mejor el flujo y las pruebas pendientes en tiempo real
3. medicion operativa consolidada de tiempos muertos y tiempos efectivos por estacion
4. guias logisticas explicitas para pasos sensibles como la muestra de orina
5. cierre de la reintegracion de Somatometria dentro de Examen Medico
6. implementacion real del backlog de recepcion derivado de QR y corroboracion
7. implementacion real del modulo de equipos y del aterrizaje de agenda con datos AMI

## Conclusion

La visita del 17 de abril no se quedo solo como observacion cualitativa. Si produjo consecuencias concretas en el repositorio.

La respuesta mas tangible fue la implementacion del cronograma admin persistente, que ataca la falta de trazabilidad operativa. La segunda respuesta fue convertir varias fricciones observadas en backlog formal con direccion arquitectonica clara: recepcion, agenda real, equipos y correccion del flujo clinico visible.

Sin embargo, la conclusion honesta es que una parte importante de lo detectado en la visita sigue en fase de formalizacion o backlog y todavia no puede considerarse cerrada en operacion. Por eso este documento debe leerse como un corte de trazabilidad realista: muestra avances verdaderos, pero tambien deja visible lo que aun falta para reflejar plenamente la experiencia observada en AMI dentro del sistema.