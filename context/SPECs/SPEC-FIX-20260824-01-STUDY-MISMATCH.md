# SPEC-FIX-20260824-01 — Mensaje de documento incompatible

## Origen y estado

- **Fuente funcional:** DEC-20260824-01 / FND-20260824-02.
- **Estado:** READY_FOR_SOFIA.
- **Caso reproducido:** documento `ESPIROMETRIA.pdf` cargado en estudio `AUDIOMETRIA`; MiniMax devolvió rechazo de modalidad y la UI mostró el error técnico crudo.

## Objetivo

Transformar el error de incompatibilidad de tipo en un mensaje operativo claro, sin exponer prompt, HTML, respuesta del proveedor, stack ni PII.

Mensaje esperado cuando la clasificación sea confiable:

> Seleccionaste Audiometría, pero el documento parece ser Espirometría. Abre Espirometría y vuelve a cargar el archivo.

Si el tipo detectado no es confiable, usar:

> El documento no parece corresponder al estudio seleccionado. Verifica el archivo y vuelve a intentarlo.

## Alcance autorizado

- Backend: clasificar/mapear el rechazo de modalidad a `STUDY_TYPE_MISMATCH` sin cambiar proveedor ni prompts clínicos.
- Server Action: propagar un error estructurado y sanitizado (`errorCode`, `selectedStudyType`, `detectedStudyType`, `message`), conservando detalle técnico sólo en auditoría segura.
- UI `PapeletaWorkspace`: mostrar la leyenda accionable; no renderizar el error bruto.
- Tests para Audiometría↔Espirometría y error genérico de proveedor.

## Protecciones

- No tocar calibraciones V3, publicación, snapshots, migraciones, auth, DR7/MedGemma ni contratos clínicos de extracción.
- No ocultar errores de credenciales, timeout o proveedor que no sean mismatch.
- No inferir tipo desde texto no confiable si el clasificador no lo declara.

## Criterios verificables

- AC-1: mismatch Audio→Espiro produce `STUDY_TYPE_MISMATCH` y mensaje accionable.
- AC-2: mismatch Espiro→Audio produce mensaje inverso.
- AC-3: HTML/prompt/respuesta M3 no aparece en UI ni `resultNotes`.
- AC-4: error M3 no relacionado conserva categoría técnica sanitizada.
- AC-5: extracción válida Audio y Espiro no cambia.
- AC-6: typecheck, tests focales, lint y `next build` pasan.

## Archivos previstos

- `backend/app/services/ai/*` o boundary HTTP existente de clasificación/error.
- `frontend/src/actions/event-test.actions.ts` y/o `ai-prediagnosis.actions.ts`.
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`.
- Tests del backend/frontend correspondientes.

## Rollback y validación

Cambio reversible de código, sin datos ni migración. V1 dirigida, V2 completa y Playwright final sobre un expediente de prueba con archivos del tipo correcto y un caso mismatch controlado.
