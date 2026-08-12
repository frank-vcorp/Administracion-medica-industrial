# ROLLOUT-FLAG-20260812-01 — Activar AI_KEYS_FROM_DB_ENABLED en producción Vercel

## Contexto
Tras FIX-20260812-14 (módulo IA devuelve error user-friendly cuando la key
está vacía), Frank confirmó Camino A: activar la feature flag
`AI_KEYS_FROM_DB_ENABLED=true` para que el backend lea las claves IA desde la
BD cifrada (AES-256-GCM) en lugar de depender de env vars.

**Situación actual confirmada:**
- Panel `/admin/ai-keys` muestra M3 `Estado: presente`, sufijo `o9A4`,
  `Fuente activa: env var` → **la key SÍ está en BD**, pero el resolver
  retorna "env" porque la flag está `false`.
- Gemini `Estado: ausente` (sin fila en BD). La fuente activa dice "env var"
  pero no hay `GEMINI_API_KEY` en Vercel → vacío.
- DR7 `Estado: presente`, sufijo `3f0a` (fila BD existe, env var también
  configurada por separado).

**Decisión:** Frank autorizó activar flag `AI_KEYS_FROM_DB_ENABLED=true` para
que M3 lea de BD. Sin cambios de código.

## Procedimiento (operador: Frank o deploy)

### Paso 1 — Setear env var en Vercel (1 minuto)

1. Vercel Dashboard → Proyecto `administracion-medica-industrial` →
   Settings → Environment Variables.
2. Add New:
   - **Key:** `AI_KEYS_FROM_DB_ENABLED`
   - **Value:** `true`
   - **Environment:** Production (también Preview si quieres probar antes).
3. Save.

> **No requiere** ningún otro env var adicional. El resolver hace fallback a
> env var si BD no tiene fila válida (CB-1 SPEC §D8), así que el cambio es
> aditivo y reversible.

### Paso 2 — Redeploy (2-3 minutos)

Vercel Dashboard → Deployments → último deployment → ⋯ → Redeploy.

(Alternativamente: push vacío a `main` para triggerear redeploy automático,
pero redeploy manual desde dashboard es más rápido y trazable.)

### Paso 3 — Validación post-deploy (5 minutos)

Ejecutar estos checks en orden. Si alguno falla → flag off + rollback (Paso 5).

#### 3.1 Endpoint de diagnóstico

```bash
curl -s https://administracion-medica-industrial.vercel.app/api/v2/ai/status \
  -H "x-ami-role: SUPERADMIN" | jq .
```

**Esperado:**
```json
{
  "ai_keys_from_db_enabled": true,
  "key_source": {
    "gemini": "env",
    "m3": "db",
    "dr7": "env"
  },
  "m3_key_present": true,
  "m3_enabled": true,
  ...
}
```

> ⚠️ `m3_key_present` sigue mostrando `bool(M3_API_KEY)` (env var); NO refleja
> la key de BD. El indicador real de que BD está activa es `key_source.m3 ==
> "db"`.

#### 3.2 Panel admin

Refrescar `https://administracion-medica-industrial.vercel.app/admin/ai-keys`.

**Esperado:**
- M3: `Fuente activa: db` (antes decía `env var`).
- DR7: `Fuente activa: db` o `env` (depende de cuál está primero en
  precedencia; el código BD-gana-si-existe-y-enabled).
- Gemini: `Fuente activa: env` (sigue ausente en BD).

#### 3.3 Flujo end-to-end (CRÍTICO)

1. Login como admin en producción.
2. Ir a un evento `IN_PROGRESS` con estudios pendientes.
3. En Audiometría, subir un PDF/PNG de prueba.
4. **Esperado:** clasificación + extracción exitosa, sin
   `M3_CREDENTIALS_UNAVAILABLE`. El `extraction_snapshot.audit.key_source`
   debe ser `"db"`.
5. Si vuelve a salir `M3_CREDENTIALS_UNAVAILABLE` → **rollback inmediato**
   (Paso 5).

### Paso 4 — Confirmar logs

Vercel → Deployments → último → Logs (Runtime Logs). Filtrar por:
- `[AI_KEYS] m3 key refrescada desde db` → confirma lectura desde BD.
- Ausencia de `[FIX-20260812-13] m3 cache fría sin fila BD` → no hay cold-load
  degradado.

### Paso 5 — Rollback (si falla)

Vercel → Settings → Environment Variables → `AI_KEYS_FROM_DB_ENABLED` → editar
a `false` → Save → Redeploy.

Riesgo: ninguno. Flag off = comportamiento idéntico al actual (env-var-only).
No se pierden datos (las keys siguen en BD cifradas).

## Riesgos identificados

1. **Caché TTL 60 s del resolver** — los procesos del backend ya corriendo
   con caché fría pueden tener `api_key=""` durante los primeros 60 s
   post-deploy. El warmup en `v2_upload_and_analyze` (main.py:973-982) lo
   pre-calienta, pero si llegan requests antes del warmup, FIX-20260812-14 los
   intercepta con mensaje user-friendly (no regresión).
2. **`ENCRYPTION_KEY` mal configurada** — si el env var de cifrado está
   corrupto o ausente, el resolver raise y FIX-20260812-14 lo intercepta con
   `M3_CREDENTIALS_UNAVAILABLE`. NO propaga el error del SDK OpenAI al usuario.
3. **Caché de procesos pre-existentes** — el flag se lee una vez en
   `main.py:210` al import-time. Si Vercel mantiene warm lambdas, el flag
   puede quedar cacheado. **Por eso el redeploy manual es obligatorio** (no
   basta con cambiar la env var sin redeploy).

## Trazabilidad

- ADR: `context/decisions/ADR-20260809-03-GESTION-API-KEYS-IA-RUNTIME.md` §D8
- SPEC: `context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md` §9
  Rollout Fase 3
- FIX-20260812-14: `context/diagnostics/FIX-20260812-14-m3-missing-credentials.md`
- ID operativo: ROLLOUT-FLAG-20260812-01
- Fecha: 2026-08-12
- Operador: Frank
- Decisión origen: Camino A (recomendado por ATLAS)

## Próximos pasos sugeridos

Una vez validado el rollout M3:
1. Purgar/eliminar la fila `gemini` de la BD (no se usa, está vacía).
2. Purgar/eliminar la fila `dr7` redundante (DR7 sigue funcionando por env
   var; tenerla duplicada es superficie de auditoría innecesaria).
3. Evaluar activar también `GEMINI_API_KEY` en BD cuando Frank decida rotar
   la key de Gemini.