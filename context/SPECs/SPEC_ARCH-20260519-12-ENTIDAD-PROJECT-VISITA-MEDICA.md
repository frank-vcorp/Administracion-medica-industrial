# SPEC: Entidad Project — Proyecto de Visita Médica

**ID:** ARCH-20260519-12  
**Fecha:** 2026-05-19  
**Estado:** APROBADO CON AJUSTES — Dictamen FIX-20260519-06 aplicado (2026-05-19)  
**Agente Autor:** INTEGRA  
**Prioridad:** Alta — prerequisito de SPEC-11 (Alta Masiva)  
**Puntaje INTEGRA:** (3×3) + (3×2) - (2×0.5) = **14**  
*(Valor=3: habilita operaciones de unidad móvil y campañas masivas | Urgencia=3: bloquea SPEC-11 | Complejidad=2: nueva entidad + migración + CRUD)*

---

## 1. Contexto y Problema

AMI opera campañas de visita médica — una empresa contrata a AMI para atender a sus trabajadores en bloque, ya sea en sus instalaciones (unidad móvil) o en sucursal AMI. Estas campañas tienen empresa, rango de fechas y una unidad/sucursal asignada.

Hoy este calendario existe **fuera del sistema** en Google Calendar. El equipo lo gestiona manualmente y no hay trazabilidad interna de qué trabajadores pertenecen a qué campaña, ni visibilidad de la carga por unidad.

**La entidad `Project` es el eslabón que conecta:**
- La empresa (quién contrató la visita)
- El rango de fechas (cuándo ocurre)
- La unidad asignada (quién atiende)
- Los trabajadores pre-registrados (quiénes van a ser atendidos)

---

## 2. Modelo de Datos

### 2.1 Nuevo enum `ProjectStatus`

```prisma
enum ProjectStatus {
  DRAFT        // En planeación, no confirmado
  CONFIRMED    // Confirmado con la empresa
  IN_PROGRESS  // Fechas activas — la visita está ocurriendo
  COMPLETED    // Visita finalizada
  CANCELLED    // Cancelado
}
```

### 2.2 Nuevo modelo `Project`

```prisma
model Project {
  id          String        @id @default(uuid())
  name        String        // Ej: "AIRBUS Mayo 2026" — libre, descriptivo
  companyId   String
  branchId    String?       // Sucursal AMI de referencia (null si es planta del cliente)
  unitRef     String?       // Texto libre: "Unidad Móvil 3"
                            // Provisional hasta que exista la entidad Equipment (Sprint 5)
                            // Cuando exista: migrar a FK equipmentId
  startDate   DateTime
  endDate     DateTime
  status      ProjectStatus @default(DRAFT)
  notes       String?       // Notas del vendedor / contrato
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  company     Company       @relation(fields: [companyId], references: [id])
  branch      Branch?       @relation(fields: [branchId], references: [id])
  workers     ProjectWorker[]

  @@map("projects")
}
```

### 2.3 Nuevo modelo `ProjectWorker` (tabla de unión)

```prisma
model ProjectWorker {
  projectId   String
  workerId    String
  addedAt     DateTime  @default(now())
  addedBy     String?   // userId del admin que hizo la importación (trazabilidad)

  project     Project   @relation(fields: [projectId], references: [id])
  worker      Worker    @relation(fields: [workerId], references: [id])

  @@id([projectId, workerId])
  @@map("project_workers")
}
```

### 2.4 Modificaciones a modelos existentes

**`Company`** — agregar relación inversa:
```prisma
projects  Project[]
```

**`Worker`** — agregar relación inversa:
```prisma
projectWorkers  ProjectWorker[]
```

**`Branch`** — agregar relación inversa (requerida por Prisma para la FK `branchId` en `Project`):
```prisma
projects  Project[]
```

---

## 3. Reglas de Negocio

- Un proyecto pertenece a **una sola empresa**.
- Un trabajador puede estar en **múltiples proyectos** a lo largo del tiempo (visitas anuales, por ejemplo).
- Un proyecto puede tener **múltiples trabajadores**.
- `startDate` debe ser ≤ `endDate`. Si son iguales, la visita es de un solo día.
- No hay restricción de solapamiento de fechas entre proyectos de la misma empresa (una empresa grande puede tener dos visitas simultáneas en distintas plantas).
- `unitRef` es texto libre hasta que Sprint 5 provea la entidad `Equipment`. No se valida contra nada.
- El campo `branchId` es opcional: si la unidad va a la planta del cliente, puede no haber sucursal AMI involucrada.

---

## 4. Contratos Técnicos

### 4.1 Server Actions — `project.actions.ts`

**Archivo nuevo:** `frontend/src/actions/project.actions.ts`

```typescript
// Firma de las acciones esperadas

export async function getProjects(): Promise<ProjectWithCompany[]>
// Retorna todos los proyectos ordenados por startDate desc
// Incluye: company.name, _count.workers

export async function getProjectsByCompany(companyId: string): Promise<Project[]>
// Para el dropdown en BulkWorkerImportModal

export async function createProject(data: {
  name: string
  companyId: string
  startDate: string   // ISO string
  endDate: string
  branchId?: string
  unitRef?: string
  notes?: string
}): Promise<{ success: boolean; project?: Project; error?: string }>

export async function updateProject(
  projectId: string,
  data: Partial<{
    name: string; startDate: string; endDate: string;
    branchId: string; unitRef: string; notes: string;
  }>
): Promise<{ success: boolean; error?: string }>
// Actualiza los campos editables del proyecto. NO permite cambiar companyId.

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus
): Promise<{ success: boolean; error?: string }>
```

> **Autorización:** Todas las actions verifican sesión activa con `getServerSession()` antes de cualquier query. En esta fase son accesibles solo para roles `ADMIN` y `RECEPTIONIST`. Cuando el portal B2B (Sprint 7) reutilice estas actions para `COMPANY_CLIENT`, deberá filtrarse por `user.companyId === project.companyId`.

**Validación Zod** para `createProject`:
```typescript
const CreateProjectSchema = z.object({
  name:      z.string().min(1).max(200),
  companyId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate:   z.string().datetime(),
  branchId:  z.string().uuid().optional(),
  unitRef:   z.string().max(100).optional(),
  notes:     z.string().max(1000).optional(),
}).refine(d => new Date(d.startDate) <= new Date(d.endDate), {
  message: 'La fecha de inicio debe ser anterior o igual a la fecha de fin'
})
```

### 4.2 Página de gestión — `projects/page.tsx`

**Archivo nuevo:** `frontend/src/app/projects/page.tsx`

Vista de lista (no calendario en esta fase). Muestra:
- Nombre del proyecto
- Empresa
- Rango de fechas
- Unidad (unitRef o branchId)
- Status con badge de color
- Conteo de trabajadores pre-registrados
- Botón "Nuevo Proyecto"

> **Nota:** La vista calendario (tipo Google Calendar de la captura) se define en Sprint 7 / SPEC futura. Esta fase solo requiere lista funcional para poder seleccionar proyectos desde el modal de carga masiva.

### 4.3 Componente `ProjectFormModal.tsx`

**Archivo nuevo:** `frontend/src/components/ProjectFormModal.tsx`

Formulario con los campos del modelo. Mínimo viable:
- Nombre (texto)
- Empresa (dropdown)
- Fecha inicio / Fecha fin (date pickers)
- Unidad (texto libre — placeholder: "Ej: Unidad Móvil 3")
- Sucursal AMI (dropdown opcional)
- Notas (textarea opcional)

---

## 5. Archivos a Crear / Modificar

| Archivo | Operación | Notas |
|---------|-----------|-------|
| `frontend/prisma/schema.prisma` | Modificar | Agregar `Project`, `ProjectWorker`, `ProjectStatus`; actualizar `Company`, `Worker` y `Branch` |
| `frontend/src/actions/project.actions.ts` | Crear | Server actions de CRUD |
| `frontend/src/app/projects/page.tsx` | Crear | Vista lista de proyectos |
| `frontend/src/components/ProjectFormModal.tsx` | Crear | Modal de creación/edición |

**Total: 4 archivos** — dentro del límite.

---

## 6. Criterios de Aceptación

### Gate 1 — Compilación
- [ ] `pnpm build` sin errores TypeScript
- [ ] `prisma migrate dev` aplica sin conflictos

### Gate 2 — Testing
- [ ] Crear proyecto para empresa existente: proyecto creado con status DRAFT
- [ ] Intentar crear proyecto con `startDate > endDate`: error de validación claro
- [ ] Listar proyectos: aparecen en `/projects` con empresa, fechas y conteo de trabajadores
- [ ] Cambiar status de DRAFT a CONFIRMED: badge actualizado sin recargar
- [ ] Crear proyecto sin sucursal AMI (unidad móvil a planta cliente): funciona con `branchId = null`

### Gate 3 — Revisión
- [ ] `ProjectWorker` usa clave compuesta `[projectId, workerId]` — no permite duplicados
- [ ] `unitRef` acepta `null` sin error
- [ ] El campo `addedBy` en `ProjectWorker` registra el usuario que hizo la importación

### Gate 4 — Documentación
- [ ] SPEC-11 actualizada con referencia a esta entidad
- [ ] Migración de Prisma generada y documentada

---

## 7. Notas de Arquitectura

### Sobre `unitRef` como texto libre
Es una deuda técnica intencionada. Cuando Sprint 5 construya la entidad `Equipment` (inventario de unidades móviles), la migración será:
1. Agregar columna `equipmentId String?` en `Project`
2. Script de migración de datos: parsear `unitRef` existentes contra el catálogo de equipos
3. Deprecar `unitRef` en una SPEC posterior

Esta estrategia es preferible a no construir `Project` hasta que existan los equipos — eso bloquearía SPEC-11 indefinidamente.

### Fuera de alcance (esta SPEC)
- Vista calendario visual (Sprint 7)
- Bloqueo automático de capacidad de unidad por proyecto (requiere `Equipment`)
- Notificaciones a la empresa cuando el proyecto pasa a IN_PROGRESS
- Reportes de cobertura por proyecto (% de trabajadores pre-registrados vs atendidos)

---

## 8. Dependencias

| Depende de | Estado |
|-----------|--------|
| `Company` (ya existe) | ✅ Disponible |
| `Branch` (ya existe) | ✅ Disponible |
| `Worker` (ya existe) | ✅ Disponible |
| `Equipment` (Sprint 5) | ⏳ Pendiente — referenciado via `unitRef` texto libre |

---

## 9. Consumidores de esta SPEC

| SPEC | Cómo consume `Project` |
|------|------------------------|
| SPEC-11 (Alta Masiva) | El modal de carga masiva selecciona un `Project`; workers importados se ligan via `ProjectWorker` |
| Sprint 7 (Portal B2B) | Las empresas ven sus proyectos y su estado desde el portal |
| Sprint 4 (Agenda Real) | Los proyectos definen bloqueos de capacidad en el calendario de citas |

---

*Generado por INTEGRA — ARCH-20260519-12 — 2026-05-19*
