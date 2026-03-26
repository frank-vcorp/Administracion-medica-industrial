"""
Servicio de Clasificación de Documentos Médicos.
IMPL-20260225-01: Clasificador inteligente usando Gemini Vision.
"""

import time
from typing import Dict, Any
from .base import GeminiBase
from app.schemas.medical import DocumentClassification


class DocumentClassifierService(GeminiBase):
    """
    Servicio que clasifica documentos médicos sin depender del nombre del archivo.
    Usa Gemini Vision para analizar la imagen/PDF y determinar el tipo.
    """
    
    # IMPL-20260326-17: Prompt actualizado — GEN-O1WV7 (Campimetria), GEN-C85PD (Electrocardiograma), GEN-U5BQX (RiesgoCardiovascular)
    CLASSIFICATION_PROMPT = """Eres un experto médico. Analiza esta imagen de documento médico y CLASIFICA su tipo.

**Tipos válidos:**
1. **Audiometria** - Gráfico con curvas de audición, frecuencias (Hz), decibeles (dB)
2. **Espirometria** - Valores de FEV1, FVC, curvas de flujo volumétrico
3. **Laboratorio** - Tabla de parámetros bioquímicos, biometría, química sanguínea
4. **Rayos_X** - Imágenes radiológicas (Tórax, columna, extremidades)
5. **Campimetria** - Mapa de campo visual con cuadrícula de puntos, índices MD/PSD/VFI, escotomas o defectos de campo visual por ojo
6. **Electrocardiograma** - Trazado ECG con ondas P/QRS/T, cuadrícula métrica, ritmo cardíaco, frecuencia en lpm, intervalos PR/QRS/QTc
7. **RiesgoCardiovascular** - Evaluación o escala de riesgo cardiovascular (Framingham, OMS/ISH, ACC/AHA) con nivel de riesgo calculado
8. **Otro** - Documento médico que no encaja en las categorías anteriores

**Instrucciones:**
- Analiza SOLO el contenido visual, NO el nombre del archivo.
- Sé específico en tu explicación (qué elementos visuales te llevan a esa conclusión).
- Asigna una confianza de 0.0 a 1.0 (1.0 = segurísimo, 0.5 = dudoso).

**Respuesta OBLIGATORIA en JSON:**
{
  "tipo": "Audiometria|Espirometria|Laboratorio|Rayos_X|Campimetria|Electrocardiograma|RiesgoCardiovascular|Otro",
  "confianza": 0.95,
  "razon": "Observé un gráfico de audiometría con curvas de decibeles en frecuencias típicas..."
}
"""
    
    def classify(self, file_path: str) -> DocumentClassification:
        """
        Clasifica un documento médico usando Gemini Vision.
        
        Args:
            file_path: Ruta local del archivo (imagen o PDF)
        
        Returns:
            DocumentClassification con tipo, confianza y razón.
        
        Raises:
            ValueError: Si la respuesta de Gemini es inválida.
        """
        print(f"🔍 Clasificando documento: {file_path}")
        
        start_time = time.time()
        result = self.call_gemini(file_path, self.CLASSIFICATION_PROMPT)
        duration = time.time() - start_time
        
        print(f"✅ Clasificación completada en {duration:.2f}s")
        
        # Validar estructura de respuesta
        if not isinstance(result, dict):
            raise ValueError(f"Respuesta de Gemini no es dict: {result}")
        if not result.get("tipo") or "confianza" not in result:
            raise ValueError(f"Respuesta de Gemini incompleta: {result}")
        
        try:
            classification = DocumentClassification(
                tipo=result.get("tipo", "Otro"),
                confianza=float(result.get("confianza", 0.5)),
                razon=result.get("razon", "")
            )
            return classification
        except Exception as e:
            raise ValueError(f"Error al parsear clasificación: {e}\nRespuesta: {result}")
