"""
IMPL-20260701-01: Helper para descargar y comprimir imágenes/PDFs de estudios
médicos durante la generación del EBOOK PDF.

SPEC: context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md
Decisiones relacionadas:
  - Decisión 9: Imágenes originales embebidas inline.
  - Decisión 11: Compresión PIL (thumbnail 1500px, JPEG 80% si >500KB).
  - Decisión 12: PDFs de estudios se mergean con pypdf.

Funciones exportadas:
  - fetch_image(file_url, base_url=None) -> Optional[bytes]
  - compress_image(image_bytes, max_dim=1500, max_kb=500) -> bytes
  - is_pdf(image_bytes) -> bool
  - is_supported_format(image_bytes) -> bool

Fase 1: el módulo define la API completa y los helpers de inspección/
compresión, pero NO se conecta todavía al EventTest.fileUrl real
(eso es Fase 2). Por ahora fetch_image intenta resolver archivos
locales de /uploads/{key} como prueba de concepto.
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import requests
from PIL import Image
from io import BytesIO

logger = logging.getLogger(__name__)

# Magic bytes según especificación PDF.
PDF_MAGIC = b"%PDF"

# Extensiones que sabemos embeber como imagen (JPG/PNG) directamente.
SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png"}

# Extensiones que se mergean como página PDF con pypdf.
SUPPORTED_PDF_EXTS = {".pdf"}


def is_pdf(image_bytes: bytes) -> bool:
    """Detecta si los bytes corresponden a un PDF por magic bytes."""
    if not image_bytes or len(image_bytes) < 4:
        return False
    return image_bytes[:4] == PDF_MAGIC


def is_supported_format(image_bytes: bytes) -> bool:
    """
    Determina si los bytes son un formato soportado para embeber en el EBOOK.
    Acepta PDF (magic bytes) o imágenes JPG/PNG (verificables con PIL).
    """
    if not image_bytes:
        return False
    if is_pdf(image_bytes):
        return True
    try:
        img = Image.open(BytesIO(image_bytes))
        img.verify()
        fmt = (img.format or "").upper()
        return fmt in {"JPEG", "JPG", "PNG"}
    except Exception:
        return False


def _local_path_from_url(file_url: str) -> Optional[str]:
    """
    Si file_url apunta a /uploads/{key} en el mismo backend,
    resuelve a la ruta absoluta del filesystem.
    """
    if not file_url:
        return None
    prefix = "/uploads/"
    if file_url.startswith(prefix):
        rel = file_url[len(prefix):]
        # Defensa contra path traversal: bloquear '..' o absolutas.
        if ".." in rel.split("/") or rel.startswith("/"):
            return None
        upload_dir = os.getenv("UPLOAD_DIR") or "/uploads"
        return os.path.join(upload_dir, rel)
    return None


def fetch_image(file_url: str, base_url: Optional[str] = None) -> Optional[bytes]:
    """
    Descarga los bytes de un archivo a partir de un fileUrl.

    Estrategias soportadas:
      1. /uploads/{key} en el mismo backend -> lee del filesystem local.
      2. /api/files/{key} en el mismo backend -> hace GET al endpoint.
      3. http(s)://... -> hace GET directo.

    Retorna None si no se puede acceder (no se debe romper la generación
    del EBOOK por una imagen faltante; se loggea warning).

    En Fase 1 esta función se usa principalmente con URLs dummy / locales.
    En Fase 2 se conectará con EventTest.fileUrl real (que ya vive en /uploads).
    """
    if not file_url or not isinstance(file_url, str):
        return None

    try:
        # 1) Local filesystem (/uploads).
        local = _local_path_from_url(file_url)
        if local and os.path.exists(local) and os.path.isfile(local):
            with open(local, "rb") as fh:
                data = fh.read()
            if data:
                return data

        # 2) Endpoint /api/files/{key} o URL absoluta.
        url = file_url
        if url.startswith("/api/files/"):
            if base_url:
                url = base_url.rstrip("/") + url
            # Si no hay base_url y no se puede resolver local, fallback vacío.
            if not base_url:
                logger.warning(
                    "fetch_image: /api/files/ sin base_url, no se puede resolver: %s",
                    file_url,
                )
                return None

        if url.startswith("http://") or url.startswith("https://"):
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200 and resp.content:
                return resp.content
            logger.warning(
                "fetch_image: HTTP %s al descargar %s", resp.status_code, url
            )
            return None

        logger.warning("fetch_image: esquema no soportado para %s", file_url)
        return None
    except Exception as exc:
        logger.warning("fetch_image: error descargando %s: %s", file_url, exc)
        return None


def compress_image(
    image_bytes: bytes,
    max_dim: int = 1500,
    max_kb: int = 500,
) -> bytes:
    """
    Comprime una imagen siguiendo la Decisión 11 del SPEC:
      - Si la imagen excede `max_dim` px en cualquier lado, se redimensiona
        con PIL.Image.thumbnail preservando aspect ratio.
      - Si el PNG resultante es >max_kb, se convierte a JPEG calidad 80%.

    Retorna los bytes comprimidos (JPEG o PNG según el caso).
    Si la imagen no es JPG/PNG válido, retorna los bytes originales.
    """
    if not image_bytes:
        return image_bytes

    # Si es PDF, no se procesa: ya está comprimido y se mergea aparte.
    if is_pdf(image_bytes):
        return image_bytes

    try:
        img = Image.open(BytesIO(image_bytes))
        img.load()
    except Exception as exc:
        logger.warning("compress_image: bytes no son imagen válida: %s", exc)
        return image_bytes

    # 1) Resize si excede max_dim.
    if max(img.size) > max_dim:
        img.thumbnail((max_dim, max_dim))

    # 2) Intentar guardar como PNG.
    png_buf = BytesIO()
    try:
        img.save(png_buf, format="PNG", optimize=True)
    except Exception as exc:
        logger.warning("compress_image: error guardando PNG, fallback JPEG: %s", exc)
        # Fallback a JPEG.
        jpg_buf = BytesIO()
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        img.save(jpg_buf, format="JPEG", quality=80, optimize=True)
        return jpg_buf.getvalue()

    png_bytes = png_buf.getvalue()

    # 3) Si PNG > max_kb, convertir a JPEG 80%.
    if len(png_bytes) > max_kb * 1024:
        if img.mode in ("RGBA", "LA", "P"):
            img = img.convert("RGB")
        jpg_buf = BytesIO()
        img.save(jpg_buf, format="JPEG", quality=80, optimize=True)
        return jpg_buf.getvalue()

    return png_bytes