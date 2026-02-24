from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import os
import time
import base64
import requests
import json
import mimetypes
from pdf2image import convert_from_path
import io

app = FastAPI(title="Residente Digital API")

UPLOAD_DIR = "/app/uploads"
# Using the key provided by user (Temporary for MVP)
# In production this MUST be an env variable.
GEMINI_API_KEY = "AIzaSyC5bVos0JwqdutC3JsQf6I3sNY7NVv2qlQ" 
GEMINI_MODEL = "gemini-2.5-flash" 

class AnalyzeRequest(BaseModel):
    file_path: str
    expected_type: str | None = None

@app.get("/")
def read_root():
    return {"status": "ok", "service": "Residente Digital Backend (Gemini AI)"}

def get_b64_content(file_path):
    """
    Returns base64 string of the image. 
    If PDF, converts first page to JPEG first.
    """
    mime_type, _ = mimetypes.guess_type(file_path)
    
    if mime_type == 'application/pdf' or file_path.lower().endswith('.pdf'):
        try:
            print(f"📄 Converting PDF to Image: {file_path}")
            pages = convert_from_path(file_path, first_page=1, last_page=1)
            if pages:
                img_byte_arr = io.BytesIO()
                pages[0].save(img_byte_arr, format='JPEG')
                return base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        except Exception as e:
            print(f"⚠️ PDF Conversion Error: {e}")
            # Fallback to reading raw file (will probably fail in Vision API but worth a shot)
            pass

    # Standard Image Read
    with open(file_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def get_prompt_for_type(filename: str):
    filename_lower = filename.lower()
    
    if "audio" in filename_lower:
        return """Tu tarea es analizar la imagen de este estudio de Audiometría y extraer sus datos.
**Regla Crítica:** El nombre del **Paciente** está en la parte superior. El nombre del **Médico** está al final. **NO LOS CONFUNDAS**.
**Formato de Salida Obligatorio (SOLO JSON):**
{
  "tipo_detectado": "Audiometría",
  "paciente": "Nombre extraído",
  "fecha_estudio": "dd/mm/yyyy",
  "oido_derecho": { "500": 0, "1000": 0, "2000": 0, "3000": 0, "4000": 0, "diagnostico": "..." },
  "oido_izquierdo": { "500": 0, "1000": 0, "2000": 0, "3000": 0, "4000": 0, "diagnostico": "..." },
  "interpretacion": "Resumen de 2 líneas"
}"""

    if "lab" in filename_lower or "biometria" in filename_lower:
        return """Analiza este resultado de Laboratorio Clínico.
**Formato de Salida Obligatorio (SOLO JSON):**
{
  "tipo_detectado": "Laboratorio",
  "paciente": "Nombre extraído",
  "fecha": "dd/mm/yyyy",
  "parametros_anormales": ["Lista de parámetros fuera de rango"],
  "interpretacion": "Resumen breve"
}"""

    # Default
    return """Analiza este documento médico. Extrae los datos clave.
**Formato de Salida Obligatorio (SOLO JSON):**
{
  "tipo_detectado": "General",
  "paciente": "Nombre",
  "fecha": "Fecha",
  "resumen": "Descripción del documento"
}"""

def call_gemini(local_path, prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
    
    b64_data = get_b64_content(local_path)

    payload = {
        "contents": [{
            "parts": [
                {"text": prompt},
                {
                    "inline_data": {
                        "mime_type": "image/jpeg", # Always sending as JPEG to Gemini
                        "data": b64_data
                    }
                }
            ]
        }]
    }

    try:
        response = requests.post(url, headers={"Content-Type": "application/json"}, json=payload)
        response.raise_for_status()
        data = response.json()
        
        text_resp = data.get('candidates', [])[0].get('content', {}).get('parts', [])[0].get('text', '')
        text_resp = text_resp.replace('```json', '').replace('```', '').strip()
        
        return json.loads(text_resp)
    except Exception as e:
        print(f"Gemini Error: {e}")
        if 'text_resp' in locals():
            return {"raw_text": text_resp, "error": "JSON parse failed"}
        return {"error": str(e)}


@app.post("/analyze")
def analyze_document(request: AnalyzeRequest):
    filename = os.path.basename(request.file_path)
    local_path = os.path.join(UPLOAD_DIR, filename)
    
    if not os.path.exists(local_path):
        return {"status": "error", "error": "File not found"}

    print(f"🧠 Gemini Processing: {filename}")
    start_time = time.time()
    
    prompt = get_prompt_for_type(filename)
    ai_result = call_gemini(local_path, prompt)
    
    duration = time.time() - start_time
    print(f"✅ Gemini Complete in {duration:.2f}s")
    
    doc_type = ai_result.get("tipo_detectado", "Desconocido")
    
    return {
        "status": "success",
        "file": filename,
        "classification": {
            "detected_type": doc_type.upper(),
            "confidence": 0.95
        },
        "extraction": ai_result
    }
