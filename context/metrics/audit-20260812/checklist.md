# Checklist auditoría código TODO API (Atlas vs Manus)

## A. Completitud estructural (10 pts)

- [ ] A1. Existe `package.json` con scripts (dev, test, typecheck)
- [ ] A2. Existe `tsconfig.json` con `strict: true`
- [ ] A3. Existe `src/index.ts` (entry point)
- [ ] A4. Existe `src/routes/todos.ts`
- [ ] A5. Existe `src/schemas/todo.ts` con Zod
- [ ] A6. Existe `src/storage/jsonStore.ts`
- [ ] A7. Existe `src/types/todo.ts`
- [ ] A8. Existe `tests/todos.test.ts` con Vitest
- [ ] A9. Existe `README.md`
- [ ] A10. package.json declara: express, zod, vitest, ts-node-dev, typescript

## B. Calidad de implementación (10 pts)

- [ ] B1. TypeScript usa `type` o `interface` para Todo (no `any`)
- [ ] B2. Zod valida body de POST (title string no vacío)
- [ ] B3. PATCH valida que el ID existe antes de actualizar
- [ ] B4. DELETE responde 404 si ID no existe
- [ ] B5. GET responde array vacío `[]` si no hay todos
- [ ] B6. jsonStore maneja concurrencia básica (mutex/lock o read-write atómico)
- [ ] B7. Errores HTTP usan status codes correctos (400, 404, 500)
- [ ] B8. Tests usan supertest o fetch real contra la app
- [ ] B9. Tests cubren caso exitoso Y caso de error (400/404)
- [ ] B10. README incluye: install, dev, test, curl examples

## C. Code smells (10 pts)

- [ ] C1. No hay `console.log` de debug dejados
- [ ] C2. No hay código comentado/muerto
- [ ] C3. No hay TODOs o FIXMEs sin resolver
- [ ] C4. No hay dependencias innecesarias (ej: lodash para trivial)
- [ ] C5. Nombres de variables consistentes (no mezcla snake_case y camelCase)
- [ ] C6. No hay try/catch vacíos o que solo hacen console.error
- [ ] C7. El JSON store no pierde datos en escrituras concurrentes (al menos aviso)
- [ ] C8. Hay separación clara: rutas / lógica / storage
- [ ] C9. Tipos exportados y reutilizados (no duplicados)
- [ ] C10. El código compila mentalmente sin imports faltantes

## Score
- Atlas: X/30
- Manus: X/30

Ganador: ___
