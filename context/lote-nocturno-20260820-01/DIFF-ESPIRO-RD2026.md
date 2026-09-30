# DIFF-ESPIRO-RD2026 — Corrección por insumo real omitido (ESPIROMETRIA.pdf)

- **ID intervención:** IMPL-20260821-09 (corrección post-lote, gatillada por handoff con insumo real omitido)
- **ID tarea:** cierre DG-1 (P1) — Espirometría Insumo RD2026 omitido en revisión original
- **SPEC activa:** `context/SPECs/SPEC_ARCH-20260516-12-ESPIROMETRIA-EXTRACCION-EXHAUSTIVA.md` (mantenida)
- **SPEC lote:** `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` v1.0 (mantenida)
- **Fecha:** 2026-08-21 10:35 America/Mexico_City
- **Origen del insumo:** `context/RD2026/ESPIROMETRIA.pdf` (1 página, 123 540 bytes, PDF 1.3, Producer MS Reporting Services 11.0.0.0, CreationDate 2025-03-19 11:06:46 -06; declarado en `INVENTARIO-INSUMOS.md` §AMI-11).
- **Producto / Railway / Vercel / migraciones / AMI:** **NO modificados**.
- **Calibración V3 Espirometría:** sigue en `status='draft'`. **Cero V3 transita a `published`** (cumple handoff §5 D4).

---

## 1. Resumen ejecutivo

El insumo real `context/RD2026/ESPIROMETRIA.pdf` (omitido en la revisión original del lote `LOTE-20260820-01`) contiene el informe Sibelmed W20s que se requería en DG-1. La tabla M1/M2/M3/%REF/REF/LLN está presente como **imagen raster JPEG embebida** dentro del PDF (Im7, 790×750 px, DCTDecode), mientras la mitad inferior del PDF (criterios calidad, impresión diagnóstica, recomendaciones, realizador) reside en **capa de texto nativa** del PDF. Se requiere cruce de ambas capas para extracción fiel.

| Ítem | Antes (DG-1 declarado en GAPS.md) | Después (este DIFF) |
|---|---|---|
| Insumo disponible | sólo `ESPIRO OB.png` (834×595 px RGBA, paciente VINIEGRA) | `context/RD2026/ESPIROMETRIA.pdf` con imagen Sibelmed embebida (paciente PEÑA PATRICIO MARBELLA) |
| Filas tabla extraíbles | 9 (Mejor FVC/FEV1, MFev1/MFvc, FVC/FEV1/FEV1-FVC, FET100%, Vext., Edad del pulmón) | **10** (+FEF25%-75% canónica) |
| Fila FEF25-75% | INVENTADA en F-1 (3.30/3.29/69, NO existía en PNG) | **REAL** en el PDF (3.29/2.92/3.03, REF 3.61, LLN 2.22) |
| Repetibilidad numérica (FVC/FEV1 en mL) | null (PNG sólo exponía flag binario "Si") | **30.00 ml / 40.00 ml** (texto nativo PDF) |
| Repetibilidad ATS/ERS (flag binario) | "Si" (en PNG) | **"No"** (en PDF — criterio del Sibelmed W20s para este paciente) |
| Calidad global | no documentada en PNG | **"A"** (texto nativo PDF) |
| LLN visibles en insumo | 6/9 parámetros (Mejores/FVC/FEV1/FEV1-FVC) | **7/10 parámetros** (Mejores/FVC/FEV1/FEV1-FVC + FEF25%-75%) |
| Aceptabilidad DG-1 | BLOQUEANTE (PNG sin PDF) | **DG-1 SUPERSEDED** (PDF con tabla exhaustiva disponible) |

DG-1 queda **SUPERSEDED**: el insumo Sibelmed W20s ahora existe en el árbol del proyecto. DG-3 (XLSX sin hoja de espirometría) sigue **ABIERTO** — la verificación cruzada bit-a-bit contra el XLSX no es posible; los LLN del PDF son los calculados internamente por el equipo (ecuación P.PADILLA-MEXICO, factor étnico 100%), no los derivados del XLSX.

---

## 2. Hallazgo crítico sobre el PDF

El PDF es una **mezcla de dos capas de información** que requieren técnicas distintas para extracción fiel:

1. **Imagen raster JPEG embebida (Im7, xref 7, 790×750 px, filtro DCTDecode)**: contiene el membrete/paciente/condiciones/tabla INFORME DE FVC SIBELMED W20s/repetibilidad ATS/ERS/gráficas. Sin `get_text()` recupera estos datos; sólo PyMuPDF `page.get_images(full=True)` + `Pixmap(doc, xref)` + OCR.
2. **Texto nativo PDF** (capa vectorial de la mitad inferior): contiene los criterios de calidad (Pico Maximo: SI, Forma Triangular: SI, …), `#Pruebas aceptables: 3`, `Criterios para Dx: SI`, `Calidad: A`, `Repetibilidad FVC: 30.00 ml / FEV1: 40.00 ml`, `IMPRESIÓN DIAGNÓSTICA: PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%`, `RECOMENDACIONES:`, `Realizó EM: ERIKA RODRIGUEZ LOPEZ / Ced. Prof.: 4039862`.

El diagnóstico de la impresión (`PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%`) y las recomendaciones son **TEXTO FUENTE** del documento; se conservan en `extraction-espirometria-rd2026.json → fuente_texto_crudo` como transcripción literal **separada** del bloque `extracted_data` y NO se promueve como salida IA. La interpretación clínica pertenece al médico firmante (Dra. Erika Rodríguez López, Ced. Prof. 4039862). NO se emite diagnóstico IA, NO se clasifica aptitud.

---

## 3. Comparación con `_ESPIROMETRIA_CANONICAL_KEYS` (15 claves)

`_ESPIROMETRIA_CANONICAL_KEYS` (extractor.py:150):

```
frozenset({
  "mejor_fvc_l", "mejor_fev1_l",
  "fef2575_l_s", "fef25_75_l_s",
  "fvc_l", "fev1_l", "fev1_fvc_pct",
  "fef25_l_s", "fef50_l_s", "fef75_l_s",
  "fet100_s", "vext_l", "edad_pulmon_anios",
  "repetibilidad_fvc", "repetibilidad_fev1",
})
```

Mapeo del fixture `extraction-espirometria-rd2026.json`:

| Fila PDF (label) | key usada en fixture | Origen de la key | ¿En canonical? |
|---|---|---|---|
| Mejor FVC | `mejor_fvc_l` | frozenset | ✓ |
| Mejor FEV1 | `mejor_fev1_l` | frozenset | ✓ |
| MFev1/MFvc | `mejor_fev1_fvc_pct` | SPEC_ARCH-20260516-12 §6 | **✗ (divergencia DG-8)** |
| FVC | `fvc_l` | frozenset | ✓ |
| FEV1 | `fev1_l` | frozenset | ✓ |
| FEV1/FVC | `fev1_fvc_pct` | frozenset | ✓ |
| FEF25%-75% | `fef25_75_l_s` | frozenset (variante fef2575_l_s también) | ✓ |
| FET100% | `fet100_s` | frozenset | ✓ |
| Vext. | `vext_l` | frozenset | ✓ |
| Edad del pulmón | `edad_pulmon_anios` | frozenset (SPEC §6 dice `edad_pulmon` sin sufijo) | ✓ (con sufijo _anios) |
| Repetibilidad FVC | `calidad.repetibilidad_fvc_ml` (numérico 30.0) | frozenset (campo semántico) | ✓ |
| Repetibilidad FEV1 | `calidad.repetibilidad_fev1_ml` (numérico 40.0) | frozenset (campo semántico) | ✓ |

**Resumen de cobertura contra frozenset:**

- 11/15 claves canónicas representadas (73.3%): `mejor_fvc_l`, `mejor_fev1_l`, `fef25_75_l_s`, `fvc_l`, `fev1_l`, `fev1_fvc_pct`, `fet100_s`, `vext_l`, `edad_pulmon_anios`, `repetibilidad_fvc`, `repetibilidad_fev1`.
- 4/15 claves canónicas NO presentes en el PDF (no son bug): `fef2575_l_s` (variante ortográfica no usada; FEF25-75% está mapeada a `fef25_75_l_s`), `fef25_l_s`, `fef50_l_s`, `fef75_l_s` (el Sibelmed agrupa las 3 en FEF25-75; este layout NO imprime FEF25/FEF50/FEF75 por separado).
- 1 fila presente en el PDF que NO está en canonical: `MFev1/MFvc` (Mejor FEV1/FVC) → key propuesta por SPEC §6 como `mejor_fev1_fvc_pct`. **Divergencia DG-8**: SPEC §6 propone 12 keys; frozenset tiene 15; la SPEC añade `mejor_fev1_fvc_pct`, `fev1_vc_pct`, `pef_l_s` que el frozenset NO incluye; el frozenset añade `fef25_l_s`, `fef50_l_s`, `fef75_l_s`, `fef2575_l_s` que la SPEC §6 no lista. **Acción INTEGRA (futuro):** alinear frozenset con SPEC §6 o reescribir SPEC §6 con frozenset.

**Verificación:** las 11 keys presentes son **internamente coherentes** (Mejor FVC=2.33, Mejor FEV1=2.15, MFev1/MFvc=92.13, FVC M2=2.33, FEV1 M2=2.11, FEV1/FVC=90.59-93.31, FEF25-75=2.92-3.29, FET100=3.74-4.26, Vext=0.06-0.08, Edad pulmonar=47.15-49.51, Rep FVC=30 ml, Rep FEV1=40 ml). Ningún valor parece inferido: todos son visibles en el PDF (texto nativo + imagen embebida Im7).

---

## 4. Comparación con SPEC_ARCH-20260516-12

§6 de la SPEC lista el **mapeo canónico inicial** de 12 labels (Mejor FVC, Mejor FEV1, Mejor FEV1/FVC, FVC, FEV1, FEV1/FVC, FEV1/VC, PEF, FEF25-75, FET100, Vext., Edad de pulmón).

| Label SPEC §6 | Key SPEC §6 | Presente en PDF | key usada en fixture | Observación |
|---|---|---|---|---|
| Mejor FVC | mejor_fvc_l | ✓ | mejor_fvc_l | ✓ alineado |
| Mejor FEV1 | mejor_fev1_l | ✓ | mejor_fev1_l | ✓ alineado |
| Mejor FEV1/FVC | mejor_fev1_fvc_pct | ✓ (label "MFev1/MFvc") | mejor_fev1_fvc_pct | ✓ alineado con SPEC; **no en frozenset** |
| FVC | fvc_l | ✓ | fvc_l | ✓ alineado |
| FEV1 | fev1_l | ✓ | fev1_l | ✓ alineado |
| FEV1/FVC | fev1_fvc_pct | ✓ | fev1_fvc_pct | ✓ alineado |
| FEV1/VC | fev1_vc_pct | ✗ (no visible) | — | No presente en este PDF |
| PEF | pef_l_s | ✗ (no visible) | — | No presente en este PDF (Sibelmed W20s no imprime PEF en este layout específico) |
| FEF25-75 | fef25_75_l_s | ✓ (label "FEF25%-75%") | fef25_75_l_s | ✓ alineado |
| FET100 | fet100_s | ✓ (label "FET100%") | fet100_s | ✓ alineado |
| Vext. | vext_l | ✓ (label "Vext.") | vext_l | ✓ alineado |
| Edad de pulmón | edad_pulmon | ✓ (label "Edad del pulmón") | edad_pulmon_anios | ⚠ SPEC usa `edad_pulmon`; canonical usa `edad_pulmon_anios`; se adopta canonical |

**Conclusión AC §6:** 9/12 labels de la SPEC presentes en el PDF y correctamente mapeados a key canónica (con la divergencia documentada en `edad_pulmon` vs `edad_pulmon_anios`). 3 labels no visibles (FEV1/VC, PEF, FEV1/VC) — no es limitación del extractor sino ausencia en este layout específico del Sibelmed W20s.

§7 de la SPEC establece reglas obligatorias: el fixture cumple todas (JSON válido, sin interpretación clínica, sin valores inventados, tabla sobre gráfica, sin omisión de filas visibles, `notas_calidad` documenta celdas vacías).

---

## 5. Comparación contra fixture previo (`extraction-espirometria-ob.json` v2 F-1)

El fixture previo (F-1) se construyó sobre `ESPIRO OB.png` (otro paciente: VINIEGRA DIAZ LUIS EDUARDO, Hombre, 29, IMC 23.3, referencia 2004202611). El presente fixture se construye sobre `context/RD2026/ESPIROMETRIA.pdf` (paciente PEÑA PATRICIO MARBELLA, Mujer, 34, IMC 28.9, referencia 1803202501). **NO reemplazan al mismo paciente**: ambos coexisten como extracciones sobre insumos distintos.

| # | Aspecto | F-1 (ESPIRO OB.png) | RD2026 (ESPIROMETRIA.pdf) |
|---|---|---|---|
| 1 | Insumo | PNG 834×595 RGBA, paciente VINIEGRA | PDF 1 página con imagen Sibelmed embebida, paciente PEÑA |
| 2 | Filas tabla | 9 (sin FEF25-75; FET/Vext/EdadPulmón sin LLN) | 10 (con FEF25-75; FET/Vext/EdadPulmón sin LLN por layout Sibelmed) |
| 3 | Fila FEF25-75% | INVENTADA en F-1 (3.30/3.29/69) — eliminada en F-1 mismo | REAL en PDF (3.29/2.92/3.03, REF 3.61, LLN 2.22) |
| 4 | Repetibilidad numérica | null (PNG sin números) | 30.00 ml FVC / 40.00 ml FEV1 (texto nativo) |
| 5 | Repetibilidad ATS/ERS flag | "Si" | "No" (Sibelmed) |
| 6 | Calidad global | "suficiente" | "A" |
| 7 | LLN visibles | 6/9 | 7/10 |
| 8 | Impresión diagnóstica | no aplica (PNG no la incluye) | presente en texto nativo PDF; **mantenida como fuente_texto_crudo separada** |
| 9 | Equipo/SIBELMED W20s | confirmado en PNG | confirmado en PDF (header "INFORME DE FVC SIBELMED W20s") |
| 10 | Referencia ecuación | NHANES III-EEUU Mexicano-Americano | P.PADILLA-MEXICO |
| 11 | Factor étnico | 90% | 100% |
| 12 | Cumplimiento AC-3.4 | PASS (6/9 LLN visibles en PNG) | PASS (7/10 LLN visibles en PDF) |

**No hay contradicción** entre los dos fixtures: documentan dos pacientes distintos con dos equipos/referencias/distintas. Ambos son válidos para su insumo respectivo.

---

## 6. Decisión de cierre / supersesión de DG-1

**DG-1 SUPERSEDED** (no cerrado: la PROMOCIÓN a `tested` exige además una validación bit-a-bit contra un XLSX de espirometría o un manual de referencia que aún no existe en AMI → sigue DG-3).

- **Cierre lógico:** el insumo Sibelmed W20s YA existe en el árbol del proyecto (`context/RD2026/ESPIROMETRIA.pdf`). El extractor backend (`_ESPIROMETRIA_CANONICAL_KEYS` + `_ESPIROMETRIA_BACKEND_GUARDRAILS`) ya está alineado para digerir el layout de 10 filas con M1/M2/M3/%REF/REF/LLN que expone el PDF. La calibración V3 puede ahora pasar de `draft` a `tested` si INTEGRA/GEMINI validan la extracción; pero **NO se promueve** en este lote (sigue `draft` por restricción handoff §5 D4 + porque DG-3 sigue abierto).
- **Lo que NO queda cerrado:** la promoción a `tested` de la calibración V3 Espirometría. Esa decisión es de INTEGRA/ATLAS, no de SOFIA. SOFIA sólo entrega el fixture y el DIFF para que INTEGRA/GEMINI puedan evaluar.
- **DG-3 sigue ABIERTO:** `context/datos AMI/.../VALORES DE REFERENCIA.xlsx` no contiene hoja de espirometría; los LLN del PDF son los del cálculo interno del Sibelmed con la ecuación P.PADILLA-MEXICO. Sin XLSX de espirometría no es posible verificación cruzada bit-a-bit externa.

**Acción residual para INTEGRA/ATLAS:** decidir si la nueva evidencia RD2026 basta para promover `espirometria-v3-draft.json` a `tested`, o si aún se requiere el XLSX externo. SOFIA recomienda: **mantener `draft`** hasta que DG-3 (XLSX) cierre, para no saltar la auditoría cruzada.

---

## 7. Comandos reproducibles

```bash
# Texto nativo del PDF (capa vectorial — mitad inferior)
python3 -c "import fitz; d=fitz.open('context/RD2026/ESPIROMETRIA.pdf'); print(d[0].get_text('text'))"

# Enumerar imágenes embebidas
python3 -c "
import fitz
d=fitz.open('context/RD2026/ESPIROMETRIA.pdf')
for i in d[0].get_images(full=True):
    print('IMG xref=', i[0], 'w=', i[2], 'h=', i[3], 'filter=', i[8])
"

# Extraer imagen Sibelmed embebida
python3 -c "
import fitz
d=fitz.open('context/RD2026/ESPIROMETRIA.pdf')
for xref, *_ in d[0].get_images(full=True):
    if xref == 7:
        p = fitz.Pixmap(d, xref)
        p.save('/tmp/kilo-rd2026/embedded_img_7.png')
        print('saved', p.width, 'x', p.height)
"

# OCR sobre imagen embebida (×3 para nitidez numérica)
python3 -c "
from PIL import Image
img = Image.open('/tmp/kilo-rd2026/embedded_img_7.png')
img.resize((img.width*3, img.height*3), Image.LANCZOS).save('/tmp/kilo-rd2026/embedded_img_7_3x.png')
"
tesseract /tmp/kilo-rd2026/embedded_img_7_3x.png /tmp/kilo-rd2026/embedded_7_3x_ocr -l spa+eng --psm 6

# Validar contrato V3 (no se modifica; sólo verifica JSON)
node context/lote-nocturno-20260820-01/validate-snapshot.js

# SHA-256 de los nuevos archivos
sha256sum context/lote-nocturno-20260820-01/extraction-espirometria-rd2026.json \
          context/lote-nocturno-20260820-01/DIFF-ESPIRO-RD2026.md \
          context/lote-nocturno-20260820-01/CORRECCION-DG1.md
```

---

## 8. Trazabilidad a SPEC/AC

| SPEC / AC | Estado | Evidencia |
|---|---|---|
| SPEC_ARCH-20260516-12 §3 (caso fuente Sibelmed) | **CUMPLE** | PDF RD2026/ESPIROMETRIA.pdf expone 12/13 labels visibles en §3 (referencia, fecha, hora, nombre, sexo, edad, talla, peso, temperatura, presión, humedad, fuma, motivo, procedencia, imc, técnico, transductor, referencia ecuación, F. étnico, F. BTPS, tipo informe, equipo/modelo, versión, tabla M1/M2/M3/%REF/REF/LLN, repetibilidad ATS/ERS FVC/FEV1, gráficas) |
| SPEC_ARCH-20260516-12 §6 (mapeo canónico 12 labels) | **9/12 CUMPLE** | Mejor FVC, Mejor FEV1, Mejor FEV1/FVC, FVC, FEV1, FEV1/FVC, FEF25-75, FET100, Vext. correctamente mapeados. FEV1/VC, PEF, Edad de pulmón (con variante de sufijo) requieren alineación adicional |
| SPEC_ARCH-20260516-12 §7 (reglas del prompt) | **CUMPLE** | JSON válido, sin diagnóstico, sin valores inventados, tabla priorizada, notas_calidad documenta celdas vacías, ninguna fila visible omitida |
| SPEC_ARCH-20260516-12 §9 (criterios de aceptación) | **CUMPLE 5/6** | (1) identificación+paciente+condiciones+equipo recuperados ✓; (2) extractor no se limita a fev1/fvc/ratio ✓; (3) tabla exhaustiva M1/M2/M3/%REF/REF/LLN recuperada (10 filas) ✓; (4) filas no reconocidas canónicamente se conservan (MFev1/MFvc) ✓; (5) salida puramente extractiva, sin diagnóstico ✓; (6) tests del slice — pendiente de GEMINI |
| AC-3.4 (LLN coherente) | **PASS** | 7/10 LLN visibles en PDF; 3 celdas vacías por layout Sibelmed (no limitación AMI) |
| DG-1 (PNG sin PDF) | **SUPERSEDED** | PDF Sibelmed W20s ahora disponible; calibración puede pasar a `tested` si INTEGRA/GEMINI validan |
| DG-3 (XLSX sin hoja espiro) | **SIGUE ABIERTO** | sin cambios respecto al lote previo; no cerrado por este insumo |