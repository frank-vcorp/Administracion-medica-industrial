# SPEC ARCH-20260516-04 — Progreso por etapas y barra para upload/procesamiento IA

- ID: ARCH-20260516-04
- Fecha: 2026-05-16
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md
  - context/SPECs/SPEC_ARCH-20260516-03-CALIBRACION-CONFIG-SOLO-DOS-PROMPTS.md

## Objetivo

Hacer más amigable la espera durante el upload y procesamiento IA de estudios en la papeleta clínica, mostrando una barra de progreso y etapas visibles del pipeline en lugar del estado opaco actual de “subiendo archivo”.

## Problema actual

Hoy la UI solo expone un booleano `isUploading`, pero la operación real incluye múltiples fases:

1. subir archivo
2. clasificar estudio
3. extraer datos con Gemini
4. generar prediagnóstico con MedGemma
5. guardar snapshots/resultado

Para el usuario eso se percibe como una sola espera larga, sin saber si:

1. el sistema sigue trabajando
2. se trabó
3. ya terminó el upload pero sigue la IA

## Decisión de arquitectura

Se aprueba una mejora UX ligera y honesta basada en **progreso por etapas**, no en porcentaje técnico exacto de backend.

La UI debe mostrar:

1. una barra de progreso visual
2. una lista/stepper de etapas del pipeline
3. el estado actual resaltado

## Regla de honestidad UX

No se debe vender el porcentaje como métrica exacta del backend. El porcentaje visible será una representación UX de etapas alcanzadas, no un cálculo de bytes ni de tiempo restante.

## Etapas aprobadas

La implementación debe usar, como mínimo, estas fases visibles:

1. `Subiendo archivo`
2. `Clasificando estudio`
3. `Extrayendo datos con Gemini`
4. `Generando prediagnóstico con MedGemma`
5. `Guardando resultado`

## Mapeo UX sugerido

Barra basada en hitos:

1. Subiendo archivo → 10%
2. Clasificando estudio → 25%
3. Extrayendo datos con Gemini → 50%
4. Generando prediagnóstico con MedGemma → 80%
5. Guardando resultado → 100%

Este mapeo es orientativo y debe presentarse como progreso de etapas, no como telemetría exacta.

## Alcance aprobado

Incluye:

1. estado local adicional en el workspace clínico para reflejar la fase actual
2. barra de progreso visible durante el procesamiento
3. stepper o lista compacta de etapas con la fase activa resaltada
4. copy más claro que diferencie upload de procesamiento IA
5. reset limpio del estado al terminar o fallar

No incluye:

1. migración a jobs asíncronos reales
2. endpoint de progreso del backend
3. polling en tiempo real del servidor
4. cancelación explícita del job

## Punto de entrada esperado

1. `frontend/src/components/clinical/PapeletaWorkspace.tsx`
2. componentes auxiliares de UI si SOFIA decide extraer uno pequeño
3. solo lectura del flujo existente en `frontend/src/actions/event-test.actions.ts` y `frontend/src/actions/ai-prediagnosis.actions.ts`

## Restricciones

1. no rediseñar el pipeline backend en esta iteración
2. no introducir estados falsamente “en vivo” si la UI no puede distinguirlos honestamente
3. no romper el flujo actual de upload ni la regeneración IA
4. mantener la implementación pequeña y enfocada

## Criterios de aceptación

1. durante el upload/procesamiento IA el usuario ve una barra de progreso
2. durante la espera el usuario ve las etapas del pipeline y cuál está activa
3. el copy deja claro que la operación incluye procesamiento IA, no solo upload
4. el estado visual se limpia correctamente al terminar o fallar
5. la UX reduce la ambigüedad de “no sé si se trabó o sigue trabajando”

## Criterio de éxito

La iteración será exitosa cuando el usuario vea una espera guiada y comprensible durante el pipeline IA del estudio, sin necesidad de adivinar si el sistema sigue trabajando o quedó trabado.