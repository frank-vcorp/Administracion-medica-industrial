import os
from pathlib import Path

import pytest

# Asegurar imports desde la raíz del backend
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.pdf.signer import SignerService


@pytest.fixture
def dummy_pdf_bytes() -> bytes:
    # No necesita ser un PDF válido para los tests de fallback (solo se copia y se agrega marca)
    return b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF\n"


def test_init_generates_test_certificate_when_missing(tmp_path, monkeypatch):
    """Si no existe cert_path, __init__ debe intentar generar el certificado."""
    cert_dir = tmp_path / "certs"
    cert_path = cert_dir / "missing.p12"

    called = {"count": 0}

    def fake_generate(self):
        called["count"] += 1
        # Simula que el certificado fue creado
        cert_dir.mkdir(parents=True, exist_ok=True)
        cert_path.write_bytes(b"dummy")

    monkeypatch.setattr(SignerService, "_generate_test_certificate", fake_generate)

    svc = SignerService(cert_path=str(cert_path), cert_dir=str(cert_dir))

    assert called["count"] == 1
    assert svc.cert_dir == cert_dir
    assert str(cert_path) == svc.cert_path
    assert cert_path.exists()


def test_sign_pdf_returns_error_when_input_missing(tmp_path, monkeypatch):
    """Validación de entrada: si el PDF de entrada no existe, debe regresar error."""
    cert_dir = tmp_path / "certs"
    cert_path = cert_dir / "cert.p12"

    # Evitar generación real de certificado
    monkeypatch.setattr(SignerService, "_generate_test_certificate", lambda self: None)
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert_path.write_bytes(b"dummy")

    svc = SignerService(cert_path=str(cert_path), cert_dir=str(cert_dir))

    res = svc.sign_pdf(input_pdf=str(tmp_path / "nope.pdf"), output_pdf=str(tmp_path / "out.pdf"))

    assert res["status"] == "error"
    assert "Archivo no encontrado" in res["message"]


def test_sign_pdf_fallback_marks_pdf_when_pyhanko_unavailable(tmp_path, monkeypatch, dummy_pdf_bytes):
    """Edge: si pyHanko no está instalado, debe usar el fallback que agrega la marca."""
    cert_dir = tmp_path / "certs"
    cert_path = cert_dir / "cert.p12"

    monkeypatch.setattr(SignerService, "_generate_test_certificate", lambda self: None)
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert_path.write_bytes(b"dummy")

    in_pdf = tmp_path / "in.pdf"
    out_pdf = tmp_path / "signed.pdf"
    in_pdf.write_bytes(dummy_pdf_bytes)

    # Forzar ImportError al intentar importar pyhanko.sign.signers
    import builtins

    real_import = builtins.__import__

    def raising_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name.startswith("pyhanko"):
            raise ImportError("pyhanko not installed")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", raising_import)

    svc = SignerService(cert_path=str(cert_path), cert_dir=str(cert_dir))
    res = svc.sign_pdf(str(in_pdf), str(out_pdf), reason="Motivo")

    assert res["status"] == "success"
    assert out_pdf.exists()
    content = out_pdf.read_bytes()
    assert dummy_pdf_bytes in content  # se copió el contenido
    assert b"FIRMADO DIGITALMENTE" in content
    assert res["reason"] == "Motivo"
    assert "warning" in res


def test_sign_pdf_returns_error_on_unhandled_exception(tmp_path, monkeypatch, dummy_pdf_bytes):
    """Flujo de error: si ocurre una excepción al escribir, debe retornar status=error."""
    cert_dir = tmp_path / "certs"
    cert_path = cert_dir / "cert.p12"

    monkeypatch.setattr(SignerService, "_generate_test_certificate", lambda self: None)
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert_path.write_bytes(b"dummy")

    in_pdf = tmp_path / "in.pdf"
    in_pdf.write_bytes(dummy_pdf_bytes)

    # Forzar que el fallback sea usado
    import builtins
    real_import = builtins.__import__

    def raising_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name.startswith("pyhanko"):
            raise ImportError("pyhanko not installed")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", raising_import)

    # Forzar excepción al abrir archivo de salida
    def boom_open(*args, **kwargs):
        # Solo explota al abrir para escritura del output
        if len(args) >= 2 and args[1] == "wb":
            raise OSError("disk full")
        return real_open(*args, **kwargs)

    real_open = builtins.open
    monkeypatch.setattr(builtins, "open", boom_open)

    svc = SignerService(cert_path=str(cert_path), cert_dir=str(cert_dir))
    res = svc.sign_pdf(str(in_pdf), str(tmp_path / "out.pdf"))

    assert res["status"] == "error"
    assert "Error al firmar PDF" in res["message"]


def test_verify_signature_returns_error_when_file_missing(tmp_path, monkeypatch):
    """Validación de entrada: verify_signature con archivo inexistente retorna error."""
    cert_dir = tmp_path / "certs"
    cert_path = cert_dir / "cert.p12"

    monkeypatch.setattr(SignerService, "_generate_test_certificate", lambda self: None)
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert_path.write_bytes(b"dummy")

    svc = SignerService(cert_path=str(cert_path), cert_dir=str(cert_dir))
    res = svc.verify_signature(str(tmp_path / "missing.pdf"))

    assert res["status"] == "error"
    assert "Archivo no encontrado" in res["message"]


def test_verify_signature_fallback_detects_marker(tmp_path, monkeypatch):
    """Fallback: si pyHanko no está disponible, detecta la marca en bytes."""
    cert_dir = tmp_path / "certs"
    cert_path = cert_dir / "cert.p12"

    monkeypatch.setattr(SignerService, "_generate_test_certificate", lambda self: None)
    cert_dir.mkdir(parents=True, exist_ok=True)
    cert_path.write_bytes(b"dummy")

    signed_pdf = tmp_path / "signed.pdf"
    signed_pdf.write_bytes(b"abc\n%% FIRMADO DIGITALMENTE\nxyz")

    import builtins
    real_import = builtins.__import__

    def raising_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name.startswith("pyhanko"):
            raise ImportError("pyhanko not installed")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", raising_import)

    svc = SignerService(cert_path=str(cert_path), cert_dir=str(cert_dir))
    res = svc.verify_signature(str(signed_pdf))

    assert res["status"] == "success"
    assert res["is_signed"] is True
    assert res["method"] == "basic_check"
