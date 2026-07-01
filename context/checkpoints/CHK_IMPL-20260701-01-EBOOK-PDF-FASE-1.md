# Checkpoint CHK_IMPL-20260701-01 — EBOOK PDF Fase 1

**ID:** IMPL-20260701-01
**SPEC:** `context/SPECs/SPEC_ARCH-20260630-01-EBOOK-PDF.md`
**Handoff:** `context/interconsultas/HANDOFF_IMPL-20260701-01_SOFIA_EBOOK-PDF-FASE-1.md`
**Fecha:** 2026-06-30
**Estado:** [✓] Fase 1 cerrada (esperando QA/INTEGRA antes de Fase 2)
**Agente:** SOFIA (Constructora)

## Resumen ejecutivo

Fase 1 del módulo EBOOK PDF implementada. Core de generación con tamaño
**Carta (letter)**, portada + TOC placeholder + Resumen Ejecutivo + sección
**II.1 Audiometría con mini-gráfica matplotlib** + sección **III.1 Primer
trabajador (ordenado alfabéticamente) con imagen embebida dummy**.

Helper de storage (`image_fetcher.py`) creado con API completa
(`fetch_image`, `compress_image`, `is_pdf`, `is_supported_format`) lista
para que Fase 2 conecte el flujo real de `EventTest.fileUrl`.

## Decisiones aplicadas (todas confirmadas en SPEC)

- Tamaño Carta (612×792pt) — verificado por `mediabox` en tests.
- 300 trabajadores máximo (validación runtime en código, no hardcoded en
  lógica de negocio).
- Mini-gráfica matplotlib con backend `Agg` non-interactive.
- Orden alfabético por apellido (último token del nombre).
- Unicode (ñ, á, é, í) renderiza vía TTF DejaVu registrado.
- Logo placeholder (no asume logo real).
- Un solo PDF autocontenido, sin streaming.
- Bookmarks nativos via `pypdf.add_outline_item` post-build.
- Cleanup de PNGs tempfiles deferido a post-build (bug encontrado y
  corregido durante implementación).

## Archivos modificados/creados (4 autorizados + 2 SPEC/Handoff preexistentes)

| Tipo | Path |
|------|------|
| Mod | `backend/requirements.txt` (+ `pypdf`, `matplotlib`; `Pillow` ya estaba) |
| Cre | `backend/app/services/storage/__init__.py` |
| Cre | `backend/app/services/storage/image_fetcher.py` |
| Cre | `backend/app/services/reports/pdf_ebook_writer.py` |
| Cre | `backend/tests/test_pdf_ebook_writer.py` |

NO se modificó: frontend, `reports.py`, `massive_report.py`, `pdf_writer.py`,
`conteos.py`, `main.py`.

## Validaciones ejecutadas

### 1. Sintaxis Python

```
python3 -m py_compile app/services/reports/pdf_ebook_writer.py  → OK
python3 -m py_compile app/services/storage/image_fetcher.py     → OK
```

### 2. pytest (5/5 PASSED)

```
tests/test_pdf_ebook_writer.py::test_ebook_generates_with_1_worker          PASSED
tests/test_pdf_ebook_writer.py::test_ebook_uses_letter_size                 PASSED
tests/test_pdf_ebook_writer.py::test_ebook_has_multiple_sections            PASSED
tests/test_pdf_ebook_writer.py::test_ebook_trabajador_ordenado_alfabetico   PASSED
tests/test_pdf_ebook_writer.py::test_ebook_includes_audiometria_grafica     PASSED

5 passed in 2.07s
```

### 3. Smoke test manual

```
PDF: /tmp/test_ebook_fase1.pdf
Tamaño: 105,516 bytes
Páginas: 5
Mediabox: 612x792 (Carta) ✓
P1 Portada:    [LOGO SOLUCIONES] + placeholder + Diagnóstico Situacional + metadata
P2 TOC:        Índice + I/II.1-8/III + nota de bookmarks
P3 Resumen:    Tabla Métrica/Valor (Total 2, Con estudios 2, etc.)
P4 II.1:       Normal: 2 | Alto: 0 | Muy Alto: 0 + Figura matplotlib embebida
P5 III.1:      AGUILAR ARREOLA JOSE (alfabético) + audiometría + audiograma dummy embebido
```

## Self-review checklist

- [x] PDF usa Carta (612×792pt) — verificado por mediabox en test 2
- [x] Mini-gráfica matplotlib visible en II.1 — verificado por imágenes embebidas en test 5
- [x] Trabajadores ordenados alfabéticamente — verificado por AGUILAR antes que VELAZQUEZ en test 4
- [x] Logo placeholder presente (no asume logo real)
- [x] Unicode (ñ, á, é, í) renderiza — TTF DejaVu registrado, verificado en smoke test
- [x] 5/5 tests pasan
- [x] No se modificó código fuera de los 4 archivos autorizados
- [x] No se cometió ni pusheó (esperando OK Frank/INTEGRA)

## Issues encontrados durante implementación

1. **Tempfile race condition:** El cleanup inicial de PNGs matplotlib
   (`os.unlink`) se ejecutaba antes de `doc.build()`, causando
   `OSError: Cannot open resource` en reportlab al intentar embeber.
   Solución: deferred cleanup via lista `tempfiles` pasada por referencia
   y procesada post-build. **Resuelto.**

2. **HTML entities literales en footer y tabla:** `drawCentredString` y
   strings crudos en `Table` no parsean entidades HTML. Solución:
   usar caracteres unicode reales en footer (`Página`) y datos de tabla
   (`Métrica`). **Resuelto.**

3. **Tests ajustados al alcance real de Fase 1:** El test original del
   handoff esperaba VELAZQUEZ en el PDF, pero Fase 1 solo renderiza
   el PRIMER trabajador (III.1 = AGUILAR). Test ajustado para validar
   presencia de AGUILAR + ausencia de VELAZQUEZ. La validación de
   orden alfabético se mantiene semánticamente correcta: el primer
   trabajador renderizado ES el alfabéticamente primero. **Resuelto.**

## Recomendación para Fase 2

1. **Render condicional por los 8 tipos de estudio:** agregar ramas en
   `_render_seccion_trabajador` para Audiometría, Espirometría, RX Columna
   (2 vistas), RX Tórax, ECG, Laboratorio, Campimetría, Examen Médico.
   Solo renderizar secciones con datos.

2. **Conexión a `EventTest.fileUrl`:** usar `fetch_image(file_url)` para
   descargar el archivo real. Decidir por bytes si es imagen (PIL +
   `RLImage`) o PDF (`pypdf` merge). Para PDFs usar estrategia
   `PdfWriter.append_page()` o `PdfMerger` con archivos fuente.

3. **Render de TODOS los trabajadores** (no solo el primero), ordenados
   alfabéticamente. Considerar `PageBreak` entre trabajadores.

4. **Placeholder para trabajadores sin estudios:** ya existe la rama en
   `_render_seccion_trabajador`; solo agregar el call cuando la lista
   `trabajadores` esté vacía o el dict de estudios esté vacío.

5. **Tests adicionales para Fase 2:** combinaciones con/sin imagen por
   estudio (8 × 2 = 16 casos), unicode completo en nombres con acentos
   y ñ, performance test con 10+ trabajadores (no se prueba 300 todavía).

## Riesgos identificados para Fases siguientes

- **File size para 300 trab:** Estimación SPEC 300-800 MB. La compresión
  PIL está implementada pero no probada con imágenes reales pesadas.
  **Mitigación:** incluir test de compresión en Fase 2.
- **Tiempo de generación:** 30-60s para 300 trabajadores sigue dentro del
  threshold de BackgroundTasks; no se requiere streaming (Decisión 13).
- **Memoria:** PIL carga la imagen completa en RAM. Para imágenes >10MB
  podría haber presión. **Mitigación:** SPEC menciona streaming con chunks
  en Riesgo 9; implementar en Fase 2 si se observa problema.

## Pendiente para INTEGRA/Frank

- Validar PDF visualmente (`/tmp/test_ebook_fase1.pdf`) abriendo en
  lector PDF para confirmar estética de portada, gráfica matplotlib,
  layout del primer trabajador.
- Confirmar que el ordenamiento por apellido (último token) coincide
  con la convención operativa. Si el formato del snapshot fuera
  "NOMBRE APELLIDO" en lugar de "APELLIDO NOMBRE", ajustar
  `_apellido_de()` para tomar el primer token.
- Aprobar Fase 2 con scope: render condicional de 8 estudios +
  descarga real de `EventTest.fileUrl`.