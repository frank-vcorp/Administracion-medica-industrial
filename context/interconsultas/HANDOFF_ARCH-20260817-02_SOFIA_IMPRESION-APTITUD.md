# HANDOFF — ARCH-20260817-02 — SOFIA — Impresión y Aptitud del Examen Médico

**Origen:** INTEGRA
**Destino:** SOFIA
**ID tarea:** ARCH-20260817-02 (SPEC lista, ADR firmado)
**SPEC activa:** `context/SPECs/SPEC_ARCH-20260817-02-IMPRESION-APTITUD.md`
**ADR:** `context/decisions/ADR-20260817-02-IMPRESION-APTITUD.md`
**Fecha:** 2026-08-17 (CST)
**Baseline esperado:** `1467d4f` (Módulo 1 combos — SPEC-01 corte 1 verde). Verificar antes de empezar: `pnpm typecheck && pnpm test --run` desde `frontend/`.

---

## 0. Restricciones de bloqueo (leer primero)

**Este handoff NO se delega hasta que Frank apruebe explícitamente las 2 decisiones abiertas:**

- **P1 (DA-1):** Cambio del enum de `aptitud` a 5 valores del PDF de referencia + `PENDIENTE DE RESULTADOS`, con DA-1 tolerante + migración de la heurística `includes('no apto')` del portal. **Corte 1 depende de esto.**
- **P2 (DA-4):** Membrete "Soluciones Médico Empresariales / Medicina Laboral" como header del PDF. **Corte 5 depende de esto; Cortes 2-3-4 pueden proceder sin él.**

Si Frank aprueba solo P1 (no P2): ejecutar Cortes 1-2-3-4, saltar Corte 5.
Si Frank aprueba ambos: ejecutar Cortes 1-2-3-4-5.
Si Frank rechaza P1: volver a INTEGRA para re-SPEC (DA-1 es foundation).

**Restricciones globales (heredadas de SPEC-01 + handoff Frank):**
- SOFIA NO commitea/pushea sin OK explícito de Frank.
- SOFIA NO toca `prisma/schema.prisma`.
- SOFIA NO toca `backend/app/services/ai/prediagnostic.py` (verificación visual solo).
- SOFIA NO implementa nota médica, certificado médico, tipo de consulta ni incapacidad (fuera de alcance, SPEC §1.5).
- SOFIA respeta los literales del PDF de referencia **verbatim** (principio "lo copia igualito" de SPEC-01 — los 9 labels de la tabla, los 4 literales de aptitud, el patrón numerado de recomendaciones, el texto "Realizó EM / Ced. Prof.").
- SOFIA ejecuta gates (`pnpm typecheck && pnpm test --run && pnpm lint`) después de CADA commit, no solo al final.
- SOFIA usa `task` tool con `subagent_type='gemini'` como segunda mano de validación antes de reportar "listo para commit" en cambios no triviales (toca contrato del portal, >200 líneas, PDF). Qodo está sunset.

---

## 1. Referencias funcionales

| ID | Descripción | Fuente |
|---|---|---|
| T-5.8 | Auto-poblamiento del resumen/dictamen desde antecedentes y examen | `Revision_AMI_10082026_puntos.md` §5.8 |
| T-5.14 | Incremento de caracteres de aptitud/dictamen | `Revision_AMI_10082026_puntos.md` §5.14 |
| T-B.1 | Membrete / logo "Soluciones" + cintillo en reporte final | `Junta_semanal_12082026_puntos.md` B.1 |
| T-B.4 | Auto-poblamiento del dictamen desde examen médico | `Junta_semanal_12082026_puntos.md` B.4 |
| T-5.9 (parcial) | Observaciones adicionales: ampliar caracteres | `Revision_AMI_10082026_puntos.md` §5.9 |
| T-5.10 (parcial) | Impresión del examen médico: máximo 3 hojas (paginación controlada) | `Revision_AMI_10082026_puntos.md` §5.10 |

**Fuente canónica de literales:** `context/datos AMI/informacion para revision/REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf` (extraído vía `pdftotext -layout` por INTEGRA — ver SPEC §1.3 para la estructura literal completa).

---

## 2. Resultado técnico esperado

Migrar "Impresión y Aptitud" del Examen Médico a una UX completa basada en el `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf`:

1. **Enum de aptitud** alineado al PDF canónico (5 valores + DA-1 tolerante).
2. **Auto-poblamiento** del dictamen final en `EventFlowController` desde la pestaña "Impresión y Aptitud" (elimina duplicación de captura).
3. **Reemplazo del `MedicalDictamenPDF`** por reporte de aptitud fiel al PDF de referencia (tabla de 9 campos, 5 valores de aptitud como checklist, recomendaciones numeradas, firma, paginación, membrete si P2 aprobada).
4. **Tabla resumen de 9 campos** con auto-poblamiento mixto (campos 1-5 desde captura manual, campos 6-9 desde resultados IA), preview en vivo en la pestaña "Impresión y Aptitud".
5. **Recomendaciones auto-pobladas** desde catálogo de reglas hallazgo→recomendación + edición manual.
6. **Migración de la heurística `includes('no apto')`** del portal a lectura estructurada de `aptitud` con fallback legacy.

---

## 3. Alcance de archivos/módulos

### 3.1 Corte 1 — Enum de aptitud + DA-1 + migración heurística portal (8 commits)

Depende de: **OK Frank P1 (DA-1)**.

| # | Archivo | Líneas estimadas | Cambio |
|---|---|---|---|
| 1 | `frontend/src/schemas/clinical/exam.schema.ts` | +~40 / -~5 | Constantes `APTITUD_VALUES_NUEVO` (5), `LEGACY_APTITUD_VALUES` (`'NO APTO'`), `AGUDEZA_VISUAL_RESUMEN_VALUES` (3), `PRESION_ARTERIAL_RESUMEN_VALUES` (3). `aptitud` → `tolerantZinEnum(APTITUD_VALUES_NUEVO)`. `agudeza_visual_resumen` y `presion_arterial_resumen` → `tolerantZinEnum`. Ver líneas vigentes: `:411` (`aptitud`), `:419-420` (resumen). |
| 2 | `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` (`APTITUD_OPTIONS` líneas 237-242) | +~10 / -~5 | 5 valores nuevos con labels y colores. El literal largo "NO CUMPLE CON LOS CRITERIOS..." con `break-words` o `truncate` + tooltip. |
| 3 | `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` (resumen clínico líneas 1408-1450) | +~30 / -~5 | `agudeza_visual_resumen` y `presion_arterial_resumen` como `<select>` (junto a `estado_nutricional` y `salud_bucal` que ya son combos SPEC-01). Extender `RESUMEN_CLINICO_FIELDS` con los 2 campos nuevos. |
| 4 | `frontend/src/lib/clinical/aptitud.helper.ts` (NUEVO) | +~40 | Helper `isAptoFromVerdict(verdict, examData)` → `{ apto, pendiente, label }`. `aptitudLabel(aptitud)`. Lógica: `aptitud === 'APTO'` → apto; `aptitud === 'PENDIENTE DE RESULTADOS'` → pendiente; `aptitud` en {`APTO CONDICIONADO`, `APTO CON RESTRICCIONES`, `NO CUMPLE...`} → no apto; `aptitud` nulo/indef → fallback legacy `finalDiagnosis.toLowerCase().includes('no apto')`. |
| 5 | `frontend/src/actions/portal.actions.ts` (línea 63) | +~20 / -~3 | Migrar `const diag = v.finalDiagnosis.toLowerCase(); ... includes('no apto')` → `isAptoFromVerdict(v, v.exam?.physicalExamData)`. Añadir `exam: { select: { physicalExamData: true } }` en el include del verdict (ver `:55`, `:112`, `:155`). |
| 6 | `frontend/src/app/portal/events/page.tsx` (línea 56) | +~5 / -~2 | Migrar `const isApto = ...` → `isAptoFromVerdict(event.verdict, event.exam?.physicalExamData).apto`. |
| 7 | `frontend/src/app/portal/workers/page.tsx` (líneas 52, 119) | +~5 / -~4 | Migrar `isApto` a `isAptoFromVerdict`. |
| 8 | `frontend/src/actions/__tests__/medical-exam.actions.test.ts` (test 19 actual línea 402) | +~30 | Actualizar test 19 (espera `'APTO'`). Añadir: acepta los 5 nuevos (`APTO`, `APTO CONDICIONADO`, `APTO CON RESTRICCIONES`, `NO CUMPLE...`, `PENDIENTE DE RESULTADOS`) + acepta legacy `'NO APTO'` (DA-1) + rechaza `'X'`. |

**Total Corte 1:** ~7 archivos (1 nuevo), ~180 / -~25.

### 3.2 Corte 2 — Reporte de aptitud PDF (5 commits)

Depende de: Corte 1 (usa `aptitudLabel`).

| # | Archivo | Líneas estimadas | Cambio |
|---|---|---|---|
| 9 | `frontend/src/lib/clinical/exam-summary.builder.ts` (NUEVO) | +~120 | `buildExamSummary(verdict, exam, studies[], labs[])` → objeto con 9 campos string. Campos 1-5 desde `exam.physicalExamData` (estado_nutricional, agudeza_visual_resumen, salud_bucal, impresion_diagnostica como "EXAMEN MEDICO", presion_arterial_resumen). Campos 6-9 desde `studies/labs[].extractedData` con transformación a texto legible **reutilizando `ClinicalExtractionRenderer`** (audiometría → `resumen_por_oido`/`clasificacion_hipoacusia`; espirometría → `patron`/`fvc_percent_predicho`; RX → `hallazgo`; laboratorio → concatenar analitos out-of-range). Fallback `Pendiente de resultado` si no hay dato. |
| 10 | `frontend/src/lib/clinical/recommendations.builder.ts` (NUEVO) | +~80 | `buildRecommendations(examSummary, studyResults)` → `string[]`. Catálogo de reglas SPEC §2.3 (salud_bucal → odontología; estado_nutricional SOBREPESO/OBESIDAD → hábitos; agudeza DISMINUIDA → optometrista; presion ALTA/BAJA → medicina interna; audiometría hipoacusia → tapones + seguimiento; espirometría restrictivo/obstructivo → ejercicios + EPP; etc.). |
| 11 | `frontend/src/components/pdf/MedicalDictamenPDF.tsx` | +~350 / -~120 | Reemplazo del componente por reporte de aptitud fiel al PDF: header membretado (D4 si P2 aprobada — ver Corte 5), datos del paciente, tabla de 9 campos (labels verbatim: `ESTADO NUTRICIONAL`, `AGUDEZA VISUAL`, `SALUD BUCAL`, `EXAMEN MEDICO`, `PRESION ARTERIAL`, `AUDIOMETRIA`, `ESPIROMETRIA`, `LABORATORIOS`, `RADIOGRAFIA`), bloque "DICTAMEN DE APTITUD" con 5 valores como checklist (uno marcado según `aptitud`), "OBSERVACIONES / COMENTARIOS / RECOMENDACIONES:" con lista numerada, firma "Realizó EM: <nombre> / Ced. Prof.: <cédula>". Paginación con `wrap` hasta 3 hojas. **Eliminar el `JSON.stringify(s.extractedData)` actual (líneas 70-85).** |
| 12 | `frontend/src/app/api/pdf/[eventId]/route.tsx` | +~80 / -~10 | Extender `include` del `prisma.medicalVerdict.findUnique` (línea 16-28) para añadir `event: { include: { exam: true, studies: true, labs: true, worker: { include: { company: true } } } }`. Construir `data` (línea 53-78) con los 9 campos resumen vía `buildExamSummary(verdict, exam, studies, labs)` + recomendaciones vía `buildRecommendations(...)`. Pasar `aptitud` estructurada al componente. |
| 13 | `frontend/src/components/pdf/__tests__/MedicalDictamenPDF.test.tsx` (NUEVO) | +~60 | Snapshot test del PDF con datos de ejemplo: verifica los 9 labels, los 5 valores de aptitud, el bloque de recomendaciones numeradas, la firma. |

**Total Corte 2:** ~5 archivos (3 nuevos), ~690 / -~130.

### 3.3 Corte 3 — Auto-poblamiento dictamen en EventFlowController (3 commits)

Depende de: Corte 2 (usa `buildRecommendations`).

| # | Archivo | Líneas estimadas | Cambio |
|---|---|---|---|
| 14 | `frontend/src/app/events/[id]/_lib/event-page-data.ts` (línea 139) | +~20 / -~2 | Extender carga para incluir `MedicalExam.physicalExamData` (y `somatometryData`, `eyeAcuityData`) en el `serializedVerdict` que se pasa al `EventFlowController`. Añadir al `include` de `prisma.medicalEvent.findUnique` el `exam: true`. |
| 15 | `frontend/src/app/events/[id]/page.tsx` (líneas 212-215) | +~10 / -~2 | Pasar `examSummary` (physicalExamData + studies/labs) al `EventFlowController` además de `verdictData`. |
| 16 | `frontend/src/components/EventFlowController.tsx` (líneas 9-16 props, 108-122 textareas, 56-86 handleSign) | +~60 / -~5 | Extender `EventFlowControllerProps` con `examSummary?: { physicalExamData: Record<string,unknown>, studies: ..., labs: ... }`. Al montar en estado `VALIDATING`: si `verdictData?.finalDiagnosis` está vacío, auto-poblar textarea "Diagnóstico Final" con concatenación `aptitud + impresion_diagnostica + restricciones + observaciones_finales`. Poblar textarea "Recomendaciones" con `buildRecommendations(examSummary, studyResults).map((r,i) => \`${i+1}.- ${r}\`).join(' ')`. Los textareas siguen siendo editables. **No sobrescribir si el médico ya escribió.** |

**Total Corte 3:** ~3 archivos (0 nuevos), ~90 / -~9.

### 3.4 Corte 4 — Preview tabla resumen en pestaña "Impresión y Aptitud" (2 commits)

Depende de: Corte 2 (usa `buildExamSummary`).

| # | Archivo | Líneas estimadas | Cambio |
|---|---|---|---|
| 17 | `frontend/src/components/clinical/ResumenReportePreview.tsx` (NUEVO) | +~90 | Componente de preview de la tabla de 9 campos. Recibe `physicalExamData` + `studyResults` (props) y renderiza la tabla con labels exactos del PDF. Reutiliza `buildExamSummary`. Reactivo: se actualiza al cambiar los campos 1-5 del form y al cambiar `studyResults`. |
| 18 | `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` (sub-tab `impresion`, después del resumen clínico actual ~línea 1450) | +~120 | Renderizar `<ResumenReportePreview>` al final de la sub-tab `impresion`. Pasar `physicalExamData={form}` + `studyResults` (props nuevas del componente padre `PapeletaWorkspace` que ya tiene acceso a los estudios del evento). Botón "Ver preview del reporte" que abre `/api/pdf/<eventId>` en nueva pestaña (solo cuando `hasAptitud && form.impresion_diagnostica`). |

**Total Corte 4:** ~2 archivos (1 nuevo), ~210.

### 3.5 Corte 5 — Membrete "Soluciones" (1 commit, condicionado a P2)

Depende de: **OK Frank P2 (DA-4)**.

| # | Archivo | Líneas estimadas | Cambio |
|---|---|---|---|
| 19 | `frontend/src/components/pdf/MedicalDictamenPDF.tsx` (header, ya tocado en #11) | +~25 / -~5 | Header membretado: logo placeholder + cintillo "Soluciones Médico Empresariales / Medicina Laboral" + línea separadora. |
| 20 | `frontend/public/logo-soluciones-placeholder.svg` (NUEVO) | +~20 | Logo placeholder SVG (mismo patrón que `ARCH-20260630-01` v2 decisión 3 — placeholder hasta logo final de Lety). |

**Total Corte 5:** ~1-2 archivos, ~45 / -~5. **Saltar si P2 rechazada.**

---

## 4. Contratos que cambian

| Contrato | Cambio | Motivo |
|---|---|---|
| `ImpresiónAptitudSchema.aptitud` (`exam.schema.ts:411`) | `z.enum([...4 valores])` → `tolerantZinEnum(5 valores)` (DA-1) | DA-1: alinear al PDF canónico + preservar legacy |
| `ImpresiónAptitudSchema.agudeza_visual_resumen` (`:419`) | `cleanString` → `tolerantZinEnum(3 valores)` | DA-6: enum corto fiel al PDF |
| `ImpresiónAptitudSchema.presion_arterial_resumen` (`:420`) | `cleanString` → `tolerantZinEnum(3 valores)` | DA-6: catálogo ZIN `dllIDPresionArt` |
| Heurística `isApto` (`portal.actions.ts:63`, `portal/events/page.tsx:56`, `portal/workers/page.tsx:52,119`) | `finalDiagnosis.includes('no apto')` → `isAptoFromVerdict(verdict, exam.physicalExamData)` con fallback legacy | DA-1: el nuevo literal "NO CUMPLE..." no contiene "no apto" |
| `MedicalDictamenPDF` props | Añade `aptitud`, `examSummary` (9 campos), `recommendations` ya existente | DA-3/DA-5: reporte fiel al PDF |
| `EventFlowControllerProps` | Añade `examSummary` opcional | DA-2: auto-poblamiento |
| `app/api/pdf/[eventId]/route.tsx` include | Añade `exam: true` | DA-5: cargar physicalExamData para la tabla resumen |

## 5. Contratos protegidos (NO cambiar)

| Contrato | Razón |
|---|---|
| `MedicalVerdict` Prisma model (`finalDiagnosis`, `recommendations`, `validatorId`, `signedAt`, `signatureHash`, `pdfUrl`) | Sin migración Prisma. `aptitud` sigue en `MedicalExam.physicalExamData` JSON. |
| `prisma/schema.prisma` | Restricción Frank: no tocar schema. |
| `saveVerdict(eventId, diagnosis, recommendations, validatorId)` firma (`medical-event.actions.ts:40`) | La firma de la función no cambia; solo cambia cómo se construyen `diagnosis` y `recommendations` (auto-poblados en `EventFlowController`). |
| `signMedicalDictamPDF(eventId)` (`signature.actions.tsx:14`) | La firma digital no cambia; solo el PDF que se firma. |
| `backend/app/services/ai/prediagnostic.py` | La IA no se toca. Se consumen resultados. |
| Flujo clínico canónico (cita → check-in → papeleta → examen → IA → VALIDATING → firma → COMPLETED) | Sin cambios de estado. |
| `ClinicalExtractionRenderer` lógica de parseo | Se **reutiliza** (no se modifica) para `buildExamSummary`. |
| SPEC-01 (DA-1, `tolerantZinEnum`, constantes ZIN) | Esta SPEC es aditiva; no rompe SPEC-01. |

---

## 6. Criterios de aceptación (AC)

Ver SPEC §5 (26 criterios numerados AC-1 a AC-26). Resumen ejecutivo:

**Corte 1 (AC-1 a AC-8):** enum aptitud 5 valores + DA-1 legacy + 2 selects resumen + heurística portal migrada con fallback. **Validación Playwright:** `/portal/workers` con dictamen "NO CUMPLE..." muestra badge "No Apto".

**Corte 2 (AC-9 a AC-15):** PDF con 9 labels exactos + 5 valores aptitud checklist + recomendaciones numeradas + firma + paginación + include `exam`. **Validación:** `curl /api/pdf/<eventId> | pdftotext | grep 'ESTADO NUTRICIONAL'` devuelve 1.

**Corte 3 (AC-16 a AC-19):** textareas auto-poblados en VALIDATING + editables + `saveVerdict` persiste tal cual. **Validación Playwright:** VALIDATING → textarea "Diagnóstico Final" contiene literal aptitud + impresión diagnóstica.

**Corte 4 (AC-20 a AC-22):** preview tabla 9 campos en vivo + campos 6-9 `Pendiente de resultado` si no hay IA. **Validación Playwright:** capturar `estado_nutricional = SOBREPESO` → preview muestra `ESTADO NUTRICIONAL: SOBREPESO`.

**Corte 5 (AC-23, condicionado):** header membretado. **Validación:** `pdftotext | grep 'Soluciones Médico Empresariales'` devuelve 1.

**Global (§5.7):** Playwright E2E flujo completo cita → … → firma → descarga PDF → verificar membrete + 9 campos + aptitud marcada + recomendaciones + firma.

**No-regresión (§5.8, AC-24 a AC-26):** `prediagnostic.py` sin cambio; portal lista dictámenes OK; legacy `finalDiagnosis.includes('no apto')` sin `aptitud` estructurada sigue clasificando no-apto.

---

## 7. Casos borde

| Caso | Comportamiento esperado |
|---|---|
| Registro legacy con `aptitud = 'NO APTO'` | Carga sin error (DA-1). El botón "NO APTO" ya no existe en la UI nueva; el valor legacy se muestra como texto en el preview pero el médico debe re-seleccionar uno de los 5 nuevos al editar. |
| Registro legacy con `aptitud = 'NO APTO'` y `finalDiagnosis` que contiene `'no apto'` | Portal lo clasifica como no-apto vía fallback legacy (AC-8). |
| Dictamen con `aptitud = 'NO CUMPLE CON LOS CRITERIOS...'` | Portal lo clasifica como no-apto vía `aptitud` estructurada (AC-7). **NO** debe clasificarse como apto por bug de heurística. |
| Estudio IA sin `extractedData` todavía | Campo 6-9 de la tabla resumen muestra `Pendiente de resultado`. |
| `verdictData.finalDiagnosis` ya tiene contenido (médico escribió manualmente) | `EventFlowController` NO sobrescribe. Solo auto-puebla si está vacío. |
| `physicalExamData` vacío (examen no guardado) | Auto-poblamiento de textareas produce strings vacíos o `Pendiente`. El médico completa manualmente. |
| PDF con contenido > 1 página | Paginación con `wrap` hasta 3 hojas (T-5.10). Si excede 3, truncar con nota "Ver expediente completo". |
| Catálogo D3 no genera recomendación para un hallazgo | Textarea de recomendaciones queda vacío o con placeholder. El médico agrega manualmente. |
| Logo "Soluciones" final no disponible (Corte 5) | Placeholder SVG. Lety confirmará logo final en iteración posterior. |
| Médico en estado `IN_PROGRESS` (no `VALIDATING`) | `EventFlowController` retorna `null` (línea 39-41 actual). El auto-poblamiento NO aplica. |

---

## 8. Validaciones detectadas (comandos)

| Gate | Comando | Salida esperada |
|---|---|---|
| Typecheck | `pnpm typecheck` (desde `frontend/`) | 0 errores |
| Tests unitarios | `pnpm test --run` (desde `frontend/`) | Todos pasan (incluye nuevos tests aptitud enum + DA-1 + builder + PDF snapshot) |
| Lint | `pnpm lint` (desde `frontend/`) | 0 errores nuevos |
| PDF válido | `curl -s http://localhost:3000/api/pdf/<eventId> -o /tmp/dictamen.pdf && pdftotext -layout /tmp/dictamen.pdf - \| grep -c 'ESTADO NUTRICIONAL'` | `1` |
| Membrete (si P2) | `pdftotext -layout /tmp/dictamen.pdf - \| grep -c 'Soluciones Médico Empresariales'` | `1` |
| No-regresión IA | `curl -s http://localhost:8000/api/v2/studies/upload-and-analyze` con estudio de prueba | `extractedData` presente (sin cambio backend) |

**Playwright E2E:** `frontend/tests/flujo-completo.spec.ts` — extender el TC-12 (dictamen) para verificar auto-poblamiento + descarga PDF con 9 campos.

---

## 9. Dependencias

- **Baseline `1467d4f`** (SPEC-01 corte 1 verde). Verificar al empezar.
- **`@react-pdf/renderer`** ya en `package.json` (lo usa `MedicalDictamenPDF` actual y `pdf-generator.tsx` demo). No añadir dependencia.
- **`ClinicalExtractionRenderer`** existente para transformar `extractedData` → texto legible. Verificar su API antes de usarlo en `buildExamSummary`.
- **OK Frank P1** para Corte 1. **OK Frank P2** para Corte 5.

---

## 10. DoD

- [ ] Los 18-19 commits (Corte 5 condicionado) están en `main` tras OK Frank + revisión GEMINI.
- [ ] `pnpm typecheck` → 0 errores.
- [ ] `pnpm test --run` → todos pasan.
- [ ] `pnpm lint` → 0 errores nuevos.
- [ ] Playwright E2E del flujo clínico completo (cita → … → firma → descarga PDF) pasa.
- [ ] `pdftotext` del PDF generado contiene los 9 labels exactos, "DICTAMEN DE APTITUD", recomendaciones numeradas, firma.
- [ ] Portal clasifica apto/no-apto/pendiente con heurística migrada (AC-7, AC-8).
- [ ] `prediagnostic.py` sin cambio (AC-24).
- [ ] GEMINI audit aprobado (con o sin observaciones, sin bloqueadores).
- [ ] PROYECTO.md actualizado por CRONISTA con estado DONE y referencia a esta SPEC.
- [ ] Publicación a producción requiere permiso separado (NO incluido).

---

## 11. Decisiones resueltas (resumen para SOFIA)

| ID | Decisión | Estado |
|---|---|---|
| DA-1 | Enum aptitud 5 valores PDF + `PENDIENTE` + DA-1 tolerante + migrar heurística portal | ⚠️ **Espera OK Frank P1** |
| DA-2 | Auto-poblamiento dictamen desde pestaña Impresión/Aptitud (no pisa edición manual) | ACEPTADO |
| DA-3 | Reemplazo `MedicalDictamenPDF` por reporte fiel al PDF canónico | ACEPTADO |
| DA-4 | Membrete "Soluciones" como header del PDF | ⚠️ **Espera OK Frank P2** |
| DA-5 | Tabla 9 campos: AMBOS orígenes (manual + IA), en vivo, congelado al firmar | ACEPTADO |
| DA-6 | `agudeza_visual_resumen` + `presion_arterial_resumen` a enums cortos | ACEPTADO |
| DA-7 | Recomendaciones: catálogo MIXTO + edición + lista numerada | ACEPTADO |
| DA-8 | Nota médica, certificado, tipo consulta, incapacidad → FUERA DE ALCANCE | ACEPTADO |

---

## 12. Preguntas abiertas a Frank (INTEGRA gestiona, SOFIA no pregunta directo)

**P1 (DA-1, bloquea Corte 1):** ¿Apruebas cambiar el enum de `aptitud` a los 4 literales del PDF de referencia (`APTO` / `APTO CONDICIONADO` / `APTO CON RESTRICCIONES` / `NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO`) + conservar `PENDIENTE DE RESULTADOS` como 5ª opción operativa, con DA-1 tolerante para registros legacy con `NO APTO`? (Esto requiere migrar la heurística `includes('no apto')` del portal a leer `aptitud` estructurada, con fallback legacy.)

**P2 (DA-4, bloquea Corte 5; Cortes 2-3-4 pueden proceder sin ella):** ¿Apruebas membrete como **header** (logo placeholder + cintillo "Soluciones Médico Empresariales / Medicina Laboral") aplicado **solo al reporte de aptitud** en esta SPEC? ¿O prefieres watermark / pie / aplicar también a nota médica y certificado (que abriría scope a SPECs separadas)?

---

## 13. Prohibido inferir

- SOFIA NO debe inventar literales de aptitud fuera de los 5 del SPEC.
- SOFIA NO debe implementar nota médica, certificado, tipo de consulta ni incapacidad (DA-8, fuera de alcance).
- SOFIA NO debe tocar `prisma/schema.prisma` ni `prediagnostic.py`.
- SOFIA NO debe commitear/pushear sin OK explícito de Frank.
- SOFIA NO debe sobrescribir un `finalDiagnosis` que el médico ya editó manualmente (DA-2: solo auto-poblar si vacío).
- SOFIA NO debe usar `agent_manager` para delegar; usar `task` con `subagent_type='gemini'` para segunda mano de validación.
- SOFIA NO debe reportar "listo" sin ejecutar gates tras cada commit.

---

## 14. Orden de ejecución recomendado

1. **Verificar baseline `1467d4f`**: `pnpm typecheck && pnpm test --run` desde `frontend/`. Reportar si no está verde.
2. **Esperar OK Frank P1** (DA-1). Si no llega, reportar `BLOCKED (espera-F-rank)` y NO empezar Corte 1.
3. **Corte 1 completo** (8 commits). Gates tras cada commit. Playwright heurística portal (AC-7, AC-8).
4. **Pausa OK Frank** (opcional — Frank puede aprobar continuar directo a Corte 2).
5. **Corte 2 completo** (5 commits). Gates + curl + snapshot (AC-9 a AC-15).
6. **Corte 3 completo** (3 commits). Gates + Playwright VALIDATING (AC-16 a AC-19).
7. **Corte 4 completo** (2 commits). Gates + Playwright preview en vivo (AC-20 a AC-22).
8. **Si P2 aprobada: Corte 5** (1 commit). Validación membrete (AC-23).
9. **GEMINI auditoría** vía `task` con `subagent_type='gemini'`.
10. **Reporte final a INTEGRA** con `READY_FOR_VERIFYING` + evidencia (gates, Playwright, curl, snapshots).

---

**Firmado:** INTEGRA — 2026-08-17 CST
**Espera:** OK Frank P1 (DA-1) y P2 (DA-4) antes de delegar. Corte 1 bloqueado por P1; Cortes 2-3-4 pueden proceder tras P1 sin P2; Corte 5 bloqueado por P2.
