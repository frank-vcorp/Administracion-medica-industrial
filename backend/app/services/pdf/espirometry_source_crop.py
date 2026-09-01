"""
Recorte fijo de la zona superior del PDF Sibelmed W20s (tabla + gráficas).
Ejecutado en Railway donde poppler-utils está disponible.
"""
from __future__ import annotations

import io
from typing import Optional

from pdf2image import convert_from_bytes

SIBELMED_W20S_TOP_CROP_RATIO = 0.67
ESPIROMETRY_CROP_SUBDIR = "espirometry-crops"


def file_url_to_storage_key(file_url: str) -> Optional[str]:
    trimmed = (file_url or "").strip()
    if not trimmed or ".." in trimmed:
        return None
    if trimmed.startswith("/api/files/"):
        return trimmed[len("/api/files/") :]
    if trimmed.startswith("/uploads/"):
        return trimmed[len("/uploads/") :]
    if trimmed.startswith("/"):
        return None
    return trimmed


def espirometry_crop_output_key(event_test_id: str) -> str:
    safe_id = event_test_id.strip().replace("/", "_")
    return f"{ESPIROMETRY_CROP_SUBDIR}/{safe_id}.png"


def crop_espirometry_source_top_from_pdf(
    pdf_bytes: bytes,
    crop_ratio: float = SIBELMED_W20S_TOP_CROP_RATIO,
) -> bytes:
    pages = convert_from_bytes(
        pdf_bytes,
        dpi=150,
        first_page=1,
        last_page=1,
    )
    if not pages:
        raise ValueError("No se pudo rasterizar la primera página del PDF")

    img = pages[0]
    width, height = img.size
    if width <= 0 or height <= 0:
        raise ValueError("Dimensiones inválidas en la página rasterizada")

    crop_height = max(1, round(height * crop_ratio))
    cropped = img.crop((0, 0, width, crop_height))
    out = io.BytesIO()
    cropped.save(out, format="PNG")
    return out.getvalue()
