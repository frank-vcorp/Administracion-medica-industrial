# ADR-20260623-01 — Módulo de Reportes Masivos por Proyecto

**Fecha:** 2026-06-23
**Estado:** [✓] Aprobada
**ID:** ARCH-20260623-01

## Contexto

El sistema AMI actualmente soporta proyectos (`Project`) con carga masiva de trabajadores (`BulkWorkerImportModal` + `ProjectWorker`), pero **no existe módulo de reporte consolidado** para entregar a la empresa cliente.

Los proyectos UMM (Unidades Médicas Móviles) requieren entregar:
- **CONCENTRADO GENERAL** (XLSX): una fila por trabajador con todos los estudios
- **LABORATORIOS** (XLSX): biometría hemática, QS6, EGO, toxicológico
- **GRAFICAS** (XLSX): agregados para diagnóstico situacional
- **DIAGNOSTICO SITUACIONAL** (PPTX/HTML): pirámide edad, distribución sexo, antecedentes, etc.

Actualmente esto se hace **a mano en Excel después de capturar** y se imprime. Esto es trabajo manual repetitivo, propenso a errores, y no auditable desde la plataforma.

## Decisión

Crear un **Módulo de Reportes Masivos** (`ProjectReportsModule`) que aplica a **cualquier proyecto con trabajadores cargados** (UMM o en clínica) y entrega dos formatos:

1. **XLSX** (concentrado, laboratorios, graficas) — para procesamiento por la empresa
2. **PDF ebook** con drill-down — para visualización interactiva

### Corte actual (Micro-Sprint 1)

**XLSX + PDF simple**:
- XLSX multi-hoja: CONCENTRADO + LABORATORIOS + GRAFICAS
- PDF estático con portada "Diagnóstico Situacional" + concentrado
- Sin drill-down interactivo (queda para Micro-Sprint 2)
- Sin historial persistente (queda para Micro-Sprint 3)
- Generación asíncrona con notificación (job + polling/SSE)

### Por qué async

Proyectos UMM pueden tener 100-500+ trabajadores con 12+ estudios cada uno. Generar PDF sincrónicamente es timeout garantizado.

### Por qué @react-pdf/renderer + PDF.js

- `@react-pdf/renderer` ya está en `package.json` (^4.3.2) — sin nueva dependencia para PDF estático
- `pdfjs-dist` se agregará en Micro-Sprint 2 para el viewer interactivo con drill-down
- Drill-down inicial: links internos a páginas de detalle por trabajador/estudio

### Por qué preview obligatorio

El usuario respondió que si un trabajador no tiene todos los estudios, debe verse preview con contadores (X de Y completos) antes de generar. Evita reportes con huecos confusos.

### Por qué no flag `isUMM`

El usuario fue explícito: el módulo no se limita a UMM. **Cualquier proyecto** con `ProjectWorker` activos puede generar reporte masivo. La condición es puramente funcional, no de metadata.

## Scope Micro-Sprint 1

### Incluido
- [ ] Server action `generateProjectMassiveReport(projectId, options)` async
- [ ] Tabla `ProjectReport` (historial mínimo: id, projectId, generatedBy, generatedAt, fileUrl, format, status)
- [ ] Endpoint backend para generación PDF (`POST /api/v2/projects/[id]/reports/massive`)
- [ ] Botón "Reporte Masivo" en `/projects/[id]` con modal de preview
- [ ] Modal de preview: muestra contadores (trabajadores completos, parciales, sin estudios) y formatos disponibles
- [ ] Generación asíncrona con polling del estado (`pending` → `processing` → `ready` | `failed`)
- [ ] XLSX con 3 hojas: CONCENTRADO, LABORATORIOS, GRAFICAS
- [ ] PDF con portada diagnóstica situacional + concentrado tabular

### Excluido (futuro)
- PDF.js viewer interactivo con drill-down (Micro-Sprint 2)
- Editor de plantillas por empresa (Micro-Sprint 3)
- Reportes comparativos entre proyectos (Micro-Sprint 4)

## Archivos autorizados (≤8)

1. `frontend/src/actions/project-reports.actions.ts` (nuevo)
2. `frontend/src/components/projects/ProjectMassiveReportModal.tsx` (nuevo)
3. `frontend/src/app/projects/[id]/page.tsx` (agregar botón)
4. `frontend/prisma/schema.prisma` (agregar modelo `ProjectReport`)
5. `backend/app/main.py` (agregar endpoint generación)
6. `backend/app/services/reports/massive_report.py` (nuevo)
7. `backend/app/services/reports/xlsx_writer.py` (nuevo)
8. `backend/app/services/reports/pdf_writer.py` (nuevo)

## Restricciones

1. No tocar lógica de admisión ni `MedicalEvent`
2. Reutilizar `prisma.worker.findMany` con relaciones ya cargadas
3. No introducir nuevo proveedor IA — los datos ya están extraídos
4. Reutilizar `@react-pdf/renderer` existente
5. Job async con tabla `ProjectReport` para tracking, **sin Redis** (usar polling simple)

## Validación

```bash
cd frontend && pnpm typecheck
cd backend && pytest tests/test_reports.py -q
```

Manual: crear proyecto → cargar 5+ trabajadores → generar XLSX + PDF → verificar paridad con `CONCENTRADO GENERAL EJEMPLO.xlsx`.
