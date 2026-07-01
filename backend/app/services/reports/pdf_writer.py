"""
IMPL-20260630-03: Generador PDF para reportes masivos.
ARCH-20260623-01: Modulo de Reportes Masivos.

Usa reportlab para producir:
  - Pagina 1: Portada "Diagnostico Situacional"
  - Pagina 2+: Concentrado tabular (landscape A4)

============================================================================
⚠️  DEPRECATED  ⚠️
============================================================================
IMPL-20260701-04: Este modulo esta DEPRECADO desde la Fase 4 del modulo
EBOOK PDF.

Reemplazado por: app.services.reports.pdf_ebook_writer.generar_ebook
                  (SPEC_ARCH-20260630-01-EBOOK-PDF.md)

El orquestador (massive_report.py) ya NO llama a generar_pdf() para
format='EBOOK' ni 'BOTH'. Se conserva intacto en este archivo para:
  1) Rollback de emergencia (cambio de una linea en massive_report.py).
  2) Referencia historica.
  3) Tests legacy (test_pdf_writer_creates_portada_and_concentrado).

NO MODIFICAR LA LOGICA. Su implementacion esta congelada.
============================================================================
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
)

from app.services.reports.conteos import (
    calcular_distribuciones,
    calcular_escoliosis_distribucion,
    calcular_espirometria_distribucion,
    calcular_hbc_por_rango,
    calcular_trauma_acustico_por_area,
)


# Columnas del concentrado en landscape (ancho en points).
COLUMNAS: List[Dict[str, Any]] = [
    {"key": "folio", "label": "FOLIO", "width": 35},
    {"key": "nombre", "label": "NOMBRE", "width": 95},
    {"key": "sexo", "label": "SEXO", "width": 38},
    {"key": "area", "label": "AREA", "width": 55},
    {"key": "antiguedad", "label": "ANTIG.", "width": 45},
    {"key": "agudezaVisual", "label": "AG. VISUAL", "width": 60},
    {"key": "dx", "label": "DX AUDIO", "width": 50},
    {"key": "hbc", "label": "% HBC", "width": 30},
    {"key": "espirometria", "label": "ESPIRO", "width": 50},
    {"key": "tabaquismo", "label": "TAB.", "width": 35},
    {"key": "escoliosis", "label": "ESCOL.", "width": 30},
    {"key": "lordosis", "label": "LORD.", "width": 30},
    {"key": "basculacion", "label": "BASC.", "width": 30},
    {"key": "ecg", "label": "ECG", "width": 65},
]


def _fila_aplanada(w: Dict[str, Any]) -> Dict[str, str]:
    c = w.get("campimetria") or {}
    a = w.get("audiometria") or {}
    e = w.get("espirometria") or {}
    rxc = w.get("rxColumna") or {}
    ecg = w.get("ecg") or {}
    sexo = (w.get("sexo") or "").upper()
    sexo_short = "M" if sexo.startswith("M") else ("F" if sexo.startswith("F") else (sexo or ""))
    hbc = a.get("hbc")
    esc = rxc.get("escoliosis")
    lord = rxc.get("lordosis")
    basc = rxc.get("basculacion")

    def fmt_num(v: Any, suffix: str = "") -> str:
        if v is None:
            return "N/A"
        return f"{v}{suffix}"

    return {
        "folio": str(w.get("folio") or ""),
        "nombre": str(w.get("nombre") or ""),
        "sexo": sexo_short,
        "area": str(w.get("area") or ""),
        "antiguedad": str(w.get("antiguedad") or ""),
        "agudezaVisual": str(c.get("agudezaVisual") or "N/A"),
        "dx": str(a.get("dx") or "N/A"),
        "hbc": fmt_num(hbc),
        "espirometria": str(e.get("patron") or "N/A"),
        "tabaquismo": str(e.get("tabaquismo") or "N/A"),
        "escoliosis": fmt_num(esc, "°"),
        "lordosis": fmt_num(lord, "°"),
        "basculacion": fmt_num(basc, " cm"),
        "ecg": str(ecg.get("impresion") or "N/A"),
    }


def _seccion(titulo: str, items: List[Any], styles) -> List[Any]:
    flow: List[Any] = [Paragraph(titulo, styles["Seccion"])]
    for it in items:
        flow.append(Paragraph(f"&bull; {it}", styles["Item"]))
    flow.append(Spacer(1, 6))
    return flow


def _footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(colors.grey)
    canvas.drawString(20 * mm, 10 * mm, f"Pagina {doc.page}")
    canvas.drawCentredString(
        A4[0] / 2 if doc.pagesize == A4 else landscape(A4)[0] / 2,
        10 * mm,
        "AMI - Reportes Masivos UMM",
    )
    canvas.restoreState()


def generar_pdf(project: Dict[str, Any], output_path: str) -> str:
    """Genera PDF (portada + concentrado) en `output_path`."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="Titulo",
            parent=styles["Title"],
            fontSize=20,
            spaceAfter=4,
            textColor=colors.HexColor("#0f172a"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Subtitulo",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#64748b"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Seccion",
            parent=styles["Heading2"],
            fontSize=11,
            textColor=colors.HexColor("#0f172a"),
            backColor=colors.HexColor("#f1f5f9"),
            borderPadding=4,
            spaceBefore=4,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Item",
            parent=styles["Normal"],
            fontSize=9,
            leading=12,
        )
    )

    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=f"Reporte Masivo - {project.get('empresa', 'Proyecto')}",
        author="AMI",
    )

    story: List[Any] = []

    # --- Portada ---
    story.append(Paragraph("DIAGN&Oacute;STICO SITUACIONAL", styles["Titulo"]))
    story.append(
        Paragraph(
            "M&oacute;dulo de Reportes Masivos UMM &mdash; Administraci&oacute;n M&eacute;dica Industrial",
            styles["Subtitulo"],
        )
    )
    story.append(Paragraph(f"<b>Fecha:</b> {project.get('fecha', 'N/D')}", styles["Item"]))
    story.append(Spacer(1, 8))

    story += _seccion(
        "DATOS DE LA EMPRESA",
        [
            f"<b>Empresa:</b> {project.get('empresa', 'N/D')}",
            f"<b>Raz&oacute;n social:</b> {project.get('empresaLegal', 'N/D')}",
            f"<b>Trabajadores evaluados:</b> {len(project.get('trabajadores', []))}",
        ],
        styles,
    )

    trabajadores = project.get("trabajadores", [])
    examen_medico = len(trabajadores)
    audiometrias = sum(1 for w in trabajadores if (w.get("audiometria") or {}).get("dx") not in (None, "", "N/A"))
    espirometrias = sum(1 for w in trabajadores if (w.get("espirometria") or {}).get("patron") not in (None, "", "N/A"))
    rx_columna = sum(1 for w in trabajadores if (w.get("rxColumna") or {}).get("impresion") not in (None, "", "N/A"))
    rx_columna_na = examen_medico - rx_columna
    laboratorios = examen_medico

    story += _seccion(
        "CONTEOS POR ESTUDIO",
        [
            f"{examen_medico} Examen M&eacute;dico",
            f"{audiometrias} Audiometr&iacute;as",
            f"{espirometrias} Espirometr&iacute;as",
            f"{rx_columna} Radiograf&iacute;as de Columna ({rx_columna_na} N/A)",
            f"{laboratorios} Laboratorios",
        ],
        styles,
    )

    dist = calcular_distribuciones(project)
    hbc = calcular_hbc_por_rango(project)
    espiro = calcular_espirometria_distribucion(project)
    escolio = calcular_escoliosis_distribucion(project)
    trauma = calcular_trauma_acustico_por_area(project)

    story += _seccion(
        "PIR&Aacute;MIDE DE EDAD",
        [
            f"18-30 a&ntilde;os: {dist['edad18a30']} trabajadores",
            f"31-45 a&ntilde;os: {dist['edad31a45']} trabajadores",
            f"46+ a&ntilde;os: {dist['edad46mas']} trabajadores",
        ],
        styles,
    )

    story += _seccion(
        "DISTRIBUCI&Oacute;N POR SEXO",
        [
            f"Masculino: {dist['masculino']}",
            f"Femenino: {dist['femenino']}",
        ],
        styles,
    )

    story += _seccion(
        "INDICADORES CLAVE",
        [
            f"{hbc['normal']} Audiometr&iacute;as Normales (%HBC &lt;10%)",
            f"{hbc['alto'] + hbc['muyAlto']} Audiometr&iacute;as con HBC elevado",
            f"{escolio['normal']} Escoliosis Normal",
            f"{escolio['leve'] + escolio['moderada'] + escolio['grave']} Escoliosis alterada",
        ],
        styles,
    )

    if trauma:
        story += _seccion(
            "TRAUMA AC&Uacute;STICO POR &Aacute;REA",
            [f"{t['area']}: {t['conteo']} caso{'s' if t['conteo'] != 1 else ''}" for t in trauma],
            styles,
        )
    else:
        story += _seccion(
            "TRAUMA AC&Uacute;STICO POR &Aacute;REA",
            ["Sin casos de trauma ac&uacute;stico detectados."],
            styles,
        )

    story += _seccion(
        "ESPIROMETR&Iacute;AS (PATR&Oacute;N)",
        [f"{e['patron']}: {e['conteo']}" for e in espiro],
        styles,
    )

    story.append(PageBreak())

    # --- Concentrado (landscape) ---
    doc.pagesize = landscape(A4)
    doc.leftMargin = 12 * mm
    doc.rightMargin = 12 * mm
    doc.topMargin = 12 * mm
    doc.bottomMargin = 12 * mm

    story.append(
        Paragraph(
            f"CONCENTRADO GENERAL &mdash; {project.get('empresa', '')}",
            styles["Titulo"],
        )
    )
    story.append(Spacer(1, 6))

    header_row = [c["label"] for c in COLUMNAS]
    data: List[List[str]] = [header_row]
    for w in trabajadores:
        fila = _fila_aplanada(w)
        data.append([fila[c["key"]] for c in COLUMNAS])

    table = Table(data, colWidths=[c["width"] for c in COLUMNAS], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 7),
                ("FONTSIZE", (0, 1), (-1, -1), 7),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f8fafc")],
                ),
            ]
        )
    )
    story.append(table)

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return output_path