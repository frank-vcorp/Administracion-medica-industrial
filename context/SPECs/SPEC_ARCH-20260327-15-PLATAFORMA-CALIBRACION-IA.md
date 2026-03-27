## SPEC: Plataforma de Calibración IA Ligada al Catálogo de Pruebas

**ID:** `ARCH-20260327-15`
**Estado:** `Lista para implementación por SOFIA`
**Padre:** `ARCH-20260325-01`, `ARCH-20260326-16`, `ARCH-20260327-01`
**Objetivo:** construir un módulo interno de calibración ligado al catálogo de pruebas que separe explícitamente la calibración de extracción documental y la calibración diagnóstica, de forma que el afinamiento del pipeline IA salga de la papeleta clínica y quede gobernado por prueba/versiones.

### Problema a resolver
- El panel raw dentro de la papeleta clínica resolvió inspección inmediata, pero mezcla trabajo clínico con calibración técnica.
- La extracción actual por estudio está limitada por contratos mínimos y no existe un espacio dedicado para comparar documento vs extracción vs criterio esperado.
- El prediagnóstico IA tampoco tiene un circuito explícito de calibración supervisada por médico fuera de la revisión puntual del expediente.
- El catálogo de pruebas existe, pero hoy no concentra la gobernanza IA de cada prueba.

### Decisión arquitectónica
- Se crea una **plataforma de calibración IA** ligada al `MedicalTest` del catálogo.
- Cada prueba médica puede tener dos planos de calibración independientes pero relacionados:
  1. **Extracción**: qué datos se leen, cómo se estructuran y qué tan completos/trazables son.
  2. **Diagnóstico**: cómo se interpreta el set de datos extraídos cuando aplique prediagnóstico IA.
- La plataforma se construye como módulo administrativo/técnico, no dentro del workspace clínico.
- El panel raw actual de la papeleta **permanece temporalmente** hasta que esta consola cubra adecuadamente la inspección técnica. Su retiro no forma parte de esta SPEC.

### Alcance MVP

#### Sí entra
- Nueva ruta de calibración ligada al catálogo de pruebas.
- Vista por prueba con dos tabs:
  - `Extracción`
  - `Diagnóstico`
- Listado de snapshots por prueba usando datos reales ya generados (`StudyExtractionSnapshot`, `AIPrediagnosisSnapshot`, `DoctorStudyReview`).
- Comparación visual de:
  - documento fuente
  - extracción raw
  - extracción canónica
  - faltantes
  - prediagnóstico IA
  - revisión médica vigente si existe
- Configuración inicial de calibración por prueba usando el campo `options` del `MedicalTest` para evitar migración en V1.
- Integración visible desde el catálogo de pruebas.

#### No entra
- Rediseño completo del pipeline backend de extracción.
- Versionado formal en nuevas tablas Prisma para contratos IA.
- Editor avanzado de prompts dentro de la UI.
- Eliminación del panel raw actual de la papeleta.
- Automatización de reentrenamiento o autoedición de prompts.
- Nuevas reglas clínicas de dictamen final o firma.

### Principios no negociables

#### 1. Separación de responsabilidades
- La papeleta clínica sigue siendo espacio operativo.
- La calibración IA vive en un módulo técnico/administrativo aparte.

#### 2. Gobernanza por prueba
- Toda calibración cuelga de una prueba concreta del catálogo (`MedicalTest`).
- No debe haber calibración “flotante” desligada del catálogo.

#### 3. Extracción y diagnóstico son capas distintas
- Si falla la lectura documental, debe verse como fallo de extracción.
- Si falla la interpretación clínica, debe verse como fallo diagnóstico.
- La UI debe hacer explícita esa diferencia.

#### 4. Reusar evidencia real
- El MVP debe aprovechar snapshots ya existentes del sistema.
- No inventar datasets sintéticos ni contratos paralelos en esta fase.

### Resultado esperado

#### Desde el catálogo de pruebas
Cada fila del catálogo debe ofrecer una entrada clara tipo `Calibrar IA`.

#### Pantalla de calibración por prueba
Debe mostrar:
1. Encabezado de la prueba seleccionada
2. Metadatos básicos de calibración leídos/escritos desde `MedicalTest.options`
3. Tabs:
   - `Extracción`
   - `Diagnóstico`

#### Tab Extracción
Debe incluir:
1. Selector/listado de snapshots de extracción asociados a `EventTest.testId = MedicalTest.id`
2. Documento fuente/visor
3. Raw completo del `structuredData`
4. Vista legible de `extracted_data`
5. `missing_fields`
6. Bloque de notas del calibrador para extracción
7. Estado simple del caso de calibración:
   - `pendiente`
   - `aprobado`
   - `requiere_ajuste`

#### Tab Diagnóstico
Debe incluir:
1. Snapshot de prediagnóstico asociado a la extracción seleccionada
2. Resumen IA
3. Estado clínico IA
4. Justificación / limitaciones
5. Última revisión médica si existe
6. Campo estructurado de feedback diagnóstico:
   - `correcto`
   - `incorrecto_por_extraccion`
   - `incorrecto_por_interpretacion`
   - `requiere_revision_humana`
7. Notas del calibrador/médico

### Contrato de configuración por prueba en V1

Se reutiliza `MedicalTest.options` como JSON con una llave `aiCalibration`.

Ejemplo:

```json
{
  "aiCalibration": {
    "enabled": true,
    "canonicalStudyType": "Espirometria",
    "extraction": {
      "enabled": true,
      "schemaVersion": "extract-v2",
      "targetFields": ["paciente", "fecha_estudio", "fev1", "fvc", "fev1_fvc_ratio"]
    },
    "diagnosis": {
      "enabled": true,
      "promptVersion": "predx-v1",
      "requiresDoctorCalibration": true
    }
  }
}
```

#### Reglas
- No romper compatibilidad con otros usos de `options`.
- Si `aiCalibration` no existe, la UI debe mostrar estado `Sin calibración configurada`.
- El usuario puede activar/desactivar calibración por prueba desde la interfaz V1.

### Modelo funcional MVP

#### A. Relación catálogo -> evidencia real
- `MedicalTest.id`
  -> `EventTest.testId`
  -> `StudyExtractionSnapshot.eventTestId`
  -> `AIPrediagnosisSnapshot.extractionSnapshotId`
  -> `DoctorStudyReview.prediagnosisSnapshotId`

#### B. Sin nuevas tablas en V1
- Las observaciones de calibración del MVP pueden persistirse inicialmente en `MedicalTest.options.aiCalibration.reviewNotes` para configuración global.
- Las observaciones por caso pueden ser V1 no persistentes o persistidas también en `options.aiCalibration.lastReview` si SOFIA ve viable una estructura simple.
- Prioridad del MVP: visibilidad y navegación, no data model perfecto.

### UX detallada

#### 1. Entrada desde catálogo
- En [frontend/src/app/admin/services/page.tsx](frontend/src/app/admin/services/page.tsx) cada prueba debe mostrar acción `Calibrar IA`.
- Si la prueba no tiene soporte IA evidente, la acción puede seguir visible pero entrar con estado vacío/configurable.

#### 2. Ruta de calibración
- Ruta propuesta:
  - `/admin/services/[id]/calibration`
- Debe cargar:
  - datos de la prueba
  - snapshots recientes asociados
  - configuración `aiCalibration`

#### 3. Layout recomendado
- Desktop: 3 columnas o 2 columnas anchas con tabs y panel lateral.
- Prioridad visual:
  1. documento
  2. extracción / prediagnóstico
  3. diff / notas / estado
- Móvil puede colapsar a una sola columna; este no es el foco principal del MVP, pero no debe romper.

### Cambios obligatorios de implementación

#### 1. Frontend route nueva
- Crear página de calibración para una prueba:
  - `frontend/src/app/admin/services/[id]/calibration/page.tsx`

#### 2. Server actions del catálogo
- Extender [frontend/src/actions/medical-profiles.ts](frontend/src/actions/medical-profiles.ts) para:
  - obtener una prueba individual con `options`
  - recuperar snapshots asociados a esa prueba
  - actualizar configuración `aiCalibration` en `MedicalTest.options`

#### 3. UI del catálogo
- Modificar [frontend/src/app/admin/services/page.tsx](frontend/src/app/admin/services/page.tsx) para agregar CTA `Calibrar IA` por prueba.

#### 4. Componentes de calibración
SOFIA puede crear componentes presentacionales dedicados, por ejemplo:
- `frontend/src/components/calibration/CalibrationShell.tsx`
- `frontend/src/components/calibration/ExtractionCalibrationTab.tsx`
- `frontend/src/components/calibration/DiagnosisCalibrationTab.tsx`
- `frontend/src/components/calibration/CalibrationDocumentViewer.tsx`

#### 5. Reuso de visualizador raw
- Puede reutilizar patrones del visor/document viewer y del raw panel actual, pero deben vivir en el módulo de calibración, no acoplados a la papeleta.

### Restricciones de implementación
- No tocar el flujo clínico del expediente en esta SPEC.
- No eliminar el raw de la papeleta aún.
- No crear un editor libre de prompt.
- No instalar librerías nuevas si el visor nativo actual ya resuelve PDF/imagen.
- No depender de datos mock si ya existen snapshots reales en base.

### Criterios de aceptación

#### 1. Catálogo
- Desde el catálogo se puede entrar a calibración de una prueba concreta.

#### 2. Configuración
- La prueba muestra si tiene calibración IA configurada o no.
- Se puede guardar configuración básica en `options.aiCalibration`.

#### 3. Extracción
- Se pueden ver snapshots reales de extracción ligados a esa prueba.
- Se pueden inspeccionar `structuredData`, `extracted_data` y `missing_fields`.
- El documento fuente se puede abrir/visualizar desde la misma pantalla.

#### 4. Diagnóstico
- Si existe prediagnóstico IA, se puede ver en el tab Diagnóstico.
- Si existe revisión médica, se puede comparar con la salida IA.

#### 5. Gobernanza
- Todo queda ligado a una prueba del catálogo; no hay accesos huérfanos.

### Archivos objetivo probables
- `frontend/src/app/admin/services/page.tsx`
- `frontend/src/app/admin/services/[id]/calibration/page.tsx`
- `frontend/src/actions/medical-profiles.ts`
- componentes nuevos bajo `frontend/src/components/calibration/`

### Validación esperada
- `pnpm lint` o validación equivalente del frontend si el entorno lo permite.
- Navegación manual:
  1. Ir a catálogo de pruebas
  2. Entrar a calibración de una prueba soportada
  3. Ver snapshots reales de extracción
  4. Cambiar entre tabs Extracción y Diagnóstico
  5. Guardar configuración básica de calibración

### Handoff a SOFIA
- Implementar MVP de plataforma de calibración IA ligada al catálogo de pruebas.
- Reusar el visualizador documental y raw panel existentes como referencia, no como dependencia rígida.
- Usar `qodo self-review` antes de cerrar si el entorno lo permite.
- Generar checkpoint de implementación con archivos tocados y estado de validación.