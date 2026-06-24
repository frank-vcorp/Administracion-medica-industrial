# HANDOFF ARCH-20260623-01 a SOFIA — Módulo de Reportes Masivos

**SPEC fuente:** `context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md`
**ADR:** `context/decisions/ADR-20260623-01-MODULO-REPORTES-MASIVOS.md`
**Micro-Sprint 1:** XLSX + PDF simple, async con polling, sin drill-down interactivo

## Objetivo

Construir el módulo de reportes masivos para `Project`. Genera concentrado estandarizado en XLSX y PDF para cualquier proyecto con carga masiva (UMM o clínica).

## Punto de entrada

- Frontend: `frontend/src/app/projects/[id]/page.tsx` (agregar botón "Reporte Masivo")
- Backend: `backend/app/main.py` (agregar endpoints)

## Archivos autorizados (≤8)

1. `frontend/prisma/schema.prisma` — agregar modelo `ProjectReport`
2. `frontend/src/actions/project-reports.actions.ts` (nuevo) — server actions
3. `frontend/src/components/projects/ProjectMassiveReportModal.tsx` (nuevo) — UI preview + generación
4. `frontend/src/app/projects/[id]/page.tsx` — botón + integración modal
5. `backend/app/main.py` — endpoints REST
6. `backend/app/services/reports/massive_report.py` (nuevo) — orquestador
7. `backend/app/services/reports/xlsx_writer.py` (nuevo) — openpyxl 3 hojas
8. `backend/app/services/reports/pdf_writer.py` (nuevo) — reportlab portada + concentrado

## Implementación esperada

### 1. Schema Prisma
```prisma
model ProjectReport {
  id            String    @id @default(cuid())
  projectId     String
  project       Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  format        String    // 'XLSX' | 'PDF' | 'BOTH'
  status        String    // 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
  fileUrlXlsx   String?
  fileUrlPdf    String?
  errorMessage  String?
  generatedById String
  generatedBy   User      @relation(fields: [generatedById], references: [id])
  generatedAt   DateTime  @default(now())
  completedAt   DateTime?
  @@index([projectId])
  @@index([status])
}
```

### 2. Endpoints backend

- `POST /api/v2/projects/{projectId}/reports/massive` body=`{format: "XLSX" | "PDF" | "BOTH"}` → crea ProjectReport PENDING, dispara BackgroundTask, retorna `{reportId, status}`
- `GET /api/v2/projects/{projectId}/reports/{reportId}` → estado
- `GET /api/v2/projects/{projectId}/reports/{reportId}/download?format=xlsx|pdf` → stream archivo
- `GET /api/v2/projects/{projectId}/reports` → historial (lista)

### 3. Server actions frontend

- `requestMassiveReport(projectId, format)` → crea report, retorna ID
- `pollReportStatus(projectId, reportId)` → estado actual
- `getProjectReportsHistory(projectId)` → historial

### 4. UI Modal

`ProjectMassiveReportModal.tsx`:
- Props: `projectId`, `isOpen`, `onClose`
- Estado interno: `preview`, `generating`, `reportStatus`, `downloadLinks`
- Al abrir: fetch preview data (total, completos, parciales, sin estudios)
- Botones formato: "XLSX", "PDF", "Ambos"
- Click generar: `requestMassiveReport()` → polling cada 2s
- Cuando READY: muestra links de descarga
- Tab "Historial" en el mismo modal: lista reportes previos con link descarga

### 5. XLSX Writer

3 hojas con openpyxl:
- **CONCENTRADO**: 1 fila/trabajador, columnas según `CONCENTRADO GENERAL EJEMPLO.xlsx` (folio, nombre, sexo, area, antiguedad, agudeza visual, ..., impresión diagnóstica)
- **LABORATORIOS**: 1 fila/trabajador con BH, QS6, EGO, TOXICOLÓGICO
- **GRAFICAS**: agregados (conteos por categoría)

Datos se obtienen con `prisma.projectWorker.findMany` + joins a `worker`, `medicalEvent`, `eventTest`, `studyRecord`, `studyExtractionSnapshot`, `aiPrediagnosisSnapshot`.

### 6. PDF Writer

- Página 1: Portada "Diagnóstico Situacional" (empresa, fechas, conteos, pirámide edad texto, distribución sexo)
- Páginas 2-N: Tabla concentrado (mismos datos que XLSX, simplificado para impresión)

Usar `reportlab` (Python) o `@react-pdf/renderer` (Node). Recomiendo reportlab por estar en backend.

## Restricciones

1. NO tocar lógica de admisión ni `MedicalEvent`
2. NO introducir Redis — usar `BackgroundTasks` FastAPI + polling simple
3. Reutilizar `@react-pdf/renderer` si vas por Node, o `reportlab` si Python
4. NO crear rutas nuevas fuera de `/projects/[id]` — todo en modal
5. NO romper carga masiva existente (`BulkWorkerImportModal`)
6. Reportes parciales permitidos: celdas N/A donde falten datos, NO bloquear
7. Limpiar `uploads/reports/{projectId}/` archivos > 30 días (opcional, dejar TODO si no da tiempo)

## Validación obligatoria

```bash
cd frontend && pnpm typecheck
cd backend && pytest tests/test_reports.py -q
```

**Smoke test manual**:
1. Crear proyecto en `/projects/new`
2. Cargar 5+ trabajadores con `BulkWorkerImportModal`
3. Click "Reporte Masivo" en `/projects/[id]`
4. Verificar preview: contadores correctos
5. Generar XLSX
6. Descargar y comparar con `CONCENTRADO GENERAL EJEMPLO.xlsx`
7. Repetir para PDF

## Self-review antes de cerrar

- ¿El preview muestra contadores correctos?
- ¿El XLSX tiene las 3 hojas con datos consistentes?
- ¿El PDF tiene portada + concentrado legible?
- ¿El polling se detiene al llegar a READY o FAILED?
- ¿Los links de descarga funcionan con el storage actual (filesystem/S3)?
- ¿La columna DX de audiometría prioriza el diagnóstico más grave entre OD y OI?

Al cerrar, **NO** pidas Qodo (está sunset). En su lugar, incluye self-review manual y sugiere que INTEGRA invoque a **GEMINI** (`subagent_type='gemini'`) como segunda mano de validación.
