# HANDOFF a SOFIA — Outer-tab "Antecedentes" en Examen Médico

**De:** INTEGA (Spark 1.1)
**Para:** SOFIA (M3 ilimitado)
**Fecha:** 2026-08-09
**SPEC:** `context/SPECs/SPEC_ARCH-20260809-01-ANTECEDENTES-OUTER-TAB-EXAMEN-MEDICO.md`
**ADR:** `context/decisions/ADR-20260809-01-ANTECEDENTES-SNAPSHOT-POR-CITA.md`
**SPEC padre respetada:** `context/SPECs/SPEC_ARCH-20260326-04-HISTORIAL-MAESTRO-EXAMEN-SNAPSHOT.md`

## Objetivo

Implementar una 5ª outer-tab "Antecedentes" en `ExamenMedicoEstudio.tsx`, editable, que precargue los datos del portal/historial maestro y persista como **snapshot por cita** en `physicalExamData.antecedentes_captured`. No romper el flujo actual de Examen Médico.

## Restricciones innegociables

1. **No modificar** el flujo de la pestaña 4 (Examen Médico → Exploración/Impresión). Su action `saveExamenMedicoPapeleta` y su disparo de IA quedan intactos.
2. **No sobrescribir** el historial maestro. La nueva outer-tab persiste solo en `physicalExamData.antecedentes_captured` (snapshot local). El CTA al historial maestro es un link, no un side-effect.
3. **No disparar IA** desde la nueva outer-tab. La action `saveAntecedentesCaptura` NO invoca `triggerStructuredStudyAIPrediagnosis`.
4. **No cambiar** `EventTest.status` desde la nueva outer-tab.
5. **No añadir migración Prisma.** `physicalExamData` ya es `Json?` (ver `prisma/schema.prisma:427`).
6. **No añadir lógica de rol nueva.** Heredar `readonly` existente.
7. **No commit/push/PR** sin OK explícito de Frank.
8. **Qodo está sunset** — NO invocar `qodo`. La segunda mano la hará GEMINI.

## Alcance (archivos)

| Archivo | Acción |
|---|---|
| `frontend/src/lib/antecedentes-fields.ts` | NUEVO — extraer diccionarios de `AntecedentesForm.tsx` |
| `frontend/src/components/clinical/AntecedentesCaptura.tsx` | NUEVO — editor snapshot por cita |
| `frontend/src/components/clinical/AntecedentesForm.tsx` | MODIFICAR — reimportar de `antecedentes-fields.ts` |
| `frontend/src/schemas/clinical/exam.schema.ts` | MODIFICAR — `AntecedentesCapturaSchema` + extender `ExamenMedicoCompletoSchema` |
| `frontend/src/actions/medical-exam.actions.ts` | MODIFICAR — añadir `saveAntecedentesCaptura` |
| `frontend/src/app/events/[id]/_lib/event-page-data.ts` | MODIFICAR — inyectar `no_patologicos` + `patologicos` (`:185-199`) |
| `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` | MODIFICAR — 5ª outer-tab, estado, render, `LONGITUDINAL_SECTIONS` a 5 |
| Tests del action | NUEVO/MODIFICAR |
| `frontend/tests/flujo-completo.spec.ts` | MODIFICAR — regresión TC-08 |

## Contratos clave (referencias, NO código — ver SPEC §4, §7, §8)

- **Schema Zod:** `AntecedentesCapturaSchema = ClinicalHistoryDataSchema.extend({ _provenance: ... })`. Reusar `ClinicalHistoryDataSchema` de `history.schema.ts:148-154`. Extender `ExamenMedicoCompletoSchema` (`exam.schema.ts:121-127`) con `antecedentes_captured: AntecedentesCapturaSchema.optional()`.
- **Action `saveAntecedentesCaptura(eventId, rawData)`:** read-modify-write merge sobre `physicalExamData` (NO pisar Exploración/Impresión/Módulo1). Validar con `AntecedentesCapturaSchema.parse(rawData)`. `revalidatePath`. Retorna `{ success, error? }`. No IA, no status change.
- **Componente `AntecedentesCaptura`:** props `eventId, workerId?, initialData?, fallbackLongitudinal?, prefilledData?, readonly?`. Precarga en cascada: snapshot previo → portal → longitudinal. Badges de proveniencia por campo. CTA a `/history/${workerId}`.
- **Loader:** añadir `no_patologicos` y `patologicos` a la desestructuración de `histData` raíz en `event-page-data.ts:185-199`, mismo patrón que `rootDP`/`rootHL`/`rootHF`.
- **ExamenMedicoEstudio:** `type OuterTab` añade `'antecedentes'`; array `outerTabs` (`:356-361`) añade entrada con `locked: false` SIEMPRE; render condicional `outerTab === 'antecedentes'` → `<AntecedentesCaptura .../>`; `LONGITUDINAL_SECTIONS` (`:69-73`) pasa de 3 a 5 entradas.

## Validaciones obligatorias antes de reportar como listo

```
1. pnpm typecheck          → 0 errores (baseline preservado)
2. pnpm test               → vitest sin regresión + tests nuevos del action
3. pnpm lint               → 0 errores

Segunda mano: GEMINI (subagent_type='gemini') tras implementación.
NO uses qodo (sunset).

Self-review manual:
  - ¿El código refleja la SPEC §3-§9?
  - ¿El action hace merge no destructivo sobre physicalExamData?
  - ¿Los tests cubren CP-1..CP-5 (SPEC §11)?
  - ¿La pestaña 4 (Exploración/Impresión) queda intacta?
  - ¿Compatibilidad retroactiva: exámenes sin antecedentes_captured siguen abriendo?
```

## DoD

- CA-1..CA-15 (SPEC §11) verificados con evidencia.
- Gates typecheck/test/lint en verde.
- GEMINI auditoría completada (0 bloqueadores).
- Reporte estructurado a INTEGA: archivos tocados, resultado de gates, capturas si las hubo, riesgos/desviaciones.

## Notas

- El helper `antecedentes-fields.ts` es **prerrequisito**: extraer PRIMERO, antes de crear `AntecedentesCaptura.tsx`, para que ambos componentes (`AntecedentesForm` y `AntecedentesCaptura`) importen de la misma fuente.
- `AntecedentesForm.tsx` ya funciona y escribe al maestro — **no rediseñarlo**, solo reimportar los diccionarios del helper.
- Si surge ambigüedad no cubierta por la SPEC, reportar a INTEGA (no improvisar decisiones de contrato).
