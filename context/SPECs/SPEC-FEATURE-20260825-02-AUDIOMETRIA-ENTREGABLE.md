# SPEC-FEATURE-20260825-02 — Entregable validado de Audiometría

- **Estado:** READY_FOR_SOFIA
- **Prioridad:** P1 funcional
- **ADR:** `context/decisions/ADR-20260825-01-AUDIOMETRIA-ENTREGABLE-COMUN.md`
- **Fuentes funcionales:** `FND-20260825-05` a `FND-20260825-09`, `BR-20260825-03`, `BR-20260825-04`
- **Gate:** Discovery cerrado con decisiones `DEC-20260825-03` a `DEC-20260825-07`; implementación autorizable dentro de este alcance.

## 1. Objetivo

Aplicar a Audiometría el ciclo validado de Espirometría: contexto clínico, carga del documento, extracción/presentación, prediagnóstico asistido, revisión médica, aceptación y PDF validado descargable.

## 2. Alcance incluido

- Cuestionario de antecedentes auditivos y exploración física asociado al `EventTest`.
- Procesamiento de documento de audiómetro en PDF/imagen y, cuando corresponda, XML directo.
- Presentación bilateral por oído y frecuencia.
- Preservación de valores fuente, nulos y cobertura documental.
- Interpretación derivada basada en patrón, PTA/criterios AMI y limitaciones.
- Revisión médica editable, aceptación y rechazo.
- PDF validado con evidencia fuente, interpretación aceptada, médico, cédula y firma.
- Descarga protegida por identidad/autorización.

## 3. Fuera de alcance

- Persistencia definitiva de PDF fuente y PDF final.
- Publicación de la calibración V3 antes del gate.
- Inventar frecuencias o valores no visibles.
- Copiar diagnóstico/recomendación de AMI como salida de IA.
- Decidir aptitud laboral o diagnóstico final automáticamente.
- Cambiar criterios de Espirometría.

## 4. Contrato funcional

### 4.1 Cuestionario

Persistir antecedentes de audiometría previa, dificultad auditiva, historial laboral, exposición recreativa/ruido, explosión o trauma, infecciones, tinnitus/mareos, medicamentos ototóxicos, exploración de faringe/CAD/CAI/MTD/MTI y observaciones clínicas. No solicitar Patient ID manual, consentimiento ni responsables: paciente/Event provienen de la papeleta y la identidad profesional de la sesión/documento fuente.

### 4.2 Documento fuente

Reconocer oído derecho/izquierdo, frecuencia, intensidad, símbolos, tipo de vía cuando sea visible, PTA, porcentajes y metadatos. La tabla numérica prevalece sobre narrativa para valores. Las frecuencias ausentes permanecen `null` y reducen completitud.

### 4.3 Interpretación

- Normalidad AMI: `≤25 dB`.
- PTA calculado: `PTA3 = (TA500 + TA1000 + TA2000) / 3` por oído; conservar el PTA fuente del documento por separado.
- La salida debe distinguir explícitamente `criterios_norma_nom`, `criterios_ami`, `valores_fuente` y `pta_fuente`; no presentar los criterios AMI como si fueran texto de la NOM.
- La salida debe mostrar la ecuación PTA, sus tres entradas, el resultado, la fuente del cálculo y el `pta_fuente` por separado, siguiendo el patrón de transparencia de Espirometría.
- Graves: 250/500/1000 Hz.
- Medias/agudas: 2000/3000/4000/6000/8000 Hz.
- `1000 Hz` es frontera y no se duplica en promedios.
- La clasificación combina patrón por grupos y PTA/criterio AMI.
- Umbrales en huecos AMI producen `NO_CONCLUYENTE_PARA_CLASIFICACION` y revisión médica.
- Diagnóstico nosológico/etiológico y recomendación fuente se muestran como evidencia documental separada.

### 4.4 Revisión y PDF

La revisión médica debe editar/aceptar la interpretación derivada, limitaciones y recomendación. Una revisión `REVIEWED_ACCEPTED` o `REVIEWED_EDITED` genera el PDF validado; `REVIEWED_REJECTED` no lo genera. El PDF debe distinguir fuente documental, interpretación IA y decisión médica, e incluir perfil/firma del médico autenticado.

## 5. Criterios verificables

- AC-1: El cuestionario se guarda en el EventTest y se recupera al recargar.
- AC-2: El renderer muestra OD/OI, frecuencias y valores sin desplazar celdas ni inventar ausentes.
- AC-3: Se conserva cobertura parcial cuando el documento sólo contiene 4 frecuencias.
- AC-4: La extracción separa valores de tabla de narrativa diagnóstica fuente.
- AC-5: La interpretación aplica patrón + PTA/criterio AMI y marca huecos como no concluyentes.
- AC-6: La revisión médica puede aceptar, editar o rechazar.
- AC-7: Sólo aceptación válida permite descargar el PDF.
- AC-8: El PDF incluye datos del paciente/Event, evidencia, interpretación aceptada, médico, cédula y firma.
- AC-9: La descarga no permite acceso cruzado entre usuarios.
- AC-10: XML de Audiometría conserva su parser directo y no se envía innecesariamente al extractor IA.
- AC-11: Cuando exista cuestionario guardado, `clinicalContext` de Audiometría se propaga al contexto de prediagnóstico igual que Espirometría; no se inventan respuestas ausentes.
- AC-12: El panel muestra una referencia explícita del criterio AMI y los criterios derivados separados de la decisión médica; el PDF no incluye esas tablas administrativas ni criterios derivados.

## 6. Gates y validación

- **V1:** Zod/server action, typecheck y tests focales de cuestionario, extracción, normalización y cálculo.
- **V2:** suite frontend/backend una sola vez al cierre de implementación.
- **V3:** Playwright real sobre Event de prueba desechable, documento fuente, revisión, PDF, permisos, consola y requests; además smoke XML si se dispone de fixture autorizado.
- **Gate clínico:** confirmar la fórmula exacta de PTA, normalidad, vía aérea/vía ósea y clasificación de huecos antes de `READY_FOR_SOFIA`.

## 7. Riesgos abiertos

- Los ejemplos recibidos muestran tablas de 4 frecuencias aunque las gráficas pueden mostrar más.
- El significado operativo exacto de `Audio TA` y `Audio VO` debe confirmarse con sus archivos.
- El programa AMI deja intervalos de dB sin clasificación explícita.
- La fecha de acción de un ejemplo parece inconsistente con la fecha del estudio.
