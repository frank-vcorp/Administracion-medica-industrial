# SPEC: Alta Masiva de Trabajadores desde Creación de Proyecto

**ID:** ARCH-20260527-03  
**Fecha:** 2026-05-27  
**Estado:** IMPLEMENTADA Y PUBLICADA  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta  
**Depende de:**  
- ARCH-20260519-12 (Entidad `Project`)  
- ARCH-20260519-11 (Alta masiva de trabajadores)  
- ARCH-20260519-16 (Calendario de proyectos)

---

## 1. Contexto y Problema

Hoy el flujo operativo está partido en dos superficies:

1. El usuario crea el proyecto desde `/projects`.
2. Luego debe ir a `/workers` para ejecutar la carga masiva.

Esto genera fricción y aumenta la probabilidad de errores de contexto (empresa/proyecto incorrectos).

---

## 2. Objetivo

Permitir que, al crear un proyecto, el usuario pueda iniciar inmediatamente la alta masiva de trabajadores para ese mismo proyecto y empresa, sin salir del módulo de proyectos.

---

## 3. Alcance

### Incluye

1. Acción post-creación de proyecto para iniciar alta masiva.
2. Apertura del flujo de `BulkWorkerImportModal` desde `/projects`.
3. Preselección automática de empresa y proyecto recién creado.
4. Opción de bloqueo de empresa/proyecto cuando el flujo se inicia desde proyecto.

### No incluye

1. Rediseño completo del modal de alta masiva.
2. Cambios de negocio en validación server-side de `bulkImportWorkers()`.
3. Nuevas rutas.
4. Nuevas dependencias externas.

---

## 4. Decisiones de Diseño

1. Se reutiliza `ProjectFormModal` existente mediante `onSuccess(projectId, projectName)`.
2. Se reutiliza `BulkWorkerImportModal` extendiendo props para modo contextual desde proyecto.
3. El flujo debe permitir una salida clara:
   - crear proyecto y cerrar
   - crear proyecto e iniciar carga masiva
4. El source of truth de empresa sigue siendo `project.companyId`; no se acepta companyId libre desde cliente en importación.

---

## 5. Superficie Técnica Esperada

| Archivo | Acción | Descripción |
|---------|--------|-------------|
| `frontend/src/components/ProjectFormModal.tsx` | Modificar | Exponer acción UX post-creación para disparar inicio de alta masiva |
| `frontend/src/components/BulkWorkerImportModal.tsx` | Modificar | Soportar apertura controlada + preselección de `companyId/projectId` |
| `frontend/src/components/ProjectsCalendar.tsx` | Modificar | Orquestar estado: proyecto recién creado y apertura de alta masiva |
| `frontend/src/app/projects/page.tsx` | Modificar | Pasar props necesarias al calendario sin romper carga actual |

> No se debe tocar `worker.actions.ts` salvo hallazgo crítico de seguridad/consistencia.

---

## 6. Contrato Funcional

### Flujo esperado

1. Usuario entra a `/projects`.
2. Crea proyecto desde `ProjectFormModal`.
3. Al éxito, ve acción clara: `Iniciar alta masiva`.
4. Si la ejecuta, se abre `BulkWorkerImportModal` con:
   - empresa preseleccionada del proyecto
   - proyecto preseleccionado
   - paso inicial en `upload` (o en `project` bloqueado, según implementación más limpia)
5. Usuario sube plantilla y ejecuta importación sin tener que re-elegir proyecto.

### Reglas

1. Si el proyecto recién creado no puede resolverse en lista de proyectos, mostrar error y fallback a selección manual.
2. Si el usuario cierra el modal de alta masiva, no se pierde el proyecto creado.
3. La tabla/calendario de proyectos se mantiene operativa.

---

## 7. Criterios de Aceptación

1. Desde `/projects`, crear proyecto ofrece iniciar carga masiva inmediata.
2. La alta masiva abre con empresa y proyecto correctos del proyecto recién creado.
3. No se requiere navegar a `/workers` para iniciar ese import.
4. El flujo manual previo de `BulkWorkerImportModal` en `/workers` sigue funcionando.
5. Sin regresión en `pnpm exec tsc --noEmit --skipLibCheck`.
6. Sin regresión en eslint de archivos tocados.

---

## 8. Riesgos y Mitigaciones

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Acoplar demasiado `ProjectFormModal` con `BulkWorkerImportModal` | Media | Resolver orquestación en `ProjectsCalendar` y mantener modales desacoplados por props |
| Estado inconsistente al reabrir modal | Media | Reset explícito de estado en apertura/cierre controlados |
| Regresión del flujo de alta masiva existente | Alta | Mantener comportamiento por defecto cuando no hay props contextuales |

---

## 9. Ejecución para SOFIA

### Archivo ancla inicial

`frontend/src/components/ProjectsCalendar.tsx`

### Datos existentes a reutilizar

1. `ProjectFormModal` ya expone `onSuccess(projectId, projectName)`.
2. `BulkWorkerImportModal` ya implementa todo el flujo de importación.
3. `bulkImportWorkers(rows, projectId)` ya resuelve `companyId` desde proyecto en servidor.

### Datos faltantes a crear

1. Estado de orquestación en `/projects` para “proyecto creado” y “abrir alta masiva”.
2. Props de apertura contextual en `BulkWorkerImportModal`.
3. UX post-creación en `ProjectFormModal` para iniciar alta masiva.

### Archivos exactos a crear o modificar

1. `frontend/src/components/ProjectsCalendar.tsx` — modificar
2. `frontend/src/components/ProjectFormModal.tsx` — modificar
3. `frontend/src/components/BulkWorkerImportModal.tsx` — modificar
4. `frontend/src/app/projects/page.tsx` — modificar solo si hace falta cableado de props

### Máximo de archivos permitidos

**4 archivos**

Si se requiere abrir un quinto archivo, devolver `BLOQUEO DE CONTEXTO` a INTEGRA con justificación técnica.

### Validación exacta esperada

1. `pnpm exec tsc --noEmit --skipLibCheck`
2. `pnpm exec eslint src/components/ProjectsCalendar.tsx src/components/ProjectFormModal.tsx src/components/BulkWorkerImportModal.tsx src/app/projects/page.tsx`
3. Verificación manual:
   - crear proyecto desde `/projects`
   - disparar alta masiva inmediata
   - confirmar preselección correcta de empresa/proyecto

### Condición de detención si falta contexto

Detener y devolver `BLOQUEO DE CONTEXTO` si:

1. la orquestación obliga a rediseñar `worker.actions.ts`;
2. se requiere cambiar contrato de seguridad del import server-side;
3. se detecta incompatibilidad estructural entre modales que obligue a superar 4 archivos.

---

*Generado por INTEGRA — ARCH-20260527-03 — 2026-05-27*