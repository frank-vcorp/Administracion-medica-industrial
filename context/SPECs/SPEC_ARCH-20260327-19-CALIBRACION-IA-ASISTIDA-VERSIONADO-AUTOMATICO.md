## SPEC: Calibración IA Asistida con Versionado Automático y Documento Anclado

**ID:** `ARCH-20260327-19`
**Estado:** `Lista para implementación por SOFIA`
**Padre:** `ARCH-20260327-15`, `ARCH-20260327-18`
**Objetivo:** evolucionar la consola de calibración IA para que deje de depender de captura manual, incorpore asistencia permanente de IA, lleve versionado automático de configuraciones y opere con un layout de revisión técnica donde el documento fuente permanezca grande y visible al lado derecho.

### Problema a resolver
- El MVP actual de calibración ya permite inspeccionar snapshots y editar configuración básica, pero todavía obliga a capturar demasiados campos manualmente.
- La versión de calibración hoy depende del usuario; eso es frágil y no escala si hay iteraciones frecuentes por prueba.
- La IA hoy aparece como objeto calibrado, no como copiloto operativo continuo dentro de la consola.
- La revisión documental pierde eficiencia si el documento no ocupa una superficie prioritaria y estable durante la calibración.

### Decisión arquitectónica
- La siguiente fase del módulo será de **calibración asistida**, no de captura manual.
- Cada calibración debe generar una **nueva versión automática** del contrato IA cuando cambie la configuración efectiva.
- La IA debe permanecer activa como apoyo durante toda la sesión de calibración, proponiendo esquema candidato, campos candidatos, alias, unidades, evidencias y advertencias.
- En desktop, el **documento fuente será el panel dominante del lado derecho**, anclado y siempre visible durante la edición/curaduría del lado izquierdo.

### Alcance de esta iteración

#### Sí entra
- Propuesta automática de esquema candidato por IA a partir de snapshots reales.
- Propuesta automática de extracción candidata por documento.
- Versionado automático de `aiCalibration` sin requerir captura manual del número de versión.
- Panel de asistencia IA persistente durante la calibración.
- Rediseño del layout desktop para dejar el documento grande a la derecha.
- Historial visible de versiones recientes por prueba.

#### No entra
- Entrenamiento automático de modelos.
- Reescritura completa del backend extractor en esta fase.
- Versionado en tablas Prisma nuevas si puede resolverse dentro de `MedicalTest.options` V2.
- Edición libre de prompts clínicos complejos.

### Principios no negociables

#### 1. La IA propone, el humano gobierna
- La IA debe sugerir y asistir continuamente.
- La aprobación, descarte o promoción final sigue siendo humana.

#### 2. El versionado es automático
- El usuario no elige manualmente el número de versión.
- Cada cambio persistido que altere el contrato efectivo debe crear una nueva versión.

#### 3. El documento es la fuente de verdad visual
- La calibración debe hacerse viendo el documento sin perder contexto.
- El panel documental ocupa prioridad espacial en desktop.

#### 4. Esquema y extracción son artefactos distintos
- Una cosa es el contrato candidato de campos.
- Otra cosa es el llenado candidato para un documento específico.

### Resultado esperado

#### Flujo operativo ideal
1. El usuario entra a la calibración de una prueba.
2. La IA carga una propuesta inicial de esquema candidato basada en snapshots históricos.
3. La IA muestra campos candidatos detectados para el documento seleccionado.
4. El usuario acepta, corrige o descarta elementos.
5. Al guardar, el sistema crea automáticamente una nueva versión de calibración.
6. El documento sigue visible en grande al lado derecho durante toda la sesión.

### Modelo funcional

#### A. Asistencia IA permanente
La consola debe incluir un bloque o rail de apoyo IA con estas funciones mínimas:
- sugerir campos candidatos
- detectar aliases repetidos o conflictivos
- proponer tipo de dato y unidad
- señalar campos faltantes respecto al esquema vigente
- advertir inconsistencias entre documento, extracción y contrato actual
- resumir qué cambió entre la versión vigente y la propuesta nueva

#### B. Versionado automático
Se debe persistir un historial de versiones dentro de `MedicalTest.options.aiCalibration` con una estructura como referencia:

```json
{
  "aiCalibration": {
    "currentVersion": 4,
    "currentVersionLabel": "calib-v4",
    "updatedAt": "2026-03-27T00:00:00.000Z",
    "versions": [
      {
        "version": 3,
        "label": "calib-v3",
        "createdAt": "2026-03-26T22:10:00.000Z",
        "source": "manual-review",
        "summary": "Se agregan FEV1 y FVC como obligatorios"
      },
      {
        "version": 4,
        "label": "calib-v4",
        "createdAt": "2026-03-27T00:00:00.000Z",
        "source": "ai-assisted-review",
        "summary": "Se promueve esquema candidato con aliases y unidad"
      }
    ],
    "draft": {
      "fieldDefinitions": []
    }
  }
}
```

#### Reglas del versionado
- Si no existe historial previo, el primer guardado crea `version = 1`.
- Si existe una versión actual y cambia el contrato efectivo, el siguiente guardado crea `version = currentVersion + 1`.
- Si el usuario solo navega o genera propuesta sin guardar, no se crea nueva versión.
- El historial debe mostrar fecha, origen del cambio y resumen breve.
- Debe existir una diferencia visible entre `versión vigente` y `borrador actual`.

#### C. Propuesta IA de esquema candidato
La IA debe generar por prueba una propuesta que incluya como mínimo:
- `key` canónica sugerida
- etiqueta legible
- tipo de dato sugerido
- unidad sugerida
- aliases detectados
- frecuencia de aparición en snapshots históricos
- ejemplo de valor observado
- confianza de la propuesta
- evidencia documental o textual
- recomendación: `aceptar`, `revisar`, `descartar`

#### D. Propuesta IA de extracción candidata
Para un documento concreto, la IA debe proponer:
- valor detectado por campo
- texto fuente del que proviene
- zona/sección aproximada del documento
- confianza por campo
- posibles conflictos o ambigüedades

### UX detallada

#### Layout desktop obligatorio
- Pantalla dividida en 2 zonas principales.
- **Izquierda (40-45%)**: calibración, propuesta IA, editor de campos, versiones, acciones.
- **Derecha (55-60%)**: documento fuente grande, sticky, siempre visible.
- El documento debe ocupar la mayor altura útil posible.
- El usuario no debe perder de vista el PDF/imagen mientras ajusta campos.

#### Jerarquía visual
1. Documento fuente grande a la derecha.
2. Tabla/lista de campos candidatos a la izquierda.
3. Asistente IA contextual con observaciones y sugerencias.
4. Historial de versiones y diff de cambios.

#### Componentes esperados
- `CandidateSchemaPanel`
- `CandidateFieldsTable`
- `CalibrationVersionHistory`
- `CalibrationAIAssistantRail`
- `CalibrationDocumentViewer` con prioridad de ancho y alto

### Cambios esperados de implementación

#### Frontend
- Evolucionar la ruta [frontend/src/app/admin/services/[id]/calibration/page.tsx](frontend/src/app/admin/services/[id]/calibration/page.tsx) para adoptar el layout con documento grande a la derecha.
- Extender [frontend/src/components/calibration/AICalibrationEditor.tsx](frontend/src/components/calibration/AICalibrationEditor.tsx) o reemplazarlo por un editor basado en propuesta IA y promoción de candidatos.
- Extender [frontend/src/components/calibration/CalibrationTabs.tsx](frontend/src/components/calibration/CalibrationTabs.tsx) para incluir propuesta IA, diff de versiones e historial.

#### Acciones / servidor
- Extender [frontend/src/actions/medical-profiles.ts](frontend/src/actions/medical-profiles.ts) para:
  - generar propuesta de esquema candidato desde snapshots reales
  - generar propuesta de extracción candidata para un caso
  - persistir historial de versiones automático en `aiCalibration`
  - guardar resumen del cambio entre versiones

### Contrato funcional de `aiCalibration` V2
La estructura objetivo debe evolucionar para soportar:
- `currentVersion`
- `currentVersionLabel`
- `versions[]`
- `draft`
- `fieldDefinitions[]`
- `aliases`
- `requiredFields`
- `normalizers`
- `diagnosticHints`
- `aiAssistance.lastSuggestedAt`
- `aiAssistance.lastSuggestionSummary`

### Criterios de aceptación

#### 1. Asistencia IA
- La consola ya no parte vacía cuando existen snapshots reales suficientes.
- La IA muestra campos/esquema candidatos y sugerencias accionables.

#### 2. Versionado automático
- Guardar una calibración crea una nueva versión sin que el usuario capture el número.
- La UI permite distinguir versión vigente, borrador y versiones previas.

#### 3. Documento a la derecha
- En desktop el documento se visualiza grande, estable y prioritario en el lado derecho.
- El calibrador puede trabajar sin ocultar el documento fuente.

#### 4. Curaduría mínima
- El usuario puede aceptar, editar o descartar candidatos sin construir el contrato desde cero.

### Validación esperada
- Navegación manual en la consola de calibración.
- Verificación visual del layout derecho dominante para documento.
- Verificación funcional de creación automática de versiones consecutivas.
- Prueba de generación de propuesta IA desde snapshots reales.

### Handoff a SOFIA
- Implementar la evolución de calibración asistida sobre el módulo existente.
- Priorizar experiencia de curaduría asistida, no formularios vacíos.
- Mantener versionado automático dentro de `MedicalTest.options.aiCalibration` si no es imprescindible migrar esquema.
- Garantizar que el documento permanezca grande y visible en el lado derecho durante la edición.
- Usar `qodo self-review` antes de cerrar si el entorno lo permite.