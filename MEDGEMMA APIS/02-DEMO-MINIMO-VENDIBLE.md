# Demo Mínimo Vendible

- ID: ARCH-20260513-03-DEMO
- Estado: Definido

## Objetivo del demo

Demostrar en menos de 3 minutos que el sistema puede leer estudios, producir prediagnóstico por estudio y consolidar varios estudios en una sola vista clínica de apoyo.

## Estructura del demo

### Vista general

Pantalla única con dos columnas principales:

1. izquierda: carga de archivos y listado de estudios cargados
2. derecha: resultados clínicos

## Flujo del demo

### Escena 1. Carga simple

1. el usuario arrastra un Examen Médico
2. el sistema lo clasifica y extrae
3. aparece un bloque de estudio con:
   - tipo de estudio
   - estado de lectura
   - parámetros extraídos relevantes
   - prediagnóstico de apoyo

### Escena 2. Segundo estudio

1. el usuario sube una Audiometría
2. aparece el segundo bloque con su propio prediagnóstico
3. el sistema detecta que ambos estudios pertenecen al mismo caso o demo

### Escena 3. Consolidado final

1. se activa una tarjeta superior o inferior de consolidado clínico
2. el sistema muestra:
   - resumen integral del caso
   - hallazgos compatibles entre estudios
   - contradicciones o faltantes
   - red flags
   - nota de que es apoyo a decisión médica

## Resultado visible esperado

### Por estudio

Cada estudio debe mostrar:

1. nombre del archivo
2. tipo de estudio detectado
3. estado documental
4. parámetros estructurados clave
5. prediagnóstico individual
6. limitaciones

### Consolidado

Debe mostrar:

1. estudios usados en el consolidado
2. hallazgos clínicos integrados
3. áreas no concluyentes
4. prioridad de revisión médica

## Dataset demo recomendado

### Demo 1

1. Examen Médico
2. Audiometría

### Demo 2

1. Examen Médico
2. Espirometría

### Demo 3

1. Examen Médico
2. Audiometría
3. Laboratorio

## Mensaje comercial a decir durante el demo

1. aquí no solo leemos el archivo, lo estructuramos clínicamente
2. aquí no solo damos un resumen por estudio, también consolidamos el caso
3. el médico conserva siempre la decisión final
4. esto reduce tiempo de lectura y mejora estandarización clínica

## Guardrails del demo

1. nunca mostrarlo como diagnóstico automático
2. siempre mostrar la leyenda de apoyo a decisión clínica
3. siempre mostrar qué estudios entraron al consolidado

## Criterios de aceptación del demo

1. el usuario entiende la propuesta en menos de 60 segundos
2. la pantalla se ve simple, moderna y no saturada
3. el consolidado multiestudio es evidente y diferenciador
4. el demo funciona aunque solo se suba un estudio
