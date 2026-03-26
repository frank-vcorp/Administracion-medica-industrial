## SPEC: Prediagnóstico IA Estructurado por Estudio y Consolidado por Evento

**ID:** `ARCH-20260326-16`
**Estado:** `V1 lista para implementación por SOFIA`
**Padre:** `ARCH-20260325-05`, `ARCH-20260326-04`, `ARCH-20260326-06`
**Objetivo:** incorporar un sistema de extracción estructurada, prediagnóstico IA por estudio y consolidación multiestudio por evento, manteniendo al médico como autoridad diagnóstica final y dejando trazabilidad clínica auditable.

### Estado de esta versión
- Esta V1 incorpora revisión cruzada de Deby y GEMINI.
- Esta V1 ya no es solo una visión conceptual; fija alcance inicial, modelo de persistencia, estados clínicos, contratos mínimos y gates para implementación.
- La implementación inicial obligatoria será incremental y de bajo riesgo: primero prediagnóstico por estudio en modo sombra clínica; el consolidado multiestudio quedará detrás de guardrails y solo para estudios válidos del mismo evento.

### Problema a resolver
- Hoy el pipeline IA existente clasifica y extrae datos de documentos médicos, pero su salida no está integrada al expediente clínico operativo por estudio.
- El sistema necesita que cada estudio conserve sus parámetros extraídos de forma estructurada y reutilizable por humanos, reglas futuras, reportes y nuevas capas de IA.
- El usuario no quiere un resumen como salida principal; quiere parámetros atómicos persistidos.
- El prediagnóstico IA debe ser apoyo del médico, no reemplazo.
- La salida IA debe incluir justificación, bases clínicas, bibliografía y un mecanismo de evaluación comparativa contra el diagnóstico final del médico.

### Decisión arquitectónica
- La salida principal de IA será **estructura de datos por parámetro**, no texto libre.
- El resumen humano será una vista derivada del JSON estructurado.
- El prediagnóstico IA será una capa separada de interpretación, basada en los parámetros extraídos.
- El diagnóstico médico seguirá siendo la única salida clínica final con autoridad.
- El sistema debe almacenar tanto la confianza de la IA como la evaluación retrospectiva del médico sobre esa sugerencia.
- La mejora mensual del sistema debe ser supervisada y versionada; no habrá autoaprendizaje automático en producción.

### Alcance de implementación V1
- Sí entra en V1:
  - extracción estructurada por estudio con snapshot versionado
  - prediagnóstico IA por estudio con justificación, limitaciones y citas
  - revisión médica obligatoria por estudio
  - feedback comparativo IA vs médico
  - auditoría transaccional del flujo IA
  - separación estricta entre vista operativa interna y documento oficial firmado
- No entra en V1:
  - autoaprendizaje en producción
  - promoción automática de nuevas versiones de modelo o prompts
  - uso del prediagnóstico para cierre automático de expediente, dictamen o aptitud
  - consolidado multiestudio fuera del mismo evento clínico
  - consolidado multiestudio si existen estudios críticos no concluyentes o rechazados

### Principios no negociables

#### 1. Parámetros primero
- Todo estudio procesado por IA debe producir un conjunto de parámetros estructurados persistibles.
- Ningún prediagnóstico IA puede existir sin una base estructurada asociada.

#### 2. Separación de capas
- Deben persistirse por separado:
  - datos extraídos
  - interpretación IA
  - validación / diagnóstico médico
- La capa extractiva no puede contener diagnóstico clínico final ni recomendaciones de aptitud.
- Los prompts de extracción deberán limitarse a parámetros, calidad documental, fragmentos fuente y normalización.

#### 3. Modo sombra clínica
- El prediagnóstico IA no puede autopoblar aptitud, dictamen final, firma digital ni documentos oficiales.
- El médico debe aceptar, corregir o rechazar explícitamente la sugerencia.

#### 4. Evidencia verificable
- El prediagnóstico IA debe incluir:
  - justificación ligada a parámetros
  - bases clínicas aplicadas
  - bibliografía / citas controladas
- Las fuentes no deben quedar como texto inventado; deben poder versionarse y citarse.

#### 5. Trazabilidad y feedback
- Cada estudio debe registrar el resultado comparativo entre IA y médico para análisis posterior.

#### 6. Inmutabilidad clínica
- Ninguna nueva corrida de IA ni corrección humana debe sobrescribir evidencia previa.
- Toda regeneración debe crear una nueva versión inmutable.
- El sistema puede marcar una versión como vigente, pero el histórico debe conservarse completo.

### Estrategia de rollout
- Fase 1 obligatoria: prediagnóstico por estudio dentro de la Papeleta, separado del dictamen final.
- Fase 2 opcional: reglas determinísticas por tipo de estudio para endurecer interpretación en estudios medibles.
- Fase 3 posterior: consolidado multiestudio por evento, solo cuando existan métricas de operación real y guardrails validados.

### Modelo funcional esperado

#### A. Por cada estudio cargado en la Papeleta
Debe existir, en el mismo espacio del estudio:
1. Documento original o archivo cargado
2. Parámetros extraídos por IA
3. Vista humana de los parámetros
4. Prediagnóstico IA
5. Diagnóstico del médico
6. Estado de revisión/aprobación del médico

#### B. A nivel expediente / evento
Debe poder consolidarse la información de múltiples estudios para una sugerencia clínica conjunta de apoyo:
- no como dictamen final
- sí como prediagnóstico consolidado multiestudio
- solo para estudios del mismo evento
- solo si cumplen criterios de integridad y revisión definidos en esta SPEC

### Modelo de persistencia y versionado V1

#### Entidades mínimas obligatorias
1. `StudyExtractionSnapshot`
  - relación: muchas versiones por estudio
  - guarda extracción estructurada, calidad, fragmentos fuente y metadatos de corrida
2. `AIPrediagnosisSnapshot`
  - relación: muchas versiones por estudio
  - guarda interpretación IA basada en una versión concreta de extracción
3. `DoctorReview`
  - relación: muchas revisiones por estudio, pero una revisión vigente activa por versión de prediagnóstico
  - guarda aceptación, edición o rechazo del médico
4. `ClinicalEvidenceSet`
  - relación: una versión de evidencia asociada a cada prediagnóstico IA
  - guarda citas controladas y versión del corpus utilizado
5. `ConsolidatedPrediagnosisSnapshot`
  - relación: muchas versiones por evento
  - opcional en V1, pero el contrato debe quedar preparado desde ahora

#### Política de cardinalidad
- Un estudio puede tener múltiples extracciones versionadas.
- Un prediagnóstico IA debe apuntar exactamente a una extracción concreta.
- Una revisión médica debe apuntar exactamente a una versión concreta de prediagnóstico.
- Un consolidado por evento debe apuntar explícitamente a las versiones de estudio que consumió.

#### Política de inmutabilidad
- `StudyExtractionSnapshot`, `AIPrediagnosisSnapshot` y `ConsolidatedPrediagnosisSnapshot` son inmutables.
- Una nueva corrida crea una nueva versión; nunca actualiza el payload clínico previo in-place.
- El backend podrá mantener punteros o flags de “vigente” para facilitar lectura operativa.

#### Persistencia pragmática inicial
- SOFIA puede implementar V1 con tablas nuevas o con modelos versionados equivalentes en Prisma.
- No se permite resolver V1 acumulando blobs ambiguos en campos heredados sin relación explícita de versión.
- La migración debe dejar claro qué entidad representa extracción, cuál prediagnóstico y cuál revisión médica.

### Contrato lógico mínimo por estudio

#### 1. Extracción estructurada
Cada estudio debe guardar algo equivalente a:

```json
{
  "study_type": "laboratorio|audiometria|espirometria|rayos_x|otro",
  "source_file": {
    "name": "archivo.pdf",
    "uploaded_at": "2026-03-26T23:00:00Z"
  },
  "structured_parameters": [
    {
      "key": "glucosa",
      "label": "Glucosa",
      "value": 110,
      "raw_value": "110",
      "unit": "mg/dL",
      "reference_range": "70-100",
      "status": "high|low|normal|unknown",
      "confidence": 0.94,
      "source_fragment": "Glucosa 110 mg/dL",
      "page": 1,
      "normalized": true,
      "reviewed_by_human": false
    }
  ],
  "missing_fields": [],
  "quality_notes": []
}
```

#### Metadatos obligatorios de auditoría por extracción
Cada snapshot de extracción debe incluir además:

```json
{
  "audit": {
    "model_name": "gemini-2.x",
    "prompt_version": "extract-v1",
    "pipeline_version": "ai-pipeline-2026-03",
    "corpus_version": null,
    "source_file_hash": "sha256:...",
    "triggered_by_user_id": "user-id|system",
    "trigger_reason": "initial_upload|manual_regeneration",
    "pages_used": [1],
    "created_at": "2026-03-26T23:00:00Z"
  }
}
```

- La extracción no puede incluir `diagnostico_ia`, `interpretacion_clinica_final` ni campos equivalentes.
- Si el pipeline actual los genera, deberán moverse a la capa posterior de interpretación.

#### 2. Vista humana derivada
- El sistema debe renderizar una vista legible del JSON.
- Esta vista no sustituye al JSON; se deriva de él.

#### 3. Prediagnóstico IA
Debe guardar una estructura separada:

```json
{
  "summary": "Probable hipoacusia bilateral leve",
  "confidence": 0.81,
  "justification": [
    "Elevación de umbrales en 2000, 4000 y 6000 Hz en ambos oídos"
  ],
  "clinical_basis": [
    {
      "principle": "Interpretación de elevación de umbrales audiométricos",
      "applied_parameters": ["od_2000", "oi_2000"]
    }
  ],
  "citations": [
    {
      "source_id": "NOM-XXX",
      "title": "Norma o guía",
      "section": "Sección aplicable",
      "excerpt": "Texto breve de respaldo"
    }
  ],
  "limitations": [
    "Interpretación condicionada por calidad del documento"
  ],
  "red_flags": []
}
```

#### Metadatos obligatorios del prediagnóstico

```json
{
  "audit": {
    "model_name": "gemini-2.x",
    "prompt_version": "predx-v1",
    "corpus_version": "evidence-2026-03",
    "based_on_extraction_snapshot_id": "uuid",
    "triggered_by_user_id": "user-id|system",
    "created_at": "2026-03-26T23:10:00Z"
  }
}
```

- El lenguaje debe ser prudente: “compatible con”, “sugiere”, “requiere correlación clínica”, “no concluyente”.
- Queda prohibido redactar aptitud laboral o dictamen final desde esta capa.

#### 4. Revisión médica
Debe existir una capa específica de validación:

```json
{
  "doctor_status": "PENDING|REVIEWED_ACCEPTED|REVIEWED_EDITED|REVIEWED_REJECTED",
  "doctor_diagnosis": "",
  "doctor_notes": "",
  "reviewed_by": "user-id",
  "reviewed_at": "2026-03-26T23:30:00Z"
}
```

#### Estados formales obligatorios
- `DRAFT_EXTRACTED`
- `AI_PENDING_REVIEW`
- `AI_NON_CONCLUSIVE`
- `REVIEWED_ACCEPTED`
- `REVIEWED_EDITED`
- `REVIEWED_REJECTED`
- `SUPERSEDED`

- `AI_NON_CONCLUSIVE` aplica cuando faltan parámetros clave, el documento es ilegible o la confianza cae bajo umbral.
- `SUPERSEDED` aplica cuando existe una versión posterior vigente.

#### 5. Feedback comparativo IA vs médico
Debe persistirse para aprendizaje supervisado posterior:

```json
{
  "ai_confidence": 0.81,
  "doctor_agreement_score": 87,
  "doctor_usefulness_score": 92,
  "difference_type": "same_conclusion|same_line_with_edits|different_conclusion|ai_non_conclusive",
  "doctor_feedback_note": "La IA detectó el patrón general, pero faltó especificidad clínica"
}
```

#### Taxonomía mínima obligatoria de feedback
- `doctor_agreement_score`: escala 0-100, donde 0 es nula concordancia y 100 es concordancia total.
- `doctor_usefulness_score`: escala 0-100, donde 0 es inútil y 100 es altamente útil para acelerar la revisión.
- `difference_type` permitido:
  - `same_conclusion`
  - `same_line_with_edits`
  - `different_conclusion`
  - `ai_non_conclusive`
- `error_severity` obligatorio:
  - `none`
  - `low`
  - `medium`
  - `high`
- `error_category` obligatorio:
  - `omission`
  - `wrong_interpretation`
  - `unsupported_claim`
  - `low_document_quality`
  - `insufficient_context`
  - `other`

### Consolidación multiestudio por evento
- El sistema debe poder leer los `structured_parameters` y `ai_prediagnosis` de todos los estudios del mismo evento.
- Debe generarse un `ai_consolidated_prediagnosis` de apoyo.
- Este consolidado no sustituye el dictamen médico final.
- Solo podrá ejecutarse si todos los estudios marcados como críticos para ese evento están en `REVIEWED_ACCEPTED` o `REVIEWED_EDITED`.
- Debe registrar explícitamente qué estudios y qué versiones consumió.
- Si existe conflicto entre estudios, el consolidado debe exponerlo como limitación y no resolverlo silenciosamente.

### Flujo recomendado

#### Paso 1. Carga de estudio
- se sube PDF o imagen
- se ejecuta clasificación y extracción si el estudio lo requiere

#### Paso 2. Persistencia estructurada
- se guardan parámetros canónicos y metadatos de extracción
- se registra auditoría transaccional del actor, versión y archivo fuente

#### Paso 3. Prediagnóstico IA
- la IA interpreta los parámetros ya estructurados
- genera conclusión, justificación, bases, bibliografía, limitaciones y confianza
- si no se cumplen umbrales o faltan parámetros críticos, el resultado obligatorio es `AI_NON_CONCLUSIVE`

#### Paso 4. Validación médica
- el médico visualiza:
  - documento original
  - parámetros extraídos
  - vista humana
  - prediagnóstico IA
- luego registra su diagnóstico final y su evaluación de la utilidad / concordancia
- ninguna aceptación médica debe borrar la versión original sugerida por IA

#### Paso 5. Consolidación del evento
- la IA genera un análisis conjunto de estudios disponibles para el expediente
- solo si el evento cumple reglas de integridad y compatibilidad temporal

#### Paso 6. Mejora mensual supervisada
- se consumen métricas y datasets de comparación IA vs médico
- no se reentrena ni se modifica producción automáticamente

### Umbrales y reglas de bloqueo V1
- Cada tipo de estudio deberá definir un conjunto de parámetros mínimos para permitir interpretación.
- Si faltan parámetros mínimos, el estado será `AI_NON_CONCLUSIVE`.
- Si el archivo está corrupto, incompleto o ilegible, se debe bloquear la capa de interpretación y mostrar solo estado de extracción fallida o incompleta.
- El consolidado multiestudio queda bloqueado si:
  - existe al menos un estudio crítico en `AI_NON_CONCLUSIVE`
  - existe al menos un estudio crítico en `REVIEWED_REJECTED`
  - se detecta incompatibilidad temporal o documental entre estudios

### Corpus de evidencia clínica
- La bibliografía y bases clínicas deben provenir de un corpus controlado, versionado y auditable.
- V1 debe modelar una fuente interna equivalente a `ClinicalEvidenceSource` o estructura persistente equivalente.
- Cada cita debe guardar:
  - `source_id`
  - `title`
  - `section`
  - `excerpt`
  - `version_or_date`
- No se permite que la IA cite texto sin referencia persistible.
- Si no existe evidencia trazable suficiente, el prediagnóstico debe reducir su confianza o declararse no concluyente.

### Requisitos de evidencia clínica
- Las bases y citas del prediagnóstico deben provenir de un corpus controlado y versionado.
- El sistema debe poder asociar cada cita a:
  - identificador de fuente
  - título
  - sección o fragmento
  - versión o fecha
- No se aceptan referencias opacas como "según literatura médica" sin soporte trazable.

### Contrato mínimo de API para implementación

#### Backend
- `POST /api/studies/{studyId}/ai-extractions`
  - crea nueva versión de extracción estructurada
- `GET /api/studies/{studyId}/ai-extractions/current`
  - obtiene extracción vigente
- `POST /api/studies/{studyId}/ai-prediagnosis`
  - crea nueva versión de prediagnóstico basada en extracción vigente o en una versión explícita
- `GET /api/studies/{studyId}/ai-prediagnosis/current`
  - obtiene prediagnóstico vigente
- `POST /api/studies/{studyId}/doctor-review`
  - crea revisión médica y feedback comparativo
- `GET /api/events/{eventId}/ai-consolidated-prediagnosis`
  - devuelve consolidado vigente o estado bloqueado

#### Reglas del contrato
- Toda operación de creación debe responder con id de snapshot y estado clínico resultante.
- Las respuestas deben incluir referencias a la versión de extracción y al corpus/evidencia usados.
- Las mutaciones deben disparar registro de auditoría transaccional.

### Guardrails obligatorios
- Prohibido usar el prediagnóstico IA para firmar o cerrar expedientes automáticamente.
- Prohibido usar el prediagnóstico IA para definir aptitud laboral sin validación médica.
- Si la extracción es incompleta o la confianza es baja, la IA debe declararse no concluyente.
- La UI debe diferenciar visualmente:
  - parámetros extraídos
  - interpretación IA
  - diagnóstico médico
- El documento PDF oficial no debe incluir JSON crudo, razonamiento auxiliar completo ni feedback comparativo IA vs médico.
- La vista operativa interna sí puede mostrar trazabilidad y detalle de auditoría para revisión.

### Contrato mínimo de UI para V1

#### Dentro del espacio del estudio en Papeleta
Debe renderizarse en este orden:
1. archivo original
2. estado de extracción
3. parámetros estructurados
4. vista humana derivada
5. bloque `Sugerencia IA no diagnóstica`
6. formulario de revisión médica

#### Reglas visuales
- El bloque de IA debe usar copy prudente y estado visible.
- Si el estado es `AI_NON_CONCLUSIVE`, la UI debe mostrar motivo explícito.
- El diagnóstico médico debe verse como bloque separado y dominante respecto al bloque IA.
- Debe existir acceso directo a documento original y fragmentos fuente antes de aceptar o editar.

### Encaje con el sistema actual

#### Backend reutilizable
- `backend/app/services/ai/classifier.py`
- `backend/app/services/ai/extractor.py`
- `backend/app/schemas/medical.py`

#### Frontend / flujo clínico a extender
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- `frontend/src/app/events/[id]/page.tsx`
- `frontend/src/app/validation/page.tsx`

#### Ajustes obligatorios derivados del estado actual
- La extracción actual no podrá seguir mezclando interpretación clínica dentro de esquemas extractivos.
- El PDF oficial deberá dejar de exponer JSON crudo asociado al pipeline IA.
- La auditoría existente deberá integrarse al flujo de ingestión, regeneración, aceptación, edición, rechazo y consolidación.

### Archivos objetivo esperados para implementación posterior
- backend:
  - `backend/app/schemas/medical.py`
  - `backend/app/services/ai/extractor.py`
  - nuevos esquemas/servicios de prediagnóstico y evidencia clínica
- frontend:
  - `frontend/src/components/clinical/PapeletaWorkspace.tsx`
  - nuevos componentes por estudio para extracción estructurada y revisión
  - `frontend/src/app/events/[id]/page.tsx`
  - `frontend/src/app/validation/page.tsx`
- persistencia:
  - modelo o almacenamiento para `structured_parameters`, `ai_prediagnosis`, `doctor_review`, `ai_feedback`
  - modelo versionado para evidencia clínica y consolidado multiestudio

### Soft Gates obligatorios para cierre de implementación

#### Gate 1. Compilación
- frontend y backend deben compilar sin errores nuevos

#### Gate 2. Testing
- tests unitarios para nuevos servicios de extracción/prediagnóstico
- tests de backend para contratos de API y reglas de estado
- al menos un test E2E del flujo: archivo -> extracción -> sugerencia IA -> revisión médica

#### Gate 3. Revisión
- verificar que extracción y prediagnóstico están separados
- verificar que no existe propagación automática a dictamen final ni PDF firmado
- verificar que snapshots son versionados e inmutables

#### Gate 4. Documentación
- checkpoint de implementación
- documentación de endpoints o acciones server-side
- explicación del modelo versionado y reglas de estado

### Criterios de aceptación de V1

#### A. Parámetros persistidos
- cada estudio procesado guarda parámetros estructurados reutilizables

#### B. Vista integrada por estudio
- cada estudio muestra en su propio espacio:
  - datos extraídos
  - prediagnóstico IA
  - diagnóstico médico

#### C. Prediagnóstico explicable
- la IA entrega confianza, justificación, bases clínicas, bibliografía y limitaciones

#### D. Validación humana trazable
- el médico puede aprobar, corregir o rechazar el prediagnóstico

#### E. Feedback útil para mejora posterior
- el sistema guarda concordancia y utilidad percibida por el médico

#### F. Consolidación multiestudio
- el evento puede consumir en conjunto los estudios ya extraídos para generar un prediagnóstico consolidado de apoyo

#### G. Auditoría reconstruible
- cada sugerencia IA debe ser reconstruible end-to-end con archivo, versión de modelo, prompt, corpus, citas y revisión médica asociada

#### H. Separación de documento oficial
- el PDF firmado y el dictamen final no exponen contenido auxiliar de IA no validado

### Veredicto
- Sí al enfoque 100% IA para prediagnóstico, pero en modo sombra clínica.
- La salida principal debe ser estructurada por parámetro.
- El resumen es derivado.
- El médico sigue siendo la autoridad final.
- La mejora mensual debe ser supervisada y auditada.
- La implementación debe arrancar por estudio, no por consolidado transversal completo.
- SOFIA queda autorizada para implementar V1 siguiendo esta SPEC y respetando los Soft Gates.