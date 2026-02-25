"""
Módulo de esquemas Pydantic para validación de datos extraídos por IA.
IMPL-20260225-01: Pipeline IA modular.
"""

from .medical import (
    DocumentClassification,
    AudiometriaData,
    LaboratorioData,
    EspirometriaData,
    RayosXData,
    ExtractedDataUnion,
)

__all__ = [
    "DocumentClassification",
    "AudiometriaData",
    "LaboratorioData",
    "EspirometriaData",
    "RayosXData",
    "ExtractedDataUnion",
]
