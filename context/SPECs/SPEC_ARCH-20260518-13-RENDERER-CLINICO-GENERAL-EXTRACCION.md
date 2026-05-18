# SPEC ARCH-20260518-13 - Renderer Clínico General para Extracción Estructurada

## 1. Objetivo

Reemplazar el panel actual `Valores capturados` por una representación clínica legible para médicos, basada en secciones y tablas ordenadas, manteniendo el JSON extraído como fuente de verdad temporal para DEV/QA pero no como UI principal.

## 2. Problema Detectado

El componente actual en `frontend/src/components/clinical/PapeletaWorkspace.tsx` renderiza `extractedData` como una lista vertical genérica (`ExtractedDataRows`).

Consecuencias:

- la tabla clínica de estudios como Espirometría se vuelve prácticamente ilegible
- los arreglos de objetos (`parametros`) pierden completamente su semántica tabular
- el médico no puede contrastar fácilmente la extracción con el documento original
- el JSON ya es correcto, pero la proyección humana no lo es

## 3. Decisión Arquitectónica

Se aprueba un **renderer clínico general configurable por tipo de estudio**, no una pantalla artesanal completamente distinta por estudio.

Patrón:

- un contenedor común de presentación clínica extractiva
- un esquema de secciones configurable por `studyType`
- soporte para tipos de bloque reutilizables
- el JSON raw permanece solo como soporte DEV/QA temporal y podrá ocultarse después

## 4. Principios

1. El JSON extraído sigue siendo la fuente de verdad.
2. La UI médica no debe renderizar el JSON como lista vertical genérica.
3. La representación debe parecer un reporte clínico estructurado, no un inspector técnico.
4. No se duplicará lógica de extracción en frontend; solo se reorganiza presentación.
5. La solución debe escalar a múltiples estudios con el mismo renderer base.

## 5. Alcance

### Incluye

- sustituir el panel azul actual por un renderer clínico estructurado
- definir un esquema general de secciones reutilizable
- implementar configuración inicial para `Espirometria`
- conservar el panel raw técnico como superficie secundaria de auditoría/DEV

### No incluye

- reescritura del extractor backend
- rediseño del panel raw técnico
- eliminación definitiva del JSON raw en esta entrega
- representación visual de gráficas clínicas dibujadas por frontend

## 6. Estructura General del Renderer

El renderer general debe soportar bloques como estos:

- `keyValueSection`
- `tableSection`
- `badgeListSection`
- `noteSection`

Contrato conceptual sugerido:

```ts
type ClinicalPresentationSection =
  | { kind: "keyValue"; title: string; fields: string[] }
  | { kind: "table"; title: string; source: string; columns: string[] }
  | { kind: "badges"; title: string; source: string; fields: string[] }
  | { kind: "note"; title: string; source: string }

type StudyPresentationSchema = {
  studyType: string
  sections: ClinicalPresentationSection[]
}
```

## 7. Configuración Inicial Requerida: Espirometría

La vista de Espirometría debe renderizar, como mínimo:

### 7.1 Resumen principal

- FVC
- FEV1
- FEV1/FVC ratio
- FVC % predicho
- FEV1 % predicho

### 7.2 Datos del paciente

- nombre completo
- sexo
- edad
- talla
- peso
- IMC
- motivo
- procedencia

### 7.3 Datos del estudio

- referencia
- fecha
- hora
- tipo de reporte
- equipo modelo
- versión de software

### 7.4 Condiciones técnicas

- técnico
- transductor
- temperatura
- humedad
- presión
- ecuación de referencia
- factor étnico
- factor BTPS

### 7.5 Calidad técnica del estudio

- repetibilidad ATS/ERS FVC
- repetibilidad ATS/ERS FEV1
- notas de calidad
- completitud documental si existe

### 7.6 Tabla principal de parámetros

Usar `extracted_data.parametros` como tabla real con columnas:

- Parámetro
- Unidad
- M1
- M2
- M3
- REF
- LLN
- %REF M1
- %REF M2
- %REF M3

Notas:

- el label clínico (`label`) es la primera columna visible
- `key` no debe ser protagonista visual; puede quedar oculto o como ayuda secundaria DEV si el equipo lo decide
- filas sin `key` válida, como `Edad del pulmón`, deben seguir renderizándose normalmente

### 7.7 Gráficas / indicadores

Renderizar como resumen corto:

- curva flujo-volumen presente
- curva volumen-tiempo presente
- maniobras graficadas
- observaciones de gráfica

## 8. UX Esperada

- quitar la inmensa lista vertical azul actual
- usar tablas limpias con lectura horizontal normal
- separar secciones con títulos clínicos claros
- mantener un diseño sobrio y técnico
- en móvil, permitir scroll horizontal controlado en tablas en vez de colapsar datos en vertical ilegible

## 9. Ubicación Sugerida de Implementación

### Archivos probables

- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- nuevo componente sugerido: `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`
- nuevo esquema sugerido: `frontend/src/components/clinical/extraction-presentation-schemas.ts`

## 10. Criterios de Aceptación

1. El panel `Valores capturados` deja de renderizar el payload como lista vertical genérica.
2. Espirometría se muestra en secciones legibles para médico.
3. `parametros` se renderiza como tabla real, no como repetición de claves en una sola columna.
4. La vista conserva exactamente la información extraída, sin pérdida de datos relevantes.
5. El panel raw técnico sigue existiendo como superficie secundaria.
6. La solución es extensible a Audiometría y otros estudios sin rehacer toda la UI.

## 11. Riesgos

- intentar resolver todos los estudios en una sola entrega puede sobredimensionar el corte
- hacer la tabla demasiado genérica puede perder legibilidad clínica
- exponer `key` y metadata técnica en primer plano puede volver a contaminar la UI médica

## 12. Recomendación de Entrega

Entrega incremental:

1. infraestructura del renderer general
2. configuración y render de Espirometría
3. mantener raw técnico colapsable o secundario
4. iteración posterior para Audiometría

## 13. Resultado Esperado

El médico ve una representación estructurada, ordenada y consumible del estudio extraído, con tablas clínicas legibles y bloques claramente separados, sin depender del JSON raw como interfaz principal.