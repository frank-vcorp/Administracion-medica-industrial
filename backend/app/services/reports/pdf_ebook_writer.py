"""
Generador del EBOOK PDF Ejecutivo por Proyecto (Diagnóstico Situacional + Expedientes).

Combina:
  1. Portada institucional SME (Soluciones Médico Empresariales) + tabla de cobertura.
  2. Índice navegable (hipervínculos clicables a cada sección y trabajador con
     número de página real post-ensamblado).
  3. I. Resumen Ejecutivo (demografía, edad, sexo, aptitud global).
  4. II. Diagnóstico Situacional (II.1 a II.10) con gráficas matplotlib y
     Cuadros de Recomendaciones Médicas por modalidad (audiometría + LFT Art. 514,
     espirometría, columna NOM-036, tórax, ECG, visual, laboratorio, IMC/TA/bucal).
  5. III. Reportes Individuales en orden alfabético por apellido:
     Cada capítulo de trabajador incluye su ficha clínica, imágenes embebidas e
     INMEDIATAMENTE después (en orden de impresión) su Dictamen firmado y los
     PDFs de sus estudios validados, con Bookmarks jerárquicos apuntando a la
     página exacta de cada sección y trabajador.
"""
from __future__ import annotations

import logging
import os
import tempfile
from io import BytesIO
from typing import Any, Dict, List, Optional, Tuple

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pypdf import PdfReader, PdfWriter
from pypdf.annotations import Link
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Flowable,
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from app.services.reports.conteos import (
    calcular_aptitud_distribucion,
    calcular_conteo_estudios,
    calcular_distribuciones,
    calcular_escoliosis_distribucion,
    calcular_espirometria_distribucion,
    calcular_hbc_por_rango,
    calcular_imc_distribucion,
    calcular_presion_arterial_distribucion,
    calcular_qs6_niveles,
    calcular_salud_bucal_distribucion,
    calcular_trauma_acustico_por_area,
)

logger = logging.getLogger(__name__)

MAX_TRABAJADORES = 300

SME_TEAL = colors.HexColor("#0f766e")
SME_TEAL_LIGHT = colors.HexColor("#f0fdfa")
SME_PURPLE = colors.HexColor("#592c82")
SME_DARK = colors.HexColor("#0f172a")
SME_SLATE = colors.HexColor("#475569")
SME_BORDER = colors.HexColor("#cbd5e1")
SME_BG_SOFT = colors.HexColor("#f8fafc")
SME_AMBER_BG = colors.HexColor("#fffbeb")
SME_AMBER_BORDER = colors.HexColor("#f59e0b")

# ------------------------------------------------------------------
# Tipografía unicode
# ------------------------------------------------------------------
try:
    pdfmetrics.registerFont(
        TTFont("DejaVu", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf")
    )
    pdfmetrics.registerFont(
        TTFont(
            "DejaVu-Bold",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        )
    )
    FONT_NAME = "DejaVu"
    FONT_NAME_BOLD = "DejaVu-Bold"
except Exception as exc:
    logger.warning("Fallback a Helvetica por fuente DejaVu no disponible: %s", exc)
    FONT_NAME = "Helvetica"
    FONT_NAME_BOLD = "Helvetica-Bold"


def _resolve_sme_logo_path() -> Optional[str]:
    candidates = [
        os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "assets", "sme-logo.png")
        ),
        os.path.abspath(
            os.path.join(
                os.path.dirname(__file__),
                "..",
                "..",
                "..",
                "..",
                "frontend",
                "public",
                "branding",
                "SOLUCIONES MEDICO EMPRESRIALES-06.png",
            )
        ),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return p
    return None


def _esc(text: Any) -> str:
    s = "" if text is None else str(text)
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _apellido_de(trabajador: Dict[str, Any]) -> str:
    """Ordenamiento alfabético por apellidos (`nombre` viene como `APELLIDO NOMBRE`)."""
    return (trabajador.get("nombre") or "").strip().upper()


# ------------------------------------------------------------------
# Flowables de rastreo de páginas y links clicables en TOC
# ------------------------------------------------------------------

class _MarkerFlowable(Flowable):
    """Flowable invisible (0x0) que registra la página ReportLab (0-based) del marcador."""

    def __init__(self, key: str, tracker: Dict[str, int]):
        super().__init__()
        self.key = key
        self.tracker = tracker
        self.width = 0
        self.height = 0

    def draw(self):
        if self.key not in self.tracker:
            self.tracker[self.key] = max(0, self.canv.getPageNumber() - 1)


class _TocLinkRow(Flowable):
    """Fila de Índice con texto a la izquierda, número de página a la derecha y rectángulo clicable."""

    def __init__(
        self,
        label: str,
        page_display: str,
        dest_key: str,
        link_rects: List[Tuple[int, Tuple[float, float, float, float], str]],
        width: float,
        indent: int = 0,
        bold: bool = False,
    ):
        super().__init__()
        self.label = label
        self.page_display = page_display
        self.dest_key = dest_key
        self.link_rects = link_rects
        self.width = width
        self.height = 17 if bold else 15
        self.indent = indent
        self.bold = bold

    def draw(self):
        c = self.canv
        c.saveState()
        font = FONT_NAME_BOLD if self.bold else FONT_NAME
        size = 9.5 if self.bold else 8.8
        color = SME_PURPLE if self.bold else SME_DARK
        c.setFont(font, size)
        c.setFillColor(color)

        x_left = self.indent * 12
        y_text = 4
        max_chars = max(20, int((self.width - x_left - 50) / (size * 0.52)))
        txt = self.label if len(self.label) <= max_chars else self.label[: max_chars - 1] + "…"
        c.drawString(x_left, y_text, txt)

        # Página alineada a la derecha
        c.setFont(FONT_NAME_BOLD if self.bold else FONT_NAME, size)
        c.setFillColor(SME_TEAL if self.page_display else SME_SLATE)
        if self.page_display:
            c.drawRightString(self.width - 2, y_text, f"Pág. {self.page_display}")

        # Línea guía punteada sutil
        c.setStrokeColor(colors.HexColor("#e2e8f0"))
        c.setLineWidth(0.5)
        c.line(0, 1, self.width, 1)

        # Coordenadas absolutas PDF para registrar Link en pypdf
        try:
            ax, ay = c.absolutePosition(0, 0)
            rl_page_idx = max(0, c.getPageNumber() - 1)
            self.link_rects.append(
                (rl_page_idx, (ax, ay, ax + self.width, ay + self.height), self.dest_key)
            )
        except Exception:
            pass
        c.restoreState()


# ------------------------------------------------------------------
# Estilos
# ------------------------------------------------------------------

def _build_styles():
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="EbookTitle",
            fontName=FONT_NAME_BOLD,
            fontSize=22,
            leading=26,
            spaceAfter=8,
            alignment=1,
            textColor=SME_DARK,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookSubtitle",
            fontName=FONT_NAME_BOLD,
            fontSize=13,
            leading=17,
            alignment=1,
            textColor=SME_TEAL,
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookH1",
            fontName=FONT_NAME_BOLD,
            fontSize=15,
            leading=19,
            spaceBefore=4,
            spaceAfter=8,
            textColor=SME_PURPLE,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookH2",
            fontName=FONT_NAME_BOLD,
            fontSize=11,
            leading=14,
            spaceBefore=7,
            spaceAfter=4,
            textColor=SME_TEAL,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookBody",
            fontName=FONT_NAME,
            fontSize=9,
            leading=13,
            spaceAfter=3,
            textColor=SME_DARK,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookSmall",
            fontName=FONT_NAME,
            fontSize=8.2,
            leading=11.5,
            spaceAfter=2,
            textColor=SME_SLATE,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookPlaceholder",
            fontName=FONT_NAME,
            fontSize=10,
            leading=13,
            alignment=1,
            textColor=colors.HexColor("#94a3b8"),
        )
    )
    return styles


# ------------------------------------------------------------------
# Helpers de tablas y cuadros de recomendaciones
# ------------------------------------------------------------------

def _crear_tabla_conteos(data: List[List[str]], col_widths: Optional[List[float]] = None):
    widths = col_widths or [4.2 * inch, 2.3 * inch]
    tabla = Table(data, colWidths=widths)
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SME_TEAL),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), FONT_NAME_BOLD),
                ("FONTNAME", (0, 1), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 8.8),
                ("ALIGN", (0, 0), (0, -1), "LEFT"),
                ("ALIGN", (1, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("GRID", (0, 0), (-1, -1), 0.5, SME_BORDER),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SME_BG_SOFT]),
            ]
        )
    )
    return tabla


def _cuadro_recomendaciones(titulo: str, items: List[str], styles) -> Table:
    """Cuadro institucional SME de recomendaciones médico-laborales."""
    bullets = "<br/>".join(f"• {_esc(item)}" for item in items)
    content = [
        [Paragraph(f"<b>{_esc(titulo)}</b>", styles["EbookH2"])],
        [Paragraph(bullets, styles["EbookSmall"])],
    ]
    box = Table(content, colWidths=[6.9 * inch])
    box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SME_TEAL_LIGHT),
                ("LINEBEFORE", (0, 0), (0, -1), 3, SME_TEAL),
                ("BOX", (0, 0), (-1, -1), 0.5, SME_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return box


# ------------------------------------------------------------------
# Helpers de gráficas matplotlib Agg
# ------------------------------------------------------------------

def _generar_grafica_barras(
    categorias: List[str],
    valores: List[int],
    titulo: str,
    color: str = "#0f766e",
    horizontal: bool = False,
) -> Optional[str]:
    try:
        fig, ax = plt.subplots(figsize=(5.2, 2.7), dpi=110)
        if horizontal:
            ax.barh(categorias, valores, color=color)
            ax.invert_yaxis()
        else:
            ax.bar(categorias, valores, color=color)
        ax.set_title(titulo, fontsize=10, fontweight="bold", color="#0f172a")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.tick_params(labelsize=8)
        if not horizontal:
            ax.set_ylabel("Trabajadores", fontsize=8)
        plt.tight_layout()

        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.close()
        plt.savefig(tmp.name, format="png", dpi=110, bbox_inches="tight")
        plt.close(fig)
        return tmp.name
    except Exception as exc:
        logger.error("Error generando gráfica de barras: %s", exc)
        return None


def _generar_grafica_barras_categorias(
    categorias: List[str],
    valores: List[int],
    colores: List[str],
    titulo: str,
) -> Optional[str]:
    try:
        fig, ax = plt.subplots(figsize=(5.2, 2.7), dpi=110)
        ax.bar(categorias, valores, color=colores[: len(categorias)])
        ax.set_title(titulo, fontsize=10, fontweight="bold", color="#0f172a")
        ax.set_ylabel("Trabajadores", fontsize=8)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        ax.tick_params(labelsize=8)
        plt.tight_layout()

        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.close()
        plt.savefig(tmp.name, format="png", dpi=110, bbox_inches="tight")
        plt.close(fig)
        return tmp.name
    except Exception as exc:
        logger.error("Error generando gráfica de barras categóricas: %s", exc)
        return None


def _generar_grafica_pastel(
    labels: List[str], valores: List[int], titulo: str
) -> Optional[str]:
    try:
        nonzero = [(lbl, val) for lbl, val in zip(labels, valores) if val > 0]
        if not nonzero:
            return None
        f_labels = [p[0] for p in nonzero]
        f_vals = [p[1] for p in nonzero]
        fig, ax = plt.subplots(figsize=(5.2, 2.7), dpi=110)
        colores = ["#0f766e", "#f59e0b", "#ef4444", "#592c82", "#3b82f6", "#64748b"]
        ax.pie(
            f_vals,
            labels=f_labels,
            colors=colores[: len(f_vals)],
            autopct="%1.0f%%",
            startangle=90,
            textprops={"fontsize": 8},
        )
        ax.set_title(titulo, fontsize=10, fontweight="bold", color="#0f172a")
        plt.tight_layout()

        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.close()
        plt.savefig(tmp.name, format="png", dpi=110, bbox_inches="tight")
        plt.close(fig)
        return tmp.name
    except Exception as exc:
        logger.error("Error generando gráfica de pastel: %s", exc)
        return None


def _generar_grafica_hbc(hbc: Dict[str, int]) -> Optional[str]:
    return _generar_grafica_barras_categorias(
        ["Normal (<10%)", "Alto (10-19%)", "Muy Alto (≥20%)"],
        [hbc["normal"], hbc["alto"], hbc["muyAlto"]],
        ["#10b981", "#f59e0b", "#ef4444"],
        "Distribución %HBC (Hipoacusia Bilateral Combinada)",
    )


# ------------------------------------------------------------------
# Portada y TOC
# ------------------------------------------------------------------

def _render_portada(project: Dict[str, Any], styles) -> List[Any]:
    elements: List[Any] = []

    logo_path = _resolve_sme_logo_path()
    if logo_path:
        elements.append(RLImage(logo_path, width=2.2 * inch, height=0.95 * inch, kind="proportional"))
    else:
        badge = Table(
            [[Paragraph("<b>SOLUCIONES MÉDICO EMPRESARIALES (SME)</b>", ParagraphStyle("SmeHdr", parent=styles["EbookH2"], alignment=1, textColor=colors.white))]],
            colWidths=[6.9 * inch],
        )
        badge.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), SME_TEAL), ("TOPPADDING", (0, 0), (-1, -1), 10), ("BOTTOMPADDING", (0, 0), (-1, -1), 10)]))
        elements.append(badge)

    elements.append(Spacer(1, 0.35 * inch))
    elements.append(Paragraph("Diagn&oacute;stico Situacional", styles["EbookTitle"]))
    elements.append(
        Paragraph(
            _esc(project.get("empresa") or "Proyecto de Unidad Móvil"),
            styles["EbookSubtitle"],
        )
    )
    elements.append(
        Paragraph(
            "<i>Carpeta consolidada imprimible y navegable — Salud Ocupacional y Medicina del Trabajo</i>",
            styles["EbookPlaceholder"],
        )
    )
    elements.append(Spacer(1, 0.25 * inch))

    trabajadores = project.get("trabajadores", []) or []
    fecha_txt = _esc(project.get("fecha") or "N/A")
    if project.get("fechaFin"):
        fecha_txt = f"{fecha_txt} al {_esc(project.get('fechaFin'))}"

    meta_rows = [
        ["Empresa Cliente", _esc(project.get("empresa") or "N/A")],
        ["Razón Social", _esc(project.get("empresaLegal") or project.get("empresa") or "N/A")],
        ["Proyecto / Campaña", _esc(project.get("nombreProyecto") or "Campaña Médica UMM")],
        ["Unidad Móvil Asignada", _esc(project.get("unidadMovil") or "Clínica / Unidad Móvil SME")],
        ["Fecha de Atención", fecha_txt],
        ["Total de Trabajadores", str(len(trabajadores))],
    ]
    meta_table = Table(meta_rows, colWidths=[2.3 * inch, 4.6 * inch])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), SME_BG_SOFT),
                ("FONTNAME", (0, 0), (0, -1), FONT_NAME_BOLD),
                ("FONTNAME", (1, 0), (1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (0, -1), SME_SLATE),
                ("TEXTCOLOR", (1, 0), (1, -1), SME_DARK),
                ("GRID", (0, 0), (-1, -1), 0.5, SME_BORDER),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    elements.append(meta_table)
    elements.append(Spacer(1, 0.25 * inch))

    est_counts = calcular_conteo_estudios(project)
    cov_rows = [
        ["Estudio / Valoración Realizada", "Trabajadores Evaluados"],
        ["Examen Médico Ocupacional", str(est_counts["examenMedico"])],
        ["Audiometría", str(est_counts["audiometria"])],
        ["Espirometría", str(est_counts["espirometria"])],
        ["Electrocardiograma (ECG)", str(est_counts["ecg"])],
        ["Radiografía de Columna", str(est_counts["rxColumna"])],
        ["Radiografía de Tórax", str(est_counts["rxTorax"])],
        ["Campimetría / Agudeza Visual", str(est_counts["campimetria"])],
        ["Laboratorio Clínico", str(est_counts["laboratorio"])],
    ]
    elements.append(Paragraph("<b>Cobertura de Estudios de la Campaña</b>", styles["EbookH2"]))
    elements.append(_crear_tabla_conteos(cov_rows, col_widths=[4.6 * inch, 2.3 * inch]))
    elements.append(Spacer(1, 0.2 * inch))
    elements.append(
        Paragraph(
            "<i>Generado por Sistema Médico Empresarial (SME) — Imprimible tamaño Carta y navegable mediante Índice o Marcadores PDF.</i>",
            styles["EbookSmall"],
        )
    )
    return elements


def _render_toc(
    toc_entries: List[Tuple[str, str, int, bool]],
    final_page_map: Dict[str, int],
    link_rects: List[Tuple[int, Tuple[float, float, float, float], str]],
    styles,
    usable_width: float,
) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("&Iacute;ndice General", styles["EbookH1"]))
    elements.append(
        Paragraph(
            "<i>Haz clic en cualquier apartado o trabajador para saltar directamente a su página.</i>",
            styles["EbookSmall"],
        )
    )
    elements.append(Spacer(1, 0.12 * inch))

    for key, label, indent, bold in toc_entries:
        p_idx = final_page_map.get(key)
        p_disp = str(p_idx + 1) if p_idx is not None else ""
        elements.append(
            _TocLinkRow(
                label=label,
                page_display=p_disp,
                dest_key=key,
                link_rects=link_rects,
                width=usable_width,
                indent=indent,
                bold=bold,
            )
        )
    return elements


# ------------------------------------------------------------------
# Secciones I y II (Diagnóstico Situacional)
# ------------------------------------------------------------------

def _render_resumen_ejecutivo(
    project: Dict[str, Any],
    styles,
    tempfiles: List[str],
) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("I. Resumen Ejecutivo y Demograf&iacute;a", styles["EbookH1"]))
    elements.append(Spacer(1, 0.1 * inch))

    trabajadores = project.get("trabajadores", []) or []
    total = len(trabajadores)
    sin_estudios = sum(1 for w in trabajadores if not _tiene_estudios(w))
    con_estudios = total - sin_estudios
    dist = calcular_distribuciones(project)
    apt = calcular_aptitud_distribucion(project)

    data = [
        ["Indicador Poblacional", "Cantidad"],
        ["Total trabajadores en proyecto", str(total)],
        ["Con al menos 1 estudio clínico", str(con_estudios)],
        ["Sin estudios registrados", str(sin_estudios)],
        ["Sexo Masculino", str(dist["masculino"])],
        ["Sexo Femenino", str(dist["femenino"])],
        ["Edad 18 a 30 años", str(dist["edad18a30"])],
        ["Edad 31 a 45 años", str(dist["edad31a45"])],
        ["Edad 46 años o más", str(dist["edad46mas"])],
        ["Dictamen Apto", str(apt["apto"])],
        ["Apto con restricciones / observaciones", str(apt["conRestricciones"])],
        ["No Apto / Pendiente", str(apt["noApto"] + apt["pendiente"])],
    ]
    elements.append(_crear_tabla_conteos(data, col_widths=[4.6 * inch, 2.3 * inch]))
    elements.append(Spacer(1, 0.15 * inch))

    # Gráfica combinada de Edad y Sexo
    try:
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(6.8, 2.5), dpi=110)
        age_labels = ["18-30", "31-45", "≥46"]
        age_vals = [dist["edad18a30"], dist["edad31a45"], dist["edad46mas"]]
        ax1.bar(age_labels, age_vals, color=["#0f766e", "#592c82", "#0284c7"])
        ax1.set_title("Pirámide de Edad", fontsize=9.5, fontweight="bold")
        ax1.spines["top"].set_visible(False)
        ax1.spines["right"].set_visible(False)
        ax1.tick_params(labelsize=8)

        sex_vals = [dist["masculino"], dist["femenino"]]
        sex_lbls = ["Masculino", "Femenino"]
        if sum(sex_vals) > 0:
            nz = [(l, v, c) for l, v, c in zip(sex_lbls, sex_vals, ["#0f766e", "#592c82"]) if v > 0]
            ax2.pie([x[1] for x in nz], labels=[x[0] for x in nz], colors=[x[2] for x in nz], autopct="%1.0f%%", startangle=90, textprops={"fontsize": 8})
        else:
            ax2.text(0.5, 0.5, "Sin dato", ha="center", va="center", fontsize=8)
            ax2.axis("off")
        ax2.set_title("Distribución por Sexo", fontsize=9.5, fontweight="bold")
        plt.tight_layout()
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.close()
        plt.savefig(tmp.name, format="png", dpi=110, bbox_inches="tight")
        plt.close(fig)
        elements.append(RLImage(tmp.name, width=6.6 * inch, height=2.4 * inch))
        tempfiles.append(tmp.name)
    except Exception as exc:
        logger.warning("Error generando gráfica demográfica: %s", exc)

    return elements


def _render_estadistica_audiometria(
    project: Dict[str, Any],
    styles,
    tempfiles: List[str],
) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.1 Audiometr&iacute;a (%HBC) y LFT", styles["EbookH1"]))
    hbc = calcular_hbc_por_rango(project)
    elements.append(
        _crear_tabla_conteos(
            [
                ["Clasificación %HBC", "Trabajadores"],
                ["Normal (<10%)", str(hbc["normal"])],
                ["Riesgo Alto (10-19.9%)", str(hbc["alto"])],
                ["Riesgo Muy Alto (≥20%)", str(hbc["muyAlto"])],
            ]
        )
    )
    elements.append(Spacer(1, 0.12 * inch))
    grafica_path = _generar_grafica_hbc(hbc)
    if grafica_path:
        elements.append(RLImage(grafica_path, width=5.0 * inch, height=2.6 * inch))
        tempfiles.append(grafica_path)

    elements.append(Spacer(1, 0.12 * inch))
    lft_data = [
        ["% HBC (LFT Art. 514 Fracc. 351)", "% Incapacidad Permanente", "% HBC", "% Incapacidad"],
        ["10%", "10%", "45%", "40%"],
        ["20%", "17%", "55%", "50%"],
        ["30%", "25%", "65%", "60%"],
        ["35%", "30%", "75 a 100%", "70%"],
    ]
    lft_tbl = Table(lft_data, colWidths=[2.3 * inch, 1.5 * inch, 1.5 * inch, 1.6 * inch])
    lft_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), SME_BG_SOFT),
                ("FONTNAME", (0, 0), (-1, 0), FONT_NAME_BOLD),
                ("FONTNAME", (0, 1), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 7.8),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.4, SME_BORDER),
            ]
        )
    )
    elements.append(Paragraph("<b>Tabla de referencia Ley Federal del Trabajo (Sorderas e Hipoacusias)</b>", styles["EbookSmall"]))
    elements.append(lft_tbl)
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(
        _cuadro_recomendaciones(
            "Recomendaciones Médicas — Conservación Auditiva",
            [
                "Riesgo Alto o Muy Alto: Ingresar al Programa de Conservación Auditiva, audiometría de control en 6 meses y reubicación si exposición > 85 dB.",
                "Casos de seguimiento / normalidad: Uso obligatorio y verificado de EPP auditivo, audiometría anual y capacitación en cuidado auditivo.",
            ],
            styles,
        )
    )
    return elements


def _render_estadistica_trauma_acustico(
    project: Dict[str, Any],
    styles,
    tempfiles: List[str],
) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.2 Trauma Ac&uacute;stico por &Aacute;rea", styles["EbookH1"]))
    trauma = calcular_trauma_acustico_por_area(project)
    if not trauma:
        elements.append(Paragraph("<i>Sin casos de trauma ac&uacute;stico detectados en esta campaña.</i>", styles["EbookBody"]))
        return elements

    data = [["Área / Puesto", "Casos"]] + [[t["area"], str(t["conteo"])] for t in trauma]
    elements.append(_crear_tabla_conteos(data))
    elements.append(Spacer(1, 0.12 * inch))
    grafica_path = _generar_grafica_barras(
        [t["area"] for t in trauma],
        [t["conteo"] for t in trauma],
        "Trauma Acústico por Área",
        color="#ef4444",
        horizontal=True,
    )
    if grafica_path:
        elements.append(RLImage(grafica_path, width=5.0 * inch, height=2.6 * inch))
        tempfiles.append(grafica_path)
    return elements


def _render_estadistica_espirometria(
    project: Dict[str, Any],
    styles,
    tempfiles: List[str],
) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.3 Espirometr&iacute;a (Patr&oacute;n) y Tabaquismo", styles["EbookH1"]))
    espiro = calcular_espirometria_distribucion(project)
    data = [["Patrón Espirométrico", "Casos"]] + [[e["patron"], str(e["conteo"])] for e in espiro]
    elements.append(_crear_tabla_conteos(data))
    elements.append(Spacer(1, 0.12 * inch))
    grafica_path = _generar_grafica_pastel(
        [e["patron"][:32] for e in espiro],
        [e["conteo"] for e in espiro],
        "Distribución Patrón Espirométrico",
    )
    if grafica_path:
        elements.append(RLImage(grafica_path, width=5.0 * inch, height=2.6 * inch))
        tempfiles.append(grafica_path)
    elements.append(Spacer(1, 0.12 * inch))
    elements.append(
        _cuadro_recomendaciones(
            "Recomendaciones Médicas — Salud Respiratoria",
            [
                "Casos alterados (restrictivo / obstructivo): Valoración por Neumología / Medicina Interna y espirometría con broncodilatador en 6 meses.",
                "Evitar exposición sin protección a polvos, humos o agentes sensibilizantes; reforzar uso adecuado de EPP respiratorio.",
            ],
            styles,
        )
    )
    return elements


def _render_estadistica_rx_columna(
    project: Dict[str, Any],
    styles,
    tempfiles: List[str],
) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.4 RX Columna (Escoliosis) — NOM-036", styles["EbookH1"]))
    esc = calcular_escoliosis_distribucion(project)
    elements.append(
        _crear_tabla_conteos(
            [
                ["Grado Cobb", "Casos"],
                ["Normal (<5°)", str(esc["normal"])],
                ["Leve (5-9°)", str(esc["leve"])],
                ["Moderada (10-19°)", str(esc["moderada"])],
                ["Grave (≥20°)", str(esc["grave"])],
            ]
        )
    )
    elements.append(Spacer(1, 0.12 * inch))
    grafica_path = _generar_grafica_barras_categorias(
        ["Normal", "Leve", "Moderada", "Grave"],
        [esc["normal"], esc["leve"], esc["moderada"], esc["grave"]],
        ["#10b981", "#f59e0b", "#ef4444", "#7f1d1d"],
        "Distribución Escoliosis (Cobb)",
    )
    if grafica_path:
        elements.append(RLImage(grafica_path, width=5.0 * inch, height=2.6 * inch))
        tempfiles.append(grafica_path)
    elements.append(Spacer(1, 0.12 * inch))
    elements.append(
        _cuadro_recomendaciones(
            "Recomendaciones Médicas — Higiene de Columna (NOM-036-1-STPS-2018)",
            [
                "Riesgo Alto / Muy Alto: Ingresar al programa de Cuidado de Espalda y evaluar restricción de manejo manual de cargas > 5 kg.",
                "Corroborar cada caso con clínica y antecedentes; capacitación anual en técnica segura de levantamiento y ergonomía.",
            ],
            styles,
        )
    )
    return elements


def _render_estadistica_rx_torax(project: Dict[str, Any], styles) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.5 RX T&oacute;rax", styles["EbookH1"]))
    trabajadores = project.get("trabajadores", [])
    normales = alterados = na = 0
    for w in trabajadores:
        imp = ((w.get("rxTorax") or {}).get("impresion") or "").upper().strip()
        if not imp or imp in ("N/A", "NA"):
            na += 1
        elif "NORMAL" in imp or "SIN EVIDENCIA" in imp:
            normales += 1
        else:
            alterados += 1
    elements.append(
        _crear_tabla_conteos(
            [
                ["Resultado Radiografía de Tórax", "Casos"],
                ["Normales", str(normales)],
                ["Con hallazgos / seguimiento", str(alterados)],
                ["N/A o sin estudio", str(na)],
                ["Total", str(len(trabajadores))],
            ]
        )
    )
    elements.append(Spacer(1, 0.12 * inch))
    elements.append(
        _cuadro_recomendaciones(
            "Recomendaciones Médicas — Radiografía de Tórax",
            [
                "Casos con hallazgos: Canalizar a valoración médica específica para descartar patología pleuropulmonar o cardiomegalia.",
                "Seguimiento anual con RX de tórax para personal expuesto a polvos o humos metálicos.",
            ],
            styles,
        )
    )
    return elements


def _render_estadistica_ecg(project: Dict[str, Any], styles) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.6 ECG (Electrocardiograma)", styles["EbookH1"]))
    trabajadores = project.get("trabajadores", [])
    normales = alterados = na = 0
    for w in trabajadores:
        imp = ((w.get("ecg") or {}).get("impresion") or "").upper().strip()
        if not imp or imp in ("N/A", "NA"):
            na += 1
        elif "NORMAL" in imp or "SIN ANORMAL" in imp or "SIN DATOS DE ANORMAL" in imp:
            normales += 1
        else:
            alterados += 1
    elements.append(
        _crear_tabla_conteos(
            [
                ["Resultado Electrocardiograma", "Casos"],
                ["Sin alteraciones aparentes", str(normales)],
                ["Con hallazgos / seguimiento", str(alterados)],
                ["N/A o sin estudio", str(na)],
                ["Total", str(len(trabajadores))],
            ]
        )
    )
    elements.append(Spacer(1, 0.12 * inch))
    elements.append(
        _cuadro_recomendaciones(
            "Recomendaciones Médicas — Salud Cardiovascular",
            [
                "Casos con alteraciones del ritmo o conducción: Referir a Cardiología previo a actividades en alturas o espacios confinados.",
            ],
            styles,
        )
    )
    return elements


def _render_estadistica_campimetria(
    project: Dict[str, Any],
    styles,
    tempfiles: List[str],
) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.7 Campimetr&iacute;a (Agudeza Visual)", styles["EbookH1"]))
    mapa: Dict[str, int] = {}
    for w in project.get("trabajadores", []):
        av = (w.get("campimetria") or {}).get("agudezaVisual") or "N/A"
        av = av.strip() if isinstance(av, str) and av.strip() else "N/A"
        mapa[av] = mapa.get(av, 0) + 1
    elements.append(_crear_tabla_conteos([["Agudeza Visual", "Casos"]] + [[k, str(v)] for k, v in sorted(mapa.items())]))
    elements.append(Spacer(1, 0.12 * inch))
    grafica_path = _generar_grafica_pastel(list(mapa.keys()), list(mapa.values()), "Distribución Agudeza Visual")
    if grafica_path:
        elements.append(RLImage(grafica_path, width=5.0 * inch, height=2.6 * inch))
        tempfiles.append(grafica_path)
    elements.append(Spacer(1, 0.12 * inch))
    elements.append(
        _cuadro_recomendaciones(
            "Recomendaciones Médicas — Salud Visual",
            [
                "Disminución de agudeza visual NO corregida: Gestionar adaptación óptica y verificar uso permanente de lentes en el puesto de trabajo.",
                "Revaloración optométrica en 6 meses (casos no corregidos) o anual (casos corregidos y normales).",
            ],
            styles,
        )
    )
    return elements


def _render_estadistica_laboratorio(
    project: Dict[str, Any],
    styles,
    tempfiles: List[str],
) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.8 Laboratorio", styles["EbookH1"]))
    qs6 = calcular_qs6_niveles(project)

    elements.append(
        _crear_tabla_conteos(
            [
                ["Parámetro Química Sanguínea", "Normal", "Límite / Alto"],
                ["Glucosa (<100 mg/dL normal)", str(qs6["glucosa"]["normal"]), str(qs6["glucosa"]["alta"])],
                ["Colesterol (<200 mg/dL normal)", str(qs6["colesterol"]["normal"]), str(qs6["colesterol"]["limite"] + qs6["colesterol"]["alto"])],
                ["Triglicéridos (<150 mg/dL normal)", str(qs6["trigliceridos"]["normal"]), str(qs6["trigliceridos"]["limite"] + qs6["trigliceridos"]["alto"])],
            ],
            col_widths=[3.7 * inch, 1.6 * inch, 1.6 * inch],
        )
    )
    elements.append(Spacer(1, 0.12 * inch))

    for title, cats, vals, col in [
        ("Glucosa (mg/dL)", ["Normal (<100)", "Alta (≥100)"], [qs6["glucosa"]["normal"], qs6["glucosa"]["alta"]], "#0f766e"),
        ("Colesterol (mg/dL)", ["Normal (<200)", "Límite (200-239)", "Alto (≥240)"], [qs6["colesterol"]["normal"], qs6["colesterol"]["limite"], qs6["colesterol"]["alto"]], "#592c82"),
        ("Triglicéridos (mg/dL)", ["Normal (<150)", "Límite (150-199)", "Alto (≥200)"], [qs6["trigliceridos"]["normal"], qs6["trigliceridos"]["limite"], qs6["trigliceridos"]["alto"]], "#0284c7"),
    ]:
        g_path = _generar_grafica_barras(cats, vals, title, color=col)
        if g_path:
            elements.append(RLImage(g_path, width=4.6 * inch, height=2.1 * inch))
            tempfiles.append(g_path)
            elements.append(Spacer(1, 0.06 * inch))

    elements.append(
        _cuadro_recomendaciones(
            "Recomendaciones Médicas — Perfil Metabólico y Laboratorio",
            [
                "Glucosa o lípidos elevados: Canalizar a Medicina Familiar y Nutrición; monitoreo de glucosa capilar y perfil lipídico a los 3-6 meses.",
                "Fomentar campañas de alimentación saludable e hidratación en planta.",
            ],
            styles,
        )
    )
    return elements


def _render_estadistica_clinica_general(
    project: Dict[str, Any],
    styles,
    tempfiles: List[str],
) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.9 Estado Nutricional, Presi&oacute;n Arterial y Salud Bucal", styles["EbookH1"]))

    imc = calcular_imc_distribucion(project)
    pa = calcular_presion_arterial_distribucion(project)
    bucal = calcular_salud_bucal_distribucion(project)

    elements.append(
        _crear_tabla_conteos(
            [
                ["Índice de Masa Corporal (OMS)", "Trabajadores"],
                ["Bajo peso (<18.5)", str(imc["bajoPeso"])],
                ["Peso Normal (18.5-24.9)", str(imc["normal"])],
                ["Sobrepeso (25.0-29.9)", str(imc["sobrepeso"])],
                ["Obesidad Grado I (30-34.9)", str(imc["obesidadI"])],
                ["Obesidad Grado II (35-39.9)", str(imc["obesidadII"])],
                ["Obesidad Grado III (≥40)", str(imc["obesidadIII"])],
            ]
        )
    )
    elements.append(Spacer(1, 0.1 * inch))

    imc_path = _generar_grafica_barras_categorias(
        ["Bajo", "Normal", "Sobrepeso", "Ob. I", "Ob. II", "Ob. III"],
        [imc["bajoPeso"], imc["normal"], imc["sobrepeso"], imc["obesidadI"], imc["obesidadII"], imc["obesidadIII"]],
        ["#38bdf8", "#10b981", "#f59e0b", "#f97316", "#ef4444", "#7f1d1d"],
        "Distribución Estado Nutricional (IMC)",
    )
    if imc_path:
        elements.append(RLImage(imc_path, width=5.0 * inch, height=2.5 * inch))
        tempfiles.append(imc_path)

    elements.append(Spacer(1, 0.12 * inch))
    elements.append(
        _crear_tabla_conteos(
            [
                ["Presión Arterial y Salud Bucal", "Casos"],
                ["Presión Arterial Normal (<120/80)", str(pa["normal"])],
                ["Presión Normal Alta (120-129/<80)", str(pa["normalAlta"])],
                ["Presión Elevada / Hipertensión (≥130 o ≥80)", str(pa["elevada"])],
                ["Salud Bucal sin alteraciones", str(bucal["normal"])],
                ["Caries / Sarro dental detectado", str(bucal["cariesSarro"])],
            ]
        )
    )
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(
        _cuadro_recomendaciones(
            "Recomendaciones Médicas — Crónico-Degenerativas y Salud Bucal",
            [
                "Sobrepeso / Obesidad: Programa nutricional individualizado, retos de actividad física y adecuación de menús en comedor.",
                "Presión Arterial elevada: Toma seriada durante 3 días consecutivos a la misma hora y valoración médica de confirmación.",
                "Caries / Sarro: Referir a unidad odontológica para limpieza y tratamiento preventivo.",
            ],
            styles,
        )
    )
    return elements


def _render_cierre_situacional(styles) -> List[Any]:
    elements: List[Any] = []
    elements.append(Paragraph("II.10 Conclusiones y Cierre M&eacute;dico Ocupacional", styles["EbookH1"]))
    elements.append(Spacer(1, 0.15 * inch))
    elements.append(
        Paragraph(
            "Agradecemos la confianza depositada en <b>Soluciones Médico Empresariales (SME)</b> para el "
            "cuidado integral de la salud ocupacional de sus colaboradores. En las páginas subsecuentes "
            "se integran los expedientes médicos individuales (dictámenes de aptitud y estudios de soporte) "
            "listos para impresión continua o consulta directa desde el índice.",
            styles["EbookBody"],
        )
    )
    elements.append(Spacer(1, 0.4 * inch))
    sig_tbl = Table(
        [
            [Paragraph("________________________________________", styles["EbookBody"])],
            [Paragraph("<b>Coordinación de Medicina Ocupacional</b>", styles["EbookBody"])],
            [Paragraph("Soluciones Médico Empresariales · Salud Responsable", styles["EbookSmall"])],
        ],
        colWidths=[4.2 * inch],
    )
    sig_tbl.setStyle(TableStyle([("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    elements.append(sig_tbl)
    return elements


# ------------------------------------------------------------------
# III. Sección por trabajador + recolección de PDFs nativos para intercalar
# ------------------------------------------------------------------

def _render_seccion_trabajador(
    trabajador: Dict[str, Any],
    styles,
    tempfiles: List[str],
    image_fetcher_instance: Optional[Any] = None,
    fetched_cache: Optional[Dict[str, Optional[bytes]]] = None,
    indice: int = 1,
) -> List[Any]:
    elements: List[Any] = []
    folio = trabajador.get("folio", "N/A")
    nombre = trabajador.get("nombre", "Sin nombre")
    edad = trabajador.get("edad")
    edad_txt = f"{edad} años" if edad else ((trabajador.get("laboratorio") or {}).get("edad") or "N/A")
    ex_med = trabajador.get("examenMedico") or {}

    # Banner encabezado del expediente del trabajador
    hdr_tbl = Table(
        [
            [Paragraph(f"<b>III.{indice} &nbsp; {_esc(nombre)}</b>", ParagraphStyle("WT", parent=styles["EbookH1"], textColor=colors.white, spaceAfter=2, spaceBefore=0))],
            [
                Paragraph(
                    f"<b>Folio:</b> {_esc(folio)} &nbsp;|&nbsp; "
                    f"<b>Sexo:</b> {_esc(trabajador.get('sexo') or 'N/A')} &nbsp;|&nbsp; "
                    f"<b>Edad:</b> {_esc(edad_txt)} &nbsp;|&nbsp; "
                    f"<b>Área/Puesto:</b> {_esc(trabajador.get('area') or 'N/A')} &nbsp;|&nbsp; "
                    f"<b>Aptitud:</b> {_esc(ex_med.get('aptitud') or 'Pendiente')}",
                    ParagraphStyle("WM", parent=styles["EbookSmall"], textColor=colors.HexColor("#e2e8f0")),
                )
            ],
        ],
        colWidths=[6.9 * inch],
    )
    hdr_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), SME_DARK),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    elements.append(hdr_tbl)
    elements.append(Spacer(1, 0.14 * inch))

    tiene_algun_estudio = False

    # 1. AUDIOMETRÍA
    audio = trabajador.get("audiometria") or {}
    if audio and _dict_has_value(audio):
        tiene_algun_estudio = True
        elements.extend(_render_audiometria(audio, styles))
        img_url = audio.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(img_url, "Audiograma original", image_fetcher_instance, tempfiles, styles, fetched_cache)
            )

    # 2. ESPIROMETRÍA
    espiro = trabajador.get("espirometria") or {}
    if espiro and _dict_has_value(espiro):
        tiene_algun_estudio = True
        elements.extend(_render_espirometria(espiro, styles))
        img_url = espiro.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(img_url, "Curva flujo-volumen", image_fetcher_instance, tempfiles, styles, fetched_cache)
            )

    # 3. RX COLUMNA
    rx_col = trabajador.get("rxColumna") or {}
    if rx_col and _dict_has_value(rx_col):
        tiene_algun_estudio = True
        elements.extend(_render_rx_columna(rx_col, styles))
        for sub_idx, key in enumerate(["fileUrlAP", "fileUrlLateral"], 1):
            img_url = rx_col.get(key)
            if img_url and image_fetcher_instance is not None:
                label = "RX Columna AP" if sub_idx == 1 else "RX Columna Lateral"
                elements.extend(
                    _render_imagen_estudio(img_url, label, image_fetcher_instance, tempfiles, styles, fetched_cache)
                )

    # 4. RX TÓRAX
    rx_torax = trabajador.get("rxTorax") or {}
    if rx_torax and _dict_has_value(rx_torax):
        tiene_algun_estudio = True
        elements.extend(_render_rx_torax(rx_torax, styles))
        img_url = rx_torax.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(img_url, "RX Tórax PA", image_fetcher_instance, tempfiles, styles, fetched_cache)
            )

    # 5. ECG
    ecg = trabajador.get("ecg") or {}
    if ecg and _dict_has_value(ecg):
        tiene_algun_estudio = True
        elements.extend(_render_ecg(ecg, styles))
        img_url = ecg.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(img_url, "Trazo ECG", image_fetcher_instance, tempfiles, styles, fetched_cache)
            )

    # 6. LABORATORIO
    lab = trabajador.get("laboratorio") or {}
    if lab and _dict_has_value(lab):
        tiene_algun_estudio = True
        elements.extend(_render_laboratorio(lab, styles))
        img_url = lab.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(img_url, "Resultados de laboratorio", image_fetcher_instance, tempfiles, styles, fetched_cache)
            )

    # 7. CAMPIMETRÍA
    campi = trabajador.get("campimetria") or {}
    if campi and _dict_has_value(campi):
        tiene_algun_estudio = True
        elements.extend(_render_campimetria(campi, styles))

    # 8. EXAMEN MÉDICO
    if ex_med and _dict_has_value(ex_med):
        tiene_algun_estudio = True
        elements.extend(_render_examen_medico(ex_med, styles))

    if not tiene_algun_estudio:
        elements.append(
            Paragraph("<i>Sin estudios realizados para este trabajador.</i>", styles["EbookPlaceholder"])
        )

    return elements


def _render_audiometria(audio: Dict[str, Any], styles) -> List[Any]:
    hbc_val = audio.get("hbc", "N/A")
    if hbc_val is not None and hbc_val != "N/A":
        try:
            hbc_val = f"{float(hbc_val):.2f}%"
        except (TypeError, ValueError):
            pass
    return [
        Paragraph("Audiometría", styles["EbookH2"]),
        Paragraph(
            f"<b>DX:</b> {_esc(audio.get('dx', 'N/A'))} &nbsp;|&nbsp; "
            f"<b>OD:</b> {_esc(audio.get('oidoDerecho', 'N/A'))} &nbsp;|&nbsp; "
            f"<b>OI:</b> {_esc(audio.get('oidoIzquierdo', 'N/A'))} &nbsp;|&nbsp; "
            f"<b>%HBC:</b> {_esc(hbc_val)}",
            styles["EbookBody"],
        ),
    ]


def _render_espirometria(espiro: Dict[str, Any], styles) -> List[Any]:
    return [
        Paragraph("Espirometría", styles["EbookH2"]),
        Paragraph(
            f"<b>Patrón:</b> {_esc(espiro.get('patron', 'N/A'))} &nbsp;|&nbsp; "
            f"<b>FVC:</b> {_esc(espiro.get('fvc', 'N/A'))} &nbsp;|&nbsp; "
            f"<b>Tabaquismo:</b> {_esc(espiro.get('tabaquismo', 'N/A'))}",
            styles["EbookBody"],
        ),
    ]


def _render_rx_columna(rx_col: Dict[str, Any], styles) -> List[Any]:
    elements: List[Any] = [
        Paragraph("RX Columna", styles["EbookH2"]),
        Paragraph(
            f"<b>Escoliosis:</b> {_esc(rx_col.get('escoliosis', 'N/A'))}° &nbsp;|&nbsp; "
            f"<b>Lordosis:</b> {_esc(rx_col.get('lordosis', 'N/A'))}° &nbsp;|&nbsp; "
            f"<b>Báscula:</b> {_esc(rx_col.get('basculacion', 'N/A'))} cm",
            styles["EbookBody"],
        ),
    ]
    if rx_col.get("impresion"):
        elements.append(Paragraph(f"<b>Impresión:</b> {_esc(rx_col.get('impresion'))}", styles["EbookBody"]))
    return elements


def _render_rx_torax(rx_torax: Dict[str, Any], styles) -> List[Any]:
    return [
        Paragraph("RX Tórax", styles["EbookH2"]),
        Paragraph(f"<b>Impresión:</b> {_esc(rx_torax.get('impresion', 'N/A'))}", styles["EbookBody"]),
    ]


def _render_ecg(ecg: Dict[str, Any], styles) -> List[Any]:
    return [
        Paragraph("ECG", styles["EbookH2"]),
        Paragraph(f"<b>Impresión:</b> {_esc(ecg.get('impresion', 'N/A'))}", styles["EbookBody"]),
    ]


def _render_laboratorio(lab: Dict[str, Any], styles) -> List[Any]:
    elements: List[Any] = [Paragraph("Laboratorio", styles["EbookH2"])]
    bh = lab.get("bh") or {}
    qs6 = lab.get("qs6") or {}
    ego = lab.get("ego") or {}
    toxico = lab.get("toxico") or {}

    if bh and _dict_has_value(bh):
        elements.append(
            Paragraph(
                f"<b>BH:</b> Hb={_esc(bh.get('hb', 'N/A'))}, LEU={_esc(bh.get('leu', 'N/A'))}, "
                f"PLA={_esc(bh.get('pla', 'N/A'))}, CHb={_esc(bh.get('chgm', bh.get('mchb', 'N/A')))}",
                styles["EbookBody"],
            )
        )
    if qs6 and _dict_has_value(qs6):
        elements.append(
            Paragraph(
                f"<b>QS6:</b> GLUC={_esc(qs6.get('gluc', 'N/A'))}, BUN={_esc(qs6.get('bun', 'N/A'))}, "
                f"COL={_esc(qs6.get('col', 'N/A'))}, TRIG={_esc(qs6.get('trig', 'N/A'))}",
                styles["EbookBody"],
            )
        )
    if toxico and _dict_has_value(toxico):
        elements.append(
            Paragraph(
                f"<b>Tóxico:</b> ANFETA={_esc(toxico.get('anfeta', 'N/A'))}, "
                f"COCA={_esc(toxico.get('coca', 'N/A'))}, MARIHUA={_esc(toxico.get('marihua', 'N/A'))}",
                styles["EbookBody"],
            )
        )
    if ego and _dict_has_value(ego):
        elements.append(
            Paragraph(
                f"<b>EGO:</b> {_esc(ego.get('descripcion', ego.get('resultado', 'N/A')))}",
                styles["EbookBody"],
            )
        )
    return elements


def _render_campimetria(campi: Dict[str, Any], styles) -> List[Any]:
    return [
        Paragraph("Campimetría", styles["EbookH2"]),
        Paragraph(
            f"<b>Agudeza Visual:</b> {_esc(campi.get('agudezaVisual', 'N/A'))} &nbsp;|&nbsp; "
            f"<b>Campos:</b> {_esc(campi.get('camposVisuales', 'N/A'))} &nbsp;|&nbsp; "
            f"<b>Color:</b> {_esc(campi.get('discriminacionColor', 'N/A'))}",
            styles["EbookBody"],
        ),
    ]


def _render_examen_medico(examen: Dict[str, Any], styles) -> List[Any]:
    elements: List[Any] = [
        Paragraph("Examen Médico", styles["EbookH2"]),
        Paragraph(
            f"<b>Peso:</b> {_esc(examen.get('peso', 'N/A'))} kg &nbsp;|&nbsp; "
            f"<b>Talla:</b> {_esc(examen.get('talla', 'N/A'))} m &nbsp;|&nbsp; "
            f"<b>IMC:</b> {_esc(examen.get('imc', 'N/A'))} &nbsp;|&nbsp; "
            f"<b>TA:</b> {_esc(examen.get('presionArterial', 'N/A'))}",
            styles["EbookBody"],
        ),
    ]
    if examen.get("diagnostico"):
        elements.append(Paragraph(f"<b>Diagnóstico:</b> {_esc(examen.get('diagnostico'))}", styles["EbookBody"]))
    if examen.get("recomendaciones"):
        elements.append(Paragraph(f"<b>Recomendaciones:</b> {_esc(examen.get('recomendaciones'))}", styles["EbookSmall"]))
    return elements


def _fetch_cached(
    file_url: str,
    image_fetcher_instance: Any,
    cache: Optional[Dict[str, Optional[bytes]]] = None,
) -> Optional[bytes]:
    if not file_url or image_fetcher_instance is None:
        return None
    if cache is not None and file_url in cache:
        return cache[file_url]
    fetch_fn = getattr(image_fetcher_instance, "fetch", None) or getattr(
        image_fetcher_instance, "fetch_image", None
    )
    if not fetch_fn:
        return None
    try:
        raw = fetch_fn(file_url)
    except Exception as exc:
        logger.warning("Error descargando %s: %s", file_url, exc)
        raw = None
    if cache is not None:
        cache[file_url] = raw
    return raw


def _render_imagen_estudio(
    file_url: str,
    caption: str,
    image_fetcher_instance: Any,
    tempfiles: List[str],
    styles,
    fetched_cache: Optional[Dict[str, Optional[bytes]]] = None,
) -> List[Any]:
    elements: List[Any] = []
    if image_fetcher_instance is None or not file_url:
        return elements

    compress_fn = getattr(image_fetcher_instance, "compress", None) or getattr(
        image_fetcher_instance, "compress_image", None
    )
    is_pdf_fn = getattr(image_fetcher_instance, "is_pdf", None)
    if not (compress_fn and is_pdf_fn):
        return elements

    try:
        raw = _fetch_cached(file_url, image_fetcher_instance, fetched_cache)
        if not raw:
            return elements

        # Los PDFs nativos se intercalan en el capítulo de este trabajador con pypdf;
        # aquí solo confirmamos que están anexos en este capítulo.
        if is_pdf_fn(raw):
            elements.append(
                Paragraph(
                    f"<i>{_esc(caption)}: Documento PDF oficial anexo a continuación en este expediente.</i>",
                    styles["EbookSmall"],
                )
            )
            return elements

        compressed = compress_fn(raw)
        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.write(compressed)
        tmp.close()
        elements.append(Spacer(1, 0.08 * inch))
        elements.append(Paragraph(f"<i>{_esc(caption)}:</i>", styles["EbookSmall"]))
        elements.append(RLImage(tmp.name, width=5.6 * inch, height=3.3 * inch, kind="proportional"))
        elements.append(Spacer(1, 0.08 * inch))
        tempfiles.append(tmp.name)
    except Exception as exc:
        logger.warning("_render_imagen_estudio error %s: %s", file_url, exc)
    return elements


# ------------------------------------------------------------------
# Footer / Encabezado por página
# ------------------------------------------------------------------

def _footer_portada(canvas, doc):
    canvas.saveState()
    canvas.restoreState()


def _footer_normal(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(SME_BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(0.7 * inch, 0.6 * inch, letter[0] - 0.7 * inch, 0.6 * inch)
    canvas.setFont(FONT_NAME, 7.8)
    canvas.setFillColor(SME_SLATE)
    canvas.drawString(0.7 * inch, 0.43 * inch, "Soluciones Médico Empresariales — Diagnóstico Situacional y Expedientes UMM")
    canvas.drawRightString(letter[0] - 0.7 * inch, 0.43 * inch, f"Página {doc.page}")
    canvas.restoreState()


# ------------------------------------------------------------------
# Utilidades de presencia de estudios
# ------------------------------------------------------------------

def _v_has_value(v: Any) -> bool:
    if v is None:
        return False
    if isinstance(v, str) and v.strip().upper() in ("", "N/A", "NA"):
        return False
    return True


def _dict_has_value(d: Optional[Dict[str, Any]]) -> bool:
    if not d or not isinstance(d, dict):
        return False
    for k, v in d.items():
        if k in ("fileUrl", "fileUrlAP", "fileUrlLateral", "validatedPdfUrl", "dictamenPdfUrl"):
            continue
        if isinstance(v, dict):
            if _dict_has_value(v):
                return True
        elif _v_has_value(v):
            return True
    return False


def _tiene_estudios(trabajador: Dict[str, Any]) -> bool:
    for key in (
        "audiometria",
        "espirometria",
        "rxColumna",
        "rxTorax",
        "ecg",
        "laboratorio",
        "campimetria",
        "examenMedico",
    ):
        if _dict_has_value(trabajador.get(key) or {}):
            return True
    return False


# ------------------------------------------------------------------
# Construcción Two-Pass + Intercalado de PDFs por Trabajador
# ------------------------------------------------------------------

def _collect_worker_native_pdfs(
    trabajador: Dict[str, Any],
    image_fetcher_instance: Any,
    fetched_cache: Dict[str, Optional[bytes]],
) -> List[Tuple[str, bytes]]:
    """
    Devuelve la lista ordenada de [(titulo_doc, pdf_bytes)] que pertenecen
    exclusivamente a este trabajador (Dictamen primero, luego reportes de estudios).
    """
    if image_fetcher_instance is None:
        return []

    is_pdf_fn = getattr(image_fetcher_instance, "is_pdf", None) or (
        lambda data: isinstance(data, (bytes, bytearray)) and bytes(data).lstrip()[:5].startswith(b"%PDF")
    )

    docs: List[Tuple[str, str]] = []
    seen_urls: set[str] = set()

    def _push(title: str, url: Optional[str]) -> None:
        if not url or not isinstance(url, str):
            return
        clean = url.strip()
        if not clean or clean in seen_urls:
            return
        seen_urls.add(clean)
        docs.append((title, clean))

    for d in trabajador.get("documentosPdf") or []:
        if isinstance(d, dict):
            _push(str(d.get("titulo") or "Documento"), d.get("url"))

    # También revisar URLs directas en estudios por si el caller armó snapshot manual.
    ex = trabajador.get("examenMedico") or {}
    _push("Dictamen Médico de Aptitud", ex.get("dictamenPdfUrl"))
    _push("Examen Médico Validado", ex.get("validatedPdfUrl") or ex.get("fileUrl"))
    for key, label in (
        ("audiometria", "Audiometría"),
        ("espirometria", "Espirometría"),
        ("rxColumna", "Radiografía de Columna"),
        ("rxTorax", "Radiografía de Tórax"),
        ("ecg", "Electrocardiograma"),
        ("campimetria", "Campimetría"),
        ("laboratorio", "Laboratorio Clínico"),
    ):
        st = trabajador.get(key) or {}
        _push(f"{label} (Validado)", st.get("validatedPdfUrl"))
        _push(f"{label} (Reporte)", st.get("fileUrl"))

    out: List[Tuple[str, bytes]] = []
    for title, url in docs:
        raw = _fetch_cached(url, image_fetcher_instance, fetched_cache)
        if not raw or not is_pdf_fn(raw):
            continue
        try:
            reader = PdfReader(BytesIO(raw))
            if len(reader.pages) > 0:
                out.append((title, raw))
        except Exception as exc:
            logger.warning("PDF nativo inválido (%s): %s", title, exc)
    return out


def _build_reportlab_story(
    project: Dict[str, Any],
    trabajadores_ordenados: List[Dict[str, Any]],
    toc_entries: List[Tuple[str, str, int, bool]],
    final_page_map: Dict[str, int],
    marker_pages: Dict[str, int],
    link_rects: List[Tuple[int, Tuple[float, float, float, float], str]],
    styles,
    tempfiles: List[str],
    image_fetcher_instance: Any,
    fetched_cache: Dict[str, Optional[bytes]],
    usable_width: float,
) -> List[Any]:
    story: List[Any] = []

    story.append(_MarkerFlowable("portada", marker_pages))
    story.extend(_render_portada(project, styles))
    story.append(PageBreak())

    story.append(_MarkerFlowable("toc", marker_pages))
    story.extend(_render_toc(toc_entries, final_page_map, link_rects, styles, usable_width))
    story.append(PageBreak())

    story.append(_MarkerFlowable("resumen", marker_pages))
    story.extend(_render_resumen_ejecutivo(project, styles, tempfiles))
    story.append(PageBreak())

    sections = [
        ("ii_audiometria", lambda: _render_estadistica_audiometria(project, styles, tempfiles)),
        ("ii_trauma_acustico", lambda: _render_estadistica_trauma_acustico(project, styles, tempfiles)),
        ("ii_espirometria", lambda: _render_estadistica_espirometria(project, styles, tempfiles)),
        ("ii_rx_columna", lambda: _render_estadistica_rx_columna(project, styles, tempfiles)),
        ("ii_rx_torax", lambda: _render_estadistica_rx_torax(project, styles)),
        ("ii_ecg", lambda: _render_estadistica_ecg(project, styles)),
        ("ii_campimetria", lambda: _render_estadistica_campimetria(project, styles, tempfiles)),
        ("ii_laboratorio", lambda: _render_estadistica_laboratorio(project, styles, tempfiles)),
        ("ii_clinica_general", lambda: _render_estadistica_clinica_general(project, styles, tempfiles)),
        ("ii_cierre", lambda: _render_cierre_situacional(styles)),
    ]

    for key, builder in sections:
        story.append(_MarkerFlowable(key, marker_pages))
        story.extend(builder())
        story.append(PageBreak())

    story.append(_MarkerFlowable("iii_expedientes", marker_pages))
    story.append(Paragraph("III. Reportes Individuales", styles["EbookH1"]))

    for idx, trabajador in enumerate(trabajadores_ordenados, 1):
        if idx > 1:
            story.append(PageBreak())
        w_key = f"trabajador_{idx}"
        story.append(_MarkerFlowable(w_key, marker_pages))
        story.extend(
            _render_seccion_trabajador(
                trabajador,
                styles,
                tempfiles,
                image_fetcher_instance=image_fetcher_instance,
                fetched_cache=fetched_cache,
                indice=idx,
            )
        )
        story.append(_MarkerFlowable(f"trabajador_end_{idx}", marker_pages))

    return story


def _build_pdf_bytes(
    story: List[Any],
    empresa: str,
) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=letter,
        topMargin=0.75 * inch,
        bottomMargin=0.8 * inch,
        leftMargin=0.7 * inch,
        rightMargin=0.7 * inch,
        title=f"Diagnóstico Situacional y Ebook — {empresa}",
        author="Soluciones Medico Empresariales",
    )
    doc.build(story, onFirstPage=_footer_portada, onLaterPages=_footer_normal)
    return buf.getvalue()


def _compute_final_page_mapping(
    num_rl_pages: int,
    trabajadores_ordenados: List[Dict[str, Any]],
    marker_pages: Dict[str, int],
    worker_native_pdfs: Dict[int, List[Tuple[str, bytes]]],
) -> Tuple[Dict[int, int], Dict[int, List[Tuple[str, int]]]]:
    """
    Calcula en qué página 0-based FINAL cae cada página ReportLab al intercalar
    los PDFs nativos de cada trabajador inmediatamente después de su última
    página ReportLab (`trabajador_end_{idx}`).
    """
    insert_after_page: Dict[int, List[Tuple[int, str, bytes]]] = {}
    for idx in range(1, len(trabajadores_ordenados) + 1):
        pdfs = worker_native_pdfs.get(idx) or []
        if not pdfs:
            continue
        end_pg = marker_pages.get(f"trabajador_end_{idx}")
        if end_pg is None:
            continue
        bucket = insert_after_page.setdefault(end_pg, [])
        for title, pbytes in pdfs:
            bucket.append((idx, title, pbytes))

    rl_to_final: Dict[int, int] = {}
    worker_doc_final_pages: Dict[int, List[Tuple[str, int]]] = {}
    cursor = 0
    for rl_idx in range(num_rl_pages):
        rl_to_final[rl_idx] = cursor
        cursor += 1
        for idx, title, pbytes in insert_after_page.get(rl_idx, []):
            try:
                cnt = len(PdfReader(BytesIO(pbytes)).pages)
            except Exception:
                cnt = 0
            if cnt > 0:
                worker_doc_final_pages.setdefault(idx, []).append((title, cursor))
                cursor += cnt

    return rl_to_final, worker_doc_final_pages


def generar_ebook(
    project: Dict[str, Any],
    output_path: str,
    image_fetcher_instance: Optional[Any] = None,
) -> str:
    """
    Genera el PDF Ebook completo (Diagnóstico Situacional + Expedientes
    intercalados + Índice clicable + Bookmarks jerárquicos exactos).
    """
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    trabajadores = project.get("trabajadores", []) or []
    if len(trabajadores) > MAX_TRABAJADORES:
        logger.warning(
            "generar_ebook: %d trabajadores excede el máximo de %d",
            len(trabajadores),
            MAX_TRABAJADORES,
        )

    trabajadores_ordenados = sorted(
        trabajadores,
        key=lambda w: (_apellido_de(w), w.get("folio", "")),
    )

    fetched_cache: Dict[str, Optional[bytes]] = {}
    worker_native_pdfs: Dict[int, List[Tuple[str, bytes]]] = {}
    for idx, t in enumerate(trabajadores_ordenados, 1):
        worker_native_pdfs[idx] = _collect_worker_native_pdfs(
            t, image_fetcher_instance, fetched_cache
        )

    toc_entries: List[Tuple[str, str, int, bool]] = [
        ("resumen", "I. Resumen Ejecutivo y Demografía", 0, True),
        ("ii_audiometria", "II.1 Audiometría (%HBC) y LFT Art. 514", 1, False),
        ("ii_trauma_acustico", "II.2 Trauma Acústico por Área", 1, False),
        ("ii_espirometria", "II.3 Espirometría y Tabaquismo", 1, False),
        ("ii_rx_columna", "II.4 RX Columna (Escoliosis) — NOM-036", 1, False),
        ("ii_rx_torax", "II.5 RX Tórax", 1, False),
        ("ii_ecg", "II.6 Electrocardiograma (ECG)", 1, False),
        ("ii_campimetria", "II.7 Campimetría y Agudeza Visual", 1, False),
        ("ii_laboratorio", "II.8 Laboratorio Clínico", 1, False),
        ("ii_clinica_general", "II.9 Estado Nutricional, Presión Arterial y Salud Bucal", 1, False),
        ("ii_cierre", "II.10 Conclusiones y Cierre Médico", 1, False),
        ("iii_expedientes", f"III. Expedientes Individuales ({len(trabajadores_ordenados)} trabajadores)", 0, True),
    ]
    for idx, t in enumerate(trabajadores_ordenados, 1):
        folio = t.get("folio") or ""
        lbl = f"III.{idx} {t.get('nombre', 'Sin nombre')}" + (f" ({folio})" if folio else "")
        toc_entries.append((f"trabajador_{idx}", lbl, 1, False))

    styles = _build_styles()
    usable_width = letter[0] - 1.4 * inch
    tempfiles_p1: List[str] = []
    marker_pages_p1: Dict[str, int] = {}
    link_rects_p1: List[Tuple[int, Tuple[float, float, float, float], str]] = []

    empresa = str(project.get("empresa") or "Proyecto")

    # ── Pass 1: medir páginas ReportLab sin números finales aún ─────────────
    story_p1 = _build_reportlab_story(
        project=project,
        trabajadores_ordenados=trabajadores_ordenados,
        toc_entries=toc_entries,
        final_page_map={},
        marker_pages=marker_pages_p1,
        link_rects=link_rects_p1,
        styles=styles,
        tempfiles=tempfiles_p1,
        image_fetcher_instance=image_fetcher_instance,
        fetched_cache=fetched_cache,
        usable_width=usable_width,
    )
    pdf_p1 = _build_pdf_bytes(story_p1, empresa)
    for tmp in tempfiles_p1:
        try:
            os.unlink(tmp)
        except OSError:
            pass

    num_rl_p1 = len(PdfReader(BytesIO(pdf_p1)).pages)
    rl_to_final_p1, _ = _compute_final_page_mapping(
        num_rl_p1, trabajadores_ordenados, marker_pages_p1, worker_native_pdfs
    )
    final_page_map = {
        k: rl_to_final_p1.get(rl_pg, rl_pg)
        for k, rl_pg in marker_pages_p1.items()
    }

    # ── Pass 2: render final con números de página reales y rects clicables ─
    tempfiles_p2: List[str] = []
    marker_pages_p2: Dict[str, int] = {}
    link_rects_p2: List[Tuple[int, Tuple[float, float, float, float], str]] = []

    story_p2 = _build_reportlab_story(
        project=project,
        trabajadores_ordenados=trabajadores_ordenados,
        toc_entries=toc_entries,
        final_page_map=final_page_map,
        marker_pages=marker_pages_p2,
        link_rects=link_rects_p2,
        styles=styles,
        tempfiles=tempfiles_p2,
        image_fetcher_instance=image_fetcher_instance,
        fetched_cache=fetched_cache,
        usable_width=usable_width,
    )
    pdf_p2 = _build_pdf_bytes(story_p2, empresa)
    for tmp in tempfiles_p2:
        try:
            os.unlink(tmp)
        except OSError:
            pass

    # ── Pass 3: ensamblado pypdf intercalando PDFs por trabajador + bookmarks ─
    base_reader = PdfReader(BytesIO(pdf_p2))
    num_rl_p2 = len(base_reader.pages)
    rl_to_final, worker_doc_final_pages = _compute_final_page_mapping(
        num_rl_p2, trabajadores_ordenados, marker_pages_p2, worker_native_pdfs
    )
    exact_final_map = {
        k: rl_to_final.get(rl_pg, rl_pg)
        for k, rl_pg in marker_pages_p2.items()
    }

    insert_after_page: Dict[int, List[bytes]] = {}
    for idx in range(1, len(trabajadores_ordenados) + 1):
        pdfs = worker_native_pdfs.get(idx) or []
        if not pdfs:
            continue
        end_pg = marker_pages_p2.get(f"trabajador_end_{idx}")
        if end_pg is None:
            continue
        bucket = insert_after_page.setdefault(end_pg, [])
        for _title, pbytes in pdfs:
            bucket.append(pbytes)

    writer = PdfWriter()
    for rl_idx, page in enumerate(base_reader.pages):
        writer.add_page(page)
        for pbytes in insert_after_page.get(rl_idx, []):
            try:
                sub_reader = PdfReader(BytesIO(pbytes))
                for sub_pg in sub_reader.pages:
                    writer.add_page(sub_pg)
            except Exception as exc:
                logger.warning("Error intercalando página PDF nativa: %s", exc)

    # Registrar hipervínculos internos en cada entrada del Índice
    for toc_rl_pg, rect, dest_key in link_rects_p2:
        src_final = rl_to_final.get(toc_rl_pg)
        dst_final = exact_final_map.get(dest_key)
        if src_final is not None and dst_final is not None:
            try:
                writer.add_annotation(
                    page_number=src_final,
                    annotation=Link(rect=rect, border=[0, 0, 0], target_page_index=dst_final),
                )
            except Exception as exc:
                logger.debug("No se pudo agregar Link TOC %s: %s", dest_key, exc)

    # Registrar Bookmarks / Outlines jerárquicos con página final exacta
    try:
        writer.add_outline_item("Portada", exact_final_map.get("portada", 0))
        writer.add_outline_item("Índice General", exact_final_map.get("toc", 1))
        writer.add_outline_item(
            "I. Resumen Ejecutivo y Demografía", exact_final_map.get("resumen", 0)
        )
        diag_parent = writer.add_outline_item(
            "II. Diagnóstico Situacional",
            exact_final_map.get("ii_audiometria", 0),
        )
        for key, label, _ind, _b in toc_entries:
            if key.startswith("ii_"):
                writer.add_outline_item(
                    label, exact_final_map.get(key, 0), parent=diag_parent
                )

        exp_parent = writer.add_outline_item(
            f"III. Expedientes Individuales ({len(trabajadores_ordenados)})",
            exact_final_map.get("iii_expedientes", 0),
        )
        for idx, t in enumerate(trabajadores_ordenados, 1):
            w_pg = exact_final_map.get(f"trabajador_{idx}", 0)
            w_title = f"III.{idx} {t.get('nombre', 'Sin nombre')}"
            w_node = writer.add_outline_item(w_title, w_pg, parent=exp_parent)
            for doc_title, doc_pg in worker_doc_final_pages.get(idx, []):
                writer.add_outline_item(doc_title, doc_pg, parent=w_node)
    except Exception as exc:
        logger.warning("No se pudieron registrar outlines jerárquicos: %s", exc)

    with open(output_path, "wb") as fh:
        writer.write(fh)

    logger.info("EBOOK generado: %s (%d páginas)", output_path, len(writer.pages))
    return output_path
