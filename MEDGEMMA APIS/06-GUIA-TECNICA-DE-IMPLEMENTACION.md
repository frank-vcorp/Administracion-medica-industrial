# Guía Técnica de Implementación

- ID: ARCH-20260513-03-TECH
- Audiencia: técnico implementador, fundador técnico, builder

## Objetivo técnico

Implementar una versión vendible del servicio de forma separada del sistema principal, reutilizando conocimiento del repo actual pero sin depender completamente de su estructura de producto.

## Arquitectura recomendada

### Frontend demo comercial

Responsabilidades:

1. landing page
2. upload de uno o múltiples archivos
3. visualización de resultados por estudio
4. visualización de consolidado final
5. formulario de contacto a WhatsApp

### Backend de procesamiento

Responsabilidades:

1. recibir archivos
2. clasificar y extraer con Gemini 2.5
3. persistir JSON estructurado por estudio
4. invocar MedGemma para prediagnóstico por estudio
5. invocar consolidado multiestudio
6. devolver payload para UI

### Proveedores

1. extracción documental: Gemini 2.5
2. prediagnóstico por estudio: MedGemma
3. consolidado multiestudio: MedGemma o capa clínica consolidada equivalente

## Diseño del pipeline

### Paso 1. Upload

Entrada:

1. uno o múltiples archivos
2. opcionalmente nombre de caso o trabajador

### Paso 2. Clasificación y extracción

Salida mínima por estudio:

1. `study_type`
2. `structured_data`
3. `quality`
4. `missing_fields`

### Paso 3. Prediagnóstico por estudio

Salida mínima:

1. `summary`
2. `confidence`
3. `justification`
4. `limitations`
5. `red_flags`

### Paso 4. Consolidado multiestudio

Entrada:

1. lista de estudios válidos del mismo caso

Salida mínima:

1. `final_support_summary`
2. `cross_study_findings`
3. `excluded_studies`
4. `clinical_attention_points`

## Contratos recomendados

### Estudio individual

```json
{
  "study_id": "uuid",
  "study_type": "Audiometria",
  "source_file_name": "audio.pdf",
  "structured_data": {},
  "prediagnosis": {
    "summary": "...",
    "confidence": 0.78,
    "limitations": []
  }
}
```

### Consolidado

```json
{
  "case_id": "uuid",
  "studies_used": ["uuid-1", "uuid-2"],
  "studies_excluded": [],
  "final_support_summary": "...",
  "cross_study_findings": [],
  "clinical_attention_points": []
}
```

## Requisitos de implementación

1. provider abstraction para capa clínica
2. fallback si MedGemma no está disponible
3. logs por estudio y por consolidado
4. manejo de errores y no concluyente
5. trazabilidad de modelo y proveedor usados

## Variables de configuración sugeridas

1. `GEMINI_API_KEY`
2. `GEMINI_MODEL_EXTRACTION`
3. `MEDGEMMA_ENABLED`
4. `FEATHERLESS_API_KEY`
5. `FEATHERLESS_MODEL`
6. `CLINICAL_FALLBACK_PROVIDER`
7. `WA_CONTACT_NUMBER`

## Política de seguridad y operación

1. no loggear documentos completos en producción
2. no guardar PHI sin política clara de retención
3. mantener modo sombra clínica
4. mostrar disclaimer en UI y documentos comerciales

## Checklist técnico de salida

1. upload múltiple funcionando
2. extracción por estudio funcionando
3. prediagnóstico individual funcionando
4. consolidado final funcionando
5. landing comercial funcionando
6. contacto a WhatsApp funcionando
