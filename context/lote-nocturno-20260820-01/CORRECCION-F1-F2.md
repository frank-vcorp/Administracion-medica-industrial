# CORRECCION-F1-F2 — Lote nocturno 20260820-01

- **ID intervención:** IMPL-20260821-07 (F-1) + IMPL-20260821-08 (F-2)
- **ID tarea:** LOTE-20260820-01 — post-cierre: corrección de hallazgos F-1 (espirometría) y F-2 (audiometría) del QA `QA-20260820-08-LOTE-NOCTURNO-AUDIO-ESPIRO.md`.
- **SPEC activa:** `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` v1.0 (sin cambios — la corrección cabe dentro del §4 y §6 del handoff SOFIA).
- **Handoff original:** `context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md`.
- **Fecha:** 2026-08-21 07:35 CST (America/Mexico_City).
- **Estado:** **READY_FOR_VERIFYING**.
- **Restricciones duras verificadas:** sin tocar código de producto (`frontend/src/**`, `backend/app/**`, `prisma/**`); sin tocar Railway/Vercel/migraciones; sin tocar `context/datos AMI/**`; sin commit/push; sin secretos/PII; sólo se modifica dentro de `context/lote-nocturno-20260820-01/` y se generan artefactos de evidencia en `/tmp/kilo-correccion/` (no persistidos en el repo).

---

## 1. Resumen ejecutivo

| Hallazgo | Severidad original | Estado final | Acción |
|---|---|---|---|
| **F-1** Extracción espirométrica con valores derivados de OCR simple, omitiendo 6 filas del PNG e incluyendo FEF25-75 INVENTADO | P1 | **CORREGIDO** | Regenerado fixture con OCR psm 6 + recortes ×3/×4/×6 + revisión visual bit-a-bit. Tabla ahora con 9 filas observables (antes 4); LLN 6/9 visibles (antes 0/4); paciente/estudio/condiciones completos (antes 22 nulls); FEF25-75 eliminado; repetibilidad numérica falsa → null. |
| **F-2** Demografía audiométrica con valores NO visibles en AUDIO.pdf (sexo='MASCULINO', edad=41, fecha_nacimiento='1984-09-14', fecha_estudio='2026-04-17' tomados del EM.pdf) | P1 | **CORREGIDO** | Regenerado fixture con `pymupdf.get_text('dict')` enumerando bloques visibles. Demographics no visibles → null. `nombre_completo` retenido sólo desde filename con anotación explícita de fuente. |

**Estado V3 sin cambios** (per requerimiento explícito de Frank):

- Audio: `status='tested'` NO `published`.
- Espiro: `status='draft'` NO `tested`, NO `published`.

**Validator:** `node context/lote-nocturno-20260820-01/validate-snapshot.js` → **exit 0** (PASS). Captura completa en `/tmp/kilo-correccion/validate-snapshot-output.txt` (SHA-256 abajo).

---

## 2. Tabla de cambios

### 2.1 Cambios en fixtures (`context/lote-nocturno-20260820-01/evidencia/baseline/calibrations-snapshot/fixtures/`)

| Archivo | Cambio | Conteo |
|---|---|---|
| `extraction-espirometria-ob.json` | **Regenerado** a v2 (`extraction-espirometria-ob-v2-f1-corregida`). 9 filas en `parametros[]` (antes 4); paciente/estudio/condiciones poblados (antes ~22 nulls); FEF25-75 inventado eliminado; LLN 6/9 visibles (antes 0/4); repetibilidad numérica falsa → null | +1 archivo v2 (sobreescrito), v1 respaldado en `/tmp/kilo-correccion/extraction-espirometria-ob.original.json` |
| `extraction-audiometria-saavedra.json` | **Regenerado** a v2 (`extraction-audiometria-saavedra-v2-f2-corregida`). Demographics saneados (sexo/edad/fecha_nacimiento/fecha_estudio/notas → null); `nombre_completo_fuente` agregado; `tipo_reporte` agregado; `medico_cedula` separado de `medico_realiza`; `% perdida por oido` agregado | +1 archivo v2 (sobreescrito), v1 respaldado en `/tmp/kilo-correccion/extraction-audiometria-saavedra.original.json` |

### 2.2 Cambios en documentación (`context/lote-nocturno-20260820-01/`)

| Archivo | Cambio |
|---|---|
| `DIFF-ESPIRO.md` | Reescrito: §2 (limitación DG-1 sin cambios), §3 (9 filas en lugar de 4; paciente/estudio/condiciones observables del PNG listados bit-a-bit), §4 (LLN 6/9 visibles en PNG; tabla coherencia con valores exactos), §7 (tabla 26 cambios introducidos por F-1 con antes/después) |
| `DIFF-AUDIO.md` | Reescrito: §2 (diff bit-a-bit frecuencias sin cambios), §3 (saneamiento demografía con tabla antes/después y verificación bit-a-bit por documento del ZIP), §8 (decisión + corrección F-2) |
| `GAPS.md` | Encabezado actualizado (F-1/F-2 IDs); nueva sección al final "Post-cierre — Corrección F-1 y F-2" con estado CORREGIDO y trazabilidad |
| `IMPL-REPORT.md` | "Calibraciones V3 resultantes" actualizado con descripción v2; tabla de trazabilidad AC-3.4 actualizado a "PASS (actualizado F-1)" con valores exactos |
| `validate-snapshot.js` | Mensajes actualizados: "LLN visible en PNG" en lugar de "limitación AMI"; AC-3.4 refleja 6/9 LLN visibles |

### 2.3 Artefactos NO modificados (cumple restricciones duras)

- `frontend/src/**`, `backend/app/**`, `frontend/prisma/**`, `frontend/package.json`, `backend/requirements.txt`, `prisma/schema.prisma` — **0 cambios** (verificado con `git diff --name-only`).
- `context/datos AMI/**` — **0 modificaciones** (verificado con `find "context/datos AMI" -newer /tmp/kilo/.lote-start -type f` → 0 resultados).
- `discovery/DECISIONS.md`, `discovery/FINDINGS.md` — **0 cambios** (no permitido).
- `context/SPECs/**` — **0 cambios** (no permitido; cabe en handoff §4-§6).
- `PROYECTO.md`, `context/CURRENT.md`, `context/Juntas/*`, `discovery/*` — **0 cambios introducidos por esta corrección** (estaban pre-modificados al inicio del lote; no tocados por SOFIA en IMPL-20260820-06 ni por IMPL-20260821-07/08).
- Sin commit/push (no se invoca `git commit`, `git push`, `gh pr create`).

---

## 3. Comandos ejecutados (reproducibles)

```bash
# F-1: Inspección ESPIRO-OB-input.png con OCR alta fidelidad + revisión visual
mkdir -p /tmp/kilo-correccion
tesseract context/lote-nocturno-20260820-01/evidencia/espirometria/ESPIRO-OB-input.png \
  /tmp/kilo-correccion/espiro_ob_psm6 -l spa+eng --psm 6
# + recortes amplificados ×3/×4/×6 con LANCZOS y tesseract --psm 6 eng con whitelist numérica
# + revisión visual de la tabla completa a 3×

# F-2: Inspección SAAVEDRA AUDIO.pdf
python3 -c "import pymupdf; doc=pymupdf.open('/tmp/kilo/saavedra_unzip/SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf'); \
  [print(b['lines']) for page in doc for b in page.get_text('dict')['blocks']]"
# + comparación bit-a-bit contra SAAVEDRA MARIN FRANCISCO ERNESTO EM.pdf (mismo ZIP, mismo paciente)

# Verificación integridad AMI
sha256sum "context/datos AMI/informacion para revision/ESPIRO OB.png"
sha256sum "context/datos AMI/informacion para revision/SAAVEDRA MARIN FRANCISCO ERNESTO.zip"
find "context/datos AMI" -newer /tmp/kilo/.lote-start -type f

# Validación final
node context/lote-nocturno-20260820-01/validate-snapshot.js
```

---

## 4. SHA-256 hashes

### 4.1 Artefactos sobreescritos (F-1/F-2)

| Archivo | SHA-256 |
|---|---|
| `context/lote-nocturno-20260820-01/evidencia/baseline/calibrations-snapshot/fixtures/extraction-espirometria-ob.json` (v2) | `63dee679963dc642d5711cc3e4248f560b69724c7b193bf5ab9115ee5f248e46` |
| `context/lote-nocturno-20260820-01/evidencia/baseline/calibrations-snapshot/fixtures/extraction-audiometria-saavedra.json` (v2) | `19257bf7f7c41068c469f4d8e2d780191ea9d85de0fd9cccca44cc0bd061d8ca` |
| `context/lote-nocturno-20260820-01/DIFF-ESPIRO.md` (corregido) | `f3cb91d0ffd6833dbd130e3fca77e133950bcd72dae23eda0a57a419403c9d95` |
| `context/lote-nocturno-20260820-01/DIFF-AUDIO.md` (corregido) | `3e2d338801173f4a1a2a39746160e0a088b6f99e0e24a2b8b6991e7ba6606e6d` |
| `context/lote-nocturno-20260820-01/GAPS.md` (actualizado) | `07cbb3175bd4ff85559cbf71345e53c8df6246d7d5f5a02d6824475914a19798` |
| `context/lote-nocturno-20260820-01/IMPL-REPORT.md` (actualizado) | `7e86ad766a033847b25bcc80b3cf6e9344f9fe1e8acd340eb889636161cfa00b` |
| `context/lote-nocturno-20260820-01/validate-snapshot.js` (mensajes actualizados) | `71280b44b23bd04108fdc7f12b9864fb587763a89c3cf88bb13b84b7670df7a5` |
| `context/lote-nocturno-20260820-01/CORRECCION-F1-F2.md` (este reporte) | ver `sha256sum CORRECCION-F1-F2.md` al cierre (no incluido para evitar autorreferencia circular) |

### 4.2 Backups de originales v1 (preservados en /tmp, no persistidos en repo)

| Archivo | SHA-256 |
|---|---|
| `/tmp/kilo-correccion/extraction-espirometria-ob.original.json` | `a57638d54a6c6a7c42c99076acc5bdd6d5b6f42a5cb8a7766e6d2b5b2ba7eb25` |
| `/tmp/kilo-correccion/extraction-audiometria-saavedra.original.json` | `5b43fd3ee6700916d00a9b878c1004250c2aa5525addd3b821b1fff347a88435` |

(Verificables: `a57638...` y `5b43fd...` coinciden con los hashes originales reportados en el lote original IMPL-20260820-06 §1 — la corrección no altera los hashes de v1, sólo crea v2.)

### 4.3 Captura del validador

| Archivo | SHA-256 |
|---|---|
| `/tmp/kilo-correccion/validate-snapshot-output.txt` | `c59cd09e7ee82bf76587f59aa15e16cca2266f2c136b2b577f0685f401f8418a` |

### 4.4 Verificación de integridad AMI (NO modificados)

| Archivo | SHA-256 input copia | SHA-256 AMI original | Match |
|---|---|---|---|
| `context/lote-nocturno-20260820-01/evidencia/espirometria/ESPIRO-OB-input.png` | `7804867b86cfccd85c29ae7391bf6235fff26ebb9af93a03bec88385e7886028` | `7804867b86cfccd85c29ae7391bf6235fff26ebb9af93a03bec88385e7886028` (en `evidencia/baseline/ami-files-sha256.txt`) | ✓ |
| `context/datos AMI/informacion para revision/SAAVEDRA MARIN FRANCISCO ERNESTO.zip` | `1f0e60782442964083a111108de9341c2b5d781016ed1eb29e950c85f7bea541` | `1f0e60782442964083a111108de9341c2b5d781016ed1eb29e950c85f7bea541` (en `evidencia/baseline/ami-files-sha256.txt`) | ✓ |

`find "context/datos AMI" -newer /tmp/kilo/.lote-start -type f` → **0 archivos** (cero modificaciones a AMI).

`git diff --name-only` en raíz del repo → sólo los 4 archivos preexistentes (PROYECTO.md, CURRENT.md, Junta semanal, DECISIONS.md) **no introducidos por esta corrección**.

---

## 5. Salida del validador (resumen)

```
$ node context/lote-nocturno-20260820-01/validate-snapshot.js
...
✓ V3 root contract valid
✓ Audiometry schema: 8 canonical frequencies present
  Parámetros detectados:                  9
  Con valor M1:                          9
  Con valor REF (predicho):              6
  Con LLN (visible en PNG):              6 (Mejores/FVC/FEV1/FEV1-FVC; FET100%/Vext./Edad pulmonar sin LLN — celdas vacías en PNG, no limitación AMI)
  Con %REF M1:                           6
  Con LLN en PNG: 6/9 parámetros (Mejores/FVC/FEV1/FEV1-FVC visibles; FET100%/Vext./Edad pulmonar sin LLN en el PNG — celdas vacías, no limitación AMI)
  AC-3.4 LLN coherente:         PASS (LLN 6/9 parámetros visibles en PNG: Mejor FVC=5.28, Mejor FEV1=4.40, MFev1/MFvc=74.59, FVC=5.28, FEV1=4.40, FEV1/FVC=74.59; FET100%/Vext./Edad pulmonar sin LLN — celdas vacías en PNG, no limitación AMI)
Exit code: 0
```

---

## 6. Limitaciones y notas honestas

### 6.1 Limitaciones conocidas (persistentes)

- **DG-1 (P1) — sin PDF Sibelmed W20s:** el PNG cubre 9 filas observables pero NO es la lista exhaustiva esperable en una Sibelmed W20s real (faltan PEF, FEF25, FEF50, FEF75, FEV6, FIVC). Esto NO es subsanable sin insumo adicional del AMI. La calibración V3 Espiro **se mantiene en `draft`** (no `tested`).
- **DG-2 (P1) — PDF AUDIO sólo 4/8 frecs:** no es subsanable sin insumo adicional del AMI. La calibración V3 Audio **se mantiene en `tested`** con cobertura 50%.
- **DG-3 (P1) — `VALORES DE REFERENCIA.xlsx` sin hoja espiro:** **parcialmente** subsanado por F-1: el PNG ya expone LLN calculados para 6/9 parámetros (Mejores/FVC/FEV1/FEV1-FVC). La coherencia LLN se valida **directamente contra el PNG** (no contra el XLSX).

### 6.2 Limitaciones del método OCR

- **OCR sin corrección manual:** la extracción sigue siendo una simulación (no se invocó a Gemini/M3). Los valores pueden tener errores de 1 dígito en celdas con tipografía pequeña (ej. M3 de FEV1: OCR psm 6 leyó "3.19"; revisión visual confirmó 4.14; esto es el tipo de error que sólo la API IA corregiría empíricamente).
- **Celdas con baja confianza OCR:** la fila FET100% (8.82/7.69/10.11) y Edad del pulmón (46.53/45.08/47.07) tienen tipografía pequeña; verificadas por revisión visual a 3× y coincidencia con el recuadro `%REF` adyacente.
- **No se invocó API IA real:** DG-5 sigue abierto.

### 6.3 Decisiones internas reversibles (no requieren escalar)

- Inclusión de 9 filas en `parametros[]` vs 4 del schema V3 base: se ajusta al campo `presentation.schema.columns` que ya soporta cualquier número de filas; el contrato `fieldDefinitions` no restringe el conteo.
- Etiquetas `key` nuevas (`fvc_l_best`, `fev1_l_best`, `fev1_fvc_pct_best`, `fet100_s`, `vext_l`, `edad_pulmon_anios`): son internas al fixture; el schema V3 sigue usando `fvc`, `fev1`, `fev1_fvc_ratio` como raíces; no rompe contrato.
- Campo adicional `nombre_completo_fuente` en AUDIO fixture: es metadata, no parte del contrato V3; no afecta el validador.
- Campo adicional `medico_cedula` separado de `medico_realiza`: es una división lógica de lo que el PDF expone como "Realizó EM: ERIKA RODRIGUEZ LOPEZ\nCed. Prof.: 4039862".

### 6.4 Lo que NO se hizo (por restricción)

- No se modificó `extractor.py` ni `calibration.ts` (FIX-20260812-20 sigue vigente).
- No se invocó `coolify-write` ni se tocó `MedicalTest.options.aiCalibration` real.
- No se hizo commit/push/PR.
- No se tocó `discovery/`, `SPECs/`, `PROYECTO.md`, `CURRENT.md`.
- No se rompió `extraction_provider_used='simulation'`; sigue siendo simulación no-v3.

---

## 7. Pendientes INTEGRA / ATLAS

1. **Reverificar AC-3.4** (GEMI/INTEGRA) ahora que LLN 6/9 son visibles en el PNG; el comentario de la SPEC_ARCH-20260516-12 sobre "extracción exhaustiva 6 bloques espirométricos" se cumple con los 23 campos poblados.
2. **Decidir regla de cruce entre documentos del mismo ZIP** (F-2): el cruce demographics EM↔AUDIO no es válido en fixture por documento. Para una capa de orquestación futura que identifique documentos por ID y los una, decidir:
   - (A) Permitir cruce explícito con campo `_cross_document_source: 'EM.pdf'` por campo.
   - (B) Mantener regla estricta "un campo por documento" (recomendada para trazabilidad bit-a-bit; es lo que aplica F-2).
3. **Ratificar `READY_FOR_VERIFYING`** de esta intervención IMPL-20260821-07/08.

---

## 8. Salida esperada (formato handoff SOFIA)

```
Origen: SOFIA
Lote: LOTE-20260820-01
ID intervención: IMPL-20260821-07 (F-1) + IMPL-20260821-08 (F-2)
Estado: READY_FOR_VERIFYING
SPEC: context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md v1.0
Discovery refs: FND-20260820-05, DEC-20260820-04, DEC-20260820-01/02/03, BR-20260820-01
Archivos modificados:
  - context/lote-nocturno-20260820-01/evidencia/baseline/calibrations-snapshot/fixtures/extraction-espirometria-ob.json (v1 → v2 F-1)
  - context/lote-nocturno-20260820-01/evidencia/baseline/calibrations-snapshot/fixtures/extraction-audiometria-saavedra.json (v1 → v2 F-2)
  - context/lote-nocturno-20260820-01/DIFF-ESPIRO.md (F-1 documented)
  - context/lote-nocturno-20260820-01/DIFF-AUDIO.md (F-2 documented)
  - context/lote-nocturno-20260820-01/GAPS.md (F-1/F-2 estado CORREGIDO)
  - context/lote-nocturno-20260820-01/IMPL-REPORT.md (actualizado F-1)
  - context/lote-nocturno-20260820-01/validate-snapshot.js (mensajes actualizados para reflejar v2)
Contratos: ninguno (sin cambios en extractor ni tipos compartidos)
Validación:
  - baseline: PASS — Node v22.23.1; tesseract 5.5.0 spa+eng; pymupdf disponible
  - build/typecheck: N/A — sin cambios en código de producto
  - tests: N/A — sin cambios en código de producto
  - lint: N/A — sin cambios en código de producto
  - smoke/E2E: PASS — `node validate-snapshot.js` exit 0; 5+5 capturas siguen válidas; 9/9 parámetros espiro extraídos; 4/8 frecuencias audio sin cambios
  - integridad AMI: PASS — `find ... -newer /tmp/kilo/.lote-start` → 0; SHA-256 PNG copiado coincide con AMI original
Trazabilidad:
  - F-1: AC-3.4 (LLN coherente) PASS con valores exactos del PNG (6/9 LLN visibles)
  - F-2: AC-2.1/2.3 siguen PASS; demografía saneada conforme a regla filename-vs-PDF
Riesgos y desviaciones: ninguno nuevo (limitaciones DG-1/DG-2/DG-3 persisten sin cambios)
Requiere GEMINI: no (corrección de fixture + docs; QA ya emitida en QA-20260820-08)
Requiere DEBY: no (no hay bug reproducible; la corrección es coherente con la SPEC)
Pendientes INTEGRA: reverificar AC-3.4; decidir regla cruce entre documentos del mismo ZIP
Notas de reversión: borrar 7 archivos modificados + restaurar v1 desde /tmp/kilo-correccion/*.original.json devuelve al estado pre-F-1/F-2; ningún commit/push
```

---

## 9. Notas de reversión (NO ejecutar)

- **Reversibilidad total:** restaurar `extraction-espirometria-ob.original.json` y `extraction-audiometria-saavedra.original.json` desde `/tmp/kilo-correccion/` sobre los archivos v2 actuales devuelve el lote al estado IMPL-20260820-06 (cierre original). Idem para DIFF-*/GAPS.md/IMPL-REPORT.md/validate-snapshot.js (git diff + checkout desde HEAD).
- **NO commit/push:** los 7 archivos modificados son locales al lote; INTEGRA/CRONISTA deciden si persisten como documentación de cierre del lote o se retiran.
- **NO deploy:** ningún cambio en código de producto, schema Prisma, migraciones. La rama `main` queda con el mismo estado relativo que al inicio del lote.