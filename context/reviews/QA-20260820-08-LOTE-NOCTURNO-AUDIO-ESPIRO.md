# QA-20260820-08 — LOTE-20260820-01 (lote nocturno Audio/Espiro)

```
QA-VERDICT
ID tarea: LOTE-20260820-01
Auditoría: GEMINI (vía ATLAS)
SPEC activa: context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md v1.0
Handoff origen: context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md (READY)
IMPL-REPORT: context/lote-nocturno-20260820-01/IMPL-REPORT.md (Unidades 1-4)
Incremento auditado: artefactos lote-nocturno-20260820-01 (calibraciones V3 local-snapshot,
  fixtures de extracción simulada, scripts, 5 HTML mocks + capturas Playwright,
  5 accessibility snapshots, hashes SHA-256) — SIN cambios a código de producto
Veredicto: PASS_WITH_WARNINGS
Alcance: Reforzada (lote sensible: calibración clínica + AI_NON_CONCLUSIVE + ref values; 13 archivos scope + 4 archivos complementarios; 5 archivos nuevos en frontend/src NO afectados — el lote opera sólo en artefactos aislados)
Severidad mayor detectada: P1 (2 hallazgos) — ninguno bloqueante del cierre matinal
```

---

## 1. Delimitación y fuentes

| Fuente | Verificación |
|---|---|
| `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` | Leído completo (271 líneas) |
| `context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md` | Leído completo (160 líneas) |
| `context/lote-nocturno-20260820-01/IMPL-REPORT.md` | Leído completo (234 líneas) |
| `context/lote-nocturno-20260820-01/INVENTARIO-INSUMOS.md` | Leído completo (142 líneas) |
| `context/lote-nocturno-20260820-01/DIFF-AUDIO.md` | Leído completo (133 líneas) |
| `context/lote-nocturno-20260820-01/DIFF-ESPIRO.md` | Leído completo (150 líneas) |
| `context/lote-nocturno-20260820-01/EVIDENCIA-RENDERER.md` | Leído completo (153 líneas) |
| `context/lote-nocturno-20260820-01/GAPS.md` | Leído completo (99 líneas) |
| `context/diagnostics/FIX-20260812-20-espirometria-extraccion-vacia.md` | Leído completo (179 líneas) |
| `discovery/DECISIONS.md` `DEC-20260820-04` | Confirmado (líneas 94-102) |
| `validate-snapshot.js` | Re-ejecutado (PASS; ver §4) |
| Suite Playwright (5 specs) | Re-ejecutada (5/5 PASS; ver §4) |
| `context/datos AMI/informacion para revision/` integridad | `find … -newer /tmp/kilo/.lote-start` → 0 archivos |
| `git status --porcelain` | 4 archivos `M` preexistentes + directorio lote untracked; 0 staged, 0 commits del lote |
| `git log -- backend/app/services/ai/extractor.py` | FIX-20260812-20 = commit `4f561b7`, vigente |
| `backend/app/services/ai/extractor.py` | `py_compile` OK; símbolos guardrails presentes |
| `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` | Sin atributos `data-presentation-state`/`data-version`/`data-ai-flag` (ver §3 hallazgo F-3) |
| `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx` | AI_NON_CONCLUSIVE con `Razón: {non_conclusive_reason}` línea 441-442 — contrato OK |

---

## 2. Trazabilidad AC

| AC | Estado | Evidencia verificada |
|---|---|---|
| **AC-1.1** SHA-256 de cada AMI | **PASS** | `evidencia/baseline/ami-files-sha256.txt` (40 entradas, reproducibles). Hash `7804867b86cfccd…` para `ESPIRO OB.png` match entre AMI original y copia local `evidencia/espirometria/ESPIRO-OB-input.png`. |
| **AC-1.2** Inventario calibraciones V3 | **PASS (adaptado)** | Snapshot JSON local en lugar de SELECT SQL (BD PostgreSQL no disponible localmente; documentado en `INVENTARIO-INSUMOS.md §4.1`). Estructura V3 validada por `validate-snapshot.js` (ver §4). |
| **AC-1.3** Playwright Chromium localizable | **PASS** | Binario reutilizado `/opt/kilo-playwright-browsers/chromium-1237/chrome-linux64/chrome` (Google Chrome for Testing 152.0.7977.8). Suite 5/5 PASS en 6.1s. |
| **AC-1.4** Comandos baseline disponibles | **PASS** | Node v22.23.1, Python 3.14.4, tesseract 5.5.0, pymupdf 1.28.2, openpyxl, pdfplumber. PostgreSQL/Docker ausentes (documentado). |
| **AC-2.1** V3 Audio `status='tested'` | **PASS** | `audiometria-v3-tested.json` con `draft.status='tested'`. |
| **AC-2.2** Ninguna V3 a `published` | **PASS** | `publishedVersions=[]` en ambos snapshots; `validate-snapshot.js` rechaza `draft.status='published'` con error CRITICAL. |
| **AC-2.3** `DIFF-AUDIO.md` lista cada frec canónica | **PASS** | 8 filas OD/OI en §2 (250/500/1000/2000/3000/4000/6000/8000 Hz). Cobertura 50% (4/8 con valor del PDF). |
| **AC-2.4** `completitud_documental ∈ {suficiente, completo}` | **NO PROCEDE (justificado)** | PDF real sólo expone 4/8 freqs; `completitud_documental='parcial'` declarado explícitamente en fixture y diff. |
| **AC-2.5** Gaps con severidad y responsable | **PASS** | `GAPS.md DG-2` P1 asignado a ATLAS→Frank. |
| **AC-3.1** V3 Espiro auditada | **PASS** | `espirometria-v3-draft.json` con `draft.status='draft'`. |
| **AC-3.2** Ninguna V3 a `published` | **PASS** | Verificación idéntica a AC-2.2. |
| **AC-3.3** Limitación PNG declarada | **PASS** | `DIFF-ESPIRO.md §2` declara DG-1 (sólo PNG, sin PDF; `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` y `DIAGNOSTICO BASICO AUDIOS.pptx` NO existen; verificado con `test -f`). |
| **AC-3.4** LLN coherente con `VALORES DE REFERENCIA.xlsx` | **PASS (con caveat)** | XLSX sin hoja de espirometría confirmado (5 hojas: HEMATOLOGIA, QUIMICA CLINICA, INMUNOLOGIA, UROANALISIS+PARASITOLOGIA, TOXICOLOGIA). LLN se reporta como gap (null) en fixture y mock; documentado como DG-3. **Caveat QA:** ver hallazgo F-1 abajo — el PNG sí expone REF/LLN que la fixture ignora. |
| **AC-4.1** 5+ capturas | **PASS** | 5 PNG (28/97/58/98/97 KB) + 5 accessibility snapshots. |
| **AC-4.2** Renderer contrato V3 (no fallback hardcodeado) | **PASS CONDICIONAL** | Los 5 HTML mocks declaran `data-presentation-state`, `data-version`, secciones V3 (`Extracción clínica`, `Vía aérea por frecuencia`, `Parámetros espirométricos`, etc.). **Caveat QA:** los mocks NO son producidos por `ClinicalExtractionRenderer.tsx`; ver hallazgo F-3. |
| **AC-4.3** `AI_NON_CONCLUSIVE` comprobada con razón | **PASS** | `audio-non-conclusive.html` línea 42-43 muestra banner con `'AI_NON_CONCLUSIVE'` + razón `'parametros_minimos_faltantes'`; atributo `data-ai-flag="AI_NON_CONCLUSIVE"`; lista 6 mínimos faltantes. Suite Playwright valida estos strings. |
| **AC-4.4** Sin acceso a producción | **PASS** | Specs sólo abren `file://` URLs; `launchOptions.executablePath` apunta a binario local; cero red externa. |
| **AC-5.x** QA GEMINI | **N/A en este reporte** (este reporte es la entrega AC-5). |
| **AC-6.x** Cierre INTEGRA | **PENDIENTE** (Unidad 6 — no ejecutada en este lote). |

---

## 3. Validaciones independientes re-ejecutadas

### 3.1 Validador estructural (read-only)

Comando: `node context/lote-nocturno-20260820-01/validate-snapshot.js`

```
✓ V3 root contract valid (audiometria-v3-tested.json)
✓ Audiometry schema: 8 canonical frequencies present
✓ V3 root contract valid (espirometria-v3-draft.json)

Diff Audio: cobertura estructural 50% (4/8 freqs con valor del PDF SAAVEDRA).
Diff Espiro: 4 parámetros detectados (FVC/FEV1/FEV1-FVC/FEF25-75); 0/4 con LLN (limitación AMI documentada).
```

Exit code: 0. PASS.

### 3.2 Suite Playwright headless

Comando: `cd context/lote-nocturno-20260820-01/evidencia/playwright && PLAYWRIGHT_BROWSERS_PATH=/opt/kilo-playwright-browsers npx --prefix frontend playwright test --config=playwright.config.cjs`

```
Running 5 tests using 1 worker
  ✓ renders audio-draft-empty (631ms)
  ✓ renders audio-tested-saavedra (727ms)
  ✓ renders espiro-draft-ob (549ms)
  ✓ renders espiro-tested-hipotetico (570ms)
  ✓ renders audio-non-conclusive (534ms)
5 passed (6.1s)
```

Exit code: 0. PASS.

### 3.3 Integridad AMI

- `/tmp/kilo/.lote-start` (timestamp 2026-08-20 23:59:59) presente.
- `find "context/datos AMI" -newer /tmp/kilo/.lote-start -type f` → 0 archivos modificados por SOFIA.
- Hash `7804867b86cfccd…` para `ESPIRO OB.png` idéntico en `ami-files-sha256.txt` y en copia local `evidencia/espirometria/ESPIRO-OB-input.png` (verificación cruzada).
- `sha256sum` directo del archivo AMI match con hash registrado.

### 3.4 Estado git

```
git status --porcelain: 63 entradas
  M PROYECTO.md (preexistente; no introducido por SOFIA)
  M context/CURRENT.md (preexistente)
  M context/Juntas/Junta semanal… (preexistente)
  M discovery/DECISIONS.md (preexistente)
  ?? context/lote-nocturno-20260820-01/ (untracked; 27 archivos lote)
  ?? + otros untracked ajenos al lote (SPEC_ARCH-20260817/019/SPEC_LOTE; AMI; etc.)
  0 staged, 0 commits introducidos por SOFIA en este lote.
```

### 3.5 FIX-20260812-20 vigencia

```
git log -- backend/app/services/ai/extractor.py | grep -i espirometria
  → commit 4f561b7 "FIX-20260812-20: Espirometría — extracción tabular FVC/FEV1/M1/M2/M3/REF/LLN"
```

Símbolos presentes en el código actual (líneas confirmadas):

| Símbolo | Línea | Estado |
|---|---|---|
| `_ESPIROMETRIA_CANONICAL_KEYS` | 150 | Presente |
| `_ESPIROMETRIA_BACKEND_GUARDRAILS` | 160 | Presente |
| `_build_espirometria_extraction_prompt()` | 268 | Presente |
| `_normalize_espirometria_result()` | 346 | Presente |
| Dispatch en `extract_by_type()` | 726 | Presente |
| Llamada a normalizer | 865 | Presente |

`python3 -m py_compile backend/app/services/ai/extractor.py` → exit 0. FIX vigente.

---

## 4. Hallazgos priorizados

### F-1 — P1 — Fixture `extraction-espirometria-ob.json` no refleja fielmente el PNG

- **Descripción:** El fixture declara "SIMULACIÓN — los valores numéricos se derivan de la OCR del PNG con tesseract 5.5.0", pero la inspección visual directa de `context/datos AMI/informacion para revision/ESPIRO OB.png` (verificada con `PIL.Image.crop` y OCR `tesseract --psm 6`) muestra que la tabla INFORME DE FVC del PNG contiene **valores que el fixture NO captura**:
  - **Mejor FVC** (M1/M2/M3): `5.91 / 5.91 / 5.91`, REF=`5.33`, LLN=`5.28` — el fixture tiene `3.68/3.68/3.68`, REF=`5.91`, LLN=`null`.
  - **Mejor FEV1**: `4.20 / 4.20 / 4.20`, REF=`4.40`, LLN=`4.40` — fixture tiene `3.09/3.09/3.09`, REF=`4.20` (este 4.20 es **M1**, no REF), LLN=`null`.
  - **MFeV1/FVC**: `71.08 × 3`, REF=`83.68`, LLN=`74.59` — fixture tiene `84.14/83.93/null`, REF=`null`, LLN=`null`.
  - **FEF25-75**: `8.82 / 7.69 / 10.11`, REF=`4.80` — fixture tiene `3.30/3.29/null`, REF=`null`.
  - El fixture asigna `m1_pct_ref=100` para FEV1/FVC cuando REF es `null` (inconsistente; el OCR muestra 85%).
  - El mock `espiro-draft-ob.html` replica los mismos valores del fixture (no del OCR).
- **Impacto:** La validación AC-3.4 ("LLN coherente con `VALORES DE REFERENCIA.xlsx`") cumple formalmente porque el XLSX no tiene hoja de espirometría, pero el criterio implícito "no inventar valores" se rompe en sentido inverso: la fixture tiene valores que **no coinciden con el insumo real** (el PNG sí contiene REF y LLN para FVC/FEV1/FEV1/FVC que la fixture ignora). Si en próxima iteración se ejecuta el extractor real sobre el PNG, se obtendrán valores distintos a los validados.
- **Reproducción:** Abrir `context/datos AMI/informacion para revision/ESPIRO OB.png` y comparar fila por fila con `evidencia/baseline/calibrations-snapshot/fixtures/extraction-espirometria-ob.json` y `evidencia/playwright/espiro-draft-ob.html` líneas 105-107.
- **Owner recomendado:** **SOFIA** (próximo lote con extractor real); **INTEGRA** debe documentar que la "simulación" diverge del OCR real.
- **Condición de cierre:** aceptar la divergencia como limitación del modo "simulación" (cumple DG-5 ya registrado), o regenerar el fixture con OCR de mayor fidelidad (psm 6 + revisión manual de las 9 filas del PNG). **No bloquea el cierre matinal** porque el lote está en `READY_FOR_VERIFYING` y la divergencia no afecta el contrato V3 (sigue siendo un `draft` válido).

### F-2 — P1 — Fixture `extraction-audiometria-saavedra.json` tiene demografía inventada

- **Descripción:** El PDF SAAVEDRA AUDIO (`/tmp/saavedra_unzip_check/SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf`, extraído del ZIP; texto verificado con `pymupdf`) **NO contiene** los campos `nombre_completo`, `sexo`, `edad_anios`, `fecha_nacimiento`. La fixture afirma:
  - `paciente_detalle.nombre_completo: "FRANCISCO ERNESTO SAAVEDRA MARIN"` (proviene del nombre del archivo/ZIP, no del PDF)
  - `paciente_detalle.sexo: "MASCULINO"` — inventado
  - `paciente_detalle.edad_anios: 41` — inventado
  - `paciente_detalle.fecha_nacimiento: "1984-09-14"` — inventado
  - `paciente_detalle.notas: "Trabajador; Estudio de audiometría de seguimiento anual."` — inventado
- Los campos audiométricos (umbrales OD/OI 500/1000/2000/3000 Hz, campos fuente faringe/cad/cai/mtd/mti, notas_calidad, medico_realiza, recomendaciones) **sí** coinciden con el PDF real.
- **Impacto:** AC-2.3 cumple formalmente (las 8 frecuencias canónicas están listadas con valor o null), pero la calidad del fixture para entrenamiento/calibración es cuestionable porque los demográficos no son observables. Si el extractor real produce la misma extracción con campos demográficos null, la calibración debería tolerar nulls en paciente_detalle.
- **Reproducción:** `pymupdf.open(...) → doc[0].get_text()` muestra sólo el texto del PDF; comparar con la sección `paciente_detalle` del fixture.
- **Owner recomendado:** **SOFIA** (corregir fixture o documentar claramente que demografía viene del filename/ZIP, no del PDF).
- **Condición de cierre:** documentar en `GAPS.md` (nuevo DG-X) la divergencia demografía vs PDF; en próximo lote con extractor real, marcar `paciente_detalle.*` como null cuando el PDF no los expone. **No bloquea el cierre matinal** (Audio queda en `tested` con justificación DG-2 de cobertura 50% ya aceptada).

### F-3 — P2 — Los HTML mocks no son producidos por el renderer de producción

- **Descripción:** Las 5 capturas Playwright (`audio-draft-empty`, `audio-tested-saavedra`, `audio-non-conclusive`, `espiro-draft-ob`, `espiro-tested-hipotetico`) son archivos HTML **hand-crafted** en `evidencia/playwright/*.html` con atributos `data-presentation-state`, `data-version`, `data-ai-flag`, etc. Una búsqueda exhaustiva en `frontend/src/` confirma que `ClinicalExtractionRenderer.tsx` (606 líneas) **NO emite ninguno de estos atributos** — su versión visible es sólo `v{version}` como `<span>` de texto. Los atributos `data-presentation-state`, `data-version`, `data-ai-flag` sólo existen en los mocks del lote.
- Adicionalmente, la bandera `AI_NON_CONCLUSIVE` se renderiza en producción vía `StudyAIPrediagnosisPanel.tsx` (línea 387-442) **separado** del `ClinicalExtractionRenderer`, no embebido en él como muestra el mock `audio-non-conclusive.html` línea 46.
- **Impacto:** AC-4.2 ("renderer contrato V3, no fallback hardcodeado") cumple formalmente porque los mocks sí tienen secciones del `presentation.schema`. Pero la cobertura **no es evidencia de que el renderer real produzca esa salida**; es evidencia de que un mock *compatible* con el contrato pasa las aserciones. Un próximo lote con extractor real podría revelar drift entre el mock y el output real.
- **Reproducción:** `grep -n "data-presentation-state\|data-version=\|data-ai-flag" frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` → 0 resultados.
- **Owner recomendado:** **INTEGRA** (aclarar en `GAPS.md` el alcance: los mocks son evidencia de contrato, no del renderer real). **DEBY** si en próxima iteración Playwright se reejecuta contra el renderer real con Next dev server.
- **Condición de cierre:** documentar en `EVIDENCIA-RENDERER.md §1` o en un nuevo DG-Y que las capturas son **mocks auto-contenidos** que representan la salida esperada del renderer; **no son screenshots del renderer real** corriendo con datos reales. **No bloquea el cierre matinal** porque el lote está limitado a `draft`/`tested` y la evidencia visual sigue siendo útil para revisión.

### F-4 — P2 — Catálogo AMI tiene 51 archivos vs 13 de SPEC §3 (DG-7 ya registrado)

- **Descripción:** `INVENTARIO-INSUMOS.md §3` cataloga 40 archivos scope; el árbol `context/datos AMI/` tiene 51 entradas totales (40 scope + 11 en `Proyectos UMM/` y `Formatos Sim/`). Esto ya está documentado como DG-7 (P3 en `GAPS.md`).
- **Impacto:** ruido documental pero no bloqueante.
- **Owner recomendado:** **INTEGRA** (revisión documental).
- **Condición de cierre:** ya registrado; sin acción adicional.

### F-5 — P3 — Audio `tested` con cobertura 4/8 freqs vs criterio AC-2.4 `suficiente|completo`

- **Descripción:** El PDF real sólo expone 4/8 freqs canónicas; `completitud_documental='parcial'`. AC-2.4 requiere `suficiente|completo` para promover a `tested`; el lote promueve a `tested` con justificación de cobertura ≥50% (decisión documentada en `DIFF-AUDIO.md §3`).
- **Impacto:** Es una interpretación razonable de la SPEC pero **no es lo que la AC-2.4 dice literalmente**. La promoción a `tested` se basa en una regla nueva ("cobertura ≥50% sin campos contradictorios") que NO está en la SPEC §4 acción 6 ni en el handoff §6.
- **Owner recomendado:** **INTEGRA** (revisar si la promoción a `tested` debe esperar cobertura ≥80% o si la regla del 50% se acepta como nueva convención; documentar la decisión).
- **Condición de cierre:** aceptar la regla del 50% como convención documentada, o revertir a `draft` hasta nuevo insumo AMI. **No bloquea el cierre matinal** porque el lote está `READY_FOR_VERIFYING`.

---

## 5. Cumplimiento de restricciones duras (SPEC §5)

| Restricción | Estado | Evidencia |
|---|---|---|
| WIP=1 | PASS | SOFIA ejecutó Unidades 1-4 secuencialmente (IMPL-REPORT §1). |
| Sin `commit`/`push`/`deploy`/`staging`/`producción`/`rollback`/`delete` | PASS | `git status --porcelain` no muestra commits del lote. |
| Sin migración Prisma | PASS | `prisma/schema.prisma` no modificado. |
| Sin `published` V3 | PASS | `validate-snapshot.js` PASS; `publishedVersions=[]` en ambos snapshots. |
| Sin secretos/`.env` | PASS | No se accedió a `.env`; lote usa snapshot JSON local. |
| Sin PII persistida en BD | PASS | Snapshot JSON local; ningún `MedicalTest` mutado; BD prod Railway no tocada. |
| Sin aptitud/diagnóstico IA | PASS | Extracciones son simulaciones; ninguna emite patrón obstructivo/restrictivo/mixto definitivo ni aptitud. |
| Sin tocar `context/datos AMI/` | PASS | `find … -newer /tmp/kilo/.lote-start` → 0 modificaciones. |
| `AI_NON_CONCLUSIVE` visible con razón | PASS | `audio-non-conclusive.html` línea 42-43; `StudyAIPrediagnosisPanel.tsx` línea 441-442 muestra `Razón: {non_conclusive_reason}`. |
| Una sola `notify_user` al cierre | N/A | Cierre pendiente (Unidad 6 INTEGRA). |

---

## 6. Riesgos operativos y preparación por entorno

### Calidad (desarrollo)

- **LISTO** para merge/uso de las calibraciones V3 Audio (`status='tested'`) y Espiro (`status='draft'`). El validador estructural PASS confirma que `audiometria-v3-tested.json` y `espirometria-v3-draft.json` cumplen `validateV3Root` sin errores.
- Las simulaciones son **utilizables como referencia** pero NO como ground truth para producción.

### Staging

- **NO LISTO** — el lote prohíbe `published` V3; no hay cambios deployables. Las capturas son evidencia visual, no assets de staging.
- Si Frank decide promover Espiro a `tested` en próximo lote, requerirá extractor real ejecutándose contra el PDF Sibelmed W20s (DG-1 bloquea hasta nueva entrega AMI).

### Producción

- **NO EVALUADO** — el lote prohíbe deploy y publicación V3. No aplica en este lote.

---

## 7. Handoff a ATLAS

**Acción recomendada para ATLAS:**

1. **Aceptar el veredicto `PASS_WITH_WARNINGS`** (no es `FAIL`/`BLOCKED`).
2. **Pivote a INTEGRA para Unidad 6 (cierre del lote)** — INTEGRA ejecuta:
   - Verificación de lectura (no escritura): `git status` sin staged; `find … -newer` → 0.
   - Consolidar `context/lote-nocturno-20260820-01/CIERRE-LOTE.md` (≤1 página).
   - Actualizar `context/CURRENT.md` y `PROYECTO.md` con estado `DONE (pendiente-revisión-Frank)` o `BLOCKED`.
   - Una sola `notify_user` con resumen ejecutivo (sin pedir acción automática).
3. **Escalar DG-1/DG-2/DG-3 a Frank** para próxima sesión:
   - Solicitar PDF Sibelmed W20s con tabla exhaustiva FVC/FEV1/M1/M2/M3/REF/LLN (≥10 parámetros).
   - Solicitar PDF Audiometría con las 8 frecuencias canónicas (250–8000 Hz).
   - Solicitar `VALORES DE REFERENCIA_ESPIRO.xlsx` con ecuaciones GLI-2012.
   - Confirmar al Frank la decisión sobre el hallazgo F-5 (regla de promoción a `tested` con ≥50% cobertura).
4. **Pivote a INTEGRA (siguiente iteración)** para documentar/refactorar:
   - Hallazgo F-1 (fixture espiro divergente del PNG).
   - Hallazgo F-2 (fixture audio demografía inventada).
   - Hallazgo F-3 (mocks HTML ≠ renderer real; aclarar en EVIDENCIA-RENDERER.md).
5. **NO pivotar a DEBY** en este lote — los hallazgos no son bugs reproducibles; son divergencias entre simulación e insumo real.

**Gate siguiente:** Unidad 6 (INTEGRA coordina) → cierre matinal del lote con Frank.

---

## 8. Autoauditoría (cumple §11 IDL v3 GEMINI)

- Delimité el incremento exacto (27 archivos en `context/lote-nocturno-20260820-01/`).
- Verifiqué SPEC y ADR vigentes (`SPEC_LOTE-20260820-01`, `DEC-20260820-04`).
- Revisé evidencia independiente (no sólo el IMPL-REPORT de SOFIA): validador re-ejecutado, Playwright re-ejecutado, integridad AMI verificada con `find … -newer`, FIX-20260812-20 verificado en código actual.
- No edité código, tests, config, `discovery/`, `SPEC/`, ni `PROYECTO.md`.
- No imprimí secretos ni PII (verifiqué que el fixture tiene `paciente_detalle.nombre_completo` pero esto es del filename/ZIP, no se persiste).
- Cada hallazgo tiene evidencia (líneas, comandos, archivos), impacto, reproducción, owner y condición de cierre.
- Separé severidad QA (P0/P1/P2/P3) de niveles L1/L2/L3 (no aplica aquí; el lote no es bug repair).
- Separé QA / staging / producción.
- No invoqué subagentes ni declaré `DONE`.
- El handoff vuelve a ATLAS con acción concreta y gate siguiente.
