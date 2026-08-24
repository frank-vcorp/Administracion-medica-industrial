# SPEC-FEATURE-20260824-01 — Criterios clínicos de Espirometría en Events

- **Estado:** READY_FOR_SOFIA
- **Revisión:** 1.1 — corrección por evidencia visual del Event y requerimiento explícito de Frank, 2026-08-24
- **Origen:** FND-20260824-03
- **Prioridad:** P1 UX/funcional
- **Fuente de prueba:** `context/RD2026/ESPIROMETRIA.pdf`

## 1. Objetivo

Mostrar en Events la información de calidad, repetibilidad y criterios clínicos que aparece después de las gráficas en el PDF de Espirometría, inmediatamente arriba del panel `Prediagnóstico IA`.

La sección no puede limitarse a mostrar `notas_calidad`: debe mostrar los campos individuales aun cuando el extractor sólo entregue la tabla `parametros[]` y las notas generales. Los valores calculables deben derivarse de la tabla fuente de forma determinista y visible.

## 2. Alcance incluido

Para estudios canónicos `Espirometria`, renderizar una sección visible antes de `StudyAIPrediagnosisPanel` con los campos disponibles del snapshot de extracción:

- Pico máximo.
- Forma triangular.
- Libre de artefactos.
- Meseta.
- Tiempo.
- Repetibilidad FVC < 200.
- Repetibilidad FEV1 < 200.
- Número de pruebas aceptables.
- Criterios para diagnóstico.
- Calidad.
- Repetibilidad FVC numérica en ml.
- Repetibilidad FEV1 numérica en ml.
- Si están disponibles en el payload, impresión diagnóstica y recomendaciones como **texto fuente del documento**, sin presentarlos como diagnóstico generado por IA.

El bloque debe tolerar snapshots históricos o payloads parciales: campos ausentes no generan errores ni valores inventados.

## 2.1 Cálculos obligatorios desde la tabla fuente

Cuando `parametros[]` contiene las maniobras M1/M2/M3:

- `repetibilidad_fvc_ml`: diferencia absoluta entre los dos valores FVC más altos.
- `repetibilidad_fev1_ml`: diferencia absoluta entre los dos valores FEV1 más altos.
- `repetibilidad_fvc_menor_200`: `Sí` si la diferencia FVC es menor que 200 ml.
- `repetibilidad_fev1_menor_200`: `Sí` si la diferencia FEV1 es menor que 200 ml.
- `pruebas_aceptables`: cantidad de maniobras válidas disponibles, en el caso de prueba `3`.

Para el PDF de prueba, el resultado esperado es exactamente `FVC 30.00 ml`, `FEV1 40.00 ml`, `Sí`, `Sí` y `3`.

Los criterios cualitativos (`Pico máximo`, `Forma triangular`, `Libre de artefactos`, `Meseta`, `Tiempo`, `Criterios para Dx`, `Calidad`) sólo pueden mostrarse como valores SI/A cuando el payload fuente los proporciona; no deben inferirse silenciosamente desde la tabla numérica. Si Frank requiere que se reproduzcan los valores de la segunda imagen aun sin estar en el PDF fuente, se necesita un insumo clínico/configuración explícita adicional.

## 3. Segundo cambio de UI

En `StudyAIPrediagnosisPanel`, las secciones siguientes deben iniciar siempre desplegadas:

- Justificación.
- Limitaciones.
- Fuentes clínicas.

Se conserva la posibilidad semántica de usar `details`, pero el estado inicial debe ser `open`; no se cambia el contenido ni el contrato de IA.

## 4. Ubicación y presentación

Orden en la columna derecha de Events:

1. Archivo vinculado / visor.
2. Criterios clínicos de Espirometría.
3. Prediagnóstico IA.

La sección sólo aparece para Espirometría y cuando existe extracción. Debe conservar el modo sombra clínica: no autoriza diagnóstico final, dictamen ni aptitud.

## 5. Contratos protegidos

- No cambiar schema Prisma, migraciones, endpoints ni persistencia.
- No recalcular ni reinterpretar valores clínicos en frontend.
- No promover `impresion_diagnostica_texto` o `recomendaciones_texto` a salida IA.
- No alterar el flujo de revisión médica ni la información de auditoría.
- No cambiar el layout general de Events ni la posición del visor.
- No afectar Audiometría ni otros tipos de estudio.

## 6. Archivos permitidos

- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx`
- `frontend/src/components/clinical/extraction-presentation-schemas.ts` sólo si es estrictamente necesario para exponer las claves ya presentes.
- Nuevo componente frontend bajo `frontend/src/components/clinical/` si reduce complejidad y no crea contrato nuevo.
- Tests focales asociados.

## 7. Criterios verificables

- **AC-1:** Con `context/RD2026/ESPIROMETRIA.pdf`, Events muestra los criterios de calidad y repetibilidad antes de `Prediagnóstico IA`.
- **AC-2:** Se muestran los valores numéricos `FVC 30 ml` y `FEV1 40 ml` cuando están presentes.
- **AC-3:** Se muestran `3` pruebas aceptables y calidad `A` cuando están presentes.
- **AC-4:** Justificación, Limitaciones y Fuentes clínicas aparecen desplegadas al cargar el panel IA.
- **AC-5:** Payload parcial o snapshot histórico sin los campos nuevos renderiza sin excepción ni valores inventados.
- **AC-6:** Audiometría y otros tipos conservan el comportamiento actual.
- **AC-7:** Typecheck y tests focales frontend pasan.

## 8. Validación

- V1: typecheck y tests focales del renderer/panel.
- V2: suite frontend completa una vez al cierre SOFIA.
- V3: Playwright sobre Event con el PDF indicado; verificar orden visual, texto visible, estado abierto de las tres secciones y ausencia de errores de consola/request.

## 9. Riesgos y rollback

Riesgo bajo: cambio presentacional sobre snapshots existentes. Rollback eliminando el bloque nuevo y restaurando el render previo; sin migración ni cambios de datos.

## 10. Prohibido inferir

No inventar criterios ausentes, no convertir texto fuente del médico en diagnóstico IA, no modificar fórmulas de repetibilidad, no alterar calibración publicada ni ejecutar acciones de despliegue.
