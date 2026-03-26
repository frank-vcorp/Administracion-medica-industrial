# CHK_IMPL-20260326-03 — Parseo Tolerante Gemini + Degradación AI_NON_CONCLUSIVE

**Fecha:** 2026-03-26  
**ID Intervención:** IMPL-20260326-03  
**Agente:** SOFIA - Builder  
**Tipo:** Fix puntual backend (sin cambios frontend)

---

## Problema corregido

En producción (Railway), el análisis de Espirometría fallaba en la capa de prediagnóstico:

```
❌ Error llamando Gemini (text-only): Unterminated string starting at: line 4 column 3 (char 311)
❌ Error en V2 upload-and-analyze: [misma excepción]
```

Flujo roto: Clasificación ✅ → Extracción ✅ → Prediagnóstico ❌ → Endpoint falla.  
HTTP devuelve 200 pero con payload de error en lugar de resultado estructurado.

---

## Causa raíz

1. `_call_gemini_text_only` usaba `json.loads(text)` directo — cualquier JSON imperfecto de Gemini (truncado por tokens, texto al final, fences residuales) lanzaba `JSONDecodeError`.
2. El stripping de markdown era frágil: `if text.startswith("```")` con `split("```")` dejaba residuos.
3. `generate_prediagnosis` no tenía try-except alrededor de la llamada a `_call_gemini_text_only` — la excepción se propagaba hasta el route level.

---

## Cambios implementados

### `backend/app/services/ai/base.py`

- **Añadido:** `GeminiBase._tolerant_json_parse(text)` — helper estático compartido:
  1. Intenta `json.loads(text)` directo.
  2. Si falla: extrae subcadena `text[first_'{':last_'}'+1]` para tolerar texto extra antes/después.
  3. Si sigue fallando: lanza `ValueError` informativo (no `JSONDecodeError` crudo).
- **Actualizado:** `call_gemini` usa `_tolerant_json_parse` en lugar de `json.loads`.

### `backend/app/services/ai/prediagnostic.py`

- **`_call_gemini_text_only`:** stripping markdown incondicional con `replace("```json","").replace("```","")` + usa `GeminiBase._tolerant_json_parse` compartido.
- **`generate_prediagnosis`:** la llamada a `_call_gemini_text_only` está envuelta en try-except. Si falla (por cualquier causa), retorna `AIPrediagnosisResult` con `clinical_state="AI_NON_CONCLUSIVE"` y `non_conclusive_reason` descriptivo. El endpoint nunca propaga la excepción al route level.

---

## Casos cubiertos por el helper tolerante

| Caso | Antes | Después |
|------|-------|---------|
| JSON limpio | ✅ OK | ✅ OK |
| JSON con texto extra al final | ❌ JSONDecodeError | ✅ Parsea correctamente |
| JSON embebido con texto antes y después | ❌ JSONDecodeError | ✅ Parsea correctamente |
| Fences markdown residuales | ❌ JSONDecodeError (a veces) | ✅ Stripeado robusto |
| JSON genuinamente truncado | ❌ Propaga excepción | ✅ Degrada a AI_NON_CONCLUSIVE |

---

## Soft Gates

- **Gate 1 Compilación:** `ast.parse()` sin errores en ambos archivos ✅
- **Gate 2 Testing:** 6 tests aislados del helper pasan ✅
- **Gate 3 Revisión:** `git diff --cached` revisado (2 archivos, 59 ins / 12 del) ✅
- **Gate 4 Deploy:** `railway up --detach` ejecutado; `Application startup complete` confirmado en logs ✅

---

## Archivos modificados

- [backend/app/services/ai/base.py](../../backend/app/services/ai/base.py)
- [backend/app/services/ai/prediagnostic.py](../../backend/app/services/ai/prediagnostic.py)

**Commit:** `f6ea208` — `fix(ai): parseo tolerante de JSON Gemini y degradación segura a AI_NON_CONCLUSIVE`

---

## Comportamiento esperado post-deploy

Cuando Gemini devuelve JSON imperfecto para Espirometría:
- El pipeline **no falla** — completa con `clinical_state: "AI_NON_CONCLUSIVE"`
- El log muestra: `⚠️ Fallo al llamar/parsear Gemini (text-only) para Espirometria: ...`
- El endpoint devuelve 200 con resultado estructurado (extracción disponible, prediagnóstico degradado)
- El médico ve el estudio con estado "requiere revisión manual" en lugar de un error de aplicación

---

## Limitaciones / Pendiente

- Si Gemini trunca el JSON por límite de tokens (`maxOutputTokens: 2048`), `_tolerant_json_parse` no puede recuperarlo — degrada correctamente a `AI_NON_CONCLUSIVE`. Si el problema persiste frecuentemente, se puede evaluar aumentar `maxOutputTokens` a 4096 en ARCH futura.
- No se añadieron dependencias externas (solución stdlib pura).
