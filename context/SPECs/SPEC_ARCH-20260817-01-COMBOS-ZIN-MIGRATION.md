# SPEC — ARCH-20260817-01 — Migración de campos abiertos a combos seleccionables (adopción ZIN)

**Estado:** READY (espera OK Frank para delegar a SOFIA)
**Firmada por:** INTEGRA (sobre glm-5.2 — plan Alibaba)
**Fecha de firma:** 2026-08-17 (CST)
**Origen:** Handoff ATLAS M3 (análisis curl ZIN + juntas AMI 10/ago y 12/ago)
**Baseline esperado:** `4f561b7` (FIX-20260812-20). Verificación inmediata recomendada: `pnpm typecheck && pnpm test --run` desde `frontend/`.

---

## 1. Contexto

### 1.1 Necesidad

Frank pidió "verificar formularios que tienen preguntas abiertas que se pueden sustituir por seleccionables". El ZIN actual (sistema legacy en `https://devcami.azurewebsites.net/Examenes/ExamenGral.aspx`) ya tiene los `<select>` implementados para casi todos los campos clínicos relevantes. Hay que adoptarlos en AMI para reducir errores de dedo del médico y mejorar consistencia de captura.

### 1.2 Tickets cubiertos

Esta SPEC cubre directamente los siguientes tickets detectados en las juntas AMI (ver `context/Juntas/Revision_AMI_10082026_puntos.md`):

| Ticket | Descripción | Cita textual junta |
|---|---|---|
| **T-5.1** | Prellenado de exploración física estilo ZIN | Frank: "Lo copia igualito que el ZIN". Erika: "Sí tal cual". |
| **T-5.2** | Agudeza visual = combos de selección (no inputs libres) | Jaqueline: "ya tenemos combos donde seleccionas y abajo te aparecen opciones". Erika: "dejar combos de selección". |
| **T-5.3** | Campimetría = combos (normal / alterada / no aplica / ver estudio anexo) | — |
| **T-5.4** | Ishihara = combos (normal / anormal) | — |
| **T-5.6** | Antecedentes patológicos: acordeón "Sí" → desplegar desde cuándo / tratamiento | Frank: "que sea como acordeón que se expanda con ver detalles". |
| **T-5.7** | Heredo familiares: combos (abuelo materno, paterno, padre, madre, otros) | Jaqueline: "seleccionamos y tenemos opciones como opción múltiple". |
| **T-5.14 (parcial)** | Signos vitales al integrar dictamen (complexión, agudeza, presión arterial) | Jaqueline: "incrementar los caracteres porque está muy reducido". |

### 1.3 Restricciones (heredadas del handoff)

- **No commits automáticos sin OK de Frank.** Esta SPEC se entrega lista para delegar a SOFIA, pero la delegación efectiva espera OK explícito.
- **No tocar schema Prisma** — el cambio es UI + Zod + acciones, no modelo de datos.
- **No romper flujo clínico**: cita → check-in → papeleta → examen → IA → revisión → dictamen debe funcionar idéntico.
- **Sin migración de datos** (Opción A — ver §2.1).
- Mantener compatibilidad con datos legacy en BD.

---

## 2. Decisiones arquitectónicas resueltas

### 2.1 D1 — Compatibilidad legacy: Opción A (tolerante con `z.string().refine()`)

**Decisión:** Adoptar **Opción A** con `z.string()` + `.refine()` tolerante. El schema Zod acepta los valores del enum nuevo **Y** cualquier string legacy.

**Justificación:**
- Frank fijó explícitamente "Sin migración de datos" en el handoff → descarta Opción B (`z.enum()` estricto).
- Opción C (campo nuevo `_v2` + preservar legacy) duplica superficie sin beneficio (los valores nuevos ya son subset aceptado del viejo).
- `z.string().refine(v => v === '' || ENUM_VALUES.includes(v) || v === null || v === undefined)` permite:
  - Registros legacy en BD cargan sin error.
  - Captura nueva solo acepta valores del enum.
  - Validación server-side rechaza solo strings maliciosos/fuera de enum.

**Confianza:** ≥95%. Es decisión interna, reversible, sin impacto contractual.

### 2.2 D2 — División en 2 cortes con commits granulares por archivo

**Decisión:** Dos cortes secuenciales. Cada archivo modificable genera su propio commit para permitir rollback individual (petición explícita de Frank).

**Corte 1 (independiente, ~6h SOFIA):** Solo Agudeza Visual.
- 4 tickets impactados (T-5.2, T-5.3, T-5.4, T-5.5 parcial — reflejos default ya existe).
- Riesgo bajo.
- Validación aislada.

**Corte 2 (dependiente de Corte 1, ~17h SOFIA):** Exploración física + Antecedentes.
- 3 tickets impactados (T-5.1, T-5.6, T-5.7) + T-5.14 parcial.
- Reutiliza patrones definidos en Corte 1.

**Confianza:** ≥90%. Alineado con petición explícita de Frank.

### 2.3 D3 — Plantillas ZIN literales exactas

**Decisión:** Los 16 literales de plantilla de exploración física se copian **exactamente** del `NOTA MEDICA EJEMPLO.pdf` (extraídos en `context/datos AMI/informacion para revision/Analisis_ZIN_Formulario_ExamenGeneral.md` §B). Sin paráfrasis, sin normalización de mayúsculas.

**Justificación:** Frank explícito: "Lo copia igualito que el ZIN".

**Implementación:** los 16 literales van como constantes exportadas desde `exam.schema.ts` (o un archivo `plantillas-zin.ts` adyacente). El `<input>` queda con `defaultValue={PLANTILLAS[field]}` (texto libre sigue siendo editable; el médico puede desviarse si el caso lo requiere).

**Validación de literales:** Confirmación paralela con Jaqueline/Erika puede ocurrir durante implementación de SOFIA — no bloquea la SPEC. La fuente canónica es el `NOTA MEDICA EJEMPLO.pdf` ya analizado por ATLAS. Si Jaqueline detecta discrepancia, se ajusta el literal en un commit posterior.

### 2.4 D4 — Numéricos a `<input type="number">` con step/min/max

**Decisión:** Los 30 numéricos (signos vitales, somatometría) se convierten de `type="text"` a `type="number"` con atributos `step`, `min`, `max` apropiados por campo.

**Justificación:** El análisis ZIN §"Numéricos" ya los clasificó. El schema Zod ya usa `z.coerce.number()` para estos campos (`exam.schema.ts:5`), pero el input actual es `type="text"` — convertir mejora UX (teclado numérico móvil, validación nativa).

**Alcance:** Se incluye en **Corte 2** (no en Corte 1, que solo toca agudeza visual).

### 2.5 D5 — Acordeón "Sí/No + Especifique" con `useState` local

**Decisión:** El patrón acordeón ZIN (`ddl...` SÍ/NO/NO APLICA + input condicional "Especifique") se implementa con `useState` local + render condicional, reutilizando el patrón **ya existente** en `AntecedentesCaptura.tsx:438-518` (No Patológicos ya tiene botones SI/NEGADO con sub-campos condicionales).

**Justificación:** No introduce nueva dependencia ni contexto global. El estado del acordeón se propaga al padre vía `onChange` (componente controlado).

---

## 3. Alcance exacto por archivo

### 3.1 Corte 1 — Agudeza Visual

| # | Archivo | Cambio | Diff estimado |
|---|---|---|---|
| 1 | `frontend/src/schemas/clinical/exam.schema.ts` | Agregar constantes enum + `z.string().refine()` para 11 campos (8 visión + reflejos + ishihara + campimetria) | +~80 líneas |
| 2 | `frontend/src/components/clinical/studies/AgudezaVisualStudy.tsx` | 8 inputs `type="text"` → 8 `<select>` con opciones ZIN (ver §4.1); 3 inputs complementarios (reflejos, campimetria, test_ishihara) → 3 `<select>` | +~100 / -~30 |
| 3 | `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` (solo sección agudeza visual, pestaña 3 interna) | Mismo cambio que #2 pero en el render inline de `agudezaForm` (líneas ~248-261 estado, render en pestaña 3) | +~100 / -~30 |
| 4 | `frontend/src/lib/demo/demo-data.ts` + `demo-types.ts` | Actualizar snapshots demo para que usen valores del nuevo enum (no `DemoCampimetria` que es estructura separada — solo si el demo renderiza los selects) | +~20 / -~10 |
| 5 | `frontend/src/actions/__tests__/medical-exam.actions.test.ts` | Agregar casos de test: acepta valores legacy + acepta valores enum nuevos + rechaza strings fuera de enum | +~60 |

**Total Corte 1:** ~5 archivos, ~360 líneas añadidas, ~70 removidas.

### 3.2 Corte 2 — Exploración Física + Antecedentes

| # | Archivo | Cambio | Diff estimado |
|---|---|---|---|
| 6 | `frontend/src/schemas/clinical/exam.schema.ts` | Constantes enum para 9 selects de exploración física + 16 literales plantilla ZIN + `z.string().refine()` para 9 campos exploración | +~200 |
| 7 | `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` (sección exploración, `EXPLORACION_FIELDS` iteración línea 1020) | 9 inputs → 9 selects (reflejos, campimetría, ishihara, test_adam, arco_movilidad, tono_muscular, coordinacion, estado_nutricional, salud_bucal); 16 inputs con `defaultValue={PLANTILLAS_ZIN[field]}` (texto libre); ~6 inputs `type="text"` → `type="number"` con step/min/max | +~250 / -~50 |
| 8 | `frontend/src/components/clinical/AntecedentesCaptura.tsx` (sección heredo-familiares, ~líneas 406-429) | 9 inputs `type="text"` (con placeholder "Relación familiar (ej: PADRE)") → 9 `<select>` con opciones ZIN: 7 con `NEGADOS/PADRE/MADRE/AMBOS/HERMANOS/AB PATERNO/AB MATERNO/OTROS` + `ddlAHFMentales` con `NEGADO/SI/NO APLICA` + `otras` como texto condicional cuando `otras == 'OTROS'` | +~80 / -~20 |
| 9 | `frontend/src/components/clinical/AntecedentesCaptura.tsx` (sección patológicos) | Agregar patrón "Especifique" condicional a cada patológico marcado como "SÍ" (campo `especifique` que aparece con `useState` local cuando el valor es "SÍ") | +~60 |
| 10 | `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` + `PapeletaWorkspace.tsx` | Verificar que el renderer de extracción IA y el workspace padre siguen funcionando con los nuevos valores (sin cambios de código si los campos son string) | solo verificación |
| 11 | `frontend/src/lib/demo/pdf-generator.tsx` + `xlsx-generator.ts` | Verificar que el render de PDF/XLSX muestra los nuevos valores enum correctamente (snapshot demo usa `DemoCampimetria`, estructura separada — probablemente sin cambios) | solo verificación |
| 12 | `frontend/src/actions/medical-exam.actions.ts` | Validación server-side ya está en `exam.schema.ts` (Zod). Verificar que el action `saveExamenMedicoPapeleta` no rechaza legacy. | solo verificación |
| 13 | `backend/app/services/ai/prediagnostic.py` | **NO TOCAR.** Solo verificar que `vision_lejana_od` y `vision_lejana_oi` siguen siendo strings parseables (ZIN usa 20/200..20/10 — el backend ya maneja formato Snellen, ver `prediagnostic.py:160, 504, 518, 520, 525`). El backend NO consume los 9 campos de exploración física ni los antecedentes en el prompt IA — solo `vision_lejana_od/oi`. | solo verificación |
| 14 | Tests de integración | Agregar tests de snapshots de ExamenMedicoCompletoSchema con valores nuevos | +~40 |

**Total Corte 2:** ~9 archivos verificando/modificando, ~630 líneas añadidas, ~70 removidas.

**Gran total SPEC:** ~14 archivos en scope, ~990 líneas añadidas, ~140 removidas.

### 3.3 Archivos explícitamente NO tocados

| Archivo | Razón |
|---|---|
| `prisma/schema.prisma` | Restricción de Frank: no tocar schema. |
| `frontend/src/components/clinical/TriageForm.tsx` | Legacy — no se importa en ningún componente activo (grep 0 resultados). Muerto. |
| `frontend/src/components/clinical/DoctorExamForm.tsx` | Legacy — no se importa en ningún componente activo (grep 0 resultados). Muerto. |
| `backend/app/services/ai/prediagnostic.py` | Solo lee `vision_lejana_od/oi` — formato Snellen ya compatible. |
| Migraciones SQL | Sin migración de datos (Opción A). |

---

## 4. Mapeo exacto campo ZIN → campo AMI

### 4.1 Agudeza visual (Corte 1)

| Campo AMI (`exam.schema.ts`) | Select ZIN | Opciones (10 cada uno) |
|---|---|---|
| `vision_lejana_od` | `ddlVisionLejana` | `20/200, 20/100, 20/70, 20/50, 20/40, 20/30, 20/25, 20/20, 20/15, 20/10` |
| `vision_lejana_oi` | `ddlLejanaOi` | mismas |
| `vision_cercana_od` | `ddlVisionCercana` | mismas |
| `vision_cercana_oi` | `ddlCercanaOI` | mismas |
| `lejana_corregida_od` | `ddlCorregida` | mismas |
| `lejana_corregida_oi` | `DDLCorregidaOi` | mismas |
| `cercana_corregida_od` | `ddlCercanaCorregida` | mismas |
| `cercana_corregida_oi` | `ddlCercanaCorregidaOi` | mismas |
| `reflejos` | (no existe en ZIN — campo AMI propio) | `PRESENTES Y NORMOREFLECTICOS, DISMINUIDOS, AUSENTES, NO APLICA` (default `PRESENTES Y NORMOREFLECTICOS`) |
| `campimetria` | `txtCampimtria` (input text en ZIN → AMI lo convierte a select) | `CAMPOS VISUALES DENTRO DE PARÁMETROS NORMALES, ALTERADOS, NO APLICA, VER ESTUDIO ANEXO` |
| `test_ishihara` | `txtDaltomismo` (input text en ZIN → AMI lo convierte a select) | `NORMAL (LEE 12,8,6,29,57,45), ALTERADO, NO APLICA` |

### 4.2 Exploración física — combos (Corte 2)

| Campo AMI (`ExploracionFisicaSchema`) | Label | Opciones (de ZIN) |
|---|---|---|
| `arco_de_movilidad` | ARCO DE MOVILIDAD | `Presentes y normales, Limitados, Ausentes` |
| `tono_muscular` | TONO MUSCULAR | `Normal, Hipotrofia, Hipertrofia` |
| `coordinacion` | COORDINACION | `Normal, Alterada` |
| `test_adam` | TEST DE ADAM | `Negativo, Positivo` |
| `presencia_quiste_sinovial` | PRESENCIA QUISTE | `Normal, Disminuida, Disminuida Corregida, Ausente` |
| `test_romberg` | TEST ROMBERG | `Negativo, Positivo Bilateral, Positivo Derecho, Positivo Izquierdo` |
| `signo_bragard` | SIGNO BRAGGARD | `Negativo, Positivo` |
| `prueba_finkelstein` | PRUEBA FINKE | `Negativo, Positivo Bilateral, Positivo Derecho, Positivo Izquierdo` |
| `signo_tinel` | SIGNO TINEL | `Negativo, Positivo Bilateral, Positivo Derecho, Positivo Izquierdo` |
| `prueba_phanel` | PRUEBA PHANEL | `Negativo, Positivo Bilateral, Positivo Derecho, Positivo Izquierdo` |
| `prueba_lasegue` | PRUEBA LASEGUE | `Negativo, Positivo Bilateral, Positivo Derecho, Positivo Izquierdo` |
| `circulacion_venosa` | CIRCULACIÓN VENOSA | `C0: SIN SIGNOS VISIBLES NI PALPABLES, C1: TELANGIECTASIAS O VENAS RETICULARES, C2: VARICES, C3: EDEMA, C4: TRASTORNOS TRÓFICOS, C5: ULCERA CURADA, C6: ULCERA ACTIVA` |
| `boca_estado` (asociado a `ddlEFBoca` ZIN) | SALUD BUCAL | `CARIES, SARRO, CARIES Y SARRO, SIN DATOS` |
| `estado_nutricional` (de `ImpresiónAptitudSchema`) | ESTADO NUTRICIONAL | `Bajo peso, Normal, Sobrepeso, Obesidad` |

### 4.3 Exploración física — plantillas prellenadas (Corte 2)

Literales EXACTOS extraídos del `NOTA MEDICA EJEMPLO.pdf` (ver `Analisis_ZIN_Formulario_ExamenGeneral.md` §B). Van como `defaultValue` del input — el médico puede editar:

| Campo AMI | Literal ZIN (defaultValue) |
|---|---|
| `neurologico` | `Alerta, orientado en tiempo, lugar y persona. Cooperador.` |
| `cabeza` | `Cráneo normocéfalo, sin hundimientos ni exostosis.` |
| `piel_y_faneras` | `Sin datos de palidez, ictericia o cianosis.` |
| `oidos_cad` | `Permeable, MT íntegra, cono luminoso permeable.` |
| `oidos_cai` | `Permeable, MT íntegra, cono luminoso permeable.` |
| `ojos` | `Pupilas isocóricas, normorrefléxicas.` |
| `nariz` | `Alineada, septum alineado.` |
| `faringe` | `Sin datos patológicos.` |
| `cuello` | `Cilíndrico, tráquea central.` |
| `torax` | `Mesomórfico, movimientos de amplexión y amplexación normales.` |
| `corazon` | `Ruidos cardíacos rítmicos, sin soplos.` |
| `campos_pulmonares` | `Bien ventilados, sin ruidos agregados.` |
| `abdomen` | `Globoso, blando, depresible, sin dolor.` |
| `genitourinario` | `Giordano negativo bilateral.` |
| `columna_vertebral` | `Clínicamente alineada.` |
| `ms_superiores` | `Íntegros, fuerza y sensibilidad conservada.` |
| `ms_inferiores` | `Íntegros, sensibilidad conservada.` |

### 4.4 Heredo-familiares (Corte 2)

`AntecedentesCaptura.tsx:406-429` itera `HEREDOFAMILIARES_DESCRIPCIONES` con inputs `type="text"` y placeholder `"Relación familiar (ej: PADRE)"`. Conversión a `<select>`:

| Campo AMI | Opciones ZIN |
|---|---|
| `diabetes`, `has`, `epilepsia`, `cardiopatia`, `renales`, `asma`, `cancer` (7 campos) | `NEGADOS, PADRE, MADRE, AMBOS, HERMANOS, AB PATERNO, AB MATERNO, OTROS` |
| `mentales` | `NEGADO, SI, NO APLICA` |
| `otras` | Texto libre condicional: solo se muestra si el campo "otras" del heredo está en `OTROS` |

### 4.5 Patológicos — "Especifique" condicional (Corte 2)

`AntecedentesCaptura.tsx:539-553` ya usa `<select>` SI/NEGADO para cada patológico. Falta: cuando el valor es `SI`, mostrar input `especifique_<campo>` con label "Especifique" (patrón acordeón de `txtAPEspecificacion` ZIN).

Implementación: agregar a `PATOLOGICOS_DESCRIPCIONES` una lista paralela `PATOLOGICOS_ESPECIFIQUE_KEYS` y, en el render, mostrar input condicional `value === 'SI'`.

---

## 5. Plan de commits granulares

Frank pidió commits por componente para rollback individual. Plan:

### Corte 1 (5 commits)

| Commit | Archivo | Mensaje |
|---|---|---|
| 1 | `exam.schema.ts` | `feat(clinical): add ZIN enum constants + tolerant z.string().refine() for visual acuity (ARCH-20260817-01 corte 1)` |
| 2 | `AgudezaVisualStudy.tsx` | `feat(clinical/studies): replace 8 text inputs + 3 complementary with ZIN selects in AgudezaVisualStudy (ARCH-20260817-01 corte 1)` |
| 3 | `ExamenMedicoEstudio.tsx` (sección agudeza) | `feat(clinical): replace agudeza visual text inputs with ZIN selects in ExamenMedicoEstudio (ARCH-20260817-01 corte 1)` |
| 4 | `demo-data.ts` + `demo-types.ts` | `chore(demo): align demo snapshots with new visual acuity enum (ARCH-20260817-01 corte 1)` |
| 5 | `medical-exam.actions.test.ts` | `test(clinical): add cases for legacy + enum + out-of-enum values (ARCH-20260817-01 corte 1)` |

### Corte 2 (6-7 commits)

| Commit | Archivo | Mensaje |
|---|---|---|
| 6 | `exam.schema.ts` | `feat(clinical): add ZIN constants for physical exam combos + plantilla literals (ARCH-20260817-01 corte 2)` |
| 7 | `ExamenMedicoEstudio.tsx` (sección exploración — combos) | `feat(clinical): replace 9 physical-exam text inputs with ZIN selects (ARCH-20260817-01 corte 2)` |
| 8 | `ExamenMedicoEstudio.tsx` (sección exploración — plantillas) | `feat(clinical): prefill 16 physical-exam inputs with ZIN plantilla literals (ARCH-20260817-01 corte 2)` |
| 9 | `ExamenMedicoEstudio.tsx` (numéricos con step) | `feat(clinical): convert vitals/somatometria text inputs to type=number with step/min/max (ARCH-20260817-01 corte 2)` |
| 10 | `AntecedentesCaptura.tsx` (heredo) | `feat(clinical): replace 9 heredo-familiares text inputs with ZIN selects (ARCH-20260817-01 corte 2)` |
| 11 | `AntecedentesCaptura.tsx` (patológicos) | `feat(clinical): add conditional "Especifique" input to patológicos SI (ARCH-20260817-01 corte 2)` |
| 12 | Tests | `test(clinical): add integration tests for ZIN-combos migration (ARCH-20260817-01 corte 2)` |

**Total:** 11-12 commits. Cada uno reversible en isolation.

---

## 6. Criterios de aceptación verificables

### 6.1 Gates automáticos (todos deben pasar)

- `pnpm typecheck` (desde `frontend/`) → 0 errores.
- `pnpm test --run` (desde `frontend/`) → todos los tests pasan (incluyendo los nuevos).
- `pnpm lint` (desde `frontend/`) → 0 errores nuevos introducidos por este cambio.

### 6.2 Validaciones funcionales (Corte 1)

- `AgudezaVisualStudy.tsx`: los 8 selects de visión renderizan con opciones `20/200, 20/100, 20/70, 20/50, 20/40, 20/30, 20/25, 20/20, 20/15, 20/10` (verificar con Playwright snapshot).
- `AgudezaVisualStudy.tsx`: el select de Reflejos tiene default `PRESENTES Y NORMOREFLECTICOS` y 4 opciones.
- `AgudezaVisualStudy.tsx`: el select de Campimetría tiene 4 opciones (las listadas en §4.1).
- `AgudezaVisualStudy.tsx`: el select de Ishihara tiene 3 opciones.
- `ExamenMedicoEstudio.tsx` (pestaña 3 interna): mismo comportamiento que `AgudezaVisualStudy`.
- Registros legacy en BD con strings arbitrarios en `vision_lejana_od` cargan sin error en el form (validación manual con snapshot preexistente o test).

### 6.3 Validaciones funcionales (Corte 2)

- `ExamenMedicoEstudio.tsx` (sub-tab exploración): 9 selects renderizan con opciones ZIN (ver §4.2).
- `ExamenMedicoEstudio.tsx`: 16 inputs de exploración física tienen `defaultValue` con el literal ZIN exacto (ver §4.3).
- `ExamenMedicoEstudio.tsx`: inputs numéricos tienen `type="number"` + `step`/`min`/`max`.
- `AntecedentesCaptura.tsx`: 9 selects de heredo-familiares con opciones ZIN (ver §4.4).
- `AntecedentesCaptura.tsx`: cuando un patológico se marca "SÍ", aparece input "Especifique" condicional.
- Backend `prediagnostic.py` sigue parseando `vision_lejana_od/oi` correctamente (formato Snellen compatible — verificación manual con curl al endpoint IA).

### 6.4 Validación E2E (Corte 2 completo)

- **Playwright E2E:** flujo clínico completo cita → check-in → papeleta → examen (agudeza visual + exploración + antecedentes) → submit → respuesta IA → dictamen. Debe completarse sin errores HTTP 4xx/5xx.
- Criterio: captura con todos los campos del nuevo enum devuelve `aiWarning` vacío y `success=true` en `saveExamenMedicoPapeleta`.

---

## 7. Handoff a SOFIA

Ver handoff estructurado en `context/interconsultas/HANDOFF_ARCH-20260817-01_SOFIA_COMBOS-ZIN-MIGRATION.md`.

**Orden de implementación:**
1. Cortar baseline (verificar `4f561b7` verde).
2. Ejecutar Corte 1 completo (5 commits).
3. Validación funcional Corte 1 (gates + Playwright).
4. Pausa para OK Frank (opcional — Frank puede aprobar continuar directo a Corte 2).
5. Ejecutar Corte 2 completo (6-7 commits).
6. Validación funcional Corte 2 (gates + Playwright E2E).
7. GEMINI auditoría.
8. Reporte final a INTEGRA.

**Restricciones de handoff:**
- SOFIA NO commitea/pushea sin OK explícito de Frank.
- SOFIA NO toca `prisma/schema.prisma`.
- SOFIA NO toca `prediagnostic.py` (verificación visual solo).
- SOFIA NO toca `TriageForm.tsx` ni `DoctorExamForm.tsx` (legacy muertos).
- SOFIA ejecuta gates después de cada commit (no solo al final).
- SOFIA usa `task` tool con `subagent_type='gemini'` como segunda mano de validación antes de reportar "listo".

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Registros legacy con strings arbitrarios rompen la carga del form | Media | Alto | `z.string().refine()` tolerante (D1) — no rompe nada. |
| `ExamenMedicoEstudio.tsx` tiene 1222 líneas, tocarlo puede introducir bug visual | Media | Medio | Commits granulares por sección (D2); Playwright snapshot pre/post. |
| Literales ZIN no coinciden con lo que Jaqueline/Erika esperan | Baja | Bajo | D3: confirmación paralela con Jaqueline durante implementación; ajuste en commit posterior. |
| `prediagnostic.py` cambia en paralelo por otra SPEC y rompe compatibilidad Snellen | Baja | Alto | Ninguna acción requerida — la SPEC ARCH-20260809-03 (API Keys IA) no toca el prompt clínico. Monitorear. |
| Duplicación de campos visuales en 2 componentes activos (`AgudezaVisualStudy` + `ExamenMedicoEstudio`) introduce divergencia | Media | Medio | Commits 2 y 3 se hacen en secuencia, mismo enum subyacente. Deuda técnica: extraer `<VisualAcuityField>` reutilizable en SPEC futura (no esta). |

---

## 9. Definición de Done (DoD)

- [ ] Los 11-12 commits de esta SPEC están en `main` (tras OK Frank + revisión GEMINI).
- [ ] `pnpm typecheck` → 0 errores.
- [ ] `pnpm test --run` → todos pasan.
- [ ] `pnpm lint` → 0 errores nuevos.
- [ ] Playwright E2E del flujo clínico completo pasa.
- [ ] Snapshot visual de los 3 componentes (`AgudezaVisualStudy`, `ExamenMedicoEstudio` secciones agudeza + exploración, `AntecedentesCaptura` secciones heredo + patológicos) coincide con opciones ZIN.
- [ ] Backend `prediagnostic.py` sigue retornando prediagnóstico válido con captura que usa los nuevos enums.
- [ ] GEMINI audit aprobado (con o sin observaciones, sin bloqueadores).
- [ ] PROYECTO.md actualizado por CRONISTA con estado DONE y referencia a esta SPEC.
- [ ] Publicación a producción sigue pendiente y requiere permiso separado (NO incluido en esta SPEC).

---

## 10. Referencias

- Discovery juntas: `context/Juntas/Revision_AMI_10082026_puntos.md` (junta 10/ago, 73 min).
- Análisis curl ZIN: `context/datos AMI/informacion para revision/Analisis_ZIN_Formulario_ExamenGeneral.md` (95 inputs + 57 selects).
- Schema Zod actual: `frontend/src/schemas/clinical/exam.schema.ts:45-157`.
- Componente AgudezaVisualStudy actual: `frontend/src/components/clinical/studies/AgudezaVisualStudy.tsx:1-172`.
- Componente ExamenMedicoEstudio: `frontend/src/components/clinical/ExamenMedicoEstudio.tsx:38-143` (constantes), `:248-261` (estado agudeza), `:1020` (render EXPLORACION_FIELDS).
- Componente AntecedentesCaptura: `frontend/src/components/clinical/AntecedentesCaptura.tsx:406-429` (heredo), `:539-553` (patológicos).
- Backend IA: `backend/app/services/ai/prediagnostic.py:160, 197, 214, 253, 504, 507, 518, 520, 525`.
- ADR asociado: `context/decisions/ADR-20260817-01-COMBOS-ZIN-MIGRATION.md`.
- Handoff SOFIA: `context/interconsultas/HANDOFF_ARCH-20260817-01_SOFIA_COMBOS-ZIN-MIGRATION.md`.

---

**Firmado:** INTEGRA — 2026-08-17 CST
**Espera:** OK explícito de Frank para delegar a SOFIA (Corte 1 primero).
