# SPEC: Búsqueda Externa Server-Side y Reutilización Consistente

**ID:** ARCH-20260527-24  
**Fecha:** 2026-05-27  
**Estado:** LISTA PARA IMPLEMENTACION  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta  
**SPEC madre:** `context/SPECs/SPEC_ARCH-20260527-14-SLICE-D-ADMISION-EXTERNA-SIN-EMPRESA.md`

---

## 1. Objetivo

Corregir la inconsistencia entre la UX del modal de `Ingreso externo` y la lógica real de identidad ya existente en backend, reemplazando la búsqueda local en memoria por una búsqueda **directa a base de datos** y conservando el control de duplicados actual al momento de crear una persona nueva.

---

## 2. Estado actual verificado

### 2.1 Búsqueda visual actual

En `frontend/src/components/CheckInModal.tsx`, el bloque `Buscar externo existente` hoy:

1. no consulta la base de datos;
2. filtra en cliente la prop `workers` ya cargada por la página;
3. restringe candidatos a `workers.filter((worker) => !worker.company)`;
4. aplica solo un `includes()` sobre nombre completo;
5. devuelve un subconjunto visual que puede no representar la realidad de la base.

### 2.2 Duplicados ya resueltos en backend

En `frontend/src/actions/worker.actions.ts`, la action `createExternalWorkerIntake()` ya implementa control de identidad mínimo:

1. normaliza `firstName` y `lastName`;
2. busca coincidencias exactas por nombre y apellido en `worker.findMany()`;
3. si hay `dob`, reutiliza coincidencia fuerte por nombre + apellido + DOB;
4. si no hay `dob` y hay candidatos, devuelve `status = 'ambiguous_match'`;
5. solo crea nuevo `Worker` cuando no hay match fuerte o cuando recepción confirma continuar.

### 2.3 Problema de diseño resultante

La pantalla y la fuente de verdad hoy no usan el mismo universo de búsqueda:

1. el modal solo muestra externos sin empresa;
2. la deduplicación real revisa coincidencias más amplias en la tabla `workers`;
3. por eso el usuario puede no ver a una persona existente aunque backend sí la detecte después al crear.

---

## 3. Decisión de arquitectura

La búsqueda previa de `Ingreso externo` debe ser **server-side** y debe consultar la misma base de identidad que protege la creación.

### Regla principal

La UI no debe decidir identidad a partir de una lista precargada en cliente.

### Regla de consistencia

La búsqueda previa y la deduplicación de creación deben operar sobre el mismo universo lógico de personas existentes.

### Regla de UX

El flujo sigue siendo simple: buscar, seleccionar si existe, o capturar alta mínima si no aparece. No se debe convertir en módulo complejo.

---

## 4. Alcance

### Sí entra

1. Nueva búsqueda server-side para el modo `external` del modal.
2. Consulta directa a Prisma sobre `workers`.
3. Render de resultados reales desde DB dentro del mismo modal.
4. Selección de un `workerId` existente desde esos resultados.
5. Conservación de `createExternalWorkerIntake()` como guardia final de duplicados.

### No entra

1. Cambios de Prisma schema.
2. Rediseño visual amplio del modal.
3. Nuevas rutas o páginas.
4. Reescritura del flujo de `Trabajador existente`.
5. Fuzzy search avanzada, scoring complejo o motor externo.

---

## 5. Comportamiento esperado

### Caso A — La persona ya existe en DB

1. Recepción abre `Ingreso externo`.
2. Escribe al menos 2 caracteres en la caja de búsqueda.
3. El modal consulta al servidor.
4. Se muestran coincidencias reales de DB.
5. Recepción selecciona una.
6. El flujo continúa con `createExternalWalkInEvent()` sin crear un `Worker` nuevo.

### Caso B — La persona no aparece en DB

1. Recepción abre `Ingreso externo`.
2. Escribe nombre/apellido y no obtiene resultados útiles.
3. Captura alta mínima.
4. Al confirmar, `createExternalWorkerIntake()` mantiene la validación de duplicados ya existente.
5. Si no hay match fuerte, se crea la persona y luego el evento clínico.

### Caso C — Coincidencia ambigua al crear

1. Recepción no selecciona un resultado previo.
2. Intenta crear nuevo externo.
3. Backend detecta coincidencia exacta por nombre y apellido sin DOB suficiente.
4. Se devuelve advertencia `ambiguous_match` como hoy.
5. El usuario puede completar DOB o forzar creación manual.

---

## 6. Contrato técnico exacto para Sofia

### Archivo ancla inicial

`frontend/src/components/CheckInModal.tsx`

### Datos existentes a reutilizar

1. `createExternalWorkerIntake()` ya existe en `frontend/src/actions/worker.actions.ts` y no debe reescribirse desde cero.
2. `selectedExternalWorkerId`, `externalQuery` y el flujo de confirmación externa ya existen en `CheckInModal`.
3. `createExternalWalkInEvent()` ya resuelve la convergencia a `MedicalEvent` y no forma parte de este ajuste.

### Datos faltantes a crear

Crear una nueva server action acotada para búsqueda previa, por ejemplo `searchExternalIntakeCandidates(query: string)` en `frontend/src/actions/worker.actions.ts`, con esta salida mínima:

1. `id`
2. `firstName`
3. `lastName`
4. `dob`
5. `company: { name: string } | null`

### Archivos exactos a crear o modificar

1. `frontend/src/components/CheckInModal.tsx`
2. `frontend/src/actions/worker.actions.ts`

### Máximo de archivos permitidos

Máximo 2 archivos funcionales. Si se requiere tocar un tercero, detenerse y devolver `BLOQUEO DE CONTEXTO`.

---

## 7. Reglas de implementación obligatorias

### 7.1 Regla de consulta

La nueva búsqueda debe consultar DB directamente y no reutilizar `workers.filter()` para el modo externo.

### 7.2 Regla de activación

No consultar al servidor si el texto limpio tiene menos de 2 caracteres.

### 7.3 Regla de volumen

Limitar respuesta a máximo 8 resultados visibles.

### 7.4 Regla de universo de búsqueda

La búsqueda debe operar sobre `workers` de forma consistente con la deduplicación. No restringir artificialmente solo a `company = null`.

### 7.5 Regla de continuidad

Si se selecciona un resultado existente, no mostrar el bloque de alta mínima mientras esa selección siga activa.

### 7.6 Regla de fallback

Si no hay resultados o no se selecciona ninguno, se mantiene el flujo actual de alta mínima con `createExternalWorkerIntake()`.

### 7.7 Regla de honestidad visual

Cada resultado debe mostrar al menos:

1. nombre completo;
2. empresa asociada o etiqueta `Sin empresa`;
3. DOB si existe y cabe en el espacio sin recargar la UI.

---

## 8. Diseño operativo mínimo

Dentro del bloque `Ingreso externo`:

1. la caja `Buscar externo existente` sigue visible;
2. al escribir, dispara búsqueda server-side con retraso corto razonable en cliente;
3. mientras consulta, puede mostrar un estado breve de `Buscando...`;
4. si hay resultados, los lista;
5. si el usuario elige uno, queda seleccionado claramente;
6. si no elige ninguno, puede seguir con alta mínima.

No se pide autocompletado complejo ni componente externo.

---

## 9. Criterios de aceptación

1. Escribir un nombre existente en `Ingreso externo` consulta DB y devuelve coincidencias reales.
2. La búsqueda deja de depender de `workers.filter()` local para el modo externo.
3. Se puede seleccionar una persona existente y continuar sin crear duplicado.
4. Si no se selecciona nadie, sigue funcionando el alta mínima actual.
5. El control de duplicados de `createExternalWorkerIntake()` permanece intacto.
6. El ajuste no rompe el modo `Trabajador existente`.

---

## 10. Validación esperada

Validación exacta esperada para Sofia:

1. `cd frontend && pnpm exec eslint src/components/CheckInModal.tsx src/actions/worker.actions.ts`
2. Validación manual en recepción:
   - escribir nombre de persona existente y confirmar que aparecen resultados desde DB;
   - seleccionar uno y crear evento externo sin alta nueva;
   - intentar alta nueva sin selección y confirmar que sigue operando `ambiguous_match` cuando aplica.

---

## 11. Condición de detención

Si para cumplir este ajuste Sofia concluye que necesita:

1. cambiar Prisma schema;
2. tocar más de 2 archivos funcionales;
3. abrir ruta nueva;
4. alterar `createExternalWalkInEvent()`;

debe detenerse y devolver `BLOQUEO DE CONTEXTO`.