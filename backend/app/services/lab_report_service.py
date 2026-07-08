"""
IMPL-20260708-19: Fase 3 NOVA absorción (ARCH-20260707-17) — F Reportes PDF.

Servicio que genera 3 PDFs imprimibles usando reportlab:
  - etiquetas: hoja con QR-like text box + folio + paciente + estudios
  - resultados: hoja con cabecera + tabla de analitos capturados + rangos
  - recibos:    hoja con totales + pagos registrados + saldo pendiente

Usa el mismo patrón que pdf_ebook_writer.py (SimpleDocTemplate + platypus)
pero con templates minimalistas (sin matplotlib), optimizados para
impresión rápida en láser/inyección de tinta.

Diseño:
  - Cada función retorna bytes (PDF binario). El router FastAPI se encarga
    de envolverlos en Response con media_type="application/pdf" y
    Content-Disposition: attachment.
  - Si la LabOrder no existe, lanza LookupError (404).
  - Si no hay datos suficientes (ej. PDF de resultados sin LabResult),
    genera un PDF con un mensaje "Sin datos" — NO falla.
  - Sin dependencias externas nuevas: solo reportlab (ya instalado).
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch, cm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


# ---------------------------------------------------------------------------
# Estilos compartidos
# ---------------------------------------------------------------------------
def _styles() -> Dict[str, ParagraphStyle]:
    s = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "TitleAMI",
            parent=s["Title"],
            fontSize=18,
            textColor=colors.HexColor("#1e3a8a"),
            spaceAfter=12,
            alignment=1,  # center
        ),
        "h2": ParagraphStyle(
            "H2AMI",
            parent=s["Heading2"],
            fontSize=12,
            textColor=colors.HexColor("#334155"),
            spaceBefore=10,
            spaceAfter=6,
        ),
        "normal": ParagraphStyle(
            "NormalAMI",
            parent=s["Normal"],
            fontSize=10,
            textColor=colors.HexColor("#0f172a"),
        ),
        "small": ParagraphStyle(
            "SmallAMI",
            parent=s["Normal"],
            fontSize=8,
            textColor=colors.HexColor("#475569"),
        ),
    }


# ---------------------------------------------------------------------------
# Helpers de serialización
# ---------------------------------------------------------------------------
def _serialize_order(order: Any) -> Dict[str, Any]:
    """Normaliza una LabOrder (con includes) a dict JSON-friendly."""
    if order is None:
        return {}
    if isinstance(order, dict):
        return dict(order)
    return {k: getattr(order, k, None) for k in (
        "id", "folio", "branch", "workerId", "doctorName", "doctorClave",
        "status", "urgency", "subtotal", "ivaPct", "iva", "total",
        "isCourtesy", "courtesyType", "createdAt", "confirmedAt",
    )}


def _value(obj: Any, key: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _format_money(value: Optional[float]) -> str:
    if value is None:
        return "$0.00"
    return f"${float(value):,.2f}"


def _format_date(value: Any) -> str:
    if value is None:
        return "—"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, str):
        try:
            dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return dt.strftime("%Y-%m-%d %H:%M")
        except Exception:
            return value
    return str(value)


def _patient_full_name(order: Dict[str, Any]) -> str:
    worker = _value(order, "worker") or {}
    first = _value(worker, "firstName", "") or ""
    last = _value(worker, "lastName", "") or ""
    return f"{first} {last}".strip() or "—"


def _patient_code(order: Dict[str, Any]) -> str:
    worker = _value(order, "worker") or {}
    return _value(worker, "universalId", "") or "—"


def _company_name(order: Dict[str, Any]) -> str:
    company = _value(order, "company") or {}
    return _value(company, "name", "") or ""


def _items_table(order: Dict[str, Any]) -> List[Dict[str, Any]]:
    items = _value(order, "items") or []
    out = []
    for it in items:
        test = _value(it, "medicalTest") or {}
        out.append({
            "code": _value(test, "code", "") or "—",
            "name": _value(test, "name", "") or "—",
            "price": float(_value(it, "price", 0) or 0),
            "discountAmount": float(_value(it, "discountAmount", 0) or 0),
            "discountPct": float(_value(it, "discountPct", 0) or 0),
            "amount": float(_value(it, "amount", 0) or 0),
        })
    return out


def _payments_total(payments: List[Any]) -> float:
    total = 0.0
    for p in payments or []:
        amt = _value(p, "amount", 0)
        try:
            total += float(amt)
        except (TypeError, ValueError):
            continue
    return total


# ---------------------------------------------------------------------------
# Plantilla base — carta, márgenes modestos
# ---------------------------------------------------------------------------
def _build_pdf(story: List[Any]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title="AMI Lab",
        author="AMI",
    )
    doc.build(story)
    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes


# ---------------------------------------------------------------------------
# 1) Etiquetas — muestra QR textual + folio + paciente + estudios
# ---------------------------------------------------------------------------
async def build_etiquetas_pdf(order: Any) -> bytes:
    """
    PDF de etiquetas para impresión en tira (8 etiquetas por hoja A4
    Letter con 4 filas × 2 columnas). Incluye:
      - Folio LabOrder
      - QR-like text box (placeholder, sin qrcode lib)
      - Nombre del paciente
      - Estudios (códigos)
      - Fecha de captura
    """
    o = _serialize_order(order)
    if not o:
        raise LookupError("LabOrder no encontrada")

    styles = _styles()
    folio = _value(o, "folio", "s/folio")
    patient = _patient_full_name(o)
    code = _patient_code(o)
    doctor = _value(o, "doctorName", "—")
    branch = _value(o, "branch", "MATRIZ")
    items = _items_table(o)
    codes = ", ".join(it["code"] for it in items) or "(sin estudios)"
    created = _format_date(_value(o, "createdAt"))

    # Construir 8 etiquetas en una grilla 4x2
    rows = []
    # Repetimos la misma etiqueta 8 veces (un sheet completo)
    for _ in range(4):
        cell_label = _build_single_label(
            folio=folio, patient=patient, code=code, doctor=doctor,
            branch=branch, codes=codes, created=created, styles=styles,
        )
        rows.append([cell_label, cell_label])
    grid = Table(rows, colWidths=[3.5 * inch, 3.5 * inch], rowHeights=[2.6 * inch] * 4)
    grid.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
        ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))

    story = [
        Paragraph(f"<b>Hoja de etiquetas</b> · Folio {folio}", styles["title"]),
        Paragraph(
            f"Paciente: <b>{patient}</b> &nbsp;|&nbsp; Cód: {code} &nbsp;|&nbsp; "
            f"Fecha: {created} &nbsp;|&nbsp; Sucursal: {branch}",
            styles["normal"],
        ),
        Spacer(1, 0.15 * inch),
        grid,
        Spacer(1, 0.2 * inch),
        Paragraph(
            "<i>Imprimir en hoja A4 / Letter · 8 etiquetas por hoja · "
            "Recortar por línea punteada.</i>",
            styles["small"],
        ),
    ]
    return _build_pdf(story)


def _build_single_label(
    folio: Any, patient: str, code: str, doctor: str,
    branch: str, codes: str, created: str,
    styles: Dict[str, ParagraphStyle],
) -> Table:
    """Tabla interna con el contenido de una etiqueta individual."""
    body = [
        [Paragraph(f"<b>AMI Lab — {branch}</b>", styles["small"])],
        [Paragraph(f"<b>Folio:</b> {folio}", styles["normal"])],
        [Paragraph(f"<b>Paciente:</b> {patient}", styles["normal"])],
        [Paragraph(f"<b>Cód:</b> {code}", styles["normal"])],
        [Paragraph(f"<b>Médico:</b> {doctor}", styles["normal"])],
        [Paragraph(f"<b>Fecha:</b> {created}", styles["normal"])],
        [Paragraph(f"<b>Estudios:</b> {codes}", styles["small"])],
        # QR placeholder (cuadrado punteado)
        [_build_qr_placeholder(folio, styles)],
    ]
    t = Table(body, colWidths=[2.6 * inch])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 1),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
    ]))
    return t


def _build_qr_placeholder(folio: Any, styles: Dict[str, ParagraphStyle]) -> Table:
    """Placeholder visual de un QR (cuadrado 60x60). No usa qrcode lib."""
    qr_cell = Table(
        [[" " * 6], [" " * 6], [" " * 6], [" " * 6]],
        colWidths=[0.7 * inch], rowHeights=[0.12 * inch] * 4,
    )
    qr_cell.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#0f172a")),
    ]))
    container = Table(
        [[qr_cell, Paragraph(f"<font size=7 color='#475569'>QR: AMI-{folio}</font>", styles["small"])]],
        colWidths=[0.8 * inch, 1.8 * inch],
    )
    container.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    return container


# ---------------------------------------------------------------------------
# 2) Resultados — formato NOVA: paciente + tabla de analitos
# ---------------------------------------------------------------------------
async def build_resultados_pdf(order: Any) -> bytes:
    """
    PDF de resultados del paciente (formato NOVA):
      - Cabecera: paciente, médico, fecha, folio, sucursal
      - Tabla por cada estudio:
          columnas: Analito | Valor | Unidad | Rango ref. | Fuera de rango
      - Pie: firma / sello (placeholder)
    """
    o = _serialize_order(order)
    if not o:
        raise LookupError("LabOrder no encontrada")

    styles = _styles()
    folio = _value(o, "folio", "s/folio")
    patient = _patient_full_name(o)
    code = _patient_code(o)
    doctor = _value(o, "doctorName", "—")
    branch = _value(o, "branch", "MATRIZ")
    company = _company_name(o) or "(sin empresa)"
    created = _format_date(_value(o, "createdAt"))
    status = _value(o, "status", "—")
    urgency = _value(o, "urgency", "NORMAL")
    confidentiality = _value(o, "confidentiality", "NORMAL")

    story = [
        Paragraph("Resultados de Laboratorio", styles["title"]),
        Paragraph(
            f"<b>AMI Lab — {branch}</b> &nbsp;|&nbsp; "
            f"Folio: <b>{folio}</b> &nbsp;|&nbsp; "
            f"Fecha: {created}",
            styles["normal"],
        ),
        Spacer(1, 0.15 * inch),
    ]

    # Cabecera del paciente
    patient_data = [
        ["Paciente:", patient, "Cód:", code],
        ["Médico:", doctor, "Sucursal:", branch],
        ["Empresa:", company, "Urgencia:", urgency],
        ["Estado:", status, "Confidencialidad:", confidentiality],
    ]
    patient_table = Table(patient_data, colWidths=[1.2 * inch, 2.5 * inch, 1.2 * inch, 1.6 * inch])
    patient_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#475569")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(patient_table)
    story.append(Spacer(1, 0.25 * inch))

    # Tabla de analitos por cada item
    items = _value(o, "items") or []
    any_results = False
    for it in items:
        test = _value(it, "medicalTest") or {}
        test_name = _value(test, "name", "—")
        test_code = _value(test, "code", "—")
        story.append(Paragraph(
            f"<b>{test_code}</b> — {test_name}",
            styles["h2"],
        ))

        results = _value(it, "results") or []
        if not results:
            story.append(Paragraph(
                "<i>Sin resultados capturados para este estudio.</i>",
                styles["small"],
            ))
            story.append(Spacer(1, 0.1 * inch))
            continue

        any_results = True
        rows = [["Analito", "Valor", "Unidad", "Rango ref.", "Obs."]]
        for r in results:
            analyte = _value(r, "analyte") or {}
            analyte_name = _value(analyte, "name", "—")
            val_num = _value(r, "valueNumber")
            val_text = _value(r, "valueText")
            value_str = str(val_num) if val_num is not None else (val_text or "—")
            unit = _value(_value(r, "unit"), "symbol") or ""
            is_oos = bool(_value(r, "isOutOfRange", False))
            is_crit = bool(_value(r, "isCritical", False))
            obs_flags = []
            if is_crit:
                obs_flags.append("⚠️ CRÍTICO")
            elif is_oos:
                obs_flags.append("⚠️ Fuera de rango")
            obs_str = ", ".join(obs_flags) or ""
            rows.append([analyte_name, value_str, unit, "", obs_str])

        tbl = Table(rows, colWidths=[2.1 * inch, 0.9 * inch, 0.7 * inch, 1.0 * inch, 1.5 * inch])
        tbl_style = [
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
            ("LEFTPADDING", (0, 0), (-1, -1), 5),
            ("RIGHTPADDING", (0, 0), (-1, -1), 5),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
        # Resaltar filas con flags
        for ridx, r in enumerate(results, start=1):
            if _value(r, "isCritical", False):
                tbl_style.append(("BACKGROUND", (0, ridx), (-1, ridx), colors.HexColor("#fee2e2")))
                tbl_style.append(("TEXTCOLOR", (0, ridx), (-1, ridx), colors.HexColor("#991b1b")))
            elif _value(r, "isOutOfRange", False):
                tbl_style.append(("BACKGROUND", (0, ridx), (-1, ridx), colors.HexColor("#fef3c7")))
        tbl.setStyle(TableStyle(tbl_style))
        story.append(tbl)
        story.append(Spacer(1, 0.2 * inch))

    if not any_results:
        story.append(Paragraph(
            "<i>Esta orden aún no tiene resultados capturados.</i>",
            styles["small"],
        ))

    # Pie de firma
    story.append(Spacer(1, 0.4 * inch))
    story.append(Paragraph("_______________________________________", styles["normal"]))
    story.append(Paragraph(
        f"<b>Firma del responsable</b><br/>"
        f"AMI Lab — Sucursal {branch}<br/>"
        f"Documento generado el {_format_date(datetime.utcnow())}",
        styles["small"],
    ))

    return _build_pdf(story)


# ---------------------------------------------------------------------------
# 3) Recibo — totales + pagos + saldo
# ---------------------------------------------------------------------------
async def build_recibo_pdf(order: Any) -> bytes:
    """
    PDF de recibo de pago:
      - Cabecera: folio + paciente + fecha
      - Tabla de items (estudios) con precios y descuentos
      - Totales: subtotal, IVA, total
      - Pagos registrados (LabCashMovement): método + monto + ref
      - Saldo pendiente
      - Mensaje de cortesía si aplica
    """
    o = _serialize_order(order)
    if not o:
        raise LookupError("LabOrder no encontrada")

    styles = _styles()
    folio = _value(o, "folio", "s/folio")
    patient = _patient_full_name(o)
    code = _patient_code(o)
    doctor = _value(o, "doctorName", "—")
    branch = _value(o, "branch", "MATRIZ")
    company = _company_name(o) or "(sin empresa)"
    created = _format_date(_value(o, "createdAt"))
    subtotal = float(_value(o, "subtotal", 0) or 0)
    iva_pct = float(_value(o, "ivaPct", 0) or 0)
    iva = float(_value(o, "iva", 0) or 0)
    total = float(_value(o, "total", 0) or 0)
    is_courtesy = bool(_value(o, "isCourtesy", False))

    story = [
        Paragraph("Recibo de Pago", styles["title"]),
        Paragraph(
            f"<b>AMI Lab — {branch}</b> &nbsp;|&nbsp; Folio: <b>{folio}</b>",
            styles["normal"],
        ),
        Spacer(1, 0.1 * inch),
    ]

    # Cabecera del paciente
    patient_data = [
        ["Paciente:", patient, "Cód:", code],
        ["Médico:", doctor, "Fecha:", created],
        ["Empresa:", company, "Sucursal:", branch],
    ]
    pt = Table(patient_data, colWidths=[1.0 * inch, 2.8 * inch, 1.0 * inch, 1.7 * inch])
    pt.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#475569")),
        ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#475569")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
    ]))
    story.append(pt)
    story.append(Spacer(1, 0.2 * inch))

    # Items
    story.append(Paragraph("<b>Estudios</b>", styles["h2"]))
    items = _items_table(o)
    if not items:
        story.append(Paragraph("<i>Sin estudios registrados.</i>", styles["small"]))
    else:
        rows = [["Código", "Estudio", "Precio", "Desc.", "Monto"]]
        for it in items:
            disc = it["discountAmount"] or 0
            if it["discountPct"]:
                disc = f"{disc} + {it['discountPct']}%"
            rows.append([
                it["code"],
                it["name"],
                _format_money(it["price"]),
                str(disc) if disc else "—",
                _format_money(it["amount"]),
            ])
        tbl = Table(rows, colWidths=[0.9 * inch, 3.0 * inch, 0.9 * inch, 0.7 * inch, 1.0 * inch])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (2, 0), (4, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ]))
        story.append(tbl)

    story.append(Spacer(1, 0.2 * inch))

    # Totales
    story.append(Paragraph("<b>Totales</b>", styles["h2"]))
    totals_rows = [
        ["Subtotal:", _format_money(subtotal)],
        [f"IVA ({iva_pct:g}%):", _format_money(iva)],
        ["Total:", _format_money(total)],
    ]
    tt = Table(totals_rows, colWidths=[4.5 * inch, 1.5 * inch])
    tt.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#1e3a8a")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#eff6ff")),
    ]))
    story.append(tt)
    story.append(Spacer(1, 0.2 * inch))

    # Cortesía
    if is_courtesy:
        courtesy_type = _value(o, "courtesyType", "") or ""
        story.append(Paragraph(
            f"<b>⚠️ ORDEN MARCADA COMO CORTESÍA</b>"
            + (f" — {courtesy_type}" if courtesy_type else ""),
            styles["normal"],
        ))
        story.append(Spacer(1, 0.1 * inch))

    # Pagos
    story.append(Paragraph("<b>Pagos registrados</b>", styles["h2"]))
    payments = _value(o, "cashMovements") or []
    if not payments:
        story.append(Paragraph("<i>Sin pagos registrados.</i>", styles["small"]))
        paid_total = 0.0
    else:
        rows = [["Fecha", "Método", "Referencia", "Monto"]]
        for p in payments:
            method = _value(p, "method", "—")
            ref = _value(p, "reference", "") or "—"
            amt = _value(p, "amount", 0)
            ts = _format_date(_value(p, "createdAt"))
            user = _value(p, "user") or {}
            user_name = _value(user, "fullName", "") or ""
            rows.append([ts, str(method), ref, _format_money(amt)])
        pt2 = Table(rows, colWidths=[1.6 * inch, 1.2 * inch, 2.2 * inch, 1.0 * inch])
        pt2.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#475569")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (3, 0), (3, -1), "RIGHT"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ]))
        story.append(pt2)
        paid_total = _payments_total(payments)

    # Saldo
    story.append(Spacer(1, 0.15 * inch))
    balance = max(0.0, total - paid_total)
    balance_rows = [
        ["Total cobrado:", _format_money(paid_total)],
        ["Saldo pendiente:", _format_money(balance)],
    ]
    bt = Table(balance_rows, colWidths=[4.5 * inch, 1.5 * inch])
    bt.setStyle(TableStyle([
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTSIZE", (0, 0), (-1, -1), 10),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (1, -1), (-1, -1), colors.HexColor("#dc2626") if balance > 0 else colors.HexColor("#15803d")),
    ]))
    story.append(bt)

    story.append(Spacer(1, 0.4 * inch))
    story.append(Paragraph(
        f"<i>Recibo generado el {_format_date(datetime.utcnow())} — "
        f"AMI Lab · Sucursal {branch}</i>",
        styles["small"],
    ))

    return _build_pdf(story)