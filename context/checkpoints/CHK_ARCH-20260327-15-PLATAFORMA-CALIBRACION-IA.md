# Checkpoint de Arquitectura

- **ID:** `ARCH-20260327-15`
- **Fecha:** `2026-03-27`
- **Estado:** `SPEC emitida`
- **Artefacto relacionado:** `context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md`

## Decisión
- Se aprueba construir un MVP de plataforma de calibración IA ligada al catálogo de pruebas.
- El MVP se divide en dos tabs por prueba: `Extracción` y `Diagnóstico`.
- La configuración inicial de calibración se ancla en `MedicalTest.options.aiCalibration` para evitar migraciones en V1.

## Motivo
- El panel raw de la papeleta resolvió inspección inmediata, pero no es el lugar correcto para gobernar calibración IA.
- El catálogo de pruebas es el ancla natural para administrar contratos, versiones y revisión técnica por estudio.

## Siguiente paso
- Handoff inmediato a `SOFIA - Builder` para implementación del MVP descrito en la SPEC.