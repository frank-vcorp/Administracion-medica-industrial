## SPEC: Transición a Historial Maestro Longitudinal

**ID:** `ARCH-20260326-06`
**Padre:** `ARCH-20260326-04`, `ARCH-20260325-07`
**Objetivo:** Transformar el Historial Clínico en el editor maestro longitudinal y hacer que el portal de prellenado solo alimente esa misma base, eliminando la estructura paralela actual y reduciendo la recaptura innecesaria dentro del Examen Médico.

### Problema actual
- El portal de prellenado escribe en `ClinicalHistory.data.prefill_base`.
- El Historial Clínico editable actual guarda en otra estructura raíz (`patologicos`, `heredo_familiares`, `no_patologicos`).
- La ficha del trabajador y la vista Historial muestran `prefill_base` como si fuera la base longitudinal, pero el médico edita otra cosa.
- El Examen Médico todavía permite recapturar información longitudinal ya conocida.

### Decisión de diseño
- La base longitudinal maestra será `ClinicalHistory.data` en su raíz, no `prefill_base`.
- El portal de prellenado ya no alimentará una estructura paralela; deberá fusionar su captura directamente en `ClinicalHistory.data`.
- El Historial Clínico será el editor principal de esa misma base longitudinal.
- El Examen Médico conservará únicamente snapshot de cita y consulta clínica del episodio.

### Modelo canónico de datos longitudinales
`ClinicalHistory.data` debe soportar y persistir como campos maestros:
- `datos_personales`
- `historia_laboral`
- `heredo_familiares`
- `patologicos`
- `no_patologicos`

**Nota:** `ginecologicos_inmunizaciones` puede quedar para una etapa posterior si la migración del primer corte se vuelve demasiado amplia. No bloquea este corte.

### Alcance de implementación

#### 1. Esquemas
Actualizar [frontend/src/schemas/clinical/history.schema.ts](frontend/src/schemas/clinical/history.schema.ts) para que `ClinicalHistoryDataSchema` acepte los campos longitudinales maestros compatibles con el portal y el historial:
- `datos_personales`
- `historia_laboral`
- `heredo_familiares`
- `patologicos`
- `no_patologicos`

Reutilizar, donde sea posible, los esquemas ya definidos en [frontend/src/schemas/clinical/prefilled.schema.ts](frontend/src/schemas/clinical/prefilled.schema.ts).

#### 2. Portal de prellenado
Actualizar [frontend/src/actions/prefilled-invitation.actions.ts](frontend/src/actions/prefilled-invitation.actions.ts):
- `validatePublicToken()` debe dejar de depender de `prefill_base` y leer directamente desde `ClinicalHistory.data` como base longitudinal.
- `submitModule1()` debe fusionar `datos_personales`, `historia_laboral` y `heredo_familiares` directamente en `ClinicalHistory.data`.
- Debe preservarse la lógica de snapshot por cita en `PrefilledInvitation.module1Data`.

#### 3. Historial Clínico
Actualizar [frontend/src/components/clinical/AntecedentesForm.tsx](frontend/src/components/clinical/AntecedentesForm.tsx):
- Debe evolucionar de un formulario parcial a un editor maestro longitudinal.
- Debe incluir, además de lo existente:
  - datos personales declarativos
  - historia laboral
  - heredo-familiares
  - patológicos
  - no patológicos si el corte lo permite dentro del tiempo y complejidad razonables
- Debe inicializarse desde `ClinicalHistory.data` raíz.
- Debe guardar contra `upsertWorkerClinicalHistory()` sin perder campos ya existentes.

Actualizar [frontend/src/actions/clinical-history.actions.ts](frontend/src/actions/clinical-history.actions.ts):
- `upsertWorkerClinicalHistory()` debe hacer merge defensivo con el estado actual cuando el payload sea parcial, para no borrar secciones longitudinales no editadas en la sesión actual.

#### 4. Vistas longitudinales
Actualizar:
- [frontend/src/app/history/[workerId]/page.tsx](frontend/src/app/history/[workerId]/page.tsx)
- [frontend/src/app/workers/[id]/page.tsx](frontend/src/app/workers/[id]/page.tsx)

Requisitos:
- Deben leer la base longitudinal desde `ClinicalHistory.data` raíz.
- Deben dejar de tratar `prefill_base` como fuente maestra.
- La ficha del trabajador mantiene su bloque resumen.
- La vista Historial conserva el editor maestro.

#### 5. Examen Médico
Actualizar [frontend/src/components/clinical/ExamenMedicoEstudio.tsx](frontend/src/components/clinical/ExamenMedicoEstudio.tsx):
- El snapshot del portal se mantiene como referencia de la cita.
- Debe eliminarse la recaptura editable de `datos_personales`, `historia_laboral` y `heredo_familiares` dentro del Módulo 1.
- En su lugar, mostrar:
  - resumen del snapshot longitudinal usado en la cita
  - CTA visible para abrir el Historial Clínico maestro
- Se conservan en este corte:
  - exploración física
  - impresión diagnóstica
  - aptitud
- `patologicos` y `no_patologicos` pueden mantenerse temporalmente en el examen solo si moverlos en este mismo corte incrementa demasiado el riesgo; si SOFIA puede moverlos sin romper el flujo, mejor hacerlo en esta misma implementación.

### Reglas de migración
- No hacer migraciones destructivas de datos.
- Mantener compatibilidad de lectura temporal con `prefill_base` solo como fallback de transición si existen registros previos.
- Todo dato nuevo debe escribirse ya en la raíz de `ClinicalHistory.data`.

### Criterios de aceptación

#### A. Fuente única longitudinal
- El sistema deja de depender de `prefill_base` como estructura primaria para nuevos datos.
- La base longitudinal maestra vive en `ClinicalHistory.data`.

#### B. Portal alimenta al historial maestro
- Lo enviado por el trabajador termina integrado en la misma base que después edita el médico.

#### C. Historial editable real
- El médico puede editar desde Historial la misma información longitudinal que el trabajador precargó.

#### D. Menos duplicación en examen
- El Examen Médico ya no recaptura manualmente `datos_personales`, `historia_laboral` y `heredo_familiares`.

#### E. Snapshot preservado
- La cita actual sigue conservando `PrefilledInvitation.module1Data` como evidencia/snapshot por episodio.

### Archivos objetivo
- [frontend/src/schemas/clinical/history.schema.ts](frontend/src/schemas/clinical/history.schema.ts)
- [frontend/src/components/clinical/AntecedentesForm.tsx](frontend/src/components/clinical/AntecedentesForm.tsx)
- [frontend/src/actions/clinical-history.actions.ts](frontend/src/actions/clinical-history.actions.ts)
- [frontend/src/actions/prefilled-invitation.actions.ts](frontend/src/actions/prefilled-invitation.actions.ts)
- [frontend/src/app/history/[workerId]/page.tsx](frontend/src/app/history/[workerId]/page.tsx)
- [frontend/src/app/workers/[id]/page.tsx](frontend/src/app/workers/[id]/page.tsx)
- [frontend/src/components/clinical/ExamenMedicoEstudio.tsx](frontend/src/components/clinical/ExamenMedicoEstudio.tsx)

### Veredicto
- No hay que eliminar el formulario del Historial.
- Hay que convertirlo en el editor maestro longitudinal.
- El prellenado debe alimentar esa misma base, no una estructura paralela.