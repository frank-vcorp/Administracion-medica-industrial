# Checkpoint — FIX-20260324-04
**Fecha:** 2026-03-24
**Agente:** INTEGRA - Arquitecto
**Objetivo:** Corregir la ausencia visual de la papeleta de estudios en Expedientes cuando los `EventTest` ya existen en base de datos.

---

## Causa raíz validada

1. El check-in sí instancia estudios programados como `EventTest` desde el `serviceProfileId` de la cita.
2. La vista del expediente sólo cargaba `studies` y `labs`, que representan archivos subidos/procesados, no la lista programada desde la cita.
3. Resultado: expedientes con `EventTest` reales seguían sin mostrar la papeleta en UI.

---

## Evidencia real

- Expediente `bf91dcf8-1349-4013-a72b-963f08681b6b` de `Juan Piñedo` tiene 3 `EventTest` en estado `PENDING`.
- Expediente `3c5d51a1-f31e-497b-90ba-0f10504199da` de `Frank Saavedra` tiene 4 `EventTest` y la UI corregida ya muestra `Papeleta de Estudios` con estudios como `EXAMEN MEDICO`, `QUÍMICA SANGUÍNEA DE 6` y `EXAMEN GENERAL DE ORINA`.

---

## Cambio aplicado

1. `getEventById()` ahora incluye `eventTests` con metadatos del estudio.
2. La vista `events/[id]` ahora renderiza la sección `Papeleta de Estudios` y muestra nombre, código, categoría y estado.

---

## Validación

- Sin errores de TypeScript/diagnóstico en los archivos modificados.
- Validación local con sesión ADMIN y stack reconstruido usando base remota.
- Confirmado que la sección aparece en el DOM final del expediente.