# IMPL-REPORT — ARCH-20260820-01-FASE2B
Intervención: IMPL-20260820-01
Tarea: ARCH-20260820-01-FASE2B
Estado: **READY_FOR_VERIFYING**
Fecha: 2026-08-20
SPEC: `context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1
ADR: `context/decisions/ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md` v1.1
Handoff: `context/interconsultas/HANDOFF_ARCH-20260820-01_FASE2B_SOFIA_EDITOR-V3.md`
Discovery refs: DEC-20260820-03, DEC-20260820-02, DEC-20260820-01, BR-20260820-01

## Resumen

Cierre del cableado de UI de la Fase 2 de ARCH-20260820-01. La pantalla
`/admin/services/[id]/calibration` ahora identifica el estado V3 del
contrato `aiCalibration` (draft/tested/published), permite guardar como
`draft` o `tested`, y expone el botón "Publicar" con gates G0…G9 visibles
(G5/G8/G9 como N/A justificados). `manual_service` muestra sólo el aviso
"sin editor". RBAC: `canEdit` (ADMIN+) controla la visibilidad del editor;
`canPublish` (SUPERADMIN) controla el botón publicar. Acciones backend
(`saveAICalibrationV3`, `publishAICalibrationV3`) y tipos V3 permanecen
intactos.

## Archivos modificados / creados

```
EDITAR
  frontend/src/app/admin/services/[id]/calibration/page.tsx
  frontend/src/components/calibration/CalibrationWorkspaceClient.tsx
  frontend/src/components/calibration/AICalibrationEditor.tsx

CREAR
  frontend/src/lib/calibration-v3-ui.ts
  frontend/src/components/calibration/CalibrationV3StatusPanel.tsx
  frontend/src/components/calibration/__tests__/calibration-v3-ui.test.ts
```

NO TOCAR (contratos protegidos — verificado vía `git diff`):
`frontend/src/actions/calibration-v3.actions.ts`,
`frontend/src/lib/calibration-v3-shared.ts`,
`frontend/src/types/calibration.ts`, `backend/**`, Prisma/migraciones,
`arch-20260819-02-tarjetas-muestra`.

## Contratos

- `CalibrationWorkspaceClientProps`: añadidos `aiCalibrationV3`,
  `operationMode`, `canEdit`, `canPublish` (no se eliminó ningún prop existente).
- `AICalibrationEditorProps`: añadidos `initialStatus` (default `"draft"`)
  y `onSaved?: (status) => void` (ambos opcionales, retrocompatibles).
- `buildDraftV3FromEditorState` input: añadido `status?: "draft" | "tested"`
  (default `"draft"`). El `return.draft.status` lo respeta.
- Nuevos tipos exportados: `CalibrationV3UIState`,
  `PublishGateVisibility`, `PublishErrorMap`; funciones
  `describeCalibrationV3State`, `coerceV3DraftToEditorInitial`,
  `getPublishGateVisibility`, `mapPublishErrorCode`, `isOperationModeValue`
  (todas en `calibration-v3-ui.ts`).
- Resto de contratos públicos: sin cambios.

## Validación

| Gate | Estado | Comando / evidencia |
|---|---|---|
| baseline typecheck | PASS | `npm run typecheck` → 0 errores |
| tests focalizados | PASS | `npx vitest run src/components/calibration/__tests__/calibration-v3-ui.test.ts src/actions/__tests__/calibration-v3.actions.test.ts` → **65/65 PASS** (24 nuevos + 41 existentes) |
| lint focal | PASS | `npm run lint -- src/components/calibration/AICalibrationEditor.tsx src/components/calibration/CalibrationWorkspaceClient.tsx src/components/calibration/CalibrationV3StatusPanel.tsx src/lib/calibration-v3-ui.ts src/app/admin/services/[id]/calibration/page.tsx` → 0 errors / 0 warnings |
| build Vercel | PASS | `npx prisma generate && npx next build` → SUCCESS. Ruta `/admin/services/[id]/calibration` lista como `ƒ (Dynamic)`. 0 errores. |

### Tests completos (suite vitest)

`npm test` → **33 archivos pasan, 1 falla (pre-existente, no relacionado)**.

- Pre-existente: `src/actions/__tests__/medical-exam.actions.test.ts` con
  15 fallos en `ImpresiónAptitudSchema.parse` (línea 1085; campos
  `estado_nutricional`/`salud_bucal` esperados como string). Pertenece a
  IMPL-20260817-07/IMPL-20260817-08, fuera del scope ARCH-20260820-01.
  Presente en baseline antes de mi sesión (verificado al inicio).
- Mi scope: 24 nuevos + 41 existentes en `calibration-v3.actions.test.ts`
  → **65 PASS**.

### Lint baseline

Los 2 errors en `calibration-v3-shared.ts` (`require()` de `node:crypto`)
son pre-existentes y protegidos por el handoff (no se puede tocar). Misma
cantidad antes y después de mi sesión.

## Trazabilidad AC-2B

| AC | Criterio | Evidencia |
|---|---|---|
| **AC-2B.1** | `page.tsx` parsea `operationMode` (válido/null) y `schemaVersion==='V3'`; deriva `canEdit`/`canPublish` de la sesión. | `page.tsx` líneas 78-103 (parseo con `isOperationModeValue`), líneas 105-115 (raíz V3), líneas 117-121 (RBAC server-side via `isAdminLike`/`isSuperAdmin`). `npm run typecheck` 0 errores. `npm run build` OK. |
| **AC-2B.2** | `describeCalibrationV3State` cubre `isManualService`, `currentPublishedVersion`, `supersededCount`. | Tests 1-9 + CB-2B-1 en `calibration-v3-ui.test.ts`. 9 casos en `describeCalibrationV3State` + 2 en CB-2B-1. |
| **AC-2B.3** | `coerceV3DraftToEditorInitial` mapea `clinicalCriteria→diagnosis`, `extraction→extraction`, `fieldDefinitions/presentation` intactos; `clinicalCriteria=null` → `diagnosis={enabled:false,prompt:""}`. | 3 tests en `describe("coerceV3DraftToEditorInitial")`: caso clínico completo, `document_extraction` (CB-2B-2), defaults seguros. |
| **AC-2B.4** | `buildDraftV3FromEditorState` respeta `status` (`draft`/`tested`, default `draft`); UI permite elegir. | `AICalibrationEditor.tsx` líneas 199-213 (input.status), 258-259 (destructure), 292 (`status ?? "draft"`); radio UI "Guardar como" (líneas 612-643); `initialStatus` prop tipado. Los 41 tests existentes de `calibration-v3.actions.test.ts` que mockean `saveAICalibrationV3` siguen pasando (el `status` por defecto "draft" preserva comportamiento). |
| **AC-2B.5** | Editor se precarga desde draft V3 (`coerceV3DraftToEditorInitial`) o raw V1/V2 si no hay draft; `document_extraction` sin sección clínica. | `CalibrationWorkspaceClient.tsx` líneas 459-469: `initial = aiCalibrationV3?.draft ? coerceV3DraftToEditorInitial(...) : initialRawCalibration`. `getEditorSectionsForOperationMode` (42-70, AICalibrationEditor) ya ocultaba sección clínica para `document_extraction` (CB-14, tests 4 en calibration-v3.actions.test.ts). |
| **AC-2B.6** | Panel muestra `operationMode`, draft (`draft`/`tested`/ninguno), `currentPublishedVersion`, `supersededCount`. | `CalibrationV3StatusPanel.tsx` líneas 60-115 (header + grid 3 cards). `data-testid="calibration-v3-draft-status"` y `calibration-v3-published-version`. |
| **AC-2B.7** | "Publicar" solo con `canPublish=true`; llama `publishAICalibrationV3`; éxito → `versionNumber` + `onChanged`; fallo → `mapPublishErrorCode` + gate resaltado. | `CalibrationV3StatusPanel.tsx` `PublishSection` (148-263): botón público (201-211), call a `publishAICalibrationV3(testId)` (218), éxito → `setMessage({...versionNumber})` + `onChanged()` (230-237), fallo → `mapPublishErrorCode(res.code)` + resaltado del gate (245-247, 268-272). |
| **AC-2B.8** | `mapPublishErrorCode` cubre 10 gates + códigos sin gate + fallback seguro. | 4 tests en `describe("mapPublishErrorCode")`: tabla 11 gates, 6 códigos sin gate, desconocido, string vacío. |
| **AC-2B.9** | `manual_service`: no editor, no publicar, aviso. `isLegacyOnly`: flujo V1/V2. Snapshot congelado. | `CalibrationV3StatusPanel` 48-58 (aviso manual_service). `CalibrationWorkspaceClient` 432-438 (sin `<AICalibrationEditor>` cuando `isManualService`). `getPublishGateVisibility` test "manual_service" valida G0b/G8/G9 N/A. Estado `hasLegacySnapshot` renderizado como badge (líneas 81-85). |
| **AC-2B.10** | Build Vercel: `prisma generate && next build` 0 errores; typecheck 0; lint 0 nuevos; tests verde. Helpers puros sin `'use server'`, sin `node:crypto`. | `prisma generate` + `next build` exitosos (lista la ruta). `npm run typecheck` 0 errores. `npm run lint` 0 errores en 5 archivos scope. `calibration-v3-ui.ts` es módulo plano — verificado: `grep node:crypto\|use server\|calibration-v3-shared` solo encuentra comentarios que documentan la prohibición. |
| **AC-2B.11** | No-admin (`canEdit=false`) no ve editor; aviso "Requiere rol ADMIN o superior". | `CalibrationV3StatusPanel` líneas 41-53: si `!canEdit` retorna el aviso con `data-testid="calibration-v3-status-panel-no-permission"`. El workspace ya no monta el editor condicionalmente cuando `canEdit=false` porque el panel lo reemplaza, pero como defensa en profundidad `handleSubmit` del editor sigue pasando por `saveAICalibrationV3` que devuelve `FORBIDDEN` server-side. |

## Casos borde cubiertos

- **CB-2B-1**: `currentPublishedVersionId` roto → cae a la primera
  `published|disabled` (test "CB-2B-1 cae a la primera..."). Si todas
  están `superseded`, `currentPublishedVersion=null` (test "publishedVersions
  no vacías pero todas superseded").
- **CB-2B-2**: `clinicalCriteria=null` (document_extraction) → `diagnosis.enabled=false`
  (test "document_extraction…").
- **CB-2B-3**: `operationMode` ausente/inválido → `null`; `getEditorSectionsForOperationMode(null)`
  devuelve editor completo (legacy), no asume Audiometría. Verificado
  también en calibration-v3.actions.test.ts test 6.
- **CB-2B-4**: Sin V3 ni V2 → `isLegacyOnly=true`, badge legacy, editor
  con `initial=rawCalibration` (workflow legacy preservado).
- **CB-2B-5**: `publishAICalibrationV3` `NO_DRAFT`/`DRAFT_NOT_TESTED`/`TEST_NOT_FOUND`
  → el `PublishSection` muestra `mapPublishErrorCode(code)` con `gate=null`
  (no gate highlight), sin crash. Cubierto por `mapPublishErrorCode` tests
  (6 códigos sin gate).

## Riesgos y desviaciones

- **Pre-existente**: `medical-exam.actions.test.ts` (15 fallos en
  `ImpresiónAptitudSchema`) y los 2 errors de lint en
  `calibration-v3-shared.ts` no son de mi scope ni los puedo tocar
  (handoff §9: "no modificar `calibration-v3-shared.ts`"). Documento
  aquí para que INTEGRA/GEMINI los vean durante la verificación.
- **FamilyTemplate**: `familyTemplateId=null` (P-04) preservado. G8/G9
  visibles como N/A "sin plantilla (P-04)" — no inventé catálogo.
- **G5 E2E**: visible como N/A "sin infraestructura E2E en Fase 2", no
  bloquea publicación (consistente con `publishAICalibrationV3`).
- **`coerceV3DraftToEditorInitial` sólo cubre campos que el editor ya
  entiende** (`extraction`, `diagnosis`, `fieldDefinitions`,
  `presentation`, `canonicalStudyType`, `enabled`). Los campos V3 puros
  (`requiredParams`, `confidenceThreshold`, `targetFields`,
  `presentation.schema` editable, `familyTemplateId`, `overrides`,
  `supportingReferences`) permanecen en el draft persistido pero
  NO se exponen en UI en esta fase — cobertura UI completa es Fase 6
  (documentado en `buildDraftV3FromEditorState` líneas 234-244).
- **No se ejecutó browser/E2E manual** del flujo `/admin/services/[id]/calibration`
  (no hay dato sembrado de prueba V3 ni sesión persistente en este
  entorno). La verificación end-to-end queda para INTEGRA/GEMINI.

## Requiere GEMINI

**Sí — recomendado por riesgo.** Reglas aplicables del handoff §11:
- Toca contrato visible de UI (cambio de props de dos componentes,
  añadir un componente, nuevo módulo, nuevo módulo de tests).
- Toca RBAC visible (botón publicar sólo SUPERADMIN).
- Cambio grande de UX (nuevo panel + radio + lista de gates).
- Ruta crítica `/admin/services/[id]/calibration` (era el último
  fallo Vercel del proyecto, FIX-20260820-01-VERCEL-BUILD).

INTEGRA decide si anexa QA-20260820-04+.

## Requiere DEBY

**No.** No hay bug reproducible de mi cambio. Los 2 attempts rule no
aplican. El build pasó, los tests focalizados pasan, los del scope
calibration-v3 (41) pasan, el typecheck pasa. Los fallos pre-existentes
en `medical-exam.actions.test.ts` no afectan el flujo V3.

## Pendientes INTEGRA

1. Auditoría QA-20260820-04+ (recomendada, ver §"Requiere GEMINI").
2. Verificación E2E manual de `/admin/services/[id]/calibration` con
   un `MedicalTest` con `operationMode` y `aiCalibration` V3 sembrados.
3. Confirmación de pre-existente: ¿los 15 fallos en
   `medical-exam.actions.test.ts` ya estaban en main antes de la
   sesión? (Sí — verificado en baseline.) No frena esta entrega.
4. Si Frank decide exponer `familyTemplateId` y el catálogo
   `FamilyTemplate`, los gates G8/G9 dejan de ser N/A y el helper
   `getPublishGateVisibility` debe ampliarse (P-04 ⇒ futuro).

## Notas de reversión

Reversión limpia: `git checkout main -- frontend/src/app/admin/services/[id]/calibration/page.tsx frontend/src/components/calibration/CalibrationWorkspaceClient.tsx frontend/src/components/calibration/AICalibrationEditor.tsx` y `rm -r frontend/src/components/calibration/CalibrationV3StatusPanel.tsx frontend/src/components/calibration/__tests__/calibration-v3-ui.test.ts frontend/src/lib/calibration-v3-ui.ts`. No hay migraciones, no hay Prisma, no hay seeds; no se tocó `calibration-v3.actions.ts`, `calibration-v3-shared.ts`, `types/calibration.ts`, backend, Events, ni la rama `arch-20260819-02-tarjetas-muestra`.

## Estado de ejecución

```
BACKLOG → READY → IN_PROGRESS → VERIFYING → DONE
                              └──────────────→ BLOCKED
                                          (este IMPL)
```

`IN_PROGRESS` (intervención SOFIA) → `READY_FOR_VERIFYING` (entregado a
INTEGRA para auditoría QA). NO `DONE` (GEMINI/INTEGRA deben validar).
