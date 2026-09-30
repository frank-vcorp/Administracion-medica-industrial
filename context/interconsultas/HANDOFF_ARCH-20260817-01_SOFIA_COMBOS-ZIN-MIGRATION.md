# Handoff a SOFIA — ARCH-20260817-01 — Combos ZIN Migration

**De:** INTEGRA (sobre glm-5.2)
**Para:** SOFIA (subagent_type='sofia')
**Fecha:** 2026-08-17 CST
**SPEC asociada:** `context/SPECs/SPEC_ARCH-20260817-01-COMBOS-ZIN-MIGRATION.md`
**ADR asociado:** `context/decisions/ADR-20260817-01-COMBOS-ZIN-MIGRATION.md`

---

## 1. Resumen ejecutivo

Adoptar los `<select>` y plantillas del ZIN (sistema legacy) en AMI para reducir errores de dedo del médico. **Dos cortes secuenciales, 11-12 commits granulares** por archivo (Frank pidió rollback individual). **Sin migración de datos** (Opción A: `z.string().refine()` tolerante). **Sin tocar Prisma ni backend IA.**

---

## 2. Alcance

**Corte 1 — Agudeza Visual (~6h):** 5 commits, 5 archivos.
- 8 inputs `type="text"` de visión → 8 `<select>` con opciones ZIN (10 opciones cada uno: `20/200, 20/100, 20/70, 20/50, 20/40, 20/30, 20/25, 20/20, 20/15, 20/10`).
- 3 inputs complementarios (reflejos, campimetria, test_ishihara) → 3 `<select>` con opciones ZIN.
- Schema Zod: `z.string().refine()` tolerante.
- Tests: acepta legacy + enum + rechaza fuera-de-enum.

**Corte 2 — Exploración Física + Antecedentes (~17h):** 6-7 commits, ~9 archivos.
- 9 inputs de exploración física → 9 `<select>` con opciones ZIN.
- 16 inputs de exploración física con `defaultValue` = plantilla ZIN literal exacta (texto libre sigue editable).
- 6+ inputs `type="text"` → `type="number"` con step/min/max (signos vitales, somatometría).
- 9 inputs de heredo-familiares → 9 `<select>` con opciones ZIN (7 con `NEGADOS/PADRE/MADRE/AMBOS/HERMANOS/AB PATERNO/AB MATERNO/OTROS`, 1 con `NEGADO/SI/NO APLICA`, 1 texto condicional).
- Patológicos: agregar input "Especifique" condicional cuando se marca "SÍ".

**Ver `SPEC_ARCH-20260817-01` §3 y §4 para mapeo exacto campo AMI ↔ select ZIN ↔ opciones.**

---

## 3. Restricciones

- **NO commitear/pushear sin OK explícito de Frank.** Prepara commits pero espera OK.
- **NO tocar `prisma/schema.prisma`.**
- **NO tocar `backend/app/services/ai/prediagnostic.py`.** Solo verificación visual.
- **NO tocar `TriageForm.tsx` ni `DoctorExamForm.tsx`** (legacy muertos — 0 imports activos, verificado por INTEGRA).
- **NO ejecutar acción destructiva** (rollback, delete, force-push) sin OK Frank.
- **Ejecutar gates después de CADA commit** (no solo al final): `pnpm typecheck && pnpm test --run && pnpm lint` desde `frontend/`.
- **Usar `task` tool con `subagent_type='gemini'`** como segunda mano de validación antes de reportar "listo" (Qodo está sunset).
- **Usar formato de commit canónico** de la SPEC §5.

---

## 4. Archivos a tocar (con referencias exactas)

### 4.1 Corte 1

| Archivo | Líneas relevantes | Acción |
|---|---|---|
| `frontend/src/schemas/clinical/exam.schema.ts` | `:45-57` (`AgudezaVisualSchema`) | Agregar constantes enum + `z.string().refine()` para 11 campos. |
| `frontend/src/components/clinical/studies/AgudezaVisualStudy.tsx` | `:15-24` (`VISUAL_FIELDS`), `:45-47` (defaults), `:88-101` (render 8 inputs), `:107-138` (render 3 complementarios) | Reemplazar 8 inputs + 3 inputs por selects con opciones ZIN. |
| `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` | `:64-73` (`VISUAL_FIELDS`), `:248-261` (estado `agudezaForm`), pestaña 3 interna render | Mismo cambio que `AgudezaVisualStudy`. |
| `frontend/src/lib/demo/demo-data.ts` + `demo-types.ts` | `:21,77,136,191,247,302,351,407,463,513` (`campimetria:` en snapshots demo) | Verificar si el demo renderiza los selects — si sí, actualizar valores a enum. Si `DemoCampimetria` es estructura separada (lo es), probablemente sin cambios. |
| `frontend/src/actions/__tests__/medical-exam.actions.test.ts` | (agregar casos) | Tests: legacy string + enum value + out-of-enum string. |

### 4.2 Corte 2

| Archivo | Líneas relevantes | Acción |
|---|---|---|
| `frontend/src/schemas/clinical/exam.schema.ts` | `:62-97` (`ExploracionFisicaSchema`) | Constantes para 9 selects + 16 literales plantilla + `z.string().refine()` para 9 campos. |
| `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` | `:108-143` (`EXPLORACION_FIELDS`), `:1020-1035` (render iterativo) | 9 inputs → 9 selects; 16 inputs con `defaultValue={PLANTILLAS[field]}`; ~6 inputs `type="text"` → `type="number"` con step/min/max. |
| `frontend/src/components/clinical/AntecedentesCaptura.tsx` | `:406-429` (heredo-familiares), `:539-553` (patológicos) | 9 inputs heredo → 9 selects; agregar input "Especifique" condicional a patológicos cuando value === 'SI'. |
| `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` | (verificar) | Verificar que el renderer sigue funcionando con valores enum (sin cambios si los campos son string). |
| `frontend/src/components/clinical/PapeletaWorkspace.tsx` | `:1105` (`<ExamenMedicoEstudio>`) | Verificar props pasadas — probablemente sin cambios. |
| `frontend/src/lib/demo/pdf-generator.tsx` + `xlsx-generator.ts` | `:130` (pdf `agudezaVisual: w.campimetria.agudezaVisual`) | Verificar render con nuevos valores. |
| `frontend/src/actions/medical-exam.actions.ts` | (verificar) | Validación server-side ya está en schema — verificar que el action no rechaza legacy. |

---

## 5. Mapeo campo AMI → opciones ZIN (canónico)

**Ver `SPEC_ARCH-20260817-01` §4 para tabla completa.** Resumen ejecutivo:

### 5.1 Agudeza visual (Corte 1)

- 8 campos de visión → 10 opciones cada uno: `20/200, 20/100, 20/70, 20/50, 20/40, 20/30, 20/25, 20/20, 20/15, 20/10`.
- `reflejos` (default `PRESENTES Y NORMOREFLECTICOS`): 4 opciones — `PRESENTES Y NORMOREFLECTICOS, DISMINUIDOS, AUSENTES, NO APLICA`.
- `campimetria`: 4 opciones — `CAMPOS VISUALES DENTRO DE PARÁMETROS NORMALES, ALTERADOS, NO APLICA, VER ESTUDIO ANEXO`.
- `test_ishihara`: 3 opciones — `NORMAL (LEE 12,8,6,29,57,45), ALTERADO, NO APLICA`.

### 5.2 Exploración física — combos (Corte 2)

Ver SPEC §4.2 para 9 selects con opciones exactas.

### 5.3 Exploración física — plantillas (Corte 2)

Ver SPEC §4.3 para 16 literales exactos extraídos del `NOTA MEDICA EJEMPLO.pdf`. **Copia literal, sin paráfrasis** (Frank: "lo copia igualito").

### 5.4 Heredo-familiares (Corte 2)

- 7 campos (`diabetes`, `has`, `epilepsia`, `cardiopatia`, `renales`, `asma`, `cancer`): 8 opciones — `NEGADOS, PADRE, MADRE, AMBOS, HERMANOS, AB PATERNO, AB MATERNO, OTROS`.
- `mentales`: 3 opciones — `NEGADO, SI, NO APLICA`.
- `otras`: texto condicional cuando otra sección heredo está en `OTROS`.

### 5.5 Patológicos — acordeón (Corte 2)

`AntecedentesCaptura.tsx:539-553` ya usa `<select>` SI/NEGADO. Falta: cuando value === 'SI', mostrar input `especifique_<campo>` con label "Especifique".

---

## 6. Plan de ejecución

1. **Preflight:** verificar baseline `4f561b7` verde. Si el sandbox falla con error `-122` (filesystem del entorno), reportar a INTEGRA y proceder asumiendo que el código está verde en el último commit.
2. **Corte 1 completo:**
   - Commit 1: `exam.schema.ts` (constantes enum + refine).
   - Commit 2: `AgudezaVisualStudy.tsx` (8+3 selects).
   - Commit 3: `ExamenMedicoEstudio.tsx` sección agudeza (8+3 selects).
   - Commit 4: `demo-data.ts` + `demo-types.ts` (verificar).
   - Commit 5: `medical-exam.actions.test.ts` (tests).
   - Gates después de cada commit.
   - Playwright snapshot visual de los 2 componentes.
   - Reportar a INTEGRA: "Corte 1 listo, gates verdes".
3. **Pausa OK Frank** (opcional, INTEGRA puede aprobar continuar a Corte 2 si todo verde).
4. **Corte 2 completo:**
   - Commit 6: `exam.schema.ts` (constantes exploración + plantillas).
   - Commit 7: `ExamenMedicoEstudio.tsx` sección exploración (9 selects).
   - Commit 8: `ExamenMedicoEstudio.tsx` sección exploración (16 plantillas prellenadas).
   - Commit 9: `ExamenMedicoEstudio.tsx` (numéricos con step/min/max).
   - Commit 10: `AntecedentesCaptura.tsx` heredo (9 selects).
   - Commit 11: `AntecedentesCaptura.tsx` patológicos (Especifique condicional).
   - Commit 12: tests integración.
   - Gates después de cada commit.
   - Playwright E2E flujo clínico completo.
5. **GEMINI auditoría:** invocar vía `task` con `subagent_type='gemini'` con el handoff del cambio completo.
6. **Reporte final a INTEGRA** con:
   - Lista de commits realizados.
   - Resultado de gates después de cada commit.
   - Snapshot visual pre/post de los componentes.
   - Evidencia de que el backend `prediagnostic.py` sigue funcionando (curl al endpoint IA o test que ejercite el flujo).
   - Riesgos o desviaciones detectadas.

---

## 7. Validaciones obligatorias antes de cerrar

1. `pnpm typecheck` (desde `frontend/`) → 0 errores.
2. `pnpm test --run` (desde `frontend/`) → todos los tests pasan (incluyendo los nuevos).
3. `pnpm lint` (desde `frontend/`) → 0 errores nuevos introducidos.
4. Playwright snapshot visual pre/post de los 3 componentes (`AgudezaVisualStudy`, `ExamenMedicoEstudio` secciones agudeza + exploración, `AntecedentesCaptura` secciones heredo + patológicos).
5. Playwright E2E del flujo clínico completo: cita → check-in → papeleta → examen → IA → revisión → dictamen.
6. Backend `prediagnostic.py` sigue retornando prediagnóstico válido con captura que usa los nuevos enums (verificar con curl al endpoint IA o test).

---

## 8. Self-review manual antes de reportar "listo" (Qodo está sunset)

Responde en el reporte final:

- ¿El código refleja la SPEC (`SPEC_ARCH-20260817-01`)?
- ¿Hay code smells evidentes (duplicación, mutaciones inseguras, tipos `any` innecesarios)?
- ¿Los tests cubren los edge cases listados en la SPEC §6?
- ¿Algún riesgo de regresión en el flujo clínico end-to-end?
- ¿Los 16 literales plantilla coinciden exactamente con `SPEC §4.3` (sin paráfrasis)?
- ¿Los 11-12 commits están aislados por archivo/área (rollback-friendly)?

---

## 9. Escalamiento a INTEGRA

- Si el sandbox falla con error `-122` (filesystem), reportar a INTEGRA y continuar asumiendo baseline verde.
- Si 2 intentos no resuelven un bug técnico, invocar `task` con `subagent_type='debugger'` (DEBY) con contexto completo.
- Si una decisión de producto/contrato no está cubierta por esta SPEC, pausar y reportar a INTEGRA (no improvisar).
- Si la duplicación de campos visuales en `AgudezaVisualStudy` + `ExamenMedicoEstudio` introduce divergencia que no se puede resolver con el mismo enum subyacente, pausar y reportar a INTEGRA (deuda técnica DA-6).

---

## 10. Referencias

- SPEC: `context/SPECs/SPEC_ARCH-20260817-01-COMBOS-ZIN-MIGRATION.md`
- ADR: `context/decisions/ADR-20260817-01-COMBOS-ZIN-MIGRATION.md`
- Discovery juntas: `context/Juntas/Revision_AMI_10082026_puntos.md`
- Análisis curl ZIN: `context/datos AMI/informacion para revision/Analisis_ZIN_Formulario_ExamenGeneral.md`
- Schema Zod actual: `frontend/src/schemas/clinical/exam.schema.ts:45-157`
- Backend IA: `backend/app/services/ai/prediagnostic.py:160, 504-525`

---

**Handoff emitido por INTEGRA. Espera OK explícito de Frank para activar la delegación a SOFIA.**
