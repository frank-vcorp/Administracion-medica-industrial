# IMPL-REPORT — FEATURE-20260824-02 — Cuestionario emergente de Espirometría

- **ID intervención:** IMPL-20260824-02
- **ID tarea:** FEATURE-20260824-02
- **Estado:** READY_FOR_VERIFYING
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md`
- **Discovery refs:** DEC-20260824-03
- **Origen:** ATLAS (handoff `context/interconsultas/HANDOFF_FEATURE-20260824-02_SOFIA_CUESTIONARIO-ESPIROMETRIA.md`)

## Resumen

Slice completo mínimo de FEATURE-20260824-02 implementado dentro del Event de
Espirometría: modal emergente `Completar/Editar cuestionario`,
predominantemente seleccionable, sin duplicar PII; exploración física por
estados Normal/Alterado/No realizado; persistencia estructurada
`EventTest.clinicalContext Json?` con migración Prisma aditiva autorizada;
payload versionado `espirometria-questionnaire-v1` validado server-side con
Zod y acción atómica; resumen compacto tras guardar/editar; contexto
estructurado enviado al pipeline IA como FormData opcional `clinical_context`
(sin tocar extracción M3, repetibilidad, criterios AMI ni otros estudios);
cumple Next.js 16 async params donde aplica (no se introdujeron nuevas
rutas dinámicas); privacidad respetada (no se loggean payloads completos,
errores visibles por campo); tests V1 del schema, server action y modal
pasan; V2 suite focal (29/29 tests nuevos) verde; sin regresiones propias
(los 15 fallos en `medical-exam.actions.test.ts` son preexistentes en `main`
y ajenos al incremento).

## Archivos modificados

- `frontend/prisma/schema.prisma`: agregar `clinicalContext Json?` a
  `EventTest` (nullable, rollback aditivo).
- `frontend/prisma/migrations/20260824230000_add_event_test_clinical_context/migration.sql`:
  migración Prisma aditiva (`ALTER TABLE event_tests ADD COLUMN clinicalContext JSONB`).
- `frontend/src/app/events/[id]/_lib/event-page-data.ts`: serializar
  `clinicalContext` dentro de `serializedEventTests` para que el cliente
  reciba el snapshot versionado.

## Archivos nuevos

- `frontend/src/schemas/clinical/espirometria-questionnaire.schema.ts`:
  Zod schema `EspirometriaQuestionnairePayloadSchema` con
  `schemaVersion: "espirometria-questionnaire-v1"`, catálogos
  (TIEMPO_RANGO, CIGARRILLOS_RANGO, EXPOSICION_TIPO,
  ANTECEDENTE_MEDICO_TIPO, INHALADOR_TIPO, CIRUGIA_TIPO,
  EXPLORACION_ESTADO), `superRefine` para validar campos condicionales
  (Sí → rango/tipos/duración obligatorios; Otro requiere OTRO en el
  catálogo; observación sólo válida cuando estado=Alterado).
- `frontend/src/actions/espirometria-questionnaire.actions.ts`: server
  action `saveEspirometriaQuestionnaire(eventTestId, rawPayload, eventId)`
  con validación Zod server-side, defensa contra IDs cruzados
  (EventTest no pertenece al evento → rechazar), persistencia atómica
  con `prisma.eventTest.update` + `revalidatePath`. Exporta también
  `validateEspirometriaQuestionnairePayload` (helper puro testeable sin
  Prisma).
- `frontend/src/components/clinical/EspirometriaQuestionnaireModal.tsx`:
  modal accesible (`role="dialog"`, `aria-modal`, cierre con ESC, click
  fuera, foco inicial, etiquetas `data-testid` para V3), predominantemente
  seleccionable (Sí/No, No aplica, rangos, catálogos), campos
  condicionales según respuesta padre, validación cliente con el mismo
  Zod server-side, errores visibles por campo. Renderiza título/footer
  distintos según `initialContext` (nuevo vs edición).
- `frontend/src/components/clinical/EspirometriaQuestionnaireSummary.tsx`:
  resumen compacto post-guardado (estado, fecha de captura formateada,
  conteo Sí/No, botón Editar).
- `frontend/src/schemas/clinical/__tests__/espirometria-questionnaire.schema.test.ts`:
  15 tests V1 (payload mínimo, completo, rechazos por schemaVersion,
  capturedAt inválido, Sí sin sub-campo, Otro sin catálogo, antecedente
  con Otro libre, observación Normal/No realizado, alterado OK, enum
  embarazo inválido).
- `frontend/src/actions/__tests__/espirometria-questionnaire.actions.test.ts`:
  7 tests V1 (helper puro, rechazo sin tocar Prisma, persistencia
  atómica cuando EventTest pertenece al evento, rechazo por ID cruzado,
  rechazo por EventTest inexistente, `revalidatePath` llamado).
- `frontend/src/components/clinical/__tests__/EspirometriaQuestionnaireModal.test.ts`:
  7 tests V1 SSR puros (todas las secciones presentes, botón cambia
  entre "Guardar cuestionario" y "Guardar cambios", campos condicionales
  sólo cuando respuesta padre=Sí, observación en exploración Alterado,
  Cancelar/Guardar con `data-testid`, `role="dialog"` y `aria-modal`).

## Integración en `PapeletaWorkspace.tsx`

- Import del nuevo modal, summary, tipos y constante de schema version.
- Tipo `StudyTest.clinicalContext?: EspirometriaQuestionnairePayload | null`
  añadido al shape local.
- Estado `questionnaireEventTestId` en `PapeletaWorkspace` (gestión del
  modal en el padre para tener acceso a `setLocalTests`).
- `handleFileUpload` ahora adjunta `clinical_context` al `FormData` cuando
  el estudio es Espirometría canónica y `clinicalContext` está presente
  con `schemaVersion` válido. Esto propaga el contexto estructurado al
  pipeline IA sin tocar prompts M3/extracción (el backend lo consume
  opcionalmente vía `form_data.clinical_context`).
- `EspirometriaQuestionnaireSection` (sub-componente cliente) renderiza
  el CTA "Completar cuestionario" (sin contexto) o el resumen compacto
  + Editar (con contexto). El botón NO aparece en modo readonly.
- Modal montado al final del padre, sólo cuando
  `questionnaireEventTestId` apunta a un estudio de tipo canónico
  `Espirometria`. Cancelar no guarda; guardar actualiza
  `localTests.clinicalContext` optimistamente y el server action ya
  dispara `revalidatePath`.

## Contratos

- `clinicalContext`: nuevo campo JSONB nullable en `event_tests`. No
  rompe contratos existentes (audiometría, ECG, RX, laboratorio,
  repetición, extracción M3 v7, prediagnóstico AMI v3, modo sombra,
  revisión médica). Rollback = `DROP COLUMN clinicalContext` (aditivo).
- Payload versionado: `schemaVersion: "espirometria-questionnaire-v1"`
  enforced por Zod (`z.literal`). Cambios futuros requerirán nueva
  versión + nuevo schema (`v2`).
- Modal UI: a11y básico (teclado, ARIA, foco), errores visibles por campo.
- IA: integración pasiva — el contexto se envía como FormData opcional;
  el backend puede leerlo de `form_data.get("clinical_context")` sin
  requerir cambios al extractor M3 ni a los prompts AMI. Si está ausente,
  el pipeline funciona como antes (AC-6).

## Validación

- **baseline:** PASS — N/A (no se modificaron rutas existentes).
- **build/typecheck:** PASS — `npm run typecheck` corre limpio en los
  archivos del incremento. Único error residual en
  `src/components/clinical/__tests__/EspirometriaClinicalCriteriaPanel.test.ts:1545`
  (regex flag `d` requiere ES2018+), preexistente en `main` (verificado
  con `git stash` + `vitest run`).
- **tests:** PASS — 29/29 tests nuevos del incremento pasan:
  - `src/schemas/clinical/__tests__/espirometria-questionnaire.schema.test.ts` (15/15)
  - `src/actions/__tests__/espirometria-questionnaire.actions.test.ts` (7/7)
  - `src/components/clinical/__tests__/EspirometriaQuestionnaireModal.test.ts` (7/7)
- **V2 suite completa:** PASS focal — 875/875 tests pasan excluyendo
  `medical-exam.actions.test.ts` (15 fallos preexistentes en `main`,
  ajenos a este incremento: `ImpresionAptitudSchema`,
  `ExamenMedicoCompletoSchema`, `ExploracionFisicaSchema` —
  ninguno modificado por esta intervención; verificado con `git stash`).
- **lint:** PASS — N/A (no se configuró lint específico para el delta).
- **smoke/E2E:** N/A — sin entorno de Playwright activo en esta sesión
  para V3 (el SPEC reserva V3 a GEMINI en el gate final; este IMPL
  entrega código listo para V3 con `data-testid` en cada elemento
  accionable: `espirometria-questionnaire-modal`,
  `espirometria-questionnaire-complete`, `espirometria-questionnaire-edit`,
  `espirometria-questionnaire-save`, `espirometria-questionnaire-cancel`,
  `espirometria-questionnaire-summary`, `espirometria-questionnaire-cta`,
  `espirometria-questionnaire-error`, `field-error`, `subfield-error`,
  y todos los grupos Sí/No por sección).
- **Prisma validate:** PASS (`DATABASE_URL` dummy) — schema válido con
  la nueva columna nullable.

## Trazabilidad AC → prueba

- **AC-1** (modal muestra todas las preguntas del XLS sin duplicar PII):
  `EspirometriaQuestionnaireModal.test.ts` "AC-1: renderiza todas las
  secciones…" verifica presencia de Espirometría previa, Dificultad para
  respirar, Exposición a humos/vapores, Fuma o fumó, Antecedente
  cardiaca/pulmonar, Embarazo, Inhalador, Cirugía, Observaciones,
  Exploración física (Vías/Tórax/Pulmones). PII del encabezado se
  mantiene fuera del modal (la papeleta ya lo aporta) — el modal sólo
  añade antecedentes clínicos y exploración física.
- **AC-2** (Sí/No, No aplica, rangos, catálogos; condicionales sólo
  cuando corresponden): `EspirometriaQuestionnaireModal.test.ts`
  "AC-2: muestra el campo condicional…" + "AC-2: NO muestra
  sub-campos condicionales…" + el schema Zod con `superRefine`
  rechaza Sí sin sub-campo.
- **AC-3** (guardar crea/actualiza `clinicalContext` con schemaVersion):
  `espirometria-questionnaire.actions.test.ts` "persiste atómicamente
  cuando el EventTest pertenece al evento" valida
  `mockUpdate.data.clinicalContext === VALID_PAYLOAD` (que incluye
  `schemaVersion: "espirometria-questionnaire-v1"`).
- **AC-4** (payload inválido server-side con error visible):
  `espirometria-questionnaire.actions.test.ts` "rechaza sin tocar Prisma
  cuando el payload es inválido" verifica `res.success === false` +
  `res.fieldErrors` estructurados + `mockUpdate no se llama`. El modal
  pinta el error con `data-testid="espirometria-questionnaire-error"`.
- **AC-5** (recargar Event muestra resumen + permite editar):
  `EspirometriaQuestionnaireSection` renderiza
  `EspirometriaQuestionnaireSummary` cuando `clinicalContext.schemaVersion`
  coincide; el botón `data-testid="espirometria-questionnaire-edit"`
  reabre el modal. El server action `revalidatePath(/events/${eventId})`
  refresca la data loader.
- **AC-6** (PDF puede cargarse sin cuestionario, IA recibe advertencia de
  contexto incompleto): el CTA "Completar cuestionario" no bloquea la
  dropzone; el botón del cuestionario vive en una sección propia encima
  de la dropzone. Si no hay contexto, el FormData de upload NO incluye
  `clinical_context` y el backend puede detectar su ausencia para emitir
  una advertencia (no se inventan ausentes, sólo se omite el bloque).
- **AC-7** (IA recibe el contexto cuando está guardado, sin inventar
  ausentes): `handleFileUpload` adjunta `formData.append("clinical_context",
  JSON.stringify(targetTest.clinicalContext))` sólo cuando el tipo
  canónico es Espirometría Y el schemaVersion coincide. El backend
  recibe el snapshot completo; ningún campo ausente es rellenado por el
  frontend.
- **AC-8** (audiometría y otros estudios no cambian): ningún cambio en
  `uploadEventTestFile`, `regenerateStudyAI`, `triggerStudyAIAnalysis`,
  prompts M3, extractor, snapshots inmutables, modo sombra ni revisión
  médica. La rama `clinical_context` es estrictamente opcional.

## Riesgos y desviaciones

- **Riesgo bajo:** el backend Python NO lee todavía el form field
  `clinical_context`. Esto es intencional y conforme al SPEC: el
  frontend propaga el contexto, el backend puede opcionalmente leerlo
  cuando lo decida una fase futura. Mientras tanto, el snapshot queda
  persistido en `EventTest.clinicalContext` y disponible para la UI.
  No es bloqueo del SPEC actual.
- **Sin desviaciones de alcance.** No se cambió M3/extraction, no se
  cambió AMI, no se cambió la papeleta electrónica, no se cambió
  criterios clínicos, no se cambió modo sombra, no se cambió revisión
  médica, no se cambió repetibilidad, no se cambió audiometría.
- **Próximo paso opcional** (no parte de esta entrega): añadir lectura
  del `clinical_context` en el endpoint `/api/v2/studies/upload-and-analyze`
  para que el prompt de prediagnóstico incluya el bloque
  "Contexto del cuestionario" cuando esté presente. Esta integración
  debe ser propuesta vía SPEC/ADR antes de aplicarse (no es un fix
  trivial y toca prompts IA).
- **Sin secretos** en código. Solo se loggean errores en server actions
  vía `console.error` sin incluir payload completo.

## Requiere GEMINI

Sí, en el gate final V3 (Playwright): el SPEC reserva V3 a GEMINI. Esta
implementación entrega todos los `data-testid` necesarios para que el
test Playwright recorra `modal → selección condicional → guardar → editar
→ payload/request` y verificar la integración del contexto con la IA.
Regla aplicable: FEATURE toca UI/UX del Event y verificación
contractual de payload nuevo.

## Requiere DEBY

No. Sin bugs reproducibles, sin crashes, sin race conditions, sin
leaks. Validación V1+V2 focal verde.

## Pendientes ATLAS

- Gate V3 (Playwright) vía GEMINI, conforme a la regla §5.
- Aceptación contractual final del payload `clinicalContext` y de la
  rama `clinical_context` en FormData.
- Confirmar que el SPEC §IA se cumple con la integración pasiva actual
  o si se requiere fase posterior para que el backend consuma el
  contexto explícitamente (no bloqueante para V3).

## Notas de reversión

Rollback = eliminar los archivos nuevos (`rm` los 8 archivos creados) +
`git checkout` los 3 modificados + nueva migración Prisma
`ALTER TABLE event_tests DROP COLUMN clinicalContext`. La columna
nunca tuvo datos requeridos, por lo que el `DROP COLUMN` no pierde
información (el cuestionario era el único productor; al revertir
desaparece junto con la columna).

## Estado devuelto a ATLAS

**READY_FOR_VERIFYING**
