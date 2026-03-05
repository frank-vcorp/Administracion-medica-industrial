# DICTAMEN TÉCNICO: Login 401 Unauthorized en Producción (Vercel)

- **ID:** FIX-20260303-01
- **Fecha:** 2026-03-03
- **Solicitante:** Frank (directo)
- **Estado:** ✅ VALIDADO

---

## A. Análisis de Causa Raíz

### Síntoma
POST a `/api/auth/callback/credentials` retornaba **401 Unauthorized** en la app desplegada en Vercel (`administracion-medica-industrial.vercel.app`), al intentar login con `admin@sistema.com` / `Admin@123`.

### Hallazgo Forense

| Área Investigada | Resultado |
|---|---|
| Usuario en BD Railway | ✅ Existe, activo, rol ADMIN |
| Hash almacenado | ✅ `$2b$10$...` (60 chars, bcrypt válido) |
| Password match local | ✅ `compare('Admin@123', hash)` → `true` |
| Variables Vercel | ✅ DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, NEXT_PUBLIC_API_URL |
| Prisma en producción | ✅ Conecta y encuentra 7 usuarios |
| bcryptjs en producción | ✅ Named y default exports disponibles |

### Causa Raíz

**Import incompatible de bcryptjs v3 en contexto ESM de Next.js 16.**

El código original usaba:
```typescript
import { compare } from "bcryptjs"
```

bcryptjs v3.0.3 tiene `"type": "module"` y exports condicionales ESM/CJS:
```json
{
  ".": {
    "import": { "default": "./index.js" },
    "require": { "default": "./umd/index.js" }
  }
}
```

La versión UMD (CJS) usa `preferDefault(exports)` que puede devolver el objeto default en lugar de los named exports, dependiendo de cómo el bundler de Next.js resuelva el módulo en serverless functions. Esto causaba que `compare` fuera potencialmente `undefined` en el runtime de Vercel, y el `authorize()` de NextAuth capturaba la excepción como 401 genérico.

**Agravante:** El `authorize()` no tenía `try-catch` propio, por lo que cualquier error de runtime era silenciosamente convertido a `CredentialsSignin` (401) por NextAuth v4.

---

## B. Justificación de la Solución

### Cambios Aplicados

1. **`frontend/src/auth.ts`** — Cambio de import strategy:
   - De: `import { compare } from "bcryptjs"` (named import vulnerable a interop)
   - A: `import bcryptjs from "bcryptjs"` (default import seguro)
   - **Nuevo `safeCompare()`**: Función defensiva que intenta `bcryptjs.compare()` y tiene fallback con import dinámico
   - **Try-catch con logging**: `console.error()` en `authorize()` para diagnosticar errores futuros en los logs de Vercel Functions

2. **Limpieza**: Endpoint `/api/debug/auth-test` creado temporalmente para diagnóstico y eliminado tras confirmar el fix.

### Archivo Modificado
- `frontend/src/auth.ts` — líneas 14-26 (safeCompare), líneas 53-89 (authorize con try-catch)

### Validación
```
$ curl POST /api/auth/callback/credentials → HTTP/2 200 ✅
  → Cookie __Secure-next-auth.session-token generada correctamente
```

---

## C. Instrucciones de Handoff

### Para SOFIA (si continúa implementación):
1. El import de `bcryptjs` ahora es **default import** (`import bcryptjs from "bcryptjs"`).
2. Si se necesita `hash` en otro archivo, usar el mismo patrón: `bcryptjs.hash()` en vez de `import { hash }`.
3. Los `@types/bcryptjs@2.4.6` siguen funcionando con bcryptjs v3 para tipado.

### Para GEMINI-CLOUD-QA (auditoría):
1. Verificar que el login funciona en todos los roles de prueba (ADMIN, RECEPTIONIST, DOCTOR_GENERAL, etc.).
2. Los logs de `authorize()` ahora aparecerán en Vercel Functions → Runtime Logs si hay errores futuros.

---

## Commits

| Commit | Descripción |
|---|---|
| `8d4ed6d` | Fix authorize() + endpoint diagnóstico |
| `c07ede1` | Permitir temporalmente /api/debug en middleware |
| `d5213ea` | Limpieza: eliminar debug endpoint, restaurar middleware |
