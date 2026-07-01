# HANDOFF IMPL-20260701-02 → SOFIA: EBOOK PDF - FASE 2 (8 secciones + imágenes reales)

**De:** INTEGRA
**Para:** SOFIA
**Continúa de:** IMPL-20260701-01 (Fase 1 ya implementada, 5/5 tests verde)
**SPEC:** `context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md`

## Objetivo

Ampliar `pdf_ebook_writer.py` para soportar las **8 secciones clínicas por trabajador** (Audiometría, Espirometría, RX Columna, RX Tórax, ECG, Laboratorio, Campimetría, Examen Médico) con **imágenes reales descargadas desde EventTest.fileUrl** + renderizar **TODOS los trabajadores** (no solo el primero).

## ⚠️ SCOPE TIGHT — para evitar límite de pasos

Esta fase es grande. **Si te quedas sin steps**, prioriza en este orden y reporta lo que alcanzaste:

1. **PRIORIDAD 1**: Render condicional de las 8 secciones (sin imágenes todavía, solo datos estructurados)
2. **PRIORIDAD 2**: Loop por TODOS los trabajadores con PageBreak entre ellos
3. **PRIORIDAD 3**: Imagen embebida para audiometría (la más común)
4. **PRIORIDAD 4**: Imágenes para las otras 7 secciones
5. **PRIORIDAD 5**: Tests pytest de combinaciones

Si solo alcanzas PRIORIDAD 1+2, eso ya es un avance enorme. Reporta el límite real al final.

## Tareas (ejecutar en este orden estricto)

### Tarea 1: Extender `_render_seccion_trabajador()`

**Archivo:** `backend/app/services/reports/pdf_ebook_writer.py`

Modificar la función para renderizar las 8 secciones clínicas de forma **condicional** (solo si hay datos):

```python
def _render_seccion_trabajador(trabajador: Dict[str, Any], styles: Dict, image_fetcher_instance=None) -> List:
    """
    Renderiza las 8 secciones clínicas de un trabajador.
    Solo renderiza secciones con datos.
    """
    from reportlab.platypus import Paragraph, Spacer, Image as RLImage, Table, TableStyle, PageBreak
    from reportlab.lib import colors
    
    elements = []
    nombre = trabajador.get('nombre', 'Sin nombre')
    
    # Header del trabajador
    elements.append(Paragraph(f"{nombre}", styles['H1']))
    elements.append(Paragraph(
        f"<b>Folio:</b> {trabajador.get('folio', 'N/A')} | "
        f"<b>Sexo:</b> {trabajador.get('sexo', 'N/A')} | "
        f"<b>Área:</b> {trabajador.get('area', 'N/A')} | "
        f"<b>Antigüedad:</b> {trabajador.get('antiguedad', 'N/A')}",
        styles['Body']
    ))
    elements.append(Spacer(1, 0.15*inch))
    
    # 1. AUDIOMETRÍA
    audio = trabajador.get('audiometria', {})
    if audio and any(v for v in audio.values() if v and v != 'N/A' and v != ''):
        elements.extend(_render_audiometria(audio, styles))
        # Si hay imagen del audiograma
        img_url = audio.get('fileUrl')
        if img_url and image_fetcher_instance:
            elements.extend(_render_imagen_estudio(img_url, 'Audiograma original', image_fetcher_instance))
    
    # 2. ESPIROMETRÍA
    espiro = trabajador.get('espirometria', {})
    if espiro and any(v for v in espiro.values() if v and v != 'N/A' and v != ''):
        elements.extend(_render_espirometria(espiro, styles))
        img_url = espiro.get('fileUrl')
        if img_url and image_fetcher_instance:
            elements.extend(_render_imagen_estudio(img_url, 'Curva flujo-volumen', image_fetcher_instance))
    
    # 3. RX COLUMNA
    rx_col = trabajador.get('rxColumna', {})
    if rx_col and any(v for v in rx_col.values() if v and v != 'N/A' and v != ''):
        elements.extend(_render_rx_columna(rx_col, styles))
        # RX Columna puede tener 2 imágenes: AP + lateral
        for idx, key in enumerate(['fileUrlAP', 'fileUrlLateral'], 1):
            img_url = rx_col.get(key)
            if img_url and image_fetcher_instance:
                label = 'RX Columna AP' if idx == 1 else 'RX Columna Lateral'
                elements.extend(_render_imagen_estudio(img_url, label, image_fetcher_instance))
    
    # 4. RX TÓRAX
    rx_torax = trabajador.get('rxTorax', {})
    if rx_torax and any(v for v in rx_torax.values() if v and v != 'N/A' and v != ''):
        elements.extend(_render_rx_torax(rx_torax, styles))
        img_url = rx_torax.get('fileUrl')
        if img_url and image_fetcher_instance:
            elements.extend(_render_imagen_estudio(img_url, 'RX Tórax PA', image_fetcher_instance))
    
    # 5. ECG
    ecg = trabajador.get('ecg', {})
    if ecg and any(v for v in ecg.values() if v and v != 'N/A' and v != ''):
        elements.extend(_render_ecg(ecg, styles))
        img_url = ecg.get('fileUrl')
        if img_url and image_fetcher_instance:
            elements.extend(_render_imagen_estudio(img_url, 'Trazo ECG', image_fetcher_instance))
    
    # 6. LABORATORIO
    lab = trabajador.get('laboratorio', {})
    if lab and any(v for v in lab.values() if v and v != 'N/A' and v != ''):
        elements.extend(_render_laboratorio(lab, styles))
        img_url = lab.get('fileUrl')
        if img_url and image_fetcher_instance:
            elements.extend(_render_imagen_estudio(img_url, 'Resultados de laboratorio', image_fetcher_instance))
    
    # 7. CAMPIMETRÍA
    campi = trabajador.get('campimetria', {})
    if campi and any(v for v in campi.values() if v and v != 'N/A' and v != ''):
        elements.extend(_render_campimetria(campi, styles))
    
    # 8. EXAMEN MÉDICO
    examen = trabajador.get('examenMedico', {})
    if examen and any(v for v in examen.values() if v and v != 'N/A' and v != ''):
        elements.extend(_render_examen_medico(examen, styles))
    
    return elements
```

### Tarea 2: Crear las 8 funciones `_render_X()`

Cada una retorna una lista de elementos Platypus. Patrón:

```python
def _render_audiometria(audio: Dict, styles: Dict) -> List:
    """Renderiza sección de audiometría."""
    elements = []
    elements.append(Paragraph('Audiometría', styles['H2']))
    elements.append(Paragraph(
        f"<b>DX:</b> {audio.get('dx', 'N/A')} | "
        f"<b>OD:</b> {audio.get('oidoDerecho', 'N/A')} | "
        f"<b>OI:</b> {audio.get('oidoIzquierdo', 'N/A')} | "
        f"<b>%HBC:</b> {audio.get('hbc', 'N/A')}",
        styles['Body']
    ))
    return elements


def _render_espirometria(espiro: Dict, styles: Dict) -> List:
    """Renderiza sección de espirometría."""
    elements = []
    elements.append(Paragraph('Espirometría', styles['H2']))
    elements.append(Paragraph(
        f"<b>Patrón:</b> {espiro.get('patron', 'N/A')} | "
        f"<b>FVC:</b> {espiro.get('fvc', 'N/A')} | "
        f"<b>Tabaquismo:</b> {espiro.get('tabaquismo', 'N/A')}",
        styles['Body']
    ))
    return elements


def _render_rx_columna(rx_col: Dict, styles: Dict) -> List:
    """Renderiza sección de RX columna."""
    elements = []
    elements.append(Paragraph('RX Columna', styles['H2']))
    elements.append(Paragraph(
        f"<b>Escoliosis:</b> {rx_col.get('escoliosis', 'N/A')}° | "
        f"<b>Lordosis:</b> {rx_col.get('lordosis', 'N/A')}° | "
        f"<b>Basculación:</b> {rx_col.get('basculacion', 'N/A')} cm",
        styles['Body']
    ))
    impresion = rx_col.get('impresion', '')
    if impresion:
        elements.append(Paragraph(f"<b>Impresión:</b> {impresion}", styles['Body']))
    return elements


def _render_rx_torax(rx_torax: Dict, styles: Dict) -> List:
    """Renderiza sección de RX tórax."""
    elements = []
    elements.append(Paragraph('RX Tórax', styles['H2']))
    impresion = rx_torax.get('impresion', 'N/A')
    elements.append(Paragraph(f"<b>Impresión:</b> {impresion}", styles['Body']))
    return elements


def _render_ecg(ecg: Dict, styles: Dict) -> List:
    """Renderiza sección de ECG."""
    elements = []
    elements.append(Paragraph('ECG', styles['H2']))
    impresion = ecg.get('impresion', 'N/A')
    elements.append(Paragraph(f"<b>Impresión:</b> {impresion}", styles['Body']))
    return elements


def _render_laboratorio(lab: Dict, styles: Dict) -> List:
    """Renderiza sección de laboratorio."""
    elements = []
    elements.append(Paragraph('Laboratorio', styles['H2']))
    
    bh = lab.get('bh', {})
    qs6 = lab.get('qs6', {})
    ego = lab.get('ego', {})
    toxico = lab.get('toxico', {})
    
    if bh:
        elements.append(Paragraph(
            f"<b>BH:</b> Hb={bh.get('hb', 'N/A')}, "
            f"MCHb={bh.get('mchb', 'N/A')}, "
            f"CHGM={bh.get('chgm', 'N/A')}, "
            f"LEU={bh.get('leu', 'N/A')}, "
            f"PLA={bh.get('pla', 'N/A')}",
            styles['Body']
        ))
    
    if qs6:
        elements.append(Paragraph(
            f"<b>QS6:</b> GLUC={qs6.get('gluc', 'N/A')}, "
            f"BUN={qs6.get('bun', 'N/A')}, "
            f"COL={qs6.get('col', 'N/A')}, "
            f"TRIG={qs6.get('trig', 'N/A')}",
            styles['Body']
        ))
    
    if toxico:
        elements.append(Paragraph(
            f"<b>Tóxico:</b> ANFETA={toxico.get('anfeta', 'N/A')}, "
            f"COCA={toxico.get('coca', 'N/A')}, "
            f"MARIHUA={toxico.get('marihua', 'N/A')}",
            styles['Body']
        ))
    
    return elements


def _render_campimetria(campi: Dict, styles: Dict) -> List:
    """Renderiza sección de campimetría."""
    elements = []
    elements.append(Paragraph('Campimetría', styles['H2']))
    elements.append(Paragraph(
        f"<b>Agudeza Visual:</b> {campi.get('agudezaVisual', 'N/A')} | "
        f"<b>Campos:</b> {campi.get('camposVisuales', 'N/A')} | "
        f"<b>Color:</b> {campi.get('discriminacionColor', 'N/A')}",
        styles['Body']
    ))
    return elements


def _render_examen_medico(examen: Dict, styles: Dict) -> List:
    """Renderiza sección de examen médico."""
    elements = []
    elements.append(Paragraph('Examen Médico', styles['H2']))
    elements.append(Paragraph(
        f"<b>Peso:</b> {examen.get('peso', 'N/A')} kg | "
        f"<b>Talla:</b> {examen.get('talla', 'N/A')} cm | "
        f"<b>IMC:</b> {examen.get('imc', 'N/A')} | "
        f"<b>TA:</b> {examen.get('presionArterial', 'N/A')}",
        styles['Body']
    ))
    dx = examen.get('diagnostico', '')
    if dx:
        elements.append(Paragraph(f"<b>Diagnóstico:</b> {dx}", styles['Body']))
    return elements
```

### Tarea 3: Helper para embeber imagen

```python
def _render_imagen_estudio(file_url: str, caption: str, image_fetcher_instance) -> List:
    """
    Descarga, comprime y embebe una imagen de estudio en el PDF.
    Si la descarga falla, retorna un mensaje de advertencia.
    """
    from reportlab.platypus import Paragraph, Spacer, Image as RLImage
    from reportlab.lib.units import inch
    import tempfile
    
    elements = []
    
    if not image_fetcher_instance:
        return elements
    
    try:
        # Descargar bytes
        image_bytes = image_fetcher_instance.fetch(file_url)
        if not image_bytes:
            elements.append(Paragraph(f"<i>{caption}: imagen no disponible</i>", styles['Body']))
            return elements
        
        # Comprimir con PIL
        compressed = image_fetcher_instance.compress(image_bytes)
        
        # Detectar tipo
        if image_fetcher_instance.is_pdf(compressed):
            # PDF: mergear con pypdf (esto se hace DESPUÉS del doc.build, ver Tarea 5)
            elements.append(Paragraph(f"<i>{caption}: PDF detectado (se embebrá al final)</i>", styles['Body']))
            # Marcar para merge posterior
            if not hasattr(_render_imagen_estudio, '_pending_pdfs'):
                _render_imagen_estudio._pending_pdfs = []
            _render_imagen_estudio._pending_pdfs.append((file_url, caption))
        else:
            # JPG/PNG: embeber directamente
            tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
            tmp.write(compressed)
            tmp.close()
            
            elements.append(Spacer(1, 0.1*inch))
            elements.append(Paragraph(f"<i>{caption}:</i>", styles['Body']))
            elements.append(RLImage(tmp.name, width=5*inch, height=3*inch, kind='proportional'))
            elements.append(Spacer(1, 0.1*inch))
    
    except Exception as e:
        elements.append(Paragraph(f"<i>{caption}: error al cargar ({str(e)[:50]})</i>", styles['Body']))
    
    return elements
```

### Tarea 4: Loop por TODOS los trabajadores

En `generar_ebook()`, cambiar la lógica de III:

```python
def generar_ebook(project_snapshot, output_path, image_fetcher_instance=None):
    # ... (mismo código de portada + TOC + resumen + II.1 audiometría)
    
    # III. TODOS los trabajadores
    trabajadores_ordenados = sorted(
        project_snapshot.get('trabajadores', []),
        key=lambda w: (
            w.get('nombre', '').split()[-1] if w.get('nombre') else '',  # apellido
            w.get('nombre', '')
        )
    )
    
    for idx, trabajador in enumerate(trabajadores_ordenados, 1):
        if idx > 1:  # PageBreak entre trabajadores (no antes del primero)
            elements.append(PageBreak())
        
        # Header de sección III
        elements.append(Paragraph(f'III Reportes Individuales', styles['H1']))
        elements.extend(_render_seccion_trabajador(
            trabajador, styles, image_fetcher_instance
        ))
    
    # ... (doc.build)
```

### Tarea 5 (OPCIONAL si alcanzas): Merge de PDFs nativos

Si un EventTest.fileUrl apunta a un PDF (audiometría, labs), mergearlo al final:

```python
# Después de doc.build()
if hasattr(_render_imagen_estudio, '_pending_pdfs'):
    from pypdf import PdfMerger
    merger = PdfMerger()
    merger.append(output_path)
    for file_url, caption in _render_imagen_estudio._pending_pdfs:
        try:
            pdf_bytes = image_fetcher_instance.fetch(file_url)
            if pdf_bytes:
                tmp_pdf = tempfile.NamedTemporaryFile(suffix='.pdf', delete=False)
                tmp_pdf.write(pdf_bytes)
                tmp_pdf.close()
                merger.append(tmp_pdf.name)
        except Exception:
            pass
    merger.write(output_path)
    merger.close()
```

## Modificaciones a tests existentes

Agregar en `backend/tests/test_pdf_ebook_writer.py`:

```python
def test_ebook_renders_all_workers(project_ejemplo, tmp_path):
    """Verifica que se renderizan TODOS los trabajadores, no solo el primero."""
    output = tmp_path / "ebook.pdf"
    generar_ebook(project_ejemplo, str(output))
    reader = PdfReader(str(output))
    full_text = ""
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ""
        except Exception:
            pass
    
    # Ambos trabajadores deben aparecer
    assert 'AGUILAR' in full_text
    assert 'VELAZQUEZ' in full_text


def test_ebook_renders_8_section_types(project_completo, tmp_path):
    """Verifica que las 8 secciones se renderizan cuando hay datos."""
    output = tmp_path / "ebook.pdf"
    generar_ebook(project_completo, str(output))
    reader = PdfReader(str(output))
    full_text = ""
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ""
        except Exception:
            pass
    
    for seccion in ['Audiometría', 'Espirometría', 'RX Columna', 'RX Tórax', 
                    'ECG', 'Laboratorio', 'Campimetría', 'Examen Médico']:
        assert seccion in full_text, f"Falta sección: {seccion}"


@pytest.fixture
def project_completo():
    """Proyecto con trabajador que tiene las 8 secciones con datos."""
    return {
        'empresa': 'TEST', 'empresaLegal': 'TEST S.A.', 'fecha': '2026-06-30',
        'trabajadores': [{
            'folio': '001', 'nombre': 'COMPLETO TRABAJADOR', 'sexo': 'M',
            'area': 'X', 'antiguedad': '5',
            'audiometria': {'dx': 'NORMAL', 'oidoDerecho': 'Normal', 'oidoIzquierdo': 'Normal', 'hbc': 0},
            'espirometria': {'patron': 'NORMAL', 'fvc': 0.9, 'tabaquismo': 'NEGADO'},
            'rxColumna': {'escoliosis': 3, 'lordosis': 36, 'basculacion': 0, 'impresion': 'NORMAL'},
            'rxTorax': {'impresion': 'NORMAL'},
            'ecg': {'impresion': 'NORMAL'},
            'laboratorio': {'bh': {'hb': 15}, 'qs6': {'gluc': 90, 'col': 180}, 'toxico': {'anfeta': 'NEGATIVO'}},
            'campimetria': {'agudezaVisual': 'NORMAL', 'camposVisuales': 'NORMAL', 'discriminacionColor': 'NORMAL'},
            'examenMedico': {'peso': 70, 'talla': 170, 'imc': 24.2, 'presionArterial': '120/80', 'diagnostico': 'APTO'},
        }],
    }
```

## Validaciones obligatorias

```bash
# 1. Sintaxis
cd backend && python -m py_compile app/services/reports/pdf_ebook_writer.py

# 2. Tests
cd backend && pytest tests/test_pdf_ebook_writer.py -v

# 3. Smoke test con proyecto de 5 trabajadores con todas las secciones
cd backend && python -c "
from app.services.reports.pdf_ebook_writer import generar_ebook
project = {
    'empresa': 'TEST', 'empresaLegal': 'TEST S.A. DE C.V.',
    'fecha': '2026-06-30',
    'trabajadores': [
        # 5 trabajadores con todas las secciones llenas
    ]
}
path = generar_ebook(project, '/tmp/test_ebook_fase2.pdf')
import os
print(f'PDF: {path} ({os.path.getsize(path)} bytes)')
"
```

## Reglas inquebrantables

- ❌ NO modifiques `pdf_writer.py` (deprecated, intacto)
- ❌ NO modifiques `massive_report.py`
- ❌ NO modifiques el frontend
- ❌ NO modifiques `reports.py` (API)
- ❌ NO commitees ni pushees
- ❌ NO pidas qodo (sunset)
- ❌ NO invoques GEMINI directamente

## Reporte final

Al cerrar reporta con:

1. **Prioridades completadas** (1, 2, 3, 4, 5 según alcanzaste)
2. ✅/❌ de pytest (tests viejos + nuevos)
3. ✅/❌ de smoke test manual
4. Path del PDF generado
5. Self-review
6. Límite de steps alcanzado (si fue el caso)
7. Recomendación para Fase 3