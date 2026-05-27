# HANDOFF ARCH-20260519-16 a SOFIA — Calendario de Proyectos

- ID: ARCH-20260519-16
- Fecha: 2026-05-27
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion
- Issue Jira: SIN-ISSUE
- Archivo a trabajar: context/SPECs/SPEC_ARCH-20260519-16-CALENDARIO-PROYECTOS-VISITAS.md
- Estado actual: `Project` ya existe, `/projects` ya funciona como tabla y el acceso aún no está expuesto en navegación
- Objetivo exacto: convertir `Project` en una superficie operativa agregando vista calendario mensual reutilizando el CRUD existente
- Salida esperada: código listo para validación + handoff a Val/GEMINI
- Restricciones: máximo 5 archivos, sin drag-and-drop, sin agenda por hora, sin Google Calendar, sin nuevas rutas de detalle, sin librería nueva salvo bloqueo real justificado

## Orden de implementación

1. Tomar como ancla `frontend/src/app/projects/page.tsx`
2. Crear `frontend/src/components/ProjectsCalendar.tsx`
3. Reutilizar `ProjectFormModal.tsx` para edición desde calendario
4. Exponer `/projects` en `frontend/src/components/AppShell.tsx`
5. Mantener `ProjectsTable.tsx` como fallback o vista alterna

## Datos existentes a reutilizar

1. `Project` y `ProjectStatus` ya existen en Prisma y en producción
2. `getProjects()` ya devuelve `company`, `branch` y `_count.workers`
3. `ProjectFormModal.tsx` ya soporta crear/editar
4. `ProjectsTable.tsx` ya existe y funciona

## Archivos exactos permitidos

1. `frontend/src/app/projects/page.tsx`
2. `frontend/src/components/ProjectsCalendar.tsx`
3. `frontend/src/components/ProjectsTable.tsx`
4. `frontend/src/actions/project.actions.ts` solo si hace falta filtro extra
5. `frontend/src/components/AppShell.tsx`

## Validación esperada

1. `pnpm exec tsc --noEmit --skipLibCheck`
2. `pnpm exec eslint src/app/projects/page.tsx src/components/ProjectsCalendar.tsx src/components/ProjectsTable.tsx src/components/AppShell.tsx src/actions/project.actions.ts`
3. Verificación manual de que:
   - `/projects` muestra calendario mensual
   - hay acceso visible en navegación
   - el toggle conserva la tabla existente si se implementa
   - click sobre un proyecto permite abrir edición

## Condición de detención

Si necesitas abrir un sexto archivo, una librería nueva o una ruta de detalle no contemplada, detente y devuelve `BLOQUEO DE CONTEXTO`.
