# Checkpoint de Arquitectura

- **ID:** `ARCH-20260327-18`
- **Fecha:** `2026-03-27`
- **Estado:** `Hotfix aplicado`
- **Artefacto relacionado:** `context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md`

## Ajuste aplicado
- Se tipó explícitamente la lectura de `prediagnosisData` en `CalibrationTabs` para evitar render directo de valores `unknown` en JSX.

## Motivo
- El build de Vercel fallaba con `Type 'unknown' is not assignable to type 'ReactNode'` en el tab de Diagnóstico.
- El hotfix normaliza summary, estado clínico, confianza, justificación, limitaciones y red flags antes del render.