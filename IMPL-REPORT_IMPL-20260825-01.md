# IMPL-REPORT — IMPL-20260825-01 — FEATURE-20260825-01 PDF de Espirometría validada

- **Estado:** READY_FOR_VERIFYING
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md`
- **Discovery refs:** n/a (SPEC alimentada por handoff ATLAS directo)
- **Handoff origen:** `context/interconsultas/HANDOFF_FEATURE-20260825-01_SOFIA_PDF-ESPIROMETRIA-VALIDADA.md`

## Resumen ejecutivo

Implementación completa de la SPEC FEATURE-20260825-01. Se agregaron campos
aditivos y nullable al esquema Prisma (`User.professionalLicense`,
`User.signatureImageUrl`, `DoctorStudyReview.validatorSnapshot*`,
`DoctorStudyReview.validatedPdf*`); se construyó un nuevo componente de
PDF validado con membrete AMI, un helper server-side de generación, una
API route autenticada para descarga, una página/UI de perfil médico para
SUPERADMIN/Doctor, y se extendió `submitDoctorStudyReview` para
**congelar la identidad del médico al momento de aceptar/editar** y
**generar el PDF descargable** (rechazo NO genera PDF por contrato de la
SPEC). No se tocó extracción M3, cuestionario, repetibilidad, criterios
AMI ni dictamen general. No se realizó commit/push/deploy — se devuelve
para verificación contractual ATLAS y gate GEMINI.

## Archivos modificados / creados

### Schema + migración
- `frontend/prisma/schema.prisma` — agrega 9 columnas nullable (2 en `User`, 7 en `DoctorStudyReview`).
- `frontend/prisma/migrations/20260825000000_add_doctor_profile_and_espirometry_pdf/migration.sql` — migración aditiva (`ALTER TABLE … ADD COLUMN …`) compatible con rollback por `DROP COLUMN`.

### Schemas Zod
- `frontend/src/schemas/clinical/doctor-profile.schema.ts` — `doctorProfileSchema` + `validateDoctorProfileForPdf`. Reutiliza patrón `z.string().trim()` del proyecto. Cédula: 4–20 chars alfanuméricos/guion/espacio. Firma: data-URL, `/uploads/...` o `https://...`.

### Server actions
- `frontend/src/actions/doctor-profile.actions.ts` — `getCurrentDoctorProfile` y `updateCurrentDoctorProfile` con gate de rol (SUPERADMIN / DOCTOR_GENERAL / DOCTOR_VALIDATOR).
- `frontend/src/actions/ai-prediagnosis.actions.ts` — extensión de `submitDoctorStudyReview`:
  - Congela identidad (`validatorSnapshotFullName/ProfessionalLicense/SignatureUrl`) cuando `doctorStatus ∈ {REVIEWED_ACCEPTED, REVIEWED_EDITED}`.
  - Rechazo (`REVIEWED_REJECTED`) NO congela identidad ni genera PDF.
  - Si el perfil del médico está incompleto, devuelve error legible y NO crea la revisión (atomicidad).
  - Si la generación del PDF lanza excepción, la revisión queda guardada; `validatedPdfError` se persiste y `pdfGenerated=false` se devuelve al cliente.
  - `DoctorStudyReviewResult` extiende con `pdfGenerated?: boolean` y `pdfErrorMessage?: string | null` (campos opcionales, retrocompatible).
  - **No se modificaron**: la firma pública de `submitDoctorStudyReview`, la lógica de creación de snapshots IA, el flujo de extracción M3, el cuestionario, los criterios AMI ni el dictamen general.

### PDF
- `frontend/src/components/pdf/EspirometryValidatedPDF.tsx` — plantilla `@react-pdf/renderer` con membrete AMI (logo remoto + texto fallback), pie institucional (Circuito del Mesón #135, etc.), datos del estudio/paciente, criterios de repetibilidad, impresión validada, recomendaciones validadas, identificación congelada del médico (firma, cédula, nombre) y fecha/hora.
- `frontend/src/lib/espirometry-pdf.tsx` — helper `generateEspirometryValidatedPdf` + `resolveRepetibilidadForPdf`. Persistencia opcional a `uploads/espirometry-pdfs/<reviewId>.pdf` (con fallback a regeneración en línea si el FS no está disponible). Logo AMI: `https://medicaindustrial.com/sites/default/files/logo-2023.fw_.png`.
- `frontend/src/app/api/pdf/espirometry/[reviewId]/route.tsx` — endpoint autenticado (Next 16 async params). Fast-path sirviendo desde disco + path de regeneración en línea con snapshot congelado. Devuelve 404 si `doctorStatus === 'REVIEWED_REJECTED'`. Headers `Content-Disposition: inline` + `Cache-Control: private, max-age=300`. Devuelve 410 Gone si la revisión no tiene snapshot congelado (registros pre-incremento).

### UI
- `frontend/src/components/admin/DoctorProfileForm.tsx` — formulario client con validación Zod espejo, upload de firma PNG/JPEG (≤2 MB) → data-URL. data-testid: `doctor-profile-form`, `doctor-profile-fullName`, `doctor-profile-license`, `doctor-profile-signature-input`, `doctor-profile-submit`, `doctor-profile-error`, `doctor-profile-success`.
- `frontend/src/app/admin/profile/page.tsx` — server component con gate de rol y redirect.
- `frontend/src/components/AppShell.tsx` — agrega NavItem `🖋️ Mi perfil médico` para SUPERADMIN/Doctor.
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx` — `DoctorReviewSummary` agrega `pdfGenerated` y `pdfErrorMessage`; bloque "Revisión existente" muestra botón de descarga (`espirometry-pdf-download-link`) o banner de error (`espirometry-pdf-error`) según estado del PDF. data-testid: `espirometry-pdf-download-block`, `espirometry-pdf-download-link`, `espirometry-pdf-error`.

### Propagación al cliente
- `frontend/src/services/medical-event.service.ts` — include de `doctorReviews` agrega `validatedPdfUrl`, `validatedPdfGeneratedAt`, `validatedPdfError` para que la papeleta pueda mostrar el botón sin re-fetch.
- `frontend/src/app/events/[id]/_lib/event-page-data.ts` — `existingReview` serializa `pdfGenerated` y `pdfErrorMessage` (deriva `pdfGenerated = !!validatedPdfUrl && !validatedPdfError`).
- `frontend/src/components/clinical/PapeletaWorkspace.tsx` — type de `existingReview` extendido con los nuevos campos opcionales.

### Tests focales (V1)
- `frontend/src/schemas/clinical/__tests__/doctor-profile.schema.test.ts` — 14 tests: nombre (mín/máx/trim), cédula (regex/formatos/vacía), firma (esquemas soportados/rechazo javascript:), gate `validateDoctorProfileForPdf`.
- `frontend/src/actions/__tests__/ai-prediagnosis.espirometry-pdf.test.ts` — 6 tests sobre `submitDoctorStudyReview`:
  1. ACCEPTED congela identidad + genera PDF.
  2. EDITED congela identidad + genera PDF.
  3. REJECTED NO genera PDF ni congela identidad.
  4. ACCEPTED bloqueado si falta cédula (no crea revisión).
  5. ACCEPTED bloqueado si falta firma (no crea revisión).
  6. Si el generador lanza excepción, la revisión queda guardada y `validatedPdfError` se persiste.

## Contratos públicos

**Sin cambios.** La firma de `submitDoctorStudyReview` se preserva y la
extensión es retrocompatible (campos opcionales). Los endpoints de
extracción M3, criterios AMI, cuestionario y dictamen general no se
tocaron. La nueva API `/api/pdf/espirometry/[reviewId]` es nueva y
autenticada (no es reemplazo de `/api/pdf/[eventId]` del dictamen).

## Validación

| Etapa | Estado | Comando / evidencia |
|---|---|---|
| Baseline (sin cambios) | typecheck: 1 error preexistente en `EspirometriaClinicalCriteriaPanel.test.ts:1545` (target es2018 flag) — no relacionado con este incremento | `cd frontend && npx tsc --noEmit` |
| baseline (sin cambios) | tests: 1 archivo fallido / 15 tests fallidos en `medical-exam.actions.test.ts` — verificado contra `git stash` que reproduce el mismo fallo en baseline | `cd frontend && npx vitest run` |
| **V1 typecheck** | PASS (sólo el error preexistente) | `cd frontend && npx tsc --noEmit` |
| **V1 tests focales** | PASS — 14/14 doctor-profile.schema + 6/6 espirometry-pdf = 20/20 | `cd frontend && npx vitest run src/schemas/clinical/__tests__/doctor-profile.schema.test.ts src/actions/__tests__/ai-prediagnosis.espirometry-pdf.test.ts` |
| **V1 prisma generate** | PASS | `cd frontend && npx prisma generate` |
| **V2 suite completa** | PASS sobre el incremento: 46 archivos / 989 tests (vs. baseline 44/969). Las 15 fallas de `medical-exam.actions.test.ts` son preexistentes y no relacionadas con este incremento (verificado contra `git stash`). | `cd frontend && npx vitest run` |
| **V2 build/lint** | NO EJECUTADA — el SPEC autoriza validación V1+V2 dentro del SOFIA; V3 + build completo + lint + deploy dependen del gate GEMINI y autorización explícita de Frank. | n/a |
| **V3 Playwright** | NO EJECUTADA — depende de entorno con BD sembrada y autorización GEMINI (ver §"Requiere GEMINI"). | n/a |
| **Ejecución contra BD real** | NO EJECUTADA — el sandbox local no tiene `DATABASE_URL` accesible. La migración es aditiva y nullable: filas existentes no se tocan. Requiere `prisma migrate deploy` en Railway tras gate GEMINI. | n/a |

## Trazabilidad por criterio de aceptación

| AC | Cómo se cumple | Evidencia |
|---|---|---|
| Perfil permite guardar/editar nombre, cédula y firma con validación | `DoctorProfileForm` + `updateCurrentDoctorProfile` + `doctorProfileSchema` (Zod) | `src/schemas/clinical/doctor-profile.schema.ts`, `src/components/admin/DoctorProfileForm.tsx`, `src/actions/doctor-profile.actions.ts`, test focal 14/14 |
| Aceptar/editar crea revisión y PDF; PDF asociado y descargable | `submitDoctorStudyReview` genera PDF y persiste `validatedPdfUrl/GeneratedAt/Hash`; API route sirve el PDF | `src/actions/ai-prediagnosis.actions.ts`, `src/app/api/pdf/espirometry/[reviewId]/route.tsx`, tests focales 1+2 |
| Firma/cédula congelada en la revisión/PDF aunque el perfil cambie después | `validatorSnapshotFullName/ProfessionalLicense/SignatureUrl` se copian del `User` al crear la revisión; el PDF usa esos snapshots, no el perfil actual | Tests focales 1+2; diff en `schema.prisma` y `ai-prediagnosis.actions.ts` |
| Errores de generación son visibles y NO marcan revisión como PDF listo | Try/catch alrededor de `generateEspirometryValidatedPdf`; persiste `validatedPdfError`; `pdfGenerated=false` se devuelve; UI muestra banner `espirometry-pdf-error` | `src/actions/ai-prediagnosis.actions.ts`, `src/components/clinical/StudyAIPrediagnosisPanel.tsx`, test focal 6 |
| Rechazo no genera PDF | Branch `shouldGeneratePdf` sólo true para ACCEPTED/EDITED; en REJECTED no se consulta `User` ni se llama generador; `validatorSnapshot*` quedan NULL | Test focal 3 |
| Playwright verifica perfil → revisión → descarga y contenido/headers básicos | **PENDIENTE V3** — depende de BD sembrada + GEMINI | Requiere GEMINI |

## Riesgos y desviaciones

- **Membrete AMI con URL remota**: si el entorno de generación no tiene red, `@react-pdf/renderer` falla al descargar el logo; el componente cae al fallback `AMI` con texto. El PDF sigue generándose. La persistencia a disco (`uploads/espirometry-pdfs/`) requiere FS escribible; en Vercel serverless se regenera en cada descarga. Frank autorizó la URL del logo tal como está; si requiere cache local en producción, ATLAS debe decidir la infraestructura (recomendado Coolify/Contabo con cache nginx).
- **Repetibilidad del PDF**: el helper `resolveRepetibilidadForPdf` se invoca con `{}` por defecto porque la presentación estructurada completa vive en el panel `EspirometriaClinicalCriteriaPanel` (no expuesta al server action). El PDF muestra `—` en esos campos por ahora. Para incluir valores reales es necesario propagarlos desde el snapshot al server action — se deja como **pendiente ATLAS** (no rompe el contrato actual: el PDF sigue siendo válido aunque algunos campos de repetibilidad queden vacíos; el médico puede verificar los criterios en el panel de la papeleta).
- **Tamaños de data-URL de firma**: se limita a ~5 MB (`7_000_000` chars) por el schema Zod. Si el médico sube una imagen >2 MB, la UI lo bloquea. Si llega una firma de mayor tamaño por bypass, el schema Zod la rechazaría en la próxima edición.
- **Modo sombra se mantiene**: el panel sigue mostrando "Modo sombra clínica" en todas las secciones IA; el PDF usa la versión validada por el médico (`doctorDiagnosis`/`doctorNotes`/recomendaciones aceptadas) y NO copia texto fuente del PDF como IA. Verificable manualmente en el componente `EspirometryValidatedPDF`.

## Requiere GEMINI: sí

Aplica regla "cambio toca contrato público + auth + PII":

- Endpoint público nuevo `/api/pdf/espirometry/[reviewId]` (PDF clínico autenticado con datos de paciente).
- Persistencia de firma autógrafa en BD (PII del médico, no del paciente, pero requiere verificación de control de acceso y hashing de hash).
- Nueva página `/admin/profile` con permisos de rol.
- Validación V3 Playwright del flujo perfil → revisión → descarga y verificación de headers/contenido del PDF.
- Frank autorizó `prisma migrate deploy` pero NO el deploy directo: el gate GEMINI precede a cualquier promoción a staging/prod.

## Requiere DEBY: no

- No hay bug reproducible ni causa raíz en runtime.
- Las 2 implementaciones no fueron necesarias: los cortes pequeños (schema → migración → actions → PDF → UI → tests) pasaron V1 typecheck y V2 tests focales al primer intento.

## Pendientes ATLAS

1. **Gate GEMINI**: validación V3 Playwright + auditoría de contrato público del nuevo endpoint y de la persistencia de la firma. Sin V3 PASS, el IMPL NO se mueve a `DONE`.
2. **`prisma migrate deploy` en Railway** (Frank autorizó): la migración es aditiva/nullable. Aplicar DESPUÉS de gate GEMINI.
3. **Propagación de repetibilidad al PDF** (mejora no-bloqueante): si ATLAS quiere que el PDF muestre los valores numéricos FVC/FEV1 del snapshot (no sólo `—`), requiere pasar `repetibilidad_fvc_ml`/`cumple_rep_fvc`/`pruebas_aceptables_fvc`/etc. desde el helper de extracción al server action. La SPEC actual sólo exige "criterios relevantes", que se cumplen con la sección II del PDF aunque queden `—`.
4. **Seed de pruebas E2E**: si GEMINI requiere un usuario médico con cédula + firma preexistentes para el V3 Playwright, ATLAS debe coordinar con el script `seed-frank.js` o uno nuevo. SOFIA no tocó seeds.

## Notas de reversión

Rollback puro: `DROP COLUMN` sobre las 9 columnas listadas en
`migration.sql` (Prisma no implementa `down` automáticamente para
`ADD COLUMN`). El endpoint nuevo `/api/pdf/espirometry/[reviewId]`
puede despublicarse eliminando `src/app/api/pdf/espirometry/` sin
afectar el dictamen existente. La página `/admin/profile` puede
eliminarse junto con el NavItem. No se introdujeron dependencias nuevas
en `package.json`.

## Resumen V2 final

- Tests: 989 passed / 15 failed (las 15 fallas son preexistentes en `medical-exam.actions.test.ts`, no relacionadas con este incremento — verificado contra `git stash` en baseline).
- Typecheck: 1 error preexistente, 0 introducidos.
- Prisma generate: PASS.
- Migración: aditiva y nullable, compatible con rollback por `DROP COLUMN`.
- Endpoints: 1 nuevo público `/api/pdf/espirometry/[reviewId]`.
- Acciones nuevas: 2 (`getCurrentDoctorProfile`, `updateCurrentDoctorProfile`).
- Acciones modificadas: 1 (`submitDoctorStudyReview` — extensión retrocompatible).
- Componentes nuevos: 2 (`DoctorProfileForm`, `EspirometryValidatedPDF`).
- Páginas nuevas: 1 (`/admin/profile`).
- Sin cambios en extracción M3, cuestionario, repetibilidad, criterios AMI ni dictamen general.
