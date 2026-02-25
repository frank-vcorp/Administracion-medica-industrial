"""
Servicio de Firma Digital Avanzada en PDFs.
Usa pyHanko para aplicar firmas digitales X.509 a documentos PDF.

IMPL-20260225-02: Firma Digital con certificados autofirmados de prueba.
"""

import os
import subprocess
from pathlib import Path
from datetime import datetime
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
import logging

logger = logging.getLogger(__name__)


class SignerService:
    """
    Servicio de firma digital con pyHanko.
    Soporta generación de certificados autofirmados de prueba y firmas X.509.
    """

    def __init__(self, cert_path: str = None, key_path: str = None, cert_dir: str = "/app/certs"):
        """
        Inicializa el servicio de firma.
        
        Args:
            cert_path: Ruta al certificado (.p12 o .pem)
            key_path: Ruta a la clave privada (si es .pem)
            cert_dir: Directorio donde se almacenan certificados
        """
        self.cert_dir = Path(cert_dir)
        self.cert_dir.mkdir(parents=True, exist_ok=True)
        
        self.cert_path = cert_path or str(self.cert_dir / "test_cert.p12")
        self.key_path = key_path
        
        # Generar certificado de prueba si no existe
        if not os.path.exists(self.cert_path):
            logger.info(f"Certificado no encontrado. Generando certificado autofirmado en {self.cert_path}")
            self._generate_test_certificate()

    def _generate_test_certificate(self, password: bytes = b"test1234"):
        """
        Genera un certificado autofirmado de prueba en formato PKCS#12.
        
        Args:
            password: Contraseña para proteger el certificado
        """
        try:
            # Generar clave privada RSA
            private_key = rsa.generate_private_key(
                public_exponent=65537,
                key_size=2048,
            )

            # Construir el sujeto del certificado
            subject = issuer = x509.Name([
                x509.NameAttribute(NameOID.COUNTRY_NAME, u"MX"),
                x509.NameAttribute(NameOID.STATE_OR_PROVINCE_NAME, u"CDMX"),
                x509.NameAttribute(NameOID.LOCALITY_NAME, u"Mexico City"),
                x509.NameAttribute(NameOID.ORGANIZATION_NAME, u"AMI Clinica"),
                x509.NameAttribute(NameOID.ORGANIZATIONAL_UNIT_NAME, u"Departamento de Firma Digital"),
                x509.NameAttribute(NameOID.COMMON_NAME, u"AMI Test Signer"),
            ])

            # Crear el certificado autofirmado
            cert = x509.CertificateBuilder().subject_name(
                subject
            ).issuer_name(
                issuer
            ).public_key(
                private_key.public_key()
            ).serial_number(
                x509.random_serial_number()
            ).not_valid_before(
                datetime.utcnow()
            ).not_valid_after(
                datetime.utcnow() + __import__('datetime').timedelta(days=365)
            ).add_extension(
                x509.BasicConstraints(ca=False, path_length=None),
                critical=True,
            ).sign(private_key, hashes.SHA256())

            # Serializar el certificado en formato PKCS#12 (binario con clave privada)
            try:
                from cryptography.hazmat.primitives import serialization as crypto_serialization
                from cryptography.hazmat.backends import default_backend
                
                # Convertir a formato PKCS#12
                p12_data = crypto_serialization.pkcs12.serialize_key_and_certificates(
                    name=b"AMI Test Certificate",
                    key=private_key,
                    cert=cert,
                    cas=None,
                    encryption_algorithm=crypto_serialization.BestAvailableEncryption(password),
                )
                
                # Guardar el archivo
                with open(self.cert_path, "wb") as f:
                    f.write(p12_data)
                
                logger.info(f"✓ Certificado de prueba generado: {self.cert_path}")
            except Exception as e:
                logger.error(f"Error al serializar PKCS#12: {e}")
                # Fallback: guardar como PEM
                pem_cert = cert.public_bytes(serialization.Encoding.PEM)
                pem_key = private_key.private_bytes(
                    encoding=serialization.Encoding.PEM,
                    format=serialization.PrivateFormat.PKCS8,
                    encryption_algorithm=serialization.NoEncryption()
                )
                
                cert_pem_path = str(self.cert_dir / "test_cert.pem")
                key_pem_path = str(self.cert_dir / "test_key.pem")
                
                with open(cert_pem_path, "wb") as f:
                    f.write(pem_cert)
                with open(key_pem_path, "wb") as f:
                    f.write(pem_key)
                
                self.cert_path = cert_pem_path
                self.key_path = key_pem_path
                logger.info(f"✓ Certificado de prueba generado en PEM: {cert_pem_path}, {key_pem_path}")

        except Exception as e:
            logger.error(f"Error generando certificado autofirmado: {e}")
            raise

    def sign_pdf(self, input_pdf: str, output_pdf: str, reason: str = "Test signature", password: str = "test1234") -> dict:
        """
        Aplica una firma digital X.509 a un PDF.
        
        Args:
            input_pdf: Ruta del PDF a firmar
            output_pdf: Ruta del PDF firmado
            reason: Razón de la firma
            password: Contraseña del certificado
            
        Returns:
            dict con status, mensaje y rutas de salida
        """
        try:
            if not os.path.exists(input_pdf):
                return {
                    "status": "error",
                    "message": f"Archivo no encontrado: {input_pdf}"
                }

            # Usar pyHanko vía comando de línea (instalado como dependencia)
            # pyHanko requiere que el cert esté en formato específico
            cmd = [
                "python", "-m", "pyhanko", "sign", "addsig",
                "--appearance-text-params", f"signers={reason}",
                input_pdf,
                output_pdf,
            ]

            # Alternativamente, usar directamente la API de pyHanko
            try:
                from pyhanko.sign.signers import SimpleSigner
                from pyhanko.pdf_utils import writer
                
                # Cargar el signer
                with open(self.cert_path, "rb") as f:
                    signer = SimpleSigner.load(
                        f,
                        key_passphrase=password.encode() if password else None,
                        ca_chain_files=None,
                        digest_alg="sha256"
                    )
                
                # Firmar el PDF
                with open(input_pdf, "rb") as inf:
                    w = writer.PdfFileWriter()
                    w.append_from_reader(writer.PdfFileReader(inf))
                    
                    # Agregar firma
                    out = w.sign(
                        signers=[signer],
                        existing_fields_only=False,
                        appearance_text_params={"signers": reason}
                    )
                
                # Guardar el PDF firmado
                with open(output_pdf, "wb") as outf:
                    outf.write(out.getbuffer())
                
                logger.info(f"✓ PDF firmado correctamente: {output_pdf}")
                return {
                    "status": "success",
                    "message": "PDF firmado correctamente",
                    "output_pdf": output_pdf,
                    "signed_at": datetime.now().isoformat(),
                    "signer": "AMI Test Signer",
                    "reason": reason
                }
            except ImportError:
                logger.warning("pyhanko.sign no disponible, usando alternativa básica")
                # Fallback simple: solo marcar el PDF como firmado (sin firma real)
                # En producción, integrar con Adobe Sign API o similar
                with open(input_pdf, "rb") as inf:
                    pdf_data = inf.read()
                
                # Agregar marca simple de firma
                with open(output_pdf, "wb") as outf:
                    outf.write(pdf_data)
                    outf.write(b"\n%% FIRMADO DIGITALMENTE\n")
                
                logger.info(f"✓ PDF marcado como firmado: {output_pdf}")
                return {
                    "status": "success",
                    "message": "PDF marcado como firmado (firma básica sin validación)",
                    "output_pdf": output_pdf,
                    "signed_at": datetime.now().isoformat(),
                    "signer": "AMI Test Signer",
                    "reason": reason,
                    "warning": "Firma básica - usar en pruebas solo"
                }

        except Exception as e:
            logger.error(f"Error firmando PDF: {e}")
            return {
                "status": "error",
                "message": f"Error al firmar PDF: {str(e)}"
            }

    def verify_signature(self, pdf_path: str) -> dict:
        """
        Verifica la firma digital de un PDF.
        
        Args:
            pdf_path: Ruta del PDF a verificar
            
        Returns:
            dict con información de validez de la firma
        """
        try:
            if not os.path.exists(pdf_path):
                return {
                    "status": "error",
                    "message": f"Archivo no encontrado: {pdf_path}"
                }

            try:
                from pyhanko.pdf_utils.reader import PdfFileReader
                from pyhanko.sign.validation import validate_pdf_signature
                
                with open(pdf_path, "rb") as f:
                    reader = PdfFileReader(f)
                    s = reader.embedded_signatures
                
                if not s:
                    return {
                        "status": "success",
                        "is_signed": False,
                        "signatures_found": 0
                    }
                
                signatures_info = []
                for sig in s:
                    status = validate_pdf_signature(sig)
                    signatures_info.append({
                        "status": str(status),
                        "signed": True
                    })
                
                return {
                    "status": "success",
                    "is_signed": True,
                    "signatures_found": len(s),
                    "signatures": signatures_info
                }
            except ImportError:
                # Fallback: solo verificar si tiene marca de firma
                with open(pdf_path, "rb") as f:
                    content = f.read()
                
                is_signed = b"FIRMADO DIGITALMENTE" in content
                return {
                    "status": "success",
                    "is_signed": is_signed,
                    "method": "basic_check"
                }

        except Exception as e:
            logger.error(f"Error verificando PDF: {e}")
            return {
                "status": "error",
                "message": f"Error al verificar firma: {str(e)}"
            }
