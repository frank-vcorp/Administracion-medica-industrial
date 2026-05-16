# SPEC ARCH-20260513-01 — Calibracion V1 de Audiometria y Espirometria

- ID: ARCH-20260513-01
- Fecha: 2026-05-13
- Agente: INTEGRA - Arquitecto
- Estado: Planificado para implementacion
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260506-09-ARQUITECTURA-IA-DOS-MOMENTOS.md
  - context/SPECs/ARCH-20260225-05-PIPELINE-IA.md
  - context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md
  - context/Juntas/ANALISIS_INSUMOS_AMI_2026-05-06_POSIBLES-AVANCES.md
  - context/checkpoints/CHK_ARCH-20260507-12-CIERRE-SESION.md

## Objetivo

Dejar definido el siguiente corte funcional para Audiometria y Espirometria como una V1 de calibracion documental y prelectura clinica asistida, aprovechando la base ya existente de extraccion y prediagnostico sin romper el flujo actual de papeleta ni mezclar OCR con dictamen medico.

## Corte demostrable solicitado para hoy

El objetivo operativo de esta iteracion debe quedar expresado en cuatro entregables visibles:

1. extraccion configurada y probada con Gemini 2.5 Pro para Audiometria y Espirometria
2. capa de interpretacion clinica preparada para usar MedGemma como proveedor objetivo de analisis medico
3. regla funcional explicita: si existe calibracion medica capturada en el panel, el analisis la prioriza; si no existe, el modelo medico opera en modo sombra con conocimiento general
4. demo de punta a punta con Extraccion + Prediagnostico para Audiometria y Espirometria, visible para AMI

## Realidad tecnica verificada hoy

Al momento de esta SPEC, el runtime verificado del repositorio sigue mostrando por defecto `gemini-2.5-flash` en varias rutas de persistencia y backend.

Eso implica:

1. Gemini 2.5 Pro no debe asumirse como ya operativo solo por documentacion; debe quedar explicitamente configurado y probado
2. MedGemma aparece como direccion estrategica documentada, pero no como proveedor ya integrado en runtime verificado
3. por lo tanto, el punto de MedGemma requiere implementacion/configuracion real y no solo ajuste semantico de SPEC

## Contexto

El repositorio ya cuenta con piezas reales para ambos estudios:

1. contratos base en backend para `AudiometriaData` y `EspirometriaData`
2. extractor especializado por tipo documental
3. capa separada de prediagnostico IA en modo sombra clinica
4. deteccion canonica de estudios en el frontend
5. modulo administrativo de calibracion IA ya operativo en `/admin/services/[id]/calibration`
6. workspace de calibracion con versionado, visor documental y curaduria de campos

Lo que falta no es inventar un flujo nuevo, sino cerrar la primera calibracion util para operacion:

1. endurecer contratos de extraccion
2. completar reglas base de prelectura asistida
3. elevar la trazabilidad de calidad documental
4. dejar validacion minima reproducible por estudio

## Modulo existente a reutilizar

Esta iteracion debe considerar como superficie primaria el modulo de calibracion ya existente, no una UI nueva paralela.

Anclas actuales verificadas:

1. `frontend/src/app/admin/services/[id]/calibration/page.tsx`
2. `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx`
3. `frontend/src/components/calibration/CalibrationDocumentViewer.tsx`
4. `frontend/src/components/calibration/CandidateSchemaPanel.tsx`
5. `frontend/src/components/calibration/CalibrationVersionHistory.tsx`
6. `frontend/src/components/calibration/CalibrationAIAssistantRail.tsx`
7. `frontend/src/lib/calibration-schema.ts`
8. `frontend/src/types/calibration.ts`

La tarea de Audiometria y Espirometria debe entrar por ese workspace y aprovechar su contrato `aiCalibration` en `MedicalTest.options`, en lugar de resolver la calibracion solo desde extractor/prediagnostico sin reflejo en consola de calibracion.

## Restriccion principal

Esta iteracion no debe cambiar el flujo clinico validado en piso.

Por lo tanto:

1. no se rediseña la papeleta
2. no se agrega una estacion nueva de trabajo
3. no se vuelve obligatorio capturar mas datos manuales en cabina
4. no se permite que la IA emita aptitud ni diagnostico final

## Principio arquitectonico

Se mantiene el modelo de dos momentos:

1. extraccion documental canonica
2. interpretacion clinica asistida en modo sombra

Ninguna historia de Audiometria o Espirometria debe mezclar ambas capas en una sola salida opaca.

## Propuesta funcional V1

### 1. Audiometria V1

La V1 debe dejar una salida documental mas consistente para Audiometria, con:

1. frecuencias canonicas por oido: 250, 500, 1000, 2000, 3000, 4000, 6000 y 8000 Hz
2. indicacion clara de calidad documental cuando falten datos o el layout sea ambiguo
3. base de prelectura asistida para:
   - audicion normal
   - hipoacusia conductiva
   - hipoacusia neurosensorial
   - hipoacusia mixta
4. clasificacion preliminar de severidad como apoyo, no como dictamen final
5. capacidad de dejar evidencia de parametros usados en la sugerencia

### 2. Espirometria V1

La V1 debe dejar una salida documental y tecnica consistente para Espirometria, con:

1. campos minimos esperados: `fev1`, `fvc`, `fev1_fvc_ratio`, `fev1_percent_predicho`
2. soporte opcional para broncodilatador cuando el documento lo incluya
3. validacion minima de completitud para declarar si la prueba es interpretable o no concluyente
4. base de prelectura asistida para:
   - patron normal
   - patron obstructivo
   - patron sugestivo de restriccion
5. graduacion preliminar de severidad usando FEV1 cuando aplique

### 3. Calidad documental y trazabilidad

Para ambos estudios, la extraccion debe exponer una señal mas util de calidad, de forma que el sistema pueda distinguir entre:

1. documento util y suficientemente legible
2. documento parcial pero aprovechable
3. documento no concluyente por falta de parametros clave

### 4. Modo sombra clinica obligatorio

Toda interpretacion debe seguir entrando al flujo como sugerencia IA revisable por medico, reutilizando la capa ya existente de prediagnostico y revision medica.

## Alcance V1

Incluye:

1. ajuste de contratos canónicos de extraccion para Audiometria y Espirometria
2. endurecimiento del extractor para ambos estudios
3. reglas base de prelectura clinica asistida alineadas a insumos AMI
4. mejoras de no concluyente y limitaciones cuando falten parametros minimos
5. aterrizaje de ambos estudios dentro del modulo de calibracion existente
6. validaciones y pruebas dirigidas por estudio
7. explicitar y configurar la separacion de proveedor para extraccion vs interpretacion clinica
8. definir comportamiento de fallback cuando no exista calibracion medica capturada

No incluye todavia:

1. lectura automatica robusta de todos los layouts posibles del mercado
2. interpretacion clinica final o aptitud
3. dashboard de calidad por sucursal
4. integracion con modulo de equipos o mantenimiento
5. reentrenamiento o fine-tuning de modelos

## Diseno tecnico minimo

### Superficie funcional obligatoria

La calibracion de esta iteracion no se considera completa si solo vive en backend.

Debe quedar utilizable o al menos claramente anclada en el modulo administrativo existente para que un calibrador pueda:

1. entrar a la prueba del catalogo
2. ver snapshots reales asociados
3. revisar candidatos o contrato vigente
4. guardar o ajustar `aiCalibration` para Audiometria y Espirometria
5. conservar versionado e historial dentro del workspace ya construido

### Politica de proveedores objetivo

Para este corte se debe dejar expresamente separado:

1. proveedor de extraccion documental
2. proveedor de interpretacion clinica

Objetivo de negocio del corte:

1. Extraccion: Gemini 2.5 Pro
2. Interpretacion clinica: MedGemma

Si por restricciones reales del entorno MedGemma no puede quedar operativo hoy, el entregable minimo aceptable debe dejar:

1. integracion preparada o abstraida para cambiar el proveedor medico sin reescribir el pipeline
2. fallback temporal claramente identificado en modo sombra clinica
3. evidencia explicita de que MedGemma queda pendiente de habilitacion, no fingido como ya configurado

### Politica de calibracion medica

La capa de interpretacion debe obedecer esta regla:

1. si existe calibracion medica capturada para la prueba en el panel de calibracion, se prioriza como marco de interpretacion
2. si no existe calibracion medica capturada, el analisis puede usar conocimiento medico general del proveedor configurado, siempre en modo sombra
3. en ambos casos debe quedar trazable en audit o metadata cual camino se uso

### Contratos de extraccion

Audiometria debe tender a un contrato con:

1. `paciente`
2. `fecha_estudio`
3. `oido_derecho` como mapa frecuencia -> valor
4. `oido_izquierdo` como mapa frecuencia -> valor
5. `notas_calidad`
6. opcionalmente un bloque ligero de completitud o frecuencias detectadas si hace falta para trazabilidad

Espirometria debe tender a un contrato con:

1. `paciente`
2. `fecha_estudio`
3. `fev1`
4. `fvc`
5. `fev1_fvc_ratio`
6. `fev1_percent_predicho`
7. `notas_calidad`
8. opcionalmente banderas de completitud o broncodilatador

### Reglas de interpretacion V1

La capa de prediagnostico debe:

1. citar explicitamente parametros usados
2. declarar limitaciones cuando falte informacion suficiente
3. degradar a `AI_NON_CONCLUSIVE` cuando no se cumpla el minimo interpretable
4. mantenerse desacoplada del PDF oficial y del dictamen final

## Archivos probables

- backend/app/schemas/medical.py
- backend/app/services/ai/extractor.py
- backend/app/services/ai/prediagnostic.py
- backend/tests/test_ai_pipeline.py
- frontend/src/app/admin/services/[id]/calibration/page.tsx
- frontend/src/actions/medical-profiles.ts
- frontend/src/components/calibration/CalibrationWorkspaceClient.tsx
- frontend/src/lib/calibration-schema.ts
- frontend/src/types/calibration.ts
- frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx
- frontend/src/lib/study-ai.ts
- context/checkpoints/CHK_IMPL-20260513-01.md

## Criterios de aceptacion

1. Audiometria entrega una salida estructurada con frecuencias por oido suficientemente estable para cotejo clinico basico.
2. Espirometria entrega una salida estructurada con los parametros minimos definidos o reporta de forma explicita por que no es concluyente.
3. El prediagnostico IA de ambos estudios reutiliza el modo sombra clinica ya existente y no invade el dictamen oficial.
4. Cuando falten datos minimos, la salida se marca como no concluyente con limitaciones visibles.
5. El modulo `/admin/services/[id]/calibration` sigue siendo la consola primaria de calibracion para estas pruebas y no se duplica una UI paralela.
6. El flujo actual de papeleta, estudios y Examen Medico no cambia.
7. Existen pruebas dirigidas para al menos un caso nominal y un caso incompleto por cada estudio.
8. La extraccion queda configurada y probada con el proveedor objetivo definido para hoy, sin depender de defaults anteriores.
9. La capa clinica deja documentado y visible si uso calibracion medica capturada o fallback medico general.
10. Queda un demo reproducible de Audiometria y Espirometria para mostrar a AMI.

## Demo esperado para AMI

La demostracion de cierre debe poder mostrar, como minimo:

1. entrada al panel de calibracion de Audiometria desde el catalogo
2. evidencia de configuracion de extraccion y diagnostico por prueba
3. corrida de analisis sobre un caso de Audiometria con snapshot visible
4. corrida de analisis sobre un caso de Espirometria con snapshot visible
5. visualizacion del modelo usado en extraccion y del modelo usado en interpretacion
6. evidencia de si el prediagnostico uso calibracion medica cargada o fallback general

## Riesgos controlados

1. Si se intenta abarcar demasiados layouts en V1, se diluye el valor operativo del corte.
2. Si se mezcla extraccion con interpretacion, se rompe la linea de dos momentos ya formalizada.
3. Si no se explicita la calidad documental, el medico recibe una sugerencia sin contexto suficiente.

## Criterio de exito

La iteracion sera exitosa si AMI puede cargar una Audiometria o una Espirometria y obtener una salida estructurada mas util, junto con una prelectura prudente y trazable, sin tocar el flujo operativo ya aprobado.

## Priorizacion sugerida

- Valor: 5
- Urgencia: 4
- Complejidad: 3
- Puntaje: 21.5

## Referencias

- context/Juntas/ANALISIS_INSUMOS_AMI_2026-05-06_POSIBLES-AVANCES.md
- context/SPECs/SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md
- context/SPECs/SPEC_ARCH-20260327-19-CALIBRACION-IA-ASISTIDA-VERSIONADO-AUTOMATICO.md
- context/SPECs/SPEC_ARCH-20260506-09-ARQUITECTURA-IA-DOS-MOMENTOS.md
- context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md
- context/checkpoints/CHK_ARCH-20260507-12-CIERRE-SESION.md