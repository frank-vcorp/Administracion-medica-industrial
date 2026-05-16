# SPEC ARCH-20260513-02 — Piloto MedGemma 27B via Featherless para Prediagnostico Clinico

- ID: ARCH-20260513-02
- Fecha: 2026-05-13
- Agente: INTEGRA - Arquitecto
- Estado: Planificado para implementacion
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260506-09-ARQUITECTURA-IA-DOS-MOMENTOS.md
  - context/SPECs/SPEC_ARCH-20260513-01-CALIBRACION-V1-AUDIOMETRIA-ESPIROMETRIA.md
  - context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md
  - context/interconsultas/HANDOFF_ARCH-20260513-01_SOFIA_CALIBRACION-V1-AUDIO-ESPIRO.md

## Objetivo

Definir un piloto controlado para consumir MedGemma 27B Text por API gestionada en Featherless como proveedor de interpretacion clinica en modo sombra, manteniendo Gemini 2.5 como proveedor de extraccion documental multimodal.

El piloto debe validar si el sistema obtiene mejor calidad de razonamiento medico sin introducir infraestructura propia ni romper el flujo actual de carga, extraccion, persistencia y revision medica.

## Decision de arquitectura

Se ratifica el modelo de dos momentos ya definido en el repositorio:

1. extraccion documental multimodal con Gemini 2.5
2. interpretacion clinica textual con MedGemma 27B Text

Regla explicita del corte:

1. MedGemma no recibira el archivo crudo ni imagenes originales
2. MedGemma recibira exclusivamente texto o payload clinico estructurado derivado de la extraccion
3. Gemini sigue siendo la unica capa autorizada para clasificacion, OCR y lectura visual de PDFs o imagenes

## Proveedor objetivo del piloto

Proveedor API para el piloto:

1. Featherless
2. modelo objetivo: `google/medgemma-27b-text-it`
3. modalidad: API gestionada, sin despliegue propio
4. plan objetivo de entrada: Premium 25 USD/mes

Motivo de seleccion:

1. costo mensual fijo razonable para el sistema en etapa piloto
2. evita operar infraestructura propia
3. permite usar MedGemma 27B Text exactamente en la capa donde el repositorio ya separa el prediagnostico clinico

## Hipotesis del piloto

Hipotesis principal:

MedGemma 27B, usado solo sobre datos clinicos estructurados y contexto medico calibrado, debe producir un prediagnostico mas especializado y util para revision medica que el fallback generalista actual, sin alterar el flujo operativo de AMI.

La hipotesis se considera valida si:

1. el prediagnostico mantiene los guardrails actuales
2. el medico percibe mejora en pertinencia clinica sobre Audiometria y Espirometria
3. la latencia y operacion del proveedor son aceptables para uso asistido no bloqueante

## Alcance del piloto

Incluye:

1. integrar MedGemma 27B Text como proveedor configurable solo para la capa de prediagnostico
2. mantener Gemini 2.5 como proveedor de extraccion
3. probar el piloto en Audiometria y Espirometria, que ya son el corte activo del backlog
4. registrar en auditoria el proveedor clinico realmente usado
5. dejar fallback explicito a proveedor generalista cuando MedGemma no este habilitado o falle
6. conservar revision medica obligatoria y modo sombra

No incluye:

1. reemplazar Gemini en extraccion
2. enviar imagenes o PDFs crudos a MedGemma 27B Text
3. usar MedGemma 4B multimodal en esta iteracion
4. despliegue self-hosted, vLLM o infraestructura propia
5. ampliar el piloto a todos los estudios del catalogo

## Modulos y estudios cubiertos

Estudios iniciales del piloto:

1. Audiometria
2. Espirometria

Razon del recorte:

1. ya existe una SPEC activa para calibracion V1 de ambos estudios
2. son el mejor punto para medir mejora de interpretacion clinica sin abrir demasiadas variantes documentales
3. reducen el riesgo del piloto y permiten comparacion mas clara entre proveedores

## Contrato entre capas

### Capa 1 — Extraccion con Gemini 2.5

Responsabilidades:

1. recibir archivo crudo
2. clasificar tipo documental
3. extraer parametros estructurados
4. marcar calidad o completitud documental
5. persistir `ExtractionSnapshot`

Salida minima esperada para pasar a MedGemma:

1. `study_type`
2. `structured_data`
3. `clinical_state` o bandera de completitud documental
4. metadatos de auditoria

### Capa 2 — Prediagnostico con MedGemma 27B Text

Responsabilidades:

1. recibir solo datos estructurados y contexto textual del estudio
2. aplicar prompts clinicos y calibracion medica si existe
3. producir resumen, hallazgos sugeridos, banderas, confianza y razon de no concluyente
4. persistir `AIPrediagnosisSnapshot`

Restricciones obligatorias:

1. no emitir aptitud laboral
2. no emitir dictamen medico final
3. no firmar documentos
4. no inventar parametros ausentes
5. degradar a `AI_NON_CONCLUSIVE` cuando falten minimos clinicos

## Politica de fallback

Debe existir fallback clinico controlado para continuidad operativa.

Orden esperado:

1. si `MEDGEMMA_ENABLED=true` y la API Featherless responde correctamente, usar MedGemma
2. si MedGemma no esta habilitado o falla, usar proveedor generalista actual como fallback temporal
3. en todos los casos registrar en auditoria `clinical_model_used` y `clinical_provider`

## Politica de calibracion

Se mantiene la regla ya definida en el repo:

1. si existe `medical_calibration`, esa calibracion se inyecta como marco preferente
2. si no existe calibracion, MedGemma opera con conocimiento general y modo sombra
3. el snapshot debe registrar si la interpretacion fue `medical_calibration` o `general_fallback`

## Criterios de aceptacion

1. Gemini 2.5 sigue siendo el proveedor efectivo de extraccion documental en el piloto
2. MedGemma 27B via Featherless queda integrado solo en la capa de prediagnostico
3. Audiometria y Espirometria pueden ejecutar el flujo completo con proveedor clinico configurable
4. el sistema registra claramente cuando el prediagnostico fue generado por MedGemma y cuando por fallback
5. no se rompe el flujo actual de papeleta ni la revision medica obligatoria
6. si la API Featherless falla, el sistema no queda bloqueado y responde con fallback o estado no concluyente controlado
7. existe una prueba piloto demostrable sobre documentos reales o muestra representativa de Audiometria y Espirometria
8. queda documentada la decision de plan proveedor: Featherless Premium 25 USD/mes

## Validacion del piloto

La validacion debe cubrir tres ejes:

### 1. Validacion tecnica

1. conexion estable a Featherless
2. consumo del modelo `google/medgemma-27b-text-it`
3. manejo de timeout, error y fallback

### 2. Validacion clinica operativa

1. comparar utilidad del prediagnostico frente al proveedor generalista actual
2. medir calidad percibida por el medico en Audiometria y Espirometria
3. confirmar que el lenguaje sigue siendo prudente y revisable

### 3. Validacion economica

1. confirmar que el plan Premium cubre el piloto sin costo variable relevante
2. confirmar que el volumen esperado del sistema hace razonable el fee mensual fijo

## Entregables esperados para SOFIA

1. proveedor MedGemma configurable en backend para prediagnostico
2. integracion API con Featherless sin montar infraestructura
3. auditoria clara de proveedor usado
4. fallback operativo documentado
5. prueba piloto sobre Audiometria y Espirometria
6. checkpoint de cierre con hallazgos de calidad y decision de continuidad

## Riesgos conocidos

1. MedGemma 27B Text no resuelve vision, por lo que cualquier confusion entre capas degradaria el piloto
2. Featherless maneja limites por plan y concurrencia; si la carga supera el piloto, se debe reevaluar
3. el contexto operativo del modelo en Featherless puede ser menor al maximo teorico del model card original
4. la mejora clinica debe demostrarse con muestras AMI, no asumirse por benchmark publico

## Definicion de listo para implementacion

La SPEC se considera lista para handoff cuando SOFIA pueda implementar el piloto tocando como maximo la superficie de proveedor clinico, configuracion y validacion puntual del flujo de prediagnostico, sin redisenar el pipeline general.

## URL de contratacion del proveedor

URLs operativas verificadas:

1. pagina principal y pricing: https://featherless.ai/#pricing
2. alta o seleccion de plan: https://featherless.ai/account
3. modelo objetivo del piloto: https://featherless.ai/models/google/medgemma-27b-text-it
