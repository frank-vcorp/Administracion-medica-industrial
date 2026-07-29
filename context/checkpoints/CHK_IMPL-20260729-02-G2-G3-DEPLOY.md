# CHK_IMPL-20260729-02-G2-G3-DEPLOY

**ID intervención:** `IMPL-20260729-02`
**ID tarea:** `IMPL-20260729-02 — Gap G2 + Gap G3`
**Fecha:** 2026-07-29
**SPEC funcional:** `context/SPECs/SPEC_IMPL-20260729-FLUJO-END-TO-END.md`
**SPEC correcciones:** `context/SPECs/SPEC_IMPL-20260729-SOFIA-CORRECCIONES.md`
**Plan:** `context/PLAN_IMPL-20260729-02-G2-G3.md`
**Baseline:** `FIX-20260729-01-BASELINE`, commit `efd26fe`

## Alcance ejecutado

Se modificó exclusivamente la suite E2E `frontend/tests/flujo-completo.spec.ts`. Se añadió este checkpoint como entregable explícito. No se tocaron UI, acciones, backend, endpoints, Prisma, migraciones, schemas ni dependencias.

## Tabla TC-01..TC-12

| Caso | Resultado final | Evidencia / observación |
|---|---|---|
| TC-01 | PASS | Empresa creada y `companyId` extraído desde la card por heading + link `Configurar Empresa` (`/companies/{id}`). RFC y nombre usan `RUN_TAG`. |
| TC-02 | PASS | Validado aislado con TC-01: 2/2 en 19.7 s. Modal real de `/admin/profiles`, 7 checkboxes del catálogo vigente y `Guardar Perfil`. |
| TC-03 | PASS | Validado dentro de TC-01..TC-04. Modal `Crear Puesto`, perfil default y verificación posterior mediante `tr` filtrado por `PUESTO_NOMBRE`. |
| TC-04 | PASS | Validado aislado como dependencia TC-01..TC-04 y en suite final. Worker creado; `workerId` extraído desde `tr` + link `Historial`. Se corrigieron fecha/género requeridos y colisión de `universalId` en los datos del fixture. |
| TC-05 | PASS | Cita creada y visible en la tarjeta de `/appointments` para `APPOINTMENT_DATE`. La UI no expone `appointmentId` en href; se verifica persistencia por tarjeta. |
| TC-06 | PASS | Check-in real desde `/appointments`, carga de evidencia INE dummy y corroboración. `eventId` extraído desde URL directa o fallback `/events` (`tr` + link `Abrir Expediente`). |
| TC-07 | PASS | `Papeleta electrónica` visible; se observaron 6 botones de estudio visibles y 7 estudios pendientes/completados en el estado del workspace. |
| TC-08 | PASS | Somatometría, signos vitales y agudeza visual completados usando las pestañas y placeholders reales. Resultado visible en UI. |
| TC-09 | FAIL — gap funcional | El XML llegó al upload real pero la acción lo encaminó al pipeline IA V2/Gemini; la respuesta fue `400 Bad Request`, no se persistió snapshot/archivo y no aparecieron `250/500/1000`. No se convirtió en `skip`. |
| TC-10 | NOT RUN | El modo serial detuvo los casos posteriores al fallo duro de TC-09. El selector fue actualizado al botón de estudio y al `input[type="file"]`; requiere reejecución después del fix del pipeline. |
| TC-11 | NOT RUN | Bloqueado por el fallo serial de TC-09. Selector preparado: botón `BIOMETRIA HEMATICA COMPLETA` → `Registrar muestra tomada` → fila de `/lab/reception` + link `/events/{id}`. |
| TC-12 | NOT RUN | Bloqueado por el fallo serial de TC-09. Selector preparado para `EventFlowController` real (`Reporte médico de aptitud`, placeholders de diagnóstico/recomendaciones y `Firmar y Emitir Dictamen`). |

### Conteo reproducible

- Ejecución incremental TC-01..TC-02: **2 passed**.
- Ejecución incremental TC-01..TC-04: **4 passed**.
- Ejecución final serial: **8 passed, 1 failed, 3 did not run**.
- No se introdujeron skips condicionales para ocultar gaps funcionales.

## Selectores y correcciones aplicadas

### G2 — TC-02 Perfil médico

- Botón real: `getByRole('button', { name: '+ Nuevo Perfil' })`.
- El modal no tiene `role="dialog"`; se acota por el formulario que contiene el placeholder `Nombre del perfil (ej. Ingreso Operativo)`.
- Nombre: placeholder real del input.
- Estudios: `getByRole('checkbox', { name: /CÓDIGO NOMBRE/i })`, con conteo exacto antes de marcar.
- Submit: `getByRole('button', { name: 'Guardar Perfil' })`.
- Hallazgo de contrato UI: `/admin/profiles` no renderiza combobox Empresa. El action acepta `companyId` opcional y `getMedicalProfilesForCompany()` incluye perfiles globales; el test documenta y usa ese comportamiento sin inyectar campos ni cambiar producto.
- Se sustituyeron códigos legacy ausentes (`GEN-01`, `GEN-02`, `LAB-01`, `AUDIO-01`, `ESPIRO-01`) por nombres accesibles del catálogo productivo observado: `GEN-001`, `GEN-003`, `GEN-013`, `LAB-018`, `GEN-012`, `IMG-013`, `GEN-015`.

### G3 — TC-04 Trabajador

- Formulario acotado por placeholder `Nombre`.
- Se llenan explícitamente `Nombre`, `Apellidos`, `input[name="dob"]`, `select[name="gender"]`, email, teléfono, `select[name="companyId"]` y `select[name="jobPositionId"]`.
- El diagnóstico de la primera ejecución identificó `unique constraint` en `universalId`: el generador usa inicial, apellidos, fecha y género, no el sufijo de email/nombre. El fixture codifica `RUN_TAG` en la primera inicial y en una fecha válida determinista para evitar colisiones persistentes.
- Se mantiene el único `click({ force: true })` preexistente para el overlay documentado en `c8a80e1`/`4e9de7f`; no se añadió otro bypass.
- ID persistente: `tr` filtrado por nombre completo → link `Historial` → `/history/{workerId}`.

### TC-03 y TC-05..TC-12

- TC-03: modal real `Crear Puesto`, placeholder `Ej: Soldador, Operador de Montacargas`, `select[name="defaultProfileId"]`, submit `Crear Puesto`, verificación de fila tras reload.
- TC-05: `AppointmentFormModal` acotado por `select[name="companyId"]`; selects `workerId`/`branchId`, inputs `date`/`time`; evidencia persistente en tarjeta de `/appointments`.
- TC-06: tarjeta de cita por nombre → `button[title="Check-in"]` → modal `Corroboración de Identidad` → primer input de archivo → `Confirmar y Hacer Check-In`.
- TC-07: `Papeleta electrónica` y botones reales del `PapeletaWorkspace`; se eliminó la dependencia inexistente de `[data-testid="event-test-card"]`.
- TC-08: botón `EXAMEN MEDICO`, placeholders clínicos reales (`Ej: 75.5`, `Ej: 1.75`, `120`, `80`, `BPM`), pestañas y bloque estructural `Campo Visual` para inputs sin `for/id`.
- TC-09/TC-10: botón del estudio → `input[type="file"]`; ya no se buscan `<section>` inexistentes. El progreso usa `.first()` para evitar strict mode.
- TC-11: botón `BIOMETRIA|HEMATICA` → `Registrar muestra tomada`; en LAB se acota `tr` por nombre y se extrae el href de evento.
- TC-12: se sustituyó la hipótesis de `<section>` + `select Aptitud` por el componente real `EventFlowController`.

## Validaciones obligatorias

| Gate | Resultado | Comando | Evidencia |
|---|---|---|---|
| typecheck | PASS | `cd frontend && npm run typecheck` | `tsc --noEmit` sin errores. Incluye las correcciones locales de `textContent()` y teclado ya presentes en baseline. |
| tests | PASS | `cd frontend && npm test` | 18 archivos, **273/273 tests**. Los mensajes de error de entorno en `api-handler.test.ts` son salidas esperadas de casos que prueban variables ausentes; el proceso termina PASS. |
| lint | PASS | `cd frontend && npm run lint` | 0 errores, 0 warnings. |
| diff check | PASS | `git diff --check` | Sin whitespace errors. |
| E2E incremental | PASS parcial | `npx playwright test flujo-completo.spec.ts --grep 'TC-0[1-2]' --project=chromium --timeout=120000 --reporter=line` | 2 passed. |
| E2E datos maestros | PASS | `npx playwright test flujo-completo.spec.ts --grep 'TC-0[1-4]' --project=chromium --timeout=120000 --reporter=line` | 4 passed; repetido después de corregir `universalId`, 4 passed. |
| E2E serial completo | FAIL controlado | `npx playwright test flujo-completo.spec.ts --project=chromium --timeout=300000 --reporter=line` | 8 passed, TC-09 failed por gap XML/Gemini, 3 no ejecutados por serial. |

Las ejecuciones E2E se hicieron contra `BASE_URL` productiva con credenciales de entorno; no se registran credenciales ni secretos en este checkpoint.

## Evidencia browser-side

Snapshots on-demand confirmaron:

- Login: nombres accesibles `Correo Electrónico`, `Contraseña`, `Iniciar Sesión`.
- `/admin/profiles`: `+ Nuevo Perfil`, input de nombre, checkbox accesible con código/nombre y `Guardar Perfil`.
- `/workers`: modal `Nuevo Trabajador`, campos requeridos reales y `Guardar Trabajador`.
- `/appointments`: `Agendar Cita`, selects sin asociación HTML de label y tarjeta de cita con botón `▶`/title `Check-in`.
- `/events/{id}`: `Papeleta electrónica`, 7 estudios en estado y 6 botones visibles por el ocultamiento intencional de Somatometría/Agudeza bajo `Examen Médico`.
- `/events`: fallback persistente `tr` + link `Abrir Expediente` usado para `eventId` cuando el redirect del check-in compite con `loadData()`.

## Gaps restantes y follow-up requerido

### G-XML-01 — Parser XML directo no seleccionado

**Evidencia:** TC-09 selecciona `AUDIOMETRIA`, carga `context/PACIENTES/JESSICA GABRIELA.xml`, el UI muestra error HTTP 400 del proveedor Gemini y no muestra tabla bilateral. El flujo esperado por SPEC era parser XML directo sin IA.

**Propuesta de follow-up:** crear una SPEC de fix para que `uploadEventTestFile`/`triggerStudyAIAnalysis` detecte XML de audiometría antes del pipeline IA, invoque el parser directo, persista `fileUrl`/snapshot compatible y exponga las 16 mediciones, PTA y prediagnóstico posterior. No implementar en este lote: implica action/pipeline y contrato funcional fuera del archivo autorizado.

### G-RAW-02 — Panel RAW

La UI vigente renderiza `Extracción clínica` y los paneles RAW fueron retirados por la limpieza de papeleta. La SPEC histórica aún lista “RAW de extracción” como criterio. El test valida el renderer vigente y el checkpoint deja la desviación explícita; decidir en follow-up si se reintroduce la evidencia RAW o se actualiza la SPEC funcional.

### G-DICT-03 — Cierre de dictamen

TC-12 no alcanzó a ejecutarse por el fallo serial de TC-09. La página vigente no muestra el formulario hipotético `<select Aptitud>` de la prueba original; el selector preparado apunta al `EventFlowController` que solo aparece al llegar a `VALIDATING`. Revalidar después de desbloquear TC-09 y documentar si la transición a `VALIDATING`/`CLOSED` requiere SPEC de producto.

### G-APT-04 — appointmentId no expuesto

`/appointments` no renderiza un link con `appointmentId`; la cita se verifica por tarjeta y el `eventId` se obtiene después desde la papeleta. No se inventó un ID ni se alteraron contratos.

## Riesgos / desviaciones

- Los E2E crean datos persistentes en la BD productiva de pruebas; nombre/RFC de empresa, nombre/fecha/ID derivado del trabajador, email/teléfono del trabajador, puesto y perfil usan `RUN_TAG`. El email de contacto de TC-01 conserva el valor fijo de la UI previa porque no es la clave de unicidad del flujo.
- El generador de `universalId` tiene un espacio finito derivado de inicial/fecha/género; el fixture codifica el `RUN_TAG` en campos que sí participan en el generador para evitar la colisión observada.
- `force: true` permanece solo en TC-04 por el overlay modal ya documentado; la causa adicional de validación fue corregida con fecha y género.
- TC-10..TC-12 quedan pendientes de ejecución efectiva por el gating serial de TC-09; no se marcaron como PASS ni se convirtieron en SKIP.
- No se tocaron contratos públicos, acciones, esquemas Prisma, migraciones, UI ni backend.

## Pendientes INTEGRA / GEMINI

1. INTEGRA debe decidir/encaminar SPEC de follow-up para parser XML directo y determinar si el panel RAW sigue siendo criterio obligatorio.
2. Reejecutar TC-09..TC-12 después del fix del pipeline; confirmar EventTests, LabOrder y cierre `CLOSED`.
3. Solicitar segunda mano de GEMINI sobre este diff antes de cualquier commit/promoción.
4. Frank debe aprobar cualquier commit/push; SOFIA no ejecutó commit ni push.

## Rollback recomendado

No ejecutado. Si INTEGRA decide descartar este lote, revertir únicamente los cambios de `frontend/tests/flujo-completo.spec.ts` y retirar este checkpoint; no modificar los archivos no rastreados preexistentes del workspace.

**Estado:** `BLOCKED — G-XML-01 funcional pendiente; gates frontend verdes; TC-01..TC-08 verificados.`
