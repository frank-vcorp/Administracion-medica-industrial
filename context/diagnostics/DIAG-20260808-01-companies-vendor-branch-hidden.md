# DIAG-20260808-01 — Columnas Vendedor/Sucursal no visibles en /companies

**Reportado por:** Frank (captura `/companies` 2026-08-08)
**Agente:** ATLAS M3 (entry-point)
**Severidad:** Baja (UI/responsive, no afecta datos ni funcionalidad)
**Complejidad:** Trivial — derivada directa a SOFIA (no requiere INTEGRA/SPEC)

## Síntoma

En la tabla densa de `/companies`, las columnas **Vendedor** y **Sucursal** aparecen vacías (`—`) aunque la empresa tiene ambos campos asignados en BD.

## Diagnóstico (causa raíz)

**No es un bug de datos.** La query Prisma trae correctamente `seller` y `defaultBranch`, y el componente los renderiza. El problema es **CSS responsive**:

| Archivo | Línea | Código |
|---|---|---|
| `frontend/src/components/companies/CompanySelectableTable.tsx` | 140-141 | `<th className="px-3 py-3 hidden xl:table-cell">Vendedor</th>` / `Sucursal` |
| `frontend/src/components/companies/CompanySelectableTable.tsx` | 189-192 | Mismas clases `hidden xl:table-cell` en las `<td>` correspondientes |

`hidden xl:table-cell` en Tailwind = solo visible a partir de **1280px** (breakpoint `xl` default). En pantallas de 1366×768 con el sidebar izquierdo abierto, el área útil queda por debajo de 1280px, por lo que las columnas se ocultan.

### Verificación de datos

- `frontend/src/services/company.service.ts:765-766` — `listCompaniesWithFilters` **sí incluye** `seller: { select: { id, fullName, email } }` y `defaultBranch: { select: { id, name } }`.
- `frontend/src/app/companies/page.tsx:85-100` — map correctamente shapea `seller.fullName` y `defaultBranch.name` al shape `SelectableCompany`.
- `frontend/src/components/companies/CompanySelectableTable.tsx:189-194` — renderiza `c.seller?.fullName` y `c.defaultBranch?.name` con fallback `—`.

→ Datos OK, render OK, **solo visibility CSS bloqueada**.

## Evidencia

Captura de Frank muestra sidebar abierto + viewport reducido → columnas Vendedor/Sucursal en blanco. El `Aceros corrugados` sí tiene vendedor/sucursal en BD (lo confirma Frank verbalmente), pero no se ve porque la columna está `hidden xl:table-cell`.

## Solución propuesta (a SOFIA)

**Opción A (recomendada, mínima):** Bajar el breakpoint de `xl` (1280px) a `lg` (1024px) en las columnas Vendedor y Sucursal (la fila `lg:table-cell`). Mantiene el responsive pero las hace visibles en pantallas más típicas.

```diff
- <th className="px-3 py-3 hidden xl:table-cell">Vendedor</th>
- <th className="px-3 py-3 hidden xl:table-cell">Sucursal</th>
+ <th className="px-3 py-3 hidden lg:table-cell">Vendedor</th>
+ <th className="px-3 py-3 hidden lg:table-cell">Sucursal</th>
... (mismas clases en las <td>)
```

**Opción B (alternativa):** Eliminar `hidden` por completo y dejar las columnas siempre visibles. En mobile real (<640px) el scroll horizontal del `overflow-x-auto` ya lo cubre.

**Opción C (más invasiva, no recomendada):** Compactar Email/Contacto a `xl` y dejar Vendedor/Sucursal en `lg` para jerarquizar la info.

### Recomendación

**Opción A** — cambio de 4 clases, sin regresiones, valida el caso de Frank.

## Validaciones obligatorias para SOFIA

1. `pnpm typecheck`
2. `pnpm test`
3. `pnpm lint` (si existe)
4. Self-review manual:
   - ¿Quedan las columnas Vendedor/Sucursal visibles en viewports 1024-1279px?
   - ¿Las columnas Email/Contacto siguen ocultas en <1024px (correcto, son menos críticas)?
   - ¿No hay regresión en la selección bulk (SUPERADMIN)?

## Handoff a SOFIA

```
Origen: ATLAS M3 / Diagnóstico: DIAG-20260808-01
Raíz: /home/frank/repos/Administracion-medica-industrial
Stack: Next.js 16.1.6 + TS + Prisma + Tailwind
Archivos afectados: 1 (frontend/src/components/companies/CompanySelectableTable.tsx)
Cambio: 4 líneas (clases Tailwind de xl → lg en Vendedor/Sucursal, en thead y tbody)
Riesgo: Mínimo (solo CSS responsive, no afecta API ni datos)
Validar: typecheck, test, lint, self-review
No requiere SPEC nueva ni decisión arquitectónica.
```

## Estado

- [x] Diagnóstico documentado
- [ ] Derivado a SOFIA para fix
- [ ] Validado por SOFIA
- [ ] Segunda mano GEMINI (pre-commit)

## ID de trazabilidad

- ID: DIAG-20260808-01
- Sesión: 2026-08-08
- Relación: IMPL-20260731-02 (CompanySelectableTable), FIX-FRANK-20260731-05 (vista densa)
