"""Tests para recorte audiometría DD65."""
from __future__ import annotations

from io import BytesIO

from PIL import Image
from pdf2image.exceptions import PDFInfoNotInstalledError
import pytest

from app.services.pdf.audiometry_source_crop import (
    AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO,
    AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO,
    audiometry_crop_output_key,
    crop_audiometry_audiogram_band_from_pdf,
)
from app.services.pdf.espirometry_source_crop import file_url_to_storage_key


def test_audiometry_crop_output_key():
    assert audiometry_crop_output_key("et-99") == "audiometry-crops/et-99.png"


def test_file_url_reused_from_espirometry_helper():
    assert file_url_to_storage_key("/api/files/audio.pdf") == "audio.pdf"


def _minimal_pdf_bytes() -> bytes:
    img = Image.new("RGB", (400, 1200), color=(255, 255, 255))
    buf = BytesIO()
    img.save(buf, format="PDF")
    return buf.getvalue()


def test_crop_audiometry_audiogram_band_from_pdf():
    try:
        out = crop_audiometry_audiogram_band_from_pdf(_minimal_pdf_bytes())
    except PDFInfoNotInstalledError:
        pytest.skip("poppler no instalado en este entorno")
    assert out[:8] == b"\x89PNG\r\n\x1a\n"
    img = Image.open(BytesIO(out))
    assert img.width > 50
    assert img.height > 50
    assert img.height < 5000
    assert AUDIOMETRY_DD65_AUDIOGRAM_Y0_RATIO == 0.19
    assert AUDIOMETRY_DD65_AUDIOGRAM_Y1_RATIO == 0.71
