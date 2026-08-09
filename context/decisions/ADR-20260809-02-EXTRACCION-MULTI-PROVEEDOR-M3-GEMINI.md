# ADR-20260809-02 — Extracción documental multi-proveedor (Gemini + MiniMax M3)

- **ID:** ARCH-20260809-02
- **Fecha:** 2026-08-09
- **Agente:** INTEGRA — Arquitecto
- **Estado:** Aprobada (delegación a SOFIA en curso)
- **Escala:** Arquitectónica (L3 en política DEBY, pero sin contrato público a usuarios finales)
- **Modelo de razonamiento:** GLM-5.2 (gateway Kilo)
- **Relacionada con:**
  - `context/SPECs/SPEC_ARCH-20260519-15-ROLLBACK-EXTRACCION-A-GEMINI.md` (rollback Featherless→Gemini)
  - `context/SPECs/SPEC_ARCH-20260518-06-BASE-EXTRACCION-Y-PLANTILLA-CALIBRACION.md` (base universal + bloque calibración)
  - `context/SPECs/SPEC_ARCH-20260518-03-EXTRACCION-SIN-FALLBACK-CLINICA-CON-FALLBACK.md` (sin fallback de prompt)
  - `backend/app/services/ai/base.py` (GeminiBase + FeatherlessVisionBase como plantilla)
  - `backend/app/services/ai/extractor.py` (ExtractorService → `call_gemini` hoy)

---

## 1. Contexto y decisión

El sistema AMI mantiene dos capas IA independientes:

1. **Capa clínica (prediagnóstico):** MedGemma 4B vía DR7 (`prediagnostic.py`). **No se toca en este corte.** Frank lo confirmó explícitamente.
2. **Capa de extracción documental:** hoy resuelta exclusivamente con Gemini (`ExtractorService` hereda de `GeminiBase` y llama `self.call_gemini` en `extractor.py:237`). Fue la salida del rollback `ARCH-20260519-15` tras `503 capacity_exhausted` de Featherless/Qwen-VL.

Frank quiere **probar la extracción con MiniMax M3 lado a lado con Gemini**, sin redeploys, configurándolo desde el módulo de calibración existente (`aiCalibration`), y manteniendo Gemini como red de seguridad operativa. Tiene plan Pro de tokens de M3, así que el coste no es factor limitante.

### Decisión aprobada

Agregar un **selector runtime de proveedor + modelo para la capa de extracción documental**, configurable por calibración (`aiCalibration.extraction.provider` + `aiCalibration.extraction.model`) y sobreescribible por payload de analyze (override opcional para A/B), con **degradación honesta automática de M3 a Gemini** ante fallo del upstream M3.

- Selector **global por prueba** (persistido en `aiCalibration`) **con override opcional por ejecución** (en el payload de `/api/v2/studies/upload-and-analyze`). Esto da el máximo de flexibilidad: un default estable por prueba + la capacidad de forzar un proveedor concreto en una corrida de calibración sin tocar la configuración guardada.
- Gemini sigue siendo el **default efectivo** para toda calibración legacy que no declare `extraction.provider` (migración implícita, sin ruptura).
- M3 y Gemini son los dos únicos proveedores de extracción en este corte. No se modelan más proveedores (YAGNI; se pueden añadir tras validar el patrón).

## 2. Comparación Gemini vs MiniMax M3 (capa de extracción)

| Eje | Gemini 2.5 Flash (actual) | MiniMax M3 |
|---|---|---|
| Multimodalidad nativa | Sí (inline_data image/jpeg) | Sí (OpenAI-compatible image_url base64) |
| SDK | REST propio (`generativelanguage`) | OpenAI SDK (compatible) |
| Latencia típica extracción | 5–10 s | A verificar en runtime (esperable 4–12 s) |
| Coste | Plan API estándar | Plan Pro de tokens de Frank (no limitante) |
| Estabilidad operativa | Alta (default tras rollback) | A validar en producción lado a lado |
| Patrón ya en el repo | `GeminiBase.call_gemini` | `FeatherlessVisionBase.call_featherless_vision` (OpenAI SDK, reutilizable como plantilla) |
| Parseo tolerante | `_tolerant_json_parse` | Mismo helper reusable |
| Motivo histórico de salida | — | Sin historial AMI; se reintroduce con fallback esta vez |

**Conclusión:** ambos son viables para extracción multimodal de PDF/imágenes médicas. M3 aporta un segundo cerebro de familia distinta (útil para A/B de calidad de extracción). Gemini aporta la red de seguridad ya probada en producción AMI.

## 3. ¿Por qué no solo M3?

Frank ya pasó por un rollback de proveedor extractivo (`ARCH-20260519-15`) por `503 capacity_exhausted` de Featherless/Qwen-VL. La lección arquitectónica extraída: **un único proveedor extractivo externo es un punto único de fallo del flujo principal de AMI** (subir estudio → obtener extracción usable en tiempo real).

Reemplazar Gemini por M3 como único proveedor reproduciría el riesgo: si M3 satura, cambia su API, o degrada, el flujo extractivo se cae sin red. La decisión correcta es **multi-proveedor con fallback automático**, no sustitución.

Además, Frank pidió explícitamente "probar ambos proveedores lado a lado" — eso implica conservar Gemini como referencia viva, no como código muerto.

## 4. Política de fallback (unidireccional M3 → Gemini)

- **Solo M3 → Gemini.** Nunca Gemini → M3, ni M3 → M3 (reintentos cortos sí, pero el fallback entre proveedores es unidireccional para evitar loops).
- **Triggers de fallback** (cualquiera):
  - HTTP 5xx del upstream M3.
  - Timeout de lectura (>60 s, coherente con `timeout=(10,60)` de `call_gemini`).
  - HTTP 4xx persistente tras 1 reintento, **excluyendo 401/403** (credenciales malas no deben enmascararse como fallback silencioso; son error explícito de configuración).
- **Caso especial:** si `extraction_provider=m3` pero `M3_API_KEY` no está configurada → fallback a Gemini con `extraction_fallback_reason="m3_not_configured"`.
- **Si `extraction_provider=gemini` y Gemini falla → NO hay fallback.** No existe segundo proveedor definido para ese camino. La corrida degrada a error explícito (igual que hoy).
- **Trazabilidad obligatoria** en toda corrida de extracción:
  - `extraction_provider_requested`: proveedor pedido (gemini | m3), nunca null.
  - `extraction_provider_used`: proveedor que efectivamente respondió (puede ser `gemini` tras fallback).
  - `extraction_model_used`: modelo efectivo (env var resuelta).
  - `extraction_fallback_reason`: null si no hubo fallback; string corto si lo hubo (`m3_5xx`, `m3_timeout`, `m3_4xx_persistent`, `m3_not_configured`).

## 5. Selector en aiCalibration (global + override por payload)

Resolución de la ambigüedad que ATLAS escaló ("¿override por documento o solo global?"):

- **Global por prueba** (persistido en `aiCalibration.extraction`): define el proveedor/modelo default de esa prueba. Se edita en la UI de calibración existente (`AICalibrationEditor.tsx`). Sin nueva pantalla.
- **Override opcional por ejecución** (en el payload del endpoint de analyze): permite forzar un proveedor/modelo concreto en una corrida sin mutar la calibración guardada. Pensado para A/B en el panel de test de calibración (`/api/v1/calibration/upload`) y, si Frank lo pide, en el endpoint de analyze.

**Regla de resolución (precedencia):**
1. Override por payload (si presente y válido) → gana.
2. `aiCalibration.extraction.provider/model` (si presente) → aplica.
3. Default global de proceso: `gemini` + `GEMINI_MODEL_EXTRACTION`.

**Migración legacy:** toda `aiCalibration` existente sin `extraction.provider` se trata como `provider="gemini"` (default implícito). No se requiere script de migración; la lectura debe ser defensiva. Se documenta en SPEC §"Migración de calibraciones legacy".

## 6. Consecuencias

- **Positivas:** A/B real de extracción sin redeploys; red de seguridad operativa conservada; trazabilidad honesta de proveedor efectivo; palanca para degradar a M3 como default si Frank lo decide tras validación (solo cambiar default o la calibración).
- **Negativas:** superficie de código extractivo crece (nuevo cliente M3 + dispatcher de provider + lógica de fallback + trazabilidad extendida); complejidad de tests (cliente M3 mockeado + fallback + migración legacy).
- **Riesgos:**
  - Trazabilidad inconsistente si quedan referencias residuales a `gemini_model` sin poblarse con el proveedor real — mitigado por criterios de aceptación de la SPEC.
  - Estados híbridos difíciles de depurar si el fallback no es completo — mitigado por trazabilidad `requested/used/reason`.
  - Nombre del modelo M3 confirmado contra docs oficiales: `MiniMax-M3` (case-sensitive). Mitigado por env var `M3_DEFAULT_MODEL` ajustable.
- **Neutralidades preservadas:** capa clínica intacta (MedGemma/DR7); patrón "extracción sin fallback de prompt" intacto (si falta `aiCalibration.extraction.prompt`, la corrida sigue fallando explícitamente con `EXTRACTION_PROMPT_NOT_CONFIGURED`).

## 7. No incluido en este corte

- Clasificador documental (`DocumentClassifierService`) no se migra a M3 en este corte. Sigue con Gemini. Si Frank lo pide tras validar extracción, se abre ARCH nuevo.
- Balanceo avanzado entre más de dos proveedores.
- Reintentos exponenciales sofisticados (solo 1 reintento corto antes de fallback, para no inflar latencia).
- Selector de proveedor para la capa clínica (MedGemma/DR7) — fuera de alcance por decisión de Frank.
- Política de costo o cuotas por proveedor (Frank indicó que el coste no es problema).

## 8. Handoff

SPEC firmada: `context/SPECs/SPEC_ARCH-20260809-02-SELECTOR-EXTRACCION-MULTI-PROVEEDOR.md`
Handoff a SOFIA: `context/interconsultas/HANDOFF_ARCH-20260809-02_SOFIA_SELECTOR-EXTRACCION.md`
