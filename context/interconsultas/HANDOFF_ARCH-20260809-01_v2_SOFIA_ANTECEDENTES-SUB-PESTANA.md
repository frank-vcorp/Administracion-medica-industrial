# HANDOFF a SOFIA — Sub-pestaña "Antecedentes" dentro de Examen Médico (v2)

**De:** INTEGA (Spark 1.1)
**Para:** SOFIA (M3 ilimitado)
**Fecha:** 2026-08-09
**SPEC vigente:** `context/SPECs/SPEC_ARCH-20260809-01-ANTECEDENTES-SUB-PESTANA-EXAMEN-MEDICO.md` (v2)
**SPEC v1 (SUPERSEDED):** `context/SPECs/SPEC_ARCH-20260809-01-ANTECEDENTES-OUTER-TAB-EXAMEN-MEDICO.md`
**ADR:** `context/decisions/ADR-20260809-01-ANTECEDENTES-SNAPSHOT-POR-CITA.md` (con nota de revisión SPEC v2)
**SPEC padre respetada:** `context/SPECs/SPEC_ARCH-20260326-04-HISTORIAL-MAESTRO-EXAMEN-SNAPSHOT.md`
**Implementación:** `IMPL-20260809-02` (rework de `IMPL-20260809-01`, commit `a1b2f44`, ya en `main`)

## Objetivo

Mover "Antecedentes" de 5ª **outer-tab** (v1, rechazada en prod) a **primera sub-pestaña dentro de "Examen Médico"** (outer-tab 4). Refactorizar `AntecedentesCaptura` a componente controlado. Eliminar el action `saveAntecedentesCaptura` e integrar la persistencia en `saveExamenMedicoPapeleta` (mismo action que Módulo 1/Exploración/Impresión).

## Restricciones innegociables

1. **No modificar** el action `saveExamenMedicoPapeleta` (su lógica de full-replace + IA + status change es **correcta y esperada** para v2). Solo se elimina `saveAntecedentesCaptura`.
2. **No sobrescribir** el historial maestro. Antecedentes persiste en `physicalExamData.antecedentes_captured` (snapshot local). El CTA al historial maestro es un link, no un side-effect.
3. **No añadir migración Prisma.** `physicalExamData` ya es `Json?` (`prisma/schema.prisma:427`).
4. **No añadir lógica de rol nueva.** Heredar `readonly` existente.
5. **No commit/push/PR** sin OK explícito de Frank.
6. **Qodo está sunset** — NO invocar `qodo`. La segunda mano la hará GEMINI (`subagent_type='gemini'`).
7. **No rediseñar** el layout de `AntecedentesCaptura.tsx` (grid DP/HL/HF + NP + P). Solo refactorizar a controlado.
8. **No tocar** `antecedentes-fields.ts`, `AntecedentesForm.tsx`, `event-page-data.ts`, `exam.schema.ts` — ya correctos desde v1.

## Alcance (archivos a MODIFICAR — 4 archivos + 1 test)

| Archivo | Acción | Líneas clave |
|---|---|---|
| `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` | MODIFICAR | `OuterTab` (`:29`) → 4 valores; `InnerTab` (`:31`) → añadir `'antecedentes'` primero; `activeInnerTab` default (`:184`) → `'antecedentes'`; `outerTabs` (`:407-413`) → quitar entrada antecedentes; `innerTabs` (`:293-297`) → añadir antecedentes primero; levantar estado `antecedentes_captured`; `buildPayload()` (`:306-315`) → incluir antecedentes_captured (revertir I-1); banner (`:455`) → revertir I-4; eliminar bloque `outerTab === 'antecedentes'` (`:733-748`); añadir bloque `activeInnerTab === 'antecedentes'` dentro de examen_medico |
| `frontend/src/components/clinical/AntecedentesCaptura.tsx` | MODIFICAR | pasar a controlado: props `value/onChange/initialProvenance`; eliminar `import { saveAntecedentesCaptura }` (`:25`); eliminar `handleSave` (`:247-288`); eliminar botón guardar (`:626-635`); conservar `buildInitialState`, `pickPrefill`, `stripEmptyEnumKeys`, `FieldRow`, layout, badges, CTA maestro |
| `frontend/src/actions/medical-exam.actions.ts` | MODIFICAR | eliminar `saveAntecedentesCaptura` (`:261-333`); eliminar import `AntecedentesCapturaSchema` (`:15`) si no se usa más en el archivo; `saveExamenMedicoPapeleta` SIN cambios |
| `frontend/src/actions/__tests__/medical-exam.actions.test.ts` | MODIFICAR | eliminar tests 1-12 y 18 (del action eliminado); conservar tests 13-17 (schemas, siguen válidos); añadir tests de `saveExamenMedicoPapeleta` con `antecedentes_captured` en payload (CP-6/CP-7 SPEC §11) |
| `frontend/tests/flujo-completo.spec.ts` | MODIFICAR | TC-08/TC-08b: 4 outer-tabs + Antecedentes como primera inner-tab |

## Archivos SIN cambios (no tocar)

| Archivo | Por qué |
|---|---|
| `frontend/src/schemas/clinical/exam.schema.ts` | `AntecedentesCapturaSchema` + `ExamenMedicoCompletoSchema` ya correctos (v1 rework I-1) |
| `frontend/src/lib/antecedentes-fields.ts` | Extraído en v1, sin cambios |
| `frontend/src/components/clinical/AntecedentesForm.tsx` | Ya reimporta del helper |
| `frontend/src/app/events/[id]/_lib/event-page-data.ts` | Ya inyecta 5 secciones (v1) |
| `prisma/schema.prisma` | `physicalExamData` ya es `Json?` |

## Archivos a ELIMINAR

**Ninguno.** `saveAntecedentesCaptura` se elimina del archivo `medical-exam.actions.ts` (no es un archivo separado). No hay archivos huérfanos.

## Contratos clave (referencias a SPEC v2, NO código)

### ExamenMedicoEstudio.tsx
- **`OuterTab`** vuelve a 4 valores (sin `'antecedentes'`).
- **`InnerTab`** = `'antecedentes' | 'declarativa' | 'exploracion' | 'impresion'` (antecedentes PRIMERO).
- **`activeInnerTab`** default `'antecedentes'`.
- **`outerTabs`** array: quitar la entrada `{ id: 'antecedentes', ... }` (línea 411). Vuelve a 4 entradas.
- **`innerTabs`** array: añadir `{ id: 'antecedentes', label: 'Antecedentes', icon: '🩺', done: hasAntecedentes }` como PRIMERA entrada (antes de declarativa).
- **Estado `antecedentes_captured`**: levantar al padre. Mismo patrón que `modulo1` (`:191-200`): inicializar desde `physicalExamData.antecedentes_captured` con fallback a `longitudinalData`/`prefilledData` (usar `pickPrefill` de `AntecedentesCaptura.tsx:192-207` — esa función se queda en el hijo o se mueve al padre; SOFIA decide, pero el contrato es que el padre tenga el estado resuelto).
- **`buildPayload()`**: revertir I-1. En vez de `const { antecedentes_captured: _antecedentesCaptured, ...rest } = form; return { ...rest, aptitud, modulo1 }`, hacer `return { ...form, aptitud: aptitud || undefined, modulo1, antecedentes_captured: antecedentesState }`.
- **Banner ámbar** (`:455`): quitar `&& outerTab !== 'antecedentes'`. Vuelve a `{outerTab !== 'examen_medico' && !canAccessExamen && (...)}`.
- **Eliminar** bloque `outerTab === 'antecedentes'` (`:733-748`).
- **Añadir** dentro de `outerTab === 'examen_medico' && canAccessExamen`, un bloque `{activeInnerTab === 'antecedentes' && (<AntecedentesCaptura value={antecedentesState} onChange={setAntecedentesState} initialProvenance={...} workerId={workerId} readonly={readonly} />)}` como primera sub-pestaña.
- **Navegación**: Antecedentes tiene botón "Continuar → Módulo 1" (setActiveInnerTab('declarativa')). Opcional "💾 Guardar borrador" → `handleSave(false)`.

### AntecedentesCaptura.tsx
- Props cambian: `value: AntecedentesCaptura | null`, `onChange: (next) => void`, `initialProvenance?: {...}`, `workerId?`, `readonly?`. **Quitan** `eventId` (ya no llama action), `initialData`, `fallbackLongitudinal`, `prefilledData`.
- Eliminar: `import { saveAntecedentesCaptura }`, `handleSave`, `isSaving`/`saveMsg` state, botón "💾 Guardar antecedentes".
- Conservar: `buildInitialState` (usado para inicializar desde `value`), `pickPrefill` (si el padre lo delega), `stripEmptyEnumKeys` (limpiar enums vacíos antes de `onChange`), `FieldRow`, layout completo (grid 3 col + NP + P), badges de proveniencia, CTA "Editar historial longitudinal maestro →".
- Al cambiar un campo: `setForm` local + emitir `onChange(payloadNormalizado)` (con `stripEmptyEnumKeys` aplicado). El padre acumula y lo incluye en `buildPayload()`.

### medical-exam.actions.ts
- Eliminar función `saveAntecedentesCaptura` completa (`:261-333`).
- Eliminar `AntecedentesCapturaSchema` del import block (`:10-16`) si queda sin uso. (Verificar: `ExamenMedicoCompletoSchema` ya está importado y lo usa `saveExamenMedicoPapeleta`. `AntecedentesCapturaSchema` solo lo usaba `saveAntecedentesCaptura`.)
- `saveExamenMedicoPapeleta` SIN cambios: ya valida con `ExamenMedicoCompletoSchema` (que acepta `antecedentes_captured`), ya hace full-replace, ya dispara IA, ya cambia status.

### Tests (medical-exam.actions.test.ts)
- **Eliminar** tests 1-12 (describe block `medical-exam.actions saveAntecedentesCaptura` que usa `saveAntecedentesCaptura` import). **Eliminar** test 18 (también llama al action).
- **Conservar** tests 13-15 (prueban `ExamenMedicoCompletoSchema.parse` con/sin `antecedentes_captured` — el schema sigue existiendo).
- **Conservar** tests 16-17 (prueban `AntecedentesCapturaSchema`/`DatosPersonalesModulo1Schema` — schemas sin cambios).
- **Añadir** tests nuevos: `saveExamenMedicoPapeleta` con payload que incluye `antecedentes_captured` → verifica que el snapshot se persiste en `physicalExamData` (mock de `prisma.medicalExam.upsert` + aserción de que el `update.physicalExamData.antecedentes_captured` está presente y tiene los valores).
- Actualizar el header del archivo (`@spec` reference) a SPEC v2.
- Eliminar el import `saveAntecedentesCaptura` del test (línea 39).

### flujo-completo.spec.ts TC-08
- Antes (v1): verificaba 5ª outer-tab "Antecedentes".
- Ahora (v2): abrir Examen Médico → ver 4 sub-pestañas con "Antecedentes" como primera → editar un campo de antecedentes → guardar → verificar persistencia.

## Validaciones obligatorias antes de reportar como listo

```
1. pnpm typecheck          → 0 errores (baseline preservado)
2. pnpm test               → vitest sin regresión; tests de saveAntecedentesCaptura eliminados;
                              tests de schema conservados; tests nuevos de saveExamenMedicoPapeleta con antecedentes_captured
3. pnpm lint               → 0 errores

Segunda mano: GEMINI (subagent_type='gemini') tras implementación.
NO uses qodo (sunset).

Self-review manual:
  - ¿buildPayload() incluye antecedentes_captured como objeto (NO string)?
  - ¿saveAntecedentesCaptura fue eliminada y ningún archivo la importa/importa su test?
  - ¿AntecedentesCaptura es controlado (value/onChange) y sin botón guardar propio?
  - ¿activeInnerTab default es 'antecedentes' y es la primera entrada de innerTabs?
  - ¿El banner ámbar volvió a la condición original (sin exclusión 'antecedentes')?
  - ¿outerTabs tiene 4 entradas (sin 'antecedentes')?
  - ¿Compatibilidad retroactiva: exámenes sin antecedentes_captured siguen abriendo?
  - ¿TC-08 E2E pasa con la nueva estructura (4 outer + 4 inner)?
  - ¿El estado antecedentes se rehidrata desde physicalExamData.antecedentes_captured al montar?
```

## Plan de rollback documentado

- **Rollback del commit:** si `IMPL-20260809-02` causa problemas, `git revert <commit-v2>` restaura v1 (outer-tab, commit `a1b2f44` en `main`). Trivial.
- **Rollback parcial:** si la sub-pestaña causa problemas, ocultar el bloque `activeInnerTab === 'antecedentes'` (no renderizar) sin tocar el action. El snapshot ya persistido queda huérfano en JSON pero no rompe nada.
- **No requiere** rollback de BD ni migración inversa (`physicalExamData` es `Json?`).

## DoD

- CA-1..CA-17 (SPEC v2 §11) verificados con evidencia.
- Gates typecheck/test/lint en verde.
- GEMINI auditoría completada (0 bloqueadores).
- Reporte estructurado a INTEGA: archivos tocados, resultado de gates, capturas si las hubo, riesgos/desviaciones.

## Notas

- El helper `antecedentes-fields.ts` ya está extraído (v1) — **no tocar**.
- `AntecedentesForm.tsx` ya funciona y escribe al maestro — **no rediseñarlo**.
- `event-page-data.ts` ya inyecta las 5 secciones (v1) — **no tocar**.
- `exam.schema.ts` ya tiene `AntecedentesCapturaSchema` + `ExamenMedicoCompletoSchema` con `antecedentes_captured` (v1 rework) — **no tocar**.
- Si surge ambigüedad no cubierta por la SPEC v2, reportar a INTEGA (no improvisar decisiones de contrato). Iterative Retrieval: INTEGA responderá 1-2 preguntas de clarificación antes de aceptar el resultado.
- El estado `antecedentes_captured` debe tratarse **igual que `modulo1`**: estado separado del `form` plano (que solo lleva primitivos), inicializado desde DB al montar, incluido en `buildPayload()`.
