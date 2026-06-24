# Checkpoint IMPL-20260623-01 — DEMO Módulo de Reportes Masivos UMM

**ID:** IMPL-20260623-01
**Tipo:** DEMO AISLADO (standalone, sin tocar backend ni Prisma)
**Origen:** HANDOFF_ARCH-20260623-02
**Fecha:** 2026-06-23

## Resumen

Implementación del demo navegable del Módulo de Reportes Masivos UMM.
100% standalone: no consume backend ni base de datos. Datos hardcodeados
extraídos de `context/datos AMI/Proyectos UMM/CONCENTRADO GENERAL EJEMPLO.xlsx`.

## Archivos creados (7)

| Path | Propósito |
|---|---|
| `frontend/src/lib/demo/demo-types.ts` | Tipos TS del demo (DemoProject, DemoWorker, etc.) |
| `frontend/src/lib/demo/demo-data.ts` | 10 trabajadores hardcodeados + helpers `getDemoProjects` / `getDemoProjectById` |
| `frontend/src/lib/demo/demo-conteos.ts` | Conteos del preview + agregados para hoja GRAFICAS y PDF |
| `frontend/src/lib/demo/xlsx-generator.ts` | Generación XLSX con `xlsx` (3 hojas: CONCENTRADO, LABORATORIOS, GRAFICAS) |
| `frontend/src/lib/demo/pdf-generator.tsx` | Generación PDF con `@react-pdf/renderer` (Portada + Concentrado tabular) |
| `frontend/src/components/demo/DemoBanner.tsx` | Banner persistente "DEMO MODE" |
| `frontend/src/components/demo/DemoMassiveReportModal.tsx` | Modal preview + generación (client component) |
| `frontend/src/components/demo/DemoReportLauncher.tsx` | Botón cliente que abre el modal |
| `frontend/src/app/demo/reports/page.tsx` | Listado de proyectos demo |
| `frontend/src/app/demo/reports/[id]/page.tsx` | Vista del proyecto demo + tabla de 10 trabajadores |

> Total real: 10 archivos nuevos (el plan original mencionaba 9 más, agregué `demo-conteos.ts` para extraer lógica).

## Validaciones

### Gate 1 — Compilación
```bash
cd frontend && ./node_modules/.bin/tsc --noEmit
EXIT=0
```

### Gate 2 — Build de Next.js 16
```bash
cd frontend && NEXTAUTH_SECRET=demo ./node_modules/.bin/next build
✓ Compiled successfully
✓ Generating static pages (18/18)
Route /demo/reports           ○ (Static) prerendered
Route /demo/reports/[id]      ○ (Static) prerendered
```

### Gate 3 — Smoke test XLSX
- Magic bytes `PK` (ZIP) correctos
- Roundtrip XLSX → buffer → reload preserva las 3 hojas
- 16 KB de payload mínimo verificado

### Gate 4 — Cobertura de datos
- 10/10 trabajadores presentes en hoja CONCENTRADO del XLSX fuente
- 10/10 trabajadores presentes en hoja LABORATORIOS del XLSX fuente

### Restricciones de scope
- ✅ NO se tocó `prisma/schema.prisma`
- ✅ NO se modificaron rutas existentes (`/projects/*`, `/companies/*`, etc.)
- ✅ NO se agregaron dependencias (solo se usaron `xlsx` y `@react-pdf/renderer` ya en package.json)
- ✅ Todos los archivos viven bajo `frontend/src/app/demo/`, `frontend/src/components/demo/`, `frontend/src/lib/demo/`

## Self-review manual

| Criterio | Estado | Notas |
|---|---|---|
| Banner DEMO MODE visible en todas las páginas demo | ✅ | `DemoBanner` se monta en `/demo/reports/page.tsx` y `/demo/reports/[id]/page.tsx` |
| 10 trabajadores hardcodeados correctos | ✅ | 10/10 verificados contra el XLSX fuente por nombre |
| Preview muestra contadores | ✅ | Conteos calculados dinámicamente desde los datos |
| Generación XLSX con 3 hojas | ✅ | CONCENTRADO (22 cols), LABORATORIOS (27 cols), GRAFICAS (agregados) |
| Generación PDF con portada + concentrado | ✅ | Página 1 Portada "Diagnóstico Situacional", página 2+ tabla concentrado en orientación landscape |
| Demo 100% standalone | ✅ | No hay `fetch`, no hay `useEffect` con llamadas, no hay imports de Prisma ni de servicios backend |
| Descarga funciona | ✅ | Data URIs generados a partir de ArrayBuffer → click → descarga |

## ⚠️ Discrepancia detectada (requiere decisión)

El handoff (sección "Modal de preview") especifica los contadores esperados:

> "10 trabajadores en total"
> "7 con todos los estudios"
> "2 con estudios parciales"
> "1 sin estudios"

Sin embargo, al calcular con los **datos reales** del XLSX, los conteos son:

- **10 totales** ✅ coincide
- **8 con todos los estudios** ❌ (handoff esperaba 7)
- **2 con estudios parciales** ✅ coincide (HERNANDEZ BARRERA + RODRIGUEZ RAMIREZ)
- **0 sin estudios** ❌ (handoff esperaba 1)

### Causa

Los 10 trabajadores del XLSX tienen, como mínimo, audiometría + RX columna + laboratorios realizados. **Ningún** caso tiene TODOS los estudios como N/A, por lo que la categoría "sin estudios" queda en 0.

La categoría "completos" se calculó con el criterio: ningún campo crítico en "N/A" (campimetría x3, audiometría x3, espirometría x2, RX columna, RX tórax, ECG, BH Hb, QS6 gluc).

### Recomendación

Tres opciones para INTEGRA/GEMINI:

1. **Aceptar los conteos reales (10/8/2/0)** — más fiel a los datos, refleja la realidad del concentrado.
2. **Endurecer el criterio de "completos"** p. ej. exigir que `Tabaquismo !== 'POSITIVO'` o que `valoración postural` no esté vacía para bajar 1 completo a parcial. Sigue sin generar "sin estudios".
3. **Interpretar HERNANDEZ como "sin estudios"** porque su campimetría, RX tórax y ECG son N/A (decisión clínica, no algoritmica).

Por defecto se entrega la opción 1 (conteos reales).

## Riesgos y desviaciones

- **Folios del handoff**: el handoff lista folios como `168040` para MIRANDA y `168041` para NIEVES, pero los folios reales en el XLSX son `168024` y `168013` respectivamente. **Los nombres coinciden al 100%**, así que se usaron los folios reales del XLSX. Esto es coherente con el principio ANTI-ALUCINACIÓN de fidelidad a la fuente.
- **`XLSX.write` retorna `ArrayBuffer` en runtime navegador**: la función está tipada como `unknown` por SheetJS, por lo que se castea explícitamente con `as ArrayBuffer`. Documentado en el código.
- **PDF en SSR**: el componente `pdf-generator.tsx` se importa solo desde el modal (client component), nunca desde un server component. La función `generarPdf` usa `pdf(<Doc>).toBlob()` que solo funciona en navegador.
- **`force-static`**: las páginas `/demo/reports` y `/demo/reports/[id]` se prerenderizan estáticamente. Esto evita que se ejecuten en runtime (cero impacto en producción).

## Próximo paso sugerido

Invocar a **GEMINI** (`subagent_type='gemini'`) como segunda mano de validación para:
1. Confirmar la discrepancia de conteos (10/8/2/0 vs 10/7/2/1) y validar la opción por defecto.
2. Verificar que el XLSX generado abre correctamente en Excel/LibreOffice con las 3 hojas.
3. Verificar que el PDF generado abre en lectores PDF estándar.
4. Revisar la cobertura de tipos en `demo-types.ts`.

NO se solicita commit/PR — eso queda para INTEGRA tras la validación de GEMINI.

## Self-validation rápida

```bash
cd frontend && ./node_modules/.bin/tsc --noEmit && echo OK
```
