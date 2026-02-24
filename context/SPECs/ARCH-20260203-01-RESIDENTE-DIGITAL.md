# IMPL PLAN: Residente Digital (AMI System)

## 🎯 Objetivo
Desarrollar el sistema "Residente Digital" para la Administración Médica Industrial (AMI). El sistema gestionará el flujo completo de atención médica ocupacional, desde la cita hasta el dictamen final validado, integrando IA para la extracción de datos y pre-diagnóstico.

## ⚠️ User Review Required
> [!IMPORTANT]
> **Decisión de Stack Tecnológico**: Se requiere confirmación del usuario sobre el stack propuesto.
> **Propuesta Principal (Modern Enterprise):** 
> - **Frontend/BFF**: Next.js 14+ (App Router), TypeScript, Tailwind CSS.
> - **Backend (IA/OCR)**: Microservicio en Python (FastAPI) para procesamiento pesado de PDF/Imágenes y lógica de IA.
> - **BD**: PostgreSQL con Prisma ORM.

## 🏗️ Arquitectura de Módulos

### 1. Núcleo (Core)
- **AMI Admin**: Gestión global (Tenants, Configuración).
- **Sucursales**: Gestión de sedes físicas.
- **Usuarios y Roles**: Admin, Recepción, Médico General, Capturista, Médico Validador, Cliente (Empresa).

### 2. Entidades Principales
- **Empresa (Cliente)**: 
    - Perfiles de puesto (Baterías de estudios).
    - Asignación de trabajadores.
- **Trabajador**:
    - **ID Universal**: Identificador único persistente.
    - Historial de Expedientes.
- **Servicios**:
    - Catálogo de Estudios y Laboratorios.
    - Creación de "Baterías" (Paquetes de servicios).

### 3. Flujo Operativo (El Expediente)
El "Expediente" es la instancia de una visita.
1.  **Cita**: Agendamiento previo.
2.  **Check-in**: Creación del Expediente en Sucursal.
3.  **Examen Médico**: Historia clínica y evaluación física (Médico General).
4.  **Estudios y Laboratorios**: 
    - Realización de pruebas (Audiometría, Espirometría, Sangre, etc.).
    - **Entrada**: Archivos (PDF/Imagen).
    - **Proceso**: Captura Manual O Extracción AI (OCR).
5.  **Validación e IA**:
    - Consolidación de resultados.
    - **IA**: Generación de Pre-diagnóstico por estudio y Global.
    - **Médico Validador**: Revisa, edita y Aprueba (Firma Digital).
6.  **Dictamen Final**: Documento legal generado/firmado.
7.  **Reporte**: Entrega a Empresa (Email/Link).

## 🔨 Cambios Propuestos (Fase 1: Setup & Core)

### Infraestructura
#### [NEW] [docker-compose.yml](file:///root/antigravity-projects/Administracion-medica-industrial/Administracion-medica-industrial/docker-compose.yml)
- Configuración de base de datos Postgres y servicios locales.

### Estructura de Proyecto
#### [NEW] [/src](file:///root/antigravity-projects/Administracion-medica-industrial/Administracion-medica-industrial/src)
- Inicialización de Next.js App Router.

## 🧪 Plan de Verificación

### Pruebas Manuales
1. **Setup**: Verificar que el entorno levante con `npm run dev` y los contenedores de BD estén activos.
2. **Navegación**: Verificar acceso a Home y Dashboard placeholder.
