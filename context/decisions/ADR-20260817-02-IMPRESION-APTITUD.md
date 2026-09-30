# ADR-20260817-02 — Impresión y Aptitud del Examen Médico — Decisiones arquitectónicas

**Estado:** ACEPTADO (espera OK Frank para D1 y D4, y para activar implementación)
**Fecha:** 2026-08-17 (CST)
**Autor:** INTEGRA (sobre glm-5.2 — plan Alibaba)
**SPEC asociada:** `context/SPECs/SPEC_ARCH-20260817-02-IMPRESION-APTITUD.md`
**Contexto previo:** Handoff ATLAS M3 con `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf` y `NOTA MEDICA EJEMPLO.pdf` (extraídos vía `pdftotext -layout` por INTEGRA).

---

## Contexto

El flujo de dictamen actual de AMI tiene **tres deficiencias estructurales** verificadas en código:

1. **Duplicación de captura.** El médico completa la pestaña "Impresión y Aptitud" en `ExamenMedicoEstudio.tsx` (persiste en `MedicalExam.physicalExamData`), y luego **vuelve a escribir a mano** el "Diagnóstico Final" y "Recomendaciones" en `EventFlowController.tsx:108-122` (persiste en `MedicalVerdict.finalDiagnosis`/`recommendations`). El segundo paso ignora el primero.

2. **PDF de dictamen no fiel al formato AMI canónico.** El `MedicalDictamenPDF.tsx` actual renderiza sección III ("AUXILIARES DE DIAGNÓSTICO") como `JSON.stringify(s.extractedData)` — ilegible para un médico. No tiene la tabla de 9 campos resumen, no muestra el campo `aptitud` estructurado, no tiene membrete "Soluciones". El `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf` define el formato canónico: tabla de 9 campos (ESTADO NUTRICIONAL, AGUDEZA VISUAL, SALUD BUCAL, EXAMEN MEDICO, PRESION ARTERIAL, AUDIOMETRIA, ESPIROMETRIA, LABORATORIOS, RADIOGRAFIA), bloque "DICTAMEN DE APTITUD" con 4 valores (APTO / APTO CONDICIONADO / APTO CON RESTRICCIONES / NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO), recomendaciones numeradas, firma "Realizó EM / Ced. Prof.".

3. **Heurística frágil de aptitud en el portal.** `portal.actions.ts:63`, `portal/events/page.tsx:56` y `portal/workers/page.tsx:52,119` infieren "isApto" con `finalDiagnosis.toLowerCase().includes('no apto')`. El enum Zod actual (`['APTO', 'APTO CON RESTRICCIONES', 'NO APTO', 'PENDIENTE DE RESULTADOS']`) **no coincide** con el PDF de referencia (que usa `APTO CONDICIONADO` y el literal largo de no-apto). El nuevo literal `"NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO"` **no contiene** la subcadena `"no apto"` → la heurística lo clasificaría erróneamente como apto. Bug latente.

Las juntas AMI 10/ago y 12/ago registraron los tickets T-5.8 (auto-poblamiento dictamen), T-5.14 (incremento caracteres), T-B.1 (membrete), T-B.4 (auto-poblamiento desde examen), T-5.9 (ampliar observaciones), T-5.10 (máx 3 hojas).

---

## Decisión

### DA-1 — Enum de aptitud: 5 valores del PDF de referencia + `PENDIENTE DE RESULTADOS` + DA-1 tolerante ⚠️ REQUIERE OK FRANK

**Estado:** PROPUESTO (espera OK Frank — P1)

**Opciones evaluadas:**

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **A (propuesta)** | Enum de 5 valores: 4 del PDF canónico + `PENDIENTE DE RESULTADOS` operativa. Schema pasa de `z.enum()` a `tolerantZinEnum()` (DA-1). Migrar heurística portal a leer `aptitud` estructurada con fallback legacy. | Fiel al PDF de referencia; consistencia clínica; `PENDIENTE` cubre el flujo operativo; DA-1 preserva legacy | Requiere migrar 3 sitios de heurística del portal; el literal largo de "no apto" puede romper layout (mitigado con CSS) |
| B | Mantener enum actual (`APTO / APTO CON RESTRICCIONES / NO APTO / PENDIENTE`) y agregar `APTO CONDICIONADO` como 6º | Menor impacto en portal | **Contradice el PDF canónico** (Frank pidió basarse en formatos AMI actuales); `NO APTO` no existe en el formato real; el literal largo sigue faltando |
| C | Migrar `aptitud` a columna Prisma enum (migración de datos) | Consistencia fuerte a nivel BD | **Prohibido por Frank** ("no modificar `prisma/schema.prisma` sin OK explícito"); requiere migrar registros legacy `NO APTO`; overkill para un campo que vive bien en JSON |

**Decisión:** Opción A.

**Justificación:**
- El `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf` es la fuente canónica (igual que el ZIN lo fue para SPEC-01). Frank explícitamente pidió basar la UX en los formatos AMI actuales.
- `PENDIENTE DE RESULTADOS` se conserva porque el PDF no lo muestra al ser un reporte final ya completo, pero es operativamente necesario cuando faltan estudios por procesar.
- DA-1 (`tolerantZinEnum`) preserva registros legacy con `NO APTO` — patrón ya probado en SPEC-01 (commits `IMPL-20260817-01-C1/C2`).
- La migración de la heurística `includes('no apto')` a lectura estructurada es **contractualmente necesaria** porque el literal largo no contiene la subcadena. El fallback legacy preserva dictámenes históricos sin `aptitud` estructurada.

**Implementación:** ver `SPEC_ARCH-20260817-02` §2.1, §3.1 (Corte 1) y §6.

### DA-2 — Auto-poblamiento del dictamen desde la pestaña "Impresión y Aptitud" (cambio de frontera)

**Estado:** ACEPTADO

**Decisión:** El `EventFlowController` deja de requerir re-captura manual. Al montar en estado `VALIDATING`, auto-puebla los textareas "Diagnóstico Final" y "Recomendaciones" desde `MedicalExam.physicalExamData` (D2) y desde el catálogo de reglas (D3). El médico puede editar antes de firmar. Solo auto-puebla si `verdictData.finalDiagnosis` está vacío (no pisa edición manual previa).

**Justificación:**
- Resuelve T-5.8 y T-B.4 (Jaqueline: "lo que necesitamos es que jale directo al resumen").
- Elimina la duplicación de captura (deficiencia estructural #1).
- El `MedicalVerdict` sigue teniendo `finalDiagnosis`/`recommendations` como strings — **no cambia el contrato público del modelo**. Solo cambia cómo se construyen sus valores (de manual a propuesto+editable).
- Reversible: si el auto-poblamiento falla, el médico puede escribir manualmente (el textarea sigue siendo editable).

**Impacto en el flujo de datos:**

Antes:
```
Pestaña Impresión/Aptitud → MedicalExam.physicalExamData (aptitud, impresion, restricciones, ...)
                              ↓ (sin enlace)
EventFlowController textareas → MedicalVerdict.finalDiagnosis / recommendations (re-escritos a mano)
```

Después:
```
Pestaña Impresión/Aptitud → MedicalExam.physicalExamData (aptitud, impresion, restricciones, ...)
                              ↓ (auto-poblamiento en VALIDATING)
EventFlowController textareas (pre-poblados, editables) → MedicalVerdict.finalDiagnosis / recommendations
```

**Cambio de frontera:** la fuente de verdad del dictamen final pasa de ser "lo que el médico escribió a mano en `EventFlowController`" a "lo que el médico capturó en la pestaña Impresión/Aptitud, propuesto en `EventFlowController` y firmado". Esto es coherente con la trazabilidad canónica `Necesidad → DEC/BR → SPEC/AC → IMPL → QA` (§6 AGENTS): el dictamen se origina en la captura clínica estructurada, no en una re-escritura aislada.

### DA-3 — Reemplazo del `MedicalDictamenPDF` por reporte de aptitud fiel al PDF canónico

**Estado:** ACEPTADO

**Decisión:** El componente `MedicalDictamenPDF.tsx` se reemplaza por un reporte de aptitud que replica la estructura del `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf`:
- Header membretado (DA-4, condicionado).
- Datos del paciente (nombre, sexo, edad, empresa, fecha, tipo examen, puesto).
- Tabla de 9 campos resumen (DA-5).
- Bloque "DICTAMEN DE APTITUD" con 5 valores como checklist (uno marcado).
- "OBSERVACIONES / COMENTARIOS / RECOMENDACIONES:" con lista numerada.
- Firma "Realizó EM: <nombre> / Ced. Prof.: <cédula>".
- Paginación controlada (hasta 3 hojas, T-5.10).

El `app/api/pdf/[eventId]/route.tsx` se extiende para cargar `MedicalExam.physicalExamData` (hoy no se incluye) y construir los 9 campos resumen. La transformación de `extractedData` (audiometría/espirometría/RX/laboratorio) a texto legible se delega a `buildExamSummary` (nuevo helper), que reutiliza la lógica de `ClinicalExtractionRenderer`.

**Justificación:**
- El PDF actual es funcionalmente inútil para un médico (JSON.stringify en sección III).
- El PDF canónico es la fuente de verdad (handoff explícito de Frank).
- Reutiliza renderers existentes → riesgo bajo.

**Reversibilidad:** el componente es aislado. Si el nuevo reporte tiene defectos, `git revert` del commit 11 restaura el `MedicalDictamenPDF` anterior sin tocar el resto del flujo (commits granulares por archivo, §4 SPEC).

### DA-4 — Membrete "Soluciones" como header del PDF ⚠️ REQUIERE OK FRANK

**Estado:** PROPUESTO (espera OK Frank — P2)

**Opciones evaluadas:**

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **Header membretado (propuesta)** | Logo placeholder + cintillo "Soluciones Médico Empresariales / Medicina Laboral" en la parte superior del PDF | Fiel a la descripción de Lety ("hoja membretada, logo de soluciones y un cintillo"); no interfiere con lectura clínica ni con firma digital; reversible | Logo final de Lety pendiente (placeholder provisional) |
| Watermark | Logo/texto semitransparente sobre el contenido | Marca visible en cada hoja | Intrusivo; puede interferir con lectura clínica y firma digital; no coincide con "cintillo" |
| Pie de página | Cintillo en el footer | No interfiere con contenido | Poco visible; no cumple la intención de "hoja membretada" |

**Decisión:** Header membretado (propuesta). Solo al reporte de aptitud en esta SPEC; nota médica y certificado aplicarán el mismo membrete en sus SPECs separadas.

**Justificación:**
- Lety (junta 12/ago) dejó la decisión abierta, pero su descripción se mapea mejor a header + cintillo.
- Frank pidió basar la UX en los formatos AMI actuales; el certificado de referencia tiene branding "Soluciones".
- Logo placeholder es el patrón consistente con `ARCH-20260630-01` v2 decisión 3.

### DA-5 — Tabla de 9 campos resumen: AMBOS orígenes (captura manual + resultados IA), en vivo, congelado al firmar

**Estado:** ACEPTADO

**Decisión:** Los 9 campos del reporte de aptitud se construyen:
- Campos 1-5 (estructurales: estado nutricional, agudeza visual, salud bucal, examen médico, presión arterial) desde `MedicalExam.physicalExamData` (captura manual del examen).
- Campos 6-9 (audiometría, espirometría, laboratorios, radiografía) desde los resultados IA ya procesados (`StudyRecord.extractedData`/`aiPrediction` + `LabRecord`).
- Preview en vivo en la pestaña "Impresión y Aptitud" (reactivo a cambios del form y a resultados IA).
- Snapshot al firmar: el PDF se genera desde el estado de `MedicalVerdict` + `MedicalExam` en el momento de `signMedicalDictamPDF`; `pdfUrl` inmutable post-firma.

**Justificación:**
- Responde a la Pregunta 2 de Frank: "AMBOS".
- Los datos ya existen en el sistema (captura del examen + resultados IA); no se inventan.
- El médico ve el preview antes de firmar → valida antes de sellar.

### DA-6 — `agudeza_visual_resumen` y `presion_arterial_resumen` a enums cortos (sin migración)

**Estado:** ACEPTADO

**Decisión:** Los campos `agudeza_visual_resumen` y `presion_arterial_resumen` (hoy `cleanString`) pasan a `tolerantZinEnum` con catálogos cortos:
- `agudeza_visual_resumen`: `['NORMAL', 'DISMINUIDA', 'NO APLICA']` (3 valores — fiel al PDF que muestra `DISMINUIDA`).
- `presion_arterial_resumen`: `['NORMAL AL MOMENTO DE LA TOMA', 'ALTA', 'BAJA']` (catálogo ZIN `dllIDPresionArt`).

**Justificación:**
- Consistencia con SPEC-01 (DA-1, `tolerantZinEnum`).
- El PDF muestra valores cortos (`DISMINUIDA`, `NORMAL AL MOMENTO DE LA TOMA`), no Snellen ni numéricos.
- Sin migración Prisma (viven en JSON).

### DA-7 — Recomendaciones: catálogo MIXTO + edición manual + lista numerada

**Estado:** ACEPTADO

**Decisión:** Las recomendaciones se generan desde un catálogo cerrado de reglas hallazgo→recomendación (semilla inicial en `buildRecommendations`), aplicado sobre los 9 campos resumen + hallazgos IA. El médico puede editar, agregar, reordenar. Se renderizan como lista numerada (patrón del PDF).

**Justificación:**
- Responde a la Pregunta 3 de Frank: "mixto".
- El catálogo es semilla extensible — Jaqueline/Erika validan en iteración. No bloquea la SPEC.
- El médico mantiene el juicio clínico (puede editar).
- El patrón numerado es fiel al PDF (`1.- ... 2.- ... 3.- ...`).

### DA-8 — Nota médica, certificado, tipo de consulta e incapacidad: FUERA DE ALCANCE

**Estado:** ACEPTADO

**Decisión:** La nota médica (consulta, motivo, diagnóstico por sistemas, tratamiento, material médico), el tipo de consulta (Enfermedad General / Profesional / Accidente de trabajo / Accidente Trayecto / Primer Auxilio / Incidente), la incapacidad (Otorga Incapacidad / Num. Días / Pase de Salida) y el certificado médico NO se implementan en esta SPEC. Van en SPECs separadas.

**Justificación:**
- Son documentos DIFERENTES del reporte de aptitud. El reporte de aptitud es para examen de ingreso/periódico/retiro (aptitud laboral); la nota médica es para consulta de enfermedad; el certificado es laboral.
- No comparten modelo de captura. Implementarlos juntos mezclaría contratos.
- Frank pidió basarse en los formatos AMI actuales; el `REPORTE DE EXAMEN MEDICO (APTITUD)` es el formato del examen, no de la consulta.
- Responde a las Preguntas 5 y 6 de Frank: tipo de consulta solo nota médica; incapacidad es modelo separado.

---

## Implicaciones

### Positivas

- Elimina duplicación de captura del dictamen (deficiencia estructural #1).
- El PDF de dictamen pasa de funcionalmente inútil (JSON.stringify) a fiel al formato AMI canónico.
- El portal deja de inferir aptitud de un texto libre frágil → lee campo estructurado.
- DA-1 preserva registros legacy sin migración de datos.
- Reutiliza `ClinicalExtractionRenderer` y patrones de SPEC-01 → costo de implementación contenido.

### Negativas

- El enum de aptitud cambia → requiere migrar 3 sitios de heurística del portal (mitigado con fallback legacy).
- El catálogo de recomendaciones D3 es semilla → requerirá iteración con Jaqueline/Erika (no bloquea SPEC).
- Logo "Soluciones" final de Lety pendiente → placeholder provisional.
- Deuda técnica: el literal largo "NO CUMPLE CON LOS CRITERIOS..." puede requerir CSS específico en los botones (mitigado).

### Riesgos

- Ver `SPEC_ARCH-20260817-02` §8 (tabla de riesgos).

---

## Mitigación

- Cada commit se valida con gates (`pnpm typecheck && pnpm test --run && pnpm lint`).
- Playwright E2E del flujo clínico completo antes de declarar DONE (incluye heurística portal, auto-poblamiento VALIDATING, descarga PDF).
- SOFIA usa `task` tool con `subagent_type='gemini'` como segunda mano de validación (Qodo está sunset).
- INTEGRA no delega a SOFIA sin OK explícito de Frank para D1 (Corte 1) y D4 (Corte 5).
- SOFIA no commitea/pushea sin OK explícito de Frank.
- `prediagnostic.py` no se toca (verificación visual solo).
- `prisma/schema.prisma` no se toca.

---

## Reversibilidad

- D1 (enum aptitud): reversible vía DA-1 (los registros legacy siguen parseando); revertir el commit 1 restaura el enum anterior.
- D2 (auto-poblamiento): reversible — el textarea sigue siendo editable; si el auto-poblamiento falla, el médico escribe manualmente.
- D3 (catálogo recomendaciones): reversible — es una función pura; el médico puede ignorar y escribir manualmente.
- D4 (membrete): reversible — es un componente del header; revertir el commit 19 restaura el header anterior.
- D5 (tabla resumen PDF): reversible — `git revert` del commit 11 restaura el `MedicalDictamenPDF` anterior.
- DA-8 (fuera de alcance): no aplica (no se implementa).

---

## Referencias

- Handoff ATLAS M3 (origen): turno 2026-08-17, `REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf` y `NOTA MEDICA EJEMPLO.pdf` extraídos vía `pdftotext -layout`.
- SPEC asociada: `context/SPECs/SPEC_ARCH-20260817-02-IMPRESION-APTITUD.md`.
- SPEC/ADR previos (DA-1, `tolerantZinEnum`): `context/SPECs/SPEC_ARCH-20260817-01-COMBOS-ZIN-MIGRATION.md`, `context/decisions/ADR-20260817-01-COMBOS-ZIN-MIGRATION.md`.
- Juntas: `context/Juntas/Revision_AMI_10082026_puntos.md` (T-5.8, T-5.14, T-5.9, T-5.10), `context/Juntas/Junta_semanal_12082026_puntos.md` (T-B.1, T-B.4).
- Análisis ZIN: `context/datos AMI/informacion para revision/Analisis_ZIN_Formulario_ExamenGeneral.md` (catálogos `ddlIDAgudezaNormal`, `dllIDPresionArt`).
- Código verificado: `exam.schema.ts:410-422`, `ExamenMedicoEstudio.tsx:237-242/277-279/1408-1511`, `EventFlowController.tsx:108-122`, `medical-event.actions.ts:40-47`, `medical-event.service.ts:125-130`, `app/api/pdf/[eventId]/route.tsx`, `MedicalDictamenPDF.tsx`, `signature.actions.tsx:14-145`, `portal.actions.ts:63`, `portal/events/page.tsx:56`, `portal/workers/page.tsx:52,119`, `event-page-data.ts:139`.

---

**Decisiones registradas:** DA-1 (⚠️ P1), DA-2, DA-3, DA-4 (⚠️ P2), DA-5, DA-6, DA-7, DA-8.
**Estado global:** ACEPTADO. Espera OK Frank para DA-1 (P1) y DA-4 (P2) antes de activar implementación vía SOFIA. Cortes 2-3-4 pueden proceder independientemente de DA-4; Corte 1 depende de DA-1.
