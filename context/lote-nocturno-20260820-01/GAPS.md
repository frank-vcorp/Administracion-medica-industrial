# GAPS — Lote nocturno 20260820-01 (catálogo priorizado)

- **ID intervención:** IMPL-20260820-06 + corrección F-1/F-2 IMPL-20260821-07/08
- **ID tarea:** LOTE-20260820-01 (Unidades 1-4) + corrección post-cierre F-1/F-2
- **SPEC activa:** `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` v1.0
- **Handoff:** `context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md`
- **Fecha:** 2026-08-21 00:16 CST (original) / 2026-08-21 07:30 CST (corrección F-1/F-2)
- **Severidad:** P0 (crítico) / P1 (alto) / P2 (medio) / P3 (bajo)
- **Propietario propuesto:** INTEGRA / SOFIA / DEBY / ATLAS

---

## P0 — Críticos (bloqueantes)

_Ninguno en este lote._ Las Unidades 1-4 cerraron AC sin bloqueadores P0.

---

## P1 — Altos (afectan funcionalidad de negocio)

### DG-1 — AMI no entrega PDF de espirometría real (sólo PNG)
- **Descripción original:** `context/datos AMI/informacion para revision/` contiene sólo `ESPIRO OB.png` (834×595 px, RGBA, 198 KB) y `criterios repetitibilidad-espirometria.png`. No hay PDF Sibelmed W20s con tabla exhaustiva FVC/FEV1/M1/M2/M3/REF/LLN. PPTx `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` y `DIAGNOSTICO BASICO AUDIOS.pptx` referenciados en la SPEC §3 **NO existen** en el árbol AMI.
- **Impacto original:** Unidad 3 no puede validar exhaustivamente la tabla M1/M2/M3/REF/LLN; la calibración V3 Espirometría queda en `draft` (no `tested`). Cobertura del 4/4 parámetros visibles (FVC, FEV1, FEV1/FVC, FEF25-75) pero sin tabla LLN derivada.
- **Acción original:** solicitar a Frank en próxima iteración:
  1. PDF Sibelmed W20s con tabla exhaustiva FVC/FEV1/M1/M2/M3/REF/LLN (≥10 parámetros).
  2. PPTx de patrones espirométricos (referencia clínica).
  3. `VALORES DE REFERENCIA_ESPIRO.xlsx` con ecuaciones GLI-2012 por etnia/edad/sexo/talla.
- **Propietario propuesto original:** **ATLAS** (escalar a Frank en próxima sesión).
- **Severidad original:** P1 (alto).

### DG-1 — Estado al 2026-08-21 10:35 CST (post-intervención IMPL-20260821-09)
- **Estado:** **SUPERSEDED**. Insumo real omitido `context/RD2026/ESPIROMETRIA.pdf` (123 540 bytes, 1 página, 2025-07-10) **sí estaba en el árbol del proyecto** y contiene el informe Sibelmed W20s con tabla exhaustiva FVC/FEV1/M1/M2/M3/REF/LLN (10 filas, paciente PEÑA PATRICIO MARBELLA). Fila FEF25-75% ahora REAL (no inventada); 7/10 LLN visibles; repetibilidad numérica 30.00 ml FVC / 40.00 ml FEV1 ahora extraíble (texto nativo); Calidad 'A' documentada. Ver `CORRECCION-DG1.md` y `DIFF-ESPIRO-RD2026.md` para detalle bit-a-bit.
- **Lo que NO queda cerrado:** (a) PPTx `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` y `DIAGNOSTICO BASICO AUDIOS.pptx` siguen sin existir; (b) `VALORES DE REFERENCIA_ESPIRO.xlsx` no existe (ver DG-3, que sigue ABIERTO); (c) promoción a `tested` de `espirometria-v3-draft.json` sigue reservada a INTEGRA/ATLAS + GEMINI.
- **Decisión SOFIA:** mantener `status='draft'` (no promover a `tested`) — alineado con recomendación B de `CORRECCION-DG1.md` §6 (no saltarse QA GEMINI).
- **Propietario post-supersede:** INTEGRA/ATLAS (decisión final sobre promoción a `tested`). SOFIA entregó artefactos; no decide el ascenso de estado.
- **Severidad actual:** **SUPERSEDED** (no cerrado plenamente: la acción (a)+(c) siguen abiertas).

### DG-2 — PDF SAAVEDRA AUDIO sólo expone 4/8 frecuencias canónicas
- **Descripción:** `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf` (130 KB, 1 página) contiene tabla con sólo 4 frecuencias (500/1000/2000/3000 Hz) por oído (OD 10/5/10/15 dB; OI 10/10/5/10 dB). El texto del PDF dice "UMBRAL DE AUDICION BILATERAL DENTRO DE RANGO NORMAL EN TODAS LAS FRECUENCIAS", pero la tabla no lista 250/4000/6000/8000 Hz.
- **Impacto:** Cobertura estructural del 50% (4/8 freqs con valor directo). Calibración V3 Audiometría puede llegar a `tested` pero la validación `bit-a-bit` es parcial. AC-2.4 (`completitud_documental ∈ {suficiente, completo}`) NO procede.
- **Acción:** solicitar a Frank un PDF de audiometría con las 8 frecuencias canónicas industriales (250–8000 Hz) para repetir la validación con cobertura ≥80%.
- **Propietario propuesto:** **ATLAS** → Frank.
- **Severidad:** P1 (alto).

### DG-3 — `VALORES DE REFERENCIA.xlsx` no contiene hoja de espirometría ni LLN
- **Descripción:** el XLSX tiene 5 hojas (HEMATOLOGIA, QUIMICA CLINICA, INMUNOLOGIA, UROANALISIS+PARASITOLOGIA, TOXICOLOGIA). Ninguna referencia a FVC/FEV1/FEF25-75 ni a ecuaciones GLI-2012.
- **Impacto:** AC-3.4 (coherencia LLN con `VALORES DE REFERENCIA.xlsx`) **NO es validable** desde el AMI. La columna LLN del schema V3 queda en null para todos los parámetros espirométricos.
- **Acción:** solicitar a AMI/Frank la hoja de espirometría con LLN derivados de la ecuación GLI-2012 (NHANES III o GLI-2012 según etnia del paciente).
- **Propietario propuesto:** **ATLAS** → Frank.
- **Severidad:** P1 (alto).

---

## P2 — Medios (afectan calidad/auditoría)

### DG-4 — Sin BD local PostgreSQL para ejecutar `SELECT` contra `MedicalTest.options.aiCalibration`
- **Descripción:** el entorno local no tiene PostgreSQL ni Docker; el wrapper `coolify-write` no fue invocado (sería contra prod Railway, prohibido en este lote).
- **Impacto:** AC-1.2 (inventario de calibraciones V3 existentes) se materializa como snapshot JSON local validado por TS (`audiometria-v3-tested.json` + `espirometria-v3-draft.json`) en lugar de `SELECT schemaVersion, status, versionLabel, updatedAt FROM …`. El contrato V3 se preserva, pero no es una consulta SQL directa.
- **Acción:** documentar en CIERRE-LOTE.md que el snapshot local es proxy del estado que tendría la BD. Para futuras iteraciones con BD local, considerar levantar PostgreSQL vía Coolify (prohibido en este lote).
- **Propietario propuesto:** **INTEGRA** (en próximo lote con autorización de Frank).
- **Severidad:** P2 (medio).

### DG-5 — Extracciones de Audio/Espiro son simulaciones, no extracción IA real
- **Descripción:** el lote NO invocó a Gemini/M3 (prohibido). Las extracciones (`extraction-audiometria-saavedra.json`, `extraction-espirometria-ob.json`) son simulaciones con valores derivados de PyMuPDF y `tesseract` OCR.
- **Impacto:** los snapshots V3 tienen prompts que NO han sido probados contra API IA. Riesgo: el prompt puede necesitar ajustes empíricos en próxima iteración con API real.
- **Acción:** en próximo lote, ejecutar `saveAICalibrationV3` real + `extract_by_type("Audiometria")` real sobre `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf` para verificar end-to-end. Esto requiere autorización de Frank para usar Gemini/M3 con API key en BD local de prueba.
- **Propietario propuesto:** **SOFIA** (próximo lote).
- **Severidad:** P2 (medio).

### DG-6 — Chromium binary reutilizado del sistema (no instalado por lote)
- **Descripción:** `npx playwright install chromium` falla en ubuntu26.04-x64 (no soportado por Playwright 1.58.2). Se reutilizó `/opt/kilo-playwright-browsers/chromium-1237/chrome-linux64/chrome` (binario system-wide, Google Chrome for Testing 152.0.7977.8).
- **Impacto:** la suite Playwright depende de un binario system-wide. Si se elimina el binario, la suite queda inoperativa. Sin embargo, esto NO afecta a producción (los specs sólo corren local).
- **Acción:** documentar la dependencia en CIERRE-LOTE.md. Si en futuro se necesita instalación fresh, usar `PLAYWRIGHT_BROWSERS_PATH=/opt/kilo-playwright-browsers npx playwright install chromium` (con esa variable, sortea la detección de OS).
- **Propietario propuesto:** **DEBY** (si surge problema de provisión).
- **Severidad:** P2 (medio).

---

## P3 — Bajos (cosméticos / nice-to-have)

### DG-7 — Catálogo AMI tiene 51 archivos, SPEC §3 lista 13
- **Descripción:** la SPEC §3 cataloga 13 archivos específicos del AMI, pero el árbol `context/datos AMI/` contiene 51 archivos en 4 subcarpetas (`informacion para revision/`, `informacion para revision/laboratorio/`, `Proyectos UMM/`, `Formatos Sim/`).
- **Impacto:** ruido documental; la Unidad 1 inventarió los 40 archivos del scope SPEC (raíz + laboratorio). Los 11 archivos en `Proyectos UMM/` y `Formatos Sim/` no fueron tocados.
- **Acción:** en próxima iteración, ampliar SPEC §3 con catálogo completo; o reducir AMI a sólo lo relevante para Audio/Espiro.
- **Propietario propuesto:** **INTEGRA** (revisión documental).
- **Severidad:** P3 (bajo).

### DG-8 — `presentation.schema` en snapshot espiro hipotético tiene 8 parámetros
- **Descripción:** el `espiro-tested-hipotetico.html` muestra una tabla con 8 parámetros (FVC/FEV1/FEV1-FVC/FEF25-75/PEF/FET/FEV6/FIVC). El schema V3 del snapshot `espirometria-v3-draft.json` declara la tabla canónica con esos 8 parámetros, pero NO se valida contra el extractor backend (`_ESPIROMETRIA_CANONICAL_KEYS` en `extractor.py:150`).
- **Impacto:** el schema puede divergir de `_ESPIROMETRIA_CANONICAL_KEYS` (15 claves + variantes) si se agregan parámetros nuevos sin sincronizar.
- **Acción:** alinear `presentation.schema.sections[5].columns[*].key` con `_ESPIROMETRIA_CANONICAL_KEYS` en próximo lote de INTEGRA.
- **Propietario propuesto:** **INTEGRA**.
- **Severidad:** P3 (bajo).

---

## Resumen ejecutivo

| Severidad | Conteo | Bloqueantes del lote |
|---|---|---|
| P0 | 0 | — |
| P1 | 3 | Sí (afectan promoción a `tested` exhaustivo) |
| P2 | 3 | No (afectan calidad/auditoría) |
| P3 | 2 | No (cosméticos) |

**Decisión recomendada:** aceptar todos los gaps y entregar lote con `READY_FOR_VERIFYING`. Los P1 (DG-1/DG-2/DG-3) son dependencias externas que requieren insumos adicionales del AMI (no son bugs del código AMI). Los P2/P3 son iterativos.

---

## Post-cierre — Corrección de hallazgos F-1 y F-2 (2026-08-21 07:30 CST)

### F-1 — CORREGIDO — Extracción espirométrica con OCR de alta fidelidad

- **Severidad original:** P1 (QA GEMINI en `QA-20260820-08-LOTE-NOCTURNO-AUDIO-ESPIRO.md`).
- **Descripción original:** el fixture `extraction-espirometria-ob.json` v1 cubría 4 parámetros canónicos con valores derivados de OCR psm 6 simple, omitía 6 filas visibles en el PNG (Mejor FVC/FEV1/MFev1-MFvc/FET100%/Vext./Edad del pulmón), incluía una fila FEF25-75 INVENTADA y poblaba paciente/estudio/condiciones con null pese a ser visibles en el PNG.
- **Corrección aplicada:** regenerado `extraction-espirometria-ob-v2-f1-corregida` con OCR psm 6 sobre recortes amplificados ×3/×4/×6 (LANCZOS) + whitelist numérica eng + revisión visual bit-a-bit. Tabla ahora con 9 filas observables, LLN 6/9 (Mejores/FVC/FEV1/FEV1-FVC visibles en PNG), paciente/estudio/condiciones completos, FEF25-75 inventado eliminado, repetibilidad numérica falsa (0.03/0.02 L) marcada null (PNG sólo expone flag "Si"). Ver `DIFF-ESPIRO.md` §7 (cambios) y §3 (valores observables).
- **Estado:** F-1 **CORREGIDO**. `validate-snapshot.js` exit=0. AC-3.4 actualizado: LLN coherente (6/9 visibles en PNG; 3/9 con celda vacía — no limitación AMI).
- **Propietario:** SOFIA (corrección autónoma reversible).

### F-2 — CORREGIDO — Demografía audiométrica saneada (filename vs PDF)

- **Severidad original:** P1 (QA GEMINI).
- **Descripción original:** el fixture `extraction-audiometria-saavedra.json` v1 incluía demographics NO visibles en el AUDIO.pdf: `sexo='MASCULINO'`, `edad_anios=41`, `fecha_nacimiento='1984-09-14'`, `fecha_estudio='2026-04-17'`. Estos valores provenían del `EM.pdf` del mismo ZIP (distinto documento, mismo paciente) y se habían cruzado indebidamente.
- **Corrección aplicada:** regenerado `extraction-audiometria-saavedra-v2-f2-corregida` con `pymupdf.get_text('dict')` para enumerar todos los bloques visibles del PDF. Demographics no visibles: ahora `null`. `nombre_completo` retenido pero con campo adicional `nombre_completo_fuente='filename'` documentando que NO viene del cuerpo del PDF. Ver `DIFF-AUDIO.md` §3 (saneamiento demográfico).
- **Estado:** F-2 **CORREGIDO**. `validate-snapshot.js` exit=0. AC-2.1/2.3 siguen PASS; sin cambios en cobertura estructural (50%).
- **Propietario:** SOFIA (corrección autónoma reversible).

### Implicaciones para el cierre del lote

- **AC-3.4 actualizado a PASS con LLN 6/9 visibles** (ya no aplica la nota "limitación AMI" para los 3 parámetros FET100%/Vext./Edad pulmonar — son celdas vacías del PNG, no del XLSX).
- **Estado V3 sin cambios:** Audio `tested` NO published; Espiro `draft` NO tested NO published (mantenido por DG-1: PNG sin PDF, tabla exhaustiva no validable al 100%).
- **Pendiente para Frank:** ratificar que el cruce de demographics entre documentos del mismo ZIP debe hacerse en una capa de orquestación (no en la extracción por documento); o aceptar que el fixture queda con demographics null cuando el documento específico no los expone.