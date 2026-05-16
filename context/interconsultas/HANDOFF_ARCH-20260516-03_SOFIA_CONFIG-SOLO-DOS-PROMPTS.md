# HANDOFF ARCH-20260516-03 a SOFIA — Simplificar configuración de calibración a solo dos prompts

- ID: ARCH-20260516-03
- Fecha: 2026-05-16
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- SPEC fuente: context/SPECs/SPEC_ARCH-20260516-03-CALIBRACION-CONFIG-SOLO-DOS-PROMPTS.md

## Objetivo

Corregir la capa de configuración del panel de calibración para que deje de pedir campos que no gobiernan el pipeline real y quede reducida a solo dos prompts/versiones por prueba:

1. extracción documental para Gemini
2. diagnóstico clínico para MedGemma

## Hallazgo ya verificado

El bloqueo actual está en el formulario de configuración:

1. hoy sigue pidiendo `targetFields`
2. hoy sigue pidiendo `requiresDoctorCalibration`
3. esto contradice la operación real que el usuario quiere: solo dos prompts por prueba

## Punto de entrada real

1. `frontend/src/components/calibration/AICalibrationEditor.tsx`
2. `frontend/src/actions/medical-profiles.ts`
3. `frontend/src/types/calibration.ts`
4. cualquier componente adyacente del panel solo si necesita reflejar el cambio visual

## Cambio mínimo obligatorio

1. mantener `enabled`
2. mantener `canonicalStudyType`
3. en Extracción dejar solo el prompt/version asociado a Gemini
4. en Diagnóstico dejar solo el prompt/version asociado a MedGemma
5. quitar del formulario visible `targetFields`
6. quitar del formulario visible `requiresDoctorCalibration`
7. dejar la UI con copy explícito de proveedor por capa

## Restricciones

1. no reabras el debate de contratos complejos dentro de este formulario
2. no conviertas esta tarea en rediseño total del módulo
3. no rompas compatibilidad de lectura con configuraciones previas ya guardadas
4. si internamente necesitas seguir leyendo `schemaVersion`, el label visible debe hablar de prompt/version de extracción

## Criterios de aceptación mínimos

1. el usuario ve solo dos prompts/versiones editables por prueba
2. queda visible qué capa usa Gemini y cuál usa MedGemma
3. desaparecen del formulario los campos que hoy sobran
4. la configuración guardada sigue cargando sin romper el panel
5. dejas validación enfocada sobre el formulario de calibración

## Entregable esperado

1. ajuste mínimo del editor de calibración
2. persistencia coherente en `aiCalibration`
3. validación enfocada sin ensanchar el alcance
4. checkpoint técnico breve explicando antes/después