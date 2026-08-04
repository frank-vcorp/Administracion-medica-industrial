# SPEC: Módulo de Unidades Móviles con Calendario Dual y Mantenimiento Flexible

**ID:** ARCH-20260711-01  
**Fecha:** 2026-07-11  
**Estado:** APROBADO PARA IMPLEMENTACIÓN  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta — habilita operación real de unidades móviles de AMI  
**Puntaje INTEGRA:** (3×3) + (3×2) - (2×0.5) = **14**

---

## 1. Contexto y Problema

AMI opera **6 unidades móviles** (trailers/vehículos equipados como clínicas móviles) que asisten a proyectos de visita médica en ubicaciones externas. Actualmente:

- `Project.unitRef` es solo un **texto libre** (placeholder desde ARCH-20260519-12)
- No hay entidad dedicada para gestionar unidades móviles
- No hay trazabilidad de qué unidad atendió qué proyecto/evento
- No hay gestión de mantenimientos preventivos/correctivos
- No hay validación de disponibilidad (una unidad no puede estar en dos lugares a la vez)
- No hay imágenes ni inventario de equipos por unidad

**Este módulo resuelve:**
- Gestión completa de unidades móviles (CRUD con imágenes)
- Asignación de unidades a proyectos con validación de disponibilidad
- Calendario dual: proyectos + mantenimientos
- Reprogramación flexible de mantenimientos cuando hay conflicto con proyectos
- Trazabilidad completa: Unidad → Proyecto → MedicalEvent → LabOrder

---

## 2. Modelo de Datos

### 2.1 Nuevos Enums

```prisma
enum MobileUnitStatus {
  ACTIVA
  MANTENIMIENTO      // Fuera de servicio por mantenimiento programado
  REPARACION         // Fuera de servicio por reparación urgente
  FUERA_SERVICIO     // Baja temporal (sin uso)
  BAJA_PERMANENTE    // Dada de baja definitivamente
}

enum MaintenanceType {
  PREVENTIVO         // Mantenimiento programado regular
  CORRECTIVO         // Reparación urgente
  VERIFICACION       // Verificación técnica (INEQUIPO, calibración)
  LIMPIEZA           // Limpieza profunda/desinfección
}

enum MaintenanceStatus {
  PROGRAMADO
  COMPLETADO
  CANCELADO
  REPROGRAMADO       // Fue movido por conflicto con proyecto
}
```

### 2.2 Nuevo Modelo: MobileUnit

```prisma
model MobileUnit {
  id              String            @id @default(uuid())
  name            String            // "Unidad Móvil 1", "Unidad Móvil 2" (único)
  plate           String?           // Placa del vehículo
  vin             String?           // Número de serie del vehículo
  year            Int?              // Año del vehículo
  capacity        Int?              // Capacidad diaria de pacientes
  economicNumber  String?           // Número económico interno (opcional)
  imageUrl        String?           // URL de imagen de la unidad (Railway Storage)
  
  // Estado operativo
  status          MobileUnitStatus  @default(ACTIVA)
  
  // Inventario de equipos (JSON flexible)
  // Ejemplo: { audiometro: true, espirometro: true, rayos_x: false, ecg: true }
  equipment       Json?
  
  // Notas operativas
  notes           String?
  
  // Timestamps
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  // --- RELACIONES ---
  
  // Proyectos asignados a esta unidad
  projects        Project[]
  
  // Eventos clínicos realizados en esta unidad
  medicalEvents   MedicalEvent[]
  
  // Órdenes de laboratorio tomadas en esta unidad
  labOrders       LabOrder[]
  
  // Historial de mantenimientos
  maintenances    MaintenanceRecord[]
  
  @@unique([name])
  @@map("mobile_units")
}
```

### 2.3 Nuevo Modelo: MaintenanceRecord

```prisma
model MaintenanceRecord {
  id              String            @id @default(uuid())
  
  // Unidad asociada
  mobileUnitId    String
  
  // Tipo y estado
  type            MaintenanceType
  status          MaintenanceStatus @default(PROGRAMADO)
  
  // Fechas
  scheduledDate   DateTime          // Fecha original programada
  completedDate   DateTime?         // Fecha real de completación
  rescheduledTo   DateTime?         // Nueva fecha si fue reprogramado
  
  // Detalles
  description     String            // Descripción del trabajo
  technician      String?           // Técnico que realizó el mantenimiento
  cost            Decimal?          // Costo del mantenimiento
  nextDueDate     DateTime?         // Próximo mantenimiento sugerido
  
  // Evidencia (fotos, documentos)
  attachments     Json?             // Array de URLs: [{url, type, uploadedAt}]
  
  // Trazabilidad
  createdBy       String            // userId
  completedBy     String?           // userId
  
  // Timestamps
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  
  // --- RELACIONES ---
  mobileUnit      MobileUnit        @relation(fields: [mobileUnitId], references: [id], onDelete: Cascade)
  createdByUser   User              @relation("MaintenanceCreator", fields: [createdBy], references: [id])
  
  @@map("maintenance_records")
}
```

### 2.4 Modificaciones a Modelos Existentes

**Project:**
```prisma
model Project {
  // ... campos existentes ...
  
  // Nueva relación con MobileUnit
  mobileUnitId    String?
  mobileUnit      MobileUnit?       @relation(fields: [mobileUnitId], references: [id])
}
```

**MedicalEvent:**
```prisma
model MedicalEvent {
  // ... campos existentes ...
  
  // Nueva relación con MobileUnit (trazabilidad de dónde se realizó)
  mobileUnitId    String?
  mobileUnit      MobileUnit?       @relation(fields: [mobileUnitId], references: [id])
}
```

**LabOrder:**
```prisma
model LabOrder {
  // ... campos existentes ...
  
  // Nueva relación con MobileUnit (trazabilidad de dónde se tomó la muestra)
  mobileUnitId    String?
  mobileUnit      MobileUnit?       @relation(fields: [mobileUnitId], references: [id])
}
```

**User:**
```prisma
model User {
  // ... campos existentes ...
  
  // Mantenimientos creados por este usuario
  createdMaintenances  MaintenanceRecord[]  @relation("MaintenanceCreator")
}
```

---

## 3. Reglas de Negocio

### 3.1 Disponibilidad de Unidades

- Una unidad móvil **NO puede estar asignada a múltiples proyectos con fechas solapadas**
- Validación required al crear/editar proyecto con unidad asignada
- Si hay conflicto, sugerir 3 fechas alternativas para reprogramar mantenimiento (si aplica)

### 3.2 Mantenimiento

- Mantenimientos pueden ser **reprogramados** si hay conflicto con proyecto prioritario
- Al completar mantenimiento, auto-calcular `nextDueDate` basado en tipo:
  - PREVENTIVO: +90 días (default, editable)
  - CORRECTIVO: no aplica
  - VERIFICACION: +365 días
  - LIMPIEZA: +30 días
- Al programar mantenimiento, unidad cambia status a `MANTENIMIENTO` en esa fecha
- Al completar mantenimiento, unidad vuelve a status `ACTIVA`

### 3.3 Imágenes

- Imágenes se guardan en Railway Storage Bucket
- Ruta: `/uploads/mobile-units/{unitId}/{filename}`
- Tipos permitidos: image/jpeg, image/png
- Tamaño máximo: 5MB
- Preview antes de subir

### 3.4 Eliminación

- **Soft delete:** No implementar por ahora. Usar CASCADE restrict si hay relaciones activas
- Si unidad tiene proyectos/mantenimientos, no permitir eliminación
- Mostrar mensaje: "No se puede eliminar la unidad porque tiene proyectos o mantenimientos asociados"

### 3.5 Permisos

- **Por ahora:** Solo ADMIN puede crear/editar/eliminar unidades y mantenimientos
- **Lectura:** Todos los usuarios autenticados pueden ver unidades y calendarios

---

## 4. Contratos Técnicos

### 4.1 Server Actions — `mobile-unit.actions.ts`

**Archivo nuevo:** `frontend/src/actions/mobile-unit.actions.ts`

```typescript
// Firma de las acciones esperadas

export async function getMobileUnits(status?: MobileUnitStatus): Promise<MobileUnit[]>
// Retorna todas las unidades, opcionalmente filtradas por status
// Incluye: _count.projects, _count.maintenances

export async function getMobileUnitById(id: string): Promise<MobileUnitWithDetails>
// Retorna unidad con detalle completo: proyectos, mantenimientos, medicalEvents, labOrders

export async function createMobileUnit(data: {
  name: string
  plate?: string
  vin?: string
  year?: number
  capacity?: number
  economicNumber?: string
  status?: MobileUnitStatus
  equipment?: Json
  notes?: string
  imageUrl?: string
}): Promise<{ success: boolean; unit?: MobileUnit; error?: string }>

export async function updateMobileUnit(
  unitId: string,
  data: Partial<{
    name: string
    plate?: string
    vin?: string
    year?: number
    capacity?: number
    economicNumber?: string
    status: MobileUnitStatus
    equipment?: Json
    notes?: string
    imageUrl?: string
  }>
): Promise<{ success: boolean; error?: string }>

export async function deleteMobileUnit(unitId: string): Promise<{ success: boolean; error?: string }>
// No permitir si tiene proyectos o mantenimientos activos

export async function uploadMobileUnitImage(
  unitId: string,
  file: File
): Promise<{ success: boolean; imageUrl?: string; error?: string }>

export async function deleteMobileUnitImage(unitId: string): Promise<{ success: boolean; error?: string }>
```

### 4.2 Server Actions — `maintenance.actions.ts`

**Archivo nuevo:** `frontend/src/actions/maintenance.actions.ts`

```typescript
export async function getMaintenanceRecords(
  mobileUnitId: string,
  status?: MaintenanceStatus
): Promise<MaintenanceRecord[]>

export async function createMaintenanceRecord(data: {
  mobileUnitId: string
  type: MaintenanceType
  scheduledDate: string  // ISO string
  description: string
  technician?: string
  cost?: number
  nextDueDate?: string   // ISO string
  attachments?: Json
}): Promise<{ success: boolean; record?: MaintenanceRecord; error?: string }>

export async function updateMaintenanceRecord(
  recordId: string,
  data: Partial<{
    type: MaintenanceType
    scheduledDate: string
    description: string
    technician?: string
    cost?: number
    nextDueDate?: string
  }>
): Promise<{ success: boolean; error?: string }>

export async function reprogramMaintenance(
  recordId: string,
  newDate: string,  // ISO string
  reason?: string
): Promise<{ success: boolean; error?: string }>
// Actualiza status a REPROGRAMADO, crea nuevo registro con nueva fecha

export async function completeMaintenance(
  recordId: string,
  data: {
    completedDate: string   // ISO string
    completedBy: string     // userId
    cost: number
    attachments?: Json
    notes?: string
  }
): Promise<{ success: boolean; error?: string }>
// Actualiza status a COMPLETADO, guarda completedDate, calcula nextDueDate
```

### 4.3 Server Actions — `project.actions.ts` (extensión)

**Archivo existente:** `frontend/src/actions/project.actions.ts`

```typescript
// Extender createProject y updateProject para validar disponibilidad de unidad

export async function validateUnitAvailability(
  mobileUnitId: string,
  startDate: string,  // ISO string
  endDate: string,    // ISO string
  excludeProjectId?: string
): Promise<{ available: boolean; conflicts?: Project[] }>

export async function suggestMaintenanceDates(
  mobileUnitId: string,
  startDate: string,  // ISO string (después de endDate del proyecto)
  searchWindowDays: number,
  maxSuggestions: number
): Promise<Date[]>
```

### 4.4 Endpoints API — `backend/app/api/v1/mobile_units.py`

**Archivo nuevo:** `backend/app/api/v1/mobile_units.py`

```python
# Endpoints para gestión de unidades móviles

@router.get("/")
async def list_mobile_units(status: Optional[str] = None):
    pass

@router.get("/{unit_id}")
async def get_mobile_unit(unit_id: str):
    pass

@router.post("/")
async def create_mobile_unit(data: dict):
    pass

@router.patch("/{unit_id}")
async def update_mobile_unit(unit_id: str, data: dict):
    pass

@router.delete("/{unit_id}")
async def delete_mobile_unit(unit_id: str):
    pass

@router.post("/{unit_id}/image")
async def upload_image(unit_id: str, file: UploadFile):
    pass

@router.delete("/{unit_id}/image")
async def delete_image(unit_id: str):
    pass
```

### 4.5 Endpoints API — `backend/app/api/v1/maintenance.py`

**Archivo nuevo:** `backend/app/api/v1/maintenance.py`

```python
# Endpoints para gestión de mantenimientos

@router.get("/unit/{unit_id}")
async def list_maintenance_records(unit_id: str, status: Optional[str] = None):
    pass

@router.post("/unit/{unit_id}")
async def create_maintenance_record(unit_id: str, data: dict):
    pass

@router.patch("/{record_id}")
async def update_maintenance_record(record_id: str, data: dict):
    pass

@router.post("/{record_id}/reprogram")
async def reprogram_maintenance(record_id: str, new_date: str, reason: Optional[str] = None):
    pass

@router.post("/{record_id}/complete")
async def complete_maintenance(record_id: str, data: dict):
    pass
```

---

## 5. Vistas UI

### 5.1 Catálogo de Unidades (`/admin/mobile-units`)

- Tabla con: imagen (thumbnail), nombre, placa, status, capacidad, próximo mantenimiento
- Botón "Nueva Unidad"
- Filtros por status
- Acciones: Ver detalle, Editar, Eliminar, Ver calendario

### 5.2 Formulario de Unidad (`/admin/mobile-units/new` y `/admin/mobile-units/[id]/edit`)

- Campos: nombre (único), placa, VIN, año, capacidad, status, número económico
- Upload de imagen (drag & drop con preview)
- Equipamiento (checkboxes dinámicos: audiometro, espirometro, rayos_x, ecg, etc.)
- Notas
- Validación de unicidad de nombre

### 5.3 Detalle de Unidad (`/admin/mobile-units/[id]`)

- Imagen grande de la unidad
- Info general completa
- Equipamiento (lista)
- Próximo mantenimiento (fecha, tipo, días restantes)
- Último mantenimiento (fecha, tipo, técnico)
- Proyectos asignados (lista con fechas)
- Historial de mantenimientos (timeline)
- Botones: Editar, Eliminar, Ver calendario

### 5.4 Calendario de Proyectos (`/projects` - mejora)

- Badge de unidad móvil en cada proyecto
- Tooltip con nombre de unidad + placa
- Filtro por unidad móvil (dropdown)
- Click en badge → ir a detalle de unidad

### 5.5 Calendario de Mantenimiento (`/admin/mobile-units/[id]/maintenance`)

- Vista calendario mensual
- Mantenimientos como eventos de colores (por tipo)
- Leyenda de colores
- Botón "Programar Mantenimiento"
- Click en mantenimiento → modal de detalle
- Vista lista (tabla con filtros)

### 5.6 Módulo Unificado (`/operations/mobile-units`) — IMPL-20260804-01 + IMPL-20260804-02

A partir de esta versión, **el módulo de Unidades Móviles vive en una sola ruta** con dos pestañas (`?view=catalog|operations`, default `catalog`), replicando el patrón del módulo `/branches`:

- **📋 Catálogo** (`?view=catalog`, default): **grid de cards** de unidades vía `MobileUnitManager` (paridad visual con `BranchCard`).
  - ADMIN: header con toggle "Mostrar/Ocultar inactivas", botón `Actualizar`, botón modal `+ Nueva Unidad` (slate-900).
  - Staff no-admin: `readOnly=true` — el modal de creación no se renderiza; las cards muestran "Ver" en lugar de "Configurar".
  - Filtro por estado en card `bg-white p-4 rounded-xl border border-slate-200 shadow-sm`.
  - Empty state banner ámbar `bg-amber-50 rounded-xl border border-amber-300` con texto explicativo de permisos.
- **📊 Operación** (`?view=operations`): dashboard operativo semanal vía `MobileUnitOperationsPanel`.
  - Contadores: unidades activas, en mantenimiento, en reparación, fuera de servicio, baja permanente.
  - Próximos mantenimientos (7 días).
  - Mantenimientos vencidos.
  - Calendario semanal dual (proyectos + mantenimientos) en grid por unidad/día.
  - Alertas de conflictos (proyecto vs mantenimiento en la misma fecha/unidad).

**Tabs:** color de marca `border-purple-500 text-purple-600` (paridad con `BranchDetailTabs`). Estado persistido vía searchParam `?view=`.

**Navegación:** un único `NavItem` "Unidades Móviles" (🚑) en el bloque staff. El `NavItem` admin "Catálogo Unidades" (🚐) se eliminó porque ahora se llega desde la pestaña Catálogo en cualquier sesión. Las rutas `/admin/mobile-units/*` siguen existiendo (CRUD, detalle, mantenimiento) y son accesibles vía deep-link o desde el botón "Configurar"/"Ver" de cada card.

**Permisos:** el middleware sigue restringiendo `/admin/*` a ADMIN. La pestaña Catálogo en `/operations/mobile-units` se renderiza para todos los roles autenticados, pero `readOnly` se determina server-side con `isAdminLike(session.user.role)`. Staff no-admin que intente `/admin/mobile-units/new` directamente será **redirigido por `redirect()` server-side** a `/admin/mobile-units` (IMPL-20260804-02: ruta `/new` ya no renderiza formulario; la creación ahora es exclusivamente vía modal).

**Eliminación de unidades:** botón "Eliminar unidad" en header de `/admin/mobile-units/[id]` (paridad con `BranchDeleteGuardModal`), visible solo para ADMIN. Tras confirmar, redirige a `/admin/mobile-units`.

**Tokens visuales del módulo** (alineados con `/branches` y resto del sistema):
- Headers h2: `text-2xl font-bold text-slate-800` + subtítulo `text-sm text-slate-500`.
- Botón primario header: `bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg shadow`.
- Botón submit form: `bg-purple-600 hover:bg-purple-700 text-white rounded shadow`.
- Inputs: `w-full border border-slate-300 p-2 rounded text-sm focus:ring-purple-500`.
- Labels: `text-xs text-slate-500 mb-1 block`.
- Cards: `bg-white rounded-xl shadow-sm border border-slate-200 hover:shadow-md`.
- Status badge: `text-[10px] uppercase font-bold rounded-full` (paridad `BranchStatusBadge`).
- Modal backdrop: `bg-black/50 backdrop-blur-sm`; content: `bg-white p-6 rounded-xl shadow-2xl`.

ADRs asociados: `context/decisions/ADR-20260804-01-UNIFICAR-UI-UNIDADES-MOVILES.md`, `context/decisions/ADR-20260804-02-ALINEAR-ESTILO-MOBILE-UNITS.md`.

---

## 6. Migración de Datos

### 6.1 Script de Migración

**Archivo:** `frontend/prisma/migrations/20260711000000_add_mobile_units/migration.sql`

```sql
-- Crear enums
CREATE TYPE "MobileUnitStatus" AS ENUM ('ACTIVA', 'MANTENIMIENTO', 'REPARACION', 'FUERA_SERVICIO', 'BAJA_PERMANENTE');
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVO', 'CORRECTIVO', 'VERIFICACION', 'LIMPIEZA');
CREATE TYPE "MaintenanceStatus" AS ENUM ('PROGRAMADO', 'COMPLETADO', 'CANCELADO', 'REPROGRAMADO');

-- Crear tabla mobile_units
CREATE TABLE "mobile_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plate" TEXT,
    "vin" TEXT,
    "year" INTEGER,
    "capacity" INTEGER,
    "economicNumber" TEXT,
    "imageUrl" TEXT,
    "status" "MobileUnitStatus" NOT NULL DEFAULT 'ACTIVA',
    "equipment" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mobile_units_name_key" ON "mobile_units"("name");

-- Crear tabla maintenance_records
CREATE TABLE "maintenance_records" (
    "id" TEXT NOT NULL,
    "mobileUnitId" TEXT NOT NULL,
    "type" "MaintenanceType" NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'PROGRAMADO',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "rescheduledTo" TIMESTAMP(3),
    "description" TEXT NOT NULL,
    "technician" TEXT,
    "cost" DECIMAL(65,30),
    "nextDueDate" TIMESTAMP(3),
    "attachments" JSONB,
    "createdBy" TEXT NOT NULL,
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

-- Agregar columna mobileUnitId a projects
ALTER TABLE "projects" ADD COLUMN "mobileUnitId" TEXT;

-- Agregar columna mobileUnitId a medical_events
ALTER TABLE "medical_events" ADD COLUMN "mobileUnitId" TEXT;

-- Agregar columna mobileUnitId a lab_orders
ALTER TABLE "lab_orders" ADD COLUMN "mobileUnitId" TEXT;

-- Agregar relaciones
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_mobileUnitId_fkey" 
    FOREIGN KEY ("mobileUnitId") REFERENCES "mobile_units"("id") ON DELETE CASCADE;

ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_createdBy_fkey" 
    FOREIGN KEY ("createdBy") REFERENCES "users"("id");

ALTER TABLE "projects" ADD CONSTRAINT "projects_mobileUnitId_fkey" 
    FOREIGN KEY ("mobileUnitId") REFERENCES "mobile_units"("id") ON DELETE SET NULL;

ALTER TABLE "medical_events" ADD CONSTRAINT "medical_events_mobileUnitId_fkey" 
    FOREIGN KEY ("mobileUnitId") REFERENCES "mobile_units"("id") ON DELETE SET NULL;

ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_mobileUnitId_fkey" 
    FOREIGN KEY ("mobileUnitId") REFERENCES "mobile_units"("id") ON DELETE SET NULL;
```

### 6.2 Seed de Unidades Iniciales

**Archivo:** `frontend/prisma/seed-mobile-units.ts`

```typescript
const units = [
  { name: 'Unidad Móvil 1', plate: 'ABC-123', capacity: 50 },
  { name: 'Unidad Móvil 2', plate: 'DEF-456', capacity: 50 },
  { name: 'Unidad Móvil 3', plate: 'GHI-789', capacity: 40 },
  { name: 'Unidad Móvil 4', plate: 'JKL-012', capacity: 40 },
  { name: 'Unidad Móvil 5', plate: 'MNO-345', capacity: 30 },
  { name: 'Unidad Móvil 6', plate: 'PQR-678', capacity: 30 },
];

for (const unit of units) {
  await prisma.mobileUnit.upsert({
    where: { name: unit.name },
    create: unit,
    update: {}
  });
}
```

---

## 7. Estimación de Esfuerzo

| Fase | Tareas | Tiempo |
|------|--------|--------|
| **1. Schema + Migración** | Prisma schema, migración SQL, seed de 6 unidades | 3-4h |
| **2. Backend CRUD** | Endpoints FastAPI para unidades y mantenimientos, validaciones | 4-5h |
| **3. Server Actions** | Actions para frontend (CRUD, validaciones, reprogramación) | 3-4h |
| **4. UI Catálogo** | Página `/admin/mobile-units`, modales CRUD, filtros, upload de imagen | 4-5h |
| **5. UI Detalle Unidad** | Vista de detalle con historial, equipamiento, próximos mantenimientos | 3-4h |
| **6. UI Proyectos** | Integración selector de unidad en proyecto, validación de conflictos, modal de reprogramación | 4-5h |
| **7. Calendario Proyectos** | Mejora de calendario existente con badges de unidad | 2-3h |
| **8. Calendario Mantenimiento** | Nuevo calendario de mantenimientos por unidad, vistas calendario/lista | 5-6h |
| **9. Dashboard Operativo** | Dashboard con métricas, alertas, calendario dual | 4-5h |
| **10. Tests Backend** | pytest para endpoints y server actions | 4-5h |
| **11. Tests Frontend** | vitest para componentes y actions | 3-4h |
| **12. Tests E2E** | Playwright para flujo completo | 4-5h |
| **Total** | | **44-55h** |

---

## 8. Criterios de Aceptación

- [ ] Se pueden crear, editar y eliminar unidades móviles con imágenes
- [ ] Se pueden asignar unidades a proyectos con validación de disponibilidad
- [ ] Se pueden programar, reprogramar y completar mantenimientos
- [ ] El calendario muestra proyectos y mantenimientos de forma clara
- [ ] Los conflictos proyecto vs mantenimiento se detectan y se ofrecen alternativas
- [ ] El dashboard muestra métricas operativas en tiempo real
- [ ] Todos los tests (pytest, vitest, Playwright) pasan
- [ ] GEMINI aprueba la implementación con 0 bloqueadores

---

## 9. Handoff a SOFIA

**Archivo:** `context/interconsultas/HANDOFF_ARCH-20260711-01_SOFIA_UNIDADES-MOVILES.md`

**Instrucciones para SOFIA:**

1. **Implementar schema Prisma** con todos los modelos y relaciones definidos
2. **Crear migración SQL** y aplicar a Railway
3. **Ejecutar seed** de 6 unidades iniciales
4. **Implementar endpoints FastAPI** para CRUD de unidades y mantenimientos
5. **Implementar server actions** para frontend
6. **Crear vistas UI** según especificación (catálogo, detalle, calendarios, dashboard)
7. **Implementar upload de imágenes** a Railway Storage Bucket
8. **Implementar validaciones** de disponibilidad y reprogramación
9. **Ejecutar tests** (pytest, vitest)
10. **Solicitar revisión a GEMINI** (`subagent_type='gemini'`) como segunda mano de validación
11. **No commitear** sin OK explícito de INTEGRA

**Validaciones obligatorias antes de cerrar:**
1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm lint` (si existe script)

**Al cerrar, sugerir que INTEGRA invoque a GEMINI como segunda mano.**

---

## 10. Pruebas E2E con Playwright

**Escenarios a probar:**

1. **Crear unidad móvil con imagen**
   - Ir a `/admin/mobile-units/new`
   - Llenar formulario con imagen
   - Verificar que se crea en DB

2. **Asignar unidad a proyecto**
   - Ir a `/projects/new`
   - Seleccionar unidad disponible
   - Verificar que se asigna correctamente

3. **Detectar conflicto proyecto vs mantenimiento**
   - Programar mantenimiento para unidad en fecha X
   - Crear proyecto con misma unidad en fecha X
   - Verificar que se detecta conflicto y se ofrecen alternativas

4. **Reprogramar mantenimiento**
   - Seleccionar fecha alternativa
   - Verificar que mantenimiento se reprograma

5. **Completar mantenimiento**
   - Ir a mantenimiento programado
   - Completar con fotos/evidencia
   - Verificar que unidad vuelve a status ACTIVA

6. **Eliminar unidad con validación**
   - Intentar eliminar unidad con proyectos
   - Verificar que no permite
   - Eliminar unidad sin relaciones
   - Verificar que se elimina correctamente

---

**FIN DE LA SPEC**
