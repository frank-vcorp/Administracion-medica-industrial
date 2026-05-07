# Checkpoint de Implementación — IMPL-20260507-07

- **ID**: IMPL-20260507-07
- **SPEC fuente**: ARCH-20260507-07 — Trazabilidad Ligera sin Cambiar Flujo
- **Fecha**: 2026-05-07
- **Agente**: SOFIA - Builder
- **Commit**: `56a7860`

## Entregables implementados

### 1. `TraceabilidadLigera.tsx` (componente nuevo)

Ubicación: `frontend/src/components/clinical/TraceabilidadLigera.tsx`

Funcionalidades incluidas en V1:

| Entregable SPEC | Implementación |
|---|---|
| Último movimiento registrado | `ultimoMovimiento` derivado del test con mayor `STATUS_WEIGHT` entre los que tienen actividad |
| Siguiente paso sugerido | `siguientePaso`: primer `IN_PROGRESS` o primer `PENDING` |
| Conteo de pendientes vs completados | Cabecera siempre visible con `completados/total` + barra de progreso |
| Indicador de muestra tomada | Hitos cruzados de laboratorio visibles debajo del resumen cuando `SAMPLE_TAKEN/RESULT_REGISTERED/COMPLETED` |
| Timeline operativa ligera | Panel expandible con todos los estudios ordenados por estado (más avanzado primero) |
| Visibilidad cruzada | Chips de muestra ya tomada visibles para cualquier área que entre al workspace |
| Incidencia operativa no bloqueante | Formulario mínimo expandible: 4 tipos predefinidos + estudio relacionado (opcional). Persistencia en `localStorage` por `eventId`, sin migración Prisma. |

### 2. `PapeletaWorkspace.tsx` (modificado)

Cambios:
- Import de `TraceabilidadLigera` (línea 42)
- Bloque `{localTests.length > 0 && <TraceabilidadLigera ... />}` en la Vista Resumen (antes de la lista de estudios)
- Props pasadas: `eventId`, `tests={localTests}`, `readonly`

## Restricciones verificadas

- [x] No se cambió el flujo actual ni el orden de estaciones
- [x] No se tocó la lógica de Examen Médico
- [x] No se rompió la lógica de muestra compartida por tipo (ARCH-20260507-06)
- [x] No se agregan pantallas obligatorias
- [x] No hay migración Prisma — incidencias persisten en `localStorage`
- [x] Solo 2 archivos modificados (1 nuevo + 1 modificado)

## Validación ejecutada

| Gate | Estado | Detalle |
|---|---|---|
| Gate 1 — Compilación | ✅ OK | `get_errors` sobre ambos archivos: 0 errores TypeScript |
| Gate 2 — Testing | ⚠️ No disponible | Node.js no instalado en el shell del devcontainer; no se pueden ejecutar tests E2E ni unit |
| Gate 3 — Revisión | ✅ Manual | Qodo CLI no disponible en este entorno; revisión manual completada |
| Gate 4 — Documentación | ✅ OK | Marcas de agua JSDoc en componente, comentario inline en PapeletaWorkspace, checkpoint generado |

## Archivos tocados

```
frontend/src/components/clinical/TraceabilidadLigera.tsx  (NUEVO — 291 líneas)
frontend/src/components/clinical/PapeletaWorkspace.tsx    (MODIFICADO — +11 líneas netas)
```

## Riesgos y limitaciones restantes

1. **Incidencias en localStorage**: Las incidencias V1 son por navegador/dispositivo. Si otro operador abre el mismo evento desde otra máquina, no verá las incidencias del primero. Aceptable para V1 según SPEC; V2 debería persistirlas en BD usando un campo JSON o tabla `EventIncidence`.

2. **Último movimiento sin timestamp real**: Se aproxima por peso de estado, no por `updatedAt`. Si dos estudios tienen el mismo estado, se toma el que aparece primero en el array. Limitación menor para V1; requeriría incluir `updatedAt` en la serialización de `page.tsx` para mayor precisión.

3. **Hitos cruzados de laboratorio**: La detección es heurística por nombre (`isLabByName`). Si un estudio de laboratorio tiene un nombre poco convencional, no aparecerá en los hitos cruzados. La lógica real de `isLabTest` en PapeletaWorkspace también considera `test.category.name`, pero en `TraceabilidadLigera` solo tenemos `testNameSnapshot` para no acoplar tipos. Límite documentado y aceptable para V1.

4. **Node.js no disponible en devcontainer shell**: No se pudieron ejecutar tests unitarios ni E2E directamente. Se validó via LSP (0 errores TypeScript).

## Próximos pasos sugeridos (fuera de scope V1)

- V2: Persistir incidencias en `MedicalEvent.notes` o tabla nueva `EventIncidence`
- V2: Incluir `updatedAt` en serialización de `EventTest` para timeline ordenada por tiempo real
- V3: Mostrar trazabilidad en panel lateral colapsable para visibilidad desde el workspace de estudio activo
