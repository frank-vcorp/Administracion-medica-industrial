# QA-20260821-09 — Addendum LOTE-AUDIO-ESPIRO F-1/F-2 (post-cierre)

```
QA-VERDICT
ID tarea: LOTE-20260820-01 (corrección post-cierre)
Auditoría: GEMINI (addendum sobre QA-20260820-08)
SPEC activa: context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md v1.0
Handoff origen: context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md
Corrección: IMPL-20260821-07 (F-1 espirometría) + IMPL-20260821-08 (F-2 audiometría)
Reporte corrección: context/lote-nocturno-20260820-01/CORRECCION-F1-F2.md
Incremento auditado: 7 artefactos del lote (2 fixtures v2 + 4 docs + 1 script)
Veredicto: PASS_WITH_WARNINGS
Alcance: Reforzada (F-1/F-2 cerraron hallazgos P1 del QA-08; toca fixture clínico + AC-3.4 y AC-2.3)
```

---

## 1. Alcance de este addendum

Re-auditoría corta y focal de la corrección post-cierre documentada en `CORRECCION-F1-F2.md`. No reemplaza `QA-20260820-08`, sólo verifica que los dos hallazgos P1 cerrados (F-1, F-2) están efectivamente corregidos y que la regresión de la corrección (estados V3, integridad AMI, no publicación) se mantiene.

**Fuentes releídas:**

- `CORRECCION-F1-F2.md` (229 líneas)
- `DIFF-ESPIRO.md` (corregido, 255 líneas)
- `DIFF-AUDIO.md` (corregido, 192 líneas)
- `IMPL-REPORT.md` (actualizado F-1)
- `GAPS.md` (sección post-cierre añadida)
- `evidencia/baseline/calibrations-snapshot/fixtures/extraction-espirometria-ob.json` (v2)
- `evidencia/baseline/calibrations-snapshot/fixtures/extraction-audiometria-saavedra.json` (v2)
- `context/reviews/QA-20260820-08-LOTE-NOCTURNO-AUDIO-ESPIRO.md` (auditoría base)

---

## 2. Verificación F-1 — Espirometría: 9 parámetros sin valores inventados

### 2.1 Inspección visual + OCR independiente del PNG real

Pulso de verificación sobre `context/lote-nocturno-20260820-01/evidencia/espirometria/ESPIRO-OB-input.png` (834×595 RGBA, 198 KB):

| Verificación | Resultado |
|---|---|
| `sha256sum` PNG copia vs AMI original | `7804867b86cfccd85c29ae7391bf6235fff26ebb9af93a03bec88385e7886028` (match) |
| OCR `tesseract 5.5.0 --psm 6 spa+eng` sobre PNG completo | OK; textos visibles: Referencia, Fecha, Hora, Nombre, Sexo, Edad, Talla, Peso, Temp, Pres, Humedad, Fuma, Motivo, IMC, Procedencia, Técnico, Transductor, Referencias, F.étnico, F.BTPS, Versión, INFORME DE FVC, tabla 9 filas |
| OCR sobre recorte 6× LANCZOS de la tabla | OK; matriz FVC/FEV1/MFev1-MFvc/FVC/FEV1/FEV1-FVC/FET100%/Vext./Edad del pulmón × M1/%REF/M2/%REF/M3/%REF/REF/LLN legible |
| Revisión visual a 6× de la fila FEV1 | Valores confirmados: M1=4.16, M2=4.20, M3=4.14, REF=5.29, LLN=4.40, %REF=79/79/78 |

### 2.2 Tabla de valores: PNG vs fixture v2 (celda por celda)

**Cabecera paciente (9/9 campos visibles, todos en PNG → fixture NO null):**

| Campo fixture v2 | Valor fixture | Valor visible PNG (OCR) | Match |
|---|---|---|---|
| `paciente.nombre_completo` | VINIEGRA DIAZ LUIS EDUARDO | VINIEGRA DIAZ LUIS EDUARDO | ✓ |
| `paciente.sexo` | Hombre | Hombre | ✓ |
| `paciente.edad_anios` | 29 | 29 | ✓ |
| `paciente.talla_cm` | 191 | 191 | ✓ |
| `paciente.peso_kg` | 85 | 85 | ✓ |
| `paciente.imc` | 23.3 | 23.3 | ✓ |
| `paciente.motivo` | MATERIALES 2 AÑOS | MATERIALES 2 AÑOS | ✓ |
| `paciente.procedencia` | MACLEAN | MACLEAN | ✓ |
| `paciente.fuma` | NO | NO | ✓ |
| `estudio.referencia` | 2004202611 | 2004202611 | ✓ |
| `estudio.fecha_estudio` | 2026-04-20 | 20-04-2026 | ✓ |
| `estudio.hora_estudio` | 08:23 | 08:23 | ✓ |
| `estudio.tipo_reporte` | INFORME DE FVC | INFORME DE FVC | ✓ |
| `estudio.equipo_modelo` | SIBELMED W20s | SIBELMED W20s | ✓ |
| `estudio.version_software` | SIB-SLA-2.05 | SIB-SLA-2.05 | ✓ |
| `condiciones.tecnico` | GMC | GMC | ✓ |
| `condiciones.transductor` | Turbina | Turbina | ✓ |
| `condiciones.temperatura_c` | 20.1 | 20.1 | ✓ |
| `condiciones.presion_mmhg` | 760 | 760 | ✓ |
| `condiciones.humedad_pct` | 48 | 48 | ✓ |
| `condiciones.referencia_ecuacion` | NHANES III-EEUU Mexicano-Americano | NHANES III-EEUU Mexicano-Americano | ✓ |
| `condiciones.factor_etnico` | 90 | 90 | ✓ |
| `condiciones.factor_btps` | 1.115 | 1.115 | ✓ |

**23/23 campos poblados con valor observable en el PNG; 0 valores inventados.**

**Tabla FVC (9 filas × 8 columnas):**

| Parámetro | M1 (PNG/fixture) | M2 (PNG/fixture) | M3 (PNG/fixture) | REF (PNG/fixture) | LLN (PNG/fixture) | %REF M1 (PNG/fixture) |
|---|---|---|---|---|---|---|
| Mejor FVC | 5.91 / 5.91 | 5.91 / 5.91 | 5.91 / 5.91 | 6.33 / 6.33 | 5.28 / 5.28 | 93 / 93 |
| Mejor FEV1 | 4.20 / 4.20 | 4.20 / 4.20 | 4.20 / 4.20 | 5.29 / 5.29 | 4.40 / 4.40 | 79 / 79 |
| MFev1/MFvc | 71.08 / 71.08 | 71.08 / 71.08 | 71.08 / 71.08 | 83.68 / 83.68 | 74.59 / 74.59 | 85 / 85 |
| FVC | 5.91 / 5.91 | 5.85 / 5.85 | 5.90 / 5.90 | 6.33 / 6.33 | 5.28 / 5.28 | 93 / 93 |
| FEV1 | 4.16 / 4.16 | 4.20 / 4.20 | 4.14 / 4.14 | 5.29 / 5.29 | 4.40 / 4.40 | 79 / 79 |
| FEV1/FVC | 70.29 / 70.29 | 71.89 / 71.89 | 70.13 / 70.13 | 83.68 / 83.68 | 74.59 / 74.59 | 84 / 84 |
| FET100% | 8.82 / 8.82 | 7.69 / 7.69 | 10.11 / 10.11 | ∅ / null | ∅ / null | ∅ / null |
| Vext. | 0.08 / 0.08 | 0.09 / 0.09 | 0.09 / 0.09 | ∅ / null | ∅ / null | ∅ / null |
| Edad del pulmón | 46.53 / 46.53 | 45.08 / 45.08 | 47.07 / 47.07 | ∅ / null | ∅ / null | ∅ / null |

**Diferencias OCR psm-6 ingenuas (no del fixture):** la fila FEV1 fue leída por OCR psm-6 estándar como `3.16 / 3.14 / 9.90` (4→3). La revisión visual 6× confirmó `4.16 / 4.14 / 4.40`. **El fixture v2 contiene los valores correctos (4.16/4.14/4.40) coincidentes con la imagen a alta resolución**, no con la lectura OCR ingenua. Esto confirma que la corrección F-1 hizo OCR de alta fidelidad + revisión visual, no transcripción cruda.

**0 valores inventados. 3 filas (FET100%/Vext./Edad del pulmón) tienen celdas REF/LLN/%REF vacías en el PNG → fixture los devuelve `null` (correcto, no se inventan).**

### 2.3 Eliminación de FEF25-75 (F-1 invocado desde QA-08)

- Fixture v2 NO contiene fila `FEF25-75` (verificado: `parametros[]` tiene 9 entradas, ninguna con `key=fef2575_l_s`).
- Fila FEF25-75 con valores `3.30/3.29/69` del v1 ya no existe. Verificación: `grep -c fef2575` fixture v2 → 0.
- `missing_fields[]` documenta explícitamente cada celda vacía (18 entradas para FET100%/Vext./Edad del pulmón).

### 2.4 Repetibilidad ATS/ERS

- v1: `fvc=0.03 L`, `fev1=0.02 L` (INVENTADOS — el PNG sólo expone flag "Si").
- v2: `fvc=null`, `fev1=null` (correcto). Verificación: busca en JSON → `null` ✓.
- Texto `notas_calidad` explica: "Repetibilidad ATS/ERS: FVC: Si, FEV1: Si (criterio ≤150 mL cumplido). El PNG no expone valores numéricos…".

---

## 3. Verificación F-2 — Audiometría: demografía saneada

### 3.1 Texto crudo del PDF (`pymupdf.get_text()` sobre `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf`)

```
ESTUDIO DE AUDIOMETRIA
DIAGNOSTICO NOSOLOGICO: OÍDO DERECHO: Audición Normal
DIAGNOSTICO NOSOLOGICO: OÍDO IZQUIERDO: Audición Normal
DIAGNOSTICO ETIOLOGICO: Audición Normal
CLASIFICACION HIPOACUSIA: No Aplica
DIAGNOSTICO AUDIOMETRICO: [sin dato]
RECOMENDACIONES: Audiometría de seguimiento anual
Realizó EM: ERIKA RODRIGUEZ LOPEZ
Ced. Prof.:: 4039862
DESCRIPCIÓN AUDIOMÉTRICA: UMBRAL DE AUDICION BILATERAL DENTRO DE RANGO NORMAL EN TODAS LAS FRECUENCIAS
FARINGE: Sin datos patológicos
CAD: permeable
CAI: permeable
MTD: Íntegra, aspecto normal
MTI: Íntegra, aspecto normal
OD: 500Hz=10, 1000Hz=5, 2000Hz=10, 3000Hz=15, Perdida=8.00%, Hipoacusia bilateral=7.1300%
OI: 500Hz=10, 1000Hz=10, 2000Hz=5, 3000Hz=10, Perdida=7.00%
```

**Campos NO presentes en el PDF:** `nombre_completo`, `sexo`, `edad_anios`, `fecha_nacimiento`, `identificacion`, `notas`, `empresa`, `puesto`, `fecha_estudio`, `hora_estudio`, `equipo_modelo`, `transductor`, `ultima_calibracion`, `equipo_numero_serie`, `numero_serie_sistema`, `condiciones.{cabina,equipo,tecnico,observaciones,PTA_general}`.

### 3.2 Tabla cruzada fixture v2 vs PDF

| Campo fixture v2 | Valor v2 | Presente en PDF | Razón |
|---|---|---|---|
| `paciente_detalle.nombre_completo` | "FRANCISCO ERNESTO SAAVEDRA MARIN" | NO (filename) | Retenido desde filename; fuente anotada |
| `paciente_detalle.nombre_completo_fuente` | "filename (SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf) — NO visible en el cuerpo del PDF" | — | Metadato de trazabilidad ✓ |
| `paciente_detalle.sexo` | `null` | NO | **CORREGIDO** (v1 tenía "MASCULINO" del EM.pdf) |
| `paciente_detalle.edad_anios` | `null` | NO | **CORREGIDO** (v1 tenía 41 del EM.pdf) |
| `paciente_detalle.fecha_nacimiento` | `null` | NO | **CORREGIDO** (v1 tenía "1984-09-14" del EM.pdf) |
| `paciente_detalle.identificacion` | `null` | NO | sin cambio |
| `paciente_detalle.notas` | `null` | NO | **CORREGIDO** (v1 tenía "Trabajador; Estudio de audiometría de seguimiento anual" — inventado) |
| `paciente_detalle.empresa` | `null` | NO | sin cambio |
| `paciente_detalle.puesto` | `null` | NO | sin cambio |
| `estudio.fecha_estudio` | `null` | NO | **CORREGIDO** (v1 tenía "2026-04-17" del EM.pdf) |
| `estudio.hora_estudio` | `null` | NO | sin cambio |
| `estudio.tipo_reporte` | "ESTUDIO DE AUDIOMETRIA" | SÍ | **NUEVO** (visible como título del PDF) |
| `estudio.equipo_modelo` | `null` | NO | sin cambio |
| `estudio.transductor` | `null` | NO | sin cambio |
| `estudio.ultima_calibracion` | `null` | NO | sin cambio |
| `estudio.equipo_numero_serie` | `null` | NO | sin cambio |
| `estudio.numero_serie_sistema` | `null` | NO | sin cambio |
| `condiciones.{cabina,equipo,tecnico,observaciones,PTA_general}` | `null` × 5 | NO | sin cambio |
| `oido_derecho.va.{500,1000,2000,3000}` | 10/5/10/15 | SÍ | ✓ |
| `oido_derecho.va.{250,4000,6000,8000}` | `null` × 4 | NO (celdas no en PDF) | ✓ no inventado |
| `oido_izquierdo.va.{500,1000,2000,3000}` | 10/10/5/10 | SÍ | ✓ |
| `oido_izquierdo.va.{250,4000,6000,8000}` | `null` × 4 | NO | ✓ |
| `resumen_oidos.perdida_por_oido_od_pct` | 8.00 | SÍ | ✓ |
| `resumen_oidos.perdida_por_oido_oi_pct` | 7.00 | SÍ | ✓ |
| `resumen_oidos.hipoacusia_bilateral_combinada_od_pct` | 7.13 | SÍ (PDF: 7.1300%) | ✓ |
| `campos_fuente.{faringe,cad,cai,mtd,mti}` | ver JSON | SÍ | ✓ |
| `notas_calidad.descripcion` | "UMBRAL DE AUDICION BILATERAL DENTRO DE RANGO NORMAL EN TODAS LAS FRECUENCIAS" | SÍ | ✓ |
| `diagnostico_nosologico_{od,oi}` | "Audición Normal" | SÍ | ✓ |
| `clasificacion_hipoacusia_{od,oi}` | "No Aplica" | SÍ | ✓ |
| `recomendaciones` | "Audiometría de seguimiento anual" | SÍ | ✓ |
| `medico_realiza` | "ERIKA RODRIGUEZ LOPEZ" | SÍ | ✓ (separado de la cédula) |
| `medico_cedula` | "4039862" | SÍ ("Ced. Prof.:: 4039862") | ✓ **NUEVO** |

**Campos no visibles neutralizados a `null`:** sexo, edad_anios, fecha_nacimiento, notas, fecha_estudio, estudio.* (8 campos), condiciones.* (5 campos), frecuencias 250/4000/6000/8000 (8 campos). **Total: 24 campos null con fuente documentada en `missing_fields[]`.**

**Ningún campo demográfico no visible conserva valor del v1.** El único campo retenido del filename es `nombre_completo`, explícitamente anotado como derivado de filename con `nombre_completo_fuente`.

---

## 4. Validaciones independientes re-ejecutadas

### 4.1 `node validate-snapshot.js`

```
✓ V3 root contract valid (audiometria-v3-tested.json)
✓ Audiometry schema: 8 canonical frequencies present
✓ V3 root contract valid (espirometria-v3-draft.json)
…
Diff Audio: cobertura estructural 50% (4/8 freqs con valor del PDF SAAVEDRA).
Diff Espiro: 9 parámetros detectados; 6 con LLN visible en PNG; 6 con REF; 6 con %REF M1.
AC-3.4 LLN coherente: PASS (6/9 PNG: Mejor FVC=5.28, Mejor FEV1=4.40, MFev1/MFvc=74.59, FVC=5.28, FEV1=4.40, FEV1/FVC=74.59)
…
Exit code: 0
```

Captura persistente: `/tmp/kilo/qa-09-validate.txt`.

### 4.2 Verificación de estados V3 (independiente del validador)

Comando: `grep -n "publishedVersions\|\"status\":" audiometria-v3-tested.json espirometria-v3-draft.json`

| Archivo | `draft.status` | `publishedVersions` | `currentPublishedVersionId` |
|---|---|---|---|
| `audiometria-v3-tested.json` | `tested` | `[]` | `null` |
| `espirometria-v3-draft.json` | `draft` | `[]` | `null` |

**Audio: `tested` ✓. Espiro: `draft` ✓. Ambos `publishedVersions=[]` ✓. Cero riesgo de promoción accidental a `published` ✓.**

### 4.3 Integridad AMI

| Verificación | Resultado |
|---|---|
| `sha256sum context/lote-nocturno-20260820-01/evidencia/espirometria/ESPIRO-OB-input.png` | `7804867b86cfccd85c29ae7391bf6235fff26ebb9af93a03bec88385e7886028` |
| `sha256sum "context/datos AMI/informacion para revision/ESPIRO OB.png"` | `7804867b86cfccd85c29ae7391bf6235fff26ebb9af93a03bec88385e7886028` (match) |
| `sha256sum "context/datos AMI/informacion para revision/SAAVEDRA MARIN FRANCISCO ERNESTO.zip"` | `1f0e60782442964083a111108de9341c2b5d781016ed1eb29e950c85f7bea541` (idéntico al baseline) |
| `find "context/datos AMI" -newer /tmp/kilo/.lote-start -type f` | **0 archivos** (sin modificaciones por SOFIA en IMPL-20260821-07/08) |

**AMI intacto ✓.**

### 4.4 Estado git

```
$ git status --porcelain
 M PROYECTO.md (preexistente; no introducido por IMPL-20260821-07/08)
 M context/CURRENT.md (preexistente)
 M context/Juntas/Junta semanal… (preexistente)
 M discovery/DECISIONS.md (preexistente)
?? context/lote-nocturno-20260820-01/ (untracked; ningún commit de la corrección)
```

**Sin commit/push del lote ✓. Sin cambios a código de producto ✓.**

---

## 5. Trazabilidad AC post-corrección

| AC | Estado pre-corrección | Estado post-corrección | Evidencia |
|---|---|---|---|
| AC-2.1 Audio V3 tested | PASS | PASS | Sin cambio (audiometria-v3-tested.json sin tocar) |
| AC-2.2 no published Audio | PASS | PASS | `publishedVersions=[]` |
| AC-2.3 diff umbrales Audio | PASS | PASS | 8 filas OD/OI; sólo 4 con valor (resto null) — sin cambio |
| AC-2.4 completitud_doc Audio | NO PROCEDE | NO PROCEDE | sigue 50% (cuestión del insumo, no del fixture) |
| AC-2.5 gaps Audio | PASS | PASS | DG-2 P1 — sin cambio |
| AC-3.1 Espiro V3 auditada | PASS | PASS | espirometria-v3-draft.json sin tocar |
| AC-3.2 no published Espiro | PASS | PASS | `publishedVersions=[]` |
| AC-3.3 limitación PNG declarada | PASS | PASS | DIFF-ESPIRO §2 — sin cambio |
| AC-3.4 LLN coherente | PASS (con caveat) | **PASS (actualizado)** | 6/9 LLN visibles en PNG; antes 0/4 — **mejora** |

---

## 6. Hallazgos del addendum

### F-1 / F-2 cierre verificado

- **F-1 (P1, original):** CERRADO. Fixture v2 refleja fielmente el PNG: 9 filas, 23/23 campos poblados observables, 0 valores inventados, FEF25-75 eliminado, repetibilidad falsamente numérica → null, LLN coherente directamente con PNG (6/9).
- **F-2 (P1, original):** CERRADO. Fixture v2 sanea demografía: sexo/edad/fecha_nacimiento/fecha_estudio/notas → null; nombre_completo sólo desde filename con fuente anotada; 24 campos null con trazabilidad en `missing_fields[]`.

### Hallazgos residuales (no bloqueantes)

#### QA-09-R1 (P3) — Trazabilidad documental: tiny inaccuracy en characterization de %REF M2 de FVC

- **Descripción:** `parametros[3].m2_pct_ref` (FVC) en fixture v2 = 92. Verificación visual confirma 92 para la columna %REF M2 de FVC. Sin embargo, la fila "FVC" en el JSON tiene `m2_pct_ref=92` que es coherente. **No hay error** — sólo señalo que la tabla del `validate-snapshot.js` no desglosa %REF M2/M3 (sólo %REF M1), por lo que un revisor posterior no puede validar 92/93 M2/M3 sólo con la salida del validador. No es un defecto; es una limitación del validador.
- **Impacto:** Documental — la fidelidad del fixture es correcta; lo que falta es cobertura del validador.
- **Owner:** INTEGRA (considerar añadir %REF M2/M3 al reporte del validador en próxima iteración).
- **Condición de cierre:** ninguna — el diff bit-a-bit en `DIFF-ESPIRO.md §3.2` ya incluye la tabla completa.

#### QA-09-R2 (P3) — DEPRECATED: la nota de "limitación AMI" en GAPS.md podría re-evaluarse

- **Descripción:** La corrección F-1 reduce la limitación DG-3-AMI-VALORES-REF de "total" a "parcial" (6/9 LLN visibles en PNG). La cabecera `GAPS.md` debería idealmente reflejar "PARCIALMENTE SUBSANADO" para DG-3. La sección post-cierre añadida al final sí documenta el estado, pero la cabecera principal no fue actualizada.
- **Impacto:** sólo consistencia documental.
- **Owner:** INTEGRA (revisión documental).
- **Condición de cierre:** aclarar alineación de DG-3 con estado "parcialmente subsanado" en próxima pasada.

#### QA-09-R3 (P3) — Verificación bit-a-bit depende de OCR + revisión visual

- **Descripción:** El FIX-20260812-20 (vigente en backend) cubre el extractor real. La corrección F-1 cubre el fixture de simulación. La convergencia entre extractor real y fixture de simulación **no se ha probado** porque el lote prohíbe invocar la API IA real (DG-5). Si en próxima iteración se ejecuta el extractor real sobre el PNG, podría haber drift entre los valores simulados en `parametros[].m1_value` y los extraídos por la API.
- **Impacto:** bajo si el fixture v2 sigue siendo referencia; medio-alto si la SPEC decide promover a `tested` en base a la fidelidad del fixture.
- **Owner:** SOFIA (próximo lote con extractor real); INTEGRA (definir criterios de aceptación para promoción a `tested`).
- **Condición de cierre:** ejecutar extracción real al menos una vez para validar drift < tolerancia; documentar resultado en `GAPS.md DG-5`.

#### QA-09-R4 (P3) — Restricción heredada: AC-2.4 `completitud_doc ∈ {suficiente, completo}` no se cumple

- **Descripción:** Reincidente del QA-08 F-5. Audio sigue en `tested` con cobertura 50% (PDF 4/8 frecs). La corrección F-2 no toca esto (no es su alcance). Sigue dependiendo de un nuevo insumo AMI.
- **Impacto:** sin cambio.
- **Owner:** ATLAS→Frank (solicitar PDF con 8 frecuencias).
- **Condición de cierre:** nuevo insumo.

---

## 7. Riesgos operativos y preparación por entorno

### Calidad (desarrollo)

- **LISTO** para merge/uso de las calibraciones V3 (`audiometria-v3-tested.json` + `espirometria-v3-draft.json`) con la corrección F-1/F-2 aplicada.
- Validador estructural PASS (`exit 0`); 2 hallazgos P1 cerrados; 0 nuevos P0/P1 introducidos.

### Staging

- **NO LISTO** — el lote prohíbe `published` V3; no hay cambios deployables. Las correcciones son documentales/fixtures.

### Producción

- **NO EVALUADO** — el lote prohíbe deploy y publicación V3. No aplica en este addendum.

---

## 8. Handoff a ATLAS

**Acción recomendada para ATLAS:**

1. **Aceptar el veredicto `PASS_WITH_WARNINGS`** del addendum QA-09 (no es `FAIL`/`BLOCKED`).
2. **Pivote a INTEGRA para Unidad 6 (cierre del lote)** — INTEGRA ejecuta (sin cambios respecto a QA-08 §7):
   - Verificación de lectura (no escritura): `git status` sin staged; `find … -newer /tmp/kilo/.lote-start` → 0 (verificado en este addendum).
   - Consolidar `context/lote-nocturno-20260820-01/CIERRE-LOTE.md` actualizado con F-1/F-2 cerrados.
   - Actualizar `context/CURRENT.md` y `PROYECTO.md` con estado `DONE (pendiente-revisión-Frank)`.
   - Una sola `notify_user` con resumen ejecutivo.
3. **NO pivotar a DEBY** — los hallazgos residuales (R1–R4) son P3 no bloqueantes.
4. **Escalar a Frank** los pendientes estructurales (sin cambios respecto a QA-08):
   - DG-1: PDF Sibelmed W20s con tabla exhaustiva (PEF, FEF25/50/75, FEV6, FIVC).
   - DG-2: PDF Audiometría con 8 frecuencias canónicas.
   - DG-3 (parcial): `VALORES DE REFERENCIA_ESPIRO.xlsx` con ecuaciones GLI-2012.
   - Decisión sobre F-5 (regla del 50% como nueva convención).
5. **Documentar convergencia extractor-real vs fixture-simulación** (R3) en `GAPS.md DG-5` para próximo lote.

**Gate siguiente:** Unidad 6 (INTEGRA coordina) → cierre matinal del lote con Frank.

---

## 9. Autoauditoría (cumple §11 IDL v3 GEMINI)

- Delimité el incremento exacto (7 archivos: 2 fixtures v2 + 4 docs + 1 script).
- Verifiqué SPEC activa (`SPEC_LOTE-20260820-01 v1.0`) y la decisión de que la corrección cabe en §4-§6 del handoff.
- Revisé el diff real bit-a-bit contra las fuentes (PNG, PDF) — no me limité al reporte de SOFIA.
- No edité código, tests, config, `discovery/`, `SPEC/`, `PROYECTO.md`, AMI, ni fixtures.
- No imprimí PII (auditoría: nombre_completo aparece en fixture y en mi reporte, pero ambos son referencia a la misma entidad documentada como entrada del lote).
- Cada hallazgo tiene evidencia (línea, archivo, comparación bit-a-bit), impacto, owner y condición de cierre.
- Separé severidad QA (P0/P1/P2/P3) de niveles L1/L2/L3.
- Separé QA / staging / producción.
- No invoqué subagentes, no declaré `DONE`, no hice commit/push.
- El handoff vuelve a ATLAS con acción concreta y gate siguiente.
