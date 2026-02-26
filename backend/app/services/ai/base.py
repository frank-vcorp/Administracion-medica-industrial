"""
Utilidades base para servicios de IA.
IMPL-20260225-01: Pipeline IA modular.
"""

import os
import base64
import io
import mimetypes
import json
from typing import Dict, Any
from pdf2image import convert_from_path


class GeminiBase:
    """Base class para interacción con Gemini API."""
    
    def __init__(self, api_key: str = None, model: str = "gemini-2.5-flash"):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self.model = model
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY no configurada")
    
    def get_b64_content(self, file_path: str) -> str:
        """
        Convierte archivo (imagen o PDF) a base64.
        Los PDFs se convierten a JPEG en primera página.
        """
        mime_type, _ = mimetypes.guess_type(file_path)
        
        if mime_type == 'application/pdf' or file_path.lower().endswith('.pdf'):
            try:
                print(f"📄 Convirtiendo PDF a Imagen: {file_path}")
                pages = convert_from_path(file_path, first_page=1, last_page=1)
                if pages:
                    img_byte_arr = io.BytesIO()
                    pages[0].save(img_byte_arr, format='JPEG')
                    return base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
            except Exception as e:
                print(f"⚠️ PDF Conversion Error: {e}")
                raise
        
        # Lectura estándar de imagen
        with open(file_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')
    
    def call_gemini(self, local_path: str, prompt: str) -> Dict[str, Any]:
        """
        Llama a Gemini API con imagen y retorna JSON parseado.
        """
        import requests
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        
        b64_data = self.get_b64_content(local_path)
        
        payload = {
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": b64_data
                        }
                    }
                ]
            }]
        }
        
        try:
            response = requests.post(
                url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=(10, 60)  # 10s connect, 60s read timeout
            )
            response.raise_for_status()
            data = response.json()
            
            candidates = data.get('candidates', [])
            if not candidates:
                raise ValueError(f"Gemini API no devolvió candidatos: {data}")
                
            text_resp = (
                candidates[0]
                .get('content', {})
                .get('parts', [])[0]
                .get('text', '')
            )
            text_resp = text_resp.replace('```json', '').replace('```', '').strip()
            
            try:
                return json.loads(text_resp)
            except json.JSONDecodeError as e:
                print(f"❌ Error parseando JSON de Gemini: {text_resp}")
                raise ValueError(f"Respuesta de Gemini no es JSON válido: {e}")
        except Exception as e:
            print(f"❌ Gemini Error: {e}")
            raise
