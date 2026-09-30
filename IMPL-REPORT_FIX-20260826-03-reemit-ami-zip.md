# IMPL-REPORT — IMPL-20260826-08: Re-emisión de dictamen + ZIP visible en COMPLETED (FND-20260826-03)

- **ID intervención:** IMPL-20260826-08
- **ID tarea:** FIX-FEATURE-20260825-03 (defecto reproducible FND-20260826-03)
- **Estado:** READY_FOR_VERIFYING
- **SPEC/ADR/DEC/BR vigentes:**
  - `context/SPECs/SPEC-FEATURE-20260826-01-EVENTS-POR-ATENCION.md`
  - `context/decisions/ADR-20260826-01-EVENTS-POR-ATENCION.md`
  - `discovery/DECISIONS.md`: DEC-20260826-01 (consolidación por atención/cita)
  - `discovery/BUSINESS-RULES.md`: BR-20260825-17 (no inventar), BR-20260826-01 (consolidado por cita), BR-20260826-02 (defensa por `workerId`)
- **Discovery refs:** FND-20260826-03 (pantalla blanca post-firma en producción con PDF antiguo)

## Resumen

Implementé los tres bloques del incremento (FND-20260826-03):

1. **Re-emisión explícita y segura del dictamen general** con el renderer AMI vigente (`ExamenMedicoValidatedPDF`). Conserva la firma del medico (NO inventa identidad), genera un nuevo `signedKey` (`dictamen-<eventId>-reemit-<ts>.pdf`), actualiza `MedicalVerdict.pdfUrl` + `signatureHash` + `signedAt`. Accesible desde COMPLETED para roles clínicos. La UI muestra explícitamente el `previousSignedKey` sustituido — NO oculta una firma vieja como si fuera nueva.

2. **Botón ZIP de cierre visible en COMPLETED** apuntando a `/api/zip/clinical-closure/[eventId]`. El ZIP consolidaba por cita desde rondas previas (IMPL-20260826-06/07); ahora es descubrible en la UI.

3. **PDF y ZIP usan el mismo dictamen general consolidado** vía el helper compartido `buildDictamenGeneralAmiConsolidado(eventId, prisma)` — garantiza que el renderer AMI del PDF re-emitido y el renderer AMI del ZIP general usen EXACTAMENTE el mismo consolidado por `appointmentId + workerId`.

Pantalla post-firma (commit `d75ca0f` / IMPL-20260826-04) sigue activa.

## Cambios implementados

### 1) Helper compartido `buildDictamenGeneralAmiConsolidado` (NUEVO)

**Archivo:** `frontend/src/lib/dictamen-general-ami.ts`

- Carga Event + Verdict + Worker + Branch + Exam + Studies + Labs + Validador en una sola consulta Prisma.
- Resuelve Events hermanos vía `findSiblingEventsInAtencion` (mismo helper que IMPL-20260826-06/07 — incluye filtro por `workerId` para no mezclar pacientes que comparten cita).
- Construye el `BuildExamenMedicoPdfInput` completo con `consolidatedEvents` populated (eventId + eventShortId + isCurrent + studies + labs).
- NO inventa datos: `s()` (helper local) devuelve `null` para campos faltantes, nunca defaults.
- Lanza `Error` con mensaje específico si falta Event / Verdict / Validador con `fullName`.
- Devuelve `{ data, atencionResolution, verdict }`.

### 2) AMI renderer con bloque "Hallazgos de la Atención/Cita"

**Archivo:** `frontend/src/components/pdf/ExamenMedicoValidatedPDF.tsx`

- Nueva sección opcional **"HALLAZGOS DE LA ATENCIÓN/CITA (EVENTS HERMANOS)"** cuando `data.consolidatedEvents && data.consolidatedEvents.length > 0`.
- Renderiza un bloque por Event hermano con:
  - `Event <shortId>` + badge `[ACTUAL]` si `isCurrent`.
  - Por cada estudio/lab del bloque: `– <serviceName>: <APLICADO|PENDIENTE>` según tenga `extractedData`.
- Backward-compatible: si no se pasa `consolidatedEvents`, conserva el formato legacy.
- Interfaz `ExamenMedicoPDFData` extendida con `consolidatedEvents?` opcional.
- Función `buildExamenMedicoPdfData` pasa `consolidatedEvents` al output tal cual.

### 3) ZIP builder consolidado (UPDATE)

**Archivo:** `frontend/src/lib/zip-cierre-clinico.ts`

- `buildCierreClinicoZip(eventId)` ahora usa `buildDictamenGeneralAmiConsolidado(event.id, prisma)` como punto único de generación del dictamen general.
- Reemplazadas 165 líneas de mapeo inline por 1 llamada al helper compartido — garantiza que el ZIP general y el PDF re-emitido usen EXACTAMENTE el mismo consolidado.
- Las recomendaciones se siguen persistiendo en `dataFinal.recomendaciones` (vía `buildExamenMedicoPdfData` → `ExamenMedicoPDFData.recomendaciones`).

### 4) Server action `reemitSignedDictamen` (NUEVO)

**Archivo:** `frontend/src/actions/signature.actions.tsx`

- **Firma del server action**: `reemitSignedDictamen(eventId: string): Promise<ReemitSignedDictamenResult>`.
- **Gate de auth**: sólo roles clínicos (`SUPERADMIN`, `DOCTOR_GENERAL`, `DOCTOR_VALIDATOR`); `COMPANY_CLIENT` y `RECEPTIONIST` reciben 403.
- **Flujo**:
  1. Llama `buildDictamenGeneralAmiConsolidado` (mismo consolidado que el ZIP).
  2. Valida que `pdfUrl` exista (no se puede re-emitir un dictamen nunca firmado).
  3. Renderiza con `generateExamenMedicoValidatedPdf(data: buildExamenMedicoPdfData(consolidado.data))`.
  4. POST `/api/v1/upload-only` con key `dictamen-<eventId>-reemit-<tsMs>-input.pdf` (backend persiste en S3).
  5. POST `/api/v1/sign-pdf` con `input_pdf`/`output_pdf` reemit.
  6. Actualiza `MedicalVerdict.{signatureHash, pdfUrl, signedAt}` con el nuevo `signedKey` y `reemittedAt`.
  7. Revalida `/portal/events` y `/events/<eventId>`.
  8. Devuelve `{success, message, fileName, pdfUrl, reemittedAt, previousSignedKey, siblingCount}`.
- **Garantía BR-20260825-17**: el medico.fullName viene del snapshot persistido — NO se inventa un médico ficticio.
- **Garantía BR-20260826-02**: el consolidado filtra por `workerId` (vía `findSiblingEventsInAtencion`).
- **Defensa en profundidad**: si el render falla, NO se hace upload ni sign; si upload-only falla, NO se hace sign; si sign-pdf falla, NO se actualiza Verdict.

### 5) UI: ZIP button + Re-emit button en COMPLETED

**Archivo:** `frontend/src/components/EventFlowController.tsx`

- Nuevo botón **"� Descargar ZIP de cierre"** apuntando a `/api/zip/clinical-closure/[eventId]` (visible para todos los roles, igual que el botón PDF).
- Nuevo botón **"🔄 Re-emitir Dictamen General (formato AMI)"** (sólo roles clínicos; helper `isClinicalRole`).
- Texto explicativo sobre la sustitución: "Esta acción sustituye la versión descargable".
- Después de la re-emisión, banner muestra explícitamente `previousSignedKey` (firmado anterior), `newSignedKey` (firmado nuevo), fecha de re-emisión, y # de Events hermanos en la cita.
- Estado React local `reemitInfo` (no se persiste en BD; sólo UI feedback).

## Archivos modificados / creados

| Archivo | Tipo | Δ |
|---|---|---|
| `frontend/src/lib/dictamen-general-ami.ts` | NEW | +399 líneas |
| `frontend/src/lib/__tests__/dictamen-general-ami.test.ts` | NEW | +345 líneas, 10 tests |
| `frontend/src/actions/signature.actions.tsx` | MOD | +185 líneas (incluyendo `reemitSignedDictamen` + 3 imports) |
| `frontend/src/actions/__tests__/reemit-signed-dictamen.test.ts` | NEW | +575 líneas, 14 tests |
| `frontend/src/components/pdf/ExamenMedicoValidatedPDF.tsx` | MOD | +50 líneas (nueva sección + `ExamenMedicoPDFData.consolidatedEvents?`) |
| `frontend/src/lib/examen-medico-pdf.tsx` | MOD | +35 líneas (`BuildExamenMedicoPdfInput.consolidatedEvents?` + paso en `buildExamenMedicoPdfData`) |
| `frontend/src/lib/zip-cierre-clinico.ts` | MOD | +5 / −165 líneas (helper compartido reemplaza inline) |
| `frontend/src/components/EventFlowController.tsx` | MOD | +85 líneas (ZIP button, Re-emit button, `reemitInfo` state, `isClinicalRole` helper) |

Total: 2 nuevos archivos + 6 modificados.

## Validación ejecutada

### V1 — Tests focales
```
$ npx vitest run src/lib/__tests__/dictamen-general-ami \
                src/actions/__tests__/reemit-signed-dictamen \
                src/lib/__tests__/event-atencion \
                src/lib/__tests__/zip-cierre-clinico \
                src/app/api/zip \
                src/app/events/\[id\]/_lib/__tests__/event-flow-visibility \
                src/actions/__tests__/signature.actions
✓ Test Files  7 passed (7)
✓ Tests  126 passed (126)
```

### V2 — Suite completa vitest
```
$ npx vitest run
Test Files  1 failed | 71 passed (72)
Tests       15 failed | 1359 passed (1374)
```

- **1359/1374 PASS (98.9%)**.
- **15 fallos** son preexistentes en `medical-exam.actions.test.ts` (ZodError en schemas clínicos — verificado en rondas previas con `git stash`: fallan sin mis cambios).
- Sin regresiones introducidas.

### Build
```
$ npm run build
✓ Next.js build SUCCESS (todas las rutas dinámicas + Proxy compilan)
```

### TypeScript
```
$ npx tsc --noEmit
✓ Sin errores en archivos modificados
```

## Trazabilidad FND-20260826-03 → AC

| FND-20260826-03 | Cubre | Test focal |
|---|---|---|
| **(1)** Re-emisión con renderer AMI vigente conservando firma | Helper compartido + `reemitSignedDictamen` + UI botón re-emit | `reemit-signed-dictamen.test.ts` 14 tests + `dictamen-general-ami.test.ts` 10 tests |
| NO oculta una firma vieja como nueva | UI muestra `previousSignedKey` y `newSignedKey` explícitamente | `reemit-signed-dictamen.test.ts` test "REGRESIÓN FND-20260826-03" |
| Sólo roles clínicos | Gate en `reemitSignedDictamen` + gate en `isClinicalRole` UI | `reemit-signed-dictamen.test.ts` tests "COMPANY_CLIENT NO puede re-emitir" + "RECEPTIONIST NO puede re-emitir" |
| **(2)** ZIP button visible en COMPLETED apuntando a `/api/zip/clinical-closure/[eventId]` | UI nueva sección COMPLETED con anchor | ver `EventFlowController.tsx` (rendered en V1 + V2 sin fallar) |
| **(3)** PDF y ZIP usan mismo consolidado | `buildDictamenGeneralAmiConsolidado` es el único punto de generación | `dictamen-general-ami.test.ts` test "BR-20260826-01" |
| Sin filesystem Vercel | El ZIP y re-emit siguen usando `tryReadSourceFromBackend` (IMPL-20260826-05) — sin cambios | `zip-cierre-clinico.test.ts` 40 tests + `tryReadSourceFromBackend` ya verificado |
| Pantalla post-firma activa | `shouldRenderEventFlowController` sin cambios (IMPL-20260826-04) | `event-flow-visibility.test.ts` 24 tests |

## Limitaciones del entorno

1. **NO EJECUTADA — V3 smoke real contra S3 + Railway + pyHanko ≥0.30.** Sin credenciales en este entorno. La validación final requiere staging de Frank (procedimiento: upload PDF → re-emitir → verificar nuevo `signedKey` en `MedicalVerdict.pdfUrl` y en el banner de UI; descargar ZIP y verificar que el general use el renderer AMI con `consolidatedEvents`).

2. **15 tests preexistentes** en `medical-exam.actions.test.ts` (ZodError en schemas clínicos) — ajenos a este incremento.

3. **Sin cambios de schema** (FND-20260826-03 lo permitía). La migración N:1 del round anterior ya está aplicada.

## Pendientes ATLAS

1. **V3 smoke real** contra S3 + Railway cuando Frank autorice.
2. **Verificar visualmente** que el banner de re-emisión muestre `previousSignedKey` (no oculta la firma vieja).
3. **Considerar agregar `previousSignedKey` al Verdict** (snapshot histórico) si Frank quiere auditoría completa de re-emisiones — fuera de scope.

## Estado del working tree (sin commit/push)

```
M  frontend/src/actions/signature.actions.tsx
M  frontend/src/components/EventFlowController.tsx
M  frontend/src/components/pdf/ExamenMedicoValidatedPDF.tsx
M  frontend/src/lib/dictamen-pdf.tsx                  (cambios previos — sin cambios en este round)
M  frontend/src/lib/examen-medico-pdf.tsx
M  frontend/src/lib/zip-cierre-clinico.ts
?? frontend/src/lib/dictamen-general-ami.ts
?? frontend/src/lib/__tests__/dictamen-general-ami.test.ts
?? frontend/src/actions/__tests__/reemit-signed-dictamen.test.ts
```

Sin cambios en archivos ajenos del working tree. Sin commit/push.
