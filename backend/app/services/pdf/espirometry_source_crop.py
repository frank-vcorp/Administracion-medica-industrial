"""
Recorte fijo mitad inferior del PDF fuente Sibelmed — hoja carta 612×792 pt.
Clip exacto: (0, 396) → (612, 792), ancho completo.
Ejecutado en Railway donde poppler-utils está disponible.
"""
from __future__ import annotations

import io
from typing import Optional

from pdf2image import convert_from_bytes

ESPIROMETRY_CROP_SUBDIR = "espirometry-crops"
ESPIROMETRY_RENDER_DPI = 150
ESPIROMETRY_LETTER_WIDTH_PT = 612
ESPIROMETRY_LETTER_HEIGHT_PT = 792
ESPIROMETRY_LETTER_BOTTOM_Y0_PT = 396
ESPIROMETRY_SOURCE_CROP_TEMPLATE_ID = "sibelmed-letter-bottom-v1"

# Compat tests / imports legacy
SIBELMED_W20S_TOP_CROP_RATIO = 0.67


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


def crop_espirometry_letter_bottom_half_from_pdf(pdf_bytes: bytes) -> bytes:
    """Rasteriza página 1 completa y recorta (0,396)→(612,792) en puntos carta."""
    pages = convert_from_bytes(
        pdf_bytes,
        dpi=ESPIROMETRY_RENDER_DPI,
        first_page=1,
        last_page=1,
    )
    if not pages:
        raise ValueError("No se pudo rasterizar la primera página del PDF")

    img = pages[0]
    width, height = img.size
    if width <= 0 or height <= 0:
        raise ValueError("Dimensiones inválidas en la página rasterizada")

    y0 = round(height * ESPIROMETRY_LETTER_BOTTOM_Y0_PT / ESPIROMETRY_LETTER_HEIGHT_PT)
    y0 = max(0, min(height - 1, y0))
    cropped = img.crop((0, y0, width, height))
    out = io.BytesIO()
    cropped.save(out, format="PNG")
    return out.getvalue()


def crop_espirometry_source_top_from_pdf(
    pdf_bytes: bytes,
    crop_ratio: float = SIBELMED_W20S_TOP_CROP_RATIO,
) -> bytes:
    """@deprecated Usar crop_espirometry_letter_bottom_half_from_pdf."""
    return crop_espirometry_letter_bottom_half_from_pdf(pdf_bytes)
