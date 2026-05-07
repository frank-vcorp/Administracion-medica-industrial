## SPEC: Arquitectura IA de Dos Momentos para AMI

**ID:** ARCH-20260506-09  
**Estado:** Alineacion arquitectonica base para iteraciones siguientes  
**Relacionado con:** ARCH-20260225-05-PIPELINE-IA, ARCH-20260326-16, ARCH-20260506-06, ARCH-20260506-07, ARCH-20260506-08

### Objetivo

Formalizar que la arquitectura de IA para AMI debe operar en dos momentos separados pero conectados: primero extraccion documental y despues interpretacion clinica, de forma que el sistema pueda evolucionar hacia una capa de IA medica de Google sin acoplar toda la plataforma a un solo modelo.

## Principio central

La IA del sistema no debe ser una sola caja negra. Debe dividirse en dos capas:

1. **Capa de extraccion documental**
2. **Capa de interpretacion clinica y prediagnostico**

## Momento 1. Extraccion documental

### Objetivo
- Leer imagenes o PDFs crudos.
- Detectar el tipo de estudio.
- Extraer parametros estructurados y trazables.

### Requisitos
- OCR y comprension visual robusta.
- Salida en JSON canónico por tipo de estudio.
- Persistencia inmutable o versionada de la extraccion.
- Independencia respecto a la interpretacion clinica final.

### Ejemplos
- Audiometria: frecuencias por oido, dB, observaciones de layout.
- Espirometria: FEV1, FVC, FEV1/FVC, porcentaje predicho, broncodilatador si existe.

### Regla no negociable
- Esta capa no dicta aptitud ni diagnostico final.
- Solo estructura informacion utilizable por el sistema y por capas posteriores.

## Momento 2. Interpretacion clinica

### Objetivo
- Tomar los parametros ya extraidos.
- Aplicar reglas clinicas, criterios AMI y razonamiento asistido.
- Generar interpretacion, analisis y prediagnostico en modo sombra clinica.

### Requisitos
- Debe apoyarse sobre datos ya estructurados, no sobre OCR crudo.
- Debe poder consumir tabuladores clinicos AMI.
- Debe dejar evidencia, justificacion y limitaciones.
- Nunca reemplaza la validacion final del medico.

### Candidato natural
- IA medica de Google comunicada a AMI como linea estrategica futura.

## Decision de diseño

La plataforma debe abstraer el proveedor/modelo de IA, pero no debe mezclar responsabilidades.

### La capa de extraccion
- puede cambiar de modelo OCR/vision sin romper el contrato de datos

### La capa de interpretacion
- puede cambiar de modelo clinico sin romper el contrato de salida ni el flujo medico

## Contratos que deben permanecer estables

### Entrada de interpretacion clinica
- tipo de estudio
- parametros estructurados
- calidad documental
- reglas AMI aplicables

### Salida de interpretacion clinica
- resumen prudente
- hallazgos relevantes
- clasificacion o patron cuando aplique
- confianza
- limitaciones
- evidencia o justificacion

## Beneficio arquitectonico

Si se mantiene esta separacion:
- hoy se puede usar un modelo fuerte en OCR/document understanding para extraer
- manana se puede usar una IA medica distinta para interpretar
- cambiar de modelo no obliga a rediseñar toda la plataforma

## Alineacion con el repo actual

Esta arquitectura ya tiene una base real en el repositorio:
- capa de extraccion especializada por estudio
- capa de prediagnostico separada

El objetivo de esta SPEC no es inventar una direccion nueva, sino dejarla formalmente explicita para que los siguientes sprints no mezclen OCR, extraccion y prediagnostico como si fueran la misma cosa.

## Aplicacion inmediata

### Audiometria
- calibrar primero extraccion documental
- despues calibrar interpretacion AMI basada en tabulador de la Dra. Erika

### Espirometria
- calibrar primero extraccion documental
- despues calibrar interpretacion AMI basada en tabulador de la Dra. Erika

## Criterios de aceptación

1. Las siguientes SPECs de Audio y Espiro distinguen claramente extraccion vs interpretacion.
2. Ningun prompt futuro mezcla OCR, parseo y dictamen final en una sola capa opaca.
3. La ruta hacia IA medica de Google queda compatible sin reescribir el sistema desde cero.

## Handoff

- Usar esta SPEC como marco de arquitectura para las siguientes iteraciones de calibracion y prediagnostico.
- Mantener contratos canónicos estables aun si cambia el modelo proveedor.