# RESUMEN_ARCH-20260527-15

## Roadmap de Implementación para SOFIA — Admisión en Tres Flujos

| Orden | Slice | Objetivo | Estado | Dependencia | Archivo ancla | Riesgo principal | Validación esperada |
|------|-------|----------|--------|-------------|---------------|------------------|---------------------|
| 1 | ARCH-20260527-11 | Trazabilidad mínima de convergencia a `MedicalEvent` | Listo para implementar | Marco ARCH-20260527-10 | `frontend/prisma/schema.prisma` | Romper eventos históricos o recepción actual | `cd frontend && pnpm exec prisma validate && pnpm exec eslint src/actions/event.actions.ts src/app/reception/page.tsx src/app/events/[id]/page.tsx` |
| 2 | ARCH-20260527-12 | Recepción por `Project` para pre-registrados | Listo para implementar | Slice A | `frontend/src/components/ProjectsCalendar.tsx` | Duplicar eventos o forzar ruta nueva | `cd frontend && pnpm exec prisma validate && pnpm exec eslint src/actions/project.actions.ts src/actions/event.actions.ts src/components/ProjectsCalendar.tsx` |
| 3 | ARCH-20260527-13 | Alta rápida empresarial del mismo día | Listo para implementar | Slice B | `frontend/src/components/ProjectsCalendar.tsx` | Reimplementar de más la alta masiva formal | `cd frontend && pnpm exec eslint src/components/ProjectsCalendar.tsx src/components/BulkWorkerImportModal.tsx src/actions/worker.actions.ts src/actions/project.actions.ts src/components/ProjectFormModal.tsx` |
| 4 | ARCH-20260527-14 | Admisión externa sin empresa | Listo para implementar | Slice A | `frontend/src/components/CheckInModal.tsx` | Forzar empresa falsa o mezclar con `Project` | `cd frontend && pnpm exec eslint src/components/CheckInModal.tsx src/actions/event.actions.ts src/actions/worker.actions.ts src/app/reception/page.tsx src/app/events/[id]/page.tsx` |

## Orden recomendado

1. Primero Slice A para dejar trazabilidad de origen y evitar trabajo ciego en los siguientes slices.
2. Luego Slice B para cerrar el flujo empresarial pre-registrado de extremo a extremo.
3. Después Slice C para cubrir el caso ad hoc empresarial del mismo día reutilizando la base de B.
4. Al final Slice D para externos, porque depende del contrato de convergencia pero no de `Project`.

## Regla de ejecución

SOFIA debe trabajar en secuencia y validar cada slice antes de abrir el siguiente. Si un slice devuelve `BLOQUEO DE CONTEXTO`, no debe saltarlo silenciosamente ni improvisar arquitectura; debe detener la cadena y reportar el bloqueo exacto.