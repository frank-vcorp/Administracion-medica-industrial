## SPEC: Prediagnóstico IA Estructurado por Estudio y Consolidado por Evento

**ID:** `ARCH-20260326-16`
**Estado:** `Draft para revisión cruzada`
**Padre:** `ARCH-20260325-05`, `ARCH-20260326-04`, `ARCH-20260326-06`
**Objetivo:** incorporar un sistema de extracción estructurada, prediagnóstico IA por estudio y consolidación multiestudio por evento, manteniendo al médico como autoridad diagnóstica final y dejando trazabilidad clínica auditable.

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

### Principios no negociables

#### 1. Parámetros primero
- Todo estudio procesado por IA debe producir un conjunto de parámetros estructurados persistibles.
- Ningún prediagnóstico IA puede existir sin una base estructurada asociada.

#### 2. Separación de capas
- Deben persistirse por separado:
  - datos extraídos
  - interpretación IA
  - validación / diagnóstico médico

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

### Consolidación multiestudio por evento
- El sistema debe poder leer los `structured_parameters` y `ai_prediagnosis` de todos los estudios del mismo evento.
- Debe generarse un `ai_consolidated_prediagnosis` de apoyo.
- Este consolidado no sustituye el dictamen médico final.

### Flujo recomendado

#### Paso 1. Carga de estudio
- se sube PDF o imagen
- se ejecuta clasificación y extracción si el estudio lo requiere

#### Paso 2. Persistencia estructurada
- se guardan parámetros canónicos y metadatos de extracción

#### Paso 3. Prediagnóstico IA
- la IA interpreta los parámetros ya estructurados
- genera conclusión, justificación, bases, bibliografía, limitaciones y confianza

#### Paso 4. Validación médica
- el médico visualiza:
  - documento original
  - parámetros extraídos
  - vista humana
  - prediagnóstico IA
- luego registra su diagnóstico final y su evaluación de la utilidad / concordancia

#### Paso 5. Consolidación del evento
- la IA genera un análisis conjunto de estudios disponibles para el expediente

#### Paso 6. Mejora mensual supervisada
- se consumen métricas y datasets de comparación IA vs médico
- no se reentrena ni se modifica producción automáticamente

### Requisitos de evidencia clínica
- Las bases y citas del prediagnóstico deben provenir de un corpus controlado y versionado.
- El sistema debe poder asociar cada cita a:
  - identificador de fuente
  - título
  - sección o fragmento
  - versión o fecha
- No se aceptan referencias opacas como "según literatura médica" sin soporte trazable.

### Guardrails obligatorios
- Prohibido usar el prediagnóstico IA para firmar o cerrar expedientes automáticamente.
- Prohibido usar el prediagnóstico IA para definir aptitud laboral sin validación médica.
- Si la extracción es incompleta o la confianza es baja, la IA debe declararse no concluyente.
- La UI debe diferenciar visualmente:
  - parámetros extraídos
  - interpretación IA
  - diagnóstico médico

### Encaje con el sistema actual

#### Backend reutilizable
- `backend/app/services/ai/classifier.py`
- `backend/app/services/ai/extractor.py`
- `backend/app/schemas/medical.py`

#### Frontend / flujo clínico a extender
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- `frontend/src/app/events/[id]/page.tsx`
- `frontend/src/app/validation/page.tsx`

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

### Veredicto
- Sí al enfoque 100% IA para prediagnóstico, pero en modo sombra clínica.
- La salida principal debe ser estructurada por parámetro.
- El resumen es derivado.
- El médico sigue siendo la autoridad final.
- La mejora mensual debe ser supervisada y auditada.