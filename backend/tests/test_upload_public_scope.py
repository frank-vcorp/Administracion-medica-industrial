"""
Tests del endpoint de upload + file resolution con S3 deshabilitado.
IMPL-20260624-01: Cubre el flujo de la ruta pública /solicitar-alta donde el
frontend envía archivos con `key` (companies/public/<scope>/<section>/<filename>)
y luego los recupera vía /api/files/{key}.

Estos tests no requieren S3 ni DB: mockean los flags `_s3_enabled` y `_s3_client`
directamente sobre `app.main` para forzar el camino de filesystem local.

Ejecutar (en entorno con deps instaladas):
    cd backend && pytest tests/test_upload_public_scope.py -v
"""
import io
import os
import sys
import tempfile

import pytest


@pytest.fixture
def temp_upload_dir(monkeypatch):
    """Crea un directorio temporal y lo instala como UPLOAD_DIR para main.py."""
    tmp = tempfile.mkdtemp(prefix="upload_only_test_")
    # main.py se importa más abajo; el monkeypatch debe aplicarse antes.
    yield tmp
    # Limpieza best-effort.
    try:
        import shutil
        shutil.rmtree(tmp, ignore_errors=True)
    except Exception:
        pass


@pytest.fixture
def main_module(temp_upload_dir, monkeypatch):
    """
    Importa app.main forzando:
      - _s3_enabled = False
      - _s3_client = None
      - UPLOAD_DIR = temp_upload_dir
    """
    # Forzar env ANTES de importar.
    monkeypatch.setenv("UPLOAD_DIR", temp_upload_dir)
    # Limpiar cache de imports por si ya fue cargado.
    sys.modules.pop("app.main", None)
    import app.main as m  # noqa: E402
    # Override de los flags globales tras la inicialización del módulo.
    m._s3_enabled = False
    m._s3_client = None
    m.UPLOAD_DIR = temp_upload_dir
    return m


def _client(main_module):
    """Construye un TestClient sin inicializar servicios IA ni S3."""
    from fastapi.testclient import TestClient
    return TestClient(main_module.app)


def test_upload_only_without_key_uses_legacy_filename(main_module):
    """Sin `key` en FormData: comportamiento legacy con timestamp + filename."""
    client = _client(main_module)
    files = {"file": ("constancia.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")}
    resp = client.post("/api/v1/upload-only", files=files)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    # Legacy: file_url apunta a /uploads/{name} (montaje StaticFiles).
    assert body["file_url"].startswith("/uploads/")
    assert body["key"].endswith("constancia.pdf")
    assert body["file"] == body["key"]  # retrocompat


def test_upload_only_with_nested_key_creates_subdirs(main_module):
    """Con `key` tipo companies/public/<scope>/<section>/<filename>:
    debe crear subdirectorios y devolver /api/files/{key}."""
    client = _client(main_module)
    nested_key = "companies/public/abcd1234/constanciaFiscal/constancia.pdf"
    files = {"file": ("constancia.pdf", io.BytesIO(b"%PDF-1.4 test"), "application/pdf")}
    data = {"key": nested_key}
    resp = client.post("/api/v1/upload-only", files=files, data=data)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert body["key"] == nested_key
    assert body["file_url"] == f"/api/files/{nested_key}"
    # Verificar que el archivo realmente se creó en disco bajo UPLOAD_DIR.
    full_path = os.path.join(main_module.UPLOAD_DIR, nested_key)
    assert os.path.isfile(full_path)


def test_upload_only_rejects_path_traversal(main_module):
    """key que intenta escapar de UPLOAD_DIR con `..` debe rechazarse."""
    client = _client(main_module)
    bad_key = "../etc/passwd"
    files = {"file": ("evil.txt", io.BytesIO(b"malicious"), "text/plain")}
    data = {"key": bad_key}
    resp = client.post("/api/v1/upload-only", files=files, data=data)
    assert resp.status_code == 200  # endpoint retorna 200 con status=error
    body = resp.json()
    assert body["status"] == "error"
    assert "key inválida" in body["error"]


def test_upload_only_rejects_absolute_key(main_module):
    """key absoluta (empieza con /) debe rechazarse."""
    client = _client(main_module)
    bad_key = "/etc/passwd"
    files = {"file": ("evil.txt", io.BytesIO(b"x"), "text/plain")}
    data = {"key": bad_key}
    resp = client.post("/api/v1/upload-only", files=files, data=data)
    body = resp.json()
    assert body["status"] == "error"
    assert "key inválida" in body["error"]


def test_resolve_file_returns_local_pdf_with_inline_disposition(main_module):
    """S3 deshabilitado + archivo presente localmente: devuelve PDF con inline."""
    nested_key = "companies/public/abcd1234/constanciaFiscal/constancia.pdf"
    full_path = os.path.join(main_module.UPLOAD_DIR, nested_key)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    pdf_bytes = b"%PDF-1.4 fake pdf"
    with open(full_path, "wb") as fh:
        fh.write(pdf_bytes)

    client = _client(main_module)
    resp = client.get(f"/api/files/{nested_key}")
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "application/pdf"
    assert resp.headers.get("content-disposition") == "inline"
    assert resp.content == pdf_bytes


def test_resolve_file_503_when_s3_disabled_and_file_missing(main_module):
    """S3 deshabilitado + archivo NO presente localmente: 503 explícito."""
    client = _client(main_module)
    resp = client.get("/api/files/companies/public/missing/file.pdf")
    assert resp.status_code == 503
    body = resp.json()
    assert "S3 no configurado" in body["detail"] or "no disponible" in body["detail"]


def test_resolve_file_rejects_path_traversal(main_module):
    """key con `..` en GET debe rechazarse con 400 (no escapar de UPLOAD_DIR)."""
    client = _client(main_module)
    resp = client.get("/api/files/../../etc/passwd")
    # FastAPI path matching puede colapsar `..` antes de llegar al handler;
    # si llega, debe ser 400.
    assert resp.status_code in (400, 404)