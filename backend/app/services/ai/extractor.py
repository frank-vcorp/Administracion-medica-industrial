"""
Servicio de Extracción Especializada de Datos Médicos.
IMPL-20260225-01: Extractores por tipo de documento.
IMPL-20260326-16: Separación capa extractiva / interpretativa (ARCH-20260326-16).
               Los prompts ahora extraen SOLO parámetros canónicos + calidad documental.
               La interpretación clínica vive en PrediagnosticService (prediagnostic.py).

ARCH-20260518-06:
    - La extracción se compone con una base universal fija en backend
        más un bloque específico editable desde aiCalibration.extraction.prompt.
"""

import time
from typing import Dict, Any, Union, Optional
from .base import GeminiBase
from app.schemas.medical import (
    AudiometriaData,
    LaboratorioData,
    EspirometriaData,
    RayosXData,
    CampimetriaData,
    ElectrocardiogramaData,
    RiesgoCardiovascularData,
    DocumentClassification,
)


class ExtractorService(GeminiBase):
    """
    Servicio que extrae parámetros canónicos según el tipo de documento.
    GUARDRAIL: Los prompts NO deben pedir diagnóstico, interpretación clínica final
    ni recomendaciones de aptitud. Esas capas pertenecen a PrediagnosticService.
    """

    # ARCH-20260518-03: Prompts de extracción ELIMINADOS del backend.
    # El prompt de extracción se resuelve ÚNICAMENTE desde aiCalibration.extraction.prompt.
    # No existe fallback de extracción en el backend — ver extract_by_type().

    # LEGACY NOTE (ARCH-20260518-03): El dict PROMPTS fue eliminado. Cualquier referencia a
    # self.PROMPTS en código externo debe actualizarse para pasar ai_calibration correctamente.

    # Prompt de referencia solo para documentación: ver context/SPECs/SPEC_ARCH-20260518-03*.md

    # ARCH-20260518-06 | respaldo: context/SPECs/SPEC_ARCH-20260518-06-BASE-EXTRACCION-Y-PLANTILLA-CALIBRACION.md
    BASE_EXTRACTION_PROMPT = """
Eres un extractor de datos médicos estructurados.

Tu tarea es leer un documento médico y extraer TODOS los datos visibles con máxima precisión y exhaustividad,
devolviendo exclusivamente JSON válido según el esquema esperado.

REGLAS GENERALES
1. Extrae únicamente datos visibles en el documento.
2. No inventes, no deduzcas y no completes valores ausentes.
3. No hagas interpretación clínica, no emitas diagnósticos, no clasifiques normalidad o anormalidad.
4. Si un dato está visible en cualquier parte del documento, no lo dejes fuera.
5. Conserva números, unidades, porcentajes, fechas, horas, nombres y etiquetas con la mayor fidelidad posible.
6. Si un campo del esquema no aparece visible, usa null.
7. Si hay tablas, extrae todas las filas y columnas relevantes; no reduzcas el documento a pocos valores principales.
8. Si una etiqueta no coincide exactamente con el esquema pero es claramente equivalente, mapea al campo canónico correcto.
9. Si una etiqueta visible no tiene mapeo claro, conserva el label y sus valores en el bloque estructurado más cercano posible.
10. Devuelve SOLO JSON válido. Sin markdown, sin comentarios, sin explicación adicional.

CONTEXTO
Este documento contiene datos médicos ocupacionales reales. Puedes encontrar identificación del paciente,
metadatos del estudio, condiciones de medición, tablas de parámetros, referencias, LLN, porcentajes del predicho,
notas de calidad y gráficas.
""".strip()

    def _build_extraction_prompt(self, study_specific_prompt: str) -> str:
        """Compone la base universal con el bloque específico editable por calibración."""
        return (
            f"{self.BASE_EXTRACTION_PROMPT}\n\n"
            "BLOQUE ESPECIFICO DEL ESTUDIO\n"
            "El siguiente bloque complementa la base universal con reglas particulares del estudio actual.\n\n"
            f"{study_specific_prompt.strip()}"
        )



    def extract_by_type(
        self,
        file_path: str,
        doc_type: str,
        ai_calibration: Optional[Dict[str, Any]] = None,
    ) -> Union[AudiometriaData, LaboratorioData, EspirometriaData, RayosXData, Dict]:
        """
        Extrae datos estructurados según el tipo de documento.

        ARCH-20260518-03: El prompt de extracción se resuelve ÚNICAMENTE desde aiCalibration.
        Si no está configurado, la corrida falla explícitamente con EXTRACTION_PROMPT_NOT_CONFIGURED.
        No existe fallback de extracción en el backend.

        Args:
            file_path:      Ruta del archivo
            doc_type:       Tipo de documento (Audiometria, Laboratorio, etc.)
            ai_calibration: Dict con aiCalibration de la prueba. Debe contener
                            ai_calibration["extraction"]["prompt"] para que la
                            extracción proceda.

        Returns:
            Objeto Pydantic del tipo correspondiente o Dict genérico.

        Raises:
            ValueError: EXTRACTION_PROMPT_NOT_CONFIGURED si falta prompt de extracción
                        en aiCalibration.
        """
        # ARCH-20260518-03: resolver prompt únicamente desde aiCalibration
        extraction_cfg = (ai_calibration or {}).get("extraction") or {}
        prompt = extraction_cfg.get("prompt")

        if not prompt:
            # Sin fallback — error explícito y trazable de configuración
            raise ValueError(
                f"EXTRACTION_PROMPT_NOT_CONFIGURED: La prueba '{doc_type}' no tiene "
                "prompt de extracción configurado en aiCalibration. "
                "Configure el prompt de extracción en el panel de calibración antes de procesar."
            )

        prompt = self._build_extraction_prompt(prompt)

        _extraction_prompt_version = extraction_cfg.get("version", "calibration_custom")
        print(
            f"✅ [ARCH-20260518-03] Prompt de extracción resuelto desde aiCalibration "
            f"(v={_extraction_prompt_version}) para {doc_type}"
        )
        print(f"🧠 Extrayendo datos para tipo: {doc_type}")
        
        start_time = time.time()
        result = self.call_gemini(file_path, prompt)
        duration = time.time() - start_time
        
        print(f"✅ Extracción completada en {duration:.2f}s")
        
        # Parsear según el tipo
        # IMPL-20260326-16: los schemas ya no tienen diagnostico_ia/interpretacion
        try:
            if doc_type == "Audiometria":
                # Normalizar claves de frecuencia a strings (el schema acepta Dict[str, int])
                for key in ("oido_derecho", "oido_izquierdo"):
                    if isinstance(result.get(key), dict):
                        result[key] = {str(k): int(v) for k, v in result[key].items()}
                # Limpiar campos legacy que el modelo IA podría enviar aún
                for legacy_field in ("diagnostico_ia", "interpretacion", "recomendaciones"):
                    result.pop(legacy_field, None)
                return AudiometriaData(**result)

            elif doc_type == "Laboratorio":
                # Normalizar: si el LLM devuelve "valores_anormales" legacy mapear a "parametros"
                if "valores_anormales" in result and "parametros" not in result:
                    result["parametros"] = result.pop("valores_anormales")
                for legacy_field in ("interpretacion",):
                    result.pop(legacy_field, None)
                return LaboratorioData(**result)

            elif doc_type == "Espirometria":
                for legacy_field in ("diagnostico_ia", "recomendaciones"):
                    result.pop(legacy_field, None)
                return EspirometriaData(**result)

            elif doc_type == "Rayos_X":
                for legacy_field in ("interpretacion",):
                    result.pop(legacy_field, None)
                return RayosXData(**result)

            # IMPL-20260326-17: Parseo para estudios GEN-O1WV7, GEN-C85PD, GEN-U5BQX
            elif doc_type == "Campimetria":
                for legacy_field in ("diagnostico_ia", "interpretacion"):
                    result.pop(legacy_field, None)
                return CampimetriaData(**result)

            elif doc_type == "Electrocardiograma":
                for legacy_field in ("diagnostico_ia", "interpretacion", "recomendaciones"):
                    result.pop(legacy_field, None)
                # Normalizar frecuencia_bpm a int si viene como string
                if isinstance(result.get("frecuencia_bpm"), str):
                    try:
                        result["frecuencia_bpm"] = int(result["frecuencia_bpm"])
                    except (ValueError, TypeError):
                        result["frecuencia_bpm"] = None
                return ElectrocardiogramaData(**result)

            elif doc_type == "RiesgoCardiovascular":
                for legacy_field in ("diagnostico_ia", "interpretacion"):
                    result.pop(legacy_field, None)
                # Normalizar porcentaje_riesgo a float si viene como string
                if isinstance(result.get("porcentaje_riesgo"), str):
                    try:
                        result["porcentaje_riesgo"] = float(result["porcentaje_riesgo"].replace("%", ""))
                    except (ValueError, TypeError):
                        result["porcentaje_riesgo"] = None
                return RiesgoCardiovascularData(**result)

            else:
                return result

        except Exception as e:
            print(f"⚠️ Error al parsear {doc_type}: {e}")
            return result
