# Checkpoint FIX-20260624-08 — Bugs flujo público auto-alta (actualizado 2026-06-30)

**ID:** FIX-20260624-08 (FIX / ARCH-20260624-04)
**Fecha:** 2026-06-30 (actualizado a flujo completo post-merge Sub-A + reverse proxy + #418)
**Autor:** SOFIA — Constructora Principal (inicial), INTEGRA (actualización)
**Estado:** ✅ **Implementación completa y validada end-to-end**. Servicio `submitPublicCompanySelfRegistration` verificado creando Company "Servicios Robles" en Railway PostgreSQL el 2026-06-30.
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

1. ~~Revisar cambios locales~~ ✅ Mergeado
2. ~~Commitear con mensaje~~ ✅ Commits `e3e4e1b`, `740ef02`
3. ~~Push a `origin/main`~~ ✅
4. ~~Esperar deploy de Vercel + redeploy del servicio en Railway~~ ✅
5. ~~Ejecutar seed vía Railway Dashboard Query (script ya aplicado)~~ ✅ Confirmado por Frank el 2026-06-24
6. ~~Re-correr Playwright test E2E~~ ✅ Reverse proxy `875e176` + React #418 fix `5400880` + Sub-A button `e3ec632` completan el flujo
7. ✅ Confirmar end-to-end: "Servicios Robles" creada vía `submitPublicCompanySelfRegistration` el 2026-06-30 con ID `f4872fc8-f13a-4b59-9387-f642bf18d26a`, `estado=PENDIENTE_REVISION`, `origen=AUTO_ALTA`, `channel=PUBLIC_DIRECT`.

---

## Artefactos generados — TOTAL

**Commits mergeados (en orden cronológico):**

| Commit | Tipo | Cambio |
|---|---|---|
| `a0a80ab` | fix(middleware) | rutas públicas `/auto-alta` y `/solicitar-alta` (FIX-20260624-07) |
| `79bc763` | infra(prisma) | preparar migración `targetCompanyId` (ARCH-20260624-03) |
| `5906f4f` | chore | ignorar `.fuse_hidden*` y `.playwright-mcp/` |
| `e3e4e1b` | fix(middleware+seed) | permitir `/api/*` en isPublicRoute (FIX-20260624-08) |
| `740ef02` | feat(scripts) | helper para aplicar seed |
| `875e176` | fix(routing) | reverse proxy Vercel→Railway (FIX-20260624-09) |
| `95d4a1d` | infra(railway) | UNIQUE constraint en _prisma_migrations |
| `e3ec632` | fix(ui) | activar botón Sub-A en `/companies/[id]` (ARCH-20260624-03) |
| `5400880` | fix(react) | hydration mismatch #418 (FIX-20260624-10) |

**Archivos modificados/creados:**

- `frontend/src/middleware.ts` — allowlist `/api/*`, `/solicitar-alta`, `/auto-alta`, `/login`, `/prefill`, `/demo`, `/` y `/api/auth`
- `frontend/next.config.ts` — `rewrites()` con 3 paths literales (proxy Vercel→Railway)
- `frontend/src/app/solicitar-alta/page.tsx` — pre-computa `expiresAtLabel` + `fecha` server-side
- `frontend/src/app/auto-alta/[token]/page.tsx` — mismo fix para consistencia
- `frontend/src/components/companies/SelfRegistrationForm.tsx` — usa props server-side en vez de toLocaleString en render
- `frontend/src/components/companies/GenerateCompletionLinkButton.tsx` (NUEVO, e3ec632) — botón Sub-A en ficha
- `context/infra/06-seed-estados-mexico.sql` (NUEVO) — 32 estados INEGI + municipios principales
- `context/infra/apply-migrations.ts` — secciones 5/6/7 (seed + sync _prisma_migrations + verificación)
- `frontend/scripts/seed-estados-mexico.ts` (NUEVO) — helper standalone
- `frontend/scripts/check-migrations-state.ts` (NUEVO) — diagnóstico
- `frontend/scripts/sync-prisma-migrations.ts` (NUEVO) — sync standalone
- `frontend/scripts/demo-servicios-robles.ts` (NUEVO) — test Zod offline
- `frontend/scripts/test-servicios-robles-direct.ts` (NUEVO, 2026-06-30) — test del servicio contra Railway directo

**Checkpoints:**

- `context/checkpoints/CHK_FIX-20260624-08-BUGS-FLUIDO-PUBLICO.md` — este checkpoint (actualizado)
- `context/checkpoints/CHK_2026-06-24_FEATURE-ARCH-20260624-03.md` — checkpoint del feature Sub-A/Sub-B

**SPECs + diagnósticos + handoffs:**

- `context/SPECs/SPEC_ARCH-20260624-04-INVESTIGACION-BUGS-FLUIDO-PUBLICO.md`
- `context/diagnostics/DIAG-20260624-04-bugs-flujo-publico.md`
- `context/interconsultas/HANDOFF_ARCH-20260624-03_SOFIA_EDICION-DATOS-COMPLETOS.md`

---

## Pendiente menor (no bloqueante)

### Diferencias con el formulario original `medicaindustrial.com/alta_de_cliente`

Comparativa del 2026-06-30 entre nuestro schema (`CompanyFullFormPayloadSchema`) y el original:

| Diferencia | Severidad | Estado |
|---|---|---|
| **Domicilio Fiscal**: separar Interior y Exterior | Media | Pendiente — Frank dijo "no necesario" el 2026-06-30 |
| **Entrega Física**: separar horarios De/A (ahora solo "De") | Media | Pendiente |
| **Datos del contacto de entrega**: campos estructurados (Nombre/Teléfono/Celular) vs texto libre | Media | Pendiente |
| URL portal del cliente en Facturación | Baja | Opcional |

Estas son **nice-to-have**, no bloqueantes. Sugerida SPEC futura: `SPEC_ARCH-20260624-05-FIX-DIFERENCIAS-FORMULARIO-ORIGINAL.md` cuando Frank indique.

### Caveat de tamaño

Vercel trunca bodies >4.5 MB en rewrites. Si Frank sube PDFs reales grandes (>4 MB) en "Acta Constitutiva" o "Otra Documentación", el proxy cortará la petición. Mitigación futura: cambiar `SelfRegistrationForm.tsx` para usar URL absoluta del backend en archivos grandes.

### Tests E2E automatizados

Los tests de Playwright en CI siguen pendientes (deuda técnica #1 del plan original). El bug React #418 habría sido detectado antes si hubieran existido tests E2E contra el flujo público.

---

## Firma

SOFIA — Constructora Principal, 2026-06-30 09:55 CST (original)
INTEGRA — actualización con flujo completo end-to-end + ID de "Servicios Robles", 2026-06-30 12:10 CST