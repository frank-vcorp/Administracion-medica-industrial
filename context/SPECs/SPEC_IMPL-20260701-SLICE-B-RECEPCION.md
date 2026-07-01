# SPEC_IMPL-20260701-SLICE-B-RECEPCION — Spec de implementación Slice B

**ID:** `SPEC_IMPL-20260701-SLICE-B-RECEPCION`
**Origen:** `SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md` (Slice B) + `ADR-20260630-02-ABSORCION-NOVA-ESTRATEGIA.md` (DA-3, Slice B)
**Tipo:** SPEC de implementación
**Estado:** [~] Planificado, listo para delegar a SOFIA
**Siguiente commit merge:** `IMPL-20260701-03`

---

## 1. OBJETIVO

Construir el flujo de **admisión de laboratorio** en `/lab/reception`:
- Capturar paciente (worker AMI) + médico + empresa + clasificación + observaciones.
- Agregar uno o más estudios del catálogo AMI (MedicalTest) con descuentos por línea.
- Calcular totales (subtotal, IVA, total) en vivo.
- Persistir como `LabOrder` + `LabOrderItem` con FK a `Worker` (obligatoria) y `MedicalEvent` (opcional).
- Permitir cambio de estado DRAFT → SAVED con un solo click.

---

## 2. ALCANCE

### 2.1 Dentro del alcance (MUST)
- [ ] 2 modelos Prisma nuevos: `LabOrder`, `LabOrderItem`.
- [ ] 3 enums: `LabOrderStatus`, `LabOrderUrgency`, `LabOrderConfidentiality`.
- [ ] Relación `Worker.labOrders: LabOrder[]` (back-relation desde `LabOrder.worker`).
- [ ] Relación `MedicalEvent.labOrders: LabOrder[]` (back-relation desde `LabOrder.medicalEvent`).
- [ ] Relación `Company.labOrders: LabOrder[]` (back-relation).
- [ ] Relación `LabClassification.orders: LabOrder[]` (back-relation).
- [ ] Relación `User.createdLabOrders` y `User.cancelledLabOrders` (back-relations).
- [ ] Relación `MedicalTest.labOrderItems: LabOrderItem[]` (back-relation).
- [ ] Endpoint FastAPI `/api/v1/lab/orders` (POST/GET/PATCH/DELETE) + sub-rutas `/items` y `/search/*`.
- [ ] Endpoints autocomplete: `/api/v1/lab/search/workers`, `/search/doctors`, `/search/companies`, `/search/tests`.
- [ ] Server actions Next.js: `createLabOrderAction`, `updateLabOrderAction`, `listLabOrdersAction`, `addLabOrderItemAction`, `removeLabOrderItemAction`, `confirmLabOrderAction` (DRAFT → SAVED).
- [ ] Página `/lab/reception` con form completo idéntico a NOVA.
- [ ] Componentes: `LabOrderForm`, `LabOrderStudiesTable`, `LabOrderTotalsPanel`, `LabOrderFlagsPanel`, `LabOrderDeliveryPanel`, `LabOrderAutocomplete` (reusable).
- [ ] Lista de órdenes existentes en la misma página (`/lab/reception?list=true`).
- [ ] Tabla de pre-órdenes (NOVA-style) en el panel lateral.
- [ ] Banner amarillo "Módulo LAB — Slice B — Solo admisión demo".
- [ ] Validaciones Zod client + server.
- [ ] Soft-delete (no hard delete).
- [ ] Audit log: `action: "CREATE_LAB_ORDER"`, `action: "UPDATE_LAB_ORDER"`, `action: "CONFIRM_LAB_ORDER"`, `action: "CANCEL_LAB_ORDER"`.
- [ ] Tests pytest ≥ 10 casos (CRUD + cálculo de totales + validaciones).
- [ ] Tests vitest ≥ 8 casos (Zod schemas + cálculo de totales client-side).
- [ ] pnpm typecheck verde en código del slice.
- [ ] pnpm test verde.
- [ ] Self-review 12 puntos.
- [ ] Branch `feature/lab-slice-b-reception` con PR a main.

### 2.2 Fuera del alcance (futuros slices)
- ❌ Captura de resultados (`LabResult`) → Slice C.
- ❌ Trazabilidad muestra→proceso (`LabTraceEvent`) → Slice D.
- ❌ Catálogo avanzado Estudios/Analytes/Formulas → Slice E.
- ❌ Generación de PDF etiquetas / QR / resultados → Slice F.
- ❌ Pagos / cortesías / corte de caja → Slice G.
- ❌ Migración de datos NOVA → Slice H.
- ❌ Cutover y deprecación → Slice I.

---

## 3. ESQUEMA DE DATOS (Prisma)

> **Crea los modelos sin romper nada.** Las relaciones inversas (`back-relations`) las añadimos con cuidado.

```prisma
// ===== ENUMS NUEVOS =====

enum LabOrderStatus {
  DRAFT              // En captura, no se ha confirmado
  SAVED              // Guardado, muestra pendiente
  SAMPLE_TAKEN       // Muestra tomada en laboratorio
  IN_PROCESS         // En proceso
  COMPLETED          // Resultados completos
  CANCELLED          // Cancelada
}

enum LabOrderUrgency {
  NORMAL
  URGENT
}

enum LabOrderConfidentiality {
  NORMAL
  CONFIDENTIAL
}

// ===== MODELOS NUEVOS =====

model LabOrder {
  id                  String        @id @default(cuid())
  folio               Int           @unique  // auto-increment, único por sucursal
  novaFolio           String?       @unique  // mapeo NOVA
  branch              String        @default("MATRIZ")

  // Relaciones humanas
  workerId            String
  worker              Worker        @relation(fields: [workerId], references: [id], onDelete: Restrict)
  medicalEventId      String?
  medicalEvent        MedicalEvent? @relation(fields: [medicalEventId], references: [id], onDelete: SetNull)
  companyId           String?
  company             Company?      @relation(fields: [companyId], references: [id], onDelete: SetNull)
  classificationId    String?
  classification      LabClassification? @relation(fields: [classificationId], references: [id], onDelete: SetNull)

  // Médico (texto libre para soportar médicos externos NO mapeados a User)
  doctorName          String
  doctorClave         String?

  // Descuentos globales (a nivel orden)
  patientDiscountPct  Float         @default(0)
  doctorDiscountPct   Float         @default(0)
  doctorCommissionPct Float         @default(0)
  companyDiscountPct  Float         @default(0)

  // Flags
  urgency             LabOrderUrgency         @default(NORMAL)
  confidentiality     LabOrderConfidentiality @default(NORMAL)
  homeSample          Boolean                 @default(false)
  sendResultsByEmail  Boolean                 @default(false)
  generateInvoice     Boolean                 @default(false)
  language            String                  @default("es")  // "es" | "en"

  // Entrega
  deliveryDate        DateTime?
  deliveryTime        String?     // formato HH:mm

  // Estado
  status              LabOrderStatus @default(DRAFT)
  isCourtesy          Boolean     @default(false)  // cortesía (cargo 0)
  courtesyType        String?     // motivo de cortesía

  // Totales
  subtotal            Float       @default(0)
  ivaPct              Float       @default(16)
  iva                 Float       @default(0)
  total               Float       @default(0)

  // Notas
  observations        String?     @db.Text

  // Auditoría
  createdAt           DateTime    @default(now())
  updatedAt           DateTime    @updatedAt
  createdById         String
  createdBy           User        @relation("LabOrderCreator", fields: [createdById], references: [id])
  cancelledAt         DateTime?
  cancelledById       String?
  cancelledBy         User?       @relation("LabOrderCanceller", fields: [cancelledById], references: [id])
  confirmedAt         DateTime?

  items               LabOrderItem[]

  @@index([workerId])
  @@index([medicalEventId])
  @@index([companyId])
  @@index([status])
  @@index([createdAt])
  @@index([folio])
}

model LabOrderItem {
  id              String      @id @default(cuid())
  labOrderId      String
  labOrder        LabOrder    @relation(fields: [labOrderId], references: [id], onDelete: Cascade)
  medicalTestId   String
  medicalTest     MedicalTest @relation(fields: [medicalTestId], references: [id], onDelete: Restrict)

  // Snapshot del precio y configuración al momento de captura
  price           Float       // precio base del MedicalTest al momento
  discountAmount  Float       @default(0)  // descuento monetario $
  discountPct     Float       @default(0)  // descuento porcentaje %
  amount          Float       // monto final: price - discountAmount - (price * discountPct/100)

  // Estado del item (ciclo de vida del resultado)
  resultStatus    String      @default("P")  // P=pendiente, R=reportado, A=autorizado, V=validado, X=invalidado

  // Auditoría
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  @@index([labOrderId])
  @@index([medicalTestId])
  @@index([resultStatus])
}

// ===== EXTENSIONES BACK-RELATIONS (en modelos existentes) =====

// En model Worker { ... } añadir:
// labOrders       LabOrder[]

// En model Company { ... } añadir:
// labOrders       LabOrder[]

// En model MedicalEvent { ... } añadir:
// labOrders       LabOrder[]

// En model MedicalTest { ... } añadir:
// labOrderItems   LabOrderItem[]

// En model User { ... } añadir:
// createdLabOrders   LabOrder[] @relation("LabOrderCreator")
// cancelledLabOrders LabOrder[] @relation("LabOrderCanceller")

// En model LabClassification { ... } añadir:
// orders          LabOrder[]
```

### 3.1 Notas sobre el esquema
- **`Worker.labOrders`** es back-relation obligatoria (1:N).
- **`MedicalEvent.labOrders`** es opcional — la admisión puede ser standalone o ligada a una papeleta existente.
- **`User.createdLabOrders`** + **`User.cancelledLabOrders`** son 2 relaciones distintas al mismo modelo `User` (SQL: 2 FKs, no hay conflicto).
- **`LabClassification.orders`** se llena cuando Frank autorice asociar clasificaciones a órdenes (en este slice ya es opcional).
- **`@db.Text`** en `observations` para textos largos (>255 chars).
- **`deliveryTime`** es String "HH:mm" porque no hay tipo `time` nativo en Prisma para Postgres.
- **`novaFolio`** opcional para mapeo NOVA en Slice H.
- **`isCourtesy`** + **`courtesyType`** porque en NOVA hay flujo separado de cortesías (Slice G lo absorbe).

---

## 4. ENDPOINTS Y SERVER ACTIONS

### 4.1 Backend FastAPI

| Método | Path | Body | Descripción |
|---|---|---|---|
| POST | `/api/v1/lab/orders` | `{workerId, medicalEventId?, companyId?, doctorName, doctorClave?, classificationId?, patientDiscountPct, doctorDiscountPct, doctorCommissionPct, companyDiscountPct, urgency, confidentiality, homeSample, sendResultsByEmail, generateInvoice, language, deliveryDate?, deliveryTime?, observations?, items: [{medicalTestId, price, discountAmount?, discountPct?}]}` | Crea LabOrder DRAFT con sus items. Devuelve `{id, folio, total, items}`. |
| GET | `/api/v1/lab/orders` | `?draw=1&start=0&length=25&search[value]=&status=&dateFrom=&dateTo=` | Lista paginada DataTables. Devuelve `{draw, recordsTotal, recordsFiltered, data: [{id, folio, fecha, paciente, medico, empresa, total, status}]}`. |
| GET | `/api/v1/lab/orders/{id}` | — | Devuelve la orden completa con items. |
| PATCH | `/api/v1/lab/orders/{id}` | parcial de campos editables | Actualiza una orden en DRAFT. No permite cambios si status≠DRAFT. |
| DELETE | `/api/v1/lab/orders/{id}` | `{motivo}` | Soft delete (status=CANCELLED). Solo en DRAFT o SAVED. |
| POST | `/api/v1/lab/orders/{id}/confirm` | — | DRAFT → SAVED. Genera folio si no existe, recalcula totales, registra confirmedAt. |
| POST | `/api/v1/lab/orders/{id}/items` | `{medicalTestId, price, discountAmount?, discountPct?}` | Agrega un item a la orden (solo si DRAFT). |
| DELETE | `/api/v1/lab/orders/{id}/items/{itemId}` | — | Elimina un item (solo si DRAFT). |
| GET | `/api/v1/lab/search/workers?q=<prefix>` | — | Autocomplete de Worker por nombre/clave. Devuelve `[{id, fullName, code, age, companyName}]` (max 10). |
| GET | `/api/v1/lab/search/doctors?q=<prefix>` | — | Autocomplete de médicos (texto libre). Devuelve `[{name, clave}]`. |
| GET | `/api/v1/lab/search/companies?q=<prefix>` | — | Autocomplete de Company por nombre/RFC. Devuelve `[{id, name, rfc}]`. |
| GET | `/api/v1/lab/search/tests?q=<prefix>` | — | Autocomplete de MedicalTest (type='laboratorio'). Devuelve `[{id, code, alternateCode, name, price}]`. |

**Auth:** rol `ADMIN` o `LAB_RECEPTIONIST` (campo `User.labRole`). Validación con `require_role(['ADMIN','LAB_RECEPTIONIST'])`.

### 4.2 Frontend Next.js — Server Actions

```ts
// frontend/src/actions/lab-order.actions.ts
- createLabOrderAction(input: CreateLabOrderInput): Promise<{id, folio, total}>
- updateLabOrderAction(id: string, input: UpdateLabOrderInput): Promise<{ok}>
- listLabOrdersAction(filters): Promise<DataTablesResponse<LabOrderRow>>
- getLabOrderAction(id): Promise<LabOrder>
- deleteLabOrderAction(id, motivo: string): Promise<{ok}>
- confirmLabOrderAction(id): Promise<{ok, folio}>
- addLabOrderItemAction(orderId, item: CreateLabOrderItemInput): Promise<{ok, item}>
- removeLabOrderItemAction(orderId, itemId): Promise<{ok}>
- searchWorkersAction(q: string): Promise<WorkerSearchResult[]>
- searchDoctorsAction(q: string): Promise<DoctorSearchResult[]>
- searchCompaniesAction(q: string): Promise<CompanySearchResult[]>
- searchLabTestsAction(q: string): Promise<LabTestSearchResult[]>
```

Todas con validación Zod server-side (no confiar en cliente) + guard de rol.

### 4.3 Validaciones Zod

`frontend/src/lib/validations/lab-order.ts`:

```ts
export const createLabOrderSchema = z.object({
  workerId: z.string().cuid(),
  medicalEventId: z.string().cuid().optional(),
  companyId: z.string().cuid().optional().nullable(),
  classificationId: z.string().cuid().optional().nullable(),
  doctorName: z.string().min(2).max(120),
  doctorClave: z.string().max(40).optional().nullable(),
  patientDiscountPct: z.number().min(0).max(100).default(0),
  doctorDiscountPct: z.number().min(0).max(100).default(0),
  doctorCommissionPct: z.number().min(0).max(100).default(0),
  companyDiscountPct: z.number().min(0).max(100).default(0),
  urgency: z.enum(['NORMAL','URGENT']).default('NORMAL'),
  confidentiality: z.enum(['NORMAL','CONFIDENTIAL']).default('NORMAL'),
  homeSample: z.boolean().default(false),
  sendResultsByEmail: z.boolean().default(false),
  generateInvoice: z.boolean().default(false),
  language: z.enum(['es','en']).default('es'),
  deliveryDate: z.string().optional().nullable(),  // ISO date
  deliveryTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  observations: z.string().max(2000).optional().nullable(),
  items: z.array(z.object({
    medicalTestId: z.string().cuid(),
    price: z.number().min(0),
    discountAmount: z.number().min(0).default(0),
    discountPct: z.number().min(0).max(100).default(0),
  })).min(1),
});

export const labOrderItemSchema = z.object({
  medicalTestId: z.string().cuid(),
  price: z.number().min(0),
  discountAmount: z.number().min(0).default(0),
  discountPct: z.number().min(0).max(100).default(0),
});
```

---

## 5. ARCHIVOS A TOCAR / CREAR

### 5.1 Prisma
- `frontend/prisma/schema.prisma` — agregar `LabOrder`, `LabOrderItem`, 3 enums, back-relations.
- `frontend/prisma/migrations/20260701010000_add_lab_orders/migration.sql` (generada por Prisma).

### 5.2 Backend FastAPI
- `backend/app/schemas/lab_orders.py` — Pydantic models.
- `backend/app/services/lab_order_service.py` — CRUD + cálculo de totales + confirm.
- `backend/app/api/v1/lab/orders.py` — endpoints REST de orders.
- `backend/app/api/v1/lab/search.py` — endpoints autocomplete.
- `backend/app/main.py` — registrar nuevos routers.
- `backend/tests/test_lab_orders.py` — ≥ 10 casos pytest.

### 5.3 Frontend Next.js
- `frontend/src/app/lab/reception/page.tsx` — orquestador con tabs "Nueva orden" / "Lista de órdenes".
- `frontend/src/app/lab/reception/_components/LabOrderForm.tsx` — form completo.
- `frontend/src/app/lab/reception/_components/LabOrderStudiesTable.tsx` — tabla de estudios agregados.
- `frontend/src/app/lab/reception/_components/LabOrderTotalsPanel.tsx` — subtotal/iva/total live.
- `frontend/src/app/lab/reception/_components/LabOrderFlagsPanel.tsx` — urgente/confidencial/toma/idioma.
- `frontend/src/app/lab/reception/_components/LabOrderDeliveryPanel.tsx` — fecha+hora.
- `frontend/src/app/lab/reception/_components/LabOrderAutocomplete.tsx` — input reusable con búsqueda debounced.
- `frontend/src/app/lab/reception/_components/LabOrdersList.tsx` — tabla de órdenes existentes.
- `frontend/src/actions/lab-order.actions.ts` — 11 server actions.
- `frontend/src/lib/validations/lab-order.ts` — Zod schemas.
- `frontend/src/lib/lab-order-totals.ts` — helper puro para cálculo de totales (testable sin DB).
- `frontend/src/components/AppShell.tsx` — agregar entrada "🧬 Recepción Lab" si NO existe aún.
- `frontend/src/components/admin/Sidebar.tsx` (si existe) — idem.

### 5.4 Tests
- `frontend/src/lib/validations/lab-order.test.ts` — ≥ 8 casos Zod.
- `frontend/src/lib/lab-order-totals.test.ts` — ≥ 6 casos de cálculo.
- `frontend/src/app/lab/reception/_components/LabOrderForm.test.tsx` — ≥ 3 casos (skip si falta testing-library).
- `backend/tests/test_lab_orders.py` — ≥ 10 casos pytest.

### 5.5 Documentación
- `context/interconsultas/HANDOFF_ARCH-20260701-03_SOFIA_SLICE-B-RECEPCION.md` (INTEGRA crea antes de delegar).
- `context/checkpoints/CHK_ARCH-20260701-SLICE-B.md` (al cerrar).

---

## 6. UX / UI

### 6.1 Sidebar (añadir o complementar)
- Entrada "🧬 Recepción Lab" → `/lab/reception` con badge "Lab".

### 6.2 Página `/lab/reception`

Layout en 2 columnas:
- **Izquierda (70%)**: Form de admisión con secciones colapsables.
- **Derecha (30%)**: Tabla de órdenes recientes (estilo NOVA pre-órdenes).

#### Form de admisión (secciones):
1. **Encabezado** — Fecha (auto-hoy), Folio Preorden, Botón "Nueva" / "Siguiente ▶" / "◀ Anterior".
2. **Paciente** — `LabOrderAutocomplete` (Worker), Edad (auto-fill), Dto % Paciente.
3. **Médico** — `LabOrderAutocomplete` (doctorName libre + clave), Dto %, Comisión %.
4. **Empresa** — `LabOrderAutocomplete` (Company), Dto %, Convenio (select vacío por ahora).
5. **Clasificación** — Select opcional `LabClassification`.
6. **Observaciones** — Textarea 2000 chars.
7. **Búsqueda de estudios** — Inputs Clave / C.Alt / Nombre + botón "Buscar" + tabla de resultados para agregar.
8. **Tabla de estudios agregados** — Columnas: `Acción (×)` | `Clave` | `Estudio` | `Precio` | `Dcto $` | `Dcto %` | `Importe` | `Estado (P/R/A/V)`.
9. **Panel CAJA** — Flags: Urgente, Confidencial, Toma a domicilio, Mail, Factura + Idioma ES/EN + Cortesía (toggle).
10. **Panel ENTREGA** — Fecha + Hora (datepicker + timepicker).
11. **Panel TOTALES** — Subtotal, IVA (16%), Total a pagar.
12. **Acciones** — Botones: [Guardar (Ctrl+S)] [Confirmar y Generar Folio] [Pagos (futuro)] [Cotizaciones (futuro)] [Cotizar (futuro)] [Cancelar (soft)].

#### Comportamiento live:
- Al cambiar cualquier descuento o agregar/quitar un estudio, recalcular subtotal/iva/total en cliente (helper `lab-order-totals.ts`).
- Al elegir paciente, autollenar edad desde `Worker.birthDate`.
- Al elegir empresa, autollenar descuento por defecto desde Company config.
- Botón "Confirmar" solo habilitado si hay al menos 1 item y paciente seleccionado.

### 6.3 Banner
"Módulo LAB — Slice B — Solo admisión demo".

---

## 7. SEGURIDAD Y ROLES

- Roles permitidos: `ADMIN`, `LAB_RECEPTIONIST` (campo `User.labRole`).
- Validación backend + frontend (no confiar en cliente).
- Audit log AMI captura:
  - `action: "CREATE_LAB_ORDER"`, `entity: "LabOrder"`, `before: null`, `after: {...}`
  - `action: "UPDATE_LAB_ORDER"`, `entity: "LabOrder"`, `before: {...}`, `after: {...}`
  - `action: "CONFIRM_LAB_ORDER"`, `entity: "LabOrder"`, `before: {status: DRAFT}`, `after: {status: SAVED, folio, confirmedAt}`
  - `action: "CANCEL_LAB_ORDER"`, `entity: "LabOrder"`, `before: {...}`, `after: {...}, motivo: "..."`

---

## 8. RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|---|---|
| Migración Prisma grande (2 modelos + 3 enums + 5 back-relations) | Generar con `--create-only`, validar SQL, probar en staging primero |
| Cálculo de totales incorrecto (cliente vs servidor) | Helper `lab-order-totals.ts` puro, mismo código en cliente (preview) y backend (validación) |
| Folio único por sucursal: race condition en creación | Usar transacción + `findUnique` retry si choca (siguiente folio +1 hasta encontrar libre) |
| Worker no encontrado en autocomplete | Mostrar error claro + opción de crear paciente externo (en este slice: solo worker) |
| Auto-fill de edad falla si `Worker.birthDate` es NULL | Mostrar campo edad editable manualmente |
| `LabClassification.orders` back-relation rompe migración | Verificar con `prisma validate` que las relaciones inversas son correctas |

---

## 9. CRITERIOS DE ACEPTACIÓN (DoD)

### 9.1 Funcional (demo manual en staging)
- [ ] Login con `ADMIN` o `LAB_RECEPTIONIST`.
- [ ] Navegar a `/lab/reception` → ver form vacío + lista de órdenes a la derecha.
- [ ] Buscar paciente "Juan" en autocomplete → ver resultados con código AMI + edad + empresa.
- [ ] Seleccionar paciente → autollenar edad desde birthDate.
- [ ] Ingresar médico "Dr. López" manualmente.
- [ ] Buscar empresa "Vectoria" → autollenar descuento por defecto.
- [ ] Buscar estudio "BH" → seleccionar → ver fila agregada con precio.
- [ ] Aplicar descuento 10% → ver `Importe` recalculado en vivo.
- [ ] Agregar 2do estudio (QS) → ver totales actualizados.
- [ ] Marcar "Urgente" + "Mail" → ver flags activos.
- [ ] Confirmar → ver folio autogenerado + status cambia a SAVED.
- [ ] Volver a la lista → ver la orden recién creada.
- [ ] Cancelar una orden DRAFT → desaparece de la lista (soft delete, queda en DB con status=CANCELLED).
- [ ] Editar una orden DRAFT existente → cambiar descuento → guardar → ver totales actualizados.
- [ ] Cambiar a `?list=true` → ver tabla con filtros por status/fecha.

### 9.2 Técnico
- [ ] `pnpm typecheck` en verde.
- [ ] `pnpm test` (vitest) en verde; ≥ 80% coverage en archivos nuevos del slice.
- [ ] `cd backend && pytest tests/test_lab_orders.py -v` en verde; ≥ 10 casos.
- [ ] `prisma format && prisma validate` en verde.
- [ ] Migración aplicada en Railway staging vía SQL v5 (similar a v4).
- [ ] Sin archivos prohibidos en el commit.

### 9.3 Governance
- [ ] GEMINI auditoría APROBADO o APROBADO_CON_OBSERVACIONES.
- [ ] Branch `feature/lab-slice-b-reception` con PR a `main`.
- [ ] Merge a `main` con OK de Frank.
- [ ] Checkpoint `CHK_ARCH-20260701-SLICE-B.md` con capturas del demo.
- [ ] PROYECTO.md actualizado (línea de cierre de Slice B).

---

## 10. ESTIMACIÓN

| Fase | Horas |
|---|---|
| Prisma schema + migración | 2h |
| Backend FastAPI (11 endpoints + 2 services + tests) | 6h |
| Frontend Next.js (página + 6 componentes + 11 acciones + Zod + helper) | 8h |
| Tests frontend (vitest) | 2h |
| Sidebar + navegación | 0.5h |
| GEMINI auditoría + ajustes | 1h |
| Demo en staging + checkpoint | 1h |
| **Total** | **~20h** |

Micro-sprint de 3-4 días hábiles.

---

## 11. NOTAS PARA SOFIA

- **Reusa patrones existentes**: `lab_catalogs.py` para FastAPI, `lab-catalog.actions.ts` para Server Actions, `CatalogTable.tsx` para tablas.
- **NO instales paquetes nuevos**. Solo `pnpm install` para cualquier devDep existente.
- **NO uses jQuery, Vue, Vuetify**. Stack AMI: React + Next.js 16 + TailwindCSS.
- **NO llames `qodo`** (sunset).
- **`prisma format && prisma validate`** antes de commit.
- Si te quedas sin pasos, prefiero commit parcial + reporte a INTEGRA a no commitear.
- Si algo bloquea, dispara sub-task a GEMINI (auditoría) o DEBY (debug).
- **PR al final con descripción completa** y screenshots del demo si los tienes.

---

## 12. CHANGELOG

| Fecha | Cambio | Autor |
|---|---|---|
| 2026-07-01 | SPEC inicial Slice B | INTEGRA |