## SPEC: Separación de Somatometría y Agudeza Visual del Examen Médico

**ID:** `ARCH-20260325-05`
**Padre:** `ARCH-20260324-08`, `ARCH-20260325-01`
**Objetivo:** Reestructurar el flujo clínico para que Somatometría y Agudeza Visual operen como estudios independientes de la Papeleta, seleccionables por perfil, y dejar el Examen Médico únicamente con su contenido médico propio.

### Decisión Arquitectónica
- Somatometría y Agudeza Visual son estudios elegibles desde el perfil médico.
- Por lo tanto deben existir como `EventTest` independientes dentro de la Papeleta.
- No deben vivir como captura fija autónoma fuera del catálogo de estudios seleccionados.
- No deben formar parte del formulario de Examen Médico.
- Examen Médico no debe mostrar, editar ni heredar campos de Somatometría o Agudeza Visual.
- La Papeleta debe pasar a ser el centro operativo desde el Paso 2 del expediente.

### Cambio Funcional Aprobado
#### 1. Paso 2
- El Paso 2 deja de ser un formulario global de triaje separado.
- El Paso 2 debe abrir la Papeleta/Workspace de estudios.
- Si el perfil incluye Somatometría y/o Agudeza Visual, deben aparecer ahí como estudios individuales.
- Si el perfil no los incluye, no deben aparecer por defecto.

#### 2. EventTests
- `checkInAppointment()` ya instancia `EventTest` desde el perfil asignado; esta lógica debe mantenerse.
- Somatometría y Agudeza Visual deben renderizarse como estudios especializados dentro de la Papeleta cuando existan como `EventTest`.
- No deben duplicarse fuera de la Papeleta.

#### 3. Examen Médico
- Debe eliminarse del formulario de Examen Médico:
  - la tab de datos de Sala
  - el resumen heredado de Somatometría
  - el resumen heredado de Agudeza Visual
  - cualquier cálculo o dependencia UI basada en esos datos
- Examen Médico debe quedar con:
  - Módulo 1 declarativo
  - Exploración física
  - Impresión diagnóstica y aptitud
  - campos médicos propios del estudio

#### 4. Prellenado
- El prellenado NO debe guardarse como fuente de verdad directa en los datos maestros del trabajador.
- El prellenado debe seguir asociado a la cita / invitación / estudio Examen Médico como captura declarativa del Módulo 1.
- Examen Médico sí puede consumir prellenado, pero únicamente para su bloque declarativo propio.
- Somatometría y Agudeza Visual no deben leer ni heredar ese prellenado, porque son estudios independientes.
- Si en el futuro se desea promover ciertos datos estables al maestro del trabajador o a historia clínica, debe hacerse como sincronización controlada y validada, no como escritura automática desde el portal público.

#### 5. Persistencia longitudinal recomendada
- A nivel de producto, el prellenado sí debe poder persistir y actualizarse en el tiempo, porque gran parte de su contenido cambia poco entre cita y cita.
- La arquitectura recomendada es de dos capas:
  - **Capa longitudinal del trabajador**: guardar la base histórica/declarativa reutilizable en `ClinicalHistory` o entidad equivalente.
  - **Capa snapshot por cita**: al generar o abrir una nueva invitación, copiar esa base al contexto de la cita/Examen Médico para que quede congelada como referencia del episodio actual.
- El trabajador debe poder editar su base longitudinal en nuevas citas, y esos cambios deben actualizar la información reutilizable hacia adelante.
- La cita actual no debe depender de mutaciones posteriores del trabajador; debe conservar su snapshot propio para auditoría clínica.
- En esta iteración no es obligatorio implementar aún la sincronización entre ambas capas, pero esa es la dirección correcta del modelo.

### Criterios de Aceptación
#### A. Flujo de expediente
- Al entrar al Paso 2, el usuario trabaja ya sobre la Papeleta.
- No existe una pantalla separada de triaje global para Somatometría/Agudeza Visual.

#### B. Somatometría y Agudeza Visual
- Si el perfil incluye Somatometría, aparece como estudio independiente en la Papeleta.
- Si el perfil incluye Agudeza Visual, aparece como estudio independiente en la Papeleta.
- Si el perfil no los incluye, no aparecen.
- Cada uno conserva su captura independiente y su propio estado de `EventTest`.

#### C. Examen Médico limpio
- Examen Médico ya no muestra bloques de Somatometría.
- Examen Médico ya no muestra bloques de Agudeza Visual.
- Examen Médico ya no depende de `examData.somatometryData` ni de `examData.eyeAcuityData` para renderizar tabs o estados.

#### D. No duplicación
- Somatometría y Agudeza Visual no deben aparecer simultáneamente como estudios independientes y como parte interna del Examen Médico.

### Alcance Técnico
#### Archivos esperados
- `frontend/src/app/events/[id]/page.tsx`
- `frontend/src/components/clinical/PapeletaWorkspace.tsx`
- `frontend/src/components/clinical/TriageForm.tsx`
- `frontend/src/components/clinical/ExamenMedicoEstudio.tsx`
- `frontend/src/actions/medical-exam.actions.ts`
- Si conviene, componentes nuevos:
  - `frontend/src/components/clinical/studies/SomatometriaStudy.tsx`
  - `frontend/src/components/clinical/studies/AgudezaVisualStudy.tsx`

### Diseño Recomendado
#### 1. Paso 2 como entrada al workspace
- En `events/[id]`, `CHECKED_IN` debe llevar al workspace de la Papeleta en lugar de mostrar `TriageForm` como pantalla global separada.
- Debe revisarse si `IN_PROGRESS` se conserva como vista distinta o si se simplifica el flujo visual para no duplicar Papeleta entre Paso 2 y Paso 3.

#### 2. Reutilización de captura
- La lógica actual de captura en `TriageForm` puede reutilizarse, pero debe migrarse a componentes de estudio dentro de la Papeleta.
- No conviene perder esa lógica; conviene encapsularla por estudio.

#### 3. Limpieza del Examen Médico
- Quitar la tab `sala`.
- Quitar labels y helpers ligados a Somatometría/Agudeza Visual.
- Recalcular tabs y estados de completitud sin esas dependencias.

### Riesgos a Evitar
- Dejar Somatometría y Agudeza Visual visibles tanto en Paso 2 global como dentro de la Papeleta.
- Romper el guardado actual de esos datos al mover la UI.
- Mantener dependencias invisibles del Examen Médico respecto a `somatometryData` y `eyeAcuityData`.
- Duplicar la Papeleta en dos pasos distintos del flujo.

### Lo Que Sí Falta Considerar
- Definir si el estado `CHECKED_IN` usará la misma vista de Papeleta que hoy usa `IN_PROGRESS`, o si habrá transición automática a `IN_PROGRESS` al abrir estudios.
- Verificar si la serialización de `examData` en `events/[id]` sigue siendo necesaria para Somatometría/Agudeza Visual una vez que salgan del Examen Médico.
- Revisar si `updateSomatometria` y `updateAgudezaVisual` deben seguir escribiendo sobre la misma entidad o si a futuro conviene desacoplarlas del modelo del examen médico. Para esta iteración no es obligatorio cambiar persistencia si la UI y semántica quedan correctas.
- Definir en una iteración posterior si algunos campos estables del prellenado deben promoverse a `Worker` o a `ClinicalHistory`, siempre mediante validación explícita del personal de salud.
- Diseñar la regla exacta de sincronización entre historial longitudinal y snapshot por cita para evitar sobrescrituras no auditables.

### Veredicto
- Sí: a grandes rasgos ese es el cambio correcto.
- Lo que faltaba explicitar es que no basta con “moverlos”; también hay que resolver la duplicación de Papeleta entre Paso 2 y Paso 3, y limpiar las dependencias internas del Examen Médico para que no siga leyendo esos datos por debajo.
