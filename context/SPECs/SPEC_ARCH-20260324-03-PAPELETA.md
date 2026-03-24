## 📋 SPEC: Reestructuración de Captura Clínica Base y Papeleta de Estudios
**ID:** `ARCH-20260324-03`
**Objetivo:** Eliminar la ambigüedad y duplicidad entre los pasos 2 y 3 del flujo clínico, reubicando la captura clínica base en el Paso 2 y transformando la Papeleta en un gestor atómico por estudio, incluyendo el Examen Médico como formulario específico dentro de la propia papeleta.

### 🎯 Criterios de Aceptación

#### 1. Paso 2: "Captura Clínica Base"
- **Contexto:** Pertenece al dominio exclusivo del médico en consulta y concentra los datos clínicos base previos a la papeleta.
- **Formularios obligatorios:**
  - Somatometría (Peso, talla, signos vitales).
  - Agudeza Visual.
  - **Exploración Física** (Se reubica aquí, dejando de pertenecer al paso 3).
- **Formatos:** No requiere subida de archivos; todo se captura en formularios digitales de la base de datos a través de la UI.
- **Aclaración:** El concepto de **Examen Médico** no vive en este paso; este paso solo reúne la captura clínica base.

#### 2. Paso 3: "Gabinete y Papeleta"
- **Contexto:** Punto de interacción para personal de laboratorio, rayos X o área médica que gestiona cada estudio solicitado desde la papeleta.
- **Prohibiciones:** Desaparecen las cajas globales genéricas ("Subir SIM" / "Subir NOVA" para todo el evento).
- **Principio de UX:** Los estudios no deben resolverse en una lista larga con contenido expandido en el mismo bloque. Cada estudio debe abrir su propia vista de trabajo para evitar saturación visual.
- **Comportamiento por Prueba:**
  - Una fila interactiva *por cada prueba solicitada* (Rx Tórax, Espirometría, Biometría, Examen Médico, etc.).
  - **Botón "Muestra Tomada"** (Opcional por prueba, pensado principalmente para laboratorios, de modo que recepción sepa qué falta procesar).
  - **Upload atómico:** Cada fila tiene su propio botón de "Subir Archivo" cuando la naturaleza de la prueba genera un entregable documental. El archivo se vincula a esa "Prueba" específica, no al evento completo.
  - **Visor Integrado:** Si una prueba ya tiene archivo, la fila permite abrirlo (View PDF/Imagen) directamente desde ese renglón.
  - **Caso especial - Examen Médico:** Aunque aparece dentro de la papeleta como una prueba más, no se resuelve con upload. Debe abrir o enlazar un formulario específico que elaboraremos posteriormente para capturar su resultado estructurado.
  - **Regla funcional:** La papeleta debe soportar pruebas heterogéneas: algunas con archivo, otras con formulario, y otras con estados operativos como toma de muestra.

#### 3. Navegación y Presentación del Paso 3
- **Vista Resumen Inicial:** El usuario entra a la papeleta y ve un listado resumido de estudios con su estado general.
- **Acción al hacer clic en un renglón:** No se expande inline. El sistema navega a una vista dedicada del estudio seleccionado.
- **Patrón principal aprobado:** El Paso 3 debe operar como un **workspace dedicado** dentro del evento.
- **Relación con el menú principal:** El menú principal del sistema no debe competir visualmente con la navegación de estudios. Al entrar al workspace de papeleta, la navegación global debe salir del foco, colapsarse o quedar fuera de la vista principal de trabajo.
- **Navegación lateral:** En escritorio, la vista del estudio debe mostrar un menú lateral con todos los estudios de la papeleta para poder cambiar rápidamente entre ellos sin volver al listado general.
- **Contenido principal:** El panel principal muestra únicamente el estudio activo y sus acciones correspondientes: upload, visor, toma de muestra o formulario.
- **Contexto humano persistente:** La cabecera del workspace debe mantenerse visible para que el usuario no pierda de vista que está atendiendo a una persona concreta dentro de una empresa concreta.
- **Datos obligatorios en cabecera:** Deben mostrarse siempre, en la parte superior, como mínimo: nombre completo de la persona, puesto, empresa y nombre del perfil presente.
- **Datos complementarios recomendados:** También pueden mostrarse tipo de evento, fecha de cita y progreso general, pero sin desplazar ni diluir la identidad principal persona-puesto-empresa.
- **Modo móvil:** La navegación lateral se convierte en selector compacto, tabs o drawer, preservando la lógica de una sola vista activa por estudio.
- **Objetivo UX:** Evitar que el Paso 3 se convierta en una página larga y amontonada; el flujo debe sentirse como un workspace navegable por estudios.
- **Restricción explícita:** No deben coexistir dos menús laterales completos visibles al mismo tiempo si eso reduce la legibilidad del estudio activo.

#### 4. Estatus Operativos Propuestos (V1)
- **Objetivo:** Mostrar a AMI una nomenclatura simple, útil y suficiente para la primera versión, sin caer en estados rebuscados.
- **Pendiente:** El estudio aún no ha sido trabajado.
- **En proceso:** El estudio ya fue abierto o iniciado, pero todavía no tiene resultado final registrado.
- **Muestra tomada:** Aplica solo a estudios de laboratorio o similares donde primero se registra la toma de muestra.
- **Resultado registrado:** El estudio ya tiene su resultado principal capturado, ya sea por archivo o por formulario.
- **Completado:** El estudio se considera cerrado dentro de la papeleta para fines operativos.
- **Regla de uso:** No todos los estudios deben pasar por todos los estatus. Por ejemplo, "Muestra tomada" solo aparece cuando realmente aplica.
- **Criterio de simplicidad:** En esta primera versión no se incluyen estados como rechazado, observado, reenviado o validado. Si AMI los pide después, se agregan en una iteración posterior.

#### 5. Checklist de Implementación para SOFIA
- [ ] El Paso 2 muestra únicamente captura clínica base: somatometría, agudeza visual y exploración física.
- [ ] El Paso 3 deja de mostrar cajas globales SIM/NOVA para el evento completo.
- [ ] La entrada al Paso 3 muestra un resumen inicial de estudios con estado visible.
- [ ] Cada estudio se presenta como renglón seleccionable.
- [ ] Al hacer clic en un estudio, el usuario entra a una vista dedicada, no a un expandible inline.
- [ ] El Paso 3 se comporta como workspace dedicado dentro del evento.
- [ ] La navegación global del sistema sale del foco o se colapsa mientras se trabaja en la papeleta.
- [ ] En escritorio existe una navegación lateral interna para cambiar entre estudios sin volver al resumen.
- [ ] En móvil la navegación interna se resuelve con un patrón compacto, no con un lateral pesado.
- [ ] La cabecera persistente muestra siempre nombre completo, puesto, empresa y nombre del perfil presente.
- [ ] El contenido principal muestra solo el estudio activo y sus acciones correspondientes.
- [ ] Los estudios con archivo permiten subir y visualizar su documento desde su propia vista.
- [ ] Los estudios de laboratorio pueden mostrar la acción de "Muestra tomada" cuando aplique.
- [ ] Examen Médico aparece como estudio dentro de la papeleta.
- [ ] Examen Médico no muestra upload como acción principal.
- [ ] Examen Médico enlaza a formulario específico en una fase posterior.
- [ ] El resumen de estudios muestra, como mínimo, nombre del estudio, tipo de resolución y estatus actual.
- [ ] La salida del workspace debe ser clara para regresar al evento o al resumen de estudios.
- [ ] La experiencia debe evitar saturación visual y priorizar el estudio activo.

### 📂 Archivos a Modificar (Scope Estimado)
- `frontend/src/app/events/[id]/page.tsx` (Reubicación de componentes entre Steps 2 y 3)
- Componentes de navegación del Paso 3 para listado lateral o selector de estudios.
- Modelos de Prisma o Endpoints que atan archivos temporales a la prueba (Action methods en `src/actions`).
- TBD: Creación de componente `EventTestRow` o mejora del existente de papeleta para manejar pruebas mixtas: upload, viewer, estados y formularios específicos como Examen Médico.
