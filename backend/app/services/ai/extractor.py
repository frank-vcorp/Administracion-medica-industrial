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


# ARCH-20260518-17 | respaldo: context/interconsultas/PROMPTS_DOC-20260518-02-AUDIOMETRIA.md
# Frecuencias canónicas para Audiometría ocupacional (columnas esperadas de la tabla VA).
_AUDIOMETRIA_CANONICAL_FREQS: frozenset = frozenset(
    {"250", "500", "1000", "2000", "3000", "4000", "6000", "8000"}
)

# Guardrails backend inyectados antes del bloque de calibración para reforzar
# fiabilidad tabular sin depender de ediciones en la configuración de DB.
_AUDIOMETRIA_BACKEND_GUARDRAILS = """
GUARDRAILS ESPECÍFICOS PARA AUDIOMETRÍA (BACKEND — NO MODIFICAR VÍA CALIBRACIÓN)
1. La tabla de umbrales tonales (vía aérea VA) es la fuente primaria de datos numéricos.
   La descripción narrativa del diagnóstico NO es fuente de valores de umbral.
2. Cada celda de la tabla corresponde a UNA frecuencia específica. Si una celda está vacía
   o ilegible, usa null — NUNCA desplaces el valor de la columna adyacente para completar el hueco.
3. Frecuencias canónicas aceptadas: 250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz.
   No incluyas 125 Hz a menos que aparezca EXPLÍCITAMENTE como columna de la tabla en el documento.
4. Si una frecuencia no está visible en la tabla, omite esa clave del dict — no uses 0 ni la inventes.
5. `frecuencias_detectadas`: registra SOLO las frecuencias con valor numérico visible en la tabla.
6. `completitud_documental` (calcula tú mismo antes de responder):
   - "suficiente"     → ≥6 frecuencias con valor por oído en la tabla
   - "parcial"        → 3-5 frecuencias con valor por oído
   - "no_concluyente" → <3 frecuencias con valor por oído
""".strip()


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

    def _build_audiometria_extraction_prompt(self, study_specific_prompt: str) -> str:
        """
        ARCH-20260518-17: Variante de _build_extraction_prompt que inyecta los
        guardrails backend de Audiometría entre la base universal y el bloque de calibración,
        reforzando la fiabilidad tabular sin tocar la DB.
        """
        return (
            f"{self.BASE_EXTRACTION_PROMPT}\n\n"
            f"{_AUDIOMETRIA_BACKEND_GUARDRAILS}\n\n"
            "BLOQUE ESPECIFICO DEL ESTUDIO\n"
            "El siguiente bloque complementa la base universal con reglas particulares del estudio actual.\n\n"
            f"{study_specific_prompt.strip()}"
        )

    def _normalize_audiometria_result(self, result: dict) -> dict:
        """
        ARCH-20260518-17: Post-procesamiento del dict extraído para Audiometría.

        Acciones:
        1. Normaliza claves a str y valores a int, descartando entradas null.
        2. Deriva `frecuencias_detectadas` desde las claves reales si el LLM lo omitió.
        3. Deriva `completitud_documental` desde el conteo de frecuencias si quedó null.
        4. Anota sospecha de corrimiento en `notas_calidad` cuando hay frecuencias
           fuera del conjunto canónico (ej. 125 Hz).
        """
        # 1. Normalizar: str keys, int values, omitir nulos
        for ear_key in ("oido_derecho", "oido_izquierdo"):
            if isinstance(result.get(ear_key), dict):
                result[ear_key] = {
                    str(k): int(v)
                    for k, v in result[ear_key].items()
                    if v is not None
                }

        # 2. Derivar frecuencias_detectadas si null
        if not result.get("frecuencias_detectadas"):
            all_freqs: set = set()
            for ear_key in ("oido_derecho", "oido_izquierdo"):
                if isinstance(result.get(ear_key), dict):
                    all_freqs.update(result[ear_key].keys())
            if all_freqs:
                result["frecuencias_detectadas"] = sorted(
                    all_freqs, key=lambda f: int(f)
                )

        # 3. Derivar completitud_documental si null
        if result.get("completitud_documental") is None:
            freqs_per_ear = max(
                len(result.get("oido_derecho") or {}),
                len(result.get("oido_izquierdo") or {}),
            )
            if freqs_per_ear >= 6:
                result["completitud_documental"] = "suficiente"
            elif freqs_per_ear >= 3:
                result["completitud_documental"] = "parcial"
            else:
                result["completitud_documental"] = "no_concluyente"

        # 4. Detectar sospecha de corrimiento tabular
        all_detected_keys: set = set()
        for ear_key in ("oido_derecho", "oido_izquierdo"):
            if isinstance(result.get(ear_key), dict):
                all_detected_keys.update(result[ear_key].keys())
        non_canonical = all_detected_keys - _AUDIOMETRIA_CANONICAL_FREQS
        if non_canonical:
            warning = (
                f"SOSPECHA_CORRIMIENTO: frecuencias no canónicas en extracción: "
                f"{sorted(non_canonical, key=lambda f: int(f))}. "
                "Verifique alineación tabular de columnas."
            )
            existing = result.get("notas_calidad") or ""
            result["notas_calidad"] = (
                f"{existing} | {warning}" if existing else warning
            )

        return result

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

        # ARCH-20260518-17: Audiometría usa prompt enriquecido con guardrails backend.
        if doc_type == "Audiometria":
            prompt = self._build_audiometria_extraction_prompt(prompt)
        else:
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
                # Limpiar campos legacy que el modelo IA podría enviar aún
                for legacy_field in ("diagnostico_ia", "interpretacion", "recomendaciones"):
                    result.pop(legacy_field, None)
                # ARCH-20260518-17: normalización + guardrails post-extracción
                result = self._normalize_audiometria_result(result)
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
