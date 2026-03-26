## SPEC: Prellenado Longitudinal con Vista Dual

**ID:** `ARCH-20260325-07`
**Padre:** `ARCH-20260324-08`, `ARCH-20260325-05`
**Objetivo:** Definir el prellenado del trabajador como una base longitudinal reutilizable entre citas, visible en Historia Clínica, y a la vez como snapshot clínico visible dentro del Examen Médico de cada cita.

### Decisión Arquitectónica
- El prellenado del trabajador no debe existir solo como dato efímero por cita.
- Tampoco debe sobrescribir directamente y sin control los datos maestros del trabajador.
- El modelo correcto es de dos capas:
  - **Base longitudinal del trabajador**: información declarativa reutilizable en el tiempo.
  - **Snapshot por cita**: copia congelada para el episodio clínico actual.
- La base longitudinal debe poder actualizarse en nuevas citas.
- Cada cita debe conservar su propia versión del dato para fines clínicos y de auditoría.

### Vistas Requeridas

#### 1. Historia Clínica del trabajador
- Debe mostrar el prellenado base reutilizable del trabajador.
- Es la vista principal para consultar la información longitudinal.
- Ruta objetivo: `frontend/src/app/history/[workerId]/page.tsx`
- Debe integrarse con la lógica existente de `ClinicalHistory`.

#### 2. Examen Médico de la cita
- Debe mostrar el snapshot del Módulo 1 usado por la cita actual.
- Debe indicar que esos datos provienen de una base histórica o prellenado previo cuando aplique.
- Debe permitir al médico revisar la versión utilizada en esa cita, sin depender de ediciones futuras del trabajador.

#### 3. Portal de prellenado
- El trabajador debe seguir capturando y actualizando desde el portal público de prellenado.
- Esa captura debe poder:
  - actualizar la base longitudinal reutilizable del trabajador
  - poblar o refrescar el snapshot de la cita actual

### Regla de Negocio
- El trabajador no debe volver a llenar desde cero información estable en cada cita.
- Si algo cambió, debe poder corregirlo o actualizarlo.
- Los cambios nuevos deben servir hacia adelante.
- La cita actual debe conservar evidencia de lo que el trabajador declaró en ese momento.

### Modelo de Persistencia Recomendado

#### Capa 1: Base longitudinal
- Ubicación recomendada: `ClinicalHistory.data` o estructura equivalente.
- Aquí viven los campos estables del Módulo 1, por ejemplo:
  - datos declarativos del trabajador
  - historia laboral base
  - antecedentes declarativos
  - hábitos y otra información de baja variación

#### Capa 2: Snapshot por cita
- Ubicación actual aceptable: `PrefilledInvitation.module1Data` o estructura ligada a appointment/event.
- El snapshot debe representar lo que aplica a la cita concreta.
- No debe mutar retroactivamente si el trabajador cambia su base longitudinal después.

### UX Esperada

#### Historia Clínica
- Sección nueva sugerida: **Historia Declarativa Base** o **Prellenado Base del Trabajador**.
- Debe mostrar última actualización.
- Debe permitir edición por staff autorizado.

#### Examen Médico
- Debe mostrar un indicador tipo:
  - "Precargado desde historia clínica del trabajador"
  - "Última actualización"
  - "Datos utilizados para esta cita"
- La edición clínica del episodio no debe confundirse con la base histórica.

#### Portal de prellenado
- Debe comunicar claramente que:
  - la información se reutilizará en futuras citas
  - puede actualizarse si algo cambió
  - la cita actual conservará una copia propia

### Criterios de Aceptación

#### A. Persistencia longitudinal
- El prellenado base del trabajador puede consultarse fuera de una cita específica.
- No se pierde al finalizar la cita.

#### B. Snapshot por cita
- Cada cita conserva su propia versión del Módulo 1.
- Si el trabajador actualiza su base después, la cita anterior no cambia retroactivamente.

#### C. Doble visibilidad
- El prellenado puede verse en Historia Clínica del trabajador.
- El prellenado puede verse también dentro del Examen Médico de la cita activa.

#### D. Reutilización
- Cuando el trabajador inicia un nuevo prellenado, el sistema parte de su base longitudinal previa.
- El usuario solo corrige o completa cambios recientes.

### Alcance Técnico
- `frontend/src/app/history/[workerId]/page.tsx`
- `frontend/src/components/clinical/AntecedentesForm.tsx`
- `frontend/src/app/prefill/[token]/PrefillPortalClient.tsx`
- `frontend/src/actions/prefilled-invitation.actions.ts`
- `frontend/src/actions/clinical-history.actions.ts`
- `frontend/src/components/clinical/ExamenMedicoEstudio.tsx`

### Fuera de Alcance
- Reemplazar por completo el modelo actual de `PrefilledInvitation`.
- Diseñar migración final de todos los campos entre entidades si no es necesaria para el primer corte.
- Cambiar Somatometría o Agudeza Visual; siguen fuera del prellenado y del Examen Médico.

### Estrategia de Implementación Recomendada

#### Etapa A
- Mostrar la base longitudinal en Historia Clínica reutilizando `ClinicalHistory`.
- Mostrar el snapshot de cita dentro del Examen Médico.

#### Etapa B
- Al abrir una invitación nueva, inicializar el prellenado con la base longitudinal existente.

#### Etapa C
- Al guardar o enviar el portal, actualizar:
  - snapshot de la cita actual
  - base longitudinal reutilizable del trabajador

### Riesgos a Evitar
- Sobrescribir la historia longitudinal del trabajador sin trazabilidad.
- Usar un único objeto mutable para todas las citas.
- Confundir la vista histórica del trabajador con la captura específica de una cita.
- Hacer que Somatometría o Agudeza Visual lean este modelo; no les corresponde.

### Veredicto
- Sí, debe verse en las dos ubicaciones.
- La Historia Clínica es la vista longitudinal principal.
- El Examen Médico debe mostrar el snapshot específico de la cita.
- El portal público debe ser el punto de actualización del trabajador.