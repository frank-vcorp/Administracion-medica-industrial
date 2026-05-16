# HANDOFF ARCH-20260516-04 a SOFIA — Barra y progreso por etapas en upload/procesamiento IA

- ID: ARCH-20260516-04
- Fecha: 2026-05-16
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementación
- SPEC fuente: context/SPECs/SPEC_ARCH-20260516-04-PROGRESO-POR-ETAPAS-UPLOAD-IA.md

## Objetivo

Mejorar la UX de espera cuando se sube un estudio y se dispara el pipeline IA desde la papeleta, mostrando barra y progreso por etapas visibles en vez del estado opaco actual.

## Hallazgo ya verificado

1. la UI solo tiene `isUploading`
2. detrás de esa espera ocurren varias fases reales
3. el usuario no sabe si el sistema sigue trabajando o se trabó

## Punto de entrada real

1. `frontend/src/components/clinical/PapeletaWorkspace.tsx`
2. componente visual pequeño auxiliar si te conviene extraerlo

## Alcance mínimo obligatorio

1. mostrar barra de progreso mientras corre upload/procesamiento
2. mostrar las etapas:
   - Subiendo archivo
   - Clasificando estudio
   - Extrayendo datos con Gemini
   - Generando prediagnóstico con MedGemma
   - Guardando resultado
3. resaltar la etapa activa
4. limpiar el estado visual al terminar o fallar

## Restricciones

1. no conviertas esto en jobs async o polling server-side
2. no cambies el contrato del backend salvo que sea absolutamente innecesario
3. mantén la implementación pequeña y honesta

## Criterios de aceptación mínimos

1. el usuario ve barra + etapas durante la espera
2. el copy deja claro que no es solo upload, sino procesamiento IA
3. la UX reduce la ambigüedad actual
4. validas el slice tocado sin ensanchar alcance

## Entregable esperado

1. mejora visual funcional en la papeleta
2. validación enfocada
3. checkpoint breve con antes/después