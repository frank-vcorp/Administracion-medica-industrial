# ADR-20260820-01 — Calibración como fuente única de ejecución y presentación por prueba

- **ID:** `ARCH-20260820-01`
- **Estado:** `READY` (arquitectura firmada; pendiente de revisión de Frank antes de delegar a SOFIA)
- **Versión:** 1.1 (incorpora `DEC-20260820-02`: clasificación operativa `operationMode` + herencia por `familyTemplate`)
- **Fecha:** 2026-08-20
- **Agente:** INTEGRA — Arquitecto
- **Fuente funcional:** `discovery/DECISIONS.md` DEC-20260820-01, DEC-20260820-02, `discovery/FINDINGS.md` FND-20260820-01/02/03/04, `discovery/BUSINESS-RULES.md` BR-20260820-01
- **Auditoría forense de respaldo:** `FIX-20260820-01` (DEBY, solo lectura; 11/11 hipótesis confirmadas)
- **Supersede (parcial, no destructiva):**
  - `SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md` — se preserva como MVP histórico; el contrato `aiCalibration` V1 queda deprecado a favor de V3, pero las rutas/UI base se reutilizan.
  - `SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md` — el contrato `PresentationCalibration` se reutiliza íntegro; se amplía con versionado de publicación.
  - `SPEC_ARCH-20260809-02-SELECTOR-EXTRACCION-MULTI-PROVEEDOR.md` — el contrato `extraction.provider/model` se conserva; se integra al flujo de publicación.
- **No se toca:** rama `arch-20260819-02-tarjetas-muestra` (trabajo independiente de prototipo UI).

---

## 1. Contexto

Frank confirmó (DEC-20260820-01) que **toda configuración por prueba debe hacerse y probarse en el módulo Calibración**, y que **Events debe consumir la misma versión publicada**, sin reglas clínicas duplicadas o hardcodeadas como fuente primaria. La auditoría forense FIX-20260820-01 confirmó 11 defectos que violan esta intención:

Frank confirmó además (DEC-20260820-02) que **no todas las pruebas/servicios requieren Calibración IA**: las pruebas o servicios que no requieren extracción documental, operaciones clínicas ni prediagnóstico IA no deben tener configuración de Calibración IA. Se establece una **clasificación operativa obligatoria** (`operationMode`) con tres modos:

1. `manual_service`: ambulancias, traslados, atención médica, urgencias, inyecciones, curaciones, suturas, lavados, vacunas y consultas simples. **Sin editor de calibración IA.**
2. `document_extraction`: laboratorios/documentos/imágenes que requieren extracción configurable. Calibración **básica** (campos, aliases, unidades, tablas y presentación).
3. `clinical_interpretation`: Examen Médico, Audiometría, Espirometría, ECG y pruebas que requieran criterios, fórmulas, umbrales, prediagnóstico, recomendaciones o dictamen. Calibración **completa**.

Y FND-20260820-04 documenta que el catálogo AMI (~130 entradas + ~174 estudios de laboratorio) requiere **calibración generalizada por familias, paneles y analitos**, no configuración manual desde cero por cada prueba. Laboratorio se modela como familia → panel/estudio → analitos, con plantilla de familia + overrides por prueba.

**Consecuencias de DEC-20260820-02 para la arquitectura:**
- No existe default silencioso a `Audiometria` cuando una prueba no tiene calibración (refuerza H3).
- El catálogo `MedicalTest` debe mostrar el modo operativo de cada entrada y sólo habilitar las capacidades de IA correspondientes.
- La configuración específica por prueba es **override de una plantilla de familia**, no duplicación completa.
- La inferencia de modo en migración V1/V2 sólo asigna `clinical_interpretation` con evidencia sólida; en duda, `manual_service`+`requires_review`.

1. `aiCalibration.enabled` se persiste pero no se respeta en Events/backend/test de calibración.
2. Events decide el tipo canónico por heurística de nombre/categoría (`frontend/src/lib/study-ai.ts`) e ignora `aiCalibration.canonicalStudyType`.
3. Sin calibración, el modo Pruebas cae por default a `Audiometria` (`CalibrationWorkspaceClient.tsx:500`).
4. `fieldDefinitions` se guardan/versionan pero **no tienen consumidores runtime en backend**.
5. `PresentationSchemaPanel` es visor read-only; Events cae a `extraction-presentation-schemas.ts` hardcodeado cuando no hay schema persistido.
6. Calibración muestra JSON (`CalibrationTestResults`) mientras Events usa `ClinicalExtractionRenderer` + `StudyAIPrediagnosisPanel` (sin paridad).
7. Backend hardcodea `REQUIRED_PARAMS`, `CONFIDENCE_THRESHOLDS`, `PREDIAGNOSIS_SUPPORTED_TYPES`, `PREDIAGNOSTIC_PROMPTS` en `backend/app/services/ai/prediagnostic.py`.
8. `saveAICalibration` (V1) no versiona; `saveAICalibrationV2` solo versiona cambios de `fieldDefinitions`/`presentation.schema`, **no** de prompts, provider o canonical type.
9. Los snapshots de Events no congelan schema/versión de presentación; los históricos se renderizan con la calibración vigente.
10. El routing XML de Audiometría depende de la heurística hardcodeada de Events, no del `canonicalStudyType` publicado.
11. `medical_calibration` nunca se pasa a `generate_prediagnosis` desde el flujo principal (`main.py:1258`); el canal `_build_calibration_context` busca campos (`description`, `criteria`, `thresholds`, `notes`) que el contrato V2 no define → canal muerto.

**Evidencia validada por INTEGRA** (no por confianza ciega en DEBY):
- H1/H11: `prediagnostic.py:634-660` (`generate_prediagnosis` no lee `enabled`; `main.py:1258-1262` solo pasa `ai_calibration=`, no `medical_calibration=`).
- H2/H10: `event-test.actions.ts:14,623,881` importa y usa `getCanonicalAIStudyType` (heurística de nombre) en lugar de leer `test.options.aiCalibration.canonicalStudyType`.
- H3: `CalibrationWorkspaceClient.tsx:500` → `?? "Audiometria"`.
- H4: `prediagnostic.py:136-178` usa `REQUIRED_PARAMS`/`CONFIDENCE_THRESHOLDS`/`PREDIAGNOSIS_SUPPORTED_TYPES` hardcodeados; `fieldDefinitions` no se referencia en ningún servicio backend.
- H5: `ClinicalExtractionRenderer.tsx:486-494` cae a `getStudySchema(studyType)` hardcodeado si no llega `presentationSchema`. `PapeletaWorkspace.tsx:186-216` sí resuelve el persistido, pero su ausencia provoca el fallback silencioso.
- H7: `prediagnostic.py:192-567` contiene los prompts clínicos en `PREDIAGNOSTIC_PROMPTS` como clase del servicio.
- H8: `medical-profiles.ts:765-770` — `hasChanged` solo considera `fieldDefinitions` y `presentation.schema`.

## 2. Decisión arquitectónica

### 2.1 Contrato `aiCalibration` V3 con estados de publicación

Se adopta un **contrato V3** que unifica todas las capas (activación, tipo canónico, extracción, interpretación, presentación) bajo un mismo versionado con **estados explícitos de publicación**:

```
draft → tested → published → superseded
                              ↘ disabled
```

- `draft`: edición en curso, no consumida por Events.
- `tested`: pasó al menos una prueba end-to-end en el módulo Calibración con la UI paritaria.
- `published`: única versión consumida por Events. **Inmutable**.
- `superseded`: fue publicada, pero una versión posterior la reemplazó. Inmutable, conservada para histórico.
- `disabled`: publicación desactivada manualmente; Events no dispara IA para esa prueba hasta re-publicar.

El campo `currentVersion` actual se reinterpreta: ya no es "última editada" sino "última publicada". Las versiones `draft`/`tested` viven en `draftVersion` separado.

### 2.2 Resolución runtime única (`CalibrationResolver`)

Se introduce un **único punto de resolución** del contrato publicado, consumido tanto por Calibración (para preview de la versión `draft`/`tested`) como por Events (para `published`). El resolver:

1. Recibe `(testId, desiredState)` y devuelve la versión inmutable correspondiente.
2. Es la **única** fuente autorizada de: `canonicalStudyType`, `extraction.prompt/provider/model`, `fieldDefinitions`, `clinicalCriteria` (reemplaza a `REQUIRED_PARAMS`/`CONFIDENCE_THRESHOLDS`/`PREDIAGNOSIS_SUPPORTED_TYPES`), `diagnosis.prompt`, `presentation.schema`.
3. Elimina el canal muerto `medical_calibration`: los criterios clínicos viven **dentro** del contrato publicado, no en un parámetro separado.

Events llama al resolver con `desiredState="published"`. Calibración llama con `desiredState="draft"` o `"tested"` para su preview.

### 2.3 Routing primario por `canonicalStudyType` publicado

El routing XML/pipeline de Audiometría (y cualquier futura extracción directa) pasa a decidirse **primero** por `aiCalibration.canonicalStudyType` publicado. La heurística de `study-ai.ts` se conserva **solo como fallback explícito y trazado** cuando no existe calibración publicada (caso de un EventTest cuyo `MedicalTest` aún no fue calibrado).

### 2.4 Gate real de `enabled`

`enabled` se respeta como **gate global por prueba**: si `enabled=false` (o la versión está `disabled`), Events **no dispara IA** para esa prueba y registra el motivo en trazabilidad. Los flags granulares por capa (`extraction.enabled`, `diagnosis.enabled`, `presentation.enabled`) se conservan como gates de capa, pero el gate global es no-negociable.

### 2.5 `fieldDefinitions` como contrato runtime

`fieldDefinitions` pasa a ser el **contrato fuente** para:
- validación de campos esperados/required;
- aliases para resolución de claves extraídas;
- cálculo de `missing_fields` en backend (reemplaza la lógica hardcodeada actual).

### 2.6 Criterios clínicos configurables

Se reemplazan `REQUIRED_PARAMS`, `CONFIDENCE_THRESHOLDS`, `PREDIAGNOSIS_SUPPORTED_TYPES` y `PREDIAGNOSTIC_PROMPTS` hardcodeados por un bloque `clinicalCriteria` dentro del contrato publicado, con:
- `requiredParams: string[]` (reemplaza `REQUIRED_PARAMS`).
- `confidenceThreshold: number` (reemplaza `CONFIDENCE_THRESHOLDS`).
- `prediagnosisEnabled: boolean` (reemplaza `PREDIAGNOSIS_SUPPORTED_TYPES`).
- `prompt: string` (reemplaza `PREDIAGNOSTIC_PROMPTS[study_type]` y se unifica con `diagnosis.prompt` actual — un solo prompt clínico por versión).

El backend consulta este bloque vía `CalibrationResolver`; **no** lee constantes de módulo como fuente primaria.

### 2.7 Editor real de `presentation.schema` + paridad de renderer

- `PresentationSchemaPanel` pasa de visor read-only a **editor persistente** del contrato publicado.
- El módulo Calibración renderiza el preview de presentación usando el **mismo** `ClinicalExtractionRenderer` que Events, no un visor JSON.
- `CalibrationTestResults` mantiene un modo JSON debug **opcional** (toggle), pero la vista primaria es el renderer clínico.

### 2.8 Snapshot versionado históricamente

Cada `StudyExtractionSnapshot` y `AIPrediagnosisSnapshot` congela:
- `calibration_version_id` (referencia a la versión publicada inmutable).
- `presentation_schema` (copia inmutable del schema usado en esa corrida).
- `extraction_prompt_hash`, `clinical_prompt_hash`, `clinical_criteria_hash` (hashes para auditoría).

Los históricos se renderizan **siempre** con la versión congelada, sin importar cambios posteriores en Calibración.

### 2.9 Migración compatible V1/V2 → V3

- Las calibraciones V1/V2 existentes en `MedicalTest.options.aiCalibration` se leen con un **adaptador de lectura** que las normaliza a V3 al vuelo (sin escribir).
- La primera vez que el admin "publica" una calibración V1/V2, se materializa como V3 completa.
- El adaptador mapea: `enabled`→`status` (true→`draft`, false→`disabled`), `canonicalStudyType`→`canonicalStudyType`, `extraction.prompt`→`extraction.prompt`, `diagnosis.prompt`→`clinicalCriteria.prompt`, `fieldDefinitions`→`fieldDefinitions`, `presentation.schema`→`presentation.schema`.
- Para criterios clínicos que no existían en V1/V2 (`requiredParams`, `confidenceThreshold`, `prediagnosisEnabled`), el adaptador usa los valores hardcodeados actuales como **defaults** (mismos números que `prediagnostic.py` hoy). Esto preserva comportamiento durante la migración.

### 2.10 Degradación progresiva de hardcodeos (sin big-bang)

Los hardcodeos de `prediagnostic.py` y `extraction-presentation-schemas.ts` no se eliminan de inmediato. Se transforman en **fallbacks explícitos y trazados**, activos solo cuando el resolver no encuentra contrato publicado. Cada uso del fallback queda registrado en `extraction_snapshot.audit` o `prediagnosis.audit` con `source="legacy_hardcoded"`.

La eliminación total de los hardcodeos queda como objetivo de fase final, **después** de que todas las pruebas `clinical_interpretation` + `document_extraction` del catálogo tengan calibración V3 publicada Y el clasificador `operationMode` clasifique el catálogo completo.

### 2.11 Clasificación operativa `operationMode` (DEC-20260820-02)

Se introduce un campo `operationMode` en `MedicalTest.options` que clasifica cada entrada del catálogo en uno de tres modos: `manual_service`, `document_extraction`, `clinical_interpretation`. El modo determina:

- Si existe bloque `aiCalibration` (no existe para `manual_service`).
- Qué secciones del contrato V3 son relevantes (`clinicalCriteria` sólo para `clinical_interpretation`).
- Si el módulo Calibración muestra editor de IA (no para `manual_service`).
- Qué devuelve el resolver (`None` para `manual_service`; sin `clinicalCriteria` para `document_extraction`; completo para `clinical_interpretation`).

**No existe default silencioso a `Audiometria`.** Una prueba sin `operationMode` confirmado/inferible cae a `manual_service`+`requires_review`, nunca a interpretación clínica. Esto refuerza y formaliza la eliminación del defecto H3.

La inferencia de modo en migración V1/V2 es **conservadora**: sólo asigna `clinical_interpretation` cuando hay evidencia sólida (`canonicalStudyType` clínico + cobertura en `PREDIAGNOSIS_SUPPORTED_TYPES`); en duda, `manual_service`+`requires_review`.

### 2.12 Herencia por `familyTemplate` + `overrides` (FND-20260820-04)

Laboratorio se modela como **familia → panel/estudio → analitos**, no como N calibraciones manuales independientes. Una `MedicalTest` puede referenciar una `FamilyTemplate` (`familyTemplateId`) y declarar `overrides` sólo donde difiere. El resolver fusiona `FamilyTemplate.defaults` con `overrides` (override gana) al resolver la versión efectiva.

Reglas:
- La plantilla de familia fija el `operationMode` de sus miembros (coherencia obligatoria, gate G8).
- Un `override` puede añadir/reemplazar `fieldDefinitions` por analito, pero no eliminar los `required` de la plantilla (gate G9).
- El snapshot histórico congela la versión **efectiva ya fusionada**, no referencias a la plantilla, para que un cambio posterior en la plantilla no re-renderice históricos.

El catálogo de `FamilyTemplate`s (qué familias existen, qué analitos base, qué schemas tabulares) y la asignación de `familyTemplateId`/`operationMode` a cada `MedicalTest` existente son **decisiones funcionales/operacionales** (ATLAS/Frank), no arquitectónicas. Esta ADR define el contrato y la mecánica; no define el contenido del catálogo.

## 3. Alternativas consideradas

### 3.1 Opción A — "Big-bang: eliminar hardcodeos inmediatamente" (RECHAZADA)
- **Ventaja:** código limpio rápido.
- **Consecuencia:** cualquier prueba sin calibración V3 publicada pierde IA → regresión clínica inaceptable. Frank no autoriza riesgo de producto.
- **Decisión:** rechazada. Se exige degradación progresiva.

### 3.2 Opción B — "Persistir calibración en tabla dedicada" (RECHAZADA)
- **Ventaja:** modelo relacional limpio, consultas tipadas.
- **Consecuencia:** migración Prisma pesada, acopla el contrato a esquema físico, dificulta iteración del contrato V3 sin migraciones frecuentes.
- **Decisión:** rechazada. Se mantiene en `MedicalTest.options.aiCalibration` (JSON) con el adaptador V3. Si el volumen de versiones crece, se evalúa tabla dedicada en un ADR futuro.

### 3.3 Opción C — "Un solo prompt runtime en Calibración para todo" (RECHAZADA)
- **Ventaja:** máxima simplicidad.
- **Consecuencia:** rompe la separación extracción/interpretación/presentación confirmada por DEC-20260820-01 y por SPEC_ARCH-20260604-01 §3.1 (que prohíbe un prompt de presentación en runtime).
- **Decisión:** rechazada. Se mantienen las tres capas: extracción, interpretación (prediagnóstico), presentación. La presentación sigue siendo **configuración persistida**, no un prompt runtime.

### 3.4 Opción D — "Adoptada: contrato V3 con estados + resolver único + migración adaptativa + degradación progresiva"
- **Justificación:** respeta DEC-20260820-01 sin riesgo de producto, preserva compatibilidad V1/V2, ofrece ruta de salida limpia para eliminar hardcodeos a futuro, y centraliza la paridad Calibración↔Events en un solo punto (el resolver).

## 4. Consecuencias

### 4.1 Positivas
- Paridad obligatoria Calibración↔Events por construcción (BR-20260820-01).
- Trazabilidad clínica completa: cada snapshot histórico es reproducible.
- Frank puede ajustar prompts, criterios, umbrales, presentación y routing **sin redeploy**.
- Elimina el canal muerto `medical_calibration` (H11) al unificar criterios en el contrato publicado.
- Prepara el terreno para que futuras pruebas (Campimetria, RiesgoCardiovascular hoy fuera de V1) se habiliten desde Calibración sin tocar `prediagnostic.py`.
- El clasificador `operationMode` (DEC-20260820-02) elimina el default silencioso a `Audiometria` (H3) y reduce ruido del editor: los servicios manuales no muestran calibración IA; el editor de extracción no muestra criterios clínicos.
- La herencia por `familyTemplate` (FND-20260820-04) evita duplicar 174 calibraciones manuales de laboratorio; un cambio de familia propaga a sus miembros.

### 4.2 Negativas / trade-offs
- **Mayor complejidad del contrato `aiCalibration`:** V3 es más denso que V1/V2. Mitigado: el adaptador y el resolver ocultan la complejidad a los consumidores.
- **Dependencia de publicación para operar IA:** una prueba sin calibración publicada cae a fallback trazado o no dispara IA. Mitigado: defaults del adaptador preservan comportamiento actual durante la migración.
- **Trabajo de migración de calibraciones existentes:** requiere acción del admin para "publicar" cada calibración V1/V2 → V3. Mitigado: el adaptador permite operar sin publicar; la publicación es incremental.
- **Tamaño del snapshot crece** (congela schema + versión). Aceptable: el valor clínico de reproducibilidad justifica el costo de almacenamiento.
- **Requiere clasificar el catálogo completo:** la eliminación de hardcodeos (fase final) depende de que toda prueba `clinical_interpretation`+`document_extraction` tenga V3 publicada Y el clasificador asigne `operationMode` a todo el catálogo. La inferencia del adaptador es transitoria; la clasificación definitiva es funcional (ATLAS/Frank).
- **`FamilyTemplate` compartida introduce riesgo de regresión masiva:** editar una plantilla afecta a todos sus miembros. Mitigado: snapshots históricos congelan la versión efectiva fusionada; la edición de plantilla es operación sensible.

### 4.3 Reversibilidad
- **Alta.** El adaptador V1/V2→V3 es de lectura; el contrato V3 vive en JSON. Revertir implica: (a) dejar de consultar el resolver, (b) restaurar los hardcodeos como fuente primaria. No hay migración de esquema físico que revertir.
- Los hardcodeos no se eliminan en fases tempranas, así que el rollback a "comportamiento actual" es trivial hasta la fase final.

## 5. Referencias funcionales

- `DEC-20260820-01` — Calibración como fuente única.
- `DEC-20260820-02` — Solo las pruebas que lo necesitan tienen calibración IA; clasificación operativa `operationMode`.
- `FND-20260820-01` — Calibración no gobierna el pipeline completo de Events (P0).
- `FND-20260820-02` — El modo de prueba no reproduce la presentación de Events (P1).
- `FND-20260820-03` — Versionado incompleto y representación histórica mutable (P1).
- `FND-20260820-04` — Catálogo AMI requiere calibración por familias/paneles/analitos, no manual por prueba (P1).
- `BR-20260820-01` — Paridad obligatoria entre Calibración y Events (reglas 1-4).
- `FIX-20260820-01` — Auditoría forense DEBY (11 hipótesis confirmadas).

## 6. Decisiones técnicas propias de INTEGRA (no requieren a Frank)

1. Estados de publicación: `draft/tested/published/superseded/disabled`.
2. Resolución runtime única vía `CalibrationResolver` (un servicio, no N consumidores).
3. Congelación de snapshot con `calibration_version_id` + `presentation_schema` + hashes.
4. Adaptador V1/V2→V3 de lectura, sin migración física.
5. Defaults del adaptador = valores hardcodeados actuales (preserva comportamiento).
6. Paridad de renderer: Calibración usa el mismo `ClinicalExtractionRenderer` que Events.
7. Hashes de prompt/criterios para auditoría sin almacenar texto completo duplicado.
8. Fallbacks hardcodeados marcados con `source="legacy_hardcoded"` en trazabilidad.
9. Campo `operationMode` en `MedicalTest.options` (no dentro de `aiCalibration`): el catálogo clasifica; el resolver consume la clasificación (DEC-20260820-02).
10. Inferencia conservadora de `operationMode` en migración V1/V2: nunca `Audiometria`/`clinical_interpretation` por defecto; en duda, `manual_service`+`requires_review`.
11. Editor de calibración condicional por modo: oculto para `manual_service`; sin `clinicalCriteria` para `document_extraction`.
12. Mecánica de herencia `familyTemplate`+`overrides` con fusión en el resolver y congelación de versión efectiva en snapshot.

## 7. Decisiones que requieren a Frank (pendientes de aprobación)

1. **Rol autorizado para publicar:** ¿ADMIN, o un rol nuevo CALIBRATOR? ¿Requiere aprobación médica (DOCTOR_GENERAL) antes de publicar criterios clínicos?
2. **Política de retención de versiones publicadas:** ¿cuántas `superseded` conservar indefinidamente? ¿Hay un límite (ej. últimas 20)?
3. **Corte de soporte V1/V2:** ¿fecha objetivo para eliminar el adaptador y los hardcodeos, o se mantienen como fallback permanente?
4. **Granularidad de `enabled`:** ¿`enabled` es solo global por prueba, o se mantienen los flags por capa (`extraction.enabled`, `diagnosis.enabled`, `presentation.enabled`) como gates independientes? (Recomendación INTEGRA: ambos — global no-negociable + flags por capa para desactivar selectivamente.)
5. **Prediagnóstico deshabilitable por prueba de forma independiente de la extracción:** ¿permitir `clinicalCriteria.prediagnosisEnabled=false` manteniendo extracción activa? (Recomendación INTEGRA: sí, ya es el patrón con `PREDIAGNOSIS_SUPPORTED_TYPES`.)
6. **UI de prueba end-to-end en Calibración:** ¿debe el admin poder subir un XML/PDF de muestra (no paciente) para validar publicación antes de ir a Events? (Recomendación INTEGRA: sí, ya existe `CalibrationTestUpload`; se reutiliza.)
7. **Catálogo de `FamilyTemplate`s (funcional/ATLAS, FND-20260820-04):** ¿qué familias de laboratorio existen, qué analitos base tiene cada una, qué schemas tabulares? Esta ADR define el contrato y la mecánica de herencia; el contenido del catálogo de plantillas es funcional.
8. **Asignación de `operationMode` y `familyTemplateId` al catálogo existente (funcional/ATLAS, DEC-20260820-02 + FND-20260820-04):** la inferencia del adaptador (SPEC §11.3) es transitoria; la clasificación definitiva de las ~130 entradas + ~174 estudios de lab requiere confirmación funcional. ¿quién valida/revisa las inferencias `requires_review`?
9. **Modelo de datos del registry de `FamilyTemplate`s:** ¿tabla Prisma dedicada, JSON en config, o por familia en `TestCategory`? (Decisión técnica diferida a ADR futuro cuando el ítem 7 defina contenido.)

## 8. Gates de publicación ( gates que deben pasar antes de `published`)

Antes de marcar una versión como `published`, el módulo Calibración debe verificar:
1. `MedicalTest.options.operationMode` está definido, es válido y no es `manual_service` (gates G0/G0b, DEC-20260820-02).
2. La versión está en `tested` (corrió al menos una prueba E2E en el propio módulo).
3. `canonicalStudyType` está definido y es un valor canónico válido (omitible para `document_extraction` sin routing XML).
4. `extraction.prompt` no está vacío (gate existente, ARCH-20260518-03).
5. Si `operationMode=clinical_interpretation` Y `clinicalCriteria.prediagnosisEnabled=true`, entonces `clinicalCriteria.prompt` no está vacío.
6. Si `presentation.enabled=true`, entonces `presentation.schema` tiene al menos una sección válida.
7. No existe otra versión `published` simultánea para el mismo `MedicalTest` (la anterior pasa a `superseded` atómicamente).
8. Si `familyTemplateId != null`: coherencia de modo con la familia (G8) y overrides no eliminan `required` de la plantilla (G9).

## 9. Trazabilidad

- **Cadena esperada:** `DEC-20260820-01` + `DEC-20260820-02` → `ADR-20260820-01` (este) → `SPEC_ARCH-20260820-01` → `HANDOFF_ARCH-20260820-01_SOFIA` → `IMPL-*` → `QA-*`.
- **IDs funcionales conservados en la SPEC:** `DEC-20260820-01`, `DEC-20260820-02`, `FND-20260820-01/02/03/04`, `BR-20260820-01`.
- **No se reenumera** ningún ID funcional.

## 10. Próximo paso

- INTEGRA redacta `SPEC_ARCH-20260820-01-CALIBRACION-FUENTE-UNICA.md` con criterios verificables por fase.
- INTEGRA prepara `HANDOFF_ARCH-20260820-01_SOFIA_CALIBRACION-FUENTE-UNICA.md` (sin delegar).
- **Frank revisa este ADR + la SPEC + el handoff** antes de autorizar delegación a SOFIA.
- No se implementa código, no se toca producción, no se mezcla con `arch-20260819-02-tarjetas-muestra`.
