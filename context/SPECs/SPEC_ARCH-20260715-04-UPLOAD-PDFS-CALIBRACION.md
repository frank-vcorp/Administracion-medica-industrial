# SPEC ARCH-20260715-04 — Upload de PDFs de Prueba en Módulo de Calibración

## Contexto

Actualmente el módulo de calibración (`/admin/services/[id]/calibration`) solo muestra snapshots de EventTests reales procesados en papeletas. No hay forma de subir un PDF de prueba directamente para validar la calibración sin crear una papeleta real.

**Problema:** Para validar la calibración de Audiometría con el PDF de prueba (`CERVANTES CELEDON DAMIAN-161745-23-12-2025_04_18_14_3333.pdf`), el usuario tiene que:
1. Crear una papeleta real
2. Agregar Audiometría
3. Subir el PDF
4. Esperar procesamiento
5. Ver resultados en papeleta
6. Los snapshots aparecen en calibración

Esto es innecesariamente complejo para validar calibración.

## Objetivo

Agregar funcionalidad de upload de PDFs de prueba directamente en el módulo de calibración, permitiendo:
1. Subir un PDF de prueba
2. Procesarlo con el pipeline de extracción/prediagnóstico
3. Mostrar resultados sin crear EventTest real
4. Usar resultados para validar y ajustar calibración

## Alcance

### ✅ INCLUYE

1. **Backend:**
   - Endpoint `POST /api/v1/calibration/upload` para subir PDF de prueba
   - Endpoint `GET /api/v1/calibration/test/{test_id}/results` para obtener resultados
   - Lógica para procesar PDF sin crear EventTest
   - Almacenamiento temporal de resultados (no persistir en DB)

2. **Frontend:**
   - Botón "Subir PDF de prueba" en módulo de calibración
   - Componente de upload con drag & drop
   - Tab nuevo "📄 Pruebas" en CalibrationWorkspaceClient
   - Visualización de resultados de extracción y prediagnóstico
   - Comparación lado a lado con calibración actual

3. **Flujo:**
   - Usuario sube PDF → backend procesa → frontend muestra resultados
   - Resultados NO se guardan en DB (solo memoria/redis)
   - Usuario puede ajustar prompts y re-procesar

### ❌ NO INCLUYE

- Persistir resultados de prueba en DB
- Crear EventTests reales
- Modificar flujo de papeleta
- Cambiar lógica de extracción/prediagnóstico
- Agregar autenticación adicional (usa la existente)

## Especificación Técnica

### Backend

#### Endpoint 1: Upload PDF de Prueba

**Ruta:** `POST /api/v1/calibration/upload`

**Request:**
```http
POST /api/v1/calibration/upload
Content-Type: multipart/form-data

{
  "file": <PDF file>,
  "test_id": "uuid",
  "test_type": "Audiometria"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "test_id": "calibration_test_abc123",
  "extraction": {
    "structured_data": {...},
    "raw_payload": {...},
    "model_used": "gemini-2.5-pro",
    "prompt_version": "extract-audio-v2",
    "duration_seconds": 12.5
  },
  "prediagnosis": {
    "result": {...},
    "model_used": "medgemma-4b-it",
    "prompt_version": "predx-audiometria-v2-derivado",
    "duration_seconds": 8.3
  }
}
```

**Lógica:**
1. Recibir PDF y test_id
2. Llamar `ExtractorService.extract_by_type()` con `ai_calibration` del test
3. Llamar `PrediagnosticService.generate_prediagnosis()` con datos extraídos
4. Retornar resultados sin persistir
5. Generar ID temporal (no UUID de DB)

**Errores:**
- `400 Bad Request` si falta archivo o test_id
- `404 Not Found` si test_id no existe
- `500 Internal Server Error` si falla extracción/prediagnóstico

#### Endpoint 2: Obtener Resultados de Prueba

**Ruta:** `GET /api/v1/calibration/test/{test_id}/results`

**Response (200 OK):**
```json
{
  "test_id": "calibration_test_abc123",
  "extraction": {...},
  "prediagnosis": {...},
  "created_at": "2026-07-15T20:30:00Z"
}
```

**Nota:** En V1, los resultados se retornan inmediatamente en el upload. Este endpoint es para futuro (cache/persistencia).

#### Archivo: `backend/app/api/v1/endpoints/calibration.py`

**Nuevo archivo** con endpoints de calibración:

```python
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.services.ai.extractor import ExtractorService
from app.services.ai.prediagnostics import PrediagnosticService
from app.actions.medical_profiles import get_medical_test_by_id
import tempfile
import os

router = APIRouter()

@router.post("/upload")
async def upload_calibration_test(
    file: UploadFile = File(...),
    test_id: str = Form(...),
    test_type: str = Form(...)
):
    """
    Sube y procesa un PDF de prueba para calibración.
    No persiste en DB, solo retorna resultados.
    """
    # Validar archivo
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")
    
    # Obtener configuración de calibración
    test = await get_medical_test_by_id(test_id)
    if not test:
        raise HTTPException(status_code=404, detail="Test no encontrado")
    
    ai_calibration = test.options.get('aiCalibration') if test.options else None
    
    # Guardar archivo temporal
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    
    try:
        # Extracción
        extractor = ExtractorService()
        extraction_result = extractor.extract_by_type(
            file_path=tmp_path,
            doc_type=test_type,
            ai_calibration=ai_calibration
        )
        
        # Prediagnóstico
        prediagnostic = PrediagnosticService()
        prediagnosis_result = prediagnostic.generate_prediagnosis(
            study_type=test_type,
            extracted_data=extraction_result.dict() if hasattr(extraction_result, 'dict') else extraction_result,
            ai_calibration=ai_calibration
        )
        
        return {
            "success": True,
            "test_id": f"calibration_test_{test_id[:8]}",
            "extraction": {
                "structured_data": extraction_result.dict() if hasattr(extraction_result, 'dict') else extraction_result,
                "raw_payload": extraction_result.dict() if hasattr(extraction_result, 'dict') else extraction_result,
                "model_used": "gemini-2.5-pro",
                "prompt_version": ai_calibration.get('extraction', {}).get('version', 'unknown') if ai_calibration else 'unknown',
                "duration_seconds": 0  # TODO: medir tiempo real
            },
            "prediagnosis": {
                "result": prediagnosis_result.dict(),
                "model_used": "medgemma-4b-it",
                "prompt_version": ai_calibration.get('diagnosis', {}).get('version', 'unknown') if ai_calibration else 'unknown',
                "duration_seconds": 0  # TODO: medir tiempo real
            }
        }
    finally:
        # Limpiar archivo temporal
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
```

#### Registro en Router Principal

**Archivo:** `backend/app/api/v1/router.py`

Agregar:
```python
from app.api.v1.endpoints import calibration

api_router.include_router(calibration.router, prefix="/calibration", tags=["calibration"])
```

### Frontend

#### Componente 1: CalibrationTestUpload

**Archivo:** `frontend/src/components/calibration/CalibrationTestUpload.tsx`

**Props:**
```typescript
interface CalibrationTestUploadProps {
  testId: string
  testType: string
  onResults: (results: CalibrationTestResults) => void
}
```

**UI:**
- Zona de drag & drop para PDF
- Botón "Seleccionar archivo" como fallback
- Indicador de progreso durante upload
- Mensaje de error si falla

**Lógica:**
1. Usuario selecciona PDF
2. Enviar a `POST /api/v1/calibration/upload` con FormData
3. Mostrar spinner durante procesamiento
4. Al recibir resultados, llamar `onResults()`

#### Componente 2: CalibrationTestResults

**Archivo:** `frontend/src/components/calibration/CalibrationTestResults.tsx`

**Props:**
```typescript
interface CalibrationTestResultsProps {
  results: CalibrationTestResults
}
```

**UI:**
- Tabs: "Extracción" | "Prediagnóstico"
- Panel de extracción: JSON formateado de structured_data
- Panel de prediagnóstico: JSON formateado de result
- Métricas: tiempo de procesamiento, modelo usado, versión de prompt

#### Tipo: CalibrationTestResults

**Archivo:** `frontend/src/types/calibration.ts`

Agregar:
```typescript
export interface CalibrationTestResults {
  test_id: string
  extraction: {
    structured_data: Record<string, unknown>
    raw_payload: Record<string, unknown>
    model_used: string
    prompt_version: string
    duration_seconds: number
  }
  prediagnosis: {
    result: Record<string, unknown>
    model_used: string
    prompt_version: string
    duration_seconds: number
  }
}
```

#### Modificación: CalibrationWorkspaceClient

**Archivo:** `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx`

**Cambios:**
1. Agregar tab "📄 Pruebas" en el header
2. Agregar estado para resultados de prueba
3. Renderizar CalibrationTestUpload y CalibrationTestResults en tab "Pruebas"

```typescript
type LeftTab = "propuesta" | "presentacion" | "configuracion" | "historial" | "snapshots" | "pruebas"

const TAB_LABELS: Record<LeftTab, string> = {
  propuesta: "🤖 Propuesta IA",
  presentacion: "🧩 Presentación",
  configuracion: "⚙ Configuración",
  historial: "🕐 Historial",
  snapshots: "📋 Snapshots",
  pruebas: "📄 Pruebas",  // NUEVO
}
```

En el render:
```typescript
{activeTab === "pruebas" && (
  <div className="space-y-4">
    <CalibrationTestUpload
      testId={testId}
      testType={aiCalibration?.canonicalStudyType || 'Audiometria'}
      onResults={setTestResults}
    />
    {testResults && <CalibrationTestResults results={testResults} />}
  </div>
)}
```

## Criterios de Aceptación

1. ✅ Usuario puede subir PDF desde módulo de calibración
2. ✅ Backend procesa PDF con pipeline de extracción/prediagnóstico
3. ✅ Frontend muestra resultados de extracción y prediagnóstico
4. ✅ Resultados NO se guardan en DB
5. ✅ Usuario puede ajustar prompts y re-procesar
6. ✅ TypeScript compila sin errores
7. ✅ Backend compila sin errores
8. ✅ Tests existentes siguen pasando

## Validaciones Obligatorias

```bash
# Backend
cd backend && python -m pytest tests/ -v

# Frontend
cd frontend && pnpm typecheck && pnpm build --filter frontend
```

## Notas para Sofia

- **NO modifiques** la lógica de extracción/prediagnóstico existente
- **NO persistas** resultados de prueba en DB
- **NO crees** EventTests reales
- **Usa** archivos temporales para PDFs subidos
- **Limpia** archivos temporales después de procesar
- **Mantén** compatibilidad con TypeScript estricto
- **Agrega** tipos necesarios en `calibration.ts`

## Archivos Afectados

### Backend (nuevos)
1. `backend/app/api/v1/endpoints/calibration.py` — endpoints de calibración

### Backend (modificados)
2. `backend/app/api/v1/router.py` — registrar router de calibración

### Frontend (nuevos)
3. `frontend/src/components/calibration/CalibrationTestUpload.tsx` — componente de upload
4. `frontend/src/components/calibration/CalibrationTestResults.tsx` — componente de resultados

### Frontend (modificados)
5. `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx` — agregar tab "Pruebas"
6. `frontend/src/types/calibration.ts` — agregar tipo CalibrationTestResults

## Archivos NO Afectados

- `backend/app/services/ai/extractor.py` — no se modifica
- `backend/app/services/ai/prediagnostic.py` — no se modifica
- `backend/app/schemas/medical.py` — no se modifica
- Lógica de papeleta — no se modifica
- Lógica de EventTest — no se modifica

## Metadata

- **ID:** ARCH-20260715-04
- **Fecha:** 2026-07-15
- **Autor:** INTEGRA (Arquitecto de Soluciones)
- **Implementa:** SOFIA (Constructora Principal)
- **Prioridad:** Alta
- **Estimación:** 2-3 horas
