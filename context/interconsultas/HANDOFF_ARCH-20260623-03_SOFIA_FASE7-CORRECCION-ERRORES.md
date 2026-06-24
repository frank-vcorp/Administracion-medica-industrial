# HANDOFF ARCH-20260623-03 FASE 7 a SOFIA — Corrección 13 errores pre-existentes + instalar vitest

- ID: ARCH-20260623-03 (Fase 7 / Quality gate pre-GEMINI)
- Fecha: 2026-06-23
- De: INTEGRA - Arquitecto
- Para: SOFIA - Builder
- Estado: listo para implementacion (continuacion de Fases 1-6 ya entregadas)
- Reporte previo: SOFIA confirmo 0 errores introducidos por Fase 6; 13 errores pre-existentes bloquean typecheck limpio.

## Objetivo

Llevar `pnpm typecheck` a **0 errores** dentro del alcance del módulo Ficha Cliente v2, ejecutar la suite de tests de Fase 6 (ahora posible tras instalar `vitest`), y dejar el módulo listo para segunda mano (GEMINI). NO tocar archivos fuera del módulo Cliente v2.

## Alcance exacto

### T1 — Instalar vitest

1. Edita `frontend/package.json`. Agrega a `devDependencies`:
   - `"vitest": "^2.1.0"`
2. Ejecuta `cd frontend && npm install` (o `pnpm install` si pnpm esta disponible; el entorno actual usa `npm run` por lo que `npm install` es seguro).
3. Verifica que `npx vitest --version` funcione.

### T2 — Corregir 13 errores pre-existentes (SOLO en archivos del modulo Cliente v2)

Los 4 archivos a tocar son:

| Archivo | Errores | Causa raiz |
|---|---|---|
| `frontend/src/actions/company.actions.ts` | 4 | `import * as CompanyService` no detecta exports del service |
| `frontend/src/auth.ts` | 1 | Tipo `UserRole` en declaracion de NextAuth no incluye `VENDEDOR` |
| `frontend/src/lib/schemas/company-full-form.ts` | 4 | Zod v4 removio `errorMap`; `z.literal(true, { errorMap })` no compila |
| `frontend/src/services/company.service.ts` | 4 | `error.errors` -> `error.issues`; `findUnique({ where: { rfc } })` invalido; tipo `Literal` no asignable a `boolean` |

#### T2.1 — `company.actions.ts`

Errores verbatim:
```
src/actions/company.actions.ts(28,33): error TS2339: Property 'getCompanies' does not exist
src/actions/company.actions.ts(32,33): error TS2339: Property 'getCompanyById' does not exist
src/actions/company.actions.ts(36,42): error TS2339: Property 'createCompany' does not exist
src/actions/company.actions.ts(42,42): error TS2339: Property 'updateCompany' does not exist
```

**Causa**: el archivo importa `* as CompanyService from '@/services/company.service'` pero el service probablemente exporta con `export async function` en vez de `export const`. TS2339 indica que el namespace `CompanyService` no expone esas keys.

**Fix recomendado** (elige el menos invasivo):

Opcion A (preferida): abrir `frontend/src/services/company.service.ts` y reemplazar `export const getCompanies = async () => {...}` etc. por `export async function getCompanies() {...}`. Verifica que todas las funciones publicas del service (`getCompanies`, `getCompanyById`, `createCompany`, `updateCompany`, `deleteCompany`, `changeCompanySeller`, `generateCompanySelfRegLink`, `validateCompanySelfRegToken`, `registerSelfRegFile`, `submitCompanySelfRegistration`, `reviewAndEnableCompany`, `toggleCompanyEnabled`, `listCompaniesWithFilters`, `getCompanySellerHistory`, `listActiveSellers`, `listEstadosMexico`, `isCompanyOperativa`, `hashToken`, `generateSelfRegToken`, `assertRfcNotRegistered`, `assertUserIsActive`) usen `export async function` o `export function`.

Opcion B (si A rompe algo): cambiar el import en `company.actions.ts` a named imports:
```ts
import { getCompanies, getCompanyById, createCompany, updateCompany } from '@/services/company.service'
```

Reporta en tu self-review cual opcion usaste y por que.

#### T2.2 — `auth.ts`

Error verbatim:
```
src/auth.ts(51,13): error TS2322: Type 'UserRole' is not assignable to type '"ADMIN" | ... | "COMPANY_CLIENT"'.
  Type '"VENDEDOR"' is not assignable to type '"ADMIN" | ... | "COMPANY_CLIENT"'.
```

**Causa**: hay una declaracion de tipo local o un type assertion que restringe `UserRole` a los 6 valores originales, sin incluir `VENDEDOR`.

**Fix**: busca en `frontend/src/auth.ts` y archivos relacionados (`next-auth.d.ts` si existe en el proyecto) donde se declare el union type de `role`. Reemplaza la lista hardcodeada por inclusion del enum Prisma completo. Patron recomendado:

```ts
import { UserRole } from '@prisma/client'
// ...
role: user.role as UserRole
```

O declara el type module de NextAuth con:
```ts
declare module "next-auth" {
  interface User {
    role: UserRole  // importar de @prisma/client
  }
}
```

Si ya existe un `next-auth.d.ts`, editalo. Si no existe, crealo en `frontend/src/types/next-auth.d.ts` con el `declare module`.

#### T2.3 — `company-full-form.ts`

Errores verbatim:
```
src/lib/schemas/company-full-form.ts(87,14): error TS2769: 'errorMap' does not exist
src/lib/schemas/company-full-form.ts(90,17): error TS2769: 'errorMap' does not exist
src/lib/schemas/company-full-form.ts(165,16): error TS2769: 'errorMap' does not exist
src/lib/schemas/company-full-form.ts(183,24): error TS2769: 'errorMap' does not exist AND Argument of type 'boolean' is not assignable to parameter of type 'readonly Literal[]'
```

**Causa**: Zod v4 (instalado como `^4.3.6`) removio `errorMap`. Reemplazar por `error` (string o funcion).

**Fix**: en `frontend/src/lib/schemas/company-full-form.ts`:

1. Buscar todas las ocurrencias de `errorMap: (issue) => ({ message: '...' })` o `errorMap: () => ({...})`.
2. Reemplazar por `error: 'mensaje aqui'` (string directo).
3. Para la linea 183 (literal `true` con `errorMap`): usar `z.literal(true, { error: 'Debe aceptar terminos' })` y verificar que el tipo de retorno sea compatible con el schema padre. Si el schema padre espera `z.boolean()`, ajustar a `z.boolean().refine(v => v === true, { message: 'Debe aceptar terminos' })`.

Despues de los cambios, ejecuta `npm test -- company-full-form` para verificar que los 9 tests siguen pasando. Si algun test falla por cambio de API de Zod, ajusta el test (NO el schema) para usar `.issues` en vez de `.errors` si aplica.

#### T2.4 — `company.service.ts`

Errores verbatim:
```
src/services/company.service.ts(163,27): error TS2339: Property 'errors' does not exist on type 'ZodError'
src/services/company.service.ts(163,39): error TS7006: Parameter 'e' implicitly has an 'any' type
src/services/company.service.ts(171,41): error TS2345: 'where: { rfc: string }' not assignable to CompanyWhereUniqueInput (Property 'id' missing)
src/services/company.service.ts(214,11): error TS2322: Type 'Literal' is not assignable to type 'boolean | null | undefined'
```

**Fix**:

1. Linea 163: cambiar `e.errors` por `e.issues` (Zod v4). Agregar tipo explicito al parametro: `catch (e: unknown)` o `catch (e) { const err = e as ZodError; ... }`.

2. Linea 171: cambiar `prisma.company.findUnique({ where: { rfc } })` por `prisma.company.findFirst({ where: { rfc } })`. RFC no es unique en schema (es `String?`), por lo tanto `findFirst` es el metodo correcto.

3. Linea 214: el campo `terminosAceptados` se asigna con valor `payload.terminosAceptados` pero el schema lo define como `z.literal(true)`. Cambiar el tipo del campo en Prisma update a `as boolean` o ajustar la extraccion del payload para hacer coerce. Patron recomendado:
```ts
terminosAceptados: payload.terminosAceptados === true
```

### T3 — NO tocar archivos fuera del modulo

Los siguientes archivos tienen errores pre-existentes en `lint` (29) y `typecheck` (algunos). NO los corrijas en este pase; quedan en backlog para INTEGRA/CRONISTA:

- `frontend/src/components/clinical/DoctorExamForm.tsx`
- `frontend/src/components/clinical/TriageForm.tsx`
- `frontend/src/types/events.ts`
- `frontend/src/app/api/auth/[...nextauth]/...`
- `frontend/tests/vercel-sanity.spec.ts`
- Cualquier otro archivo que NO este en la lista de T2.

### T4 — Validaciones obligatorias

```bash
cd frontend && npm run typecheck
cd frontend && npm test -- --run
cd frontend && npm run lint
```

**Criterio de cierre**:
- `typecheck`: **0 errores totales** (los 13 corregidos + 0 nuevos).
- `test`: **todos los tests de Fase 6 pasan** (12 tests: 9 de company-full-form + 3 de company.service).
- `lint`: puede mantener errores pre-existentes fuera del modulo; documenta cuantos quedan.

Reporta el **output literal completo** de cada comando. NO resumas.

### T5 — Checkpoint

Crea `context/checkpoints/CHK_IMPL-20260623-03-FASE7-CORRECCION-TYPECHECK.md` con:

1. Output literal de las 3 validaciones (pega el stdout/stderr completo).
2. Tabla con los 13 errores originales y la linea exacta del fix.
3. Conteo de errores `lint` pre-existentes que quedan fuera del modulo (para backlog).
4. Confirmacion de que los tests pasan.

## Restricciones duras

1. NO modifiques archivos fuera de los 4 listados en T2 + `package.json` + `next-auth.d.ts` (si lo creas).
2. NO introduzcas dependencias nuevas excepto `vitest` (autorizado en T1).
3. NO hagas commit, push ni PR.
4. NO borres archivos.
5. NO modifiques variables de entorno.
6. Si encuentras errores ADICIONALES al corregir estos 13 (cascada), documenta cada uno pero NO los corrijas salvo que sean trivialmente del mismo archivo (mismo `company-full-form.ts` o `company.service.ts`).

## Self-review (5 preguntas en reporte final)

1. ¿Que opcion usaste en T2.1 (A: `export async function` en service, o B: named imports en actions)? Por que?
2. ¿Como resolviste el tipo `UserRole` en `auth.ts`? Pega el diff de la declaracion.
3. ¿Cuantos tests pasan y cuantos fallan? Si alguno fallo por cambio de API, que test y por que?
4. Errores `lint` que quedan pre-existentes: lista por archivo y conteo.
5. Output literal de las 3 validaciones (pega stdout completo).

## Reporte final (estructura obligatoria)

- Resumen 1-2 lineas.
- Archivos modificados/creados SOLO de Fase 7 (lista exacta).
- Output literal completo de `npm run typecheck`, `npm test -- --run`, `npm run lint`.
- Self-review 5 preguntas.
- Errores `lint` pre-existentes restantes (para backlog CRONISTA).
- Sugerencia explicita de invocar GEMINI como segunda mano.

NO invoques GEMINI tu mismo. NO commit, push ni PR.

## Regla global INTEGRA

Tu reporte final llega a INTEGRA, NO al usuario humano. INTEGRA notificara al usuario con formato visual y esperara OK explicito antes de commit/push.
