# CONFIRMACIÓN DE FLUJO NOVA — Frank 2026-07-07 20:25

**ID:** `CONF-20260707-01-FLUJO-NOVA`
**Origen:** Mensaje Frank 2026-07-07 20:25 CST sobre el flujo correcto de admisión de laboratorio
**Estado:** [✓] Confirmado entendimiento, pendiente decisión final
**Conclusión:** El modelo de Frank es el correcto y cambia el SPEC del Slice B/D.

---

## 1. Frank pausó el demo y reveló el modelo operativo real

> *"En la papeleta vienen marcados los laboratorios, inclusos lo sabes desde el perfil de empleo que tiene el paciente. Lo único que sucede en la papeleta es que se toma la muestra. Entonces si se toma la muestra ya podría generar automáticamente la recepción del laboratorio."*

## 2. Modelo correcto (validado contra el schema AMI)

### 2.1 El modelo de datos ya soporta el flujo

```
JobPosition (cargo)
  └── Define QUÉ tests se le hacen al trabajador (vía ServiceProfile + ProfileTest)

MedicalEvent (papeleta)
  └── eventTests: EventTest[]  ← LOS TESTS YA VIENEN DE LA PAPELETA
       ↓
       EventTest {
         testId → MedicalTest
         status: PENDING → SAMPLE_TAKEN → RESULT_REGISTERED → COMPLETED
       }
       ↓
       Si MedicalTest.categoryId === "Laboratorio" → es un examen de laboratorio
```

**Categorías existentes en DB** (verificado):
- 64d3f863 → **Laboratorio** ← esta es la que nos interesa
- 98a62682 → Estudios Generales / Sala
- 2a47d870 → Imagenología (Rayos X)
- 45394271 → Ambulancia / Otros
- 16e98530 → Estudios Generales
- b66dfce5 → Imagenología
- d95c34f6 → Ambulancia

**Status del EventTest** (enum verificado):
- PENDING, **SAMPLE_TAKEN** ← trigger de "toma de muestra", IN_PROGRESS, RESULT_REGISTERED, COMPLETED, CANCELLED, SKIPPED

### 2.2 Flujo operativo real

```
PASO 1 — Programación del cargo (administrativo)
  JobPosition "Soldador"
    → ProfileTest: BH, Audiometría, Espirometría, RX Tórax
    → Se asigna al Worker

PASO 2 — Crear papeleta (desde cita o walk-in)
  → Worker llega con su cita
  → Sistema crea MedicalEvent
  → EventTests se pre-llenan del perfil del cargo
  → Algunos son laboratorio, otros audiometría, otros RX, etc.

PASO 3 — Atención en consultorio
  → Médico/enfermera ATIENDE al paciente
  → Por cada EventTest, realiza el examen
  → Para laboratorios: TOMA LA MUESTRA → status = SAMPLE_TAKEN
  → Para audiometría: realiza el estudio → status = RESULT_REGISTERED + fileUrl
  → Para RX: toma la imagen → status = RESULT_REGISTERED + fileUrl

PASO 4 — Recepción de Laboratorio (NUEVA VISTA)
  → Muestra papeletas con EventTests en SAMPLE_TAKEN
  → Filtra por categoría Laboratorio
  → Click en papeleta → auto-rellena admisión con:
     - workerId (paciente)
     - doctorName (médico que atendió)
     - companyId (empresa del paciente)
     - medicalEventId (la papeleta)
     - Estudios = los EventTests SAMPLE_TAKEN de categoría Laboratorio
  → Recepcionista CONFIRMA folio LabOrder
  → LabOrder se crea con auto-llenado

PASO 5 — Captura de resultados (Slice C/E)
  → Una vez el lab procesa la muestra
  → Recepcionista/auxiliar CAPTURA resultados por analito
  → Validación contra rangos (verde/amarillo/rojo)
  → Ciclo P/R/A/V (Pendiente/Reportado/Autorizado/Validado)

PASO 6 — Entrega
  → Resultado final vinculado a la papeleta
  → Visible para el médico en `/events/[id]`
```

## 3. Implicaciones para NOVA absorción

### 3.1 Lo que cambia del SPEC original (DA-3 Slice B)

**Antes** (mi modelo equivocado):
```
/lab/reception
  → Nueva Admisión (form manual)
     → buscar paciente (autocomplete)
     → escribir médico
     → buscar empresa
     → agregar estudios
     → confirmar
  → Lista de órdenes recientes
```

**Después** (modelo de Frank):
```
/lab/reception
  → Bandeja de Papeletas con Labs Pendientes (vista principal)
     → Lista de MedicalEvent con EventTests SAMPLE_TAKEN de cat Laboratorio
     → Click en papeleta → pre-llena admisión
  → [Admisión manual] (fallback para pacientes sin papeleta)
```

### 3.2 Lo que se conserva de Slice B

✅ Modelo `LabOrder` con `medicalEventId` (FK opcional) — **esencial para la integración**
✅ Modelo `LabOrderItem` con `eventTestId` (FK opcional) — **vinculará con EventTest**
✅ Endpoints CRUD de LabOrder
✅ Server actions de admisión
✅ Sidebar "🧬 Recepción Lab"
✅ Schema Prisma de Slice B
✅ Migración Railway aplicada

### 3.3 Lo que cambia de Slice C

✅ `LabResult.eventTestId` (FK opcional) — **perfecto, ya está**
✅ `LabResult.labOrderItemId` (FK obligatoria) — **encadenado correctamente**
✅ Worklist de captura — **encaja con el flujo**

### 3.4 Lo que se agrega (nuevo trabajo)

1. **UI de bandeja de papeletas** en `/lab/reception` (reemplaza el form manual como vista principal)
2. **Pre-llenado automático** desde `MedicalEvent` → `LabOrder` con todos los campos derivados
3. **Lógica de filtrado** por `EventTest.testId.categoryId === Laboratorio`
4. **Trigger** al cambiar `EventTest.status` a `SAMPLE_TAKEN`:
   - O se crea `LabOrder` automáticamente (background)
   - O se muestra en la bandeja para que el recepcionista la confirme
5. **Botón "Toma de muestra"** en `/events/[id]` (opcional, si no existe ya)
6. **Vista de papeleta actualizada** con sección "Laboratorio" mostrando los `EventTest` SAMPLE_TAKEN

## 4. Decisiones que necesito de Frank

### 4.1 ¿Cómo se dispara la creación de la LabOrder?
- **A) Automática:** al cambiar `EventTest.status` a `SAMPLE_TAKEN` → trigger crea `LabOrder` con status DRAFT
- **B) Manual en bandeja:** recepcionista ve la papeleta con `EventTest` SAMPLE_TAKEN → click "Crear LabOrder" → se crea
- **C) Híbrido:** trigger automático crea el DRAFT + bandeja muestra para que recepcionista CONFIRME el folio

**Recomendación:** Opción C. Recepcionista mantiene control del folio pero no re-captura datos.

### 4.2 ¿Qué hacer con admisión manual legacy?
- **A) Eliminar:** solo admisión por papeleta
- **B) Mantener como fallback:** tab/button secundario para pacientes externos sin papeleta

**Recomendación:** Opción B. Pacientes externos (sin cita previa) son un caso real.

### 4.3 ¿Cuándo aplico este cambio?
- **A) Ahora (antes del demo):** reagendar SPEC de Slice B y volver a implementar
- **B) Demo primero:** mostrar el flujo manual actual para validar UI, después migrar
- **C) Slice E/D:** hacerlo en un slice posterior cuando se re-piense el flujo completo

**Recomendación:** Opción A. El modelo de Frank es el correcto, vale la pena re-hacer Slice B correctamente.

### 4.4 ¿"Toma de muestra" en qué UI se marca?
- **A) Botón en `/events/[id]`:** "Tomar muestra" por cada EventTest
- **B) Pantalla dedicada:** `/events/[id]/sample` o similar
- **C) Ya existe:** el sistema actual ya lo hace de otra forma que desconozco

**Recomendación:** Opción A. Botón en `/events/[id]` por cada EventTest de tipo Laboratorio. Frank lo confirma si ya hay otra forma.

## 5. Plan de acción propuesto (si Frank aprueba)

### 5.1 Re-arquitectura Slice B (rehacer)

1. **Frontend `/lab/reception`** cambia radicalmente:
   - Vista principal: bandeja de papeletas con `EventTest` SAMPLE_TAKEN de Laboratorio
   - Click en papeleta → `/lab/reception/new?medicalEventId=X` (auto-llenado)
   - Form de admisión se pre-llena desde `MedicalEvent` + `EventTest`s
   - Tab/fallback: admisión manual para casos sin papeleta

2. **Nuevo endpoint backend:** `GET /api/v1/lab/pending-orders?branchId=X`
   - Lista `MedicalEvent` con `EventTest` SAMPLE_TAKEN + cat=Laboratorio
   - Incluye: paciente, médico, empresa, lista de tests pendientes

3. **Trigger al SAMPLE_TAKEN** (opción C híbrida):
   - Al cambiar `EventTest.status` a `SAMPLE_TAKEN` (vía API o UI):
     - Crear automáticamente `LabOrder` con `medicalEventId` y `eventTestId`s
     - Status DRAFT
   - Recepcionista lo confirma en `/lab/reception`

4. **UI `EventTest.status` change:**
   - En `/events/[id]`, agregar botón "Tomar muestra" por cada EventTest de cat=Laboratorio
   - On click: cambiar status a SAMPLE_TAKEN → trigger crea LabOrder

### 5.2 Tiempo estimado

- Re-arquitectura Slice B: 4-6 horas (similar al Slice B original)
- Trigger automático: 1-2 horas
- UI botón "Tomar muestra" en papeleta: 1 hora
- Tests: 1-2 horas
- **Total: 7-11 horas** (similar a un slice nuevo)

## 6. Recomendación final de INTEGRA

Frank, tu modelo es **claramente el correcto**. Mi Slice B original era equivocado — capturaba datos que ya existían en la papeleta.

**Mi recomendación:**
1. Pausar demo del flujo manual actual
2. Re-arquitecturar Slice B con el nuevo modelo
3. Implementar primero el trigger + UI de "Toma de muestra"
4. Después seguir con Slice C/D/E con la base correcta

Avísame tu decisión. Si apruebas la opción A (rehacer), lanzo SOFIA con el nuevo SPEC.
