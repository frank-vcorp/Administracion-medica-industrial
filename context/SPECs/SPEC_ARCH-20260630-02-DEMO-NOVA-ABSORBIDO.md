# SPEC: Demo Funcional — Absorción NOVA → AMI (Slice A)

**ID:** `SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO`
**Origen:** `ADR-20260630-02-ABSORCION-NOVA-ESTRATEGIA.md` + `context/audits/nova-20260630/AUDIT-NOVA-COMPLETO.md`
**Tipo:** SPEC de implementación (demo funcional)
**Estado:** [~] Planificado
**Fase:** I (primera entrega de demo, base para slices B-I)

---

## 1. OBJETIVO

Construir un **demo navegable** dentro de AMI que muestre el camino end-to-end del LIS absorbido:

1. **Catálogos** configurables (mínimo slice A).
2. **Admisión** de paciente con estudios.
3. **Captura de resultados**.
4. **Impresión** de etiqueta + resultado.

El demo debe ser **funcional** (no estático): seed con datos de muestra, capturas reales sobre DB de demo, navegación completa entre módulos. Al cerrar el Slice A, el operador puede: catalogar unidades, ver lista idéntica a NOVA, y editar/agregar items.

> **Restricción clave:** AMI productivo NO se toca. El demo corre en DB efímera / seed.

---

## 2. ALCANCE DEL SLICE A (este entregable)

### 2.1 Dentro del alcance (MUST)
- [ ] Migración Prisma con todas las tablas LIS nuevas (definidas en §3).
- [ ] Catálogo de **Unidades** funcional en `/admin/lab/catalogs?mod=unidades`.
- [ ] Catálogo de **Muestras** funcional en `/admin/lab/catalogs?mod=muestras`.
- [ ] Catálogo de **Recipientes** funcional en `/admin/lab/catalogs?mod=recipientes`.
- [ ] Catálogo de **Métodos** funcional en `/admin/lab/catalogs?mod=metodologias`.
- [ ] Catálogo de **Lugares de proceso** funcional en `/admin/lab/catalogs?mod=lugares_proceso`.
- [ ] Catálogo de **Clasificaciones** funcional en `/admin/lab/catalogs?mod=clasificaciones`.
- [ ] Catálogo de **Indicaciones** funcional en `/admin/lab/catalogs?mod=indicaciones`.
- [ ] Catálogo de **Departamentos** funcional en `/admin/lab/catalogs?mod=departamentos`.
- [ ] Endpoint FastAPI único `/api/v1/lab/catalogs?mod=<X>` (server-side DataTables).
- [ ] Server action `lab_catalog_action` con validación Zod.
- [ ] Sidebar AMI con nueva sección **"🧪 Módulo de Laboratorios"** (placeholder en este slice, relleno en B-I).
- [ ] Seed con 10 unidades, 5 muestras, 5 recipientes, 5 métodos, 5 lugares, 5 clasificaciones, 5 indicaciones, 3 departamentos.
- [ ] Tests: vitest (frontend) + pytest (backend) ≥ 80% coverage en código nuevo.
- [ ] Validación: `pnpm typecheck`, `pnpm test`, `pnpm lint` en verde.
- [ ] GEMINI auditoría previa al commit.
- [ ] Demo verificable: entrar a `/admin/lab/catalogs?mod=unidades`, ver 10 unidades, editar una, agregar una nueva.

### 2.2 Fuera del alcance (futuros slices)
- ❌ Admisión (`/lab/reception`) → Slice B.
- ❌ Captura de resultados (`/lab/results`) → Slice C.
- ❌ Trazabilidad + bitácora → Slice D.
- ❌ Catálogo especializado de Estudios/Elementos/Perfiles → Slice E.
- ❌ Reportes imprimibles (etiquetas, resultados, recibos) → Slice F.
- ❌ Caja / cortesías / corte de caja → Slice G.
- ❌ Migración de datos NOVA → Slice H (catálogos persistentes = TODO; operativos = solo último mes desde `2026-05-31`).
- ❌ Cutover y deprecación → Slice I.

---

## 3. ESQUEMA DE DATOS (Prisma)

> **Las tablas marcadas NUEVAS se crean en este slice.** Las marcadas EXTEND se modifican mínimamente (sin breaking).

```prisma
// ===== EXTENDIDO (no breaking) =====
model Company {
  // ... campos existentes ...
  novaConvenioId String?     // ← NUEVO slice A (mapeo NOVA)
  discountPolicyId String?   // ← NUEVO slice A (FK a DiscountPolicy, futuro)
}

model User {
  // ... campos existentes ...
  novaMedicoClave String? @unique  // ← NUEVO slice A (mapeo a médicos NOVA)
  labSignature LabSignature?       // ← NUEVO slice A
  labRole LabRole?                 // ← NUEVO slice A (enum)
}

enum LabRole {
  LAB_RECEPTIONIST  // Recepción / admisión
  LAB_ANALYST       // Captura de resultados
  LAB_VALIDATOR     // Autoriza / valida
  LAB_ADMIN         // Administra catálogos
}

// ===== NUEVO =====

model LabUnit {
  id        String   @id @default(cuid())
  symbol    String   @unique
  name      String
  system    LabUnitSystem
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdBy String?
  active    Boolean  @default(true)

  analytes  LabAnalyte[]

  @@index([symbol])
}

enum LabUnitSystem {
  SI
  CONVENTIONAL
}

model LabSample {
  id                  String   @id @default(cuid())
  code                String   @unique  // ej "SANGRE", "ORINA"
  name                String
  defaultContainerId  String?
  defaultContainer    LabContainer? @relation(fields: [defaultContainerId], references: [id])
  preservation        String?        // "Refrigerada 4°C", "Ambiente", etc.
  minVolume           String?        // "5 mL"
  active              Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  tests               MedicalTest[]  // Estudios que usan esta muestra

  @@index([code])
}

model LabContainer {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String   // "Tubo tapa lila", "Frasco estéril", etc.
  color     String?
  cap       String?  // Tipo de tapa
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  samples  LabSample[]
  @@index([code])
}

model LabMethod {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String   // "Química seca", "ELISA", "Hematimetría", etc.
  principle String?  // Descripción técnica
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  tests    MedicalTest[]
  @@index([code])
}

model LabProcessArea {
  id           String   @id @default(cuid())
  code         String   @unique
  name         String   // "Hematología", "Química Clínica", "Microbiología"
  departmentId String?
  department   LabDepartment? @relation(fields: [departmentId], references: [id])
  active       Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([code])
}

model LabDepartment {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  areas     LabProcessArea[]
  @@index([code])
}

model LabClassification {
  id        String   @id @default(cuid())
  code      String   @unique
  name      String   // "Normal", "Patrón A", etc.
  color     String?  // Hex
  sortOrder Int      @default(0)
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([code])
}

model LabIndication {
  id        String   @id @default(cuid())
  code      String   @unique
  text      String   // "Ayuno de 8 horas", "Recolectar primera orina de la mañana"
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([code])
}

model LabSignature {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  imageKey  String   // Ruta en bucket S3
  active    Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// MedicalTest EXTENDIDO (cambios mínimos no-breaking)
model MedicalTest {
  // ... campos existentes ...
  novaClave           String? @unique              // ← NUEVO slice A
  labMethodId         String?                       // ← NUEVO slice A
  labMethod           LabMethod? @relation(fields: [labMethodId], references: [id])
  labSampleId         String?                       // ← NUEVO slice A
  labSample           LabSample? @relation(fields: [labSampleId], references: [id])
  labProcessAreaId    String?                       // ← NUEVO slice A
  daysToResult        Int?                          // ← NUEVO slice A
  isProfile           Boolean  @default(false)      // ← NUEVO slice A
  isPackage           Boolean  @default(false)      // ← NUEVO slice A
}
```

> Tablas para slices futuros (referencia, no se crean en A): `LabAnalyte`, `LabReferenceRange`, `LabOrder`, `LabOrderItem`, `LabResult`, `LabResultAudit`, `LabTraceEvent`, `LabCashMovement`, `DiscountPolicy`, `LabPriceList`, `LabPriceListItem`, `LabFormula`, `LabPredefinedResponse`, `Courtesy`, `LabBacteria`, `LabAntibiogram`.

---

## 4. ENDPOINTS Y SERVER ACTIONS

### 4.1 Backend FastAPI

**`GET /api/v1/lab/catalogs?mod=<X>`** — server-side DataTables compatible
- Query params: `mod` (required), `draw`, `start`, `length`, `search[value]`, `order[0][column]`, `order[0][dir]`
- Response: JSON `{draw, recordsTotal, recordsFiltered, data: [...]}`
- Soporta los 8 mods del slice A.
- Auth requerida: rol `LAB_ADMIN` o `ADMIN` AMI.
- Paginación: max `length=100`.

**`POST /api/v1/lab/catalogs?mod=<X>`** — crear item
- Body validado con Zod por mod.
- Devuelve `{id, ok: true}` o `400`.

**`PATCH /api/v1/lab/catalogs/<mod>/<id>`** — actualizar
**`DELETE /api/v1/lab/catalogs/<mod>/<id>`** — soft delete (active=false)

### 4.2 Frontend Next.js

**Ruta nueva:** `/admin/lab/catalogs/page.tsx`
- Recibe `?mod=unidades|muestras|recipientes|metodologias|lugares_proceso|clasificaciones|indicaciones|departamentos` por query param.
- Server-side render inicial + client-side paginación/búsqueda.
- Botón "Nueva" abre modal con form.
- Fila "Editar" abre modal prellenado.
- Botón "Eliminar" con confirmación.

**Server actions:**
- `lab_catalog_create_action({mod, values}) → {id}`
- `lab_catalog_update_action({mod, id, values}) → {ok}`
- `lab_catalog_delete_action({mod, id}) → {ok}`
- `lab_catalog_list_action({mod, draw, start, length, search, order}) → DataTablesResponse`
- `lab_catalog_get_action({mod, id}) → item` (para edición)

### 4.3 Sidebar AMI
Insertar nueva sección **"🧪 Módulo de Laboratorios"** en `/admin` (junto a Bitácora de Auditoría), placeholder en este slice con link a `/admin/lab/catalogs?mod=unidades`. Items reales se agregan en slices B-I.

---

## 5. ARCHIVOS A TOCAR / CREAR

### 5.1 Prisma
- `frontend/prisma/schema.prisma` — agregar `LabUnit`, `LabSample`, `LabContainer`, `LabMethod`, `LabProcessArea`, `LabDepartment`, `LabClassification`, `LabIndication`, `LabSignature`; extender `Company`, `User`, `MedicalTest` con campos nuevos.
- `frontend/prisma/migrations/20260701000000_add_lab_catalogs/migration.sql` — generada por `prisma migrate dev`.

### 5.2 Backend FastAPI
- `backend/app/api/v1/lab/catalogs.py` — endpoints REST + validaciones Zod.
- `backend/app/schemas/lab_catalogs.py` — schemas Pydantic.
- `backend/app/services/lab_catalog_service.py` — lógica de catálogo (CRUD + paginación).
- `backend/app/main.py` — registrar router `lab_catalogs`.
- `backend/tests/test_lab_catalogs.py` — tests pytest del nuevo módulo.

### 5.3 Frontend Next.js
- `frontend/src/app/admin/lab/catalogs/page.tsx` — listado + paginación.
- `frontend/src/app/admin/lab/catalogs/[mod]/page.tsx` (opcional) — variante por mod.
- `frontend/src/app/admin/lab/catalogs/_components/CatalogTable.tsx` — DataTables client.
- `frontend/src/app/admin/lab/catalogs/_components/CatalogForm.tsx` — modal crear/editar.
- `frontend/src/app/admin/lab/catalogs/_lib/catalog-defs.ts` — definición de cada mod (columnas, validaciones).
- `frontend/src/actions/lab-catalog.actions.ts` — server actions.
- `frontend/src/lib/validations/lab-catalog.ts` — schemas Zod client-side.
- `frontend/src/components/admin/Sidebar.tsx` — agregar item "Módulo de Laboratorios".

### 5.4 Tests
- `frontend/src/app/admin/lab/catalogs/_components/CatalogTable.test.tsx`
- `frontend/src/actions/lab-catalog.actions.test.ts`
- `backend/tests/test_lab_catalogs.py` (≥ 12 casos).

### 5.5 Seed
- `frontend/prisma/seed.ts` — agregar función `seedLabCatalogs()` (idempotente).
- Ejecutar `pnpm db:seed` antes del demo.

### 5.6 Documentación
- `context/interconsultas/HANDOFF_ARCH-20260630-02_SOFIA_DEMO-NOVA-SLICE-A.md` (creado por INTEGRA antes de delegar).
- `context/checkpoints/CHK_ARCH-20260630-02-SLICE-A-CATALOGOS.md` (cerrado por INTEGRA al aprobar merge).

---

## 6. UX / UI

### 6.1 Sidebar (en este slice solo placeholder)

```
ADMINISTRACIÓN
  🏥 Sucursales AMI
  👨‍⚕️ Personal AMI
  🧪 Catálogo de Pruebas
  🩻 Perfiles Médicos
  📋 Bitácora de Auditoría
  🧪 Módulo de Laboratorios ← NUEVO (placeholder, lleva a /admin/lab/catalogs?mod=unidades)
```

### 6.2 Vista `/admin/lab/catalogs`

Header con:
- `<select>` cambio rápido de mod (Unidades / Muestras / Recipientes / ...)
- Botón `+ Nueva` (abre modal)
- Toggle `Solo activos`

Tabla con columnas:
| Catálogo | Columnas |
|---|---|
| Unidades | Símbolo · Nombre · Sistema (SI/Conv) · Estado · Acciones |
| Muestras | Código · Nombre · Recipiente default · Preservación · Vol. mín · Estado · Acciones |
| Recipientes | Código · Nombre · Color · Tapa · Estado · Acciones |
| Metodologías | Código · Nombre · Principio · Estado · Acciones |
| Lugares de proceso | Código · Nombre · Departamento · Estado · Acciones |
| Clasificaciones | Código · Nombre · Color · Orden · Estado · Acciones |
| Indicaciones | Código · Indicación · Estado · Acciones |
| Departamentos | Código · Nombre · Estado · Acciones |

Modal crear/editar:
- Fields según mod.
- Validación inline.
- Cancelar / Guardar.

### 6.3 Modo demo / protegido
- Botón "Demo" en el sidebar (placeholder) para distinguir el entorno.
- Banner amarillo en todo el módulo lab: "Módulo LAB — Slice A — Solo catálogos demo".

---

## 7. SEGURIDAD Y ROLES

- Solo roles AMI `ADMIN` o `LAB_ADMIN` (futuro) pueden crear/editar/eliminar.
- El endpoint devuelve 403 si el rol no aplica.
- Audit log AMI existente captura `action: "CREATE_LAB_UNIT"`, `entity: "LabUnit"`, `userId`, `before`, `after`.

---

## 8. RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|---|---|
| Migración Prisma rompe producción | Generar `--create-only`, validar en staging, aplicar con script Railway verificado (patrón ya usado en IMPL-20260624-04) |
| DataTables server-side CORS | Mismo dominio (Next.js proxy `/api` → FastAPI interno) |
| Performance con 1000+ items por catálogo | Índices por `code`, `name`, `active`. Paginación a 25/50/100. Sin N+1. |
| Roles futuros (LAB_RECEPTIONIST, LAB_ANALYST, LAB_VALIDATOR) aún no implementados | Slice A solo usa `ADMIN`. Otros roles se agregan en slices B/C. |
| Conflicto con módulo Catálogo de Pruebas existente (`/admin/services`) | Renombrar sidebar item a "Catálogo de Pruebas (AMI)" y "Catálogos LAB (NOVA)" para distinguir |

---

## 9. CRITERIOS DE ACEPTACIÓN (DoD)

### 9.1 Funcional
- [ ] Login en AMI con `ADMIN`.
- [ ] Navegar a `/admin/lab/catalogs?mod=unidades` → ver 10 unidades seeded.
- [ ] Buscar "mg" → tabla filtra a 2 unidades.
- [ ] Click `+ Nueva` → modal aparece → llenar `mg/dL` `Miligramos por decilitro` `CONVENTIONAL` → guardar → aparece en lista.
- [ ] Click fila `Editar` → modal prellenado → cambiar nombre → guardar → cambio reflejado.
- [ ] Click `Eliminar` → confirmar → fila desaparece.
- [ ] Cambiar mod a `muestras` → ver 5 muestras. Repetir flujo CRUD.
- [ ] Repetir para los 8 mods.

### 9.2 Técnico
- [ ] `pnpm typecheck` en verde.
- [ ] `pnpm test` (vitest) en verde; ≥ 80% coverage en archivos nuevos.
- [ ] `pnpm lint` en verde.
- [ ] `cd backend && pytest tests/test_lab_catalogs.py` en verde; ≥ 12 casos.
- [ ] `prisma migrate dev` genera SQL limpio; aplicado en Railway staging.
- [ ] Sidebar muestra nuevo ítem.
- [ ] Audit log captura create/update/delete.

### 9.3 Governance
- [ ] GEMINI auditoria APROBADO o APROBADO_CON_OBSERVACIONES sin bloqueadores.
- [ ] Branch `feature/lab-slice-a-catalogs` con PR a `main`.
- [ ] Merge a `main` solo con OK de Frank.
- [ ] Checkpoint `CHK_ARCH-20260630-02-SLICE-A-CATALOGOS.md` con capturas del demo.
- [ ] PROYECTO.md actualizado (línea de cierre de Slice A).

### 9.4 Demo
- [ ] URL pública del demo cargada: `https://administracion-medica-industrial.vercel.app/admin/lab/catalogs?mod=unidades` (con usuario admin).
- [ ] Captura de pantalla del listado tomada por INTEGRA.
- [ ] Captura del modal crear tomada por INTEGRA.
- [ ] Frank aprueba el demo para iniciar Slice B.

---

## 10. ESTIMACIÓN DE ESFUERZO

| Fase | Horas | Entregable |
|---|---|---|
| Prisma schema + migración | 1.5h | `schema.prisma` extendido, SQL limpio |
| Backend FastAPI (endpoints + service + schemas + tests) | 4h | `lab_catalogs.py`, service, schemas Pydantic, 12+ tests pytest |
| Frontend Next.js (página + tabla + modal + acciones) | 5h | `/admin/lab/catalogs`, componentes, server actions, vitest |
| Sidebar AMI | 0.5h | Item nuevo |
| Seed | 1h | 8 mods seedeados |
| Tests e2e + bugfix | 2h | Cobertura ≥ 80%, lint+typecheck en verde |
| GEMINI auditoría + ajustes | 1h | Iteraciones hasta APROBADO |
| Demo en staging + screenshots + checkpoint | 1h | URL funcional + PROYECTO.md |

**Total estimado:** 16 horas. Compatible con micro-sprint de 2-3 días hábiles.

---

## 11. HANDOFF A SOFIA (extracto)

```
SUBAGENTE: SOFIA  (subagent_type='sofia')
ID HANDOFF: HANDOFF_ARCH-20260630-02_SOFIA_DEMO-NOVA-SLICE-A
CONTEXTO: docs/context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md
          docs/context/decisions/ADR-20260630-02-ABSORCION-NOVA-ESTRATEGIA.md
          docs/context/audits/nova-20260630/AUDIT-NOVA-COMPLETO.md

TAREAS (orden):
1. Crear branch feature/lab-slice-a-catalogs
2. Modificar frontend/prisma/schema.prisma con las 9 entidades nuevas + 3 extensions
3. Generar migración Prisma y validar en local
4. Backend: implementar endpoints y tests (pytest ≥ 12)
5. Frontend: implementar página catálogos + componentes + acciones + tests (vitest ≥ 80% coverage)
6. Sidebar: agregar item "Módulo de Laboratorios"
7. Seed: poblar 8 catálogos con datos seed
8. Validar local: pnpm typecheck && pnpm test && pnpm lint && pytest
9. PR con descripción detallada y screenshots del demo local
10. Sugerir GEMINI como segunda mano de validación:
    task(subagent_type='gemini', prompt='Auditar PR feature/lab-slice-a-catalogs...')
11. NO pidas qodo (está sunset desde 2026-06-22).
12. Aplicar feedback de GEMINI, hacer 2nd commit si necesario.
13. Reportar a INTEGRA con archivo diff + tests passing + screenshot demo.

VALIDACIONES OBLIGATORIAS antes de cerrar:
- pnpm typecheck (verde)
- pnpm test (vitest, verde)
- pnpm lint (si existe script, verde)
- pytest backend (verde)
- prisma format y prisma validate
- Self-review manual:
  * ¿El código refleja los 9 modelos del SPEC §3?
  * ¿Los 8 mods funcionan con CRUD completo?
  * ¿El audit log captura las acciones?
  * ¿Hay riesgo de regresión en /admin/services?
```

---

## 12. REFERENCIAS

- `context/audits/nova-20260630/AUDIT-NOVA-COMPLETO.md` — mapeo forense NOVA
- `context/decisions/ADR-20260630-02-ABSORCION-NOVA-ESTRATEGIA.md` — estrategia y roadmap
- `context/decisions/ADR-20260527-10-ADMISION-TRES-FLUJOS-Y-CONVERGENCIA-A-EVENT.md` — patrón de slices
- `PROYECTO.md` — line 17/19 — sesión 2026-06-30
- `AGENTS.md` — principios INTEGRA, governance

---

## 13. CHANGELOG

| Fecha | Cambio | Autor |
|---|---|---|
| 2026-06-30 | SPEC inicial (Slice A) | INTEGRA |
