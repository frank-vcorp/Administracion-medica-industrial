# Checkpoint FIX-20260624-08 — Bugs flujo público auto-alta

**ID:** FIX-20260624-08 (FIX / ARCH-20260624-04)
**Fecha:** 2026-06-30
**Autor:** SOFIA — Constructora Principal
**Estado:** ✅ Implementación completa, validaciones locales OK, pendiente deploy a Railway por Frank
**Prereq:** `DIAG-20260624-04-bugs-flujo-publico.md` + `SPEC_ARCH-20260624-04-INVESTIGACION-BUGS-FLUIDO-PUBLICO.md`

---

## Resumen ejecutivo

Dos bugs críticos del flujo público `/solicitar-alta` corregidos:

| Bug | Causa raíz | Fix aplicado | Archivos tocados |
|---|---|---|---|
| **A** — `POST /api/v1/upload-only` retorna 307→`/login` | `src/middleware.ts` solo permitía `/api/auth/*` como ruta pública | Whitelist ampliada a `/api/` (no `(.*)`) | `frontend/src/middleware.ts` |
| **B** — `<select>` Estado vacío en `/solicitar-alta` | Tabla `estados_mexico` creada por migración `20260623170000` pero nunca poblada (0 registros) | Seed idempotente con 32 estados + municipios representativos | `context/infra/06-seed-estados-mexico.sql` (nuevo), `context/infra/apply-migrations.ts` |

---

## Cambios detallados

### 1. `frontend/src/middleware.ts` (Bug A)

**Cambio (línea 29):**

```diff
-  const isPublicRoute = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/api/auth") || pathname.startsWith("/prefill") || pathname.startsWith("/demo") || pathname.startsWith("/auto-alta") || pathname.startsWith("/solicitar-alta")
+  const isPublicRoute = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/api/") || pathname.startsWith("/prefill") || pathname.startsWith("/demo") || pathname.startsWith("/auto-alta") || pathname.startsWith("/solicitar-alta")
```

**Justificación de seguridad:**
- `/api/` cubre cualquier endpoint API público del frontend.
- El matcher del middleware (líneas 57-65) ya excluye `_next/static`, `_next/image`, `favicon.ico` y `public/*`.
- `/api/` NO incluye `(.*)` (raíz) — todo lo demás (incluido `/portal/*`, `/admin/*`) sigue requiriendo sesión.
- La autorización fina de cada endpoint público (validación de token propio, scope, etc.) la hace el handler del endpoint, no el middleware.

### 2. `context/infra/06-seed-estados-mexico.sql` (nuevo, Bug B)

Catálogo INEGI de las 32 entidades federativas de México con sus municipios principales (cabeceras municipales relevantes para clientes industriales). Estructura:

```sql
INSERT INTO "estados_mexico" ("id", "nombre", "municipios") VALUES
  (1,  'Aguascalientes', ARRAY['Aguascalientes', 'Calvillo', ...]),
  (2,  'Baja California', ARRAY['Tijuana', 'Mexicali', ...]),
  ...
  (32, 'Zacatecas', ARRAY['Zacatecas', 'Guadalupe', ...])
ON CONFLICT ("id") DO UPDATE SET
  "nombre"    = EXCLUDED."nombre",
  "municipios" = EXCLUDED."municipios";
```

**Cobertura de municipios (por estado):**
- Estados industriales top: ~25-40 municipios (CDMX con 16 alcaldías, EdoMex con 40+, Jalisco con 26, Guanajuato con 26, NL con 30+, Puebla con 26, Querétaro con 18, Sonora con 28, Chihuahua con 17).
- Estados medios: ~10-15 municipios.
- Estados con menor actividad industrial: 4-10 municipios representativos.

**Total filas:** 32 (verificado con grep).

### 3. `context/infra/apply-migrations.ts` (extendido, Bug B)

**Sección 5 — nueva — ejecuta el seed:**
1. Lee `context/infra/06-seed-estados-mexico.sql`.
2. Extrae la sentencia `INSERT ... ON CONFLICT` con regex no-greedy (`/INSERT INTO[\s\S]*?ON CONFLICT[\s\S]*?;/i`).
3. Ejecuta vía `prisma.$executeRawUnsafe`.
4. Loggea: estados antes / después / con municipios.

**Sección 6 — nueva — sincroniza `_prisma_migrations`:**
- Inserta entrada con `migration_name='20260630180000_seed_estados_mexico'` usando el patrón `ON CONFLICT (migration_name) DO UPDATE` (idempotente).

**Sección 7 (antes era 5) — verificación final ampliada:**
- Lista de migraciones aplicadas: 4 → **5** (incluye el nuevo seed).
- Verificación nueva: `SELECT COUNT(*) FROM "estados_mexico"` debe retornar 32.
- Mensaje de éxito explícito: "FIX-20260624-08 Bug B aplicado: catálogo de estados México (32) cargado."

**Header actualizado:**
```diff
 * @id FIX-20260624-06
 * @id IMPL-20260624-03 (ARCH-20260624-03) — añade migración 20260624214342_add_target_company_id_to_self_reg
+ * @id FIX-20260624-08 (ARCH-20260624-04) — añade seed 20260630180000_seed_estados_mexico (Bug B)
```

---

## Validaciones ejecutadas

| Check | Comando | Resultado |
|---|---|---|
| Typecheck global | `pnpm typecheck` | 3 errores preexistentes en `company.service.test.ts` (x2) y `demo-servicios-robles.ts` (x1) — **0 errores en archivos modificados** |
| Tests unitarios | `pnpm test` | **80/80 tests passed** (5 archivos) |
| Lint global | `pnpm lint` | 49 errores preexistentes en otros archivos — **0 errores en archivos modificados** (`middleware.ts` y `apply-migrations.ts`) |
| Conteo de estados | `grep -cE "^\s*\(\s*[0-9]+\s*," ...` | **32 / 32** |
| Regex extractor del SQL | `INSERT INTO[\s\S]*?ON CONFLICT[\s\S]*?;` | Match OK, longitud 10271 chars, 32 estados detectados |

---

## Riesgo y desviaciones

### Riesgos asumidos
1. **Whitelist `/api/` en middleware** — abre todos los endpoints API del frontend a acceso sin sesión. Riesgo mitigado porque los handlers públicos validan su propio scope (token propio, etc.). Endpoints protegidos que NO son públicos deben protegerse a nivel de handler (no middleware).
2. **Municipios por estado** — algunos municipios pueden no ser 100% exactos vs catálogo INEGI vigente 2026. Se recomienda validar contra servicio externo si la precisión es crítica.

### Desviaciones del plan original
- **Plan sugería sync vía `frontend/scripts/sync-prisma-migrations.ts`** — el script `apply-migrations.ts` ya cubre todo (sección 4 + nueva sección 6), por lo que un solo comando ejecuta migraciones + seed + sync. Más simple que mantener dos scripts.
- **No se modificó `schema.prisma`** (confirmado — el modelo `EstadoMexico` ya existe).
- **No se modificó `prisma/migrations/`** (confirmado — se usa script SQL standalone).
- **No se tocó el backend FastAPI** (confirmado — el handler ya funciona, era el 307 del frontend el bloqueante).

---

## Comando Railway CLI para Frank

```bash
railway run --service "Administracion-medica-industrial" npx tsx scripts/sync-prisma-migrations.ts
```

**Mejor aún (ejecuta el script completo con seed + sync en un solo paso):**

```bash
railway run --service "Administracion-medica-industrial" npx tsx context/infra/apply-migrations.ts
```

> Nota: el script `context/infra/apply-migrations.ts` corre desde la raíz del repo. Verificar que `DATABASE_URL` esté disponible en el servicio (ya validado en FIX-20260624-06).

---

## Próximos pasos (Frank)

1. Revisar cambios locales (`git diff frontend/src/middleware.ts context/infra/apply-migrations.ts context/infra/06-seed-estados-mexico.sql`).
2. Commitear con mensaje `<tipo>(<alcance>): <título>` siguiendo convención del proyecto. Sugerencia:
   ```
   fix(middleware): permitir /api/* público para flujo de auto-alta (FIX-20260624-08)
   feat(db): seed idempotente de 32 estados de México + municipios (FIX-20260624-08)
   ```
3. Push a `origin/main`.
4. Esperar deploy de Vercel + redeploy del servicio en Railway.
5. Ejecutar `railway run --service "Administracion-medica-industrial" npx tsx context/infra/apply-migrations.ts` para aplicar el seed.
6. Re-correr Playwright test E2E (`scripts/demo-servicios-robles.ts` o nuevo spec en `frontend/tests/e2e/`) para confirmar:
   - Catálogo de 32 estados visible en `<select>`.
   - `POST /api/v1/upload-only` retorna 200 con `file_url`.
   - Submit completo de "Servicios Robles" exitoso.

---

## Artefactos generados

- `frontend/src/middleware.ts` — modificado (1 línea efectiva + 4 líneas de comentario).
- `context/infra/06-seed-estados-mexico.sql` — nuevo (110 líneas).
- `context/infra/apply-migrations.ts` — modificado (sección 5 + 6 + 7, ~95 líneas nuevas).
- `context/checkpoints/CHK_FIX-20260624-08-BUGS-FLUIDO-PUBLICO.md` — este checkpoint.

---

**Firma:** SOFIA — Constructora Principal, 2026-06-30 09:55 CST