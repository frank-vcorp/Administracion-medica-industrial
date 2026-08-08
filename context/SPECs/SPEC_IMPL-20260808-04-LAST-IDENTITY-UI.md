# SPEC IMPL-20260808-04 — Mostrar última identificación en Ficha, Listado y Modal de Corroboración

**Fecha:** 2026-08-08
**Estado:** VERIFYING (con observaciones de INTEGRA — requiere ajustes antes de DONE)
**ID:** IMPL-20260808-04
**Origen:** Escalamiento ATLAS M3 desde necesidad explícita de Frank.
**Tipo:** UI / consumo de datos existentes (sin cambios de schema, sin migración).
**Prioridad:** P2 (mejora UX sobre datos ya persistidos; no bloquea operación).
**SPEC predecesoras:** `SPEC_ARCH-20260519-10-SPRINT1-RECEPCION-OPERATIVA.md` (persistencia de `lastIdentity*` en `closeReceptionCorroboration`).
**ADR relacionadas:** Ninguna directa. La decisión de payload del listado (ver §6) puede motivar un ADR ligero si Frank elige miniatura server-side.

---

## 1. Objetivo

Exponer la última identificación persistida del paciente (`lastIdentity*` en `Worker`) en tres puntos de la UI, con miniatura ampliable, sin re-capturar ni migrar datos:

1. **Ficha del paciente** (`/workers/[id]`): card "Identificación" con miniatura ampliable (frente + reverso opcional) y metadatos (tipo, fecha de verificación).
2. **Listado de pacientes** (`/workers`): miniatura ampliable por fila.
3. **Modal de corroboración** (`CorroborationModal`): mostrar la identificación previa del paciente cuando llega a una cita **después de la primera**, con vista ampliada.

**Necesidad verbatim de Frank:** *"La Identificación va en la Ficha del paciente, miniatura ampliable, miniatura de 200px en el listado y si va a una cita después de la primera que se vea la identificación en el modal de corroboración."*

## 2. Contexto técnico

- **Stack:** Next.js 16.1.6 (App Router) + TypeScript + Prisma 5.22.0 + PostgreSQL (Railway).
- **Campos ya existentes en `Worker`** (`frontend/prisma/schema.prisma:194-197`, migración `ARCH-20260519-10`):
  - `lastIdentityDocumentType: String?` (catálogo `IdentityDocumentType`)
  - `lastIdentityFrontFileUrl: String?` — **data URL base64** inline (NO es URL de storage externo).
  - `lastIdentityBackFileUrl: String?` — data URL base64 inline.
  - `lastIdentityVerifiedAt: DateTime?`
- **Persistencia:** `closeReceptionCorroboration` (`frontend/src/actions/appointment.actions.ts:686-863`) escribe los 4 campos en `tx.worker.update` (líneas 783-793) tras cada check-in con captura nueva o reutilización. NO se persisten en modo `EXCEPTION_WITHOUT_CAPTURE`.
- **Tamaño típico de un dataURL base64 de INE:** 0.5–2 MB por imagen. No hay miniatura server-side (verificado: no existe `sharp`, ni `generateThumbnail`, ni storage S3 para identidad — las imágenes viven inline en la BD).
- **Consumidores actuales de `getWorkers()`** (`frontend/src/actions/worker.actions.ts:25-37`): `WorkerSelectableGrid` (listado) y posiblemente otros. No se auditaron todos en este pase.
- **Next.js 16+:** `params`/`searchParams` son `Promise` en `page.tsx`/`layout.tsx`/`route.ts` — `await params` obligatorio (ver `frontend/src/app/workers/[id]/page.tsx:13-14`, ya correcto).

## 3. Entregable de SOFIA (ya implementado, en revisión)

SOFIA ejecutó el handoff **sin SPEC previa**. Archivos producidos:

- **2 nuevos:**
  - `frontend/src/components/IdentityLightbox.tsx` (139 líneas) — lightbox nativo basado en `<dialog>` + `showModal()`, backdrop click + ESC, frente + reverso opcional.
  - `frontend/src/components/workers/WorkerIdentityCard.tsx` (153 líneas) — card para la ficha, consume `IdentityLightbox`, maneja estado vacío.
- **5 modificados:**
  - `frontend/src/services/worker.service.ts:10-27` — `getWorkerById` con `include` (company + medicalHistory); los 4 `lastIdentity*` llegan automáticamente como escalares implícitos.
  - `frontend/src/actions/worker.actions.ts:16-37` — `getWorkers` con `include` (company + jobPosition); los 4 `lastIdentity*` llegan automáticamente.
  - `frontend/src/components/workers/WorkerSelectableGrid.tsx:25-44,163-165,209-235,305-327` — `SelectableWorker` extendido con 4 campos opcionales; columna "Identificación" oculta en móvil; miniatura 48×48px (`w-12 h-12`) desde `lastIdentityFrontFileUrl`; lightbox integrado.
  - `frontend/src/components/CorroborationModal.tsx:24,113-115,191-236,524-538` — bloque compacto "Identificación previa del paciente" siempre visible si hay evidencia; botón "♻️ Reutilizar" que setea `evidenceMode='REUSED_PREVIOUS'`; lightbox integrado.
  - `frontend/src/app/workers/[id]/page.tsx:11,124-133` — importa y renderiza `WorkerIdentityCard` pasando los 4 campos.

## 4. Cumplimiento del requerimiento literal (3 puntos)

| # | Requerimiento verbatim | Entregable SOFIA | Cumple |
|---|---|---|---|
| 1 | Ficha del paciente, miniatura ampliable | `WorkerIdentityCard` + `IdentityLightbox` en `/workers/[id]` | ✅ Sí |
| 2 | Miniatura de 200px en el listado | `WorkerSelectableGrid` renderiza **48×48px** (`w-12 h-12`) desde el dataURL completo | ⚠️ Parcial — tamaño desviado (48px ≠ 200px) + problema de payload (ver §5) |
| 3 | Identificación visible en el modal de corroboración tras la primera cita | `CorroborationModal` bloque compacto + botón Reutilizar + lightbox | ✅ Sí |

## 5. Gaps detectados por INTEGRA (bloquean DONE)

### GAP-1 — CRÍTICO: payload del listado trae dataURLs completos

`getWorkers()` (`worker.actions.ts:25-37`) usa `include` sin `select` raíz, por lo que Prisma retorna **todos los escalares del Worker**, incluyendo `lastIdentityFrontFileUrl` y `lastIdentityBackFileUrl` (dataURLs base64 de ~1 MB cada uno).

- Para N workers, el RSC payload del listado ≈ N × 1–2 MB.
- Con 50 workers: ~50–100 MB. Con 200: ~200–400 MB.
- **Riesgo sistémico real:** excede límites prácticos de RSC payload de Vercel, degrada tiempos de carga (especialmente móvil/3G), eleva coste de bandwidth, y escala mal con el padrón (clínica industrial puede tener cientos/miles de trabajadores).
- El comentario de SOFIA en `worker.actions.ts:18-24` justifica el `include` por la limitación de Prisma 5.x ("no permite combinar `select`+`include` al mismo nivel"). La justificación es cierta pero **no exime de la responsabilidad del payload**: se puede resolver con `select` explícito en todos los campos (sin `include`) o con `include` anidado + `select` raíz vía una vista/DTO.
- **`getWorkerById` (ficha, 1 worker) SÍ es aceptable** con `include` completo: un solo dataURL de ~1 MB es razonable para una vista de detalle.

### GAP-2 — MENOR: tamaño de miniatura no coincide con el requerimiento

El usuario pidió "miniatura de 200px". SOFIA implementó 48×48px (`w-12 h-12`). Desviación del requerimiento literal. Fácil de corregir en CSS, **pero está acoplado a GAP-1**: mostrar 200px desde el dataURL completo agrava el problema de payload (descargar 1 MB para renderizar 200px es ineficiente; el navegador no puede sub-muestrear dataURLs inline de forma óptima).

### GAP-3 — PROCESO: falta de registro en cola canónica

`IMPL-20260808-04` no figura en la "Cola de ejecución" canónica de `PROYECTO.md` (líneas 167-182). SOFIA trabajó sin SPEC previa, violando §4 del algoritmo IDL (READY con SPEC → delegar). Como el trabajo ya está hecho, esta SPEC retroactiva sanea el contrato; el registro en cola queda como tarea de CRONISTA (mover a `VERIFYING` con observaciones).

## 6. Decisión arquitectónica ABIERTA (REQUIERE OK de Frank)

La resolución de GAP-1 + GAP-2 exige elegir cómo se sirve la miniatura del listado. Confianza < 80 % en que la opción preferida coincida con la intención de producto de Frank → **escalar** (§2: infra/contrato requiere evidencia o aprobación, aunque la confianza fuera alta).

### Opción A — Lazy loading sin miniatura visible (recomendada para alcance inmediato)
- `getWorkers()` cambia a `select` explícito **excluyendo** `lastIdentityFrontFileUrl` y `lastIdentityBackFileUrl`.
- El listado muestra un placeholder "🪪" (o avatar con iniciales) por fila; al clickar, una server action `getWorkerIdentityUrls(workerId)` retorna solo los dataURLs de ese worker y abre el `IdentityLightbox`.
- **Cumple:** "miniatura ampliable" (vía lightbox). **NO cumple literal:** "miniatura de 200px visible" en el listado.
- **Coste:** bajo, sin infra, sin migración. Re-trabajo de SOFIA ~1 h.
- **Escalabilidad:** óptima (payload del listado vuelve a metadatos livianos).

### Opción B — Miniatura server-side visible de 200px (cumple literal)
- Al persistir evidencia en `closeReceptionCorroboration`, generar una miniatura 200px (con `sharp` en server action, o vía endpoint backend) y almacenarla en nueva columna `lastIdentityFrontThumbnailUrl` (y `...Back...`).
- Requiere: migración Prisma aditiva + generación de miniatura + re-generación retroactiva para workers existentes con evidencia + ajuste de `getWorkers` para traer solo la miniatura (no el dataURL completo).
- **Cumple:** requerimiento literal "miniatura de 200px en el listado".
- **Coste:** medio-alto. Toca schema, flujo de persistencia, y requiere one-off de backfill para datos existentes.
- **Riesgo:** `sharp` en Vercel serverless puede tener límites de memoria/tiempo; conviene validar.

### Opción C — Mantener dataURL completo en listado (NO recomendada)
- Solo aceptable si el volumen típico de workers por listado es bajo (< 20). No escala. NO recomendada para clínica industrial con padrón grande.

### Recomendación INTEGRA
**Opción A** como baseline inmediato (desbloquea, cumple "ampliable", sin infra), y abrir SPEC separada (`SPEC_ARCH-...-MINIATURA-SERVER-SIDE-IDENTIDAD`) para **Opción B** si Frank confirma que la miniatura visible de 200px es requerimiento duro. Desacopla avance de la decisión de infra.

## 7. Criterios de aceptación CORREGIDOS (para el re-trabajo de SOFIA)

Asumiendo Opción A (baseline). Si Frank elige Opción B, se sustituyen C-2 y C-3.

- **C-1 (Ficha):** `/workers/[id]` muestra `WorkerIdentityCard` con frente ampliable (y reverso si existe), tipo de documento, fecha de verificación, y estado vacío "Sin identificación registrada" cuando no hay evidencia. ✓ Ya cumple SOFIA.
- **C-2 (Listado — payload):** `getWorkers()` **no** retorna `lastIdentityFrontFileUrl` ni `lastIdentityBackFileUrl` en el payload del listado. Verificable: el JSON de la server action no contiene esas claves para N>1 workers.
- **C-3 (Listado — miniatura ampliable):** cada fila con evidencia muestra un control "🪪 Ver INE" (placeholder) que, al clickar, invoca `getWorkerIdentityUrls(workerId)` y abre `IdentityLightbox`. Filas sin evidencia muestran avatar de iniciales (estado actual, ya correcto).
- **C-4 (Modal):** `CorroborationModal` muestra el bloque compacto "Identificación previa del paciente" cuando `hasLastEvidence === true`, con miniatura ampliable vía lightbox, tipo + fecha, y botón "♻️ Reutilizar" que setea `evidenceMode='REUSED_PREVIOUS'`. Visible independientemente del modo elegido. ✓ Ya cumple SOFIA.
- **C-5 (Reuso de componente):** `IdentityLightbox` se consume en los 3 sitios (ficha, listado, modal) sin duplicación. ✓ Ya cumple SOFIA.
- **C-6 (Compatibilidad):** `SelectableWorker` mantiene los 4 campos de identidad como **opcionales** (no rompe consumidores legados que no los incluyan). ✓ Ya cumple SOFIA.
- **C-7 (Next.js 16+):** `await params` en `workers/[id]/page.tsx`. ✓ Ya cumple SOFIA (línea 14).
- **C-8 (Gates):** `pnpm typecheck` sin **nuevos** errores; `pnpm test` verde; `pnpm lint` sin **nuevos** errores/warnings respecto al baseline. Los 9 errores / 12 warnings pre-existentes (reportados por ATLAS) **no** son scope de este corte — quedan en backlog.
- **C-9 (Sin migración, sin secretos):** no se toca `schema.prisma`, ni migraciones, ni backend Python, ni server actions de persistencia (Opción A). Solo lectura.

## 8. Casos borde

- **Worker sin identificación persistida** (primera cita, o sólo excepciones sin captura): ficha muestra estado vacío; listado muestra avatar de iniciales; modal no muestra bloque compacto (`hasLastEvidence=false`). ✓ Cubierto.
- **Sólo frente, sin reverso:** `IdentityLightbox` renderiza una sola columna (`backSrc` null). ✓ Cubierto.
- **Data URL corrupta / no cargable:** el `<img>` nativo muestra icono de imagen rota. Aceptable para este corte (no hay validación de integridad del base64); documentar como deuda.
- **Listado con 500+ workers:** con Opción A, el payload escala a metadatos livianos. Con la implementación actual de SOFIA (dataURL completo), payload inviable — este es GAP-1.
- **Click en "Reutilizar" cuando ya estás en modo `REUSED_PREVIOUS`:** botón deshabilitado (`disabled={evidenceMode === 'REUSED_PREVIOUS'}`, ver `CorroborationModal.tsx:229`). ✓ Cubierto.
- **Concurrencia:** `lastIdentity*` se actualiza en `closeReceptionCorroboration` dentro de `prisma.$transaction` (líneas 772-836). No hay race condition nueva en este corte (sólo lectura desde UI).

## 9. Validaciones detectables (DoD)

1. `rg "lastIdentityFrontFileUrl|lastIdentityBackFileUrl" frontend/src/actions/worker.actions.ts` → **no aparece en el `findMany` de `getWorkers`** (sí puede aparecer en `select` de la nueva `getWorkerIdentityUrls`).
2. Abrir `/workers` con N trabajadores con evidencia: el RSC payload (Network > Doc > respuesta de la ruta) no contiene bloques base64 de ~1 MB por worker.
3. Click en "🪪 Ver INE" de una fila → request a `getWorkerIdentityUrls` → abre `IdentityLightbox` con la imagen ampliada.
4. Abrir `/workers/[id]` → `WorkerIdentityCard` visible con miniatura; click amplía.
5. Abrir `CorroborationModal` para una cita de un worker con evidencia previa → bloque compacto visible; click en miniatura amplía; botón "♻️ Reutilizar" cambia a modo `REUSED_PREVIOUS`.
6. `pnpm typecheck && pnpm test && pnpm lint` sin regresiones vs baseline.

## 10. Handoff a SOFIA (re-trabajo, NO ejecutar hasta OK de Frank)

```
ALCANCE: IMPL-20260808-04 — corregir GAP-1 (payload del listado) y GAP-2 (miniatura).
DECISIÓN FRANK PENDIENTE: Opción A (lazy) vs Opción B (miniatura server-side). Ver SPEC §6.
NO EJECUTAR HASTA QUE INTEGRA CONFIRME la opción elegida por Frank.

Si Opción A:
  - worker.actions.ts: getWorkers() → select explícito EXCLUYENDO lastIdentityFrontFileUrl
    y lastIdentityBackFileUrl (conservar lastIdentityDocumentType y lastIdentityVerifiedAt
    como metadatos livianos para el placeholder).
  - Nueva server action getWorkerIdentityUrls(workerId): retorna solo
    { frontFileUrl, backFileUrl } para ese worker. select mínimo.
  - WorkerSelectableGrid.tsx: reemplazar miniatura 48px por placeholder "🪪 Ver INE"
    que invoca getWorkerIdentityUrls y abre IdentityLightbox. Mantener avatar de iniciales
    cuando no hay evidencia.
  - NO tocar: getWorkerById (ficha), WorkerIdentityCard, CorroborationModal, IdentityLightbox.

Si Opción B:
  - Abrir SPEC separada (miniatura server-side + columna thumbnail + backfill). Mayor alcance.

Validaciones obligatorias antes de cerrar:
  1. pnpm typecheck
  2. pnpm test
  3. pnpm lint
Antes de reportar como listo, NO pidas qodo (sunset). Self-review manual:
  - ¿El código refleja esta SPEC?
  - ¿Hay code smells evidentes?
  - ¿Los edge cases de §8 están cubiertos?
  - ¿Algún riesgo de regresión en getWorkers (otros consumidores)?
Solicitar revisión final a GEMINI (subagent_type='gemini') como segunda mano.
```

## 11. Notas

- Esta SPEC es **retroactiva**: documenta el trabajo ya ejecutado por SOFIA + los gaps detectados + el contrato de re-trabajo. Sanea la omisión de SPEC previa.
- El registro en la cola canónica de `PROYECTO.md` (mover a `VERIFYING` con observaciones) es tarea de CRONISTA, no de SOFIA.
- Si Frank elige Opción B, esta SPEC queda como referencia del alcance parcial ya entregado (ficha + modal cumplen; listado queda a la espera de miniatura server-side).
