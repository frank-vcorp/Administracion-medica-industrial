# Checklist: Simulación End-to-End Proyecto Beta

**ID:** TEST-20260711-01  
**Fecha:** 2026-07-11  
**Objetivo:** Validar flujo completo desde alta de empresa hasta dictamen médico  
**Pacientes:** Cervantes Celedon Damian (161745) + Carrazco Suarez Alvaro (167555)

---

## 📋 FASE 1: ALTA DE EMPRESA VÍA LINK DE VENDEDOR

### 1.1 Generación de Link (Rol: VENDEDOR)
- [ ] Login como `vendedor@ami.com` / `Vendor@123`
- [ ] Navegar a `/companies` o sección de ventas
- [ ] Generar link de auto-alta para empresa
- [ ] Copiar link público (formato: `/solicitar-alta?token=...`)
- [ ] **Validar:** Link incluye `ref=<userId>` del vendedor (trazabilidad)

### 1.2 Auto-Alta de Empresa (Rol: EMPRESA CLIENTE - sin login)
- [ ] Abrir link en navegador incógnito (simular prospecto)
- [ ] Llenar formulario de alta de empresa:
  - [ ] Nombre: "Servicios Robles S.A. de C.V." (o nombre real)
  - [ ] RFC
  - [ ] Dirección
  - [ ] Teléfono
  - [ ] Email corporativo
  - [ ] Contacto principal
- [ ] Submit del formulario
- [ ] **Validar:** Empresa creada con status `HABILITADO`
- [ ] **Validar:** Vendedor asignado correctamente (trazabilidad)
- [ ] **Validar:** Email de confirmación enviado (si SMTP configurado)

### 1.3 Verificación en Admin (Rol: ADMIN)
- [ ] Login como `admin@ami.com` / `Admin@123`
- [ ] Navegar a `/companies`
- [ ] Buscar empresa creada
- [ ] **Validar:** Datos correctos en ficha
- [ ] **Validar:** Vendedor asignado visible
- [ ] **Validar:** Status `HABILITADO`

---

## 📋 FASE 2: CREACIÓN DE WORKERS (PACIENTES)

### 2.1 Alta de Paciente 1: Cervantes Celedon Damian
- [ ] Navegar a `/workers/new` o dentro de empresa → "Agregar trabajador"
- [ ] Llenar datos:
  - [ ] Nombre: "Damian"
  - [ ] Apellido: "Cervantes Celedon"
  - [ ] Fecha de nacimiento: (¿tienes el dato real?)
  - [ ] CURP: (¿tienes el dato real?)
  - [ ] Teléfono: (¿tienes el dato real?)
  - [ ] Email: (¿tienes el dato real?)
  - [ ] Puesto: (¿tienes el dato real?)
- [ ] Submit
- [ ] **Validar:** Worker creado con `universalId` único
- [ ] **Validar:** Asociado a empresa correcta

### 2.2 Alta de Paciente 2: Carrazco Suarez Alvaro
- [ ] Repetir proceso con datos del segundo paciente
- [ ] **Validar:** Worker creado
- [ ] **Validar:** Asociado a empresa correcta

### 2.3 Verificación
- [ ] Navegar a `/workers`
- [ ] **Validar:** Ambos pacientes visibles
- [ ] **Validar:** Filtro por empresa funciona
- [ ] **Validar:** Datos completos en ficha de cada worker

---

## 📋 FASE 3: CREACIÓN DE PROYECTO DE VISITA MÉDICA

### 3.1 Crear Proyecto (Rol: ADMIN o VENDEDOR)
- [ ] Navegar a `/projects/new`
- [ ] Llenar datos:
  - [ ] Nombre: "Visita Médica Beta Julio 2026"
  - [ ] Empresa: Seleccionar empresa creada en Fase 1
  - [ ] Fecha inicio: (fecha real o placeholder)
  - [ ] Fecha fin: (fecha real o placeholder)
  - [ ] Unidad Móvil: Seleccionar una de las 6 unidades seed
  - [ ] Notas: "Prueba beta end-to-end"
- [ ] **Validar:** Selector de unidad móvil muestra disponibilidad
- [ ] **Validar:** No hay conflictos de fechas con otras unidades
- [ ] Submit
- [ ] **Validar:** Proyecto creado con status `CONFIRMED`
- [ ] **Validar:** Unidad móvil asignada correctamente

### 3.2 Verificación en Calendario
- [ ] Navegar a `/projects`
- [ ] **Validar:** Proyecto visible en calendario
- [ ] **Validar:** Badge de unidad móvil aparece en proyecto
- [ ] **Validar:** Tooltip muestra nombre de unidad + placa

---

## 📋 FASE 4: ASOCIAR WORKERS AL PROYECTO

### 4.1 Asociar Pacientes (Rol: ADMIN o CAPTURIST)
- [ ] Navegar a `/projects/[id]` (detalle del proyecto)
- [ ] Sección "Trabajadores asignados"
- [ ] Botón "Agregar trabajadores" o usar bulk import
- [ ] Seleccionar: Cervantes Celedon Damian + Carrazco Suarez Alvaro
- [ ] **Validar:** Ambos workers aparecen en lista del proyecto
- [ ] **Validar:** Status `PENDING` (pendiente de llegada)

### 4.2 Verificación
- [ ] Navegar a `/projects/[id]`
- [ ] **Validar:** Contador de workers = 2
- [ ] **Validar:** Lista de workers visible con nombres correctos

---

##  FASE 5: RECEPCIÓN / CHECK-IN (DÍA DE LA VISITA)

### 5.1 Check-in Paciente 1 (Rol: RECEPTIONIST)
- [ ] Login como `recepcion@ami.com` / `Recep@123`
- [ ] Navegar a `/reception` o `/projects/[id]/reception`
- [ ] Buscar proyecto "Visita Médica Beta Julio 2026"
- [ ] Ver lista de workers pendientes
- [ ] Click en "Check-in" para Cervantes Celedon Damian
- [ ] **Validar:** Modal de corroboración de identidad aparece
- [ ] **Validar:** Datos del worker pre-llenados
- [ ] Confirmar check-in
- [ ] **Validar:** Status cambia a `CHECKED_IN`
- [ ] **Validar:** MedicalEvent creado automáticamente
- [ ] **Validar:** `mobileUnitId` del evento = unidad asignada al proyecto

### 5.2 Check-in Paciente 2
- [ ] Repetir proceso para Carrazco Suarez Alvaro
- [ ] **Validar:** Segundo MedicalEvent creado
- [ ] **Validar:** Ambos eventos visibles en `/events`

### 5.3 Verificación de Eventos
- [ ] Navegar a `/events`
- [ ] **Validar:** 2 eventos activos visibles
- [ ] **Validar:** Cada evento muestra: worker, empresa, proyecto, unidad móvil
- [ ] **Validar:** Status `SCHEDULED` o `IN_PROGRESS`

---

## 📋 FASE 6: SUBIR ESTUDIOS MÉDICOS (PAPELETA)

### 6.1 Abrir Papeleta de Paciente 1
- [ ] Navegar a `/events/[id]` (evento de Cervantes)
- [ ] **Validar:** Vista de papeleta cargada correctamente
- [ ] **Validar:** Secciones visibles: Datos personales, Estudios, Dictamen

### 6.2 Upload de Documentos (Paciente 1)
- [ ] Sección "Estudios Médicos"
- [ ] Click en "Subir documento" o drag & drop
- [ ] Subir archivos de `/context/PACIENTES/161745 - CERVANTES CELEDON DAMIAN RX0001/`:
  - [ ] `161745 - CERVANTES CELEDON DAMIAN RX0001.jpg`
  - [ ] `161745 - CERVANTES CELEDON DAMIAN RX0002.jpg`
  - [ ] `161745 - CERVANTES CELEDON DAMIAN RX0003.jpg`
  - [ ] `CERVANTES CELEDON DAMIAN-161745-23-12-2025_04_18_14_3333.pdf`
  - [ ] `CERVANTES CELEDON DAMIAN-161745-23-12-2025_04_18_19_8999.pdf`
  - [ ] `CERVANTES CELEDON DAMIAN-161745-23-12-2025_04_18_25_5318.pdf`
  - [ ] `CERVANTES CELEDON DAMIAN.pdf`
  - [ ] `CERVANTES_CELEDON_DAMIAN.pdf`
- [ ] **Validar:** Upload progress bar visible
- [ ] **Validar:** Archivos aparecen en lista "Documentos subidos"
- [ ] **Validar:** Clasificación IA automática (Rayos X, Laboratorio, etc.)
- [ ] **Validar:** Extracción de datos estructurados (si aplica)
- [ ] **Validar:** Prediagnóstico IA generado (MedGemma/DR7)

### 6.3 Upload de Documentos (Paciente 2)
- [ ] Navegar a `/events/[id]` (evento de Carrazco)
- [ ] Repetir upload con archivos de `/context/PACIENTES/167555 - CARRAZCO SUAREZ ALVARO RX0001/`
- [ ] **Validar:** Mismo flujo de IA

### 6.4 Verificación de Estudios
- [ ] En cada papeleta, sección "Valores capturados"
- [ ] **Validar:** Datos extraídos visibles (si la IA pudo extraer)
- [ ] **Validar:** RAW de extracción visible (para QA)
- [ ] **Validar:** Prediagnóstico visible con `justification` y `citations`

---

## 📋 FASE 7: EXAMEN MÉDICO Y DICTAMEN

### 7.1 Llenar Examen Médico (Rol: DOCTOR)
- [ ] Login como `doctor@ami.com` / `Doctor@123`
- [ ] Navegar a `/events/[id]` (papeleta de Cervantes)
- [ ] Sección "Examen Médico"
- [ ] Llenar datos:
  - [ ] Peso, Talla, IMC
  - [ ] Presión arterial
  - [ ] Frecuencia cardíaca
  - [ ] Agudeza visual (si aplica)
  - [ ] Audiometría (si aplica)
  - [ ] Espirometría (si aplica)
  - [ ] Observaciones clínicas
- [ ] **Validar:** Datos guardados correctamente
- [ ] **Validar:** Historial clínico longitudinal pre-llena datos si existe

### 7.2 Repetir para Paciente 2
- [ ] Llenar examen médico para Carrazco

### 7.3 Generar Dictamen (Rol: DOCTOR_VALIDATOR)
- [ ] Login como `validador@ami.com` / `Valid@123`
- [ ] Navegar a `/validation`
- [ ] Seleccionar evento de Cervantes
- [ ] Revisar:
  - [ ] Estudios subidos
  - [ ] Datos extraídos por IA
  - [ ] Prediagnóstico
  - [ ] Examen médico llenado
- [ ] **Validar:** Vista de validación completa
- [ ] Click en "Firmar dictamen"
- [ ] **Validar:** Modal de firma aparece
- [ ] Confirmar firma
- [ ] **Validar:** Dictamen firmado con timestamp
- [ ] **Validar:** Status del evento cambia a `COMPLETED`
- [ ] **Validar:** PDF de dictamen generado

### 7.4 Repetir para Paciente 2
- [ ] Validar y firmar dictamen de Carrazco

---

##  FASE 8: VERIFICACIÓN FINAL Y REPORTES

### 8.1 Verificación de Eventos Completados
- [ ] Navegar a `/events`
- [ ] **Validar:** Ambos eventos con status `COMPLETED`
- [ ] **Validar:** Dictámenes firmados visibles
- [ ] **Validar:** PDFs descargables

### 8.2 Verificación de Proyecto
- [ ] Navegar a `/projects/[id]`
- [ ] **Validar:** Proyecto muestra 2 workers completados
- [ ] **Validar:** Status del proyecto actualizado (opcional: `IN_PROGRESS` → `COMPLETED`)

### 8.3 Verificación de Unidad Móvil
- [ ] Navegar a `/operations/mobile-units`
- [ ] **Validar:** Unidad asignada muestra proyecto asociado
- [ ] **Validar:** Calendario de unidad muestra proyecto en fechas correctas

### 8.4 Reporte Masivo (Opcional)
- [ ] Navegar a `/reports` o `/projects/[id]/report`
- [ ] Generar reporte masivo del proyecto
- [ ] **Validar:** XLSX generado con 3 hojas (CONCENTRADO, LABORATORIOS, GRAFICAS)
- [ ] **Validar:** PDF generado con portada diagnóstica

---

## 📋 FASE 9: VALIDACIÓN DE TRAZABILIDAD

### 9.1 Auditoría
- [ ] Navegar a `/admin/audit`
- [ ] **Validar:** Entradas de auditoría para:
  - [ ] Creación de empresa
  - [ ] Creación de workers
  - [ ] Creación de proyecto
  - [ ] Check-ins
  - [ ] Uploads de documentos
  - [ ] Firmas de dictámenes

### 9.2 Trazabilidad de Unidad Móvil
- [ ] Navegar a `/admin/mobile-units/[id]`
- [ ] **Validar:** Proyecto asociado visible
- [ ] **Validar:** MedicalEvents asociados visibles
- [ ] **Validar:** LabOrders asociados visibles (si se crearon)

---

## 📋 CRITERIOS DE ÉXITO

- [ ] **Empresa creada** vía link de vendedor con trazabilidad
- [ ] **2 Workers creados** y asociados a empresa
- [ ] **Proyecto creado** con unidad móvil asignada
- [ ] **2 Workers asociados** al proyecto
- [ ] **2 Check-ins realizados** con MedicalEvents creados
- [ ] **16+ documentos subidos** (8 por paciente) con IA activa
- [ ] **2 Exámenes médicos** llenados
- [ ] **2 Dictámenes firmados** con PDF generado
- [ ] **Trazabilidad completa** desde empresa → workers → proyecto → eventos → estudios → dictamen
- [ ] **Unidad móvil** muestra proyecto y eventos asociados
- [ ] **Auditoría** registra todas las acciones

---

##  DATOS FALTANTES (NECESARIOS PARA LA PRUEBA)

**Paciente 1: Cervantes Celedon Damian**
- Fecha de nacimiento: ?
- CURP: ?
- Teléfono: ?
- Email: ?
- Puesto: ?

**Paciente 2: Carrazco Suarez Alvaro**
- Fecha de nacimiento: ?
- CURP: ?
- Teléfono: ?
- Email: ?
- Puesto: ?

**Empresa:**
- Nombre: ? (¿"Servicios Robles S.A. de C.V." o nombre real?)
- RFC: ?
- Dirección: ?
- Teléfono: ?
- Email: ?
- Contacto principal: ?

**Proyecto:**
- Nombre: "Visita Médica Beta Julio 2026" (¿o nombre real?)
- Fecha inicio: ?
- Fecha fin: ?
- Unidad móvil: ¿Cuál de las 6? (recomiendo "Unidad Móvil 1")

---

**¿Tienes los datos faltantes o uso placeholders para la prueba?**
