# SPEC IMPL-20260630-03 — Módulo de Reportes Masivos (Backend + Frontend)

**ID:** IMPL-20260630-03
**Fecha:** 2026-06-30
**Estado:** [/] En progreso (cierre parcial ver `context/checkpoints/CHK_IMPL-20260630-03-MODULO-REPORTES.md`)
**ADR padre:** `context/decisions/ADR-20260623-01-MODULO-REPORTES-MASIVOS.md`
**SPEC funcional:** `context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md`
**Origen:** Junta con Lolis (reporte), Leticia y Frank Saavedra — demo de concentrado 10 trabajadores

## Objetivo

Implementar el módulo de reportes masivos por proyecto (UMM/clínica) end-to-end, con datos reales de Prisma, generación asíncrona backend, descarga XLSX + PDF idénticos al formato operativo `CONCENTRADO GENERAL EJEMPLO.xlsx`, y UI integrada en `/projects/[id]` con polling.

## Acuerdos de la junta (2026-04-08) que este módulo debe respetar

| Acuerdo | Impacto en implementación |
|---------|---------------------------|
| **Ubicación**: integrar reportes dentro de "Proyectos" | ✓ Botón en `/projects/[id]` (no módulo separado) |
| **Acceso clientes**: dashboard con navegación por paciente y por prueba | Pendiente fase 2 — acceso para `User.role = CLIENT` |
| **Formato entrega**: PDF imprimible tipo "libro" + Excel para tratamiento masivo | ✓ Ya contemplado (portada "Diagnóstico Situacional" + 3 hojas XLSX) |
| **Gráficas en PDF**: barras, pastel, resúmenes por estudio | ✓ Ya contemplado en hoja GRAFICAS y portada PDF |
| **Colores/marca**: logo Soluciones + paleta RGB/CMYK | ⚠️ Pendiente feedback Leticia — placeholder por ahora |
| **Organización tipo expediente**: todas las pruebas juntas por paciente (no por tipo) | ✓ Worker incluye todas las relaciones anidadas |
| **Audiometría**: DX unificado + valores por oído separados | ✓ Ya contemplado (`oidoDerecho` + `oidoIzquierdo`) |
| **Cuestionarios digitales**: integrarlos en papeleta para enfermería | Fuera de alcance de reportes |
| **Contadores en dashboard**: estado diagnóstico + avance pruebas | ✓ Ya en modal preview (total/completos/parciales/sinEstudios) |

## Alcance

### Backend (FastAPI + Prisma)

1. **Modelo Prisma `ProjectReport`** en `frontend/prisma/schema.prisma`:
   ```prisma
   model ProjectReport {
     id            String   @id @default(cuid())
     projectId     String
     project       Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
     format        String   // 'XLSX' | 'PDF' | 'BOTH'
     status        String   // 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'
     fileUrlXlsx   String?  // path relativo: uploads/reports/{projectId}/{reportId}/archivo.xlsx
     fileUrlPdf    String?  // path relativo: uploads/reports/{projectId}/{reportId}/archivo.pdf
     errorMessage  String?
     generatedById String
     generatedBy   User     @relation(fields: [generatedById], references: [id])
     generatedAt   DateTime @default(now())
     completedAt   DateTime?

     @@index([projectId])
     @@index([status])
   }
   ```

2. **Migración Prisma** `add_project_report_to_project`:
   - Generar con `npx prisma migrate dev --name add_project_report_to_project`
   - Aplicar a Railway con script existente `context/infra/apply-migrations.ts` o `frontend/scripts/sync-prisma-migrations.ts`

3. **Servicios backend** en `backend/app/services/reports/`:
   - `__init__.py`
   - `xlsx_writer.py`: genera 3 hojas (CONCENTRADO, LABORATORIOS, GRAFICAS) con openpyxl, formato idéntico a `CONCENTRADO GENERAL EJEMPLO.xlsx`
   - `pdf_writer.py`: genera PDF con portada "Diagnóstico Situacional" + concentrado tabular (usar reportlab o weasyprint, NO @react-pdf que es cliente)
   - `massive_report.py`: orquesta generación con FastAPI BackgroundTasks

4. **Endpoints FastAPI** en `backend/app/api/reports.py` (registrar en `main.py`):
   - `POST /api/v2/projects/{projectId}/reports/massive` — crea ProjectReport, dispara job
   - `GET /api/v2/projects/{projectId}/reports/{reportId}` — estado actual
   - `GET /api/v2/projects/{projectId}/reports/{reportId}/download?format=xlsx|pdf` — descarga archivo
   - `GET /api/v2/projects/{projectId}/reports` — historial (lista)

5. **Tests pytest** en `backend/tests/test_reports.py`:
   - Crear ProjectReport
   - Generar XLSX con datos reales (mockeados)
   - Generar PDF con datos reales (mockeados)
   - Verificar formato de 3 hojas en XLSX
   - Verificar portada + concentrado en PDF
   - Test de error → status FAILED con errorMessage

### Frontend (Next.js)

6. **Hook `useProjectReportStatus`** en `frontend/src/hooks/useProjectReportStatus.ts`:
   - Polling cada 2s con `setInterval`
   - Cleanup en `useEffect` return
   - Estados: `idle`, `pending`, `processing`, `ready`, `failed`
   - Retorna: `{ status, xlsxUrl, pdfUrl, error, isPolling }`

7. **Componente `ProjectMassiveReportModal`** en `frontend/src/components/projects/ProjectMassiveReportModal.tsx`:
   - Preview con conteos reales desde API (total, completos, parciales, sinEstudios)
   - Selector de formato (XLSX, PDF, Ambos)
   - Botón "Generar" → llama POST → muestra polling → links de descarga
   - Botón "Cerrar" limpio
   - Reusar lógica de conteos del demo (`calcularConteos`) pero adaptada al shape real de Prisma

8. **Botón en `/projects/[id]/page.tsx`**:
   - Visible solo si rol ∈ {ADMIN, DOCTOR_GENERAL, RECEPTIONIST}
   - onClick → abre `ProjectMassiveReportModal`

9. **Server action** `frontend/src/actions/project-reports.actions.ts`:
   - `createMassiveReportAction(projectId, format)`: llama POST al backend
   - `getReportStatusAction(projectId, reportId)`: llama GET status
   - `getProjectReportsHistoryAction(projectId)`: lista historial

10. **Tests Vitest** en `frontend/src/components/projects/__tests__/`:
    - `ProjectMassiveReportModal.test.tsx`: render, click generar, polling, descarga
    - `useProjectReportStatus.test.ts`: estados, cleanup, error

## Archivos a crear/modificar

### Nuevos
- `frontend/prisma/migrations/XXXXXX_add_project_report_to_project/migration.sql`
- `backend/app/services/reports/__init__.py`
- `backend/app/services/reports/xlsx_writer.py`
- `backend/app/services/reports/pdf_writer.py`
- `backend/app/services/reports/massive_report.py`
- `backend/app/api/reports.py`
- `backend/tests/test_reports.py`
- `frontend/src/hooks/useProjectReportStatus.ts`
- `frontend/src/components/projects/ProjectMassiveReportModal.tsx`
- `frontend/src/components/projects/__tests__/ProjectMassiveReportModal.test.tsx`
- `frontend/src/hooks/__tests__/useProjectReportStatus.test.ts`
- `frontend/src/actions/project-reports.actions.ts`
- `frontend/src/lib/reports/conteos.ts` (lógica de conteos reutilizable)

### Modificar
- `frontend/prisma/schema.prisma` (agregar model ProjectReport + relation en Project y User)
- `backend/app/main.py` (registrar router de reports)
- `frontend/src/app/projects/[id]/page.tsx` (agregar botón condicional)

## Dependencias backend a agregar

```txt
# requirements.txt
openpyxl>=3.1.0
reportlab>=4.0.0  # o weasyprint si se prefiere
```

(Si ya existen, omitir.)

## Validaciones obligatorias antes de cerrar

```bash
cd backend && pytest tests/test_reports.py -q
cd frontend && pnpm typecheck
cd frontend && pnpm test
cd frontend && pnpm lint
```

## Smoke test manual (cierre de sesión)

1. Levantar backend y frontend en local
2. Login como ADMIN
3. Ir a `/projects/[id]` de un proyecto con ≥5 trabajadores
4. Verificar que botón "Reporte Masivo" aparece
5. Click → modal muestra conteos correctos
6. Seleccionar "Ambos" → click "Generar"
7. Ver polling cada 2s, estados PENDING → PROCESSING → READY
8. Descargar XLSX, abrir, verificar 3 hojas con datos reales
9. Descargar PDF, abrir, verificar portada + concentrado
10. Cerrar modal, reabrir → ver reporte en historial

## Criterio de "terminado y bien hecho"

- [ ] Todas las validaciones automatizadas pasan
- [ ] Smoke test manual ejecutado con proyecto real y captura de pantalla
- [ ] Auditoría GEMINI = APROBADO (sin bloqueadores)
- [ ] Sin código muerto ni TODOs sin resolver
- [ ] PROYECTO.md actualizado a `[✓]`
- [ ] Checkpoint `context/checkpoints/CHK_IMPL-20260630-03-MODULO-REPORTES.md` generado

## NO alcance (fuera de este micro-sprint)

- No se hace deploy a producción Railway (queda para cuando esté terminado y validado)
- No se firma digitalmente el PDF (eso ya existe en `pdf/signer.py` como servicio independiente)
- No se agrega limpieza automática de archivos viejos
- No se notifica por email/WhatsApp al terminar

## Referencias

- Demo funcional: `https://administracion-medica-industrial.vercel.app/demo/reports/valiant-umm-demo`
- Formato operativo: `context/datos AMI/Proyectos UMM/CONCENTRADO GENERAL EJEMPLO.xlsx`
- SPEC funcional: `context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md`
- ADR: `context/decisions/ADR-20260623-01-MODULO-REPORTES-MASIVOS.md`