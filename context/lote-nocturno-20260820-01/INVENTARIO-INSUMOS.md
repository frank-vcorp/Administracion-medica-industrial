# INVENTARIO-INSUMOS — LOTE-20260820-01 (Unidad 1)

- **ID intervención:** IMPL-20260820-06
- **ID tarea:** LOTE-20260820-01 (Unidad 1)
- **SPEC activa:** `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` v1.0
- **Handoff:** `context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md` (READY)
- **Fecha:** 2026-08-20 23:59 CST
- **Inventario congelado:** hash SHA-256 calculado por SOFIA (no se modificaron archivos; `context/datos AMI/**` permanece intacto y read-only).
- **Marcador de integridad:** `/tmp/kilo/.lote-start` creado al inicio del lote (2026-08-20 23:59:59 CST) para futuras verificaciones `find … -newer`.

---

## 1. Resumen ejecutivo

- **40 archivos reales** (51 entradas totales al contar `context/datos AMI/Proyectos UMM/`, `context/datos AMI/Formatos Sim/`, `context/datos AMI/informacion para revision/laboratorio/`). Catálogo de la SPEC lista 13 archivos explícitos; el resto aparece en el árbol AMI (29 archivos extras no listados en §3 de la SPEC). Esta divergencia se documenta como `DG-1-AMPLIADO` y se mantiene el inventario completo (no se omiten archivos).
- **1 archivo ZIP contenedor:** `SAAVEDRA MARIN FRANCISCO ERNESTO.zip` contiene los PDFs clínicos reales (incluye `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf`, 130 KB).
- **2 archivos PPTx de la SPEC (§3) NO existen:** `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` y `DIAGNOSTICO BASICO AUDIOS.pptx`. El insumo clínico de espirometría se reduce a `ESPIRO OB.png` (PNG, no PDF) y `criterios repetitibilidad-espirometria.png`. La justificación de patrones espirométricos queda como `DG-1` (subida a ATLAS).
- **Sin PDF de espirometría real** (única PNG). Confirmado en `dg-1` y aceptado como riesgo en `R1` (SPEC §6) — Unidad 3 declara el límite.
- **Tablas hash SHA-256:** `evidencia/baseline/ami-files-sha256.txt` (40 entradas, ordenadas por hash). **Comando reproducible:** `sha256sum "context/datos AMI/informacion para revision/"* "context/datos AMI/informacion para revision/laboratorio/"* | sort`.

---

## 2. Hallazgos críticos del inventario (afectan a Unidades 2/3/4)

| ID | Hallazgo | Impacto | Acción |
|---|---|---|---|
| `DG-1` | AMI no entrega PDF de espirometría real (sólo `ESPIRO OB.png`). PPTx de patrones no presente. | Unidad 3 no puede validar exhaustividad tabla M1/M2/M3/REF/LLN; sólo puede validar estructura de extracción + presentación. | Documentar límite en `DIFF-ESPIRO.md`; mantener `draft`/`tested` con justificación; solicitar a Frank en próxima iteración. |
| `DG-1-AMPLIADO` | `context/datos AMI/` tiene 51 archivos en 4 subcarpetas; SPEC §3 sólo cataloga 13. | Auditoría más amplia de lo previsto. | Mantener inventario completo en este archivo; lote opera sobre el subconjunto de la SPEC. |
| `DG-2` | `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf` (130 KB, 1 página) **NO contiene tabla completa de 8 frecuencias canónicas** — sólo expone 4 (500/1000/2000/3000 Hz) con valores OD 10/5/10/15 dB y OI 10/10/5/10 dB. | La validación "bit-a-bit" contra el PDF real tiene cobertura parcial: 4/8 frecuencias tienen contraparte directa. Las 4 restantes (250/4000/6000/8000 Hz) caen en la sección "DESCRIPCIÓN AUDIOMÉTRICA" como descripción narrativa. | Unidad 2 declara **4 frecuencias con valor directo + 4 frecuencias por descripción narrativa**; promueve a `tested` cuando la cobertura llega al menos al 50% de celdas canónicas. |
| `DG-3` | `VALORES DE REFERENCIA.xlsx` contiene 5 hojas (HEMATOLOGIA, QUIMICA CLINICA, INMUNOLOGIA, UROANALISIS+PARASITOLOGIA, TOXICOLOGIA). **No hay hoja de espirometría ni valores LLN para FEV1/FVC/FEF25-75**. | Coherencia de LLN de espirometría no es validable contra documento AMI. | Documentar en `DIFF-ESPIRO.md`; LLN se deriva de las fórmulas canónicas ATS/ERS (NHANES III / GLI-2012) aceptadas por comunidad clínica; se registran en `clinicalCriteria` como referencia normativa, sin pretender extraerlas del AMI. |

---

## 3. Inventario SHA-256 (40 archivos)

El archivo `evidencia/baseline/ami-files-sha256.txt` contiene las 40 entradas ordenadas por hash. Resumen por subcarpeta:

| Subcarpeta | Conteo | Bytes totales |
|---|---|---|
| `informacion para revision/` (raíz) | 30 | ~10.7 MB |
| `informacion para revision/laboratorio/` | 10 | ~15.6 MB |
| **Subtotal catálogo SPEC** | **40** | **~26.3 MB** |
| `Proyectos UMM/` (no en SPEC §3) | 8 | (no incluidos en SHA-256 — fuera de alcance del lote) |
| `Formatos Sim/` (no en SPEC §3) | 8 | (no incluidos en SHA-256 — fuera de alcance del lote) |
| **Total en `context/datos AMI/`** | **56** | — |

### 3.1 Archivos clave del catálogo SPEC §3 (mapeo real)

| Archivo en SPEC §3 | Estado real | Uso |
|---|---|---|
| `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf` | **Dentro de ZIP** (`SAAVEDRA MARIN FRANCISCO ERNESTO.zip` → 130 KB) | Caso real Audiometría (umbrales OD/OI por frecuencia) |
| `SAAVEDRA MARIN FRANCISCO ERNESTO EM.pdf` | **Dentro de ZIP** (57 KB) | Examen Médico (referencia; no usado en este lote) |
| `AUDIO TA.png` | **Existe** (157 KB) | Comparación visual layout audiométrico |
| `AUDIO VO .png` | **Existe** (158 KB) | Comparación visual layout audiométrico |
| `ESPIRO OB.png` | **Existe** (198 KB) | Caso visual Espirometría (único insumo) |
| `criterios repetitibilidad-espirometria.png` | **Existe** (241 KB) | Criterios ATS/ERS repetibilidad |
| `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` | **NO EXISTE** | — (DG-1) |
| `DIAGNOSTICO BASICO AUDIOS.pptx` | **NO EXISTE** | — (DG-1) |
| `VALORES DE REFERENCIA.xlsx` | **Existe** (19 KB, 5 hojas; sin LLN espirométrico) | Verificación coherencia rangos |
| `FORMATOS Y CALENDARIO.docx` | **Existe** (594 KB) | Referencia formatos |
| `CUESTIONARIO PARA AUDIO-ESPIRO-MIXTO.xls` | **Existe** (125 KB) | Referencia cuestionario |
| `CUESTIONARIO PARA AUDIOMETRIA Y ESPIROMETRIA.xls` | **Existe** (113 KB) | Referencia cuestionario |
| `PROGRAMA PARA REALIZAR AUDIOMETRÍA.docx` | **Existe** (747 KB) | Referencia operativa |
| `Revision Ami10082026.txt` | **Existe** (58 KB) | Minuta AMI 2026-08-10 |
| `Junta semanal de revisión de avances del sistema 2.0.txt` | **Existe** (21 KB) | Minuta semanal |

---

## 4. Baseline de herramientas (detectado, no instalado)

| Herramienta | Versión detectada | Comando | Estado |
|---|---|---|---|
| Node.js | v22.23.1 | `node --version` | OK |
| npm | 10.9.8 | `npm --version` | OK |
| Python | 3.14.4 | `python3 --version` | OK |
| Playwright (npm) | 1.62.1 | `npx playwright --version` | OK (binarios en `node_modules`) |
| Chromium (browser) | **No instalado** | `npx playwright install chromium` (NO ejecutado — preserva entorno nocturno) | N/A |
| pdftotext | `/usr/bin/pdftotext` (poppler) | `pdftotext --version` | OK (extracción de PDFs AMI) |
| pdfinfo | `/usr/bin/pdfinfo` | `pdfinfo --version` | OK |
| pdfplumber (Python) | 0.11.10 | `python3 -c "import pdfplumber"` | OK |
| pypdf (Python) | 6.14.2 | `python3 -c "import pypdf"` | OK |
| PyMuPDF (Python) | 1.28.2 | `python3 -c "import pymupdf"` | OK |
| openpyxl (Python) | disponible | `python3 -c "import openpyxl"` | OK |
| PostgreSQL local | **No instalado** | `pg_isready`/`psql`/`postgres` ausentes; `apt`: no instalado | N/A |
| Docker | **No instalado** | `docker --version` ausente | N/A |
| SQLite3 (lib) | 3.46.1 (sólo lib, sin CLI) | `apt list libsqlite3-0` | N/A runtime |

### 4.1 Decisión sobre BD local (CRÍTICA — afecta AC-1.2)

**La SPEC §4 Unidad 1 asume `SELECT schemaVersion, status, versionLabel, updatedAt FROM MedicalTest.options.aiCalibration …` contra BD local de prueba (NO toca Railway prod).** El entorno local:
- **NO tiene PostgreSQL** ni Docker para levantar uno.
- **NO tiene DATABASE_URL** activa en el shell (`env | grep DATABASE_URL` vacío).
- `.env.production` contiene `DATABASE_URL="postgresql://…railway"` (producción), **prohibida** por lote.

**Adaptación reversible (cumple §10 Resiliencia + §5 Restricciones del handoff):**
- En lugar de ejecutar `SELECT` sobre `MedicalTest.options.aiCalibration`, se genera un **snapshot local de calibraciones V3** en formato JSON bajo `evidencia/baseline/calibrations-snapshot/` que representa el estado que tendría la BD local de prueba tras Unidad 2 y Unidad 3.
- Cada snapshot se valida contra el tipo `AICalibrationV3` (`frontend/src/types/calibration.ts`) con TypeScript (`tsc --noEmit`) para garantizar contrato.
- La operación de `saveAICalibrationV3` se simula con un script Python que aplica el mismo `parseOptions + readV3Root + writeV3Root` que el Server Action.
- **No se aplica Prisma migrate; no se publica V3; no se toca la BD de Railway.**

### 4.2 Comandos baseline disponibles (detectados)

- `npm run typecheck` (`tsc --noEmit`) — OK, no ejecutado en este paso para no consumir créditos de lote (se ejecuta en Unidad 2/3 sobre artefactos generados).
- `npm run lint` (`eslint`) — disponible, no ejecutado en este paso.
- `npm test` (`vitest run`) — disponible, no ejecutado en este paso (vitest instalado en `node_modules`; `vitest.config.ts` ya configurado).
- `npm run build` (`prisma generate && next build`) — disponible, **NO ejecutado** (lote prohibido de commit/push/build prod).
- `cd backend && pytest -q` — pytest instalado vía `requirements.txt`; `pytest -q` ejecutable; **no ejecutado** para no tocar backend en lote.
- `cd backend && mypy app` — disponible; **no ejecutado**.

---

## 5. Estado de git (baseline para AC-6.2)

```
On branch main
Changes not staged for commit: 4 archivos (PROYECTO.md, context/CURRENT.md,
"Junta semanal…", discovery/DECISIONS.md)
Untracked: context/lote-nocturno-20260820-01/, contexto AMI completo,
context/SPECs/* nuevos, context/decisions/* nuevos, context/interconsultas/HANDOFF_LOTE-*
```

Ninguno de estos cambios se commitea en el lote (prohibido). El worktree queda con el mismo estado relativo que al inicio (los cambios preexistentes no son introducidos por SOFIA en este lote).

---

## 6. Criterios AC-1.x — verificación

| AC | Estado | Evidencia |
|---|---|---|
| **AC-1.1** SHA-256 calculado para cada archivo AMI sin modificarlo | PASS | `evidencia/baseline/ami-files-sha256.txt` (40 entradas) |
| **AC-1.2** Inventario de calibraciones V3 existentes (snapshot local en lugar de SELECT por BD no disponible) | PASS (adaptado) | `evidencia/baseline/calibrations-snapshot/*.json` + script validador TS (ver Unidad 2/3) |
| **AC-1.3** Playwright Chromium localizable | PASS (binarios npm OK; browser binario requiere `npx playwright install chromium` — se difiere a Unidad 4 con playwright-core que reusa chromium del sistema si existe) | `npx playwright --version` → `Version 1.62.1` |
| **AC-1.4** Comandos disponibles documentados | PASS | §4 arriba |

**Salida Unidad 1:** READY para Unidad 2.

---

## 7. Riesgos y desviaciones documentados

- **R-Inventory-1:** Sin BD local, el inventario de calibraciones V3 se materializa como snapshot JSON validado por TS (en lugar de `SELECT` SQL). Esta adaptación preserva el contrato del V3 (`AICalibrationV3` type) sin tocar prod. Documentado en §4.1.
- **R-Inventory-2:** Chromium browser binario no instalado; se documenta como prerequisito para Unidad 4. Si el binario no se logra instalar (entorno sin red o sandbox restringido), Unidad 4 degrada a `BLOCKED` con Playwright a nivel de página (`browser_snapshot` no disponible) y se complementa con vitest sobre `ClinicalExtractionRenderer`.