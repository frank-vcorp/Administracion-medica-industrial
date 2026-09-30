# ADR-20260817-01 — Combos ZIN Migration — Decisiones arquitectónicas

**Estado:** ACEPTADO (espera OK Frank para activar implementación)
**Fecha:** 2026-08-17 (CST)
**Autor:** INTEGRA (sobre glm-5.2)
**SPEC asociada:** `context/SPECs/SPEC_ARCH-20260817-01-COMBOS-ZIN-MIGRATION.md`
**Contexto previo:** Handoff ATLAS M3 con análisis curl del ZIN (`Analisis_ZIN_Formulario_ExamenGeneral.md`).

---

## Contexto

El sistema AMI tiene actualmente **95 inputs de texto libre** en el formulario de Examen Médico que deberían ser selects con opciones controladas. Esto produce:

1. **Errores de dedo del médico** (los valores varían en cada captura).
2. **Inconsistencia en BD** (mismo concepto capturado con strings distintos).
3. **Dificultad para que la IA extraiga patrones** (los enum son mucho más fáciles de interpretar que texto libre).

El sistema ZIN (legacy en `https://devcami.azurewebsites.net/Examenes/ExamenGral.aspx`) ya tiene implementados **57 selects** con las opciones clínicamente correctas. La junta AMI del 10/ago (Frank, Erika, Jaqueline, Leticia, Alan) consensuó adoptar los literales y patrones del ZIN ("lo copia igualito").

ATLAS M3 entregó análisis curl autenticado con clasificación de los 95 inputs en:
- 30 numéricos → convertir a `type="number"`.
- 28 candidatos a `<select>` (con opciones ZIN identificadas).
- 7 patrones acordeón "Sí/No + Especifique".
- 16 plantillas prellenadas (literales extraídos del `NOTA MEDICA EJEMPLO.pdf`).
- 17 texto libre legítimo (datos personales, historia laboral) → mantener.

---

## Decisión

### DA-1 — Compatibilidad legacy: Opción A (`z.string().refine()` tolerante)

**Estado:** ACEPTADO

**Opciones evaluadas:**

| Opción | Descripción | Pros | Contras |
|---|---|---|---|
| **A (elegida)** | `z.string().refine(v => v === '' \|\| ENUM.includes(v) \|\| v == null)` | Sin migración de datos; registros legacy cargan sin error; captura nueva restringe a enum | Tolerante — permite strings arbitrarios en legacy (poco limpio pero reversible) |
| B | `z.enum([...])` estricto | Mayor consistencia; rechaza strings fuera de enum | Requiere migración de datos legacy; rompe registros existentes en BD; costo alto sin beneficio clínico |
| C | Campo nuevo `vision_lejana_od_v2: enum` + preservar `vision_lejana_od: string` | Coexistencia limpia legacy/nuevo | Duplica superficie de campos; ambigüedad en cuál leer; costo de migración de código sin beneficio claro |

**Decisión:** Opción A.

**Justificación:**
- Frank fijó explícitamente en el handoff: **"Sin migración de datos (Opción A default)"**. Restricción anula toda evaluación adicional.
- Opción B descartada por restricción de Frank.
- Opción C descartada por sobre-ingeniería (duplicación sin beneficio).
- `z.string().refine()` cumple: registros legacy string-libre cargan; captura nueva solo acepta enum; validación server-side rechaza solo strings maliciosos.

**Implementación:** ver `SPEC_ARCH-20260817-01` §2.1 y §3.

### DA-2 — División en 2 cortes con commits granulares por archivo

**Estado:** ACEPTADO

**Decisión:** Dos cortes secuenciales. Cada archivo modificable genera su propio commit para permitir rollback individual.

**Justificación:**
- Frank pidió explícitamente: **"commits granulares por componente para permitir rollback individual si algo falla"**.
- Corte 1 (Agudeza Visual, ~6h) es independiente y permite validar el patrón antes de extenderlo.
- Corte 2 (Exploración + Antecedentes, ~17h) reutiliza los patrones definidos en Corte 1.
- 11-12 commits totales, todos reversibles en isolation.

### DA-3 — Plantillas ZIN literales exactas (sin paráfrasis)

**Estado:** ACEPTADO

**Decisión:** Los 16 literales de plantilla de exploración física se copian **exactamente** del `NOTA MEDICA EJEMPLO.pdf` (ya extraídos en `Analisis_ZIN_Formulario_ExamenGeneral.md` §B). Sin paráfrasis, sin normalización de mayúsculas, sin "mejoras" de redacción.

**Justificación:**
- Frank explícito: **"Lo copia igualito que el ZIN"**.
- Erika confirmó: **"Sí tal cual"**.
- Cualquier "mejora" introduciría divergencia con el ZIN, que es justo lo que se quiere evitar.

**Implementación:** los 16 literales van como `defaultValue` del input (texto libre sigue siendo editable; el médico puede desviarse si el caso lo requiere). Van como constantes exportadas desde `exam.schema.ts` o un archivo adyacente `plantillas-zin.ts`.

**Validación con stakeholder:** Jaqueline/Erika pueden confirmar los literales durante implementación de SOFIA. La fuente canónica es el `NOTA MEDICA EJEMPLO.pdf` ya analizado por ATLAS. Si se detecta discrepancia, ajuste en commit posterior (no bloquea SPEC).

### DA-4 — Numéricos a `type="number"` con step/min/max

**Estado:** ACEPTADO

**Decisión:** Los 30 numéricos (signos vitales, somatometría) se convierten de `type="text"` a `type="number"` con atributos `step`, `min`, `max` apropiados por campo.

**Justificación:**
- Mejora UX: teclado numérico móvil, validación nativa del navegador.
- El schema Zod ya usa `z.coerce.number()` (`exam.schema.ts:5`) para estos campos — el cambio es solo de UI.
- Incluido en Corte 2 (no en Corte 1).

### DA-5 — Acordeón con `useState` local (sin contexto global)

**Estado:** ACEPTADO

**Decisión:** El patrón acordeón ZIN ("Sí/No + Especifique") se implementa con `useState` local + render condicional, reutilizando el patrón **ya existente** en `AntecedentesCaptura.tsx:438-518` (No Patológicos con botones SI/NEGADO + sub-campos condicionales).

**Justificación:**
- No introduce nueva dependencia ni contexto global.
- El estado del acordeón se propaga al padre vía `onChange` (componente controlado).
- Patrón ya probado en el codebase actual — reutilización, no invención.

### DA-6 — Duplicación temporal de campos visuales en 2 componentes (deuda técnica explícita)

**Estado:** ACEPTADO (con deuda técnica registrada)

**Contexto:** Descubierto durante SPEC: hay **dos componentes activos** que renderizan los 8 campos visuales:
- `frontend/src/components/clinical/studies/AgudezaVisualStudy.tsx` (estudio standalone, importado por `PapeletaWorkspace.tsx:38`).
- `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` (pestaña 3 interna, estado `agudezaForm` en `:248-261`).

(`TriageForm.tsx` y `DoctorExamForm.tsx` también los tenían, pero ya no se importan en ningún componente activo — legacy muerto.)

**Decisión:** Tocar ambos componentes con el mismo patrón en commits separados (commits 2 y 3 del Corte 1). NO extraer componente `<VisualAcuityField>` reutilizable en esta SPEC.

**Justificación:**
- Frank pidió commits granulares por componente → tocar cada archivo por separado.
- Refactor extractivo (extraer `<VisualAcuityField>`) es más limpio pero introduce riesgo de bug en los 2 sitios a la vez y NO es rollback-friendly.
- Deuda técnica explícita: abrir SPEC futura `ARCH-YYYYMMDD-NN-VISUAL-ACUITY-FIELD-EXTRACTION` para extraer el componente una vez que los 2 sitios estén alineados y estables.

**Deuda técnica registrada para SPEC futura:**
- Mover los 8 selects a `<VisualAcuityField name=... label=... />` reutilizable.
- Migrar `AgudezaVisualStudy.tsx` y `ExamenMedicoEstudio.tsx` para usar el componente.
- Eliminar duplicación de constantes `VISUAL_FIELDS`.

---

## Implicaciones

### Positivas

- Reducción significativa de errores de dedo del médico.
- Mayor consistencia de captura entre sucursales/médicos.
- Backend `prediagnostic.py` ya maneja formato Snellen (20/20, 20/15, etc.) → sin cambio backend.
- Sin migración de datos → sin riesgo de pérdida de información histórica.
- Commits granulares permiten rollback individual si se detecta bug en producción.

### Negativas

- Duplicación temporal de campos visuales en 2 componentes (DA-6 — deuda técnica).
- Tres componentes legacy (`TriageForm`, `DoctorExamForm`) quedan sin actualizar — pero están muertos (no se importan). Eliminarlos es SPEC de limpieza futura.
- Literales ZIN se copian sin "mejora" — algunos médicos podrían quererlos más cortos, pero la consistencia con ZIN es prioridad.

### Riesgos

- Ver `SPEC_ARCH-20260817-01` §8 (tabla de riesgos).

---

## Mitigación

- Cada commit se valida con gates (`pnpm typecheck && pnpm test --run && pnpm lint`).
- Playwright E2E del flujo clínico completo antes de declarar DONE.
- SOFIA usa `task` tool con `subagent_type='gemini'` como segunda mano de validación (Qodo está sunset).
- INTEGRA no delega a SOFIA sin OK explícito de Frank para el Corte 1.
- SOFIA no commitea/pushea sin OK explícito de Frank.

---

## Referencias

- Handoff ATLAS M3 (origen): turno 2026-08-17, análisis curl ZIN autenticado.
- SPEC asociada: `context/SPECs/SPEC_ARCH-20260817-01-COMBOS-ZIN-MIGRATION.md`.
- Discovery juntas: `context/Juntas/Revision_AMI_10082026_puntos.md` (junta 10/ago).
- Análisis curl ZIN: `context/datos AMI/informacion para revision/Analisis_ZIN_Formulario_ExamenGeneral.md`.
- Schema Zod actual: `frontend/src/schemas/clinical/exam.schema.ts`.
- Backend IA: `backend/app/services/ai/prediagnostic.py:160, 504-525` (formato Snellen).

---

**Decisiones registradas:** DA-1, DA-2, DA-3, DA-4, DA-5, DA-6.
**Estado global:** ACEPTADO. Espera OK Frank para activar implementación vía SOFIA.
