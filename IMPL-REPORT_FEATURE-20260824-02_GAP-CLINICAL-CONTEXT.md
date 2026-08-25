# IMPL-REPORT — FEATURE-20260824-02 — Gap fix: propagación de clinical_context al prediagnóstico IA

- **ID intervención:** IMPL-20260824-02-gap-01
- **ID tarea:** FEATURE-20260824-02 (segundo pase — gap fix)
- **Estado:** READY_FOR_VERIFYING
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md`
- **Origen:** ATLAS (instrucción explícita del operador tras IMPL inicial)
- **IMPL previo:** `IMPL-REPORT_FEATURE-20260824-02.md` (frontend + persistencia + UI modal)

## Resumen

Se corrige el gap detectado: `PapeletaWorkspace.handleFileUpload` adjuntaba
`clinical_context` al FormData de `uploadEventTestFile`, pero el server
action `triggerStudyAIAnalysis` NO lo reenviaba al `uploadForm` que llama
`/api/v2/studies/upload-and-analyze`, y el backend Python NO lo leía. El
cuestionario nunca llegaba a MedGemma/DR7.

Cambios:

1. **Frontend** — `triggerStudyAIAnalysis` ahora lee `clinical_context`
   del FormData de entrada, lo valida defensivamente (JSON válido +
   objeto + `schemaVersion` conocido + Zod schema) y lo reenvía al
   `uploadForm` como string JSON. La validación es tolerante: si el
   payload está ausente o no es válido, se omite sin romper el upload
   (compat con FEATURE-20260824-02 AC-6 y con callers legacy).
2. **Backend** — `/api/v2/studies/upload-and-analyze` acepta el campo
   opcional `clinical_context` (Form), lo parsea defensivamente y lo
   pasa al flujo de prediagnóstico clínico como nuevo kwarg
   `clinical_context` de `PrediagnosticService.generate_prediagnosis`.
   El contexto NUNCA se reenvía a la capa extractiva M3 (la
   extracción sigue siendo puramente documental).
3. **Prediagnóstico** — `generate_prediagnosis` inyecta el cuestionario
   al prompt de MedGemma/DR7 como bloque delimitado
   `=== CONTEXTO CLÍNICO ===` con instrucciones explícitas: usar como
   contexto corroborante, NO inventar respuestas ausentes, NO sustituir
   los parámetros extraídos del documento. El bloque se omite por
   completo si `clinical_context` está ausente o no es válido
   (preservando el comportamiento pre-FEATURE-20260824-02 al 100%).
4. **Trazabilidad** — el audit del snapshot (`extraction_snapshot.audit`
   + `prediagnosis_snapshot.audit`) lleva
   `clinical_context_schema_version` y `clinical_context_present` cuando
   el contexto fue inyectado. El payload NO se duplica en el snapshot
   (vive en `EventTest.clinicalContext`).
5. **Tests** — 9 tests frontend (reenvío + audit + compat) +
   12 tests backend (helper puro + firma compat + ausencia/presencia
   + payloads inválidos). 100% verdes.

## Archivos modificados

- `frontend/src/actions/ai-prediagnosis.actions.ts`:
  - Import de `EspirometriaQuestionnairePayloadSchema` y
    `ESPIROMETRIA_QUESTIONNAIRE_SCHEMA_VERSION`.
  - Helper puro `extractAndValidateClinicalContext(formData)`:
    parsea JSON, exige objeto, exige `schemaVersion` conocido y Zod
    válido. Logs warn sin PII ante fallos.
  - `uploadForm` recibe `clinical_context` cuando el helper devuelve
    payload válido.
  - `mergedExtractionAudit` y `mergedPredxAudit` ahora llevan
    `clinical_context_schema_version` cuando el contexto fue reenviado.
- `backend/app/main.py`:
  - Parámetro nuevo `clinical_context: Optional[str] = Form(default=None)`
    en `v2_upload_and_analyze`.
  - Parseo defensivo del JSON: si no es válido o no es objeto, se
    omite con log warn (sin propagar al cliente — FEATURE-20260824-02
    AC-4).
  - `parsed_clinical_context` se pasa como kwarg `clinical_context` a
    `prediagnostic_svc.generate_prediagnosis(...)`.
  - Audit del `prediagnosis_snapshot.audit` incluye
    `clinical_context_schema_version` y `clinical_context_present: true`
    cuando el contexto fue inyectado (consistente con el frontend).
- `backend/app/services/ai/prediagnostic.py`:
  - Helper puro `_render_clinical_context_block(clinical_context)`:
    renderiza el bloque delimitado con instrucciones anti-injection;
    devuelve `""` para entradas inválidas.
  - `PrediagnosticService.generate_prediagnosis` acepta kwarg
    opcional `clinical_context`. Compat retroactiva: callers sin el
    kwarg siguen funcionando idénticamente.
  - El bloque se inyecta al prompt DESPUÉS del `{extracted_json}`,
    con instrucciones explícitas para MedGemma/DR7.
  - `result.limitations` documenta la inyección del cuestionario con
    su `schemaVersion`.

## Archivos nuevos (tests)

- `frontend/src/actions/__tests__/ai-prediagnosis.clinical-context.test.ts`:
  9 tests V1 (payload ausente, payload válido, JSON inválido, no-objeto,
  schemaVersion futura, Zod inválido, audit presente/ausente, compat
  legacy).
- `backend/tests/test_clinical_context_propagation.py`: 12 tests V1
  (helper puro, firma compat, sin contexto, con contexto, sin
  schemaVersion, schemaVersion futura, no PII duplicada).

## Contratos

- **No se creó nueva migración Prisma.** La columna `clinicalContext`
  añadida en el IMPL previo es suficiente y coherente con el schema
  Prisma actual (verificado con `npx prisma validate` → "schema is
  valid").
- **No se cambió extracción M3 / prompts AMI / repetibilidad / modo
  sombra / revisión médica / otros estudios.** El contexto sólo se
  inyecta en el prompt del prediagnóstico clínico (capa MedGemma/DR7).
- **No se inventan ausentes.** Si el cuestionario omite una pregunta,
  el modelo NO debe rellenarla — está protegido por instrucciones
  explícitas en el bloque y por el guardrail preexistente del modelo
  clínico (lenguaje obligatorio "compatible con", "sugiere",
  "requiere correlación clínica").
- **No se duplica PII.** El cuestionario por contrato sólo trae
  antecedentes respiratorios + exploración física (sin nombre, sin
  empresa, sin RFC, sin CURP, sin número de trabajador). Verificado
  en el helper backend con un test específico
  `test_no_duplica_pii_del_encabezado`.
- **Payload ausente → comportamiento idéntico al pre-FEATURE-20260824-02.**
  El bloque no aparece en el prompt y `clinical_context_schema_version`
  no aparece en el audit.

## Validación

- **typecheck (frontend):** PASS — único error residual en
  `EspirometriaClinicalCriteriaPanel.test.ts:1545` (regex flag `d`),
  preexistente en `main` (verificado con `git stash` en el IMPL previo).
- **vitest focal (frontend):** PASS — 884/884 tests pasan (incluye 9
  nuevos del gap + 29 del IMPL previo + 846 preexistentes). Excluye
  `medical-exam.actions.test.ts` que tiene 15 fallos preexistentes en
  `main` no relacionados con este incremento.
- **vitest focal (backend):** PASS — 12/12 tests nuevos del gap + 23
  tests preexistentes de prediagnóstico pasan. Total: 35/35 en el
  subset `prediagnost or clinical_context or signature`.
- **prisma validate:** PASS — `npx prisma validate` con `DATABASE_URL`
  dummy reporta `The schema at prisma/schema.prisma is valid`.
- **Sintaxis Python:** PASS — `python3 -c "ast.parse(...)"` verde para
  `main.py` y `prediagnostic.py`.
- **Sin regresión en prompts AMI / extracción M3 / repetibilidad:** los
  tests del IMPL previo (EspirometriaClinicalCriteriaPanel, criterios
  AMI) siguen pasando — no se tocó `clinical_criteria` ni
  `extraction_prompt`.

## Trazabilidad AC (gap fix)

- **AC-7 (IA recibe el contexto cuando está guardado, sin inventar
  ausentes):** el gap era exactamente que el contexto no llegaba a la
  IA. Ahora el frontend lo reenvía al `uploadForm`, el backend lo
  inyecta al prompt del prediagnóstico clínico y el helper incluye
  instrucciones anti-injection explícitas. Test:
  `ai-prediagnosis.clinical-context.test.ts > "payload presente y
  válido → se reenvía como JSON string serializado"` + tests backend
  `TestClinicalContextPresent`.
- **AC-6 (PDF puede cargarse sin cuestionario, IA recibe advertencia de
  contexto incompleto):** preservado. Payload ausente → el helper
  devuelve `null` → el `uploadForm` no lleva `clinical_context` → el
  backend omite el bloque del prompt. Test:
  `"payload ausente → NO se adjunta clinical_context al FormData del
  backend (AC-6)"` + `"sin_clinical_context_prompt_no_contiene_bloque"`.
- **AC-4 (payload inválido es rechazado server-side con error visible):**
  preservado. La validación Zod en el server action de guardado
  (`saveEspirometriaQuestionnaire`) sigue siendo la fuente de verdad
  del snapshot. El helper de reenvío es defensa en profundidad: si
  el payload se manipula entre el guardado y el reenvío, se omite
  silenciosamente sin romper el upload.

## Riesgos y desviaciones

- **Riesgo bajo:** el backend Python acepta cualquier schemaVersion
  string (forward-compatible). Si en el futuro llega un payload con
  `schemaVersion="espirometria-questionnaire-v2"` que cambia el shape,
  el backend lo renderiza pero el LLM puede no entender la nueva
  estructura. **Mitigación:** el frontend YA valida contra la versión
  actual (`espirometria-questionnaire-v1`); cuando se publique v2, se
  actualizará el frontend primero y luego el backend. Mientras tanto,
  el bloque se documenta en `limitations` con la versión exacta.
- **Sin desviaciones de alcance.** No se tocó M3, AMI, repetibilidad,
  modo sombra, revisión médica, otros estudios, criterios clínicos.
- **Próximo paso opcional** (no parte de esta entrega): considerar
  exponer también el contexto en `/api/v2/studies/prediagnosis-from-params`
  (ruta usada por formularios estructurados como Somatometría /
  Examen Médico). Esta integración es trivial — añadir el kwarg en
  `triggerStructuredStudyAIPrediagnosis` y un parámetro opcional en
  `prediagnosis-from-params` — pero queda fuera del scope del gap
  actual y debe proponerse vía SPEC/ADR si se requiere.

## Requiere GEMINI

No (este gap fix es de integración mecánica sin cambio de contrato
público de IA; la integración queda en una capa opcional del prompt).
Si el operador requiere V3 Playwright del flujo clínico end-to-end,
se puede activar como parte del gate final FEATURE-20260824-02.

## Requiere DEBY

No. Sin bugs reproducibles.

## Pendientes ATLAS

- Aceptación contractual del gap fix (reenvío + inyección).
- Decisión sobre si promover la integración también a
  `/api/v2/studies/prediagnosis-from-params` (ruta de formularios
  estructurados). Si sí, nueva propuesta de SPEC/ADR.

## Estado devuelto a ATLAS

**READY_FOR_VERIFYING**
