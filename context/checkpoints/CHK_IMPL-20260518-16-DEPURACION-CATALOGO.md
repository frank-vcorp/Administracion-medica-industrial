# Checkpoint IMPL-20260518-16 — Depuración Catálogo Pruebas Legacy

**ID:** IMPL-20260518-16  
**Fecha:** 2026-05-18  
**SPEC de referencia:** `context/SPECs/SPEC_ARCH-20260518-16-DEPURACION-CATALOGO-PRUEBAS-LEGACY.md`  
**Agente:** SOFIA - Builder

---

## 1. Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/actions/medical-profiles.ts` | Añadido `CATALOG_LEGACY_HIDDEN` y filtro `where: { code: { notIn: [...] } }` en `getMedicalTests()` |

**Total archivos modificados: 1** (dentro del límite de 5 de la SPEC).

---

## 2. Resumen Exacto del Cambio

Se agregó antes de `getMedicalTests()`:

```typescript
/**
 * Códigos de pruebas legacy excluidas del catálogo seleccionable.
 * No se borran de la DB — solo se ocultan de la UI.
 * @see SPEC_ARCH-20260518-16-DEPURACION-CATALOGO-PRUEBAS-LEGACY
 * @id IMPL-20260518-16
 */
const CATALOG_LEGACY_HIDDEN = ['GEN-01', 'GEN-02'] as const
```

Y se modificó la query de `getMedicalTests()` para incluir:

```typescript
where: {
  code: { notIn: [...CATALOG_LEGACY_HIDDEN] },
},
```

**Efecto:** `GEN-01` (Somatometría / Peso, Talla, Signos Vitales) y `GEN-02` (Agudeza Visual) dejan de aparecer en:
- `/admin/profiles` — selección de pruebas para perfiles médicos
- `/admin/services` — listado del catálogo de pruebas

Los registros `MedicalTest` siguen en la DB. Los `EventTest` históricos y `ProfileTest` existentes no se tocan.

---

## 3. Hipótesis Validada

> **Hipótesis:** `getMedicalTests()` es el ancla única. Filtrar por `code: { notIn }` oculta las pruebas legacy del catálogo visible sin impacto en historial.

**Resultado:** CONFIRMADA. Typecheck sin errores en:
- `medical-profiles.ts` ✓
- `admin/profiles/page.tsx` ✓  
- `admin/services/page.tsx` ✓

La firma de retorno de `getMedicalTests()` no cambia (mismo shape, menos registros), por lo que ambos consumidores son compatibles sin cambios.

---

## 4. Riesgos Residuales

| Riesgo | Nivel | Nota |
|--------|-------|------|
| `GEN-IEC74` ("AGUDEZA VISUAL" uppercase, Estudios Generales) sigue visible | **Bajo** | La SPEC lo marca explícitamente como "pendiente de corroboración funcional". No se toca en este corte. |
| Si los códigos GEN-01/GEN-02 no existen en la DB de producción | **Bajo** | El filtro sería no-op (no rompe nada). Verificar con `SELECT code, name FROM medical_tests WHERE code IN ('GEN-01','GEN-02');` |
| Otros duplicados legacy no cubiertos | **Bajo** | La constante `CATALOG_LEGACY_HIDDEN` está diseñada para ser extendida fácilmente en el futuro. |

---

## Soft Gates

- [✓] **Gate 1 - Compilación:** TypeScript sin errores en el slice afectado
- [~] **Gate 2 - Testing:** No existen tests unitarios para `getMedicalTests()`. El riesgo es bajo dado que el cambio es un filtro de lectura no destructivo.
- [✓] **Gate 3 - Revisión:** Cambio mínimo (7 líneas), un solo archivo, reversible
- [✓] **Gate 4 - Documentación:** Comentario JSDoc + ID de intervención en código

---

*Generado por SOFIA | IMPL-20260518-16*
