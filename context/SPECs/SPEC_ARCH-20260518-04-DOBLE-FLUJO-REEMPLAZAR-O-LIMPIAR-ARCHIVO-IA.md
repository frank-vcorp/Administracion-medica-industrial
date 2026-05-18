# SPEC ARCH-20260518-04: Doble Flujo para Reemplazar o Limpiar Archivo IA sin Romper Auditoría

- ID: ARCH-20260518-04
- Fecha: 2026-05-18
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/interconsultas/DICTAMEN_FIX-20260518-01.md
  - context/SPECs/SPEC_FIX-20260516-01-INSTRUMENTACION-UPLOAD-NETWORK-CHANGED.md
  - context/SPECs/SPEC_ARCH-20260518-03-EXTRACCION-SIN-FALLBACK-CLINICA-CON-FALLBACK.md

## 1. Objetivo

Resolver la ambigüedad operativa actual del módulo de estudios IA permitiendo dos acciones explícitas y separadas:

1. reemplazar archivo conservando historial y trazabilidad
2. limpiar archivo y análisis vigentes para recapturar desde cero

La solución debe mejorar control operativo del usuario sin destruir auditoría clínica ni evidencia técnica histórica.

## 2. Problema Confirmado

El flujo actual usa una sola acción implícita de reemplazo de archivo. Eso genera dos tensiones:

1. el usuario no tiene una forma clara de “resetear” un estudio antes de volver a capturarlo
2. la UI puede quedar desalineada si el refresh posterior al upload falla, porque el cliente depende de `router.refresh()` para recibir el snapshot nuevo

Además, el concepto de “reemplazo” hoy no distingue entre:

1. sustituir evidencia manteniendo historial
2. eliminar evidencia activa y dejar el estudio limpio para una nueva captura

## 3. Decisión Arquitectónica

Se aprueba un doble flujo explícito:

### A. Reemplazar archivo

Acción principal no destructiva.

Comportamiento esperado:

1. conservar historial de snapshots previos
2. vincular el nuevo archivo como evidencia activa del estudio
3. ejecutar nuevamente extracción y prediagnóstico según corresponda
4. marcar snapshots previos como superseded o equivalentes, sin borrado duro por defecto
5. actualizar la UI hacia el nuevo snapshot vigente sin depender únicamente del refresh global del árbol

### B. Eliminar archivo y limpiar análisis

Acción destructiva controlada, con confirmación explícita.

Comportamiento esperado:

1. desvincular el archivo activo del estudio
2. limpiar el snapshot vigente de extracción y el snapshot vigente de prediagnóstico para la vista operativa
3. dejar el estudio en estado listo para recaptura limpia
4. preservar auditoría interna de que existió evidencia/análisis previo, idealmente mediante marcado lógico y no mediante hard delete silencioso
5. opcionalmente programar limpieza física del archivo en storage si el modelo de persistencia lo soporta sin romper trazabilidad

## 4. Principio de Auditoría

La auditoría no debe romperse.

Esto implica:

1. no hacer hard delete por defecto sobre snapshots históricos o revisiones médicas ya emitidas
2. distinguir entre “vigente” y “superseded/eliminado lógicamente”
3. registrar quién ejecutó la acción y cuándo
4. conservar relación histórica con archivo previo, snapshot extractivo previo y snapshot clínico previo

Regla explícita:

- la limpieza operativa del estudio no equivale a borrar la historia del estudio

## 5. Modelo Operativo Esperado

### Reemplazar archivo

Estado del sistema tras éxito:

1. `fileUrl` activo apunta al archivo nuevo
2. el snapshot extractivo nuevo pasa a ser el vigente
3. el snapshot clínico nuevo pasa a ser el vigente si aplica
4. los snapshots previos quedan no vigentes
5. la UI muestra inmediatamente los valores capturados del snapshot nuevo y no solo el `fileUrl`

### Limpiar archivo y análisis

Estado del sistema tras éxito:

1. el estudio queda sin `fileUrl` activo
2. no se muestra snapshot vigente extractivo
3. no se muestra snapshot vigente clínico
4. el estudio queda apto para nueva captura
5. la bitácora y los registros históricos conservan el rastro de lo limpiado

## 6. Reglas de UX

La UI debe exponer dos acciones claramente separadas:

1. `Reemplazar archivo`
2. `Eliminar archivo y limpiar análisis`

Requisitos mínimos:

1. la acción destructiva debe pedir confirmación
2. la acción destructiva debe advertir que limpia la vista operativa pero preserva auditoría interna
3. la acción de reemplazo no debe presentarse como borrado
4. si la sincronización falla por red, la UI debe quedar en estado consistente y mostrar error útil

## 7. Alcance Aprobado

Incluye:

1. agregar la acción explícita para limpiar archivo y análisis vigentes
2. mantener la acción actual de reemplazo como flujo separado
3. introducir noción clara de snapshot vigente vs snapshot histórico
4. corregir la actualización de cliente para que el nuevo snapshot no dependa solo de `router.refresh()`
5. mejorar la legibilidad del panel de valores capturados cuando existan arreglos de objetos complejos

No incluye:

1. purga irreversible obligatoria de toda la evidencia histórica
2. rediseño completo del modelo documental del expediente
3. borrado físico garantizado en storage si el sistema aún no tiene mecanismo auditado para ello

## 8. Criterios de Aceptación

1. El usuario puede reemplazar archivo sin perder historial técnico previo.
2. El usuario puede limpiar archivo y análisis vigentes mediante una acción explícita con confirmación.
3. Tras reemplazo exitoso, la UI refleja el snapshot nuevo sin requerir recarga dura manual.
4. Tras limpieza exitosa, la UI queda sin archivo ni snapshots vigentes y el estudio queda listo para nueva captura.
5. Los snapshots previos no se eliminan silenciosamente; quedan trazables como históricos/no vigentes.
6. La auditoría distingue con claridad entre reemplazo y limpieza operativa.
7. El panel de valores capturados deja de degradar arreglos de objetos a textos tipo `[object Object]`.

## 9. Resultado Esperado

El módulo de estudios IA gana un flujo operativo claro y seguro:

1. reemplazo para continuidad con historial
2. limpieza para recaptura desde cero

Ambos caminos mantienen trazabilidad clínica y técnica, reducen estados ambiguos en la UI y evitan que el usuario tenga que forzar soluciones manuales para “limpiar” un estudio antes de una nueva captura.
