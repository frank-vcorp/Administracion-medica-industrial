# HANDOFF: Implementación Módulo de Unidades Móviles

**De:** INTEGRA (Arquitecto de Soluciones)  
**Para:** SOFIA (Constructora Principal)  
**ID:** HANDOFF_ARCH-20260711-01  
**Fecha:** 2026-07-11  
**Prioridad:** ALTA  
**SPEC Referencia:** `context/SPECs/SPEC_ARCH-20260711-01-MODULO-UNIDADES-MOVILES.md`

---

## 📋 Tarea

Implementar el **Módulo de Unidades Móviles con Calendario Dual y Mantenimiento Flexible** completo según la SPEC ARCH-20260711-01.

---

## 🎯 Entregables

1. **Schema Prisma completo** con modelos `MobileUnit`, `MaintenanceRecord` y modificaciones a `Project`, `MedicalEvent`, `LabOrder`, `User`
2. **Migración SQL** aplicada a Railway PostgreSQL
3. **Seed de 6 unidades iniciales** (con nombres genéricos: "Unidad Móvil 1" a "Unidad Móvil 6")
4. **Endpoints FastAPI** para CRUD de unidades y mantenimientos
5. **Server Actions** para frontend (CRUD, validaciones, reprogramación, completación)
6. **Vistas UI:**
   - `/admin/mobile-units` (catálogo)
   - `/admin/mobile-units/new` (crear)
   - `/admin/mobile-units/[id]` (detalle)
   - `/admin/mobile-units/[id]/edit` (editar)
   - `/admin/mobile-units/[id]/maintenance` (calendario de mantenimiento)
   - `/operations/mobile-units` (dashboard operativo)
7. **Mejoras a vistas existentes:**
   - `/projects` (calendario con badges de unidad)
   - `/projects/new` y `/projects/[id]/edit` (selector de unidad con validación)
8. **Upload de imágenes** a Railway Storage Bucket
9. **Tests:**
   - pytest backend (mínimo 10 tests)
   - vitest frontend (mínimo 20 tests)
   - Playwright E2E (6 escenarios completos)
10. **Aprobación de GEMINI** con 0 bloqueadores

---

## 🔧 Instrucciones Detalladas

### Paso 1: Schema Prisma

1. Leer `frontend/prisma/schema.prisma`
2. Agregar nuevos enums: `MobileUnitStatus`, `MaintenanceType`, `MaintenanceStatus`
3. Agregar nuevo modelo `MobileUnit` con campos: id, name (único), plate, vin, year, capacity, economicNumber, imageUrl, status, equipment (JSON), notes, timestamps
4. Agregar nuevo modelo `MaintenanceRecord` con campos: id, mobileUnitId (FK), type, status, scheduledDate, completedDate, rescheduledTo, description, technician, cost, nextDueDate, attachments (JSON), createdBy, completedBy, timestamps
5. Modificar modelo `Project`: agregar `mobileUnitId` (FK opcional)
6. Modificar modelo `MedicalEvent`: agregar `mobileUnitId` (FK opcional)
7. Modificar modelo `LabOrder`: agregar `mobileUnitId` (FK opcional)
8. Modificar modelo `User`: agregar relación `createdMaintenances`
9. Ejecutar `npx prisma generate` para validar schema

### Paso 2: Migración SQL

1. Crear archivo de migración: `frontend/prisma/migrations/20260711000000_add_mobile_units/migration.sql`
2. Incluir CREATE TYPE para enums
3. Incluir CREATE TABLE para `mobile_units` y `maintenance_records`
4. Incluir ALTER TABLE para agregar columnas y FKs
5. Aplicar migración a Railway: `railway run --service 'Administracion-medica-industrial' npx prisma migrate deploy`
6. Verificar que migración se aplicó correctamente

### Paso 3: Seed de Unidades

1. Crear archivo: `frontend/prisma/seed-mobile-units.ts`
2. Insertar 6 unidades con nombres genéricos ("Unidad Móvil 1" a "Unidad Móvil 6"), placas placeholder, capacity 30-50
3. Ejecutar seed: `railway run --service 'Administracion-medica-industrial' npx tsx prisma/seed-mobile-units.ts`
4. Verificar que unidades se crearon en DB

### Paso 4: Endpoints FastAPI

1. Crear archivo: `backend/app/api/v1/mobile_units.py`
2. Implementar endpoints:
   - `GET /` (lista con filtros)
   - `GET /{unit_id}` (detalle)
   - `POST /` (crear)
   - `PATCH /{unit_id}` (actualizar)
   - `DELETE /{unit_id}` (eliminar con validación)
   - `POST /{unit_id}/image` (subir imagen)
   - `DELETE /{unit_id}/image` (eliminar imagen)
3. Crear archivo: `backend/app/api/v1/maintenance.py`
4. Implementar endpoints:
   - `GET /unit/{unit_id}` (lista)
   - `POST /unit/{unit_id}` (crear)
   - `PATCH /{record_id}` (actualizar)
   - `POST /{record_id}/reprogram` (reprogramar)
   - `POST /{record_id}/complete` (completar)
5. Registrar routers en `backend/app/main.py`
6. Ejecutar tests backend: `cd backend && python -m pytest tests/ -v`

### Paso 5: Server Actions

1. Crear archivo: `frontend/src/actions/mobile-unit.actions.ts`
2. Implementar actions:
   - `getMobileUnits()`
   - `getMobileUnitById()`
   - `createMobileUnit()`
   - `updateMobileUnit()`
   - `deleteMobileUnit()`
   - `uploadMobileUnitImage()`
   - `deleteMobileUnitImage()`
3. Crear archivo: `frontend/src/actions/maintenance.actions.ts`
4. Implementar actions:
   - `getMaintenanceRecords()`
   - `createMaintenanceRecord()`
   - `updateMaintenanceRecord()`
   - `reprogramMaintenance()`
   - `completeMaintenance()`
5. Extender `frontend/src/actions/project.actions.ts`:
   - Agregar `validateUnitAvailability()`
   - Agregar `suggestMaintenanceDates()`
6. Ejecutar tests frontend: `cd frontend && npm test`

### Paso 6: Vistas UI

#### 6.1 Catálogo de Unidades (`/admin/mobile-units`)

1. Crear carpeta: `frontend/src/app/admin/mobile-units/`
2. Crear archivo: `page.tsx` con tabla de unidades
3. Crear componente: `frontend/src/components/mobile-units/MobileUnitTable.tsx`
4. Crear componente: `frontend/src/components/mobile-units/MobileUnitModal.tsx` (para crear/editar)
5. Implementar upload de imagen con drag & drop
6. Implementar filtros por status

#### 6.2 Detalle de Unidad (`/admin/mobile-units/[id]`)

1. Crear carpeta: `frontend/src/app/admin/mobile-units/[id]/`
2. Crear archivo: `page.tsx` con detalle completo
3. Crear componente: `frontend/src/components/mobile-units/MobileUnitDetail.tsx`
4. Mostrar imagen grande, info general, equipamiento, próximos mantenimientos, proyectos asignados, historial

#### 6.3 Calendario de Mantenimiento (`/admin/mobile-units/[id]/maintenance`)

1. Crear carpeta: `frontend/src/app/admin/mobile-units/[id]/maintenance/`
2. Crear archivo: `page.tsx` con vista calendario
3. Usar librería de calendario existente o crear componente custom
4. Implementar modal de programación de mantenimiento
5. Implementar modal de reprogramación (cuando hay conflicto)
6. Implementar modal de completación

#### 6.4 Dashboard Operativo (`/operations/mobile-units`)

1. Crear carpeta: `frontend/src/app/operations/mobile-units/`
2. Crear archivo: `page.tsx` con dashboard
3. Crear componentes:
   - `UnitCounters.tsx` (contadores de status)
   - `UpcomingMaintenances.tsx` (próximos mantenimientos)
   - `DualCalendar.tsx` (calendario con proyectos y mantenimientos)
   - `UtilizationChart.tsx` (gráfica de utilización)

#### 6.5 Mejoras a Calendario de Proyectos

1. Modificar `frontend/src/app/projects/page.tsx` para mostrar badges de unidad
2. Modificar `frontend/src/app/projects/new/page.tsx` para incluir selector de unidad
3. Modificar `frontend/src/app/projects/[id]/edit/page.tsx` para incluir selector de unidad
4. Implementar validación de disponibilidad en tiempo real

### Paso 7: Upload de Imágenes

1. Usar configuración existente de Railway Storage Bucket
2. Implementar endpoint de upload en backend
3. Implementar componente de drag & drop en frontend
4. Validar tipo (image/jpeg, image/png) y tamaño (< 5MB)
5. Guardar URL en campo `imageUrl` de `MobileUnit`

### Paso 8: Tests

#### 8.1 Backend (pytest)

Crear archivo: `backend/tests/test_mobile_units.py`

Tests mínimos:
- `test_create_mobile_unit()`
- `test_list_mobile_units()`
- `test_get_mobile_unit()`
- `test_update_mobile_unit()`
- `test_delete_mobile_unit_with_relations()`
- `test_upload_image()`
- `test_create_maintenance_record()`
- `test_reprogram_maintenance()`
- `test_complete_maintenance()`
- `test_validate_unit_availability()`

#### 8.2 Frontend (vitest)

Crear archivo: `frontend/src/actions/__tests__/mobile-unit.actions.test.ts`

Tests mínimos:
- `test getMobileUnits()`
- `test createMobileUnit()`
- `test updateMobileUnit()`
- `test deleteMobileUnit()`
- `test uploadMobileUnitImage()`
- `test createMaintenanceRecord()`
- `test reprogramMaintenance()`
- `test completeMaintenance()`
- `test validateUnitAvailability()`
- `test suggestMaintenanceDates()`

#### 8.3 E2E (Playwright)

Crear archivo: `frontend/tests/e2e/mobile-units.spec.ts`

Escenarios:
1. Crear unidad móvil con imagen
2. Asignar unidad a proyecto
3. Detectar conflicto proyecto vs mantenimiento
4. Reprogramar mantenimiento
5. Completar mantenimiento
6. Eliminar unidad con validación

### Paso 9: Validaciones

1. Ejecutar `pnpm typecheck` en frontend
2. Ejecutar `pnpm test` en frontend
3. Ejecutar `pnpm lint` en frontend
4. Ejecutar `python -m pytest tests/ -v` en backend
5. Verificar que todos los tests pasan

### Paso 10: Revisión de GEMINI

1. Al terminar implementación, solicitar revisión a GEMINI:
   ```
   task tool con subagent_type='gemini'
   prompt: "Revisar implementación del módulo de Unidades Móviles (SPEC ARCH-20260711-01). Verificar consistencia con SPEC, typecheck, tests, code smells, edge cases."
   ```
2. Esperar aprobación de GEMINI con 0 bloqueadores

---

## ⚠️ Advertencias

1. **NO commitear** sin OK explícito de INTEGRA
2. **NO pushear** a main sin aprobación de GEMINI
3. **NO eliminar** funcionalidad existente
4. **NO cambiar** arquitectura sin consultar con INTEGRA
5. **Validar** que migración se aplica correctamente en Railway
6. **Verificar** que upload de imágenes funciona con Railway Storage Bucket
7. **Probar** flujo completo de reprogramación de mantenimientos

---

## 📞 Contacto

Si hay dudas durante la implementación, consultar con INTEGRA antes de proceder.

**¡Éxito con la implementación!**
