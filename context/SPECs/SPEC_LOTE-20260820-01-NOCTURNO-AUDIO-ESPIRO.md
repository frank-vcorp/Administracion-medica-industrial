# SPEC LOTE-20260820-01 — Lote nocturno Audio/Espiro contra documentos reales AMI

- **ID:** `LOTE-20260820-01`
- **Estado:** `READY` (autorización vigente de Frank vía `DEC-20260820-04`; pendiente activación de SOFIA/GEMINI por ATLAS)
- **Versión:** 1.0
- **Propietario:** INTEGRA
- **Fecha:** 2026-08-20 23:48 America/Mexico_City
- **Tipo:** Lote operativo de validación (no es SPEC de feature; no introduce contrato nuevo)
- **ADR de respaldo:** no requiere (no introduce decisión arquitectónica nueva; se ciñe a contratos vigentes de `ADR-20260820-01` y `ADR-20260819-03`)
- **Fuentes funcionales:** `DEC-20260820-04` (autorización del lote), `FND-20260820-05` (cierre nocturno con evidencia real), `DEC-20260820-01` (Calibración fuente única), `DEC-20260820-02` (operationMode), `DEC-20260820-03` (publicación V3 visible), `BR-20260820-01` (paridad Calibración↔Events), `FND-20260820-01/02/03` (gaps a cerrar), `SPEC_ARCH-20260513-01`, `SPEC_ARCH-20260516-07`, `SPEC_ARCH-20260516-12`, `FIX-20260812-20`
- **Documentos fuente AMI:** `context/datos AMI/informacion para revision/` (ver §3)
- **Supersede:** no aplica
- **Fuera de alcance:** no se publica en `production` ningún cambio clínico; no se aplican migraciones; no se hacen commit/push/deploy; no se elimina nada; no se modifican contratos V3; no se rediseña Events; no se avanza `ARCH-20260820-01 Fase 5` (snapshot versionado + migración Prisma)

---

## 1. Resultado

Al expirar el lote, Frank dispondrá de evidencia reproducible que indica, para Audiometría y Espirometría:

1. Qué versiones V3 quedaron en `draft` o `tested` (no se publica `published`).
2. Qué tan cerca está la extracción + presentación clínica de parear con los documentos reales AMI entregados.
3. Qué gaps persisten (documentación, datos, calibración, contrato) con severidad y responsable.
4. Qué archivos PNG/HTML/log son la evidencia para revisión matinal de Frank.

La IA sólo produce **prelectura asistida y trazable**; **no emite diagnóstico final ni aptitud** en ninguna unidad del lote (`FND-20260820-05`, criterio clínico).

## 2. Ventana y permisos

| Campo | Valor |
|---|---|
| `loteId` | `LOTE-20260820-01` |
| Inicio | 2026-08-20 23:48 America/Mexico_City |
| Expiración | 2026-08-21 07:00 America/Mexico_City |
| WIP | 1 (una sola sesión SOFIA activa por instancia; paralelización deshabilitada por defecto) |
| Zona de trabajo | entorno local (repositorio, `npm run dev`, Playwright headless contra `http://localhost:3000`) |
| BD de pruebas | snapshot local (NO toca Railway prod) |
| Permisos | lectura/escritura sobre `MedicalTest.options.aiCalibration` (sólo ramas `draft` y `tested`); ejecución de suites vitest/pytest/lint/typecheck; Playwright headless; lectura de `context/datos AMI/informacion para revision/` |
| Prohibido sin nueva autorización | `commit`, `push`, `merge`, `PR`, `deploy`, `staging`, `production`, `rollback`, `delete`, `force-push`, migración Prisma, publicación V3 (`tested→published`), acceso a secretos/`.env`, llamadas a IA en producción, persistencia de datos reales de pacientes, escritura sobre `context/datos AMI/` |

## 3. Insumos reales AMI (catálogo)

Inventario congelado al 2026-08-20 23:52. Hash SHA-256 calculado por la Unidad 1.

| Archivo | Tipo | Uso previsto |
|---|---|---|
| `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf` | PDF Audiometría | Caso real Audiometría (umbrales OD/OI por frecuencia) |
| `AUDIO TA.png`, `AUDIO VO .png` | Imagen Audiometría | Comparación visual de layout |
| `SAAVEDRA MARIN FRANCISCO ERNESTO EM.pdf` | PDF Examen Médico | Caso real Examen Médico (no usado en este lote, queda como referencia) |
| `ESPIRO OB.png` | Imagen Espirometría | Caso visual Espirometría (no hay PDF en el AMI) |
| `criterios repetitibilidad-espirometria.png` | Imagen Espirometría | Criterios ATS/ERS repetibilidad |
| `DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx` | Presentación | Patrones espirométricos (referencia clínica) |
| `DIAGNOSTICO BASICO AUDIOS.pptx` | Presentación | Diagnóstico audiométrico (referencia clínica) |
| `VALORES DE REFERENCIA.xlsx` | Hoja de cálculo | Valores de referencia / LLN / ecuaciones |
| `FORMATOS Y CALENDARIO.docx` | Word | Formatos y calendario (referencia) |
| `CUESTIONARIO PARA AUDIO-ESPIRO-MIXTO.xls` | XLS | Cuestionario audio-espiro (referencia) |
| `CUESTIONARIO PARA AUDIOMETRIA Y ESPIROMETRIA.xls` | XLS | Cuestionario audio (referencia) |
| `PROGRAMA PARA REALIZAR AUDIOMETRÍA.docx` | Word | Programa de realización (referencia) |
| `Revision Ami10082026.txt` | Texto | Minuta AMI 2026-08-10 (contexto) |
| `Junta semanal de revisión de avances del sistema 2.0.txt` | Texto | Minuta semanal (contexto) |

> **Hallazgo de descubrimiento (a levantar a ATLAS si bloquea):** el AMI no entrega PDF de espirometría real; sólo imágenes (`ESPIRO OB.png`). Esto reduce la calidad de la validación de Espirometría para tabla exhaustiva M1/M2/M3/REF/LLN. La Unidad 3 documenta el límite explícitamente.

## 4. Plan por unidades (WIP=1, secuenciales)

Cada unidad tiene un ID, un responsable principal, una duración estimada, un output verificable y una bandera de salida. Una unidad `BLOCKED` no detiene a las siguientes si la dependencia es sólo de evidencia.

### Unidad 1 — Aprovisionamiento de insumos y baseline (responsable: SOFIA, ≈30 min)

**Objetivo:** congelar el inventario y la línea base de calibraciones V3 antes de iterar.

**Acciones:**
1. Calcular SHA-256 de cada archivo de `context/datos AMI/informacion para revision/` (no modificar archivos).
2. Listar calibraciones V3 existentes (sin filtro de prueba) con `SELECT schemaVersion, status, versionLabel, updatedAt FROM MedicalTest.options.aiCalibration WHERE @?, schemaVersion='V3'` (consulta de sólo lectura contra BD local de prueba). Salida a CSV en `context/lote-nocturno-20260820-01/INVENTARIO-INSUMOS.md`.
3. Localizar/instalar Playwright Chromium headless (`npx playwright install chromium`) y validar `chromium --version`.
4. Confirmar comandos disponibles: `npm run typecheck`, `npm test`, `npm run lint`, `npm run build`, `backend pytest`, `backend mypy`.

**Output verificable:** `context/lote-nocturno-20260820-01/INVENTARIO-INSUMOS.md` con tabla hash + CSV inventario + versiones Playwright/node/python.

**Salida:** `READY para Unidad 2` o `BLOCKED` (Playwright/node/python ausentes).

---

### Unidad 2 — Calibración V3 Audiometría: iterar `draft ↔ tested` contra caso AMI real (responsable: SOFIA, ≈2 h)

**Objetivo:** dejar una calibración V3 de Audiometría en estado `tested` que produzca, sobre `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf`, una extracción cuya tabla de umbrales OD/OI por frecuencia canónica coincida bit-a-bit con la tabla del PDF (validación visual con diff lado a lado).

**Acciones:**
1. Identificar la prueba `Audiometría` en el catálogo de servicios (`operationMode='clinical_interpretation'`).
2. En modo de prueba de Calibración, iterar sobre `draft` (no `published`):
   - editar `extraction.prompt` (resumir el contrato exhaustivo de `SPEC_ARCH-20260516-07` + `SPEC_ARCH-20260513-01`)
   - editar `clinicalCriteria` (umbrales, normales, completitud mínima)
   - editar `presentation.schema` (secciones OD/OI por frecuencia, con bloque de calidad)
3. Ejecutar la extracción contra `SAAVEDRA MARIN FRANCISCO ERNESTO AUDIO.pdf` (servidor local; sin tocar BD prod).
4. Renderizar resultado con `ClinicalExtractionRenderer` (captura PNG + HTML).
5. Comparar tabla de umbrales OD/OI (250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz) contra la tabla del PDF; registrar desviaciones en `context/lote-nocturno-20260820-01/DIFF-AUDIO.md`.
6. Si `requiere_review=false` y `completitud_documental='suficiente'` (o `completo'`) y tabla de umbrales coincide: promover a `tested` (no `published`).
7. Si no coincide: iterar prompt/clinicalCriteria hasta 3 veces; si persiste, registrar gap y salir.

**Output verificable:**
- `MedicalTest.options.aiCalibration.schemaVersion='V3'.status='tested'` (o `draft` con justificación) para Audiometría.
- `context/lote-nocturno-20260820-01/DIFF-AUDIO.md` con diff y criterios.
- Snapshot de extracción + PNG en `context/lote-nocturno-20260820-01/evidencia/audio/`.

**Criterios AC-2.x:**
- **AC-2.1** Existe al menos una versión V3 con `status='tested'` para Audiometría; **AC-2.2** Ninguna versión V3 transiciona a `published`; **AC-2.3** `DIFF-AUDIO.md` lista cada frecuencia canónica con valor extraído vs valor del PDF; **AC-2.4** Si tabla coincide, `completitud_documental ∈ {suficiente, completo}`; **AC-2.5** Si hay gap, queda registrado con severidad y responsable.

**Salida:** `READY para Unidad 3` o `BLOCKED` con causa.

---

### Unidad 3 — Calibración V3 Espirometría: tabla exhaustiva M1/M2/M3/REF/LLN (responsable: SOFIA, ≈2 h)

**Objetivo:** dejar una calibración V3 de Espirometría en `draft` o `tested` que produzca, sobre `ESPIRO OB.png` (único insumo real disponible, no hay PDF), una extracción con tabla de parámetros M1/M2/M3/%REF/REF/LLN visible (no necesariamente completa por la limitación del insumo).

**Acciones:**
1. Identificar la prueba `Espirometría` (`operationMode='clinical_interpretation'`).
2. Validar que FIX-20260812-20 (guardrails backend para Espirometría) sigue vigente en rama actual: `git log -- backend/app/services/ai/extractor.py | grep -i espirometria`.
3. Iterar sobre `draft`:
   - `extraction.prompt` con guardrails para tabla M1/M2/M3/REF/LLN
   - `clinicalCriteria` con FEV1/FVC/ratio, calidad, repetibilidad ATS/ERS
   - `presentation.schema` con tabla canónica
4. Ejecutar extracción sobre `ESPIRO OB.png`; si la tabla no aparece por la limitación del insumo, promover a `tested` registrando el límite.
5. Validar paridad de rangos con `VALORES DE REFERENCIA.xlsx` (no como override de calibración; como verificación de coherencia del bloque LLN de `presentation.schema`).
6. Documentar el límite: sin PDF de espirometría real, no se puede verificar exhaustividad de tabla M1/M2/M3; queda como `BLOCKED funcional` para iteración futura.

**Output verificable:**
- `MedicalTest.options.aiCalibration.schemaVersion='V3'.status` ∈ {`draft`, `tested`} para Espirometría.
- `context/lote-nocturno-20260820-01/DIFF-ESPIRO.md` con análisis y el límite del insumo.
- Snapshot + PNG en `context/lote-nocturno-20260820-01/evidencia/espirometria/`.

**Criterios AC-3.x:**
- **AC-3.1** Existe versión V3 auditada para Espirometría; **AC-3.2** Ninguna V3 a `published`; **AC-3.3** `DIFF-ESPIRO.md` declara la limitación del insumo (PNG sin PDF); **AC-3.4** Coherencia de LLN con `VALORES DE REFERENCIA.xlsx` registrada.

**Salida:** `READY para Unidad 4` o `BLOCKED` con causa.

---

### Unidad 4 — Renderer clínico headless: capturas Playwright de ambas pruebas (responsable: SOFIA, ≈1.5 h)

**Objetivo:** producir evidencia visual reproducible de la presentación clínica de `draft` y `tested` de ambas pruebas, con verificación de contenido visible (umbrales OD/OI, tabla M1/M2/M3, calidad, bandera `AI_NON_CONCLUSIVE` cuando falten mínimos).

**Acciones:**
1. Crear `context/lote-nocturno-20260820-01/evidencia/playwright/` con tests mínimos (no committed a `main`; viven sólo en el lote).
2. Tests a ejecutar (vitest o playwright runner; lo que detecte el repo):
   - `audio-draft.spec.ts`: navega a la papeleta/evento con `Audio` cargado, captura PNG + accessibility snapshot.
   - `audio-tested.spec.ts`: igual con `tested`.
   - `espiro-draft.spec.ts`: idem.
   - `espiro-tested.spec.ts`: idem.
   - `audio-non-conclusive.spec.ts`: inyecta extracción con mínimos faltantes y verifica que la UI muestra `AI_NON_CONCLUSIVE` con razón `parametros_minimos_faltantes`.
3. Validar, para cada captura, que el accessibility snapshot contiene los textos clave (umbrales OD/OI, tabla M1/M2/M3, calidad, `AI_NON_CONCLUSIVE`).
4. Persistir PNGs y snapshots en `context/lote-nocturno-20260820-01/evidencia/`.

**Output verificable:** `context/lote-nocturno-20260820-01/EVIDENCIA-RENDERER.md` con índice de 5+ capturas + hash + veredicto por captura.

**Criterios AC-4.x:**
- **AC-4.1** 5+ capturas existen; **AC-4.2** cada acceso a la papeleta renderiza la presentación clínica del contrato V3 (no el fallback hardcodeado); **AC-4.3** `audio-non-conclusive.spec.ts` comprueba la bandera `AI_NON_CONCLUSIVE`; **AC-4.4** ningún acceso en producción (sólo localhost).

**Salida:** `READY para Unidad 5` o `BLOCKED` con causa.

---

### Unidad 5 — QA independiente GEMINI + registro de gaps (responsable: GEMINI vía ATLAS, ≈1 h; INTEGRA coordina)

**Objetivo:** dictamen independiente del lote y catálogo de gaps.

**Acciones:**
1. INTEGRA prepara handoff a GEMINI vía ATLAS (no invocación directa).
2. GEMINI evalúa: completitud por prueba, paridad Calibración↔renderer, trazabilidad de `AI_NON_CONCLUSIVE`, ausencia de `published` accidental, respeto a la prohibición de diagnosticar/aptitud.
3. INTEGRA consolida `context/lote-nocturno-20260820-01/GAPS.md` con clasificación `P0|P1|P2|P3`, dueño propuesto (INTEGRA/SOFIA/DEBY/ATLAS), bloqueante sí/no.

**Output verificable:**
- `context/reviews/QA-20260820-08-LOTE-NOCTURNO-AUDIO-ESPIRO.md` (veredicto GEMINI).
- `context/lote-nocturno-20260820-01/GAPS.md` con catálogo priorizado.

**Criterios AC-5.x:**
- **AC-5.1** GEMINI emite `PASS`/`PASS_WITH_WARNINGS`/`FAIL`/`BLOCKED`; **AC-5.2** todo `FAIL` queda como `BLOCKED` del lote; **AC-5.3** todo gap tiene severidad y dueño.

**Salida:** `READY para Unidad 6` o `BLOCKED`.

---

### Unidad 6 — Cierre del lote + handoff matinal a Frank (responsable: INTEGRA, ≈30 min)

**Objetivo:** snapshot final del lote y entrega a Frank para revisión.

**Acciones:**
1. Verificar (lectura) que ninguna calibración V3 haya pasado a `published`.
2. Verificar (lectura) que ningún archivo de `context/datos AMI/` haya sido modificado.
3. Verificar (lectura) que `git status` no presente archivos staged (sin commit).
4. Consolidar `context/lote-nocturno-20260820-01/CIERRE-LOTE.md` (≤1 página):
   - loteId, ventana, unidades ejecutadas, calibraciones `draft`/`tested` resultantes, gaps abiertos, evidencia adjunta, decisión recomendada para Frank al regreso.
5. Notificar a Frank vía ATLAS con resumen ejecutivo (sin pedir acción automática).
6. Cerrar lote en `context/CURRENT.md` y `PROYECTO.md`.

**Output verificable:**
- `context/lote-nocturno-20260820-01/CIERRE-LOTE.md` firmado.
- `context/CURRENT.md` actualizado a `LOTE-20260820-01 DONE (pendiente-revisión-Frank)` o `BLOCKED`.
- Entrada en `PROYECTO.md` `Diario de Cambios`.

**Criterios AC-6.x:**
- **AC-6.1** `CIERRE-LOTE.md` ≤ 1 página; **AC-6.2** `git status` sin staged; **AC-6.3** ninguna V3 `published`; **AC-6.4** `context/datos AMI/` intacto.

---

## 5. Restricciones duras (no negociables)

1. **WIP=1.** Una sola sesión SOFIA activa. Paralelización deshabilitada por defecto (los archivos de artefactos del lote y los archivos de calibración V3 son comunes; cualquier paralelización requeriría evidencia de cero acoplamiento y autoriza INTEGRA explícitamente).
2. **No `commit`, `push`, `merge`, `PR`, `deploy`, `staging`, `production`, `rollback`, `delete`, `force-push`.** Auditar no implica permiso para desplegar.
3. **No migración Prisma.** Aunque `ARCH-20260820-01` Fase 5 esté READY, queda fuera del lote.
4. **No `published` V3.** Sólo `draft`/`tested`. Si la unidad lo intenta, abortar y reportar.
5. **No secretos/`.env`.** Cero exposición de claves; preferir `.env.example`; las ejecuciones IA deben usar `.env.local` o claves de BD local de prueba.
6. **No PII persistida.** Las papeletas reales AMI no se persisten en BD; sólo se usan como input en modo de prueba. No se sube nada a Railway prod.
7. **No aptitud ni diagnóstico.** La IA sólo produce prelectura asistida y trazable; cualquier dictamen automatizado es bug del lote.
8. **No tocar `context/datos AMI/`.** Los archivos reales AMI son read-only para el lote.
9. **`AI_NON_CONCLUSIVE` visible.** Si faltan mínimos clínicos, la UI debe mostrar la razón explícitamente (no ocultar ni simular concluyente).
10. **Notificación única al cierre.** Una sola `notify_user` con el resumen del lote (no spam de progreso).

## 6. Riesgos aceptados

- **R1 (aceptado):** sin PDF de espirometría real, la tabla M1/M2/M3/REF/LLN no puede validarse exhaustivamente. Unidad 3 declara el límite y mantiene `draft`/`tested` con justificación.
- **R2 (aceptado):** si Playwright headless no está disponible en el entorno, Unidad 1 aborta y el lote queda `BLOCKED` para ese eje; las unidades 2 y 3 pueden continuar con snapshots de BD ocurl.
- **R3 (aceptado):** cierre silencioso (Frank ausente >15 min). Si el lote termina a las 07:00 con unidades `DONE`/`BLOCKED`, se persiste el estado y un solo `notify_user` resumen.
- **R4 (aceptado):** GEMINI no responde en ventana. Unidad 5 cierra como `BLOCKED` con handoff pendiente; unidades 1-4 siguen `DONE` si cumplen AC.

## 7. DoD

- **D1** Unidades 1-4 superaron AC-1.x … AC-4.x con evidencia reproducible.
- **D2** Unidad 5 tiene veredicto GEMINI (o `BLOCKED` documentado).
- **D3** Unidad 6 con `CIERRE-LOTE.md` firmado y `CURRENT.md`+`PROYECTO.md` consistentes.
- **D4** Ninguna V3 quedó `published`.
- **D5** `git status` sin cambios staged; ninguna migración aplicada.

## 8. Trazabilidad a Discovery

| ID | Uso en esta SPEC |
|---|---|
| `DEC-20260820-04` | Autorización del lote |
| `FND-20260820-05` | Motivación: cierre nocturno con evidencia real |
| `DEC-20260820-01` | Calibración fuente única (gobernanza de extracción y presentación) |
| `DEC-20260820-02` | `operationMode='clinical_interpretation'` aplica a Audio/Espiro |
| `DEC-20260820-03` | Publicación V3 visible (sólo `draft`/`tested` en este lote) |
| `BR-20260820-01` | Paridad Calibración↔renderer (validada en Unidad 4) |
| `FND-20260820-01/02/03` | Gaps a cerrar en unidades 2-4 |
| `SPEC_ARCH-20260513-01` | Base V1 Audio/Espiro (prompts/clinicalCriteria) |
| `SPEC_ARCH-20260516-07` | Campos fuente Audiometría (Faringe/CAD/CAI/MTD/MTI) |
| `SPEC_ARCH-20260516-12` | Extracción exhaustiva Espirometría |
| `FIX-20260812-20` | Guardrails backend para Espirometría (validar vigencia en Unidad 3) |

## 9. Pendientes y discovered gaps

- **DG-1:** AMI no entrega PDF de espirometría real (sólo PNG). Solicitar a Frank samples adicionales en próxima iteración.
- **DG-2:** `AI_NON_CONCLUSIVE` debe verificar que muestra la razón explícita (`parametros_minimos_faltantes`, `calidad_insuficiente`, etc.) y no sólo una etiqueta genérica.
- **DG-3:** Fase 5 de `ARCH-20260820-01` (snapshot versionado + migración Prisma) queda pendiente de autorización operativa de Frank para iteración futura.

## 10. Cambios estructurales a artefactos del lote

Archivos y directorios que el lote **crea** (no toca código de producto):

- `context/lote-nocturno-20260820-01/INVENTARIO-INSUMOS.md`
- `context/lote-nocturno-20260820-01/DIFF-AUDIO.md`
- `context/lote-nocturno-20260820-01/DIFF-ESPIRO.md`
- `context/lote-nocturno-20260820-01/EVIDENCIA-RENDERER.md`
- `context/lote-nocturno-20260820-01/GAPS.md`
- `context/lote-nocturno-20260820-01/CIERRE-LOTE.md`
- `context/lote-nocturno-20260820-01/evidencia/audio/*.png`
- `context/lote-nocturno-20260820-01/evidencia/espirometria/*.png`
- `context/lote-nocturno-20260820-01/evidencia/playwright/*.spec.ts` (sólo vigentes durante el lote; retirables al cierre)
- `context/reviews/QA-20260820-08-LOTE-NOCTURNO-AUDIO-ESPIRO.md` (GEMINI)

**NO** se crean archivos `.ts`, `.tsx`, `.prisma`, `.sql`, `.yml`, `.json` de config de runtime, ni se modifican `package.json`, `prisma/schema.prisma`, `backend/app/**`, `frontend/src/**` excepto para guardar `draft`/`tested` en `aiCalibration` (acción reversible de runtime, no commitable).
