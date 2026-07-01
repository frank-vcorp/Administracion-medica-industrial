# HANDOFF IMPL-20260701-04 → SOFIA: EBOOK PDF - FASE 4 (Frontend + API integration)

**De:** INTEGRA
**Para:** SOFIA
**Continúa de:** IMPL-20260701-03 (Fase 3 cerrada, 8/8 tests, 8 secciones + 8 estadísticas + imágenes)
**SPEC:** `context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md` (sección 6.4 API + 7.1 Frontend)

## Objetivo

Integrar el `pdf_ebook_writer` con el sistema existente:

1. **Backend**: Modificar orquestador `massive_report.py` para que cuando `format='EBOOK'` use `pdf_ebook_writer` en vez de `pdf_writer`. Marcar `pdf_writer.py` como deprecated.
2. **API**: Validar `format` acepta `'XLSX' | 'EBOOK' | 'BOTH'`.
3. **Frontend**: Cambiar tipo `ReportFormat` de `'PDF'` a `'EBOOK'`, actualizar modal, server action, labels.
4. **Tests**: E2E que verifique la integración end-to-end.

## Decisiones arquitectónicas FIJAS

- Mantener `pdf_writer.py` intacto pero marcado como deprecated (rollback safety)
- Enum `format` cambia de `'PDF'` a `'EBOOK'` en frontend
- Frontend manda `EBOOK` al backend (no `PDF`)
- Backend `reports.py` valida `'EBOOK'` y llama a `pdf_ebook_writer`
- `massive_report.py` orquesta: si format incluye EBOOK → `pdf_ebook_writer.generar_ebook()`
- Naming archivo: `EBOOK_{empresa}_{fecha}.pdf` (ya implementado)

## ⚠️ SCOPE TIGHT — Prioridades

1. **PRIORIDAD 1**: Modificar `massive_report.py` para usar `pdf_ebook_writer` cuando format='EBOOK'
2. **PRIORIDAD 2**: Actualizar validación en `backend/app/api/reports.py` 
3. **PRIORIDAD 3**: Marcar `pdf_writer.py` como deprecated (solo docstring + comment)
4. **PRIORIDAD 4**: Frontend types (`ReportFormat = 'XLSX' | 'EBOOK' | 'BOTH'`)
5. **PRIORIDAD 5**: Frontend modal (label "PDF" → "EBOOK", descripción actualizada)
6. **PRIORIDAD 6**: Frontend server action (enviar `'EBOOK'` en vez de `'PDF'`)
7. **PRIORIDAD 7**: Tests E2E (backend + frontend)

**Mínimo aceptable**: PRIORIDAD 1-3 (backend). Frontend puede esperar.

## Archivos a modificar

### Backend
- `backend/app/services/reports/massive_report.py` — orquestador
- `backend/app/api/reports.py` — validación de format
- `backend/app/services/reports/pdf_writer.py` — solo docstring deprecated

### Frontend
- `frontend/src/lib/reports/types.ts` — `ReportFormat` type
- `frontend/src/components/projects/ProjectMassiveReportModal.tsx` — labels
- `frontend/src/actions/project-reports.actions.ts` — server action
- `frontend/src/components/projects/__tests__/ProjectMassiveReportModal.test.tsx` — test

## Tareas Backend (PRIORIDADES 1-3)

### Tarea 1: Modificar `massive_report.py`

**Lee primero el archivo actual** (línea ~250-323 donde está la orquestación).

**Busca la sección** que tiene algo como:
```python
# Probablemente hay un branch con format='PDF' que llama pdf_writer.generar_pdf()
# Si format='PDF' o 'BOTH':
#     pdf_path = pdf_writer.generar_pdf(project_snapshot, ...)
#     guardar en storage
```

**Modifícalo para**:
```python
from app.services.reports.pdf_ebook_writer import generar_ebook as generar_ebook_pdf

# En la función de orquestación:
if format in ('EBOOK', 'BOTH'):
    # Construir snapshot con datos necesarios
    snapshot = project_to_snapshot(project_data)
    output_path = f"{UPLOAD_DIR}/{project_id}/{report_id}/EBOOK_{empresa_slug}_{fecha}.pdf"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    generar_ebook_pdf(snapshot, output_path)
    file_url_pdf = build_file_url(output_path)
    update_project_report_file_url(report_id, 'pdf', file_url_pdf)

# Si format='PDF' (legacy, no debería llegar porque validación rechaza)
# Pero por retrocompatibilidad:
if format == 'PDF':
    # Log warning + fallback a EBOOK
    logger.warning(f"format='PDF' recibido pero deprecated, usando EBOOK")
    # Llamar pdf_ebook_writer también
```

**Importante**: El campo en DB se llama `fileUrlPdf` aunque ahora almacene un EBOOK (mantener nombre por compatibilidad con DB schema).

### Tarea 2: Modificar `backend/app/api/reports.py`

**Lee el endpoint POST /massive**. Busca donde valida `format`.

**Modifica la validación**:
```python
# Antes:
ALLOWED_FORMATS = {'XLSX', 'PDF', 'BOTH'}

# Ahora:
ALLOWED_FORMATS = {'XLSX', 'EBOOK', 'BOTH'}
```

Y el mensaje de error:
```python
if format not in ALLOWED_FORMATS:
    raise HTTPException(
        status_code=400, 
        detail=f"format inválido. Valores permitidos: {sorted(ALLOWED_FORMATS)}"
    )
```

### Tarea 3: Marcar `pdf_writer.py` como deprecated

**Solo agregar al inicio del archivo** (NO modificar lógica):

```python
"""
⚠️ DEPRECATED — Este archivo ya no se usa en producción.
Reemplazado por `pdf_ebook_writer.py` (IMPL-20260701-01..04).
Se mantiene para rollback de emergencia y referencia histórica.

Para generar ebooks en producción, usar:
    from app.services.reports.pdf_ebook_writer import generar_ebook

NO MODIFICAR este archivo. Su logica está congelada.
"""
```

## Tareas Frontend (PRIORIDADES 4-6)

### Tarea 4: Modificar `frontend/src/lib/reports/types.ts`

```typescript
// Antes
export type ReportFormat = 'XLSX' | 'PDF' | 'BOTH';

// Ahora
export type ReportFormat = 'XLSX' | 'EBOOK' | 'BOTH';

export interface ProjectReportResponse {
  id: string;
  projectId: string;
  format: ReportFormat;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
  fileUrlXlsx?: string;
  fileUrlPdf?: string;  // ← apunta al EBOOK (mantener nombre por compat DB)
  errorMessage?: string;
  generatedAt: string;
  completedAt?: string;
}
```

### Tarea 5: Modificar `frontend/src/components/projects/ProjectMassiveReportModal.tsx`

**Lee el archivo actual** y busca donde está el selector de formato. Probablemente tiene 3 opciones: XLSX, PDF, AMBOS.

**Modifica el selector**:
```tsx
{/* Antes */}
<FormatoRadio value="PDF" ... label="PDF" ... descripcion="..." />
<FormatoRadio value="AMBOS" ... label="Ambos" ... />

{/* Ahora */}
<FormatoRadio 
  value="EBOOK" 
  label="EBOOK (PDF navegable)" 
  descripcion="Documento único con índice, bookmarks, estadísticas con gráficas y una sección por trabajador con sus estudios e imágenes embebidas. Reemplaza la carpeta física." 
/>
<FormatoRadio 
  value="BOTH" 
  label="Ambos" 
  descripcion="Genera XLSX y EBOOK en la misma corrida" 
/>
```

**Agregar nota sobre traducción** (debajo del selector):
```tsx
<p className="text-xs text-slate-500 italic mt-2">
  💡 Los EBOOKs están en español. Si necesita traducirlo, ábralo en Chrome/Edge 
  y use la función de traducción del navegador (click derecho → Traducir).
</p>
```

### Tarea 6: Modificar `frontend/src/actions/project-reports.actions.ts`

**Busca donde se envía format al backend**. Probablemente:
```typescript
const body = { format: 'PDF' };  // o similar
```

**Modifica**:
```typescript
// Cambiar todas las referencias de 'PDF' a 'EBOOK' en el envío
const body = { format: 'EBOOK' };  // o el valor seleccionado
```

Y actualizar tipos:
```typescript
import type { ReportFormat } from '@/lib/reports/types';

async function createMassiveReportAction(projectId: string, format: ReportFormat) {
  // ...
}
```

## Tarea 7: Tests E2E (PRIORIDAD 7)

### Backend test

Agregar a `backend/tests/test_pdf_ebook_writer.py`:

```python
def test_ebook_format_validation():
    """Verifica que el formato 'EBOOK' es aceptado (no 'PDF')."""
    # Importar el router o la función de validación
    from app.api.reports import _validate_format  # o donde esté
    
    assert _validate_format('EBOOK') == 'EBOOK'
    assert _validate_format('XLSX') == 'XLSX'
    assert _validate_format('BOTH') == 'BOTH'
    
    with pytest.raises(ValueError):
        _validate_format('PDF')  # PDF debe estar deprecado
```

### Frontend test

En `frontend/src/components/projects/__tests__/ProjectMassiveReportModal.test.tsx`:

```tsx
it('muestra opciones XLSX, EBOOK, BOTH (no PDF)', () => {
  render(<ProjectMassiveReportModal ... />);
  
  expect(screen.getByText(/EBOOK/i)).toBeInTheDocument();
  expect(screen.queryByText(/PDF/i)).not.toBeInTheDocument(); // PDF deprecado
  expect(screen.getByText(/XLSX/i)).toBeInTheDocument();
});
```

## Validaciones obligatorias

```bash
# 1. Sintaxis backend
cd backend && python -m py_compile app/services/reports/massive_report.py
cd backend && python -m py_compile app/api/reports.py

# 2. Tests backend
cd backend && pytest tests/ -v
# Esperado: TODOS los tests existentes siguen pasando + nuevo test pasa

# 3. Smoke test E2E (simular lo que el modal haría)
cd backend && python -c "
from app.services.reports.massive_report import orchestrate_massive_report
project_id = 'test-id'
report_id = 'test-rpt'
format = 'EBOOK'
result = orchestrate_massive_report(project_id, report_id, format)
print(result)
assert result['status'] == 'READY'
assert 'file_url_pdf' in result
"

# 4. Frontend typecheck
cd frontend && pnpm typecheck 2>&1 | head -30
# Esperado: 0 errores nuevos del módulo reportes (errores preexistentes OK)

# 5. Frontend tests
cd frontend && pnpm test -- --run 2>&1 | tail -20
# Esperado: tests del modal pasan
```

## Reglas inquebrantables

- ❌ NO elimines `pdf_writer.py` (solo márcalo deprecated)
- ❌ NO modifiques `conteos.py`
- ❌ NO modifiques el schema Prisma
- ❌ NO commitear ni pushear
- ❌ NO invoques qodo ni GEMINI
- ❌ NO hagas deploy

## Reporte final

Reporta con:
1. Prioridades completadas (1-7)
2. ✅/❌ de pytest backend
3. ✅/❌ de pnpm typecheck frontend
4. ✅/❌ de smoke test E2E
5. Path del PDF EBOOK generado en smoke test
6. Self-review
7. **Si alcanzaste límite**: reporta dónde quedaste
8. Recomendación para Fase 5 (validación stakeholders)