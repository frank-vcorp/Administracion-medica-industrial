# ADR-20260630-02 — Estrategia de absorción NOVA → AMI

**ID:** `ADR-20260630-02`
**Fecha:** 2026-06-30
**Estado:** [✓] Aceptado
**Origen:** `ARCH-20260630-02` — auditoría completa en `context/audits/nova-20260630/AUDIT-NOVA-COMPLETO.md`
**Decisor:** INTEGRA, con visto bueno de Frank.

---

## 1. CONTEXTO

AMI (Residente Digital) y NOVA Connection (LIS externo) conviven en producción. La operación de laboratorio **laboral-industrial** (BH, QS, EGO, perfillipídico, audiometría, espirometría, RX, ECG, etc.) se captura dos veces: una en AMI para el expediente médico del trabajador, y otra en NOVA para el laboratorio. Esto genera:

- Doble captura manual (~10-15 min por paciente en mostrador).
- Riesgo de inconsistencia (resultado en un sistema, interpretación en otro).
- Imposibilidad de hacer correlación paciente↔resultado automáticamente.
- Coste de licenciamiento y mantenimiento del LIS paralelo.

Frank autorizó **absorber todo lo que aporte valor** y migrar datos recientes.

---

## 2. DECISIONES ARQUITECTÓNICAS

### DA-1. Stack y arquitectura AMI se mantienen
AMI ya tiene Next.js 16 + Prisma + FastAPI + PostgreSQL + MedGemma pipeline. **No se introduce PHP ni se replica la arquitectura legacy de NOVA.** La absorción es una **réplica funcional en stack AMI moderno**.

### DA-2. Modelo de datos NOVA se unifica con AMI, NO se replica 1:1
NOVA tiene 45 entidades standalone. AMI ya tiene `Worker`, `Company`, `MedicalEvent`, `EventTest`, `MedicalTest`. La absorción **extiende los modelos AMI existentes** y crea nuevos módulos, no crea duplicados.

**Mapeo conceptual:**
| Concepto NOVA | Concepto AMI | Acción |
|---|---|---|
| Empresa | `Company` | **Extender** (columnas NOVA: convenio, descuento default, estado) |
| Paciente | `Worker` | **Extender** (sin empresa) o `Patient` externo si NOVA lo maneja |
| Médico | `User` (rol médico) o nuevo `ExternalDoctor` | **Extender** User con perfil médico |
| Orden | `MedicalEvent` | **Extender** (folio NOVA, cortesía, urgencia, confidencial) |
| Estudio en orden | `EventTest` | **Extender** (precio, descuentos, importe, esLabLab) |
| Estudio (catálogo) | `MedicalTest` | **Extender** (tipo LIS, metodología, lugar de proceso, etc.) |
| Elemento (analito) | **NUEVO** `LabAnalyte` | Crear tabla hija |
| Valor de referencia | **NUEVO** `LabReferenceRange` | Crear (analyte_id, sex, age_min, age_max, min, max, text) |
| Muestra | **NUEVO** `LabSample` | Crear |
| Recipiente | **NUEVO** `LabContainer` | Crear |
| Unidad | **NUEVO** `LabUnit` | Crear |
| Metodología | **NUEVO** `LabMethod` | Crear |
| Lugar de proceso | **NUEVO** `LabProcessArea` | Crear |
| Clasificación | **NUEVO** `LabClassification` | Crear |
| Resultado | **NUEVO** `LabResult` | Crear (analyte_id + range_validation + status_workflow) |
| Bitácora resultado | **NUEVO** `LabResultAudit` | Crear |
| Trazabilidad evento | **NUEVO** `LabTraceEvent` | Crear |
| Caja movimiento | `Payment` (ya existe) + **NUEVO** `LabCashMovement` | Extender Payment |
| Cortesía | `Payment.status = COURTESY` o **NUEVO** `Courtesy` | Decidir en slice 2 |
| Fórmula | **NUEVO** `LabFormula` | Crear (texto fórmula + parámetros) |
| Respuestas predef. | **NUEVO** `LabPredefinedResponse` | Crear |

### DA-3. Estrategia por módulo (gap analysis)

| Módulo NOVA | Estado en AMI | Estrategia |
|---|---|---|
| **Recepción** (`/recepcion`) | No existe workspace dedicado de "toma de muestra" con descuentos | **ABSORBER** nativo como `/lab/reception` |
| **Modificar folio** | No existe | **ABSORBER** como edición de `LabOrder` en `/lab/reception` |
| **Resultados** (`/resultados`) | AMI tiene captura inline por estudio en `/events/[id]` | **ABSORBER** nativo como vista `/lab/results` con captura masiva |
| **Trazabilidad** | Parcial vía `EventTest.status` | **ABSORBER** nativo como vista cronológica + tabla `LabTraceEvent` |
| **Bitácora de resultados** | Existe `AuditLog` genérico | **ABSORBER** con tabla `LabResultAudit` específica del LIS |
| **Tesorería** | AMI ya tiene `Payment` (modal de cobro) | **ABSORBER PARCIAL** — extender `Payment` con campos NOVA; crear `LabCashMovement` para caja chica del lab |
| **Facturación** | AMI no factura (no es su alcance) | **DESCARTAR** — NOVA queda como está para CFDI hasta que se integre SAT/Proveedor |
| **Cortesías** | No existe | **ABSORBER** como flag `cortesia=true` en `LabOrder` |
| **Corte de caja** | No existe | **ABSORBER** nativo como `/lab/cash-closing` |
| **Modificar folio** | No existe | **ABSORBER** edición de `LabOrder` |
| **Notificaciones** | AMI tiene notificaciones básicas por mail | **ABSORBER PARCIAL** — reusar canal mail AMI + agregar scheduler específico de resultado |
| **Cat. Empresas** | AMI `Company` | **EXTENDER** `Company` |
| **Cat. Médicos** | AMI `User` (rol) o ninguno externo | **EXTENDER** o crear `ExternalDoctor` |
| **Cat. Pacientes** | AMI `Worker` | **EXTENDER** `Worker` (puede no tener empresa) |
| **Cat. Servicios** | AMI `MedicalTest` | **EXTENDER** o crear `LabService` |
| **Cat. Descuentos** | No existe | **ABSORBER** como `DiscountPolicy` global + flag aplicación |
| **Cat. Usuarios** | AMI `User` | **EXTENDER** con roles LIS |
| **Cat. Firmas** | AMI no maneja | **ABSORBER** storage de imágenes en bucket + `LabSignature` |
| **Cat. Lugares de proceso** | No existe | **ABSORBER** como `LabProcessArea` |
| **Cat. Departamentos** | No existe | **ABSORBER** como `LabDepartment` |
| **Cat. Recipientes** | No existe | **ABSORBER** como `LabContainer` |
| **Cat. Muestras** | No existe | **ABSORBER** como `LabSample` |
| **Cat. Metodologías** | No existe | **ABSORBER** como `LabMethod` |
| **Cat. Indicaciones** | No existe | **ABSORBER** como `LabIndication` |
| **Cat. Valores referencia** | No existe | **ABSORBER** como `LabReferenceRange` |
| **Cat. Unidades** | AMI `MedicalUnit` parcial | **EXTENDER** con sistema (SI/conv) |
| **Cat. Clasificaciones** | No existe | **ABSORBER** como `LabClassification` |
| **Cat. Respuestas rápidas** | AMI tiene plantillas de texto | **ABSORBER** como `LabPredefinedResponse` |
| **Cat. Movs. caja** | No existe | **ABSORBER** como `LabCashMovementType` |
| **Cat. Bacterias** | No existe | **ABSORBER** como `LabBacteria` |
| **Cat. Antibiogramas** | No existe | **ABSORBER** como `LabAntibiogram` |
| **Cat. Estudios** | AMI `MedicalTest` | **EXTENDER** `MedicalTest` con campos LIS |
| **Cat. Perfiles** | AMI `MedicalTest` (tipo perfil) | **REUSAR** `MedicalTest` con flag `isProfile` |
| **Cat. Elementos** | No existe | **ABSORBER** como `LabAnalyte` |
| **Cat. Cultivos** | AMI tiene `MedicalTest` tipo cultivo | **EXTENDER** |
| **Cat. Paquetes** | AMI `MedicalPackage` (similar) | **REUSAR/EXTENDER** |
| **Requisitos de órdenes** | No existe | **ABSORBER** como `LabRequirement` (texto libre) |
| **Reimprimir etiquetas** | AMI tiene QR (`/qr/[id]`) | **EXTENDER** QR AMI para incluir `clave_orden`, sample_id, barcode |
| **Reimprimir cotizaciones** | AMI tiene modo impresión | **EXTENDER** con template PDF LIS |
| **Reimprimir recibos** | AMI ya tiene recibos | **REUSAR** generador de recibos |
| **Reimprimir resultados** | AMI tiene resultados por evento | **ABSORBER** como `LabResultReport` (PDF) |
| **Ajustes** (general) | AMI tiene `/admin/services` y `/branches` | **REUSAR** secciones aplicables, agregar bloque LIS |
| **Lista de precios** | AMI no tiene | **ABSORBER** como `LabPriceList` + `LabPriceListItem` |
| **Fórmulas** | AMI tiene `aiCalculation` (cálculo post-IA) | **ABSORBER** como `LabFormula` (texto fórmula) |
| **Respuestas predefinidas** | No existe en AMI | **ABSORBER** como `LabPredefinedResponse` |
| **Órdenes canceladas** | No existe vista | **ABSORBER** como filtro de `LabOrder.status = CANCELLED` |

### DA-4. Política de datos (confirmado 2026-06-30 22:16 CST por Frank)
- **Datos persistentes** (todos los catálogos): **migrar TODO lo que exista en NOVA**.
- **Datos operativos recientes** (órdenes, resultados, pagos, trazabilidad): **migrar solo el último mes** = desde `2026-05-31` inclusive.
- **Datos históricos operativos**: NO se migran. Quedan como consulta histórica solo en NOVA hasta deprecación.
- **Sin acceso a BD NOVA**: la migración usa la inferencia del modelo forense + endpoint proxy HTTP si Frank lo habilita. Si Frank consigue dump `.sql`/`.csv` después, el script acepta el archivo.
- Script de migración idempotente, ejecutable en staging primero.

### DA-5. Demo funcional antes de cualquier merge productivo
- Antes de tocar el AMI productivo, **SOFIA entrega un demo funcional** navegable en `/lab/demo` que demuestra el flujo end-to-end: catálogo → admisión → captura → resultado → impresión.
- El demo se carga con dataset seed (no datos reales).

### DA-6. Migración por handoffs (slices)
Cada slice es un handoff SOFIA con:
- Entidades Prisma nuevas / extendidas
- Endpoints FastAPI
- Server actions / rutas Next.js
- Migración DB
- Tests (vitest + pytest)
- **GEMINI como segunda mano de validación** (no Qodo, está sunset)
- Checkpoint `CHK_ARCH-2026070X-XX-*.md`
- Branch feature, PR, merge a `main` solo con verificación productiva

### DA-7. NOVA convive durante toda la implementación
- NOVA sigue siendo la fuente de verdad operativa hasta que se haga **cutover explícito por Frank**.
- AMI y NOVA corren en paralelo, alimentados manualmente por el operador.
- El cutover se hace cuando todos los slices tengan demo verde + aceptación de Frank + Lolis + Dra. Erika + Leticia.

---

## 3. PLAN DE MIGRACIÓN DE DATOS

**Política confirmada por Frank (2026-06-30):**

| Categoría | Política de migración |
|---|---|
| **Datos persistentes** (catálogos: `MedicalTest` extend, `LabAnalyte`, `LabReferenceRange`, `LabUnit`, `LabSample`, `LabContainer`, `LabMethod`, `LabProcessArea`, `LabDepartment`, `LabClassification`, `LabIndication`, `LabBacteria`, `LabAntibiogram`, `LabFormula`, `LabPredefinedResponse`, `LabPriceList`, `LabSignature`, `Company` extend, `User` extend, `Worker` extend, `ExternalDoctor`) | **TODO** lo que exista en NOVA se trae a AMI |
| **Datos recientes operativos** (`LabOrder`, `LabOrderItem`, `LabResult`, `LabResultAudit`, `LabTraceEvent`, `LabCashMovement`, `Courtesy`) | **Solo el último mes** = desde `2026-05-31` inclusive hasta la fecha de ejecución |
| **Datos históricos operativos** (anteriores a 2026-05-31) | **NO se migran**. Quedan solo en NOVA como consulta histórica hasta la deprecación. |

**Sin acceso a la base NOVA** (Frank confirma 2026-06-30): la migración sigue siendo por **inferencia del schema a partir de la auditoría forense** del HTML y endpoints. Si Frank en algún momento consigue dump `.sql` o `.csv`, el script `migrate_nova.py` acepta el archivo como input sin cambios.

### 3.1 Origen (NOVA MySQL probable)
Sin dump directo. **Origen = estado actual NOVA** con sus ~XX items en cada catálogo y ~YY órdenes del último mes (cifras exactas cuando Frank corra `migrate_nova.py --dry-run` sobre staging NOVA vía endpoint HTTP proxy).

### 3.2 Destino (AMI PostgreSQL)
Migración con script Python `backend/scripts/migrate_nova.py` ejecutable vía `tsx`, idempotente, con:
- Modo `--dry-run` que solo reporta conteos sin escribir.
- Modo `--persistent-only` (default para primer pase) que migra solo los 20 catálogos.
- Modo `--operational --since=2026-05-31` que migra órdenes/resultados recientes.
- Modo `--mapping=path/to/map.json` para casos especiales.
- Logging estructurado por tabla: `tabla origen=X, destino=Y, procesados=N, insertados=M, saltados=K, errores=E`.
- Rollback por DROP TABLE de tablas nuevas (no afecta AMI existentes).

### 3.3 Orden de migración (respetando dependencias)
1. **Catálogos base persistentes (TODO):** `LabUnit`, `LabSample`, `LabContainer`, `LabMethod`, `LabIndication`, `LabDepartment`, `LabProcessArea`, `LabClassification`, `LabBacteria`, `LabAntibiogram`, `Company` (extend), `User` (extend), `ExternalDoctor` (si aplica).
2. **Catálogo LIS especializado (TODO):** `MedicalTest` (extend), `LabAnalyte`, `LabReferenceRange`, `LabFormula`, `LabPredefinedResponse`, `LabPriceList`, `LabSignature`.
3. **Catálogos comerciales (TODO):** `DiscountPolicy`, `LabCashMovementType`.
4. **Datos operativos recientes (solo mes):** `LabOrder`, `LabOrderItem`, `LabResult`, `LabResultAudit`, `LabTraceEvent`, `LabCashMovement`, `Courtesy` — solo desde `2026-05-31`.
5. **Imágenes (TODO si existen):** `LabSignature` (binarios en bucket).

### 3.4 Conflictos predecibles
- **`MedicalTest` duplicado**: el mismo estudio (BH) puede existir en AMI (con `type='laboratorio'`) y en NOVA. **Decisión**: usar el de AMI como primario; mergear campos NOVA faltantes (`metodologia`, `lugar_proceso`, `muestra_id`, `recipiente_id`, `nova_clave`).
- **Empresas duplicadas** (RUC/RFC iguales): merge por RFC normalizado. Si NOVA no trae RFC, match por nombre normalizado fuzzy.
- **Pacientes duplicados**: merge por `clave_nova` guardada; en AMI, `Worker.claveNOVA` opcional.
- **Folios duplicados**: si AMI ya tiene folios numéricos, los de NOVA pueden chocar. Migrar como `LabOrder.novaFolio:String` separado.
- **Último mes sin órdenes**: el script `--operational` debe distinguir entre "no hay datos" (correcto) y "no se pudo conectar" (error). Reportar diferencia explícita en el log.

---

## 4. ROADMAP DE IMPLEMENTACIÓN (slices)

> Cada slice = 1 handoff a SOFIA + 1 demo navegable + 1 PR mergeado + 1 checkpoint.

### Slice A — Modelo base + catálogos seed
**Goal:** Crear todas las entidades Prisma nuevas y seedear con datos NOVA genéricos.
**Entregable:**
- Migración Prisma con todas las tablas LIS nuevas.
- Endpoint FastAPI `/api/v1/lab/catalogs/[tipo]?mod=...` (server-side DataTables compatible).
- Server actions para CRUD de catálogos básicos.
- Vista `/admin/lab/catalogs` con menú idéntico al sidebar NOVA.
- Seed con 10 unidades, 10 muestras, 10 recipientes, 5 departamentos, 5 lugares, 5 métodos.
**Demo:** `/admin/lab/catalogs?mod=unidades` muestra lista NOVA-style de unidades, editable.

### Slice B — Admisión (Recepción) end-to-end
**Goal:** Capturar la admisión de paciente + estudios + totales en `/lab/reception`.
**Entregable:**
- `/lab/reception` con form idéntico a NOVA (folio autogenerado, paciente autocomplete, médico, empresa, descuentos, flags, fecha+hora entrega).
- Tabla de estudios agregados con cálculo de totales live.
- Endpoint `/api/v1/lab/orders` POST/GET.
- `LabOrder`, `LabOrderItem` persistidos.
- Generador de etiquetas y QR.
- Botones Guardar / Pagos / Cotizaciones / Cotizar.
**Demo:** alta de orden completa + etiqueta impresa.

### Slice C — Captura de resultados y ciclo de vida
**Goal:** `LabResult` con captura masiva + ciclo P/R/A/V + invalidación.
**Entregable:**
- `/lab/results` con filtros NOVA-style (folio, paciente, médico, estudio, fecha, hora, flags).
- Vista por paciente/orden: tabla de elementos con input editable, selección de unidad, validación contra rango.
- Botones P/R/A/V con cambio de estado y autorización con motivo.
- Generador de PDF "Hoja de trabajo" (estilo NOVA cuadernillo).
**Demo:** captura de BH completa, autorización, invalidación con motivo.

### Slice D — Trazabilidad y bitácora
**Goal:** `LabTraceEvent` + `LabResultAudit`.
**Entregable:**
- `/lab/trazabilidad` con filtros y vista cronológica muestra → proceso → validación → entrega.
- Bitácora inmutable de cada cambio en resultado (snapshots before/after).
- Export CSV.
**Demo:** consulta de trazabilidad por folio, ver eventos cronológicos, exportar.

### Slice E — Catálogo de Estudios/Elementos/Unidades/ValoresRef
**Goal:** Editor especializado para configurar el catálogo LIS.
**Entregable:**
- Editor de `MedicalTest` extendido con tipo LIS.
- Editor de `LabAnalyte` hijo.
- Editor de `LabReferenceRange` por edad/sexo.
- Editor de fórmulas (calculadora simple).
- Templates de respuestas predefinidas por estudio.
**Demo:** crear estudio "Perfil lipídico" con 6 analitos y rangos.

### Slice F — Reportes imprimibles
**Goal:** Reimprimir etiquetas, cotizaciones, recibos y resultados.
**Entregable:**
- Templates PDF (reportlab) para etiquetas con QR, cotización, recibo de pago, resultado.
- `/lab/reprint/etiquetas`, `/lab/reprint/cotizaciones`, `/lab/reprint/recibos`, `/lab/reprint/resultados`.
- Reutilizar `pdf_ebook_writer` para resultados.
**Demo:** reimprimir resultado PDF idéntico al de NOVA.

### Slice G — Caja del laboratorio
**Goal:** Tesorería, cortesías, corte de caja.
**Entregable:**
- `/lab/cash` con movimientos del día (forma pago, moneda, tipo cambio).
- `/lab/courtesy` para registrar órdenes sin cargo.
- `/lab/cash-closing` para corte.
**Demo:** abrir caja, registrar abonos, cerrar con corte.

### Slice H — Migración de datos desde NOVA
**Goal:** Script de migración idempotente y validado contra dump NOVA.
**Entregable:**
- `backend/scripts/migrate_nova.py` con todos los pasos.
- Modo `--dry-run` para auditoría previa.
- Reporte final con conteos y errores.
**Demo:** correr migración sobre dump Frank, mostrar reporte.

### Slice I — Cutover y deprecación
**Goal:** AMI es el único sistema operativo.
**Entregable:**
- Comunicación a Lolis/Leticia/Dra. Erika con fechas y checklist.
- Modo "solo lectura" en NOVA.
- Snapshot final de NOVA archivado.
- Banner en AMI con fecha "NOVA deprecado".
**Demo:** AMI captura una orden end-to-end + resultado + recibo sin tocar NOVA.

---

## 5. ALTERNATIVAS DESCARTADAS

### Alt-1. Migrar NOVA a PHP+PHP en AMI (mantener stack NOVA)
**Razón de descarte:** AMI es Next.js + Prisma; introducir PHP bifurca el código y rompe la governance de INTEGRA/SOFIA. Costo operativo doble.

### Alt-2. Puente API NOVA↔AMI (sin absorber)
**Razón de descarte:** perpetúa la doble captura, no resuelve la fricción operativa. Solo útil como fase de transición, no como destino final.

### Alt-3. Reemplazar AMI por NOVA
**Razón de descarte:** NOVA es solo LIS; AMI tiene gestión de trabajadores, expediente clínico, IA clínica, proyectos, calendario, papeleta, reportes masivos — todos fuera del alcance de NOVA.

---

## 6. CONSECUENCIAS

### Positivas
- Operación unificada: un solo login, un solo expediente por paciente.
- Correlación automática paciente ↔ resultado ↔ interpretación clínica.
- Eliminación del licenciamiento NOVA.
- Resultado de laboratorio visible en el expediente del trabajador para el médico ocupacional.
- PDF de resultados unificado con la papeleta (puede reusar `pdf_writer`/reportlab de AMI).
- Base para futuro entrenamiento MedGemma con datos estructurales LIS.

### Negativas / Riesgos
- **Riesgo datos**: la migración de NOVA puede traer inconsistencias históricas que AMI ahora tendrá que gestionar.
  - **Mitigación**: modo `--dry-run` obligatorio; doble revisión post-migración por Frank + Lolis.
- **Riesgo operativo**: durante el periodo de coexistencia, captura dual sigue existiendo.
  - **Mitigación**: plazo explícito de cutover (Frank fija fecha).
- **Riesgo funcional**: NOVA tiene 13 años de UX pulida; el demo AMI puede no alcanzar paridad al 100% desde el primer slice.
  - **Mitigación**: feedback explícito post-demo por Lolis/Dra. Erika; iteración en slices posteriores.
- **Riesgo performance**: AMI nunca ha gestionado ~10-50k órdenes/mes. Carga nueva en DB.
  - **Mitigación**: tests de carga en staging; índices Prisma por `clave_nova`, `createdAt`, `sucursalId`.
- **Riesgo técnico**: extensa nueva tabla `LabAnalyte`-relacionada. Migración Prisma grande.
  - **Mitigación**: aplicar en staging primero; rollback ya tipado en `context/infra`.

### Trade-offs aceptados
- **Trade-off**: AMI aumenta su superficie ~50% en este quarter.
  - **Aceptado por Frank** porque ahora el LIS es el módulo más usado de AMI.
- **Trade-off**: NOVA ya no se mantiene por el cliente.
  - **Aceptado** porque Frank controla el código (es interno de ustedes).

---

## 7. PRÓXIMOS PASOS INMEDIATOS

1. **Frank ejecutó 2026-06-30 22:16**:
   - (a) Política de datos confirmada: persistentes = TODOS, operativos = solo último mes desde `2026-05-31`. ✅
   - (b) Sin acceso a BD NOVA: se mantiene inferencia. ✅
   - (c) Frank solicita a NOVA eliminar el usuario `FRANCISCO` al cerrar la auditoría. Pendiente acción administrativa fuera del scope del repo.
2. **INTEGRA** crea `SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md` con handoff ejecutable para el Slice A. ✅
3. **SOFIA** ejecuta Slice A; **GEMINI** valida; **INTEGRA** aprueba merge. Pendiente OK de Frank para arrancar.
4. **Frank** revisa demo `/admin/lab/catalogs?mod=unidades` y aprueba seguir con Slice B.
5. Repite por cada slice (B a I).
6. **Frank** notifica a NOVA cuando Slice E (catálogo de Estudios/Elementos/Perfiles/Unidades/ValoresRef) y Slice H (migración) estén en verde, para que NOVA prepare el corte operativo.

---

## 8. REFERENCIAS

- `context/audits/nova-20260630/AUDIT-NOVA-COMPLETO.md` — informe forense
- `context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md` — spec del demo
- `context/decisions/ADR-20260527-10-ADMISION-TRES-FLUJOS-Y-CONVERGENCIA-A-EVENT.md` — patrón de slices ya usado
- `PROYECTO.md` línea 17 (2026-06-30): sesión de auditoría que origina este ADR
