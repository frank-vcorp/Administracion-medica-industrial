"""
Residente Digital API - Backend con Pipeline IA Modular
IMPL-20260225-01: Clasificação y extracción inteligentes de documentos médicos.
IMPL-20260225-02: Firma Digital Avanzada y Motor de Reportes Masivos.
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import time
import json
from typing import List, Dict, Any, Optional

from services.ai import DocumentClassifierService, ExtractorService
from services.pdf import SignerService, ReportService
from schemas import DocumentClassification, ExtractedDataUnion

app = FastAPI(
    title="Residente Digital API",
    description="Pipeline IA modular para análisis de documentos médicos"
)

# CORS: permitir al frontend de Vercel comunicarse con este backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/uploads")
# In production this MUST be an env variable.
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

# Inicializar servicios de IA
try:
    classifier = DocumentClassifierService(api_key=GEMINI_API_KEY, model=GEMINI_MODEL)
    extractor = ExtractorService(api_key=GEMINI_API_KEY, model=GEMINI_MODEL)
except Exception as e:
    print(f"⚠️ Error inicializando servicios de IA: {e}")
    classifier = None
    extractor = None 

# Inicializar servicios de PDF
try:
    signer = SignerService(cert_dir="/app/certs")
    reporter = ReportService(output_dir="/app/reports")
except Exception as e:
    print(f"⚠️ Error inicializando servicios de PDF: {e}")
    signer = None
    reporter = None

class AnalyzeRequest(BaseModel):
    """Solicitud de análisis de documento médico."""
    file_path: str
    expected_type: str | None = None  # Para retrocompatibilidad (ahora se detecta automáticamente)


class SignPdfRequest(BaseModel):
    """Solicitud para firmar un PDF."""
    input_pdf: str
    output_pdf: Optional[str] = None
    reason: Optional[str] = "Certificado Médico AMI"
    password: str  # Requerido, sin valor por defecto por seguridad


class GenerateReportRequest(BaseModel):
    """Solicitud para generar un reporte masivo."""
    data_list: List[Dict[str, Any]]
    formats: Optional[List[str]] = ["excel", "json", "html"]  # Formatos a generar
    title: Optional[str] = "Reporte de Consolidación"


@app.get("/")
def read_root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "Residente Digital Backend (Pipeline IA Modular)",
        "version": "2.1",
        "pipeline": "Clasificador + Extractor Especializado"
    }


@app.post("/api/v1/upload-and-analyze")
async def upload_and_analyze(file: UploadFile = File(...)):
    """
    Endpoint combinado: recibe un archivo multipart, lo guarda en /uploads,
    ejecuta el pipeline IA completo y retorna el resultado.
    Diseñado para ser llamado desde Vercel (serverless, sin filesystem propio).
    """
    if not classifier or not extractor:
        return {
            "status": "error",
            "error": "Servicios de IA no están disponibles"
        }
    
    filename = f"{int(time.time())}-{file.filename.replace(' ', '_')}"
    local_path = os.path.join(UPLOAD_DIR, filename)
    
    try:
        # Guardar archivo en disco de Railway
        contents = await file.read()
        with open(local_path, "wb") as f:
            f.write(contents)
        
        print(f"\n🚀 Upload+Analyze: {filename} ({len(contents)} bytes)")
        pipeline_start = time.time()
        
        # PASO 1: CLASIFICACIÓN
        classification = classifier.classify(local_path)
        print(f"   ✓ Clasificado: {classification.tipo} ({classification.confianza:.2f})")
        
        # PASO 2: EXTRACCIÓN
        extracted_data = extractor.extract_by_type(local_path, classification.tipo)
        
        total_time = time.time() - pipeline_start
        print(f"   ✓ Pipeline completo en {total_time:.2f}s")
        
        return {
            "status": "success",
            "file": filename,
            "classification": {
                "detected_type": classification.tipo,
                "confidence": classification.confianza,
                "reason": classification.razon,
            },
            "extraction": extracted_data if isinstance(extracted_data, dict) else extracted_data.model_dump(),
            "timings": {"total_seconds": round(total_time, 2)},
        }
    
    except Exception as e:
        print(f"❌ Error en upload-and-analyze: {e}")
        return {"status": "error", "error": str(e), "file": filename}


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


# ========================================
# ENDPOINTS DE FIRMA DIGITAL (IMPL-20260225-02)
# ========================================

@app.post("/api/v1/sign-pdf")
def sign_pdf(request: SignPdfRequest):
    """
    Endpoint para firmar un PDF con certificado X.509.
    
    Aplica una firma digital avanzada a un documento PDF.
    Genera certificado autofirmado de prueba si no existe.
    
    Args:
        input_pdf: Ruta del PDF a firmar
        output_pdf: Ruta del PDF firmado (se genera automáticamente si no se proporciona)
        reason: Razón de la firma
        password: Contraseña del certificado
    
    IMPL-20260225-02: Firma Digital Avanzada
    """
    if not signer:
        return {
            "status": "error",
            "error": "Servicio de firma no está disponible"
        }
    
    try:
        input_path = os.path.join(UPLOAD_DIR, os.path.basename(request.input_pdf))
        
        if not os.path.exists(input_path):
            raise HTTPException(
                status_code=404,
                detail=f"Archivo no encontrado: {request.input_pdf}"
            )
        
        # Generar nombre de salida si no se proporciona
        if request.output_pdf:
            safe_filename = os.path.basename(request.output_pdf)
            output_path = os.path.join(UPLOAD_DIR, safe_filename)
        else:
            base_name = os.path.splitext(os.path.basename(request.input_pdf))[0]
            output_path = os.path.join(UPLOAD_DIR, f"{base_name}_signed.pdf")
        
        print(f"\n🔐 Firmando PDF: {os.path.basename(input_path)}")
        print(f"   → Certificado: {signer.cert_path}")
        
        result = signer.sign_pdf(
            input_pdf=input_path,
            output_pdf=output_path,
            reason=request.reason,
            password=request.password
        )
        
        if result["status"] == "success":
            print(f"   ✓ PDF firmado exitosamente")
        else:
            print(f"   ❌ Error: {result.get('message')}")
        
        return result
    
    except Exception as e:
        print(f"❌ Error en sign_pdf: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


@app.post("/api/v1/verify-signature")
def verify_pdf_signature(file_path: str):
    """
    Endpoint para verificar la firma digital de un PDF.
    
    Args:
        file_path: Ruta del PDF a verificar
    
    IMPL-20260225-02: Verificación de firmas
    """
    if not signer:
        return {
            "status": "error",
            "error": "Servicio de firma no está disponible"
        }
    
    try:
        pdf_path = os.path.join(UPLOAD_DIR, os.path.basename(file_path))
        
        if not os.path.exists(pdf_path):
            raise HTTPException(
                status_code=404,
                detail=f"Archivo no encontrado: {file_path}"
            )
        
        print(f"\n🔍 Verificando firma de: {os.path.basename(pdf_path)}")
        result = signer.verify_signature(pdf_path)
        
        return result
    
    except Exception as e:
        print(f"❌ Error en verify_signature: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


# ========================================
# ENDPOINTS DE REPORTES MASIVOS (IMPL-20260225-02)
# ========================================

@app.post("/api/v1/generate-report")
def generate_report(request: GenerateReportRequest):
    """
    Endpoint para generar reportes masivos consolidados.
    
    Acepta una lista de datos y genera reportes en múltiples formatos:
    - Excel (XLSX) con formato básico
    - JSON estructurado
    - HTML para visualización
    
    Args:
        data_list: Lista de diccionarios con datos (ej. múltiples audiometrías)
        formats: Formatos a generar (['excel', 'json', 'html'])
        title: Título del reporte
    
    IMPL-20260225-02: Motor de Reportes Masivos
    """
    if not reporter:
        return {
            "status": "error",
            "error": "Servicio de reportes no está disponible"
        }
    
    try:
        print(f"\n📊 Generando reporte masivo para {len(request.data_list)} registros")
        print(f"   → Formatos: {request.formats}")
        
        result = reporter.batch_process(
            data_list=request.data_list,
            formats=request.formats
        )
        
        if result["status"] == "success":
            print(f"   ✓ Reportes generados exitosamente")
            print(f"   → Batch ID: {result.get('batch_id')}")
        else:
            print(f"   ⚠️ Errores: {result.get('errors')}")
        
        return result
    
    except Exception as e:
        print(f"❌ Error en generate_report: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


@app.post("/api/v1/generate-excel-report")
def generate_excel_report(request: GenerateReportRequest):
    """
    Endpoint especializado para generar reporte en Excel.
    
    IMPL-20260225-02: Generación de Excel
    FIX-20260225-03: Retorno de Excel en Base64
    """
    if not reporter:
        return {
            "status": "error",
            "error": "Servicio de reportes no está disponible"
        }
    
    try:
        print(f"\n📈 Generando reporte Excel para {len(request.data_list)} registros")
        
        result = reporter.generate_excel_report(
            data_list=request.data_list
        )
        
        if result.get("status") == "success" and "output_file" in result:
            import base64
            with open(result["output_file"], "rb") as f:
                encoded = base64.b64encode(f.read()).decode("utf-8")
            result["data"] = {"xlsx": encoded}
            
        return result
    
    except Exception as e:
        print(f"❌ Error en generate_excel_report: {e}")
        return {
            "status": "error",
            "error": str(e)
        }


@app.post("/api/v1/generate-json-report")
def generate_json_report(request: GenerateReportRequest):
    """
    Endpoint especializado para generar reporte en JSON.
    
    IMPL-20260225-02: Generación de JSON
    """
    if not reporter:
        return {
            "status": "error",
            "error": "Servicio de reportes no está disponible"
        }
    
    try:
        print(f"\n📋 Generando reporte JSON para {len(request.data_list)} registros")
        
        result = reporter.generate_json_report(
            data_list=request.data_list
        )
        
        return result
    
    except Exception as e:
        print(f"❌ Error en generate_json_report: {e}")
        return {
            "status": "error",
            "error": str(e)
        }

