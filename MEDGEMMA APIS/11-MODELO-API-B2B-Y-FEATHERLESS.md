# Modelo API B2B y Featherless

- ID: ARCH-20260513-07
- Objetivo: definir como vender, operar y entregar una modalidad solo endpoint o API, y como resolver la capa MedGemma usando Featherless

## Cuando conviene ofrecer solo endpoint o API

Esta modalidad aplica cuando el cliente:

1. ya tiene frontend o sistema propio
2. no necesita nuestro micrositio ni portal completo
3. quiere integrar lectura o prediagnostico dentro de su software
4. es integrador, laboratorio, software house o grupo clinico con equipo tecnico

No conviene ofrecer API pura cuando el cliente:

1. no tiene equipo tecnico
2. necesita mucha guia operativa
3. aun no entiende bien el valor del producto
4. solo quiere validar una demo comercial

## Que se vende en modalidad API

No se vende “acceso a MedGemma”.

Se vende una API clinica verticalizada que resuelve una o mas de estas capacidades:

1. clasificacion documental
2. extraccion estructurada
3. prediagnostico por estudio
4. consolidado multiestudio

## Como debe empaquetarse comercialmente

### Opcion 1. API de lectura por estudio

El cliente envia un archivo o payload y recibe:

1. tipo de estudio
2. datos estructurados
3. prediagnostico
4. metadatos de auditoria

### Opcion 2. API por etapas

El cliente consume endpoints separados:

1. `/classify`
2. `/extract`
3. `/prediagnose`
4. `/consolidate`

### Opcion 3. API compuesta de alto nivel

El cliente envia uno o varios archivos y recibe todo el flujo resuelto:

1. extraccion por estudio
2. prediagnostico por estudio
3. consolidado final cuando aplique

## Recomendacion comercial inicial

La mejor opcion para vender rapido es una API compuesta de alto nivel.

Motivo:

1. el cliente integra menos piezas
2. el valor se entiende mejor
3. controlamos mejor guardrails, trazabilidad y fallback
4. evitamos que el cliente hable directo con cada proveedor

## Arquitectura recomendada con Featherless

### Principio central

Featherless no debe ser visible para el cliente final como dependencia contractual primaria.

Tu arquitectura debe verse asi:

1. cliente -> tu API B2B
2. tu API B2B -> Gemini para extraccion
3. tu API B2B -> Featherless para MedGemma en capa clinica
4. tu API B2B -> respuesta unificada al cliente

Eso significa:

1. el cliente no recibe una API key de Featherless
2. el cliente no habla directo con MedGemma
3. tu controlas prompts, fallback, auditoria y formato de salida
4. tu puedes cambiar proveedor despues sin romper el contrato comercial

## Flujo recomendado con Featherless

### Paso 1. Entrada

El cliente envia:

1. archivo PDF o imagen
2. o payload clinico estructurado
3. o varios estudios del mismo caso

### Paso 2. Extraccion

Tu backend usa Gemini para:

1. clasificar estudio
2. extraer parametros
3. marcar calidad documental

### Paso 3. Prediagnostico

Tu backend manda a Featherless solo:

1. `study_type`
2. `structured_data`
3. `missing_fields`
4. contexto medico o calibracion si existe

Nunca debe mandar:

1. archivo crudo si no es necesario
2. imagen original al modelo clinico
3. datos sobrantes fuera del objetivo clinico

### Paso 4. Respuesta

Tu API devuelve al cliente:

1. extraccion estructurada
2. prediagnostico
3. confianza y limitaciones
4. proveedor usado en auditoria interna si conviene
5. estado no concluyente si falta base clinica

## Endpoints sugeridos

### 1. Endpoint compuesto principal

`POST /api/v1/clinical/analyze`

Entrada sugerida:

1. `files[]` o `documents[]`
2. `case_id` opcional
3. `worker_id` opcional
4. `study_type` opcional si el cliente ya lo conoce

Salida esperada:

1. `classification`
2. `extraction_snapshot`
3. `prediagnosis_snapshot`
4. `consolidated_snapshot` cuando aplique
5. `audit`

### 2. Endpoint solo prediagnostico

`POST /api/v1/clinical/prediagnose`

Uso:

1. para clientes que ya extraen datos por su cuenta
2. les cobras por capa clinica, no por OCR

Entrada:

1. `study_type`
2. `structured_data`
3. `medical_calibration` opcional

Salida:

1. `summary`
2. `confidence`
3. `justification`
4. `limitations`
5. `red_flags`

### 3. Endpoint de consolidado

`POST /api/v1/clinical/consolidate`

Entrada:

1. lista de estudios ya interpretados o estructurados
2. `case_id`

Salida:

1. `final_support_summary`
2. `cross_study_findings`
3. `excluded_studies`
4. `clinical_attention_points`

## Modelo de cobro para API

La API no conviene venderla por costo del modelo. Conviene venderla asi:

### Opcion recomendada

1. setup de integracion
2. mensualidad base
3. bolsa incluida de uso o volumen razonable
4. sobreconsumo o escalon superior segun volumen

### Ejemplo de estructura comercial

1. setup API: integracion, sandbox, documentacion y soporte inicial
2. mensualidad API Starter
3. mensualidad API Pro
4. tarifa enterprise para white-label o volumen alto

### Alternativa si el cliente insiste en uso

1. cobro por estudio procesado
2. cobro por consolidado por caso
3. minimo mensual garantizado

## Que contrato requiere una API

Si es API B2B, el contrato debe subir un poco el nivel frente al piloto demo.

Minimo recomendado:

1. contrato de servicio
2. anexo tecnico de endpoints y limites
3. anexo de SLA si el cliente lo pide
4. anexo de tratamiento de datos si habra informacion sensible

## Que entregables debemos darle al cliente API

1. base URL
2. API key propia emitida por nosotros
3. documentacion de endpoints
4. payloads de ejemplo
5. limites de uso
6. ambientes: sandbox y produccion si aplica

## Como lo hariamos especificamente con Featherless

### Variante mas pragmatica

1. nosotros contratamos Featherless
2. guardamos `FEATHERLESS_API_KEY` en nuestra infraestructura
3. llamamos a `google/medgemma-27b-text-it` solo desde backend
4. respondemos al cliente con nuestro formato estable

Ventajas:

1. control total del producto
2. el cliente no ve complejidad de proveedor
3. se puede cambiar Featherless por otro proveedor despues
4. protegemos prompts y logica de negocio

### Variante menos recomendable

1. el cliente contrata Featherless por su cuenta
2. nosotros configuramos para usar su key

Solo conviene cuando:

1. el cliente enterprise exige control de proveedor
2. el cliente quiere pagar su propia infraestructura IA

Riesgos:

1. soporte mas complejo
2. mas friccion comercial
3. menor control sobre calidad y continuidad

## Recomendacion operativa hoy

1. vender API compuesta de alto nivel
2. esconder Featherless detras de nuestra capa
3. reservar API pura por etapas para cuentas tecnicas mas maduras
4. usar Featherless como proveedor interno de MedGemma, no como cara publica del producto

## Script comercial para prospecto tecnico

Si ya tienes sistema propio, no necesitas nuestro portal. Podemos entregarte una API para enviar estudios o datos estructurados y recibir extraccion, prediagnostico y consolidado clinico de apoyo. Nosotros operamos la capa IA y el proveedor medico por detras, para que tu integres un endpoint estable y no dependas directamente del modelo.