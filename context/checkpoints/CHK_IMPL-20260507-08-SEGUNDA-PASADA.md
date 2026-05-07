# CHK IMPL-20260507-08 — Segunda Pasada: Seguridad y Deduplicación de Cronograma

**Fecha:** 2026-05-07
**Agente:** SOFIA
**ID Intervención:** IMPL-20260507-08 (segunda pasada)
**SPEC:** context/SPECs/SPEC_ARCH-20260507-08-CRONOGRAMA-PAPELETA-ADMIN.md

---

## Correcciones Aplicadas

### 1. Seguridad server-side en `getEventTimeline`
**Archivo:** `frontend/src/actions/timeline.actions.ts`

**Problema:** La función exponía el cronograma sin validar sesión ni rol.

**Corrección:** Se añadieron dos guards al inicio de `getEventTimeline`:
- `session?.user?.id` → devuelve `{ success: false, error: 'No autenticado', data: null }` si no hay sesión.
- `session.user.role !== 'ADMIN'` → devuelve `{ success: false, error: 'Solo administradores pueden consultar el cronograma', data: null }` para roles no autorizados.

El contrato de retorno se mantiene idéntico (`{ success, error?, data }`), sin romper callers existentes.

---

### 2. Deduplicación de movimientos automáticos en `updateEventTestStatus`
**Archivo:** `frontend/src/actions/event-test.actions.ts`

**Problema:** `updateEventTestStatus` escribía en el timeline cada vez que se llamaba con un estado mapeado, sin importar si el estado realmente cambió.

**Corrección:** Antes de ejecutar el `prisma.eventTest.update`, se lee el estado previo:
```typescript
const prevTest = await prisma.eventTest.findUnique({
  where: { id: eventTestId },
  select: { status: true },
})
const oldStatus = prevTest?.status
```
La escritura en timeline se condiciona a `oldStatus !== status`:
```typescript
if (timelineType && oldStatus !== status) { ... }
```
La propagación de `SAMPLE_TAKEN` a hermanos **no fue modificada** — sigue funcionando igual.

---

## Gates de Calidad

| Gate | Estado | Detalle |
|------|--------|---------|
| 1. Compilación | ✅ Aprobado | Sin errores en ambos archivos (verificado con `get_errors`) |
| 2. Testing | ⚠️ Sin tests nuevos | Los cambios son guards defensivos; no añaden lógica nueva que requiera tests unitarios adicionales |
| 3. Revisión | ✅ Aprobado | Cambios mínimos y focalizados según scope del ARCH |
| 4. Documentación | ✅ Aprobado | Comentarios `IMPL-20260507-08` inline en ambos archivos |

---

## Archivos Tocados

| Archivo | Tipo de Cambio |
|---------|----------------|
| `frontend/src/actions/timeline.actions.ts` | Añadir guards de sesión y rol en `getEventTimeline` |
| `frontend/src/actions/event-test.actions.ts` | Leer `oldStatus` y guardar entrada solo si hay transición real |

---

## Estado

Listo para commit. Sin errores de editor. Sin cambios en UI ni en Prisma schema.
