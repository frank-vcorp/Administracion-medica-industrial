# SPEC-FIX-20260730-02 — Regresión TC-07 por fix LAB_CATEGORY_ID (G-LAB-TRIGGER-02)

**ID:** `FIX-20260730-02-G-LAB-TRIGGER-02` (también cubre investigación de regresión)
**Fecha:** 2026-07-30
**Prioridad:** P0 (bloqueante para cerrar G-LAB-TRIGGER-01)
**Tipo:** Investigación + Fix de regresión
**Estado:** [~] Pendiente de investigación

---

## 1. Problema

El commit `72dc596` (`fix(FIX-20260730-01-LAB-TRIGGER): corrige LAB_CATEGORY_ID hardcoded`) arregló el bug raíz del trigger LabOrder (LAB_CATEGORY_ID estaba hardcodeado como `"64d3f863"` en 6 lugares pero la categoría real en BD es UUID `16c16ef0-cf35-4fe5-9bef-311f6fc8674c`). **Pero introdujo una regresión**: TC-07 del flujo E2E ahora falla porque el data loader de `events/[id]/page.tsx` lanza una excepción capturada por el `error.tsx` boundary, mostrando "Error al cargar el expediente".

**Evidencia**:

```
E2E post-72dc596 (TC-11 reactivado):
  TC-01..TC-06: 6 PASS
  TC-07: FAIL — getByText('Papeleta electrónica', { exact: true }) hidden
  TC-08..TC-12: NOT RUN (serial gating)

E2E con revert 72dc596 (TC-11 reactivado):
  TC-01..TC-10: 10 PASS
  TC-11: FAIL (LAB_CATEGORY_ID mismatch, esperado)
  TC-12: NOT RUN
```

El error boundary muestra el mensaje genérico:
```
heading "Error al cargar el expediente" [level=2]
paragraph: Hubo un problema de conexión con el servidor de base de datos o de serialización de datos.
paragraph: "digest: 1730908078"
button "Reintentar"
```

## 2. Causas probables

1. **`study_service.py:326` cambio de comportamiento**: la línea `if cid and ("lab" in str(cname).lower() or cid == "64d3f863"):` se cambió a `if cid and ("lab" in str(cname).lower() or cid == "16c16ef0-cf35-4fe5-9bef-311f6fc8674c"):`. Si `study_service` se invoca desde el data loader de la papeleta, la rama condicional podría estar devolviendo un objeto con un campo nuevo que rompe la serialización.
2. **`pending_orders.py:25` cambio de constante**: `LAB_CATEGORY_ID` ahora es UUID largo en lugar de string corto. Si alguna lógica downstream construye paths o queries con este valor (e.g. `f"category:{LAB_CATEGORY_ID}"`), podría haber incompatibilidad.
3. **Cambio en `lab/pending_orders.py:51,55`**: el default `category_id` y `categoryId` cambió. Si el frontend action serializa estos campos con tipos diferentes, podría romper el JSON parsing.

## 3. Estrategia de diagnóstico

1. **Capturar el stack trace real**: el `error.tsx` solo muestra `digest`. Para obtener el stack real, agregar log temporal en `events/[id]/page.tsx` con `console.error(error.stack)` o usar el `useEffect` que ya tiene `console.error('[events/[id]] ErrorBoundary capturó:', error)`.
2. **Aislar el cambio mínimo**: aplicar los 5 cambios de `72dc596` UNO POR UNO, ejecutar E2E, identificar cuál introduce la regresión.
3. **Inspeccionar logs de Railway + Vercel**: puede haber stack trace en los logs del backend o del frontend.
4. **Comparar con BD directa**: ejecutar el mismo query que hace el data loader con el eventId actual y verificar qué campo falla.

## 4. Alcance

**Incluido:**

- Investigación del stack trace real.
- Aplicación de fixes mínimos para resolver la regresión.
- Re-aplicación del fix LAB_CATEGORY_ID (`72dc596`) si se encuentra la causa exacta.
- Reactivación de TC-11 + TC-12 (si aplica).
- Reejecución E2E completa 12/12 PASS.

**Excluido:**

- Cambios al modelo Prisma o migraciones.
- Refactor del data loader o de `study_service.py` (solo si es estrictamente necesario).
- Cambios al UI de la papeleta.

## 5. Decisiones arquitectónicas (provisionales)

- **D1**: el LAB_CATEGORY_ID hardcodeado debe migrarse a lookup por nombre ("Laboratorio") en lugar de UUID, para evitar futuras regresiones si el UUID cambia. Pero esto queda como TODO post-fix, no parte de este lote.
- **D2**: si el cambio mínimo es revertir un solo archivo (e.g. `study_service.py`) y mantener los otros 4 cambios, se prefiere esa opción.

## 6. Definition of Ready

- [x] Regresión documentada en este SPEC.
- [x] Evidencia reproducible con git revert/cherry-pick.
- [ ] Aprobación de Frank para investigar.

## 7. Definition of Done

- TC-07 E2E PASS.
- TC-11 E2E PASS (trigger LabOrder funcional).
- TC-12 E2E PASS o skip justificado.
- Gates verdes (typecheck/vitest/lint).
- Commit + push autorizado.
- PROYECTO.md actualizado.

## 8. Estimación

| Tarea | Tiempo |
|---|---|
| Diagnóstico con logs | 0.5 h |
| Aislamiento del cambio problemático | 0.5 h |
| Fix mínimo | 1 h |
| Reaplicar LAB_CATEGORY_ID | 0.5 h |
| Reactivar TC-11/TC-12 + E2E | 0.5 h |
| **Total** | **~3 h** |

## 9. Estado

[~] Pendiente aprobación Frank
**Gating**: TC-07..TC-10 PASS confirmados. TC-11 FAIL esperado por LAB_CATEGORY_ID revertido. TC-12 NOT RUN.
**Próxima acción**: Frank aprueba investigación o acepta estado actual.