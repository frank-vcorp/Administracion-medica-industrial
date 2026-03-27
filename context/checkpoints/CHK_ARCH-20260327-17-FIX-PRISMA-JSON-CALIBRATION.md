# Checkpoint de Arquitectura

- **ID:** `ARCH-20260327-17`
- **Fecha:** `2026-03-27`
- **Estado:** `Hotfix aplicado`
- **Artefacto relacionado:** `context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md`

## Ajuste aplicado
- Se normalizó la persistencia de `MedicalTest.options` hacia `Prisma.InputJsonValue` para evitar error de tipado en build de Vercel.

## Motivo
- Prisma rechazaba el objeto `aiCalibration` al venir tipado como `Record<string, unknown>` dentro del campo JSON `options`.
- El hotfix convierte explícitamente el payload a un valor JSON compatible para compilación y despliegue.