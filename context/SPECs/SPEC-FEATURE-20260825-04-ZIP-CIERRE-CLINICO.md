# SPEC-FEATURE-20260825-04 — ZIP de cierre clínico

- **Estado:** READY_FOR_SOFIA (addendum de alcance)
- **Prioridad:** P1
- **Base:** `DEC-20260825-17`, `DEC-20260825-18`, `BR-20260825-18`, `BR-20260825-19`
- **Addendum vigente:** `DEC-20260826-01`, `BR-20260826-01`, `FND-20260826-02`
- **Validación solicitada:** mínima; generar, descargar y probar el artefacto. No ejecutar suite completa en esta primera pasada.

## Resultado

Endpoint autenticado que genera un ZIP por atención/cita del trabajador con:

- `01_Dictamen_General/dictamen-general.pdf`
- Una carpeta por cada Event/estudio aplicable de esa atención/cita, con dictamen PDF y fuente original cuando existan.
- `manifest.txt` con Event, archivos incluidos y fuentes ausentes.

## Reglas

- Sólo `SUPERADMIN`, `DOCTOR_GENERAL` y `DOCTOR_VALIDATOR` descargan el ZIP completo.
- `COMPANY_CLIENT` recibe 403.
- No mezclar Event/paciente; todos los datos se resuelven por `eventId`.
- El `eventId` recibido debe resolver la atención/cita y seleccionar únicamente Events hermanos del mismo trabajador y cita/atención.
- El PDF general debe usar el mismo formato visual AMI de referencia e integrar los hallazgos de los Events seleccionados.
- Fuente ausente: manifestar `NO_DISPONIBLE`, no inventar.
- Reutilizar rutas/helpers existentes; no crear almacenamiento persistente nuevo.
- El ZIP es una primera versión operativa; la persistencia documental definitiva queda diferida.

## Validación mínima

- Lint/typecheck focal del endpoint/helper.
- Un test de generación/estructura o smoke equivalente.
- Build Next si el cambio toca rutas de producción.
- No ejecutar V2 completa ni V3 Playwright en esta pasada; la descarga real de Frank será la prueba funcional inicial.
