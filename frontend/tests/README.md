# Tests e2e Playwright

Documentación operativa del harness. El contrato de los tests contra la UI vive en los
`data-testid` que implementan los componentes (ver `src/components/**/MobileUnit*.tsx`,
`src/components/ProjectFormModal.tsx`, etc.).

## Arquitectura

```
playwright.config.ts
├── globalSetup: tests/global-setup.ts
│   └── carga .env.local + ejecuta scripts/seed-e2e.ts (Tenant → User ADMIN → Branch → Company → 6 MobileUnits)
├── projects:
│   ├── auth-setup (testMatch: *.setup.ts)
│   │   └── tests/auth.setup.ts: autentica ADMIN via NextAuth /api/auth/callback/credentials
│   │       y persiste tests/.auth/admin.json
│   └── chromium (dependencies: [auth-setup], storageState: tests/.auth/admin.json)
└── tests/*.spec.ts (todos los specs usan chromium con sesión ADMIN)
```

## Variables de entorno requeridas

- `DATABASE_URL` (PostgreSQL alcanzable).
- `NEXTAUTH_SECRET` (auth.ts:149 lo requiere para firmar el JWT).

Carga: `tests/global-setup.ts` parsea `.env.local` y `.env` desde `frontend/` antes de
invocar el seed.

## Comandos

```bash
# Listar tests (config check rápido)
npx playwright test --list

# Correr un test específico
npx playwright test mobile-units.spec.ts -g "7\\. Bloqueo"

# Correr todo el suite (requiere BD real)
npx playwright test
```

## Credenciales sembradas

- email: `e2e-admin@ami.test`
- password: `E2eAdmin!2026`
- role: `ADMIN`

## Fechas dinámicas

`tests/helpers/dates.ts` exporta `dynamicTestDate(offsetDays)` que devuelve
`YYYY-MM-DD` relativo a `Date.now()` UTC. Los tests que necesitan fechas futuras
(TC-3 inicio/fin, TC-4 mantenimiento, TC-7 mantenimiento+proyecto) la usan para
evitar el time-bomb que tuvo la versión anterior con fechas hardcodeadas (ver
IMPL-20260804-06 R6).

## Cambio de comportamiento colateral (R10)

A partir de IMPL-20260804-05 (commit `1b89309`), **todos los specs del proyecto
`chromium`** heredan `storageState` con sesión ADMIN. Esto significa:

- Los specs que asumen sesión nula deben sobrescribir `storageState: undefined`
  o usar un proyecto aparte sin dependencias. Ejemplos en este repo:
  `auto-alta-debug.spec.ts`, `branches-debug.spec.ts`, `companies-debug.spec.ts`,
  `companies-table-debug.spec.ts`, `vercel-sanity.spec.ts` (algunos hacen su
  propio login, otros navegan a rutas públicas).
- `flujo-completo.spec.ts` hace login manual con `TEST_USER_EMAIL` propio;
  sigue funcionando porque el JWT adicional simplemente sobreescribe la sesión.
- `example.spec.ts` navega a `https://playwright.dev` (externo) — el storageState
  heredado es irrelevante ahí.

Si añades un spec que asume "sesión nula", usa:

```ts
test.use({ storageState: undefined })
```

## Cosas que NO cubre el harness

- FireFox / Webkit (descomentar en `playwright.config.ts` requiere
  `npx playwright install firefox webkit`).
- Viewports móviles (Pixel 5 / iPhone 12 están comentados).
- Ejecución en CI contra staging (configurar `webServer` para apuntar a la URL
  de staging y deshabilitar `pnpm dev`).