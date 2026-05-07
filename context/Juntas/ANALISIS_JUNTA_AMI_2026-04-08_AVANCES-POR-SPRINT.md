# Analisis interno de junta AMI 2026-04-08 contra avances reales del sistema por sprint

**ID:** ARCH-20260506-03  
**Fecha:** 2026-05-06  
**Uso:** Documento interno de trabajo para Frank Saavedra y Copilot.  
**Fuente principal de contraste:** [Avances AMI_ 2026_04_08 12_50 CST - Notas de Gemini.md](./Avances%20AMI_%202026_04_08%2012_50%20CST%20-%20Notas%20de%20Gemini.md)

## Objetivo

Dejar trazado, de forma interna y ordenada, que puntos discutidos en la junta del 8 de abril ya corresponden a avances reales del sistema construidos en sprints previos o en iteraciones posteriores verificables dentro del repositorio.

## Lectura general

La junta del 8 de abril no partio de un sistema conceptual. La conversacion se monto sobre una base ya construida en sprints anteriores: agenda, citas, check-in, expedientes, papeleta, validacion medica, historial, auditoria y pipeline IA. Sin embargo, la reunion si evidencio que varios de esos avances aun requerian homologacion clinica, mejor nomenclatura y un ajuste mas fino al flujo operativo real de AMI.

## Trazabilidad por sprint y por tema de la junta

### 1. Base operativa previa a la junta

**Lo hablado en junta**
- Registro de empresas y pacientes.
- Agenda y gestion de citas.
- Check-in y paso a piso/estatus clinico.
- Expedientes y trazabilidad del paciente.
- Papeleta de estudios.
- Validacion medica.

**Avance real en sistema**
- La base de infraestructura, base de datos, UI de recepcion, expediente medico y flujo punta a punta ya estaba implementada desde febrero.
- El proyecto ya declaraba como alcance estructural un sistema para empresas, trabajadores, expedientes, citas y estudios medicos con IA.

**Evidencia**
- [PROYECTO.md](../../PROYECTO.md)
- [CHK_IMPL-20260225-04.md](../checkpoints/CHK_IMPL-20260225-04.md)

**Lectura interna**
- La reunion del 8 de abril ocurre cuando la plataforma ya tiene una columna vertebral operativa. La percepcion de “todavia en construccion” obedece mas a capa clinica, flujo y lenguaje que a ausencia de sistema.

### 2. Sprint 7 y modulo de citas, agenda y auditoria

**Lo hablado en junta**
- Gestion de citas por sucursal.
- Disponibilidad por horario.
- Flujo de check-in.
- Necesidad de trazabilidad de resultados y movimientos.
- Importancia de no perder visibilidad operativa.

**Avance real en sistema**
- El Sprint 7 ya habia incorporado el modelo Appointment y AuditLog, con relaciones a trabajador, empresa, sucursal y evento medico.
- Ya existia soporte de agenda, citas y bitacora para seguimiento de acciones criticas.

**Evidencia**
- [CHK_IMPL-20260225-04.md](../checkpoints/CHK_IMPL-20260225-04.md)
- [PROYECTO.md](../../PROYECTO.md)

**Lectura interna**
- Lo que en la junta se discute como definicion de proceso en realidad cae sobre una base de citas ya implementada. El hueco no era “crear citas desde cero”, sino ajustar reglas de operacion, nomenclatura y atencion masiva/sin cita.

### 3. Sprint de citas y piso clinico ya completado antes de la junta

**Lo hablado en junta**
- Cambio de “trabajadores” a “pacientes”.
- Revision de “piso clinico” y “centro de control”.
- Flujo de sala de espera, consultorio y validacion.
- Check-in con QR y arribo.

**Avance real en sistema**
- El repositorio ya registraba el sprint de Gestion de Citas y Piso Clinico como completado, incluyendo renombrado del flujo de piso, kanban sala-consultorio-validacion y modal de check-in con QR.

**Evidencia**
- [PROYECTO.md](../../PROYECTO.md)

**Lectura interna**
- La junta no inaugura el modulo de piso clinico; lo que hace es cuestionar su lenguaje y pedir mayor alineacion con la operacion AMI. Es una diferencia importante: habia producto, faltaba homologacion semantica y clinica.

### 4. Flujo trabajador a cita y continuidad operativa

**Lo hablado en junta**
- Alta del paciente y generacion de cita.
- Necesidad de agendar sin perder contexto.
- Flujo operativo entre registro y agenda.

**Avance real en sistema**
- Ya se habia trabajado el flujo integrado trabajador a cita y la navegacion directa despues de crear trabajador para continuar con la agenda.

**Evidencia**
- [CHK_IMPL-20260226-01-WORKER-REDIRECT.md](../checkpoints/CHK_IMPL-20260226-01-WORKER-REDIRECT.md)
- [CHK_IMPL-20260227-03-WORKER-APPOINTMENT-FLOW.md](../checkpoints/CHK_IMPL-20260227-03-WORKER-APPOINTMENT-FLOW.md)

**Lectura interna**
- El sistema ya estaba siendo refinado para continuidad de uso administrativo. La junta confirma que este tipo de continuidad si era critica para recepcion y operacion.

### 5. Validacion medica, papeleta y expediente

**Lo hablado en junta**
- Papeleta por perfil.
- Revision del expediente por medico.
- Carga de estudios, captura de valores y sugerencia de IA.
- Rechazo, aceptacion o edicion del diagnostico.

**Avance real en sistema**
- El flujo de expediente, papeleta y validacion medica ya formaba parte del producto base y habia sido robustecido con historial y workspace clinico.
- La reunion confirma que esa capa ya era visible y operable, aunque todavia requeria afinacion clinica.

**Evidencia**
- [PROYECTO.md](../../PROYECTO.md)
- [CHK_IMPL-20260324-06-PAPELETA-WORKSPACE.md](../checkpoints/CHK_IMPL-20260324-06-PAPELETA-WORKSPACE.md)
- [CHK_ARCH-20260326-01.md](../checkpoints/CHK_ARCH-20260326-01.md)

**Lectura interna**
- El valor de la junta aqui fue menos “definir si existira una papeleta” y mas “aterrizar como debe verse y hablar para medicos ocupacionales reales”.

### 6. Historial clinico longitudinal y menor recaptura

**Lo hablado en junta**
- Examen medico dividido en modulos.
- Revision de antecedentes y datos prellenados.
- Necesidad de reutilizar mejor informacion y no capturar de mas.

**Avance real en sistema**
- Posterior a la junta, el repositorio consolida el historial clinico longitudinal como maestro, con menor recaptura y fallback inline.

**Evidencia**
- [PROYECTO.md](../../PROYECTO.md)
- [CHK_IMPL-20260305-01.md](../checkpoints/CHK_IMPL-20260305-01.md)
- [CHK_ARCH-20260326-06.md](../checkpoints/CHK_ARCH-20260326-06.md)

**Lectura interna**
- Este punto confirma que la reunion si empujaba hacia una base clinica mas madura: no solo capturar por episodio, sino empezar a estructurar continuidad longitudinal.

### 7. Somatometria y agudeza visual como estudios propios

**Lo hablado en junta**
- Se discutio explicitamente si somatometria, signos vitales y agudeza visual debian vivir como pruebas aparte o dentro del examen medico.
- Se acordo integrarlas de forma coherente al flujo real del examen.

**Avance real en sistema**
- El repositorio registra como decision e implementacion la separacion de Somatometria y Agudeza Visual como EventTests independientes dentro de la Papeleta.

**Evidencia**
- [CHK_ARCH-20260325-05.md](../checkpoints/CHK_ARCH-20260325-05.md)
- [CHK_IMPL-20260325-09.md](../checkpoints/CHK_IMPL-20260325-09.md)
- [PROYECTO.md](../../PROYECTO.md)

**Lectura interna**
- Este es uno de los mejores ejemplos de como la junta si tuvo traduccion directa a arquitectura funcional del sistema.

### 8. Calibracion IA y lectura de estudios

**Lo hablado en junta**
- Necesidad de calibrar pruebas con formatos reales.
- Dos capas de calibracion: por IA y por tabulador/criterio medico.
- Solicitud de PDF crudo o salida real de maquinaria.

**Avance real en sistema**
- El sistema ya tenia pipeline IA, extraccion estructurada y prediagnostico.
- Posteriormente se implemento una plataforma de calibracion asistida con versionado automatico y workspace documental.

**Evidencia**
- [PROYECTO.md](../../PROYECTO.md)
- [CHK_ARCH-20260327-19-CALIBRACION-ASISTIDA.md](../checkpoints/CHK_ARCH-20260327-19-CALIBRACION-ASISTIDA.md)

**Lectura interna**
- La junta no parte de cero en IA. Lo que pide es pasar de una capa tecnica general a una calibracion clinicamente gobernada por material de AMI.

### 9. Equipos, mantenimiento y unidades moviles

**Lo hablado en junta**
- Disponibilidad de unidades moviles.
- Calendario de proyectos.
- Programa de calibracion y mantenimiento de equipos.

**Avance real en sistema**
- No se identifica en los checkpoints leidos un modulo de unidades moviles ya cerrado como sprint productizado.
- Si existe planteamiento funcional y espacio natural para convertirlo en modulo derivado de sucursales, equipos y calendario.

**Lectura interna**
- Este frente seguia mas cerca de discovery/planeacion que de sprint cerrado. Por eso los insumos que AMI mando ahora son relevantes: aqui si pueden abrir una linea nueva de producto.

## Resumen ejecutivo interno

### Lo que ya estaba construido o muy avanzado al momento de la junta
- Infraestructura del sistema.
- Empresas, trabajadores/pacientes, sucursales.
- Agenda y citas.
- Check-in y flujo operativo base.
- Expedientes.
- Papeleta y validacion medica.
- Historial clinico en evolucion.
- Pipeline IA con lectura y extraccion.

### Lo que la junta vino a corregir o aterrizar
- Nomenclatura clinica.
- Ajuste del flujo a operacion AMI.
- Atencion masiva y sin cita.
- Integracion coherente de somatometria/agudeza/signos vitales.
- Gobernanza medica de la calibracion IA.

### Conclusión interna

La junta del 8 de abril debe leerse como una sesion de homologacion clinico-operativa sobre una plataforma ya sustancialmente avanzada por sprints, no como una sesion de descubrimiento de un prototipo inicial. El valor de esa junta estuvo en orientar el siguiente tramo: pasar de una base funcional robusta a una capa mas especializada en lenguaje clinico, flujo real AMI y calibracion medica gobernada por insumos autenticos.

## Sprints de hoy

### Sprint de hoy 1. Corregir Somatometria dentro de Examen Medico
- Reintegrar Somatometria y Signos Vitales como pestaña o bloque interno de Examen Medico.
- Mantener compatibilidad de persistencia sin perder datos existentes.
- Eliminar la sensacion de que el medico sale del examen para capturar datos base.

### Sprint de hoy 2. Audiometria calibrada y probada
- Separar claramente extraccion documental e interpretacion clinica.
- Usar los tabuladores enviados por la Dra. Erika para la capa de interpretacion.
- Dejar un flujo completo de prueba desde estudio hasta apoyo clinico revisable.

### Sprint de hoy 3. Espirometria calibrada y probada
- Separar claramente extraccion documental e interpretacion clinica.
- Usar los tabuladores enviados por la Dra. Erika para la capa de interpretacion.
- Dejar un flujo completo de prueba desde estudio hasta apoyo clinico revisable.

### Sprint de hoy 4. Agenda y Equipos quedan formalizados
- Agenda AMI con datos reales queda en SPEC para explotacion operativa posterior.
- Equipos, calibracion y mantenimiento quedan en SPEC para construir modulo propio sin frenar el frente clinico.