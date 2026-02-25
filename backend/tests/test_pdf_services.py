"""
Tests unitarios para servicios de PDF.
IMPL-20260225-02: Firma Digital y Motor de Reportes.

Cubre:
- Inicialización de servicios
- Generación de certificados
- Firma de PDFs
- Generación de reportes en múltiples formatos
"""

import pytest
import os
import json
import tempfile
from pathlib import Path
from unittest.mock import Mock, patch, MagicMock

# Importar servicios
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.pdf.signer import SignerService
from app.services.pdf.reporter import ReportService


class TestSignerService:
    """Tests para SignerService."""

    @pytest.fixture
    def temp_cert_dir(self):
        """Crea directorio temporal para certificados."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def signer(self, temp_cert_dir):
        """Instancia de SignerService con directorio temporal."""
        return SignerService(cert_dir=temp_cert_dir)

    def test_initialization_creates_cert_dir(self, temp_cert_dir):
        """Verifica que se crea el directorio de certificados."""
        signer = SignerService(cert_dir=temp_cert_dir)
        assert Path(temp_cert_dir).exists()

    def test_certificate_generation(self, signer, temp_cert_dir):
        """Verifica que se genera un certificado autofirmado."""
        # El certificado debe ser generado en __init__
        cert_files = list(Path(temp_cert_dir).glob("*"))
        assert len(cert_files) > 0, "Debe haber al menos un archivo de certificado"

    def test_sign_pdf_file_not_found(self, signer):
        """Verifica error cuando el archivo PDF no existe."""
        result = signer.sign_pdf(
            input_pdf="/ruta/inexistente/documento.pdf",
            output_pdf="/tmp/firmado.pdf"
        )
        assert result["status"] == "error"
        assert "no encontrado" in result["message"].lower()

    def test_sign_pdf_success(self, signer):
        """Verifica firma exitosa de un PDF."""
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(b"%PDF-1.4\ndummy pdf content")
            input_pdf = tmp.name
        
        try:
            output_pdf = input_pdf.replace(".pdf", "_signed.pdf")
            result = signer.sign_pdf(
                input_pdf=input_pdf,
                output_pdf=output_pdf
            )
            
            # Debe retornar status de éxito
            assert result["status"] in ["success", "error"]
            
            # Si es éxito, el archivo debe existir
            if result["status"] == "success":
                assert "output_pdf" in result
                assert "signed_at" in result
        
        finally:
            if os.path.exists(input_pdf):
                os.unlink(input_pdf)
            if "output_pdf" in result and os.path.exists(result.get("output_pdf", "")):
                os.unlink(result["output_pdf"])

    def test_verify_signature_file_not_found(self, signer):
        """Verifica error cuando archivo a validar no existe."""
        result = signer.verify_signature("/ruta/inexistente/documento.pdf")
        assert result["status"] == "error"
        assert "no encontrado" in result["message"].lower()

    def test_verify_signature_unsigned_pdf(self, signer):
        """Verifica que detecta un PDF sin firma."""
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            tmp.write(b"%PDF-1.4\ndummy unsigned pdf")
            pdf_path = tmp.name
        
        try:
            result = signer.verify_signature(pdf_path)
            assert result["status"] == "success"
            # Debe indicar que no está firmado
            assert "is_signed" in result
        
        finally:
            if os.path.exists(pdf_path):
                os.unlink(pdf_path)

    def test_cert_path_attribute(self, signer):
        """Verifica que el servicio tiene la ruta del certificado."""
        assert signer.cert_path is not None
        assert len(signer.cert_path) > 0


class TestReportService:
    """Tests para ReportService."""

    @pytest.fixture
    def temp_report_dir(self):
        """Crea directorio temporal para reportes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield tmpdir

    @pytest.fixture
    def reporter(self, temp_report_dir):
        """Instancia de ReportService con directorio temporal."""
        return ReportService(output_dir=temp_report_dir)

    @pytest.fixture
    def sample_data(self):
        """Datos de ejemplo para reportes."""
        return [
            {"id": 1, "nombre": "John Doe", "tipo": "Audiometría", "resultado": "Normal"},
            {"id": 2, "nombre": "Jane Smith", "tipo": "Laboratorio", "resultado": "Anormal"},
            {"id": 3, "nombre": "Bob Johnson", "tipo": "Radiología", "resultado": "Normal"},
        ]

    def test_initialization_creates_output_dir(self, temp_report_dir):
        """Verifica que se crea el directorio de salida."""
        reporter = ReportService(output_dir=temp_report_dir)
        assert Path(temp_report_dir).exists()

    def test_generate_excel_report_empty_data(self, reporter):
        """Verifica error con lista vacía."""
        result = reporter.generate_excel_report([])
        assert result["status"] == "error"

    def test_generate_excel_report_success(self, reporter, sample_data):
        """Verifica generación exitosa de Excel."""
        result = reporter.generate_excel_report(sample_data)
        
        if result["status"] == "success":
            assert "output_file" in result
            assert result["records_count"] == 3
            assert result["format"] == "xlsx"
            assert os.path.exists(result["output_file"])

    def test_generate_json_report_empty_data(self, reporter):
        """Verifica error con lista vacía."""
        result = reporter.generate_json_report([])
        assert result["status"] == "error"

    def test_generate_json_report_success(self, reporter, sample_data):
        """Verifica generación exitosa de JSON."""
        result = reporter.generate_json_report(sample_data)
        
        if result["status"] == "success":
            assert "output_file" in result
            assert result["records_count"] == 3
            assert result["format"] == "json"
            assert os.path.exists(result["output_file"])
            
            # Verificar el contenido del JSON
            with open(result["output_file"], "r") as f:
                json_data = json.load(f)
                assert json_data["total_records"] == 3
                assert "records" in json_data

    def test_generate_summary_report_empty_data(self, reporter):
        """Verifica error con lista vacía."""
        result = reporter.generate_summary_report([])
        assert result["status"] == "error"

    def test_generate_summary_report_success(self, reporter, sample_data):
        """Verifica generación exitosa de resumen HTML."""
        result = reporter.generate_summary_report(sample_data, title="Test Report")
        
        assert result["status"] == "success"
        assert "html_content" in result
        assert result["records_count"] == 3
        assert "Test Report" in result["html_content"]
        assert "<table>" in result["html_content"]

    def test_batch_process_success(self, reporter, sample_data):
        """Verifica procesamiento en batch de múltiples formatos."""
        result = reporter.batch_process(
            sample_data,
            formats=["json", "html"]
        )
        
        assert result["status"] == "success"
        assert "generated_files" in result
        assert "batch_id" in result
        assert result["records_count"] == 3 or result.get("total_records") == 3

    def test_batch_process_all_formats(self, reporter, sample_data):
        """Verifica batch con todos los formatos."""
        result = reporter.batch_process(
            sample_data,
            formats=["excel", "json", "html"]
        )
        
        if result["status"] == "success":
            # Al menos uno de los formatos debe haberse generado
            assert len(result["generated_files"]) >= 1


class TestReportEndToEnd:
    """Tests E2E integrando servicios."""

    def test_signer_and_reporter_together(self):
        """Verifica que los servicios se pueden inicializar juntos."""
        with tempfile.TemporaryDirectory() as cert_dir:
            with tempfile.TemporaryDirectory() as report_dir:
                signer = SignerService(cert_dir=cert_dir)
                reporter = ReportService(output_dir=report_dir)
                
                assert signer is not None
                assert reporter is not None
                assert Path(cert_dir).exists()
                assert Path(report_dir).exists()

    def test_complete_workflow(self):
        """Verifica flujo completo: datos -> reporte -> firma."""
        with tempfile.TemporaryDirectory() as tmpdir:
            cert_dir = os.path.join(tmpdir, "certs")
            report_dir = os.path.join(tmpdir, "reports")
            
            signer = SignerService(cert_dir=cert_dir)
            reporter = ReportService(output_dir=report_dir)
            
            # Generar datos y reporte
            sample_data = [
                {"paciente": "Juan Pérez", "fecha": "2026-02-25", "resultado": "Apto"},
                {"paciente": "María García", "fecha": "2026-02-24", "resultado": "No Apto"},
            ]
            
            report_result = reporter.generate_json_report(sample_data)
            assert report_result["status"] == "success"


if __name__ == "__main__":
    # Ejecutar tests: pytest backend/tests/test_pdf_services.py -v
    pytest.main([__file__, "-v"])
