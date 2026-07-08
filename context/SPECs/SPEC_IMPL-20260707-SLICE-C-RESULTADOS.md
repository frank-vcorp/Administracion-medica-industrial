# SPEC_IMPL-20260707-SLICE-C-RESULTADOS — Captura de resultados + ciclo de vida + integración papeleta

**ID:** `SPEC_IMPL-20260707-SLICE-C-RESULTADOS`
**Origen:** `ADR-20260630-02-ABSORCION-NOVA-ESTRATEGIA.md` (DA-3, Slice C) + pregunta Frank "¿podemos ligar la papeleta con nuestra versión de NOVA para laboratorios?"
**Tipo:** SPEC de implementación
**Estado:** [~] Planificado
**Siguiente commit:** `IMPL-20260707-16`

---

## 1. OBJETIVO

Implementar la captura de resultados de laboratorio en `/lab/results` con:
1. **Vista por orden**: tabla de analitos con input editable, validación contra rangos, ciclo P/R/A/V
2. **Ciclo de vida completo**: Pendiente → Reportado → Autorizado → Validado (con motivos de invalidación/desautorización)
3. **Bitácora de auditoría**: cada cambio de estado se registra con snapshot before/after
4. **🆕 Integración con papeleta AMI**: `LabOrder` ya tiene `medicalEventId` (opcional). En este slice agregamos:
   - En `MedicalEvent` (papeleta), UI muestra sección "Laboratorio" con `LabOrder`s y `LabResult`s asociados
   - En `LabResult`, campo opcional `eventTestId` vincula el resultado con un `EventTest` específico de la papeleta
   - En `/lab/results`, filtro por paciente muestra también las papeletas activas del paciente

## 2. ALCANCE

### 2.1 Dentro del alcance (MUST)

#### Schema Prisma
- [ ] `LabAnalyte` — analito/parámetro dentro de un estudio (ej: "Hemoglobina" en "BH"). FK a `MedicalTest` y `LabUnit`.
- [ ] `LabReferenceRange` — rango normal por edad/sexo para cada analito (FK a `LabAnalyte`).
- [ ] `LabResult` — valor capturado por analito por orden. FK a `LabOrderItem` (obligatoria) y `EventTest` (opcional, para papeleta).
- [ ] `LabResultAudit` — bitácora de cambios de estado con snapshot before/after en JSON.
- [ ] Enum `LabResultStatus` — PENDING/REPORTED/AUTHORIZED/VALIDATED/INVALIDATED.
- [ ] Enum `LabAnalyteDataType` — NUMERIC/TEXT/ENUM (cualitativo).
- [ ] Back-relations: `MedicalTest.analytes: LabAnalyte[]`, `MedicalTest.labResults: LabResult[]`, `MedicalEvent.labResults: LabResult[]` (transitiva), `Worker.labResults: LabResult[]` (transitiva), `EventTest.labResults: LabResult[]`.
- [ ] Migración Prisma `20260707120000_add_lab_results` con todas las tablas.

#### Backend FastAPI
- [ ] `backend/app/schemas/lab_results.py` con Pydantic models.
- [ ] `backend/app/services/lab_result_service.py` con CRUD + ciclo de vida + validación contra rangos.
- [ ] `backend/app/api/v1/lab/results.py` con endpoints REST:
  - `GET /results?draw=&start=&length=&search=&status=&dateFrom=&dateTo=&orderId=&workerId=`
  - `GET /results/{id}`
  - `POST /results` (captura inicial, una o varias en bulk)
  - `PATCH /results/{id}` (actualizar valor)
  - `POST /results/{id}/report` (PENDING→REPORTED, requiere capturar valor)
  - `POST /results/{id}/authorize` (REPORTED→AUTHORIZED, requiere userId firmante)
  - `POST /results/{id}/validate` (AUTHORIZED→VALIDATED, requiere userId firmante)
  - `POST /results/{id}/invalidate` (cualquiera→INVALIDATED, requiere motivo)
  - `GET /orders/{orderId}/worklist` — hoja de trabajo con analitos esperados
- [ ] `backend/app/api/v1/medical_events.py` — extender endpoint existente para incluir `labOrders` y `labResults` anidados (relación transitiva vía `LabOrder`).
- [ ] Tests pytest ≥ 12 casos.

#### Frontend Next.js
- [ ] Página `/lab/results` con:
  - Filtros NOVA-style (folio, paciente, médico, estudio, fecha, flags urgentes/confidenciales/por_mail)
  - Tabs: "Resultados pendientes" / "Reportados" / "Autorizados" / "Validados" / "Inválidos"
  - Lista de órdenes + click → vista detalle
- [ ] Página `/lab/results/[orderId]` con:
  - Header: folio, paciente, médico, empresa, fecha, estado global
  - Tabla de analitos con input editable, unidad, rango de referencia, valor actual
  - **Validación visual contra rango**: verde (normal), amarillo (borderline), rojo (fuera de rango o crítico)
  - Botones P/R/A/V/X con confirmación (motivo para invalidar/desautorizar)
  - **🆕 Sección "Papeleta Asociada"** si `medicalEventId`: muestra link a `/events/[id]` y permite desvincular
- [ ] Componente `LabResultTable` (reutilizable)
- [ ] Componente `LabResultAuditTimeline` (muestra bitácora)
- [ ] Server actions: `getLabResultsAction`, `bulkCreateLabResultsAction`, `updateLabResultAction`, `transitionLabResultAction` (con action: 'report'|'authorize'|'validate'|'invalidate')
- [ ] Server action `getWorklistAction(orderId)` para hoja de trabajo
- [ ] **🆕 En `/events/[id]`** (papeleta AMI), agregar sección "Laboratorio" que muestra:
  - LabOrders asociadas con su estado y folio
  - LabResults con sus analitos, valores, rangos, estado
  - Link "Crear nueva orden de laboratorio" → `/lab/reception?medicalEventId=[id]&workerId=[workerId]`
- [ ] **🆕 En `/lab/reception`** (admisión), agregar selector opcional de "Papeleta Asociada" (autocomplete por `MedicalEvent.id` o por paciente) que pre-llena `workerId` y `medicalEventId`.

#### Tests
- [ ] pytest backend ≥ 12 casos
- [ ] vitest frontend ≥ 8 casos Zod + smoke

### 2.2 Fuera del alcance (futuros slices)
- ❌ Generación de PDF (etiquetas, resultados, recibos) → Slice F
- ❌ Trazabilidad muestra→proceso (`LabTraceEvent`) → Slice D
- ❌ Catálogo avanzado Estudios/Elementos/Perfiles/Formulas → Slice E
- ❌ Pagos / cortesías / corte de caja → Slice G
- ❌ Migración de datos NOVA → Slice H
- ❌ Cutover y deprecación → Slice I

## 3. ESQUEMA DE DATOS

```prisma
// ===== ENUMS NUEVOS =====

enum LabResultStatus {
  PENDING       // capturado pero sin valor final
  REPORTED      // valor capturado, pendiente de autorización
  AUTHORIZED    // firmado por analista (médico/responsable)
  VALIDATED     // validado por responsable final
  INVALIDATED   // cancelado/inválido (con motivo)
}

enum LabAnalyteDataType {
  NUMERIC        // valor numérico (ej: hemoglobina 14.5)
  TEXT           // texto libre (ej: "positivo", "negativo")
  ENUM           // opciones predefinidas (ej: "A", "B", "O", "AB" para grupo sanguíneo)
}

// ===== MODELOS NUEVOS =====

model LabAnalyte {
  id              String   @id @default(cuid())
  medicalTestId   String
  medicalTest     MedicalTest @relation(fields: [medicalTestId], references: [id], onDelete: Cascade)
  code            String              // "HGB" para Hemoglobina
  name            String              // "Hemoglobina"
  orderIndex      Int      @default(0) // orden de visualización
  dataType        LabAnalyteDataType @default(NUMERIC)
  defaultUnitId   String?
  defaultUnit     LabUnit?  @relation(fields: [defaultUnitId], references: [id])
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  referenceRanges LabReferenceRange[]
  results         LabResult[]

  @@unique([medicalTestId, code])
  @@index([medicalTestId])
}

model LabReferenceRange {
  id           String     @id @default(cuid())
  analyteId    String
  analyte      LabAnalyte @relation(fields: [analyteId], references: [id], onDelete: Cascade)
  sex          LabSex                  // M/F/A (all)
  ageMinMonths Int?                    // 0 = nacimiento
  ageMaxMonths Int?                    // null = sin límite
  valueMin      Float?                 // rango numérico
  valueMax      Float?
  textValue     String?                // para ENUM/TEXT (ej: "Negativo", "Positivo")
  unitId        String?
  unit          LabUnit? @relation(fields: [unitId], references: [id])
  criticalLow   Float?                 // valor crítico bajo (alerta roja)
  criticalHigh  Float?                 // valor crítico alto (alerta roja)
  isCritical    Boolean  @default(false) // marca como valor crítico por defecto
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([analyteId, sex, ageMinMonths, ageMaxMonths])
}

enum LabSex {
  M
  F
  A  // all / ambos sexos
}

model LabResult {
  id                String   @id @default(cuid())
  labOrderItemId    String
  labOrderItem      LabOrderItem @relation(fields: [labOrderItemId], references: [id], onDelete: Cascade)
  analyteId         String
  analyte           LabAnalyte @relation(fields: [analyteId], references: [id])
  
  // Vínculo opcional con papeleta (EventTest específico)
  eventTestId       String?
  eventTest         EventTest? @relation(fields: [eventTestId], references: [id], onDelete: SetNull)
  
  // Valor capturado
  valueText         String?     // para TEXT/ENUM
  valueNumber       Float?      // para NUMERIC
  unitId            String?
  unit              LabUnit? @relation(fields: [unitId], references: [id])
  
  // Estado del ciclo
  status            LabResultStatus @default(PENDING)
  
  // Auditoría
  capturedById      String?
  capturedBy        User? @relation("LabResultCapturer", fields: [capturedById], references: [id])
  capturedAt        DateTime?
  
  reportedById      String?
  reportedBy        User? @relation("LabResultReporter", fields: [reportedById], references: [id])
  reportedAt        DateTime?
  
  authorizedById    String?
  authorizedBy      User? @relation("LabResultAuthorizer", fields: [authorizedById], references: [id])
  authorizedAt      DateTime?
  
  validatedById     String?
  validatedBy       User? @relation("LabResultValidator", fields: [validatedById], references: [id])
  validatedAt       DateTime?
  
  invalidatedById   String?
  invalidatedBy     User? @relation("LabResultInvalidator", fields: [invalidatedById], references: [id])
  invalidatedAt     DateTime?
  invalidateReason  String?
  
  // Flags
  isOutOfRange       Boolean  @default(false) // calculado al guardar
  isCritical         Boolean  @default(false) // calculado al guardar (fuera de criticalLow/High)
  isAbnormal         Boolean  @default(false) // flag manual del analista
  
  observations      String?  // notas del analista
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  auditEvents       LabResultAudit[]
  
  @@unique([labOrderItemId, analyteId])  // 1 resultado por analito por item
  @@index([analyteId])
  @@index([status])
  @@index([eventTestId])
}

model LabResultAudit {
  id            String   @id @default(cuid())
  resultId      String
  result        LabResult @relation(fields: [resultId], references: [id], onDelete: Cascade)
  
  action        String   // "CREATE" | "UPDATE_VALUE" | "REPORT" | "AUTHORIZE" | "VALIDATE" | "INVALIDATE" | "OUT_OF_RANGE_DETECTED"
  fromStatus    LabResultStatus?
  toStatus      LabResultStatus?
  before        Json?    // snapshot antes del cambio
  after         Json?    // snapshot después del cambio
  reason        String?  // motivo (para INVALIDATE, AUTHORIZE)
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  createdAt     DateTime @default(now())
  
  @@index([resultId, createdAt])
}

// ===== EXTENSIONES BACK-RELATIONS (modelos existentes) =====

// model MedicalTest { labResults LabResult[] }
// model EventTest { labResults LabResult[] }
// model LabUnit { analyteDefaults LabAnalyte[] @relation("LabUnitAnalyteDefault"); resultUnits LabResult[]; rangeUnits LabReferenceRange[] }
// model User { capturedResults LabResult[] @relation("LabResultCapturer"); reportedResults LabResult[] @relation("LabResultReporter"); ... }
// model MedicalEvent { labResults via labOrders.transitive } (no necesita nueva relation, la transitividad funciona)
```

## 4. ENDPOINTS Y SERVER ACTIONS

### 4.1 Backend FastAPI

| Método | Path | Body | Descripción |
|---|---|---|---|
| `GET` | `/api/v1/lab/results` | Query: draw, start, length, search, status, dateFrom, dateTo, orderId, workerId, folio | Lista paginada con filtros |
| `GET` | `/api/v1/lab/results/{id}` | — | Result individual con audit log |
| `POST` | `/api/v1/lab/results` | `{labOrderItemId, analyteId, valueText?, valueNumber?, unitId?}` (o array de varios) | Crear uno o varios |
| `PATCH` | `/api/v1/lab/results/{id}` | `{valueText?, valueNumber?, unitId?, observations?}` | Actualizar valor |
| `POST` | `/api/v1/lab/results/{id}/report` | — | PENDING→REPORTED |
| `POST` | `/api/v1/lab/results/{id}/authorize` | `{reason?}` | REPORTED→AUTHORIZED |
| `POST` | `/api/v1/lab/results/{id}/validate` | `{reason?}` | AUTHORIZED→VALIDATED |
| `POST` | `/api/v1/lab/results/{id}/invalidate` | `{reason: required}` | cualquier→INVALIDATED |
| `GET` | `/api/v1/lab/orders/{orderId}/worklist` | — | Hoja de trabajo: analitos esperados para una orden (basado en el MedicalTest del LabOrderItem) |
| `PATCH` | `/api/v1/lab/orders/{orderId}/items/{itemId}` | `{eventTestId?}` | Vincular LabOrderItem a EventTest de la papeleta |

### 4.2 Extensión de endpoints existentes
- `GET /api/v1/medical_events/{id}` ahora incluye `labOrders: LabOrder[]` con `items.results: LabResult[]` anidados
- `POST /api/v1/lab/orders` ahora acepta `eventTestId` por cada item (vinculación opcional a examen de papeleta)

### 4.3 Frontend Next.js — Server Actions

```ts
// frontend/src/actions/lab-result.actions.ts
- getLabResultsAction(filters): Promise<ActionResult<{rows, total}>>
- getLabResultAction(id): Promise<LabResultWithAudit>
- bulkCreateLabResultsAction(items): Promise<{ok, ids: string[]}>
- updateLabResultAction(id, values): Promise<{ok}>
- transitionLabResultAction(id, action, reason?): Promise<{ok, newStatus}>
- getWorklistAction(orderId): Promise<WorklistItem[]>
- linkLabOrderItemToEventTestAction(itemId, eventTestId): Promise<{ok}>
```

```ts
// frontend/src/actions/medical-event.actions.ts (extender existente)
// Añadir helper para obtener medicalEvent con labOrders+labResults
- getMedicalEventWithLabsAction(id): Promise<MedicalEventWithLabs>
```

### 4.4 Validaciones Zod

```ts
// frontend/src/lib/validations/lab-result.ts
export const createLabResultSchema = z.object({
  labOrderItemId: z.string().min(1),
  analyteId: z.string().min(1),
  valueText: z.string().optional().nullable(),
  valueNumber: z.number().optional().nullable(),
  unitId: z.string().optional().nullable(),
}).refine(d => d.valueText !== null || d.valueNumber !== null, {
  message: "Debe proporcionar valueText o valueNumber",
});

export const transitionSchema = z.object({
  action: z.enum(['report', 'authorize', 'validate', 'invalidate']),
  reason: z.string().max(500).optional(),
}).refine(d => d.action !== 'invalidate' || (d.reason && d.reason.length >= 5), {
  message: "Invalidar requiere motivo de al menos 5 caracteres",
  path: ['reason'],
});
```

## 5. ARCHIVOS A TOCAR / CREAR

### 5.1 Prisma
- `frontend/prisma/schema.prisma` — agregar 4 modelos + 3 enums + 6 back-relations
- `frontend/prisma/migrations/20260707120000_add_lab_results/migration.sql` (auto-generada)

### 5.2 Backend FastAPI
- `backend/app/schemas/lab_results.py` (NEW)
- `backend/app/services/lab_result_service.py` (NEW)
- `backend/app/services/lab_analyte_service.py` (NEW, opcional)
- `backend/app/api/v1/lab/results.py` (NEW)
- `backend/app/api/v1/lab/worklist.py` (NEW)
- `backend/app/main.py` — registrar nuevos routers
- `backend/tests/test_lab_results.py` (NEW, ≥ 12 casos)

### 5.3 Frontend Next.js
- `frontend/src/app/lab/results/page.tsx` (NEW)
- `frontend/src/app/lab/results/[orderId]/page.tsx` (NEW) — vista detalle con worklist
- `frontend/src/app/lab/results/_components/LabResultTable.tsx` (NEW)
- `frontend/src/app/lab/results/_components/LabResultAuditTimeline.tsx` (NEW)
- `frontend/src/app/lab/results/_components/WorklistTable.tsx` (NEW)
- `frontend/src/app/lab/reception/_components/LabOrderForm.tsx` (MOD — agregar selector de MedicalEvent)
- `frontend/src/app/events/[id]/_components/LabSection.tsx` (NEW — sección Laboratorio en papeleta)
- `frontend/src/actions/lab-result.actions.ts` (NEW)
- `frontend/src/lib/validations/lab-result.ts` (NEW)
- `frontend/src/lib/lab-result-utils.ts` (NEW — helpers: calcular out-of-range, crítico, etc.)

### 5.4 Tests
- `frontend/src/lib/validations/lab-result.test.ts` (≥ 8 casos)
- `frontend/src/lib/lab-result-utils.test.ts` (≥ 6 casos)
- `frontend/src/actions/lab-result.actions.test.ts` (≥ 4 casos, smoke)
- `backend/tests/test_lab_results.py` (≥ 12 casos)

### 5.5 Documentación
- `context/interconsultas/HANDOFF_ARCH-20260707-16_SOFIA_SLICE-C-RESULTADOS.md` (NEW)
- `context/checkpoints/CHK_ARCH-20260707-SLICE-C.md` (al cerrar)
- `context/infra/09-migration-20260707-lab-results.sql` (SQL consolidado Railway)

### 5.6 Seed adicional (opcional)
- 5-10 analitos típicos de BH (Hemoglobina, Hematocrito, Leucocitos, Plaquetas, etc.) en el seed
- 5 rangos de referencia ejemplo

## 6. UX / UI

### 6.1 Página `/lab/results` (lista + filtros)

Layout:
- Filtros arriba: folio, paciente, médico, estudio, fecha desde/hasta, checkboxes urgentes/confidenciales/por_mail
- Tabs: Pendientes | Reportados | Autorizados | Validados | Inválidos
- Tabla de órdenes con columnas: Folio | Fecha | Paciente | Médico | Estudio | #Analitos | #Capturados | #Pendientes | Estado | Acciones
- Click en fila → navega a `/lab/results/[orderId]`

### 6.2 Página `/lab/results/[orderId]` (detalle)

Layout:
- Header con datos de la orden: Folio, Paciente, Médico, Empresa, Fecha creación, Estado global, Urgente/Confidencial flags
- Botones globales: P (todo a Reported), A (todo a Authorized), V (todo a Validated)
- Si tiene `medicalEventId`: **sección "Papeleta Asociada"** con link a `/events/[id]`, botón "Desvincular"
- Tabla de analitos:
  - Columnas: Clave | Nombre | Rango (texto: "M: 13-17, F: 12-16") | Valor | Unidad | Estado | Acciones
  - Input editable para valor
  - Indicador visual de rango: verde / amarillo / rojo según valor vs rango
  - Indicador crítico: rojo si está fuera de criticalLow/criticalHigh
  - Botones individuales: P, R, A, V, X
- Timeline de auditoría debajo de la tabla

### 6.3 Sección Laboratorio en `/events/[id]`

- Header: "Laboratorio — 2 órdenes asociadas"
- Lista de LabOrders con: folio, fecha, estado, #analitos
- Click → navega a `/lab/results/[orderId]`
- Botón "Nueva orden de laboratorio" → navega a `/lab/reception?workerId=[workerId]&medicalEventId=[id]`

### 6.4 Banner
"Módulo LAB — Slice C — Resultados demo"

## 7. SEGURIDAD Y ROLES

- Roles permitidos para captura: `ADMIN`, `LAB_RECEPTIONIST`, `LAB_ANALYST`
- Roles permitidos para autorizar: `ADMIN`, `LAB_VALIDATOR`
- Roles permitidos para invalidar: `ADMIN`, `LAB_VALIDATOR` (con motivo)
- Audit log captura cada cambio de estado con snapshot before/after completo en JSON
- Toda acción genera entrada en `LabResultAudit`

## 8. RIESGOS Y MITIGACIONES

| Riesgo | Mitigación |
|---|---|
| Migración grande: 4 modelos + 3 enums + 6 back-relations | Generar con `--create-only`, validar SQL, probar en staging |
| Ciclo de vida complejo (5 estados con transiciones) | Service con métodos `transition_*` que validan transición legal y registran audit |
| Validación contra rangos requiere cálculo de edad del paciente | Helper `calculateAgeInMonths(birthDate, sampleDate)` |
| Vinculación LabOrderItem ↔ EventTest puede ser 1:N | Schema permite múltiples LabOrderItems apuntando al mismo EventTest |
| Bitácora inmutable: ¿cómo corregir errores? | Cada corrección genera nueva entrada en audit log con before/after (no se borra historial) |

## 9. CRITERIOS DE ACEPTACIÓN (DoD)

### 9.1 Funcional (demo manual en staging)
- [ ] Login con `LAB_ANALYST`, ir a `/lab/results` → ver lista de órdenes pendientes
- [ ] Filtrar por paciente → ver solo las órdenes de ese paciente
- [ ] Click en una orden → ir a `/lab/results/[orderId]` → ver tabla de analitos
- [ ] Capturar valor de un analito → guardar → ver indicador de rango
- [ ] Capturar valor fuera de rango → ver indicador amarillo/rojo
- [ ] Capturar valor crítico → ver alerta roja
- [ ] Botón P → status cambia a REPORTED, audit log registra cambio
- [ ] Botón A → status cambia a AUTHORIZED, audit log registra con snapshot
- [ ] Botón V → status cambia a VALIDATED
- [ ] Botón X con motivo → status cambia a INVALIDATED
- [ ] Crear nueva admisión con `medicalEventId` → la orden aparece en la papeleta
- [ ] Ir a `/events/[id]` → ver sección "Laboratorio" con la orden recién creada
- [ ] Click en la orden desde la papeleta → navega a `/lab/results/[orderId]`
- [ ] Invalidar un resultado → ver timeline de auditoría con snapshot

### 9.2 Técnico
- [ ] `pnpm typecheck` en verde
- [ ] `pnpm test` en verde
- [ ] `pytest tests/test_lab_results.py` ≥ 12 verde
- [ ] `scripts/test_prisma_naming.py` extendido pasa todas las queries
- [ ] Sin archivos prohibidos en commits
- [ ] Migración aplicada en Railway sin errores

### 9.3 Governance
- [ ] GEMINI auditoría APROBADO o APROBADO_CON_OBSERVACIONES
- [ ] Branch `feature/lab-slice-c-results` con PR
- [ ] Merge con OK de Frank
- [ ] Checkpoint `CHK_ARCH-20260707-SLICE-C.md` con capturas
- [ ] PROYECTO.md actualizado

## 10. ESTIMACIÓN

| Fase | Horas |
|---|---|
| Prisma schema + migración | 2h |
| Backend FastAPI (services + endpoints + tests) | 6h |
| Frontend Next.js (2 páginas + 3 componentes + 2 server actions + Zod) | 8h |
| Integración papeleta (LabSection + selector MedicalEvent) | 3h |
| Tests | 2h |
| GEMINI + ajustes | 1h |
| Demo + checkpoint | 1h |
| **Total** | **~23h** |

Micro-sprint de 3-4 días hábiles. Estimamos completar en una sesión extendida.

## 11. CHANGELOG

| Fecha | Cambio | Autor |
|---|---|---|
| 2026-07-07 | SPEC inicial Slice C con integración papeleta | INTEGRA |

---

**Nota final**: esta SPEC se generó con Frank preguntando "¿podemos ligar la papeleta con nuestra versión de NOVA para laboratorios?". La respuesta es SÍ, y este slice implementa la integración bidireccional:
- `LabOrder.medicalEventId` → papeleta
- `MedicalEvent.labOrders[]` (back-relation, ya existía)
- `LabResult.eventTestId` → examen específico de la papeleta
- UI: papeleta muestra sección de Laboratorio; admisión lab permite seleccionar papeleta
