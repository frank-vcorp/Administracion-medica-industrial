# SPEC ARCH-20260513-03 — Copiloto Clínico Ocupacional para Lectura de Estudios y Prediagnóstico Asistido

- ID: ARCH-20260513-03
- Fecha: 2026-05-13
- Agente: INTEGRA - Arquitecto
- Estado: Definición comercial y de producto lista para implementación
- Carpeta: MEDGEMMA APIS

## Objetivo

Definir un producto comercializable, demostrable y escalable llamado Copiloto Clínico Ocupacional para Lectura de Estudios y Prediagnóstico Asistido, orientado a clínicas de salud ocupacional, laboratorios, médicos del trabajo y operadores B2B que requieren lectura documental, extracción clínica y apoyo al prediagnóstico por estudio y de forma consolidada.

## Tesis del producto

La propuesta de valor no es vender acceso al modelo, sino vender una plataforma verticalizada de apoyo clínico ocupacional que:

1. recibe documentos médicos crudos
2. extrae parámetros clínicos estructurados
3. genera prediagnóstico por estudio
4. consolida múltiples estudios del mismo caso o evento
5. presenta un apoyo clínico final revisable por el médico

## Problema de mercado

Las clínicas ocupacionales y proveedores de estudios enfrentan varios problemas recurrentes:

1. lectura manual lenta de estudios heterogéneos
2. dispersión de información entre examen médico, audiometría, espirometría, laboratorio y otros estudios
3. dificultad para consolidar hallazgos en un solo criterio clínico de apoyo
4. dependencia excesiva de revisión manual para tareas repetitivas de bajo valor
5. ausencia de trazabilidad y estandarización en la interpretación preliminar

## Promesa del producto

En minutos, una clínica puede subir uno o varios estudios, obtener extracción estructurada, prediagnóstico por estudio y un consolidado clínico de apoyo para revisión médica, manteniendo al médico como autoridad final.

## Usuarios objetivo

### Primarios

1. médicos laborales
2. coordinadores clínicos
3. clínicas ocupacionales pequeñas y medianas
4. empresas que tercerizan estudios médicos ocupacionales

### Secundarios

1. laboratorios clínicos que quieren agregar capa de interpretación asistida
2. integradores de software médico ocupacional
3. grupos multi-sucursal que buscan estandarización operativa
4. operadores B2B de campañas médicas industriales

## Capacidades núcleo del producto

### 1. Prediagnóstico por estudio

Para cada archivo subido, el sistema debe:

1. identificar el tipo de estudio
2. extraer parámetros estructurados
3. evaluar calidad documental
4. generar un prediagnóstico asistido prudente
5. mostrar evidencia y limitaciones

### 2. Consolidado multiestudio por caso

Cuando un usuario sube múltiples estudios del mismo trabajador o evento, el sistema debe:

1. agrupar estudios relacionados
2. mantener el prediagnóstico individual por estudio
3. construir un consolidado clínico final de apoyo con base en todos los estudios válidos
4. señalar contradicciones, vacíos y hallazgos prioritarios
5. dejar claro cuáles estudios sí y cuáles no entraron al consolidado

### 3. Modo sombra clínica obligatorio

Ninguna salida del sistema debe:

1. emitir aptitud laboral final
2. firmar documentos
3. reemplazar la decisión final del médico
4. ocultar incertidumbre o datos faltantes

## Arquitectura funcional del producto

### Capa 1. Ingesta documental

Responsabilidades:

1. recibir PDF, imagen o documento clínico
2. clasificar el estudio
3. extraer parámetros clínicos
4. normalizar datos a JSON canónico

Proveedor objetivo:

1. Gemini 2.5

### Capa 2. Prediagnóstico por estudio

Responsabilidades:

1. interpretar el JSON estructurado de cada estudio
2. generar hallazgos, alertas y resumen prudente
3. devolver confianza, limitaciones y justificación

Proveedor objetivo:

1. MedGemma

### Capa 3. Consolidado por evento o expediente

Responsabilidades:

1. consumir todos los estudios del mismo caso
2. cruzar hallazgos relevantes entre estudios
3. construir un prediagnóstico conjunto de apoyo
4. señalar correlaciones clínicas y áreas no concluyentes

## Alcance comercial inicial

### Incluye en la V1 comercial

1. landing page comercial
2. demo sencillo y altamente demostrable
3. carga de uno o varios archivos
4. prediagnóstico por estudio
5. consolidado multiestudio
6. contacto por WhatsApp para venta
7. documentación comercial para cliente
8. documentación técnica para implementación

### No incluye en la V1 comercial

1. expediente clínico completo multirol
2. firma electrónica de dictamen
3. integración obligatoria con ERP del cliente
4. automatización regulatoria completa
5. autoaprendizaje clínico en producción

## Demo mínimo demostrable

El demo debe ser extremadamente simple y visualmente fuerte:

1. panel izquierdo con carga de archivo o archivos
2. panel derecho con resultados
3. bloque por estudio con extracción y prediagnóstico
4. bloque final de consolidado cuando existan múltiples estudios

Ejemplo demostrable:

1. subir Examen Médico
2. subir Audiometría
3. generar prediagnóstico individual de cada uno
4. generar prediagnóstico consolidado final de apoyo al médico

## Reglas del consolidado multiestudio

### Entrada

El consolidado solo debe consumir estudios pertenecientes al mismo trabajador, evento o caso de revisión.

### Criterios de inclusión

1. el estudio debe haber sido clasificado correctamente
2. la extracción debe tener mínimos clínicos suficientes
3. el prediagnóstico individual no debe estar en estado inválido o corrupto

### Salida esperada

1. resumen clínico conjunto
2. hallazgos relevantes transversales
3. estudios que apoyan el criterio
4. estudios no concluyentes o excluidos
5. alertas o red flags
6. recomendaciones de revisión o correlación clínica

### Restricciones

1. no emitir dictamen final
2. no emitir aptitud laboral
3. no ocultar conflictos entre estudios
4. no consolidar estudios de casos distintos

## Casos de uso prioritarios

1. examen médico + audiometría
2. examen médico + espirometría
3. laboratorio + examen médico
4. audiometría + espirometría + laboratorio
5. campaña ocupacional con múltiples estudios por trabajador

## Diferenciadores comerciales

1. especializado en salud ocupacional
2. soporta consolidado multiestudio y no solo lectura aislada
3. arquitectura de dos momentos con mejor control clínico
4. modo sombra con guardrails
5. posibilidad de white-label o API B2B
6. operación en español enfocada al mercado mexicano

## Criterios de aceptación del producto

1. el demo permite subir uno o más estudios
2. el sistema genera prediagnóstico por estudio
3. el sistema genera consolidado multiestudio cuando aplica
4. el lenguaje de salida es prudente y clínicamente trazable
5. existe landing page comercial lista para captar leads
6. existe pricing razonable y justificable
7. existe documentación de onboarding para cliente
8. existe guía técnica de implementación y venta

## Activos de venta obligatorios

1. landing page con CTA a WhatsApp
2. propuesta de precios y paquetes
3. casos de uso
4. demo mínimo vendible
5. guion de venta y objeciones
6. documento de onboarding cliente
7. guía técnica de despliegue y operación
