# Pipeline IA Modular - Guía de Implementación

## IMPL-20260225-01: Refactorización Backend IA

### ✅ Completado

1. **Estructura Modular**
   ```
   backend/app/
   ├── services/
   │   ├── ai/
   │   │   ├── __init__.py          (Exporta servicios)
   │   │   ├── base.py               (GeminiBase: llamadas a API)
   │   │   ├── classifier.py         (DocumentClassifierService)
   │   │   └── extractor.py          (ExtractorService especializado)
   │   └── __init__.py
   ├── schemas/
   │   ├── __init__.py               (Exporta esquemas)
   │   └── medical.py                (Pydantic models)
   ├── main.py                        (Actualizado con Pipeline v2.0)
   └── ...
   ```

2. **Documentación de Servicios**

### DocumentClassifierService

Clasifica documentos médicos **sin depender del nombre del archivo**.

```python
from app.services.ai import DocumentClassifierService

classifier = DocumentClassifierService(api_key="tu_gemini_api_key")
classification = classifier.classify("/ruta/a/documento.pdf")

print(f"Tipo: {classification.tipo}")
print(f"Confianza: {classification.confianza}")
print(f"Razón: {classification.razon}")
```

**Tipos soportados:**
- `Audiometria` - Estudios de audición
- `Laboratorio` - Análisis clínicos
- `Espirometria` - Pruebas de función pulmonar
- `Rayos_X` - Estudios radiológicos
- `Otro` - Documentos médicos genéricos

### ExtractorService

Extrae datos **estructurados y validados** según el tipo de documento.

```python
from app.services.ai import ExtractorService

extractor = ExtractorService(api_key="tu_gemini_api_key")
extracted = extractor.extract_by_type("/ruta/documento.pdf", "Audiometria")

# Retorna AudiometriaData validado por Pydantic
print(extracted.paciente)
print(extracted.fecha_estudio)
print(extracted.oido_derecho)  # Dict[int, int]
```

---

## Endpoint REST

### POST `/api/v1/analyze`

Análisis completo usando el Pipeline.

**Request:**
```json
{
  "file_path": "audiometria_juan.pdf"
}
```

**Response (200 OK):**
```json
{
  "status": "success",
  "file": "audiometria_juan.pdf",
  "classification": {
    "detected_type": "Audiometria",
    "confidence": 0.95,
    "reason": "Gráfico con frecuencias Hz y decibeles detectadas..."
  },
  "extraction": {
    "paciente": "Juan Pérez",
    "fecha_estudio": "25/02/2026",
    "oido_derecho": {"500": 10, "1000": 15, ...},
    "oido_izquierdo": {"500": 12, "1000": 18, ...},
    "diagnostico_ia": "Hipoacusia bilateral leve",
    "recomendaciones": ["Seguimiento cada 6 meses"],
    "interpretacion": "Patrón típico de exposición ocupacional"
  },
  "timings": {
    "classification_seconds": 3.45,
    "extraction_seconds": 2.12,
    "total_seconds": 5.57
  },
  "pipeline_version": "2.0"
}
```

---

## Esquemas Pydantic

Todos los esquemas están validados y documentados en `app/schemas/medical.py`:

- **DocumentClassification** - Resultado de clasificación
- **AudiometriaData** - Datos de estudio audiométrico
- **LaboratorioData** - Datos de análisis clínico
- **EspirometriaData** - Datos de función pulmonar
- **RayosXData** - Datos de estudio radiológico
- **ExtractedDataUnion** - Wrapper de clasificación + datos

---

## Variables de Entorno

```bash
GEMINI_API_KEY=tu_clave_aqui
GEMINI_MODEL=gemini-2.5-flash  # default
```

---

## Testing

```bash
cd backend/tests
pytest test_ai_pipeline.py -v

# Con cobertura:
pytest test_ai_pipeline.py --cov=app.services.ai --cov=app.schemas
```

Los tests incluyen:
- ✅ Instanciación correcta de servicios
- ✅ Mocking de Gemini API
- ✅ Validación de clasificación por tipo
- ✅ Validación de extracción estructurada
- ✅ Manejo de errores (API, parseo, archivos)

---

## Retrocompatibilidad

El endpoint legacy `/analyze` sigue disponible y redirige a `/api/v1/analyze`.

```python
@app.post("/analyze")
def analyze_document(request: AnalyzeRequest):
    return analyze_document_v2(request)
```

---

## Next Steps (Fase 6.2)

1. **Firma Digital** - Implementar `SignerService` con `pyHanko`
2. **Generación de Reportes** - Servicio de reportes masivos con ReportLab
3. **Frontend Integration** - Botón "Clasificar" y "Firmar Dictamen"

---

**Autor:** SOFIA - Builder
**ID:** IMPL-20260225-01
**Estado:** ✅ Completado (Gates 1-3)
