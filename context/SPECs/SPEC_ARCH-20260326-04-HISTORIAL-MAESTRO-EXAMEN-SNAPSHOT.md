## SPEC: Historial Maestro Longitudinal y Examen como Snapshot por Cita

**ID:** `ARCH-20260326-04`
**Padre:** `ARCH-20260325-07`, `ARCH-20260325-05`, `ARCH-20260324-04`
**Objetivo:** Consolidar la Historia Clínica como fuente maestra longitudinal editable por médico y usar el Examen Médico solo como snapshot clínico por cita, eliminando la recaptura innecesaria del Módulo 1.

### Decisión Arquitectónica
- La Historia Clínica del trabajador será la fuente maestra longitudinal de antecedentes y datos declarativos persistentes.
- El Examen Médico no debe volver a capturar de forma completa datos que ya existen en la Historia Clínica.
- El Examen Médico conservará un snapshot por cita para fines clínicos, legales y de auditoría.
- El portal del trabajador será una fuente de prellenado útil, pero no la única ni la autoridad final.
- El médico debe poder editar completamente la Historia Clínica, porque en la práctica muchas veces completará o corregirá información que el trabajador no puede declarar con precisión.

### Regla de Autoridad de Dato

#### 1. Historia Clínica longitudinal
- Es la fuente maestra.
- Puede ser editada por personal clínico autorizado.
- Puede ser parcialmente alimentada por el trabajador desde el portal.
- Debe persistir entre citas y servir como base para nuevas atenciones.

#### 2. Examen Médico por cita
- Es un snapshot clínico del estado usado en esa cita.
- No sustituye ni redefine por sí mismo la historia maestra.
- Debe tomar como base la Historia Clínica al iniciar el episodio.
- Solo debe capturar:
  - confirmación de datos longitudinales relevantes para la cita
  - cambios detectados en la consulta actual
  - hallazgos clínicos propios del episodio
  - impresión diagnóstica, aptitud y exploración física

### Respuesta a la Regla de Negocio
- Sí: si eliminamos la recaptura innecesaria del Módulo 1, el médico deja de repetir información estable ya capturada.
- Sí: aun así el médico debe poder editar todo el historial longitudinal, porque el trabajador no siempre sabrá o podrá llenarlo completo.
- Por tanto, el diseño correcto no es “solo prellenado del trabajador”, sino “historial maestro editable por médico con apoyo de prellenado”.

### Nuevo Modelo de Interacción

#### A. Trabajador
- Llena desde portal lo que conoce.
- Actualiza cambios personales o laborales simples.
- Genera una base preliminar reutilizable.

#### B. Médico
- Consulta la ficha del trabajador y el historial longitudinal desde el expediente.
- Corrige, completa y valida la información longitudinal cuando sea necesario.
- Usa el Examen Médico para registrar lo específico de la cita, no para rehacer todo el historial.

### Diseño Funcional Requerido

#### 1. Ficha del trabajador
- Debe mostrar resumen longitudinal.
- Debe enlazar claramente a la Historia Clínica editable.
- No necesita ser el editor principal.

#### 2. Historia Clínica
- Debe ser el editor maestro longitudinal.
- Debe contener todos los dominios longitudinales del actual Módulo 1 que realmente sean persistentes:
  - datos personales declarativos
  - historia laboral
  - heredo-familiares
  - antecedentes patológicos
  - no patológicos relevantes y hábitos
  - inmunizaciones si aplican como historial longitudinal
- Debe permitir edición completa por el médico.

#### 3. Examen Médico
- Debe mostrar el snapshot importado para la cita actual.
- Debe evitar volver a pedir todos los campos longitudinales como captura completa.
- Debe ofrecer una UX de confirmación clínica, por ejemplo:
  - “Sin cambios respecto al historial”
  - “Cambios relevantes en esta cita”
  - “Editar historial longitudinal”
- Debe centrarse en:
  - exploración física
  - hallazgos actuales
  - síntomas o cambios recientes
  - impresión diagnóstica
  - aptitud o restricciones

### Normalización del Módulo 1

#### Se elimina como recaptura completa dentro del Examen Médico
- Datos Personales
- Historia Laboral
- Heredo-Familiares
- Patológicos
- No Patológicos persistentes

#### Se conserva como snapshot o confirmación por cita
- Cambios recientes declarados en la consulta
- Datos que impacten específicamente el dictamen actual
- Confirmación clínica de vigencia del historial

### Comportamiento esperado cuando el médico detecta cambios
- Si el médico corrige un dato longitudinal, el sistema debe permitir actualizar la Historia Clínica maestra.
- La cita actual debe poder conservar además el snapshot ya usado o el snapshot corregido de esa cita, según política clínica definida.
- Recomendación operativa:
  - actualizar la historia maestra
  - regenerar o actualizar el snapshot de la cita actual solo si el cambio ocurre antes del cierre clínico del evento

### Criterios de Aceptación

#### A. No repetición innecesaria
- El médico no vuelve a llenar manualmente todos los campos longitudinales en cada Examen Médico.

#### B. Autoridad clínica
- El médico puede editar completamente la Historia Clínica longitudinal.

#### C. Snapshot por cita
- Cada evento conserva su snapshot clínico específico, independiente de futuras modificaciones del historial.

#### D. Navegación clínica
- Desde el expediente, el médico puede abrir:
  - ficha del trabajador
  - historia clínica longitudinal

#### E. Dictamen más eficiente
- El Examen Médico se enfoca en cambios, hallazgos y criterio clínico del episodio.

### Estrategia de Implementación Recomendada

#### Etapa 1
- Expandir Historia Clínica para absorber todos los campos longitudinales del actual Módulo 1.

#### Etapa 2
- Transformar el Módulo 1 del Examen Médico en una vista de snapshot + confirmación de cambios, no un formulario longitudinal completo.

#### Etapa 3
- Agregar acciones clínicas explícitas:
  - editar historial longitudinal
  - aplicar cambios del episodio al historial maestro
  - mantener snapshot de cita

### Riesgos a Evitar
- Que el snapshot por cita vuelva a convertirse en el lugar de captura principal.
- Que el trabajador sea tratado como única fuente de verdad del historial.
- Que el médico pierda capacidad de corregir o enriquecer el historial longitudinal.
- Que un cambio longitudinal modifique retroactivamente dictámenes de citas cerradas.

### Veredicto
- Sí, con este modelo el médico deja de repetir información ya capturada.
- Sí, el médico debe poder editar el historial completo.
- El trabajador acelera el proceso, pero la autoridad longitudinal final debe quedar del lado clínico.