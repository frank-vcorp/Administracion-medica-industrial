# CHK_IMPL-20260326-05 — Trazabilidad IA: Endpoint de diagnóstico + enriquecimiento de error

**ID de Intervención:** IMPL-20260326-05  
**Agente:** SOFIA - Builder  
**Fecha:** 2026-03-26  
**Estado:** ✅ Completado (Gates 1, 3, 4 validados)

---

## Problema Raíz Abordado

En producción (Vercel + Railway), el estudio AUDIOMETRIA mostraba el mensaje genérico  
`"Servicios de IA no están disponibles"` al regenerar IA, sin revelar si el problema era:
- `GEMINI_API_KEY` ausente/inválida  
- Error de inicialización de uno de los tres servicios IA  
- Modelo incorrecto

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/app/main.py` | +54 líneas: `import re`, `_sanitize_error`, `_ai_unavailable_response`, `ai_init_error` global, `GET /api/v2/ai/status`, actualización de 2 respuestas de error en V2 |
| `frontend/src/actions/event-test.actions.ts` | +30 líneas: enriquecimiento de error en `regenerateStudyAI` con consulta al nuevo endpoint |

---

## Cambios Técnicos Detallados

### Backend (`backend/app/main.py`)

1. **`import re`** — para el regex de sanitización de API keys.

2. **`_GOOGLE_API_KEY_RE`** — regex `AIza[A-Za-z0-9_\-]{30,}` para redactar keys de Google en errores.

3. **`_sanitize_error(err: str) -> str`** — helper que redacta API keys y trunca a 300 chars.  
   Nunca expone el valor real de `GEMINI_API_KEY`.

4. **`ai_init_error: Optional[str]`** — variable global que persiste el error sanitizado de init IA.  
   Se setea en el bloque `except` de la inicialización; `None` si init fue exitosa.

5. **`_ai_unavailable_response(msg)`** — helper que construye respuesta estándar de error con:
   ```json
   {
     "status": "error",
     "error": "...",
     "details": {
       "classifier": bool,
       "extractor": bool,
       "prediagnostic": bool,
       "api_key_present": bool,
       "model": "gemini-2.5-flash",
       "last_init_error": "... sanitizado ..."
     }
   }
   ```

6. **`GET /api/v2/ai/status`** — endpoint público de solo lectura:
   ```json
   {
     "overall_status": "ok" | "degraded",
     "classifier": bool,
     "extractor": bool,
     "prediagnostic": bool,
     "model": "gemini-2.5-flash",
     "api_key_present": bool,
     "last_init_error": "... sanitizado ..."
   }
   ```

7. **V2 endpoints** — `POST /api/v2/studies/upload-and-analyze` y `POST /api/v2/studies/prediagnosis-from-params` ahora llaman `_ai_unavailable_response()` en vez de retornar el mensaje genérico sin detalle.

### Frontend (`frontend/src/actions/event-test.actions.ts`)

En `regenerateStudyAI`, después de recibir el resultado de `triggerStudyAIAnalysis`:

- Si `aiResult.error` contiene `"Servicios de IA no están disponibles"`, se consulta `GET /api/v2/ai/status`.
- Se construye un `enrichedError` que puede ser:
  - `"Servicios de IA no están disponibles: GEMINI_API_KEY ausente"`
  - `"Servicios de IA no están disponibles: Error inicializando extractor: ..."`
  - `"Servicios de IA no están disponibles: classifier no inicializado"`
- `enrichedError` se persiste en `resultNotes` y se retorna al caller.
- El `try/catch` interno garantiza que si `/api/v2/ai/status` no responde, se mantiene el error original.

---

## Soft Gates

| Gate | Estado | Evidencia |
|------|--------|-----------|
| G1 - Compilación | ✅ | `python3 -c "import ast; ast.parse(...)"` → OK; `pnpm build` → éxito |
| G2 - Testing | ⚠️ No aplica | Sin test automático de nuevo endpoint (diagnóstico, no clínico) |
| G3 - Revisión | ✅ | Cambios mínimos; no toca lógica clínica ni flujo de revisión médica |
| G4 - Documentación | ✅ | Este checkpoint |

---

## Restricciones Cumplidas

- ✅ No toca lógica clínica ni flujo de revisión médica
- ✅ No expone secretos: `GEMINI_API_KEY` solo se reporta como `bool`
- ✅ Sanitización de API keys en mensajes de error (`AIza...` → `[API_KEY_REDACTED]`)
- ✅ Truncamiento a 300 chars para evitar stack traces largos
- ✅ Cambios mínimos y focalizados (2 archivos)

---

## Ejemplo de Diagnóstico Esperado en Producción

Si `GEMINI_API_KEY` no está configurada en Railway, el endpoint `/api/v2/ai/status` retornará:
```json
{
  "overall_status": "degraded",
  "classifier": false,
  "extractor": false,
  "prediagnostic": false,
  "model": "gemini-2.5-flash",
  "api_key_present": false,
  "last_init_error": "API key is required to use the Generative AI SDK..."
}
```

Y en la UI de EventTest, `resultNotes` mostrará:
```
Archivo cargado, pero la IA no generó prediagnóstico: Servicios de IA no están disponibles: GEMINI_API_KEY ausente
```
