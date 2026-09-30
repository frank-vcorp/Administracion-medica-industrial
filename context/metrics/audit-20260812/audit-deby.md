# FIX-20260812-01: Auditoría Atlas vs Manus

## Metadata
- **ID:** FIX-20260812-01
- **Fecha:** 2026-08-12
- **Auditor:** DEBY (DEBUGGER)
- **Método:** lectura estática (sin ejecución, sin instalar dependencias, sin correr tests). Verificación auxiliar solo con `ls`, `wc -l` y grep de patrones (solo lectura).
- **Archivos auditados A (Atlas, 9 archivos, 443 líneas medidas):**
  - `atlas-output/package.json` (26 lín.)
  - `atlas-output/tsconfig.json` (23 lín.)
  - `atlas-output/README.md` (90 lín.)
  - `atlas-output/src/index.ts` (34 lín.)
  - `atlas-output/src/routes/todos.ts` (58 lín.)
  - `atlas-output/src/schemas/todo.ts` (12 lín.)
  - `atlas-output/src/storage/jsonStore.ts` (91 lín.)
  - `atlas-output/src/types/todo.ts` (9 lín.)
  - `atlas-output/tests/todos.test.ts` (100 lín.)
- **Archivos auditados B (Manus, 9 archivos de código + 1 de métricas, 413 líneas medidas sin TIMING.md):**
  - `manus-output/package.json` (24 lín.)
  - `manus-output/tsconfig.json` (14 lín.)
  - `manus-output/README.md` (49 lín.)
  - `manus-output/TIMING.md` (15 lín.)
  - `manus-output/src/index.ts` (38 lín.)
  - `manus-output/src/routes/todos.ts` (91 lín.)
  - `manus-output/src/schemas/todo.ts` (17 lín.)
  - `manus-output/src/storage/jsonStore.ts` (91 lín.)
  - `manus-output/src/types/todo.ts` (7 lín.)
  - `manus-output/tests/todos.test.ts` (82 lín.)
- Nota: ningún output contiene archivos ocultos (.gitignore, vitest.config, .env, etc.).

## Tabla comparativa checklist

| # | Item | Atlas | Manus | Evidencia Atlas | Evidencia Manus |
|---|------|-------|-------|-----------------|-----------------|
| A1 | package.json scripts (dev, test, typecheck) | ✓ | ✓ | package.json:6-12 (`dev`:7, `typecheck`:10, `test`:11; extra `start`/`build`:8-9) | package.json:6-10 (`dev`:7, `test`:8, `typecheck`:9) |
| A2 | tsconfig.json con `strict: true` | ✓ | ✓ | tsconfig.json:8 | tsconfig.json:6 |
| A3 | Existe `src/index.ts` (entry point) | ✓ | ✓ | src/index.ts:27-34 (bootstrap `require.main === module`) | src/index.ts:31-36 (bootstrap `process.argv[1] === fileURLToPath(...)`) |
| A4 | Existe `src/routes/todos.ts` | ✓ | ✓ | src/routes/todos.ts:8-57 (router con POST/GET/PATCH/DELETE) | src/routes/todos.ts:5-87 (router con POST/GET/PATCH/DELETE) |
| A5 | Existe `src/schemas/todo.ts` con Zod | ✓ | ✓ | src/schemas/todo.ts:1-9 (`CreateTodoSchema`, `UpdateTodoSchema`) | src/schemas/todo.ts:1-17 (`createTodoSchema`, `todoIdSchema`, `todoListSchema`) |
| A6 | Existe `src/storage/jsonStore.ts` | ✓ | ✓ | src/storage/jsonStore.ts:11-87 (`JsonTodoStore`) | src/storage/jsonStore.ts:7-91 (`JsonTodoStore`) |
| A7 | Existe `src/types/todo.ts` | ✓ | ✓ | src/types/todo.ts:1-9 | src/types/todo.ts:1-7 |
| A8 | Existe `tests/todos.test.ts` con Vitest | ✓ | ✓ | tests/todos.test.ts:1 (`import { describe, it, expect, beforeEach } from 'vitest'`) | tests/todos.test.ts:1 (`import { afterEach, beforeEach, describe, expect, it } from "vitest"`) |
| A9 | Existe `README.md` | ✓ | ✓ | README.md (90 lín., inglés) | README.md (49 lín., español) |
| A10 | package.json declara: express, zod, vitest, ts-node-dev, typescript | ✓ | ✗ | package.json:13-25 — express:14, zod:15, ts-node-dev:22, typescript:23, vitest:24 | package.json:11-23 — express:12, zod:13, typescript:21, vitest:22; **falta ts-node-dev**: usa `tsx`:20 como runner alternativo |
| B1 | TypeScript usa `type`/`interface` para Todo (no `any`) | ✓ | ✓ | src/types/todo.ts:1-6 `interface Todo` + DTOs derivados con `Pick`:8-9; grep `\bany\b`: 0 usos como tipo | src/types/todo.ts:1-7 `interface Todo`; grep `\bany\b`: solo `expect.any(String)` en tests:34,65 (matcher, no tipo) |
| B2 | Zod valida body de POST (title string no vacío) | ✓ | ✓ | src/schemas/todo.ts:4 `z.string().min(1).max(200)` | src/schemas/todo.ts:4 `z.string().trim().min(1).max(200)` (mejor: rechaza whitespace-only, verificado en tests:37-41) |
| B3 | PATCH valida que el ID existe antes de actualizar | ✓ | ✓ | src/routes/todos.ts:39-44 (`store.update` → `null` → 404); jsonStore.ts:33-35 (`findIndex === -1`) | src/routes/todos.ts:37-53 (valida formato UUID → 400:39-45; `store.complete` → `null` → 404:50-53) |
| B4 | DELETE responde 404 si ID no existe | ✓ | ✓ | src/routes/todos.ts:50-53 | src/routes/todos.ts:73-78 |
| B5 | GET responde array vacío `[]` si no hay todos | ✓ | ✓ | jsonStore.ts:66 (ENOENT → `[]`); testeado explícitamente en tests:45-49 | jsonStore.ts:71-73 (ENOENT → `[]`); sin test explícito de array vacío inicial (gap menor de cobertura) |
| B6 | jsonStore maneja concurrencia básica (mutex/lock o read-write atómico) | ✓ | ✗ | jsonStore.ts:12 (`writeChain`), :75-86 (mutex single-writer por encadenamiento de promesas) + escritura atómica tmp+rename:79-81 | **No encontrado**: sin lock, sin cola, sin tmp+rename. Mutaciones read→modify→write directas (jsonStore.ts:14-27, 29-44, 46-57) y `fs.writeFile` directo al target:85 |
| B7 | Errores HTTP usan status codes correctos (400, 404, 500) | ✗ | ✓ | 400 (routes:15,34) y 404 (routes:43,52; index.ts:14 ruta desconocida) correctos, **pero** JSON malformado en el body → 500: el error handler index.ts:18-22 ignora `err.status` (body-parser adjunta status 400 en su SyntaxError) y hardcodea 500:21 | 400 (routes:12,40,65 + index.ts:20-23 SyntaxError de body-parser → 400), 404 (routes:51,76), 500 (routes:89-91, index.ts:25) |
| B8 | Tests usan supertest o fetch real contra la app | ✓ | ✓ | tests/todos.test.ts:2 (`import request from 'supertest'`) | tests/todos.test.ts:6 (`import request from "supertest"`) |
| B9 | Tests cubren caso exitoso Y caso de error (400/404) | ✓ | ✓ | 201: tests:22-34; 400: tests:36-43; 404: tests:73-80 y 93-99 (8 tests en total) | 201: tests:24-35; 400: tests:37-41 y 69; 404: tests:70 (6 tests; falta cobertura de DELETE 404) |
| B10 | README incluye: install, dev, test, curl examples | ✓ | ✓ | install:10-14, dev:16-22, test:37-43, curl:55-73 | install/dev:9-16, test:43-49 (`npm test`), curl:29-41 |
| C1 | No hay `console.log` de debug dejados | ✓ | ✓ | Solo logs intencionales: index.ts:20 (`console.error` de errores no manejados) e index.ts:32 (banner de arranque), ambos con `eslint-disable-next-line`; no son restos de debug | Cero `console.*` en todo el codebase (grep) |
| C2 | No hay código comentado/muerto | ✓ | ✓ | Comentarios solo documentales (p.ej. routes:11,24,30,48) | Comentarios mínimos; sin bloques comentados |
| C3 | No hay TODOs o FIXMEs sin resolver | ✓ | ✓ | Grep TODO/FIXME/XXX/HACK: única coincidencia es `'TODO API'` (tests:15), nombre del producto, no comentario | Grep: sin coincidencias |
| C4 | No hay dependencias innecesarias | ✓ | ✓ | deps: express+zod; dev: types/express, types/node, types/supertest, supertest, ts-node-dev, typescript, vitest — todas usadas | deps: express+zod; dev: types, supertest, tsx, typescript, vitest — todas usadas |
| C5 | Nombres de variables consistentes | ✓ | ✓ | camelCase consistente (grep `[a-z]_[a-z]` en *.ts: 0 resultados). Nota: alias `fssync` (jsonStore.ts:2) es engañoso (es la API de promesas, no sync), pero no es mezcla de convenciones | camelCase consistente (grep: 0 resultados) |
| C6 | No hay try/catch vacíos o que solo hacen console.error | ✓ | ✓ | catch funcional ENOENT (jsonStore.ts:65-68); `next.catch(() => undefined)` (:83-84) es guarda de cadena comentada y el error sigue propagando al caller vía la promesa retornada (:85) | catch → respuesta 500 real (routes:22-24,31-33,56-58,81-83); no vacíos. Nota: no loguean el error (swallow silencioso) |
| C7 | El JSON store no pierde datos en escrituras concurrentes (al menos aviso) | ✓ | ✗ | Escrituras serializadas por `writeChain` + rename atómico (jsonStore.ts:75-86); documentado en README:77 | **Pierde datos**: dos POST concurrentes leen el mismo array, ambos hacen push, el último `writeFile` gana (jsonStore.ts:14-27). Sin aviso en README ni en código |
| C8 | Separación clara: rutas / lógica / storage | ✓ | ✓ | routes/ + storage/ + schemas/ + types/ | routes/ + storage/ + schemas/ + types/ |
| C9 | Tipos exportados y reutilizados (no duplicados) | ✓ | ✓ | `Todo`/DTOs importados por storage (jsonStore.ts:5) y rutas vía schemas. Nota: `CreateTodoInput`/`UpdateTodoInput` (schemas:11-12) se exportan sin usarse y son estructuralmente idénticos a los DTO (types:8-9) — duplicación leve | `Todo` importado por storage (jsonStore.ts:5) y tests (:9). Nota: `persistedTodoSchema` (schemas:9-15) duplica la forma de la interface `Todo` — espejo runtime intencional, riesgo de divergencia |
| C10 | El código compila mentalmente sin imports faltantes | ✓ | ✓ | Todos los imports resuelven (CJS); `require.main` válido en CommonJS. Nota: tsconfig.json:22 **excluye `tests/` del typecheck** | Todos los imports resuelven; extensiones `.js` correctas para NodeNext (index.ts:9-10, routes:2-3, store:4-5); imports `type`-only correctos bajo `verbatimModuleSyntax` (index.ts:2-5); typecheck incluye tests (tsconfig:13) |

## Scores
- **Atlas: 29/30** (A: 10/10, B: 9/10, C: 10/10) — único fallo: B7 (JSON malformado → 500 en vez de 400).
- **Manus: 27/30** (A: 9/10, B: 9/10, C: 9/10) — fallos: A10 (falta ts-node-dev), B6 (sin manejo de concurrencia), C7 (pierde escrituras concurrentes sin aviso).
- **Ganador: Atlas (29 vs 27)** — con salvedades críticas detalladas abajo. El score de checklist NO implica listo para producción: Atlas tiene 2 bugs latentes que crashean el proceso.

## Issues críticos detectados

### Atlas
1. **La primera escritura falla out-of-the-box (ENOENT) y, combinado con el issue 2, crashea el proceso.** `mutate()` escribe el tmp en `${filePath}.tmp` (jsonStore.ts:79-81) y `defaultStorePath()` apunta a `cwd/data/todos.json` (jsonStore.ts:89-91), pero **nunca se crea el directorio `data/`** (no hay `fs.mkdir` en todo el código). En un checkout fresco, el primer POST falla con ENOENT. Los tests no lo detectan porque `makeTmpStore()` usa un directorio ya creado por `mkdtemp` (tests/todos.test.ts:9-13): el padre siempre existe. El README:77 afirma que el archivo "created on first write" — falso para el directorio.
2. **Rutas async sin try/catch + Express 4 → unhandled promise rejection → crash.** Deps: express ^4.19.2 (package.json:14); Express 4 no captura rechazos de handlers async (eso es de Express 5). Ninguna ruta envuelve las llamadas al store (routes/todos.ts:12-55). Cualquier error del store (issue 1, JSON corrupto en `readTodos` jsonStore.ts:62, error de disco) se convierte en unhandled rejection; Node ≥15 termina el proceso por defecto. El README exige Node 18+ (README:7), así que el crash está garantizado. El "centralized error handler" (index.ts:18-22) es **código muerto** para todas las rutas async.
3. **Sin validación runtime de datos persistidos.** `readTodos()` hace `JSON.parse` + cast `parsed as Todo[]` (jsonStore.ts:62-64). Si `todos.json` contiene JSON válido con forma incorrecta (p.ej. `[{"foo":1}]`), la API sirve objetos malformados silenciosamente. Manus valida con Zod en este punto.
4. **JSON de request malformado → 500 en vez de 400** (index.ts:18-22): el handler ignora `err.status`; body-parser adjunta status 400 a su SyntaxError. Es el motivo del fallo de B7.
5. **Smells menores:** import duplicado del mismo módulo con alias engañoso (`import { promises as fs }` + `import { promises as fssync }`, jsonStore.ts:1-2 — ambos son la API de promesas); tsconfig excluye `tests/` del typecheck (tsconfig.json:22), por lo que `npm run typecheck` no cubre los tests; exports de tipos sin usar que duplican los DTO (schemas/todo.ts:11-12 vs types/todo.ts:8-9); `main: "src/index.ts"` (package.json:5) apunta a fuente TS en vez de `dist/index.js`.

### Manus
1. **Race condition con pérdida silenciosa de escrituras (lost writes).** Todas las mutaciones son read → modify → write sin serialización alguna: `create` (jsonStore.ts:14-27), `complete` (:29-44), `delete` (:46-57). Dos POST concurrentes leen el mismo array, ambos hacen `push`, y el último `writeTodos` gana → un todo se pierde sin error ni log. Sin mutex, sin cola, sin `O_EXCL`, sin tmp+rename. Para un store respaldado por archivo, este es el fallo más grave posible: es silencioso.
2. **Escritura no atómica → riesgo de corrupción permanente.** `fs.writeFile` directo sobre el archivo target (jsonStore.ts:85), sin tmp+rename. Un crash/SIGKILL/OOM a mitad de escritura deja `todos.json` truncado. La siguiente lectura lanza "El archivo de tareas no contiene JSON válido" (jsonStore.ts:75-77) → **todos los endpoints devuelven 500 hasta intervención manual**. Atlas sí hace tmp+rename (jsonStore.ts:79-81).
3. **PATCH ignora el body y no puede des-completar.** `router.patch` (routes/todos.ts:36-59) nunca lee `request.body`; `store.complete` solo marca `completed = true` (jsonStore.ts:37-41). Enviar `{"completed": false}` marca la tarea como completada igualmente — semántica trampa y gap funcional frente a Atlas (que acepta toggle en ambas direcciones).
4. **Swallow silencioso de errores.** Todos los `catch { sendInternalError(response) }` (routes/todos.ts:22-24,31-33,56-58,81-83) descartan el error sin loguearlo (cero `console.*` en el codebase). Un 500 en producción es imposible de diagnosticar sin reproducir.
5. **Menores:** sin handler 404 JSON para rutas desconocidas (cae el 404 HTML por defecto de Express); sin scripts `build`/`start` (proyecto dev-only vía tsx); `const app = createApp()` a nivel de módulo (index.ts:31) + `export default app` (:38) — acoplamiento innecesario al importar desde tests; tests no cubren DELETE 404 ni GET vacío inicial.

## Fortalezas únicas de cada versión

### Atlas
- Único con manejo real de concurrencia: mutex single-writer por cadena de promesas + escritura atómica tmp+rename (jsonStore.ts:12,75-86), documentado (README:77).
- DELETE con 204 sin body (routes/todos.ts:54) — semántica REST más correcta que el 200 de Manus.
- PATCH con body que permite completar y des-completar (routes/todos.ts:31-46).
- Suite de tests más completa (8 casos vs 6): array vacío explícito, 404 de PATCH y de DELETE.
- Handler 404 JSON para rutas desconocidas (index.ts:13-15).
- tsconfig con flags extra de rigor (`noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, tsconfig.json:16-19) y pipeline de producción (`build`/`start`).
- Cumplió la instrucción de timing: 3.80 min autodeclarados.

### Manus
- Validación Zod del ID (UUID) en PATCH/DELETE → 400 para IDs malformados (routes/todos.ts:37-45,62-70); Atlas responde 404 a cualquier string inexistente, sin distinguir formato.
- Validación Zod de los datos persistidos al leer (schemas/todo.ts:9-17 + jsonStore.ts:63-69): falla fuerte ante corrupción en vez de servir basura tipada.
- `fs.mkdir(dirname, { recursive: true })` antes de escribir (jsonStore.ts:84): la primera escritura funciona out-of-the-box — exactamente donde Atlas se rompe.
- try/catch en todas las rutas → errores de storage se convierten en 500, nunca crashean el proceso.
- JSON de request malformado → 400 (index.ts:20-23), donde Atlas devuelve 500.
- Setup ESM moderno y consistente (NodeNext + `verbatimModuleSyntax` + extensiones `.js`), y el typecheck incluye los tests (tsconfig.json:13).
- Modelo de datos más rico (`completedAt`, types/todo.ts:6), `trim()` en title, limpieza de dirs temporales en `afterEach` (tests:20-22).

## Diferencias de diseño relevantes
- **Módulos:** Atlas CommonJS (`tsconfig module: commonjs`, `require.main`); Manus ESM (`"type": "module"`, NodeNext, `import.meta.url`).
- **Runner dev:** Atlas ts-node-dev; Manus tsx (motivo del fallo A10).
- **Manejo de errores:** Atlas apuesta por un handler centralizado que resulta inalcanzable desde rutas async (Express 4); Manus usa try/catch por ruta, verboso pero efectivo.
- **Concurrencia:** Atlas mutex + rename atómico; Manus nada.
- **Validación de IDs:** Atlas ninguna (cualquier string → 404); Manus Zod UUID (mal formato → 400, inexistente → 404).
- **PATCH:** Atlas dirigido por body (toggle bidireccional); Manus sin body (solo completa, idempotente, preserva `completedAt`).
- **DELETE:** Atlas 204 sin body; Manus 200 con `{ id }`.
- **Validación de persistencia:** Atlas confía (`as Todo[]`); Manus round-trip Zod.
- **Idioma:** mensajes y comentarios en inglés (Atlas) vs español (Manus).
- **Typecheck de tests:** Atlas los excluye (tsconfig.json:22); Manus los incluye (tsconfig.json:13).
- **Producción:** Atlas tiene build/start; Manus es dev-only.

## Timing honesto
- **Atlas: 3.80 min** (autodeclarado y verificable). No existe archivo TIMING.md dentro de `atlas-output/`; la cifra proviene del input de la tarea y es corroborada por `manus-output/TIMING.md:15` ("Atlas cumplió la instrucción de timing honestamente (3.80 min)").
- **Manus: 0.00 min** (placeholder, no midió). `manus-output/TIMING.md:3-5` lo admite explícitamente: "TIMING_DURATION_MIN: 0.00 (no real - Manus falló la instrucción de timing)".
- Nota de integridad de datos: `TIMING.md:12` afirma "Atlas entregó 612 líneas, Manus 363 líneas". Mi medición real (`wc -l`): **Atlas 443 líneas, Manus 413 líneas** (428 incluyendo TIMING.md). Las cifras declaradas no coinciden con el contenido real; se reportan las medidas.

## Veredicto

**Atlas gana la auditoría 29/30 contra 27/30**, y gana en las dimensiones que más separan ingeniería de maqueta: completitud declarada (A10), manejo de concurrencia (B6/C7) y profundidad de tests. Su store serializa escrituras con una cadena de promesas y rename atómico, su DELETE usa 204, su PATCH permite toggle bidireccional, y su README documenta el modelo de concurrencia. Es la implementación más pensada. Pero hay que ser brutal: **el score de checklist no equivale a software que funciona**. Atlas tiene dos bugs latentes encadenados que lo hacen crashear en un checkout fresco: nunca crea el directorio `data/` (primera escritura → ENOENT) y ninguna ruta async tiene try/catch bajo Express 4 (cualquier error del store → unhandled rejection → el proceso muere). Su "centralized error handler" es código muerto para las rutas async. Los tests pasan solo porque `mkdtemp` crea el directorio que el código de producción nunca crea. Además devuelve 500 ante JSON de request malformado (debería ser 400).

**Manus es más robusto en runtime pero arquitectónicamente incompleto.** Todo lo que Atlas rompe en el arranque, Manus lo resuelve: `mkdir` recursivo antes de escribir, try/catch por ruta que convierte errores de storage en 500 sin crashear, 400 para JSON malformado y para UUIDs inválidos, validación Zod de datos persistidos. Su fallo es estructural y, a mi juicio, peor en modo de fallo: **no tiene ninguna protección de concurrencia**. Las escrituras concurrentes se pierden en silencio (last-write-wins) y el `writeFile` directo al target puede corromper el archivo ante un crash a mitad de escritura, dejando la API entera en 500 hasta reparación manual. La pérdida silenciosa de datos es más peligrosa que un crash visible. Suma el PATCH que ignora el body (no se puede des-completar una tarea) y el swallow de errores sin logging.

**Coste de cierre:** poner a Atlas en estado shippable cuesta ~5 líneas (un `mkdir recursive` en `mutate`/`defaultStorePath` + try/catch por ruta o respetar `err.status` en el handler); poner a Manus en estado shippable requiere rediseñar el path de escritura del store (mutex/cadena + tmp+rename), que es trabajo arquitectónico. Por score, por arquitectura y por coste de fix, **el ganador es Atlas**, con la condición explícita de que ninguno de los dos es shippable tal como está y de que Atlas debe resolver FIX-20260812-01 issues 1 y 2 antes de cualquier uso real.

---
*Dictamen generado por DEBY (DEBUGGER) — FIX-20260812-01. Solo lectura estática; no se ejecutó código, no se instalaron dependencias, no se corrieron tests.*
