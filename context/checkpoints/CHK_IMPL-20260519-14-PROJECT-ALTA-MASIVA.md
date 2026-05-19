# Checkpoint — IMPL-20260519-14 Project + Alta Masiva
**Fecha:** 2026-05-19
**ID:** IMPL-20260519-14
**Agente:** SOFIA - Builder
**Tipo:** Feature Principal (ARCH-20260519-14)
**SPECs fuente:** SPEC_ARCH-20260519-12 (Project) + SPEC_ARCH-20260519-11 (Alta Masiva)
**Hotfix asociado:** CHK_IMPL-20260519-14-HOTFIX-AUTHZ.md

---

## Resumen Ejecutivo

Implementación completa del corte ARCH-20260519-14 en dos fases secuenciales:

- **Fase A (SPEC-12):** Nueva entidad `Project` (proyectos/campañas de visita médica) con modelos Prisma, migrations, server actions y UI completa.
- **Fase B (SPEC-11):** Alta Masiva de trabajadores por plantilla Excel vinculada a un proyecto, con flujo de error granular y límite de 200 filas.

Ambas fases se complementan: el alta masiva requiere un `projectId` existente para registrar `ProjectWorker` por cada trabajador creado exitosamente.

---

## Alcance Implementado

### Fase A — Entidad Project (SPEC-12)

| Ítem | Estado | Detalle |
|------|--------|---------|
| `ProjectStatus` enum | ✅ | `DRAFT`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| Modelo `Project` | ✅ | Campos: `id`, `name`, `companyId`, `branchId`, `unitRef` (texto libre hasta Sprint 5), `startDate`, `endDate`, `status`, `notes`, timestamps |
| Modelo `ProjectWorker` | ✅ | Join table `projectId` + `workerId` + `addedAt` + `addedBy` (trazabilidad del importador) |
| Relaciones inversas | ✅ | `Company.projects[]`, `Branch.projects[]`, `Worker.projectWorkers[]` |
| Migración | ✅ | `frontend/prisma/migrations/20260519000000_add_project_and_project_worker/` |
| `project.actions.ts` (nuevo) | ✅ | `getProjects`, `getProjectsByCompany`, `createProject`, `updateProject`, `updateProjectStatus` |
| Guards de autorización | ✅ | `requireAdminOrReceptionist()` en todas las queries y mutaciones |
| `ProjectFormModal.tsx` | ✅ | Crear/editar proyecto con validación de campos |
| `ProjectsTable.tsx` | ✅ | Tabla con columnas: nombre, empresa, sucursal, fechas, estado, acciones |
| `app/projects/page.tsx` | ✅ | Página principal de gestión de proyectos |

### Fase B — Alta Masiva (SPEC-11)

| Ítem | Estado | Detalle |
|------|--------|---------|
| Dependencia `xlsx@^0.18.5` | ✅ | Agregada a `package.json` |
| Plantilla Excel | ✅ | `public/templates/plantilla-trabajadores.xlsx` |
| `bulkImportWorkers()` en `worker.actions.ts` | ✅ | Parseo Excel, validación Zod por fila, límite 200 filas, registro `ProjectWorker` |
| `BulkWorkerImportModal.tsx` | ✅ | Upload, preview de errores por fila, resumen de éxito/error |
| `workers/page.tsx` actualizado | ✅ | Botón "Alta Masiva" integrado |
| `companyId` server-side | ✅ | Nunca desde cliente: se resuelve vía `project.companyId` |
| `gender` no persistido | ✅ | Solo se usa para `generateUniversalId`, no se almacena en `Worker` |

---

## Archivos Principales

| Archivo | Tipo | Descripción |
|---------|------|-------------|
| `frontend/prisma/schema.prisma` | Modificado | Modelos `Project`, `ProjectWorker`, enum `ProjectStatus` + relaciones inversas |
| `frontend/prisma/migrations/20260519000000_add_project_and_project_worker/` | Nuevo | Migración SQL del corte |
| `frontend/src/actions/project.actions.ts` | Nuevo | Server Actions completas para Project (205 líneas) |
| `frontend/src/actions/worker.actions.ts` | Modificado | `bulkImportWorkers()` + hotfix auth (+263 líneas) |
| `frontend/src/components/ProjectFormModal.tsx` | Nuevo | Modal de creación/edición de proyecto |
| `frontend/src/components/ProjectsTable.tsx` | Nuevo | Tabla de listado de proyectos |
| `frontend/src/app/projects/page.tsx` | Nuevo | Página `/projects` |
| `frontend/src/components/BulkWorkerImportModal.tsx` | Nuevo | Modal de carga masiva por Excel |
| `frontend/src/app/workers/page.tsx` | Modificado | Integración botón Alta Masiva |
| `frontend/public/templates/plantilla-trabajadores.xlsx` | Nuevo | Plantilla descargable |
| `frontend/package.json` + `pnpm-lock.yaml` | Modificados | Dep `xlsx@^0.18.5` |

---

## Estado de Commit

| Capa | Estado |
|------|--------|
| Hotfix de autorización | ✅ Committed — `b8bdea9` (main) |
| Cierre principal Project + Alta Masiva | ✅ Committed — `dce0166` (main) |

> El corte ARCH-20260519-14 ya cuenta con commit final de cierre en `main`.

---

## Soft Gates

| Gate | Estado | Evidencia |
|------|--------|-----------|
| G1 — Compilación (typecheck) | ✅ PASS | `tsc --noEmit --skipLibCheck` limpio en actions |
| G2 — Testing | ⚠️ Parcial | No hay tests unitarios de Server Actions en este slice; flujos de error cubiertos inline |
| G3 — Revisión (lint) | ✅ PASS | `eslint --max-warnings=0` limpio en `project.actions.ts` y `worker.actions.ts` |
| G4 — Documentación | ✅ PASS | Marca de agua `IMPL-20260519-14` en todos los archivos nuevos; checkpoint presente |

---

## Restricciones Respetadas

- `companyId` nunca desde cliente en `bulkImportWorkers` — siempre de `project.companyId`
- `gender` no persiste en `Worker` — solo para `generateUniversalId`
- Límite de 200 filas en importación masiva
- `await params` en rutas dinámicas (Next.js 16)
- Guards `requireAdminOrReceptionist()` en todas las queries públicas (cierre de OWASP A01)

---

## Riesgos Residuales

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Migración Prisma no ejecutada en producción (Railway) | Alto | Pendiente `prisma migrate deploy` en próximo deploy |
| Archivos UI/schema uncommitted | Medio | Commit de cierre requerido antes de QA |
| `bulkImportWorkers` FASE 2 (`COMPANY_CLIENT`): falta validar `project.companyId === session.user.companyId` | Bajo | Comentario `// TODO FASE 2` en código, bloqueado por ausencia del rol |
| `xlsx` parseo en Server Action — sin streaming para archivos >200 filas | Bajo | Límite duro de 200 filas mitiga el riesgo de timeout |

---

## Siguiente Paso

1. Ejecutar `prisma migrate deploy` en Railway (coordinado con GEMINI/infra).
2. Solicitar QA a GEMINI sobre el corte ya comprometido.
3. Validar flujo manual en un entorno con Prisma runtime operativo y OpenSSL compatible.
