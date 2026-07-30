# HANDOFF_IMPL-20260729-FLUJO-E2E — Implementación flujo end-to-end completo

**Para:** @SOFIA  
**De:** @INTEGRA  
**Fecha:** 2026-07-29  
**SPEC referencia:** `context/SPECs/SPEC_IMPL-20260729-FLUJO-END-TO-END.md`  
**Prioridad:** P0 (Crítica)  

---

## 1. Contexto

Frank solicitó completar y validar un flujo end-to-end completo del sistema AMI que cubra:
**Empresa → Trabajador → Cita → Recepción → Papeleta → Exámenes → Upload IA → Laboratorio → Dictamen → Cierre**

Los módulos existen pero **nunca se probó el recorrido completo**. Esta implementación requiere validar cada integración y crear lo que falte.

---

## 2. Trabajo requerido

### Fase 1: Validar preparación de datos maestros

#### Tarea 1.1: Verificar creación de empresa
- [ ] Navegar a `/companies` y crear empresa de prueba
- [ ] Verificar que se persiste en BD con UUID único
- [ ] Confirmar que ficha `/companies/[id]` muestra datos completos

**Comandos útiles:**
```bash
# Backend: verificar empresa creada
curl -H "Authorization: Bearer <token>" \
  http://localhost:8000/api/v1/companies/<company_id>
```

#### Tarea 1.2: Crear perfil médico con estudios
- [ ] Navegar a `/admin/profiles` o integrado en empresa
- [ ] Crear perfil "Examen Médico General - Soldador"
- [ ] Asociar 7 estudios mínimos:
  - GEN-01 (Somatometría)
  - GEN-02 (Agudeza Visual)
  - LAB-01 (Biometría Hemática)
  - AUDIO-01 (Audiometría)
  - ESPIRO-01 (Espirometría)
  - RX-TORAX
  - ECG-01
- [ ] Verificar tabla `profile_tests` en BD

**SQL verificación:**
```sql
SELECT pt.profile_id, mt.code, mt.name
FROM profile_tests pt
JOIN medical_tests mt ON pt.test_id = mt.id
WHERE pt.profile_id = '<profile_uuid>';
```

#### Tarea 1.3: Asignar perfil a puesto de trabajo
- [ ] En `/companies/[id]`, sección "Puestos de Trabajo"
- [ ] Crear puesto "Soldador"
- [ ] Asignar `defaultProfileId` al perfil creado
- [ ] Verificar FK válida en BD

---

### Fase 2: Validar alta de trabajador

#### Tarea 2.1: Crear trabajador individual
- [ ] Navegar a `/workers` → "Nuevo Trabajador"
- [ ] Llenar datos mínimos (nombre, apellido, empresa, puesto)
- [ ] Verificar `universalId` generado automáticamente
- [ ] Confirmar asociación a `companyId` y `jobPositionId`

**Backend endpoint:**
```python
POST /api/v1/workers
{
  "firstName": "JESSICA GABRIELA",
  "lastName": "MORENO GOMEZ",
  "companyId": "<uuid>",
  "jobPositionId": "<uuid>"
}
```

#### Tarea 2.2: (Opcional) Probar alta masiva desde Excel
- [ ] Usar botón "Importar Excel" en `/workers`
- [ ] Subir archivo con 3-5 trabajadores de prueba
- [ ] Verificar todos creados correctamente

---

### Fase 3: Validar generación de cita

#### Tarea 3.1: Crear cita manual
- [ ] Navegar a `/appointments` → "Nueva Cita"
- [ ] Seleccionar trabajador creado
- [ ] Seleccionar sucursal default
- [ ] Elegir fecha/hora próxima
- [ ] Verificar que `medicalProfileId` se auto-llena desde puesto
- [ ] Confirmar cita creada con status `SCHEDULED`

**Verificación BD:**
```sql
SELECT id, worker_id, branch_id, medical_profile_id, status, scheduled_at
FROM appointments
WHERE worker_id = '<worker_uuid>'
ORDER BY created_at DESC
LIMIT 1;
```

---

### Fase 4: Validar check-in y corroboración identidad

#### Tarea 4.1: Corroborar identidad en recepción
- [ ] Navegar a `/reception`
- [ ] Buscar trabajador por nombre o INE
- [ ] Simular escaneo de INE (subir imagen placeholder)
- [ ] Click "Verificar identidad"
- [ ] Verificar Appointment actualizado con:
  - `identity_verified_by_user_id`
  - `identity_verified_at`

**Backend action reference:**
```typescript
// frontend/src/actions/worker.actions.ts
verifyIdentityAction(appointmentId, userId, documentUrls)
```

---

### Fase 5: Validar generación de papeleta (MedicalEvent)

#### Tarea 5.1: Iniciar atención desde cita
- [ ] En `/appointments`, click en cita creada
- [ ] Click "Iniciar atención" o "Generar papeleta"
- [ ] Verificar redirección a `/events/[id]`

#### Tarea 5.2: Verificar MedicalEvent creado
- [ ] MedicalEvent debe existir en BD con:
  - `worker_id` correcto
  - `company_id` correcto
  - `medical_profile_id` correcto
  - `status = 'IN_PROGRESS'`

**SQL verificación:**
```sql
SELECT id, worker_id, company_id, status, created_at
FROM medical_events
WHERE worker_id = '<worker_uuid>'
ORDER BY created_at DESC
LIMIT 1;
```

#### Tarea 5.3: CRÍTICO - Verificar EventTests pre-llenados
- [ ] Contar EventTests creados (deben ser 7, uno por estudio del perfil)
- [ ] Verificar cada EventTest tiene:
  - `event_id` apuntando al MedicalEvent
  - `test_id` apuntando a MedicalTest
  - `test_name_snapshot` copiado del catálogo
  - `status = 'PENDING'`

**SQL verificación:**
```sql
SELECT et.id, et.test_id, mt.code, et.test_name_snapshot, et.status
FROM event_tests et
JOIN medical_tests mt ON et.test_id = mt.id
WHERE et.event_id = '<event_uuid>'
ORDER BY mt.code;
```

**⚠️ GAP POTENCIAL:** Si EventTests NO se crean automáticamente, implementar trigger en backend:
```python
# backend/app/services/event_service.py
def create_medical_event_from_appointment(appointment_id):
    appointment = db.query(Appointment).filter(...).first()
    
    # Crear MedicalEvent
    event = MedicalEvent(...)
    db.add(event)
    db.commit()
    
    # CRÍTICO: Crear EventTests desde ProfileTest
    profile_tests = db.query(ProfileTest).filter(
        profile_id=appointment.medical_profile_id
    ).all()
    
    for pt in profile_tests:
        test = db.query(MedicalTest).filter(id=pt.test_id).first()
        event_test = EventTest(
            event_id=event.id,
            test_id=test.id,
            test_name_snapshot=test.name,
            status=EventTestStatus.PENDING
        )
        db.add(event_test)
    
    db.commit()
    return event
```

---

### Fase 6: Validar llenado de examen médico

#### Tarea 6.1: Completar antecedentes clínicos
- [ ] En `/events/[id]`, sección "Antecedentes"
- [ ] Llenar formulario con datos de prueba
- [ ] Verificar ClinicalHistory persistido en BD

#### Tarea 6.2: Capturar somatometría
- [ ] En EventTest de GEN-01, llenar:
  - Peso (ej: 70 kg)
  - Talla (ej: 165 cm)
  - IMC calculado automático
  - PA sistólica/diastólica (ej: 120/80)
  - FC (ej: 72 bpm)
- [ ] Verificar EventTest.status cambia a `COMPLETED`
- [ ] Verificar valores persistidos

#### Tarea 6.3: Capturar agudeza visual
- [ ] En EventTest de GEN-02, llenar:
  - OD: 1.0 (20/20)
  - OI: 0.8 (20/25)
- [ ] Verificar persistencia

**Backend endpoint ejemplo:**
```python
PATCH /api/v1/events/{event_id}/event-tests/{event_test_id}
{
  "selected_option": "COMPLETED",
  "result_data": {
    "weight": 70,
    "height": 165,
    "bmi": 25.7,
    "bp_systolic": 120,
    "bp_diastolic": 80
  }
}
```

---

### Fase 7: CRÍTICO - Validar upload de estudios IA

#### Tarea 7.1: Subir audiometría XML
- [ ] Usar archivo real: `context/PACIENTES/JESSICA GABRIELA.xml`
- [ ] En `/events/[id]`, sección "Audiometría" → "Subir archivo"
- [ ] Seleccionar archivo XML
- [ ] Verificar:
  - Upload exitoso (<1s)
  - Parser XML directo activa (NO usa IA)
  - Tabla de umbrales renderizada:
    - 8 frecuencias: 250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz
    - 2 oídos: ACL (izquierdo), ACR (derecho)
  - PTA calculado para cada oído
  - Panel "RAW de extracción" visible con JSON

**Verificación logs backend:**
```bash
# Debe aparecer en logs:
"Audiometry XML parsed directly: 16 points extracted in 45ms"
```

#### Tarea 7.2: Verificar prediagnóstico de audiometría
- [ ] Esperar ~10-30s después de upload
- [ ] Verificar tarjeta de prediagnóstico aparece con:
  - Clasificación por oído (ej: "Hipoacusia severa bilateral")
  - Tipo (conductiva, neurosensorial, mixta)
  - Severidad (leve, moderada, severa, profunda)
  - Justificación basada en reglas ATS/ERS
  - Recomendación clínica prudente

**Verificación BD:**
```sql
SELECT pd.id, pd.study_type, pd.classification, pd.severity, pd.justification
FROM study_prediagnosis pd
WHERE pd.event_test_id = '<audiometry_event_test_uuid>'
ORDER BY created_at DESC
LIMIT 1;
```

**⚠️ GAP POTENCIAL:** Si prediagnóstico NO se genera:
- Verificar DR7.ai API key configurada: `DR7_API_KEY` en env vars
- Revisar logs backend: `backend/app/services/prediagnostic.py`
- Test manual endpoint:
```bash
curl -X POST http://localhost:8000/api/v1/studies/prediagnose \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "event_test_id": "<uuid>",
    "study_type": "audiometry",
    "extracted_data": {...}
  }'
```

#### Tarea 7.3: Subir espirometría PDF
- [ ] Usar archivo PDF de espirómetro (crear placeholder si no hay uno real)
- [ ] En `/events/[id]`, sección "Espirometría" → "Subir archivo"
- [ ] Verificar:
  - Upload exitoso
  - Extracción IA con Gemini (~5-10s)
  - Tabla de valores extraídos:
    - FEV1, FVC, FEV1/FVC ratio
    - % predicho, % ref, LLN
    - Curva flujo-volumen presente/ausente
  - Panel "RAW de extracción" visible

#### Tarea 7.4: Verificar prediagnóstico de espirometría
- [ ] Esperar ~10-30s
- [ ] Verificar tarjeta con:
  - Patrón (obstructivo, restrictivo, normal)
  - Severidad
  - Justificación
  - Recomendación

---

### Fase 8: Validar flujo de laboratorio

#### Tarea 8.1: Marcar muestra como tomada
- [ ] En `/events/[id]`, sección "Biometría Hemática"
- [ ] Click "Tomar muestra"
- [ ] Verificar EventTest.status cambia a `SAMPLE_TAKEN`

#### Tarea 8.2: CRÍTICO - Verificar LabOrder creado automáticamente
- [ ] Navegar a `/lab/reception`
- [ ] Verificar bandeja muestra papeleta con EventTest SAMPLE_TAKEN
- [ ] Click en papeleta
- [ ] Verificar auto-llenado de datos (worker, empresa, médico)
- [ ] Confirmar admisión
- [ ] Verificar LabOrder.status cambia de DRAFT a SAVED
- [ ] Verificar folio generado

**⚠️ GAP POTENCIAL:** Si LabOrder NO se crea:
Implementar trigger en backend:
```python
# backend/app/services/lab_service.py
def confirm_sample_taken(event_test_id):
    event_test = db.query(EventTest).filter(id=event_test_id).first()
    event_test.status = EventTestStatus.SAMPLE_TAKEN
    
    # Verificar si ya existe LabOrder para este evento
    existing_order = db.query(LabOrder).filter(
        medical_event_id=event_test.event_id
    ).first()
    
    if not existing_order:
        # Crear LabOrder DRAFT
        lab_order = LabOrder(
            worker_id=event.worker_id,
            company_id=event.company_id,
            medical_event_id=event.id,
            doctor_name=event.doctor_name,
            status=LabOrderStatus.DRAFT
        )
        db.add(lab_order)
        db.commit()
        
        # Agregar items
        lab_item = LabOrderItem(
            lab_order_id=lab_order.id,
            medical_test_id=event_test.test_id,
            event_test_id=event_test.id
        )
        db.add(lab_item)
    
    db.commit()
```

#### Tarea 8.3: Capturar resultados de laboratorio
- [ ] Navegar a `/lab/results`
- [ ] Seleccionar orden creada
- [ ] Capturar valores de BH:
  - Hemoglobina: 14.5 g/dL
  - Leucocitos: 7.5 ×10³
  - Plaquetas: 250 ×10³
- [ ] Verificar colores de validación (verde/amarillo/rojo)
- [ ] Autorizar resultado
- [ ] Validar resultado
- [ ] Verificar LabResult.status = VALIDATED

#### Tarea 8.4: Verificar resultado visible en papeleta
- [ ] Volver a `/events/[id]`
- [ ] Sección "Laboratorio" debe mostrar:
  - Folio LabOrder
  - Valores de analitos con colores
  - Flags isOutOfRange/isCritical
  - Timestamp de validación

---

### Fase 9: Validar dictamen final y cierre

#### Tarea 9.1: Generar dictamen médico
- [ ] En `/events/[id]`, scroll a sección "Dictamen Final"
- [ ] **Si componente NO existe:** Crear componente nuevo:
  ```tsx
  // frontend/src/components/verdict/MedicalVerdictForm.tsx
  - Selector aptitud: APTO | APTO_CON_RESTRICCIONES | NO_APTO
  - Textarea conclusiones
  - Textarea recomendaciones
  - Botón "Firmar y cerrar"
  ```
- [ ] Seleccionar "APTO"
- [ ] Llenar conclusiones de prueba
- [ ] Click "Firmar y cerrar"

#### Tarea 9.2: Verificar cierre de papeleta
- [ ] MedicalEvent.status cambia a `CLOSED`
- [ ] MedicalVerdict creado en BD con:
  - `event_id` correcto
  - `aptitude` seleccionado
  - `signed_by_user_id` del médico
  - `signed_at` timestamp
- [ ] PDF de papeleta completo generable

**Backend endpoint:**
```python
POST /api/v1/events/{event_id}/close
{
  "verdict": {
    "aptitude": "APTO",
    "conclusions": "Paciente sin hallazgos patológicos...",
    "recommendations": "Control anual..."
  },
  "signed_by_user_id": "<user_uuid>"
}
```

---

## 3. Validaciones obligatorias antes de reportar

### 3.1 Typecheck
```bash
cd frontend && pnpm typecheck
```

### 3.2 Tests unitarios (si se crearon componentes nuevos)
```bash
cd frontend && pnpm test
```

### 3.3 Tests E2E mínimo (flujo crítico)
```bash
cd frontend && npx playwright test flujo-completo.spec.ts
```

### 3.4 Verificación manual en producción/staging
- [ ] Navegar todo el flujo en entorno real
- [ ] Tomar screenshots de cada fase
- [ ] Documentar cualquier bug encontrado

---

## 4. Archivos clave a revisar

### Backend
- `backend/app/api/v1/events.py` - CRUD MedicalEvent
- `backend/app/api/v1/event_tests.py` - Gestión EventTests
- `backend/app/services/event_service.py` - Creación MedicalEvent desde Appointment
- `backend/app/services/lab_service.py` - Triggers LabOrder
- `backend/app/services/prediagnostic.py` - Pipeline IA DR7.ai
- `backend/app/utils/audiometry_xml_parser.py` - Parser directo XML

### Frontend
- `frontend/src/app/events/[id]/page.tsx` - Vista papeleta
- `frontend/src/components/event/EventTestCard.tsx` - Tarjeta de estudio
- `frontend/src/components/upload/FileUploadWithAI.tsx` - Upload con pipeline IA
- `frontend/src/components/lab/LabReceptionBandeja.tsx` - Bandeja recepción
- `frontend/src/components/verdict/MedicalVerdictForm.tsx` - **CREAR SI NO EXISTE**

### Schema
- `frontend/prisma/schema.prisma` - Modelos MedicalEvent, EventTest, LabOrder, LabResult, MedicalVerdict

---

## 5. Comandos de diagnóstico

### Verificar migraciones aplicadas
```bash
cd frontend && npx prisma migrate status
```

### Verificar seed data
```bash
cd frontend && npx prisma db seed
```

### Verificar env vars críticas
```bash
# Backend .env
DR7_API_KEY=<clave>
GEMINI_API_KEY=<clave>
STORAGE_BUCKET_URL=<url>
DATABASE_URL=<postgres://...>
```

### Logs backend en tiempo real
```bash
# Railway
railway logs --service 'Administracion-medica-industrial'
```

---

## 6. Bugs conocidos a investigar

### Bug 1: Upload network changed
- **Síntoma:** `ERR_NETWORK_CHANGED` en upload interrumpe flujo sin manejo de error
- **SPEC fix:** `context/SPECs/SPEC_FIX-20260516-01-INSTRUMENTACION-UPLOAD-NETWORK-CHANGED.md`
- **Acción:** Agregar try/catch con logging estructurado

### Bug 2: Catálogo estados México vacío
- **Síntoma:** `<select>` de estados sin opciones en formulario público
- **Acción:** Verificar tabla `estados_mexico` tiene seed data

### Bug 3: Endpoint upload-only retorna 500
- **Síntoma:** HTTP 500 en `POST /api/v1/upload-only`
- **Causa probable:** Env vars de storage faltantes en producción
- **Acción:** Verificar configuración Railway

---

## 7. Reporte esperado

Al finalizar, generar reporte estructurado:

```markdown
## Resultado validación flujo end-to-end IMPL-20260729-E2E

### Fases completadas
- [x] Fase 1: Preparación datos maestros
- [x] Fase 2: Alta trabajador
- [ ] Fase 3: ...

### Gaps encontrados
1. EventTests no se crean automáticamente → IMPLEMENTADO
2. LabOrder trigger falta → IMPLEMENTADO
3. Componente dictamen no existe → CREADO

### Bugs encontrados
1. Upload falla con ERR_NETWORK_CHANGED → FIX PENDIENTE
2. ...

### Métricas
- Tiempo total flujo: XX minutos
- Estudios IA procesados: X/X
- Prediagnósticos generados: X/X
- Tests E2E pasando: X/8

### Archivos modificados
- `backend/app/services/event_service.py` (+50 líneas)
- `frontend/src/components/verdict/MedicalVerdictForm.tsx` (nuevo, 200 líneas)
- ...

### Screenshots
- [Adjuntar carpeta con screenshots de cada fase]
```

---

## 8. Escalamiento

**Escalar a INTEGRA si:**
- EventTests trigger requiere cambio arquitectónico mayor
- LabOrder creation conflictúa con Slice B/C/D de NOVA
- Más de 2 enfoques fallidos en mismo problema

**Escalar a DEBUGGER si:**
- Upload de archivos falla consistentemente
- Pipeline IA retorna errores 503 repetidos
- Prediagnóstico nunca completa (>2min timeout)

**Escalar a GEMINI si:**
- Cambios no triviales requieren auditoría antes de merge
- Typecheck/lint errors nuevos introducidos

---

**Estado:** [/] Listo para implementación por SOFIA
