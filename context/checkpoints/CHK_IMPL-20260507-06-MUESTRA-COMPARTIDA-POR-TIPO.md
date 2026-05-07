# Checkpoint IMPL-20260507-06 — Muestra Compartida por Tipo en Papeleta

- **ID:** IMPL-20260507-06
- **Fecha:** 2026-05-07
- **Agente:** SOFIA - Builder
- **SPEC origen:** ARCH-20260507-06
- **Estado:** Entregado — pendiente QA

---

## Resumen ejecutivo

Implementada la regla de muestra compartida por tipo en la papeleta electrónica.
Al marcar `SAMPLE_TAKEN` en un estudio de laboratorio, la acción propaga automáticamente
ese estado a todos los `EventTest` hermanos del mismo grupo de muestra dentro del mismo evento.
La UI refleja el estado de forma inmediata (optimistic update) y el servidor persiste la propagación.

---

## Archivos modificados

| Archivo | Tipo de cambio |
|---------|----------------|
| `frontend/src/services/medical-event.service.ts` | Agrega `options: true` al select de `MedicalTest` en `getEventById` |
| `frontend/src/app/events/[id]/page.tsx` | Serializa `test.options` hacia `PapeletaWorkspace` |
| `frontend/src/actions/event-test.actions.ts` | Helper `resolveSampleGroupFromSnapshot` + propagación server-side en `updateEventTestStatus` |
| `frontend/src/components/clinical/PapeletaWorkspace.tsx` | Helper `resolveSampleGroup`, cálculo `groupSampleTaken`, propagación optimista, prop nueva a `StudyPanel` |

---

## Comportamiento implementado

### 1. Resolución de grupo (`resolveSampleGroup` / `resolveSampleGroupFromSnapshot`)
- **Fuente principal:** `MedicalTest.options.sampleType` (campo JSON). Si existe y no está vacío, se usa como grupo.
- **Fallback heurístico:** palabras clave en `testNameSnapshot`:
  - `sangre` → biometría, biometria, química, glucosa, colesterol, hemograma, sanguínea
  - `orina` → orina, ego, urin
  - `heces` → heces, copro
  - `otro` → sin grupo (no se propaga)

### 2. Propagación server-side (`event-test.actions.ts`)
- Solo se ejecuta cuando `status === 'SAMPLE_TAKEN'`
- Consulta el `EventTest` actualizado para obtener su grupo
- Busca hermanos en el mismo `eventId` con status `PENDING` o `IN_PROGRESS`
- Filtra por mismo grupo y actualiza con `updateMany`
- **No propaga** `RESULT_REGISTERED` ni `COMPLETED`
- **No propaga** cuando grupo es `'otro'`

### 3. Propagación client-side optimista (`PapeletaWorkspace.tsx`)
- En `handleStatusChange`, si `status === 'SAMPLE_TAKEN'`:
  - Identifica el grupo del estudio trigger
  - Llama `setLocalTests(prev => ...)` con forma funcional para obtener estado más reciente
  - Actualiza hermanos con status `PENDING` o `IN_PROGRESS` del mismo grupo
- Para otros estados, mantiene el flujo original con `updateLocalStatus`

### 4. UI — sampleTracked por grupo
- `groupSampleTaken` se calcula en `PapeletaWorkspace` verificando si algún hermano del mismo grupo ya tiene `SAMPLE_TAKEN`, `RESULT_REGISTERED` o `COMPLETED`
- Se pasa como prop a `StudyPanel`
- `sampleTracked = isLab && (estadoDirecto || groupSampleTaken)`
- El badge "✓ Muestra tomada" y el botón "🧪 Registrar muestra tomada" responden correctamente al estado del grupo

---

## Criterios de aceptación — validación

| Criterio SPEC | Estado |
|---------------|--------|
| CA-1: Dos estudios de sangre → al marcar uno, el otro se actualiza | ✅ Server propaga + client optimistic |
| CA-2: Dos estudios de orina → comportamiento equivalente | ✅ Misma lógica |
| CA-3: Sangre no marca orina | ✅ Grupos distintos, no se toca |
| CA-4: Registrar resultado sigue siendo individual | ✅ No se propaga RESULT_REGISTERED ni COMPLETED |
| CA-5: Sin migración Prisma | ✅ Solo se agregó `options: true` al select existente |

---

## Soft Gates

| Gate | Estado | Detalle |
|------|--------|---------|
| Gate 1 — Compilación | ✅ | 0 errores TS en los 4 archivos (verificado con VS Code TS checker) |
| Gate 2 — Testing | ⚠️ | Sin entorno Node/Next disponible en devcontainer para run tests |
| Gate 3 — Revisión | ✅ | Lógica verificada manualmente. Sin cambios en otros archivos. |
| Gate 4 — Documentación | ✅ | Este checkpoint + marcas de agua en código |

---

## Riesgos residuales

1. **Heurística por nombre:** Si un test tiene nombre ambiguo (ej. "Panel básico") y no tiene `options.sampleType` definido, caerá en `'otro'` y no se propagará. Esto es el comportamiento esperado — favorecer no-propagación falsa sobre propagación incorrecta.

2. **MedicalTest.options como array:** El esquema Prisma define `options Json @default("[]")`. Si el valor es un array (default) en lugar de un objeto, la heurística por nombre se activa correctamente como fallback.

3. **Hermanos ya en RESULT_REGISTERED/COMPLETED:** No se propaga hacia atrás (correcto por diseño). La UI muestra `sampleTracked` via `groupSampleTaken` para estos casos.

4. **Race condition en Autopilot:** Si dos capturistas marcan SAMPLE_TAKEN simultáneamente en estudios del mismo grupo, el segundo `updateMany` operará sobre estados ya actualizados. Resultado idempotente (ambos quedan en SAMPLE_TAKEN). Sin riesgo de datos corruptos.
