"""
Recorte vertical del PDF DD65 V2: banda «Audiograma Tono Puro» → antes de «Notas».
Ratios calibrados en frontend (`audiometry-dd65-clip.ts`). Ejecuta en Railway (poppler + Pillow).
"""
from __future__ import annotations

import io

from pdf2image import convert_from_bytes

from app.services.pdf.espirometry_source_crop import file_url_to_storage_key

AUDIOMETRY_CROP_SUBDIR = "audiometry-crops"
AUDIOMETRY_RENDER_DPI = 150
AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO = 0.19
AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO = 0.71
AUDIOMETRY_SOURCE_CROP_TEMPLATE_ID = "dd65-audiogram-tono-puro-v2"


def audiometry_crop_output_key(event_test_id: str) -> str:
    safe_id = event_test_id.strip().replace("/", "_")
    return f"{AUDIOMETRY_CROP_SUBDIR}/{safe_id}.png"


def crop_audiometry_audiogram_band_from_pdf(pdf_bytes: bytes) -> bytes:
    """Rasteriza página 1 y recorta la franja vertical [Y0_RATIO, Y1_RATIO)."""
    pages = convert_from_bytes(
        pdf_bytes,
        dpi=AUDIOMETRY_RENDER_DPI,
        first_page=1,
        last_page=1,
    )
    if not pages:
        raise ValueError("No se pudo rasterizar la primera página del PDF")

    img = pages[0]
    width, height = img.size
    if width <= 0 or height <= 0:
        raise ValueError("Dimensiones inválidas en la página rasterizada")

    y0 = round(height * AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO)
    y1 = round(height * AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO)
    y0 = max(0, min(height - 1, y0))
    y1 = max(y0 + 1, min(height, y1))
    cropped = img.crop((0, y0, width, y1))
    out = io.BytesIO()
    cropped.save(out, format="PNG")
    return out.getvalue()
