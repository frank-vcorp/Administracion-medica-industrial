# Analisis interno de insumos AMI y avances posibles con la informacion recibida

**ID:** ARCH-20260506-03  
**Fecha:** 2026-05-06  
**Uso:** Documento interno de trabajo para Frank Saavedra y Copilot.  
**Base de insumos revisados:** carpeta [context/datos AMI](../datos%20AMI)

## Objetivo

Determinar que si podemos avanzar de inmediato con la informacion ya enviada por AMI y que sigue faltando para empujar con mas precision la calibracion documental, la interpretacion clinica y la homologacion funcional del sistema.

## Contexto estrategico a conservar

Estos avances no deben leerse como calibracion IA generica. Deben quedar alineados a la linea estrategica ya comunicada a AMI en el correo posterior a la junta: avanzar hacia una capa de apoyo clinico basada en la IA medica de Google, presentada en ese momento como MedGemma.

Ademas, la arquitectura objetivo debe conservar una separacion explicita de **dos momentos de IA**:

### Momento 1. Extraccion documental
- usar un motor con muy buena capacidad de OCR y comprension visual para leer PDF crudo o imagen
- extraer parametros estructurados utilizables por el sistema
- dejar esos datos en campos canónicos, auditables y reutilizables

### Momento 2. Interpretacion clinica
- usar una IA medica especializada para analizar los parametros ya extraidos
- generar interpretacion, analisis y prediagnostico en modo sombra clinica
- no reemplazar nunca la validacion final del medico

Por lo tanto:
- Audiometria y Espirometria no se calibran solo para extraer texto o valores.
- Se calibran para construir una primera capa de apoyo clinico documentado que despues pueda coexistir o integrarse con la linea de IA medica de Google ya comunicada al cliente.
- Agenda y Equipos tampoco son frentes aislados: ayudan a aterrizar capacidad operativa, trazabilidad y gobernanza del sistema que esa capa clinica necesitara para ser util en AMI.

## Insumos revisados

### Carpeta principal
- [context/datos AMI/DIAGNOSTICO BASICO AUDIOS.pptx](../datos%20AMI/DIAGNOSTICO%20BASICO%20AUDIOS.pptx)
- [context/datos AMI/DETERMINAR EL PATRÓN ESPIROMÉTRICO.pptx](../datos%20AMI/DETERMINAR%20EL%20PATR%C3%93N%20ESPIROM%C3%89TRICO.pptx)

### Subcarpeta Formatos Sim
- [context/datos AMI/Formatos Sim/Envios dra. Jacky.txt](../datos%20AMI/Formatos%20Sim/Envios%20dra.%20Jacky.txt)
- [context/datos AMI/Formatos Sim/FORMATOS Y CALENDARIO.docx](../datos%20AMI/Formatos%20Sim/FORMATOS%20Y%20CALENDARIO.docx)
- [context/datos AMI/Formatos Sim/AMI AGENDA MARZO 2026.xlsx](../datos%20AMI/Formatos%20Sim/AMI%20AGENDA%20MARZO%202026.xlsx)
- [context/datos AMI/Formatos Sim/formatossim2_0.zip](../datos%20AMI/Formatos%20Sim/formatossim2_0.zip)

## Lo que si aportan estos insumos

### 1. Agenda mensual operativa por clinica

La agenda de marzo aporta una base real para analizar:
- volumen de pacientes por clinica
- patrones de carga por horario
- perfiles y combinaciones de estudios mas frecuentes
- campos de operacion reales usados por AMI
- diferencias entre Prado, Marques y PIQ

### 2. Programa de calibracion y mantenimiento de equipos

El archivo de mantenimiento incluido en el zip permite avanzar en:
- catalogo base de equipos
- ubicacion por sede o unidad
- frecuencia de calibracion o mantenimiento
- estados operativos
- estructura futura para modulo de equipos y control de vencimientos

### 3. Formatos visuales de audiometria y espirometria

El Word con imagenes incrustadas si aporta:
- apariencia del formato real que ve AMI
- disposicion visual de tablas y valores
- forma aproximada en que se presenta la informacion al medico

Esto sirve para:
- diseno de parser documental orientado a layout
- definicion de campos candidatos
- preparacion de UI de calibracion y captura asistida

### 4. Tabuladores clinicos usados para dictamen

Los dos PowerPoints son especialmente relevantes porque la Dra. Erika mando ahi los criterios de interpretacion que usa para dictaminar.

#### Audiometria

El PowerPoint de audiometria aporta reglas clinicas para:
- distinguir audicion normal vs hipoacusia
- diferenciar hipoacusia conductiva
- diferenciar hipoacusia neurosensorial
- diferenciar hipoacusia mixta
- considerar frecuencias graves, medias y agudas
- ubicar criterios de gravedad
- reconocer el patron tipico de trauma acustico cronico por ruido

#### Espirometria

El PowerPoint de espirometria aporta reglas clinicas para:
- determinar si la espirometria es aceptable y repetible
- usar FEV1/FVC respecto al LIN
- distinguir patron normal
- distinguir patron obstructivo
- distinguir patron sugestivo de restriccion
- graduar gravedad con FEV1
- reconocer respuesta a broncodilatador

## Con esto que si podemos avanzar ya

## A. Audiometria

### Avances inmediatos posibles
- Definir el contrato de campos esperados para extraccion documental de audiometria.
- Estructurar catalogo de parametros por frecuencia: 250, 500, 1000, 2000, 3000, 4000, 6000 y 8000 Hz.
- Separar por oido derecho e izquierdo.
- Preparar reglas base para clasificar salida preliminar como normal, conductiva, neurosensorial o mixta.
- Incorporar umbrales de severidad como capa de apoyo al medico.
- Diseñar version inicial de tabla de captura/cotejo en calibracion IA.

### Resultado util concreto
- Ya podemos construir una primera version de esquema de extraccion para audiometria y una capa de interpretacion clinica asistida basada en los tabuladores de AMI.

## B. Espirometria

### Avances inmediatos posibles
- Definir los campos minimos esperados: FEV1, FVC, FEV1/FVC, porcentaje predicho y broncodilatador cuando exista.
- Mapear reglas para patron normal, obstructivo o sugestivo de restriccion.
- Preparar gradacion de severidad usando FEV1.
- Diseñar una matriz de validacion para revisar si el documento extraido contiene los parametros minimos necesarios para interpretar.
- Construir primer contrato de extraccion y primera capa de razonamiento clinico asistido alineada al criterio de la Dra. Erika.

### Resultado util concreto
- Ya podemos aterrizar una primera base de calibracion y prelectura tecnica para espirometria, aunque todavia haga falta validar contra mas estudios reales.

## C. Agenda y flujo operativo por clinica

### Avances inmediatos posibles
- Analizar patrones de demanda por sucursal.
- Identificar horas pico y combinaciones frecuentes de perfiles.
- Estimar grupos de estudios mas comunes para nuevo ingreso, perfil general, publico general y otros escenarios.
- Empezar a modelar reglas base para agenda masiva y capacidad operativa.

### Resultado util concreto
- La agenda ya permite pasar de discurso general a analisis real de flujo por clinica.

## D. Equipos y mantenimiento

### Avances inmediatos posibles
- Proponer estructura de modulo de equipos.
- Definir entidades minimas: equipo, tipo, marca, modelo, serie, ubicacion, frecuencia, estado, fecha compromiso.
- Preparar backlog de mantenimiento, calibracion y vencimientos.
- Vincular este frente con sucursales y eventualmente unidades moviles.

### Resultado util concreto
- Ya se puede abrir un frente serio de discovery estructurado para modulo de equipos y mantenimiento.

## E. Plataforma de calibracion IA

### Avances inmediatos posibles
- Cargar los formatos visuales como referencia documental.
- Definir candidatos de campo para audio y espiro.
- Capturar reglas medicas AMI como capa de interpretacion inicial.
- Preparar version 1 de calibracion por prueba para ambas tipologias.
- Mantener compatibilidad conceptual con la linea de IA medica de Google comunicada a AMI.

### Resultado util concreto
- La informacion recibida ya permite avanzar en calibracion funcional guiada, aunque todavia no cierra la calibracion documental completa.

## Lo que aun no resuelven estos insumos

### 1. No son suficientes para calibracion documental robusta al 100%

Aunque los formatos visuales ayudan, no reemplazan:
- PDF original exportado por el equipo
- salida nativa del software del equipo
- varios estudios reales de pacientes para comparar variabilidad

### 2. No sustituyen casos clinicos reales suficientes

Los PowerPoints son criterios de interpretacion. Son muy utiles, pero no equivalen a un lote de estudios reales para probar extraccion, errores, ruido documental y consistencia.

### 3. No cubren todavia laboratorio ni trazabilidad de resultados

Sigue faltando:
- estudios de laboratorio reales para calibracion
- archivo real de seguimiento de envio de resultados
- propuesta formal de nomenclatura clinica
- listado homologado de perfiles y pruebas

## Dictamen interno

La entrega de AMI no cierra todos los pendientes de la junta ni todos los insumos solicitados en el correo posterior, pero si destraba trabajo real en cuatro frentes:

1. calibracion inicial de audiometria
2. calibracion inicial de espirometria
3. analisis operativo de agenda por clinica
4. modelado inicial de equipos, mantenimiento y calendario operativo

## Recomendacion de trabajo inmediato

## Formalizacion para ataque secuencial

Con base en lo revisado, conviene dejar formalizados desde hoy cuatro frentes para poder trabajarlos sin perder trazabilidad ni olvidar lo que sigue faltando de AMI.

### Frente 0. Correccion previa de Somatometria

Aunque el repositorio ya habia evolucionado a Somatometria y Agudeza Visual como estudios independientes, para el flujo operativo actual conviene reabrir la decision y corregir Somatometria para que viva como pestanas internas dentro de Examen Medico, de acuerdo con la forma en que AMI ejecuta y dictamina realmente.

**Razon de prioridad**
- Impacta directamente el flujo clinico visible.
- Condiciona la experiencia del medico antes de entrar a calibracion fina de estudios documentales.
- Si no se corrige primero, se puede seguir calibrando sobre una semantica operativa que AMI no reconoce como propia.

**Artefacto a usar**
- Nueva SPEC hija para correccion de arquitectura clinica de Examen Medico y Somatometria.

### Frente 1. Audiometria calibrada y probada

Objetivo de ataque inmediato:
- dejar Audiometria calibrada en una primera version
- probar un flujo completo real del estudio dentro del sistema

Esto implica:
- contrato de extraccion
- reglas de interpretacion inicial basadas en tabulador AMI
- prueba de punta a punta con al menos un documento real o representativo

### Frente 2. Espirometria calibrada y probada

Objetivo de ataque inmediato:
- dejar Espirometria calibrada en una primera version
- probar un flujo completo real del estudio dentro del sistema

Esto implica:
- contrato de extraccion
- reglas de patron y severidad basadas en tabulador AMI
- prueba de punta a punta con al menos un documento real o representativo

### Frente 3. SPEC de Agenda AMI

Objetivo:
- dejar especificado como siguiente bloque funcional el uso de la agenda real AMI para analitica, capacidad y futura atencion masiva/sin cita

### Frente 4. SPEC de Equipos y mantenimiento

Objetivo:
- dejar especificado el modulo base de equipos, calibracion, mantenimiento y relacion con sedes/unidades moviles

## Lo que faltaria seguir solicitando a AMI mientras avanzamos

Para que estos frentes no se queden atorados a mitad del camino, conviene mantener visible esta lista de insumos pendientes:

### Para Audiometria
- PDF original exportado por el equipo o salida nativa del software.
- Mas estudios reales de distintos pacientes para validar variabilidad.
- Confirmacion de si el tabulador de la Dra. Erika es regla vigente oficial o guia operativa base.

### Para Espirometria
- PDF original exportado por el equipo o salida nativa del software.
- Estudios con y sin broncodilatador, si forman parte del criterio AMI.
- Confirmacion de los campos minimos obligatorios para dictaminar cuando falte informacion.

### Para Agenda
- Confirmacion de que marzo 2026 es un mes suficientemente representativo.
- Criterio de que AMI considera carga normal, saturacion y sobrecupo.
- Reglas reales para atencion sin cita y cargas masivas.

### Para Equipos
- Confirmacion de inventario maestro vigente.
- Relacion equipo-sede-unidad movil.
- Regla de vencimiento, semaforizacion y responsables operativos.

### Para seguimiento de resultados y homologacion funcional
- Archivo real de seguimiento de envio de resultados.
- Propuesta de nomenclatura clinica para modulos, estados y etiquetas.
- Listado homologado final de perfiles y pruebas.

## Artefactos a crear o tomar como base desde hoy

- SPEC de correccion de Somatometria dentro de Examen Medico.
- SPEC de Agenda AMI basada en datos reales.
- SPEC de Equipos, calibracion y mantenimiento.
- Este documento como lista viva de “lo ya util” y “lo aun pendiente por pedir”.

### Frente 1. Audiometria
- Definir contrato de extraccion por frecuencia y por oido.
- Convertir tabulador de la Dra. Erika en reglas de apoyo clinico.
- Alinear la salida a una futura capa de apoyo clinico basada en IA medica de Google.

### Frente 2. Espirometria
- Definir contrato minimo de extraccion.
- Convertir tabulador de la Dra. Erika en reglas de clasificacion y severidad.
- Alinear la salida a una futura capa de apoyo clinico basada en IA medica de Google.

### Frente 3. Agenda
- Explorar volumen, patrones, perfiles y ventanas horarias por sede.

### Frente 4. Equipos
- Diseñar backlog funcional de mantenimiento/calibracion.

## Conclusión interna

Con lo recibido, ya no estamos solo en espera pasiva de “mas datos”. Ya se puede trabajar sobre una primera capa clinicamente guiada para audiometria y espirometria usando los tabuladores que la Dra. Erika mando, y al mismo tiempo se puede empezar a aterrizar analitica de agenda y modelado de equipos. Lo que sigue faltando no invalida avanzar; simplemente delimita hasta donde podemos llegar hoy con precision documental y validacion clinica real.