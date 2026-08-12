# FIX-20260812-16 — Deploy verification & rollback

## Cambios
- `frontend/next.config.ts`: rewrite catch-all `/api/v2/:path*` → Railway backend.

## Verificación post-deploy Vercel (CRÍTICO)

El fix NO surte efecto hasta que Vercel redespliegue el frontend (auto-deploy
al detectar push a `main`, típicamente 30-90s).

### Check 1: ¿Vercel ya reescribe /api/v2/*?

```bash
# Debe retornar HTTP 200 con JSON del status IA (no HTML 404 de Next.js)
curl -s -o /dev/null -w "%{http_code}\n" \
  'https://administracion-medica-industrial.vercel.app/api/v2/ai/status' \
  -H 'x-ami-role: SUPERADMIN'
```

- **200** = rewrite funciona, fix operativo ✅
- **404** = Vercel aún no redesplegó. Esperar 60-90s y reintentar.

### Check 2: ¿El frontend sigue funcionando?

Cargar `https://administracion-medica-industrial.vercel.app/` y verificar que
la UI principal renderiza correctamente. Si hay error 500, rollback inmediato.

### Check 3: ¿El flujo de subida funciona?

1. Login en producción.
2. Ir a un evento `IN_PROGRESS` con estudio "Pendiente de resultado de prueba".
3. Subir un PDF de prueba.
4. Verificar que NO aparece `M3_CREDENTIALS_UNAVAILABLE`.

## Solución inmediata (alternativa, no requiere redeploy de Vercel)

Si Frank quiere que funcione YA sin esperar el redeploy de Vercel:

1. Vercel Dashboard → Settings → Environment Variables → Add:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://administracion-medica-industrial-production.up.railway.app`
   - Environment: Production
2. Redeploy manual en Vercel → Deployments → último → Redeploy.

Esto hace que los Server Actions (`PYTHON_API = NEXT_PUBLIC_API_URL || 'http://localhost:8000'`)
usen Railway directo, bypaseando el proxy de Vercel. Funciona incluso con el
bundle viejo (FIX-20260812-16 aún no aplicado).

## Rollback

Si el rewrite catch-all causa algún problema (ej. conflicto con otra ruta del
frontend), revertir con:

```bash
git revert 745188d
git push
```

Vercel redesplegará automáticamente.

## Trazabilidad
- Commit: `745188d`
- FIX-ID: FIX-20260812-16
- Tipo: Frontend (next.config.ts)
- Riesgo: bajo (solo agrega regla de rewrite)
- Reversibilidad: alta (git revert)