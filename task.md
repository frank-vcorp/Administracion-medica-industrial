# Tareas - Residente Digital

- [/] Inicialización del Proyecto (INTEGRA)
    - [x] Crear estructura de directorios (.gemini context)
    - [x] Crear PROYECTO.md
    - [x] Definir Stack Tecnológico (ADR)
    - [x] Scaffold Codebase (Frontend/Backend)
    - [x] Docker Compose Setup (Manual Scripts)
    - [x] Enviroment Verification


- [x] Definición de Especificaciones (INTEGRA)
    - [x] Crear SPEC inicial (Residente Digital)
    - [x] Validar módulos con Usuario
    - [x] Crear Diccionario de Datos (GLOSSARY.md)
- [x] Modelado de Base de Datos (INTEGRA/SOFIA)
    - [x] Definir Esquema Prisma (schema.prisma)
    - [x] Generar Migración Inicial
    - [x] Verificar conexión desde Backend (Python) y Frontend (Next.js)

- [x] Configuración de Entorno y QA Automatizado (DEBY)
    - [x] Configurar AGENTS.md para Qodo CLI
    - [x] Auditoría Forense Nocturna con Qodo CLI (`frontend/src/actions`)
    - [x] Generar Reporte RAW Independiente de Qodo (`QODO_AUDIT_RAW.md`)
    - [x] Aplicar Fixes de Mínima Intervención (Try/Catch y Performance)
    - [x] Crear DICTAMEN_FIX-20260224-01.md
- [x] Implementación y Cableado (SOFIA)
    - [x] Core API: Workers & Companies (Next.js/Prisma)
    - [x] Core API: Medical Events
    - [x] UI: Reception (Worker List & Check-in)
    - [x] UI: Medical Board (Event View & Validation)
    - [x] Cableado de Módulos (Companies, Branches, Services)
    - [x] Flujo de Integridad Referencial (Empresa -> Trabajador -> Cita)
- [x] Integración de Archivos & IA (SOFIA)
    - [x] Configuración Volumen Compartido (Uploads)
    - [x] Upload Component (Next.js)
    - [x] Conexión Backend Python (Gemini 1.5 Flash Vision)
    - [x] Análisis Multimodal (Documentos Médicos)
- [x] Pruebas de Usuario (DEBY)
    - [x] Verificación de Flujo Completo (verify-full-journey)
    - [x] Demo E2E "Caso Francisco Saavedra"
    - [x] Integración WhatsApp Probadal

- [x] Implementación Portal B2B Empresarial (SOFIA)
    - [x] Layout y Menú de Navegación del Portal (`/portal`)
    - [x] Dashboard Estadístico B2B (Métricas de aptitud)
    - [x] Listado de Trabajadores (`/portal/workers`)
    - [x] Histórico de Expedientes y Dictámenes (`/portal/events`)

- [x] Infraestructura y Despliegue de Producción (INTEGRA/DEBY)
    - [x] Aprovisionamiento de PostgreSQL en la nube (Railway)
    - [x] Ejecutar `npx prisma db push` o migraciones hacia la nueva BD
    - [x] Eliminar `force-dynamic` y restaurar Server Static Generation (SSG) de Next.js
    - [x] Configurar `DATABASE_URL` en Vercel

- [x] Panel de Administración y Motor PDF (INTEGRA/SOFIA)
    - [x] Módulo Administrativo: CRUD de Usuarios de Clínica (Médicos, Recepcionistas)
    - [x] Módulo Administrativo: CRUD de Servicios y Perfiles (Baterías de Laboratorio)
    - [x] API de Generación PDF: Convertir MedicalVerdict a PDF
    - [x] UI de Descarga: Implementar acción en Portal B2B para bajar PDF oficial

- [x] Seguridad: Login y Control Multi-tenant (SOFÍA - Fase 5)
    - [x] Implementar NextAuth.js v5 o Auth.js para autenticación
    - [x] Crear modelo de Usuario con hashedPassword en Prisma
    - [x] Implementar rutas de Sign-up y Sign-in
    - [x] Middleware de protección de rutas (`/portal/*`, `/admin/*`)
    - [x] Asociación de Empresa a Usuario (Multi-tenant)
    - [x] Validación de permisos por rol (MDico, Recepcionista, Admin)
    - [x] Implementar Logout y manejo de sesiones
    - [x] Testing E2E de flujo de autenticación completo

- [✓] Refinamiento de Pipeline IA y Ofimática (SOFÍA - Fase 6)
    - [x] Mejorar clasificación de documentos con Vision API (filtros por tipo)
    - [x] Implementar extracción de datos específicos por estudio (Laboratorio, Radiología, etc.)
    - [x] Generar reportes de análisis masivo con histórico
    - [x] Integración de firma digital avanzada en PDFs (RFC/Certificado digital)

- [x] Auditoría de Seguridad y QA (DEBY - Fase 5)
    - [x] Ejecutar Qodo CLI para analizar cambios de autenticación
    - [x] Generar QODO_AUDIT_RAW para seguridad post-implementación
    - [x] Testing manual de acceso multi-tenant (validar aislamiento de datos)

- [✓] Módulos Complementarios Fase 2: Citas, Dashboard y Bitácora (SOFIA - Sprint 7)
    - [x] MOD-CITAS: Extensión del schema Prisma
        - [x] Crear modelo `Appointment` (branchId, workerId, serviceProfileId, scheduledStart, scheduledEnd, status)
        - [x] Crear enum `AppointmentStatus` (SCHEDULED, CONFIRMED, CANCELLED, NO_SHOW, COMPLETED)
        - [x] Agregar índices para optimización (branchId, scheduledStart)
        - [x] Ejecutar migración de base de datos
    - [x] MOD-CITAS: Server Actions y Lógica
        - [x] Implementar `createAppointment()` Server Action
        - [x] Implementar `updateAppointmentStatus()` Server Action
        - [x] Implementar `getDailyAppointments(branchId, date)` Server Action (optimizada)
        - [x] Implementar `cancelAppointment()` Server Action
        - [x] Implementar conversión de Cita a Evento Médico en Check-in
    - [x] MOD-CITAS: UI Components
        - [x] Crear componente `AppointmentForm` (Reserva)
        - [x] Crear componente `AppointmentList` (Agenda por sucursal)
        - [x] Crear componente `AppointmentCalendar` (Vista calendario)
        - [x] Crear página `/admin/appointments`
        - [x] Crear página `/admin/appointments/new`
    - [x] MOD-DASHBOARD: Extensión del schema Prisma
        - [x] Crear modelo `AuditLog` (userId, action, entity, entityId, details, ipAddress, userAgent)
        - [x] Agregar índices (entityId, userId)
        - [x] Ejecutar migración de base de datos
    - [x] MOD-DASHBOARD: Server Actions y Analytics
        - [x] Implementar `getDashboardMetrics(tenantId)` con aggregations
        - [x] Implementar KPI Citas hoy (Total vs Atendidas)
        - [x] Implementar KPI Estado de eventos (En proceso vs Terminados)
        - [x] Implementar gráfico de atenciones por empresa (Top 5)
    - [x] MOD-DASHBOARD: UI Components
        - [x] Crear widget `AppointmentMetrics` (Citas hoy)
        - [x] Crear widget `EventStatusMetrics` (Estados de eventos)
        - [x] Crear widget `CompanyPerformance` (Top 5 empresas)
        - [x] Crear página `/dashboard` (Panel operativo)
    - [x] MOD-BITACORA: Servicio de Auditoría
        - [x] Implementar `createAuditLog()` (función utilitaria)
        - [x] Integrar logging en `createMedicalEvent()`
        - [x] Integrar logging en `updateMedicalVerdict()`
        - [x] Integrar logging en `updateAppointmentStatus()`
        - [x] Integrar logging en login/logout (NextAuth.js callback)
    - [x] MOD-BITACORA: UI Components
        - [x] Crear componente `AuditLogList` (Historial de auditoría)
        - [x] Crear página `/admin/audit-logs`
        - [x] Filtros por usuario, entidad, fecha
    - [x] Validación y Testing
        - [x] Testing E2E: Flujo completo Reserva -> Check-in -> Evento Médico
        - [x] Testing E2E: Dashboard muestra métricas correctas
        - [x] Testing E2E: Bitácora registra todas las acciones críticas
        - [x] Performance: Consultas de Dashboard no deben exceder 2s
        - [x] Auditoría: Verificar que AuditLog es append-only
    - [x] Documentación
        - [x] Actualizar DATA_DICTIONARY.md con nuevos modelos
        - [x] Generar SPEC final de implementación
        - [x] Crear Checkpoint de Sprint 7

- [✓] Sprint: Gestión de Citas y Piso Clínico - Correcciones de Calidad (CRONISTA - 2026-02-27)
    - [x] Renombrado módulo "Piso Clínico" (antes "Sala Clínica")
    - [x] Ajustado flujo Kanban: Sala → Consultorio → Validación
    - [x] Implementado modal de Check-in con código QR (🎫)
    - [x] Estandarización de `prisma.$transaction` para operaciones compuestas
        - [x] Check-in = Update Appointment Status + Create Medical Event (atómico)
        - [x] Integración de auditoría en transacciones críticas
    - [x] Corrección de bugs de timezone y WhatsApp
        - [x] Normalización de fechas a ISO string en cliente
        - [x] Validación de `workerPhone` antes de generar enlaces `wa.me`
    - [x] Auditoría de Calidad completada (DICTAMEN_DEBY_20260227-01)

## 📌 Deuda Técnica Identificada

### Quick Wins - Prioridad Alto
- [ ] **UI Bug: `borderColor` en componente `Lane`** (reception/page.tsx)
  - **Problema:** Prop recibida pero no aplicada en clases CSS (hardcodeado `border-slate-100`)
  - **Impacto:** Visual (bordes de columnas Kanban no coinciden con encabezado)
  - **Fix:** Aplicar `borderColor` dinámicamente en elemento `div` de Lane
  
- [ ] **Refactorización: `handleSubmit` en `AppointmentFormModal.tsx`**
  - **Problema:** Depende del estado `selectedWorker` que puede desincronizarse
  - **Solución:** Buscar objeto `worker` directamente en `handleSubmit` usando `workerId` del Config
  - **Impacto:** Elimina race condition en selección de trabajador

### Notas Técnicas
- [ ] **Evaluación:** Datos en URL de WhatsApp (`expedientId` y nombre completo)
  - Aunque `wa.me` es seguro, considerar si es necesario enviar el ID interno o solo confirmación genérica

## 🔧 Estándares Técnicos Implementados

### `prisma.$transaction()` - Patrón Estándar para Operaciones Compuestas

**Archivo:** `frontend/src/actions/appointment.actions.ts` (línea 263)

**Contexto:** Operación de Check-in requiere actualizar estado de cita Y crear evento médico de forma atómica.

**Implementación:**
\`\`\`typescript
const result = await prisma.$transaction(async (tx) => {
  // 1. Obtener cita y verificar estado
  const existingAppointment = await tx.appointment.findUnique({
    where: { id: appointmentId },
    include: { worker: true, company: true, branch: true, medicalEvents: true }
  })
  
  // 2. Actualizar estado de cita
  const updatedAppointment = await tx.appointment.update({
    where: { id: appointmentId },
    data: { status: 'COMPLETED' }
  })
  
  // 3. Crear evento médico
  const medicalEvent = await tx.medicalEvent.create({
    data: { /* ... */ }
  })
  
  // 4. Log de auditoría dentro de la transacción
  await tx.auditLog.create({
    data: {
      action: 'CHECK_IN',
      entity: 'Appointment',
      entityId: appointmentId,
      // ...
    }
  })
  
  return { updatedAppointment, medicalEvent }
})
\`\`\`

**Ventajas:**
- ✅ **Atomicidad:** Todas las operaciones se ejecutan juntas o ninguna
- ✅ **Consistencia:** Si hay error en paso 3, pasos 1-2 se revierten automáticamente
- ✅ **Auditoría integrada:** El log es parte de la transacción (no puede fallar parcialmente)

**Aplicación futura:** Usar este patrón para cualquier operación compuesta (ej: transferencia de trabajador entre empresas, creación de evento + expediente, etc.).

## ⏭️ Próximo Sprint

**Polished UX & Mejoras Visuales (Antigravity Handoff)**
- [ ] Agregar campo `googleMapsUrl` a modelo Branch (Sucursal) para ubicación exacta
- [ ] Heredar URL de Google Maps en el Pase de Confirmación (AppointmentFormModal)

**Validación Médica & Dictamen Avanzado** (Pendiente)
- [ ] Implementar validación manual de dictámenes por médico
- [ ] Sistema de "Puntos de Control" en flujo médico
- [ ] Plantillas de dictamen por tipo de estudio

## 🔮 Backlog Futuro (Roadmap)

**MOD-CITAS-EXT (Self-Service Widget)**
- [ ] Crear componente `AppointmentWidget` isolado (sin auth requerida) para incrustar en sitios web externos
- [ ] API Pública para agendamiento externo (con rate limiting y captcha)
- [ ] Panel de configuración de widget (colores, logo, horarios visibles)

---

**Última actualización:** 2026-02-27 | **ID:** DOC-20260227-01

```
