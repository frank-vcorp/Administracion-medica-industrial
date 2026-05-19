# HANDOFF ARCH-20260519-14 a SOFIA — Project y Alta Masiva

- ID: ARCH-20260519-14
- Fecha: 2026-05-19
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion secuencial
- SPECs fuente:
  - context/SPECs/SPEC_ARCH-20260519-12-ENTIDAD-PROJECT-VISITA-MEDICA.md
  - context/SPECs/SPEC_ARCH-20260519-11-ALTA-MASIVA-TRABAJADORES.md
- Dictamenes de validacion:
  - context/interconsultas/DICTAMEN_FIX-20260519-06-SPECS-11-12.md

## Objetivo

Implementar primero la entidad `Project` como base operativa de campañas/visitas medicas y, sobre esa base, implementar la carga masiva de trabajadores por plantilla Excel vinculada a un proyecto.

El orden es obligatorio:

1. SPEC-12 `Project`
2. SPEC-11 `Alta Masiva`

No se debe iniciar SPEC-11 antes de que exista la migracion y las actions de `Project`.

## Contexto operativo

AMI agenda visitas medicas por empresa y rango de fechas, hoy fuera del sistema. La alta masiva no pertenece solo a una empresa abstracta: pertenece a una visita/campana concreta.

Por eso la secuencia correcta es:

1. crear entidad `Project`
2. permitir seleccionar o crear proyecto desde el flujo de alta masiva
3. registrar en `ProjectWorker` a cada trabajador creado exitosamente

## Dependencias y orden de ejecucion

### Regla de secuencia

1. si sigues cerrando `ARCH-20260519-10`, termina ese corte primero
2. despues toma este handoff
3. dentro de este handoff, implementa SPEC-12 completa antes de tocar SPEC-11

### Motivo

Hay solapamiento real en:

1. frontend/prisma/schema.prisma
2. frontend/src/actions/worker.actions.ts

No hay conflicto funcional entre Sprint 1 Recepcion Operativa y este corte, pero si hay riesgo de friccion en migraciones y merges si se mezclan al mismo tiempo.

## Alcance exacto

### Fase A — SPEC-12 Entidad Project

Implementar:

1. nuevos modelos `Project`, `ProjectWorker` y enum `ProjectStatus`
2. relaciones inversas en `Company`, `Worker` y `Branch`
3. action file nuevo `frontend/src/actions/project.actions.ts`
4. actions minimas:
   - `getProjects()`
   - `getProjectsByCompany(companyId)`
   - `createProject(data)`
   - `updateProject(projectId, data)`
   - `updateProjectStatus(projectId, status)`
5. vista base en `frontend/src/app/projects/page.tsx`
6. modal `frontend/src/components/ProjectFormModal.tsx`

### Fase B — SPEC-11 Alta Masiva por Excel

Implementar:

1. `bulkImportWorkers(rows, projectId)` en `frontend/src/actions/worker.actions.ts`
2. selector de proyecto en el modal de importacion
3. opcion de crear proyecto inline desde el flujo de importacion
4. parseo client-side con `xlsx@^0.18.5`
5. script generador de plantilla `.xlsx`
6. alta de relaciones en `ProjectWorker`
7. auditoria agregada del proceso de importacion

## Restricciones cerradas

1. `companyId` nunca llega desde cliente en la importacion; se resuelve desde `project.companyId`
2. `gender` en `BulkWorkerRow` se usa solo para `generateUniversalId()`; no existe columna `gender` en `Worker` y no debe persistirse
3. el limite operativo de Fase 1 es `200` filas por importacion
4. la deduplicacion masiva usa la matriz aprobada en la SPEC y es mas permisiva que la alta individual por diseno
5. la plantilla Excel no se sube al servidor; solo se envia JSON normalizado
6. `ProjectFormModal` si debe soportar edicion en este corte
7. no introducir calendario visual estilo Google Calendar en esta implementacion; queda fuera de alcance

## Anclas reales

1. frontend/prisma/schema.prisma
2. frontend/src/actions/worker.actions.ts
3. frontend/src/lib/id.utils.ts
4. frontend/src/app/workers/page.tsx
5. frontend/src/components/WorkerImportModal.tsx o equivalente real si el nombre actual difiere
6. frontend/src/actions/project.actions.ts
7. frontend/src/app/projects/page.tsx
8. frontend/src/components/ProjectFormModal.tsx

## Criterios minimos de validacion

### Para SPEC-12

1. `prisma migrate dev` corre sin error de relacion faltante en `Branch`
2. `Project` puede crearse y editarse sin cambiar `companyId`
3. `getProjectsByCompany()` retorna proyectos utilizables para dropdown
4. solo `ADMIN` y `RECEPTIONIST` acceden a las actions en esta fase

### Para SPEC-11

1. carga de hasta `200` filas sin timeout operativo razonable
2. `bulkImportWorkers()` rechaza `projectId` invalido o no autorizado
3. cada trabajador nuevo crea su registro en `ProjectWorker`
4. `warnings`, `duplicates`, `errors` y `created` quedan reportados correctamente
5. `gender` no se persiste en `Worker`
6. la plantilla descargable existe y contiene encabezados + fila ejemplo

## Validacion recomendada por orden

1. migracion Prisma de SPEC-12
2. validacion funcional de actions de Project
3. prueba estrecha de `bulkImportWorkers()` sin UI
4. integracion del modal de importacion
5. validacion final de UI y plantilla

## Nota final

Las dos SPECs ya fueron revisadas por DEBY y quedaron aprobadas con ajustes aplicados. Implementa exactamente sobre las versiones vigentes de las SPECs. Si aparece una necesidad de ampliar alcance a calendario visual, equipo como entidad formal o portal B2B, reabrir con INTEGRA en un corte separado.