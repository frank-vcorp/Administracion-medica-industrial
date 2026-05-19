# Checkpoint — IMPL-20260519-14 HOTFIX Autorización
**Fecha:** 2026-05-19
**ID:** IMPL-20260519-14-HOTFIX
**Agente:** SOFIA - Builder
**Tipo:** Hotfix de Seguridad (OWASP A01: Broken Access Control)

---

## Resumen Ejecutivo

Hotfix acotado sobre el corte ARCH-20260519-14 (Project + Alta Masiva).
Se cerraron 2 huecos de autorización confirmados por revisión externa:

| Función | Hueco anterior | Corrección aplicada |
|---------|---------------|---------------------|
| `getProjects()` | Sin guard — cualquier sesión (o ninguna) podía leer todos los proyectos | Ahora invoca `requireAdminOrReceptionist()` y retorna `[]` si no autorizado |
| `getProjectsByCompany(companyId)` | Sin guard — cualquier caller podía enumerar proyectos de cualquier empresa | Ahora invoca `requireAdminOrReceptionist()` y retorna `[]` si no autorizado |
| `bulkImportWorkers()` | Solo verificaba existencia de sesión (`session !== null`) sin restricción de rol | Ahora valida `['ADMIN', 'RECEPTIONIST'].includes(role)` y retorna error antes de resolver el proyecto |

---

## Archivos Modificados

- `frontend/src/actions/project.actions.ts` — líneas ~72–94 (getProjects, getProjectsByCompany)
- `frontend/src/actions/worker.actions.ts` — líneas ~294–305 (sección de verificación de sesión en bulkImportWorkers)

## Comentario Fase 2 (COMPANY_CLIENT)

Agregado inline en `bulkImportWorkers()`:
```
// TODO FASE 2 (portal B2B COMPANY_CLIENT): agregar validación adicional
//   project.companyId === session.user.companyId antes de resolver el proyecto.
```

---

## Soft Gates

| Gate | Estado | Evidencia |
|------|--------|-----------|
| G1 — Compilación (typecheck) | ✅ PASS | `tsc --noEmit` sin errores en los archivos modificados |
| G2 — Testing | ⚠️ N/A | No hay tests unitarios de Server Actions en este slice; hotfix es estructuralmente simple |
| G3 — Revisión (lint) | ✅ PASS | `eslint` con `--max-warnings=0` limpio |
| G4 — Documentación | ✅ PASS | `@hotfix` JSDoc en ambas funciones; comentario TODO FASE 2 en bulkImport |

---

## Cambios No Realizados (fuera de alcance)

- Mutaciones (`createProject`, `updateProject`, `updateProjectStatus`) — ya tenían guard, no tocadas.
- Resto de `worker.actions.ts` — no modificado.
- Ningún archivo de UI, schema, ni migración.

---

## Siguiente Paso

PR listo para revisión. Solicitar QA a GEMINI si el corte principal ARCH-20260519-14 también está completo.
