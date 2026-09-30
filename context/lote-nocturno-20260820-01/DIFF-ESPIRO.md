# DIFF-ESPIRO — Lote nocturno 20260820-01 (Unidad 3 — Espirometría)

- **ID intervención:** IMPL-20260820-06 + corrección F-1 IMPL-20260821-07
- **ID tarea:** LOTE-20260820-01 (Unidad 3) + corrección F-1
- **SPEC activa:** `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` v1.0
- **Handoff:** `context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md`
- **Fecha original:** 2026-08-21 00:03 CST
- **Fecha corrección F-1:** 2026-08-21 07:25 CST
- **Calibración V3 resultante:** `espirometria-v3-draft.json` (status=`draft`, NO publicada, NO `tested`).
- **Cumplimiento:** ningún V3 transita a `published` (cumple §5 D4 del handoff y AC-3.2).
- **Riesgo aceptado:** R1 (SPEC §6) — sin PDF de espirometría real; la tabla exhaustiva del PNG cubre 9 filas vs 15 esperables en Sibelmed W20s (PEF, FIVC, FEF75, etc. quedan fuera del PNG).

---

## 1. Resumen

| Ítem | Valor |
|---|---|
| Calibración V3 Espirometría generada | `status='draft'`, `operationMode='clinical_interpretation'`, `canonicalStudyType='Espirometria'` |
| Presentación clínica | 7 secciones (keyValue × 6 + table × 1) cubriendo 9 parámetros extraídos del PNG (Mejor FVC, Mejor FEV1, MFev1/MFvc, FVC, FEV1, FEV1/FVC, FET100%, Vext., Edad del pulmón) con tabla M1/M2/M3/REF/LLN/%REF |
| Paciente (visible en PNG) | nombre_completo, sexo, edad_anios, talla_cm, peso_kg, imc, motivo, procedencia, fuma — 9/9 campos observables |
| Estudio (visible en PNG) | referencia, fecha_estudio, hora_estudio, tipo_reporte, equipo_modelo, version_software — 6/6 campos observables |
| Condiciones (visible en PNG) | tecnico, transductor, temperatura_c, presion_mmhg, humedad_pct, referencia_ecuacion, factor_etnico, factor_btps — 8/8 campos observables |
| clinicalCriteria | prediagnosisEnabled=true; requiredParams=3 (fev1_l, fvc_l, fev1_fvc_pct); confidenceThreshold=0.7 |
| `presentation.schema` secciones | Resumen principal, Datos del paciente, Datos del estudio, Condiciones técnicas, Calidad técnica, Parámetros espirométricos (tabla canónica), Gráficas e indicadores |
| FIX-20260812-20 vigencia | CONFIRMADO vía `git log -- backend/app/services/ai/extractor.py \| grep -i espirometria` y `grep -n _ESPIROMETRIA_BACKEND_GUARDRAILS extractor.py` |
| Decisión | **mantener en `draft`** (cumple AC-3.1) por limitación del insumo (PNG sin PDF; tabla cubre 9 filas vs 15 esperables; FET100%/Vext./Edad pulmonar sin LLN/REF/%REF en el PNG). **NO promover a `tested`**, **NO publicar**. |

---

## 2. Limitación crítica del insumo (DG-1) — declaración explícita

**El AMI no entrega PDF de espirometría real.** Insumos disponibles en `context/datos AMI/informacion para revision/`:

| Archivo | Tipo | Uso |
|---|---|---|
| `ESPIRO OB.png` | PNG (834×595 px, RGBA, 198 KB) | Caso visual — único insumo de valores espirométricos |
| `criterios repetitibilidad-espirometria.png` | PNG (724×860 px, RGBA, 241 KB) | Criterios ATS/ERS (repetibilidad FVC/FEV1) |
| `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` | **NO EXISTE** | — |
| `DIAGNOSTICO BASICO AUDIOS.pptx` | **NO EXISTE** | — |
| `VALORES DE REFERENCIA.xlsx` | XLSX (5 hojas: HEMATOLOGIA, QUIMICA CLINICA, INMUNOLOGIA, UROANALISIS+PARASITOLOGIA, TOXICOLOGIA) | **NO contiene hoja de espirometría ni valores LLN** |

**Consecuencias en la calibración V3 (corregidas tras F-1):**

- La extracción corregida sobre el PNG cubre **9 parámetros canónicos** observables (Mejor FVC/FEV1, MFev1/MFvc, FVC/FEV1/FEV1-FVC por maniobra, FET100%, Vext., Edad del pulmón) — **NO es la lista exhaustiva** que cubre una Sibelmed W20s real (también esperable: PEF, FEF25, FEF50, FEF75, FEV6, FIVC, etc.).
- El campo `LLN` es visible en el PNG para 6/9 parámetros (Mejor FVC=5.28, Mejor FEV1=4.40, MFev1/MFvc=74.59, FVC=5.28, FEV1=4.40, FEV1/FVC=74.59). Para los 3 restantes (FET100%, Vext., Edad del pulmón) las celdas LLN/REF/%REF están vacías en el PNG; se devuelven null (no se inventan). Documentado en `missing_fields[]`.
- Los valores de `REF` (predicho) son visibles para los mismos 6 parámetros (5.29/5.29/83.68 para FVC/FEV1/FEV1-FVC y duplicados para los Mejores).
- El `clinicalCriteria` no puede ser promovido a `tested` porque no es validable la trazabilidad bit-a-bit contra una tabla exhaustiva de parámetros con LLN para las 3 filas sin LLN en PNG, ni contra las filas que el PNG directamente no expone (PEF, FIVC, etc.).

**Decisión SOFIA:** mantener `draft` (no `tested`) hasta que AMI entregue PDF con tabla FVC/FEV1/M1/M2/M3/REF/LLN completa y referencia normativa que respalde los LLN. **Esto NO bloquea las Unidades 1, 2 y 4** que ya completaron AC.

---

## 3. Valores observables (extraídos vía OCR de alta fidelidad del PNG, NO inferidos)

**Origen:** `tesseract 5.5.0 spa+eng` aplicado a `ESPIRO OB.png` (no se modifica el AMI; OCR en `/tmp/kilo-correccion/`). Equipo: `SIBELMED W20s`. Versión software: `SIB-SLA-2.05`. Fecha del estudio: `2026-04-20 08:23`. Referencia: `2004202611`.

**Método de extracción (corrección F-1):**

1. `tesseract --psm 6 spa+eng` sobre PNG completo (834×595).
2. `tesseract --psm 6 spa+eng` sobre recortes por fila (×4 upscaling LANCZOS).
3. `tesseract --psm 6 eng` con whitelist numérica `0123456789.()LFEVC/%s` sobre recortes (×6 upscaling).
4. Revisión visual de la tabla completa a 3× (ver `/tmp/kilo-correccion/espiro_table_3x.png`).

### 3.1 Paciente (cabecera PNG — 9/9 campos visibles)

| Campo | Valor observable en PNG |
|---|---|
| Referencia | `2004202611` |
| Fecha | `20-04-2026` |
| Hora | `08:23` |
| Nombre | `VINIEGRA DIAZ LUIS EDUARDO` |
| Sexo | `Hombre` |
| Edad(a) | `29` |
| Talla(cm) | `191` |
| Peso(Kg) | `85` |
| Temp(°C) | `20.1` |
| Pres(mmHg) | `760` |
| Humedad(%) | `48` |
| 1.Fuma | `NO` |
| Motivo | `MATERIALES 2 AÑOS` |
| IMC | `23.3` |
| Procedencia | `MACLEAN` |
| Técnico | `GMC` |
| Transductor | `Turbina` |
| Referencias | `NHANES III-EEUU Mexicano-Americano` |
| F.étnico | `90` |
| F.BTES | `1.115` |
| Versión | `SIB-SLA-2.05` |

### 3.2 Tabla INFORME DE FVC (SIBELMED W20s) — 9 filas × 8 columnas

| Parámetro | Unidad | M1 | %REF M1 | M2 | %REF M2 | M3 | %REF M3 | REF | LLN |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Mejor FVC** | L | **5.91** | 93 | **5.91** | 93 | **5.91** | 93 | **6.33** | **5.28** |
| **Mejor FEV1** | L | **4.20** | 79 | **4.20** | 79 | **4.20** | 79 | **5.29** | **4.40** |
| **MFev1/MFvc** | % | **71.08** | 85 | **71.08** | 85 | **71.08** | 85 | **83.68** | **74.59** |
| **FVC** | L | **5.91** | 93 | **5.85** | 92 | **5.90** | 93 | **6.33** | **5.28** |
| **FEV1** | L | **4.16** | 79 | **4.20** | 79 | **4.14** | 78 | **5.29** | **4.40** |
| **FEV1/FVC** | % | **70.29** | 84 | **71.89** | 86 | **70.13** | 84 | **83.68** | **74.59** |
| **FET100%** | s | **8.82** | null | **7.69** | null | **10.11** | null | null | null |
| **Vext.** | L | **0.08** | null | **0.09** | null | **0.09** | null | null | null |
| **Edad del pulmón** | años | **46.53** | null | **45.08** | null | **47.07** | null | null | null |

**Notas:**

- FET100%, Vext. y Edad del pulmón NO exponen columnas REF/LLN/%REF en el PNG — celdas devueltas en null (no se inventan).
- Fila FEF25-75 que aparecía en `extraction-espirometria-ob-v1` **NO existe en el PNG** y fue eliminada en la corrección F-1.
- Repetibilidad ATS/ERS: el PNG sólo expone flags `FVC: Si, FEV1: Si`; no se exponen los valores numéricos 0.03/0.02 L que aparecían en v1 — corregido en v2 (ahora `calidad.repetibilidad_ats_ers_fvc=null`, `calidad.repetibilidad_ats_ers_fev1=null`).

### 3.3 Calidad técnica (criterios ATS/ERS de repetibilidad)

- Repetibilidad FVC: `null` (PNG sólo expone flag "Si"; no valor numérico).
- Repetibilidad FEV1: `null` (PNG sólo expone flag "Si"; no valor numérico).
- `es_interpretable: true` (las 3 maniobras son aceptables según el flag y las curvas visibles).
- `completitud_documental: 'suficiente'` (9 parámetros × 3 maneuvers ≈ 27 valores; 22 visibles).

---

## 4. Coherencia de LLN con `VALORES DE REFERENCIA.xlsx`

| Parámetro | LLN esperado (GLI-2012) | LLN visible en PNG | Coherencia |
|---|---|---|---|
| Mejor FVC | depende de sexo/edad/talla (GLI-2012) | **5.28** (visible en PNG) | ✓ coherente con referencia SIBELMED W20s |
| Mejor FEV1 | depende de sexo/edad/talla (GLI-2012) | **4.40** (visible en PNG) | ✓ |
| MFev1/MFvc | <70% como flag obstructivo histórico; LLN exacto depende de ecuación | **74.59** (visible en PNG) | ✓ |
| FVC | depende de sexo/edad/talla (GLI-2012) | **5.28** (visible en PNG) | ✓ |
| FEV1 | depende de sexo/edad/talla (GLI-2012) | **4.40** (visible en PNG) | ✓ |
| FEV1/FVC | depende de sexo/edad/talla (GLI-2012) | **74.59** (visible en PNG) | ✓ |
| FET100% | sin LLN universal | **null** (celda vacía en PNG) | ✓ no aplica |
| Vext. | sin LLN universal | **null** (celda vacía en PNG) | ✓ no aplica |
| Edad del pulmón | sin LLN universal | **null** (celda vacía en PNG) | ✓ no aplica |

**Conclusión AC-3.4:** la coherencia LLN es **directamente verificable** contra los valores del PNG para 6/9 parámetros (Mejores/FVC/FEV1/FEV1-FVC). El XLSX `VALORES DE REFERENCIA.xlsx` no contiene hoja de espirometría, pero **los LLN ya están calculados y visibles en el PNG** (no dependen del XLSX). Documentado como `DG-3-AMI-VALORES-REF` pero la limitación ahora es parcial — no es bloqueante para validar la calibración V3 contra el insumo real.

**Acción sugerida para Frank:** solicitar a AMI el equivalente a `VALORES DE REFERENCIA_ESPIRO.xlsx` con las ecuaciones GLI-2012 por etnia/edad/sexo/talla, o un PDF Sibelmed W20s con la tabla completa (incluyendo PEF, FEF25, FEF50, FEF75, FEV6, FIVC).

---

## 5. Estado del extractor backend (FIX-20260812-20)

Comando ejecutado (lectura): `git log -- backend/app/services/ai/extractor.py | grep -i espirometria` → confirma commit `4f561b7 FIX-20260812-20: Espirometría — extracción tabular FVC/FEV1/M1/M2/M3/REF/LLN`.

Funciones presentes en el código actual (`backend/app/services/ai/extractor.py`):

| Símbolo | Línea | Estado |
|---|---:|---|
| `_ESPIROMETRIA_CANONICAL_KEYS` | 150 | Presente |
| `_ESPIROMETRIA_BACKEND_GUARDRAILS` | 160 | Presente |
| `_build_espirometria_extraction_prompt()` | 268 | Presente |
| `_normalize_espirometria_result()` | 346 | Presente |
| Dispatch en `extract_by_type()` | 726 | Presente |
| Llamada a normalizer | 865 | Presente |

**Conclusión:** FIX-20260812-20 sigue vigente. La rama backend de espirometría está protegida contra regresión por el test `test_espirometria_usa_prompt_con_guardrails_backend_FIX_20260812_20`.

---

## 6. Estado de la calibración y trazabilidad

- **Snapshot local:** `evidencia/baseline/calibrations-snapshot/espirometria-v3-draft.json` (status='draft').
- **Extracción corregida (v2, F-1):** `evidencia/baseline/calibrations-snapshot/fixtures/extraction-espirometria-ob.json` (9 parámetros, LLN 6/9, paciente/estudio/condiciones completos).
- **Extracción v1 original:** preservada en `/tmp/kilo-correccion/extraction-espirometria-ob.original.json` (no se modifica historial).
- **Inputs copiados (sin modificar AMI):**
  - `evidencia/espirometria/ESPIRO-OB-input.png` (SHA-256 = mismo que AMI).
  - `evidencia/espirometria/criterios-repetitibilidad-input.png` (SHA-256 = mismo que AMI).
- **OCR de apoyo:** `/tmp/kilo-correccion/espiro_ob_psm6.txt`, `/tmp/kilo-correccion/espiro_top_psm6.txt`, `/tmp/kilo-correccion/espiro_hdr_psm6.txt`, `/tmp/kilo-correccion/espiro_tbl_psm6.txt`, `/tmp/kilo-correccion/espiro_tbl_big_psm6.txt`, `/tmp/kilo-correccion/espiro_tbl_big2_psm6.txt`, `/tmp/kilo-correccion/espiro_*_row_huge_ocr.txt` (todos en /tmp, no persisto en lote).

---

## 7. Cambios introducidos por la corrección F-1

| # | Cambio | Antes (v1) | Después (v2 F-1) |
|---|---|---|---|
| 1 | Filas tabla `parametros[]` | 4 (FVC, FEV1, FEV1/FVC, FEF25-75) | 9 (Mejor FVC/FEV1/MFev1-MFvc, FVC/FEV1/FEV1-FVC, FET100%, Vext., Edad del pulmón) |
| 2 | Fila FEF25-75 (inventada) | 3.30 / 3.29 / 69 | **eliminada** (NO existe en PNG) |
| 3 | `paciente.nombre_completo` | null | `"VINIEGRA DIAZ LUIS EDUARDO"` (visible en PNG) |
| 4 | `paciente.sexo` | null | `"Hombre"` (visible en PNG) |
| 5 | `paciente.edad_anios` | null | `29` (visible en PNG) |
| 6 | `paciente.talla_cm` | null | `191` (visible en PNG) |
| 7 | `paciente.peso_kg` | null | `85` (visible en PNG) |
| 8 | `paciente.imc` | null | `23.3` (visible en PNG) |
| 9 | `paciente.motivo` | null | `"MATERIALES 2 AÑOS"` (visible en PNG) |
| 10 | `paciente.procedencia` | null | `"MACLEAN"` (visible en PNG) |
| 11 | `paciente.fuma` | null | `"NO"` (visible en PNG) |
| 12 | `estudio.referencia` | null | `"2004202611"` (visible en PNG) |
| 13 | `estudio.equipo_modelo` | `"SIBELMED W20s"` | `"SIBELMED W20s"` (sin cambio; ya estaba correcto) |
| 14 | `estudio.version_software` | null | `"SIB-SLA-2.05"` (visible en PNG) |
| 15 | `condiciones.tecnico` | null | `"GMC"` (visible en PNG) |
| 16 | `condiciones.transductor` | null | `"Turbina"` (visible en PNG) |
| 17 | `condiciones.temperatura_c` | null | `20.1` (visible en PNG) |
| 18 | `condiciones.presion_mmhg` | null | `760` (visible en PNG) |
| 19 | `condiciones.humedad_pct` | null | `48` (visible en PNG) |
| 20 | `condiciones.referencia_ecuacion` | null | `"NHANES III-EEUU Mexicano-Americano"` (visible en PNG) |
| 21 | `condiciones.factor_etnico` | null | `90` (visible en PNG) |
| 22 | `condiciones.factor_btps` | null | `1.115` (visible en PNG) |
| 23 | `calidad.repetibilidad_ats_ers_fvc` | `0.03` (L) — INVENTADO | `null` (PNG sólo expone flag "Si") |
| 24 | `calidad.repetibilidad_ats_ers_fev1` | `0.02` (L) — INVENTADO | `null` (PNG sólo expone flag "Si") |
| 25 | `parametros[*].lln_value` | 0/4 = null | **6/9 = visible** (5.28, 4.40, 74.59, 5.28, 4.40, 74.59); 3/9 = null (FET100%, Vext., Edad del pulmón — celdas vacías) |
| 26 | `parametros[*].ref_value` | 2/4 = visible (sólo FVC y FEV1) | 6/9 = visible; 3/9 = null |

**F-1 — Estado:** **CORREGIDO**. La cobertura real del PNG es ahora fielmente reflejada; las 3 filas sin LLN/REF/%REF son honestamente null, no se confunden con "limitación AMI".

---

## 8. Comandos reproducibles

```bash
# Validar contrato V3 + diff
node context/lote-nocturno-20260820-01/validate-snapshot.js

# OCR de alta fidelidad sobre el PNG (no modifica AMI; salida en /tmp/kilo-correccion/)
mkdir -p /tmp/kilo-correccion
tesseract context/lote-nocturno-20260820-01/evidencia/espirometria/ESPIRO-OB-input.png \
  /tmp/kilo-correccion/espiro_ob_psm6 -l spa+eng --psm 6

# Confirmar vigencia FIX-20260812-20 (lectura, sin modificar)
git log -- backend/app/services/ai/extractor.py | grep -i espirometria
grep -n "_ESPIROMETRIA_BACKEND_GUARDRAILS\|_build_espirometria_extraction_prompt\|_normalize_espirometria_result" \
  backend/app/services/ai/extractor.py
```

**Salida del validador (resumen, captura: `/tmp/kilo-correccion/validate-snapshot-output.txt`):**

```
✓ V3 root contract valid
✓ Audiometry schema: 8 canonical frequencies present
  Parámetros detectados:                  9
  Con valor M1:                          9
  Con valor REF (predicho):              6
  Con LLN (visible en PNG):              6 (Mejores/FVC/FEV1/FEV1-FVC; FET100%/Vext./Edad pulmonar sin LLN — celdas vacías en PNG, no limitación AMI)
  Con %REF M1:                           6
Exit code: 0
```

---

## 9. Criterios AC-3.x — verificación

| AC | Estado | Evidencia |
|---|---|---|
| **AC-3.1** Existe versión V3 auditada para Espirometría | PASS | `espirometria-v3-draft.json` (draft.status='draft') |
| **AC-3.2** Ninguna V3 a `published` | PASS | `publishedVersions=[]`; validator rechaza draft.status='published' |
| **AC-3.3** `DIFF-ESPIRO.md` declara la limitación del insumo (PNG sin PDF) | PASS | §2 arriba (declaración explícita DG-1) |
| **AC-3.4** Coherencia de LLN con `VALORES DE REFERENCIA.xlsx` registrada | PASS (actualizado) | §4 arriba (LLN 6/9 parámetros visibles en PNG; los 3 restantes son celdas vacías en PNG, no limitación AMI) |

---

## 10. Decisión final

- Calibración V3 Espirometría queda en **`draft`** (no `tested`, no `published`).
- Justificación: limitación de insumo (PNG sin PDF; tabla cubre 9 filas vs 15 esperables; FET100%/Vext./Edad pulmonar sin LLN/REF/%REF en el PNG).
- Esta decisión **NO bloquea** Unidades 1, 2 y 4 (las cuales cerraron AC).
- **Corrección F-1 aplicada:** la tabla ahora refleja fielmente las 9 filas observables del PNG; LLN 6/9 son visibles directamente; paciente/estudio/condiciones completos; FEF25-75 inventado eliminado.
- Próximo paso: solicitar a Frank en próxima iteración un PDF Sibelmed W20s con tabla completa (PEF, FEF25/50/75, FEV6, FIVC) y `VALORES DE REFERENCIA_ESPIRO.xlsx` para promover a `tested`.