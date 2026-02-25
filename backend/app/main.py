"""
Residente Digital API - Backend con Pipeline IA Modular
IMPL-20260225-01: Clasificação y extracción inteligentes de documentos médicos.
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import time
import json

from services.ai import DocumentClassifierService, ExtractorService
from schemas import DocumentClassification, ExtractedDataUnion

app = FastAPI(
    title="Residente Digital API",
    description="Pipeline IA modular para análisis de documentos médicos"
)

UPLOAD_DIR = "/app/uploads"
# Using the key provided by user (Temporary for MVP)
# In production this MUST be an env variable.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyC5bVos0JwqdutC3JsQf6I3sNY7NVv2qlQ")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Inicializar servicios de IA
try:
    classifier = DocumentClassifierService(api_key=GEMINI_API_KEY, model=GEMINI_MODEL)
    extractor = ExtractorService(api_key=GEMINI_API_KEY, model=GEMINI_MODEL)
except Exception as e:
    print(f"⚠️ Error inicializando servicios de IA: {e}")
    classifier = None
    extractor = None 

class AnalyzeRequest(BaseModel):
    """Solicitud de análisis de documento médico."""
    file_path: str
    expected_type: str | None = None  # Para retrocompatibilidad (ahora se detecta automáticamente)


@app.get("/")
def read_root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "Residente Digital Backend (Pipeline IA Modular)",
        "version": "2.0",
        "pipeline": "Clasificador + Extractor Especializado"
    }

def get_b64_content(file_path):
    """
    Returns base64 string of the image. 
    If PDF, converts first page to JPEG first.
    DEPRECATED: Use GeminiBase.get_b64_content() from services instead.
    """
    pass  # Implementado en services/ai/base.py


def get_prompt_for_type(filename: str):
    """
    DEPRECATED: Las prompts están especializadas en ExtractorService.
    Este método se mantiene por retrocompatibilidad solo.
    """
    pass  # Implementado en services/ai/extractor.py


def call_gemini(local_path, prompt):
    """
    DEPRECATED: Use GeminiBase.call_gemini() from services.
    """
    pass  # Implementado en services/ai/base.py


@app.post("/api/v1/analyze")
def analyze_document_v2(request: AnalyzeRequest):
    """
    Endpoint mejorado que usa el Pipeline IA Modular.
    
    1. Clasifica el documento (Audiometría, Laboratorio, etc.)
    2. Extrae datos estructurados según el tipo específico.
    3. Retorna JSON con validación Pydantic.
    
    IMPL-20260225-01: Pipeline IA modular.
    """
    if not classifier or not extractor:
        return {
            "status": "error",
            "error": "Servicios de IA no están disponibles"
        }
    
    filename = os.path.basename(request.file_path)
    local_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(local_path):
        raise HTTPException(
            status_code=404,
            detail=f"Archivo no encontrado: {filename}"
        )
    
    try:
        print(f"\n🚀 Analizando documento: {filename}")
        pipeline_start = time.time()
        
        # PASO 1: CLASIFICACIÓN
        print("► Paso 1: Clasificación de documento")
        classification = classifier.classify(local_path)
        classification_time = time.time() - pipeline_start
        print(f"   ✓ Clasificado como: {classification.tipo} (confianza: {classification.confianza:.2f})")
        
        # PASO 2: EXTRACCIÓN ESPECIALIZADA
        print(f"► Paso 2: Extracción de datos para {classification.tipo}")
        extraction_start = time.time()
        extracted_data = extractor.extract_by_type(local_path, classification.tipo)
        extraction_time = time.time() - extraction_start
        print(f"   ✓ Datos extraídos correctamente")
        
        # PASO 3: RETORNAR RESULTADO ESTRUCTURADO
        total_time = time.time() - pipeline_start
        
        return {
            "status": "success",
            "file": filename,
            "classification": {
                "detected_type": classification.tipo,
                "confidence": classification.confianza,
                "reason": classification.razon,
            },
            "extraction": extracted_data if isinstance(extracted_data, dict) else extracted_data.model_dump(),
            "timings": {
                "classification_seconds": round(classification_time, 2),
                "extraction_seconds": round(extraction_time, 2),
                "total_seconds": round(total_time, 2),
            },
            "pipeline_version": "2.0"
        }
    
    except Exception as e:
        print(f"❌ Error en pipeline: {e}")
        return {
            "status": "error",
            "error": str(e),
            "file": filename
        }


@app.post("/analyze")
def analyze_document(request: AnalyzeRequest):
    """
    DEPRECATED: Endpoint legacy para retrocompatibilidad.
    Use /api/v1/analyze en su lugar.
    """
    return analyze_document_v2(request)
