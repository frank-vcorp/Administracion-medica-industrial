## SPEC HIJA: Portal Temporal de Prellenado para Trabajador
**ID:** `ARCH-20260324-09`
**Padre:** `ARCH-20260324-08`
**Objetivo:** Definir el portal temporal mediante el cual el trabajador puede capturar unicamente el modulo de prellenado del Examen Medico, usando una invitacion segura, de vigencia corta y operable desde WhatsApp, enlace directo, QR o tableta institucional de AMI.

### 🎯 Resultado Esperado
Recepcion o personal autorizado debe poder generar una invitacion temporal asociada a una cita para que el trabajador llene solo la parte declarativa del Examen Medico. Esa invitacion debe expirar automaticamente a las 6 horas, poder regenerarse y funcionar tanto en celular propio del trabajador como en una tableta AMI en sala de espera.

### ✅ Criterios de Aceptacion

#### 1. Regla de Acceso
- El trabajador no entra al expediente ni a la papeleta interna.
- El trabajador accede a un portal publico controlado por token.
- El portal solo expone el **Modulo 1: Cuestionario del trabajador**.
- El portal no debe mostrar al trabajador informacion de Somatometria, Agudeza Visual, Exploracion Fisica, impresion diagnostica, aptitud ni controles medicos internos.
- La restriccion de visibilidad debe aplicarse desde backend y no depender solo de ocultamiento visual en frontend.

#### 2. Token Temporal
- Cada invitacion debe generar un token unico asociado a una cita o entidad equivalente ligada a la cita.
- El token debe tener vigencia de **6 horas** desde su emision.
- Solo puede existir **una invitacion activa por cita**.
- Si se genera una nueva invitacion, la anterior debe invalidarse.
- Al expirar, el portal debe mostrar un mensaje claro indicando que el enlace vencio y que debe solicitar uno nuevo en AMI.
- Recepcion debe poder regenerar la invitacion sin editar manualmente datos tecnicos.

#### 3. Canales de Comparticion
- La interfaz interna debe ofrecer tres acciones operativas minimas:
  - **Compartir por WhatsApp**
  - **Copiar enlace**
  - **Abrir en tableta AMI**
- Como complemento opcional, el sistema puede mostrar un **QR** para apertura en celular propio.
- El canal principal inicial recomendado es WhatsApp asistido, usando mensaje prearmado al telefono capturado del trabajador.
- El sistema debe permitir envio manual cuando el numero requiera validacion o el canal automatico no este disponible.

#### 4. Mensajeria y Expectativa de Tiempo
- El mensaje de invitacion debe indicar explicitamente que el formulario tiene una vigencia de 6 horas.
- La pantalla del portal debe reiterar al trabajador que dispone de 6 horas para completarlo.
- Debe mostrarse la hora limite o tiempo restante de manera legible.
- El mensaje debe ser operacional y breve; no debe incluir diagnosticos ni informacion clinica sensible.

#### 5. Identidad y Validacion Ligera
- Antes de permitir acceso al formulario, el portal debe pedir una validacion ligera de identidad.
- Las opciones admitidas para la validacion son:
  - fecha de nacimiento
  - numero de empleado
  - ultimo dato acordado por operacion
- La implementacion inicial debe elegir **un solo factor simple** para no friccionar el flujo.
- La validacion no sustituye autenticacion fuerte; su objetivo es reducir acceso casual por reenvio del enlace.

#### 6. Experiencia del Trabajador
- El portal debe mostrar una interfaz minima, clara y apta para movil.
- Debe incluir contexto visible del proceso:
  - nombre del trabajador
  - empresa
  - tipo de evaluacion o perfil medico cuando exista
  - indicador de avance por secciones
  - tiempo restante o expiracion
- Debe permitir:
  - guardado parcial
  - continuar captura mientras el token siga vigente
  - envio final del modulo
- Debe existir una pantalla de confirmacion al finalizar.

#### 7. Alcance de Datos del Trabajador
- El trabajador solo puede capturar secciones declarativas del Modulo 1.
- Las secciones esperadas son:
  - datos personales
  - historia laboral
  - antecedentes heredo-familiares
  - antecedentes personales no patologicos y toxicomanias
  - antecedentes personales patologicos
  - antecedentes ginecologicos cuando aplique
  - inmunizaciones reportadas
- Las secciones deben poder marcarse visualmente como:
  - pendientes
  - incompletas
  - completas

#### 8. Modo Tableta AMI
- Debe existir una accion interna para abrir la invitacion en una tableta institucional de AMI.
- Ese flujo debe reutilizar el mismo portal y el mismo modelo de datos del prellenado.
- El modo tableta debe comportarse como **modo kiosco**:
  - interfaz limpia y enfocada
  - sin acceso al resto del sistema
  - limpieza de sesion al enviar
  - reinicio rapido por parte del staff
  - cierre o bloqueo por inactividad
- La tableta no debe requerir crear un formulario alterno distinto al del celular.

#### 9. Relacion con el Estudio Examen Medico
- El resultado del portal debe quedar asociado a la cita y luego disponible dentro del estudio **Examen Medico** en la papeleta.
- Cuando el medico abra el estudio, debe ver claramente si existe:
  - sin prellenado
  - prellenado parcial
  - prellenado completo
- La ausencia de prellenado nunca debe bloquear la captura medica.
- El trabajador nunca debe ver el Modulo 2 del medico.

#### 10. Trazabilidad Operativa
- El sistema debe registrar metadatos minimos de la invitacion:
  - fecha y hora de emision
  - fecha y hora de expiracion
  - canal usado
  - usuario staff que la genero
  - aperturas del enlace
  - estado final
- Debe existir un historial simple que permita a recepcion saber si el formulario fue abierto, guardado parcialmente, enviado o expirado.

### 🧩 Decisiones de UX
- El portal del trabajador es un flujo externo y reducido, no una vista simplificada del expediente clinico.
- El diseño debe priorizar legibilidad, progreso por secciones y bajo estres cognitivo.
- WhatsApp se adopta como canal practico inicial, pero no como dependencia exclusiva.
- QR y tableta AMI son canales de respaldo operativamente valiosos.
- El medico debe percibir el prellenado como antecedente reutilizable, no como documento separado.

### 🔐 Reglas de Seguridad
- El token debe ser aleatorio, no derivable y no reutilizable indefinidamente.
- Debe validarse expiracion en cada request al portal.
- No deben exponerse ids internos consecutivos en la URL publica.
- El backend del portal debe tener esquema propio de autorizacion por token y alcance limitado.
- El portal publico no debe permitir navegar ni consultar otros recursos del sistema.
- Cualquier intento con token invalido o expirado debe responder con estado controlado y mensaje claro.

### 📊 Estados Propuestos del Prellenado
- `NOT_GENERATED`: aun no se genero invitacion.
- `INVITATION_ACTIVE`: existe token vigente sin envio final.
- `OPENED`: el trabajador ya accedio al portal.
- `PARTIAL`: existe avance guardado parcial.
- `SUBMITTED`: el trabajador envio el modulo 1.
- `EXPIRED`: la vigencia del token termino sin cierre valido.
- `CANCELLED`: la invitacion fue invalidada por reemplazo u operacion.

### 🗂️ Contrato de Datos Minimo
- Debe existir una entidad o conjunto de entidades que persistan:
  - referencia a cita o appointment
  - token temporal hasheado o protegido
  - expiracion
  - estado del prellenado
  - payload estructurado del modulo 1
  - metadatos de canal y trazabilidad
- Las respuestas del trabajador deben conservar su origen para que luego puedan distinguirse de ajustes del medico.
- La persistencia debe permitir guardar parcial sin marcar el formulario como enviado.

### 🖥️ Superficies de UI Esperadas
- Vista interna de cita o recepcion con bloque de acciones:
  - Compartir por WhatsApp
  - Copiar enlace
  - Mostrar QR
  - Abrir en tableta AMI
  - Regenerar enlace
- Portal publico del trabajador
- Vista medica del estudio Examen Medico con lectura del estado del prellenado

### 📂 Scope Estimado
- Flujo de citas o detalle de cita donde se genera la invitacion
- Nuevo portal publico para trabajador
- Nuevas actions o endpoints para crear, validar e invalidar invitaciones
- Persistencia de token, expiracion y respuestas del modulo 1
- Integracion posterior con el estudio Examen Medico dentro de la papeleta

### 🚫 Fuera de Alcance
- Envio automatico full con proveedor WhatsApp Business en la primera etapa
- OTP o autenticacion multifactor compleja
- Captura del modulo clinico del medico en el portal del trabajador
- Firma electronica del trabajador
- Generacion PDF del cuestionario previo

### 🛠️ Recomendacion de Implementacion
- **Etapa A:** crear el modelo de invitacion temporal, portal publico, guardado parcial y acciones internas de compartir/copy/tableta.
- **Etapa B:** agregar QR y trazabilidad enriquecida si no entra desde el primer corte.
- **Etapa C:** si negocio lo requiere, evolucionar de WhatsApp asistido a integracion automatica con proveedor oficial.

### 🔗 Relacion con la Arquitectura Vigente
Esta SPEC complementa [context/SPECs/SPEC_ARCH-20260324-08-EXAMEN-MEDICO-DIVIDIDO.md](context/SPECs/SPEC_ARCH-20260324-08-EXAMEN-MEDICO-DIVIDIDO.md) y cierra el detalle operativo del acceso del trabajador. El estudio Examen Medico sigue siendo resuelto dentro de la papeleta; este portal solo habilita la captura previa, temporal y restringida del Modulo 1.