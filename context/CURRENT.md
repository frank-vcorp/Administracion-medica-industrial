# CURRENT — ARCH-20260820-01 / DEC-20260820-03

- **Actualizado:** 2026-08-20 22:15 CST
- **WIP:** Cableado visible del editor V3 en Calibración IA — SPEC-HANDOFF emitido.
- **Estado:** READY_FOR_SOFIA (handoff en `context/interconsultas/HANDOFF_ARCH-20260820-01_FASE2B_SOFIA_EDITOR-V3.md`).
- **Decisión funcional confirmada:** `discovery/DECISIONS.md` → `DEC-20260820-03`: desde Admin → Servicios → Calibración IA, un administrador debe poder guardar `draft/tested` y publicar explícitamente `published`, manteniendo fallback V1/V2 y sin editor para `manual_service`.
- **Observación:** la pantalla actual muestra workspace legacy `calib-v2`; `AICalibrationEditor` existe y guarda V3, pero la página no pasa `operationMode` y no expone un flujo visible para publicar `publishAICalibrationV3`.
- **Alcance confirmado:** mantener ruta/tabs actuales; cablear estado V3, guardado draft/test y publicación; no rediseñar Events, no eliminar hardcodeos, no FamilyTemplate, no migraciones adicionales.
- **Artefactos previos:** `SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md`, `ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md`, commit `ca0b9f8` con hotfix Vercel, migración de snapshots aplicada en Railway producción.
- **Siguiente paso:** ATLAS activa la sesión independiente de SOFIA con el handoff `HANDOFF_ARCH-20260820-01_FASE2B_SOFIA_EDITOR-V3.md` (estado READY). SOFIA implementa el cableado UI (page → workspace → editor/panel), valida `typecheck`/`vitest`/`lint`/`build Vercel` y reporta `READY_FOR_VERIFYING`; INTEGRA recibe, verifica AC-2B.x y decide GEMINI (RBAC + contrato visible).
