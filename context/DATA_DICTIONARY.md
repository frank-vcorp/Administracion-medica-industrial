# DICCIONARIO DE DATOS (Compendio)

> [!IMPORTANT]
> Este documento sirve como "Fuente de Verdad" para nombrar variables, tablas y modelos.
> **Regla**: El código (tablas, clases) estará en **INGLÉS**. La interfaz y documentación en **ESPAÑOL**.

## 🗺️ Mapeo de Entidades (Domain -> Code)

| Concepto de Negocio (ES) | Tabla / Modelo (EN) | Prefijo Variable | Descripción |
|--------------------------|---------------------|------------------|-------------|
| **Administración Médica**| `Tenant` / `System` | `sys_` | Configuración global del sistema AMI. |
| **Sucursal**             | `Branch`            | `branch_`        | Sedes físicas de atención. |
| **Empresa (Cliente)**    | `Company`           | `comp_`          | Cliente que contrata el servicio. |
| **Trabajador**           | `Worker`            | `work_`          | Paciente/Empleado. **Tiene ID Universal**. |
| **Cita**                 | `Appointment`       | `appt_`          | Agendamiento de visita. |
| **Servicio**             | `Service`           | `srv_`           | Item individual (Estudio/Lab). |
| **Perfil / Batería**     | `ServiceProfile`    | `prof_`          | Conjunto de servicios agrupados. |
| **Expediente**           | `MedicalEvent`      | `event_`         | La instancia de atención (Check-in). "Expediente de la visita". |
| **Examen Médico**        | `MedicalExam`       | `exam_`          | Evaluación física general. |
| **Estudio**              | `StudyRecord`       | `study_`         | Resultado de estudio (PDF/Img) + Datos. |
| **Laboratorio**          | `LabRecord`         | `lab_`           | Resultado de laboratorio. |
| **Dictamen**             | `MedicalVerdict`    | `verdict_`       | Documento final con firma. |
| **Usuario Sistema**      | `User`              | `usr_`           | Médico, Admin, Recepcionista. |

## 🏗️ Definición de Campos Clave (Naming Convention)

### Estándares
- **Primary Key**: `id` (UUID o Int, preferible UUID para universalidad).
- **Primary Key Compuesto**: `[entity]Id`
- **Fechas**: `createdAt`, `updatedAt`, `deletedAt` (Soft delete).
- **Booleanos**: `isActive`, `hasSigned`, `isVerified`.

### Detalle por Entidad Principal

#### 1. Worker (Trabajador)
- `universalId`: String (ID único indestructible).
- `nationalId`: String (CURP/DNI).
- `firstName`, `lastName`: Nombres.
- `companyId`: Relación actual.

#### 2. MedicalEvent (Expediente de Visita/Evento)
- `status`: Enum (`SCHEDULED`, `IN_PROGRESS`, `VALIDATING`, `CLOSED`).
- `workerId`: Paciente.
- `branchId`: Ubicación.
- `checkInTime`: Fecha/Hora llegada.

#### 3. StudyRecord / LabRecord (Estudios)
- `fileUrl`: Path al PDF/Imagen original.
- `extractedData`: JSON (Datos sacados por IA).
- `aiPrediction`: JSON/String (Pre-diagnóstico IA).
- `validatorNotes`: String (Notas del médico).
- `isApproved`: Boolean.

#### 4. MedicalVerdict (Dictamen)
- `finalDiagnosis`: Texto aprobado.
- `signedBy`: User ID del médico validador.
- `signatureHash`: Firma digital.
- `generatedReportUrl`: Link al PDF final.

## 🤖 Vocabulario IA
- **OCR**: Extracción de texto crudo.
- **Extraction**: Estructuración de datos (Nombre, Fecha, Valores).
- **Prediction**: Sugerencia clínica de la IA.
