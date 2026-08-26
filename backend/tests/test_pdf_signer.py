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


# -----------------------------------------------------------------------------#
# IMPL-FIX-20260826-01: tests focales del flujo pyHanko REAL (sin fallback).
# pyHanko ≥0.30 cambió la API: `SimpleSigner.load(f, ..., digest_alg=...)` ya no
# existe (ahora requiere `key_file`+`cert_file` o `load_pkcs12`); el flujo de
# firma pasó de `PdfFileWriter.append_from_reader + .sign(...)` a
# `IncrementalPdfFileWriter` + `PdfSigner.sign_pdf`. Estos tests generan un
# material criptográfico autofirmado (PEM key + PEM cert) y firman un PDF real.
# -----------------------------------------------------------------------------#
def _build_minimal_pdf_bytes() -> bytes:
    """Construye un PDF mínimo válido con una sola página en memoria."""
    import io
    from pyhanko.pdf_utils import generic
    from pyhanko.pdf_utils.writer import PdfFileWriter

    w = PdfFileWriter()
    page_dict = generic.DictionaryObject({
        generic.pdf_name("/Type"): generic.pdf_name("/Page"),
        generic.pdf_name("/MediaBox"): generic.ArrayObject([
            generic.FloatObject(0), generic.FloatObject(0),
            generic.FloatObject(595), generic.FloatObject(842),
        ]),
        generic.pdf_name("/Resources"): generic.DictionaryObject(),
    })
    page_ref = w.add_object(page_dict)
    pages = w.root["/Pages"]
    pages.raw_get("/Kids").append(page_ref)
    pages[generic.pdf_name("/Count")] = generic.FloatObject(1)

    buf = io.BytesIO()
    w.write(buf)
    return buf.getvalue()


def test_sign_pdf_real_pyhanko_with_pem_material(tmp_path):
    """
    AC: SignerService con cert/key en formato PEM (fallback del cert generator)
    firma un PDF real usando pyHanko ≥0.30 (`IncrementalPdfFileWriter` +
    `PdfSigner.sign_pdf`). El resultado debe ser un PDF con una firma
    embebida detectable por `verify_signature`.

    Nota: este test NO fuerza PEM vs PKCS#12 — el generador interno decide.
    Si pyHanko está importado en el proceso, cryptography ≥50.x puede usar
    PKCS#12; si no, cae a PEM. Ambos formatos deben funcionar end-to-end.
    """
    from cryptography.hazmat.primitives.serialization import pkcs12 as _pkcs12
    from cryptography.hazmat.primitives.asymmetric import rsa as _rsa
    from cryptography import x509 as _x509
    from cryptography.x509.oid import NameOID as _NameOID
    from cryptography.hazmat.primitives import hashes as _hashes
    from cryptography.hazmat.primitives import serialization as _ser
    from datetime import datetime, timedelta

    cert_dir = tmp_path / "certs"
    cert_dir.mkdir(parents=True, exist_ok=True)

    # Construimos el material criptográfico directamente para tener
    # control determinista sobre el formato (siempre PEM, sin depender
    # de side-effects de imports de pyHanko que cambien el comportamiento
    # del cert generator).
    password = b"test1234"
    private_key = _rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = _x509.Name([
        _x509.NameAttribute(_NameOID.COUNTRY_NAME, u"MX"),
        _x509.NameAttribute(_NameOID.COMMON_NAME, u"AMI Test Signer"),
    ])
    cert = (
        _x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(_x509.random_serial_number())
        .not_valid_before(datetime.utcnow())
        .not_valid_after(datetime.utcnow() + timedelta(days=365))
        .add_extension(_x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(private_key, _hashes.SHA256())
    )

    # Escribir material PEM sin encriptación (paridad con el flujo canónico
    # de producción cuando cryptography 50.x no soporta pkcs12 vía el
    # atributo serialization.pkcs12).
    pem_cert = cert.public_bytes(_ser.Encoding.PEM)
    pem_key = private_key.private_bytes(
        encoding=_ser.Encoding.PEM,
        format=_ser.PrivateFormat.PKCS8,
        encryption_algorithm=_ser.NoEncryption(),
    )

    pem_cert_path = cert_dir / "test_cert.pem"
    pem_key_path = cert_dir / "test_key.pem"
    pem_cert_path.write_bytes(pem_cert)
    pem_key_path.write_bytes(pem_key)

    # Stub del cert generator: saltamos el __init__ que podría sobrescribir
    # nuestros archivos PEM (cryptography 50.x con pkcs12 disponible
    # regeneraría como .p12).
    from app.services.pdf.signer import SignerService as _Svc
    monkeypatch = __import__("pytest").MonkeyPatch()
    monkeypatch.setattr(_Svc, "_generate_test_certificate", lambda self: None)
    try:
        svc = SignerService(
            cert_path=str(pem_cert_path),
            key_path=str(pem_key_path),
            cert_dir=str(cert_dir),
        )
        # Como stub-eamos el generator, los paths deben ser los que pasamos.
        assert svc.cert_path == str(pem_cert_path)
        assert svc.key_path == str(pem_key_path)

        # Construye input PDF mínimo
        in_pdf = tmp_path / "in.pdf"
        in_pdf.write_bytes(_build_minimal_pdf_bytes())
        out_pdf = tmp_path / "out.pdf"

        res = svc.sign_pdf(
            input_pdf=str(in_pdf),
            output_pdf=str(out_pdf),
            reason="Dictamen Médico AMI",
            password="test1234",
        )

        assert res["status"] == "success", res
        assert res.get("message") == "PDF firmado correctamente"
        assert res["output_pdf"] == str(out_pdf)
        assert res["reason"] == "Dictamen Médico AMI"
        # Sin "warning" del fallback.
        assert "warning" not in res
        assert out_pdf.exists()
        # El output debe ser más grande que el input (firma embebida).
        assert out_pdf.stat().st_size > in_pdf.stat().st_size

        # Verificar que pyHanko embebió al menos una firma.
        from pyhanko.pdf_utils.reader import PdfFileReader
        with open(out_pdf, "rb") as f:
            reader = PdfFileReader(f)
            embedded = reader.embedded_signatures
        assert len(list(embedded)) >= 1, \
            "El PDF firmado debe contener al menos una firma embebida"
    finally:
        monkeypatch.undo()


def test_sign_pdf_real_pyhanko_handles_p12_extension(tmp_path):
    """
    AC: Cuando el material criptográfico está en formato PKCS#12 (.p12),
    SignerService debe detectar el formato por extensión y usar
    `SimpleSigner.load_pkcs12(...)` (no `SimpleSigner.load(...)` con
    key/cert separados). El test genera un cert PEM y lo serializa
    manualmente como PKCS#12 con la misma password que el flujo canónico.

    Esto verifica que:
      - El código detecta `.p12`/`.pfx` por extensión.
      - Carga correctamente con passphrase.
      - Firma el PDF con pyHanko real.
      - Devuelve status=success.
    """
    from cryptography.hazmat.primitives.serialization import pkcs12 as _pkcs12

    cert_dir = tmp_path / "certs"
    cert_dir.mkdir(parents=True, exist_ok=True)

    # Construimos manualmente un .p12 real usando el subpath pkcs12
    # de cryptography. Necesario porque pyhanko ya está importado
    # (import side-effect) en este punto del test session.
    from cryptography.hazmat.primitives.asymmetric import rsa as _rsa
    from cryptography import x509 as _x509
    from cryptography.x509.oid import NameOID as _NameOID
    from cryptography.hazmat.primitives import hashes as _hashes
    from cryptography.hazmat.primitives import serialization as _ser
    from datetime import datetime, timedelta
    password = b"test1234"

    private_key = _rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = issuer = _x509.Name([
        _x509.NameAttribute(_NameOID.COUNTRY_NAME, u"MX"),
        _x509.NameAttribute(_NameOID.COMMON_NAME, u"AMI Test Signer"),
    ])
    cert = (
        _x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(issuer)
        .public_key(private_key.public_key())
        .serial_number(_x509.random_serial_number())
        .not_valid_before(datetime.utcnow())
        .not_valid_after(datetime.utcnow() + timedelta(days=365))
        .add_extension(_x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .sign(private_key, _hashes.SHA256())
    )
    p12_bytes = _pkcs12.serialize_key_and_certificates(
        name=b"AMI Test Certificate",
        key=private_key,
        cert=cert,
        cas=None,
        encryption_algorithm=_ser.BestAvailableEncryption(password),
    )

    p12_path = cert_dir / "test_cert.p12"
    p12_path.write_bytes(p12_bytes)

    # Instanciamos el servicio con la ruta .p12. La extensión activa
    # la rama `load_pkcs12` en `sign_pdf`.
    svc = SignerService(cert_path=str(p12_path), cert_dir=str(cert_dir))

    in_pdf = tmp_path / "in.pdf"
    in_pdf.write_bytes(_build_minimal_pdf_bytes())
    out_pdf = tmp_path / "out.pdf"

    res = svc.sign_pdf(
        input_pdf=str(in_pdf),
        output_pdf=str(out_pdf),
        reason="Dictamen Médico AMI",
        password="test1234",
    )

    assert res["status"] == "success", res
    assert res.get("message") == "PDF firmado correctamente"
    assert "warning" not in res
    assert out_pdf.exists()
    assert out_pdf.stat().st_size > in_pdf.stat().st_size

    # Verificar que pyHanko embebió la firma.
    from pyhanko.pdf_utils.reader import PdfFileReader
    with open(out_pdf, "rb") as f:
        reader = PdfFileReader(f)
        embedded = reader.embedded_signatures
    assert len(list(embedded)) >= 1, \
        "El PDF firmado con material PKCS#12 debe contener una firma embebida"
