# SPEC FIX-20260516-01 — Instrumentación y manejo de error para upload IA interrumpido por red

- ID: FIX-20260516-01
- Fecha: 2026-05-16
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260516-04-PROGRESO-POR-ETAPAS-UPLOAD-IA.md

## Objetivo

Corregir la falta de observabilidad y de manejo robusto cuando la petición de upload/procesamiento IA falla en cliente con errores de red tipo `ERR_NETWORK_CHANGED`, para que la UI:

1. no deje promesas sin capturar
2. no deje la barra/etapas colgadas
3. muestre error útil al usuario
4. registre contexto suficiente para diagnóstico

## Hipótesis verificada

En la papeleta clínica:

1. `handleFileUpload()` hace `await uploadEventTestFile(formData)` sin `try/catch`
2. `handleRegenerateAI()` hace `await regenerateStudyAI(...)` sin `try/catch`
3. si la server action revienta por red durante el POST a `/events/[id]`, el cliente queda con:
   - `Uncaught (in promise) TypeError: Failed to fetch`
   - barra/stepper potencialmente detenidos
   - sin mensaje estructurado útil para el usuario

## Alcance aprobado

Incluye:

1. agregar `try/catch/finally` robusto en upload y regeneración IA
2. asegurar limpieza de timers y estados visuales ante excepción
3. agregar logging estructurado en cliente con contexto suficiente
4. mostrar un mensaje de error más útil al usuario cuando falle la red

No incluye:

1. rediseño del transporte de server actions
2. retry automático complejo
3. instrumentación backend avanzada

## Logging mínimo esperado

El log debe incluir, como mínimo:

1. operación (`upload` o `regenerate`)
2. `eventId`
3. `eventTestId`
4. nombre del archivo si existe
5. etapa visible en la que iba la UI al momento del fallo
6. mensaje/error capturado

## UX esperada

Ante fallo de red:

1. la barra debe desaparecer o resetearse limpiamente
2. el usuario debe ver un mensaje tipo:
   - `La carga o el procesamiento IA se interrumpieron por un cambio de red. Intenta nuevamente.`
3. no debe quedar un `Uncaught (in promise)` sin manejo local

## Criterios de aceptación

1. `handleFileUpload()` ya no deja errores de red sin capturar
2. `handleRegenerateAI()` ya no deja errores de red sin capturar
3. los timers siempre se limpian aunque ocurra excepción
4. el usuario recibe error legible cuando falla la red
5. existe logging suficiente para entender el contexto del fallo

## Criterio de éxito

La iteración será exitosa cuando un fallo de red durante el upload/procesamiento IA deje traza útil para diagnóstico y la UI salga del estado colgado sin perder control de la interacción.