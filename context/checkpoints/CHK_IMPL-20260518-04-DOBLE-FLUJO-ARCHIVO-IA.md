# CHK_IMPL-20260518-04 — Doble Flujo de Archivo IA

- ID: IMPL-20260518-04
- Fecha: 2026-05-18
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260518-04-DOBLE-FLUJO-REEMPLAZAR-O-LIMPIAR-ARCHIVO-IA.md
  - context/interconsultas/DICTAMEN_FIX-20260518-01.md

## Cambios implementados

1. Se agregó acción server `clearEventTestFile()` para limpiar archivo activo y snapshots vigentes del estudio sin hard delete del histórico.
2. Se cambió `triggerStudyAIAnalysis()` para marcar snapshots vigentes previos como `isSuperseded = true` antes de crear una nueva corrida activa.
3. Se completó en la UI el doble flujo:
   - reemplazar archivo con actualización optimista del snapshot extractivo
   - eliminar archivo y limpiar análisis con confirmación explícita
4. Se mantuvo la semántica de auditoría: el histórico se preserva y la vista operativa solo consume snapshots no superseded.

## Archivos tocados

- frontend/src/actions/ai-prediagnosis.actions.ts
- frontend/src/actions/event-test.actions.ts
- frontend/src/components/clinical/PapeletaWorkspace.tsx

## Validación

1. Validación estática con `get_errors` sobre los 3 archivos tocados.
2. Resultado: sin errores reportados.

## Riesgos / pendientes

1. No se ejecutaron tests automatizados por limitación del entorno actual de terminal/pytest.
2. El cleanup implementado es lógico; no elimina físicamente el archivo histórico en storage.
3. La UI sigue llamando `router.refresh()` como refuerzo, aunque ahora el snapshot extractivo ya puede actualizarse en cliente de forma optimista.
