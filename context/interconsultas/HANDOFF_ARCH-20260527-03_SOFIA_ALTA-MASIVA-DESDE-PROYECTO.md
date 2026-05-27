# HANDOFF ARCH-20260527-03 a SOFIA — Alta Masiva desde Proyecto

- ID: ARCH-20260527-03
- Fecha: 2026-05-27
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- Issue Jira: SIN-ISSUE
- Archivo a trabajar: context/SPECs/SPEC_ARCH-20260527-03-ALTA-MASIVA-DESDE-PROYECTO.md
- Estado actual: `/projects` ya tiene calendario y creación de proyectos; la carga masiva hoy vive en flujo separado
- Objetivo exacto: habilitar que, tras crear proyecto, se pueda iniciar alta masiva inmediata con empresa/proyecto preseleccionados
- Salida esperada: código listo para validación + checkpoint
- Restricciones: máximo 4 archivos, sin nuevas rutas, sin nuevas dependencias, sin rediseño server-side

## Orden de implementación

1. Anclar en `frontend/src/components/ProjectsCalendar.tsx`
2. Ajustar `ProjectFormModal` para acción post-creación
3. Extender `BulkWorkerImportModal` para modo contextual (preselección y apertura controlada)
4. Ajustar `frontend/src/app/projects/page.tsx` solo si se requiere cableado adicional

## Datos existentes a reutilizar

1. `ProjectFormModal.onSuccess(projectId, projectName)`
2. `BulkWorkerImportModal` flujo actual completo
3. `bulkImportWorkers(rows, projectId)` con resolución segura de `companyId` desde proyecto

## Archivos exactos permitidos

1. `frontend/src/components/ProjectsCalendar.tsx`
2. `frontend/src/components/ProjectFormModal.tsx`
3. `frontend/src/components/BulkWorkerImportModal.tsx`
4. `frontend/src/app/projects/page.tsx` (solo si aplica)

## Validación esperada

1. `pnpm exec tsc --noEmit --skipLibCheck`
2. `pnpm exec eslint src/components/ProjectsCalendar.tsx src/components/ProjectFormModal.tsx src/components/BulkWorkerImportModal.tsx src/app/projects/page.tsx`
3. Verificación manual:
   - crear proyecto en `/projects`
   - iniciar alta masiva desde ese éxito
   - confirmar preselección de empresa/proyecto

## Condición de detención

Si necesitas abrir un quinto archivo o tocar server actions de importación, detente y devuelve `BLOQUEO DE CONTEXTO` con causa técnica exacta.
