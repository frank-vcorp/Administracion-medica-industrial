# SPEC-FEATURE-20260825-03 — Entregable validado de Examen Médico

- **Estado:** READY_FOR_SOFIA
- **Prioridad:** P1 funcional
- **ADR:** `context/decisions/ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md`
- **Fuentes:** `FND-20260825-16`, `FND-20260825-17`, `context/SPECs/SPEC_ARCH-20260819-01-ESPECIFICACION-ENTREGABLE-EXAMEN-MEDICO.md`
- **Alcance cerrado:** completar el flujo existente y generar el PDF AMI consolidado; no rediseñar el perfil clínico.
- **Addendum vigente:** `DEC-20260826-01` / `BR-20260826-01`. El consolidado debe integrar los Events de la misma atención/cita del trabajador y reproducir el formato visual del entregable AMI de referencia, incluyendo los bloques de estudios aplicables y sus hallazgos disponibles.

## 1. Resultado esperado

Generar un PDF firmado de Examen Médico con la estructura del documento AMI de referencia, usando datos del perfil clínico, Event, estudios complementarios y revisión médica.

## 2. Contenido del PDF

### Página/sección 1 — Identificación e historia

- Paciente, nacimiento, edad, sexo, identidad de género, estado civil, escolaridad, dirección y tipo sanguíneo.
- Empresa, puesto, área, tipo de examen, historia ocupacional, riesgos y EPP.
- Antecedentes heredofamiliares y personales no patológicos/toxicomanías.

### Página/sección 2 — Antecedentes y mediciones

- Antecedentes personales patológicos.
- Historia gineco-obstétrica cuando aplique.
- Inmunizaciones.
- Peso, talla, IMC, cintura/cadera, TA, FC, FR y temperatura.
- Agudeza visual, visión corregida, reflejos, Ishihara y campimetría.

### Página/sección 3 — Exploración

- Exploración general y neurológica.
- Cabeza, piel, oídos, ojos, boca, nariz, faringe, cuello, tórax, corazón, pulmones, abdomen, genitourinario, columna y extremidades.
- Pruebas musculoesqueléticas.
- Impresión diagnóstica del médico.

### Página/sección 4 — Dictamen

- Aptitud: `APTO`, `APTO CONDICIONADO`, `APTO CON RESTRICCIONES`, `NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO`, `PENDIENTE DE RESULTADOS`.
- Restricciones y observaciones finales.
- Recomendaciones auto-pobladas desde hallazgos y editables por el médico.
- Nota de condicionamiento por estudios paraclínicos cuando corresponda.
- Médico evaluador/revisor, cédula, fecha, membrete y firma.

## 3. Fuentes y prioridad

1. Datos personales/laborales: perfil clínico y Event.
2. Exploración y mediciones: `physicalExamData` y estudios del Event.
3. Resultados complementarios: slots independientes (`audiometria_texto`, `espirometria_texto`, `laboratorios_texto`, `radiografia_texto`, `examen_medico_texto`).
4. Recomendaciones: catálogo derivado + edición médica.
5. Aptitud, impresión, restricciones y notas: decisión explícita del médico autenticado.

## 4. Criterios verificables

- AC-1: El resumen se auto-pobla desde el perfil/Event sin pedir datos duplicados.
- AC-2: Los cinco slots de estudios se muestran de forma independiente y trazable.
- AC-3: El PDF reproduce la estructura AMI de cuatro páginas/secciones.
- AC-4: Los faltantes aparecen como pendientes/visibles, no como valores inventados.
- AC-5: Las recomendaciones se auto-pueblan y el médico puede editarlas.
- AC-6: La aptitud sólo puede ser seleccionada/confirmada por el médico.
- AC-7: Impresión, restricciones y observaciones finales quedan asociadas a la revisión firmante.
- AC-8: El PDF incluye médico, cédula, fecha, firma y membrete.
- AC-9: La descarga está autorizada por sesión y pertenece al Event/paciente solicitado; las rutas legacy también exigen autenticación y scope.
- AC-10: No se filtran datos clínicos hacia el portal corporativo; éste recibe sólo el dictamen permitido.
- AC-11: El dictamen general muestra un bloque identificable por cada Event/estudio aplicable de la misma atención/cita, con hallazgos disponibles y `PENDIENTE` cuando falte información; no muestra sólo conclusión/recomendaciones.
- AC-12: El membrete, jerarquía visual, secciones y tabla de aptitud del PDF general son coherentes con `REPORTE DE EXAMEN MEDICO (APTITUD)`; no se sustituye por una hoja genérica de resumen.

## 5. Validación y límites

- V1: tests focales de schema, mapeo de perfil, slots, aptitud y PDF.
- V2: suite frontend/backend una vez al cierre.
- V3: Playwright con Event desechable, perfil completo, estudios parciales/completos, firma, descarga y autorización.
- No incluir persistencia documental nueva fuera de la infraestructura existente.
- No cambiar reglas de Audiometría/Espirometría.
- No automatizar aptitud ni firma.
- `COMPANY_CLIENT` no puede descargar el PDF clínico completo; sólo consume el dictamen autorizado por el portal.
