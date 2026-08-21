# SPEC-HANDOFF

~~~
SPEC-HANDOFF
Origen: INTEGRA
ID tarea: ARCH-20260820-01-FASE2B
SPEC activa: context/SPECs/SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md (v1.1)
ADR: context/decisions/ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md (v1.1)
Referencias funcionales: DEC-20260820-03 (publicación V3 visible desde Calibración), DEC-20260820-02 (operationMode), DEC-20260820-01 (calibración fuente única), BR-20260820-01 (paridad Calibración↔Events)
Resultado: Desde `Admin → Servicios → Calibración IA`, el administrador identifica el estado V3 (draft/tested/published), guarda draft/tested y publica `published` con gates visibles; `manual_service` no muestra editor; fallback V1/V2 intacto; respeta `operationMode` y RBAC vigente (editar ADMIN+, publicar SUPERADMIN).
Alcance de archivos/módulos: (ver sección "Archivos" abajo)
Contratos que cambian: contrato de props de `CalibrationWorkspaceClient` y `AICalibrationEditor`; firma de `buildDraftV3FromEditorState` (nuevo campo `status`)
Contratos protegidos: `calibration-v3.actions.ts` (save/publish/getPublished*) intacto; `calibration-v3-shared.ts` intacto; `MedicalTest.options.aiCalibration` V3 shape (types ya firmes); servidor resolver backend; Events; `arch-20260819-02-tarjetas-muestra`
Criterios AC: AC-2B.1 … AC-2B.11 (sección "Criterios de aceptación")
Casos borde: CB-13/CB-14/CB-15 (SPEC §16) + CB-2B-1…CB-2B-5 (sección "Casos borde")
Validaciones detectadas: `npm run typecheck` (0 errores), `npm test` (vitest, verde), `npm run lint` (0 errores nuevos), `npm run build` (Vercel, `prisma generate && next build`, 0 errores)
Restricciones: (sección "Restricciones")
Dependencias: `saveAICalibrationV3`, `publishAICalibrationV3` (ya implementadas y testeadas en `@/actions/calibration-v3.actions.ts`); tipos V3 en `@/types/calibration.ts`; `isAdminLike`/`isSuperAdmin` en `@/lib/auth/roles`
DoD: (sección "DoD")
Prohibido inferir: (sección "Prohibido inferir")
~~~

Estado: **READY** (sin `DISCOVERY-GAP`; role de publicación ya resuelto por contrato vigente: editar ADMIN+, publicar SUPERADMIN).

---

## 1. Contexto y estado observado (validado por INTEGRA)

La cadena backend/acciones de `ARCH-20260820-01` ya está implementada y commiteada en `main`:

- **Fase 1** (`22ba048`): `backend/app/services/ai/calibration_resolver.py` + `GET /api/v1/calibration/resolve` + clasificador `operationMode`.
- **Fase 2** (`0cce88f`): `frontend/src/actions/calibration-v3.actions.ts` con `saveAICalibrationV3` (draft/tested) y `publishAICalibrationV3` (gates G0-G9 + transición atómica `tested→published` + `superseded` + `legacyV1V2Snapshot`) + editor condicional por `operationMode` en `AICalibrationEditor.tsx`.
- **Fases 3-5** (`d6295b1`): `getPublishedCalibrationForEventTest`, `getPublishedVersionForSnapshot`, snapshot versionado.
- **FIX Vercel build** (`ca0b9f8`, HEAD): helpers compartidos en `frontend/src/lib/calibration-v3-shared.ts` (no `'use server'`).

**El hueco (DEC-20260820-03) es puramente de cableado visible de UI:**

1. `frontend/src/app/admin/services/[id]/calibration/page.tsx` solo parsea `aiCalibrationV2` (campo `currentVersion`) y **no** lee `MedicalTest.options.operationMode` ni la raíz V3 (`schemaVersion==='V3'`). No pasa `operationMode` ni el estado V3 al cliente.
2. `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx:466` renderiza `<AICalibrationEditor testId={testId} initial={initialRawCalibration} />` **sin** `operationMode`; el header solo muestra `aiCalibrationV2.currentVersionLabel` (legacy), no el estado V3.
3. **No existe UI** que invoque `publishAICalibrationV3` (solo acciones + tests).
4. `AICalibrationEditor.tsx` llama `saveAICalibrationV3` pero su helper `buildDraftV3FromEditorState` hardcodea `status: "draft"` (línea 273); no hay forma de guardar `tested` desde UI.
5. El editor lee `initial` con shape V1/V2 (claves `extraction`, `diagnosis`, `fieldDefinitions`, `presentation`, `enabled`, `canonicalStudyType`). Un draft V3 tiene shape distinto (`clinicalCriteria` en vez de `diagnosis`); si se le pasara el draft V3 crudo, el prompt clínico no precargaría.

**Este handoff cierra Fase 2 (completa su UI) sin tocar backend ni `calibration-v3.actions.ts`.**

---

## 2. Archivos (alcance)

### EDITAR

1. `frontend/src/app/admin/services/[id]/calibration/page.tsx` (server component)
2. `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx` (client)
3. `frontend/src/components/calibration/AICalibrationEditor.tsx` (client — cambio mínimo: selección de status + callback)

### CREAR

4. `frontend/src/lib/calibration-v3-ui.ts` (módulo puro, **sin** `'use server'`, **sin** `node:crypto`)
5. `frontend/src/components/calibration/CalibrationV3StatusPanel.tsx` (client)
6. `frontend/src/components/calibration/__tests__/calibration-v3-ui.test.ts` (vitest, entorno node, extensión `.test.ts`)

### NO TOCAR (contratos protegidos)

- `frontend/src/actions/calibration-v3.actions.ts` (save/publish/getPublished* — ya correctos y testeados).
- `frontend/src/lib/calibration-v3-shared.ts` (importa `node:crypto`; NO importar desde componentes cliente — su header lo prohíbe).
- `frontend/src/types/calibration.ts` (contrato V3 ya firme; no renombrar).
- `backend/**` (resolver/prediagnostic/main), `frontend/src/app/events/**`, `frontend/src/actions/event-test.actions.ts`, `ai-prediagnosis.actions.ts`.
- Schema Prisma / migraciones.
- Rama `arch-20260819-02-tarjetas-muestra`.

---

## 3. Contrato de props

### 3.1 `CalibrationWorkspaceClient`

```ts
interface CalibrationWorkspaceClientProps {
  testId: string
  aiCalibration: AICalibrationV2 | null              // legado V1/V2 (existe hoy)
  aiCalibrationV3: AICalibrationV3 | null            // NUEVO — raíz V3 (null si no hay)
  initialRawCalibration: Record<string, unknown> | null  // raw legacy V1/V2 (existe hoy)
  operationMode: OperationMode | null                // NUEVO — de MedicalTest.options.operationMode
  canEdit: boolean                                   // NUEVO — isAdminLike(role)
  canPublish: boolean                                // NUEVO — isSuperAdmin(role)
  eventTests: EventTestEntry[]                       // (existe)
  candidateFields: CandidateField[]                  // (existe)
  apiUrl: string                                     // (existe)
}
```

`OperationMode` importado de `@/types/calibration` (`"manual_service" | "document_extraction" | "clinical_interpretation"`).

### 3.2 `AICalibrationEditor` (cambio mínimo)

```ts
interface AICalibrationEditorProps {
  testId: string
  initial: Record<string, unknown> | null
  operationMode?: OperationMode | null      // ya existe (se empieza a pasar desde el workspace)
  initialStatus?: "draft" | "tested"        // NUEVO — default "draft"
  onSaved?: (status: "draft" | "tested") => void  // NUEVO — opcional, para refrescar el workspace
}
```

`buildDraftV3FromEditorState` (exportado, ya testeado) gana un campo `status?: "draft" | "tested"` (default `"draft"`) en su input; el `return` usa `status: input.status ?? "draft"`.

### 3.3 `CalibrationV3StatusPanel` (nuevo)

```ts
interface CalibrationV3StatusPanelProps {
  testId: string
  operationMode: OperationMode | null
  aiCalibrationV3: AICalibrationV3 | null
  canEdit: boolean
  canPublish: boolean
  onChanged: () => void   // invoca router.refresh() en el workspace
}
```

---

## 4. Helpers puros (en `frontend/src/lib/calibration-v3-ui.ts`)

Todos son funciones puras exportables para test node (mismo patrón que `getEditorSectionsForOperationMode`). No leen Prisma ni session.

### 4.1 `describeCalibrationV3State(aiCalibrationV3, operationMode)`

Devuelve un resumen derivado (no inventa estado):

```ts
export interface CalibrationV3UIState {
  operationMode: OperationMode | null
  isManualService: boolean
  hasV3: boolean                    // existe raíz V3
  isLegacyOnly: boolean             // no hay V3; hay/sea V1/V2 o nada
  draftStatus: "draft" | "tested" | null
  currentPublishedVersion: {
    versionId: string
    versionNumber: number
    label: string
    publishedAt: string
  } | null
  supersededCount: number
  hasLegacySnapshot: boolean        // aiCalibrationV3.legacyV1V2Snapshot != null
}
```

Regla de resolución de `currentPublishedVersion`: usar `aiCalibrationV3.currentPublishedVersionId`; si no coincide, la primera con `status === "published" || status === "disabled"` (mismo criterio que `getPublishedCalibrationForEventTest`). `supersededCount` = count de `publishedVersions` con `status === "superseded"`.

### 4.2 `coerceV3DraftToEditorInitial(draft: AICalibrationDraftV3): Record<string, unknown>`

Mapea un draft V3 al shape legacy que el editor ya entiende (su fuente actual de `initial`):

```ts
{
  enabled: draft.enabled,
  canonicalStudyType: draft.canonicalStudyType ?? "",
  extraction: {
    enabled: draft.extraction.enabled,
    prompt: draft.extraction.prompt ?? "",
    version: draft.extraction.version ?? "",
    schemaVersion: draft.extraction.schemaVersion ?? "",
    provider: draft.extraction.provider ?? "gemini",
    model: draft.extraction.model ?? "",
  },
  diagnosis: {
    enabled: draft.clinicalCriteria?.prediagnosisEnabled ?? false,
    prompt: draft.clinicalCriteria?.prompt ?? "",
    promptVersion: draft.clinicalCriteria?.promptVersion ?? "",
  },
  fieldDefinitions: draft.fieldDefinitions ?? [],
  presentation: draft.presentation ?? { enabled: false, schema: null },
}
```

Para `document_extraction` (`clinicalCriteria === null`), `diagnosis.enabled` queda `false` y `diagnosis.prompt` `""` (la sección clínica igual se oculta vía `getEditorSectionsForOperationMode`).

### 4.3 `PUBLISH_GATE_VISIBILITY` + `mapPublishErrorCode(code: string)`

Lista ordenada de gates visibles (para renderizar "gates visibles" en el panel):

| Gate | Label | N/A si |
|---|---|---|
| G0 | `operationMode` definido y válido | — |
| G0b | `operationMode != manual_service` | — |
| G1 | `canonicalStudyType` canónico | `document_extraction` sin routing XML |
| G2 | `extraction.prompt` no vacío si `extraction.enabled` | `extraction.enabled=false` |
| G3 | `clinicalCriteria.prompt` no vacío si `prediagnosisEnabled` | `document_extraction` (clinicalCriteria=null) |
| G4 | `presentation.schema` con ≥1 sección si `presentation.enabled` | `presentation.enabled=false` |
| G5 | prueba E2E previa | N/A justificado (Fase 2, sin infra E2E) |
| G6 | sin colisión `versionId` | — |
| G7 | `fieldDefinitions` define todos `requiredParams` | `clinicalCriteria=null` |
| G8 / G9 | coherencia `familyTemplate` | `familyTemplateId=null` (P-04) |

`mapPublishErrorCode(code)` devuelve `{ gate: string | null, title: string, hint: string }` para los códigos de `publishAICalibrationV3`:

- `PUBLISH_INVALID_OPERATION_MODE` → G0
- `PUBLISH_MANUAL_SERVICE_NO_CALIBRATION` → G0b
- `PUBLISH_INVALID_CANONICAL_TYPE` → G1
- `PUBLISH_EXTRACTION_PROMPT_EMPTY` → G2
- `PUBLISH_CLINICAL_PROMPT_EMPTY` → G3
- `PUBLISH_PRESENTATION_SCHEMA_EMPTY` → G4
- `PUBLISH_MISSING_E2E_TEST` → G5
- `PUBLISH_VERSION_ID_COLLISION` → G6
- `PUBLISH_REQUIRED_PARAMS_NOT_DEFINED` → G7
- `PUBLISH_FAMILY_MODE_MISMATCH` → G8
- `PUBLISH_FAMILY_OVERRIDE_REMOVES_REQUIRED` → G9
- `FORBIDDEN` → gate `null` (rol); `NO_DRAFT`/`DRAFT_NOT_TESTED` → gate `null` (estado); `UNAUTHENTICATED`/`TEST_NOT_FOUND`/`INTERNAL_ERROR` → gate `null`.

Código desconocido → `{ gate: null, title: code, hint: "Error inesperado de publicación" }` (fallback seguro).

---

## 5. Estado / UX (comportamiento esperado)

### 5.1 `page.tsx` (server)
1. Parsear `operationMode` de `test.options.operationMode` validando contra los 3 literales; si no válido → `null`.
2. Parsear raíz V3: si `options.aiCalibration` es objeto y `schemaVersion === "V3"` → `aiCalibrationV3` tipado `AICalibrationV3`; en otro caso `null`.
3. Resolver sesión server-side (`getServerSession(authOptions)`), derivar `canEdit = isAdminLike(role)` y `canPublish = isSuperAdmin(role)` (`@/lib/auth/roles`).
4. Pasar `operationMode`, `aiCalibrationV3`, `canEdit`, `canPublish` al workspace (conservando los props actuales).

### 5.2 `CalibrationWorkspaceClient`
1. **Header:** sustituir/aumentar el badge legacy por un badge V3 cuando `aiCalibrationV3` exista: `estado del draft` (`draft`/`tested`/`sin draft`) + `vN publicado` (`currentPublishedVersion`). Mantener el badge V2 legacy solo cuando `isLegacyOnly`.
2. **Tab "Configuración":** arriba renderizar `CalibrationV3StatusPanel`; debajo el `AICalibrationEditor`. El `initial` del editor se computa así: si `aiCalibrationV3?.draft` existe → `coerceV3DraftToEditorInitial(draft)`; si no → `initialRawCalibration` (V1/V2 legacy, comportamiento actual). Pasar `operationMode` y `initialStatus={aiCalibrationV3?.draft?.status ?? "draft"}`.
3. **Post-guardado/publicación:** `onSaved`/`onChanged` → `router.refresh()` (`useRouter` de `next/navigation`) para recargar el server component (las acciones ya llaman `revalidatePath`).
4. PESTAÑA `pruebas`: **sin cambios** (ya usa `canonicalStudyType ?? ""`, H3 resuelto). No tocar.

### 5.3 `CalibrationV3StatusPanel`
1. Badge de `operationMode` (o "sin clasificar" si `null`).
2. Estado de publicación: draft (`draft`/`tested`/ninguno), versión publicada vigente (`versionNumber`, `label`, `publishedAt`), conteo `superseded`, indicador `legacyV1V2Snapshot` congelado.
3. Si `isManualService`: aviso "Servicio manual — sin calibración IA (DEC-20260820-02)"; **sin** botón publicar ni editor.
4. Botones:
   - "Guardar borrador (draft)" y "Guardar y marcar probado (tested)" se resuelven dentro del `AICalibrationEditor` (ver 5.4); el panel puede duplicar un atajo solo si reutiliza el mismo estado del editor (no duplicar). Por mínimo, estos botones viven en el editor.
   - "Publicar" (`canPublish=true` únicamente): invoca `publishAICalibrationV3(testId)`; en éxito → mensaje con `versionNumber` + `onChanged()`; en fallo → muestra el gate fallido (`mapPublishErrorCode`) sobre la lista de `PUBLISH_GATE_VISIBILITY` resaltando el que falló.
   - Si `canPublish=false`: botón oculto + leyenda "Publicar requiere rol SUPERADMIN".
   - Si `canEdit=false` (no admin): panel y editor se reemplazan por aviso "Requiere rol ADMIN o superior para editar calibración".
5. Lista de gates visibles (G0…G9 con N/A donde aplique) para que el usuario entienda qué se valida antes de publicar.

### 5.4 `AICalibrationEditor`
1. Añadir selección de status: radio/toggle "Guardar como: borrador (draft) | probado (tested)" (default `initialStatus`).
2. `handleSubmit` pasa el `status` elegido a `buildDraftV3FromEditorState` (nuevo campo) y llama `saveAICalibrationV3`.
3. Al éxito llama `onSaved?.(status)`.
4. El early-return de `manual_service` (ya existente, `data-testid="ai-calibration-editor-disabled-manual-service"`) se mantiene.

---

## 6. Criterios de aceptación (verificables)

| ID | Criterio | Validación (comando + salida esperada) |
|---|---|---|
| AC-2B.1 | `page.tsx` parsea `operationMode` (válido o `null`) y la raíz V3 (`schemaVersion==='V3'`) y las pasa al workspace; deriva `canEdit`/`canPublish` de la sesión. | `npm run typecheck` 0 errores; `npm run build` OK. |
| AC-2B.2 | `describeCalibrationV3State` devuelve `isManualService=true` para `operationMode=manual_service` y `currentPublishedVersion` correcto para un V3 con published, `supersededCount` correcto. | `npm test` (test nuevo `calibration-v3-ui.test.ts`). |
| AC-2B.3 | `coerceV3DraftToEditorInitial` mapea `clinicalCriteria→diagnosis`, `extraction→extraction`, `fieldDefinitions/presentation` intactos; para `clinicalCriteria=null` produce `diagnosis={enabled:false,prompt:""}`. | `npm test` (nuevo). |
| AC-2B.4 | `buildDraftV3FromEditorState` respeta `status` (`draft`/`tested`, default `draft`); `saveAICalibrationV3` recibe el status elegido (guardar tested produce `draft.status==='tested'` en `MedicalTest.options.aiCalibration.draft`). | `npm test` (extender test existente de build + mocks). |
| AC-2B.5 | El editor se precarga desde draft V3 existente (`coerceV3DraftToEditorInitial`) o desde raw V1/V2 si no hay draft; para `document_extraction` la sección clínica está oculta (`getEditorSectionsForOperationMode` → `showClinicalCriteria=false`, ya cubierto). | `npm test` + revisión manual de `/admin/services/[id]/calibration`. |
| AC-2B.6 | El panel muestra estado V3: `operationMode`, draft (`draft`/`tested`/ninguno), versión publicada (`versionNumber`/`label`/`publishedAt`) y `supersededCount`. | revisión manual; `describeCalibrationV3State` cubre la lógica (`npm test`). |
| AC-2B.7 | "Publicar" solo se muestra con `canPublish=true` (SUPERADMIN); si no, leyenda de rol. "Publicar" llama `publishAICalibrationV3`; éxito → refresco + `versionNumber`; fallo → mensaje del gate fallido (`mapPublishErrorCode`) + gate resaltado en la lista visible. | `npm test` (`mapPublishErrorCode` cubre G0/G0b/G1-G9 + FORBIDDEN + NO_DRAFT + DRAFT_NOT_TESTED) + revisión manual. |
| AC-2B.8 | `mapPublishErrorCode` cubre los 10 gates + códigos sin gate; código desconocido → fallback seguro. | `npm test` (nuevo). |
| AC-2B.9 | `manual_service`: no editor, no publicar, aviso visible (DEC-20260820-02). `isLegacyOnly`: se mantiene flujo V1/V2 (editor completo, badge V2) y `saveAICalibrationV3` inicializa V3 capturando `legacyV1V2Snapshot` (tests de actions 31/32 ya cubren la acción). | revisión manual + `npm test` (existente + `describeCalibrationV3State`). |
| AC-2B.10 | Build Vercel: `npm run build` (incluye `prisma generate`) 0 errores; `npm run typecheck` 0 errores; `npm run lint` 0 errores nuevos; `npm test` verde. **No** exportar funciones no-async desde archivos `'use server'`; helpers en `calibration-v3-ui.ts` (sin `'use server'`, sin `node:crypto`). | `npm run build` / `typecheck` / `lint` / `test`. |
| AC-2B.11 | No-admin (`canEdit=false`) no ve editor ni panel; aviso "Requiere rol ADMIN o superior". (La acción ya rechaza no-admin con `FORBIDDEN`; el gate UI es UX.) | revisión manual. |

---

## 7. Casos borde

- **CB-2B-1:** Dato V3 con `publishedVersions` no vacías pero `currentPublishedVersionId` roto → `describeCalibrationV3State` cae a la primera `published|disabled` (mismo criterio que `getPublishedCalibrationForEventTest`).
- **CB-2B-2:** Draft V3 con `clinicalCriteria=null` (document_extraction) → `coerceV3DraftToEditorInitial` produce `diagnosis.enabled=false`; el editor no muestra sección clínica.
- **CB-2B-3:** `operationMode` ausente/inválido → `null`; `getEditorSectionsForOperationMode(null)` devuelve editor completo (legacy); no se asume Audiometría (H3).
- **CB-2B-4:** Sin `aiCalibrationV3` y sin `aiCalibrationV2` (prueba nueva) → `isLegacyOnly=true`, editor vacío; al guardar, `saveAICalibrationV3` inicializa raíz V3.
- **CB-2B-5:** Publicar con `publishAICalibrationV3` → `NO_DRAFT`/`DRAFT_NOT_TESTED`/`TEST_NOT_FOUND` → panel muestra mensaje claro (sin gate), sin crash.

---

## 8. Validaciones detectadas (comandos)

| Comando | Salida esperada |
|---|---|
| `npm run typecheck` | 0 errores |
| `npm test` | verde (incluye `calibration-v3-ui.test.ts` + tests existentes de actions/editor) |
| `npm run lint` | 0 errores nuevos |
| `npm run build` | 0 errores (Vercel: `prisma generate && next build`) |
| Revisión manual `/admin/services/[id]/calibration` | estado V3 visible; guardar draft/tested; publicar con gates; manual_service sin editor |

**Nota de entorno de test:** la config de Vitest (`frontend/vitest.config.ts`) usa `environment:'node'` e `include: ['src/**/__tests__/**/*.test.ts', 'src/**/*.test.ts']` — **`.test.tsx` NO se ejecuta** y no hay `jsdom`/`happy-dom` instalado. Los tests de esta fase son **helpers puros en `.test.ts`** (node). No agregar dependencias de DOM ni tests `.test.tsx`. (El test de acciones `calibration-v3.actions.test.ts` ya importa helpers puros de `AICalibrationEditor` sin render React; replicar ese patrón.)

---

## 9. Restricciones

1. No implementar ni modificar `calibration-v3.actions.ts`, `calibration-v3-shared.ts`, `types/calibration.ts`, backend, Events, Prisma/migraciones, `arch-20260819-02-tarjetas-muestra`.
2. No exportar funciones no-async desde archivos `'use server'` (regla Next.js 16; fue el FIX Vercel build). Los helpers puros viven en `calibration-v3-ui.ts` (sin directiva, sin `node:crypto`). `calibration-v3-ui.ts` **no** importa `calibration-v3-shared.ts` (este importa `node:crypto` y tiene header prohibitivo).
3. `familyTemplateId` queda `null` (P-04); no crear catálogo FamilyTemplate ni registrar plantillas. Gates G8/G9 visibles como "N/A — sin plantilla (P-04)".
4. G5 (E2E) visible como "N/A — sin infraestructura E2E en Fase 2"; no bloquear publicación.
5. RBAC: editar ADMIN+ (`isAdminLike`), publicar SUPERADMIN (`isSuperAdmin`); no inventar rol `CALIBRATOR`. El gate server-side en las acciones es autoritativo; `canEdit`/`canPublish` son solo UX.
6. No commit/push/PR/deploy sin autorización explícita de Frank.
7. Mantener `saveAICalibration`(V1)/`saveAICalibrationV2` operativos (deprecados, no eliminar).
8. Async params Next.js 16: en `page.tsx`, `params` es Promise (`const { id } = await params` — ya cumple; no regresar a acceso síncrono).

---

## 10. Dependencias

- `saveAICalibrationV3`, `publishAICalibrationV3` y tipos `PublishV3Result`/`PublishErrorCode`/`SaveDraftV3Result` en `@/actions/calibration-v3.actions.ts` (ya implementados; `publishAICalibrationV3` acepta `status` `draft` o `tested`).
- Tipos V3 en `@/types/calibration.ts` (`OperationMode`, `AICalibrationV3`, `AICalibrationDraftV3`, `AICalibrationVersionV3`).
- `isAdminLike`/`isSuperAdmin` en `@/lib/auth/roles`.
- `getMedicalTestById` ya devuelve `options` (JSON) y `category.name` (ver `medical-profiles.ts:570`).
- `useRouter` de `next/navigation` para `router.refresh()` post-guardado/publicación.

---

## 11. Definition of Done

Todos los AC-2B.1…AC-2B.11 verificados con evidencia reproducible (typecheck, vitest, lint, build Vercel, revisión manual); self-review SOFIA; `PROYECTO.md` con una sola representación de `ARCH-20260820-01-FASE2B`; sin commits/push/PR sin OK Frank; rama `arch-20260819-02-tarjetas-muestra` no mezclada; GEMINI posterior según riesgo (toca contrato visible y RBAC en UI — decisión de auditoría en recepción por INTEGRA).

---

## 12. Prohibido inferir

- No inventar `operationMode` para una prueba si `MedicalTest.options.operationMode` no existe o no es válido (devolver `null`, flujo legacy).
- No asumir `canonicalStudyType` default; sin draft se muestra placeholder/vacío.
- No crear FamilyTemplate ni `familyTemplateId` distinto de `null`.
- No inferir roles distintos a los del contrato vigente (ADMIN+/SUPERADMIN).
- No tocar la persistencia ni la salida de `publishAICalibrationV3` (ya resuelve gates, `superseded`, retención 20, `legacyV1V2Snapshot`); el panel solo consume su resultado.
- No duplicar lógica de resolución de `operationMode`/V1→V3 (eso es del resolver backend); el frontend solo lee `MedicalTest.options`.