# Diagnóstico ARCH-20260624-04 — Bugs flujo público auto-alta

**Fecha:** 2026-06-30
**Investigador:** INTEGRA (delegado directo por Frank)
**Estado:** ✅ Causas raíz identificadas (ambos bugs)
**Próximo paso:** FIX por SOFIA (ver `SPEC_ARCH-20260624-04`)

---

## Resumen ejecutivo

| Bug | Severidad | Causa raíz | Fix |
|---|---|---|---|
| **A** — `POST /api/v1/upload-only` HTTP 500 (en realidad 307) | 🔴 CRÍTICO | Middleware `src/middleware.ts` no incluye `/api/v1/*` (excepto `/api/auth`) en `isPublicRoute`. Redirige a `/login` con HTTP 307 → Playwright lo interpreta como error. | Añadir `/api/v1/` (o `/api/`) a la whitelist del middleware. |
| **B** — Catálogo de estados México vacío en `<select>` | 🟡 MEDIO | Tabla `estados_mexico` fue creada por la migración `20260623170000` pero nunca se pobló con los 32 estados. Falta un seed. | Crear migración seed idempotente con los 32 estados + municipios principales, aplicar vía `apply-migrations.ts`. |

---

## Bug A — `POST /api/v1/upload-only` HTTP 307 redirect

### Causa raíz: middleware bloqueante

**Evidencia 1 — Respuesta cruda con curl (2026-06-30 15:43 UTC):**
```http
POST https://administracion-medica-industrial.vercel.app/api/v1/upload-only
Body: multipart/form-data (file=constancia_fiscal.pdf, key=test/x.pdf)

HTTP/2 307
location: /login
server: Vercel
x-vercel-id: sfo1::ppgx4-1782834185250-ef740748c74a
```

**El endpoint NO retorna 500.** Retorna **HTTP 307 con `Location: /login`**. El browser de Playwright sigue el redirect, llega a `/login` como GET, y reporta error (probablemente 404 o CSP violation que se manifiesta como 500).

**Evidencia 2 — Configuración del backend:**
```python
# backend/app/main.py líneas 609-643
try:
    contents = await file.read()
    if _s3_enabled and _upload_file_to_s3(contents, target_filename):
        return {"status": "success", "key": target_filename, "file_url": ...}
    # Fallback local
    local_path = os.path.join(UPLOAD_DIR, target_filename)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, "wb") as f:
        f.write(contents)
    return {"status": "success", ...}
except Exception as e:
    print(f"❌ Error en upload-only: {e}")
    return {"status": "error", "error": str(e)}
```

El handler tiene `try/except` y retorna 200 con `status: error`. **No es el problema.**

**Evidencia 3 — Variables de entorno del servicio** (`railway variables --service "Administracion-medica-industrial"`):
- `STORAGE_S3_ACCESS_KEY` ✓ `tid_RCYyuVwO...`
- `STORAGE_S3_BUCKET` ✓ `shelved-pod-d66dcokrpe-ik`
- `STORAGE_S3_ENDPOINT` ✓ `https://t3.storageapi.dev`
- `STORAGE_S3_REGION` ✓ `auto`
- `STORAGE_S3_SECRET_KEY` ✓ `tsec_IF-NXD...`
- `UPLOAD_DIR` ✓ `/uploads`
- Sin `DATABASE_URL` (conexión via Railway internal).

**El backend tiene todas las env vars necesarias.** El problema NO es storage.

**Evidencia 4 — Configuración del frontend:**
```bash
$ cat frontend/next.config.ts
const nextConfig: { /* Enable server actions */ };
```

`next.config.ts` no tiene rewrites. **Significa que `/api/v1/upload-only` se sirve contra Vercel (Next.js), no contra el backend Python.**

Pero el endpoint está implementado en FastAPI (`backend/app/main.py`), no en Next.js. Hay una desconexión arquitectónica: **el frontend hace POST a `/api/v1/upload-only` en el host de Vercel, pero ese endpoint no existe en el frontend**.

### Pregunta arquitectónica adicional

¿Cómo resolvió Frank el endpoint `upload-only`? El commit `8babb03` dice:
- `feat: implement public upload-only and file serving endpoints for self-registration without token (ARCH-20260624-01)`
- Modifica `backend/app/main.py` (FastAPI) 143 líneas
- Añade tests en `backend/tests/test_upload_public_scope.py`

**Pero el frontend hace `fetch('/api/v1/upload-only', ...)`** desde el código cliente (browser). Sin un proxy/reverse proxy apuntando al backend FastAPI, ese endpoint nunca se ejecuta en Vercel.

### Causa raíz confirmada

**Bug A tiene 2 componentes:**

1. **Middleware bloqueante** (causa inmediata del 307):
   - `frontend/src/middleware.ts:23` solo permite `/api/auth/*` como ruta pública.
   - CUALQUIER otro `/api/*` se redirige a `/login`.

2. **Discrepancia arquitectónica** (causa profunda — requiere reverse proxy o mover endpoint al frontend):
   - El endpoint está en FastAPI (`backend/app/main.py`), pero el frontend lo llama contra el mismo host de Vercel.
   - Para que funcione, hace falta: o (a) reverse proxy en `next.config.ts`, o (b) reescribir el endpoint en Next.js, o (c) cambiar el `fetch` del cliente para apuntar al host de Railway del backend.

### Fix mínimo viable (Prioridad 1)

**Añadir `/api/v1/` a `isPublicRoute` en `src/middleware.ts`** — esto resuelve el 307 redirect (el endpoint al menos será alcanzable).

### Fix completo (Prioridad 2 — separar)

Esto requiere decisión arquitectónica con Frank. Opciones:

| Opción | Effort | Trade-off |
|---|---|---|
| **A1**. Reverse proxy en `next.config.ts` que redirija `/api/v1/upload-only` y `/api/v1/files/[...]` al backend FastAPI | Bajo (5 líneas config) | Funciona pero requiere que el servicio backend sea público o accesible desde Vercel |
| **A2**. Reimplementar endpoint en Next.js (route handler en `app/api/v1/upload-only/route.ts`) | Medio (migrar lógica Python a TypeScript) | Stack unificado, sin proxy |
| **A3**. Hardcodear URL del backend en el frontend (`fetch('https://backend-host/api/v1/upload-only', ...)`) | Bajo | Funciona pero rompe el patrón same-origin |

**Recomendación:** A1 (reverse proxy) si el backend FastAPI es accesible públicamente, si no A3 (URL hardcodeada del backend en cliente).

---

## Bug B — Catálogo de estados México vacío

### Causa raíz: tabla sin seed

**Evidencia 1 — Render del cliente** (Playwright snapshot):
```yaml
- generic [ref=e316]:
  - generic [ref=e317]:
    - text: Estado *
    - combobox [ref=e318]:
      - option "Seleccionar…" [selected]   ← SOLO ESTA OPCIÓN
```

**Evidencia 2 — React hydration error:**
```
Console: Error: Minified React error #418 (hydration mismatch)
https://react.dev/errors/418?args[]=text&args[]=
```

El server renderizó 0 options y el cliente esperaba el catálogo. Lo que pasa:
- Server: `await listEstadosMexico()` → retorna `[]` → render con 1 option "Seleccionar…"
- Cliente: re-render con `estados=[]` → no hay cambio → **PERO** las props que recibió del server eran distintas.

**Evidencia 3 — Service code (`frontend/src/services/company.service.ts:770-772`):**
```ts
export async function listEstadosMexico() {
  return prisma.estadoMexico.findMany({ orderBy: { nombre: 'asc' } })
}
```

Service trivial: solo consulta la tabla. Si retorna `[]`, la tabla está vacía.

**Evidencia 4 — Modelo existe en schema.prisma:**
```prisma
model EstadoMexico {
  id         Int      @id // clave INEGI
  nombre     String
  municipios String[] // nombres comunes
}
```

**Evidencia 5 — Migración `20260623170000`** (en `context/infra/apply-migrations.ts:297-308`):
```ts
if (!(await checkTable("estados_mexico"))) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE "estados_mexico" (
      "id"        INTEGER NOT NULL,
      "nombre"    TEXT NOT NULL,
      "municipios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      CONSTRAINT "estados_mexico_pkey" PRIMARY KEY ("id")
    )
  `)
}
```

**La migración crea la tabla pero NO inserta ningún registro.** No hay INSERT INTO para los 32 estados.

### Causa raíz confirmada

**La tabla `estados_mexico` está creada pero vacía.** `listEstadosMexico()` retorna `[]` honestamente.

### Verificación adicional intentada (sin éxito)

- `psql` no está instalado en el contenedor local ni en Railway (`bash: psql: orden no encontrada`)
- `pg` package no está en `frontend/node_modules`
- `railway run --service "Postgres"` con auth rotativa del proxy público no funciona

**No pude contar registros exactos**, pero toda la evidencia indirecta apunta a **0 registros**.

### Fix

**Crear nueva migración Prisma con seed de los 32 estados de México + sus municipios principales** (al menos los 10 con más actividad industrial: Querétaro, Estado de México, CDMX, Jalisco, Nuevo León, Puebla, Guanajuato, Coahuila, Chihuahua, Sonora).

Procedimiento (siguiendo el patrón FIX-20260624-05):
1. Modificar `frontend/prisma/schema.prisma` para añadir un `prisma.estadoMexico.createMany(...)` o mejor: crear un script de seed SQL idempotente.
2. Crear migración `frontend/prisma/migrations/<TIMESTAMP>_seed_estados_mexico/`.
3. Crear script idempotente en `context/infra/06-seed-estados-mexico.sql` con todos los `INSERT INTO ... ON CONFLICT DO NOTHING`.
4. Aplicar a Railway con el procedimiento estándar (`apply-migrations.ts` extendido + sync `_prisma_migrations`).

---

## Comandos ejecutados (bitácora)

```bash
# Verificar env vars del servicio frontend en Vercel
railway variables --service "Administracion-medica-industrial"

# Leer backend handler de upload
grep -B 2 -A 65 "upload_only\b" backend/app/main.py

# Verificar deps Python
cat backend/requirements.txt

# Encontrar service function
grep -n "listEstadosMexico\|estados_mexico" frontend/src/services/company.service.ts

# Verificar modelo Prisma
grep -A 5 "model EstadoMexico" frontend/prisma/schema.prisma

# Reproducir Bug A con curl (crítico)
curl -v -X POST https://administracion-medica-industrial.vercel.app/api/v1/upload-only \
     -F "file=@.playwright-mcp/dummy-pdfs/constancia_fiscal.pdf" \
     -F "key=test/x.pdf"
# → HTTP/2 307, location: /login (← CONFIRMADO BUG A)

# Verificar si /api/v1 está en middleware whitelist
grep -n "isPublicRoute\|startsWith.*api\|startsWith.*auto-alta\|startsWith.*solicitar" frontend/src/middleware.ts
```

## Recomendaciones para el fix (FIX-20260624-08)

### Para Bug A

**Fix inmediato (puede ir solo):**
```diff
// frontend/src/middleware.ts línea 23
- const isPublicRoute = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/api/auth") || ...
+ const isPublicRoute = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/api/") || ...
```

**Fix arquitectónico (separado):** decidir entre A1/A2/A3 arriba con Frank.

### Para Bug B

Crear archivo `context/infra/06-seed-estados-mexico.sql` con INSERT idempotente:
```sql
INSERT INTO estados_mexico (id, nombre, municipios) VALUES
  (1, 'Aguascalientes', ARRAY['Aguascalientes','Calvillo','Jesús María','San Francisco de los Romo']),
  (2, 'Baja California', ARRAY['Tijuana','Mexicali','Ensenada','Rosarito','Tecate']),
  ...
  -- 32 estados totales
ON CONFLICT (id) DO NOTHING;
```

Extender `apply-migrations.ts` con nueva sección.

Aplicar vía Railway CLI.

---

## Riesgos y notas

1. **El fix de middleware debe limitarse a `/api/v1/` o `/api/`** — NO abrir `/(.*)` que haría todo público.
2. **El seed debe usar `ON CONFLICT DO NOTHING`** para ser idempotente.
3. **El catálogo debe incluir municipios principales** por estado (al menos los más industrializados), porque el modelo los pide (`municipios: String[]`).
4. **Frank debe confirmar si la política de la empresa** permite mostrar el catálogo completo de estados en el formulario público (probablemente sí — es info pública del SAT/INEGI).
5. **Trazabilidad**: documentar en `PROYECTO.md` que ambos bugs existían desde `8babb03` y fueron descubiertos por test E2E Playwright el 2026-06-30.
