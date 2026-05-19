# DICTAMEN TÉCNICO: Revisión funcional-operativa de la SPEC Sprint 1 Recepción Operativa
- **ID:** FIX-20260519-03
- **Fecha:** 2026-05-19
- **Solicitante:** INTEGRA
- **Estado:** ✅ VALIDADO

### A. Análisis de Causa Raíz

Dictamen general:

- La SPEC [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](/workspaces/Administracion-medica-industrial/context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md) sí consolida correctamente el objetivo del sprint y ya acota mejor el alcance que las piezas históricas [context/SPECs/SPEC_ARCH-20260507-11-QR-IDENTIFICACION-OPERATIVA-MINIMA.md](/workspaces/Administracion-medica-industrial/context/SPECs/SPEC_ARCH-20260507-11-QR-IDENTIFICACION-OPERATIVA-MINIMA.md), [context/SPECs/SPEC_ARCH-20260507-12-CORROBORACION-IDENTIDAD-CHECK-IN.md](/workspaces/Administracion-medica-industrial/context/SPECs/SPEC_ARCH-20260507-12-CORROBORACION-IDENTIDAD-CHECK-IN.md) y [context/SPECs/SPEC_ARCH-20260514-01-ALINEACION-CORROBORACION-NOMBRE-INE.md](/workspaces/Administracion-medica-industrial/context/SPECs/SPEC_ARCH-20260514-01-ALINEACION-CORROBORACION-NOMBRE-INE.md).
- El problema no está en la dirección del sprint, sino en que todavía hay decisiones operativas críticas no cerradas. Si se manda así a implementación, SOFIA puede construir un flujo técnicamente coherente pero operativamente incorrecto para recepción real AMI.

Hallazgos ordenados por severidad:

**Críticos**

1. La SPEC endurece una política central sin definir excepciones operativas. El histórico venía tratando la evidencia INE como opcional y no bloqueante; la SPEC nueva vuelve obligatorio el frente y bloquea check-in hasta capturarlo. Ese cambio puede ser válido, pero hoy no define qué pasa si el paciente no trae INE, trae otro documento oficial, el dispositivo de captura falla, la imagen sale ilegible o la clínica decide no rechazar al paciente por operación. Sin ese manejo de excepciones, el flujo en piso queda incompleto.
2. No está cerrada la regla de recaptura versus reutilización de evidencia. La SPEC dice que el frente de INE debe capturarse persistentemente en la cita actual y al mismo tiempo que el trabajador conservará referencia a la última INE válida. Falta decidir si cada ingreso exige una nueva captura aunque ya exista una INE vigente y legible, o si esa referencia permite reutilizar evidencia previa en ciertos casos. Eso cambia por completo la carga operativa de recepción.
3. Falta un criterio funcional para discrepancias que no se resuelven solo corrigiendo nombre. La SPEC permite corregir únicamente nombre completo y muestra fecha de nacimiento como contraste, pero no define qué hacer si la fecha de nacimiento no coincide, si el documento corresponde a otra persona, si el nombre difiere de forma material o si existe duda de identidad. Hoy solo queda claro lo que se puede editar, no el protocolo de decisión cuando la corroboración falla.

**Altos**

4. La política documental está sobrerrestringida a INE sin confirmar si AMI realmente opera solo con INE. En piso puede haber pacientes con pasaporte, licencia, cartilla u otra identificación oficial. Si negocio quiere “identificación oficial” y no específicamente “INE”, la SPEC actual puede forzar rechazos innecesarios o una implementación demasiado rígida.
5. El paso “corroboración obligatoria previa al check-in” no define secuencia exacta de recepción. Falta precisar si ocurre antes o después del aviso de privacidad, antes o después de confirmar llegada, y qué ve o recibe el paciente cuando la corroboración queda pendiente. Esto importa porque la minuta de visita [context/Juntas/MINUTA_VISITA_AMI_2026-04-17.md](/workspaces/Administracion-medica-industrial/context/Juntas/MINUTA_VISITA_AMI_2026-04-17.md) ya documenta fricción de espera y baja visibilidad del flujo.
6. “Última INE válida disponible” no tiene definición operativa. No está claro qué vuelve válida una evidencia: legibilidad, coincidencia visual, nombre corregido, coincidencia de fecha de nacimiento, vigencia del documento, aprobación del recepcionista o simple existencia de archivo. Sin esa definición, distintas recepcionistas podrían usar criterios distintos.
7. El QR operativo mínimo sigue con ubicación funcional ambigua. La SPEC dice que debe mostrarse en “un punto natural del flujo”, pero no cierra si para este sprint el punto aprobado es pantalla de recepción, pase impreso, workspace del evento u otro artefacto. Esto abre margen a una implementación correcta pero poco útil para la recaptura real en estaciones o equipos.

**Medios**

8. La trazabilidad administrativa está bien orientada, pero no explicita resultado de corroboración. Se auditó usuario, fecha, nombre previo, nombre confirmado y presencia de evidencia; sin embargo, falta decidir si también debe quedar un estado operativo como “corroborada sin cambios”, “corroborada con corrección”, “con observación” o “no corroborada por excepción”. Esa clasificación sería útil para operación y auditoría futura.
9. No está cerrada la relación entre corrección de nombre y QR operativo. Si el nombre cambia durante corroboración, falta definir si el QR operativo debe regenerarse de inmediato con el nombre corregido o si conserva el dato previo de la cita. Operativamente, para estaciones o equipos debería existir una sola versión vigente.
10. No se explicita la cobertura legal-operativa de almacenar imágenes de INE. La visita y el proceso ya contemplan aviso de privacidad, pero la SPEC no dice si el consentimiento actual cubre esta evidencia documental o si recepción deberá ejecutar una confirmación adicional. No bloquea el diseño del flujo, pero sí conviene cerrarlo antes de institucionalizar la captura obligatoria.

Segunda opinión no disponible:

- Se intentó correr Qodo para una segunda revisión funcional, pero la herramienta no está instalada en este entorno (`qodo: command not found`).

### B. Justificación de la Solución

Preguntas funcionales abiertas que deben resolverse antes de handoff:

1. ¿AMI quiere política estricta de “solo INE” o “identificación oficial” con varios documentos aceptables?
2. Si el paciente no presenta INE o la captura falla, ¿el check-in se rechaza, se difiere, se escala a supervisor o se permite ingreso con excepción auditada?
3. ¿El frente de INE debe capturarse en cada ingreso o puede reutilizarse la última evidencia válida del trabajador bajo ciertas condiciones?
4. ¿Qué condiciones hacen que una INE previa sea “válida” para reutilización o referencia operativa?
5. Si nombre y fecha de nacimiento no coinciden con el documento, ¿recepción solo corrige nombre, cancela ingreso o activa un protocolo de incidencia?
6. ¿La fecha de nacimiento permanecerá estrictamente no editable en este sprint aunque el documento muestre discrepancia real, o debe existir una salida administrativa controlada?
7. ¿En qué punto exacto del flujo de recepción ocurre la corroboración: al localizar la cita, antes del check-in formal o como subpaso dentro del check-in actual?
8. ¿Dónde debe vivir el QR operativo en V1 para que realmente sirva en piso: pase impreso, pantalla de recepción, vista del evento, o más de un punto?
9. Si el nombre se corrige durante corroboración, ¿el QR operativo debe regenerarse en el acto con el nombre actualizado?
10. ¿El aviso de privacidad vigente ya cubre la retención de frente y reverso de identificación oficial como evidencia de recepción?

Recomendación de aprobación:

- **No aprobarla todavía** para handoff de implementación tal como está redactada hoy.
- **Sí aprobaría la dirección del sprint**, porque el corte está bien planteado y está alineado con el backlog vigente en [PROYECTO.md](/workspaces/Administracion-medica-industrial/PROYECTO.md).
- **Pero antes de mandarla a SOFIA deben cerrarse al menos cuatro decisiones de negocio**: política de documento aceptable, manejo de excepciones, regla de recaptura/reutilización de evidencia y protocolo cuando la corroboración falla por discrepancia material.
- Una vez cerradas esas decisiones, la recomendación cambia a **aprobar con ajustes**; no se requiere replantear el sprint, solo cerrar reglas operativas que hoy siguen implícitas.

### C. Instrucciones de Handoff para INTEGRA

1. Convertir la política documental en una regla explícita: “solo INE” o “identificación oficial aceptable”, incluyendo catálogo permitido.
2. Agregar a la SPEC un bloque de excepciones operativas con al menos tres escenarios: sin documento, falla de captura y discrepancia de identidad no resoluble en recepción.
3. Definir expresamente si la evidencia se recaptura en cada ingreso o si la referencia del trabajador habilita reutilización controlada.
4. Añadir definición funcional de “última INE válida” y el criterio para reemplazarla o conservarla.
5. Fijar el punto exacto donde aparece el QR operativo en V1 y la regla de regeneración si el nombre cambia.
6. Reenviar a SOFIA solo cuando esas decisiones queden incorporadas en la SPEC como reglas ejecutables, no como supuestos.