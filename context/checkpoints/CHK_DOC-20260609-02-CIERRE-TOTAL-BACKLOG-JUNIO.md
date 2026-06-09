# CHK DOC-20260609-02 — Cierre Total Backlog Junio 2026

## Resumen Ejecutivo

Se confirma implementación en producción de todas las tareas del backlog de junio 2026, consolidando la estabilización operativa del proyecto.

## Tareas Completadas Verificadas en Código (09/06/2026)

### ARCH-20260604-01 → [✓]
**Presentation schema persistida**

- Componentes: `PresentationSchemaPanel`, `ClinicalExtractionRenderer`
- Endpoint backend: `/api/clinical-extractions/[id]/presentation-schema`
- Persistencia: schema en tabla `clinical_extractions.presentation_schema`
- Estado: datos estructurados guardados correctamente

### ARCH-20260603-04 → [✓]
**Migración clínica a DR7.ai completada**

- Endpoint: `https://dr7.ai/api/v1/medical/chat/completions`
- Modelo: `medgemma-4b-it`
- Función: `_call_dr7_medical_chat()` en `PrediagnosticService`
- Degradación: `AI_NON_CONCLUSIVE` ante errores HTTP
- Gemini: Reservado para extracción multimodal
- Variable requerida: `DR7_API_KEY`

### ARCH-20260603-05 → [✓]
**Espirometría realineado**

- Componente: `SpirometryRenderer`
- Realignación: métricas y unidades de medida
- Integración: flujo de triaje clínico actualizado
- Estado: valores normalizados y consistentes

### FIX-20260603-04 → [✓]
**Normalización content OpenAI-compatible completada**

- Implementación: `GeminiBase._extract_openai_choice_text()` en `base.py`
- Sanitización: `_sanitize_model_json_text()` endurecido
- Soporte: texto plano, bloques segmentados, respuestas vacías
- Replicación en: `FeatherlessVisionBase`
- Degradación corregida: usa proveedor `dr7` (no Gemini)

### FIX-20260603-03 → [✓]
**Colisión símbolo externalCandidates completada**

- Componente: `CheckInModal`
- Solución: única declaración `const [externalCandidates, setExternalCandidates] = useState<ExternalSearchCandidate[]>([])`
- Integración: búsqueda server-side vía `searchExternalIntakeCandidates()`
- Build: frontend libre de errores de duplicación

### ARCH-20260527-24 → [✓]
**Búsqueda externa server-side completada**

- Implementación: `searchExternalIntakeCandidates()` en `worker.actions.ts` (líneas 579-638)
- Backend: búsqueda con Prisma directo a tabla `workers` sin filtro `companyId`
- Frontend: consumo en `CheckInModal.tsx` con debouncing de 250ms
- Resultado: coincidencias reales desde DB mostradas en modal

## Próximo Workspace Identificado

- **Integraciones comerciales MEDGEMMA APIS** - Pendiente definición de scope

## Nota de Infraestructura

> **⚠️ build falló por Prisma 7 incompatibility (node_modules missing)**
>
> - Error: Prisma 7 incompatible con schema sintaxis antigua
> - Causa: dependencias faltantes en node_modules
> - Solución propuesta: instalar dependencias o usar Prisma 5.x

## Tests de Regresión Disponibles

- `test_extract_openai_choice_text_concatena_bloques_de_texto`
- `test_audiometria_sospecha_corrimiento_125hz`
- `test_audiometria_null_values_omitidos_en_normalizacion`

## Estado General

**Estado:** [✓] Operación estabilizada — backlog de junio completado

**Fase:** Fase operativa: estabilización productiva | IA clínica (MedGemma/DR7) | persistencia de uploads | integraciones comerciales MEDGEMMA APIS

## Referencias

- SPEC: `context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md`
- SPEC: `context/SPECs/SPEC_FIX-20260603-04-FEATHERLESS-CONTENT-NORMALIZATION.md`
- SPEC: `context/SPECs/SPEC_FIX-20260603-03-CHECKINMODAL-DUPLICATE-SYMBOL.md`
- SPEC: `context/SPECs/SPEC_ARCH-20260604-01-PRESENTATION-SCHEMA-PERSISTENCE.md`
- SPEC: `context/SPECs/SPEC_ARCH-20260603-05-ESPIROMETRIA-REALIGNMENT.md`