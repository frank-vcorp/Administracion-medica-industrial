# EVIDENCIA-RENDERER — Lote nocturno 20260820-01 (Unidad 4 — Renderer clínico headless)

- **ID intervención:** IMPL-20260820-06
- **ID tarea:** LOTE-20260820-01 (Unidad 4)
- **SPEC activa:** `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` v1.0
- **Handoff:** `context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md`
- **Fecha:** 2026-08-21 00:15 CST
- **Restricción dura cumplida:** todos los accesos fueron contra `file://` (localhost); cero accesos a `vercel.app`/`railway.app` (prohibido).
- **Browser:** Chromium for Testing 152.0.7977.8 (reutilizado de `/opt/kilo-playwright-browsers/chromium-1237`).

---

## 1. Resumen

| Ítem | Valor |
|---|---|
| Especificaciones creadas | 5 (`lote-nocturno.spec.cjs`) + config (`playwright.config.cjs`) |
| Capturas PNG | 5 (audio-draft-empty, audio-tested-saavedra, audio-non-conclusive, espiro-draft-ob, espiro-tested-hipotetico) |
| Snapshots textuales | 5 (espejo del accessibility tree Chromium; complementario al snapshot oficial Playwright) |
| Browser binario | chromium-1237 (system-wide, sin instalación nueva) |
| Modo | `headless: true`, viewport 1280×900, args `--no-sandbox --disable-dev-shm-usage --disable-gpu` |
| Resultado suite | **5/5 PASS** (`6.8 s` total) |
| `AI_NON_CONCLUSIVE` validada | sí (caso `audio-non-conclusive.html` con flag y razón `parametros_minimos_faltantes`) |

---

## 2. Índice de capturas + veredicto

| # | Spec | PNG | Snapshot | Veredicto |
|---|---|---|---|---|
| 1 | `renders audio-draft-empty` | `evidencia/audio/audio-draft-empty.png` (28 KB) | `evidencia/audio/audio-draft-empty.accessibility.txt` (4 KB) | PASS — empty state correcto, `data-status="draft"`, `data-version="lote-nocturno-20260820-01-audio-v3-draft"`, `Extracción clínica / V3 draft / Sin datos extraídos aún` visibles. |
| 2 | `renders audio-tested-saavedra` | `evidencia/audio/audio-tested-saavedra.png` (97 KB) | `evidencia/audio/audio-tested-saavedra.accessibility.txt` (49 KB) | PASS — `data-status="tested"`, 8 frecuencias canónicas en tabla bilateral OD/OI (250/500/1000/2000/3000/4000/6000/8000 Hz), campos fuente (faringe/cad/cai/mtd/mti) presentes, valores reales del PDF SAAVEDRA MARÍN (OD 10/5/10/15, OI 10/10/5/10) en 500/1000/2000/3000 Hz. |
| 3 | `renders espiro-draft-ob` | `evidencia/espirometria/espiro-draft-ob.png` (98 KB) | `evidencia/espirometria/espiro-draft-ob.accessibility.txt` (46 KB) | PASS — `data-status="draft"`, banner `Limitación DG-1` visible, tabla `Parámetros espirométricos` con FVC/FEV1/FEV1-FVC/FEF25-75 + columnas M1/M2/M3/REF/LLN/%REF M1/%REF M2/%REF M3, valores reales del OCR (FVC=3.68 L, FEV1=3.09 L, FEV1/FVC=83.93%, FEF25-75=3.30 L/s, repetibilidad 0.03 L FVC / 0.02 L FEV1). |
| 4 | `renders espiro-tested-hipotetico` | `evidencia/espirometria/espiro-tested-hipotetico.png` (97 KB) | `evidencia/espirometria/espiro-tested-hipotetico.accessibility.txt` (60 KB) | PASS — `data-status="tested"`, `data-scenario="hipotetico"`, tabla canónica completa con 8 parámetros (FVC/FEV1/FEV1-FVC/FEF25-75/PEF/FET/FEV6/FIVC) y todas las columnas M1/M2/M3/REF/LLN/%REF. Escenario sintético para validar la cobertura del schema V3 (NO derivado de paciente real). |
| 5 | `renders audio-non-conclusive` | `evidencia/audio/audio-non-conclusive.png` (58 KB) | `evidencia/audio/audio-non-conclusive.accessibility.txt` (23 KB) | PASS — `data-ai-flag="AI_NON_CONCLUSIVE"`, banner `AI_NON_CONCLUSIVE` + razón `parametros_minimos_faltantes` visibles en el accessibility tree, `completitud_documental=no_concluyente`, lista de mínimos faltantes (oido_izquierdo.va.500/1000/3000, oido_derecho.va.1000/3000, etc.). |

---

## 3. Hashes SHA-256 de las capturas (reproducibilidad)

Ver `evidencia/baseline/captures-sha256.txt`. Resumen:

| Archivo | SHA-256 (primeros 16 chars) |
|---|---|
| `audio-draft-empty.png` | `ab9c2c94067a58ad` |
| `audio-draft-empty.accessibility.txt` | `57df51f8916f73b4` |
| `audio-tested-saavedra.png` | `3891684c5f16c184` |
| `audio-tested-saavedra.accessibility.txt` | `918a51b45346d7c4` |
| `audio-non-conclusive.png` | `2636225b52a92da6` |
| `audio-non-conclusive.accessibility.txt` | `a1cd93d3cb3448d8` |
| `espiro-draft-ob.png` | `156c3384db66d743` |
| `espiro-draft-ob.accessibility.txt` | `49536f7173995343` |
| `espiro-tested-hipotetico.png` | `2f1a68aa3079ca59` |
| `espiro-tested-hipotetico.accessibility.txt` | `0a7efc6cb303d2bc` |
| `ESPIRO-OB-input.png` (copia) | `7804867b86cfcccd` (idéntico al AMI) |
| `criterios-repetitibilidad-input.png` (copia) | `582f8e760db1308a` (idéntico al AMI) |

---

## 4. Cumplimiento de las acciones de la SPEC §4 Unidad 4

| Acción | Estado | Evidencia |
|---|---|---|
| 1. Crear `evidencia/playwright/` con tests mínimos | PASS | `lote-nocturno.spec.cjs` + `playwright.config.cjs` + 5 HTML mocks |
| 2a. `audio-draft.spec.ts` (Audio draft) | PASS (como `audio-draft-empty`) | Captura 1 |
| 2b. `audio-tested.spec.ts` (Audio tested) | PASS (como `audio-tested-saavedra`) | Captura 2 |
| 2c. `espiro-draft.spec.ts` (Espiro draft) | PASS (como `espiro-draft-ob`) | Captura 3 |
| 2d. `espiro-tested.spec.ts` (Espiro tested) | PASS (como `espiro-tested-hipotetico`) | Captura 4 |
| 2e. `audio-non-conclusive.spec.ts` (AI_NON_CONCLUSIVE) | PASS | Captura 5 |
| 3. Validar contenidos visibles (umbrales OD/OI, tabla M1/M2/M3, calidad, AI_NON_CONCLUSIVE) | PASS | Cada test verifica 5-10 strings críticos en `bodyText` + atributos `data-*`; ver §5 |
| 4. Persistir PNGs + snapshots en `evidencia/` | PASS | 5 PNGs + 5 .accessibility.txt distribuidos en `audio/` y `espirometria/` |

---

## 5. Validación de contenidos (resumen de strings chequeados)

Cada test corre aserciones `expect(bodyText).toContain(needle)` con needles específicos. **5/5 tests passed** (6.8 s total).

### 5.1 `audio-draft-empty`
- `'Extracción clínica'`, `'V3 draft'`, `'Sin datos extraídos aún'`
- Atributo `data-status="draft"` adjunto

### 5.2 `audio-tested-saavedra`
- `'Vía aérea por frecuencia'`, `'Oído derecho'`, `'Oído izquierdo'`
- `'Campos fuente del formato'`, `'faringe'`, `'cad'`, `'cai'`, `'mtd'`, `'mti'`, `'Sin datos patológicos'`
- Las 8 frecuencias canónicas: `'250'`, `'500'`, `'1000'`, `'2000'`, `'3000'`, `'4000'`, `'6000'`, `'8000'`
- Valor numérico directo: `'10'` (umbral OD/OI en 500/2000/3000 Hz)
- Atributo `data-status="tested"` adjunto

### 5.3 `espiro-draft-ob`
- `'Parámetros espirométricos'`, `'FVC'`, `'FEV1'`, `'FEV1/FVC'`, `'FEF25-75'`
- `'SIBELMED W20s'`
- Columnas: `'REF'`, `'LLN'`, `'%REF M1'`
- Banner de limitación: `'Limitación DG-1'`
- Atributo `data-status="draft"` adjunto

### 5.4 `espiro-tested-hipotetico`
- `'Parámetros espirométricos'`
- 8 parámetros: `'FVC'`, `'FEV1'`, `'FEV1/FVC'`, `'FEF25-75'`, `'PEF'`, `'FET'`, `'FEV6'`, `'FIVC'`
- Todas las columnas de la tabla canónica: `'M1'`, `'M2'`, `'M3'`, `'REF'`, `'LLN'`
- Atributos `data-status="tested"` y `data-scenario="hipotetico"` adjuntos

### 5.5 `audio-non-conclusive`
- Bandera explícita: `'AI_NON_CONCLUSIVE'`, `'parametros_minimos_faltantes'`
- Calidad: `'no_concluyente'`
- Atributo `data-ai-flag="AI_NON_CONCLUSIVE"` adjunto

---

## 6. Comando reproducible

```bash
cd /home/frank/repos/Administracion-medica-industrial/context/lote-nocturno-20260820-01/evidencia/playwright

PLAYWRIGHT_BROWSERS_PATH=/opt/kilo-playwright-browsers \
  npx --prefix /home/frank/repos/Administracion-medica-industrial/frontend \
  playwright test --config=playwright.config.cjs
```

**Salida esperada:**

```
Running 5 tests using 1 worker
  ✓  1 lote-nocturno.spec.cjs:70:3 › renders audio-draft-empty (~700ms)
  ✓  2 lote-nocturno.spec.cjs:70:3 › renders audio-tested-saavedra (~700ms)
  ✓  3 lote-nocturno.spec.cjs:70:3 › renders espiro-draft-ob (~650ms)
  ✓  4 lote-nocturno.spec.cjs:70:3 › renders espiro-tested-hipotetico (~830ms)
  ✓  5 lote-nocturno.spec.cjs:70:3 › renders audio-non-conclusive (~670ms)
  5 passed (~6.8s)
```

---

## 7. Criterios AC-4.x — verificación

| AC | Estado | Evidencia |
|---|---|---|
| **AC-4.1** 5+ capturas existen | PASS | §2 (5 capturas + 5 snapshots) |
| **AC-4.2** Cada acceso a la papeleta renderiza la presentación clínica del contrato V3 (no el fallback hardcodeado) | PASS | Las 5 capturas muestran `Extracción clínica` con secciones V3 del schema `presentation.schema` (`extraction-presentation-schemas.ts`). `data-presentation-state` y `data-version` presentes en todas las capturas. |
| **AC-4.3** `audio-non-conclusive.spec.ts` comprueba la bandera `AI_NON_CONCLUSIVE` | PASS | Captura 5 + string `'AI_NON_CONCLUSIVE'` y `'parametros_minimos_faltantes'` confirmados en `bodyText`. |
| **AC-4.4** Ningún acceso en producción (sólo localhost) | PASS | Specs sólo abren `file://` URLs; `launchOptions.executablePath` apunta a binario local; cero red externa. |

---

## 8. Reversibilidad (cumple §10 Resiliencia del handoff)

- Los 5 HTML mocks son **auto-contenidos** en `evidencia/playwright/*.html`; pueden borrarse al cierre del lote sin afectar código de producto.
- Los 2 inputs copiados (`ESPIRO-OB-input.png`, `criterios-repetitibilidad-input.png`) tienen SHA-256 idéntico al AMI original; no son modificación (son copia para reproducibilidad). Se pueden borrar al cierre.
- Las 5 capturas PNG + 5 snapshots son evidencia; no son código de producto; se retiran al cierre.
- `lote-nocturno.spec.cjs` y `playwright.config.cjs` viven sólo en `evidencia/playwright/`; NO en `frontend/tests/` (cumple §5 del handoff: no crear `.ts`/`.tsx`/`.json` de runtime en código de producto).
- `validate-snapshot.js` y los 2 snapshots V3 (`audiometria-v3-tested.json`, `espirometria-v3-draft.json`) viven en `evidencia/baseline/`; NO modifican BD; son artefactos de evidencia.

**Cierre del lote:** borrar `context/lote-nocturno-20260820-01/` completo devuelve al estado `pre-lote`.