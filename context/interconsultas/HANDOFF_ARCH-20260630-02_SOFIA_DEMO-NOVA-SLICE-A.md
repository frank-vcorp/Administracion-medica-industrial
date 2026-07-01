# Handoff a SOFIA: Slice A — Demo NOVA (Catálogos)

**ID:** `HANDOFF_ARCH-20260630-02_SOFIA_DEMO-NOVA-SLICE-A`
**Fecha:** 2026-06-30
**Origen:** `SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md`
**Destino:** SOFIA (`subagent_type='sofia'`)
**Tipo:** Implementación de catálogo LIS base

---

## Contexto

Frank autorizó absorber NOVA Connection (LIS externo) dentro de AMI. La auditoría forense está en `context/audits/nova-20260630/AUDIT-NOVA-COMPLETO.md`. La estrategia está en `context/decisions/ADR-20260630-02-ABSORCION-NOVA-ESTRATEGIA.md`. Este Slice A es el primer entregable: **catálogos LIS navegables, editables, con seed**.

Stack AMI actual: Next.js 16 + Prisma + FastAPI + PostgreSQL + Zod.
NO se introduce PHP, NO se replica la arquitectura NOVA, NO se toca producción todavía.

## Lo que SOFIA entrega

Branch `feature/lab-slice-a-catalogs` con todo verde y PR abierto a `main`, que demuestra:

- Migración Prisma con 9 entidades LIS nuevas + 3 extensiones (Company, User, MedicalTest).
- Endpoint FastAPI `GET/POST/PATCH/DELETE /api/v1/lab/catalogs?mod=<X>` (8 mods).
- Server actions y página Next.js `/admin/lab/catalogs` con tabla editable.
- Sidebar AMI con item "Módulo de Laboratorios" (placeholder para slices siguientes).
- 8 catálogos seedeados: 10 unidades, 5 muestras, 5 recipientes, 5 métodos, 5 lugares de proceso, 5 clasificaciones, 5 indicaciones, 3 departamentos.
- Tests pytest (≥ 12 casos) + tests vitest (≥ 80% coverage en archivos nuevos).
- `pnpm typecheck && pnpm test && pnpm lint` en verde.
- Banner de demo en todo el módulo lab.
- Demo desplegado en staging de Railway/Vercel con URL accesible.

Lee el SPEC completo en `context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md` antes de tocar nada.

## Orden de tareas

1. Lee el SPEC completo.
2. Crea branch `feature/lab-slice-a-catalogs` desde `main`.
3. Modifica `frontend/prisma/schema.prisma` con las 9 entidades nuevas del §3 del SPEC + 3 extensiones. **Importante:** no rompas tablas existentes; los nuevos campos son todos opcionales o con defaults.
4. Ejecuta `pnpm prisma migrate dev --name add_lab_catalogs` en local; verifica que la SQL sea limpia.
5. Backend (`backend/app/`):
   - Crea `schemas/lab_catalogs.py` con Pydantic models para cada mod.
   - Crea `services/lab_catalog_service.py` con CRUD + paginación DataTables compatible.
   - Crea `api/v1/lab/catalogs.py` con los 8 endpoints REST.
   - Registra el router en `main.py`.
   - Escribe `tests/test_lab_catalogs.py` con al menos 12 casos (CRUD por mod).
6. Frontend (`frontend/src/`):
   - Crea `app/admin/lab/catalogs/page.tsx` con lectura de `?mod=` por searchParams (Next.js 16 → `await searchParams`).
   - Componente `CatalogTable.tsx` con paginación client-side y búsqueda (puedes usar `tanstack-table` ya en AMI o DataTables-like manual, **NO** agregues jQuery DataTables — usar React).
   - Componente `CatalogForm.tsx` con form modal.
   - `actions/lab-catalog.actions.ts` con 4 server actions.
   - `lib/validations/lab-catalog.ts` con Zod schemas.
   - Sidebar (`components/admin/Sidebar.tsx`): agrega link "🧪 Módulo de Laboratorios" → `/admin/lab/catalogs?mod=unidades`.
   - Banner amarillo en el módulo: "Módulo LAB — Slice A — Solo catálogos demo".
7. Seed (`frontend/prisma/seed.ts`): agrega función `seedLabCatalogs()` con datos del §6.2 del SPEC. Idempotente (skip si ya existe por code).
8. Validar local: `pnpm typecheck && pnpm test && (pnpm lint) && cd backend && pytest`.
9. Aplicar migración en staging Railway (`pnpm prisma migrate deploy` con script verificado, mismo patrón que IMPL-20260624-04 en PROYECTO.md).
10. Desplegar en staging. Validar demo manualmente.
11. PR con descripción detallada + screenshots del demo + checklist DoD.
12. **Sugerir segunda mano de validación a INTEGRA vía GEMINI** (no Qodo, está sunset desde 2026-06-22):
    ```
    task(
      subagent_type='gemini',
      prompt='Auditar PR feature/lab-slice-a-catalogs en AMI. Validar consistencia con context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md. Reportar bloqueadores si los hay.'
    )
    ```
13. **Self-review manual** antes de reportar como listo (qodo está sunset):
    - ¿Las 9 entidades del §3 del SPEC están en el schema Prisma con los nombres exactos?
    - ¿Las 3 extensiones (Company, User, MedicalTest) son no-breaking?
    - ¿Los 8 mods funcionan con CRUD completo?
    - ¿El banner de demo está visible?
    - ¿El audit log captura create/update/delete?
    - ¿Hay code smell evidente (código muerto, duplicación, magic strings)?
    - ¿Los tests cubren los edge cases del SPEC §9?
14. Aplicar feedback de GEMINI (si hay), commit final.
15. Reportar a INTEGRA con:
    - Diff resumido (`git diff --stat main..feature/lab-slice-a-catalogs`)
    - Output de los 3 comandos en verde
    - Screenshots del demo
    - URL del staging funcionando
    - Riesgos / desviaciones encontrados

## Validaciones obligatorias (no skip)

Antes de pedir GEMINI:

- `cd frontend && pnpm typecheck` → 0 errores.
- `cd frontend && pnpm test` → todos en verde, coverage ≥ 80% en archivos nuevos.
- `cd frontend && pnpm lint` → 0 errores (si script existe).
- `cd backend && pytest tests/test_lab_catalogs.py -v` → todos en verde.
- `cd frontend && npx prisma format && npx prisma validate` → 0 errores.

## Cosas que NO debe hacer SOFIA

- NO crear `qodo` calls (Qodo CLI está sunset desde 2026-06-22, retornaría error).
- NO modificar tablas AMI existentes sin preservar compatibilidad (todo cambio es opcional/additive).
- NO commitear `cookies.txt` ni `nova-*` archivos.
- NO hacer merge a `main` sin OK de Frank.
- NO introducir `npm install` de paquetes pesados no aprobados (jQuery, Vue, Vuetify). El frontend AMI se mantiene React/Next.
- NO hacer push force ni saltarse hooks.

## Riesgos identificados en el SPEC §8

- Migración Prisma grande: usar el patrón validado de IMPL-20260624-04 (crear con `--create-only`, validar SQL, aplicar vía script en Railway).
- No romper el "Catálogo de Pruebas" existente (`/admin/services`): el nuevo sidebar item se nombra distinto.
- Tests de regresión: correr `pnpm test` global, no solo archivos nuevos.

## Done Definition (DoD)

Resumido del SPEC §9, todo marcado:

- [ ] Demo navegable en staging con 8 catálogos y CRUD completo.
- [ ] pnpm typecheck + pnpm test + pytest en verde.
- [ ] PR a main con descripción, screenshots y self-review.
- [ ] GEMINI APROBADO o APROBADO_CON_OBSERVACIONES sin bloqueadores.
- [ ] URL demo funcional.
- [ ] Regresión cero en /admin/services y resto de AMI.

## Referencias rápidas

- SPEC: `context/SPECs/SPEC_ARCH-20260630-02-DEMO-NOVA-ABSORBIDO.md`
- ADR: `context/decisions/ADR-20260630-02-ABSORCION-NOVA-ESTRATEGIA.md`
- Auditoría: `context/audits/nova-20260630/AUDIT-NOVA-COMPLETO.md`
- Patrón migración Railway: PROYECTO.md (2026-06-24 ARCH-20260624-03)
- Patrón de handoff: `context/interconsultas/HANDOFF_ARCH-20260527-11_SOFIA_SLICE-A-TRAZABILIDAD-EVENT.md`
