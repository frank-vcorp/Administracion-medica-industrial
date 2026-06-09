# ARQUITECTURA DEL SISTEMA - Administracion-medica-industrial

**Fecha de Generación:** 2026-06-09  
**Versión:** 1.0

## 📋 Stack Tecnológico Detectado

| Capa | Tecnología | Versión |
|------|------------|---------|
| **Framework Frontend** | Next.js | 16.1.6 (App Router) |
| **Lenguaje** | TypeScript | ^5 |
| **Database** | PostgreSQL | via Prisma ORM ^5.22.0 |
| **ORM** | Prisma | ^5.22.0 |
| **UI/CSS** | Tailwind CSS | ^4 |
| **Autenticación** | NextAuth.js | ^4.24.13 |
| **Validación** | Zod | ^4.3.6 |
| **PDF** | @react-pdf/renderer | ^4.3.2 |
| **Excel** | xlsx | ^0.18.5 |

## 🏗️ Arquitectura de Carpetas

```
frontend/
├── src/
│   ├── app/                    # App Router - Pages y Layouts
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── events/
│   │   │   └── [id]/page.tsx   # Expediente clínico
│   │   ├── workers/
│   │   ├── companies/
│   │   ├── projects/           # Proyectos de visita médica
│   │   └── validation/
│   ├── actions/                # Server Actions (CRUD operations)
│   │   ├── worker.actions.ts
│   │   ├── medical-event.actions.ts
│   │   ├── event-test.actions.ts
│   │   ├── appointment.actions.ts
│   │   ├── ai-prediagnosis.actions.ts
│   │   └── ...               # 19 archivos de acciones
│   ├── components/             # Componentes React
│   │   ├── clinical/           # UI clínica (estudios, papeleta, examen)
│   │   ├── calibration/        # UI de calibración IA
│   │   └── modals/             # Modales (CheckIn, Upload, Formularios)
│   ├── lib/                    # Librerías y utilidades
│   │   ├── prisma.ts           # Cliente Prisma
│   │   └── study-ai.ts         # Integración IA
│   ├── services/               # Servicios de negocio
│   │   ├── worker.service.ts
│   │   ├── medical-event.service.ts
│   │   └── company.service.ts
│   └── types/                  # Tipos TypeScript
│       └── events.ts
├── prisma/
│   └── schema.prisma           # Esquema de base de datos
└── uploads/                    # Persistencia de archivos (Railway Volume)
```

## 🗄️ Modelos de Datos Clave (Prisma)

### Core Entities
- **Tenant** - Administración médica (multi-tenant)
- **Branch** - Sucursales físicas
- **Company** - Empresas cliente
- **Worker** - Trabajadores/Pacientes
- **User** - Usuarios del sistema (roles: ADMIN, RECEPTIONIST, DOCTOR_GENERAL, etc.)
- **Appointment** - Citas agendadas
- **MedicalEvent** - Expediente de visita (núcleo del flujo clínico)

### IA & Estudios
- **MedicalTest** - Catálogo de pruebas médicas
- **EventTest** - Pruebas vinculadas a eventos
- **StudyRecord** - Estudios con resultados
- **StudyExtractionSnapshot** - Snapshots inmutables de extracción IA
- **AIPrediagnosisSnapshot** - Prediagnósticos IA inmutables
- **DoctorStudyReview** - Revisiones médicas de IA
- **ClinicalEvidenceSource** - Fuentes de evidencia clínica versionadas

### Proyectos
- **Project** - Proyectos de visita médica
- **ProjectWorker** - Trabajadores en proyectos
- **JobPosition** - Puestos de trabajo

### Operación
- **MedicalVerdict** - Dictámenes firmados
- **AuditLog** - Bitácora de auditoría
- **PapeletaTimelineEntry** - Cronograma operativo persistente

## 🔌 Integraciones Externas

- **Gemini 2.5 Flash** - Clasificación documental y extracción estructurada
- **MedGemma 4B-IT / DR7.ai** - Prediagnóstico clínico
- **Featherless** - Proveedor IA (fallback/gateway)
- **Railway Storage Bucket** - Persistencia de archivos privados
- **NextAuth.js** - Autenticación y autorización

## 🔄 Flujos Principales

### 1. Admisión de Trabajador
```
Programado (Appointment) → Check-in → MedicalEvent
Pre-registrado (Project) → Llegada → MedicalEvent
Mismo día (BulkWorkerImport) → MedicalEvent
Externo (sin empresa) → MedicalEvent
```

### 2. Pipeline IA (Estudios)
```
Upload PDF → Clasificación (Gemini) → Extracción (Gemini) → Prediagnóstico (MedGemma) → Review Médico → Dictamen
```

### 3. Proyectos de Visita Médica
```
Crear Proyecto → Alta Masiva → Calendario → Recepción por Project → MedicalEvent
```

## 🎯 Estado Actual

- **Fase:** Operación estabilizada con backlog de junio COMPLETADO
- **Features completados:** Recepción con QR, agenda premium, prediagnóstico IA, firma digital, auditoría, DR7.ai, presentation schema, búsqueda externa server-side
- **Backend:** 100% funcional (PostgreSQL conectado)
- **Frontend:** Funcional con Next.js 16.1.6
- **Pendiente:** Integraciones comerciales MEDGEMMA APIS, resolver Prisma 7 incompatibility

## 📝 Notas de Desarrollo

- Los `params` y `searchParams` en páginas dinámicas son **Promises** (Next.js 16+)
- Validación con Zod en server actions
- Modelo multi-tenant con aislamiento de datos
- Snapshots de IA son inmutables (política de trazabilidad)