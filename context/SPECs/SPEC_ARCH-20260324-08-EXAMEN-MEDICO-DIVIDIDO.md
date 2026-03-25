## SPEC: Examen Medico Dividido en Prellenado y Evaluacion Clinica
**ID:** `ARCH-20260324-08`
**Padre:** `ARCH-20260324-04`
**Objetivo:** Definir el Examen Medico como un flujo dividido en dos modulos coordinados: un cuestionario previo autollenado por el trabajador y una evaluacion clinica complementaria capturada por el medico durante la consulta.

### Decision Arquitectonica
- La idea es correcta y deseable para el producto.
- El Examen Medico no debe modelarse como un solo formulario monolitico llenado completamente por el medico.
- Debe separarse en dos momentos de captura:
  - **Modulo 1: Cuestionario del trabajador** antes de la cita.
  - **Modulo 2: Evaluacion medica** durante la consulta.
- El medico no debe recapturar informacion que el trabajador ya puede responder con anticipacion; su rol debe ser validar, complementar, corregir si hace falta y continuar con la parte clinica profesional.
- El prellenado del trabajador debe ser **opcional**, no requisito para continuar el flujo clinico.

### Justificacion
- Reduce tiempo de consulta presencial.
- Mejora la calidad del dato porque el trabajador responde con calma informacion historica y personal.
- Permite que el medico concentre la consulta en exploracion, criterio clinico, orientacion y aptitud.
- Hace que el estudio "Examen Medico" dentro de la papeleta tenga verdadero comportamiento de formulario estructurado y no de simple placeholder.

### Flujo Propuesto

#### Fase 1: Generacion de cita
- Cuando se genera la cita del trabajador, el sistema debe poder emitir un enlace unico de prellenado.
- Ese enlace debe apuntar al **Modulo 1: Cuestionario del trabajador**.
- El enlace puede enviarse por WhatsApp, correo o mostrarse en recepcion, segun el canal disponible.
- Si el trabajador no usa el enlace o no logra completar el cuestionario, la cita debe continuar con normalidad y el medico debe poder capturar la informacion faltante dentro del estudio Examen Medico.

#### Fase 2: Prellenado del trabajador
- El trabajador captura con anticipacion la informacion que si puede responder por si mismo.
- El sistema guarda ese avance ligado a la cita o al evento medico futuro.
- El trabajador puede dejar el formulario en estado:
  - no iniciado
  - en captura
  - enviado
- El flujo no debe bloquearse si el estado permanece en no iniciado.

#### Fase 3: Consulta medica
- Cuando el medico abre el estudio "Examen Medico" dentro de la papeleta, debe ver el formulario dividido.
- La informacion del trabajador debe aparecer precargada.
- Si no existe prellenado, el medico debe poder llenar directamente tambien la parte declarativa del trabajador dentro del mismo estudio.
- El medico puede:
  - revisar lo capturado
  - corregir o complementar respuestas si detecta inconsistencias
  - llenar la parte exclusivamente clinica
  - cerrar el estudio con impresion diagnostica y aptitud
- Todo esto debe ocurrir dentro del estudio "Examen Medico"; no en formularios paralelos fuera de la papeleta.

### Modulo 1: Cuestionario del Trabajador
Este modulo corresponde al contenido autollenable del esquema proporcionado por el usuario.

#### Secciones del modulo 1
- Datos personales
- Historia laboral
- Antecedentes heredo-familiares
- Antecedentes personales no patologicos y toxicomanias
- Antecedentes personales patologicos
- Antecedentes ginecologicos cuando aplique por sexo
- Inmunizaciones reportadas

#### Reglas funcionales del modulo 1
- Debe ser apto para portal web, movil o tablet.
- Debe permitir guardado parcial.
- Debe tener validaciones simples y lenguaje claro.
- Debe ocultar la seccion ginecologica cuando no aplique.
- Debe marcar visualmente secciones completas, incompletas y pendientes.
- Debe quedar asociado a la cita y posteriormente visible para el medico.

### Modulo 2: Evaluacion Clinica del Medico
Este modulo corresponde al contenido exclusivo del personal de salud.

#### Secciones del modulo 2
- Exploracion fisica general
- Pruebas especificas propias del acto medico
- Impresion diagnostica y aptitud

#### Reglas funcionales del modulo 2
- Debe ser visible solo para personal autorizado.
- Debe mostrar el resumen del modulo 1 ya contestado por el trabajador.
- Debe permitir continuar sin prellenado previo.
- Debe permitir al medico complementar o corregir datos del modulo 1 si es necesario.
- Debe autocompletar el medico que realiza con base en la sesion activa.
- Debe dejar campo para medico revisor cuando aplique.
- Debe incorporar la Exploracion Fisica como parte del modulo clinico del medico.
- No debe contener ni heredar Somatometria ni Agudeza Visual.
- Somatometria y Agudeza Visual deben modelarse como estudios independientes seleccionables por perfil y ejecutados como EventTests propios dentro de la Papeleta.

### Integracion con la Papeleta
- Dentro del Paso 3, el estudio "Examen Medico" sigue apareciendo como una prueba de la papeleta.
- Su accion principal ya no debe ser un placeholder generico, sino **Abrir formulario** o **Continuar formulario**.
- El estado visible del estudio debe considerar el avance de ambos modulos.
- El estudio debe contener de principio a fin todo el formulario del Examen Medico; no debe fragmentarse entre Sala y pantallas externas independientes.
- Somatometria y Agudeza Visual no forman parte del estudio Examen Medico; deben aparecer como estudios independientes cuando el perfil los incluya.

### Estados Propuestos del Estudio Examen Medico
- Pendiente: no existe captura del trabajador ni del medico.
- Prellenado parcial: el trabajador inicio pero no envio el modulo 1.
- Prellenado completo: el trabajador envio el modulo 1.
- En revision medica: el medico ya abrio o continua el modulo 2.
- Completado: el medico cerro impresion diagnostica y aptitud.

### Ajuste Operativo por Opcionalidad del Prellenado
- El estado **Pendiente** sigue siendo valido aunque la cita ya este en curso.
- El prellenado no debe ser condición para que el medico abra el estudio.
- Si no hubo prellenado, el estudio debe abrir con la parte del trabajador vacía pero editable por el medico.

### Contrato de UX
- Si el trabajador ya contesto el modulo 1, el medico no debe enfrentar una pantalla vacia.
- Si el trabajador no contesto el modulo 1, el medico no debe quedar bloqueado; simplemente debe iniciar desde el mismo estudio.
- Debe haber separacion visual clara entre:
  - informacion declarada por el trabajador
  - informacion confirmada o ajustada por el medico
  - informacion exclusivamente clinica
- La UI debe hacer evidente que el medico esta continuando un proceso ya iniciado, no capturando todo desde cero.
- Cuando no exista prellenado, la UI debe seguir manteniendo la misma estructura visual, cambiando solo el origen de captura.

### Decisiones de Modelo de Datos
- El Examen Medico necesita un modelo estructurado propio; no basta con un campo de texto o archivo.
- Debe existir persistencia separada para:
  - respuestas del trabajador
  - respuestas o validaciones del medico
  - estado del formulario
  - metadatos de envio y cierre
- La cita debe poder existir antes de que el evento medico entre formalmente a captura clinica, por lo que el prellenado debe asociarse al appointment o a una entidad intermedia ligada a ese appointment.

### Recomendacion de Implementacion
- Implementar esto en dos etapas:
  - **Etapa A:** Integrar Examen Medico dentro de la papeleta con accion real de abrir formulario, estructura dividida y captura médica completa dentro del estudio. En esta etapa el prellenado puede existir o no, pero nunca debe bloquear.
  - **Etapa B:** Habilitar el portal o enlace de prellenado opcional para el trabajador y reutilizar la misma estructura de datos.
- Si el tiempo lo permite, la mejor arquitectura desde el inicio es modelar ambos modulos juntos y permitir fallback a captura médica completa cuando el trabajador no prellene.

### Riesgos a Evitar
- Duplicar preguntas del trabajador y del medico en dos formularios sin relacion.
- Obligar al medico a volver a escribir antecedentes que el trabajador ya capturo.
- Mezclar respuestas autodeclaradas con hallazgos clinicos sin distinguir origen.
- Asociar el prellenado solo al worker sin anclarlo a una cita concreta.
- Duplicar Somatometria o Agudeza Visual dentro del Examen Medico cuando ya existen como estudios independientes del perfil.

### Archivos/Areas Impactadas en Futuras Implementaciones
- Flujo de generacion de cita
- Envio de enlace de prellenado
- Estudio Examen Medico dentro de la papeleta
- Nuevas actions y schemas de formulario estructurado
- Persistencia asociada a appointment/event

### Veredicto
- La propuesta del usuario es correcta.
- No solo mejora UX; tambien mejora operacion clinica y calidad de captura.
- Recomiendo adoptar formalmente este modelo dividido como la arquitectura oficial del Examen Medico.
