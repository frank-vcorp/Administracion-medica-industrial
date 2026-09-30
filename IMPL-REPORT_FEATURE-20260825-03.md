# IMPL-REPORT — IMPL-FEATURE-20260825-03 — FEATURE-20260825-03 Examen Médico entregable PDF AMI

- **ID intervención:** IMPL-FEATURE-20260825-03 (ronda 2 — QA fixes)
- **ID tarea:** FEATURE-20260825-03
- **Estado:** READY_FOR_VERIFYING
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md`
- **ADR:** `context/decisions/ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md`
- **Discovery refs:** `DEC-20260825-13`, `BR-20260825-14`, `FND-20260825-16`, `FND-20260825-17`, `FND-20260825-18`
- **QA:** `context/reviews/QA-20260825-03-FEATURE-20260825-03.md` (P1-1, P1-2 cerrados; P2-3, P3-1 cerrados reversibles)
- **Origen:** ATLAS (handoff `context/interconsultas/HANDOFF_SPEC-FEATURE-20260825-03_SOFIA.md`)

## Resumen — Ronda 2 (QA fixes)

QA-20260825-03 emitió veredicto `FAIL` con 2 hallazgos P1 (AC-10 y
ruta legacy sin auth) y 2 P2 reversibles (P2-3 gate aptitud, P3-1
fast-path). Esta ronda cierra **todos** los hallazgos dentro del mismo
incremento, sin cambiar schema Prisma (P2-1/P2-2 quedan fuera — el
usuario instruyó "no inventes schema de snapshots") y sin tocar
Audiometría/Espirometría.

Decisiones:
- **P1-1** (AC-10): `COMPANY_CLIENT` queda EXCLUIDO del endpoint nuevo
  `/api/pdf/examen-medico/[eventId]`. El portal corporativo sigue
  accediendo al dictamen REDUCIDO por la ruta legacy
  `/api/pdf/[eventId]` (que es la superficie que ya consumía el portal
  antes de este incremento). Sin acceso al historial clínico completo.
- **P1-2**: la ruta legacy `/api/pdf/[eventId]` ahora exige sesión y
  scope por rol/empresa (paridad con las rutas nuevas). Antes era
  PÚBLICA — el IMPL-REPORT anterior afirmaba erróneamente que ya
  filtraba por empresa (corrección incorporada aquí).
- **P2-3** (reversible, sin schema): gate adicional en el endpoint
  nuevo: `physicalExamData.aptitud` vacía → **409 Conflict** antes de
  regenerar el PDF. El dictamen debe incluir aptitud canónica del
  médico (ADR R6).
- **P3-1** (reversible, sin schema): tras regenerar el PDF en línea
  con persistencia exitosa, se cablea `MedicalVerdict.pdfUrl =
  result.url` para que la próxima descarga use el fast-path
  (paridad con `/api/pdf/espirometry`).

## Cambios — Ronda 2

### Archivos modificados (2)

- `frontend/src/app/api/pdf/examen-medico/[eventId]/route.tsx`:
  - **P1-1**: elimina la rama que autorizaba `COMPANY_CLIENT` (con o sin
    empresa propia) y la reemplaza por un `403` explícito antes del
    lookup del Event. Sólo roles clínicos (SUPERADMIN, DOCTOR_*)
    acceden al PDF consolidado.
  - **P2-3**: añade un gate que rechaza con `409` si
    `physicalExamData.aptitud` está vacía.
  - **P3-1**: tras la regeneración en línea, si `result.url` está
    presente y `verdict.pdfUrl` aún vacío, escribe
    `MedicalVerdict.pdfUrl = result.url` para cablear el fast-path.
- `frontend/src/app/api/pdf/[eventId]/route.tsx`:
  - **P1-2**: añade `getServerSession` + scope por rol/empresa. Sin
    sesión → 401; roles no clínicos y no-COMPANY_CLIENT → 403;
    COMPANY_CLIENT con `worker.companyId !== session.user.companyId`
    → 403; COMPANY_CLIENT con SU empresa → 200; DOCTOR_*/SUPERADMIN
    → 200. Filename `Dictamen-<universalId>.pdf` se mantiene.

### Archivos creados — Ronda 2 (1)

- `frontend/src/app/api/pdf/[eventId]/__tests__/route.test.ts`: 10
  tests V1 cubriendo el fix P1-2 — sin sesión → 401; CAPTURIST/
  RECEPTIONIST → 403; COMPANY_CLIENT empresa ajena → 403; COMPANY_CLIENT
  SU empresa → 200; COMPANY_CLIENT sin companyId → 403; DOCTOR_*/
  SUPERADMIN → 200; verdict inexistente → 404; fast-path desde disco.

### Archivos modificados — tests (1)

- `frontend/src/app/api/pdf/examen-medico/[eventId]/__tests__/route.test.ts`:
  - **P1-1 regresión**: 2 nuevos tests `COMPANY_CLIENT` (misma y otra
    empresa) → 403 sin lookup. Eliminado el test anterior que afirmaba
    `COMPANY_CLIENT → 200`.
  - **P2-3 regresión**: 2 nuevos tests con `physicalExamData.aptitud`
    vacía/undefined → 409.
  - **P3-1 regresión**: 2 nuevos tests — tras regenerar con persistencia
    exitosa se cablea `MedicalVerdict.pdfUrl`; sin persistencia (Vercel
    serverless) NO se escribe.

### Archivos modificados — comentarios (1)

- `frontend/src/lib/examen-medico-pdf.tsx`: comentario de privacidad
  corregido — antes afirmaba que la ruta legacy ya estaba autenticada
  (FND-20260825-18 P1-2 demostró que era falso). Ahora describe la
  separación: el endpoint nuevo sirve el consolidado clínico (sólo
  clínicos), el legacy sirve el dictamen reducido (también autenticado
  tras P1-2).

## Archivos del incremento (round 1 + round 2)

**Creados (6):**
- `frontend/src/components/pdf/ExamenMedicoValidatedPDF.tsx`
- `frontend/src/lib/examen-medico-pdf.tsx`
- `frontend/src/lib/__tests__/examen-medico-pdf.test.ts` (16 tests)
- `frontend/src/app/api/pdf/examen-medico/[eventId]/route.tsx`
- `frontend/src/app/api/pdf/examen-medico/[eventId]/__tests__/route.test.ts` (17 tests, +5 vs round 1)
- `frontend/src/app/api/pdf/[eventId]/__tests__/route.test.ts` (10 tests, NUEVO en round 2)

**Modificados (2):**
- `frontend/src/app/api/pdf/examen-medico/[eventId]/route.tsx` (round 2)
- `frontend/src/app/api/pdf/[eventId]/route.tsx` (round 2 — P1-2)

## Trazabilidad AC-7 / AC-10 (foco QA)

- **AC-7** (impresión/restricciones/observaciones asociadas a la
  revisión firmante):
  - QA-20260825-03 §P2-2 señala que `aptitud/restricciones/
    observaciones_finales` se leen de `physicalExamData` vivo y no
    del verdict firmado. **Esta ronda NO corrige P2-2** — el usuario
    instruyó "no inventes schema de snapshots". El PDF sigue leyendo
    del snapshot persistido en `physicalExamData` con fallback al
    snapshot del `MedicalVerdict.finalDiagnosis` para
    `impresionDiagnostica`. La regeneración sigue siendo
    reproducible con los mismos snapshots congelados
    (`MedicalVerdict.signedAt`, validator.*, physicalExamData).
- **AC-10** (no filtra datos clínicos al portal corporativo):
  - **CERRADO P1-1**: `COMPANY_CLIENT` recibe `403` en
    `/api/pdf/examen-medico/[eventId]` antes de cualquier lookup o
    generación. El portal corporativo NO tiene acceso al PDF clínico
    consolidado. La superficie del portal sigue siendo el dictamen
    reducido por `/api/pdf/[eventId]` (también autenticado tras P1-2).
  - Tests de regresión P1-1: ver §Validación.

## Validación

| Etapa | Estado | Comando / evidencia |
|---|---|---|
| baseline (pre-incremento) | 1107 passed / 15 failed | `cd frontend && npx vitest run` (las 15 fallas son en `medical-exam.actions.test.ts`, preexisting en `main`) |
| baseline typecheck | 1 error preexisting | `cd frontend && npx tsc --noEmit` (`EspirometriaClinicalCriteriaPanel.test.ts:1545`, flag regex `d` ES2018) |
| **V1 typecheck (round 2)** | PASS — sólo el error preexisting | `cd frontend && npx tsc --noEmit` |
| **V1 focal tests (round 2)** | 43/43 PASS | `cd frontend && npx vitest run src/lib/__tests__/examen-medico-pdf.test.ts src/app/api/pdf/examen-medico/[eventId]/__tests__/route.test.ts src/app/api/pdf/[eventId]/__tests__/route.test.ts` |
| **V2 suite completa (round 2)** | 1150 passed / 15 failed | `cd frontend && npx vitest run` (+15 vs round 1: +5 endpoint nuevo +10 legacy; las 15 fallas son las mismas preexistentes en `medical-exam.actions.test.ts`) |
| **V3 Playwright** | NO EJECUTADA — depende de BD sembrada + GEMINI (gate reservado) | n/a |
| **npx next build** | PASS | `cd frontend && npx next build` — compila limpio (16.8s); rutas `/api/pdf/[eventId]` y `/api/pdf/examen-medico/[eventId]` registradas como ƒ (Dynamic) |
| Smoke contra BD real | NO EJECUTADA — el sandbox local no tiene `DATABASE_URL` accesible | n/a |

## Trazabilidad P1-1 / P1-2 / P2-3 / P3-1 → test de regresión

### P1-1 (FND-20260825-18) — AC-10
- `route.tsx:64-69` rechaza `COMPANY_CLIENT` con 403 antes del lookup.
- Tests `route.test.ts`:
  - `REGRESIÓN P1-1: COMPANY_CLIENT con SU empresa → 403 (portal NO
    recibe PDF clínico)` — verifica status 403 + sin lookup +
    `mockGenerateExamenMedicoValidatedPdf` no llamado + body sin PII
    (no menciona "Juan", "Pérez", "Dra. María", cédula).
  - `REGRESIÓN P1-1: COMPANY_CLIENT con OTRA empresa → 403` — mismo
    set de asserts.

### P1-2 — ruta legacy sin auth
- `route.tsx:8-39` añade sesión obligatoria + scope por rol/empresa.
- Tests `route.test.ts` (legacy):
  - `sin sesión → 401 y NO se consulta el verdict (antes era
    PÚBLICA)`.
  - `rol no autorizado (CAPTURIST) → 403 y NO se consulta el verdict`.
  - `rol no autorizado (RECEPTIONIST) → 403 y NO se consulta el
    verdict`.
  - `COMPANY_CLIENT con OTRA empresa → 403 (IDOR bloqueado)`.
  - `COMPANY_CLIENT con SU empresa → 200 (portal corporativo recibe
    dictamen reducido)`.
  - `COMPANY_CLIENT sin companyId en sesión → 403 (no puede
    scope-ar)`.
  - `DOCTOR_GENERAL puede descargar cualquier Event`.
  - `SUPERADMIN puede descargar CUALQUIER Event`.
  - `verdict inexistente → 404 genérico (no enumera)`.
  - `fast-path: si verdict.pdfUrl existe en disco, se sirve SIN
    regenerar`.

### P2-3 — gate ADR R6
- `route.tsx:152-163` rechaza con 409 si `physicalExamData.aptitud`
  vacía.
- Tests `route.test.ts`:
  - `REGRESIÓN P2-3: aptitud vacía en physicalExamData → 409 (gate
    ADR R6)`.
  - `REGRESIÓN P2-3: aptitud undefined en physicalExamData → 409`.

### P3-1 — fast-path cableado
- `route.tsx:478-499` persiste `MedicalVerdict.pdfUrl = result.url` tras
  regenerar con éxito.
- Tests `route.test.ts`:
  - `REGRESIÓN P3-1: tras regenerar con persistencia exitosa, se
    cablea MedicalVerdict.pdfUrl` — verifica que
    `medicalVerdict.update` se llama con `{ where: { eventId },
    data: { pdfUrl: 'examen-medico-pdfs/event-1.pdf' } }`.
  - `REGRESIÓN P3-1: sin persistencia (Vercel serverless) NO se
    escribe MedicalVerdict`.

## Guardrails respetados

- **P1-1**: sin cambios en Audiometría/Espirometría; sin schema
  Prisma; sin commit/push/deploy.
- **P1-2**: la superficie legacy servida al portal corporativo se
  mantiene (sigue siendo el dictamen reducido). Sólo se añade auth +
  scope; el filename `Dictamen-<universalId>.pdf` y el componente
  `MedicalDictamenPDF` no cambian.
- **P2-3**: gate reversible — eliminar el bloque 152-163 revierte a la
  regla round-1 (sin gate).
- **P3-1**: cableado reversible — eliminar el bloque 478-499 revierte
  a la regla round-1 (sin persistencia del pdfUrl tras regenerar).
- **P2-1, P2-2**: NO se abordaron en esta ronda por instrucción
  explícita del usuario ("no inventes schema de snapshots"). Quedan
  como pendientes ATLAS (schema + SPEC/ADR nuevos).

## Riesgos y desviaciones

- **Riesgo bajo (puerta COMPANY_CLIENT cerrada)**: cualquier cliente
  portal que previamente descargaba este PDF verá ahora 403. Esto es
  el contrato correcto: el portal debe consumir el dictamen por la
  ruta legacy (que sigue funcionando con scope por empresa). Si
  ATLAS necesita exponer un "certificado de aptitud" reducido por el
  endpoint nuevo, requiere SPEC/ADR adicionales.
- **Riesgo bajo (409 aptitud vacía)**: si el médico no guardó
  aptitud antes de generar el PDF, verá 409 y deberá completar la
  aptitud en la papeleta. Esto es la regla ADR §R6 declarada.
- **Riesgo bajo (pdfUrl se cablea)**: el comportamiento es
  best-effort — si la persistencia falla (FS no escribible) el
  endpoint sigue regenerando en cada descarga (paridad con
  `/api/pdf/espirometry`).

## Requiere GEMINI

Sí, en el gate final V3 (Playwright): el SPEC reserva V3 a GEMINI.
Esta implementación entrega todos los `data-testid`/contratos
necesarios para que el test Playwright recorra el flujo del
Examen Médico: rol clínico autenticado → descarga de
`/api/pdf/examen-medico/<eventId>` → 200 con filename
`ExamenMedico-<universalId>.pdf`; COMPANY_CLIENT autenticado → 403;
sesión legacy `/api/pdf/<eventId>` con COMPANY_CLIENT en SU empresa
→ 200 con `Dictamen-<universalId>.pdf`; COMPANY_CLIENT OTRA empresa
→ 403; sin sesión → 401 en ambas rutas; verificación de headers,
paridad de identidad congelada y separación de pacientes entre
Events.

Regla aplicable: el cambio toca UI/PDF clínico + auth + PII +
regresión de seguridad de la ruta legacy.

## Requiere DEBY

No. Sin bugs reproducible, sin crashes, sin race conditions, sin
leaks. Validación V1+V2 focal verde y `npx next build` PASS. No hay
síntomas que requieran diagnóstico fuera del alcance del incremento.

## Pendientes ATLAS

- **P2-1** (snapshot congelado de identidad médica en
  `MedicalVerdict`): requiere columna Prisma nueva; NO abordado en
  esta ronda por instrucción de no inventar schema. Cuando ATLAS
  defina la migración, el helper debe leer de
  `MedicalVerdict.validatorSnapshot*` en lugar del `User.validator`
  vivo.
- **P2-2** (snapshot congelado de aptitud/restricciones/observaciones
  en `MedicalVerdict`): igual a P2-1; requiere columnas Prisma nuevas
  (o congelar el hash del render exacto). NO abordado por la misma
  razón.
- **Gate V3 Playwright**: pendiente de entorno autorizado (BD sembrada
  + sesión). Sin él, el incremento permanece `VERIFYING` (no se
  mueve a `DONE`).

## Notas de reversión

Rollback puro: eliminar los 6 archivos nuevos + revertir los 2
archivos modificados (`route.tsx` del endpoint nuevo +
`route.tsx` legacy) con `git checkout` desde `main`. No hay
migración Prisma. No hay cambios en Audiometría/Espirometría. No se
introdujeron dependencias nuevas en `package.json`. No se realizó
commit, push, PR ni deploy — se devuelve para verificación
contractual ATLAS y gate GEMINI.

## Estado devuelto a ATLAS

**READY_FOR_VERIFYING**