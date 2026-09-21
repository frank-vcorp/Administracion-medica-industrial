"""Tests para recorte espirometría Sibelmed."""
from __future__ import annotations

from io import BytesIO

from PIL import Image
from pdf2image.exceptions import PDFInfoNotInstalledError
import pytest

from app.services.pdf.espirometry_source_crop import (
    ESPIROMETRY_LETTER_BOTTOM_Y0_PT,
    ESPIROMETRY_LETTER_HEIGHT_PT,
    crop_espirometry_letter_bottom_half_from_pdf,
    espirometry_crop_output_key,
    file_url_to_storage_key,
)


def test_file_url_to_storage_key():
    assert file_url_to_storage_key("/api/files/foo.pdf") == "foo.pdf"
    assert file_url_to_storage_key("/uploads/bar.pdf") == "bar.pdf"
    assert file_url_to_storage_key("../evil.pdf") is None


def test_espirometry_crop_output_key():
    assert espirometry_crop_output_key("abc-123") == "espirometry-crops/abc-123.png"


def _minimal_pdf_bytes() -> bytes:
    img = Image.new("RGB", (200, 400), color=(255, 255, 255))
    buf = BytesIO()
    img.save(buf, format="PDF")
    return buf.getvalue()


def test_crop_espirometry_letter_bottom_half_from_pdf():
    try:
        out = crop_espirometry_letter_bottom_half_from_pdf(_minimal_pdf_bytes())
    except PDFInfoNotInstalledError:
        pytest.skip("poppler no instalado en este entorno")
    assert out[:8] == b"\x89PNG\r\n\x1a\n"
    assert len(out) > 100
    img = Image.open(BytesIO(out))
    # Mitad inferior de página carta @150dpi ≈ 1275×825; tolerancia para PDF mínimo
    assert img.width > 50
    assert ESPIROMETRY_LETTER_BOTTOM_Y0_PT == 396
    assert ESPIROMETRY_LETTER_HEIGHT_PT == 792
