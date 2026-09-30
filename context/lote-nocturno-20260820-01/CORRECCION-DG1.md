# CORRECCION-DG1 — Insumo real omitido en revisión original (ESPIROMETRIA.pdf)

- **ID intervención:** IMPL-20260821-09
- **ID tarea:** cierre DG-1 (LOTE-20260820-01, P1)
- **Gatillo:** handoff posterior al lote con insumo real omitido en revisión original
- **Fecha:** 2026-08-21 10:35 America/Mexico_City
- **Acción:** SUPERSEDED (no cierre pleno — la promoción a `tested` sigue reservada a INTEGRA/ATLAS)

---

## 1. Estado declarado en revisión original

`context/lote-nocturno-20260820-01/GAPS.md` §P1 declaraba:

> ### DG-1 — AMI no entrega PDF de espirometría real (sólo PNG)
> - **Descripción:** `context/datos AMI/informacion para revision/` contiene sólo `ESPIRO OB.png` (834×595 px, RGBA, 198 KB) y `criterios repetitibilidad-espirometria.png`. No hay PDF Sibelmed W20s con tabla exhaustiva FVC/FEV1/M1/M2/M3/REF/LLN. PPTx `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` y `DIAGNOSTICO BASICO AUDIOS.pptx` referenciados en la SPEC §3 **NO existen** en el árbol AMI.
> - **Acción:** solicitar a Frank en próxima iteración: (1) PDF Sibelmed W20s con tabla exhaustiva FVC/FEV1/M1/M2/M3/REF/LLN (≥10 parámetros). (2) PPTx de patrones espirométricos (referencia clínica). (3) `VALORES DE REFERENCIA_ESPIRO.xlsx` con ecuaciones GLI-2012 por etnia/edad/sexo/talla.

## 2. Insumo real omitido

El PDF `context/RD2026/ESPIROMETRIA.pdf` (123 540 bytes, 1 página, PDF 1.3, Producer MS Reporting Services 11.0.0.0, CreationDate 2025-03-19 11:06:46 -06) **SÍ estaba en el árbol del proyecto desde 2025-07-10** (visible en `ls -la context/RD2026/`). Fue omitido en la Unidad 1 del lote porque:

- `INVENTARIO-INSUMOS.md` (Unidad 1) sólo inventarió `context/datos AMI/**` (40 archivos), no `context/RD2026/**` (15 archivos).
- El handoff de la SPEC lote referenciaba AMI como única fuente de insumos espirométricos.

**Verificación de presencia histórica (lectura, no modificación):**

```bash
$ ls -la context/RD2026/ESPIROMETRIA.pdf
-rw-rw-r-- 1 frank frank 123540 Jul 10 16:59 context/RD2026/ESPIROMETRIA.pdf
```

## 3. Qué contiene realmente el PDF

| Bloque | Capa PDF | Técnica de extracción | Datos |
|---|---|---|---|
| Membrete | Texto nativo (capa vectorial) | PyMuPDF get_text | "ESTUDIO DE ESPIROMETRIA" |
| Imagen Sibelmed (membrete+paciente+condiciones+tabla+repetibilidad ATS/ERS+gráficas) | **Imagen raster JPEG embebida Im7** (790×750 px, filtro DCTDecode, xref=7) | PyMuPDF page.get_images + Pixmap + tesseract 5.5.0 spa+eng --psm 6 sobre Im7 ×3 LANCZOS | paciente + tabla 10 filas + repetibilidad binaria + 2 gráficas |
| Criterios calidad (Pico Maximo:SI, Forma Triangular:SI, …, Calidad:A) | Texto nativo | PyMuPDF get_text | flags SI/A |
| Repetibilidad numérica | Texto nativo | PyMuPDF get_text | FVC 30.00 ml / FEV1 40.00 ml |
| Impresión diagnóstica | Texto nativo | PyMuPDF get_text (separada como fuente_texto_crudo) | "PATRÓN ESPIROMÉTRICO RESTRICTIVO FVC: 70%" |
| Recomendaciones | Texto nativo | PyMuPDF get_text (separada como fuente_texto_crudo) | texto literal |
| Realizador | Texto nativo | PyMuPDF get_text | ERIKA RODRIGUEZ LOPEZ, Ced. Prof. 4039862 |

**Paciente del PDF (PEÑA PATRICIO MARBELLA) es distinto del paciente del PNG del lote previo (VINIEGRA DIAZ LUIS EDUARDO).** Ambos coexisten como extracciones distintas sobre insumos distintos.

## 4. Tabla extraída (10 filas visibles)

Origen: imagen raster embebida Im7 + OCR ×3 sobre LANCZOS.

| # | Parámetro (label) | key canónica | M1 | %REF M1 | M2 | %REF M2 | M3 | %REF M3 | REF | LLN |
|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Mejor FVC | mejor_fvc_l | 2.33 | 70 | 2.33 | 70 | 2.33 | 70 | 3.32 | **2.69** |
| 2 | Mejor FEV1 | mejor_fev1_l | 2.15 | 77 | 2.15 | 77 | 2.15 | 77 | 2.77 | **2.23** |
| 3 | MFev1/MFvc | mejor_fev1_fvc_pct | 92.13 | 110 | 92.13 | 110 | 92.13 | 110 | 83.67 | **76.27** |
| 4 | FVC | fvc_l | 2.30 | 69 | 2.33 | 70 | 2.26 | 68 | 3.32 | **2.69** |
| 5 | FEV1 | fev1_l | 2.15 | 77 | 2.11 | 76 | 2.09 | 75 | 2.77 | **2.23** |
| 6 | FEV1/FVC | fev1_fvc_pct | 93.31 | 112 | 90.59 | 108 | 92.29 | 110 | 83.67 | **76.27** |
| 7 | FEF25%-75% | fef25_75_l_s | 3.29 | 91 | 2.92 | 81 | 3.03 | 84 | 3.61 | **2.22** |
| 8 | FET100% | fet100_s | 3.74 | — | 4.26 | — | 3.80 | — | — | — |
| 9 | Vext. | vext_l | 0.06 | — | 0.08 | — | 0.08 | — | — | — |
| 10 | Edad del pulmón | edad_pulmon_anios | 47.15 | — | 48.58 | — | 49.51 | — | — | — |

`—` = celda no impresa en el PDF (el Sibelmed W20s no imprime REF/LLN/%REF para FET100, Vext y Edad pulmonar).

**Confirmación de LLN visibles:** 7/10 filas tienen LLN visible (filas 1-7). Las 3 restantes (FET100, Vext, Edad pulmonar) NO tienen LLN/REF/%REF impresos — **no es limitación AMI**: el layout Sibelmed W20s no expone esas columnas para esos parámetros.

## 5. Estado final de DG-1

**DG-1 SUPERSEDED** por la nueva evidencia.

- **Cierre lógico del gap original:** el insumo Sibelmed W20s con tabla exhaustiva FVC/FEV1/M1/M2/M3/REF/LLN ahora existe en `context/RD2026/ESPIROMETRIA.pdf`. El extractor backend (`_ESPIROMETRIA_CANONICAL_KEYS` + `_ESPIROMETRIA_BACKEND_GUARDRAILS`) ya está alineado para digerir el layout de 10 filas.
- **Lo que NO queda cerrado por este supersede:** la **promoción a `tested`** de `espirometria-v3-draft.json`. Esa decisión es de INTEGRA/ATLAS (no de SOFIA). Razones para NO promoverla automáticamente en esta intervención:
  1. Handoff §5 D4 del lote prohíbe transiciones de estado V3 (`draft → tested → published`).
  2. DG-3 sigue ABIERTO: sin XLSX de espirometría (`VALORES DE REFERENCIA_ESPIRO.xlsx`) no es posible verificación cruzada bit-a-bit de los LLN del PDF contra una fuente normativa externa; los LLN del PDF son los del cálculo interno del Sibelmed con la ecuación P.PADILLA-MEXICO.
  3. El PPTx `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` aún no existe en el árbol (sigue faltando).
- **Estado V3 sin cambios:** `espirometria-v3-draft.json` sigue en `status='draft'`. **Cero V3 transita a `published`** (cumple handoff §5 D4).

## 6. Decisión para INTEGRA / ATLAS

| Opción | Efecto | Recomendación |
|---|---|---|
| A. Promover `espirometria-v3-draft.json` a `tested` con la nueva evidencia RD2026 | La calibración V3 queda validada contra insumo Sibelmed W20s real; pendiente QA GEMINI | **NO sin GEMINI**; DG-3 queda como riesgo residual |
| B. Mantener `draft` y cerrar DG-1, esperar DG-3 | Más conservador; sin riesgo de saltarse QA GEMINI | **Recomendada** para no saltarse la auditoría cruzada |
| C. Solicitar a Frank `VALORES DE REFERENCIA_ESPIRO.xlsx` y `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` antes de promover | Cierra DG-3 también; alinea con la acción original del gap | **Ideal** si Frank puede aportar en próxima iteración |

SOFIA recomienda **B** (mantener `draft`, cerrar DG-1, dejar DG-3 abierto) por las razones expuestas. La promoción a `tested` debe esperar el veredicto GEMINI sobre la nueva extracción RD2026.

## 7. Estado de archivos del lote

| Archivo | Estado | Hash SHA-256 (calculado al cierre, ver §8) |
|---|---|---|
| `context/RD2026/ESPIROMETRIA.pdf` | **NO MODIFICADO** (intacto desde 2025-07-10) | (registrado en `evidencia/baseline/ami-files-sha256.txt` o en baseline AMI; no aplica a este PDF — leer con `sha256sum` para confirmar) |
| `context/lote-nocturno-20260820-01/extraction-espirometria-rd2026.json` | **CREADO** | (ver §8) |
| `context/lote-nocturno-20260820-01/DIFF-ESPIRO-RD2026.md` | **CREADO** | (ver §8) |
| `context/lote-nocturno-20260820-01/CORRECCION-DG1.md` | **CREADO** (este archivo) | (ver §8) |
| `context/lote-nocturno-20260820-01/GAPS.md` | **MODIFICADO** (mínimo: DG-1 marcado SUPERSEDED; DG-3 sigue idéntico) | (ver §8) |
| `context/lote-nocturno-20260820-01/IMPL-REPORT.md` | **MODIFICADO** (mínimo: nota al pie con §nueva evidencia) | (ver §8) |
| `evidencia/baseline/calibrations-snapshot/espirometria-v3-draft.json` | **NO MODIFICADO** (sigue `status='draft'`) | (intacto) |
| `evidencia/baseline/calibrations-snapshot/fixtures/extraction-espirometria-ob.json` | **NO MODIFICADO** (F-1 intacto; coexiste con RD2026) | (intacto) |
| `frontend/src/**`, `backend/app/**`, migraciones, Railway, Vercel, AMI | **NO MODIFICADOS** (cero) | (verificado con `git status`) |
| `validate-snapshot.js` | **NO MODIFICADO** | (intacto) |

## 8. Hashes SHA-256 de los archivos creados/modificados

(Se calcularán al final con `sha256sum` y se reportarán en el `IMPL-REPORT` consolidado de la intervención IMPL-20260821-09.)

## 9. Pendientes INTEGRA / ATLAS

1. Decidir opción A/B/C de §6 (recomendado B).
2. Si se elige A o C, activar sesión GEMINI independiente para auditar `extraction-espirometria-rd2026.json` (Unidad 5 del lote).
3. Si se cierra DG-3 (XLSX), consolidar en `context/CURRENT.md` y `PROYECTO.md` (Unidad 6, INTEGRA).
4. **Reversibilidad:** si INTEGRA decide revertir el supersede de DG-1 (mantener ABIERTO hasta tener `VALORES DE REFERENCIA_ESPIRO.xlsx`), basta con revertir este archivo + el cambio en GAPS.md + el pie de IMPL-REPORT. Los artefactos `extraction-espirometria-rd2026.json` y `DIFF-ESPIRO-RD2026.md` pueden quedarse como evidencia futura o borrarse.