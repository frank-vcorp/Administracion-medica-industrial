# SPEC ARCH-20260630-01 v2 — PDF Ebook Reemplaza Carpeta Física por Proyecto

**ID:** ARCH-20260630-01
**Fecha:** 2026-06-30 (v2 actualizada con decisiones Frank)
**Estado:** [~] Planificado (esperando aprobación INTEGRA → SOFIA)
**Origen:** Frank Saavedra — propuesta surgida de dolor operativo observado
**Cambios vs v1:**
- Tamaño: A4 → **Carta/Letter (8.5×11in)** ← México usa Carta
- Max trabajadores: 200 → **300**
- Gráficas: NO → **SÍ con matplotlib** (en estadísticas)
- Imágenes: NO consideradas → **SÍ embebidas inline por trabajador**
- Storage entrega: ZIP anexo → **Un solo PDF portable**

**SPECs relacionadas:**
- `context/SPECs/SPEC_ARCH-20260623-01-MODULO-REPORTES-MASIVOS.md` (funcional padre)
- `context/SPECs/SPEC_IMPL-20260630-03-MODULO-REPORTES-BACKEND.md` (implementación actual)
- `context/Juntas/Avances AMI_ 2026_04_08 12_50 CST - Notas de Gemini.md` (junta origen)

---

## 1. Contexto y motivación

### Dolor operativo actual

Cuando un proyecto UMM/clínica cierra, alguien (típicamente **Lolis** o personal administrativo) arma **manualmente** una carpeta física por proyecto que contiene:

1. **Concentrado estadístico** (1 hoja resumen del proyecto)
2. **N folders individuales** (uno por trabajador), cada uno con:
   - Sus estudios realizados (audiometría, espirometría, RX, labs, examen médico)
   - **Las imágenes originales** que imprimió la máquina de cada estudio (audiograma, curva espirométrica, RX, etc.)

**Problemas identificados:**
- ❌ Trabajo manual repetitivo propenso a errores humanos
- ❌ No escala a 50+ trabajadores (consume horas)
- ❌ Las imágenes físicas se pierden o se desencuadernan
- ❌ No hay forma de "navegar" digitalmente la carpeta
- ❌ No hay trazabilidad de qué estudios se incluyeron vs cuáles faltaron

### Propuesta confirmada

Reemplazar la carpeta física por un **único PDF ebook portable** que el sistema genere automáticamente, con:

| Capacidad | Beneficio |
|-----------|-----------|
| 📑 Índice paginado con anclas clicables | Cliente navega en 1 click |
| 📊 Sección de estadísticas agregadas + **gráficas matplotlib** | Visualización inmediata |
| 👤 Sección por trabajador con **TODOS sus estudios + imágenes embebidas** | Reemplaza el folder individual |
| 🖨️ Imprimible Carta (8.5×11in) | Listo para imprimir si el cliente quiere físico |
| 📑 Bookmarks nativos del PDF | Panel del lector (Chrome, Adobe) |
| 🔒 **Portable**: un solo archivo autocontenido | Cliente puede llevarlo en USB, email, Drive |

---

## 2. Goals y Non-Goals

### ✅ Goals

1. **Reemplazar** el PDF concentrado actual (`pdf_writer.py`) por un ebook rico
2. **Una sola opción PDF** en el modal (llamada "EBOOK")
3. **Imágenes originales embebidas inline** en cada sección de trabajador
4. **Estadísticas con mini-gráficas** (barras, pastel) renderizadas con matplotlib
5. **Navegación con bookmarks + TOC hipervinculado**
6. **Secciones condicionales** por trabajador (solo lo que se hizo)
7. **Tamaño Carta imprimible** sin pérdida de información
8. **Un solo archivo PDF portable** autocontenido (sin ZIPs, sin anexos externos)

### ❌ Non-Goals

- ❌ Cambios al XLSX (sigue igual, formato masivo para tratamiento de datos)
- ❌ Filtros interactivos dentro del PDF (TOC es suficiente)
- ❌ Edición en tiempo real del PDF (es read-only)
- ❌ PDF-A compliance para archivado legal de largo plazo (SPEC futura)
- ❌ Firma digital del PDF (servicio separado ya existe)
- ❌ Multi-idioma (i18n) — solo español
- ❌ Streaming/chunked download del PDF (SPEC futura si file size >100 MB se vuelve problema)

---

## 3. Decisiones arquitectónicas explícitas

### Decisión 1: Stack técnico — **STAY con reportlab (Python)**

**Decisión:** Mantener reportlab. Razones:
- Ya integrado en backend
- BackgroundTasks sin Node.js
- `canvas.bookmarkPage()` + `canvas.addOutlineEntry()` para bookmarks nativos
- Soporta embedding de imágenes JPG/PNG y PDFs como páginas
- Compatible con matplotlib (renderizar gráficos a PNG temp, luego embeber)

### Decisión 2: Implementación del Table of Contents (TOC)

**Decisión:** Custom canvas interception con `onPage` callback. Razones:
- Control total del estilo del TOC
- Bookmarks precisos
- Una sola pasada de generación
- Patrón estándar en reportlab

### Decisión 3: Tamaño de página — **CARTA / Letter (8.5×11in)**

**Decisión:** Tamaño fijo `letter` (8.5×11in = 612×792pt).

**Justificación Frank:** En México se imprime en Carta, no A4. Es el formato operativo.

**Márgenes:** 2cm top/bottom (0.79in), 2cm left/right (0.79in).
**Header:** Nombre del proyecto + fecha en cada página (excepto portada).
**Footer:** Número de página centrado.

### Decisión 4: Render de estadísticas — **SÍ con matplotlib (gráficas)**

**Decisión:** Mini-gráficas renderizadas con matplotlib y embebidas como PNG/JPG.

**Tipos de gráficas por subsección:**

| Subsección | Tipo de gráfica | Datos |
|------------|-----------------|-------|
| II.1 Audiometría | **Barras**: %HBC distribución (Normal/Alto/Muy Alto) | `calcular_hbc_por_rango()` |
| II.2 Audiometría | **Barras horizontales**: Trauma acústico por área | `calcular_trauma_acustico_por_area()` |
| II.3 Espirometría | **Pastel**: Distribución de patrón | `calcular_espirometria_distribucion()` |
| II.4 RX Columna | **Barras**: Escoliosis por grado (Normal/Leve/Moderada/Grave) | `calcular_escoliosis_distribucion()` |
| II.5 RX Tórax | **Barras simples**: Conteos normales/alterados | calculado inline |
| II.6 ECG | **Barras simples**: Conteos normales/alterados | calculado inline |
| II.7 Campimetría | **Pastel**: Agudeza visual distribución | calculado inline |
| II.8 Laboratorio | **3 mini-barras**: Glucosa, Colesterol, Triglicéridos rangos | `calcular_qs6_niveles()` |

**Implementación:** Usar `matplotlib.use('Agg')` (non-interactive) → `plt.savefig(tempfile, format='png', dpi=100, bbox_inches='tight')` → embeber PNG con `canvas.drawImage()`.

**Tamaño estimado por gráfica:** PNG 800×500px @ 100dpi = ~50-100 KB. Total sección II: ~8 gráficas × 75 KB = ~600 KB.

### Decisión 5: Orden de trabajadores — **Alfabético por apellido**

**Decisión:** `sorted(trabajadores, key=lambda w: (w['apellido'], w['nombre']))`.

### Decisión 6: Trabajadores sin estudios

**Decisión:** Incluir con sección "Sin estudios realizados" (no omitir).

### Decisión 7: Cambio del enum `format`

**Decisión:** Mantener campo `format` en DB pero cambiar valores:
```python
# Antes
format: 'XLSX' | 'PDF' | 'BOTH'

# Ahora
format: 'XLSX' | 'EBOOK' | 'BOTH'
```

**No hay breaking change** porque módulo recién desplegado sin datos previos con `'PDF'`.

**Validación:**
```python
ALLOWED_FORMATS = {'XLSX', 'EBOOK', 'BOTH'}
```

### Decisión 8: Naming del archivo descargado

**Decisión:** `EBOOK_{empresa}_{fecha}.pdf`. Prefijo `EBOOK_` distingue del concepto anterior.

### Decisión 9: 🆕 Imágenes embebidas inline en cada sección de trabajador

**Decisión:** Las imágenes originales de cada estudio (audiograma, RX, curva espirométrica, etc.) se embeben **directamente en la sección del trabajador dentro del PDF**.

**Por estudio, qué se embebe:**

| Estudio | Tiene imagen | Acción |
|---------|--------------|--------|
| **Audiometría** | ✅ `EventTest.fileUrl` | Si existe → embeber; si no → solo datos estructurados |
| **Espirometría** | ✅ | Idem |
| **RX Columna** | ✅ (típicamente 2: AP + lateral) | Idem, una por imagen |
| **RX Tórax** | ✅ | Idem |
| **ECG** | ✅ | Idem |
| **Laboratorio** | ✅ (PDF de resultados) | Idem |
| **Campimetría** | ⚠️ Variable | Si existe → embeber |
| **Examen Médico** | ❌ | Solo datos estructurados |

**Layout por imagen:**
- Escala automática al ancho de página (max 6.5in = 468pt)
- Mantener aspect ratio
- Si imagen es PDF: embeber como página completa del PDF ebook (`canvas.showPage()` + render del PDF con `PdfReader`)
- Si imagen es JPG/PNG: embeber con `canvas.drawImage()` escalada

**Múltiples imágenes en RX Columna:**
- Si 2+ imágenes → poner en página separada, una por imagen o 2-up según tamaño

**Página por imagen:**
- Header con nombre del estudio
- Imagen centrada, máximo ancho de página
- Si imagen no cabe en media página → página completa
- Caption debajo: "Audiograma original — Folio 168058, capturado 2026-06-15"

### Decisión 10: 🆕 Un solo PDF portable autocontenido

**Decisión:** Un solo archivo PDF que contiene TODO: datos + estadísticas + imágenes embebidas. Sin ZIPs anexos, sin referencias externas a archivos.

**Justificación Frank:** "No tiene sentido otra carpeta a menos que la uses para guardar los archivos y en el PDF solo haga referencia, pero es mejor en un solo PDF para que el archivo sea portable."

**Storage:**
- Los archivos originales se mantienen en `/uploads/{key}` (local) o S3 Railway bucket (cuando configurado) — esto es interno del sistema
- El PDF ebook los lee de storage durante generación, los embebe, y el PDF resultante es **autocontenido**
- Si storage se pierde, los PDFs ya generados siguen siendo válidos

**Trade-off aceptado:**
- File size grande para 300 trabajadores (estimado 100-300 MB)
- Tiempo de generación más largo (30-60s para 300)
- Browser puede tardar en descargar (chunked transfer recomendado en deployment)

### Decisión 11: 🆕 Estrategia de compresión de imágenes

**Decisión:** Comprimir imágenes antes de embeber para optimizar file size.

**Reglas:**
- Si imagen >1500px ancho → redimensionar a max 1500px con PIL (`Image.thumbnail((1500, 1500))`)
- Si imagen es PNG >500 KB → convertir a JPEG con calidad 80%
- Si imagen es PDF → embeber tal cual (PDF ya está comprimido)

**Ahorro estimado:** 40-60% del tamaño original de las imágenes.

### Decisión 12: 🆕 Renderizado de PDFs como páginas del ebook

**Decisión:** Si el archivo del estudio es un PDF (caso común: audiometría, laboratorio), se embebe como **página completa del ebook** usando **pypdf** para merge nativo.

**Justificación Frank:** pypdf es librería estándar, limpia, mantiene fidelidad del PDF original.

**Implementación:**
```python
from pypdf import PdfReader, PdfWriter
from PyPDF2 import PdfMerger

merger = PdfMerger()
merger.append(EBOOK_PATH)  # Páginas del ebook ya generadas
merger.append(original_pdf_path)  # PDF del estudio embebido
merger.write(final_ebook_path)
```

O alternativa: `canvas.Canvas().drawImage()` con renderizado del PDF como bitmap. **Decidido: pypdf merge directo** (preserva fidelidad de imágenes médicas).

### Decisión 13: Sin streaming — esperar PDF completo

**Decisión:** El backend genera el PDF completo y luego lo guarda. NO usa streaming/chunked download.

**Justificación Frank:** "más simple esperar".

**Implicaciones:**
- Usuario hace polling cada 2s mientras espera
- Status PROCESSING mientras se genera
- Status READY cuando el archivo completo está en disco
- Descarga final es un HTTP GET estándar con `Content-Disposition: attachment`

### Decisión 14: Sin reportes históricos en el ebook

**Decisión:** El EBOOK contiene SOLO los datos del proyecto actual. NO incluye reportes generados previamente del mismo proyecto.

**Justificación Frank:** "No, solo son del proyecto actual".

**Implicaciones:**
- El EBOOK es una "foto" del proyecto en el momento de generación
- Si el usuario quiere ver reportes previos, usa el endpoint `GET /api/v2/projects/{id}/reports` (historial)
- Cada generación es independiente

### Decisión 15: Traducción via browser built-in

**Decisión:** NO se implementa traducción server-side. Se documenta que el cliente puede usar la función de traducción nativa de Chrome/Edge.

**Justificación:** Chrome 114+ (jul-2023) y Edge tienen traducción de PDFs built-in. Click derecho → "Traducir a inglés". Cero costo de implementación.

**Limitaciones documentadas:**
- Solo traduce texto, no imágenes embebidas (RX, audiograma siguen en español)
- Safari y Firefox NO tienen esta función built-in (recomendar Chrome/Edge)
- Nombres propios, folios, números no se traducen (correcto)

**Acción:** Agregar nota en el modal preview del frontend: *"PDF imprimible en español. Si necesita traducirlo, ábralo en Chrome/Edge y use la función de traducción del navegador (click derecho → Traducir)."*

---

## 4. Arquitectura técnica

### 4.1 Estructura de archivos

```
backend/app/services/reports/
├── __init__.py
├── conteos.py                     # sin cambios
├── massive_report.py              # modificar: usar pdf_ebook_writer en lugar de pdf_writer
├── xlsx_writer.py                 # sin cambios
├── pdf_writer.py                  # ⚠️ DEPRECATED, mantener por 1 release para rollback
└── pdf_ebook_writer.py            # 🆕 NUEVO: ebook completo con imágenes embebidas

backend/app/api/
└── reports.py                     # modificar: format acepta 'EBOOK', llamar ebook_writer

backend/app/services/storage/      # 🆕 NUEVO paquete si no existe
├── __init__.py
└── image_fetcher.py               # helper: descargar imagen de /uploads o /api/files

frontend/src/lib/reports/
├── types.ts                       # modificar: ReportFormat = 'XLSX' | 'EBOOK' | 'BOTH'
└── conteos.ts                     # sin cambios

frontend/src/components/projects/
├── ProjectMassiveReportModal.tsx  # modificar: opciones XLSX/EBOOK/BOTH, label actualizado
└── ProjectMassiveReportButton.tsx # sin cambios

frontend/src/actions/
└── project-reports.actions.ts     # modificar: enviar 'EBOOK' en lugar de 'PDF'
```

### 4.2 Diagrama de flujo actualizado

```
┌─────────────────────────────────────────────────────────┐
│ Usuario en /projects/[id]                                │
│ Click "Reporte Masivo" → modal abre                      │
│                                                          │
│ Opciones:                                                │
│ • XLSX solo                                             │
│ • EBOOK solo  ← incluye imágenes embebidas              │
│ • Ambos (XLSX + EBOOK)                                  │
│                                                          │
│ Click "Generar"                                          │
│ → POST /api/v2/projects/{id}/reports/massive            │
│   body: { format: 'EBOOK' | 'XLSX' | 'BOTH' }           │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ Backend BackgroundTask                                   │
│                                                          │
│ Si format incluye EBOOK:                                 │
│   1. project_to_snapshot(proj)                           │
│   2. Para cada trabajador:                               │
│      a. Leer EventTest.fileUrl                            │
│      b. Descargar de /uploads o /api/files/{key}        │
│      c. Comprimir con PIL si >1500px o >500KB            │
│      d. Si PDF → mergear con pypdf                       │
│   3. Renderizar ebook:                                   │
│      • Portada + TOC + Resumen + Estadísticas (con     │
│        mini-gráficas matplotlib) + Individuales         │
│   4. Guardar EBOOK_{empresa}_{fecha}.pdf en uploads/    │
│   5. Update ProjectReport.fileUrlPdf + status READY     │
│                                                          │
│ Si format incluye XLSX:                                  │
│   → xlsx_writer.generar_xlsx(proj)                       │
└──────────────────────┬──────────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────────┐
│ Frontend polling detecta READY                           │
│ Muestra:                                                 │
│ • [Descargar EBOOK] (PDF portable, único archivo)       │
│ • [Descargar XLSX] (si fue solicitado)                   │
│                                                          │
│ Cliente descarga EBOOK:                                  │
│ → 1 archivo .pdf con TODO: portada, TOC, estadísticas   │
│   con gráficas, secciones individuales con imágenes      │
│   originales embebidas                                  │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Estructura del PDF ebook generado

Para un proyecto con 10 trabajadores (todos con todos los estudios):

```
📕 EBOOK: "VALIANT DE MÉXICO — UMM Demo" (Carta, ~30 páginas con imágenes)
│
├─ PÁGINA 1: PORTADA
│   • Logo Soluciones (placeholder hasta feedback Leticia)
│   • Título: "Diagnóstico Situacional"
│   • Subtítulo: nombre del proyecto
│   • Empresa + razón social + fecha
│   • Total trabajadores: 10
│
├─ PÁGINAS 2-3: ÍNDICE / TOC (hipervinculado)
│   I. Resumen Ejecutivo ........................ 4
│   II. Estadísticas Agregadas .................. 5
│       II.1 Audiometría (%HBC) ................. 5
│       II.2 Trauma Acústico por Área ........... 5
│       II.3 Espirometría (Patrón) .............. 6
│       II.4 RX Columna (Escoliosis) ............ 6
│       II.5 RX Tórax ........................... 7
│       II.6 ECG ................................ 7
│       II.7 Campimetría ........................ 8
│       II.8 Laboratorio ........................ 8
│   III. Reportes Individuales .................. 9
│       III.1 AGUILAR ARREOLA JOSE DAVID ........ 9
│       III.2 CRUZ MARTINEZ EDUARDO MISAEL ..... 13
│       ...
│
├─ PÁGINA 4: I. RESUMEN EJECUTIVO
│   • Conteos: total/completos/parciales/sinEstudios
│   • Pirámide de edad (tabla + opcionalmente mini-gráfico)
│   • Distribución por sexo (pastel)
│   • Indicadores clave audiométricos
│
├─ PÁGINAS 5-8: II. ESTADÍSTICAS AGREGADAS (CON GRÁFICAS)
│   II.1 Audiometría
│       Texto: 7 normales, 2 con TA leve, 1 con TA moderada
│       [GRÁFICA: Barras %HBC distribución]
│   II.2 Trauma Acústico por Área
│       [GRÁFICA: Barras horizontales por área]
│   II.3 Espirometría
│       [GRÁFICA: Pastel patrón distribución]
│   II.4 RX Columna
│       [GRÁFICA: Barras escoliosis por grado]
│   II.5 RX Tórax
│       Tabla: 8 normales, 0 alterados, 2 N/A
│   II.6 ECG
│       Tabla: 8 normales, 1 bradicardia, 1 N/A
│   II.7 Campimetría
│       [GRÁFICA: Pastel agudeza visual]
│   II.8 Laboratorio
│       [3 MINI-GRÁFICAS: Glucosa, Colesterol, Triglicéridos]
│
└─ PÁGINAS 9+: III. REPORTES INDIVIDUALES (CON IMÁGENES)
    Por cada trabajador (alfabético por apellido):
    │
    ├─ III.1 AGUILAR ARREOLA JOSE DAVID
    │   Header: Folio | Sexo | Área | Antigüedad
    │   ─────────────────────────────────────
    │   📌 AUDIOMETRÍA
    │       Datos estructurados:
    │         DX: NORMAL | OD: Normal | OI: Normal | %HBC: -1.25
    │       [IMAGEN: audiograma original embebido, página completa o mitad]
    │   📌 ESPIROMETRÍA
    │       Datos: Patrón | FVC | Tabaquismo
    │       [IMAGEN: curva flujo-volumen embebida]
    │   📌 RX COLUMNA
    │       Datos: Escoliosis | Lordosis | Basculación | Impresión
    │       [IMAGEN 1: RX AP] [IMAGEN 2: RX Lateral]
    │   📌 RX TÓRAX
    │       Datos: Impresión diagnóstica
    │       [IMAGEN: RX PA]
    │   📌 ECG
    │       Datos: Impresión
    │       [IMAGEN: trazo ECG]
    │   📌 LABORATORIO
    │       Datos: BH | QS6 | EGO | Tóxico
    │       [IMAGEN: PDF resultados del laboratorio, embebido como página]
    │   [PageBreak]
    │
    ├─ III.2 CRUZ MARTINEZ EDUARDO MISAEL
    │   ... (mismo template, solo secciones con datos E imágenes)
    │
    └─ ... etc

    Bookmarks: worker_xxx (uno por trabajador, ancla en inicio de cada sección)
```

---

## 5. Performance realista

### 5.1 Estimaciones de tamaño y tiempo

| Escenario | Trabajadores | Imágenes totales | Tiempo generación | Tamaño PDF |
|-----------|--------------|------------------|-------------------|------------|
| Mínimo viable | 1 | 4-6 | 3-5s | 1-3 MB |
| Típico | 10 | 40-60 | 10-15s | 10-30 MB |
| Target junta | 50 | 200-300 | 30-45s | 50-150 MB |
| Máximo bulk | 300 | 1200-1800 | 2-4 min | 300-800 MB |

**Veredicto:** Para el caso típico (50 trabajadores), generación 30-45s con PDF 50-150 MB es aceptable para BackgroundTasks.

### 5.2 Optimizaciones aplicadas

| Optimización | Ahorro |
|--------------|--------|
| Compresión PIL a max 1500px | ~50% en imágenes grandes |
| JPEG quality 80% en lugar de PNG | ~30% en imágenes con color |
| Embed PDFs nativos (ya comprimidos) | Sin overhead |
| Reutilizar matplotlib style entre gráficas | ~5% tiempo CPU |

### 5.3 Edge cases performance

| Caso | Comportamiento |
|------|----------------|
| Proyecto con 0 trabajadores | Botón deshabilitado (ya implementado) |
| Proyecto con 1 trabajador | Funciona, 5-10s |
| 300 trabajadores con todas las imágenes | Funciona, 2-4 min, file 300-800 MB |
| Imágenes muy grandes (>5MB c/u) | Comprimidas por PIL, file size acotado |
| Imágenes no accesibles (404) | Skip imagen, continuar con datos estructurados, log warning |

---

## 6. Fases de implementación

### Fase 1: Core ebook structure + imagen embebida simple (Backend only)
**Estimación:** 5-6 horas

**Tareas:**
1. Crear `backend/app/services/reports/pdf_ebook_writer.py` con esqueleto
2. Implementar tamaño **Carta (8.5×11in)** constante
3. Implementar portada + TOC + Resumen Ejecutivo + bookmarks
4. Implementar sección II.1 Audiometría CON **1 mini-gráfica matplotlib** (%HBC barras)
5. Implementar sección III.1 de 1 trabajador con **imagen embebida** (1 audiograma JPG o PNG)
6. Helper `image_fetcher.py`: descargar de /uploads o /api/files
7. Helper de compresión PIL
8. pytest con 1 imagen embebida

**Criterio de aceptación:**
- [ ] PDF genera con 1 trabajador y 1 imagen embebida
- [ ] Tamaño Carta (verificar width/height del PDF)
- [ ] Gráfica matplotlib visible en II.1
- [ ] Bookmark a III.1 funcional
- [ ] `pytest tests/test_pdf_ebook_writer.py` pasa

### Fase 2: Completar secciones por trabajador + imágenes de todos los estudios
**Estimación:** 6-8 horas

**Tareas:**
1. Render condicional para los 8 tipos de estudio (Audiometría, Espirometría, RX Columna, RX Tórax, ECG, Laboratorio, Campimetría, Examen Médico)
2. Para cada estudio con `fileUrl`:
   - Descargar via `image_fetcher`
   - Comprimir si >1500px o >500KB
   - Si PDF: mergear con pypdf
   - Si JPG/PNG: embeber con `canvas.drawImage()` escalada
3. RX Columna con 2+ imágenes (AP + lateral)
4. Layout: imagen debajo de datos estructurados
5. pytest con todas las combinaciones (con/sin imagen por estudio)

**Criterio de aceptación:**
- [ ] 8 tipos de estudio renderizan correctamente
- [ ] Imágenes JPG/PNG se embeben escaladas
- [ ] PDFs de laboratorio/audiometría se mergean como páginas
- [ ] Trabajador con 0 estudios muestra placeholder
- [ ] Unicode (ñ, á, é) renderiza (TTF DejaVu registrado)
- [ ] pytest cubre 8 estudios × 2 estados (con/sin imagen)

### Fase 3: Estadísticas agregadas con todas las mini-gráficas
**Estimación:** 4-5 horas

**Tareas:**
1. Renderizar II.1 a II.8 con mini-gráficas matplotlib
2. Tipos: barras (%HBC), barras horizontales (trauma por área), pastel (patrón, agudeza), barras simples (RX, ECG conteos), 3 mini-barras (lab rangos)
3. Reutilizar funciones de `conteos.py`
4. Cada subsección con su bookmark
5. pytest con datos agregados

**Criterio de aceptación:**
- [ ] 8 subsecciones con sus gráficas correspondientes
- [ ] Gráficas legibles en blanco/negro (print-friendly) Y color
- [ ] Bookmarks individuales para cada subsección
- [ ] Conteos coinciden con modal preview

### Fase 4: Integración frontend + API
**Estimación:** 2-3 horas

**Tareas:**
1. Modificar `ReportFormat` type en `lib/reports/types.ts`
2. Modificar `ProjectMassiveReportModal.tsx`: opciones XLSX/EBOOK/BOTH, descripción actualizada
3. Modificar `project-reports.actions.ts`: enviar `'EBOOK'`
4. Modificar `backend/app/api/reports.py`: validar format
5. Modificar orquestador `massive_report.py`: branch por format
6. Marcar `pdf_writer.py` como deprecated
7. pytest E2E

**Criterio de aceptación:**
- [ ] Modal muestra XLSX/EBOOK/BOTH
- [ ] Generación end-to-end funciona
- [ ] Descarga funciona
- [ ] XLSX sigue sin cambios

### Fase 5: Validación con stakeholders
**Estimación:** 2-3 horas + tiempo de feedback

**Tareas:**
1. Generar EBOOK de proyecto real con 10+ trabajadores
2. Validar con Frank (inicial, ya confirmado)
3. **Lolis** valida formato final del ebook
4. **Leticia** valida logo + colores marca
5. **Dra. Erika** valida secciones clínicas
6. Iterar según feedback
7. **Print test físico** en impresora real (Carta)

**Criterio de aceptación:**
- [ ] EBOOK generado con datos reales + imágenes embebidas
- [ ] Lolis/Leticia/Dra. Erika aprueban
- [ ] Print test pasa sin cutoff
- [ ] Decisión sobre deprecación de `pdf_writer.py`

---

## 7. API y contratos

### 7.1 Cambio en enum `format`

```python
ALLOWED_FORMATS = {'XLSX', 'EBOOK', 'BOTH'}
```

### 7.2 TypeScript types

```typescript
export type ReportFormat = 'XLSX' | 'EBOOK' | 'BOTH';
```

### 7.3 Naming de archivos

```
uploads/reports/{projectId}/{reportId}/
├── REPORTE_VALIANT_20260630.xlsx    (si format incluye XLSX)
└── EBOOK_VALIANT_20260630.pdf       (si format incluye EBOOK)
```

### 7.4 Content-Type para descarga

```
GET /api/v2/.../download?format=pdf
→ Content-Type: application/pdf
→ Content-Disposition: attachment; filename="EBOOK_VALIANT_20260630.pdf"
→ Body: bytes del PDF (streamed)
```

---

## 8. Riesgos y mitigación

| # | Riesgo | Prob | Impact | Mitigación |
|---|--------|------|--------|------------|
| 1 | Bookmarks no funcionan en todos los lectores | Baja | Medio | Test Chrome, Adobe, Foxit, Preview |
| 2 | **File size >800 MB para 300 trabajadores con imágenes** | Media | Alta | Compresión PIL + JPEG quality 80% + descartar imágenes >X MB |
| 3 | **Tiempo generación >5 min para 300 trab.** | Media | Alta | BackgroundTasks ya implementado, usuario hace polling |
| 4 | Browser timeout al descargar >500 MB | Media | Alta | Recomendar Content-Disposition con attachment, no inline |
| 5 | Imágenes no accesibles (404 storage) | Baja | Media | Skip imagen + log warning + continuar con datos estructurados |
| 6 | Unicode (ñ, á, é) no renderiza | Media | Alta | Registrar TTF DejaVu Sans en reportlab |
| 7 | Stakeholder rechaza formato | Media | Alta | Validación fase 5 ANTES de deprecar pdf_writer.py |
| 8 | PDF merge con pypdf corrompe el archivo | Baja | Alta | Validar PDF final con `pypdf.PdfReader()` post-generación |
| 9 | Imágenes muy pesadas (>10MB c/u) saturan memoria | Baja | Alta | Streaming con chunks, no cargar todo en RAM |

---

## 9. Acceptance criteria global

Para considerar el SPEC **completo**:

- [ ] Fases 1-5 ejecutadas con sus criterios individuales cumplidos
- [ ] EBOOK genera correctamente para 1, 10, 50 y 300 trabajadores
- [ ] Tamaño Carta confirmado (8.5×11in)
- [ ] Mini-gráficas matplotlib visibles en II.1-II.8
- [ ] Imágenes originales embebidas inline en cada sección del trabajador
- [ ] PDF autocontenido (un solo archivo portable, sin referencias externas)
- [ ] Bookmarks funcionan en Chrome y Adobe Reader
- [ ] TOC lista todas las secciones + cada trabajador con hyperlinks
- [ ] Cada trabajador muestra SOLO las secciones con datos E imágenes
- [ ] Estadísticas con gráficas correctas
- [ ] PDF imprimible en Carta sin cutoff
- [ ] Frontend: opciones XLSX/EBOOK/BOTH con labels correctos
- [ ] `pdf_writer.py` deprecado después de validación con stakeholders
- [ ] pytest coverage: TOC, bookmarks, conditional sections, embedded images, unicode, performance, edge cases
- [ ] Lolis/Leticia/Dra. Erika aprueban formato
- [ ] Print test físico pasa
- [ ] Documentación actualizada + checkpoint final

---

## 10. Out of scope (NO en este SPEC)

- ❌ Streaming/chunked download del PDF (futuro si file size se vuelve problema)
- ❌ Compresión adicional con Ghostscript u optimizadores externos
- ❌ Versión web interactiva del ebook (HTML equivalente)
- ❌ Multi-idioma (i18n)
- ❌ Anotaciones editables en el PDF

---

## 11. Referencias

### Código relacionado

| Archivo | Rol |
|---------|-----|
| `backend/app/services/reports/massive_report.py` | Orquestador + adaptadores → REUTILIZAR + MODIFICAR branch |
| `backend/app/services/reports/pdf_writer.py` | PDF actual → DEPRECAR |
| `backend/app/services/reports/xlsx_writer.py` | XLSX sin cambios |
| `backend/app/services/reports/conteos.py` | Conteos → REUTILIZAR |
| `backend/app/main.py` línea 54-56 | UPLOAD_DIR mount `/uploads` StaticFiles |
| `backend/app/main.py` línea 579-630 | endpoint upload + /api/files/{key} |
| `frontend/prisma/schema.prisma` línea 256 | `EventTest.fileUrl` campo |
| `frontend/src/components/clinical/StudyDocumentViewer.tsx` | Visor existente de archivos |
| `frontend/src/actions/event-test.actions.ts` línea 343-365 | Patrón de fetch de archivo |

### Documentación externa

- reportlab User Guide: https://www.reportlab.com/docs/reportlab-userguide.pdf
- matplotlib non-interactive: https://matplotlib.org/stable/users/explain/figure/backends.html
- pypdf merge: https://pypdf.readthedocs.io/en/stable/usage.html
- PIL Image.thumbnail: https://pillow.readthedocs.io/en/stable/reference/Image.html

---

## 12. Decisiones pendientes de confirmación final

1. ✅ Tamaño Carta confirmado
2. ✅ 300 trabajadores max confirmado
3. ✅ Logo placeholder confirmado
4. ✅ Gráficas matplotlib confirmado
5. ✅ Orden alfabético confirmado
6. ✅ Print test Frank confirmado
7. ✅ Validación stakeholders (Frank + Lolis/Leticia/Dra. Erika) confirmado
8. ✅ Imágenes embebidas inline confirmado
9. ✅ Un solo PDF portable confirmado
10. ✅ Stack reportlab + pypdf confirmado
11. ✅ Sin streaming (esperar PDF completo) confirmado
12. ✅ Sin reportes históricos en ebook confirmado
13. ✅ Traducción via browser built-in confirmado

**TODAS las decisiones confirmadas. SPEC listo para generar handoff a SOFIA.**

---

## 13. Próximos pasos

1. **INTEGRA actualiza PROYECTO.md** con entrada v2
2. **INTEGRA genera handoff a SOFIA** con:
   - Este SPEC v2 como referencia
   - Decisiones arquitectónicas explícitas (sección 3)
   - Plan de fases con criterios de aceptación
   - Lista de archivos a crear/modificar
   - Advertencia sobre file size para 300 trabajadores
3. **Frank aprueba handoff**
4. **SOFIA ejecuta fase por fase**, reportando al final de cada una
5. **INTEGRA valida** entre fases (especialmente antes de fase 5)
6. **Stakeholders aprueban** en fase 5
7. **Cutover**: deprecar `pdf_writer.py` después de validación final