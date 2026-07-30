# SPEC-IMPL-20260729-FLUJO-END-TO-END — Flujo completo: Empresa → Trabajador → Cita → Papeleta → Exámenes → Dictamen

**ID:** `IMPL-20260729-E2E`  
**Fecha:** 2026-07-29  
**Prioridad:** P0 (Crítica)  
**Tipo:** Implementación + Validación E2E  
**Estado:** [~] En especificación  

---

## 1. Objetivo

Completar y validar un flujo end-to-end completo del sistema AMI que cubra todo el ciclo de vida de atención médica industrial:

1. **Crear empresa cliente** con datos completos
2. **Crear trabajador** asociado a la empresa
3. **Generar perfil médico** con catálogo de estudios requeridos
4. **Asignar perfil a puesto de trabajo**
5. **Generar cita** para el trabajador
6. **Pasar por recepción/piso clínico** (check-in, corroboración identidad)
7. **Generar papeleta** (MedicalEvent) con estudios pre-cargados del perfil
8. **Llenar examen médico** en papeleta (somatometría, agudeza visual, antecedentes)
9. **Subir estudios IA**: audiometría (XML/PDF) y espirometría (PDF)
10. **Generar prediagnóstico IA** automático para cada estudio
11. **Revisar y validar resultados** de laboratorio si aplica
12. **Generar dictamen final** del evento médico
13. **Cerrar papeleta** y dejar evidencia completa

---

## 2. Contexto técnico

### Módulos existentes (verificados en código)

| Módulo | Estado | Ruta principal | Observaciones |
|---|---|---|---|
| Empresas | ✅ Operativo | `/companies` | CRUD completo, ficha v2 con vendedor |
| Trabajadores | ✅ Operativo | `/workers` | Alta individual y masiva desde Excel |
| Perfiles médicos | ✅ Operativo | `/admin/profiles` | Catálogo de perfiles por empresa |
| Puestos | ✅ Operativo | Integrado en `/companies/[id]` | DefaultProfileId asignable |
| Citas | ✅ Operativo | `/appointments` | Calendario, agenda por sucursal |
| Recepción | ✅ Operativo | `/reception` | Check-in, corroboración identidad |
| Eventos/Papeletas | ✅ Operativo | `/events/[id]` | MedicalEvent con EventTests |
| Laboratorio (LIS) | ✅ Operativo | `/lab/*` | Recepción, resultados, caja, trazabilidad |
| Proyectos | ✅ Operativo | `/projects` | Campañas empresariales con calendario |
| Unidades móviles | ✅ Operativo | `/admin/mobile-units` | Gestión de unidades externas |
| Reportes masivos | ✅ Operativo | `/reports` | PDF Ebook por proyecto |
| Calibración IA | ✅ Operativo | `/admin/services/[id]/calibration` | Prompts extraction/clinical por estudio |
| Prediagnóstico IA | ✅ Operativo | Integrado en papeleta | DR7.ai MedGemma-4b-it |
| Audiometría XML | ✅ Operativo | Parser directo | Sin IA, <100ms, 100% exacto |
| Espirometría PDF | ✅ Operativo | Upload + IA | Gemini extracción + DR7 clínico |

### Gaps detectados (requieren validación)

1. **Flujo completo nunca probado E2E**: Los módulos existen pero no hay prueba que valide el recorrido completo
2. **Integración perfil → papeleta**: Verificar que EventTests se pre-llenan correctamente desde ProfileTest
3. **Trigger LabOrder automático**: Confirmar que cambiar status a SAMPLE_TAKEN crea LabOrder DRAFT
4. **Prediagnóstico automático**: Verificar que upload de estudio dispara pipeline IA (extracción + prediagnóstico)
5. **Dictamen final**: Revisar si existe componente UI para cerrar dictamen médico del evento

---

## 3. Definition of Ready

- [x] Sistema productivo accesible (Vercel frontend + Railway backend + DB PostgreSQL)
- [x] Schema Prisma con todos los modelos requeridos (User, Company, Worker, JobPosition, MedicalProfile, Appointment, MedicalEvent, EventTest, LabOrder, LabResult, etc.)
- [x] Backend FastAPI con endpoints operativos
- [x] Frontend Next.js 16 con App Router
- [x] Seed data básico disponible (test categories, medical tests, users de prueba)
- [ ] Especificación aprobada por Frank
- [ ] Handoff a SOFIA documentado

---

## 4. Alcance detallado

### Fase 1: Preparación de datos maestros

#### 1.1 Crear empresa cliente
**Ruta:** `/companies` → Botón "Nueva Empresa"  
**Datos mínimos requeridos:**
- Nombre: "Servicios Robles S.A. de C.V." (ya existe en producción)
- RFC: `SER850101ABC`
- Dirección: Calle principal #123, Col. Centro
- Contacto: Juan Pérez
- Email/SMS para notificaciones

**Criterios de aceptación:**
- [ ] Empresa visible en lista `/companies`
- [ ] ID único generado (UUID)
- [ ] Ficha completa accesible en `/companies/[id]`

#### 1.2 Crear perfil médico para la empresa
**Ruta:** `/admin/profiles` o integrado en `/companies/[id]`  
**Nombre sugerido:** "Examen Médico General - Soldador"  
**Estudios incluidos:**
- GEN-01: Somatometría / Peso, Talla, Signos Vitales
- GEN-02: Agudeza Visual
- LAB-01: Biometría Hemática (BH)
- AUDIO-01: Audiometría Automática
- ESPIRO-01: Espirometría Forzada
- RX-TORAX: Radiografía de Tórax PA
- ECG-01: Electrocardiograma 12 derivaciones

**Criterios de aceptación:**
- [ ] Perfil creado con ID único
- [ ] Estudios asociados en tabla `profile_tests`
- [ ] Perfil visible en lista y editable

#### 1.3 Crear puesto de trabajo con perfil default
**Ruta:** `/companies/[id]` → Sección "Puestos de Trabajo"  
**Nombre:** "Soldador"  
**Perfil default:** Seleccionar perfil creado en 1.2  

**Criterios de aceptación:**
- [ ] Puesto creado con `defaultProfileId` apuntando al perfil médico
- [ ] Relación FK válida en BD
- [ ] Visible en UI de empresa

---

### Fase 2: Alta de trabajador y asignación

#### 2.1 Crear trabajador
**Ruta:** `/workers` → Botón "Nuevo Trabajador"  
**Datos mínimos:**
- Nombre: "JESSICA GABRIELA"
- Apellido: "MORENO GOMEZ"
- Fecha de nacimiento: 1990-01-15
- Género: Female
- CURP/RFC: opcional
- Teléfono/Email: para notificaciones
- Empresa: Seleccionar empresa creada en 1.1
- Puesto: Seleccionar puesto creado en 1.3

**Criterios de aceptación:**
- [ ] Worker creado con `universalId` único
- [ ] Asociado a `companyId` y `jobPositionId` correctos
- [ ] Visible en `/workers` y `/workers/[id]`

#### 2.2 (Opcional) Alta masiva desde Excel
**Ruta:** `/workers` → Botón "Importar Excel"  
**Aplica si:** Hay múltiples trabajadores para cargar

---

### Fase 3: Generación de cita

#### 3.1 Crear cita manual
**Ruta:** `/appointments` → Botón "Nueva Cita"  
**Datos:**
- Worker: Seleccionar trabajador creado en 2.1
- Sucursal: Branch default de la empresa
- Fecha/Hora: Próxima disponible según capacidad horaria
- Perfil médico: Auto-llenado desde `JobPosition.defaultProfileId`

**Criterios de aceptación:**
- [ ] Appointment creado con estado `SCHEDULED`
- [ ] Worker asociado
- [ ] Branch y MedicalProfile referenciados
- [ ] Visible en calendario `/appointments`

#### 3.2 (Alternativa) Admisión sin cita
**Ruta:** `/reception` → "Ingreso sin cita"  
**Aplica para:** Flujo de alta rápida mismo día

---

### Fase 4: Check-in y corroboración de identidad

#### 4.1 Corroborar identidad en recepción
**Ruta:** `/reception`  
**Acciones:**
- Buscar trabajador por nombre/INE/universalId
- Escanear o subir INE (frontal/posterior)
- Validar que persona coincide con foto
- Marcar como verificado (`Appointment.identityVerifiedAt`)

**Criterios de aceptación:**
- [ ] Appointment actualizado con `identityVerifiedByUserId` y `identityVerifiedAt`
- [ ] Documentos de identidad persistidos en storage
- [ ] Worker actualizado con última identidad verificada

---

### Fase 5: Generación de papeleta (MedicalEvent)

#### 5.1 Crear evento médico desde cita
**Ruta:** Desde `/appointments` → Click en cita → "Iniciar atención"  
**O alternativamente:** `/events` → "Nueva Papeleta"  

**Backend action:** `createMedicalEventFromAppointment()`  
**Resultado esperado:**
- MedicalEvent creado con:
  - `workerId` del trabajador
  - `companyId` de la empresa
  - `branchId` de la sucursal
  - `medicalProfileId` del perfil
  - `status = IN_PROGRESS`
- EventTests creados automáticamente desde ProfileTest:
  - Cada EventTest con:
    - `testId` apuntando a MedicalTest
    - `testNameSnapshot` copiado del catálogo
    - `status = PENDING`
    - `eventId` referenciando el nuevo evento

**Criterios de aceptación:**
- [ ] MedicalEvent visible en `/events`
- [ ] EventTests listados en `/events/[id]`
- [ ] Todos los estudios del perfil aparecen como EventTest
- [ ] Status inicial de EventTests es PENDING

---

### Fase 6: Llenado de examen médico en papeleta

#### 6.1 Abrir papeleta y llenar datos clínicos
**Ruta:** `/events/[id]`  

**Secciones a completar:**

**A. Antecedentes clínicos (ClinicalHistory)**
- Enfermedades previas
- Medicamentos actuales
- Alergias
- Cirugías
- Hospitalizaciones
- Hábitos (tabaco, alcohol, ejercicio)

**B. Somatometría (GEN-01)**
- Peso (kg)
- Talla (cm)
- IMC calculado automático
- Presión arterial sistólica/diastólica
- Frecuencia cardiaca
- Temperatura
- Saturación O2

**C. Agudeza Visual (GEN-02)**
- OD (ojo derecho): decimal o Snellen
- OI (ojo izquierdo): decimal o Snellen
- Corrección: sí/no
- Observaciones

**Criterios de aceptación:**
- [ ] Datos persistidos en BD
- [ ] ClinicalHistory asociado a worker
- [ ] EventTests de somatometría y agudeza marcados como COMPLETED
- [ ] Valores visibles en UI de papeleta

---

### Fase 7: Subida de estudios IA (audiometría y espirometría)

#### 7.1 Subir archivo de audiometría
**Ruta:** `/events/[id]` → Sección "Audiometría" → "Subir archivo"  

**Formatos aceptados:**
- XML directo del audiómetro DD65 V2 (parser directo, 0 tokens IA)
- PDF escaneado del formato impreso (extracción IA con Gemini)

**Proceso backend:**
1. Upload a storage bucket (Railway persistent volume)
2. Si es XML: parser directo `audiometry_xml_parser.py` extrae umbrales
3. Si es PDF: pipeline IA con Gemini extracción estructural
4. Persistir snapshot en `EventTest.fileUrl`
5. Disparar prediagnóstico IA asíncrono vía DR7.ai

**Criterios de aceptación:**
- [ ] Archivo subido y URL persistida
- [ ] Umbrales extraídos visibles en tabla (8 frecuencias × 2 oídos)
- [ ] PTA (Pure Tone Average) calculado
- [ ] Panel "RAW de extracción" visible con JSON crudo
- [ ] Prediagnóstico generado automáticamente (<30s)
- [ ] Tarjeta de prediagnóstico visible con:
  - Clasificación por oído
  - Tipo de hipoacusia (si aplica)
  - Severidad
  - Justificación basada en reglas ATS/ERS
  - Recomendación clínica prudente

#### 7.2 Subir archivo de espirometría
**Ruta:** `/events/[id]` → Sección "Espirometría" → "Subir archivo"  

**Formato:** PDF del espirómetro  

**Proceso backend:**
1. Upload a storage
2. Extracción IA con Gemini (schema exhaustivo):
   - FEV1, FVC, FEV1/FVC ratio
   - % predicho, % ref, LLN
   - Curva flujo-volumen (presente/ausente)
   - Calidad técnica, repetibilidad
3. Persistir snapshot
4. Disparar prediagnóstico DR7.ai

**Criterios de aceptación:**
- [ ] Archivo subido
- [ ] Tabla de valores extraídos visible (M1/M2/M3, %ref, LLN)
- [ ] Parámetros antropométricos capturados (edad, sexo, talla)
- [ ] Prediagnóstico generado con:
  - Patrón obstructivo/restrictivo/normal
  - Severidad
  - Justificación
  - Recomendación

---

### Fase 8: Toma de muestra de laboratorio (si aplica)

#### 8.1 Marcar estudio de laboratorio como "muestra tomada"
**Ruta:** `/events/[id]` → Sección "Biometría Hemática" → Botón "Tomar muestra"  

**Backend trigger:**
- Cambiar `EventTest.status` de PENDING a `SAMPLE_TAKEN`
- **TRIGGER AUTOMÁTICO:** Crear LabOrder DRAFT con:
  - `workerId` del trabajador
  - `companyId` de la empresa
  - `medicalEventId` de la papeleta
  - `doctorName` del médico tratante
  - Items: `LabOrderItem` por cada EventTest de tipo laboratorio

**Criterios de aceptación:**
- [ ] EventTest.status = SAMPLE_TAKEN
- [ ] LabOrder creado visible en `/lab/reception`
- [ ] Bandeja de papeletas en recepción muestra esta papeleta

#### 8.2 Recepción de laboratorio confirma folio
**Ruta:** `/lab/reception` → Click en papeleta → Confirmar admisión  

**Acciones:**
- Auto-llenar datos desde MedicalEvent
- Generar folio LabOrder único
- Cambiar status de DRAFT a SAVED
- Crear `LabTraceEvent` con timestamp SAMPLE_RECEIVED

**Criterios de aceptación:**
- [ ] LabOrder.status = SAVED
- [ ] Folio visible en papeleta original
- [ ] Trazabilidad iniciada

#### 8.3 Captura de resultados por técnico
**Ruta:** `/lab/results` → Seleccionar orden → Capturar analitos  

**Para BH:**
- Hemoglobina: valor g/dL
- Leucocitos: valor ×10³
- Plaquetas: valor ×10³
- etc.

**Validación visual:**
- Verde: dentro de rango
- Amarillo: borderline
- Rojo: crítico/alarma

**Ciclo de vida:**
- REPORTED → AUTHORIZED → VALIDATED

**Criterios de aceptación:**
- [ ] LabResult creado con todos los analitos
- [ ] Flags `isOutOfRange`, `isCritical`, `isAbnormal` calculados
- [ ] Bitácora de auditoría con snapshots before/after
- [ ] Resultado visible en papeleta `/events/[id]` sección "Laboratorio"

---

### Fase 9: Dictamen final y cierre de papeleta

#### 9.1 Generar dictamen médico final
**Ruta:** `/events/[id]` → Sección "Dictamen Final"  

**Componente UI requerido (si no existe):**
- Selector de aptitud laboral:
  - APTO
  - APTO CON RESTRICCIONES
  - NO APTO
- Campo de texto para conclusiones médicas
- Recomendaciones generales
- Firma digital del médico (`userId` de quien firma)

**Backend action:** `closeMedicalEvent(eventId, verdict)`  
**Persistencia:**
- MedicalEvent.status = CLOSED
- MedicalVerdict creado con:
  - `eventId`
  - `aptitude` (APTO/NO_APTO/etc)
  - `conclusions`
  - `recommendations`
  - `signedByUserId`
  - `signedAt` timestamp

**Criterios de aceptación:**
- [ ] Dictamen persistido en BD
- [ ] MedicalEvent.status cambiado a CLOSED
- [ ] Firma médica registrada
- [ ] PDF de papeleta completo generable (incluyendo todos los estudios, resultados y dictamen)

---

## 5. Criterios de validación E2E

### Suite de pruebas Playwright requerida

**Archivo:** `frontend/tests/flujo-completo.spec.ts`

**Test cases:**

1. **TC-01: Crear empresa y perfil**
   - Navegar a `/companies`
   - Crear empresa nueva
   - Verificar creación exitosa
   - Navegar a `/admin/profiles`
   - Crear perfil con 7 estudios
   - Asignar perfil a puesto en empresa

2. **TC-02: Crear trabajador y cita**
   - Navegar a `/workers`
   - Crear trabajador asociado a empresa y puesto
   - Navegar a `/appointments`
   - Crear cita para trabajador
   - Verificar cita en calendario

3. **TC-03: Check-in y generación de papeleta**
   - Navegar a `/reception`
   - Corroborar identidad de trabajador
   - Iniciar atención desde cita
   - Verificar MedicalEvent creado
   - Verificar EventTests pre-llenados (deben ser 7)

4. **TC-04: Llenar examen médico**
   - Abrir `/events/[id]`
   - Completar antecedentes clínicos
   - Capturar somatometría (peso, talla, PA)
   - Capturar agudeza visual (OD/OI)
   - Verificar persistencia

5. **TC-05: Subir audiometría XML**
   - Usar archivo de prueba `context/PACIENTES/JESSICA GABRIELA.xml`
   - Subir en sección Audiometría de papeleta
   - Esperar parser XML (<100ms)
   - Verificar tabla de umbrales (8 frecuencias × 2 oídos)
   - Verificar PTA calculado
   - Verificar prediagnóstico generado

6. **TC-06: Subir espirometría PDF**
   - Usar archivo PDF de espirómetro de prueba
   - Subir en sección Espirometría
   - Esperar extracción IA (~10s)
   - Verificar tabla de valores (FEV1, FVC, ratio)
   - Verificar prediagnóstico generado

7. **TC-07: Toma de muestra y resultados lab**
   - Click "Tomar muestra" en BH
   - Verificar LabOrder creado en `/lab/reception`
   - Confirmar admisión en recepción
   - Capturar resultados de BH
   - Validar colores de rangos
   - Autorizar y validar resultado
   - Verificar resultado visible en papeleta

8. **TC-08: Dictamen final y cierre**
   - Completar todas las secciones pendientes
   - Generar dictamen (seleccionar APTO)
   - Firmar con usuario médico
   - Verificar MedicalEvent.status = CLOSED
   - Descargar PDF completo de papeleta

---

## 6. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Upload de archivos falla (storage no configurado) | Media | Alto | Verificar env vars `STORAGE_BUCKET_URL` y permisos |
| Pipeline IA timeout (>30s) | Media | Medio | Implementar polling con progress bar |
| LabOrder trigger no dispara | Baja | Alto | Test manual de endpoint antes de E2E |
| Prediagnóstico retorna AI_NON_CONCLUSIVE | Media | Bajo | Mostrar mensaje informativo al usuario |
| Falta de seed data (test categories vacías) | Baja | Alto | Ejecutar `pnpm prisma db seed` antes de pruebas |
| Typecheck/lint errors bloqueantes | Alta | Medio | Documentar deuda técnica existente, no bloquear |

---

## 7. Estimación

| Fase | Complejidad | Tiempo estimado |
|---|---|---|
| 1. Preparación datos maestros | Baja | 1h |
| 2. Alta trabajador | Baja | 0.5h |
| 3. Generación cita | Baja | 0.5h |
| 4. Check-in | Baja | 0.5h |
| 5. Generación papeleta | Media | 1h (validar trigger) |
| 6. Llenado examen médico | Baja | 1h |
| 7. Upload estudios IA | Media | 2h (validar pipelines) |
| 8. Laboratorio | Media | 2h (validar trigger + captura) |
| 9. Dictamen final | Media | 1h (crear UI si falta) |
| Tests E2E | Alta | 4h |
| **Total** | | **~13.5 horas** |

---

## 8. Dependencias

### Servicios externos requeridos
- **DR7.ai API key**: Para prediagnóstico clínico (MedGemma-4b-it)
- **Gemini API key**: Para extracción documental de PDFs
- **Railway PostgreSQL**: BD persistente con migraciones aplicadas
- **Storage bucket**: Para uploads de archivos (persistent volume o S3-compatible)

### Migraciones de BD
- Todas las migraciones Prisma deben estar aplicadas en producción
- Verificar con script `check-migrations-state.ts`

### Seed data
- TestCategory: al menos 5 categorías (General, Laboratorio, Audiología, Neumología, Imagen)
- MedicalTest: al menos 15 estudios con códigos (GEN-01, GEN-02, LAB-01, AUDIO-01, ESPIRO-01, etc.)
- Users: al menos 1 ADMIN, 1 DOCTOR_GENERAL, 1 RECEPTIONIST

---

## 9. Entregables

1. **SPEC firmada**: Este documento
2. **Handoff a SOFIA**: Documento de implementación detallado
3. **Tests E2E**: Suite Playwright con 8 test cases
4. **Checkpoint**: `context/checkpoints/CHK_IMPL-20260729-FLUJO-E2E.md`
5. **Demo grabado**: Video o screenshots del flujo completo funcionando
6. **Reporte de bugs**: Lista de issues encontrados durante validación

---

## 10. Definición de Done

- [ ] SPEC revisada y aprobada por Frank
- [ ] Handoff a SOFIA generado
- [ ] Flujo completo implementado (si faltaba algo)
- [ ] Tests E2E pasando (8/8)
- [ ] Demo funcional en producción o staging
- [ ] Checkpoint documentado
- [ ] PROYECTO.md actualizado con estado DONE
- [ ] GEMINI auditoría aprobada (si cambios no triviales)

---

**Estado:** [~] Pendiente aprobación de Frank para generar handoff a SOFIA
