# SPEC ARCH-20260604-01 - Capa de Presentación Persistida en Calibración IA por Estudio

## 1. Objetivo

Eliminar la dependencia de schemas hardcodeados por estudio en frontend y mover la presentación clínica extractiva a una tercera capa persistida dentro de `aiCalibration`, editable desde el módulo de calibración y con propuesta asistida a partir del JSON real de extracción.

## 2. Problema Confirmado

El renderer clínico general resolvió el problema inicial de legibilidad, pero hoy la definición visual por estudio vive en código fijo. Eso no escala: cada nuevo estudio o cambio de layout obliga a publicar frontend aunque el extractor ya entregue un JSON correcto.

La arquitectura correcta separa tres responsabilidades:

1. extracción documental
2. interpretación clínica
3. presentación extractiva

Las dos primeras ya tienen gobernanza por calibración. La tercera todavía no.

## 3. Decisión Arquitectónica

Se aprueba agregar una nueva capa persistida en `MedicalTest.options.aiCalibration`:

- `aiCalibration.presentation`

Esta capa debe guardar un schema declarativo de render y dejar en código solo el motor genérico de visualización.

### 3.1 Regla crítica

No se aprueba un tercer prompt operativo de runtime para decidir la UI cada vez que se abre un estudio.

Sí se aprueba una propuesta asistida por IA dentro del módulo de calibración, ejecutada bajo demanda sobre un snapshot real de `extracted_data`, cuya salida debe guardarse como configuración estable y editable.

## 4. Hipótesis Local Falsable

Si el renderer clínico deja de depender exclusivamente de `frontend/src/components/clinical/extraction-presentation-schemas.ts` y primero intenta resolver un schema persistido desde `aiCalibration.presentation.schema`, entonces:

1. un estudio nuevo podrá renderizarse sin agregar código específico
2. un cambio de layout podrá corregirse desde calibración
3. los schemas hardcodeados quedarán solo como fallback temporal

Si además calibración puede pedir una propuesta asistida a partir de un snapshot real, entonces el operador no tendrá que redactar el schema visual desde cero.

## 5. Fuente de Verdad Actual a Reutilizar

### 5.1 Persistencia existente

Ya existe persistencia JSON en:

- `MedicalTest.options.aiCalibration`

Ya existe versionado automático en:

- `frontend/src/actions/medical-profiles.ts`

Ya existe el contrato base en:

- `frontend/src/types/calibration.ts`

### 5.2 Workspace de calibración existente

Ya existe la superficie de calibración con:

- layout de dos columnas
- snapshots reales
- propuesta heurística de campos
- edición de prompts de extracción y diagnóstico

Anclas actuales:

- `frontend/src/app/admin/services/[id]/calibration/page.tsx`
- `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx`

### 5.3 Renderer reutilizable

Ya existe el motor genérico en:

- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`

El objetivo no es reemplazarlo, sino cambiar la fuente del schema.

## 6. Datos Faltantes a Crear

### 6.1 Nuevo contrato persistido

Agregar dentro de `AICalibrationV2`:

- `presentation?: PresentationCalibration`

Contrato objetivo:

```ts
type PresentationSectionKind =
  | "keyValue"
  | "table"
  | "note"
  | "badges"
  | "bilateralFrequency"

type PresentationColumn = {
  key: string
  label: string
}

type PresentationSection =
  | {
      kind: "keyValue"
      title: string
      sourceKey?: string
      fields: string[]
    }
  | {
      kind: "table"
      title: string
      source: string
      columns: PresentationColumn[]
    }
  | {
      kind: "note"
      title: string
      source: string
    }
  | {
      kind: "badges"
      title: string
      sourceKey?: string
      fields: string[]
    }
  | {
      kind: "bilateralFrequency"
      title: string
      rightKey: string
      leftKey: string
      preferredOrder?: number[]
    }

type StudyPresentationSchema = {
  studyType: string
  sections: PresentationSection[]
}

type PresentationCalibration = {
  enabled: boolean
  schema: StudyPresentationSchema | null
  lastSuggestedAt?: string
  lastSuggestionModel?: string
  lastSuggestionSummary?: string
}
```

### 6.2 Propuesta asistida por IA

Agregar una acción de propuesta bajo demanda, basada en un snapshot real de `extracted_data`.

Contrato esperado de entrada:

```json
{
  "study_type": "Espirometria",
  "extracted_data": { "...": "..." },
  "ai_calibration": { "canonicalStudyType": "Espirometria" }
}
```

Contrato esperado de salida:

```json
{
  "schema": {
    "studyType": "Espirometria",
    "sections": []
  },
  "summary": "Agrupé paciente, estudio, condiciones y una tabla principal de parámetros.",
  "audit": {
    "model_name": "gemini-2.5-flash",
    "prompt_source": "presentation_schema_assistant",
    "prompt_version": "presentation-schema-v1"
  }
}
```

### 6.3 Regla de la propuesta IA

La IA debe sugerir un schema declarativo, no HTML ni JSX.

Debe:

1. agrupar campos en secciones clínicas obvias cuando el JSON lo permita
2. proponer tablas cuando encuentre arrays homogéneos de objetos
3. usar títulos médicos legibles
4. preferir rutas explícitas del JSON real
5. no inventar claves ausentes

No debe:

1. decidir estilos visuales finales
2. producir texto clínico interpretativo
3. introducir campos que no estén en `extracted_data`

## 7. Diseño del Flujo

### 7.1 En calibración

Nuevo flujo esperado:

1. el usuario selecciona un snapshot real
2. el usuario abre una nueva pestaña `Presentación`
3. puede pedir `Generar propuesta desde extracción`
4. el sistema llama a la propuesta asistida usando el `extracted_data` del snapshot seleccionado
5. la propuesta se carga en un editor declarativo
6. el usuario ajusta secciones, campos, columnas y orden
7. al guardar, `aiCalibration` crea nueva versión si cambió `presentation.schema`

### 7.2 En la papeleta clínica

Nuevo orden de resolución del schema:

1. `aiCalibration.presentation.schema` persistido en la prueba
2. fallback hardcodeado de `extraction-presentation-schemas.ts`
3. fallback genérico actual si no existe ninguno de los anteriores

## 8. Alcance

### Incluye

1. persistir `presentation` dentro de `aiCalibration`
2. permitir edición manual del schema de presentación en calibración
3. generar propuesta asistida desde un snapshot real de extracción
4. consumir el schema persistido en `ClinicalExtractionRenderer`
5. mantener los schemas hardcodeados actuales solo como fallback transitorio

### No incluye

1. eliminar aún `frontend/src/components/clinical/extraction-presentation-schemas.ts`
2. un prompt de presentación ejecutado en runtime clínico
3. rediseño visual del renderer general
4. cambios al contrato extractivo ni al prediagnóstico

## 9. Archivo Ancla Inicial

- `frontend/src/types/calibration.ts`

## 10. Archivos Exactos Permitidos

Máximo permitido: 8 archivos.

Archivos autorizados:

1. `frontend/src/types/calibration.ts`
2. `frontend/src/actions/medical-profiles.ts`
3. `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx`
4. `frontend/src/components/calibration/PresentationSchemaPanel.tsx`
5. `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`
6. `frontend/src/components/clinical/PapeletaWorkspace.tsx`
7. `backend/app/main.py`
8. `backend/app/services/ai/presentation.py`

Si SOFIA necesita tocar un noveno archivo, debe detenerse y justificarlo.

## 11. Comportamiento Esperado por Archivo

### 11.1 `frontend/src/types/calibration.ts`

Agregar tipos compartidos para `PresentationCalibration`, `StudyPresentationSchema` y `PresentationSection`.

### 11.2 `frontend/src/actions/medical-profiles.ts`

Extender `saveAICalibrationV2()` para que el versionado automático también considere cambios en `presentation.schema`, no solo en `fieldDefinitions`.

### 11.3 `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx`

Agregar nuevo tab izquierdo:

- `presentacion`

Debe recibir el snapshot seleccionado y delegar a `PresentationSchemaPanel`.

### 11.4 `frontend/src/components/calibration/PresentationSchemaPanel.tsx`

Nuevo componente.

Debe permitir:

1. pedir propuesta IA desde snapshot seleccionado
2. visualizar el schema propuesto
3. editarlo de forma declarativa básica
4. guardar el schema persistido vía `saveAICalibrationV2()`

MVP de edición permitido:

1. editar título de sección
2. editar tipo de sección
3. editar `sourceKey` o `source`
4. editar campos
5. editar columnas de tablas
6. reordenar secciones de forma simple

No se exige drag-and-drop en este primer corte.

### 11.5 `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`

Agregar prop opcional:

- `presentationSchema?: StudyPresentationSchema | null`

Resolución obligatoria:

1. usar `presentationSchema` si viene y es válido
2. si no, usar `getStudySchema(studyType)` actual
3. si no hay ninguno, caer al fallback genérico actual

### 11.6 `frontend/src/components/clinical/PapeletaWorkspace.tsx`

Resolver desde `test.test.options.aiCalibration.presentation.schema` y pasarlo a `ClinicalExtractionRenderer`.

### 11.7 `backend/app/services/ai/presentation.py`

Nuevo servicio Gemini text-only para proponer `StudyPresentationSchema` a partir de:

- `study_type`
- `extracted_data`
- opcionalmente `ai_calibration.canonicalStudyType`

Debe usar un prompt fijo y consistente de asistencia de presentación.

### 11.8 `backend/app/main.py`

Agregar endpoint POST dedicado, por ejemplo:

- `/api/v2/studies/presentation-schema/propose`

Debe responder solo JSON estructurado según el contrato definido arriba.

## 12. Criterios de Aceptación

1. La calibración de una prueba muestra una nueva pestaña `Presentación`.
2. Desde un snapshot real, el usuario puede pedir una propuesta asistida de schema visual.
3. La propuesta queda editable y guardable dentro de `aiCalibration.presentation.schema`.
4. Guardar cambios de `presentation.schema` incrementa la versión global de `aiCalibration`.
5. La papeleta clínica usa primero el schema persistido de calibración.
6. Si no existe schema persistido, los hardcodes actuales siguen funcionando como fallback.
7. No existe llamada a IA para decidir la UI en runtime de la papeleta.

## 13. Validación Exacta Esperada

### Frontend

`cd /workspaces/Administracion-medica-industrial/frontend && pnpm build`

### Backend

`cd /workspaces/Administracion-medica-industrial/backend && pytest tests/test_ai_pipeline.py -q`

## 14. Resultado Esperado

AMI deja de depender de un archivo hardcodeado por estudio para la capa de presentación extractiva. La UI clínica pasa a resolverse desde una calibración persistida y versionada, con propuesta asistida a partir del JSON real del extractor y con fallback controlado mientras migra el catálogo histórico.