# SPEC-FEATURE-20260825-04 — ZIP de cierre clínico

- **Estado:** READY_FOR_SOFIA
- **Prioridad:** P1
- **Base:** `DEC-20260825-17`, `DEC-20260825-18`, `BR-20260825-18`, `BR-20260825-19`
- **Validación solicitada:** mínima; generar, descargar y probar el artefacto. No ejecutar suite completa en esta primera pasada.

## Resultado

Endpoint autenticado que genera un ZIP por Event con:

- `01_Dictamen_General/dictamen-general.pdf`
- Una carpeta por estudio aplicable, con dictamen y fuente original cuando existan.
- `manifest.txt` con Event, archivos incluidos y fuentes ausentes.

## Reglas

- Sólo `SUPERADMIN`, `DOCTOR_GENERAL` y `DOCTOR_VALIDATOR` descargan el ZIP completo.
- `COMPANY_CLIENT` recibe 403.
- No mezclar Event/paciente; todos los datos se resuelven por `eventId`.
- Fuente ausente: manifestar `NO_DISPONIBLE`, no inventar.
- Reutilizar rutas/helpers existentes; no crear almacenamiento persistente nuevo.
- El ZIP es una primera versión operativa; la persistencia documental definitiva queda diferida.

## Validación mínima

- Lint/typecheck focal del endpoint/helper.
- Un test de generación/estructura o smoke equivalente.
- Build Next si el cambio toca rutas de producción.
- No ejecutar V2 completa ni V3 Playwright en esta pasada; la descarga real de Frank será la prueba funcional inicial.
