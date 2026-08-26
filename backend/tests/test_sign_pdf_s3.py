"""
Tests focales del fix para el defecto reproducible de firma del Examen Médico:

  Producción devuelve 404 "Archivo no encontrado: dictamen-<uuid>-<ts>.pdf" al
  pulsar Firmar porque:
    1. Frontend hace POST /api/v1/upload-only con el PDF.
    2. Backend, con STORAGE_S3_* habilitado, lo guarda SÓLO en S3.
    3. Frontend hace POST /api/v1/sign-pdf con `input_pdf` = basename.
    4. /api/v1/sign-pdf SOLO busca el input en UPLOAD_DIR local → 404.

FIX: `backend/app/main.py` ahora:
  - Resuelve input/output como `basename` (defensa contra path traversal).
  - Lee primero de UPLOAD_DIR local; si no está y S3 está habilitado, descarga
    a un tempfile LOCAL del backend (nunca en Vercel).
  - Firma SIEMPRE en tempfile local seguro.
  - Si S3 está habilitado, sube el PDF firmado al MISMO bucket con la
    `output_pdf` key.
  - Devuelve `output_pdf` (basename) y `signature_hash` ("sha256:<hex>")
    sobre los bytes firmados — contrato compatible con
    `frontend/src/actions/signature.actions.tsx` (IMPL-FEATURE-20260825-03).

Estos tests siguen el patrón establecido en `test_upload_public_scope.py`:
importan `app.main` con `_s3_enabled`, `_s3_client` y `UPLOAD_DIR` stub-eados
para forzar el camino S3 o local sin tocar red ni DB.
"""
import hashlib
import io
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest


# -----------------------------------------------------------------------------#
# Helpers / fixtures
# -----------------------------------------------------------------------------#

class FakeS3Client:
    """
    Stub del cliente S3 (`boto3.client("s3", ...)`).

    Registra uploads/downloads; permite inyectar bytes preexistentes para
    simular el escenario de producción (upload-only ya dejó el PDF en S3).
    """
    def __init__(self, presigned_url: str = "https://s3.example/presigned"):
        self.store: dict = {}
        self.downloads = []
        self.uploads = []
        self.presigned_url = presigned_url

    def download_fileobj(self, Bucket, Key, ExtraArgs=None):
        self.downloads.append({"Bucket": Bucket, "Key": Key})
        if Key not in self.store:
            # Comportamiento equivalente a NoSuchKey de S3.
            raise RuntimeError(f"NoSuchKey: {Key}")
        # Simula poblar el buffer pasado.
        if hasattr(ExtraArgs, "write"):
            ExtraArgs.write(self.store[Key])

    def upload_fileobj(self, fileobj, Bucket, Key, ExtraArgs=None):
        # boto3 espera un file-like; consumimos read() o getvalue().
        if hasattr(fileobj, "getvalue"):
            data = fileobj.getvalue()
        else:
            data = fileobj.read()
        self.store[Key] = data
        self.uploads.append({"Bucket": Bucket, "Key": Key, "bytes": data})

    def generate_presigned_url(self, op, Params=None, ExpiresIn=None):
        return self.presigned_url


class StubSigner:
    """
    Reemplazo del SignerService real para los tests del endpoint.

    Sólo verifica que el input existe localmente y copia los bytes al output
    agregando una marca simple — suficiente para validar que `sign_pdf`:
      - Lee desde S3 cuando hace falta
      - Calcula `signature_hash` sobre los bytes firmados
      - Persiste el output en S3 cuando `_s3_enabled` es True
      - Devuelve el contrato correcto
    """
    warning = "Firma básica - usar en pruebas solo"
    cert_path = "/tmp/fake_cert.p12"

    def sign_pdf(self, input_pdf: str, output_pdf: str, reason: str = "Test", password: str = "test1234"):
        if not os.path.isfile(input_pdf):
            return {"status": "error", "message": f"Archivo no encontrado: {input_pdf}"}
        with open(input_pdf, "rb") as f:
            data = f.read()
        with open(output_pdf, "wb") as f:
            f.write(data)
            f.write(b"\n%% FIRMADO DIGITALMENTE\n")
        return {
            "status": "success",
            "message": "PDF firmado correctamente (stub)",
            "output_pdf": output_pdf,
            "signed_at": "2026-08-26T00:00:00",
            "signer": "AMI Stub Signer",
            "reason": reason,
        }


@pytest.fixture
def temp_upload_dir(monkeypatch):
    """Crea un directorio temporal y lo instala como UPLOAD_DIR para main.py."""
    tmp = tempfile.mkdtemp(prefix="sign_pdf_test_")
    monkeypatch.setenv("UPLOAD_DIR", tmp)
    yield tmp
    import shutil
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.fixture
def main_module(temp_upload_dir, monkeypatch):
    """
    Importa `app.main` forzando:
      - UPLOAD_DIR = directorio temporal
      - signer = StubSigner (no requiere cert reales, no necesita /app/certs)
      - _s3_enabled y _s3_client configurables por test.

    Si el import de `app.main` es lento en el entorno de CI (p.ej. conexiones
    Prisma), pytest-xdist o el fixture equivalente pueden aislarlo.
    """
    # Limpiar cache por si el módulo ya se importó en este proceso.
    sys.modules.pop("app.main", None)
    import app.main as m  # noqa: E402

    m.UPLOAD_DIR = temp_upload_dir
    m.signer = StubSigner()
    return m


def _client(main_module):
    """Construye un TestClient sin inicializar servicios IA ni S3 reales."""
    from fastapi.testclient import TestClient
    return TestClient(main_module.app)


# -----------------------------------------------------------------------------#
# AC-1: input en S3 + S3 habilitado → firma + persiste en S3 + contrato OK
# -----------------------------------------------------------------------------#
def test_sign_pdf_falls_back_to_s3_when_local_missing(main_module):
    """
    Reproduce el defecto: el PDF sólo existe en S3 (caso de producción con
    STORAGE_S3_*). El endpoint debe:
      - Descargar el input desde S3 a un tempfile del backend.
      - Firmar.
      - Subir el output a S3 con la `output_pdf` key.
      - Devolver `status=success`, `output_pdf` (basename), `signature_hash`.
    """
    fake = FakeS3Client()
    # Pre-poblar S3 con el PDF "subido" por upload-only.
    pdf_bytes = b"%PDF-1.4 stub-dictamen-input"
    fake.store["dictamen-evt-1-1700000000000.pdf"] = pdf_bytes
    main_module._s3_enabled = True
    main_module._s3_client = fake
    main_module.STORAGE_S3_BUCKET = "ami-test-bucket"

    client = _client(main_module)
    resp = client.post(
        "/api/v1/sign-pdf",
        json={
            "input_pdf": "dictamen-evt-1-1700000000000.pdf",
            "output_pdf": "dictamen-evt-1-signed.pdf",
            "reason": "Dictamen Médico AMI",
            "password": "test1234",
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()

    # Contrato compatible con signature.actions.tsx
    assert body["status"] == "success"
    assert body["output_pdf"] == "dictamen-evt-1-signed.pdf"
    assert body["signature_hash"].startswith("sha256:")
    # Hash = sha256 sobre bytes firmados (incluye marca del stub signer).
    expected_signed = pdf_bytes + b"\n%% FIRMADO DIGITALMENTE\n"
    assert body["signature_hash"] == f"sha256:{hashlib.sha256(expected_signed).hexdigest()}"

    # Verificar que S3 recibió tanto el download del input como el upload del output.
    assert len(fake.downloads) == 1
    assert fake.downloads[0]["Key"] == "dictamen-evt-1-1700000000000.pdf"
    assert len(fake.uploads) == 1
    assert fake.uploads[0]["Key"] == "dictamen-evt-1-signed.pdf"
    assert fake.uploads[0]["bytes"] == expected_signed

    # Reporta el storage usado.
    assert body["storage"] == "s3"


# -----------------------------------------------------------------------------#
# AC-2: input NO existe ni local ni en S3 → 404
# -----------------------------------------------------------------------------#
def test_sign_pdf_404_when_neither_local_nor_s3(main_module):
    fake = FakeS3Client()
    main_module._s3_enabled = True
    main_module._s3_client = fake

    client = _client(main_module)
    resp = client.post(
        "/api/v1/sign-pdf",
        json={
            "input_pdf": "dictamen-evt-1-1700000000000.pdf",
            "output_pdf": "dictamen-evt-1-signed.pdf",
            "reason": "Dictamen Médico AMI",
            "password": "test1234",
        },
    )

    assert resp.status_code == 404
    body = resp.json()
    assert "Archivo no encontrado" in body["detail"]
    assert "dictamen-evt-1-1700000000000.pdf" in body["detail"]

    # No se subió nada a S3 (el input no se pudo conseguir).
    assert fake.uploads == []
    # Sí se intentó el download desde S3 (es el comportamiento correcto: el
    # endpoint debe consultar S3 cuando el archivo no está local). Pero
    # NoSuchKey → 404 honesto.
    assert len(fake.downloads) == 1
    assert fake.downloads[0]["Key"] == "dictamen-evt-1-1700000000000.pdf"


# -----------------------------------------------------------------------------#
# AC-3: S3 habilitado pero download falla → 404 honesto
# -----------------------------------------------------------------------------#
def test_sign_pdf_404_when_s3_download_fails(main_module):
    fake = FakeS3Client()
    # No pre-poblamos nada: download_fileobj hará raise.
    main_module._s3_enabled = True
    main_module._s3_client = fake

    client = _client(main_module)
    resp = client.post(
        "/api/v1/sign-pdf",
        json={
            "input_pdf": "dictamen-evt-1-1700000000000.pdf",
            "output_pdf": "dictamen-evt-1-signed.pdf",
            "reason": "Dictamen Médico AMI",
            "password": "test1234",
        },
    )

    assert resp.status_code == 404
    body = resp.json()
    assert "Archivo no encontrado" in body["detail"]


# -----------------------------------------------------------------------------#
# AC-4: input existe localmente + S3 deshabilitado → firma local + contrato OK
# -----------------------------------------------------------------------------#
def test_sign_pdf_uses_local_when_present_and_s3_disabled(main_module):
    pdf_bytes = b"%PDF-1.4 local-stub-dictamen"
    local_pdf = os.path.join(main_module.UPLOAD_DIR, "dictamen-evt-2-local.pdf")
    with open(local_pdf, "wb") as f:
        f.write(pdf_bytes)

    main_module._s3_enabled = False
    main_module._s3_client = None

    client = _client(main_module)
    resp = client.post(
        "/api/v1/sign-pdf",
        json={
            "input_pdf": "dictamen-evt-2-local.pdf",
            "output_pdf": "dictamen-evt-2-signed.pdf",
            "reason": "Dictamen Médico AMI",
            "password": "test1234",
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "success"
    assert body["output_pdf"] == "dictamen-evt-2-signed.pdf"
    assert body["signature_hash"].startswith("sha256:")
    assert body["storage"] == "local"

    # Verificar que el PDF firmado quedó persistido en UPLOAD_DIR.
    persisted = os.path.join(main_module.UPLOAD_DIR, "dictamen-evt-2-signed.pdf")
    assert os.path.isfile(persisted)
    with open(persisted, "rb") as f:
        persisted_bytes = f.read()
    expected_signed = pdf_bytes + b"\n%% FIRMADO DIGITALMENTE\n"
    assert persisted_bytes == expected_signed
    assert body["signature_hash"] == f"sha256:{hashlib.sha256(expected_signed).hexdigest()}"


# -----------------------------------------------------------------------------#
# AC-5: input existe localmente + S3 habilitado → prefiere local (no S3)
# -----------------------------------------------------------------------------#
def test_sign_pdf_prefers_local_over_s3_when_both_available(main_module):
    """
    Si el input está local, no descargamos de S3 (evita tráfico innecesario).
    El output se persiste en S3 cuando está habilitado.
    """
    pdf_bytes = b"%PDF-1.4 both-locations"
    local_pdf = os.path.join(main_module.UPLOAD_DIR, "dictamen-evt-3-both.pdf")
    with open(local_pdf, "wb") as f:
        f.write(pdf_bytes)

    fake = FakeS3Client()
    fake.store["dictamen-evt-3-both.pdf"] = b"OTHER-BYTES-not-read"
    main_module._s3_enabled = True
    main_module._s3_client = fake

    client = _client(main_module)
    resp = client.post(
        "/api/v1/sign-pdf",
        json={
            "input_pdf": "dictamen-evt-3-both.pdf",
            "output_pdf": "dictamen-evt-3-signed.pdf",
            "reason": "Dictamen Médico AMI",
            "password": "test1234",
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "success"
    assert body["output_pdf"] == "dictamen-evt-3-signed.pdf"

    # No se descargó de S3 (preferimos local).
    assert fake.downloads == []
    # Sí se subió el output a S3.
    assert len(fake.uploads) == 1
    assert fake.uploads[0]["Key"] == "dictamen-evt-3-signed.pdf"
    expected_signed = pdf_bytes + b"\n%% FIRMADO DIGITALMENTE\n"
    assert fake.uploads[0]["bytes"] == expected_signed
    assert body["signature_hash"] == f"sha256:{hashlib.sha256(expected_signed).hexdigest()}"
    assert body["storage"] == "s3"


# -----------------------------------------------------------------------------#
# AC-6: input_pdf vacío o path traversal → 400 defensivo
# -----------------------------------------------------------------------------#
def test_sign_pdf_rejects_empty_input(main_module):
    main_module._s3_enabled = False
    main_module._s3_client = None

    client = _client(main_module)
    resp = client.post(
        "/api/v1/sign-pdf",
        json={
            "input_pdf": "",
            "output_pdf": "out.pdf",
            "reason": "x",
            "password": "x",
        },
    )
    assert resp.status_code == 400
    assert "input_pdf" in resp.json()["detail"].lower() or "inválido" in resp.json()["detail"].lower()


def test_sign_pdf_strips_path_traversal_in_input(main_module):
    """
    Defense-in-depth: aunque el cliente envíe '../etc/passwd', el endpoint
    resuelve sólo el basename y trata de firmar `passwd` — que no existe.
    Devuelve 404, NO escapa de UPLOAD_DIR.
    """
    main_module._s3_enabled = False
    main_module._s3_client = None

    client = _client(main_module)
    resp = client.post(
        "/api/v1/sign-pdf",
        json={
            "input_pdf": "../../etc/passwd",
            "output_pdf": "out.pdf",
            "reason": "x",
            "password": "x",
        },
    )
    # El basename es "passwd" y no existe ni en local ni en S3 → 404 honesto.
    assert resp.status_code == 404


# -----------------------------------------------------------------------------#
# AC-7: output_pdf no se proporciona → se deriva del input
# -----------------------------------------------------------------------------#
def test_sign_pdf_derives_output_when_not_provided(main_module):
    pdf_bytes = b"%PDF-1.4 derive-out"
    fake = FakeS3Client()
    fake.store["dictamen-evt-7-input.pdf"] = pdf_bytes
    main_module._s3_enabled = True
    main_module._s3_client = fake

    client = _client(main_module)
    resp = client.post(
        "/api/v1/sign-pdf",
        json={
            "input_pdf": "dictamen-evt-7-input.pdf",
            "output_pdf": None,
            "reason": "x",
            "password": "test1234",
        },
    )

    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["output_pdf"] == "dictamen-evt-7-input_signed.pdf"
    assert len(fake.uploads) == 1
    assert fake.uploads[0]["Key"] == "dictamen-evt-7-input_signed.pdf"
