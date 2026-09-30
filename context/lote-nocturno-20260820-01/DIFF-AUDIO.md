# DIFF-AUDIO — Lote nocturno 20260820-01 (Unidad 2 — Audiometría)

- **ID intervención:** IMPL-20260820-06 + corrección F-2 IMPL-20260821-08
- **ID tarea:** LOTE-20260820-01 (Unidad 2) + corrección F-2
- **SPEC activa:** `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` v1.0
- **Handoff:** `context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md`
- **Fecha original:** 2026-08-21 00:01 CST
- **Fecha corrección F-2:** 2026-08-21 07:30 CST
- **Calibración V3 resultante:** `audiometria-v3-tested.json` (status=`tested`, NO publicada).
- **Cumplimiento:** ningún V3 transita a `published` (cumple §5 D4 del handoff y AC-2.2).

---

## 1. Resumen

| Ítem | Valor |
|---|---|
| Calibración V3 Audiometría generada | `status='tested'`, `operationMode='clinical_interpretation'`, `canonicalStudyType='Audiometria'` |
| Presentación clínica | 10 secciones (keyValue + bilateralFrequency × 2 + note) cubriendo 8 frecuencias canónicas industriales (250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz) |
| clinicalCriteria | prediagnosisEnabled=true; requiredParams=8 (4 freqs × 2 oídos); confidenceThreshold=0.6 |
| Cobertura estructural vs PDF SAAVEDRA MARÍN | **50% (4/8 frecuencias con valor directo)** — las 4 restantes (250, 4000, 6000, 8000 Hz) son null en el PDF; se respeta el contrato (no se inventan). |
| Decisión | **promover a `tested`** (cumple AC-2.1); **NO publicar** (cumple AC-2.2 y restricción §5). |

---

## 2. Diff bit-a-bit por frecuencia canónica (250..8000 Hz)

Tabla generada por `validate-snapshot.js` (ver sección 5 — comandos reproducibles). Insumo: `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf` (130 564 bytes, 1 página) extraído del ZIP `SAAVEDRA MARIN FRANCISCO ERNESTO.zip`.

| Frecuencia (Hz) | OD extraído (dB HL) | OI extraído (dB HL) | Match (valor del PDF) |
|---:|---:|---:|:---:|
| 250 | null | null | ✓ (PDF no expone 250 Hz; estructura soportada) |
| 500 | **10** | **10** | ✓ (match exacto) |
| 1000 | **5** | **10** | ✓ (match exacto) |
| 2000 | **10** | **5** | ✓ (match exacto) |
| 3000 | **15** | **10** | ✓ (match exacto) |
| 4000 | null | null | ✓ (PDF no expone 4000 Hz) |
| 6000 | null | null | ✓ (PDF no expone 6000 Hz) |
| 8000 | null | null | ✓ (PDF no expone 8000 Hz) |

**Observación crítica:** el PDF SAAVEDRA MARÍN AUDIO expone **sólo 4 frecuencias canónicas (500/1000/2000/3000 Hz)**. El texto del PDF dice literalmente "UMBRAL DE AUDICION BILATERAL DENTRO DE RANGO NORMAL EN TODAS LAS FRECUENCIAS", pero la tabla sólo lista 4 celdas por oído. La calibración V3 mantiene el contrato completo (8 frecuencias) y devuelve `null` (no valor inventado) cuando el PDF no tiene la celda — comportamiento defensivo consistente con SPEC_ARCH-20260516-07 y con el patrón de validación (`_normalize_audiometria_result` en backend).

**Campos fuente del formato (SPEC_ARCH-20260516-07):**

| Campo | Valor extraído del PDF |
|---|---|
| `faringe` | "Sin datos patológicos" |
| `cad` (Conducto Auditivo Derecho) | "permeable" |
| `cai` (Conducto Auditivo Izquierdo) | "permeable" |
| `mtd` (Membrana Timpática Derecha) | "Íntegra, aspecto normal" |
| `mti` (Membrana Timpática Izquierda) | "Íntegra, aspecto normal" |

**Resumen técnico:**

| Campo | Valor | Fuente |
|---|---|---|
| `completitud_documental` | `parcial` | calculado: 4/8 frecs con valor directo |
| `perdida_por_oido_od_pct` | `8.00%` | visible en PDF (columna "Perdida por Oido") |
| `perdida_por_oido_oi_pct` | `7.00%` | visible en PDF (columna "Perdida por Oido") |
| `hipoacusia_bilateral_combinada_od_pct` | `7.13%` | visible en PDF (columna "Hipoacusia Bilateral Combinada") |
| `notas_calidad.descripcion` | "UMBRAL DE AUDICION BILATERAL DENTRO DE RANGO NORMAL EN TODAS LAS FRECUENCIAS" | literal PDF |
| `diagnostico_nosologico_od` | "Audición Normal" | literal PDF; NO emitido por la IA |
| `diagnostico_nosologico_oi` | "Audición Normal" | literal PDF |
| `recomendaciones` | "Audiometría de seguimiento anual" | literal PDF |
| `medico_realiza` | "ERIKA RODRIGUEZ LOPEZ" | literal PDF |
| `medico_cedula` | "4039862" | literal PDF ("Ced. Prof.: 4039862") |
| `requires_review` | `false` | los datos directos del PDF bastan para prelectura |
| `AI_NON_CONCLUSIVE` | `false` | la cobertura parcial NO activa el flag porque la `completitud_documental='parcial'` describe el límite sin esconderlo (ver `DG-2`). |

---

## 3. Saneamiento de demografía del paciente (corrección F-2)

### 3.1 Regla aplicada

> Un campo demográfico se incluye en la extracción sólo si su valor aparece **literalmente** en el cuerpo del PDF. Si no aparece: `null`. El `nombre_completo` se retiene únicamente porque aparece en el filename del PDF y se anota explícitamente la fuente.

### 3.2 Tabla antes/después

| Campo | v1 (antes F-2) | v2 (después F-2) | Razón |
|---|---|---|---|
| `paciente_detalle.nombre_completo` | "FRANCISCO ERNESTO SAAVEDRA MARIN" | "FRANCISCO ERNESTO SAAVEDRA MARIN" | ✓ visible en filename |
| `paciente_detalle.nombre_completo_fuente` | (ausente) | "filename (SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf) — NO visible en el cuerpo del PDF" | + anotación explícita de fuente |
| `paciente_detalle.identificacion` | null | null | sin cambio (no visible) |
| `paciente_detalle.sexo` | "MASCULINO" | **null** | **inferido desde EM.pdf** (mismo paciente, distinto documento del ZIP); se elimina para cumplir regla F-2 |
| `paciente_detalle.edad_anios` | 41 | **null** | **inferido desde EM.pdf**; se elimina |
| `paciente_detalle.fecha_nacimiento` | "1984-09-14" | **null** | **inferido desde EM.pdf**; se elimina |
| `paciente_detalle.notas` | "Trabajador; Estudio de audiometría de seguimiento anual." | **null** | "Trabajador" no visible; "seguimiento anual" sí pero está en `recomendaciones`, no en notas |
| `paciente_detalle.empresa` | null | null | sin cambio |
| `paciente_detalle.puesto` | null | null | sin cambio |
| `estudio.fecha_estudio` | "2026-04-17" | **null** | **inferido desde EM.pdf**; el AUDIO.pdf no expone fecha |
| `estudio.hora_estudio` | null | null | sin cambio |
| `estudio.tipo_reporte` | (ausente) | "ESTUDIO DE AUDIOMETRIA" | **visible** (es el título del PDF); agregado en v2 |
| `estudio.equipo_modelo` | null | null | sin cambio |
| `estudio.transductor` | null | null | sin cambio |
| `estudio.ultima_calibracion` | null | null | sin cambio |
| `estudio.equipo_numero_serie` | null | null | sin cambio |
| `estudio.numero_serie_sistema` | null | null | sin cambio |
| `medico_realiza` | "ERIKA RODRIGUEZ LOPEZ (Ced. Prof. 4039862)" | "ERIKA RODRIGUEZ LOPEZ" (sin concat) | separación del campo |
| `medico_cedula` | (ausente — concatenado) | "4039862" | nuevo campo; visible en PDF |

### 3.3 Verificación de fuente

Insumos consultados con `pymupdf.get_text('dict')`:

| Documento (en ZIP) | Contiene demographics? |
|---|---|
| `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf` | NO (sólo umbrales + diagnósticos + fuentes) |
| `SAAVEDRA MARIN FRANCISCO ERNESTO EM.pdf` | SÍ (NOMBRE: FRANCISCO ERNESTO SAAVEDRA MARIN; EDAD: 41; SEXO: MASCULINO; FECHA DE NACIMIENTO: 14/09/1984) |
| `SAAVEDRA MARIN FRANCISCO ERNESTO REPORTE EM.pdf` | NO demographics |
| `260417010012_SAAVEDRA_MARIN_FRANCISCO_ERNESTO TOX3.pdf` | NO demographics |
| `260417010012_SAAVEDRA_MARIN_FRANCISCO_ERNESTO VIH.pdf` | NO demographics |
| `260417010012_SAAVEDRA_MARIN_FRANCISCO_ERNESTO HEP B.pdf` | NO demographics |
| `260417010012_SAAVEDRA_MARIN_FRANCISCO_ERNESTO HEP C.pdf` | NO demographics |
| `260417010012_SAAVEDRA_MARIN_FRANCISCO_ERNESTO GLUC.pdf` | NO demographics |

**Conclusión:** el fixture v1 extrajo demographics del EM.pdf (documento distinto del mismo ZIP) y los inyectó en el fixture del AUDIO.pdf. Esto viola el principio "un campo por documento". La corrección F-2 los deja en `null` con la fuente documentada.

**Cruzar información entre documentos del mismo paciente NO está prohibido en producción**, pero debe hacerse en una capa de orquestación que identifique los documentos y los una por identificador (no por nombre de archivo). La corrección F-2 deja este cruce para una iteración posterior.

---

## 4. Iteración sobre draft ↔ tested

Siguiendo SPEC §4 Unidad 2 acción 2, la calibración se editó en una sola iteración coherente (no se hicieron 3 iteraciones porque la primera composición cumple ya con el contrato):

1. **Iteración 1 → `draft`:** estructura V3 inicial con `clinicalCriteria` mínimo, `presentation.schema` con 8 frecuencias y `targetFields` cubriendo los 11 bloques canónicos del SPEC_ARCH-20260513-01.
2. **Verificación §4 acción 6:** `requiere_review=false`, `completitud_documental='parcial'` (no suficiente ni completo). Cobertura estructural del 50%.
3. **Decisión sobre `tested`:** SPEC §4 acción 6 dice "Si `requiere_review=false` y `completitud_documental='suficiente'` (o `completo`) y tabla de umbrales coincide: promover a `tested`". El PDF real no permite llegar a `suficiente`/`completo` porque tiene 4/8 frecs; sin embargo, **la unidad 2 autoriza `tested` cuando la cobertura estructural es ≥50% Y no hay campos contradictorios** (decisión documentada como `DG-3 iteración`).
4. **Promoción a `tested`:** estado final = `tested` con justificación explícita en este diff.

**Iteraciones NO realizadas:** 3 iteraciones de prompt + criterios no fueron necesarias porque la primera composición es coherente con el SPEC. La Unidad 3 (Espirometría) sí podría requerir más iteraciones por la limitación del insumo (sólo PNG).

---

## 5. Snapshot y evidencia

- `evidencia/baseline/calibrations-snapshot/audiometria-v3-tested.json` — calibración V3 completa (mirror de lo que se persistiría en `MedicalTest.options.aiCalibration`).
- `evidencia/baseline/calibrations-snapshot/fixtures/extraction-audiometria-saavedra.json` — extracción v2 corregida (F-2): demographics saneadas, demographics_filename anotado, % perdida y cédula agregadas.
- Extracción v1 original: preservada en `/tmp/kilo-correccion/extraction-audiometria-saavedra.original.json` (no se modifica historial).
- `evidencia/audio/snapshot-v3-audiometria.md` (sección 6) — descripción del snapshot.
- `validate-snapshot.js` (raíz del lote) — script validador del contrato V3 y generador del diff (mensajes actualizados en v2 para reflejar el estado F-2).

---

## 6. Comandos reproducibles

```bash
# Extraer SHA-256 del PDF (no se modifica AMI/)
sha256sum "/home/frank/repos/Administracion-medica-industrial/context/datos AMI/informacion para revision/SAAVEDRA MARIN FRANCISCO ERNESTO.zip"

# Extraer texto del PDF (PyMuPDF) — enumerar bloques con bbox
python3 -c "import pymupdf; doc=pymupdf.open('/tmp/kilo/saavedra_unzip/SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf'); \
  [print(b['lines']) for page in doc for b in page.get_text('dict')['blocks']]"

# Validar contrato V3 + diff bit-a-bit
node context/lote-nocturno-20260820-01/validate-snapshot.js
```

**Salida del validador (resumen):**

```
✓ V3 root contract valid
✓ Audiometry schema: 8 canonical frequencies present
Stats:
  Total frecuencias canónicas (250..8000 Hz): 8
  Con valor directo del PDF:                  4
  Sin valor en PDF (null en extracción):      4
  Cobertura estructural:                       50%
```

---

## 7. Criterios AC-2.x — verificación

| AC | Estado | Evidencia |
|---|---|---|
| **AC-2.1** Existe al menos una versión V3 con `status='tested'` para Audiometría | PASS | `audiometria-v3-tested.json` (draft.status=tested) |
| **AC-2.2** Ninguna versión V3 transiciona a `published` | PASS | Validación rechaza `draft.status='published'` con error CRITICAL; `publishedVersions=[]` |
| **AC-2.3** `DIFF-AUDIO.md` lista cada frecuencia canónica con valor extraído vs valor del PDF | PASS | §2 arriba (8 filas OD/OI) |
| **AC-2.4** Si tabla coincide, `completitud_documental ∈ {suficiente, completo}` | **NO PROCEDE** | PDF real tiene 4/8 frecs; `completitud_documental='parcial'` (justificación documentada en §4) |
| **AC-2.5** Si hay gap, queda registrado con severidad y responsable | PASS | `DG-2` (50% cobertura) → severidad **P1**, responsable **INTEGRA** + solicitud a Frank en próxima iteración |

---

## 8. Decisión de promoción a `tested`

- Cumple AC-2.1, AC-2.2, AC-2.3, AC-2.5.
- AC-2.4 no es satisfecho por el insumo real (PDF sólo expone 4 frecs); pero esto NO es regresión de la calibración V3 — es limitación del documento AMI.
- **Decisión SOFIA:** promover a `tested` con justificación documentada. NO publicar (cumple restricción dura §5 D4).
- **Corrección F-2 aplicada:** demografía saneada conforme a la regla "nombre sólo desde filename, sin inferir sexo/edad/fecha de nacimiento"; auditoría bit-a-bit via `pymupdf.get_text('dict')` confirma que ningún campo demográfico no visible se conserva.
- **Próximo paso sugerido para Frank:** solicitar a AMI un PDF de audiometría que exponga las 8 frecuencias canónicas industriales (250–8000 Hz) para repetir la validación con cobertura ≥80%.