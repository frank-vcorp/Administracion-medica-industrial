"""
IMPL-20260630-05: Tests del generador EBOOK PDF (Fase 3: II.2-II.8 estadísticas).

SPEC: context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md
Handoff Fase 1: context/interconsultas/HANDOFF_IMPL-20260701-01_SOFIA_EBOOK-PDF-FASE-1.md
Handoff Fase 2: context/interconsultas/HANDOFF_IMPL-20260701-02_SOFIA_EBOOK-PDF-FASE-2.md
Handoff Fase 3: context/interconsultas/HANDOFF_IMPL-20260701-03_SOFIA_EBOOK-PDF-FASE-3.md

Cobertura Fase 1 (preservada):
  1. PDF se genera con 1+ trabajador y tamaño > 1KB.
  2. Tamaño Carta (612×792pt) verificado por mediabox.
  3. PDF tiene >= 5 páginas (portada + TOC + resumen + II.1 + III.1).
  4. Orden alfabético: AGUILAR primero.
  5. II.1 Audiometría incluye la mini-gráfica matplotlib (imagen embebida).

Cobertura Fase 2 (preservada):
  6. Todos los trabajadores se renderizan (loop completo, no solo el primero).
  7. Las 8 secciones clínicas se renderizan condicionalmente cuando hay datos.

Cobertura Fase 3 (nueva):
  8. Las 8 subsecciones II.1-II.8 aparecen en el PDF con datos completos.
"""
from pathlib import Path

import pytest
from pypdf import PdfReader

from app.services.reports.pdf_ebook_writer import generar_ebook


# ------------------------------------------------------------------
# Fixtures
# ------------------------------------------------------------------
@pytest.fixture
def project_ejemplo():
    """Proyecto de prueba con 2 trabajadores (AGUILAR < VELAZQUEZ)."""
    return {
        "id": "test-1",
        "empresa": "TEST S.A.",
        "empresaLegal": "TEST S.A. DE C.V.",
        "fecha": "2026-06-30",
        "trabajadores": [
            {
                "folio": "001",
                "nombre": "VELAZQUEZ MORENO LORENZO",
                "sexo": "M",
                "area": "SOLDADURA",
                "antiguedad": "5 AÑOS",
                "audiometria": {
                    "dx": "NORMAL",
                    "oidoDerecho": "Normal",
                    "oidoIzquierdo": "Normal",
                    "hbc": -1.25,
                },
                "espirometria": {},
                "rxColumna": {},
                "rxTorax": {},
                "ecg": {},
                "laboratorio": {},
            },
            {
                "folio": "002",
                "nombre": "AGUILAR ARREOLA JOSE DAVID",
                "sexo": "M",
                "area": "SOLDADURA",
                "antiguedad": "3 AÑOS",
                "audiometria": {
                    "dx": "NORMAL",
                    "oidoDerecho": "Normal",
                    "oidoIzquierdo": "Normal",
                    "hbc": 0.5,
                },
                "espirometria": {},
                "rxColumna": {},
                "rxTorax": {},
                "ecg": {},
                "laboratorio": {},
            },
        ],
    }


@pytest.fixture
def output_pdf(project_ejemplo, tmp_path):
    """Genera el PDF una sola vez por sesión de tests para reutilizar."""
    out = tmp_path / "ebook_test.pdf"
    generar_ebook(project_ejemplo, str(out))
    return out


# ------------------------------------------------------------------
# Tests
# ------------------------------------------------------------------
def test_ebook_generates_with_1_worker(output_pdf):
    """El PDF se genera y tiene un tamaño razonable."""
    assert output_pdf.exists()
    assert output_pdf.stat().st_size > 1000, (
        f"PDF demasiado pequeño: {output_pdf.stat().st_size} bytes"
    )


def test_ebook_uses_letter_size(output_pdf):
    """Verifica tamaño Carta (8.5×11in = 612×792pt)."""
    reader = PdfReader(str(output_pdf))
    page = reader.pages[0]
    assert int(page.mediabox.width) == 612
    assert int(page.mediabox.height) == 792


def test_ebook_has_multiple_sections(output_pdf):
    """El PDF tiene >= 5 páginas (portada + TOC + resumen + II.1 + III.1)."""
    reader = PdfReader(str(output_pdf))
    assert len(reader.pages) >= 5, (
        f"Se esperaban >= 5 páginas, hay {len(reader.pages)}"
    )


def test_ebook_trabajador_ordenado_alfabetico(output_pdf):
    """
    Verifica que el primer trabajador renderizado (III.1) sea el alfabéticamente
    primero: AGUILAR (apellido A) debe aparecer antes que VELAZQUEZ
    (apellido V) en el orden de aparición del PDF.
    """
    reader = PdfReader(str(output_pdf))
    full_text = ""
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ""
        except Exception:
            pass

    assert "AGUILAR" in full_text, (
        "Se esperaba AGUILAR (primer apellido alfabéticamente) en III.1"
    )
    assert "VELAZQUEZ" in full_text, (
        "Fase 2 debe renderizar TODOS los trabajadores; VELAZQUEZ debe aparecer"
    )
    # AGUILAR debe aparecer antes que VELAZQUEZ en el texto del PDF.
    assert full_text.index("AGUILAR") < full_text.index("VELAZQUEZ"), (
        "AGUILAR debe aparecer antes que VELAZQUEZ (orden alfabético)"
    )


def test_ebook_includes_audiometria_grafica(output_pdf):
    """
    Verifica que la sección II.1 Audiometría incluye la mini-gráfica matplotlib.
    Como reportlab comprime los streams (FlateDecode + ASCII85Decode), no
    podemos buscar la firma PNG en los bytes crudos. En su lugar usamos pypdf
    para inspeccionar las imágenes declaradas en los recursos de cada página.
    """
    reader = PdfReader(str(output_pdf))

    # 1) Texto II.1 presente.
    full_text = ""
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ""
        except Exception:
            pass
    assert "II.1" in full_text, "No se encontró el encabezado II.1"

    # 2) Buscar al menos una imagen embebida (la mini-gráfica matplotlib).
    #    pypdf expone page.images() en versiones recientes.
    found_image = False
    for page in reader.pages:
        try:
            images = list(page.images)
            if images:
                found_image = True
                break
        except Exception:
            # Fallback: revisar /Resources /XObject en raw dict.
            try:
                res = page.get("/Resources") or {}
                xobjs = res.get("/XObject") or {}
                if xobjs:
                    found_image = True
                    break
            except Exception:
                pass

    assert found_image, (
        "No se encontró ninguna imagen embebida en el PDF "
        "(la mini-gráfica matplotlib de II.1 debería estar presente)"
    )


# ------------------------------------------------------------------
# Tests Fase 2: 8 secciones + TODOS los trabajadores
# ------------------------------------------------------------------
@pytest.fixture
def project_completo():
    """
    Proyecto con 1 trabajador que tiene las 8 secciones clínicas con datos.
    Se usa para verificar que el render condicional funciona para todas.
    """
    return {
        "id": "test-completo",
        "empresa": "TEST FULL S.A.",
        "empresaLegal": "TEST FULL S.A. DE C.V.",
        "fecha": "2026-06-30",
        "trabajadores": [
            {
                "folio": "999",
                "nombre": "COMPLETO LOPEZ JUAN",
                "sexo": "M",
                "area": "PRODUCCION",
                "antiguedad": "10 AÑOS",
                "audiometria": {
                    "dx": "NORMAL",
                    "oidoDerecho": "Normal",
                    "oidoIzquierdo": "Normal",
                    "hbc": 0.5,
                },
                "espirometria": {
                    "patron": "NORMAL",
                    "fvc": 0.92,
                    "tabaquismo": "NEGADO",
                },
                "rxColumna": {
                    "escoliosis": 3,
                    "lordosis": 36,
                    "basculacion": 0,
                    "impresion": "NORMAL",
                },
                "rxTorax": {"impresion": "NORMAL"},
                "ecg": {"impresion": "NORMAL"},
                "laboratorio": {
                    "bh": {"hb": 15.2, "leu": 7000, "pla": 250000},
                    "qs6": {"gluc": 90, "col": 180, "trig": 120},
                    "toxico": {
                        "anfeta": "NEGATIVO",
                        "coca": "NEGATIVO",
                        "marihua": "NEGATIVO",
                    },
                },
                "campimetria": {
                    "agudezaVisual": "NORMAL",
                    "camposVisuales": "NORMAL",
                    "discriminacionColor": "NORMAL",
                },
                "examenMedico": {
                    "peso": 70,
                    "talla": 170,
                    "imc": 24.2,
                    "presionArterial": "120/80",
                    "diagnostico": "APTO",
                },
            }
        ],
    }


def test_ebook_renders_all_workers(project_ejemplo, tmp_path):
    """
    Fase 2: el PDF debe incluir TODOS los trabajadores, no solo el primero.
    """
    out = tmp_path / "ebook_all_workers.pdf"
    generar_ebook(project_ejemplo, str(out))
    reader = PdfReader(str(out))
    full_text = ""
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ""
        except Exception:
            pass

    assert "AGUILAR" in full_text, "Falta AGUILAR en el PDF"
    assert "VELAZQUEZ" in full_text, "Falta VELAZQUEZ en el PDF"
    # Verificar orden alfabético por apellido.
    assert full_text.index("AGUILAR") < full_text.index("VELAZQUEZ"), (
        "AGUILAR debe aparecer antes que VELAZQUEZ (orden alfabético)"
    )


def test_ebook_renders_8_section_types(project_completo, tmp_path):
    """
    Fase 2: cuando un trabajador tiene datos en las 8 secciones clínicas,
    todas deben renderizarse (los H2 correspondientes deben aparecer en el PDF).
    """
    out = tmp_path / "ebook_8_sections.pdf"
    generar_ebook(project_completo, str(out))
    reader = PdfReader(str(out))
    full_text = ""
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ""
        except Exception:
            pass

    secciones_esperadas = [
        "Audiometría",
        "Espirometría",
        "RX Columna",
        "RX Tórax",
        "ECG",
        "Laboratorio",
        "Campimetría",
        "Examen Médico",
    ]
    for seccion in secciones_esperadas:
        assert seccion in full_text, (
            f"Falta sección clínica en el PDF: {seccion!r}"
        )


# ------------------------------------------------------------------
# Tests Fase 3: 8 subsecciones II.1-II.8 con mini-gráficas
# ------------------------------------------------------------------
def test_ebook_includes_8_estadisticas(project_completo, tmp_path):
    """
    Fase 3: verifica que las 8 subsecciones II.1-II.8 están presentes en el
    PDF cuando el proyecto tiene datos completos (los encabezados se
    renderizan como Paragraphs y aparecen en el texto extraído).
    """
    out = tmp_path / "ebook_8_estadisticas.pdf"
    generar_ebook(project_completo, str(out))
    reader = PdfReader(str(out))
    full_text = ""
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ""
        except Exception:
            pass

    subsecciones = [
        "II.1",  # Audiometría
        "II.2",  # Trauma Acústico
        "II.3",  # Espirometría
        "II.4",  # RX Columna
        "II.5",  # RX Tórax
        "II.6",  # ECG
        "II.7",  # Campimetría
        "II.8",  # Laboratorio
    ]
    for sub in subsecciones:
        assert sub in full_text, (
            f"Falta subsección de estadísticas en el PDF: {sub!r}"
        )