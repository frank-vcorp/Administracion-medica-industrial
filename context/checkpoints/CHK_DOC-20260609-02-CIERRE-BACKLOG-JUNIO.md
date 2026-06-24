# CHK DOC-20260609-02 — Cierre Backlog Junio 2026

## Resumen Ejecutivo

Se confirma implementación en producción de las tareas del backlog de junio 2026, consolidando la estabilización operativa del proyecto.

## Tareas Verificadas

### ARCH-20260603-04 → [✓]
**Migración clínica a DR7.ai completada**

- Endpoint: `https://dr7.ai/api/v1/medical/chat/completions`
- Modelo: `medgemma-4b-it`
- Función: `_call_dr7_medical_chat()` en `PrediagnosticService`
- Degradación: `AI_NON_CONCLUSIVE` ante errores HTTP
- Gemini: Reservado para extracción multimodal
- Variable requerida: `DR7_API_KEY`

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

## Tests de Regresión Disponibles

- `test_extract_openai_choice_text_concatena_bloques_de_texto`
- `test_audiometria_sospecha_corrimiento_125hz`
- `test_audiometria_null_values_omitidos_en_normalizacion`

## Estado General

**Estado:** [✓] Operación estabilizada — backlog de junio completado

**Fase:** Fase operativa: estabilización productiva | IA clínica (MedGemma/DR7) | persistencia de uploads | integraciones comerciales MEDGEMMA APIS

## Work items próximos

- ARCH-20260604-01: Presentation schema asistida (alta prioridad)
- ARCH-20260527-24: Búsqueda externa server-side (media prioridad)
- FIX-20260603-01: Corrimiento tabular residual (baja prioridad)

## Infraestructura

- pnpm build falló: Prisma 7 incompatible con schema sintaxis antigua
- Solución: instalar dependencias o usar Prisma 5.x

## Referencias

- SPEC: `context/SPECs/SPEC_ARCH-20260603-04-MIGRACION-CLINICA-DR7-TEXTO.md`
- SPEC: `context/SPECs/SPEC_FIX-20260603-04-FEATHERLESS-CONTENT-NORMALIZATION.md`
- SPEC: `context/SPECs/SPEC_FIX-20260603-03-CHECKINMODAL-DUPLICATE-SYMBOL.md`