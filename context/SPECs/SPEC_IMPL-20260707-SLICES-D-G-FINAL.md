# SPEC_IMPL-20260707-SLICES-D-G-FINAL — SPEC consolidado NOVA absorción completa

**ID:** `SPEC_IMPL-20260707-SLICES-D-G-FINAL`
**Origen:** Frank 2026-07-07 20:53 CST "procede con todo, intenta terminar todo el módulo sustituto de NOVA"
**Estado:** [~] Planificado, en ejecución
**Sin CRONISTA:** documentación la hace INTEGRA directamente

---

## 1. OBJETIVO

Completar todos los slices pendientes de NOVA absorción en AMI para que el sistema funcione end-to-end como sustituto de NOVA Connection:

- **B-v2** — Re-arquitectura: bandeja de papeletas + trigger SAMPLE_TAKEN
- **D** — Trazabilidad (muestra→proceso→entrega)
- **E** — Catálogo avanzado de estudios + seed de analitos típicos
- **F** — Reportes PDF (etiquetas, resultados, recibos)
- **G** — Caja, cortesías, corte de caja
- **H** — Migración datos NOVA (catálogos + órdenes del último mes)
- **I** — Cutover y deprecación

---

## 2. FASES DE EJECUCIÓN

### FASE 1: B-v2 + E (8-10h)
- B-v2: Bandeja de papeletas con EventTest SAMPLE_TAKEN de cat=Laboratorio
- B-v2: Pre-llenado automático desde MedicalEvent
- B-v2: Trigger al cambiar EventTest.status a SAMPLE_TAKEN
- B-v2: Fallback admisión manual
- E: Editor especializado de MedicalTest (BH, QS, EGO, Perfiles, Paquetes)
- E: Seed de 5 estudios típicos × 6-8 analitos cada uno
- E: Seed de rangos de referencia por edad/sexo

### FASE 2: D + C-update (4-6h)
- D: Modelo `LabTraceEvent` (muestra→proceso→entrega)
- D: UI `/lab/trazabilidad` con timeline cronológico
- C-update: Vincular `LabResult` con `EventTest` para integración papeleta

### FASE 3: F + G (8-10h)
- F: Templates PDF (etiquetas, resultados, recibos) usando `pdf_ebook_writer`
- F: Endpoints `/api/v1/lab/reports/{id}/pdf`
- F: UI "Imprimir" en `/lab/results/[orderId]`
- G: Modelo `LabCashMovement` + `Courtesy`
- G: UI de caja con formas de pago
- G: Reporte de corte de caja

### FASE 4: H + I (6-8h)
- H: Script `migrate_nova.py` con modos `--persistent-only` y `--operational --since=2026-05-31`
- H: Mapeo `MOD_TO_NOVA_MODEL` con cardinalidades
- H: Validación post-migración
- I: Banner "NOVA deprecado" en AMI
- I: Snapshot final de NOVA archivado

---

## 3. ENTREGABLES OBLIGATORIOS (TODOS)

### 3.1 Schema Prisma (extensiones)

```prisma
// ===== FASE 1 =====
// (sin cambios — la Schema ya soporta B-v2 y E)
// LabAnalyte, LabReferenceRange, LabResult, LabResultAudit (Slice C)
// eventTestId en LabOrderItem (Slice C)

// ===== FASE 2 =====
model LabTraceEvent {
  id          String   @id @default(cuid())
  labOrderId  String
  labOrder    LabOrder @relation(fields: [labOrderId], references: [id], onDelete: Cascade)
  event       String   // "SAMPLE_RECEIVED" | "PROCESS_STARTED" | "ANALYSIS_DONE" | "VALIDATED" | "DELIVERED"
  timestamp   DateTime @default(now())
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  notes       String?
  location    String?  // lugar físico del proceso

  @@index([labOrderId])
  @@index([event])
  @@index([timestamp])
}

// ===== FASE 3 =====
enum PaymentMethod {
  CASH
  CARD
  TRANSFER
  CHECK
  OTHER
}

model LabCashMovement {
  id          String   @id @default(cuid())
  labOrderId  String
  labOrder    LabOrder @relation(fields: [labOrderId], references: [id], onDelete: Cascade)
  amount      Float
  method      PaymentMethod
  reference   String?
  currency    String   @default("MXN")
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  createdAt   DateTime @default(now())

  @@index([labOrderId])
}

model Courtesy {
  id          String   @id @default(cuid())
  labOrderId  String   @unique
  labOrder    LabOrder @relation(fields: [labOrderId], references: [id], onDelete: Cascade)
  reason      String
  approvedById String
  approvedBy   User    @relation(fields: [approvedById], references: [id])
  createdAt   DateTime @default(now())
}

// ===== FASE 4 =====
// (sin cambios — la Schema ya tiene lo necesario para la migración)
// novaFolio String? @unique en LabOrder (ya existe)
```

### 3.2 Backend FastAPI

**Fase 1:**
- `GET /api/v1/lab/pending-orders?branchId=X&category=Laboratorio` — bandeja de papeletas
- `POST /api/v1/lab/auto-generate-from-event` — trigger al SAMPLE_TAKEN
- `GET /api/v1/medical_tests/lab-catalog` — estudios con analitos
- `POST /api/v1/lab/analytes` — CRUD de analitos
- `POST /api/v1/lab/reference-ranges` — CRUD de rangos
- Endpoint `POST /api/v1/event_tests/{id}/sample` — marca SAMPLE_TAKEN y triggera

**Fase 2:**
- `GET /api/v1/lab/orders/{id}/trace` — timeline de eventos
- `POST /api/v1/lab/orders/{id}/trace` — registrar evento manual

**Fase 3:**
- `GET /api/v1/lab/reports/etiquetas/{orderId}` — PDF de etiquetas
- `GET /api/v1/lab/reports/resultados/{orderId}` — PDF de resultados
- `GET /api/v1/lab/reports/recibos/{orderId}` — PDF de recibo
- `POST /api/v1/lab/orders/{id}/payments` — registrar pago
- `GET /api/v1/lab/cash-closing` — reporte de corte

**Fase 4:**
- `python scripts/migrate_nova.py` con `--dry-run`, `--persistent-only`, `--operational --since=2026-05-31`

### 3.3 Frontend Next.js

**Fase 1:**
- `/lab/reception` REESCRITO: vista principal = bandeja de papeletas
- `/lab/reception/[medicalEventId]` — admisión auto-llenada desde papeleta
- `/admin/lab/catalog` — editor de MedicalTest con analitos y rangos
- `/events/[id]` — botón "Tomar muestra" por cada EventTest de cat=Laboratorio

**Fase 2:**
- `/lab/results/[orderId]` — añadir timeline de trazabilidad

**Fase 3:**
- `/lab/results/[orderId]` — botones "Imprimir etiquetas" / "Imprimir resultados"
- `/lab/cash` — vista de caja con pagos
- `/lab/cash-closing` — reporte de cierre

**Fase 4:**
- Banner "NOVA deprecado" en `/admin/lab/*` y `/lab/*`

### 3.4 Tests
- pytest backend ≥ 30 (10 por fase)
- vitest frontend ≥ 20 (cubrir Zod + helpers)
- Migration script test con datos sintéticos

---

## 4. CRITERIOS DE ACEPTACIÓN (DoD)

### FASE 1
- [ ] `/lab/reception` muestra bandeja de papeletas
- [ ] Click en papeleta → admisión pre-llenada
- [ ] Trigger SAMPLE_TAKEN crea LabOrder automáticamente
- [ ] Botón "Tomar muestra" en `/events/[id]`
- [ ] Seed de 5 estudios × 6 analitos × 3 rangos
- [ ] Tests verde
- [ ] Playwright OK

### FASE 2
- [ ] `/lab/results/[orderId]` muestra timeline
- [ ] Eventos: SAMPLE_RECEIVED, PROCESS_STARTED, ANALYSIS_DONE, VALIDATED, DELIVERED
- [ ] `LabResult.eventTestId` vincula con EventTest correctamente
- [ ] Tests verde
- [ ] Playwright OK

### FASE 3
- [ ] PDF de etiquetas descarga correctamente
- [ ] PDF de resultados con datos del paciente + analitos
- [ ] PDF de recibo con totales y pagos
- [ ] UI de caja con formas de pago
- [ ] Tests verde
- [ ] Playwright OK

### FASE 4
- [ ] Script de migración con `--dry-run` funciona
- [ ] Catálogos persistentes migrados (43 items Slice A ya están)
- [ ] Órdenes del último mes migradas (si hay acceso a NOVA)
- [ ] Banner "NOVA deprecado" visible
- [ ] Tests verde
- [ ] Playwright OK

---

## 5. ESTIMACIÓN TOTAL

| Fase | Horas |
|---|---|
| Fase 1 (B-v2 + E) | 8-10h |
| Fase 2 (D + C-update) | 4-6h |
| Fase 3 (F + G) | 8-10h |
| Fase 4 (H + I) | 6-8h |
| **Total** | **26-34h** |

Frank autorizó "intentar terminar todo". Lanzaré SOFIA en cada fase secuencialmente con verificación Playwright entre fases. INTEGRA maneja documentación directamente (sin CRONISTA por instrucción de Frank).

---

## 6. PLAN DE EJECUCIÓN

1. INTEGRA: Crear SPEC ✓ (este archivo)
2. INTEGRA: Lanzar SOFIA Fase 1
3. SOFIA: Implementar Fase 1
4. INTEGRA: Verificar Fase 1 con Playwright + merge a main + migración Railway
5. INTEGRA: Lanzar SOFIA Fase 2
6. SOFIA: Implementar Fase 2
7. INTEGRA: Verificar Fase 2 + merge + migración
8. INTEGRA: Lanzar SOFIA Fase 3
9. SOFIA: Implementar Fase 3
10. INTEGRA: Verificar Fase 3 + merge + migración
11. INTEGRA: Lanzar SOFIA Fase 4
12. SOFIA: Implementar Fase 4
13. INTEGRA: Verificar Fase 4 + merge + ejecutar migración
14. INTEGRA: Documentación final sin CRONISTA
15. INTEGRA: Reporte a Frank

---

**INTEGRA se retira a operar. Frank espera. Sin CRONISTA.**
