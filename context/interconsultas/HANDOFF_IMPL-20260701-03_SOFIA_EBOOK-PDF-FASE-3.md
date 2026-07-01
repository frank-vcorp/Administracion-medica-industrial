# HANDOFF IMPL-20260701-03 → SOFIA: EBOOK PDF - FASE 3 (Estadísticas con mini-gráficas II.2-II.8)

**De:** INTEGRA
**Para:** SOFIA
**Continúa de:** IMPL-20260701-02 (Fase 2 cerrada, 7/7 tests verde)
**SPEC:** `context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md` (sección 6.3 del SPEC)

## Objetivo

Agregar las **7 subsecciones de estadísticas restantes** (II.2 Trauma Acústico, II.3 Espirometría, II.4 RX Columna, II.5 RX Tórax, II.6 ECG, II.7 Campimetría, II.8 Laboratorio) con sus **mini-gráficas matplotlib**. **II.1 Audiometría ya existe** desde Fase 1.

## Decisiones arquitectónicas FIJAS

- matplotlib Agg backend (non-interactive)
- Tabla + 1 mini-gráfica por subsección
- Reutilizar funciones de `conteos.py`
- Tamaño Carta (8.5×11in) constante
- PageBreak entre subsecciones si la gráfica no cabe

## ⚠️ SCOPE TIGHT

**Prioridades** (si te quedas sin steps):
1. **PRIORIDAD 1**: II.2 Trauma Acústico (barras horizontales por área)
2. **PRIORIDAD 2**: II.3 Espirometría (pastel distribución patrón)
3. **PRIORIDAD 3**: II.4 RX Columna (barras escoliosis por grado)
4. **PRIORIDAD 4**: II.8 Laboratorio (3 mini-barras: glucosa, colesterol, triglicéridos)
5. **PRIORIDAD 5**: II.5 RX Tórax + II.6 ECG (tablas simples de conteos)
6. **PRIORIDAD 6**: II.7 Campimetría (pastel agudeza visual)
7. **PRIORIDAD 7**: Tests pytest

**Mínimo aceptable**: PRIORIDAD 1-4. Sin tests si no alcanzas.

## Archivos a modificar

- `backend/app/services/reports/pdf_ebook_writer.py` (extender)
- `backend/tests/test_pdf_ebook_writer.py` (opcional, si alcanzas)

## Funciones de `conteos.py` ya disponibles (REUTILIZAR)

```python
from app.services.reports.conteos import (
    calcular_trauma_acustico_por_area,  # II.2
    calcular_espirometria_distribucion,  # II.3
    calcular_escoliosis_distribucion,    # II.4
    calcular_qs6_niveles,                # II.8
)
```

**Para II.5, II.6, II.7** no hay funciones en `conteos.py` — calcular inline.

## Funciones a crear (siguiendo patrón de `_render_estadistica_audiometria` de Fase 1)

### Plantilla genérica

```python
def _generar_grafica_barras(categorias: List[str], valores: List[int], 
                             titulo: str, color: str = '#10b981',
                             horizontal: bool = False) -> Optional[str]:
    """Genera mini-gráfica de barras con matplotlib. Retorna path del PNG temp."""
    try:
        fig, ax = plt.subplots(figsize=(5, 3), dpi=100)
        if horizontal:
            ax.barh(categorias, valores, color=color)
            ax.invert_yaxis()
        else:
            ax.bar(categorias, valores, color=color)
        ax.set_title(titulo, fontsize=11)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        plt.tight_layout()
        
        tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        plt.savefig(tmp.name, format='png', dpi=100, bbox_inches='tight')
        plt.close(fig)
        return tmp.name
    except Exception as e:
        logger.error(f"Error generando gráfica: {e}")
        return None


def _generar_grafica_pastel(labels: List[str], valores: List[int], titulo: str) -> Optional[str]:
    """Genera mini-gráfica de pastel con matplotlib."""
    try:
        fig, ax = plt.subplots(figsize=(5, 3), dpi=100)
        colores = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']
        ax.pie(valores, labels=labels, colors=colores[:len(labels)], autopct='%1.0f%%', startangle=90)
        ax.set_title(titulo, fontsize=11)
        plt.tight_layout()
        
        tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        plt.savefig(tmp.name, format='png', dpi=100, bbox_inches='tight')
        plt.close(fig)
        return tmp.name
    except Exception as e:
        logger.error(f"Error generando pastel: {e}")
        return None
```

### II.2 Trauma Acústico por Área

```python
def _render_estadistica_trauma_acustico(project: Dict, styles: Dict) -> List:
    """II.2 Trauma acústico por área — barras horizontales."""
    from reportlab.platypus import Paragraph, Spacer, Image as RLImage
    elements = []
    elements.append(Paragraph('II.2 Trauma Acústico por Área', styles['H1']))
    elements.append(Spacer(1, 0.1*inch))
    
    trauma = calcular_trauma_acustico_por_area(project)
    if not trauma:
        elements.append(Paragraph('<i>Sin casos de trauma acústico detectados.</i>', styles['Body']))
        return elements
    
    # Tabla resumen
    data = [['Área', 'Casos']]
    for t in trauma:
        data.append([t['area'], str(t['conteo'])])
    elements.append(_crear_tabla_conteos(data))
    elements.append(Spacer(1, 0.1*inch))
    
    # Gráfica
    categorias = [t['area'] for t in trauma]
    valores = [t['conteo'] for t in trauma]
    grafica_path = _generar_grafica_barras(categorias, valores, 'Trauma Acústico por Área', 
                                             color='#ef4444', horizontal=True)
    if grafica_path:
        elements.append(RLImage(grafica_path, width=5*inch, height=3*inch, kind='proportional'))
    
    return elements
```

### II.3 Espirometría (Patrón)

```python
def _render_estadistica_espirometria(project: Dict, styles: Dict) -> List:
    """II.3 Distribución patrón espirométrico — pastel."""
    from reportlab.platypus import Paragraph, Spacer, Image as RLImage
    elements = []
    elements.append(Paragraph('II.3 Espirometría (Patrón)', styles['H1']))
    elements.append(Spacer(1, 0.1*inch))
    
    espiro = calcular_espirometria_distribucion(project)
    data = [['Patrón', 'Casos']]
    for e in espiro:
        data.append([e['patron'], str(e['conteo'])])
    elements.append(_crear_tabla_conteos(data))
    elements.append(Spacer(1, 0.1*inch))
    
    # Gráfica pastel
    labels = [e['patron'][:30] for e in espiro]  # Truncar para que no se salga
    valores = [e['conteo'] for e in espiro]
    grafica_path = _generar_grafica_pastel(labels, valores, 'Distribución Patrón Espirométrico')
    if grafica_path:
        elements.append(RLImage(grafica_path, width=5*inch, height=3*inch, kind='proportional'))
    
    return elements
```

### II.4 RX Columna (Escoliosis)

```python
def _render_estadistica_rx_columna(project: Dict, styles: Dict) -> List:
    """II.4 Escoliosis por grado Cobb — barras."""
    from reportlab.platypus import Paragraph, Spacer, Image as RLImage
    elements = []
    elements.append(Paragraph('II.4 RX Columna (Escoliosis)', styles['H1']))
    elements.append(Spacer(1, 0.1*inch))
    
    esc = calcular_escoliosis_distribucion(project)
    data = [
        ['Grado', 'Casos'],
        [f'Normal (<5°)', str(esc['normal'])],
        [f'Leve (5-9°)', str(esc['leve'])],
        [f'Moderada (10-19°)', str(esc['moderada'])],
        [f'Grave (≥20°)', str(esc['grave'])],
    ]
    elements.append(_crear_tabla_conteos(data))
    elements.append(Spacer(1, 0.1*inch))
    
    categorias = ['Normal', 'Leve', 'Moderada', 'Grave']
    valores = [esc['normal'], esc['leve'], esc['moderada'], esc['grave']]
    colores = ['#10b981', '#f59e0b', '#ef4444', '#7f1d1d']
    
    # Gráfica con colores por severidad
    grafica_path = _generar_grafica_barras_categorias(categorias, valores, colores, 'Distribución Escoliosis')
    if grafica_path:
        elements.append(RLImage(grafica_path, width=5*inch, height=3*inch, kind='proportional'))
    
    return elements
```

### II.5 RX Tórax (conteos simples)

```python
def _render_estadistica_rx_torax(project: Dict, styles: Dict) -> List:
    """II.5 RX Tórax — solo conteos (sin gráfica)."""
    from reportlab.platypus import Paragraph, Spacer
    elements = []
    elements.append(Paragraph('II.5 RX Tórax', styles['H1']))
    elements.append(Spacer(1, 0.1*inch))
    
    trabajadores = project.get('trabajadores', [])
    total = len(trabajadores)
    normales = sum(1 for w in trabajadores 
                   if w.get('rxTorax', {}).get('impresion', '').upper().startswith('NORMAL'))
    alterados = sum(1 for w in trabajadores 
                    if w.get('rxTorax', {}).get('impresion', '') 
                    and 'NORMAL' not in w.get('rxTorax', {}).get('impresion', '').upper()
                    and w.get('rxTorax', {}).get('impresion') != 'N/A')
    na = total - normales - alterados
    
    data = [
        ['Resultado', 'Casos'],
        ['Normales', str(normales)],
        ['Alterados', str(alterados)],
        ['N/A o sin estudio', str(na)],
    ]
    elements.append(_crear_tabla_conteos(data))
    return elements
```

### II.6 ECG (conteos simples)

```python
def _render_estadistica_ecg(project: Dict, styles: Dict) -> List:
    """II.6 ECG — solo conteos."""
    # Mismo patrón que II.5 pero para ECG
    # Detectar: normales (sin "bradicardia" ni "alteración"), alterados (con "bradicardia"/"alteración"), N/A
    ...
```

### II.7 Campimetría (pastel)

```python
def _render_estadistica_campimetria(project: Dict, styles: Dict) -> List:
    """II.7 Agudeza visual — pastel."""
    # Calcular inline: NORMAL, DISMINUIDA, N/A
    ...
```

### II.8 Laboratorio (3 mini-barras)

```python
def _render_estadistica_laboratorio(project: Dict, styles: Dict) -> List:
    """II.8 Laboratorio — 3 mini-gráficas (glucosa, colesterol, triglicéridos)."""
    from reportlab.platypus import Paragraph, Spacer, Image as RLImage
    elements = []
    elements.append(Paragraph('II.8 Laboratorio', styles['H1']))
    elements.append(Spacer(1, 0.1*inch))
    
    qs6 = calcular_qs6_niveles(project)
    
    # Glucosa
    elements.append(Paragraph('<b>Glucosa</b>', styles['H2']))
    g_path = _generar_grafica_barras(
        ['Normal (<100)', 'Alta (≥100)'],
        [qs6['glucosa']['normal'], qs6['glucosa']['alta']],
        'Glucosa (mg/dL)', color='#3b82f6'
    )
    if g_path:
        elements.append(RLImage(g_path, width=4.5*inch, height=2*inch, kind='proportional'))
    
    elements.append(Spacer(1, 0.1*inch))
    
    # Colesterol
    elements.append(Paragraph('<b>Colesterol</b>', styles['H2']))
    c_path = _generar_grafica_barras(
        ['Normal (<200)', 'Límite (200-239)', 'Alto (≥240)'],
        [qs6['colesterol']['normal'], qs6['colesterol']['limite'], qs6['colesterol']['alto']],
        'Colesterol (mg/dL)', color='#8b5cf6'
    )
    if c_path:
        elements.append(RLImage(c_path, width=4.5*inch, height=2*inch, kind='proportional'))
    
    elements.append(Spacer(1, 0.1*inch))
    
    # Triglicéridos
    elements.append(Paragraph('<b>Triglicéridos</b>', styles['H2']))
    t_path = _generar_grafica_barras(
        ['Normal (<150)', 'Límite (150-199)', 'Alto (≥200)'],
        [qs6['trigliceridos']['normal'], qs6['trigliceridos']['limite'], qs6['trigliceridos']['alto']],
        'Triglicéridos (mg/dL)', color='#ec4899'
    )
    if t_path:
        elements.append(RLImage(t_path, width=4.5*inch, height=2*inch, kind='proportional'))
    
    return elements
```

### Helper genérico de tabla

```python
def _crear_tabla_conteos(data: List[List[str]]) -> 'Table':
    """Crea tabla estilizada para conteos."""
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib import colors
    tabla = Table(data, colWidths=[3*inch, 1.5*inch])
    tabla.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1e293b')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'DejaVu-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'DejaVu'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('ALIGN', (1, 1), (1, -1), 'CENTER'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')]),
    ]))
    return tabla
```

### Modificar `generar_ebook()` para incluir II.2-II.8

Insertar después de II.1 Audiometría:

```python
# II.2 Trauma Acústico
elements.extend(_render_estadistica_trauma_acustico(project_snapshot, styles))
elements.append(PageBreak())

# II.3 Espirometría
elements.extend(_render_estadistica_espirometria(project_snapshot, styles))
elements.append(PageBreak())

# II.4 RX Columna
elements.extend(_render_estadistica_rx_columna(project_snapshot, styles))
elements.append(PageBreak())

# II.5 RX Tórax
elements.extend(_render_estadistica_rx_torax(project_snapshot, styles))
elements.append(PageBreak())

# II.6 ECG
elements.extend(_render_estadistica_ecg(project_snapshot, styles))
elements.append(PageBreak())

# II.7 Campimetría
elements.extend(_render_estadistica_campimetria(project_snapshot, styles))
elements.append(PageBreak())

# II.8 Laboratorio
elements.extend(_render_estadistica_laboratorio(project_snapshot, styles))
elements.append(PageBreak())
```

## Validaciones obligatorias

```bash
# 1. Sintaxis
cd backend && python -m py_compile app/services/reports/pdf_ebook_writer.py

# 2. Tests (los 7 viejos + nuevos si alcanzaste)
cd backend && pytest tests/test_pdf_ebook_writer.py -v

# 3. Smoke test con datos de los 10 trabajadores demo
cd backend && python -c "
from app.services.reports.pdf_ebook_writer import generar_ebook
# Usar datos del demo /mnt/Datos/Proyectos 2.0/Administracion Medica Industrial/Administracion-medica-industrial/frontend/src/lib/demo/demo-data.ts
# ... (cargar 10 trabajadores demo)
path = generar_ebook(project, '/tmp/test_ebook_fase3.pdf')
import os
print(f'PDF: {path} ({os.path.getsize(path)} bytes)')
"
# Esperado: PDF 100-300KB, 15-25 páginas (portada + TOC + resumen + II.1-II.8 + 10 trabajadores)
```

## Test opcional si alcanzaste

```python
def test_ebook_includes_8_estadisticas(project_demo_completo, tmp_path):
    """Verifica que II.1-II.8 están presentes."""
    output = tmp_path / "ebook.pdf"
    generar_ebook(project_demo_completo, str(output))
    reader = PdfReader(str(output))
    full_text = ""
    for page in reader.pages:
        try:
            full_text += page.extract_text() or ""
        except Exception:
            pass
    
    for subseccion in ['II.1', 'II.2', 'II.3', 'II.4', 'II.5', 'II.6', 'II.7', 'II.8']:
        assert subseccion in full_text, f"Falta: {subseccion}"
```

## Reglas inquebrantables

- ❌ NO modifiques `pdf_writer.py`
- ❌ NO modifiques `massive_report.py`
- ❌ NO modifiques `conteos.py` (las funciones ya están)
- ❌ NO modifiques frontend
- ❌ NO modifiques `reports.py`
- ❌ NO commitees ni pushees
- ❌ NO invoques qodo ni GEMINI

## Reporte final

Reporta con:
1. Prioridades completadas (1-7)
2. ✅/❌ de pytest
3. ✅/❌ de smoke test manual + tamaño del PDF
4. Self-review
5. **Si alcanzaste límite**: reporta dónde quedaste
6. Recomendación para Fase 4 (frontend + API)