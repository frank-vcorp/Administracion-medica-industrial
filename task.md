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

- [/] Módulos Complementarios Fase 2: Citas, Dashboard y Bitácora (SOFIA - Sprint 7)
    - [ ] MOD-CITAS: Extensión del schema Prisma
        - [ ] Crear modelo `Appointment` (branchId, workerId, serviceProfileId, scheduledStart, scheduledEnd, status)
        - [ ] Crear enum `AppointmentStatus` (SCHEDULED, CONFIRMED, CANCELLED, NO_SHOW, COMPLETED)
        - [ ] Agregar índices para optimización (branchId, scheduledStart)
        - [ ] Ejecutar migración de base de datos
    - [ ] MOD-CITAS: Server Actions y Lógica
        - [ ] Implementar `createAppointment()` Server Action
        - [ ] Implementar `updateAppointmentStatus()` Server Action
        - [ ] Implementar `getDailyAppointments(branchId, date)` Server Action (optimizada)
        - [ ] Implementar `cancelAppointment()` Server Action
        - [ ] Implementar conversión de Cita a Evento Médico en Check-in
    - [ ] MOD-CITAS: UI Components
        - [ ] Crear componente `AppointmentForm` (Reserva)
        - [ ] Crear componente `AppointmentList` (Agenda por sucursal)
        - [ ] Crear componente `AppointmentCalendar` (Vista calendario)
        - [ ] Crear página `/admin/appointments`
        - [ ] Crear página `/admin/appointments/new`
    - [ ] MOD-DASHBOARD: Extensión del schema Prisma
        - [ ] Crear modelo `AuditLog` (userId, action, entity, entityId, details, ipAddress, userAgent)
        - [ ] Agregar índices (entityId, userId)
        - [ ] Ejecutar migración de base de datos
    - [ ] MOD-DASHBOARD: Server Actions y Analytics
        - [ ] Implementar `getDashboardMetrics(tenantId)` con aggregations
        - [ ] Implementar KPI Citas hoy (Total vs Atendidas)
        - [ ] Implementar KPI Estado de eventos (En proceso vs Terminados)
        - [ ] Implementar gráfico de atenciones por empresa (Top 5)
    - [ ] MOD-DASHBOARD: UI Components
        - [ ] Crear widget `AppointmentMetrics` (Citas hoy)
        - [ ] Crear widget `EventStatusMetrics` (Estados de eventos)
        - [ ] Crear widget `CompanyPerformance` (Top 5 empresas)
        - [ ] Crear página `/dashboard` (Panel operativo)
    - [ ] MOD-BITACORA: Servicio de Auditoría
        - [ ] Implementar `createAuditLog()` (función utilitaria)
        - [ ] Integrar logging en `createMedicalEvent()`
        - [ ] Integrar logging en `updateMedicalVerdict()`
        - [ ] Integrar logging en `updateAppointmentStatus()`
        - [ ] Integrar logging en login/logout (NextAuth.js callback)
    - [ ] MOD-BITACORA: UI Components
        - [ ] Crear componente `AuditLogList` (Historial de auditoría)
        - [ ] Crear página `/admin/audit-logs`
        - [ ] Filtros por usuario, entidad, fecha
    - [ ] Validación y Testing
        - [ ] Testing E2E: Flujo completo Reserva -> Check-in -> Evento Médico
        - [ ] Testing E2E: Dashboard muestra métricas correctas
        - [ ] Testing E2E: Bitácora registra todas las acciones críticas
        - [ ] Performance: Consultas de Dashboard no deben exceder 2s
        - [ ] Auditoría: Verificar que AuditLog es append-only
    - [ ] Documentación
        - [ ] Actualizar DATA_DICTIONARY.md con nuevos modelos
        - [ ] Generar SPEC final de implementación
        - [ ] Crear Checkpoint de Sprint 7

```
