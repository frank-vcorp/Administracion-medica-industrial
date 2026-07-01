# HANDOFF IMPL-20260701-01 → SOFIA: EBOOK PDF - FASE 1 (Core + Imagen Embebida)

**De:** INTEGRA (arquitectura)
**Para:** SOFIA (implementación)
**SPEC:** `context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md` (v3, 15 decisiones arquitectónicas confirmadas)
**Origen:** Frank Saavedra — reemplazar carpeta física manual por ebook PDF autocontenido
**ID de este IMPL:** IMPL-20260701-01

## Objetivo del handoff

Implementar **Fase 1** del SPEC del ebook PDF: core de generación con tamaño Carta, portada + TOC + Resumen Ejecutivo + primera sección de estadísticas con mini-gráfica matplotlib + primera sección de trabajador con imagen embebida. NO incluye integración frontend ni el resto de secciones — eso son Fases 2-4.

## ⚠️ DECISIONES ARQUITECTÓNICAS YA TOMADAS (NO discutir, solo aplicar)

| # | Decisión | Valor |
|---|----------|-------|
| 1 | Stack | **reportlab (Python)** + pypdf para merge de PDFs |
| 2 | Tamaño página | **Carta/Letter (8.5×11in)** — NO A4 |
| 3 | Max trabajadores | 300 |
| 4 | Mini-gráficas | **SÍ con matplotlib** (Agg backend non-interactive) |
| 5 | Imágenes originales | **Embebidas inline** en cada sección de trabajador |
| 6 | Storage entrega | **Un solo PDF portable autocontenido** |
| 7 | Compresión imágenes | PIL thumbnail max 1500px, JPEG 80% si >500KB |
| 8 | PDFs de estudios | Mergear con pypdf (preserva fidelidad médica) |
| 9 | Streaming | NO (esperar PDF completo) |
| 10 | Historial | NO en ebook (solo proyecto actual) |
| 11 | Traducción | NO server-side (browser built-in) |
| 12 | Orden trabajadores | Alfabético por apellido, luego nombre |
| 13 | Sin estudios | Mostrar "Sin estudios realizados" |
| 14 | Logo | Placeholder (texto/imagen genérica hasta feedback Leticia) |
| 15 | Orden alfabético | `sorted(trabajadores, key=lambda w: (w['apellido'], w['nombre']))` |

## Archivos a leer ANTES de empezar (orden estricto)

1. `context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md` — SPEC completo (13 secciones)
2. `context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md` — contexto funcional
3. `backend/app/services/reports/massive_report.py` — adaptadores existentes (`_audiometria()`, `_espirometria()`, etc.)
4. `backend/app/services/reports/pdf_writer.py` — PDF actual a deprecar (referencia de estructura)
5. `backend/app/services/reports/conteos.py` — funciones de agregación (`calcular_hbc_por_rango`, etc.)
6. `frontend/src/lib/demo/pdf-generator.tsx` — referencia de layout (Portada + TablaConcentrado)
7. `frontend/prisma/schema.prisma` línea 256 — `EventTest.fileUrl` campo
8. `backend/app/main.py` líneas 54-56, 579-630 — cómo se sirven archivos (UPLOAD_DIR + /api/files)
9. `backend/requirements.txt` — dependencias existentes (openpyxl, reportlab, pytest-asyncio)

## Alcance EXACTO de Fase 1

### ✅ Lo que SÍ debes implementar

1. **Nuevo archivo:** `backend/app/services/reports/pdf_ebook_writer.py`
2. **Nuevo archivo:** `backend/app/services/storage/__init__.py` (paquete)
3. **Nuevo archivo:** `backend/app/services/storage/image_fetcher.py` (helper para descargar imágenes)
4. **Nuevo archivo:** `backend/tests/test_pdf_ebook_writer.py` (pytest)
5. **Modificar:** `backend/requirements.txt` (agregar `pypdf`, `matplotlib`, `Pillow` si no están)

### ✅ Lo que el archivo `pdf_ebook_writer.py` debe contener en Fase 1

```python
# Pseudo-estructura
def generar_ebook(project_snapshot: Dict[str, Any], output_path: str) -> str:
    """
    Genera el PDF ebook completo.
    Retorna path del archivo generado.
    """
    canvas = Canvas(output_path, pagesize=letter)  # 8.5×11in
    
    # 1. PORTADA (1 página)
    render_portada(canvas, project)
    
    # 2. TOC con hyperlinks (placeholder, 1-2 páginas)
    render_toc(canvas, project)  # skeleton
    
    # 3. RESUMEN EJECUTIVO (1 página)
    render_resumen_ejecutivo(canvas, project)
    
    # 4. ESTADÍSTICAS II.1 AUDIOMETRÍA (1 página CON GRÁFICA)
    render_estadistica_audiometria(canvas, project)  # INCLUYE mini-gráfica matplotlib
    
    # 5. SECCIÓN III.1 PRIMER TRABAJADOR (3-5 páginas CON IMAGEN)
    primer_trabajador = sorted(project['trabajadores'], key=ordenar_alfabetico)[0]
    render_seccion_trabajador(canvas, primer_trabajador, imagen_audiometria=True)
    
    # Bookmark setup básico
    setup_bookmarks(canvas)
    
    canvas.save()
    return output_path
```

### ✅ Lo que el helper `image_fetcher.py` debe hacer en Fase 1

```python
def fetch_image(file_url: str, base_url: str = None) -> bytes:
    """
    Descarga bytes de imagen desde storage.
    - Si file_url empieza con /uploads → local
    - Si file_url empieza con /api/files → backend
    Retorna bytes de la imagen o None si falla.
    """
    # Implementación: usa httpx o requests
    # Manejo de errores: log warning + retornar None

def compress_image(image_bytes: bytes, max_size_kb: int = 500) -> bytes:
    """
    Comprime imagen con PIL.
    - Resize a max 1500px si >1500px
    - Convierte PNG >max_size_kb a JPEG 80%
    Retorna bytes comprimidos.
    """
```

## Tareas específicas (ejecutar en este orden)

### Tarea 1: Verificar/Agregar dependencias

```bash
# Leer backend/requirements.txt
# Verificar si existen: pypdf, matplotlib, Pillow
# Si NO existen, agregar:
echo "pypdf>=3.0.0" >> backend/requirements.txt
echo "matplotlib>=3.5.0" >> backend/requirements.txt
echo "Pillow>=9.0.0" >> backend/requirements.txt

# Instalar localmente para desarrollo
pip install pypdf matplotlib Pillow
```

### Tarea 2: Crear paquete storage helper

```bash
mkdir -p backend/app/services/storage
touch backend/app/services/storage/__init__.py
```

**Archivo `backend/app/services/storage/image_fetcher.py`:**
- Función `fetch_image(file_url: str) -> Optional[bytes]`
- Función `compress_image(image_bytes: bytes) -> bytes`
- Función `is_pdf(image_bytes: bytes) -> bool` (magic bytes `%PDF`)
- Función `is_supported_format(image_bytes: bytes) -> bool`

### Tarea 3: Crear `pdf_ebook_writer.py`

**Esqueleto mínimo viable:**

```python
# backend/app/services/reports/pdf_ebook_writer.py
"""
Generador del PDF Ebook que reemplaza la carpeta física.
SPEC: context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md
ID: IMPL-20260701-01
"""
from typing import Dict, Any, List, Optional
from io import BytesIO
import logging
import tempfile

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import Canvas
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

import matplotlib
matplotlib.use('Agg')  # Non-interactive backend (CRÍTICO: NO display)
import matplotlib.pyplot as plt

from app.services.storage.image_fetcher import fetch_image, compress_image
from app.services.reports.conteos import calcular_hbc_por_rango

logger = logging.getLogger(__name__)

# Registrar TTF para unicode (ñ, á, é, í)
try:
    pdfmetrics.registerFont(TTFont('DejaVu', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('DejaVu-Bold', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    FONT_NAME = 'DejaVu'
except Exception as e:
    logger.warning(f"No se pudo registrar DejaVu, usando Helvetica: {e}")
    FONT_NAME = 'Helvetica'


def generar_ebook(project: Dict[str, Any], output_path: str) -> str:
    """
    Genera el PDF ebook completo (Fase 1: solo portada + TOC + resumen + II.1 + III.1).
    Retorna el path del archivo generado.
    """
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,  # 8.5×11in
        topMargin=2*inch,
        bottomMargin=2*inch,
        leftMargin=2*inch,
        rightMargin=2*inch,
    )
    
    styles = getSampleStyleSheet()
    styles.add(ParagraphStyle(name='CustomTitle', fontName=FONT_NAME, fontSize=24, spaceAfter=20))
    styles.add(ParagraphStyle(name='CustomH1', fontName=FONT_NAME, fontSize=18, spaceAfter=12, textColor=colors.HexColor('#1e293b')))
    styles.add(ParagraphStyle(name='CustomH2', fontName=FONT_NAME, fontSize=14, spaceAfter=8, textColor=colors.HexColor('#334155')))
    styles.add(ParagraphStyle(name='CustomBody', fontName=FONT_NAME, fontSize=10, leading=14))
    
    story = []
    bookmarks = {}  # name -> page_number (placeholder, calcular después)
    
    # 1. PORTADA
    story.extend(_render_portada(project, styles))
    story.append(PageBreak())
    
    # 2. TOC (placeholder, mejorar en Fase 1)
    story.extend(_render_toc_placeholder(project, styles))
    story.append(PageBreak())
    
    # 3. RESUMEN EJECUTIVO
    story.extend(_render_resumen_ejecutivo(project, styles))
    story.append(PageBreak())
    
    # 4. II.1 AUDIOMETRÍA CON GRÁFICA
    story.extend(_render_estadistica_audiometria(project, styles))
    story.append(PageBreak())
    
    # 5. III.1 PRIMER TRABAJADOR CON IMAGEN
    primer_trabajador = sorted(
        project.get('trabajadores', []),
        key=lambda w: (
            w.get('nombre', '').split()[-1] if w.get('nombre') else '',  # apellido
            w.get('nombre', '')
        )
    )[0] if project.get('trabajadores') else None
    
    if primer_trabajador:
        story.extend(_render_seccion_trabajador(primer_trabajador, styles))
    
    doc.build(story)
    logger.info(f"EBOOK generado: {output_path}")
    return output_path


def _render_portada(project: Dict[str, Any], styles) -> List:
    """Renderiza portada con logo placeholder + título + metadata."""
    elements = []
    
    # Logo placeholder (cuadrado gris con texto)
    elements.append(Spacer(1, 1*inch))
    elements.append(Paragraph(
        '[LOGO SOLUCIONES — placeholder hasta feedback Leticia]',
        ParagraphStyle('LogoPlaceholder', parent=styles['CustomBody'], alignment=1, textColor=colors.grey)
    ))
    elements.append(Spacer(1, 1*inch))
    
    elements.append(Paragraph('Diagnóstico Situacional', styles['CustomTitle']))
    elements.append(Paragraph(project.get('empresa', 'Proyecto'), styles['CustomH2']))
    elements.append(Spacer(1, 0.5*inch))
    
    # Metadata
    metadata = [
        f"Empresa legal: {project.get('empresaLegal', 'N/A')}",
        f"Fecha del estudio: {project.get('fecha', 'N/A')}",
        f"Total trabajadores: {len(project.get('trabajadores', []))}",
        '',
        'Generado por: AMI — Sistema de Administración Médica Industrial',
        'Módulo: Reportes Masivos por Proyecto',
    ]
    for line in metadata:
        elements.append(Paragraph(line, styles['CustomBody']))
    
    return elements


def _render_toc_placeholder(project: Dict[str, Any], styles) -> List:
    """TOC placeholder. Mejorar en iteraciones siguientes."""
    elements = []
    elements.append(Paragraph('Índice', styles['CustomH1']))
    
    # Por ahora texto plano (los hyperlinks se agregarán cuando Platypus lo soporte mejor)
    toc_entries = [
        'I. Resumen Ejecutivo',
        'II. Estadísticas Agregadas',
        '   II.1 Audiometría (%HBC)',
        '   II.2 Trauma Acústico por Área',
        '   II.3 Espirometría',
        '   II.4 RX Columna',
        '   II.5 RX Tórax',
        '   II.6 ECG',
        '   II.7 Campimetría',
        '   II.8 Laboratorio',
        f'III. Reportes Individuales ({len(project.get("trabajadores", []))} trabajadores)',
    ]
    for entry in toc_entries:
        elements.append(Paragraph(entry, styles['CustomBody']))
    
    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph(
        '<i>Nota: Los bookmarks están disponibles en el panel del lector PDF (Chrome, Adobe).</i>',
        styles['CustomBody']
    ))
    
    return elements


def _render_resumen_ejecutivo(project: Dict[str, Any], styles) -> List:
    """Renderiza resumen ejecutivo con conteos."""
    elements = []
    elements.append(Paragraph('I. Resumen Ejecutivo', styles['CustomH1']))
    elements.append(Spacer(1, 0.2*inch))
    
    trabajadores = project.get('trabajadores', [])
    
    # Conteos básicos
    total = len(trabajadores)
    sin_estudios = sum(1 for w in trabajadores if not _tiene_estudios(w))
    con_estudios = total - sin_estudios
    
    data = [
        ['Métrica', 'Valor'],
        ['Total trabajadores', str(total)],
        ['Con al menos 1 estudio', str(con_estudios)],
        ['Sin estudios registrados', str(sin_estudios)],
    ]
    
    tabla = Table(data, colWidths=[3*inch, 2*inch])
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, -1), FONT_NAME),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ]))
    
    elements.append(tabla)
    return elements


def _render_estadistica_audiometria(project: Dict[str, Any], styles) -> List:
    """Renderiza II.1 Audiometría CON mini-gráfica matplotlib de %HBC."""
    elements = []
    elements.append(Paragraph('II.1 Audiometría (%HBC)', styles['CustomH1']))
    elements.append(Spacer(1, 0.1*inch))
    
    # Calcular datos
    hbc = calcular_hbc_por_rango(project)
    
    # Texto resumen
    elements.append(Paragraph(
        f"Normal (&lt;10%): {hbc['normal']} | Alto (10-19%): {hbc['alto']} | Muy Alto (≥20%): {hbc['muyAlto']}",
        styles['CustomBody']
    ))
    elements.append(Spacer(1, 0.2*inch))
    
    # Generar mini-gráfica matplotlib
    grafica_path = _generar_grafica_hbc(hbc)
    if grafica_path:
        from reportlab.platypus import Image as RLImage
        elements.append(RLImage(grafica_path, width=5*inch, height=3*inch))
    
    return elements


def _generar_grafica_hbc(hbc: Dict[str, int]) -> Optional[str]:
    """Genera mini-gráfica de barras %HBC con matplotlib."""
    try:
        fig, ax = plt.subplots(figsize=(5, 3), dpi=100)
        categorias = ['Normal (<10%)', 'Alto (10-19%)', 'Muy Alto (≥20%)']
        valores = [hbc['normal'], hbc['alto'], hbc['muyAlto']]
        colores = ['#10b981', '#f59e0b', '#ef4444']
        
        ax.bar(categorias, valores, color=colores)
        ax.set_ylabel('Trabajadores')
        ax.set_title('Distribución %HBC')
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        plt.tight_layout()
        
        # Guardar a temp file
        tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        plt.savefig(tmp.name, format='png', dpi=100, bbox_inches='tight')
        plt.close(fig)
        return tmp.name
    except Exception as e:
        logger.error(f"Error generando gráfica HBC: {e}")
        return None


def _render_seccion_trabajador(trabajador: Dict[str, Any], styles) -> List:
    """Renderiza sección III.X con datos del trabajador + imagen de audiometría embebida."""
    elements = []
    
    # Header
    nombre = trabajador.get('nombre', 'Sin nombre')
    elements.append(Paragraph(f"{nombre}", styles['CustomH1']))
    elements.append(Paragraph(
        f"Folio: {trabajador.get('folio', 'N/A')} | "
        f"Sexo: {trabajador.get('sexo', 'N/A')} | "
        f"Área: {trabajador.get('area', 'N/A')} | "
        f"Antigüedad: {trabajador.get('antiguedad', 'N/A')}",
        styles['CustomBody']
    ))
    elements.append(Spacer(1, 0.2*inch))
    
    # Audiometría (datos estructurados)
    audio = trabajador.get('audiometria', {})
    if audio and any(audio.values()):
        elements.append(Paragraph('Audiometría', styles['CustomH2']))
        elements.append(Paragraph(
            f"DX: {audio.get('dx', 'N/A')} | "
            f"OD: {audio.get('oidoDerecho', 'N/A')} | "
            f"OI: {audio.get('oidoIzquierdo', 'N/A')} | "
            f"%HBC: {audio.get('hbc', 'N/A')}",
            styles['CustomBody']
        ))
        
        # IMAGEN EMBEBIDA (si existe fileUrl en audiometría)
        # En Fase 1, simulamos con una imagen dummy para validar el flujo
        # En Fase 2 se conectará al EventTest.fileUrl real
        img_path = _render_imagen_audiometria_ejemplo()
        if img_path:
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Paragraph('<i>Audiograma original (imagen embebida):</i>', styles['CustomBody']))
            from reportlab.platypus import Image as RLImage
            elements.append(RLImage(img_path, width=5*inch, height=3*inch))
            elements.append(Paragraph(
                '<i>Ejemplo en Fase 1. En Fase 2 se conectará a EventTest.fileUrl real.</i>',
                styles['CustomBody']
            ))
    
    return elements


def _render_imagen_audiometria_ejemplo() -> Optional[str]:
    """
    Genera una imagen dummy de audiograma para Fase 1.
    En Fase 2 se reemplaza con descarga real de EventTest.fileUrl.
    """
    try:
        fig, ax = plt.subplots(figsize=(8, 4), dpi=100)
        # Audiograma dummy
        frecuencias = [125, 250, 500, 1000, 2000, 4000, 8000]
        od_db = [10, 15, 20, 25, 30, 35, 40]
        oi_db = [12, 18, 22, 28, 32, 38, 42]
        
        ax.plot(frecuencias, od_db, 'o-', label='OD', color='blue')
        ax.plot(frecuencias, oi_db, 's-', label='OI', color='red')
        ax.set_xlabel('Frecuencia (Hz)')
        ax.set_ylabel('Umbral (dB)')
        ax.set_title('Audiograma (ejemplo Fase 1)')
        ax.legend()
        ax.grid(True, alpha=0.3)
        ax.invert_yaxis()
        plt.tight_layout()
        
        tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        plt.savefig(tmp.name, format='png', dpi=100, bbox_inches='tight')
        plt.close(fig)
        return tmp.name
    except Exception as e:
        logger.error(f"Error generando imagen dummy: {e}")
        return None


def _tiene_estudios(trabajador: Dict[str, Any]) -> bool:
    """Determina si un trabajador tiene al menos 1 estudio con datos."""
    for key in ['audiometria', 'espirometria', 'rxColumna', 'rxTorax', 'ecg', 'laboratorio']:
        estudio = trabajador.get(key, {})
        if estudio and any(v for v in estudio.values() if v and v != 'N/A' and v != ''):
            return True
    return False
```

### Tarea 4: Crear `test_pdf_ebook_writer.py`

**Mínimo 5 tests:**

1. `test_ebook_generates_with_1_worker` — PDF genera con 1 trabajador, retorna path
2. `test_ebook_uses_letter_size` — Verificar `pagesize=letter` (8.5×11in = 612×792pt)
3. `test_ebook_has_portada_resumen_estadistica_trabajador` — Verificar contenido mínimo
4. `test_ebook_includes_audiometria_grafica` — Verificar que II.1 incluye la mini-gráfica
5. `test_ebook_trabajador_ordenado_alfabetico` — Verificar orden por apellido

```python
# backend/tests/test_pdf_ebook_writer.py
import pytest
from pathlib import Path
from pypdf import PdfReader
from app.services.reports.pdf_ebook_writer import generar_ebook


@pytest.fixture
def project_ejemplo():
    return {
        'id': 'test-1',
        'empresa': 'TEST S.A.',
        'empresaLegal': 'TEST S.A. DE C.V.',
        'fecha': '2026-06-30',
        'trabajadores': [
            {
                'folio': '001',
                'nombre': 'VELAZQUEZ MORENO LORENZO',
                'sexo': 'MASCULINO',
                'area': 'SOLDADURA',
                'antiguedad': '5 AÑOS',
                'audiometria': {'dx': 'NORMAL', 'oidoDerecho': 'Normal', 'oidoIzquierdo': 'Normal', 'hbc': -1.25},
                'espirometria': {'patron': 'NORMAL', 'fvc': 0.93, 'tabaquismo': 'NEGADO'},
                'rxColumna': {},
                'rxTorax': {},
                'ecg': {},
                'laboratorio': {},
            },
            {
                'folio': '002',
                'nombre': 'AGUILAR ARREOLA JOSE DAVID',
                'sexo': 'MASCULINO',
                'area': 'SOLDADURA',
                'antiguedad': '3 AÑOS',
                'audiometria': {'dx': 'NORMAL', 'oidoDerecho': 'Normal', 'oidoIzquierdo': 'Normal', 'hbc': 0.5},
                'espirometria': {},
                'rxColumna': {},
                'rxTorax': {},
                'ecg': {},
                'laboratorio': {},
            },
        ],
    }


def test_ebook_generates_with_1_worker(project_ejemplo, tmp_path):
    output = tmp_path / "ebook_test.pdf"
    result = generar_ebook(project_ejemplo, str(output))
    assert Path(result).exists()
    assert Path(result).stat().st_size > 1000  # Al menos 1KB


def test_ebook_uses_letter_size(project_ejemplo, tmp_path):
    output = tmp_path / "ebook_test.pdf"
    generar_ebook(project_ejemplo, str(output))
    reader = PdfReader(str(output))
    page = reader.pages[0]
    # letter = 612×792 pt
    assert int(page.mediabox.width) == 612
    assert int(page.mediabox.height) == 792


def test_ebook_has_multiple_sections(project_ejemplo, tmp_path):
    output = tmp_path / "ebook_test.pdf"
    generar_ebook(project_ejemplo, str(output))
    reader = PdfReader(str(output))
    assert len(reader.pages) >= 5  # Portada + TOC + Resumen + II.1 + III.1


def test_ebook_trabajador_ordenado_alfabetico(project_ejemplo, tmp_path):
    """Verificar que AGUILAR (apellido A) aparece antes que VELAZQUEZ (apellido V)."""
    output = tmp_path / "ebook_test.pdf"
    generar_ebook(project_ejemplo, str(output))
    reader = PdfReader(str(output))
    # Buscar texto en las páginas (simplificado)
    full_text = ""
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ""
        except Exception:
            pass
    
    pos_aguilar = full_text.find('AGUILAR')
    pos_velazquez = full_text.find('VELAZQUEZ')
    
    assert pos_aguilar > 0
    assert pos_velazquez > 0
    assert pos_aguilar < pos_velazquez, f"AGUILAR debe aparecer antes que VELAZQUEZ"
```

## Validaciones obligatorias antes de cerrar Fase 1

```bash
# 1. Sintaxis Python
cd backend && python -m py_compile app/services/reports/pdf_ebook_writer.py
cd backend && python -m py_compile app/services/storage/image_fetcher.py

# 2. Tests
cd backend && pytest tests/test_pdf_ebook_writer.py -v

# 3. Smoke test manual
cd backend && python -c "
from app.services.reports.pdf_ebook_writer import generar_ebook
project = {
    'empresa': 'TEST', 'empresaLegal': 'TEST S.A.',
    'fecha': '2026-06-30',
    'trabajadores': [{
        'folio': '001', 'nombre': 'VELAZQUEZ LORENZO', 'sexo': 'M',
        'area': 'X', 'antiguedad': '5',
        'audiometria': {'dx': 'NORMAL', 'oidoDerecho': 'Normal', 'oidoIzquierdo': 'Normal', 'hbc': 0},
        'espirometria': {}, 'rxColumna': {}, 'rxTorax': {}, 'ecg': {}, 'laboratorio': {},
    }]
}
generar_ebook(project, '/tmp/test_ebook.pdf')
import os
print(f'PDF generado: {os.path.getsize(\"/tmp/test_ebook.pdf\")} bytes')
"
# Abrir /tmp/test_ebook.pdf y verificar visualmente:
# - Tamaño Carta
# - Portada con placeholder logo
# - TOC con índice
# - Resumen ejecutivo
# - II.1 con mini-gráfica de barras
# - III.1 con datos del trabajador + imagen dummy de audiograma
```

## Self-review antes de reportar como listo

- [ ] ¿PDF usa tamaño Carta (612×792pt)?
- [ ] ¿Mini-gráfica matplotlib visible en II.1?
- [ ] ¿Trabajadores ordenados alfabéticamente por apellido?
- [ ] ¿Logo placeholder presente (no asume logo real)?
- [ ] ¿Unicode (ñ, á, é) renderiza (TTF registrado)?
- [ ] ¿5 tests pasan?
- [ ] ¿No introduzco cambios al código existente fuera de `pdf_ebook_writer.py`, `image_fetcher.py`, `requirements.txt`, `test_pdf_ebook_writer.py`?
- [ ] ¿No commiteo ni pusheo (esperando OK Frank)?

## Al cerrar Fase 1

Reportar a INTEGRA con:

1. ✅/❌ de pytest (5/5)
2. ✅/❌ de smoke test manual
3. Captura de pantalla del PDF generado (o path del PDF para que INTEGRA lo revise)
4. Self-review con checklist
5. Lista de issues encontrados (si hay)
6. Recomendación para Fase 2

**INTEGRA validará antes de pasar a Fase 2.**

## ❌ NO hacer en Fase 1

- ❌ NO modificar frontend (`ProjectMassiveReportModal`, `project-reports.actions`)
- ❌ NO modificar backend API (`reports.py`, `massive_report.py`)
- ❌ NO commitear ni pushear
- ❌ NO pedir qodo (sunset)
- ❌ NO invocar GEMINI directamente
- ❌ NO implementar las secciones de Espirometría/RX/ECG/etc en III.X (eso es Fase 2)
- ❌ NO implementar II.2-II.8 (eso es Fase 3)
- ❌ NO descargar imágenes reales de EventTest.fileUrl todavía (eso es Fase 2 — usar dummy matplotlib por ahora)

## Referencias

- SPEC completo: `context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md`
- Handoff anterior (referencia): `context/interconsultas/HANDOFF_IMPL-20260630-03_SOFIA_MODULO-REPORTES.md`
- Demo funcional (referencia visual): https://administracion-medica-industrial.vercel.app/demo/reports/valiant-umm-demo
- Reportlab Platypus: https://www.reportlab.com/dev/overview/
- matplotlib Agg backend: https://matplotlib.org/stable/users/explain/figure/backends.html
- pypdf merge: https://pypdf.readthedocs.io/en/stable/usage.html
- PIL Image.thumbnail: https://pillow.readthedocs.io/en/stable/reference/Image.html