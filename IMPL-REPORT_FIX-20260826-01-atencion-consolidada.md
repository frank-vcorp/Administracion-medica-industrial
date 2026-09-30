# IMPL-REPORT — IMPL-20260826-06: Consolidación por atención/cita

- **ID intervención:** IMPL-20260826-06
- **ID tarea:** FIX-FEATURE-20260825-03 (defecto reproducible consolidación)
- **Estado:** READY_FOR_VERIFYING (con bloqueos parciales reportados)
- **SPECs vigentes:** `context/SPECs/SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md` y `context/SPECs/SPEC-FEATURE-20260825-04-ZIP-CIERRE-CLINICO.md` (ambas con addendum `DEC-20260826-01` / `BR-20260826-01` / `FND-20260826-02`).
- **Discovery refs:** `DEC-20260826-01` (Consolidación por atención/cita), `BR-20260826-01` (Cierre documental por atención/cita), `FND-20260826-02` (ZIP no consolida paquete documental esperado), `OQ-20260826-01` (Alcance de Events).

## Resumen ejecutivo

Implementé la consolidación estructural del dictamen general y del ZIP de cierre para los Events del trabajador ligados a la misma cita/atención, usando **exclusivamente** la relación `MedicalEvent.appointmentId` que ya existe en el `Prisma schema` (no se inventó un agrupador nuevo). Pantalla blanca post-firma (commit `d75ca0f`) sigue desplegada y operativa.

## 🚨 BLOQUEO ESTRUCTURAL REPORTADO (no resuelto aquí)

El `Prisma schema` actual (tanto `backend/prisma/schema.prisma` como `frontend/prisma/schema.prisma`, espejos sincronizados) declara:

```prisma
model MedicalEvent {
  ...
  appointmentId  String?  @unique
  ...
  appointment    Appointment?  @relation(fields: [appointmentId], references: [id])
  ...
}
```

`@unique` sobre `appointmentId` hace que **una `Appointment` no pueda tener más de un `MedicalEvent`**. La consulta `prisma.medicalEvent.findMany({ where: { appointmentId } })` devuelve **como máximo un Event** — el actual.

Por lo tanto, **DEC-20260826-01 opción 2** ("todos los Events del trabajador ligados a la misma cita/atención") **no es implementable al 100% con el schema vigente**. La "consolidación" hoy se reduce a un único Event por cita.

### Diseño preparado para la migración de schema

El helper `findSiblingEventsInAtencion` está escrito de forma que la migración N:1 (varios Events por Appointment, mediante eliminación de `@unique` o nuevo campo `atencionId`) **recogerá automáticamente más Events sin más cambios en los call-sites**. Esto está documentado en el JSDoc del helper y verificado con tests (`event-atencion.test.ts`).

### Decisión que requiere Frank

¿Frank autoriza la migración del schema para soportar N:1 entre `Appointment` y `MedicalEvent`? ATLAS pivota con:

1. **Opción A (no migración)**: aceptar el comportamiento actual como suficiente para el flujo operativo (consolidación se reduce a 1 Event).
2. **Opción B (migración N:1)**: agregar `atencionGroupId` o relajar `@unique` para soportar varios Events por cita. Esta decisión es funcional (cambio de contrato de BD) — no técnica.

## Cambios implementados

### 1) Helper de resolución de Events hermanos (NUEVO)

- **`frontend/src/lib/event-atencion.ts`** — `findSiblingEventsInAtencion(eventId, prisma)`:
  - Lee `MedicalEvent.appointmentId` (existente).
  - `findMany({ where: { appointmentId }, orderBy: { createdAt: 'asc' }, select: { id: true } })`.
  - Defensa: input vacío/null/Event inexistente → resolución vacía; walk-in (`appointmentId=null`) → `[eventId]`; cita con `@unique` → `[eventId]`; cita con N:1 futuro → todas los Events hermanos en orden cronológico.
  - Devuelve `{ eventIds, appointmentId, hasAppointment }`.
- **`isEventInAtencion(eventId, resolution)`** — utility puro para manifests y gates.
- **Tests focales** (`__tests__/event-atencion.test.ts`): 11 tests cubriendo schema actual (1:1), schema futuro (N:1), walk-in, defensa contra eventos externos (BR-20260826-01 exclusiones), y el bloqueo documentado.

### 2) `MedicalDictamenPDF` consolidado (UPDATE backward-compat)

- **`frontend/src/components/pdf/MedicalDictamenPDF.tsx`**:
  - Nueva sección opcional **"III.B HALLAZGOS CONSOLIDADOS POR ATENCIÓN/CITA"** que renderiza un bloque por Event hermano.
  - Cada bloque muestra `studies` + `labs` del snapshot del Event con badges `APLICADO` / `PENDIENTE` y el resumen textual sin valores.
  - Bloque del Event actual se marca `ACTUAL` con borde más fuerte.
  - Backward-compatible: si `consolidatedEvents` no se pasa o está vacío, conserva el formato legacy (single-Event).
  - NO inventa: sólo refleja el snapshot del Event correspondiente.

### 3) Builder del payload (UPDATE)

- **`frontend/src/lib/dictamen-pdf.tsx`**:
  - `BuildDictamenPayloadInput.consolidatedEvents` (opcional, backward-compat).
  - `buildDictamenPdfPayload` normaliza `extractedData` (undefined → null) en cada bloque.
  - `deriveEventShortId(eventId)` — helper puro que extrae el folio corto de 8 chars.
- **Tests** (`__tests__/dictamen-pdf.test.ts`): 3 tests nuevos cubriendo compat legacy, preservación de `isCurrent`/`eventShortId`, normalización `extractedData`, y `deriveEventShortId` con defensas.

### 4) `signature.actions.tsx` consolidado (UPDATE)

- **`frontend/src/actions/signature.actions.tsx`**:
  - Tras resolver el Event actual, llama a `findSiblingEventsInAtencion`.
  - Carga `studies` + `labs` de cada Event hermano (excluyendo el actual).
  - Pasa todos los bloques a `renderDictamenInputToMemory` como `consolidatedEvents`.
  - Orden: actual primero, luego hermanos cronológicos.

### 5) ZIP builder consolidado (UPDATE)

- **`frontend/src/lib/zip-cierre-clinico.ts`**:
  - `buildCierreClinicoZip(eventId)` ahora:
    - Llama a `findSiblingEventsInAtencion` para resolver todos los Events de la cita.
    - Para cada Event (actual + hermanos) crea una carpeta `NN_Event_<shortId>/` con su `dictamen-<service>.txt` y su `fuente-<service>.<ext>`.
    - Si NO hay hermanos (caso actual con `@unique`), conserva el formato legacy `NN_<serviceName>/` para retrocompat con consumers.
    - El manifest lista todos los `atencionEventIds` y el `appointmentId` (con marca "(sin cita / walk-in)" si aplica).
    - NO mezcla Events de otras citas (defensa: filtro siempre por `appointmentId`).
    - NO inventa fuentes: el placeholder `NO_DISPONIBLE` se conserva (IMPL-20260826-05).
  - **General PDF** (`01_Dictamen_General/dictamen-general.pdf`): sigue usando `ExamenMedicoValidatedPDF` para el Event actual. **Limitación reportada**: este PDF no se consolida con hallazgos de hermanos (ver "Pendientes ATLAS").
  - `buildManifest` extendido con `atencionEventIds` y `appointmentId` (opcional, backward-compat).
- **Tests** (`__tests__/zip-cierre-clinico.test.ts`): 3 tests nuevos cubriendo el manifest con `atencionEventIds`+`appointmentId`, walk-in, y compat legacy.

### 6) Fix de mocks (`signature.actions.test.ts`)

- El test existente mockea `@/lib/dictamen-pdf` pero no incluía la nueva export `deriveEventShortId`. Añadí el mock para evitar fallos del mock factory.

## Archivos modificados / creados

| Archivo | Tipo | Δ |
|---|---|---|
| `frontend/src/lib/event-atencion.ts` | NEW | +130 líneas |
| `frontend/src/lib/__tests__/event-atencion.test.ts` | NEW | +190 líneas, 11 tests |
| `frontend/src/components/pdf/MedicalDictamenPDF.tsx` | MOD | +99 / −5 líneas |
| `frontend/src/lib/dictamen-pdf.tsx` | MOD | +44 / −2 líneas |
| `frontend/src/lib/__tests__/dictamen-pdf.test.ts` | MOD | +60 líneas, 3 tests |
| `frontend/src/actions/signature.actions.tsx` | MOD | +70 líneas |
| `frontend/src/actions/__tests__/signature.actions.test.ts` | MOD | +3 líneas (mock fix) |
| `frontend/src/lib/zip-cierre-clinico.ts` | MOD | +139 / −7 líneas |
| `frontend/src/lib/__tests__/zip-cierre-clinico.test.ts` | MOD | +49 líneas, 3 tests |

## Validación ejecutada

```
$ npx vitest run src/lib/__tests__/event-atencion \
                src/lib/__tests__/dictamen-pdf \
                src/lib/__tests__/dictamen-summary \
                src/lib/__tests__/zip-cierre-clinico
✓ src/lib/__tests__/dictamen-summary.test.ts (20 tests)
✓ src/lib/__tests__/event-atencion.test.ts (11 tests)
✓ src/lib/__tests__/dictamen-pdf.test.ts (21 tests)
✓ src/lib/__tests__/zip-cierre-clinico.test.ts (40 tests)
Test Files  4 passed (4)
Tests       92 passed (92)
```

Suite completa vitest: **1332/1347 PASS** (98.9%).

- **15 fallos** son **pre-existentes** en `src/actions/__tests__/medical-exam.actions.test.ts` (verificado con `git stash`: fallan sin mis cambios; ZodError de campos requeridos en `ExploracionFisicaSchema`/`ExamenMedicoCompletoSchema` — ajeno a este incremento).
- Pantalla blanca post-firma (commit `d75ca0f`) sigue activa: `shouldRenderEventFlowController` con 24 tests PASS.

TypeScript (`tsc --noEmit`): sin errores en archivos modificados.

Next.js build (`npm run build`): ✅ SUCCESS (todas las rutas dinámicas y proxy compilan correctamente).

## Limitaciones del entorno

1. **NO EJECUTADO — V3 smoke real contra S3 + backend Railway.** No hay credenciales en este entorno. El fix S3 (IMPL-20260826-01) + el fix pyHanko (ronda 2) + la consolidación (este incremento) deben validarse juntos contra staging de Frank.
2. **`conftest.py` workaround** sigue activo (issue preexistente de `prisma._fields` con Python 3.14; afecta a TODOS los tests que importan `app.main`).

## Pendientes ATLAS

1. **Decisión funcional sobre el bloqueo del schema** (más arriba): ¿migrar `appointmentId` a N:1 o aceptar consolidación 1:1? ATLAS pivota con Frank.
2. **V3 smoke real** contra S3 + Railway cuando Frank autorice: upload-only → sign-pdf → verificar ZIP con carpetas por Event, manifest con `atencionEventIds`, y PDF general con sección III.B cuando aplique.
3. **General PDF del ZIP** (`01_Dictamen_General/dictamen-general.pdf`) sigue mostrando sólo el Event actual. Para consolidar este PDF con hallazgos de hermanos, `ExamenMedicoValidatedPDF` debe extenderse para aceptar `consolidatedEvents` — fuera de scope de este incremento.
4. **`ExamenMedicoValidatedPDF`** (AMI reference 4-block format) NO se ha actualizado para usar el helper de consolidación. Si Frank quiere que el dictamen general del ZIP use exactamente el formato AMI con hallazgos consolidados, requiere un nuevo incremento.
5. **15 tests preexistentes** en `medical-exam.actions.test.ts` (ZodError en schemas clínicos) — ajenos a este incremento.

## Reglas y contratos preservados

- ✅ Roles clínicos (SUPERADMIN/DOCTOR_GENERAL/DOCTOR_VALIDATOR) intactos en `route.tsx`.
- ✅ COMPANY_CLIENT 403 intacto.
- ✅ `manifest.txt` siempre presente.
- ✅ `NO_DISPONIBLE` cuando fuente ausente — no se inventa.
- ✅ `consolidatedEvents` es opcional; sin él, comportamiento legacy intacto.
- ✅ No se inventan relaciones nuevas en el schema.

## Estado final del working tree (sin commit/push)

```
M  frontend/src/actions/__tests__/signature.actions.test.ts    (+3)
M  frontend/src/actions/signature.actions.tsx                 (+70)
M  frontend/src/components/pdf/MedicalDictamenPDF.tsx         (+99 −5)
M  frontend/src/lib/__tests__/dictamen-pdf.test.ts            (+60)
M  frontend/src/lib/__tests__/zip-cierre-clinico.test.ts       (+49)
M  frontend/src/lib/dictamen-pdf.tsx                          (+44 −2)
M  frontend/src/lib/zip-cierre-clinico.ts                     (+139 −7)
?? frontend/src/lib/__tests__/event-atencion.test.ts          (NEW)
?? frontend/src/lib/event-atencion.ts                         (NEW)
?? IMPL-REPORT_FIX-20260826-01-atencion-consolidada.md         (NEW)
```
