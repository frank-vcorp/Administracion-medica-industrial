# SPEC FIX-20261028-01 — Prediagnóstico clínico solo con MiniMax M3

**ID:** FIX-20261028-01
**Tipo:** FIX de proveedor clínico
**Prioridad:** P0 (producción sigue llamando a DR7 y muestra HTTP 402)
**Estado:** implementado en este corte

## Problema

La extracción ya usa MiniMax M3 (`key_resolver` de `m3`, fila de `/admin/ai-keys` o `M3_API_KEY`). El prediagnóstico no: `PrediagnosticService.generate_prediagnosis` resolvía DR7 con `_resolve_dr7_config` / `_call_dr7_medical_chat` cuando `MEDGEMMA_ENABLED` y `DR7_API_KEY` estaban presentes. Quitar la key de los secretos no corta ese camino si el flag y una key residual (env o fila `dr7`) siguen activos. El usuario ve HTTP 402 de DR7.

## Decisión

1. El chat clínico llama solo a MiniMax M3 (`POST {M3_BASE_URL}/chat/completions`, default `https://api.minimax.io/v1/chat/completions`, modelo default `MiniMax-M3`).
2. Credenciales: el mismo resolver `m3` que la extracción (BD si `AI_KEYS_FROM_DB_ENABLED`, si no env).
3. `DR7_API_KEY` y `MEDGEMMA_ENABLED` no habilitan ni enrutan este flujo. Un `base_url` que apunte a `dr7.ai` se rechaza.
4. Fallos (HTTP, cuerpo vacío, JSON no parseable) degradan a `AI_NON_CONCLUSIVE`. El texto nombra MiniMax y no copia el cuerpo (crédito insuficiente, URL de upgrade, DR7).
5. Sigue siendo apoyo a la decisión: el system prompt prohíbe diagnóstico definitivo, dictamen y aptitud. `clinical_provider` queda `m3`.

## Modelo

La prueba usa `MiniMax-M3.1-Flash` con `reasoning_effort=low` (el nivel más rápido) en extracción y prediagnóstico. La imagen va con `detail=low`. El id guardado `MiniMax-M3` se lee como Flash solo para esta medición. La llamada clínica espera hasta 90 s. El panel deja la duración en las limitaciones.

## Plazo de la llamada clínica

La subida del archivo no cambió. Vercel corta la función de `/events/[id]` a los 300 s (`Task timed out after 300 seconds`) y el navegador muestra «Error al subir archivo» porque la acción nunca responde. El `timeout` de `requests` solo corta el silencio entre bytes; MiniMax puede seguir emitiendo tokens y la espera no termina. La llamada clínica tiene un plazo de reloj de 45 s. Si se vence, el prediagnóstico queda `AI_NON_CONCLUSIVE` y la respuesta sale igual, para que el archivo quede vinculado.

## Verificación

Generar un prediagnóstico de una audiometría. La petición clínica debe ir a `api.minimax.io`, no a `dr7.ai`. Sin `M3_API_KEY` (ni fila `m3`) el resultado es no concluyente y nombra MiniMax.

Variables que el operador debe conservar: `M3_API_KEY` (o la fila `m3` con `AI_KEYS_FROM_DB_ENABLED=true`), y si aplica `M3_BASE_URL` y `M3_DEFAULT_MODEL`. Se pueden retirar `DR7_API_KEY` y `MEDGEMMA_ENABLED`.
