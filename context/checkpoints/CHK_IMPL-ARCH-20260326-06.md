# Checkpoint de Implementación

**ID:** `IMPL-ARCH-20260326-06`
**Fecha:** `2026-03-26`
**Tema:** Historial Clínico como editor maestro longitudinal

## Implementado
- `ClinicalHistory.data` raíz se usa como base longitudinal maestra para datos personales, historia laboral, heredo-familiares, no patológicos y patológicos.
- El portal de prellenado ahora alimenta esa base maestra y mantiene `PrefilledInvitation.module1Data` como snapshot por cita.
- `upsertWorkerClinicalHistory()` hace merge defensivo para no borrar secciones longitudinales no editadas.
- El formulario de Historial Clínico se expandió a editor maestro longitudinal con múltiples secciones.
- La ficha del trabajador y la vista de historial leen la base longitudinal desde la raíz y usan `prefill_base` solo como fallback legado cuando haga falta.
- El Examen Médico elimina la recaptura editable de datos personales, historia laboral, heredo-familiares, patológicos y no patológicos, mostrando referencia longitudinal y acceso directo al Historial Clínico.

## Archivos impactados
- `frontend/src/schemas/clinical/history.schema.ts`
- `frontend/src/schemas/clinical/prefilled.schema.ts`
- `frontend/src/actions/clinical-history.actions.ts`
- `frontend/src/actions/prefilled-invitation.actions.ts`
- `frontend/src/components/clinical/AntecedentesForm.tsx`
- `frontend/src/components/clinical/ExamenMedicoEstudio.tsx`
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- `frontend/src/app/history/[workerId]/page.tsx`
- `frontend/src/app/workers/[id]/page.tsx`
- `frontend/src/app/events/[id]/page.tsx`

## Validación
- Errores de editor: sin hallazgos en los archivos modificados.
- Build frontend: compila TypeScript y los cambios introducidos no reportan errores propios.
- Bloqueo residual externo: el build sigue fallando en prerender de rutas ajenas por ausencia de `DATABASE_URL` en el entorno.

## Riesgo residual
- El componente de Examen Médico mantiene únicamente los fragmentos declarativos que siguen perteneciendo al episodio clínico actual, principalmente ginecológicos e inmunizaciones reportadas cuando aplican.