# HANDOFF ARCH-20260624-02 → SOFIA — Link de auto-alta: URL pública + trazabilidad de emisor

**Origen:** INTEGRA
**Destino:** SOFIA
**SPEC:** `context/SPECs/SPEC_ARCH-20260624-02-LINK-AUTO-ALTA-URL-PUBLICA-TRAZABILIDAD.md`
**Prioridad:** Alta (afecta UX crítica — el prospecto no puede abrir el link)
**Tipo:** FIX (bug activo en producción)

---

## TL;DR

El link de auto-alta generado por el modal "Link de auto-alta generado" (`CompanyFormModal.tsx`) sale con `http://localhost:3000/...` en lugar del dominio público de Vercel. Esto es un bug. Hay que:

1. Crear helper `getPublicBaseUrl()` con fallback a auto-vars de Vercel.
2. Añadir `?ref=<userId>` al URL cuando hay sesión (trazabilidad de emisor).
3. Tests + self-review + cierre.

El modelo Prisma **no cambia** (el campo `createdByUserId` ya existe en `CompanySelfRegistration`).

---

## Cambios concretos

### 1. Crear `frontend/src/lib/env/public-base-url.ts`

```ts
/**
 * ARCH-20260624-02: Resuelve la URL base pública con fallback jerárquico.
 *
 * Prioridad:
 *   1. NEXT_PUBLIC_BASE_URL       (override manual)
 *   2. VERCEL_PROJECT_PRODUCTION_URL  (auto: dominio custom de producción)
 *   3. VERCEL_URL                (auto: *.vercel.app)
 *   4. 'http://localhost:3000'   (dev)
 *
 * Nunca retorna trailing slash.
 * Función pura para ser testeable.
 */
export function getPublicBaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  const candidate =
    env.NEXT_PUBLIC_BASE_URL ||
    env.VERCEL_PROJECT_PRODUCTION_URL ||
    env.VERCEL_URL ||
    'http://localhost:3000'
  return candidate.replace(/\/$/, '')
}
```

**Notas de diseño:**
- `NEXT_PUBLIC_*` en el nombre del primer env para que sea seguro embebible en cliente (no aplica hoy, pero es buena práctica).
- Acepta `env` opcional para tests deterministas.
- Sin `headers()` ni request-context: debe funcionar en server action, build-time y tests.

### 2. Crear `frontend/src/lib/env/public-base-url.test.ts`

Tests mínimos (4 escenarios):

```ts
import { getPublicBaseUrl } from './public-base-url'

describe('getPublicBaseUrl', () => {
  it('CA-1: retorna NEXT_PUBLIC_BASE_URL cuando está definida', () => {
    expect(getPublicBaseUrl({ NEXT_PUBLIC_BASE_URL: 'https://mi-dominio.com' }))
      .toBe('https://mi-dominio.com')
  })

  it('CA-2: retorna VERCEL_PROJECT_PRODUCTION_URL cuando no hay override y hay dominio custom', () => {
    expect(getPublicBaseUrl({
      VERCEL_PROJECT_PRODUCTION_URL: 'https://administracion-medica-industrial.vercel.app'
    })).toBe('https://administracion-medica-industrial.vercel.app')
  })

  it('CA-3: retorna VERCEL_URL cuando no hay override ni dominio custom', () => {
    expect(getPublicBaseUrl({ VERCEL_URL: 'https://ami-git-main.vercel.app' }))
      .toBe('https://ami-git-main.vercel.app')
  })

  it('CA-4: retorna localhost:3000 en dev sin env vars', () => {
    expect(getPublicBaseUrl({})).toBe('http://localhost:3000')
  })

  it('CA-5: nunca retorna string con trailing slash', () => {
    expect(getPublicBaseUrl({ NEXT_PUBLIC_BASE_URL: 'https://mi-dominio.com/' }))
      .toBe('https://mi-dominio.com')
    expect(getPublicBaseUrl({ VERCEL_URL: 'https://foo.vercel.app/' }))
      .toBe('https://foo.vercel.app')
  })
})
```

### 3. Modificar `frontend/src/services/company.service.ts`

**Línea 144 actual:**
```ts
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'
```

**Cambio:**
```ts
import { getPublicBaseUrl } from '@/lib/env/public-base-url'
// ... dentro de generateCompanySelfRegLink (línea 124-147):
const baseUrl = getPublicBaseUrl()
const refSuffix = createdByUserId ? `?ref=${encodeURIComponent(createdByUserId)}` : ''
const url = `${baseUrl}/auto-alta/${plain}${refSuffix}`
```

**Notas:**
- Usar `encodeURIComponent` por seguridad (aunque `userId` hoy es UUID, mañana podría tener otros chars).
- Eliminar el `.replace(/\/$/, '')` inline porque el helper ya lo garantiza.
- `createdByUserId` ya está disponible en scope (viene como parámetro, línea 125).

### 4. NO tocar (validar que siguen igual)

- `frontend/src/actions/company.actions.ts:106-118` — el action ya pasa `userId` correctamente.
- `frontend/src/components/CompanyFormModal.tsx:64-72` — el modal ya muestra `result.url`, automáticamente recibirá el nuevo formato.
- `frontend/src/app/auto-alta/[token]/page.tsx` — no parsea `?ref=`, sin cambios.
- `frontend/prisma/schema.prisma` — sin cambios.

---

## Pruebas del service (opcional pero recomendado)

Si ya existen tests para `company.service.ts`, agregar 2 casos:

```ts
it('CA-6: retorna URL con ?ref=<userId> cuando hay createdByUserId', async () => {
  // mock prisma.companySelfRegistration.create
  // spy getPublicBaseUrl → retorna 'https://test.vercel.app'
  const result = await generateCompanySelfRegLink('user_abc123')
  expect(result.url).toMatch(/^https:\/\/test\.vercel\.app\/auto-alta\/.+\?ref=user_abc123$/)
})

it('CA-7: retorna URL sin ?ref= cuando createdByUserId es null', async () => {
  const result = await generateCompanySelfRegLink(null)
  expect(result.url).toMatch(/^https:\/\/test\.vercel\.app\/auto-alta\/.+$/)
  expect(result.url).not.toContain('?ref=')
})
```

---

## Validaciones obligatorias antes de cerrar

```
1. pnpm typecheck
2. pnpm test
3. pnpm lint (si existe script)
```

**NO pidas `qodo ...`** — está sunset por el proveedor. En su lugar incluye este self-review manual en tu reporte final:

- ¿El código refleja la SPEC al 100%?
- ¿Los 4+ escenarios del helper están cubiertos por tests?
- ¿El formato del URL con `?ref=` se valida en al menos un test del service?
- ¿Hay code smells evidentes (duplicación, magic strings, mutación indebida)?
- ¿Algún riesgo de regresión en el flujo público `/auto-alta/[token]` o `/solicitar-alta`?
- ¿Se rompió accidentalmente el path legacy o alguna ruta adyacente?

Al cerrar, sugiere que INTEGRA invoque a **GEMINI** (`subagent_type='gemini'`) como segunda mano de validación antes de merge.

---

## Archivos esperados al cerrar

| Estado | Ruta |
|---|---|
| NUEVO | `frontend/src/lib/env/public-base-url.ts` |
| NUEVO | `frontend/src/lib/env/public-base-url.test.ts` |
| MODIFICADO | `frontend/src/services/company.service.ts` (línea 144 + 145 aprox.) |

---

## Riesgos y aceptaciones

- **Links ya compartidos en chats/email con localhost quedan muertos** → Aceptable. La BD mantiene el token + hash; regenerar el link es 1 click en el modal.
- **`?ref=` se puede borrar al reenviar por WhatsApp** → Aceptable. La trazabilidad legal está en `CompanySelfRegistration.createdByUserId`; el ref es solo UX.
- **NEXT_PUBLIC_BASE_URL colisiona con dominio de staging futuro** → Documentar en `.env.example` (no requerido en este PR).

---

## Verificación manual post-cierre (en Vercel)

1. Generar link como ADMIN/VENDEDOR en `/companies`.
2. Confirmar que el link empieza con `https://administracion-medica-industrial.vercel.app/` (o el dominio custom si ya está configurado en Vercel).
3. Confirmar que termina con `?ref=<userId>` y que el `<userId>` coincide con el id del usuario en sesión.
4. Abrir el link en pestaña incógnito: el formulario `/auto-alta/[token]` debe cargar.
5. En Prisma Studio: `CompanySelfRegistration.createdByUserId` tiene el userId correcto.

---

**Decisión final de merge sigue siendo de INTEGRA** tras segunda mano de GEMINI.
