# DICTAMEN TÉCNICO: Segunda revisión de la SPEC Sprint 1 Recepción Operativa
- **ID:** FIX-20260519-04
- **Fecha:** 2026-05-19
- **Solicitante:** INTEGRA
- **Estado:** ❌ REQUIERE MÁS CONTEXTO

### A. Análisis de Causa Raíz

Dictamen general:

- La SPEC [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](/workspaces/Administracion-medica-industrial/context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md) sí incorporó las correcciones centrales del dictamen previo: ya acepta identificación oficial válida, mantiene privilegio explícito para INE cuando aplique, permite excepción auditada sin bloquear el check-in, admite reutilización de evidencia y resuelve discrepancias con comentario operativo y continuidad.
- En dimensión operativa, la SPEC ya está mucho más alineada con piso AMI que su versión anterior.
- El problema residual ya no está principalmente en negocio operativo, sino en precisión de contrato técnico para implementación. La SPEC define el qué funcional, pero aún deja demasiadas decisiones de modelo, atomicidad y convivencia con el flujo actual para que SOFIA implemente sin adivinar detalles estructurales.

#### 1) Hallazgos operativos ordenados por severidad

**Altos**

1. La excepción auditada exige registrar “usuario que autorizó continuar”, pero no define si ese autorizante puede ser la misma recepcionista o debe ser un supervisor. La regla está en [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L138) y afecta directamente la operación en piso porque cambia el tiempo de atención y el nivel de escalamiento requerido.
2. La reutilización de evidencia está aceptada, pero no se define el criterio operativo mínimo para decir que “sigue siendo la misma”. La regla aparece en [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L163), y sin un criterio breve de vigencia o confirmación visual, distintas recepcionistas podrían aplicar políticas distintas.

**Medios**

3. La SPEC acepta identificación oficial válida, pero no fija un catálogo operativo visible de tipos de documento para captura y auditoría. La política general quedó bien resuelta en [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L120), pero sigue faltando una normalización mínima para evitar que en piso se capture texto libre inconsistente.
4. El QR operativo adicional queda descrito como útil para estaciones o equipos, pero la SPEC no fija en qué momento lo verá recepción o el paciente dentro del flujo real. La referencia actual queda en [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L58) y [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L89). No bloquea la idea, pero sí deja margen a una entrega poco útil en piso.

**Bajos**

5. La discrepancia quedó correctamente no bloqueante, pero todavía no clasifica si el comentario operativo debe distinguir entre “corrección menor”, “documento distinto” o “evidencia no capturada”. La base funcional está en [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L83) y [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L167); el faltante es más de calidad operativa que de dirección de negocio.

#### 2) Hallazgos de especificación técnica ordenados por severidad

**Críticos**

1. La SPEC no define el contrato exacto de persistencia para cita y trabajador. Hoy solo dice “extender la cita” y “extender el trabajador” en [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L196), pero el esquema real solo tiene `qrCode` en `Appointment` y no tiene campos de evidencia o referencia documental en `Appointment` ni en `Worker` [frontend/prisma/schema.prisma](frontend/prisma/schema.prisma#L320). Sin campos mínimos definidos, SOFIA tendría que inventar nombres, tipos, nulabilidad y estrategia de backfill.
2. La SPEC no define la frontera transaccional del flujo. El modal actual corrige nombre por una acción, contacto por otra y luego hace check-in por otra [frontend/src/components/CorroborationModal.tsx](frontend/src/components/CorroborationModal.tsx#L37). Con la nueva SPEC, ese mismo flujo debe además guardar evidencia, registrar reutilización, excepción y auditoría. No queda explicitado si todo debe confirmarse en una sola server action atómica o si se toleran pasos parciales. Esa omisión es grave porque toca integridad operativa.
3. La coexistencia entre el QR actual y el nuevo QR operativo no está técnicamente cerrada. La SPEC exige un QR adicional con payload mínimo delimitado por texto [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L91), pero el sistema actual ya usa un único `qrCode` de cita y el lector actual procesa JSON para check-in [frontend/src/actions/appointment.actions.ts](frontend/src/actions/appointment.actions.ts#L45) y [frontend/src/actions/appointment.actions.ts](frontend/src/actions/appointment.actions.ts#L440). Falta decidir si habrá un segundo campo persistido, un QR derivado en runtime o una estrategia visual separada para no romper el flujo existente.

**Altos**

4. La SPEC no normaliza estructuras clave para auditoría y reporting: `tipo de documento`, `motivo de excepción`, `resultado de corroboración` y `modo de evidencia` capturada o reutilizada. La trazabilidad funcional existe en [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L167), pero si se deja libre en `AuditLog.details`, la implementación puede quedar inconsistente y difícil de explotar.
5. La SPEC no describe el flujo UI mínimo para reutilización de evidencia previa. El modal actual solo soporta corrección de nombre/contacto y confirmación de check-in [frontend/src/components/CorroborationModal.tsx](frontend/src/components/CorroborationModal.tsx#L95). Falta definir si el usuario verá miniatura previa, checkbox de reutilización, selector de documento, o solo confirmación textual. Eso no es cosmético: define payload, validaciones y experiencia de error.
6. La SPEC asume que la infraestructura actual de archivos “ya disponible” basta, pero no define el ancla exacta ni el formato de almacenamiento para frente y reverso en cita. Hoy la infraestructura de archivo visible está concentrada en flujos clínicos y estudios con `fileUrl` [frontend/src/actions/upload.actions.ts](frontend/src/actions/upload.actions.ts#L11), no en recepción administrativa. La dirección es correcta, pero el contrato técnico de almacenamiento sigue abierto.

**Medios**

7. Los criterios de aceptación siguen siendo funcionales pero no suficientemente verificables para implementación y QA en algunos puntos clave. Por ejemplo, “puede mostrarse en un punto natural del flujo” y “referencia a la última identificación válida disponible” [context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md](context/SPECs/SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md#L217) siguen sin traducirse a checks concretos de interfaz, persistencia y auditoría.
8. La SPEC no aclara si el contacto secundario actual del modal queda fuera del sprint, se preserva intacto o debe convivir con la nueva captura documental. Dado que el modal ya actualiza teléfono/correo [frontend/src/components/CorroborationModal.tsx](frontend/src/components/CorroborationModal.tsx#L66), conviene congelar explícitamente ese comportamiento para que no se mezcle accidentalmente con el corte nuevo.

#### 3) Riesgos residuales

1. SOFIA puede implementar un modelo de datos técnicamente válido pero distinto al esperado por INTEGRA, obligando a una migración o refactor inmediato en el siguiente corte.
2. Si la auditoría queda solo como texto libre, recepción no tendrá trazabilidad uniforme para distinguir reutilización, excepción y discrepancia, aunque el flujo “funcione”.
3. Si el nuevo QR operativo reutiliza el único campo `qrCode` actual sin contrato explícito, se puede dañar o confundir el check-in por QR ya existente.
4. Si la excepción auditada no define claramente al autorizante, la operación puede derivar en bypass permanente sin gobernanza real o en escalamiento innecesario de cada ingreso.
5. La falta de definición de UI para reutilización de evidencia puede producir una solución funcional mínima, pero opaca para recepción y difícil de auditar después.

#### 4) Veredicto final

- **No aprobar aún para handoff.**
- La SPEC ya quedó razonablemente sólida en operatividad de piso AMI.
- El bloqueo actual es de calidad de especificación técnica: todavía faltan decisiones estructurales mínimas para que SOFIA implemente sin ambigüedades graves en modelo, transacción, QR dual y persistencia documental.
- No se requiere replantear el sprint. Se requiere un ajuste corto y puntual de contrato técnico antes de implementarlo.

Segunda opinión no disponible:

- Se intentó ejecutar Qodo CLI como segunda revisión forense, pero la herramienta no está instalada en este entorno (`qodo: command not found`).

### B. Justificación de la Solución

La revisión confirma que el dictamen anterior sí surtió efecto sobre la dimensión de negocio y operación. La SPEC corregida ya resuelve las objeciones más delicadas de piso: no amarra exclusivamente a INE, no bloquea el check-in por falta de captura normal, admite reutilización y convierte discrepancias en trazabilidad operativa en vez de bloqueo. Ese avance es real.

Sin embargo, la misma revisión también confirma que el handoff a implementación seguiría siendo riesgoso si se hace ahora. El código actual de recepción está construido sobre un modal simple más una server action de check-in que hoy no contempla evidencia documental, reutilización ni excepción estructurada [frontend/src/components/CorroborationModal.tsx](frontend/src/components/CorroborationModal.tsx#L37) y [frontend/src/actions/appointment.actions.ts](frontend/src/actions/appointment.actions.ts#L276). La SPEC ya ordena expandir esas anclas, pero no cierra todavía el contrato exacto para hacerlo de manera inequívoca.

El ajuste recomendado es pequeño y no cambia la dirección del sprint: basta con fijar un apéndice técnico mínimo con campos concretos, enums operativos mínimos y frontera de confirmación transaccional.

### C. Instrucciones de Handoff para INTEGRA

1. Agregar a la SPEC un bloque técnico corto con el contrato mínimo de datos: campos exactos propuestos en `Appointment` para frente, reverso, tipo de documento, modo de evidencia y excepción; y campos exactos en `Worker` para referencia resumida reutilizable.
2. Definir expresamente si la confirmación final será una sola server action transaccional que persiste corroboración y luego ejecuta check-in, o si el flujo aceptará pasos previos parciales. La recomendación forense es una sola confirmación final.
3. Fijar la convivencia del QR actual y del QR operativo nuevo: campo separado, generación derivada o render temporal, dejando claro que el QR de check-in JSON no debe romperse.
4. Cerrar un catálogo mínimo para `documentType`, `exceptionReason`, `evidenceMode` y, si aplica, `corroborationResult`, aunque internamente se guarden en JSON.
5. Añadir dos o tres criterios de aceptación verificables de UI: cómo se reutiliza evidencia, cómo se registra excepción y dónde se visualiza el QR operativo adicional.
6. Reenviar a SOFIA después de ese ajuste puntual. No hace falta nueva ronda de definición de negocio; hace falta concretar contrato técnico ejecutable.