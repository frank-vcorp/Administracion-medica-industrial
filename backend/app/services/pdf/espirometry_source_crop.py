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

# Regiones enmascaradas (ratios sobre PNG recortado @150 DPI) — espejo de frontend png-mask-rect.ts
SIBELMED_BRAND_MASKS: list[tuple[float, float, float, float]] = [
    (0.60, 0.0, 0.40, 0.22),
    (0.50, 0.325, 0.50, 0.035),
    (0.55, 0.495, 0.45, 0.035),
]


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


def _mask_png_rect(img, left_ratio: float, top_ratio: float, width_ratio: float, height_ratio: float):
    width, height = img.size
    x0 = max(0, int(width * left_ratio))
    y0 = max(0, int(height * top_ratio))
    x1 = min(width, int(x0 + width * width_ratio))
    y1 = min(height, int(y0 + height * height_ratio))
    for y in range(y0, y1):
        for x in range(x0, x1):
            img.putpixel((x, y), (255, 255, 255))


def strip_sibelmed_brand_from_png(img) -> None:
    for left, top, w_ratio, h_ratio in SIBELMED_BRAND_MASKS:
        _mask_png_rect(img, left, top, w_ratio, h_ratio)


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
    strip_sibelmed_brand_from_png(cropped)
    out = io.BytesIO()
    cropped.save(out, format="PNG")
    return out.getvalue()
