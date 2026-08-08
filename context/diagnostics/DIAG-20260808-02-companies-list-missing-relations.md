# DIAG-20260808-02 — Vendedor/Sucursal no se muestran en listado /companies (bug real de backend)

**Reportado por:** Frank (captura `/companies` + `/companies/[id]` 2026-08-08 19:11)
**Agente:** ATLAS M3 (re-diagnóstico)
**Severidad:** Media (datos faltantes en UI, vendedor SÍ existe en BD)
**Relación:** DIAG-20260808-01 (CSS) — el fix CSS se aplicó y desplegó, pero **NO resolvió** porque la causa real era otra.
**Estado:** Derivado a SOFIA.

## Contexto

En la captura de detalle de `Aceros corrugados` (`/companies/[id]`) Frank muestra:
- **Historial de vendedor:** "Sin asignar → **Leticia Uribe Fontes**" (`sellerId` poblado en BD).
- **Sucursales Permitidas:** `Paseo del Prado` marcada (allowedBranch).

En el listado (`/companies`), ambas columnas aparecen `—` aunque ya desplegó el fix CSS (`xl → lg`).

## Causa raíz (re-diagnóstico)

El fix de DIAG-20260808-01 (clases `xl:table-cell` → `lg:table-cell`) **se aplicó correctamente y está desplegado** (cace7d1). Pero el problema **NO era CSS** — había un bug de backend que el CSS ocultaba.

### Bug 1: `getCompanies()` NO incluye `seller`

Archivo: `frontend/src/services/company.service.ts:46-54`

```typescript
export async function getCompanies() {
  return prisma.company.findMany({
    include: {
      defaultBranch: true,         // ✅ incluido
      allowedBranches: { select: { id: true, name: true } },  // ✅ incluido
      // ❌ NO incluye 'seller'
    },
    orderBy: { createdAt: 'desc' },
  })
}
```

El listado (`page.tsx:77-82`) llama a `getCompanies()` si no hay filtros activos:

```typescript
const [companies, sellers] = await Promise.all([
  filtersActive
    ? listCompaniesWithFilters({ estado, origen, sellerId, search: q })  // ✅ incluye seller
    : getCompanies(),                                                     // ❌ NO incluye seller
  listActiveSellersAction().catch(() => []),
])
```

`listCompaniesWithFilters` SÍ incluye `seller` (línea 765-766), pero `getCompanies()` NO. Cuando el usuario navega a `/companies` sin filtros (caso de Frank), no se trae la relación `seller`.

En `page.tsx:96-99` el mapeo defensivo:
```typescript
seller: 'seller' in c && c.seller && typeof c.seller.fullName === 'string'
  ? { fullName: c.seller.fullName ?? '' }
  : null,
```
→ Al no haber `seller`, devuelve `null` → render muestra `—`.

### Bug 2: `defaultBranchId` puede ser NULL

Sucursal (`defaultBranch`) sí se incluye en `getCompanies()`, pero **`defaultBranchId` es nullable en schema** (`schema.prisma:160`). Es distinto de `allowedBranches`. Si la empresa solo tiene sucursales permitidas pero NUNCA se asignó `defaultBranchId`, el `defaultBranch` que llega al componente es `null` → render `—`.

Esto es **más probable** de lo que parece: el flujo de auto-alta y la asignación manual de sucursales permitidas (vista "Sucursales Permitidas") **NO asigna `defaultBranchId` automáticamente**. Solo el formulario `CompanyFormModal` (en flujo de creación manual) lo setea.

## Confirmación visual Frank

Frank mostró:
- ✅ `Aceros corrugados` en detalle SÍ tiene vendedor `Leticia Uribe Fontes` en el historial.
- ✅ `Aceros corrugados` en detalle SÍ tiene `Paseo del Prado` en Sucursales Permitidas.
- ❌ `Aceros corrugados` en listado muestra `—` en ambas columnas.

Conclusión: **los datos están en BD, pero no llegan al listado**.

## Solución a aplicar (SOFIA)

### Fix 1 (obligatorio): Añadir `seller` al include de `getCompanies()`

```typescript
// frontend/src/services/company.service.ts:46-54
export async function getCompanies() {
  return prisma.company.findMany({
    include: {
      seller: { select: { id: true, fullName: true, email: true } },  // ← AÑADIR
      defaultBranch: true,
      allowedBranches: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
}
```

### Fix 2 (decisión de UX — preguntar a Frank o proponer)

Tres opciones para Sucursal:

- **A (mínima):** Mostrar `defaultBranch.name` o `—` (estado actual). Si `defaultBranchId` es null, queda `—`.
- **B (resolutiva):** Mostrar `defaultBranch.name` si existe, sino `allowedBranches[0]?.name` si existe, sino `—`. Da una vista útil para empresas auto-registradas.
- **C (informativa):** Mostrar `defaultBranch.name` y, entre paréntesis, `+N permitidas` si hay más.

Recomendación: **B** — da información útil sin requerir asignar `defaultBranchId` manualmente. Es la opción que mejor alinea con la realidad operativa (la mayoría de empresas auto-registradas no tienen `defaultBranchId`).

**Decisión**: INTEGRA/Frank debe elegir. ATLAS propone B como default si no hay preferencia.

### Fix 3 (consolidación opcional): Unificar `getCompanies` y `listCompaniesWithFilters`

Ambos hacen lo mismo con filtros distintos. Podrían unificarse pasando `filtersActive=true` con filtros vacíos. Pero esto es refactor, no fix. **FUERA de scope** de este fix.

## Validaciones obligatorias para SOFIA

1. `cd /home/frank/repos/Administracion-medica-industrial/frontend && pnpm typecheck`
2. `pnpm test` (especialmente `company.service.delete.test.ts` y cualquier test de `getCompanies`)
3. `pnpm lint` (archivo modificado)

Self-review:
- ¿El listado de `/companies` muestra ahora el nombre del vendedor (`Leticia Uribe Fontes` para `Aceros corrugados`)?
- ¿La columna Sucursal muestra algo cuando hay `defaultBranch` o `allowedBranches[0]`?
- ¿El listado filtrado (con `?estado=HABILITADO`) sigue funcionando?
- ¿La selección bulk de SUPERADMIN sigue intacta?

## Sobre DIAG-20260808-01 (fix CSS)

El commit `cace7d1` **se mantiene** porque arregló un problema real (las columnas no se veían por breakpoint). Es independiente del bug de backend. Ambos fixes son necesarios: sin el CSS, las columnas seguirían invisibles aunque la data llegara.

## Handoff a SOFIA

```
Origen: ATLAS M3 / Diagnóstico: DIAG-20260808-02
Relación: continúa DIAG-20260808-01 (CSS, ya desplegado en cace7d1)
Raíz: /home/frank/repos/Administracion-medica-industrial
Stack: Next.js 16.1.6 + TS + Prisma
Archivos afectados: 1 principal (frontend/src/services/company.service.ts)
Cambios:
  1. getCompanies() — añadir seller al include
  2. (condicional) page.tsx o CompanySelectableTable — fallback a allowedBranches[0]
Decisiones pendientes:
  - Default Branch vacío → mostrar allowedBranches[0]? (propuesta B)
Riesgo: Bajo (solo añadir include, no rompe API ni schema)
Validar: typecheck, test, lint, self-review
```

## Estado

- [x] Diagnóstico documentado
- [ ] Derivado a SOFIA
- [ ] Implementado
- [ ] Validado
- [ ] Deploy verificado

## ID de trazabilidad

- ID: DIAG-20260808-02
- Sesión: 2026-08-08 19:11
- Relación: DIAG-20260808-01 (CSS, ya desplegado), IMPL-20260808-01
