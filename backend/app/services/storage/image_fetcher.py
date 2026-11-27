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


def _extract_rel_key(file_url: str) -> Optional[str]:
    """
    Normaliza `/uploads/{key}`, `/api/files/{key}` o keys relativas directas
    (p. ej. `dictamen-xxx-signed.pdf`, `rayos-x-pdfs/yyy.pdf`) a una key limpia.
    Rechaza path traversal (`..`).
    """
    if not file_url or not isinstance(file_url, str):
        return None
    raw = file_url.strip()
    if not raw or raw.startswith("http://") or raw.startswith("https://"):
        return None
    for prefix in ("/uploads/", "uploads/", "/api/files/", "api/files/"):
        if raw.startswith(prefix):
            raw = raw[len(prefix):]
            break
    rel = raw.lstrip("/")
    if not rel or ".." in rel.split("/"):
        return None
    return rel


def _local_path_candidates(rel: str) -> list[str]:
    """Rutas candidatas locales para una key relativa."""
    candidates: list[str] = []
    upload_dir = os.getenv("UPLOAD_DIR") or "/uploads"
    candidates.append(os.path.join(upload_dir, rel))
    # Fallback al directorio uploads/ junto al repo en desarrollo local.
    repo_uploads = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "..", "..", "uploads")
    )
    repo_candidate = os.path.join(repo_uploads, rel)
    if repo_candidate not in candidates:
        candidates.append(repo_candidate)
    return candidates


def _local_path_from_url(file_url: str) -> Optional[str]:
    """
    Retrocompatibilidad: si file_url apunta a /uploads/{key} o una key relativa,
    resuelve la ruta dentro de UPLOAD_DIR.
    """
    if not file_url or not file_url.startswith("/uploads/"):
        return None
    rel = _extract_rel_key(file_url)
    if not rel:
        return None
    upload_dir = os.getenv("UPLOAD_DIR") or "/uploads"
    return os.path.join(upload_dir, rel)


def _try_s3_download(rel_key: str) -> Optional[bytes]:
    """Descarga en memoria desde el bucket S3 de app.main (si está habilitado)."""
    try:
        from app.main import _download_file_from_s3
        data = _download_file_from_s3(rel_key)
        return data if data else None
    except Exception:
        return None


def fetch_image(file_url: str, base_url: Optional[str] = None) -> Optional[bytes]:
    """
    Descarga los bytes de un archivo a partir de un fileUrl.

    Estrategias soportadas:
      1. URL http(s)://... -> GET directo.
      2. /uploads/{key}, /api/files/{key} o key relativa directa:
         a) Filesystem local (`UPLOAD_DIR` y fallback repo `uploads/`).
         b) Bucket S3 del backend (`_download_file_from_s3`).
         c) Endpoint HTTP `{base_url}/api/files/{key}` si está configurado.

    Retorna None si no se puede acceder (no se debe romper la generación
    del EBOOK por una imagen o PDF faltante; se loggea warning).
    """
    if not file_url or not isinstance(file_url, str):
        return None

    raw = file_url.strip()
    if not raw:
        return None

    try:
        if raw.startswith("http://") or raw.startswith("https://"):
            resp = requests.get(raw, timeout=15)
            if resp.status_code == 200 and resp.content:
                return resp.content
            logger.warning("fetch_image: HTTP %s al descargar %s", resp.status_code, raw)
            return None

        rel_key = _extract_rel_key(raw)
        if not rel_key:
            logger.warning("fetch_image: ruta inválida para %s", raw)
            return None

        # 1) Local filesystem (UPLOAD_DIR o repo uploads/).
        for local in _local_path_candidates(rel_key):
            if os.path.exists(local) and os.path.isfile(local):
                with open(local, "rb") as fh:
                    data = fh.read()
                if data:
                    return data

        # 2) Bucket S3 en el mismo proceso FastAPI.
        s3_bytes = _try_s3_download(rel_key)
        if s3_bytes:
            return s3_bytes

        # 3) Endpoint /api/files/{key} vía HTTP si existe base_url o BACKEND_PUBLIC_URL.
        effective_base = (
            base_url
            or os.getenv("BACKEND_PUBLIC_URL")
            or os.getenv("INTERNAL_BACKEND_URL")
            or ""
        ).strip().rstrip("/")
        if effective_base:
            url = f"{effective_base}/api/files/{rel_key}"
            resp = requests.get(url, timeout=15)
            if resp.status_code == 200 and resp.content:
                return resp.content
            logger.warning("fetch_image: HTTP %s al descargar %s", resp.status_code, url)
            return None

        logger.warning("fetch_image: archivo no encontrado en local ni S3: %s", raw)
        return None
    except Exception as exc:
        logger.warning("fetch_image: error descargando %s: %s", raw, exc)
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