# SPEC ARCH-20260623-01 — Módulo de Reportes Masivos por Proyecto

**ID:** ARCH-20260623-01
**Fecha:** 2026-06-23
**Estado:** Planificado
**ADR:** `context/decisions/ADR-20260623-01-MODULO-REPORTES-MASIVOS.md`

## Objetivo

Dotar a AMI de un **módulo de reportes masivos** que entregue a la empresa cliente, para cualquier proyecto con carga masiva de trabajadores (UMM o clínica), un concentrado estandarizado en dos formatos:
- **XLSX** (procesable)
- **PDF tipo ebook** (visualizable)

## Contexto funcional

Los proyectos UMM (Unidades Médicas Móviles) son campañas de valoración médica donde se concentran decenas o cientos de trabajadores en poco tiempo. Al cierre se entrega un concentrado a la empresa cliente con:
- Datos del paciente y puesto
- Resultados de audiometría, espirometría, RX columna, RX tórax, ECG, campimetría, examen médico
- Laboratorios (BH, QS6, EGO, toxicológico)
- Gráficas agregadas para diagnóstico situacional (pirámide edad, distribución por sexo, etc.)

Actualmente esto se arma **a mano en Excel** después de capturar, sin trazabilidad en la plataforma.

## Alcance Micro-Sprint 1

### Funcional

1. **Botón "Reporte Masivo"** en `/projects/[id]`, visible para ADMIN, DOCTOR_GENERAL, RECEPTIONIST
2. **Modal de preview** antes de generar:
   - Total trabajadores del proyecto
   - Trabajadores con todos los estudios listos
   - Trabajadores parciales (X/Y estudios)
   - Trabajadores sin estudios
   - Selección de formato (XLSX, PDF, o ambos)
3. **Generación asíncrona**:
   - Click "Generar" → registro en `ProjectReport` con `status: PENDING`
   - Job procesa → `status: PROCESSING` → `READY | FAILED`
   - Polling cada 2s desde el modal
   - Cuando `READY`: links de descarga
4. **Historial descargable**: lista de reportes generados con fecha, usuario, formato, link

### XLSX generado

3 hojas idénticas al formato operativo (`CONCENTRADO GENERAL EJEMPLO.xlsx`):

**Hoja CONCENTRADO** (1 fila por trabajador):
- FOLIO, NOMBRE, SEXO, AREA/PUESTO, ANTIGÜEDAD
- AGUDEZA VISUAL, CAMPOS VISUALES, DISCRIMINACION DEL COLOR
- DX (audiometría bilateral resumido)
- OIDO DERECHO, OIDO IZQUIERDO, % HBC
- ESPIROMETRIA, FVC, TABAQUISMO
- ELECTROCARDIOGRAMA, VALORACION POSTURAL
- GRADO ESCOLIOSIS, GRADO LORDOSIS, BASCULACIÓN PÉLVICA
- RADIOGRAFIA COLUMNA (impresión), RADIOGRAFIA TORAX (impresión)
- PES, TALLA, IMC, TA SIS, TA DIA, DX PRESION
- IMPRESION DIAGNOSTICA (examen médico)

**Hoja LABORATORIOS** (1 fila por trabajador):
- Folio, Nombre, Sexo, Edad
- BH: Hb, MCHb, CHGM, LEU, PLA
- QS6: GLUC, BUN, UREA, CREAT, AU, COL, TRIG
- EGO: GLC, PROT, BLO, BAC, CRISTALES
- TOXICOLÓGICO: ANFETA, COCA, MARIHUA, OPIAC, METANF

**Hoja GRAFICAS** (agregados):
- TRAUMA ACUSTICO POR AREA (conteos)
- AUDIOMETRÍAS (%HBC por rango)
- ESPIROMETRÍAS (distribución patrón)
- COLUMNA (escoliosis, lordosis, basculación)
- QS6 (colesterol, triglicéridos, glucosa)

### PDF generado

**Página 1 — Portada "Diagnóstico Situacional"**:
- Nombre empresa
- Fechas del proyecto
- Conteos por estudio (66 audiometrías, 31 espirometrías, etc.)
- Pirámide de edad
- Distribución por sexo
- Tabla de antecedentes principales

**Página 2 en adelante — Concentrado tabular**:
- Tabla con datos clave por trabajador (mismas columnas que XLSX CONCENTRADO pero simplificadas para legibilidad)
- Una fila por trabajador
- Encabezados agrupados por estudio (AUDIOMETRÍA, ESPIROMETRÍA, COLUMNA, etc.)

## Modelo de datos

```prisma
model ProjectReport {
  id           String   @id @default(cuid())
  projectId    String
  project      Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  format       String   // 'XLSX' | 'PDF' | 'BOTH'
  status       String   // 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  fileUrlXlsx  String?  // path al archivo XLSX generado
  fileUrlPdf   String?  // path al archivo PDF generado
  errorMessage String?
  generatedById String
  generatedBy   User    @relation(fields: [generatedById], references: [id])
  generatedAt   DateTime @default(now())
  completedAt   DateTime?
  
  @@index([projectId])
  @@index([status])
}
```

## Arquitectura técnica

### Frontend
- `ProjectMassiveReportModal.tsx`: preview + generación + polling
- Hook `useProjectReportStatus(reportId)` con polling
- Botón en `/projects/[id]/page.tsx`

### Backend
- `POST /api/v2/projects/{projectId}/reports/massive` → crea ProjectReport, dispara job
- `GET /api/v2/projects/{projectId}/reports/{reportId}` → estado actual
- `GET /api/v2/projects/{projectId}/reports/{reportId}/download?format=xlsx|pdf` → descarga archivo
- `GET /api/v2/projects/{projectId}/reports` → historial

### Servicios
- `services/reports/massive_report.py` → orquesta generación
- `services/reports/xlsx_writer.py` → openpyxl, 3 hojas
- `services/reports/pdf_writer.py` → @react-pdf/renderer (Node) o reportlab (Python)

### Job async
- Sin Redis. Usar **BackgroundTasks** de FastAPI + polling desde frontend
- Almacenar archivos en `uploads/reports/{projectId}/{reportId}/`
- Limpieza opcional vía cron (no incluida en este corte)

## Edge cases

1. Proyecto sin trabajadores → modal muestra "Sin trabajadores cargados" y bloquea generación
2. Trabajador con estudios parciales → fila en XLSX con celdas N/A, marcado en preview
3. Falla en generación → `status: FAILED` con `errorMessage`, modal muestra error y opción de reintentar
4. Usuario sin permisos → botón oculto en `/projects/[id]`
5. Generación concurrente del mismo proyecto → permitir múltiples reportes (cada uno es histórico)

## Validación

```bash
cd frontend && pnpm typecheck
cd backend && pytest tests/test_reports.py -q
```

**Smoke test manual**:
1. Crear proyecto "TEST UMM" en `/projects/new`
2. Cargar 5+ trabajadores con `BulkWorkerImportModal`
3. Abrir `/projects/[id]`, click "Reporte Masivo"
4. Verificar preview: contadores correctos
5. Generar XLSX + PDF
6. Descargar ambos, comparar con `CONCENTRADO GENERAL EJEMPLO.xlsx`

## Referencias

- `context/datos AMI/Proyectos UMM/CONCENTRADO GENERAL EJEMPLO.xlsx` — formato operativo
- `context/datos AMI/Proyectos UMM/INFORMACION PARA CONCENTRADO.docx` — reglas de selección de campos
- `context/datos AMI/Proyectos UMM/DIAGNOSTICO SITUACIONAL EJEMPLO.pptx` — portada diagnóstica
- `context/decisions/ADR-20260623-01-MODULO-REPORTES-MASIVOS.md` — decisión arquitectónica
