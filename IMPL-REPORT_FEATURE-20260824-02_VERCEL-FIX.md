# IMPL-REPORT — FEATURE-20260824-02 — Fix build Vercel (helper síncrono en módulo `'use server'`)

- **ID intervención:** IMPL-20260824-02-vercel-fix-01
- **ID tarea:** FEATURE-20260824-02 (tercer pase — fix de build)
- **Estado:** READY_FOR_VERIFYING
- **SPEC:** `context/SPECs/SPEC-FEATURE-20260824-02-CUESTIONARIO-ESPIROMETRIA.md`
- **IMPLs previos:** `IMPL-REPORT_FEATURE-20260824-02.md` (UI + persistencia),
  `IMPL-REPORT_FEATURE-20260824-02_GAP-CLINICAL-CONTEXT.md` (gap IA)
- **Origen:** ATLAS (instrucción explícita del operador tras fallo de build Vercel)

## Resumen

Next.js 16 / Turbopack rechaza exports síncronos desde archivos marcados
`'use server'` (los archivos de server actions sólo pueden exportar funciones
`async`). El helper puro `validateEspirometriaQuestionnairePayload` estaba
definido como `export function` dentro de
`frontend/src/actions/espirometria-questionnaire.actions.ts`, lo que rompía
el build Vercel.

Solución mínima y limpia, alineada con el patrón ya existente del codebase
(`study-type-mismatch-note.ts` en `lib/clinical/`):

1. **Mover el helper a un módulo normal** (sin `'use server'`) en
   `frontend/src/lib/clinical/espirometria-questionnaire-validate.ts`.
2. **Eliminar el export síncrono** del archivo de actions. El archivo
   ahora sólo expone `saveEspirometriaQuestionnaire` (`async`) y el type
   `SaveEspirometriaQuestionnaireResult` (erased at compile time).
3. **Actualizar el import en el test** para apuntar al nuevo módulo.
4. **Validación Zod y contrato intactos**: el helper reusa el mismo
   `EspirometriaQuestionnairePayloadSchema`. Sin cambios funcionales.

No se tocó: UI del modal, migración Prisma, integración IA (`clinical_context`),
otros estudios, schema Zod. Solo se reorganizó la ubicación del helper.

## Archivos modificados

- `frontend/src/actions/espirometria-questionnaire.actions.ts`:
  - Bloque de cabecera ampliado con nota `FIX-Vercel-Build (2026-08-25)`.
  - Eliminada la función `validateEspirometriaQuestionnairePayload` y
    el type union que la acompañaba.
  - Eliminado el import muerto del helper (no se usaba en el cuerpo de
    `saveEspirometriaQuestionnaire`; ese action usa Zod inline).
  - Comentario final sobre dónde encontrar el helper puro.
  - Exports del archivo: ahora `SaveEspirometriaQuestionnaireResult` (type)
    + `saveEspirometriaQuestionnaire` (async). Sin exports síncronos.
- `frontend/src/actions/__tests__/espirometria-questionnaire.actions.test.ts`:
  - Import de `validateEspirometriaQuestionnairePayload` redirigido a
    `@/lib/clinical/espirometria-questionnaire-validate`.
  - Comentario de cabecera explicando el fix y por qué se movió.

## Archivos nuevos

- `frontend/src/lib/clinical/espirometria-questionnaire-validate.ts`:
  Helper puro síncrono con la misma validación Zod y mismo retorno
  discriminado `{ valid: true, payload } | { valid: false, error, fieldErrors }`.
  Importa `EspirometriaQuestionnairePayloadSchema` y el tipo
  `EspirometriaQuestionnairePayload`. Docstring explicando el motivo del
  movimiento y la equivalencia con el patrón `study-type-mismatch-note.ts`.

## Contratos

- **Validación Zod intacta:** el helper usa el mismo schema importado
  (`EspirometriaQuestionnairePayloadSchema`). Cero cambios funcionales.
- **Sin cambios en UI, migración, contexto IA ni otros estudios.**
  El fix es puramente de organización de código para desbloquear el
  build Vercel sin tocar el comportamiento del cuestionario.
- **Sin re-exports:** se evaluó la opción de re-exportar el helper
  desde el archivo de actions (`export { validateEspirometria... }`)
  para compat con consumidores existentes, pero los re-exports de
  funciones síncronas desde módulos `'use server'` también pueden ser
  rechazados por Turbopack según la versión. Se eligió la opción
  segura: actualizar imports. El único consumidor era el test, ya
  actualizado.

## Validación

- **typecheck (frontend):** PASS — único error residual en
  `EspirometriaClinicalCriteriaPanel.test.ts:1545` (regex flag `d`,
  preexistente en `main`, no relacionado con este fix).
- **vitest focal:**
  - `espirometria-questionnaire.schema.test.ts`: 15/15 PASS
  - `espirometria-questionnaire.actions.test.ts`: 7/7 PASS
  - `EspirometriaQuestionnaireModal.test.ts`: 7/7 PASS
  - `ai-prediagnosis.clinical-context.test.ts`: 9/9 PASS
  - **Total focal:** 38/38 PASS.
- **vitest global (excluyendo `medical-exam.actions.test.ts` que tiene
  15 fallos preexistentes en `main`):** 884/884 PASS. Mismo baseline
  que antes del fix; sin regresiones.
- **prisma validate:** PASS — `npx prisma validate` →
  `The schema at prisma/schema.prisma is valid`.

## Notas de reversión

Rollback = `git checkout HEAD -- frontend/src/actions/espirometria-questionnaire.actions.ts
frontend/src/actions/__tests__/espirometria-questionnaire.actions.test.ts`
+ `rm frontend/src/lib/clinical/espirometria-questionnaire-validate.ts`.
Restaura el comportamiento original (que rompe el build Vercel).

## Estado devuelto a ATLAS

**READY_FOR_VERIFYING**
