# SPEC ARCH-20260624-04 — Investigación y fix de bugs en flujo público de auto-alta

**ID:** ARCH-20260624-04
**Fecha:** 2026-06-30
**Tipo:** FIX (debug forense + reparación)
**Severidad:** 🔴 ALTA (bloquea el flujo público de captación de clientes)
**Reportado por:** Frank (humano) tras test E2E con Playwright
**Prereq:** `ARCH-20260624-01` (ruta pública sin token), commit `8babb03`

---

## 1. Contexto

El 2026-06-24 Frank comisionó verificar end-to-end el flujo público de auto-alta en producción. La intención era probar que `https://administracion-medica-industrial.vercel.app/solicitar-alta` permite a un prospecto darse de alta como cliente sin token ni auth.

INTEGRA ejecutó un test E2E controlado con Playwright llenando el formulario de prueba "Servicios Robles S.A. de C.V.". La página carga correctamente (gracias al fix `a0a80ab` que añadió `/solicitar-alta` a las rutas públicas del middleware).

Sin embargo, en el flujo se descubrieron **2 bugs activos** que rompen end-to-end:

### Bug A — `/api/v1/upload-only` retorna HTTP 500
Al hacer POST con un archivo PDF desde el formulario, el servidor responde **500 Internal Server Error** y el archivo queda en estado "Pendiente" sin subirse.

### Bug B — Catálogo de estados México vacío
El `<select>` de "Estado *" solo contiene la opción por defecto "Seleccionar…". El catálogo de los 32 estados no se cargó del backend. React reporta **error #418 (hydration mismatch)** porque el server renderizó 0 options y el cliente esperaba las opciones del catálogo.

---

## 2. Evidencia observada

### Bug A
```
POST https://administracion-medica-industrial.vercel.app/api/v1/upload-only
  → 500 Internal Server Error

Console (cliente):
  [ERROR] Failed to load resource: the server responded with a status of 500 ()
  @ https://administracion-medica-industrial.vercel.app/api/v1/upload-only:0
```

- Endpoint implementado en commit `8babb03` por Frank con 143 líneas (`backend/app/main.py`) + 150 líneas de tests.
- Nombre del endpoint: `/api/v1/upload-only`.
- Comportamiento esperado: recibir multipart/form-data con `key` y `file`, almacenar en bucket, retornar JSON con `key` y `file_url`.

### Bug B
```
DOM:
  <select required>
    <option>Seleccionar…</option>  ← solo esto
  </select>

Console (cliente):
  Error: Minified React error #418  (hydration mismatch)
  https://react.dev/errors/418?args[]=text&args[]=
```

- `SelfRegistrationForm` recibe `estados` array del page server component.
- `estados` viene de `listEstadosMexico()` en `frontend/src/services/company.service.ts:25-30`.
- En `/solicitar-alta/page.tsx:25` se invoca sin try/catch; falla silenciosa → array vacío → render roto.
- El mismo bug afecta a `/auto-alta/[token]` (mismo page server, mismo `listEstadosMexico`).

---

## 3. Causas probables (a verificar)

### Bug A — `/api/v1/upload-only` 500
Sin acceso directo a los logs de Vercel desde aquí, las hipótesis en orden de probabilidad:

1. **Falta de variable de entorno del bucket storage** (más probable). El endpoint probablemente intenta escribir a S3/R2/GCS usando credenciales que no están configuradas en Vercel.
2. **Permisos IAM del bucket insuficientes** para escritura desde el service account configurado.
3. **Incompatibilidad CORS** (el error 500 enmascara un 403 CORS pre-failed).
4. **Multipart parsing falla** (dependencia `python-multipart` no instalada en el runtime de Vercel).
5. **Excepción no capturada en el handler** (try/except genérico que devuelve 500 sin loggear causa raíz).

### Bug B — Catálogo vacío
1. **Tabla `estados_mexico` no poblada** con seed data (probable si la migración `20260623170000` solo creó la tabla, no los registros).
2. **`listEstadosMexico()` no lee de la tabla correcta** o filtra con un WHERE que excluye todo.
3. **Permisos del usuario de DB** no leen la tabla.

---

## 4. Plan de investigación

### Fase 1 — Recolectar evidencia (DEBUGGER)
1. Obtener logs de Vercel del último deploy (build + runtime).
2. Verificar env vars configuradas en Vercel: buscar `STORAGE_*`, `BUCKET_*`, `S3_*`, `R2_*`, `GCS_*`.
3. Inspeccionar respuesta cruda de `/api/v1/upload-only` con curl: headers, body, status.
4. Conectar a Railway PostgreSQL y verificar contenido de `estados_mexico`:
   ```sql
   SELECT COUNT(*) FROM estados_mexico;
   SELECT id, nombre FROM estados_mexico LIMIT 5;
   ```
5. Hacer el mismo `SELECT` desde el query de Railway para confirmar si la tabla tiene datos.
6. Levantar backend local (si es factible) y reproducir los 500 con stack trace completo.

### Fase 2 — Identificar causa raíz
- Bug A: analizar stack trace, comparar con código fuente (`backend/app/main.py` función `upload_only`).
- Bug B: confirmar si la tabla tiene 0 registros, o si `listEstadosMexico()` filtra/ordena incorrectamente.

### Fase 3 — Aplicar fix (SOFIA)
Dependiendo del diagnóstico:

**Bug A — escenarios posibles:**

| Escenario | Fix |
|---|---|
| Falta env var storage | Documentar env vars requeridas en `.env.example` + pedir a Frank configurarlas en Vercel |
| Permisos IAM | Rotar/actualizar service account |
| CORS | Añadir `Access-Control-Allow-Origin` y preflight handler |
| python-multipart faltante | Agregar a `backend/requirements.txt` |
| Excepción no capturada | Añadir try/except con logging detallado |

**Bug B — escenarios posibles:**

| Escenario | Fix |
|---|---|
| Tabla vacía | Crear seed migration con los 32 estados de México + al menos sus municipios principales |
| Query mal escrita | Arreglar el WHERE/ORDER BY |
| Permisos DB | Verificar connection string |

### Fase 4 — Verificación
1. Re-ejecutar el flujo E2E con Playwright (mismo script que detectó el bug).
2. Confirmar que:
   - El catálogo de estados se carga con 32 opciones.
   - Upload de PDFs retorna 200 con `file_url`.
   - Form submit retorna `{ ok: true, companyId: <uuid> }`.
3. Verificar en Prisma Studio que:
   - `Company` se creó con `origen='AUTO_ALTA'`, `estado='PENDIENTE_REVISION'`, `sellerId=null`.
   - `CompanySelfRegistration` con `channel='PUBLIC_DIRECT'`, `submittedCompanyId` apuntando al nuevo company.
   - `AuditLog` con `action='CREATE'`, `entity='Company'`.

---

## 5. Criterios de aceptación (post-fix)

| # | Criterio |
|---|---|
| CA-1 | `pnpm test` pasa todos los tests existentes (sin regresiones) |
| CA-2 | Playwright re-test del flujo `/solicitar-alta` completa el submit con "¡Registro recibido!" |
| CA-3 | El `<select>` de Estado tiene 32 opciones (los 32 estados de México) sin hydration mismatch |
| CA-4 | `POST /api/v1/upload-only` retorna 200 con JSON válido |
| CA-5 | En Railway PostgreSQL existe un `Company` con `origen='AUTO_ALTA'`, `estado='PENDIENTE_REVISION'` tras el submit |
| CA-6 | La Company resultante tiene todos los campos fiscales, rep legal, RH, CxP, facturación, XML correctamente pobladas |
| CA-7 | `AuditLog` contiene un entry `action='CREATE'` para esa Company |

---

## 6. Cambios esperados (post-diagnóstico)

### Si Bug A es por env vars faltantes
- Añadir a `backend/.env.example` las variables requeridas.
- Actualizar `context/infra/railway-deploy-notes.md` con instrucciones para Frank.

### Si Bug A es por código
- Fix en `backend/app/main.py:upload_only`.
- Test en `backend/tests/test_upload_public_scope.py` (150 líneas ya existentes).

### Si Bug B es tabla vacía
- Nueva migración Prisma: `frontend/prisma/migrations/<timestamp>_seed_estados_mexico/`
- Aplica el mismo procedimiento de FIX-20260624-05 (script SQL idempotente en `context/infra/`).

### Si Bug B es query mal escrita
- Fix en `frontend/src/services/company.service.ts:listEstadosMexico()`.

---

## 7. Riesgos

| Riesgo | Mitigación |
|---|---|
| El endpoint `/api/v1/upload-only` nunca fue probado contra producción real | El test E2E Playwright de esta SPEC es ahora parte del CI de aceptación |
| La tabla `estados_mexico` no se sembró porque depende de datos de un catálogo externo que requiere aprobación legal | Verificar si hay issues con la fuente de datos |
| Configurar env vars incorrectamente puede exponer credenciales del bucket | Usar Vercel Dashboard → Environment Variables (no commitear .env) |

---

## 8. Artefactos a generar

### Por DEBUGGER (Fase 1-2)
- `context/diagnostics/DIAG-20260624-04-bugs-flujo-publico.md` — Bitácora de investigación con:
  - Outputs de logs de Vercel
  - Queries SQL ejecutadas contra Railway
  - Respuesta cruda de curl a `/api/v1/upload-only`
  - Causa raíz identificada

### Por SOFIA (Fase 3)
- Fix commits (cantidad variable según diagnóstico)
- Tests nuevos si aplica
- Documentación actualizada

---

## 9. Micro-sprint sugerido (orden)

1. **DEBUGGER** (30 min estimado):
   - Recolectar logs y evidencia.
   - Ejecutar SQL contra Railway.
   - Reproducir 500 con curl.
   - Entregar `DIAG-20260624-04-bugs-flujo-publico.md` con causa raíz identificada para ambos bugs.

2. **INTEGRA** (10 min):
   - Validar el diagnóstico.
   - Autorizar SPEC de fix con alcance ajustado al diagnóstico.

3. **SOFIA** (1-2h estimado según fix):
   - Implementar fix por bug (commits separados).
   - Tests + verificación local + commit.

4. **GEMINI** (10 min):
   - Auditoría del fix.

5. **INTEGRA** (5 min):
   - Merge a `origin/main` + push.

6. **E2E Playwright** (10 min):
   - Re-ejecutar el flujo completo de "Servicios Robles".
   - Confirmar que el submit funciona end-to-end.

---

## 10. Self-review obligatorio (Fase 3, SOFIA)

- ¿La causa raíz coincide con el diagnóstico de DEBUGGER?
- ¿El fix es mínimo y no introduce regresiones?
- ¿Los tests cubren el happy path + edge cases?
- ¿Las env vars nuevas están documentadas en `.env.example`?
- ¿El seed de `estados_mexico` (si aplica) es idempotente?
- ¿Hay riesgo de exponer secretos en los logs?
- ¿El flujo `/auto-alta/[token]` también queda reparado automáticamente?

---

## 11. Cierre

Una vez aplicados los fixes y verificado con Playwright:

1. Cerrar el SPEC en `PROYECTO.md` con entrada de cierre.
2. Generar `context/checkpoints/CHK_2026-06-30_BUGS-FLUIDO-PUBLICO-FIX.md` con resumen.
3. Opcionalmente, añadir el script de Playwright como `frontend/tests/e2e/auto-alta-public.spec.ts` para prevenir regresiones futuras.
