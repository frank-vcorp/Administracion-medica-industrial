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

- [ ] Refinamiento de Pipeline IA y Ofimática (SOFÍA - Fase 6)
    - [ ] Mejorar clasificación de documentos con Vision API (filtros por tipo)
    - [ ] Implementar extracción de datos específicos por estudio (Laboratorio, Radiología, etc.)
    - [ ] Generar reportes de análisis masivo con histórico
    - [ ] Integración de firma digital avanzada en PDFs (RFC/Certificado digital)

- [x] Auditoría de Seguridad y QA (DEBY - Fase 5)
    - [x] Ejecutar Qodo CLI para analizar cambios de autenticación
    - [x] Generar QODO_AUDIT_RAW para seguridad post-implementación
    - [x] Testing manual de acceso multi-tenant (validar aislamiento de datos)
    - [x] Crear DICTAMEN de seguridad (DICTAMEN_FIX-20260225-02.md)
