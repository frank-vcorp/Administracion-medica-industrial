# HANDOFF IMPL-20260630-03 → SOFIA: Módulo de Reportes Masivos Backend + Frontend

**De:** INTEGRA (arquitectura)
**Para:** SOFIA (implementación)
**SPEC:** `context/SPECs/SPEC_IMPL-20260630-03-MODULO-REPORTES-BACKEND.md`
**SPEC funcional origen:** `context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md`

## Objetivo del handoff

Implementar end-to-end el módulo de reportes masivos por proyecto: backend con generadores XLSX/PDF idénticos al formato operativo, modelo Prisma, endpoints FastAPI con BackgroundTasks, y frontend con modal polling integrado en `/projects/[id]`.

## Orden de ejecución (respetar dependencias)

### FASE 1: Backend Core (sin esto no se puede probar nada)

#### Tarea 1.1 — Modelo Prisma `ProjectReport`

**Archivo:** `frontend/prisma/schema.prisma`

Agregar el modelo (ver SPEC sección "Alcance → Backend → punto 1") y las relaciones inversas en `model Project` y `model User`:

```prisma
model Project {
  // ... campos existentes
  reports ProjectReport[]
}

model User {
  // ... campos existentes
  generatedReports ProjectReport[]
}
```

**Validación local:**
```bash
cd frontend && npx prisma format
cd frontend && npx prisma validate
cd frontend && npx prisma generate
```

#### Tarea 1.2 — Migración Prisma

```bash
cd frontend && npx prisma migrate dev --name add_project_report_to_project
```

Esto crea `frontend/prisma/migrations/XXXXXX_add_project_report_to_project/migration.sql` con el SQL.

**Validar SQL generado:** Debe crear tabla `ProjectReport` con índices en `projectId` y `status`, FK a `Project` con `onDelete: Cascade`, FK a `User`.

#### Tarea 1.3 — Servicios generadores

**Carpeta:** `backend/app/services/reports/`

**Archivo 1:** `xlsx_writer.py`

Reusar estructura del demo en `frontend/src/lib/demo/xlsx-generator.ts` pero:
- Adaptar input al shape real de Prisma (Worker con relaciones a Audiometry, Espirometry, RxColumna, RxTorax, ECG, Laboratorio, ExamenMedico)
- Usar `openpyxl` (Python) en vez de `xlsx` (JS)
- Mantener 3 hojas idénticas: CONCENTRADO, LABORATORIOS, GRAFICAS

**Archivo 2:** `pdf_writer.py`

Reusar estructura del demo en `frontend/src/lib/demo/pdf-generator.tsx` pero:
- Usar `reportlab` (Python) en vez de `@react-pdf/renderer` (JS cliente)
- Mantener 2 secciones: Portada "Diagnóstico Situacional" + Concentrado tabular
- Tamaño A4, orientación landscape en concentrado

**Archivo 3:** `massive_report.py`

Orquesta:
1. Carga `Project` + todas las relaciones desde Prisma
2. Llama `xlsx_writer` y/o `pdf_writer` según `format`
3. Guarda archivos en `uploads/reports/{projectId}/{reportId}/`
4. Actualiza `ProjectReport.status` a READY + `fileUrlXlsx` + `fileUrlPdf`
5. En caso de error → status=FAILED + errorMessage

**Helper de conteos** (`backend/app/services/reports/conteos.py`):
- `calcular_conteos(project)`: total, completos, parciales, sinEstudios
- `calcular_hbc_por_rango(project)`
- `calcular_trauma_acustico_por_area(project)`
- etc.

Reusar lógica de `frontend/src/lib/demo/demo-conteos.ts` pero en Python.

#### Tarea 1.4 — Endpoints FastAPI

**Archivo:** `backend/app/api/reports.py`

```python
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from typing import Optional

router = APIRouter(prefix="/api/v2/projects/{project_id}/reports", tags=["reports"])

@router.post("/massive")
async def create_massive_report(
    project_id: str,
    format: str,  # 'XLSX' | 'PDF' | 'BOTH'
    background_tasks: BackgroundTasks,
    current_user = Depends(get_current_user)
):
    """Crea ProjectReport, dispara job asíncrono."""

@router.get("/{report_id}")
async def get_report_status(project_id: str, report_id: str):
    """Retorna estado actual del reporte."""

@router.get("/{report_id}/download")
async def download_report(project_id: str, report_id: str, format: str):
    """Sirve archivo XLSX o PDF."""

@router.get("")
async def list_project_reports(project_id: str):
    """Historial de reportes del proyecto."""
```

**Registrar en `backend/app/main.py`:**

```python
from app.api.reports import router as reports_router
app.include_router(reports_router)
```

#### Tarea 1.5 — Tests pytest

**Archivo:** `backend/tests/test_reports.py`

Mínimo 6 tests:
1. `test_create_project_report_returns_pending`
2. `test_xlsx_writer_creates_3_sheets`
3. `test_pdf_writer_creates_portada_and_concentrado`
4. `test_conteos_calculation`
5. `test_report_status_transitions_pending_to_ready`
6. `test_report_failed_with_error_message`

Usar `pytest` + `pytest-asyncio` + fixtures de proyecto mockeado.

### FASE 2: Frontend (requiere backend corriendo)

#### Tarea 2.1 — Hook polling

**Archivo:** `frontend/src/hooks/useProjectReportStatus.ts`

```typescript
export function useProjectReportStatus(
  projectId: string,
  reportId: string | null
) {
  // Polling cada 2s
  // Cleanup en useEffect return
  // Retorna { status, xlsxUrl, pdfUrl, error, isPolling }
}
```

#### Tarea 2.2 — Server actions

**Archivo:** `frontend/src/actions/project-reports.actions.ts`

```typescript
'use server';

export async function createMassiveReportAction(projectId: string, format: string) {
  // POST al backend, retorna { reportId, status: 'PENDING' }
}

export async function getReportStatusAction(projectId: string, reportId: string) {
  // GET status, retorna { status, fileUrlXlsx, fileUrlPdf, errorMessage }
}

export async function getProjectReportsHistoryAction(projectId: string) {
  // GET historial
}
```

Usar `fetch` con `process.env.BACKEND_URL` o el patrón que ya uses (probablemente en `src/lib/api.ts` o similar).

#### Tarea 2.3 — Componente modal

**Archivo:** `frontend/src/components/projects/ProjectMassiveReportModal.tsx`

Reusar patrón visual de `frontend/src/components/demo/DemoMassiveReportModal.tsx` pero:
- Conteos vienen de API real, no de demo-data
- Generación via server action + polling
- Links de descarga son URLs del backend, no data URIs
- Botón "Ver historial" expandible

#### Tarea 2.4 — Integración en `/projects/[id]`

**Archivo:** `frontend/src/app/projects/[id]/page.tsx`

Agregar:
```tsx
{canGenerateReport(session.user.role) && (
  <button onClick={() => setModalOpen(true)}>
    Reporte Masivo
  </button>
)}

<ProjectMassiveReportModal
  projectId={project.id}
  open={modalOpen}
  onClose={() => setModalOpen(false)}
/>
```

Helper de permisos:
```typescript
function canGenerateReport(role: string): boolean {
  return ['ADMIN', 'DOCTOR_GENERAL', 'RECEPTIONIST'].includes(role);
}
```

#### Tarea 2.5 — Tests Vitest

- `frontend/src/hooks/__tests__/useProjectReportStatus.test.ts`: mocking de fetch + cleanup
- `frontend/src/components/projects/__tests__/ProjectMassiveReportModal.test.tsx`: render + interacción

## Validaciones obligatorias antes de cerrar

```bash
# Backend
cd backend && python -m py_compile app/services/reports/*.py app/api/reports.py
cd backend && pytest tests/test_reports.py -q
cd backend && python -c "from app.main import app; print('OK')"  # verificar import

# Frontend
cd frontend && pnpm typecheck
cd frontend && pnpm test
cd frontend && pnpm lint
```

## Smoke test manual

Levantar backend y frontend:
```bash
# Terminal 1
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2
cd frontend && pnpm dev
```

1. Login como ADMIN en `http://localhost:3000`
2. Ir a `/projects/[id]` de un proyecto con ≥5 trabajadores
3. Verificar botón "Reporte Masivo" visible
4. Click → modal muestra conteos reales
5. Seleccionar "Ambos" → "Generar"
6. Ver polling cada 2s (PENDING → PROCESSING → READY)
7. Descargar XLSX, abrir, verificar 3 hojas con datos del proyecto
8. Descargar PDF, abrir, verificar portada + concentrado
9. Reabrir modal → ver reporte en historial

**Si todo funciona → micro-sprint exitoso → INTEGRA valida → pasamos a productivo.**

## Self-review manual antes de reportar como listo

- [ ] ¿El código refleja la SPEC IMPL-20260630-03 punto por punto?
- [ ] ¿Hay code smells evidentes (duplicación, funciones >50 líneas, magic numbers)?
- [ ] ¿Los tests cubren los edge cases listados en la SPEC?
- [ ] ¿Algún riesgo de regresión en endpoints existentes?
- [ ] ¿Las migraciones Prisma son aditivas (no rompen datos existentes)?
- [ ] ¿Los archivos se guardan en `uploads/reports/{projectId}/{reportId}/` con permisos correctos?

## Al cerrar

Reportar a INTEGRA con:
1. Lista de archivos creados/modificados
2. Resultado de validaciones (typecheck, tests, lint)
3. Captura de pantalla del smoke test
4. Self-review manual (checklist de arriba)
5. INTEGRA invocará a GEMINI como segunda mano de validación

**NO pidas qodo (está sunset). NO invocar a GEMINI directamente — INTEGRA lo hace.**

## NO hacer

- ❌ No commitear sin que INTEGRA revise
- ❌ No pushear a remoto
- ❌ No hacer deploy a Railway
- ❌ No firmar digitalmente PDFs (servicio separado)
- ❌ No agregar autenticación nueva (usar la existente)
- ❌ No modificar modelos existentes (solo agregar `ProjectReport` + relations)
- ❌ No usar `@react-pdf/renderer` (es cliente, debe ser backend con reportlab)