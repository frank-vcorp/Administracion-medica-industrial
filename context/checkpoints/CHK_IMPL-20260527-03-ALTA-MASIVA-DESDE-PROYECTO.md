# Checkpoint IMPL-20260527-03

- ID implementación: IMPL-20260527-03
- ID SPEC: ARCH-20260527-03
- Fecha: 2026-05-27
- Estado: COMPLETADO (listo para validación)
- Issue Jira: SIN-ISSUE

## Alcance implementado

Se habilitó el flujo para iniciar alta masiva inmediatamente después de crear un proyecto desde `/projects`, con empresa y proyecto preseleccionados.

### Archivos modificados

1. `frontend/src/components/ProjectsCalendar.tsx`
2. `frontend/src/components/ProjectFormModal.tsx`
3. `frontend/src/components/BulkWorkerImportModal.tsx`

> `frontend/src/app/projects/page.tsx` no requirió cambios.

## Cambios clave

1. **Orquestación en calendario (`/projects`)**
   - Se agregó estado contextual para capturar el proyecto recién creado.
   - Se añadió CTA visible `Iniciar alta masiva` tras creación exitosa.
   - Se abrió `BulkWorkerImportModal` en modo controlado y contextual, sin trigger propio.

2. **Salida de datos de creación en `ProjectFormModal`**
   - Se amplió `onSuccess` para incluir `companyId` opcional además de `projectId` y `projectName`.
   - Se mantiene compatibilidad con llamados existentes que usan solo dos argumentos.

3. **Modo contextual en `BulkWorkerImportModal`**
   - Nuevas props opcionales para control externo (`isOpen`, `onOpenChange`, `hideTrigger`).
   - Nuevas props de contexto (`initialCompanyId`, `initialProjectId`, `lockProjectContext`).
   - Inicialización con preselección automática de empresa/proyecto cuando se abre desde `/projects`.
   - Bloqueo de selects en modo contextual para evitar inconsistencias.
   - Fallback con mensaje si no se puede resolver el proyecto contextual y se requiere selección manual.

## Validación ejecutada

Comandos solicitados en SPEC:

1. `pnpm exec tsc --noEmit --skipLibCheck` ✅
2. `pnpm exec eslint src/components/ProjectsCalendar.tsx src/components/ProjectFormModal.tsx src/components/BulkWorkerImportModal.tsx src/app/projects/page.tsx` ✅

Observación:
- ESLint mostró solo advertencia general del proyecto sobre `.eslintignore` deprecado; no hubo errores de lint en los archivos validados.

## Riesgos residuales / notas

1. El flujo contextual depende de que `getProjectsByCompany(companyId)` devuelva el proyecto recién creado al abrir modal.
2. Si por latencia de revalidación el proyecto aún no aparece en la lista, se activa fallback manual con mensaje en UI.
