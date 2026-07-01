"""
IMPL-20260630-05: Generador del PDF Ebook (Fase 3: II.2-II.8 estadísticas
agregadas con mini-gráficas matplotlib).

SPEC: context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md
Handoff Fase 1: context/interconsultas/HANDOFF_IMPL-20260701-01_SOFIA_EBOOK-PDF-FASE-1.md
Handoff Fase 2: context/interconsultas/HANDOFF_IMPL-20260701-02_SOFIA_EBOOK-PDF-FASE-2.md
Handoff Fase 3: context/interconsultas/HANDOFF_IMPL-20260701-03_SOFIA_EBOOK-PDF-FASE-3.md

Decisiones arquitectónicas aplicadas (ver SPEC sección 3):
  1.  Stack: reportlab (Python) + pypdf + matplotlib Agg.
  2.  Tamaño Carta (8.5x11in = letter).
  3.  Max 300 trabajadores (validación en runtime, no hardcoded).
  4.  Mini-gráficas matplotlib para estadísticas (Agg backend).
  5.  Imágenes embebidas inline por sección de trabajador.
  6.  Un solo PDF autocontenido.
  7.  PIL thumbnail max 1500px + JPEG 80% si >500KB.
  8.  PDFs de estudios se mergean con pypdf (Fase 2: las imágenes JPG/PNG
      de cada EventTest se embeben inline; PDFs nativos se mergean al final).
  9.  Sin streaming: se espera el PDF completo.
  10. Sin historial en el ebook (solo proyecto actual).
  11. Sin traducción server-side.
  12. Orden alfabético por apellido, luego nombre.
  13. Sin estudios -> placeholder.
  14. Logo placeholder (texto hasta feedback Leticia).
  15. Unicode (ñ, á, é) via TTF DejaVu registrado.

Alcance de Fase 3 (esta fase):
  - 7 subsecciones II.2-II.8 con mini-gráficas matplotlib:
      II.2 Trauma acústico por área (barras horizontales).
      II.3 Espirometría distribución patrón (pastel).
      II.4 RX Columna escoliosis (barras por severidad).
      II.5 RX Tórax (tabla conteos).
      II.6 ECG (tabla conteos).
      II.7 Campimetría agudeza visual (pastel).
      II.8 Laboratorio (3 mini-barras: glucosa/colesterol/triglicéridos).
  - Helpers genéricos: _generar_grafica_barras, _generar_grafica_barras_categorias,
    _generar_grafica_pastel, _crear_tabla_conteos.
  - Reutiliza funciones de conteos.py: calcular_trauma_acustico_por_area,
    calcular_espirometria_distribucion, calcular_escoliosis_distribucion,
    calcular_qs6_niveles.
  - II.5 RX Tórax e II.6 ECG son solo tablas (sin gráfica) según SPEC.
  - II.7 campimetría se calcula inline (no hay función en conteos.py).
  - Cada subsección tiene bookmark y PageBreak entre ellas.

Alcance de Fase 2 (preservado):
  - 8 funciones _render_X() para las secciones clínicas.
  - Render condicional: solo aparece la sección si tiene datos.
  - Loop por TODOS los trabajadores con PageBreak entre ellos (no antes del primero).
  - Helper _render_imagen_estudio() con descarga + compresión para imágenes
    (PDFs nativos se mergean al final con pypdf).
  - Si image_fetcher_instance is None: skip imágenes silenciosamente.
  - Si falla descarga: skip + log warning, NO romper el PDF.
  - Si image_fetcher_instance is None, se preserva el comportamiento de Fase 1
    (compatible con los 7 tests existentes).
"""
from __future__ import annotations

import logging
import os
import tempfile
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Image as RLImage,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

import matplotlib

matplotlib.use("Agg")  # CRÍTICO: backend non-interactive (sin display).
import matplotlib.pyplot as plt

from app.services.reports.conteos import (
    calcular_escoliosis_distribucion,
    calcular_espirometria_distribucion,
    calcular_hbc_por_rango,
    calcular_qs6_niveles,
    calcular_trauma_acustico_por_area,
)

logger = logging.getLogger(__name__)

# Máximo de trabajadores soportados por el ebook (Decisión 3 del SPEC).
MAX_TRABAJADORES = 300

# ------------------------------------------------------------------
# Tipografía: registrar TTF DejaVu para unicode (ñ, á, é, í, ó, ú).
# Fallback a Helvetica si no está disponible.
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
    logger.warning(
        "No se pudo registrar DejaVu TTF, fallback a Helvetica: %s", exc
    )
    FONT_NAME = "Helvetica"
    FONT_NAME_BOLD = "Helvetica-Bold"


# ------------------------------------------------------------------
# API pública
# ------------------------------------------------------------------
def generar_ebook(
    project: Dict[str, Any],
    output_path: str,
    image_fetcher_instance: Optional[Any] = None,
) -> str:
    """
    Genera el PDF ebook completo (Fase 2) en `output_path`.
    Retorna el path del archivo generado.

    Args:
      project: snapshot del proyecto (dict con `trabajadores`, `empresa`, etc.).
      output_path: ruta absoluta del PDF de salida.
      image_fetcher_instance: módulo o adaptador con métodos
        `fetch(url)`, `compress(bytes)` y `is_pdf(bytes)` para descargar
        imágenes reales desde EventTest.fileUrl. Si es None (default), el
        PDF se genera solo con datos estructurados (sin imágenes embebidas).

    Validaciones:
      - Crea directorio padre si no existe.
      - Advierte (warning) si hay más de MAX_TRABAJADORES.
    """
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    trabajadores = project.get("trabajadores", []) or []
    if len(trabajadores) > MAX_TRABAJADORES:
        logger.warning(
            "generar_ebook: %d trabajadores excede el máximo de %d "
            "(puede degradar performance)",
            len(trabajadores),
            MAX_TRABAJADORES,
        )

    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,  # 8.5×11in = 612×792pt
        topMargin=2 * inch,
        bottomMargin=2 * inch,
        leftMargin=2 * inch,
        rightMargin=2 * inch,
        title=f"EBOOK {project.get('empresa', 'Proyecto')}",
        author="AMI - Administración Médica Industrial",
    )

    styles = _build_styles()

    # Bookmarks: name -> (page_number_after_build).
    bookmarks: Dict[str, str] = {}

    # Tempfiles (PNG matplotlib) que se generan durante el render y deben
    # existir hasta que reportlab los haya incrustado. Se limpian post-build.
    tempfiles: List[str] = []

    story: List[Any] = []

    # 1) Portada
    story.extend(_render_portada(project, styles))
    story.append(PageBreak())

    # 2) TOC placeholder
    story.extend(_render_toc(project, styles, bookmarks))
    story.append(PageBreak())

    # 3) Resumen Ejecutivo
    story.extend(_render_resumen_ejecutivo(project, styles, bookmarks))
    story.append(PageBreak())

    # 4) II.1 Audiometría con mini-gráfica
    story.extend(
        _render_estadistica_audiometria(project, styles, bookmarks, tempfiles)
    )
    story.append(PageBreak())

    # 4.b) II.2 - II.8 Estadísticas restantes con mini-gráficas (Fase 3)
    story.extend(
        _render_estadistica_trauma_acustico(
            project, styles, bookmarks, tempfiles
        )
    )
    story.append(PageBreak())

    story.extend(
        _render_estadistica_espirometria(project, styles, bookmarks, tempfiles)
    )
    story.append(PageBreak())

    story.extend(
        _render_estadistica_rx_columna(project, styles, bookmarks, tempfiles)
    )
    story.append(PageBreak())

    story.extend(
        _render_estadistica_rx_torax(project, styles, bookmarks, tempfiles)
    )
    story.append(PageBreak())

    story.extend(
        _render_estadistica_ecg(project, styles, bookmarks, tempfiles)
    )
    story.append(PageBreak())

    story.extend(
        _render_estadistica_campimetria(project, styles, bookmarks, tempfiles)
    )
    story.append(PageBreak())

    story.extend(
        _render_estadistica_laboratorio(project, styles, bookmarks, tempfiles)
    )
    story.append(PageBreak())

    # 5) III. Reportes Individuales — TODOS los trabajadores (Fase 2)
    #    Ordenados alfabéticamente por apellido. PageBreak entre ellos
    #    (no antes del primero).
    story.append(
        Paragraph("III. Reportes Individuales", styles["EbookH1"])
    )

    trabajadores_ordenados = sorted(
        trabajadores,
        key=lambda w: (_apellido_de(w), w.get("nombre", "")),
    )

    for idx, trabajador in enumerate(trabajadores_ordenados, 1):
        if idx > 1:
            story.append(PageBreak())
        story.extend(
            _render_seccion_trabajador(
                trabajador,
                styles,
                bookmarks,
                tempfiles,
                image_fetcher_instance=image_fetcher_instance,
                indice=idx,
            )
        )

    # Footer con número de página en cada página (excepto portada).
    doc.build(
        story,
        onFirstPage=_footer_portada,
        onLaterPages=_footer_normal,
    )

    # Post-build: limpiar tempfiles de matplotlib (ya incrustados en el PDF).
    for tmp in tempfiles:
        try:
            os.unlink(tmp)
        except OSError:
            pass

    # Post-build: mergear PDFs nativos pendientes (audiometría, labs) si hay.
    _merge_pending_pdfs(output_path, image_fetcher_instance)

    # Post-build: registrar bookmarks reales en el PDF.
    _register_bookmarks(output_path, bookmarks)

    logger.info("EBOOK generado: %s", output_path)
    return output_path


# ------------------------------------------------------------------
# Helpers de ordenamiento (Decisión 5/15)
# ------------------------------------------------------------------
def _apellido_de(trabajador: Dict[str, Any]) -> str:
    """
    Devuelve el apellido de un trabajador para ordenar alfabéticamente.
    Convención: el último token del campo `nombre` (formato "APELLIDO NOMBRES"
    según el snapshot de massive_report.py).
    Fallback al campo completo si no hay espacios.
    """
    nombre = (trabajador.get("nombre") or "").strip()
    if not nombre:
        return ""
    partes = nombre.split()
    return partes[-1] if len(partes) > 1 else nombre


# ------------------------------------------------------------------
# Estilos
# ------------------------------------------------------------------
def _build_styles():
    """Crea los ParagraphStyle necesarios para el ebook."""
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="EbookTitle",
            fontName=FONT_NAME_BOLD,
            fontSize=24,
            leading=28,
            spaceAfter=12,
            alignment=1,  # centro
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookSubtitle",
            fontName=FONT_NAME,
            fontSize=14,
            leading=18,
            alignment=1,
            textColor=colors.HexColor("#475569"),
            spaceAfter=24,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookH1",
            fontName=FONT_NAME_BOLD,
            fontSize=18,
            leading=22,
            spaceBefore=6,
            spaceAfter=12,
            textColor=colors.HexColor("#1e293b"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookH2",
            fontName=FONT_NAME_BOLD,
            fontSize=13,
            leading=16,
            spaceBefore=8,
            spaceAfter=6,
            textColor=colors.HexColor("#334155"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookBody",
            fontName=FONT_NAME,
            fontSize=10,
            leading=14,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="EbookPlaceholder",
            fontName=FONT_NAME,
            fontSize=11,
            leading=14,
            alignment=1,
            textColor=colors.HexColor("#94a3b8"),
        )
    )
    return styles


# ------------------------------------------------------------------
# Portada
# ------------------------------------------------------------------
def _render_portada(project: Dict[str, Any], styles) -> List[Any]:
    elements: List[Any] = []

    # Logo placeholder (Decisión 14).
    elements.append(Spacer(1, 1.2 * inch))
    elements.append(
        Paragraph(
            "[ LOGO SOLUCIONES ]",
            ParagraphStyle(
                "LogoBox",
                parent=styles["EbookTitle"],
                fontSize=20,
                textColor=colors.HexColor("#cbd5e1"),
                alignment=1,
                backColor=colors.HexColor("#f1f5f9"),
                borderPadding=18,
                borderColor=colors.HexColor("#cbd5e1"),
                borderWidth=1,
            ),
        )
    )
    elements.append(
        Paragraph(
            "<i>placeholder hasta feedback Leticia</i>",
            styles["EbookPlaceholder"],
        )
    )
    elements.append(Spacer(1, 0.6 * inch))

    # Título + subtítulo.
    elements.append(
        Paragraph("Diagn&oacute;stico Situacional", styles["EbookTitle"])
    )
    elements.append(
        Paragraph(
            project.get("empresa") or "Proyecto",
            styles["EbookSubtitle"],
        )
    )

    # Metadata.
    elements.append(Spacer(1, 0.3 * inch))
    metadata_lines = [
        f"<b>Empresa:</b> {project.get('empresa', 'N/A')}",
        f"<b>Raz&oacute;n social:</b> {project.get('empresaLegal', 'N/A')}",
        f"<b>Fecha del estudio:</b> {project.get('fecha', 'N/A')}",
        f"<b>Total trabajadores:</b> {len(project.get('trabajadores', []))}",
        "",
        "<i>Generado por AMI — Sistema de Administraci&oacute;n M&eacute;dica Industrial</i>",
        "<i>M&oacute;dulo: Reportes Masivos por Proyecto (EBOOK)</i>",
    ]
    for line in metadata_lines:
        elements.append(Paragraph(line, styles["EbookBody"]))

    return elements


# ------------------------------------------------------------------
# TOC (placeholder, mejora en Fase 1 — hipervínculos vendrán con Platypus
# en fases siguientes si se requiere)
# ------------------------------------------------------------------
def _render_toc(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
) -> List[Any]:
    bookmarks["toc"] = "toc"
    elements: List[Any] = []
    elements.append(Paragraph("&Iacute;ndice", styles["EbookH1"]))
    elements.append(Spacer(1, 0.2 * inch))

    total = len(project.get("trabajadores", []))
    toc_lines = [
        "I.   Resumen Ejecutivo",
        "II.  Estad&iacute;sticas Agregadas",
        "     II.1  Audiometr&iacute;a (%HBC)",
        "     II.2  Trauma Ac&uacute;stico por &Aacute;rea",
        "     II.3  Espirometr&iacute;a",
        "     II.4  RX Columna",
        "     II.5  RX T&oacute;rax",
        "     II.6  ECG",
        "     II.7  Campimetr&iacute;a",
        "     II.8  Laboratorio",
        f"III. Reportes Individuales ({total} trabajadores)",
    ]
    for line in toc_lines:
        elements.append(Paragraph(line, styles["EbookBody"]))

    elements.append(Spacer(1, 0.3 * inch))
    elements.append(
        Paragraph(
            "<i>Los bookmarks est&aacute;n disponibles en el panel "
            "del lector PDF (Chrome, Adobe, Foxit).</i>",
            styles["EbookBody"],
        )
    )

    return elements


# ------------------------------------------------------------------
# Resumen Ejecutivo
# ------------------------------------------------------------------
def _render_resumen_ejecutivo(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
) -> List[Any]:
    bookmarks["resumen"] = "resumen"
    elements: List[Any] = []
    elements.append(Paragraph("I. Resumen Ejecutivo", styles["EbookH1"]))
    elements.append(Spacer(1, 0.15 * inch))

    trabajadores = project.get("trabajadores", []) or []
    total = len(trabajadores)
    sin_estudios = sum(1 for w in trabajadores if not _tiene_estudios(w))
    con_estudios = total - sin_estudios

    masculino = sum(
        1
        for w in trabajadores
        if (w.get("sexo") or "").upper().startswith("M")
    )
    femenino = sum(
        1
        for w in trabajadores
        if (w.get("sexo") or "").upper().startswith("F")
    )

    data = [
        ["Métrica", "Valor"],
        ["Total trabajadores", str(total)],
        ["Con al menos 1 estudio", str(con_estudios)],
        ["Sin estudios registrados", str(sin_estudios)],
        ["Masculino", str(masculino)],
        ["Femenino", str(femenino)],
    ]
    tabla = Table(data, colWidths=[3.5 * inch, 1.5 * inch])
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), FONT_NAME_BOLD),
                ("FONTNAME", (0, 1), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f8fafc")],
                ),
            ]
        )
    )
    elements.append(tabla)
    elements.append(Spacer(1, 0.3 * inch))
    elements.append(
        Paragraph(
            "Este Resumen Ejecutivo se ampliar&aacute; en fases siguientes "
            "con pir&aacute;mide de edad y mini-gr&aacute;ficas adicionales.",
            styles["EbookBody"],
        )
    )
    return elements


# ------------------------------------------------------------------
# II.1 Audiometría con mini-gráfica matplotlib
# ------------------------------------------------------------------
def _render_estadistica_audiometria(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
    tempfiles: List[str],
) -> List[Any]:
    bookmarks["ii_audiometria"] = "ii_audiometria"
    elements: List[Any] = []
    elements.append(
        Paragraph("II.1 Audiometr&iacute;a (%HBC)", styles["EbookH1"])
    )
    elements.append(Spacer(1, 0.15 * inch))

    hbc = calcular_hbc_por_rango(project)
    elements.append(
        Paragraph(
            f"<b>Normal (&lt;10%):</b> {hbc['normal']} &nbsp;|&nbsp; "
            f"<b>Alto (10-19%):</b> {hbc['alto']} &nbsp;|&nbsp; "
            f"<b>Muy Alto (&ge;20%):</b> {hbc['muyAlto']}",
            styles["EbookBody"],
        )
    )
    elements.append(Spacer(1, 0.2 * inch))

    grafica_path = _generar_grafica_hbc(hbc)
    if grafica_path:
        elements.append(
            RLImage(grafica_path, width=5 * inch, height=3 * inch)
        )
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(
            Paragraph(
                "<i>Figura II.1 — Distribuci&oacute;n de %HBC por rango "
                "(renderizada con matplotlib Agg).</i>",
                styles["EbookBody"],
            )
        )
        # Diferir cleanup hasta post-build.
        tempfiles.append(grafica_path)
    else:
        elements.append(
            Paragraph(
                "<i>No se pudo renderizar la gr&aacute;fica matplotlib. "
                "Verificar instalaci&oacute;n del backend Agg.</i>",
                styles["EbookBody"],
            )
        )

    return elements


def _generar_grafica_hbc(hbc: Dict[str, int]) -> Optional[str]:
    """Renderiza mini-gráfica de barras %HBC con matplotlib Agg."""
    try:
        fig, ax = plt.subplots(figsize=(5, 3), dpi=100)
        categorias = ["Normal (<10%)", "Alto (10-19%)", "Muy Alto (\u226520%)"]
        valores = [hbc["normal"], hbc["alto"], hbc["muyAlto"]]
        colores = ["#10b981", "#f59e0b", "#ef4444"]
        ax.bar(categorias, valores, color=colores)
        ax.set_ylabel("Trabajadores")
        ax.set_title("Distribución %HBC")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        plt.tight_layout()

        tmp = tempfile.NamedTemporaryFile(
            suffix=".png", delete=False
        )
        tmp.close()
        plt.savefig(
            tmp.name, format="png", dpi=100, bbox_inches="tight"
        )
        plt.close(fig)
        return tmp.name
    except Exception as exc:
        logger.error("Error generando gráfica HBC: %s", exc)
        return None


# ------------------------------------------------------------------
# Helpers genéricos para mini-gráficas y tablas (Fase 3)
# ------------------------------------------------------------------
def _generar_grafica_barras(
    categorias: List[str],
    valores: List[int],
    titulo: str,
    color: str = "#10b981",
    horizontal: bool = False,
) -> Optional[str]:
    """Genera mini-gráfica de barras con matplotlib Agg. Retorna path del PNG."""
    try:
        fig, ax = plt.subplots(figsize=(5, 3), dpi=100)
        if horizontal:
            ax.barh(categorias, valores, color=color)
            ax.invert_yaxis()
        else:
            ax.bar(categorias, valores, color=color)
        ax.set_title(titulo, fontsize=11)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        if not horizontal:
            ax.set_ylabel("Trabajadores")
        plt.tight_layout()

        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.close()
        plt.savefig(tmp.name, format="png", dpi=100, bbox_inches="tight")
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
    """Genera mini-gráfica de barras con un color por categoría (severidad)."""
    try:
        fig, ax = plt.subplots(figsize=(5, 3), dpi=100)
        ax.bar(categorias, valores, color=colores)
        ax.set_title(titulo, fontsize=11)
        ax.set_ylabel("Trabajadores")
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
        plt.tight_layout()

        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.close()
        plt.savefig(tmp.name, format="png", dpi=100, bbox_inches="tight")
        plt.close(fig)
        return tmp.name
    except Exception as exc:
        logger.error(
            "Error generando gráfica de barras categóricas: %s", exc
        )
        return None


def _generar_grafica_pastel(
    labels: List[str], valores: List[int], titulo: str
) -> Optional[str]:
    """Genera mini-gráfica de pastel con matplotlib Agg."""
    try:
        fig, ax = plt.subplots(figsize=(5, 3), dpi=100)
        colores = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6"]
        ax.pie(
            valores,
            labels=labels,
            colors=colores[: len(labels)],
            autopct="%1.0f%%",
            startangle=90,
        )
        ax.set_title(titulo, fontsize=11)
        plt.tight_layout()

        tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
        tmp.close()
        plt.savefig(tmp.name, format="png", dpi=100, bbox_inches="tight")
        plt.close(fig)
        return tmp.name
    except Exception as exc:
        logger.error("Error generando gráfica de pastel: %s", exc)
        return None


def _crear_tabla_conteos(data: List[List[str]]):
    """Crea tabla estilizada (mismo look&feel que Resumen Ejecutivo)."""
    tabla = Table(data, colWidths=[3 * inch, 1.5 * inch])
    tabla.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e293b")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), FONT_NAME_BOLD),
                ("FONTNAME", (0, 1), (-1, -1), FONT_NAME),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("ALIGN", (0, 0), (-1, 0), "LEFT"),
                ("ALIGN", (1, 1), (1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                (
                    "GRID",
                    (0, 0),
                    (-1, -1),
                    0.5,
                    colors.HexColor("#cbd5e1"),
                ),
                (
                    "ROWBACKGROUNDS",
                    (0, 1),
                    (-1, -1),
                    [colors.white, colors.HexColor("#f8fafc")],
                ),
            ]
        )
    )
    return tabla


# ------------------------------------------------------------------
# II.2 - II.8 Estadísticas con mini-gráficas (Fase 3)
# ------------------------------------------------------------------
def _render_estadistica_trauma_acustico(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
    tempfiles: List[str],
) -> List[Any]:
    """II.2 Trauma acústico por área — barras horizontales."""
    bookmarks["ii_trauma_acustico"] = "ii_trauma_acustico"
    elements: List[Any] = []
    elements.append(
        Paragraph("II.2 Trauma Ac&uacute;stico por &Aacute;rea", styles["EbookH1"])
    )
    elements.append(Spacer(1, 0.1 * inch))

    trauma = calcular_trauma_acustico_por_area(project)
    if not trauma:
        elements.append(
            Paragraph(
                "<i>Sin casos de trauma ac&uacute;stico detectados.</i>",
                styles["EbookBody"],
            )
        )
        return elements

    # Tabla resumen.
    data = [["Área", "Casos"]]
    for t in trauma:
        data.append([t["area"], str(t["conteo"])])
    elements.append(_crear_tabla_conteos(data))
    elements.append(Spacer(1, 0.15 * inch))

    # Gráfica de barras horizontales.
    categorias = [t["area"] for t in trauma]
    valores = [t["conteo"] for t in trauma]
    grafica_path = _generar_grafica_barras(
        categorias,
        valores,
        "Trauma Acústico por Área",
        color="#ef4444",
        horizontal=True,
    )
    if grafica_path:
        elements.append(
            RLImage(grafica_path, width=5 * inch, height=3 * inch)
        )
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(
            Paragraph(
                "<i>Figura II.2 &mdash; Casos de trauma ac&uacute;stico "
                "agrupados por &aacute;rea de trabajo.</i>",
                styles["EbookBody"],
            )
        )
        tempfiles.append(grafica_path)

    return elements


def _render_estadistica_espirometria(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
    tempfiles: List[str],
) -> List[Any]:
    """II.3 Distribución de patrón espirométrico — pastel."""
    bookmarks["ii_espirometria"] = "ii_espirometria"
    elements: List[Any] = []
    elements.append(
        Paragraph("II.3 Espirometr&iacute;a (Patr&oacute;n)", styles["EbookH1"])
    )
    elements.append(Spacer(1, 0.1 * inch))

    espiro = calcular_espirometria_distribucion(project)
    data = [["Patrón", "Casos"]]
    for e in espiro:
        data.append([e["patron"], str(e["conteo"])])
    elements.append(_crear_tabla_conteos(data))
    elements.append(Spacer(1, 0.15 * inch))

    # Gráfica pastel. Truncar labels para que no se salga de la figura.
    labels = [e["patron"][:30] for e in espiro]
    valores = [e["conteo"] for e in espiro]
    grafica_path = _generar_grafica_pastel(
        labels, valores, "Distribución Patrón Espirométrico"
    )
    if grafica_path:
        elements.append(
            RLImage(grafica_path, width=5 * inch, height=3 * inch)
        )
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(
            Paragraph(
                "<i>Figura II.3 &mdash; Distribuci&oacute;n porcentual "
                "del patr&oacute;n espirom&eacute;trico.</i>",
                styles["EbookBody"],
            )
        )
        tempfiles.append(grafica_path)

    return elements


def _render_estadistica_rx_columna(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
    tempfiles: List[str],
) -> List[Any]:
    """II.4 Escoliosis por grado Cobb — barras por severidad."""
    bookmarks["ii_rx_columna"] = "ii_rx_columna"
    elements: List[Any] = []
    elements.append(
        Paragraph("II.4 RX Columna (Escoliosis)", styles["EbookH1"])
    )
    elements.append(Spacer(1, 0.1 * inch))

    esc = calcular_escoliosis_distribucion(project)
    data = [
        ["Grado Cobb", "Casos"],
        ["Normal (<5°)", str(esc["normal"])],
        ["Leve (5-9°)", str(esc["leve"])],
        ["Moderada (10-19°)", str(esc["moderada"])],
        ["Grave (≥20°)", str(esc["grave"])],
    ]
    elements.append(_crear_tabla_conteos(data))
    elements.append(Spacer(1, 0.15 * inch))

    # Gráfica con colores por severidad (verde→rojo oscuro).
    categorias = ["Normal", "Leve", "Moderada", "Grave"]
    valores = [esc["normal"], esc["leve"], esc["moderada"], esc["grave"]]
    colores = ["#10b981", "#f59e0b", "#ef4444", "#7f1d1d"]
    grafica_path = _generar_grafica_barras_categorias(
        categorias, valores, colores, "Distribución Escoliosis (Cobb)"
    )
    if grafica_path:
        elements.append(
            RLImage(grafica_path, width=5 * inch, height=3 * inch)
        )
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(
            Paragraph(
                "<i>Figura II.4 &mdash; Escoliosis clasificada por grado "
                "Cobb (colores por severidad).</i>",
                styles["EbookBody"],
            )
        )
        tempfiles.append(grafica_path)

    return elements


def _render_estadistica_rx_torax(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
    tempfiles: List[str],  # noqa: ARG001 (consistente con II.5–II.8)
) -> List[Any]:
    """II.5 RX Tórax — solo conteos (sin gráfica)."""
    bookmarks["ii_rx_torax"] = "ii_rx_torax"
    elements: List[Any] = []
    elements.append(Paragraph("II.5 RX T&oacute;rax", styles["EbookH1"]))
    elements.append(Spacer(1, 0.1 * inch))

    trabajadores = project.get("trabajadores", [])
    total = len(trabajadores)
    normales = 0
    alterados = 0
    na = 0
    for w in trabajadores:
        impresion = (w.get("rxTorax") or {}).get("impresion", "") or ""
        impresion_up = impresion.upper().strip()
        if not impresion_up or impresion_up in ("N/A", "NA"):
            na += 1
        elif "NORMAL" in impresion_up:
            normales += 1
        else:
            alterados += 1

    data = [
        ["Resultado", "Casos"],
        ["Normales", str(normales)],
        ["Alterados", str(alterados)],
        ["N/A o sin estudio", str(na)],
        ["Total", str(total)],
    ]
    elements.append(_crear_tabla_conteos(data))
    return elements


def _render_estadistica_ecg(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
    tempfiles: List[str],  # noqa: ARG001
) -> List[Any]:
    """II.6 ECG — solo conteos."""
    bookmarks["ii_ecg"] = "ii_ecg"
    elements: List[Any] = []
    elements.append(Paragraph("II.6 ECG", styles["EbookH1"]))
    elements.append(Spacer(1, 0.1 * inch))

    trabajadores = project.get("trabajadores", [])
    total = len(trabajadores)
    normales = 0
    alterados = 0
    na = 0
    for w in trabajadores:
        impresion = (w.get("ecg") or {}).get("impresion", "") or ""
        impresion_up = impresion.upper().strip()
        if not impresion_up or impresion_up in ("N/A", "NA"):
            na += 1
        elif "NORMAL" in impresion_up or "SIN ANORMALIDAD" in impresion_up:
            normales += 1
        else:
            alterados += 1

    data = [
        ["Resultado", "Casos"],
        ["Normales", str(normales)],
        ["Alterados", str(alterados)],
        ["N/A o sin estudio", str(na)],
        ["Total", str(total)],
    ]
    elements.append(_crear_tabla_conteos(data))
    return elements


def _render_estadistica_campimetria(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
    tempfiles: List[str],
) -> List[Any]:
    """II.7 Agudeza visual — pastel."""
    bookmarks["ii_campimetria"] = "ii_campimetria"
    elements: List[Any] = []
    elements.append(
        Paragraph("II.7 Campimetr&iacute;a (Agudeza Visual)", styles["EbookH1"])
    )
    elements.append(Spacer(1, 0.1 * inch))

    # Calcular inline: NORMAL, DISMINUIDA, N/A.
    mapa: Dict[str, int] = {}
    for w in project.get("trabajadores", []):
        av = (w.get("campimetria") or {}).get("agudezaVisual") or "N/A"
        av = av.strip() if isinstance(av, str) else "N/A"
        if not av:
            av = "N/A"
        mapa[av] = mapa.get(av, 0) + 1

    data = [["Agudeza Visual", "Casos"]]
    for av, conteo in sorted(mapa.items()):
        data.append([av, str(conteo)])
    elements.append(_crear_tabla_conteos(data))
    elements.append(Spacer(1, 0.15 * inch))

    labels = list(mapa.keys())
    valores = list(mapa.values())
    grafica_path = _generar_grafica_pastel(
        labels, valores, "Distribución Agudeza Visual"
    )
    if grafica_path:
        elements.append(
            RLImage(grafica_path, width=5 * inch, height=3 * inch)
        )
        elements.append(Spacer(1, 0.1 * inch))
        elements.append(
            Paragraph(
                "<i>Figura II.7 &mdash; Distribuci&oacute;n porcentual "
                "de agudeza visual.</i>",
                styles["EbookBody"],
            )
        )
        tempfiles.append(grafica_path)

    return elements


def _render_estadistica_laboratorio(
    project: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
    tempfiles: List[str],
) -> List[Any]:
    """II.8 Laboratorio — 3 mini-gráficas (glucosa, colesterol, triglicéridos)."""
    bookmarks["ii_laboratorio"] = "ii_laboratorio"
    elements: List[Any] = []
    elements.append(Paragraph("II.8 Laboratorio", styles["EbookH1"]))
    elements.append(Spacer(1, 0.1 * inch))

    qs6 = calcular_qs6_niveles(project)

    # Glucosa.
    elements.append(Paragraph("<b>Glucosa</b>", styles["EbookH2"]))
    g_path = _generar_grafica_barras(
        ["Normal (<100)", "Alta (≥100)"],
        [qs6["glucosa"]["normal"], qs6["glucosa"]["alta"]],
        "Glucosa (mg/dL)",
        color="#3b82f6",
    )
    if g_path:
        elements.append(RLImage(g_path, width=4.5 * inch, height=2 * inch))
        tempfiles.append(g_path)
    elements.append(Spacer(1, 0.1 * inch))

    # Colesterol.
    elements.append(Paragraph("<b>Colesterol</b>", styles["EbookH2"]))
    c_path = _generar_grafica_barras(
        ["Normal (<200)", "Límite (200-239)", "Alto (≥240)"],
        [
            qs6["colesterol"]["normal"],
            qs6["colesterol"]["limite"],
            qs6["colesterol"]["alto"],
        ],
        "Colesterol (mg/dL)",
        color="#8b5cf6",
    )
    if c_path:
        elements.append(RLImage(c_path, width=4.5 * inch, height=2 * inch))
        tempfiles.append(c_path)
    elements.append(Spacer(1, 0.1 * inch))

    # Triglicéridos.
    elements.append(Paragraph("<b>Triglic&eacute;ridos</b>", styles["EbookH2"]))
    t_path = _generar_grafica_barras(
        ["Normal (<150)", "Límite (150-199)", "Alto (≥200)"],
        [
            qs6["trigliceridos"]["normal"],
            qs6["trigliceridos"]["limite"],
            qs6["trigliceridos"]["alto"],
        ],
        "Triglicéridos (mg/dL)",
        color="#ec4899",
    )
    if t_path:
        elements.append(RLImage(t_path, width=4.5 * inch, height=2 * inch))
        tempfiles.append(t_path)

    return elements


# ------------------------------------------------------------------
# III.X Sección por trabajador (Fase 2: las 8 secciones + TODOS)
# ------------------------------------------------------------------
def _render_seccion_trabajador(
    trabajador: Dict[str, Any],
    styles,
    bookmarks: Dict[str, str],
    tempfiles: List[str],
    image_fetcher_instance: Optional[Any] = None,
    indice: int = 1,
) -> List[Any]:
    """
    Renderiza las 8 secciones clínicas de un trabajador.
    Solo renderiza secciones con datos válidos.
    Soporta imagen opcional por sección si `image_fetcher_instance` está
    presente y el dict del estudio expone `fileUrl` (o `fileUrlAP` /
    `fileUrlLateral` para RX Columna).
    """
    folio = trabajador.get("folio", "unknown")
    bookmark_key = f"trabajador_{folio}"
    bookmarks[bookmark_key] = bookmark_key

    elements: List[Any] = []
    nombre = trabajador.get("nombre", "Sin nombre")

    elements.append(
        Paragraph(f"III.{indice} &nbsp; {nombre}", styles["EbookH1"])
    )
    elements.append(
        Paragraph(
            f"<b>Folio:</b> {folio} &nbsp;|&nbsp; "
            f"<b>Sexo:</b> {trabajador.get('sexo', 'N/A')} &nbsp;|&nbsp; "
            f"<b>&Aacute;rea:</b> {trabajador.get('area', 'N/A')} &nbsp;|&nbsp; "
            f"<b>Antig&uuml;edad:</b> {trabajador.get('antiguedad', 'N/A')}",
            styles["EbookBody"],
        )
    )
    elements.append(Spacer(1, 0.2 * inch))

    tiene_algun_estudio = False

    # 1. AUDIOMETRÍA
    audio = trabajador.get("audiometria") or {}
    if audio and _dict_has_value(audio):
        tiene_algun_estudio = True
        elements.extend(_render_audiometria(audio, styles))
        img_url = audio.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(
                    img_url,
                    "Audiograma original",
                    image_fetcher_instance,
                    tempfiles,
                    styles,
                )
            )

    # 2. ESPIROMETRÍA
    espiro = trabajador.get("espirometria") or {}
    if espiro and _dict_has_value(espiro):
        tiene_algun_estudio = True
        elements.extend(_render_espirometria(espiro, styles))
        img_url = espiro.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(
                    img_url,
                    "Curva flujo-volumen",
                    image_fetcher_instance,
                    tempfiles,
                    styles,
                )
            )

    # 3. RX COLUMNA (puede tener 2 imágenes: AP + lateral)
    rx_col = trabajador.get("rxColumna") or {}
    if rx_col and _dict_has_value(rx_col):
        tiene_algun_estudio = True
        elements.extend(_render_rx_columna(rx_col, styles))
        for sub_idx, key in enumerate(["fileUrlAP", "fileUrlLateral"], 1):
            img_url = rx_col.get(key)
            if img_url and image_fetcher_instance is not None:
                label = "RX Columna AP" if sub_idx == 1 else "RX Columna Lateral"
                elements.extend(
                    _render_imagen_estudio(
                        img_url,
                        label,
                        image_fetcher_instance,
                        tempfiles,
                        styles,
                    )
                )

    # 4. RX TÓRAX
    rx_torax = trabajador.get("rxTorax") or {}
    if rx_torax and _dict_has_value(rx_torax):
        tiene_algun_estudio = True
        elements.extend(_render_rx_torax(rx_torax, styles))
        img_url = rx_torax.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(
                    img_url,
                    "RX Tórax PA",
                    image_fetcher_instance,
                    tempfiles,
                    styles,
                )
            )

    # 5. ECG
    ecg = trabajador.get("ecg") or {}
    if ecg and _dict_has_value(ecg):
        tiene_algun_estudio = True
        elements.extend(_render_ecg(ecg, styles))
        img_url = ecg.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(
                    img_url,
                    "Trazo ECG",
                    image_fetcher_instance,
                    tempfiles,
                    styles,
                )
            )

    # 6. LABORATORIO
    lab = trabajador.get("laboratorio") or {}
    if lab and _dict_has_value(lab):
        tiene_algun_estudio = True
        elements.extend(_render_laboratorio(lab, styles))
        img_url = lab.get("fileUrl")
        if img_url and image_fetcher_instance is not None:
            elements.extend(
                _render_imagen_estudio(
                    img_url,
                    "Resultados de laboratorio",
                    image_fetcher_instance,
                    tempfiles,
                    styles,
                )
            )

    # 7. CAMPIMETRÍA (sin imagen estandarizada)
    campi = trabajador.get("campimetria") or {}
    if campi and _dict_has_value(campi):
        tiene_algun_estudio = True
        elements.extend(_render_campimetria(campi, styles))

    # 8. EXAMEN MÉDICO (sin imagen, solo datos estructurados)
    examen = trabajador.get("examenMedico") or {}
    if examen and _dict_has_value(examen):
        tiene_algun_estudio = True
        elements.extend(_render_examen_medico(examen, styles))

    if not tiene_algun_estudio:
        elements.append(
            Paragraph(
                "<i>Sin estudios realizados para este trabajador.</i>",
                styles["EbookPlaceholder"],
            )
        )

    return elements


# ------------------------------------------------------------------
# Las 8 funciones de render por sección clínica (Fase 2)
# ------------------------------------------------------------------
def _render_audiometria(audio: Dict[str, Any], styles) -> List[Any]:
    """Renderiza sección de audiometría."""
    elements: List[Any] = []
    elements.append(Paragraph("Audiometría", styles["EbookH2"]))
    hbc_val = audio.get("hbc", "N/A")
    if hbc_val is not None and hbc_val != "N/A":
        try:
            hbc_val = f"{float(hbc_val):.2f}"
        except (TypeError, ValueError):
            pass
    elements.append(
        Paragraph(
            f"<b>DX:</b> {audio.get('dx', 'N/A')} &nbsp;|&nbsp; "
            f"<b>OD:</b> {audio.get('oidoDerecho', 'N/A')} &nbsp;|&nbsp; "
            f"<b>OI:</b> {audio.get('oidoIzquierdo', 'N/A')} &nbsp;|&nbsp; "
            f"<b>%HBC:</b> {hbc_val}",
            styles["EbookBody"],
        )
    )
    return elements


def _render_espirometria(espiro: Dict[str, Any], styles) -> List[Any]:
    """Renderiza sección de espirometría."""
    elements: List[Any] = []
    elements.append(Paragraph("Espirometría", styles["EbookH2"]))
    elements.append(
        Paragraph(
            f"<b>Patrón:</b> {espiro.get('patron', 'N/A')} &nbsp;|&nbsp; "
            f"<b>FVC:</b> {espiro.get('fvc', 'N/A')} &nbsp;|&nbsp; "
            f"<b>Tabaquismo:</b> {espiro.get('tabaquismo', 'N/A')}",
            styles["EbookBody"],
        )
    )
    return elements


def _render_rx_columna(rx_col: Dict[str, Any], styles) -> List[Any]:
    """Renderiza sección de RX columna."""
    elements: List[Any] = []
    elements.append(Paragraph("RX Columna", styles["EbookH2"]))
    elements.append(
        Paragraph(
            f"<b>Escoliosis:</b> {rx_col.get('escoliosis', 'N/A')}° &nbsp;|&nbsp; "
            f"<b>Lordosis:</b> {rx_col.get('lordosis', 'N/A')}° &nbsp;|&nbsp; "
            f"<b>Báscula:</b> {rx_col.get('basculacion', 'N/A')} cm",
            styles["EbookBody"],
        )
    )
    impresion = rx_col.get("impresion", "")
    if impresion:
        elements.append(
            Paragraph(f"<b>Impresión:</b> {impresion}", styles["EbookBody"])
        )
    return elements


def _render_rx_torax(rx_torax: Dict[str, Any], styles) -> List[Any]:
    """Renderiza sección de RX tórax."""
    elements: List[Any] = []
    elements.append(Paragraph("RX Tórax", styles["EbookH2"]))
    impresion = rx_torax.get("impresion", "N/A")
    elements.append(
        Paragraph(f"<b>Impresión:</b> {impresion}", styles["EbookBody"])
    )
    return elements


def _render_ecg(ecg: Dict[str, Any], styles) -> List[Any]:
    """Renderiza sección de ECG."""
    elements: List[Any] = []
    elements.append(Paragraph("ECG", styles["EbookH2"]))
    impresion = ecg.get("impresion", "N/A")
    elements.append(
        Paragraph(f"<b>Impresión:</b> {impresion}", styles["EbookBody"])
    )
    return elements


def _render_laboratorio(lab: Dict[str, Any], styles) -> List[Any]:
    """Renderiza sección de laboratorio (BH, QS6, Tóxico)."""
    elements: List[Any] = []
    elements.append(Paragraph("Laboratorio", styles["EbookH2"]))

    bh = lab.get("bh") or {}
    qs6 = lab.get("qs6") or {}
    ego = lab.get("ego") or {}
    toxico = lab.get("toxico") or {}

    if bh and _dict_has_value(bh):
        elements.append(
            Paragraph(
                f"<b>BH:</b> Hb={bh.get('hb', 'N/A')}, "
                f"LEU={bh.get('leu', 'N/A')}, "
                f"PLA={bh.get('pla', 'N/A')}, "
                f"CHb={bh.get('chgm', bh.get('mchb', 'N/A'))}",
                styles["EbookBody"],
            )
        )

    if qs6 and _dict_has_value(qs6):
        elements.append(
            Paragraph(
                f"<b>QS6:</b> GLUC={qs6.get('gluc', 'N/A')}, "
                f"BUN={qs6.get('bun', 'N/A')}, "
                f"COL={qs6.get('col', 'N/A')}, "
                f"TRIG={qs6.get('trig', 'N/A')}",
                styles["EbookBody"],
            )
        )

    if toxico and _dict_has_value(toxico):
        elements.append(
            Paragraph(
                f"<b>Tóxico:</b> ANFETA={toxico.get('anfeta', 'N/A')}, "
                f"COCA={toxico.get('coca', 'N/A')}, "
                f"MARIHUA={toxico.get('marihua', 'N/A')}",
                styles["EbookBody"],
            )
        )

    if ego and _dict_has_value(ego):
        elements.append(
            Paragraph(
                f"<b>EGO:</b> {ego.get('descripcion', ego.get('resultado', 'N/A'))}",
                styles["EbookBody"],
            )
        )

    return elements


def _render_campimetria(campi: Dict[str, Any], styles) -> List[Any]:
    """Renderiza sección de campimetría."""
    elements: List[Any] = []
    elements.append(Paragraph("Campimetría", styles["EbookH2"]))
    elements.append(
        Paragraph(
            f"<b>Agudeza Visual:</b> {campi.get('agudezaVisual', 'N/A')} &nbsp;|&nbsp; "
            f"<b>Campos:</b> {campi.get('camposVisuales', 'N/A')} &nbsp;|&nbsp; "
            f"<b>Color:</b> {campi.get('discriminacionColor', 'N/A')}",
            styles["EbookBody"],
        )
    )
    return elements


def _render_examen_medico(examen: Dict[str, Any], styles) -> List[Any]:
    """Renderiza sección de examen médico."""
    elements: List[Any] = []
    elements.append(Paragraph("Examen Médico", styles["EbookH2"]))
    elements.append(
        Paragraph(
            f"<b>Peso:</b> {examen.get('peso', 'N/A')} kg &nbsp;|&nbsp; "
            f"<b>Talla:</b> {examen.get('talla', 'N/A')} cm &nbsp;|&nbsp; "
            f"<b>IMC:</b> {examen.get('imc', 'N/A')} &nbsp;|&nbsp; "
            f"<b>TA:</b> {examen.get('presionArterial', 'N/A')}",
            styles["EbookBody"],
        )
    )
    dx = examen.get("diagnostico", "")
    if dx:
        elements.append(
            Paragraph(f"<b>Diagnóstico:</b> {dx}", styles["EbookBody"])
        )
    return elements


# ------------------------------------------------------------------
# Helper: descarga + compresión + embed de imagen de estudio (Fase 2)
# ------------------------------------------------------------------
def _render_imagen_estudio(
    file_url: str,
    caption: str,
    image_fetcher_instance: Any,
    tempfiles: List[str],
    styles,
) -> List[Any]:
    """
    Descarga, comprime y embebe una imagen de estudio en el PDF.

    - Si `image_fetcher_instance` es None: retorna [] (skip silencioso).
    - Si la descarga falla: retorna Paragraph de aviso (no rompe el PDF).
    - Si es PDF: lo registra para merge posterior con pypdf y muestra caption.
    - Si es JPG/PNG: lo embebe con RLImage escalada al ancho de página.
    """
    elements: List[Any] = []

    if image_fetcher_instance is None:
        return elements

    # Detectar interfaz: módulo image_fetcher (fetch_image/compress_image/is_pdf)
    # o adaptador (fetch/compress/is_pdf).
    fetch_fn = getattr(image_fetcher_instance, "fetch", None) or getattr(
        image_fetcher_instance, "fetch_image", None
    )
    compress_fn = getattr(image_fetcher_instance, "compress", None) or getattr(
        image_fetcher_instance, "compress_image", None
    )
    is_pdf_fn = getattr(image_fetcher_instance, "is_pdf", None)

    if not (fetch_fn and compress_fn and is_pdf_fn):
        logger.warning(
            "_render_imagen_estudio: image_fetcher_instance no expone la "
            "interfaz esperada (fetch/compress/is_pdf)"
        )
        return elements

    try:
        raw = fetch_fn(file_url)
        if not raw:
            elements.append(
                Paragraph(
                    f"<i>{caption}: imagen no disponible</i>",
                    styles["EbookBody"],
                )
            )
            return elements

        compressed = compress_fn(raw)

        if is_pdf_fn(compressed):
            # PDFs nativos: se mergean al final del ebook con pypdf.
            elements.append(
                Paragraph(
                    f"<i>{caption}: PDF detectado (se mergea al final del "
                    f"ebook como página adicional).</i>",
                    styles["EbookBody"],
                )
            )
            _pending_pdfs_list().append((file_url, caption))
        else:
            # JPG/PNG: embeber inline escalada.
            tmp = tempfile.NamedTemporaryFile(
                suffix=".png", delete=False
            )
            tmp.write(compressed)
            tmp.close()
            elements.append(Spacer(1, 0.1 * inch))
            elements.append(
                Paragraph(
                    f"<i>{caption}:</i>",
                    styles["EbookBody"],
                )
            )
            elements.append(
                RLImage(tmp.name, width=5.5 * inch, height=3.5 * inch)
            )
            elements.append(Spacer(1, 0.1 * inch))
            # Diferir cleanup hasta post-build.
            tempfiles.append(tmp.name)

    except Exception as exc:
        logger.warning(
            "_render_imagen_estudio: error procesando %s: %s",
            file_url,
            exc,
        )
        elements.append(
            Paragraph(
                f"<i>{caption}: error al cargar ({(str(exc) or '')[:50]})</i>",
                styles["EbookBody"],
            )
        )

    return elements


# ------------------------------------------------------------------
# Cola de PDFs pendientes de merge al final del ebook (Fase 2)
# ------------------------------------------------------------------
_PENDING_PDFS: List[Any] = []  # [(file_url, caption), ...]


def _pending_pdfs_list() -> List[Any]:
    """Retorna la lista global de PDFs pendientes de merge al final."""
    return _PENDING_PDFS


def _merge_pending_pdfs(
    output_path: str,
    image_fetcher_instance: Any,
) -> None:
    """
    Después de doc.build(), mergea los PDFs nativos pendientes (audiometría,
    laboratorio, etc.) al final del ebook con pypdf.
    Si no hay pendientes o falla el merge, no rompe la generación.
    """
    if not _PENDING_PDFS or image_fetcher_instance is None:
        return

    fetch_fn = getattr(image_fetcher_instance, "fetch", None) or getattr(
        image_fetcher_instance, "fetch_image", None
    )
    if not fetch_fn:
        return

    try:
        from pypdf import PdfReader, PdfWriter

        writer = PdfWriter()
        for page in PdfReader(output_path).pages:
            writer.add_page(page)

        for file_url, _caption in _PENDING_PDFS:
            try:
                pdf_bytes = fetch_fn(file_url)
                if not pdf_bytes:
                    continue
                tmp_pdf = tempfile.NamedTemporaryFile(
                    suffix=".pdf", delete=False
                )
                tmp_pdf.write(pdf_bytes)
                tmp_pdf.close()
                for page in PdfReader(tmp_pdf.name).pages:
                    writer.add_page(page)
                try:
                    os.unlink(tmp_pdf.name)
                except OSError:
                    pass
            except Exception as exc:
                logger.warning(
                    "_merge_pending_pdfs: error mergeando %s: %s",
                    file_url,
                    exc,
                )

        with open(output_path, "wb") as fh:
            writer.write(fh)
    except Exception as exc:
        logger.warning(
            "_merge_pending_pdfs: error general mergeando PDFs: %s", exc
        )
    finally:
        _PENDING_PDFS.clear()


# ------------------------------------------------------------------
# Footer / encabezados
# ------------------------------------------------------------------
def _footer_portada(canvas, doc):
    # La portada no lleva footer ni header (limpio).
    canvas.saveState()
    canvas.restoreState()


def _footer_normal(canvas, doc):
    canvas.saveState()
    canvas.setFont(FONT_NAME, 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawCentredString(
        letter[0] / 2,
        0.5 * inch,
        f"AMI — EBOOK — Página {doc.page}",
    )
    canvas.restoreState()


# ------------------------------------------------------------------
# Bookmarks nativos PDF (registrados post-build)
# ------------------------------------------------------------------
def _register_bookmarks(
    pdf_path: str, bookmarks: Dict[str, str]
) -> None:
    """
    Re-abre el PDF generado y registra bookmarks/outline entries.
    El bookmark apunta al inicio de la página 1 (Fase 1: simplificado,
    Fase 2 puede usar posiciones precisas por sección).
    """
    if not bookmarks:
        return
    try:
        from pypdf import PdfReader, PdfWriter

        reader = PdfReader(pdf_path)
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)

        for name in bookmarks.values():
            try:
                writer.add_outline_item(name, 0)  # apunta a página 1
            except Exception as exc:
                logger.debug(
                    "Bookmark '%s' no se pudo registrar: %s", name, exc
                )

        with open(pdf_path, "wb") as fh:
            writer.write(fh)
    except Exception as exc:
        logger.warning(
            "No se pudieron registrar bookmarks en %s: %s", pdf_path, exc
        )


# ------------------------------------------------------------------
# Util: ¿tiene estudios el trabajador?
# ------------------------------------------------------------------
def _tiene_estudios(trabajador: Dict[str, Any]) -> bool:
    for key in [
        "audiometria",
        "espirometria",
        "rxColumna",
        "rxTorax",
        "ecg",
        "laboratorio",
        "campimetria",
    ]:
        estudio = trabajador.get(key) or {}
        for v in estudio.values():
            if isinstance(v, dict):
                if any(_v_has_value(x) for x in v.values()):
                    return True
            elif _v_has_value(v):
                return True
    return False


def _v_has_value(v: Any) -> bool:
    if v is None:
        return False
    if isinstance(v, str) and v.strip().upper() in ("", "N/A", "NA"):
        return False
    return True


def _dict_has_value(d: Optional[Dict[str, Any]]) -> bool:
    """
    True si el dict tiene al menos un valor no vacío (recursivo para sub-dicts).
    Usado para decidir si renderizar una sección clínica.
    """
    if not d or not isinstance(d, dict):
        return False
    for v in d.values():
        if isinstance(v, dict):
            if _dict_has_value(v):
                return True
        elif _v_has_value(v):
            return True
    return False