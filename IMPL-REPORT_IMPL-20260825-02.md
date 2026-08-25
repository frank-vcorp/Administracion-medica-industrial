# IMPL-REPORT — IMPL-20260825-02 — Fix QA-20260825-01 (PDF Espirometría validada)

- **Estado:** READY_FOR_VERIFYING
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260825-01-PDF-ESPIROMETRIA-VALIDADA.md`
- **Auditor origen:** QA-20260825-01 (FAIL → re-trabajo SOFIA → re-verificación GEMINI)
- **Reporte previo:** `IMPL-REPORT_IMPL-20260825-01.md` (READY_FOR_VERIFYING, FAIL QA)

## Resumen ejecutivo

Cierre de los hallazgos P1/P2/P3 señalados por QA-20260825-01 sin
ampliar alcance y sin tocar contratos protegidos (extracción M3,
cuestionario, repetibilidad AMI original, criterios AMI, dictamen
general). Se introdujo gate de sesión en `submitDoctorStudyReview`
(P1-A), se reubicó la página de perfil fuera de `/admin/*` (P1-B), se
aplicó scope por objeto al endpoint de descarga (P2-C), se propagó la
repetibilidad real del snapshot al PDF (P2-D) y se cerraron los 4 P3
relevantes. Sin commit/push/migración. Listo para gate GEMINI.

## Hallazgos cerrados (referencia QA-20260825-01)

### P1-A — Suplantación de identidad: `reviewedByUserId` ya NO viene del cliente
**Archivos:** `frontend/src/actions/ai-prediagnosis.actions.ts`, `frontend/src/actions/__tests__/ai-prediagnosis.espirometry-pdf.test.ts`

Cambios:
- Import de `getServerSession` + `authOptions` en `ai-prediagnosis.actions.ts`.
- Constante `AUTHORIZED_REVIEWER_ROLES = {SUPERADMIN, DOCTOR_GENERAL, DOCTOR_VALIDATOR}`.
- Al inicio de `submitDoctorStudyReview` se hace `getServerSession(authOptions)`. Sin sesión → `{success:false, error:'No autenticado'}`. Rol no autorizado → `{success:false, error:'Sin permisos para emitir revisión médica'}`. Ningún caso hace `user.findUnique` ni `doctorStudyReview.create`.
- El campo `input.reviewedByUserId` se extrae con prefijo `_clientReviewedByUserId` para que TS no se queje y deje claro al lector que NO SE USA.
- `reviewedByUserId` efectivo = `session.user.id`.
- El `User.findUnique` para congelar firma/cédula se hace por `session.user.id`, no por el valor del cliente.

Tests nuevos (en `ai-prediagnosis.espirometry-pdf.test.ts`):
1. `rechaza la revisión cuando NO hay sesión` — verifica 401-style failure y que NO se consulta `User.findUnique`.
2. `rechaza la revisión cuando el rol no está autorizado (CAPTURIST)` — idem.
3. `rechaza la revisión cuando el rol no está autorizado (RECEPTIONIST)` — idem.
4. `IGNORA reviewedByUserId del cliente y usa el de la sesión para congelar identidad` — envía `reviewedByUserId: 'otro-user-falso'` y verifica que sólo se consultó al usuario de sesión y que la identidad congelada es la del session user.

### P1-B — Página `/admin/profile` inaccesible para médicos
**Archivos movidos:** `frontend/src/app/admin/profile/page.tsx` → `frontend/src/app/profile/page.tsx`.
**Archivos ajustados:** `frontend/src/components/AppShell.tsx`, `frontend/src/actions/doctor-profile.actions.ts`, `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`.

Cambios:
- Ruta movida a `/profile` (FUERA de `/admin/*`).
- `middleware.ts` sin cambios: no bloquea `/profile` y por tanto los roles médicos acceden sin rebote.
- El gate de rol vive en `app/profile/page.tsx` (redirect al dashboard si no aplica) + en `doctor-profile.actions.ts` como defensa redundante.
- NavItem actualizado a `href="/profile"`.
- `revalidatePath('/admin/profile')` → `revalidatePath('/profile')`.
- Link "Ir al perfil" en el banner de error del panel actualizado a `/profile`.

### P2-C — IDOR en endpoint de descarga
**Archivos:** `frontend/src/app/api/pdf/espirometry/[reviewId]/route.tsx`, `frontend/src/app/api/pdf/espirometry/[reviewId]/__tests__/route.test.ts`.

Cambios:
- Sesión obligatoria (401 sin sesión).
- Rol debe estar en `REVIEWER_ROLES = {SUPERADMIN, DOCTOR_GENERAL, DOCTOR_VALIDATOR}`; 403 si no.
- Scope por objeto: `if (!isSuperAdmin && review.reviewedByUserId !== session.user.id)` → 403 con cuerpo genérico (NO se filtra nombre, UUID, ni diagnóstico del review ajeno).
- 404 genérico para revisión inexistente (no enumera IDs).
- REVIEWED_REJECTED → 404 (sin PDF por contrato de SPEC), incluso para el médico que emitió la revisión.

Tests nuevos (`route.test.ts`, 9 casos):
1. Sin sesión → 401, NO se consulta `DoctorStudyReview.findUnique`.
2. CAPTURIST → 403, NO se consulta.
3. RECEPTIONIST → 403, NO se consulta.
4. DOCTOR_GENERAL con revisión ajena → 403 + body NO contiene nombre/UUID/diagnóstico del paciente (assertions explícitas sobre el body).
5. DOCTOR_GENERAL con SU PROPIA revisión → 200 + `Content-Type: application/pdf` + `Content-Disposition: inline; filename="Espirometria-..."`.
6. SUPERADMIN con revisión ajena → 200 (acceso total).
7. REVIEWED_REJECTED → 404, NO se llama al generador.
8. Revisión inexistente → 404 genérico.
9. Fast-path disco → sirve sin llamar al generador; verifica que el path NO contiene `uploads/uploads/` (P3-E).

### P2-D — Repetibilidad real del snapshot al PDF
**Archivos:** `frontend/src/lib/espirometry-pdf.tsx`, `frontend/src/lib/__tests__/espirometry-pdf.test.ts`.

Cambios:
- Nuevo helper `extractRepetibilidadFromExtraction(structuredData)` reutiliza `resolveCriteria` (mismo cálculo determinista que `EspirometriaClinicalCriteriaPanel`, sin recalcular). Soporta tanto `{extracted_data: {calidad, parametros}}` como root directo.
- `resolveRepetibilidadForPdf` YA NO devuelve `null` cuando los valores están vacíos; siempre devuelve objeto (`EspirometryRepetibilidadForPdf`) para que la sección II del PDF se renderice aunque los valores sean `—`. Esto cumple el AC de la SPEC §"Contenido": "criterios de repetibilidad".
- Booleanos ≤150 ml se derivan desde el numérico (`SI/NO/NULL` → `true/false/null`) aplicando BR-20260824-01 (umbral AMI = 150 ml).
- `REPETIBILIDAD_UMBRAL_ML = 150` exportado como constante para evitar drift.

Tests nuevos (`espirometry-pdf.test.ts`, 14 casos):
- `extractValidatedRecommendationsFromPredx`: 5 casos (unión, EDITED omite, dedup, ignora no-string, vacío).
- `extractRepetibilidadFromExtraction`: 4 casos (extrae de `calidad`, deriva booleano, root sin `extracted_data`, vacío).
- `resolveRepetibilidadForPdf`: 2 casos (construye siempre objeto; sección II nunca oculta).
- `buildEspetibilidadPdfData`: 3 casos (integración ACCEPTED con recomendaciones+repetibilidad; EDITED omite IA; paciente sin nombre no rompe).

### P3-E — Doble `uploads/` en fast-path
**Archivos:** `frontend/src/lib/espirometry-pdf.tsx`, `frontend/src/app/api/pdf/espirometry/[reviewId]/route.tsx`.

Cambios:
- Escritura: `url = 'espirometry-pdfs/<reviewId>.pdf'` (sin prefijo `uploads/`).
- Lectura en route: `path.join(REPO_UPLOAD_DIR, validatedPdfUrl)` = `<repo>/uploads/espirometry-pdfs/<reviewId>.pdf` (sin duplicación).
- Test 9 del route verifica el path explícitamente: `expect(String(pathArg)).not.toMatch(/uploads\/uploads/)`.

### P3-F — Divergencia contenido action vs route
**Archivos:** `frontend/src/lib/espirometry-pdf.tsx`.

Cambios:
- Helpers puros compartidos `extractValidatedRecommendationsFromPredx` y `buildEspetibilidadPdfData` se usan tanto en `submitDoctorStudyReview` como en la API route. Antes la action leía `recommendation + recommendations[] + recommended_actions[]` y la route sólo `recommendation` → contenido divergente en regeneración.
- Mismo hash cuando las entradas no cambian.

### P3-G — Fallback de logo inalcanzable
**Archivos:** `frontend/src/lib/espirometry-pdf.tsx`, `frontend/src/components/pdf/EspirometryValidatedPDF.tsx`.

Cambios:
- `resolveAmiLogoDataUrl()` descarga el logo UNA VEZ por proceso Node (cacheado en memoria). Si la red está caída al boot, devuelve `null` y el componente PDF usa el fallback de texto "AMI" sin lanzar excepción.
- Antes: `logoUrl` siempre era la URL remota → el componente `Image` de `@react-pdf/renderer` fallaba si la red estaba caída y el caller recibía excepción.
- El campo `logoUrl` ahora acepta data-URL o string vacío (`''` = fallback texto).

### P3-H — Doc/comentario en `doctor-profile.actions.ts`
**Archivos:** `frontend/src/actions/doctor-profile.actions.ts`.

Cambios:
- Reescrito el doc-comment: aclara que la acción opera SIEMPRE sobre el usuario en sesión (no expone variante para SUPERADMIN→otro médico). El comportamiento real coincide con el documento.

### P3-I — Schema de firma admitía `http://`
**Archivos:** `frontend/src/schemas/clinical/doctor-profile.schema.ts`.

Cambios:
- Quitada la rama `v.startsWith('http://')` del `refine`. La firma sólo acepta `data:image/`, `/uploads/` o `https://`. Docstring actualizado.

## Validación

| Etapa | Estado | Comando / evidencia |
|---|---|---|
| Baseline preexistente | typecheck: 1 error preexistente `EspirometriaClinicalCriteriaPanel.test.ts(1545,74) TS1501` | `cd frontend && npx tsc --noEmit` |
| baseline preexistente | tests: 1 archivo fallido / 15 tests fallidos en `medical-exam.actions.test.ts` | `cd frontend && npx vitest run` (verificado en IMPL-REPORT previo) |
| **V1 typecheck** | PASS — sólo el error preexistente, 0 nuevos | `cd frontend && npx tsc --noEmit` |
| **V1 prisma generate** | PASS | `cd frontend && npx prisma generate` |
| **V1 prisma validate** | PASS (con `DATABASE_URL` dummy) | `DATABASE_URL=... npx prisma validate` → `The schema at prisma/schema.prisma is valid 🚀` |
| **V1 tests focales (47/47)** | PASS — 14 doctor-profile + 14 espirometry-pdf + 9 route + 10 action | `cd frontend && npx vitest run src/lib/__tests__/espirometry-pdf.test.ts src/actions/__tests__/ai-prediagnosis.espirometry-pdf.test.ts src/app/api/pdf/espirometry/[reviewId]/__tests__/route.test.ts src/schemas/clinical/__tests__/doctor-profile.schema.test.ts` |
| **V2 suite completa** | 49 archivos / 1016 tests passed / 15 failed (preexistentes, no introducidos). +27 tests vs. baseline: 14 espirometry-pdf + 9 route + 4 nuevos auth/IDOR en action test. | `cd frontend && npx vitest run` |
| **V2 build/lint** | NO EJECUTADA — V3 + build + lint dependen del gate GEMINI y autorización Frank. | n/a |
| **V3 Playwright** | NO EJECUTADA — bloqueado en sandbox sin BD sembrada + autorización Frank (igual que IMPL-REPORT previo). | n/a |
| **Ejecución contra BD real** | NO EJECUTADA — sin `DATABASE_URL` accesible. Migración es aditiva y nullable, no rompe filas existentes. Aplicar `prisma migrate deploy` en Railway tras gate GEMINI. | n/a |

## Trazabilidad por hallazgo

| Hallazgo | Evidencia de cierre |
|---|---|
| P1-A | `getServerSession` agregado al action; `reviewedByUserId` efectivo de sesión; tests 1–4 en `ai-prediagnosis.espirometry-pdf.test.ts` |
| P1-B | Página movida de `/admin/profile` → `/profile`; NavItem actualizado; middleware NO bloquea `/profile`; gate redundante en page+action |
| P2-C | Route valida sesión + rol + `reviewedByUserId === session.user.id` salvo SUPERADMIN; tests 1–9 en `route.test.ts` |
| P2-D | `extractRepetibilidadFromExtraction` + `resolveRepetibilidadForPdf` (siempre objeto); tests 4–6 en `espirometry-pdf.test.ts` |
| P3-E | URL persistida sin prefijo `uploads/`; lectura sin duplicación; test 9 verifica path |
| P3-F | Helper `buildEspetibilidadPdfData` único consumido por action y route; tests de integración |
| P3-G | `resolveAmiLogoDataUrl` cacheado en memoria + fallback texto |
| P3-H | Doc comment alineado con comportamiento real |
| P3-I | Schema rechaza `http://` (sólo `data:`, `/uploads/` o `https://`) |

## Contratos públicos

**Sin cambios.** La firma de `submitDoctorStudyReview` se preserva
(retrocompatible: clientes existentes siguen enviando `reviewedByUserId`
que se IGNORA silenciosamente). El endpoint `/api/pdf/espirometry/[reviewId]`
mantiene su contrato HTTP (200 + PDF, 401, 403, 404). Los nuevos campos
de `DoctorStudyReviewResult` (`pdfGenerated`, `pdfErrorMessage`) son
opcionales y no rompen callers que sólo inspeccionan `success/error/reviewId`.

No se tocaron:
- Extracción M3, prompt clínico, criterios AMI, repetibilidad del
  panel clínico (`EspirometriaClinicalCriteriaPanel.resolveCriteria` se
  REUTILIZA sin modificar — `extractRepetibilidadFromExtraction` sólo lo
  invoca).
- Cuestionario de Espirometría (`espirometria-questionnaire.schema.ts`).
- Dictamen general (`MedicalVerdict`).
- `api/pdf/[eventId]` (dictamen) — sigue sin gate de auth (deuda
  preexistente, fuera del scope).

## Riesgo operativo

- **Migración Prisma** sigue aditiva y nullable. Sin cambios desde
  IMPL-REPORT previo. No aplicada en ningún entorno.
- **Persistencia de firma** como data-URL (~5 MB máx por schema). Ahora
  el control de acceso está cerrado por P1-A y P2-C.
- **Logo remoto** cacheado en memoria del proceso Node. Si el proceso se
  reinicia, re-descarga al primer PDF. En Vercel serverless cada
  invocación puede re-descargar; sigue el patrón "regenera en cada
  descarga".
- **Rollback**: idéntico al IMPL previo. La nueva ruta `/profile` puede
  eliminarse + revertir NavItem.

## Requiere GEMINI: sí

Mismas reglas aplicables que IMPL-REPORT previo + los nuevos puntos:
- **Cambios de seguridad (P1-A, P2-C)**: requieren re-auditoría
  contractual. El gate de sesión y el scope por objeto son los hallazgos
  más sensibles.
- **V3 Playwright** del flujo completo: login DOCTOR_GENERAL →
  /profile → cargar firma → volver a papeleta → aceptar revisión
  espirometría → descargar PDF → verificar headers `Content-Type` +
  `Content-Disposition` + sección II con valores de repetibilidad del
  snapshot (no `—`).
- **Frank autorizó `prisma migrate deploy`** pero NO el deploy directo.

## Requiere DEBY: no

- No hay bug reproducible ni causa raíz en runtime.
- Todos los cortes pasaron al primer intento. Sin iteración.

## Pendientes ATLAS

1. **Gate GEMINI** (requerido): V3 Playwright + auditoría de los nuevos
   gates de seguridad + V2 del endpoint con sesión real.
2. **`prisma migrate deploy` en Railway** tras gate GEMINI.
3. **Deuda preexistente**: `/api/pdf/[eventId]` (dictamen) sigue sin
   auth. Registrar para backlog (no contabiliza contra este veredicto).

## Resumen V2 final

- Tests: 1016 passed / 15 failed (15 fallas preexistentes no
  relacionadas). +27 nuevos tests pasan.
- Typecheck: 0 nuevos errores.
- Prisma validate: PASS.
- Prisma generate: PASS.
- Schema sin cambios desde IMPL previo (migración aditiva intacta).
- Endpoints: 1 nuevo público `/api/pdf/espirometry/[reviewId]`
  (ahora con scope por objeto).
- Acciones modificadas: 1 (`submitDoctorStudyReview` — gate de sesión
  añadido retrocompatible).
- Páginas movidas: 1 (`/admin/profile` → `/profile`).
- Sin cambios en extracción M3, cuestionario, repetibilidad AMI
  original, criterios AMI ni dictamen general.
