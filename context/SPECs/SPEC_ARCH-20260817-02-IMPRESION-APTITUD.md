# SPEC — ARCH-20260817-02 — Impresión y Aptitud del Examen Médico (reporte de aptitud fiel al formato AMI)

**Estado:** IMPLEMENTANDO (Corte 1 ejecutado — `c28f968..b64e221` sobre `1467d4f`)
**Firmada por:** INTEGRA (sobre glm-5.2 — plan Alibaba)
**Fecha de firma:** 2026-08-17 (CST)
**Origen:** Handoff ATLAS M3 (migración de Impresión/Aptitud a UX basada en formatos AMI actuales — `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf` y `NOTA MEDICA EJEMPLO.pdf`).
**Baseline esperado:** `1467d4f` (Módulo 1 combos — SPEC_ARCH-20260817-01 corte 1 verde). Verificación inmediata recomendada: `pnpm typecheck && pnpm test --run` desde `frontend/`.

> **DA-1 confirmado por Frank 2026-08-17:** 5 valores del enum de aptitud adoptados (4 del PDF canónico + `PENDIENTE DE RESULTADOS` operativa) + DA-1 tolerante para registros legacy con `'NO APTO'`. Sin migración de datos. La heurística `includes('no apto')` del portal se reemplaza por lectura estructurada de `aptitud` con fallback legacy.

---

## 1. Contexto

### 1.1 Necesidad

Frank pide migrar **Impresión y Aptitud** del Examen Médico a una UX completa basada en los formatos AMI actuales. El médico hoy debe **reescribir a mano** el dictamen final en `EventFlowController` aunque ya lo capturó en la pestaña "Impresión y Aptitud" de `ExamenMedicoEstudio` — duplicación de captura. Además, el PDF de dictamen actual (`MedicalDictamenPDF`) NO refleja el formato AMI canónico: renderiza `JSON.stringify(extractedData)` en sección III (ilegible), no muestra la tabla de 9 campos resumen, no muestra el campo `aptitud` estructurado, no tiene membrete "Soluciones", y las recomendaciones no se auto-poblar.

### 1.2 Tickets cubiertos

Esta SPEC cubre directamente los siguientes tickets de las juntas AMI 10/ago y 12/ago:

| Ticket | Descripción | Cita textual junta | Fuente |
|---|---|---|---|
| **T-5.8** | Auto-poblamiento del resumen/dictamen desde antecedentes y examen | Jaqueline: "lo que necesitamos es que jale directo al resumen". Frank: "podríamos jalarlos directamente". | `Revision_AMI_10082026_puntos.md` §5.8 + `Junta_semanal_12082026_puntos.md` B.4 |
| **T-5.14** | Incremento de caracteres de aptitud/dictamen | Jaqueline: "incrementar los caracteres porque está muy reducido". | `Revision_AMI_10082026_puntos.md` §5.14 |
| **T-B.1** | Membrete / logo "Soluciones" + cintillo en reporte final | Lety: "me gustaría también que ya pudiéramos a lo mejor definir cuál va a ser si va a ser una hoja membretada, si va a ser una hoja con logo de soluciones y un cintillo". | `Junta_semanal_12082026_puntos.md` B.1 |
| **T-B.4** | Auto-poblamiento del dictamen desde examen médico | Jaqueline: "lo que necesitamos es que jale directo al resumen". | `Junta_semanal_12082026_puntos.md` B.4 |
| **T-5.9 (parcial)** | Observaciones adicionales: ampliar caracteres | Jaqueline: "cuántos caracteres tenemos". Frank: "casi ilimitados". | `Revision_AMI_10082026_puntos.md` §5.9 |
| **T-5.10 (parcial)** | Impresión del examen médico: máximo 3 hojas | Erika: "tres hojas, no más". | `Revision_AMI_10082026_puntos.md` §5.10 — el reporte de aptitud es de 1-2 hojas; se cubre la paginación controlada |

### 1.3 Fuente canónica de literales

La fuente canónica de los literales del reporte de aptitud es el `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf` (extraído vía `pdftotext -layout` por INTEGRA en este análisis). Estructura literal del reporte de referencia:

```
REPORTE DE EXAMEN MEDICO
NOMBRE: <apellido nombre>           SEXO: <FEMENINO|MASCULINO>   EDAD: <n>   EMPRESA: <empresa>
FECHA: <dd/mm/yyyy>                 TIPO DE EXAMEN: <INGRESO|PERIODICO|RETIRO>
PUESTO ASPIRANTE: <puesto>

  ESTADO NUTRICIONAL: <valor>
  AGUDEZA VISUAL:    <valor>
  SALUD BUCAL:       <valor>
  EXAMEN MEDICO:     <texto diagnóstico del examen>
  PRESION ARTERIAL:  <valor>
  AUDIOMETRIA:       <texto IA: OD:... OI:...>
  ESPIROMETRIA:      <texto IA: patrón, FVC...>
  LABORATORIOS:      <texto: BH, QS, EGO, copro...>
  RADIOGRAFIA:       <texto: RXTORAX...>

DICTAMEN DE APTITUD
  [ ] APTO
  [ ] APTO CONDICIONADO            ← marcado en el ejemplo, con texto de condicionantes al lado
  [ ] APTO CON RESTRICCIONES
  [ ] NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO

OBSERVACIONES / COMENTARIOS / RECOMENDACIONES:
1.- ... 2.- ... 3.- ...

Realizó EM: <nombre del médico>     Ced. Prof.: <cédula>
```

Mismo principio que SPEC-01 ("lo copia igualito"): los literales de aptitud y los labels de la tabla resumen se adoptan **verbatim** del PDF de referencia.

### 1.4 Restricciones (heredadas del handoff)

- **No commits automáticos sin OK de Frank.** Esta SPEC se entrega lista para delegar a SOFIA, pero la delegación efectiva espera OK explícito.
- **No tocar `prisma/schema.prisma`** salvo que Frank apruebe explícitamente la D1-extend (ver §2.1). El campo `aptitud` sigue en `MedicalExam.physicalExamData` JSON, NO como columna Prisma.
- **No romper flujo clínico**: cita → check-in → papeleta → examen → IA → revisión → dictamen → firma debe funcionar idéntico.
- **Mantener DA-1 (tolerancia legacy)**: registros previos con `aptitud = "APTO"` / `"NO APTO"` / `"PENDIENTE DE RESULTADOS"` deben seguir parseando (ver §2.1 y §6 de SPEC-01).
- **Mantener patrón de commits granulares** (Frank pidió rollback individual).
- **Mantener los gates del proyecto**: `pnpm typecheck` + `pnpm test --run` + `pnpm lint`.
- **No generar documentos que no existen** (nota médica, certificado) — fuera de alcance (ver §1.5).

### 1.5 Fuera de alcance explícito (registrado para SPECs separadas)

| Tema | Razón | SPEC destino |
|---|---|---|
| **Nota médica** (consulta, motivo, diagnóstico por sistemas, tratamiento, material médico) | Es un documento DIFERENTE del reporte de aptitud. El reporte de aptitud es para examen de ingreso/periódico/retiro (aptitud laboral); la nota médica es para consulta de enfermedad. No comparten modelo de captura. | `ARCH-YYYYMMDD-NN-NOTA-MEDICA` (futura) |
| **Tipo de consulta** (Enfermedad General / Enfermedad Profesional / Accidente de trabajo / Accidente Trayecto / Primer Auxilio / Incidente) | Aplica SOLO a nota médica (ver `NOTA MEDICA EJEMPLO.pdf` footer). El reporte de aptitud usa `TIPO DE EXAMEN` (INGRESO/PERIÓDICO/RETIRO), no tipo de consulta. Ya existe flujo de tipo de examen. | `ARCH-YYYYMMDD-NN-NOTA-MEDICA` |
| **Incapacidad** (Otorga Incapacidad, Num. Días, Pase de Salida) | Aplica SOLO a nota médica. El reporte de aptitud no tiene incapacidad (es aptitud laboral, no incapacidad por enfermedad). Modelo separado `Incapacidad` recomendado en la SPEC de nota médica. | `ARCH-YYYYMMDD-NN-NOTA-MEDICA` |
| **Certificado médico** (`FORMATO CERTIFICADO MEDICO.docx`) | Documento laboral distinto. Comparte branding "Soluciones" (D4) pero no modelo. | `ARCH-YYYYMMDD-NN-CERTIFICADO-MEDICO` |
| **Calibración audiometría** (4 frecuencias, índice bilateral, % pérdida) | Ya tiene SPEC candidata `ARCH-20260812-01-CALIBRACION-AUDIOMETRIA-INDICE-BILATERAL` (ver `Junta_semanal_12082026_puntos.md` nota final). Esta SPEC consume el resultado IA de audiometría tal cual; no la calibra. | `ARCH-20260812-01` |

---

## 2. Decisiones arquitectónicas resueltas

### 2.1 D1 — Enum de aptitud: adoptar los 4 literales del PDF de referencia + preservar `PENDIENTE DE RESULTADOS` operativa + DA-1 tolerante ⚠️ REQUIERE CONFIRMACIÓN FRANK

**Estado actual (verificado en código):**

- `aptitud` NO es columna Prisma. Vive en `MedicalExam.physicalExamData` JSON, validado por `ImpresiónAptitudSchema` en `frontend/src/schemas/clinical/exam.schema.ts:411`:
  ```
  aptitud: z.enum(['APTO', 'APTO CON RESTRICCIONES', 'NO APTO', 'PENDIENTE DE RESULTADOS']).optional()
  ```
- UI (`ExamenMedicoEstudio.tsx:237-242`) define `APTITUD_OPTIONS` con los mismos 4 valores.
- El portal infiere "isApto" leyendo `MedicalVerdict.finalDiagnosis.toLowerCase().includes('no apto')` en 3 sitios: `portal.actions.ts:63`, `portal/events/page.tsx:56`, `portal/workers/page.tsx:52` y `:119`.

**Discrepancia P0 detectada:** el enum actual usa `NO APTO` y `PENDIENTE DE RESULTADOS`, pero el PDF de referencia canónico usa `APTO / APTO CONDICIONADO / APTO CON RESTRICCIONES / NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO`. Faltan `APTO CONDICIONADO` y el literal largo de "no apto"; sobra el `NO APTO` corto.

**Decisión propuesta (confianza ≥85%, reversible, interna — pendiente OK Frank por ser literal clínico de producto):**

Adoptar enum de **5 valores** (los 4 del PDF + `PENDIENTE DE RESULTADOS` operativa):

```
APTO
APTO CONDICIONADO
APTO CON RESTRICCIONES
NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO
PENDIENTE DE RESULTADOS
```

- Se elimina `NO APTO` del enum **nuevo** (no aparece en el PDF canónico).
- `PENDIENTE DE RESULTADOS` se conserva porque es operativa: cuando faltan estudios por procesar, el médico no puede emitir apto/condicionado/no-cumple. El PDF no la muestra porque es un reporte final ya completo.
- **DA-1 (tolerante):** el schema Zod pasa de `z.enum([...])` estricto a `z.string().refine(v => v === '' || APTITUD_VALUES_NUEVO.includes(v) || LEGACY_APTITUD_VALUES.includes(v) || v == null)` — patrón idéntico al `tolerantZinEnum` de SPEC-01. Registros legacy con `NO APTO` / `APTO` / `PENDIENTE DE RESULTADOS` siguen parseando.

**Impacto en la heurística del portal (cambio contractual derivado):**

El literal `"NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO"` NO contiene la subcadena `"no apto"`. Por tanto, `finalDiagnosis.toLowerCase().includes('no apto')` devolvería `false` para un dictamen no-apto del nuevo enum → **bug**: lo marcaría como APTO en el portal. **Los 3 sitios de la heurística deben migrar** a leer `aptitud` estructurada en lugar de inferirla del texto:

- La fuente de verdad de aptitud pasa a ser `MedicalExam.physicalExamData.aptitud` (campo estructurado), NO el texto libre de `MedicalVerdict.finalDiagnosis`.
- `isApto` se calcula como: `aptitud === 'APTO'` (apto) vs `aptitud !== 'APTO' && aptitud !== 'PENDIENTE DE RESULTADOS' && aptitud !== ''` (no apto) vs `aptitud === 'PENDIENTE DE RESULTADOS'` (pendiente).
- Para mantener compatibilidad con verdicts legacy (que no tienen `aptitud` estructurado), la heurística cae a `finalDiagnosis.toLowerCase().includes('no apto')` solo si `aptitud` es nulo/indefinido. Esto preserva registros históricos.

**Confianza:** ≥85%. Reversible (DA-1 + fallback legacy). **Requiere OK Frank** por ser literal clínico del dictamen (contenido de producto).

**Pregunta a Frank (P1):** ¿Apruebas cambiar el enum de aptitud a los 4 literales del PDF de referencia + conservar `PENDIENTE DE RESULTADOS` como 5ª opción operativa, con DA-1 tolerante para registros legacy con `NO APTO`? (Ver §11 P1.)

### 2.2 D2 — Auto-poblamiento del dictamen final desde la pestaña "Impresión y Aptitud"

**Decisión:** El `EventFlowController` (textarea "Diagnóstico Final" + "Recomendaciones" en `frontend/src/components/EventFlowController.tsx:108-122`) deja de requerir re-captura manual. Al montarse en estado `VALIDATING`, **auto-puebla** los textareas desde `MedicalExam.physicalExamData`:

- **Diagnóstico Final** (`MedicalVerdict.finalDiagnosis`) ← se construye concatenando desde `physicalExamData`:
  - `aptitud` (literal del enum nuevo — D1).
  - `impresion_diagnostica` (texto diagnóstico del examen).
  - `restricciones` (si `aptitud` ∈ {`APTO CONDICIONADO`, `APTO CON RESTRICCIONES`}).
  - `observaciones_finales` (si no vacío).
- **Recomendaciones** (`MedicalVerdict.recommendations`) ← se genera desde el catálogo hallazgo→recomendación (D3) aplicado sobre los 9 campos de la tabla resumen (D5).

El médico puede **editar** los textareas auto-poblados antes de firmar (no son de solo lectura). El auto-poblamiento es una **propuesta inicial**, no un reemplazo del juicio médico.

**Fuente de datos para `physicalExamData`:** la página del evento (`frontend/src/app/events/[id]/page.tsx:212-215` que renderiza `EventFlowController`) debe cargar `MedicalExam.physicalExamData` (hoy no se pasa al `EventFlowController` — solo se pasa `verdictData` con `finalDiagnosis`/`recommendations`). **Cambio requerido:** extender `event-page-data.ts` para incluir `physicalExamData` y pasarlo al `EventFlowController` como `examSummary`.

**Snapshot al firmar:** el PDF firmado se genera desde `MedicalVerdict` (finalDiagnosis + recommendations + aptitud derivada) al momento de `signMedicalDictamPDF`. No hay "edición en vivo" post-firma: el `pdfUrl` es inmutable una vez firmado (ver `app/api/pdf/[eventId]/route.tsx:35` que sirve el PDF firmado del disco si existe).

**Confianza:** ≥90%. Interna, reversible. No toca contrato público (el `MedicalVerdict` sigue teniendo `finalDiagnosis`/`recommendations` como strings; solo cambia cómo se construyen).

### 2.3 D3 — Recomendaciones auto-pobladas: catálogo MIXTO hallazgo→recomendación + edición manual, lista numerada

**Decisión:** Las recomendaciones se generan desde un **catálogo cerrado de reglas** aplicado sobre los 9 campos de la tabla resumen (D5) + los hallazgos de los estudios IA. El médico puede **editar, agregar, reordenar**. Se renderizan como **lista numerada** (patrón del PDF: `1.- ... 2.- ... 3.- ...`).

**Catálogo de reglas (semilla inicial — extensible, NO en schema Prisma, en código como constantes):**

| Disparador (campo + valor) | Recomendación generada |
|---|---|
| `salud_bucal` ∈ {`CARIES`, `SARRO`, `CARIES Y SARRO`} | `Valoración por odontología para tratamiento de {caries y sarro / caries / sarro}.` |
| `estado_nutricional` ∈ {`SOBREPESO`, `OBESIDAD G1`, `OBESIDAD G2`, `OBESIDAD G3`} | `Mejorar hábitos alimenticios. Realizar ejercicio todos los días, durante 30 minutos al día.` |
| `agudeza_visual_resumen` === `DISMINUIDA` | `Valoración con optometrista por disminución de la agudeza visual, uso de lentes para laborar y examen de la vista cada año.` |
| `presion_arterial_resumen` ∈ {`ALTA`, `BAJA`} | `Valoración por medicina interna por {hipertensión / hipotensión} arterial.` |
| Audiometría IA: `clasificacion_hipoacusia` !== `normal` | `Uso adecuado de tapones auditivos, audiometría de seguimiento en 12 semanas.` |
| Espirometría IA: `patron` ∈ {`restrictivo`, `obstructivo`, `mixto`} | `Indicar ejercicios respiratorios. Uso adecuado de equipo de protección. Espiometrías de seguimiento.` |
| Radiografía IA: hallazgo patológico | `Especificar en observaciones.` (placeholder editable) |
| Laboratorio IA: `isOutOfRange === true` en algún analito | `Valoración por medicina interna por hallazgos de laboratorio.` |

**Implementación:** las reglas viven como una función pura `buildRecommendations(examSummary, studyResults)` en `frontend/src/lib/clinical/recommendations.builder.ts` (archivo nuevo). La función toma el snapshot del examen + resultados IA y devuelve un array de strings. El `EventFlowController` las une con el patrón `1.- ... 2.- ...` y las pone en el textarea de recomendaciones.

**Edición:** el textarea es editable. El médico puede agregar recomendaciones no generadas (ej. "Dieta sin irritantes") o eliminar las que no apliquen.

**Confianza:** ≥85%. Interna, reversible. El catálogo es semilla — se amplía en iteraciones futuras conforme Jaqueline/Erika validen. No es bloqueante para la SPEC.

### 2.4 D4 — Membrete "Soluciones" en el reporte de aptitud ⚠️ REQUIERE CONFIRMACIÓN FRANK

**Estado actual:** el `MedicalDictamenPDF` actual tiene header "DICTAMEN MÉDICO" + subheader "Administración Médica Industrial (AMI)" (`MedicalDictamenPDF.tsx:40-41`). NO hay logo, no hay cintillo "Soluciones".

**Decisión propuesta (pendiente OK Frank por ser decisión de branding/UX que Lety dejó abierta):**

- **Header membretado** (no watermark, no pie de página) con:
  - Logo placeholder (hasta que Lety confirme logo final — mismo patrón que `ARCH-20260630-01` v2 decisión 3).
  - Cintillo de texto: `Soluciones Médico Empresariales / Medicina Laboral` (texto exacto del certificado de referencia, ver handoff §1).
  - Línea separadora inferior.
- **Aplicar SOLO al reporte de aptitud** (`MedicalDictamenPDF`) en esta SPEC. La nota médica y el certificado médico son SPECs separadas (§1.5); aplicarán el mismo membrete cuando se implementen, pero NO se bloquean aquí.

**Justificación de la elección (header sobre watermark/pie):**
- Lety describió "hoja membretada, si va a ser una hoja con logo de soluciones y un cintillo" → header es la interpretación literal.
- Watermark es intrusivo, puede interferir con la lectura clínica del reporte y con la firma digital.
- Pie de página es menos visible y no cumple la intención de "hoja membretada".
- Header es reversible (es solo un componente del PDF), consistente con el PDF de referencia que tiene el título "REPORTE DE EXAMEN MEDICO" arriba.

**Confianza:** ≥75% (la estructura técnica es segura; el formato visual exacto requiere OK de Lety/Frank). **Requiere OK Frank.**

**Pregunta a Frank (P2):** ¿Apruebas membrete como **header** (logo placeholder + cintillo "Soluciones Médico Empresariales / Medicina Laboral") aplicado **solo al reporte de aptitud** en esta SPEC? ¿O prefieres watermark / pie / aplicar también a nota médica y certificado (que abriría scope)? (Ver §11 P2.)

### 2.5 D5 — Tabla resumen de 9 campos en el PDF y en la pestaña "Impresión y Aptitud"

**Decisión:** El reporte de aptitud (`MedicalDictamenPDF` reemplazo) muestra la tabla de 9 campos con los labels **exactos** del PDF de referencia, alineados a la izquierda, con el texto a la derecha. La misma tabla se renderiza como **preview** en la pestaña "Impresión y Aptitud" del `ExamenMedicoEstudio` (sub-tab `impresion`) para que el médico vea el resumen que se va a generar.

**Los 9 campos y su origen de datos:**

| # | Label (verbatim PDF) | Origen de datos | Tipo |
|---|---|---|---|
| 1 | `ESTADO NUTRICIONAL` | `physicalExamData.estado_nutricional` (enum ZIN, SPEC-01). Fallback: `somatometryData.complexion`. | enum (6 valores) |
| 2 | `AGUDEZA VISUAL` | `physicalExamData.agudeza_visual_resumen` (campo a definir en D6 — enum corto). | enum corto |
| 3 | `SALUD BUCAL` | `physicalExamData.salud_bucal` (enum ZIN, SPEC-01). | enum (4 valores) |
| 4 | `EXAMEN MEDICO` | `physicalExamData.impresion_diagnostica` (texto diagnóstico del examen). | texto libre |
| 5 | `PRESION ARTERIAL` | `physicalExamData.presion_arterial_resumen` (campo a definir en D6 — enum corto). | enum corto |
| 6 | `AUDIOMETRIA` | Resultado IA del `StudyRecord`/`EventTest` de audiometría: `aiPrediction` o `extractedData.resumen_por_oido` + `clasificacion_hipoacusia`. | texto IA |
| 7 | `ESPIROMETRIA` | Resultado IA del estudio de espirometría: `aiPrediction` o `extractedData.patron` + `fvc_percent_predicho`. | texto IA |
| 8 | `LABORATORIOS` | Resultados de `LabRecord`/`LabResult` (BH, QS, EGO, copro) concatenados. | texto |
| 9 | `RADIOGRAFIA` | Resultado IA del estudio de RX: `aiPrediction` o `extractedData.hallazgo`. | texto IA |

**Carga de datos en el PDF route:** `app/api/pdf/[eventId]/route.tsx` actualmente carga `MedicalVerdict` + `event.studies/labs`. **Cambio requerido:** añadir `include: { exam: true }` (ya existe relación `MedicalEvent.exam`) para leer `MedicalExam.physicalExamData`, `somatometryData`, `eyeAcuityData`.

**Campos 6-9 (resultados IA):** el `MedicalDictamenPDF` actual ya recibe `studies[].extractedData` y `labs[].extractedData` pero los renderiza como `JSON.stringify`. **Cambio:** transformar cada `extractedData` en un texto legible por campo, reutilizando los renderers de `ClinicalExtractionRenderer.tsx` (que ya parsea audiometría/espirometría/RX). Si no hay resultado IA todavía, mostrar `Pendiente de resultado`.

**Confianza:** ≥85%. Interna, reversible. Reutiliza renderers existentes.

### 2.6 D6 — Nuevos campos `agudeza_visual_resumen` y `presion_arterial_resumen` como enums cortos (sin migración Prisma)

**Estado actual:** `ImpresiónAptitudSchema` (exam.schema.ts:419-420) ya define `agudeza_visual_resumen: cleanString` y `presion_arterial_resumen: cleanString` como texto libre. El PDF de referencia muestra valores cortos (`DISMINUIDA`, `NORMAL AL MOMENTO DE LA TOMA`).

**Decisión:** convertir esos 2 campos a enums cortos con `tolerantZinEnum` (DA-1), alineados a los catálogos ZIN ya detectados en `Analisis_ZIN_Formulario_ExamenGeneral.md` §"Signos vitales al integrar dictamen":

- `agudeza_visual_resumen` ← catálogo nuevo: `['NORMAL', 'DISMINUIDA', 'NO APLICA']` (3 valores). El ZIN usa `ddlIDAgudezaNormal`: `BAJA AL MOMENTO DE LA TOMA, NORMAL AL MOMENTO DE LA TOMA, NORMAL ALTA AL MOMENTO DE LA TOMA` — pero esos son de agudeza en dictamen, no de resumen visual. Para el reporte de aptitud, `NORMAL/DISMINUIDA/NO APLICA` es más fiel al PDF (`DISMINUIDA` aparece literal).
- `presion_arterial_resumen` ← catálogo ZIN `dllIDPresionArt`: `['NORMAL AL MOMENTO DE LA TOMA', 'ALTA', 'BAJA']`.

Estos viven en `exam.schema.ts` como constantes exportadas (`AGUDEZA_VISUAL_RESUMEN_VALUES`, `PRESION_ARTERIAL_RESUMEN_VALUES`) y como `tolerantZinEnum(...)` en el schema. El componente `ExamenMedicoEstudio` los renderiza como `<select>` en el resumen clínico (junto a `estado_nutricional` y `salud_bucal` que ya son combos SPEC-01).

**Confianza:** ≥90%. Interna, reversible, sin migración. Consistente con SPEC-01.

### 2.7 D7 — Auto-poblamiento de los 9 campos: AMBOS (captura manual + resultados IA), en vivo, congelado al firmar

Esta es la respuesta arquitectónica a la Pregunta 2 de Frank ("¿se jala de los valores YA capturados en el examen, o se genera desde IA, o ambos?").

**Decisión:** AMBOS.
- **Campos 1-5** (estructurales: estado nutricional, agudeza visual, salud bucal, examen médico, presión arterial) se jalan de los valores **ya capturados** en el examen (`physicalExamData` + `somatometryData`). No requieren IA.
- **Campos 6-9** (audiometría, espirometría, laboratorios, radiografía) se jalan de los **resultados IA** ya procesados (`StudyRecord.extractedData`/`aiPrediction` + `LabRecord`). La IA ya corrió en el flujo `upload-and-analyze`.
- **Actualización en vivo:** la tabla resumen en la pestaña "Impresión y Aptitud" se actualiza reactivamente conforme el médico completa los campos 1-5 y conforme llegan resultados IA de los campos 6-9. Es decir, es un **preview en vivo** del reporte.
- **Congelamiento al firmar:** al `signMedicalDictamPDF`, el PDF se genera desde el snapshot de `MedicalVerdict` (finalDiagnosis + recommendations) + `MedicalExam.physicalExamData` en ese momento. Una vez firmado, el `pdfUrl` es inmutable (ya lo es hoy — `route.tsx:35` sirve el firmado del disco).

**Confianza:** ≥85%. Resuelve T-5.8 y T-B.4.

### 2.8 D8 — Incremento de caracteres de aptitud/dictamen (T-5.14)

**Estado actual:** `MedicalVerdict.finalDiagnosis` y `recommendations` son `String` en Prisma (PostgreSQL `text`, sin límite). `physicalExamData.impresion_diagnostica`, `restricciones`, `observaciones_finales` son `cleanString` en Zod (sin límite explícito). Jaqueline reportó "campo muy limitado".

**Decisión:** NO hay límite de caracteres a nivel schema (PostgreSQL `text` ya es "casi ilimitado", como Frank respondió en la junta). El "límite" que Jaqueline percibió era probablemente del `MedicalDictamenPDF` actual (que renderiza en 1 página A4 con `fontSize: 11` y corte). **Solución:**
- El nuevo `MedicalDictamenPDF` (reporte de aptitud) soporta **paginación controlada** (hasta 3 hojas — ver T-5.10): `@react-pdf/renderer` permite `wrap` en `View` para que el contenido fluya a múltiples páginas.
- Los textareas de impresión diagnóstica, restricciones, observaciones y recomendaciones no imponen `maxLength` (o lo suben a 8000 caracteres como salvaguarda anti-abuso, no como límite clínico).

**Confianza:** ≥90%. Interna, reversible.

---

## 3. Alcance exacto por archivo

### 3.1 Corte 1 — Enum de aptitud + DA-1 + migración heurística portal (foundation)

| # | Archivo | Cambio | Diff estimado |
|---|---|---|---|
| 1 | `frontend/src/schemas/clinical/exam.schema.ts` | Añadir constantes `APTITUD_VALUES_NUEVO` (5 valores), `LEGACY_APTITUD_VALUES` (incluye `'NO APTO'`), `AGUDEZA_VISUAL_RESUMEN_VALUES`, `PRESION_ARTERIAL_RESUMEN_VALUES`. Cambiar `aptitud: z.enum([...])` → `tolerantZinEnum(APTITUD_VALUES_NUEVO)` (DA-1). Cambiar `agudeza_visual_resumen` y `presion_arterial_resumen` de `cleanString` → `tolerantZinEnum(...)`. | +~40 / -~5 |
| 2 | `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` (constantes `APTITUD_OPTIONS` líneas 237-242) | Reemplazar `APTITUD_OPTIONS` por los 5 valores nuevos (APTO / APTO CONDICIONADO / APTO CON RESTRICCIONES / NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO / PENDIENTE DE RESULTADOS) con labels y colores (el literal largo con `break-words` o `truncate` + tooltip). | +~10 / -~5 |
| 3 | `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` (render resumen clínico, líneas 1408-1450) | Añadir `agudeza_visual_resumen` y `presion_arterial_resumen` como `<select>` (junto a `estado_nutricional` y `salud_bucal` que ya son combos). Extender `RESUMEN_CLINICO_FIELDS` con los 2 campos nuevos. | +~30 / -~5 |
| 4 | `frontend/src/actions/portal.actions.ts` (línea 63, `const diag = v.finalDiagnosis.toLowerCase()`) | Migrar heurística `includes('no apto')` → leer `aptitud` estructurada de `MedicalExam.physicalExamData` (cargar `exam` en el include). Fallback a `includes('no apto')` si `aptitud` es nulo (legacy). | +~20 / -~3 |
| 5 | `frontend/src/app/portal/events/page.tsx` (línea 56) | Migrar `isApto` a la nueva heurística (helper compartido `isAptoFromVerdict(verdict, exam)`). | +~5 / -~2 |
| 6 | `frontend/src/app/portal/workers/page.tsx` (líneas 52, 119) | Migrar `isApto` a la nueva heurística (helper compartido). | +~5 / -~4 |
| 7 | `frontend/src/lib/clinical/aptitud.helper.ts` (archivo nuevo) | Helper `isAptoFromVerdict(verdict, examData)` y `aptitudLabel(aptitud)` reutilizable por portal y PDF. | +~40 |
| 8 | `frontend/src/actions/__tests__/medical-exam.actions.test.ts` | Actualizar test de `ImpresiónAptitudSchema` (test 19 actual espera `'APTO'`) — añadir casos: acepta los 5 nuevos + acepta legacy `'NO APTO'` (DA-1) + rechaza string fuera de enum. | +~30 |

**Total Corte 1:** ~7 archivos (1 nuevo), ~180 líneas añadidas, ~25 removidas.

### 3.2 Corte 2 — Tabla resumen de 9 campos en el PDF (reemplazo MedicalDictamenPDF)

| # | Archivo | Cambio | Diff estimado |
|---|---|---|---|
| 9 | `frontend/src/components/pdf/MedicalDictamenPDF.tsx` | Reemplazo del componente por reporte de aptitud fiel al PDF de referencia: header membretado (D4), datos del paciente (nombre, sexo, edad, empresa, fecha, tipo examen, puesto), tabla resumen de 9 campos (D5), bloque "DICTAMEN DE APTITUD" con los 5 valores como checklist (uno marcado), recomendaciones numeradas, firma "Realizó EM: <nombre> / Ced. Prof.: <cédula>". Paginación hasta 3 hojas (D8). | +~350 / -~120 |
| 10 | `frontend/src/app/api/pdf/[eventId]/route.tsx` | Extender el `include` de `prisma.medicalVerdict.findUnique` para añadir `exam: true` (leer `MedicalExam.physicalExamData`, `somatometryData`, `eyeAcuityData`). Construir el objeto `data` con los 9 campos resumen (campos 1-5 desde `physicalExamData`, campos 6-9 desde `studies/labs[].extractedData` con transformación a texto legible). | +~80 / -~10 |
| 11 | `frontend/src/lib/clinical/exam-summary.builder.ts` (archivo nuevo) | Función pura `buildExamSummary(verdict, exam, studies, labs)` que devuelve los 9 campos resumen como strings. Reutiliza `ClinicalExtractionRenderer` para transformar `extractedData` de audiometría/espirometría/RX en texto. Si no hay resultado IA, devuelve `Pendiente de resultado`. | +~120 |
| 12 | `frontend/src/lib/clinical/recommendations.builder.ts` (archivo nuevo) | Función pura `buildRecommendations(examSummary, studyResults)` con el catálogo de reglas D3. Devuelve array de strings (lista numerada en el PDF). | +~80 |
| 13 | `frontend/src/components/pdf/__tests__/MedicalDictamenPDF.test.tsx` (nuevo) | Snapshot test del PDF con datos de ejemplo (verifica que los 9 labels, los 5 valores de aptitud, el membrete y la firma renderizan). | +~60 |

**Total Corte 2:** ~5 archivos (3 nuevos), ~690 líneas añadidas, ~130 removidas.

### 3.3 Corte 3 — Auto-poblamiento del dictamen en EventFlowController

| # | Archivo | Cambio | Diff estimado |
|---|---|---|---|
| 14 | `frontend/src/app/events/[id]/_lib/event-page-data.ts` (línea 139) | Extender la carga para incluir `MedicalExam.physicalExamData` (y `somatometryData`, `eyeAcuityData`) en el `serializedVerdict` que se pasa al `EventFlowController`. | +~20 / -~2 |
| 15 | `frontend/src/app/events/[id]/page.tsx` (líneas 212-215) | Pasar `examSummary` (physicalExamData + estudios/labs) al `EventFlowController` además de `verdictData`. | +~10 / -~2 |
| 16 | `frontend/src/components/EventFlowController.tsx` (líneas 9-16, 108-122) | Extender `EventFlowControllerProps` con `examSummary?: ExamSummary`. Al montar en estado `VALIDATING`, si `verdictData.finalDiagnosis` está vacío, auto-poblarlo desde `examSummary` (D2) + poblar recomendaciones desde `buildRecommendations(...)` (D3). Los textareas siguen siendo editables. | +~60 / -~5 |
| 17 | `frontend/src/actions/medical-event.actions.ts` (`saveVerdict` línea 40) | No cambia la firma (sigue `(eventId, diagnosis, recommendations, validatorId)`). Documentar que `diagnosis` y `recommendations` llegan pre-poblados desde el `EventFlowController`. | solo doc |

**Total Corte 3:** ~3 archivos (0 nuevos), ~90 líneas añadidas, ~9 removidas.

### 3.4 Corte 4 — Tabla resumen preview en la pestaña "Impresión y Aptitud"

| # | Archivo | Cambio | Diff estimado |
|---|---|---|---|
| 18 | `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` (sub-tab `impresion`, después del resumen clínico actual ~línea 1450) | Añadir un componente `<ResumenReportePreview>` que muestra la tabla de 9 campos (D5) en vivo, reactivo a los campos 1-5 del form + los resultados IA de los estudios (campos 6-9 pasados como props). Botón "Ver preview del reporte" que abre el PDF en nueva pestaña (solo cuando el examen está completo). | +~120 |
| 19 | `frontend/src/components/clinical/ResumenReportePreview.tsx` (archivo nuevo) | Componente de preview de la tabla de 9 campos. Recibe `physicalExamData` + `studyResults` y renderiza la tabla con los labels exactos del PDF. Reutiliza `buildExamSummary`. | +~90 |

**Total Corte 4:** ~2 archivos (1 nuevo), ~210 líneas añadidas.

### 3.5 Corte 5 — Membrete "Soluciones" (depende de OK Frank D4)

| # | Archivo | Cambio | Diff estimado |
|---|---|---|---|
| 20 | `frontend/src/components/pdf/MedicalDictamenPDF.tsx` (header, ya tocado en Corte 2 #9) | Si D4 aprobada: añadir header membretado con logo placeholder + cintillo "Soluciones Médico Empresariales / Medicina Laboral". Si D4 rechazada: mantener header actual "DICTAMEN MÉDICO/AMI". | +~25 / -~5 |
| 21 | `frontend/public/logo-soluciones-placeholder.svg` (nuevo, solo si D4 aprobada) | Logo placeholder SVG (mismo patrón que `ARCH-20260630-01` v2 decisión 3 — placeholder hasta logo final de Lety). | +~20 |

**Total Corte 5:** ~1-2 archivos, ~45 líneas añadidas, ~5 removidas. **Condicionado a OK Frank D4.**

### 3.6 Archivos explícitamente NO tocados

| Archivo | Razón |
|---|---|
| `prisma/schema.prisma` | Restricción de Frank: no tocar schema. `aptitud` sigue en `physicalExamData` JSON. |
| `backend/app/services/ai/prediagnostic.py` | La IA ya produce `extractedData` y `aiPrediction`. Esta SPEC consume resultados, no calibra. |
| `signature.actions.tsx` | La firma digital no cambia; solo el PDF que se firma (Corte 2). |
| Migraciones SQL | Sin migración de datos (DA-1 + enums en JSON). |
| Nota médica / certificado / incapacidad | Fuera de alcance (§1.5). |

---

## 4. Plan de commits granulares

Frank pidió commits por componente para rollback individual. Plan (12-14 commits):

### Corte 1 — Foundation (8 commits)

| Commit | Archivo | Mensaje |
|---|---|---|
| 1 | `exam.schema.ts` (constantes) | `feat(clinical): add aptitud enum (5 values) + agudeza/pa resumen enums with DA-1 tolerant refine (ARCH-20260817-02 corte 1)` |
| 2 | `ExamenMedicoEstudio.tsx` (APTITUD_OPTIONS) | `feat(clinical): replace APTITUD_OPTIONS with 5-value PDF-reference enum (ARCH-20260817-02 corte 1)` |
| 3 | `ExamenMedicoEstudio.tsx` (resumen clínico selects) | `feat(clinical): add agudeza_visual_resumen + presion_arterial_resumen as ZIN selects (ARCH-20260817-02 corte 1)` |
| 4 | `aptitud.helper.ts` (nuevo) | `feat(clinical/lib): add isAptoFromVerdict + aptitudLabel helpers (ARCH-20260817-02 corte 1)` |
| 5 | `portal.actions.ts` | `fix(portal): migrate isApto heuristic from finalDiagnosis.includes('no apto') to structured aptitud (DA-1 legacy fallback) (ARCH-20260817-02 corte 1)` |
| 6 | `portal/events/page.tsx` | `refactor(portal): use aptitud.helper for isApto in events page (ARCH-20260817-02 corte 1)` |
| 7 | `portal/workers/page.tsx` | `refactor(portal): use aptitud.helper for isApto in workers page (ARCH-20260817-02 corte 1)` |
| 8 | `medical-exam.actions.test.ts` | `test(clinical): add aptitud enum (5 new + legacy DA-1) + agudeza/pa resumen cases (ARCH-20260817-02 corte 1)` |

### Corte 2 — Reporte de aptitud PDF (5 commits)

| Commit | Archivo | Mensaje |
|---|---|---|
| 9 | `exam-summary.builder.ts` (nuevo) | `feat(clinical/lib): add buildExamSummary for 9-field aptitude report table (ARCH-20260817-02 corte 2)` |
| 10 | `recommendations.builder.ts` (nuevo) | `feat(clinical/lib): add buildRecommendations catalog (hallazgo->recomendacion) (ARCH-20260817-02 corte 2)` |
| 11 | `MedicalDictamenPDF.tsx` | `feat(pdf): replace MedicalDictamenPDF with aptitude report faithful to AMI PDF (9-field table + 5 aptitud values + numbered recommendations + pagination) (ARCH-20260817-02 corte 2)` |
| 12 | `app/api/pdf/[eventId]/route.tsx` | `feat(api/pdf): include MedicalExam.physicalExamData + transform studies/labs extractedData to readable text (ARCH-20260817-02 corte 2)` |
| 13 | `MedicalDictamenPDF.test.tsx` (nuevo) | `test(pdf): snapshot test for aptitude report with 9 fields + aptitud + membrete (ARCH-20260817-02 corte 2)` |

### Corte 3 — Auto-poblamiento dictamen (3 commits)

| Commit | Archivo | Mensaje |
|---|---|---|
| 14 | `event-page-data.ts` | `feat(events): load MedicalExam.physicalExamData for EventFlowController auto-population (ARCH-20260817-02 corte 3)` |
| 15 | `events/[id]/page.tsx` | `feat(events): pass examSummary to EventFlowController (ARCH-20260817-02 corte 3)` |
| 16 | `EventFlowController.tsx` | `feat(events): auto-populate finalDiagnosis + recommendations from examSummary (T-5.8 + T-B.4) (ARCH-20260817-02 corte 3)` |

### Corte 4 — Preview tabla resumen (2 commits)

| Commit | Archivo | Mensaje |
|---|---|---|
| 17 | `ResumenReportePreview.tsx` (nuevo) | `feat(clinical): add ResumenReportePreview component (9-field live table) (ARCH-20260817-02 corte 4)` |
| 18 | `ExamenMedicoEstudio.tsx` (sub-tab impresion) | `feat(clinical): render ResumenReportePreview in Impresion y Aptitud tab + ver reporte button (ARCH-20260817-02 corte 4)` |

### Corte 5 — Membrete (1 commit, condicionado a D4)

| Commit | Archivo | Mensaje |
|---|---|---|
| 19 | `MedicalDictamenPDF.tsx` (header) + `logo-soluciones-placeholder.svg` | `feat(pdf): add membrete header "Soluciones Médico Empresariales / Medicina Laboral" with logo placeholder (T-B.1) (ARCH-20260817-02 corte 5)` |

**Total:** 18-19 commits. Cada uno reversible en isolation.

---

## 5. Criterios de aceptación verificables

### 5.1 Gates automáticos (todos deben pasar tras cada commit)

- `pnpm typecheck` (desde `frontend/`) → 0 errores.
- `pnpm test --run` (desde `frontend/`) → todos los tests pasan (incluyendo los nuevos).
- `pnpm lint` (desde `frontend/`) → 0 errores nuevos introducidos por este cambio.

### 5.2 Validaciones funcionales — Corte 1 (enum + DA-1 + heurística portal)

- `exam.schema.ts`: `ImpresiónAptitudSchema.parse({ aptitud: 'APTO CONDICIONADO' })` no lanza error (AC-1).
- `exam.schema.ts`: `ImpresiónAptitudSchema.parse({ aptitud: 'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO' })` no lanza error (AC-2).
- `exam.schema.ts`: `ImpresiónAptitudSchema.parse({ aptitud: 'NO APTO' })` no lanza error (DA-1 legacy, AC-3).
- `exam.schema.ts`: `ImpresiónAptitudSchema.parse({ aptitud: 'X' })` lanza error (string fuera de enum rechazado, AC-4).
- `ExamenMedicoEstudio.tsx`: los 5 botones de aptitud renderizan con los literales del PDF (verificar con Playwright snapshot — AC-5).
- `ExamenMedicoEstudio.tsx`: `agudeza_visual_resumen` y `presion_arterial_resumen` son `<select>` con opciones ZIN (AC-6).
- `portal.actions.ts`: un verdict con `physicalExamData.aptitud === 'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO'` se clasifica como **no apto** en el portal (no como apto por bug de heurística — AC-7).
- `portal.actions.ts`: un verdict legacy sin `aptitud` estructurada pero con `finalDiagnosis` que contiene `'no apto'` se sigue clasificando como no apto (fallback legacy, AC-8).
- **Validación funcional Corte 1:** Playwright E2E — login admin → `/portal/workers` → verificar que un trabajador con dictamen "NO CUMPLE..." muestra badge "No Apto" (no "Apto").

### 5.3 Validaciones funcionales — Corte 2 (reporte de aptitud PDF)

- `MedicalDictamenPDF.tsx`: el PDF generado contiene los 9 labels exactos del PDF de referencia (`ESTADO NUTRICIONAL`, `AGUDEZA VISUAL`, `SALUD BUCAL`, `EXAMEN MEDICO`, `PRESION ARTERIAL`, `AUDIOMETRIA`, `ESPIROMETRIA`, `LABORATORIOS`, `RADIOGRAFIA`) (AC-9, verificar con snapshot test).
- `MedicalDictamenPDF.tsx`: el PDF contiene el bloque "DICTAMEN DE APTITUD" con los 5 valores como checklist, uno marcado según `aptitud` (AC-10).
- `MedicalDictamenPDF.tsx`: el PDF contiene "OBSERVACIONES / COMENTARIES / RECOMENDACIONES:" con lista numerada (AC-11).
- `MedicalDictamenPDF.tsx`: el PDF contiene "Realizó EM: <nombre> / Ced. Prof.: <cédula>" (AC-12).
- `MedicalDictamenPDF.tsx`: el PDF soporta más de 1 página (paginación controlada, hasta 3) cuando el contenido excede 1 hoja (AC-13, T-5.10).
- `app/api/pdf/[eventId]/route.tsx`: el `include` carga `MedicalExam.physicalExamData` y los 9 campos resumen se construyen (AC-14).
- **Validación funcional Corte 2:** `curl -s http://localhost:3000/api/pdf/<eventId> -o /tmp/dictamen.pdf` genera un PDF válido; `pdftotext -layout /tmp/dictamen.pdf - | grep -c 'ESTADO NUTRICIONAL'` devuelve 1 (AC-15).

### 5.4 Validaciones funcionales — Corte 3 (auto-poblamiento)

- `EventFlowController.tsx`: al montar en estado `VALIDATING` con `verdictData.finalDiagnosis` vacío, el textarea "Diagnóstico Final" se auto-puebla con la concatenación de `aptitud + impresion_diagnostica + restricciones + observaciones_finales` (AC-16).
- `EventFlowController.tsx`: el textarea "Recomendaciones" se auto-puebla con la lista numerada generada por `buildRecommendations(...)` (AC-17).
- `EventFlowController.tsx`: los textareas son editables (el médico puede modificar el contenido auto-poblado antes de firmar — AC-18).
- `medical-event.actions.ts`: `saveVerdict` persiste el `finalDiagnosis` y `recommendations` tal cual lleguen (auto-poblados o editados) sin transformación adicional (AC-19).
- **Validación funcional Corte 3:** Playwright E2E — flujo completo hasta `VALIDATING` → verificar que el textarea "Diagnóstico Final" contiene el literal de aptitud + impresión diagnóstica capturada en la pestaña "Impresión y Aptitud" (no está vacío).

### 5.5 Validaciones funcionales — Corte 4 (preview tabla resumen)

- `ExamenMedicoEstudio.tsx` (sub-tab `impresion`): el componente `<ResumenReportePreview>` renderiza la tabla de 9 campos con los labels exactos (AC-20).
- `ResumenReportePreview.tsx`: los campos 1-5 se actualizan en vivo al cambiar `estado_nutricional` / `agudeza_visual_resumen` / `salud_bucal` / `impresion_diagnostica` / `presion_arterial_resumen` en el form (AC-21).
- `ResumenReportePreview.tsx`: los campos 6-9 muestran `Pendiente de resultado` si no hay resultado IA todavía, y el texto legible cuando lo hay (AC-22).
- **Validación funcional Corte 4:** Playwright E2E — capturar `estado_nutricional = SOBREPESO` → verificar que el preview muestra `ESTADO NUTRICIONAL: SOBREPESO`.

### 5.6 Validaciones funcionales — Corte 5 (membrete, condicionado a D4)

- `MedicalDictamenPDF.tsx`: el PDF contiene el header membretado con logo placeholder + cintillo "Soluciones Médico Empresariales / Medicina Laboral" (AC-23, solo si D4 aprobada).
- **Validación funcional Corte 5:** `pdftotext -layout /tmp/dictamen.pdf - | grep 'Soluciones Médico Empresariales'` devuelve 1 (solo si D4 aprobada).

### 5.7 Validación E2E global (todos los cortes)

- **Playwright E2E:** flujo clínico completo cita → check-in → papeleta → examen (Impresión y Aptitud con aptitud = `APTO CONDICIONADO` + restricciones) → submit → `VALIDATING` → verificar textareas auto-poblados → firmar → descargar PDF → verificar que el PDF contiene: membrete (si D4), 9 campos, `APTO CONDICIONADO` marcado, recomendaciones numeradas, firma. Debe completarse sin errores HTTP 4xx/5xx.

### 5.8 Validación de no-regresión

- `prediagnostic.py` sigue produciendo `extractedData` para audiometría/espirometría/RX sin cambio (verificación manual con curl al endpoint IA — AC-24).
- El portal corporativo (`/portal/events`, `/portal/workers`) sigue listando dictámenes correctamente con la heurística migrada (AC-25).
- Registros legacy de `MedicalVerdict` con `finalDiagnosis` que contiene `'no apto'` pero sin `physicalExamData.aptitud` estructurado siguen clasificándose como no apto (fallback legacy, AC-26).

---

## 6. Modelo de datos

**Sin cambios en `prisma/schema.prisma`.** Toda la estructura vive en JSON validado por Zod:

- `MedicalExam.physicalExamData.aptitud` ← enum de 5 valores (D1), tolerante legacy (DA-1).
- `MedicalExam.physicalExamData.agudeza_visual_resumen` ← enum corto (D6).
- `MedicalExam.physicalExamData.presion_arterial_resumen` ← enum corto (D6).
- `MedicalVerdict.finalDiagnosis` y `recommendations` ← strings construidos por auto-poblamiento (D2, D3), sin cambio de tipo.

**Estructura del `physicalExamData` extendido (resumen clínico + impresión):**

```
physicalExamData: {
  // Resumen clínico (9 campos tabla)
  estado_nutricional: enum(6)        // SPEC-01
  agudeza_visual_resumen: enum(3)    // D6 nuevo
  salud_bucal: enum(4)               // SPEC-01
  impresion_diagnostica: text        // campo 4 "EXAMEN MEDICO"
  presion_arterial_resumen: enum(3)  // D6 nuevo
  // (audiometría, espirometría, laboratorios, radiografía = de estudios IA, no en physicalExamData)

  // Impresión y Aptitud
  aptitud: enum(5)                   // D1 nuevo (DA-1 tolerante)
  restricciones: text
  observaciones_finales: text
  medico_evaluador: text
  medico_revisor: text
}
```

**Firma de helpers nuevos (contrato, no código de producción):**

```
// frontend/src/lib/clinical/aptitud.helper.ts
isAptoFromVerdict(verdict: { finalDiagnosis?: string | null }, examData?: { aptitud?: string | null } | null): {
  apto: boolean; pendiente: boolean; label: string
}
aptitudLabel(aptitud: string | null | undefined): string

// frontend/src/lib/clinical/exam-summary.builder.ts
buildExamSummary(verdict, exam, studies[], labs[]): {
  estado_nutricional: string
  agudeza_visual: string
  salud_bucal: string
  examen_medico: string
  presion_arterial: string
  audiometria: string
  espirometria: string
  laboratorios: string
  radiografia: string
}

// frontend/src/lib/clinical/recommendations.builder.ts
buildRecommendations(examSummary, studyResults): string[]   // array de strings numerados luego
```

---

## 7. Handoff a SOFIA

Ver handoff estructurado en `context/interconsultas/HANDOFF_ARCH-20260817-02_SOFIA_IMPRESION-APTITUD.md`.

**Orden de implementación:**
1. Cortar baseline (verificar `1467d4f` verde).
2. Esperar OK Frank para D1 (enum aptitud) y D4 (membrete).
3. Ejecutar Corte 1 completo (8 commits) — foundation, independiente.
4. Validación funcional Corte 1 (gates + Playwright heurística portal).
5. Ejecutar Corte 2 completo (5 commits) — reporte de aptitud PDF.
6. Validación funcional Corte 2 (gates + curl + snapshot).
7. Ejecutar Corte 3 completo (3 commits) — auto-poblamiento dictamen.
8. Validación funcional Corte 3 (gates + Playwright VALIDATING).
9. Ejecutar Corte 4 completo (2 commits) — preview tabla resumen.
10. Validación funcional Corte 4 (gates + Playwright preview en vivo).
11. Ejecutar Corte 5 (1 commit) — solo si D4 aprobada.
12. GEMINI auditoría.
13. Reporte final a INTEGRA.

**Restricciones de handoff:**
- SOFIA NO commitea/pushea sin OK explícito de Frank.
- SOFIA NO toca `prisma/schema.prisma`.
- SOFIA NO toca `prediagnostic.py` (verificación visual solo).
- SOFIA NO implementa nota médica, certificado ni incapacidad (fuera de alcance §1.5).
- SOFIA ejecuta gates después de cada commit (no solo al final).
- SOFIA usa `task` tool con `subagent_type='gemini'` como segunda mano de validación antes de reportar "listo".
- SOFIA respeta los literales del PDF de referencia **verbatim** (principio "lo copia igualito" de SPEC-01).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Migración de heurística `includes('no apto')` rompe clasificación de dictámenes legacy | Media | Alto | DA-1 + fallback legacy (D1): si `aptitud` es nulo, caer a `finalDiagnosis.includes('no apto')`. Test AC-8 y AC-26 cubren el caso. |
| El literal largo "NO CUMPLE CON LOS CRITERIOS..." rompe el layout del botón de aptitud | Media | Bajo | Usar `break-words` / `truncate` + tooltip en el botón; AC-5 Playwright snapshot. |
| Los `extractedData` de estudios IA tienen forma variable y la transformación a texto legible falla | Media | Medio | `buildExamSummary` reutiliza `ClinicalExtractionRenderer` (ya maneja formas variables); fallback a `Pendiente de resultado` si no parsea. |
| El catálogo de recomendaciones D3 no cubre todos los casos que Jaqueline espera | Alta | Bajo | El catálogo es semilla extensible; Jaqueline/Erika validan en iteración. El médico puede editar manualmente (D3). No bloquea SPEC. |
| El PDF excede 3 hojas con contenido largo (T-5.10) | Baja | Medio | `@react-pdf/renderer` con `wrap` en `View` para paginación; el PDF de referencia es de 1-2 hojas. |
| El logo "Soluciones" final de Lety no está disponible | Alta | Bajo | Logo placeholder (D4) hasta confirmación de Lety; mismo patrón que `ARCH-20260630-01` v2. |
| El auto-poblamiento pisa un `finalDiagnosis` que el médico ya editó manualmente | Media | Medio | Solo auto-poblar si `verdictData.finalDiagnosis` está vacío (D2); si el médico ya escribió, no sobrescribir. |
| D1 o D4 rechazadas por Frank requiere rework | Media | Medio | D1 y D4 están en cortes separados (Corte 1 y Corte 5) que se pueden saltar/ajustar sin tocar Cortes 2-3-4. |

---

## 9. Definición de Done (DoD)

- [ ] Los 18-19 commits de esta SPEC están en `main` (tras OK Frank + revisión GEMINI). Corte 5 condicionado a D4.
- [ ] `pnpm typecheck` → 0 errores.
- [ ] `pnpm test --run` → todos pasan (incluye nuevos tests de aptitud enum, DA-1, builder, PDF snapshot).
- [ ] `pnpm lint` → 0 errores nuevos.
- [ ] Playwright E2E del flujo clínico completo (cita → … → firma → descarga PDF) pasa.
- [ ] `pdftotext` del PDF generado contiene los 9 labels exactos, el bloque "DICTAMEN DE APTITUD", las recomendaciones numeradas y la firma.
- [ ] El portal clasifica correctamente apto/no-apto/pendiente con la heurística migrada (AC-7, AC-8).
- [ ] `prediagnostic.py` sigue produciendo `extractedData` sin cambio (AC-24).
- [ ] GEMINI audit aprobado (con o sin observaciones, sin bloqueadores).
- [ ] PROYECTO.md actualizado por CRONISTA con estado DONE y referencia a esta SPEC.
- [ ] Publicación a producción sigue pendiente y requiere permiso separado (NO incluido en esta SPEC).

---

## 10. Referencias

- Reporte de aptitud canónico: `context/datos AMI/informacion para revision/REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf` (extraído vía `pdftotext -layout` por INTEGRA).
- Nota médica canónica: `context/datos AMI/informacion para revision/NOTA MEDICA EJEMPLO.pdf` (extraído vía `pdftotext -layout` por INTEGRA — para §1.5 fuera de alcance).
- Análisis ZIN: `context/datos AMI/informacion para revision/Analisis_ZIN_Formulario_ExamenGeneral.md` (catálogos `ddlIDAgudezaNormal`, `dllIDPresionArt`).
- Juntas: `context/Juntas/Revision_AMI_10082026_puntos.md` (T-5.8, T-5.14, T-5.9, T-5.10), `context/Juntas/Junta_semanal_12082026_puntos.md` (T-B.1, T-B.4).
- SPEC previa: `context/SPECs/SPEC_ARCH-20260817-01-COMBOS-ZIN-MIGRATION.md` (DA-1, patrón `tolerantZinEnum`, commits granulares).
- ADR previa: `context/decisions/ADR-20260817-01-COMBOS-ZIN-MIGRATION.md`.
- Schema Zod: `frontend/src/schemas/clinical/exam.schema.ts:410-422` (`ImpresiónAptitudSchema`), `:203-213` (`ESTADO_NUTRICIONAL_VALUES`), `:199` (`SALUD_BUCAL_VALUES`).
- Pestaña Impresión/Aptitud: `frontend/src/components/clinical/ExamenMedicoEstudio.tsx:237-242` (`APTITUD_OPTIONS`), `:277-279` (state `aptitud`), `:1408-1450` (resumen clínico), `:1452-1511` (impresión diagnóstica + restricciones + observaciones).
- Dictamen final: `frontend/src/components/EventFlowController.tsx:108-122` (textareas), `:56-86` (`handleSign`).
- `saveVerdict`: `frontend/src/actions/medical-event.actions.ts:40-47`.
- `upsertVerdict`: `frontend/src/services/medical-event.service.ts:125-130`.
- PDF route: `frontend/src/app/api/pdf/[eventId]/route.tsx` (carga verdict + studies/labs, falta `exam`).
- PDF componente: `frontend/src/components/pdf/MedicalDictamenPDF.tsx` (header actual, sección III JSON.stringify, sección IV finalDiagnosis).
- Firma: `frontend/src/actions/signature.actions.tsx:14-145` (`signMedicalDictamPDF`).
- Portal heurística: `frontend/src/actions/portal.actions.ts:63`, `frontend/src/app/portal/events/page.tsx:56`, `frontend/src/app/portal/workers/page.tsx:52,119`.
- Datos del evento: `frontend/src/app/events/[id]/_lib/event-page-data.ts:139` (`finalDiagnosis`).
- ADR asociado: `context/decisions/ADR-20260817-02-IMPRESION-APTITUD.md`.
- Handoff SOFIA: `context/interconsultas/HANDOFF_ARCH-20260817-02_SOFIA_IMPRESION-APTITUD.md`.

---

**Firmado:** INTEGRA — 2026-08-17 CST
**Espera:** OK explícito de Frank para D1 (enum aptitud, P1) y D4 (membrete, P2) antes de delegar a SOFIA. Cortes 2-3-4 pueden proceder independientemente de D4; Corte 1 depende de D1.
