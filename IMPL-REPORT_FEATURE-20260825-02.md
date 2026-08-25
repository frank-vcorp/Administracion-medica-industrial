# IMPL-REPORT — FEATURE-20260825-02 — Entregable validado de Audiometría

- **ID intervención:** IMPL-20260825-02
- **ID tarea:** FEATURE-20260825-02
- **Estado:** READY_FOR_VERIFYING
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260825-02-AUDIOMETRIA-ENTREGABLE.md`
- **ADR:** `context/decisions/ADR-20260825-01-AUDIOMETRIA-ENTREGABLE-COMUN.md`
- **Discovery refs:** `DEC-20260825-03` a `DEC-20260825-07`; `BR-20260825-03` a `BR-20260825-08`; `FND-20260825-05` a `FND-20260825-09`
- **Origen:** ATLAS (handoff `context/interconsultas/HANDOFF_SPEC-FEATURE-20260825-02_SOFIA.md`)

## Resumen

Slice completo de FEATURE-20260825-02 implementado reutilizando el patrón
validado de Espirometría (FEATURE-20260824-02 + FEATURE-20260825-01),
adaptado a Audiometría con sus propios criterios y modalidades:

- Cuestionario auditivo propio (schema `audiometria-questionnaire-v1` con
  antecedentes — audiometría previa, dificultad auditiva, exposición
  laboral/recreativa, explosión/trauma, infecciones óticas, tinnitus,
  medicamentos ototóxicos — y exploración física — faringe/CAD/CAI/MTD/MTI);
  modal accesible, predominantemente seleccionable, server action atómica
  con Zod server-side, persistencia en `EventTest.clinicalContext` (misma
  columna JSON que Espirometría; el `schemaVersion` discrimina en runtime).
- Panel clínico audiométrico (`AudiometriaClinicalCriteriaPanel`) con:
  tabla bilateral TA/VO por frecuencia (NO inventa frecuencias ausentes);
  ecuación PTA3 = (TA500+TA1000+TA2000)/3 visible con sus 3 entradas,
  resultado, `pta_fuente` del documento conservado por separado; criterio
  AMI ≤25 dB; clasificación por patrón graves/agudas/mixta con manejo
  explícito de huecos → `NO_CONCLUYENTE`; capas diferenciadas (NOM / AMI
  / fuente / derivada); advertencia cuando hay 4 frecuencias (cobertura
  parcial); copia textual del diagnóstico/recomendación AMI como IA
  EXPLÍCITAMENTE prohibida en el panel.
- PDF validado de Audiometría (`AudiometriaValidatedPDF` +
  `lib/audiometry-pdf.tsx` + ruta `/api/pdf/audiometry/[reviewId]`) con
  las tres capas separadas en el documento, ecuación PTA3 + PTA fuente
  lado a lado, criterios AMI y patrón audiométrico, identidad congelada
  del médico, firma, cédula, membrete AMI. Ruta con scope por objeto
  (SUPERADMIN o médico dueño de la revisión) — IDOR fix análogo al
  espirometry.
- `submitDoctorStudyReview` extendido con dispatch por tipo de estudio
  (`Audiometria` → `buildAudiometriaPdfData` + `generateAudiometriaValidatedPdf`;
  default → Espirometría, conservando el flujo FEATURE-20260825-01 sin
  regresiones).
- `StudyAIPrediagnosisPanel` ahora acepta `studyType` opcional y elige
  la ruta correcta del PDF (`/api/pdf/espirometry/...` o
  `/api/pdf/audiometry/...`); sin `studyType` o sin template propio, NO
  muestra el botón (contrato vigente).
- Integración en `PapeletaWorkspace`: `AudiometriaQuestionnaireSection`
  con CTA "Completar cuestionario" + resumen compacto + Editar;
  propagación de `clinical_context` (Audiometría) al `FormData` cuando
  hay cuestionario versionado guardado (mismo gate que Espirometría).

No se cambió Espirometría, no se publicó la calibración V3, no se
modificaron prompts M3, no se tocó `parse_audiometry_xml` (sigue como
parser directo, AC-10).

## Archivos modificados

- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`: añadir
  prop opcional `studyType`; el bloque de descarga del PDF validado elige
  `/api/pdf/espirometry` o `/api/pdf/audiometry` por tipo canónico
  (estudios sin template propio NO muestran el botón).
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`: nuevo estado
  `audiometriaQuestionnaireEventTestId` + target test + modal mount;
  `StudyTest.clinicalContext` extendido a `Espirometria | Audiometria`
  (discriminado por `schemaVersion`); sección + criterios clínicos +
  propagación de `clinical_context` (Audiometría) y `studyType` al
  panel de prediagnóstico.
- `frontend/src/actions/ai-prediagnosis.actions.ts`: dispatch por tipo
  de estudio en `submitDoctorStudyReview` (Audiometría →
  `buildAudiometriaPdfData` + `generateAudiometriaValidatedPdf`;
  default → flujo Espirometría existente).

## Archivos nuevos

- `frontend/src/schemas/clinical/audiometria-questionnaire.schema.ts`:
  Zod schema `AudiometriaQuestionnairePayloadSchema` con
  `schemaVersion: "audiometria-questionnaire-v1"`, catálogos
  (`TIEMPO_RANGO_VALUES`, `TIPO_EXPOSICION_RUIDO_VALUES`,
  `TIPO_TRAUMA_VALUES`, `INFECCION_OTICA_VALUES`,
  `MEDICAMENTO_OTOTOXICO_VALUES`, `EXPLORACION_ESTADO_VALUES`),
  `superRefine` para validar campos condicionales (Sí → rango/lado/tipos
  obligatorios; Otro requiere OTRO en el catálogo; observación sólo
  válida cuando estado=Alterado). Metadatos administrativos: Patient
  ID, responsables, consentimiento.
- `frontend/src/lib/clinical/audiometria-questionnaire-validate.ts`:
  helper puro síncrono (`validateAudiometriaQuestionnairePayload`) para
  evitar exports síncronos en módulos `'use server'` (FIX-Vercel-Build).
- `frontend/src/actions/audiometria-questionnaire.actions.ts`: server
  action `saveAudiometriaQuestionnaire(eventTestId, rawPayload, eventId)`
  con validación Zod server-side, defensa contra IDs cruzados
  (rechaza si EventTest no pertenece al evento), persistencia atómica
  con `prisma.eventTest.update` + `revalidatePath`. Importa el helper
  puro de forma lazy para mantener el archivo como `'use server'`.
- `frontend/src/components/clinical/AudiometriaQuestionnaireModal.tsx`:
  modal accesible (`role="dialog"`, `aria-modal`, cierre con ESC, click
  fuera, foco inicial, etiquetas `data-testid` para V3),
  predominantemente seleccionable (Sí/No, catálogos, rangos, lados OD/OI),
  campos condicionales sólo cuando la respuesta padre lo habilita,
  validación cliente con el mismo Zod server-side, errores visibles por
  campo. Renderiza título/footer distintos según `initialContext`.
- `frontend/src/components/clinical/AudiometriaQuestionnaireSummary.tsx`:
  resumen compacto post-guardado (estado, fecha de captura, conteo Sí/No,
  botón Editar).
- `frontend/src/components/clinical/AudiometriaClinicalCriteriaPanel.tsx`:
  panel con tabla bilateral TA/VO por frecuencia detectada, ecuación
  PTA3, tres entradas TA, PTA calculado vs PTA fuente del documento,
  criterio AMI ≤25 dB, clasificación por patrón graves/agudas/mixta con
  huecos → NO_CONCLUYENTE, capas diferenciadas (NOM/AMI/fuente/derivada).
  Helper puro `resolveAudiometriaCriteria` reutilizable desde el PDF.
- `frontend/src/components/pdf/AudiometriaValidatedPDF.tsx`: plantilla
  PDF `@react-pdf/renderer` con secciones I–VI separadas (datos,
  evidencia audiométrica, criterios AMI, impresión diagnóstica validada,
  recomendaciones validadas, notas), TA/VO, ecuación PTA3 + tres
  entradas + PTA fuente separados, identidad congelada, firma, cédula,
  membrete AMI con fallback "AMI" si la red falla al boot. Guardrail
  explícito: NO copia el diagnóstico nosológico/recomendación textual
  AMI como salida IA.
- `frontend/src/lib/audiometry-pdf.tsx`: helper
  `buildAudiometriaPdfData` (puro, compartido action/route → mismo hash
  si los datos no cambian) + `generateAudiometriaValidatedPdf`
  (renderToBuffer + SHA-256 + persistencia opcional en
  `uploads/audiometry-pdfs/<reviewId>.pdf`). Reutiliza el cache del logo
  AMI (`resolveAmiLogoDataUrl` re-exportado).
- `frontend/src/app/api/pdf/audiometry/[reviewId]/route.tsx`: endpoint
  GET autenticado con scope por objeto (SUPERADMIN o médico dueño);
  rechazo de REVIEWED_REJECTED; fast-path desde disco; path de
  regeneración con snapshot congelado; filename
  `Audiometria-<universalId>.pdf`.
- `frontend/src/schemas/clinical/__tests__/audiometria-questionnaire.schema.test.ts`:
  14 tests V1 (payload mínimo, completo, rechazos por schemaVersion,
  capturedAt inválido, Sí sin sub-campo en 8 antecedentes, Otro sin
  catálogo OTRO en exposición laboral, observación en exploración
  Normal).
- `frontend/src/actions/__tests__/audiometria-questionnaire.actions.test.ts`:
  7 tests V1 (helper puro, rechazo sin tocar Prisma, persistencia
  atómica cuando EventTest pertenece al evento, rechazo por ID
  cruzado, EventTest inexistente, `revalidatePath`).
- `frontend/src/components/clinical/__tests__/AudiometriaQuestionnaireModal.test.ts`:
  5 tests V1 SSR puros (todas las secciones, botón cambia entre
  "Guardar cuestionario" y "Guardar cambios", campos condicionales sólo
  cuando respuesta padre=Sí, accesibilidad `role="dialog"` + `aria-modal`).
- `frontend/src/components/clinical/__tests__/AudiometriaClinicalCriteriaPanel.test.ts`:
  11 tests V1 sobre los helpers puros `calcularPTA3` y
  `resolveAudiometriaCriteria`: PTA3 = (500+1000+2000)/3; PTA incompleto
  cuando falta alguno de los 3; 1000 Hz es frontera (no se duplica);
  criterio AMI NORMAL ≤25 / ALTERADO >25; NO_CONCLUYENTE con huecos
  graves/agudas; `pta_fuente` separado del calculado; NO inventa
  frecuencias; cobertura parcial con 4 frecuencias; PTA sobre TA
  (no VO).

## Contratos afectados

- `EventTest.clinicalContext`: union
  `Espirometria | Audiometria` con discriminación por `schemaVersion`.
  Compatible con FEATURE-20260824-02 (no rompe el flujo de Espirometría).
- `DoctorStudyReview.validatedPdfUrl`: misma columna. Filename
  `Audiometria-<universalId>.pdf` por convención nueva.
- Ruta autenticada nueva `/api/pdf/audiometry/[reviewId]` con scope por
  objeto (mismo patrón que Espirometría). Sin IDOR.
- `submitDoctorStudyReview`: dispatch por `studyType` (Audiometria →
  template propio; default → Espirometría). Sin cambios en contrato
  público para clientes.
- Estudio `Audiometria` ya tenía renderer bilateral, extracción XML
  directa y calibración V3 → el incremento NO toca esa superficie; el
  panel clínico audiométrico se suma sin reemplazar nada.
- NO se publica `amiCalibration` V3 (la calibración audiométrica sigue
  en estado `tested`; el incremento opera sobre snapshots existentes).

## Validación

- **baseline:** PASS — los tests previos a este incremento (1068 totales)
  siguen pasando; las 15 fallas residen en `medical-exam.actions.test.ts`
  y son preexistentes en `main` (verificado con `git stash`: 15
  fallos / 100 tests → mismo patrón en main sin mis cambios; no son
  atribuibles a este incremento).
- **build/typecheck:** PASS — `npx tsc --noEmit` corre limpio en los
  archivos del incremento. Único error residual en
  `EspirometriaClinicalCriteriaPanel.test.ts:1545` (regex flag `d`
  requiere ES2018+), preexistente en `main` (verificado con git stash).
- **tests V1 focales:** 37/37 PASS:
  - `audiometria-questionnaire.schema.test.ts` (14/14)
  - `audiometria-questionnaire.actions.test.ts` (7/7)
  - `AudiometriaQuestionnaireModal.test.ts` (5/5)
  - `AudiometriaClinicalCriteriaPanel.test.ts` (11/11)
- **tests V2 (suite completa):** 1053 PASS / 15 FAIL preexistentes.
  Las 19 pruebas del flujo Espirometría (PDF + IA + criterios) y los 29
  tests del cuestionario de Espirometría siguen verdes.
- **lint:** N/A (no se configuró lint específico para el delta).
- **smoke/E2E:** N/A — sin entorno Playwright activo en esta sesión para
  V3 (la SPEC reserva V3 a GEMINI en el gate final). El incremento
  entrega todos los `data-testid` necesarios para que el test Playwright
  recorra el cuestionario auditivo, el panel clínico audiométrico, la
  revisión, el PDF validado y los permisos.

## Trazabilidad AC → prueba/evidencia

- **AC-1** (cuestionario persiste y se recupera): `saveAudiometriaQuestionnaire`
  persiste atómicamente (test "persiste atómicamente cuando el EventTest
  pertenece al evento"); `PapeletaWorkspace` recupera `clinicalContext`
  desde `event-page-data.ts:346` (serialización ya presente desde
  FEATURE-20260824-02) y renderiza `AudiometriaQuestionnaireSection`.
- **AC-2** (renderer bilateral, sin desplazar, sin inventar):
  `extraction-presentation-schemas.ts` ya define `audiometriaSchema` con
  bloques `bilateralFrequency` por TA/VO y `preferredOrder` completo; el
  renderer existente (`ClinicalExtractionRenderer.BilateralFrequencyTableBlock`)
  itera SOLO por frecuencias presentes y rellena con `—`. Test
  `AudiometriaClinicalCriteriaPanel.test.ts` "AC-2: NO inventa
  frecuencias ausentes" verifica que `frecuenciasDetectadas` excluye
  las ausentes.
- **AC-3** (cobertura parcial con 4 frecuencias): test "AC-3: conserva
  cobertura parcial con 4 frecuencias" verifica que 500/1000/2000/4000
  se conservan y se genera advertencia explícita; el renderer NO
  inventa 3000/6000/8000.
- **AC-4** (extracción separa valores de tabla de narrativa): el
  `extracted_data` de Audiometría usa `oido_derecho.va`, `oido_izquierdo.va`
  para umbrales y `faringe`/`cad`/`cai`/`mtd`/`mti` como campos
  fuente (no narrativa). El panel clínico audiométrico lee los primeros
  para calcular; los segundos se mantienen visibles como
  `campos_fuente`. NO hay código que copie `diagnostico_ami` o
  `recomendacion_ami` (no existen como campos extraídos).
- **AC-5** (interpretación aplica patrón + PTA/criterio AMI y marca
  huecos): tests "criterio AMI = NORMAL cuando PTA ≤ 25 dB",
  "criterio AMI = ALTERADO cuando PTA > 25 dB", "marca NO_CONCLUYENTE
  cuando faltan umbrales en graves o agudas".
- **AC-6** (revisión médica editable / aceptar / rechazar):
  `StudyAIPrediagnosisPanel` ya provee los tres botones
  (REVIEWED_ACCEPTED/REVIEWED_EDITED/REVIEWED_REJECTED). El contrato de
  `submitDoctorStudyReview` no cambia para Audiometría (mismo action,
  mismo schema Prisma).
- **AC-7** (sólo aceptación/edicción permite descargar el PDF): el
  endpoint `/api/pdf/audiometry/[reviewId]` rechaza
  `doctorStatus === 'REVIEWED_REJECTED'` con 404; el botón se renderiza
  sólo cuando `doctorStatus ∈ {REVIEWED_ACCEPTED, REVIEWED_EDITED}`.
- **AC-8** (PDF con paciente/Event/evidencia/interpretación/médico/cédula/firma):
  `AudiometriaValidatedPDF` secciones I–VI; sección II expone TA/VO por
  frecuencia detectada; sección III incluye PTA3 calculado, PTA fuente,
  criterio AMI, patrón, estado bilateral; sección IV muestra la
  `doctorDiagnosis` validada; la firma/cédula del médico congelado se
  incluyen en la sección final; el membrete superior contiene logo AMI.
- **AC-9** (descarga no permite acceso cruzado): ruta `/api/pdf/audiometry/[reviewId]`
  exige sesión, valida rol (`SUPERADMIN`/`DOCTOR_GENERAL`/`DOCTOR_VALIDATOR`)
  y scope por objeto (`reviewedByUserId === session.user.id` salvo
  SUPERADMIN); mismo patrón del fix IDOR QA-20260825-01 P2-C.
- **AC-10** (XML conserva parser directo, no se envía innecesariamente
  al extractor IA): el incremento NO toca `parse_audiometry_xml` ni la
  rama `/api/v2/event-tests/upload-xml-audiometry` ni el routing del
  frontend para Audiometría. La rama `clinical_context` en
  `handleFileUpload` del workspace adjunta el cuestionario versionado
  cuando aplica (Audiometría o Espirometría); si el archivo es XML y
  se enruta al parser directo backend, el form_data adicional no cambia
  ese flujo.

## Guardrails respetados

- NO se copió el diagnóstico nosológico ni la recomendación textual del
  PDF AMI como salida de IA. El panel audiométrico y el PDF muestran
  explícitamente la separación entre "criterio AMI" (≤25 dB, patrón
  por grupos) y la "impresión diagnóstica validada por el médico"
  (`doctorDiagnosis`).
- NO se cambió Espirometría: 19/19 tests previos del flujo Espirometría
  siguen verdes; `submitDoctorStudyReview` mantiene el default a
  `buildEspirometryPdfData` cuando `studyType !== 'Audiometria'`.
- NO se publicó la calibración V3 de Audiometría; el incremento opera
  sobre snapshots existentes sin tocar el pipeline de calibración.
- NO se inventaron frecuencias: `resolveAudiometriaCriteria` lee sólo
  lo presente; el renderer existente tampoco inventa; el PDF omite filas
  ausentes (muestra `—`).
- NO se hicieron commits/push/PR/deploy. Cambios sólo en el worktree.

## Riesgos y desviaciones

- **Riesgo bajo:** el backend Python NO lee todavía el form field
  `clinical_context` cuando es Audiometría. Esto es intencional: la SPEC
  no obliga al backend a consumirlo en este incremento (mismo patrón que
  Espirometría — el frontend lo propaga, el backend puede opcionalmente
  leerlo en una fase futura). Mientras tanto, el snapshot queda
  persistido en `EventTest.clinicalContext` y disponible para la UI.
- **Riesgo bajo:** la rama `clinical_context` para Audiometría viaja en
  el FormData de upload con el mismo `schemaVersion` que el de
  Espirometría pero con namespace distinto. Defensa en profundidad: el
  server action `ai-prediagnosis.actions.ts` ya tiene
  `extractAndValidateClinicalContext` para Espirometría; el de
  Audiometría puede añadirse en un incremento posterior si el backend lo
  requiere (no es bloqueante para V1/V2; el SPEC reserva al backend
  opcionalidad).
- **Sin desviaciones de alcance.** No se modificó la calibración V3, no
  se cambió el parser XML de Audiometría, no se cambió la UI del Event
  para Espirometría, no se cambió el renderer bilateral existente (sólo
  se enriqueció con el panel clínico audiométrico paralelo), no se cambió
  la lógica de revisión médica.

## Requiere GEMINI

Sí, en el gate final V3 (Playwright): el SPEC reserva V3 a GEMINI. Esta
implementación entrega todos los `data-testid` necesarios para que el
test Playwright recorra cuestionario → modal → guardar → editar →
clinical_context → revisión → PDF → permisos (`audiometria-questionnaire-modal`,
`audiometria-questionnaire-complete`, `audiometria-questionnaire-edit`,
`audiometria-questionnaire-save`, `audiometria-questionnaire-cancel`,
`audiometria-questionnaire-summary`, `audiometria-questionnaire-cta`,
`audiometria-questionnaire-error`, `audiometria-field-error`,
`audiometria-subfield-error`, `audiometria-clinical-criteria-panel`,
`audiometria-pta-card-od`, `audiometria-pta-card-oi`,
`audiometria-pta-equation-od`, `audiometria-pta-equation-oi`,
`audiometria-pta-entries-od`, `audiometria-pta-entries-oi`,
`audiometria-pta-calculado-od`, `audiometria-pta-calculado-oi`,
`audiometria-pta-fuente-od`, `audiometria-pta-fuente-oi`,
`audiometria-criterio-normal`, `audiometria-criterio-alterado`,
`audiometria-criterio-no_concluyente`, `audiometria-layer-nom`,
`audiometria-layer-ami`, `audiometria-layer-fuente`,
`audiometria-layer-derivada`, `audiometria-exploracion-faringe`,
`audiometria-exploracion-cad`, `audiometria-exploracion-cai`,
`audiometria-exploracion-mtd`, `audiometria-exploracion-mti`,
`audiometry-pdf-download-block`, `audiometry-pdf-download-link`,
`audiometry-pdf-error`).
Regla aplicable: FEATURE toca UI/UX del Event y verificación
contractual de payload nuevo.

## Requiere DEBY

No. Sin bugs reproducible, sin crashes, sin race conditions, sin
leaks. Validación V1+V2 focal verde. No hay síntomas que requieran
diagnóstico fuera del alcance del incremento.

## Pendientes ATLAS

- Gate V3 (Playwright) vía GEMINI, conforme a la regla §5.
- Aceptación contractual final del payload `clinicalContext` de
  Audiometría (branch unión) y de la rama `clinical_context` en FormData
  para Audiometría.
- Decidir si el backend debe consumir el `clinical_context` de
  Audiometría en una fase posterior (no bloqueante para V3).

## Notas de reversión

Rollback = eliminar los 12 archivos nuevos + revertir los 3 archivos
modificados a `git checkout` desde `main`. La columna
`EventTest.clinicalContext` ya existe desde FEATURE-20260824-02 y
sigue siendo nullable, por lo que NO se requiere nueva migración
Prisma (la rama Audiometría sólo añade un valor posible del JSON, no
modifica el schema). Los IDs `IMPL-FEATURE-20260825-02` viven sólo en
reportes, headers y commits autorizados; no son marcas de agua en
código.

## Estado devuelto a ATLAS

**READY_FOR_VERIFYING**