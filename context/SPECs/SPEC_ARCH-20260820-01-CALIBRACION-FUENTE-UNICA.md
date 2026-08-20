# SPEC ARCH-20260820-01 — Calibración como fuente única de ejecución y presentación por prueba

- **ID:** `ARCH-20260820-01`
- **Estado:** `READY` (pendiente de revisión de Frank antes de delegar a SOFIA)
- **Versión:** 1.1 (incorpora `DEC-20260820-02`: clasificación operativa `operationMode` + herencia por `familyTemplate`; nada de default silencioso a Audiometría)
- **Propietario:** INTEGRA
- **Fecha:** 2026-08-20
- **ADR de respaldo:** `context/decisions/ADR-20260820-01-CALIBRACION-FUENTE-UNICA.md`
- **Fuentes funcionales:** `DEC-20260820-01`, `DEC-20260820-02`, `FND-20260820-01/02/03/04`, `BR-20260820-01`
- **Auditoría forense:** `FIX-20260820-01` (DEBY, 11/11 hipótesis confirmadas)
- **Supersede (parcial, no destructiva):**
  - `SPEC_ARCH-20260327-15-PLATAFORMA-CALIBRACION-IA.md` (MVP histórico; rutas/UI base se reutilizan, contrato V1 deprecado a favor de V3)
  - `SPEC_ARCH-20260604-01-CALIBRACION-PRESENTACION-ESTUDIOS-IA.md` (PresentationCalibration se reutiliza íntegro; se amplía con publicación)
  - `SPEC_ARCH-20260809-02-SELECTOR-EXTRACCION-MULTI-PROVEEDOR.md` (extraction.provider/model se conserva; se integra a publicación)
- **No se toca:** rama `arch-20260819-02-tarjetas-muestra`.

---

## 1. Resultado

Convertir el módulo Calibración en la **única fuente configurada y publicada** que gobierna activación, tipo canónico, extracción, interpretación clínica y presentación de cada prueba. Events consume exclusivamente la versión `published` e Inmutable. El modo de prueba de Calibración reproduce exactamente la misma UI que Events. Los hardcodeos clínicos de backend y frontend se degradan a fallbacks explícitos y trazados, eliminables cuando todas las pruebas del catálogo tengan V3 publicada.

**Ampliación v1.1 (DEC-20260820-02):** la calibración IA no aplica a todas las pruebas/servicios. El catálogo `MedicalTest` clasifica cada entrada con un `operationMode` operacional — `manual_service`, `document_extraction` o `clinical_interpretation` — que determina qué capacidades de IA (extracción, criterios clínicos, prediagnóstico, presentación) se habilitan y si existe editor de calibración. No existe default silencioso a `Audiometria` cuando una prueba no tiene calibración. Laboratorio se modela como familia → panel/estudio → analitos con **plantilla de familia** y overrides por prueba, no como N calibraciones manuales independientes (FND-20260820-04).

## 2. Fuentes funcionales por ID

| ID | Origen | Vínculo |
|---|---|---|
| `DEC-20260820-01` | ATLAS+Frank | Calibración como fuente única |
| `DEC-20260820-02` | ATLAS+Frank | Solo las pruebas que lo necesitan tienen calibración IA; clasificación operativa `operationMode` |
| `FND-20260820-01` | ATLAS | Calibración no gobierna pipeline Events (P0) |
| `FND-20260820-02` | ATLAS | Modo de prueba no reproduce presentación Events (P1) |
| `FND-20260820-03` | ATLAS | Versionado incompleto + histórico mutable (P1) |
| `FND-20260820-04` | ATLAS | Catálogo AMI requiere calibración por familias/paneles/analitos, no manual por prueba (P1) |
| `BR-20260820-01` | ATLAS+Frank | Paridad obligatoria Calibración↔Events |
| `FIX-20260820-01` | DEBY | 11/11 hipótesis confirmadas (auditoría solo lectura) |

## 3. Alcance técnico

### 3.1 Incluye
1. Contrato `aiCalibration` V3 con estados de publicación.
2. Clasificación operativa `operationMode` en el catálogo `MedicalTest` (`manual_service` | `document_extraction` | `clinical_interpretation`) que determina capacidades habilitadas y existencia del editor de calibración (DEC-20260820-02).
3. Catálogo `MedicalTest` muestra el modo operativo de cada entrada y sólo habilita las capacidades de IA correspondientes al modo.
4. Herencia por `familyTemplate` para laboratorio (familia → panel/estudio → analitos) con `overrides` por prueba, evitando duplicación completa (FND-20260820-04).
5. Servicio `CalibrationResolver` (backend) como única fuente de resolución runtime, consciente de `operationMode`.
6. Adaptador de lectura V1/V2 → V3 (sin migración física), con inferencia de `operationMode` sólo cuando es segura.
7. Persistencia de versión publicada inmutable (JSON en `MedicalTest.options.aiCalibration.publishedVersions[]`).
8. Congelación de snapshot histórico (`calibration_version_id` + `presentation_schema` + hashes).
9. Editor real de `presentation.schema` en `PresentationSchemaPanel` (solo para modos con IA).
10. Paridad de renderer en modo de prueba (Calibración usa `ClinicalExtractionRenderer`).
11. Reemplazo de `REQUIRED_PARAMS`, `CONFIDENCE_THRESHOLDS`, `PREDIAGNOSIS_SUPPORTED_TYPES`, `PREDIAGNOSTIC_PROMPTS` por `clinicalCriteria` del contrato publicado (solo `clinical_interpretation`).
12. Routing XML/pipeline primario por `canonicalStudyType` publicado.
13. Gate real `enabled` + gates por capa.
14. Trazabilidad de fallback hardcodeado con `source="legacy_hardcoded"`.
15. Migración implícita de calibraciones V1/V2 existentes (con inferencia de modo segura).

### 3.2 No incluye
1. Eliminar los hardcodeos de `prediagnostic.py` y `extraction-presentation-schemas.ts` en fases tempranas (queda para fase final).
2. Tabla Prisma dedicada para versiones (se evalúa en ADR futuro si el volumen lo justifica).
3. Editor visual de prompts con diff/history (la publicación inmutable basta para esta SPEC).
4. Cambios al flujo clínico de la papeleta, dictamen, aptitud ni descargables.
5. Mezcla con `arch-20260819-02-tarjetas-muestra`.
6. Auth, secrets, ni producción.
7. **Editor de calibración IA para pruebas/servicios `manual_service`** (DEC-20260820-02): ambulancias, traslados, atención médica, urgencias, inyecciones, curaciones, suturas, lavados, vacunas y consultas simples no muestran editor de calibración IA; no se modela `aiCalibration` para ellos.
8. **Carga masiva/normalización del catálogo de ~174 estudios de laboratorio** (FND-20260820-04): la modelación familia → panel → analito es contrato; la ingesta de catálogo SME es trabajo funcional/operacional separado, no parte de esta SPEC.

## 4. Código observado y referencias de archivo/línea

### 4.1 Frontend Calibración (existente)
- `frontend/src/components/calibration/AICalibrationEditor.tsx` — editor V1/V2, debe ampliarse a V3.
- `frontend/src/components/calibration/CalibrationWorkspaceClient.tsx:500` — default `Audiometria` (H3), debe eliminarse.
- `frontend/src/components/calibration/CalibrationTestUpload.tsx` — subida de muestra, se reutiliza.
- `frontend/src/components/calibration/CalibrationTestResults.tsx` — vista JSON, pasa a toggle secundario.
- `frontend/src/components/calibration/PresentationSchemaPanel.tsx` — visor read-only, pasa a editor persistente.
- `frontend/src/actions/medical-profiles.ts:654-830` — `saveAICalibration` (V1, no versiona) y `saveAICalibrationV2` (solo versiona `fieldDefinitions`/`presentation.schema`). Deben unificarse en `saveAICalibrationV3` con publicación.
- `frontend/src/types/calibration.ts:116-156` — `AICalibrationV2`, base de V3.

### 4.2 Frontend Events (existente)
- `frontend/src/lib/study-ai.ts:50-136` — `getCanonicalAIStudyType` heurística hardcodeada (H2, H10), pasa a fallback explícito.
- `frontend/src/actions/event-test.actions.ts:14,623,881` — importa `getCanonicalAIStudyType`, debe priorizar `aiCalibration.canonicalStudyType` publicado.
- `frontend/src/actions/ai-prediagnosis.actions.ts` — sin gate `enabled`, debe respetarlo.
- `frontend/src/app/events/[id]/_lib/event-page-data.ts` — data loader de Events.
- `frontend/src/components/clinical/PapeletaWorkspace.tsx:186-216` — ya resuelve `presentation.schema` persistido, se mantiene; la novedad es que siempre llega el published.
- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx:486-494` — `resolvePresentationSchema` con fallback hardcodeado, se mantiene como fallback trazado.
- `frontend/src/components/clinical/extraction-presentation-schemas.ts` — hardcodeos, pasan a fallback.
- `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx` — panel de prediagnóstico de Events.

### 4.3 Backend (existente)
- `backend/app/api/v1/calibration.py` — endpoint de test de calibración.
- `backend/app/main.py`:
  - Líneas 944-982 — parseo de `ai_calibration_json` en `upload-and-analyze`.
  - Líneas 1258-1262 — llamada a `generate_prediagnosis` SIN `medical_calibration` (H11).
  - Líneas 1363-1387 — `_regenerate_prediagnosis` que sí acepta `medical_calibration` (muerto en caller principal).
  - Líneas 1543-1634 — endpoint XML Audiometría; usa `canonicalStudyType` del `ai_calibration` (backend), pero el routing frontend depende de la heurística (H10).
- `backend/app/services/ai/prediagnostic.py`:
  - Líneas 136-178 — `CONFIDENCE_THRESHOLDS`, `REQUIRED_PARAMS`, `PREDIAGNOSIS_SUPPORTED_TYPES` hardcodeados (H7).
  - Líneas 192-567 — `PREDIAGNOSTIC_PROMPTS` hardcodeados (H7).
  - Líneas 590-632 — `_build_calibration_context` que busca campos inexistentes en V2 (H11, canal muerto).
  - Líneas 634-660 — `generate_prediagnosis` no respeta `enabled` (H1).

### 4.4 Catálogo `MedicalTest` (existente, afectado por DEC-20260820-02)
- `frontend/prisma/schema.prisma:276-306` — modelo `MedicalTest`; `options Json @default("[]")` es donde viven `operationMode` y `aiCalibration`. Ya cuenta con campos LIS (`labMethodId`, `labSampleId`, `labProcessAreaId`, `analytes`, `labResults`) que respaldan la modelación familia → panel/estudio → analitos (FND-20260820-04).
- La UI de catálogo que lista/gestiona `MedicalTest` debe mostrar `operationMode` y habilitar sólo las capacidades de IA correspondientes (punto a confirmar con SOFIA para localizar el archivo exacto de catálogo admin; el contrato es el que gobierna aquí, no la ruta).
- El adaptador del resolver (§7.3) debe leer `MedicalTest.options.operationMode` antes de intentar resolver `aiCalibration`; si es `manual_service`, devuelve `None` sin tocar el JSON de calibración.

## 5. Contrato `aiCalibration` V3 propuesto (completo)

Este contrato vive en `MedicalTest.options.aiCalibration` (JSON). Se documenta como contrato técnico; su implementación física es un type TypeScript + schema Pydantic equivalente. **No es código de producción**: es la especificación del contrato que SOFIA implementará.

### 5.0 `operationMode` en `MedicalTest.options` (DEC-20260820-02)

El campo `operationMode` es una propiedad del **catálogo** (`MedicalTest.options`), no de una versión de calibración. Determina si existe bloque `aiCalibration` y qué capacidades aplica el resolver:

```jsonc
// MedicalTest.options
{
  "operationMode": "manual_service" | "document_extraction" | "clinical_interpretation",
  "aiCalibration": { /* solo si operationMode != manual_service; ver §5.1 */ }
}
```

| `operationMode` | Bloque `aiCalibration` | Capacidades habilitadas | Editor de calibración IA |
|---|---|---|---|
| `manual_service` | **No existe** | Ninguna (captura operativa/manual) | **No se muestra** |
| `document_extraction` | Sí (V3, sin `clinicalCriteria`) | Extracción configurable (campos, aliases, unidades, tablas) + presentación | Sí, **básico** (sin sección de criterios clínicos/prediagnóstico) |
| `clinical_interpretation` | Sí (V3 completo) | Extracción + criterios/fórmulas/umbrales + prediagnóstico + presentación | Sí, **completo** |

Catálogo de modos confirmado por Frank (DEC-20260820-02):
- `manual_service`: ambulancias, traslados, atención médica, urgencias, inyecciones, curaciones, suturas, lavados, vacunas y consultas simples.
- `document_extraction`: laboratorios/documentos/imágenes que requieren extracción configurable (campos, aliases, unidades, tablas y presentación).
- `clinical_interpretation`: Examen Médico, Audiometría, Espirometría, ECG y pruebas que requieran criterios, fórmulas, umbrales, prediagnóstico, recomendaciones o dictamen.

### 5.1 Estructura raíz (`aiCalibration`, sólo si `operationMode != manual_service`)

```jsonc
{
  "schemaVersion": "V3",
  "currentPublishedVersionId": "cal-v3-uuid-...",   // ID de la versión published vigente; null si nunca publicada
  "familyTemplateId": "lab-hematologia-family",     // ver §5.6; null para pruebas sin familia (Audiometría, ECG, etc.)
  "draft": { /* AICalibrationVersionDraft — edición en curso */ },
  "publishedVersions": [
    /* AICalibrationVersion[] — solo published/superseded, inmutables */
  ],
  "legacyV1V2Snapshot": { /* copia del último estado V1/V2 al migrar, solo auditoría */ }
}
```

### 5.2 Versión publicada (`AICalibrationVersion`, inmutable)

> **Condicionalidad por modo (DEC-20260820-02):** los bloques `extraction`, `fieldDefinitions` y `presentation` aplican a `document_extraction` y `clinical_interpretation`. El bloque `clinicalCriteria` aplica **solo** a `clinical_interpretation`. Para `document_extraction`, `clinicalCriteria` es `null`/ausente (no hay prediagnóstico). El `operationMode` no se duplica en la versión (vive en `MedicalTest.options`); el resolver lo lee del catálogo al resolver.

```jsonc
{
  "versionId": "cal-v3-uuid-...",          // UUID único, inmutable
  "versionNumber": 3,                       // entero monótono por MedicalTest
  "label": "calib-v3",                      // etiqueta legible
  "status": "published",                    // "published" | "superseded" | "disabled"
  "publishedAt": "2026-08-20T16:11:37-06:00",
  "publishedBy": "userId-...",
  "supersededAt": null,                     // timestamp cuando fue reemplazada
  "supersededByVersionId": null,
  "enabled": true,                          // gate global por prueba (H1)
  "canonicalStudyType": "Audiometria",      // gate routing (H2, H3, H10)

  "extraction": {
    "enabled": true,                        // gate de capa
    "prompt": "...",                        // obligation: no vacío si extraction.enabled=true
    "promptHash": "sha256:...",             // hash para auditoría sin duplicar texto
    "version": "extract-v2",
    "schemaVersion": "extract-v2",
    "targetFields": ["..."],
    "provider": "gemini",                   // heredado de ARCH-20260809-02
    "model": "gemini-2.5-flash"             // heredado de ARCH-20260809-02
  },

  "fieldDefinitions": [
    /* FieldDefinition[] — heredado de V2, ahora contrato runtime (H4)
       Para document_extraction y clinical_interpretation.
       { "key": "oido_derecho", "label": "Oído Derecho", "type": "object",
         "aliases": ["od","right"], "required": true,
         "unit": null, "referenceRange": null }   // unit/referenceRange: útiles para analitos de laboratorio (FND-20260820-04) */
  ],

  "clinicalCriteria": {                      // SOLO clinical_interpretation; null/ausente en document_extraction
    "prediagnosisEnabled": true,            // reemplaza PREDIAGNOSIS_SUPPORTED_TYPES (H7)
    "requiredParams": ["oido_derecho","oido_izquierdo"],  // reemplaza REQUIRED_PARAMS (H7)
    "confidenceThreshold": 0.55,            // reemplaza CONFIDENCE_THRESHOLDS (H7)
    "prompt": "...",                        // reemplaza PREDIAGNOSTIC_PROMPTS[type] (H7)
    "promptHash": "sha256:...",
    "promptVersion": "predx-audiometria-v3",
    "supportingReferences": [               // reemplaza citations hardcodeadas en el prompt
      { "source_id": "NOM-011-STPS-2001", "title": "...", "section": "...",
        "excerpt": "...", "version_or_date": "2001" }
    ]
  },

  "presentation": {
    "enabled": true,                        // gate de capa (H5)
    "schema": { /* StudyPresentationSchema — heredado de ARCH-20260604-01 */ },
    "schemaHash": "sha256:..."
  }
}
```

### 5.3 Draft (`AICalibrationVersionDraft`)

Misma estructura que `AICalibrationVersion` pero con:
- `status: "draft"` o `"tested"`.
- Sin `versionId` asignado (se asigna al publicar).
- `publishedAt`/`publishedBy` nulos.
- Es mutable: cada save del editor actualiza el draft.

### 5.4 Reglas de inmutabilidad
- Una vez `published`, ningún campo de la versión puede modificarse.
- `superseded` es solo una transición de estado (no reescritura).
- `disabled` es una transición reversible (puede volver a `published` solo si no fue superseded).
- `draft` y `tested` son mutables.

### 5.5 Hashes
Los campos `*Hash` son `sha256:` del JSON canónico del campo correspondiente. Sirven para auditoría y para detectar cambios sin almacenar texto duplicado en snapshots.

### 5.6 Herencia por `familyTemplate` + `overrides` (FND-20260820-04)

Laboratorio se modela como **familia → panel/estudio → analitos**, no como 174 calibraciones manuales independientes. Una entrada `MedicalTest` con `familyTemplateId != null` hereda la plantilla de familia y aplica `overrides` sólo donde difiere.

**Plantilla de familia (`FamilyTemplate`, registry compartido):**
```jsonc
{
  "templateId": "lab-hematologia-family",   // referenciado por aiCalibration.familyTemplateId
  "label": "Hematología (familia)",
  "operationMode": "document_extraction",   // la familia fija el modo de sus miembros
  "defaults": {
    // AICalibrationVersion parcial: extraction, presentation.schema, fieldDefinitions base
    // para todos los estudios de la familia. clinicalCriteria = null salvo familia interpretable.
    "extraction": { /* prompt de familia, provider, etc. */ },
    "presentation": { /* schema de presentación tabular de familia */ },
    "fieldDefinitions": [ /* analitos comunes de la familia: hemoglobina, hematocrito, etc. */ ]
  }
}
```

**Override por prueba (en `aiCalibration` de cada `MedicalTest`):**
```jsonc
// MedicalTest.options.aiCalibration (miembro de familia)
{
  "schemaVersion": "V3",
  "familyTemplateId": "lab-hematologia-family",
  "overrides": {
    // sólo los campos que difieren de la plantilla; ausente = hereda
    "fieldDefinitions": [ /* analitos específicos de ESTE estudio que no están en la familia,
                              o que cambian unit/referenceRange */ ],
    "extraction": { "prompt": "..." }      // override de prompt si este estudio lo necesita
    // clinicalCriteria: null (modo document_extraction) salvo override explícito
  },
  "draft": { /* ... */ },
  "publishedVersions": [ /* ... */ ]
}
```

**Reglas de resolución de herencia:**
1. El resolver resuelve la versión publicada del `MedicalTest` y, si `familyTemplateId != null`, **fusiona** `FamilyTemplate.defaults` con `overrides` (override gana).
2. Un `override` puede añadir/reemplazar `fieldDefinitions` por analito, pero **no eliminar** los requeridos por la plantilla (validación en publicación).
3. La `familyTemplate` fija el `operationMode` de sus miembros; un miembro no puede declarar un `operationMode` distinto al de su familia (gate de coherencia, §8).
4. Las pruebas sin familia (`familyTemplateId == null`: Audiometría, ECG, Examen Médico, etc.) definen su contrato completo en `aiCalibration` directamente.
5. El snapshot histórico congela la versión **efectiva ya fusionada** (template+override resuelto), no referencias a la plantilla, para que un cambio posterior en la plantilla no re-renderice históricos (consistente con §10).

> **Pendiente (P-04/P-05, §21):** el catálogo de `FamilyTemplate`s (qué familias, qué analitos base, qué schemas tabulares) y la asignación de `familyTemplateId`/`operationMode` a cada `MedicalTest` existente son decisiones funcionales/operacionales que ATLAS/Frank deben confirmar. Esta SPEC define el contrato y la mecánica de herencia; no define el contenido del catálogo de plantillas.

## 6. Estados y workflow

### 6.1 Máquina de estados por versión

```
draft ──(save test results)──→ tested ──(publish gate §8)──→ published
                                                              │
                                                  publish v+1 │
                                                              ↓
                                                           superseded
                                                              │
                                                  manual disable │
                                                              ↓
                                                           disabled (reversible)
```

- `draft → tested`: el admin ejecuta una prueba E2E en el módulo Calibración con el draft actual; el resultado se asocia al draft.
- `tested → published`: el admin pulsa "Publicar"; el sistema valida gates §8; si pasa, el draft se **copia** a una nueva `AICalibrationVersion` inmutable con `status=published`; la `published` anterior pasa a `superseded` atómicamente.
- `published → superseded`: ocurre solo al publicar una nueva versión. Automático, atómico.
- `published → disabled`: el admin desactiva manualmente. Reversible (vuelve a `published`).
- `disabled → superseded` solo si se publica una nueva versión mientras estaba disabled.

### 6.2 Reglas de coexistencia
- **Solo una** versión `published` (o `disabled`) vigente por `MedicalTest` a la vez.
- Cualquier número de `superseded` conservadas (sujeto a política de retención, §11).
- Exactamente un `draft` por `MedicalTest` (puede ser nulo si no hay edición en curso).
- Un `tested` se promueve a `published` y deja de existir como tal (el draft se limpia o se reinicia).

## 7. Resolución runtime única (`CalibrationResolver`)

### 7.1 Contrato del resolver (backend)

El resolver es un servicio Python (análogo a `key_resolver` existente) que expone:

```
resolve(test_id: str, desired_state: "published" | "tested" | "draft")
    -> Optional[AICalibrationVersionResolved]
```

`AICalibrationVersionResolved` contiene los campos efectivos (no el JSON crudo): `operationMode`, `enabled`, `canonicalStudyType`, `extraction`, `fieldDefinitions`, `clinicalCriteria` (puede ser `None` si `operationMode != clinical_interpretation`), `presentation`, `versionId`, `versionNumber`, `familyTemplateId` (si aplica, ya fusionado con overrides).

### 7.2 Comportamiento
- **Paso previo (DEC-20260820-02):** el resolver lee `MedicalTest.options.operationMode` antes de tocar `aiCalibration`:
  - Si `operationMode == "manual_service"` (o está ausente y no se infiere con seguridad, ver §11): devuelve `None` inmediatamente. Events no dispara IA; el catálogo no muestra editor de calibración.
  - Si `operationMode == "document_extraction"`: devuelve la versión resuelta pero con `clinicalCriteria = None` (no hay prediagnóstico).
  - Si `operationMode == "clinical_interpretation"`: devuelve la versión completa con `clinicalCriteria`.
- `desired_state="published"`: devuelve la versión `published` vigente; si está `disabled`, devuelve la versión con `enabled=false`; si no hay ninguna publicada, devuelve `None`.
- `desired_state="tested"`: devuelve el draft marcado como `tested` (para preview de publicación inminente).
- `desired_state="draft"`: devuelve el draft actual (para preview de edición en curso).
- **Fusión de familia (§5.6):** si `familyTemplateId != null`, el resolver resuelve la `FamilyTemplate` del registry, fusiona `defaults` con `overrides` de la versión, y devuelve el resultado efectivo fusionado.

### 7.3 Adaptador V1/V2 → V3
Cuando el resolver recibe un `MedicalTest.options.aiCalibration` sin `schemaVersion="V3"`:
1. **Primero infiere `operationMode`** según §11.3 (conservador; nunca `Audiometria` por defecto). Si es `manual_service`, devuelve `None` sin normalizar.
2. Lo normaliza a una `AICalibrationVersion` sintética con `status=published` (preserva el comportamiento actual).
3. Mapea campos según §11.3 del ADR/SPEC; `clinicalCriteria` sólo se sintetiza si el modo inferido es `clinical_interpretation` (con defaults = valores hardcodeados actuales de `prediagnostic.py`); si es `document_extraction`, `clinicalCriteria=null`.
4. Cachea la normalización en memoria (TTL corto) para no recalcular por request.

### 7.4 Único consumidor autorizado
**Todos** los servicios backend y frontend que necesiten datos de calibración deben pasar por el resolver. Queda prohibido leer `MedicalTest.options.aiCalibration` directamente fuera del resolver.

## 8. Reglas de publicación (gates)

Antes de transicionar `tested → published`, el sistema valida:

| Gate | Condición | Falla si |
|---|---|---|
| G0 | `MedicalTest.options.operationMode` está definido y es válido (`manual_service` \| `document_extraction` \| `clinical_interpretation`) | `PUBLISH_INVALID_OPERATION_MODE` |
| G0b | `operationMode != manual_service` (no se publica calibración para servicios manuales) | `PUBLISH_MANUAL_SERVICE_NO_CALIBRATION` |
| G1 | `canonicalStudyType` ∈ valores canónicos válidos (`Audiometria`, `Espirometria`, etc.) — **omitible** para `document_extraction` sin routing XML | `PUBLISH_INVALID_CANONICAL_TYPE` |
| G2 | `extraction.enabled=true` → `extraction.prompt` no vacío | `PUBLISH_EXTRACTION_PROMPT_EMPTY` |
| G3 | `operationMode=clinical_interpretation` Y `clinicalCriteria.prediagnosisEnabled=true` → `clinicalCriteria.prompt` no vacío. **No aplica** a `document_extraction` (clinicalCriteria ausente) | `PUBLISH_CLINICAL_PROMPT_EMPTY` |
| G4 | `presentation.enabled=true` → `presentation.schema` tiene ≥1 sección válida | `PUBLISH_PRESENTATION_SCHEMA_EMPTY` |
| G5 | Existe al menos un resultado de prueba E2E asociado al draft `tested` | `PUBLISH_MISSING_E2E_TEST` |
| G6 | No existe colisión de `versionId` con versiones previas | `PUBLISH_VERSION_ID_COLLISION` |
| G7 | `fieldDefinitions` (si `extraction.enabled=true`) define todos los `requiredParams` declarados en `clinicalCriteria.requiredParams` — sólo si `clinicalCriteria != null` | `PUBLISH_REQUIRED_PARAMS_NOT_DEFINED` |
| G8 | Si `familyTemplateId != null`: el `operationMode` del `MedicalTest` coincide con el `operationMode` de la `FamilyTemplate` (coherencia de familia) | `PUBLISH_FAMILY_MODE_MISMATCH` |
| G9 | Si `familyTemplateId != null`: los `overrides.fieldDefinitions` no eliminan analitos marcados `required` por la plantilla de familia | `PUBLISH_FAMILY_OVERRIDE_REMOVES_REQUIRED` |

Si cualquier gate falla, la transición se rechaza con el código indicado y el draft permanece `tested`.

## 9. Resolución runtime única utilizada por Calibración y Events

### 9.1 Events (consume `published`)
- `event-test.actions.ts` (frontend): antes de llamar a `getCanonicalAIStudyType` (heurística), consulta el resolver vía un server action `getPublishedCalibrationForEventTest(eventTestId)` y usa `canonicalStudyType` publicado. Si el resolver devuelve `None` o `enabled=false`, cae al fallback heurístico **marcado** con `source="legacy_heuristic"`.
- `upload-and-analyze` (backend, `main.py`): en lugar de recibir `ai_calibration_json` por el form, lo resuelve el resolver en backend vía `test_id` del EventTest. El parámetro `ai_calibration_json` del form queda deprecado pero se acepta por compat (con warning).
- `generate_prediagnosis` (`prediagnostic.py`): recibe `calibration_version` resuelta (no `ai_calibration` ni `medical_calibration` separados). Lee `enabled`, `clinicalCriteria.prompt`, `requiredParams`, `confidenceThreshold`, `prediagnosisEnabled` desde ahí. Si `enabled=false` o `prediagnosisEnabled=false` → retorna `AI_NON_CONCLUSIVE` con `reason="calibration_disabled"` sin llamar a DR7.

### 9.2 Calibración (consume `draft` o `tested`)
- `CalibrationWorkspaceClient`: el `testType` del modo de prueba se obtiene del `draft.canonicalStudyType` (no default `Audiometria`). Si el draft no tiene `canonicalStudyType`, se muestra un selector vacío con placeholder (no se asume).
- **Gate de editor por modo (DEC-20260820-02):** si `MedicalTest.operationMode=manual_service`, el módulo Calibración **no muestra editor de IA** (la entrada aparece como servicio manual sin calibración). El editor V3 muestra sólo las secciones correspondientes al `operationMode` (`clinicalCriteria` oculto para `document_extraction`).
- `CalibrationTestUpload`: sube muestra, el backend usa el `draft` para la corrida (no la `published`), de modo que el admin vea exactamente lo que se vería en Events al publicar.
- `CalibrationTestResults`: vista primaria = `ClinicalExtractionRenderer` + `StudyAIPrediagnosisPanel` (los mismos componentes de Events); el JSON debug pasa a toggle secundario.

## 10. Estrategia de snapshot/versionado histórico

### 10.1 Campos a congelar en `StudyExtractionSnapshot` y `AIPrediagnosisSnapshot`
Para cada corrida nueva (post-implementación):
- `calibration_version_id`: el `versionId` de la versión publicada usada.
- `calibration_version_number`: entero monótono para legibilidad.
- `presentation_schema_snapshot`: copia inmutable del `StudyPresentationSchema` usado (para que históricos no se re-rendericen con calibración actual).
- `extraction_prompt_hash`, `clinical_prompt_hash`, `clinical_criteria_hash`: hashes de los campos usados (verifica reproducibilidad sin duplicar texto).

### 10.2 Reglas
- Al renderizar un snapshot histórico, Events usa `presentation_schema_snapshot` (no consulta el resolver).
- Al regenerar un prediagnóstico desde un snapshot, el backend **debe** usar la versión congelada si existe; solo si no existe (snapshot pre-V3) cae al resolver con `published` actual + warning en `audit.calibration_version_mismatch=true`.
- Los snapshots pre-V3 existentes se marcan con `calibration_version_id=null` y se renderizan con el resolver actual + el flag de mismatch (aceptable: no podemos reconstruir histórico perdido).

### 10.3 Reproducibilidad
Cualquier snapshot post-V3 debe poder re-renderizarse idéntico sin importar cambios en Calibración. Esto satisface FND-20260820-03 regla 3.

## 11. Plan de migración compatible con V1/V2 existentes

### 11.1 Sin script de migración
- No se ejecuta ningún script que reescriba `MedicalTest.options.aiCalibration` ni `MedicalTest.options.operationMode`.
- El adaptador del resolver normaliza V1/V2 → V3 en lectura (§7.3) e **infiere `operationMode` en lectura** según §11.3.
- Las calibraciones V1/V2 existentes siguen siendo legibles como `published` sintéticas hasta que el admin las "re-publica" materialmente como V3.

### 11.2 Re-publicación incremental
- El admin abre cada `MedicalTest` con calibración V1/V2 en el editor V3.
- El editor precarga el draft desde el adaptador (V1/V2 → draft V3).
- El admin revisa, confirma `operationMode`, completa `clinicalCriteria` (que V1/V2 no tenía, si el modo lo requiere) y publica.
- Al publicar, el `legacyV1V2Snapshot` queda congelado en la raíz para auditoría.

### 11.3 Inferencia de `operationMode` y defaults del adaptador (preserva comportamiento)

**Regla de inferencia de modo (DEC-20260820-02):** cuando un `MedicalTest` V1/V2 no tiene `operationMode` explícito, el adaptador infiere en lectura **sólo cuando es seguro**; en caso contrario, cae a `manual_service` o marca `requires_review`, **nunca** a `Audiometria` por defecto.

| Condición observada en V1/V2 | `operationMode` inferido | Justificación |
|---|---|---|
| Tiene `aiCalibration` con `canonicalStudyType ∈ {Audiometria, Espirometria, ECG, ExamenMedico}` Y `PREDIAGNOSIS_SUPPORTED_TYPES` lo cubre | `clinical_interpretation` | Seguro: ya opera como interpretación clínica |
| Tiene `aiCalibration` con extracción pero sin `canonicalStudyType` clínico Y no está en `PREDIAGNOSIS_SUPPORTED_TYPES` | `document_extraction` | Seguro: extracción sin prediagnóstico |
| No tiene `aiCalibration` Y categoría/nombre sugiere servicio manual (ambulancia, consulta, vacuna, curación, sutura, traslado, urgencia) | `manual_service` | Seguro: no aplica IA |
| No tiene `aiCalibration` Y **no** se puede inferir con seguridad | `manual_service` + flag `requires_review=true` | Seguro por defecto: no aplica IA hasta revisión; **jamás** `Audiometria` |

> **Anti-patrón prohibido (H3 + DEC-20260820-02):** inferir `clinical_interpretation`/`Audiometria` para una prueba sin evidencia. El default silencioso a `Audiometria` que existe hoy (`CalibrationWorkspaceClient.tsx:500`) se elimina; el adaptador no lo replica.

**Defaults del adaptador por campo V3** (preserva comportamiento actual de las pruebas ya calibradas):

| Campo V3 | Default desde V1/V2 |
|---|---|
| `operationMode` | inferido según tabla anterior |
| `enabled` | `aiCalibration.enabled ?? true` |
| `canonicalStudyType` | `aiCalibration.canonicalStudyType` (si V1/V2 lo tenía); si no, `null` (no se asume) |
| `extraction.*` | directo desde V1/V2 |
| `fieldDefinitions` | directo desde V2 (vacío si V1) |
| `clinicalCriteria.requiredParams` | `REQUIRED_PARAMS[study_type]` de `prediagnostic.py` (sólo si modo inferido = `clinical_interpretation`; si no, `null`) |
| `clinicalCriteria.confidenceThreshold` | `CONFIDENCE_THRESHOLDS[study_type]` de `prediagnostic.py` (sólo si `clinical_interpretation`) |
| `clinicalCriteria.prediagnosisEnabled` | `study_type ∈ PREDIAGNOSIS_SUPPORTED_TYPES` (sólo si `clinical_interpretation`) |
| `clinicalCriteria.prompt` | `PREDIAGNOSTIC_PROMPTS[study_type]` de `prediagnostic.py` (sólo si `clinical_interpretation`) |
| `presentation.schema` | directo desde V2 (vacío si V1) |
| `familyTemplateId` | `null` (la migración V1/V2 no asigna familia; eso es decisión funcional/operacional) |

## 12. Estrategia para remover/degradar hardcodeos sin big-bang

### 12.1 Fallbacks explícitos y trazados
Los hardcodeos de `prediagnostic.py` y `extraction-presentation-schemas.ts` se transforman en **fallbacks** activos solo cuando el resolver no devuelve contrato publicado. Cada uso del fallback registra en `extraction_snapshot.audit` o `prediagnosis.audit`:
- `calibration_source: "legacy_hardcoded"` (reemplaza el ambiguo `"general_fallback"` actual).
- `legacy_hardcoded_reason`: uno de `no_published_version`, `published_disabled`, `field_definitions_incomplete`.

### 12.2 Eliminación progresiva
- **Fase 1:** fallbacks activos para todas las pruebas (comportamiento actual preservado) + clasificador `operationMode` + resolver consciente del modo.
- **Fase 2:** conforme cada prueba tenga V3 publicada, el fallback se vuelve inalcanzable para esa prueba (el resolver devuelve la versión).
- **Fase 3 (objetivo final):** cuando **todas las pruebas `clinical_interpretation` + `document_extraction`** del catálogo tengan V3 publicada Y el clasificador `operationMode` esté asignado a la totalidad del catálogo, los hardcodeos se eliminan del código. Hasta entonces permanecen como código muerto trazable.
- **Corte de soporte:** depende de decisión de Frank (ADR §7.3).

### 12.3 Anti-patrones prohibidos
- Eliminar un hardcodeo antes de que todas las pruebas relevantes tengan V3 publicada → regresión silenciosa.
- Convertir un hardcodeo en "default implícito" sin trazabilidad → violación de BR-20260820-01 excepción 2.
- Eliminar hardcodeos antes de que el clasificador `operationMode` clasifique el catálogo completo → una prueba `manual_service` podría caer a un fallback clínico indebido (DEC-20260820-02).
- Asumir `Audiometria`/`clinical_interpretation` para una prueba no clasificada → violación explícita de DEC-20260820-02 (no existe default silencioso a Audiometría).

## 13. Paridad de UI y pruebas contractuales/E2E

### 13.1 Paridad de componentes
- Calibración y Events usan el mismo `ClinicalExtractionRenderer`, el mismo `StudyAIPrediagnosisPanel` y el mismo `ClinicalExtractionRenderer` para presentation.schema.
- No se permite un renderer "de calibración" paralelo.

### 13.2 Pruebas contractuales
- **Contract test de paridad:** dado un mismo `extracted_data` + misma versión publicada, el render de Calibración (modo `tested`) y el render de Events (modo `published`) producen HTML estructuralmente idéntico (mismo árbol de secciones, mismos campos). Se valida con snapshot de Playwright.
- **Contract test de inmutabilidad:** publicar una versión, renderizar un EventTest, editar el draft, re-publicar una nueva versión, renderizar el histórico → el histórico no cambia.

### 13.3 E2E
- **E2E-PARITY-01:** en Calibración, subir muestra, validar extracción + prediagnóstico + presentación, publicar, ir a Events con un EventTest de la misma prueba y verificar que la salida es idéntica.
- **E2E-HISTORICAL-01:** generar un EventTest con versión V3 publicada, editar y re-publicar, abrir el histórico y verificar que conserva el render de la versión original.

## 14. Plan por fases (commits/archivos/criterios verificables + rollback)

Cada fase es independiente y commiteable por separado. **No se delega nada hasta que Frank apruebe la SPEC completa.** La delegación a SOFIA será fase por fase.

### Fase 1 — Clasificador `operationMode` + Resolver + adaptador V1/V2 (sin tocar Events)
- **Archivos esperados:** nuevo `backend/app/services/ai/calibration_resolver.py` (incluye lógica de inferencia de `operationMode` §11.3); ajustes en `backend/app/api/v1/calibration.py` para exponer `GET /api/v1/calibration/resolve?test_id=&state=published|tested|draft`; contrato `operationMode` en `MedicalTest.options` (leído, no migragado físicamente).
- **Criterios AC:**
  - AC-1.1: el resolver devuelve V3 sintética para un `MedicalTest` con calibración V1/V2 existente, sin escribir en DB.
  - AC-1.2: el resolver devuelve `None` para un `MedicalTest` sin `aiCalibration` Y `operationMode` inferido `manual_service`.
  - AC-1.3: el endpoint `GET /resolve` retorna el JSON V3 resuelto (con `operationMode` efectivo); no expone secretos.
  - AC-1.4: tests Pytest cubren: V1 → V3, V2 → V3, sin calibración, defaults de `clinicalCriteria` = valores hardcodeados actuales, **y la inferencia de `operationMode` de las 4 ramas de la tabla §11.3 (nunca `Audiometria` por defecto)**.
  - AC-1.5: el resolver devuelve `clinicalCriteria=null` para un `MedicalTest` con `operationMode=document_extraction`.
- **Validación:** `pytest backend/tests/test_calibration_resolver.py -v` pasa.
- **Rollback:** borrar el archivo nuevo + revertir el endpoint. Events sigue funcionando con el flujo actual (sin cambiar nada).

### Fase 2 — Contrato V3 + estados + publicación + editor condicional por `operationMode` (sin tocar Events)
- **Archivos esperados:** extensión de `frontend/src/types/calibration.ts` con tipos V3 (incluye `operationMode`, `familyTemplateId`, `overrides`); nuevo `frontend/src/actions/calibration-v3.actions.ts` con `saveAICalibrationV3` (draft/tested) y `publishAICalibrationV3` (gates G0-G9 §8); ajustes de `AICalibrationEditor` para editor V3 que muestra sólo las capacidades del `operationMode` (sin sección `clinicalCriteria` para `document_extraction`; sin editor para `manual_service`).
- **Criterios AC:**
  - AC-2.1: el editor V3 permite editar draft con todos los campos V3 correspondientes al `operationMode`.
  - AC-2.2: `publishAICalibrationV3` valida gates G0-G9; rechaza con código si falla (incluye `PUBLISH_INVALID_OPERATION_MODE`, `PUBLISH_FAMILY_MODE_MISMATCH`).
  - AC-2.3: al publicar, la versión anterior pasa a `superseded` atómicamente (transacción Prisma).
  - AC-2.4: `publishedVersions[]` conserva la nueva inmutable.
  - AC-2.5: `legacyV1V2Snapshot` queda congelado al primer publish desde V1/V2.
  - AC-2.6: el editor **no se muestra** para `MedicalTest` con `operationMode=manual_service`.
- **Validación:** `npm run typecheck` (0 errores); vitest cubre gates y publicación.
- **Rollback:** revertir el commit. El `saveAICalibration`/`saveAICalibrationV2` actuales siguen operativos.

### Fase 3 — Gate `enabled` + routing por canonicalStudyType (Events frontend)
- **Archivos esperados:** `frontend/src/actions/event-test.actions.ts` (priorizar `published.canonicalStudyType`); `frontend/src/lib/study-ai.ts` (heurística → fallback explícito con `source="legacy_heuristic"`); `frontend/src/actions/ai-prediagnosis.actions.ts` (respetar `enabled`).
- **Criterios AC:**
  - AC-3.1: un EventTest cuya prueba tiene `enabled=false` published no dispara IA; el snapshot queda con `calibration_source="calibration_disabled"`.
  - AC-3.2: un EventTest con `canonicalStudyType` published se enruta por ese valor, no por la heurística de nombre.
  - AC-3.3: si no hay published, cae a heurística con `source="legacy_heuristic"` trazado.
  - AC-3.4: `CalibrationWorkspaceClient.tsx:500` ya no asume `"Audiometria"`; usa el draft.
- **Validación:** E2E + vitest; verificar trazabilidad en `extraction_snapshot.audit`.
- **Rollback:** revertir el commit; el comportamiento previo (heurística sin gate) se restaura.

### Fase 4 — `clinicalCriteria` reemplaza hardcodeos en backend
- **Archivos esperados:** `backend/app/services/ai/prediagnostic.py` (leer del resolver en vez de constantes de módulo); `backend/app/main.py` (pasar versión resuelta a `generate_prediagnosis`, eliminar canal `medical_calibration`).
- **Criterios AC:**
  - AC-4.1: `generate_prediagnosis` recibe `calibration_version` resuelta y lee `requiredParams`, `confidenceThreshold`, `prediagnosisEnabled`, `prompt` desde ahí.
  - AC-4.2: si el resolver devuelve `None`, los hardcodeos actuales siguen como fallback con `calibration_source="legacy_hardcoded"`.
  - AC-4.3: `main.py:1258` ya no pasa `medical_calibration` (canal muerto eliminado, H11).
  - AC-4.4: tests Pytest cubren: V3 resuelta, fallback, `enabled=false` no llama a DR7.
- **Validación:** `pytest backend/tests/test_ai_pipeline.py -v` pasa.
- **Rollback:** revertir el commit; las constantes de módulo hardcodeadas siguen como fuente primaria.

### Fase 5 — Snapshot versionado (congelación histórica)
- **Archivos esperados:** ajustes en schema/migración Prisma aditiva para `StudyExtractionSnapshot.calibrationVersionId`, `.calibrationVersionNumber`, `.presentationSchemaSnapshot`, `.extractionPromptHash`, `.clinicalPromptHash`, `.clinicalCriteriaHash` (todos nullable para preservar snapshots pre-V3); ajustes en `main.py` al persistir snapshots; ajustes en `PapeletaWorkspace`/`ClinicalExtractionRenderer` para usar el snapshot congelado al renderizar históricos.
- **Criterios AC:**
  - AC-5.1: una corrida nueva persiste `calibration_version_id` + `presentation_schema_snapshot`.
  - AC-5.2: un snapshot pre-V3 (con campos nulos) se renderiza con el resolver actual + flag `calibration_version_mismatch=true` en audit.
  - AC-5.3: tras re-publicar una nueva versión, un histórico post-V3 se renderiza idéntico (sin cambios).
- **Validación:** migración aplicada en staging (no prod sin permiso); E2E histórico.
- **Rollback:** la migración es aditiva (columnas nullable); revertir el código deja los campos como null, comportamiento actual preservado.

### Fase 6 — Paridad de UI en Calibración + editor de presentation.schema
- **Archivos esperados:** `CalibrationTestResults.tsx` (toggle JSON + renderer clínico primario); `PresentationSchemaPanel.tsx` (editor persistente, no visor); `CalibrationWorkspaceClient.tsx` (integrar renderer en modo prueba).
- **Criterios AC:**
  - AC-6.1: el modo de prueba renderiza `ClinicalExtractionRenderer` + `StudyAIPrediagnosisPanel` (no JSON solo).
  - AC-6.2: `PresentationSchemaPanel` persiste `presentation.schema` en el draft V3.
  - AC-6.3: contract test de paridad (§13.2) pasa.
- **Validación:** Playwright E2E-PARITY-01.
- **Rollback:** revertir el commit; el JSON viewer vuelve como primario.

### Fase 7 (final) — Eliminación de hardcodeos (solo si catálogo clasificado + V3 publicada)
- **Condición de entrada:** (a) todas las pruebas `clinical_interpretation` + `document_extraction` del catálogo tienen versión V3 `published` (no fallback); Y (b) el clasificador `operationMode` está asignado a la totalidad del catálogo (ninguna prueba queda sin clasificar o con `requires_review=true`).
- **Archivos esperados:** eliminación de `CONFIDENCE_THRESHOLDS`, `REQUIRED_PARAMS`, `PREDIAGNOSIS_SUPPORTED_TYPES`, `PREDIAGNOSTIC_PROMPTS` en `prediagnostic.py`; eliminación de los schemas hardcodeados en `extraction-presentation-schemas.ts` (o reducción a un solo fallback genérico para tipos desconocidos).
- **Criterios AC:**
  - AC-7.1: ninguna prueba activa del catálogo cae al fallback tras la eliminación.
  - AC-7.2: si aparece una prueba nueva sin `operationMode` o sin V3, el sistema muestra "requiere calibración / requiere clasificación" en vez de aplicar hardcoded silencioso (BR-20260820-01 excepción 1 + DEC-20260820-02).
  - AC-7.3: ninguna prueba `manual_service` dispara IA tras la eliminación.
- **Validación:** E2E full de todas las pruebas con IA + verificación de que pruebas `manual_service` no disparan IA.
- **Rollback:** restaurar los hardcodeos desde git.

## 15. Reglas e invariantes

1. **Una sola fuente:** el resolver es el único lector autorizado de `MedicalTest.options.aiCalibration`.
2. **Una sola published:** máximo una versión `published` (o `disabled`) por `MedicalTest`.
3. **Inmutabilidad post-publish:** ninguna versión `published`/`superseded` se modifica.
4. **Paridad por construcción:** Calibración y Events usan los mismos componentes de render.
5. **Trazabilidad de fallback:** todo fallback hardcodeado registra `source` en audit.
6. **No silent hardcoded:** ninguna prueba con IA puede operar con hardcoded silencioso; si no hay V3 published, el fallback es visible en trazabilidad.
7. **Snapshot histórico inmutable:** los históricos post-V3 no cambian al re-publicar.
8. **Gate `enabled` no-negociable:** `enabled=false` impide IA en Events.
9. **Routing primario por canonicalStudyType:** la heurística es fallback, no fuente.
10. **Clasificación operativa obligatoria (DEC-20260820-02):** todo `MedicalTest` tiene un `operationMode` (`manual_service`/`document_extraction`/`clinical_interpretation`); el modo determina qué capacidades de IA existen y si hay editor de calibración.
11. **No default silencioso a Audiometría:** una prueba sin `operationMode` confirmado/inferible NUNCA cae a `Audiometria` ni a `clinical_interpretation`; cae a `manual_service`+`requires_review`.
12. **Herencia de familia (FND-20260820-04):** laboratorio usa `familyTemplate`+`overrides`; el override no elimina analitos `required` de la plantilla; el snapshot congela la versión efectiva fusionada.

## 16. Casos borde y errores

- **CB-01:** `MedicalTest` sin `options.aiCalibration` → resolver devuelve `None`; Events cae a heurística trazada; prediagnóstico cae a `legacy_hardcoded` con `prediagnosisEnabled` default = `study_type ∈ PREDIAGNOSIS_SUPPORTED_TYPES`.
- **CB-02:** `MedicalTest` con `aiCalibration.enabled=false` (V1/V2) → adaptador sintetiza published con `enabled=false`; Events no dispara IA; snapshot con `calibration_source="calibration_disabled"`.
- **CB-03:** Draft con `canonicalStudyType` inválido al publicar → gate G1 rechaza con `PUBLISH_INVALID_CANONICAL_TYPE`.
- **CB-04:** Draft con `extraction.enabled=true` pero `extraction.prompt=""` → gate G2 rechaza.
- **CB-05:** Draft con `presentation.enabled=true` pero `schema.sections=[]` → gate G4 rechaza.
- **CB-06:** Publicar sin prueba E2E previa → gate G5 rechaza con `PUBLISH_MISSING_E2E_TEST`.
- **CB-07:** `clinicalCriteria.requiredParams` referencia una key no declarada en `fieldDefinitions` → gate G7 rechaza.
- **CB-08:** Snapshot pre-V3 (campos V3 nulos) → se renderiza con resolver actual + flag `calibration_version_mismatch=true`; no se rompe.
- **CB-09:** Re-publicar una versión previamente `disabled` → transición `disabled → published` permitida solo si no fue `superseded`.
- **CB-10:** Un `MedicalTest` se elimina del catálogo (legacy hidden) con versiones publicadas → las versiones quedan huérfanas pero legibles para snapshots históricos; no se eliminan.
- **CB-11:** El resolver no puede parsear el JSON V1/V2 corrupto → devuelve `None` + log de error; Events cae a heurística trazada.
- **CB-12:** Fallback de heurística de nombre produce un tipo no canónico (caso `Otro`) → el prediagnóstico V1 ya lo cubre (`PREDIAGNOSTIC_PROMPTS` no tiene `Otro`); en V3, el `clinicalCriteria` default del adaptador replica ese comportamiento.
- **CB-13:** `MedicalTest` con `operationMode=manual_service` → el resolver devuelve `None` sin leer `aiCalibration`; Events no dispara IA; el catálogo no muestra editor de calibración; no se asume ningún tipo canónico (DEC-20260820-02).
- **CB-14:** `MedicalTest` con `operationMode=document_extraction` → el resolver devuelve la versión con `clinicalCriteria=null`; el editor V3 muestra sección de extracción/presentación pero oculta la sección de criterios clínicos/prediagnóstico.
- **CB-15:** `MedicalTest` sin `operationMode` y sin calibración V1/V2 inferible → el adaptador infiere `manual_service` + `requires_review=true`; el resolver devuelve `None`; no se infiere `Audiometria` ni `clinical_interpretation` (H3 + DEC-20260820-02).
- **CB-16:** `MedicalTest` con `familyTemplateId` pero su `operationMode` difiere del `operationMode` de la `FamilyTemplate` → gate G8 rechaza la publicación con `PUBLISH_FAMILY_MODE_MISMATCH`.
- **CB-17:** Override de un miembro de familia elimina un analito marcado `required` por la plantilla → gate G9 rechaza con `PUBLISH_FAMILY_OVERRIDE_REMOVES_REQUIRED`.
- **CB-18:** Cambio posterior en una `FamilyTemplate` (añadir analito) → los snapshots históricos no se re-renderizan porque congelaron la versión efectiva fusionada (§5.6 regla 5 + §10).

## 17. Seguridad, privacidad y permisos

1. **No exposición de secretos:** el resolver y el endpoint `/resolve` no retornan API keys, prompts completos pueden exponerse (no son secretos), pero los hashes se usan para auditoría.
2. **Permisos de publicación:** sujetos a decisión de Frank (ADR §7.1). Por defecto INTEGRA propone `SUPERADMIN` para publicar (consistente con políticas destructivas), `ADMIN` para editar draft.
3. **Auditoría:** cada publicación genera `AuditLog` con `action="calibration_published"`, `entity="MedicalTest"`, `details.versionId`, `details.publishedBy`.
4. **Trazabilidad de fallback:** todo fallback hardcodeado es visible en `extraction_snapshot.audit` (no se oculta).
5. **Sin PII en snapshots de muestra:** el modo de prueba de Calibración no persiste datos de paciente; la muestra se descarta tras la corrida (patrón existente).

## 18. Migración y compatibilidad

- **V1/V2 legibles:** adaptador en lectura, sin migración física.
- **V1/V2 re-publicables:** el admin puede materializar V3 desde V1/V2 cuando quiera.
- **Snapshots pre-V3:** legibles, con flag de mismatch; no se rompen.
- **Backwards-compat del form `ai_calibration_json`:** se acepta con warning en `upload-and-analyze` (deprecado, el backend prefiere resolver vía `test_id`).
- **No se eliminan APIs existentes** (`saveAICalibration`, `saveAICalibrationV2`) en fases tempranas; se marcan deprecadas en JSDoc y se mantienen hasta fase 7.

## 19. Criterios de aceptación globales (verificables)

1. **CA-G01:** existe `calibration_resolver.py` con método `resolve(test_id, desired_state)` y tests que cubren V1→V3, V2→V3, sin-calibración.
2. **CA-G02:** el endpoint `GET /api/v1/calibration/resolve` retorna V3 resuelta sin secretos.
3. **CA-G03:** `saveAICalibrationV3` y `publishAICalibrationV3` existen con gates G0-G9; tests cubren cada rechazo.
4. **CA-G04:** al publicar, la versión anterior pasa a `superseded` atómicamente (transacción Prisma).
5. **CA-G05:** un EventTest con `enabled=false` published no dispara IA; snapshot con `calibration_source="calibration_disabled"`.
6. **CA-G06:** el routing XML/pipeline usa `canonicalStudyType` published cuando existe; heurística solo como fallback trazado.
7. **CA-G07:** `generate_prediagnosis` lee `clinicalCriteria` del resolver; los hardcodeos son fallback trazado.
8. **CA-G08:** el canal `medical_calibration` se elimina del flujo principal; `_build_calibration_context` se remueve o se unifica con el contrato V3.
9. **CA-G09:** snapshots post-V3 congelan `calibration_version_id` + `presentation_schema_snapshot` + hashes.
10. **CA-G10:** un histórico post-V3 no cambia al re-publicar una nueva versión (E2E-HISTORICAL-01).
11. **CA-G11:** el modo de prueba de Calibración renderiza `ClinicalExtractionRenderer` + `StudyAIPrediagnosisPanel` (paridad con Events).
12. **CA-G12:** `PresentationSchemaPanel` persiste `presentation.schema` en draft V3 (no read-only).
13. **CA-G13:** `CalibrationWorkspaceClient.tsx:500` ya no asume `"Audiometria"`.
14. **CA-G14:** contract test de paridad (§13.2) pasa.
15. **CA-G15:** `legacyV1V2Snapshot` queda congelado al primer publish desde V1/V2.
16. **CA-G16:** gates backend `pytest` pasan con tests nuevos.
17. **CA-G17:** gates frontend `typecheck` 0 errores, `vitest` verde, `lint` 0 errores nuevos.
18. **CA-G18:** el catálogo `MedicalTest` muestra `operationMode` por entrada y sólo habilita las capacidades de IA correspondientes; el editor de calibración no se muestra para `manual_service` (DEC-20260820-02).
19. **CA-G19:** el adaptador infiere `operationMode` según §11.3 sin asumir nunca `Audiometria` por defecto; tests cubren las 4 ramas (clínica, extracción, manual seguro, no-inferible→manual+review).
20. **CA-G20:** el resolver devuelve `clinicalCriteria=null` para `document_extraction` y completo para `clinical_interpretation`; `None` para `manual_service`.
21. **CA-G21:** la herencia `familyTemplate`+`overrides` se fusiona en el resolver; el snapshot congela la versión efectiva fusionada (no referencias a plantilla) (FND-20260820-04).

## 20. Validaciones detectadas y salida esperada

| Comando | Salida esperada |
|---|---|
| `pytest backend/tests/test_calibration_resolver.py -v` | Todos los tests pasan (Fase 1) |
| `pytest backend/tests/test_ai_pipeline.py -v` | Todos los tests pasan (Fase 4) |
| `npm run typecheck` | 0 errores |
| `npm test` (vitest) | Verde, con tests nuevos |
| `npm run lint` | 0 errores nuevos |
| Playwright E2E-PARITY-01 | Render de Calibración ≡ Events |
| Playwright E2E-HISTORICAL-01 | Histórico post-V3 no cambia tras re-publish |
| `GET /api/v1/calibration/resolve?test_id=X&state=published` | JSON V3 resuelto o `null` |

## 21. Riesgos y pendientes

1. **R-01:** Volumen de `publishedVersions[]` crece indefinidamente. Mitigado: política de retención (decisión Frank, ADR §7.2).
2. **R-02:** Un bug en el adaptador V1/V2 → V3 podría romper IA de pruebas no migradas. Mitigado: tests exhaustivos + defaults preservando comportamiento actual.
3. **R-03:** El editor V3 puede ser abrumador para el admin (mucho editable). Mitigado: progresividad por fases; el draft precargado desde V1/V2 ya tiene defaults sensatos; el editor condicional por `operationMode` reduce ruido (no muestra `clinicalCriteria` para `document_extraction`).
4. **R-04:** Conflictos de merge con `arch-20260819-02-tarjetas-muestra`. Mitigado: ramas independientes; no se mezclan.
5. **R-05:** Snapshot `presentation_schema_snapshot` duplica storage. Aceptable: costo clínico de reproducibilidad justifica.
6. **R-06:** Inferencia errónea de `operationMode` podría clasificar una prueba `clinical_interpretation` como `document_extraction` (pérdida de prediagnóstico) o viceversa. Mitigado: la inferencia sólo asigna `clinical_interpretation` cuando hay evidencia sólida (`canonicalStudyType` + `PREDIAGNOSIS_SUPPORTED_TYPES`); en duda, `manual_service`+`requires_review` (conservador, nunca `Audiometria`).
7. **R-07:** Una `FamilyTemplate` compartida por muchos estudios puede introducir regresión masiva si se edita mal. Mitigado: snapshots históricos congelan la versión efectiva fusionada (§5.6 regla 5); la edición de plantilla es operación sensible (requiere revisión, ADR §7).
8. **P-01 (pendiente):** definir rol de publicación (decisión Frank).
9. **P-02 (pendiente):** política de retención de versiones (decisión Frank).
10. **P-03 (pendiente):** corte de soporte V1/V2 (decisión Frank).
11. **P-04 (pendiente, funcional/ATLAS):** catálogo de `FamilyTemplate`s — qué familias de laboratorio existen, qué analitos base tiene cada una, qué schemas tabulares. Esta SPEC define el contrato y la mecánica de herencia; no define el contenido del catálogo de plantillas (FND-20260820-04).
12. **P-05 (pendiente, funcional/ATLAS):** asignación de `operationMode` y `familyTemplateId` a cada `MedicalTest` existente del catálogo (~130 entradas + ~174 estudios de lab). La inferencia del adaptador (§11.3) es transitoria; la clasificación definitiva requiere confirmación funcional.
13. **P-06 (pendiente):** modelo de datos del registry de `FamilyTemplate`s (¿tabla Prisma dedicada, JSON en config, o por familia en `TestCategory`?). Decisión técnica diferida a ADR futuro cuando P-04 defina contenido.

## 22. Definition of Done (DoD)

- Criterios CA-G01 a CA-G21 verificados con evidencia reproducible.
- Gates §20 aprobados.
- Self-review SOFIA + GEMINI como segunda mano de validación.
- `PROYECTO.md` con una sola representación de `ARCH-20260820-01`.
- Sin commits/push/PR sin OK explícito de Frank.
- Rama `arch-20260819-02-tarjetas-muestra` no mezclada.

## 23. Trazabilidad de SPEC a hipótesis forenses

| Hipótesis FIX-20260820-01 | Sección SPEC que la resuelve |
|---|---|
| H1 (enabled no respeta) | §5.2 `enabled` gate global + §9.1 + §15 regla 8 |
| H2 (canonicalStudyType ignorado) | §9.1 routing primario + §15 regla 9 |
| H3 (default Audiometria) | §5.0 `operationMode` + §9.2 + §11.3 + §15 regla 11 + CA-G13/CA-G19 (DEC-20260820-02: no existe default silencioso a Audiometría) |
| H4 (fieldDefinitions sin consumidor) | §5.2 `fieldDefinitions` runtime + §7 resolver |
| H5 (PresentationSchemaPanel read-only) | §9.2 + CA-G11 + CA-G12 |
| H6 (JSON vs renderer) | §9.2 + CA-G11 |
| H7 (hardcodeos backend) | §5.2 `clinicalCriteria` + §4.3 + §12 |
| H8 (versionado incompleto) | §5.1 + §6 estados + §8 gates |
| H9 (snapshot no congela) | §10 + CA-G09 + CA-G10 |
| H10 (XML routing por heurística) | §9.1 + CA-G06 |
| H11 (medical_calibration muerto) | §9.1 + §4.3 + CA-G08 |
