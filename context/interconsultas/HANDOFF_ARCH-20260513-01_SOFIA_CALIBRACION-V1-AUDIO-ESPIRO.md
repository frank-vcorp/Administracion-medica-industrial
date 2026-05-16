# HANDOFF DE IMPLEMENTACION

- ID: ARCH-20260513-01
- Fecha: 2026-05-13
- Agente origen: INTEGRA - Arquitecto
- Agente destino: SOFIA - Builder
- Estado: Listo para implementacion
- SPEC fuente: context/SPECs/SPEC_ARCH-20260513-01-CALIBRACION-V1-AUDIOMETRIA-ESPIROMETRIA.md

## Objetivo

Implementar el corte V1 de calibracion documental y prelectura clinica asistida para Audiometria y Espirometria, aprovechando la arquitectura actual de dos momentos y sin cambiar el flujo clinico ya validado.

## Entregable demostrable exigido

El corte de hoy debe perseguir este resultado demostrable:

1. Gemini 2.5 Pro configurado y probado para extraccion
2. MedGemma configurado o, si no alcanza hoy, su integracion dejada preparada de forma honesta y verificable
3. uso de calibracion medica del panel como insumo preferente para la capa clinica
4. demo funcional con Audiometria y Espirometria listas para mostrar a AMI

## Aclaracion critica

Esta tarea SI debe aprovechar el modulo de calibracion existente.

No construir una experiencia paralela fuera de:

1. `frontend/src/app/admin/services/[id]/calibration/page.tsx`
2. `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx`
3. contrato `MedicalTest.options.aiCalibration`

El riesgo a evitar es dejar mejoras solo en extractor/prediagnostico sin que el panel de calibracion actual las pueda gobernar, revisar o versionar.

Segundo riesgo a evitar:

No asumir que Gemini 2.5 Pro o MedGemma ya quedaron activos solo por cambiar texto o documentacion. Debe haber evidencia funcional o dejarse explicitamente como pendiente real.

## Alcance obligatorio V1

### 1. Contratos y extraccion

1. endurecer el contrato de `AudiometriaData` hacia frecuencias canonicas por oido y mejor señal de calidad documental
2. endurecer el contrato de `EspirometriaData` hacia parametros minimos interpretables y mejor señal de completitud
3. ajustar extractor para devolver salidas mas consistentes en ambos estudios
4. mover la configuracion efectiva de extraccion al proveedor objetivo de hoy: Gemini 2.5 Pro

### 1.1. Integracion con el workspace de calibracion

1. reutilizar la ruta administrativa `/admin/services/[id]/calibration` como superficie principal de calibracion
2. reflejar los contratos y configuraciones de Audio/Espiro en `aiCalibration` cuando aplique
3. conservar versionado, historial y curaduria ya existentes
4. evitar duplicar editor o visor fuera del modulo `frontend/src/components/calibration/`

### 2. Prediagnostico en modo sombra

1. reforzar reglas base de prelectura para Audiometria
2. reforzar reglas base de prelectura para Espirometria
3. degradar a no concluyente cuando falten parametros minimos
4. mantener intacta la barrera entre sugerencia IA y dictamen final
5. preparar la capa clinica para MedGemma como proveedor medico objetivo
6. hacer que la capa clinica pueda detectar si existe calibracion medica capturada en el panel y usarla de forma prioritaria
7. si no existe calibracion medica capturada, operar con fallback medico general en modo sombra y dejarlo trazado

### 3. Validacion dirigida

1. agregar pruebas dirigidas por estudio
2. cubrir al menos un caso nominal y uno incompleto para cada estudio
3. dejar checkpoint con limitaciones conocidas y layouts todavia no cubiertos
4. dejar un demo reproducible de Audiometria y Espirometria

## Restricciones

1. no cambiar la UI ni el flujo base de papeleta salvo lo minimo para mostrar mejor el estado no concluyente si ya existe ancla reutilizable
2. no introducir aptitud ni diagnostico final automatico
3. no mezclar OCR, parseo y prediagnostico en una sola funcion opaca
4. no ampliar el corte a otros estudios en esta iteracion
5. no simular MedGemma como configurado si en runtime no lo esta realmente

## Anclas tecnicas probables

1. backend/app/schemas/medical.py
2. backend/app/services/ai/extractor.py
3. backend/app/services/ai/prediagnostic.py
4. backend/tests/test_ai_pipeline.py
5. frontend/src/app/admin/services/[id]/calibration/page.tsx
6. frontend/src/actions/medical-profiles.ts
7. frontend/src/components/calibration/CalibrationWorkspaceClient.tsx
8. frontend/src/lib/calibration-schema.ts
9. frontend/src/types/calibration.ts
10. frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx
11. frontend/src/lib/study-ai.ts

## Criterios de aceptacion minimos

1. Audiometria devuelve salida estructurada consistente para cotejo basico.
2. Espirometria devuelve salida estructurada consistente o estado no concluyente justificado.
3. Ambos estudios siguen el modelo de dos momentos.
4. El panel de calibracion actual sigue siendo util para gobernar estas pruebas.
5. El flujo clinico de evento no cambia.
6. Las pruebas nuevas cubren nominal e incompleto para ambos estudios.
7. Gemini 2.5 Pro queda efectivamente usado en extraccion o se documenta con evidencia por que no se pudo cerrar hoy.
8. MedGemma queda efectivamente usado en la capa clinica o se documenta con evidencia por que no se pudo cerrar hoy.
9. La salida clinica deja claro si uso calibracion medica del panel o fallback general.
10. Queda un demo reproducible para AMI.

## Validacion esperada

1. correr pruebas backend enfocadas en pipeline IA si el entorno lo permite
2. validar que no se rompan tipos o contratos en frontend si se toca la capa de presentacion
3. ejecutar revision puntual de diff y dejar checkpoint de implementacion
4. mostrar evidencia del modelo real usado en snapshots de extraccion y prediagnostico

## Nota para SOFIA

Prioriza utilidad clinica prudente y estabilidad contractual sobre sofisticacion. La meta de este corte no es diagnosticar mejor que el medico, sino entregar una extraccion mas confiable y una sugerencia mejor justificada, anclada al workspace de calibracion que ya existe.

Si MedGemma no alcanza a quedar operativo hoy por integracion o credenciales, no ocultarlo. Dejar preparado el punto de entrada, el fallback y la evidencia clara del estado real para no vender humo en el demo.