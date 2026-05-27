# SPEC: Slice C — Alta Rápida Empresarial el Mismo Día

**ID:** ARCH-20260527-13  
**Fecha:** 2026-05-27  
**Estado:** LISTA PARA IMPLEMENTACION  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta  
**SPEC madre:** `context/SPECs/SPEC_ARCH-20260527-10-ADMISION-TRES-FLUJOS-Y-CONVERGENCIA-A-EVENT.md`  
**Depende de:**
- `context/SPECs/SPEC_ARCH-20260519-11-ALTA-MASIVA-TRABAJADORES.md`
- `context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md`
- `context/SPECs/SPEC_ARCH-20260527-12-SLICE-B-RECEPCION-POR-PROJECT.md`

---

## 1. Objetivo

Cerrar el caso operativo donde llegan varios trabajadores de una empresa **sin pre-registro previo** y recepción necesita darlos de alta en ese momento, asociarlos a un proyecto del día y dejarlos listos para entrar a la cola operativa de recepción por `Project`, sin desviar el flujo a agenda normal ni obligar captura individual dispersa.

Este slice cubre el caso **2B — Sin cita empresarial sin pre-registro previo**.

---

## 2. Problema puntual

AMI ya tiene resueltos dos extremos, pero no el punto intermedio real de mostrador:

1. alta individual manual por trabajador;
2. alta masiva planificada por Excel antes del día de la visita.

El hueco operativo es este:

1. llegan 5, 10 o más trabajadores de una empresa;
2. no existe proyecto preparado o sí existe pero no trae padrón completo;
3. recepción no puede detener la operación para agendar uno por uno;
4. tampoco siempre habrá archivo Excel listo para usar como alta masiva formal.

El sistema necesita un carril de **alta rápida del mismo día** que permita capturar lo mínimo indispensable, crear o reutilizar el `Project` operativo y dejar a los trabajadores listos para recepción clínica.

---

## 3. Alcance

### Sí entra

1. Crear o reutilizar un `Project` operativo del día desde el propio flujo.
2. Capturar un lote corto de trabajadores en modo rápido sin exigir plantilla Excel.
3. Crear `Worker` para cada fila válida.
4. Vincular cada trabajador al `Project` mediante `ProjectWorker`.
5. Dejar a los recién creados listos para el panel de recepción por proyecto.
6. Reutilizar la misma lógica de deduplicación ya aprobada en alta masiva cuando sea razonable.

### No entra

1. Reemplazar la alta masiva por Excel existente.
2. Importación portal B2B.
3. Admisión externa sin empresa.
4. Rediseño global de `/workers`.
5. Motor complejo de matching probabilístico.
6. Captura clínica o check-in automático en el mismo paso.

---

## 4. Decisión de Diseño

### Regla principal

La alta rápida del mismo día no reemplaza el flujo formal de alta masiva por Excel. Lo complementa como carril operativo de contingencia y mostrador.

### Regla de reutilización

Debe reutilizar al máximo posible:

1. la entidad `Project`;
2. la relación `ProjectWorker`;
3. la lógica de resolución de empresa por proyecto;
4. la matriz de deduplicación base ya documentada en alta masiva.

### Regla de simplicidad

La UI no debe intentar replicar una hoja de cálculo completa. El caso esperado es un lote corto y urgente del mismo día.

### Límite operativo inicial

Se aprueba un límite inicial de **hasta 20 trabajadores por operación rápida**. Si el volumen real excede eso, el usuario debe usar la carga masiva formal por Excel.

---

## 5. Flujo Operativo Esperado

### Caso cubierto: empresa llega sin pre-registro previo

1. Usuario entra al frente de proyectos o recepción empresarial.
2. Elige `Alta rápida empresarial`.
3. Selecciona empresa existente.
4. Selecciona proyecto del día o crea uno rápido inline si no existe.
5. Captura un lote corto de trabajadores en tabla simple.
6. El sistema valida cada fila.
7. El sistema crea trabajadores válidos y los vincula al proyecto.
8. El sistema muestra resumen:
   - creados
   - duplicados exactos omitidos
   - advertencias por revisión manual
   - errores por fila
9. Los creados aparecen inmediatamente en la cola operativa del proyecto.
10. Recepción continúa con el Slice B para marcar llegada e ingresar a clínica.

---

## 6. Datos mínimos por fila

Campos mínimos aprobados para alta rápida:

1. `Nombre(s)` — obligatorio
2. `Apellido(s)` — obligatorio
3. `Fecha de nacimiento` — opcional pero altamente recomendada
4. `CURP o ID nacional` — opcional
5. `Teléfono` — opcional
6. `Puesto` — opcional

### Reglas

1. No bloquear por ausencia de teléfono, correo o puesto.
2. No exigir género si no agrega valor operativo inmediato.
3. Si una fila no tiene nombre o apellido, no se crea.
4. Si el puesto no existe, se omite sin bloquear.

---

## 7. Reutilización de deduplicación

Este slice no define nueva lógica de identidad. Debe apoyarse en la ya aprobada en alta masiva.

### Regla operativa mínima

1. Match duro por mismo nombre + DOB + misma empresa → no crear, marcar duplicado.
2. Match por mismo nombre + DOB en empresa distinta → advertencia.
3. Mismo nombre sin DOB suficiente → advertencia para revisión manual.

### Regla de UX

Las advertencias no deben bloquear todo el lote si el resto de filas es válido.

---

## 8. Superficie Técnica Esperada

### Archivo ancla inicial

`frontend/src/components/ProjectsCalendar.tsx`

### Archivos exactos a crear o modificar

1. `frontend/src/components/ProjectsCalendar.tsx`
2. `frontend/src/components/BulkWorkerImportModal.tsx`
3. `frontend/src/actions/worker.actions.ts`
4. `frontend/src/actions/project.actions.ts`
5. `frontend/src/components/ProjectFormModal.tsx`

### Máximo de archivos permitidos

Máximo 5 archivos funcionales. Si necesitas tocar schema, recepción clínica o abrir una sexta superficie, detente.

---

## 9. Estrategia de implementación preferida

La implementación preferida es extender el flujo ya existente en `BulkWorkerImportModal` con un modo alterno de captura rápida, en lugar de crear un módulo completamente nuevo.

### Modo A — Alta masiva formal

Se conserva intacto:

1. proyecto
2. upload Excel
3. preview
4. importación

### Modo B — Alta rápida del mismo día

Nuevo subflujo dentro de la misma familia:

1. proyecto
2. captura rápida en tabla corta
3. validación por fila
4. confirmación
5. creación y vínculo a proyecto

**Razón:** ambos flujos comparten empresa, proyecto y creación de `ProjectWorker`; solo cambia la fuente del lote.

---

## 10. Contrato de Acciones

### 10.1 Query de soporte

Reutilizar `getProjectsByCompany(companyId)` para seleccionar el proyecto del día.

### 10.2 Mutación nueva o extendida

Debe existir una action acotada para registrar el lote rápido del día.

Contrato mínimo:

1. recibe `rows[]`
2. recibe `projectId`
3. valida sesión y roles ya autorizados
4. resuelve `companyId` desde `projectId`
5. aplica validación y deduplicación por fila
6. crea `Worker`
7. crea `ProjectWorker`
8. devuelve resumen por fila

### 10.3 Regla de no duplicación

No debe crearse un segundo método de persistencia totalmente divergente si se puede factorizar sobre `bulkImportWorkers()` o sobre una variante cercana.

---

## 11. Diseño de UI mínimo

### 11.1 Punto de entrada

Desde la superficie de proyectos debe existir acción visible de:

1. `Alta masiva` para Excel
2. `Alta rápida hoy` para captura manual de lote corto

### 11.2 Tabla de captura rápida

Cada fila debe permitir editar:

1. nombre
2. apellido
3. fecha de nacimiento
4. CURP/ID
5. teléfono
6. puesto

### 11.3 Comportamiento mínimo

1. agregar fila
2. eliminar fila
3. validar visualmente
4. confirmar lote

### 11.4 Resumen final

Mostrar:

1. creados
2. duplicados
3. advertencias
4. errores
5. acceso inmediato al proyecto para continuar recepción

---

## 12. Reglas de Negocio

1. El proyecto debe existir antes de crear trabajadores; si no existe, se permite crearlo inline.
2. El `companyId` siempre se deriva del proyecto, no de las filas.
3. El lote rápido no debe intentar crear citas.
4. El lote rápido no debe intentar crear `MedicalEvent` todavía.
5. El lote rápido solo prepara padrón y vínculo a proyecto para que el Slice B se encargue de recepción clínica.

---

## 13. Criterios de Aceptación

1. Recepción puede crear un proyecto del día o reutilizar uno existente.
2. Puede capturar hasta 20 trabajadores en modo rápido sin Excel.
3. Los trabajadores válidos se crean y se vinculan al proyecto.
4. El flujo devuelve resumen por fila.
5. Los trabajadores recién creados aparecen listos para la cola operativa del proyecto.
6. No se crean citas ni eventos clínicos en este slice.

---

## 14. Validación Esperada

Validación exacta del slice:

1. `cd frontend && pnpm exec eslint src/components/ProjectsCalendar.tsx src/components/BulkWorkerImportModal.tsx src/actions/worker.actions.ts src/actions/project.actions.ts src/components/ProjectFormModal.tsx`

Validación manual mínima:

1. seleccionar empresa;
2. crear proyecto del día si falta;
3. capturar 3 filas manuales;
4. confirmar creación;
5. verificar que el proyecto refleja los nuevos trabajadores.

---

## 15. Condición de Detención

Si para resolver este slice se vuelve necesario:

1. tocar Prisma schema;
2. tocar `MedicalEvent` o recepción clínica;
3. abrir una ruta nueva;
4. reescribir la alta masiva formal por Excel;
5. abrir un sexto archivo funcional;

SOFIA debe detenerse y devolver `BLOQUEO DE CONTEXTO`.

---

## 16. Ejecución para SOFIA

### Datos existentes a reutilizar

1. `BulkWorkerImportModal`
2. `ProjectFormModal`
3. `getProjectsByCompany()`
4. `bulkImportWorkers()` y su lógica de clasificación cercana
5. `ProjectsCalendar`

### Datos faltantes a crear

1. modo de captura rápida
2. acción de lote manual del día
3. resumen operativo del lote

### Condición explícita

No expandir hacia recepción clínica. Este slice termina cuando los trabajadores quedan listos en el proyecto.