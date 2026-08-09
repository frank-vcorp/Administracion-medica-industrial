# SPEC: Outer-tab "Antecedentes" editable en Examen Médico (snapshot por cita)

**ID:** `ARCH-20260809-01`
**Padre:** `ARCH-20260326-04` (Historial Maestro + Examen Snapshot), `ARCH-20260324-04` (Examen Médico), `ARCH-20260326-06` (Historial Maestro Longitudinal)
**Estado:** READY (cumple DoR)
**Prioridad:** P1
**Modelo:** INTEGA Spark 1.1 (Spec) → SOFIA M3 (implementación) → GEMINI (auditoría)
**Fecha:** 2026-08-09

---

## 1. Contexto y Problema

En el workspace Events (`?view=IN_PROGRESS`), el estudio "Examen Médico" (`frontend/src/components/clinical/ExamenMedicoEstudio.tsx`) expone 4 outer-tabs: `somatometria`, `signos_vitales`, `agudeza_visual`, `examen_medico` (ver `ExamenMedicoEstudio.tsx:25,356-361`). La inner-tab "Módulo 1" dentro de "Examen Médico" (ver `ExamenMedicoEstudio.tsx:731-909`) **solo** contiene ginecológicos/inmunizaciones + nota libre del médico (`m1_gine_*`, `m1_vac_*`, `antecedentes_medico`).

**Hueco detectado:** las 5 secciones declarativas del paciente — `datos_personales`, `historia_laboral`, `heredo_familiares`, `no_patologicos`, `patologicos` — **no son editables** dentro del estudio Examen Médico. Solo se muestran como referencia readonly en un `<details>` colapsable (ver `ExamenMedicoEstudio.tsx:800-829`, `LONGITUDINAL_SECTIONS` en `:69-73` que solo enumera 3 de 5 secciones).

**Causa raíz del loader:** `event-page-data.ts:185-199` inyecta al `longitudinalData` solo `datos_personales`, `historia_laboral`, `heredo_familiares` desde `histData` raíz. **Faltan `no_patologicos` y `patologicos`** aunque sí existen en el historial maestro (confirmado: `ClinicalHistoryDataSchema` en `history.schema.ts:148-154` define las 5 secciones, y `AntecedentesForm.tsx:236-242` las persiste vía `upsertWorkerClinicalHistory`).

**Impacto operativo:** cuando el trabajador NO llena el portal (`/prefill/[token]`) o lo hace parcial, el médico debe preguntar todo desde cero y no tiene dónde registrarlo en la cita. Tampoco puede corregir/completar lo que el paciente sí llenó sin salir a `/history/[workerId]`.

---

## 2. Decisión del Usuario (aprobada)

**Opción A** (confirmada por Frank vía ATLAS): agregar una **nueva outer-tab "Antecedentes"** arriba, en paralelo a "Examen Médico", editable, que precargue lo que ya contestó el paciente. Restricciones explícitas:
- **No** es prerrequisito para la outer-tab "Examen Médico"; queda en paralelo (sin lock).
- Si el paciente llenó el portal, los valores aparecen **precargados y editables** por el médico.
- Las correcciones del médico se **persisten aparte** del historial longitudinal del paciente (**snapshot por cita**).

---

## 3. Decisión Arquitectónica y Justificación

Esta SPEC **concreta y aplica** la decisión canónica `ARCH-20260326-04` (precedencia §1: ADR activo prevalece) al componente `ExamenMedicoEstudio`. Ver ADR companion `context/decisions/ADR-20260809-01-ANTECEDENTES-SNAPSHOT-POR-CITA.md`.

### 3.1 Modelo de persistencia: snapshot por cita en `physicalExamData`

- **Nuevo sub-objeto** `antecedentes_captured` dentro de `physicalExamData` (campo `Json?` de `MedicalExam`, ver `prisma/schema.prisma:427`).
- **Shape:** `{ datos_personales?, historia_laboral?, heredo_familiares?, no_patologicos?, patologicos?, _provenance?: { source: 'portal' | 'longitudinal' | 'captured', updatedAt: ISO-string } }`.
- **NO requiere migración Prisma**: `physicalExamData` es `Json?` libre (confirmado en `schema.prisma:427`). Es aditivo y reversible.
- **NO sobrescribe** el historial maestro (`WorkerClinicalHistory`). Respeta `ARCH-20260326-04` §"Regla de Autoridad de Dato": el snapshot de la cita no redefine la historia maestra.
- Coexiste con los campos existentes de `physicalExamData` (`ExploracionFisicaSchema` + `ImpresiónAptitudSchema` + `modulo1` + `antecedentes_medico`), que **quedan intactos**.

### 3.2 Resolución de las 8 preguntas abiertas

| # | Pregunta | Decisión (con evidencia) | Confianza |
|---|---|---|---|
| 1 | ¿Migración Prisma? | **NO.** `physicalExamData` es `Json?` (ver `schema.prisma:427`). Sub-objeto `antecedentes_captured` es aditivo. | 95% |
| 2 | ¿Action nueva o `updateMedicalExam`? | **Action nueva** `saveAntecedentesCaptura(eventId, rawData)`. No reutilizar `saveExamenMedicoPapeleta` porque esa dispara IA prediagnóstico + cambia `EventTest.status` (ver `medical-exam.actions.ts:175-240`) — la outer-tab "Antecedentes" debe persistir autónoma sin forzar el flujo IA del examen. Hace **merge** (read-modify-write) sobre `physicalExamData` para no pisar Exploración/Impresión/Módulo1. | 90% |
| 3 | Visibilidad por rol | **Heredar `readonly` existente** (calculado en `page.tsx:186` como `currentStep > 3`, es decir, VALIDATING/COMPLETED). No añadir lógica de rol nueva. Cualquier rol con acceso a la papeleta ve la outer-tab; la editabilidad depende del estado del evento, no del rol. Consistente con el flujo actual. | 90% |
| 4 | Estado readonly tras cerrar | **Heredar `readonly` prop** existente (ver `ExamenMedicoEstudio.tsx:43,147`, propagado a todos los inputs via `disabled={readonly}`). Cuando `readonly=true`: inputs disabled + banner "Vista de solo lectura — expediente cerrado" (patrón existente en `:1110-1114`). | 95% |
| 5 | Refactor helper | **SÍ.** Extraer diccionarios canónicos de `AntecedentesForm.tsx` (`HEREDOFAMILIARES_DESCRIPCIONES`, `PATOLOGICOS_DESCRIPCIONES` con subgrupos, `NO_PATOLOGICOS_DESCRIPCIONES` con subs, y listas de campos de datos_personales/historia_laboral) a `frontend/src/lib/antecedentes-fields.ts`. Ambas pantallas importan el helper → evita drift entre las 5 secciones. Scope: **solo extracción + reimport**, no rediseño de UI. | 90% |
| 6 | Migración de data (loader) | **SÍ.** Extender `event-page-data.ts:185-199` para inyectar también `no_patologicos` y `patologicos` desde `histData` raíz en `longitudinalData`. Hoy faltan. | 95% |
| 7 | UI layout | Grid 3 columnas (DP / HL / HF) en desktop + filas para NP y P. Indicador visual de proveniencia: badge "📋 Del portal" (azul) para valores provenientes del portal/longitudinal; badge "✏️ Editado en consulta" (ámbar) cuando el médico modifica. Precarga editable. | 85% |
| 8 | Validaciones Zod | **Reusar `ClinicalHistoryDataSchema`** de `history.schema.ts:148-154` (ya define las 5 secciones con schemas canónicos). Definir `AntecedentesCapturaSchema` en `exam.schema.ts` como wrapper de `ClinicalHistoryDataSchema` + `_provenance`. No definir schemas nuevos. | 90% |

---

## 4. Modelo de Datos

### 4.1 Prisma (`MedicalExam`) — SIN cambios
Campo `physicalExamData Json? @default("{}")` ya existe (ver `prisma/schema.prisma:427`). No se modifica el schema. No hay migración.

### 4.2 Zod — extender `exam.schema.ts`

Definir (referencia, NO código de producción — SOFIA implementa):

```
AntecedentesCapturaSchema = ClinicalHistoryDataSchema.extend({
  _provenance: z.object({
    source: z.enum(['portal','longitudinal','captured','mixed']),
    updatedAt: z.string().datetime().optional(),
    capturedBy: z.string().optional(),
  }).optional()
})
```

Extender `ExamenMedicoCompletoSchema` (ver `exam.schema.ts:121-127`) con:
```
antecedentes_captured: AntecedentesCapturaSchema.optional()
```
- **Compatibilidad retroactiva:** campos `.optional()` garantizan que exámenes existentes (sin `antecedentes_captured`) sigan parseando.
- `antecedentes_medico` (string libre existente, `:124`) **se conserva** — es la nota resumen del médico, distinta del snapshot estructurado.

### 4.3 Tipos TypeScript
- `AntecedentesCaptura = z.infer<typeof AntecedentesCapturaSchema>`
- Actualizar `ExamData` en `ExamenMedicoEstudio.tsx:18-22` para tipar `physicalExamData.antecedentes_captured`.

---

## 5. Cambios en el loader (`event-page-data.ts`)

**Archivo:** `frontend/src/app/events/[id]/_lib/event-page-data.ts`

Modificar bloque `:175-199` para inyectar las 5 secciones:

- Añadir `no_patologicos` y `patologicos` a la desestructuración de `histData` raíz (mismo patrón que `rootDP`/`rootHL`/`rootHF` en `:185-187`).
- Extender `PrefillBase` (`:176-180`) para incluir las 5 secciones (alinear con `ClinicalHistoryDataSchema`).
- Extender el objeto `longitudinalData` (`:193-199`) para incluir `no_patologicos` y `patologicos` cuando existan.

**No tocar:** el resto del loader (serialización de eventTests, timeline, etc. permanece).

---

## 6. Cambios en `ExamenMedicoEstudio.tsx`

**Archivo:** `frontend/src/components/clinical/ExamenMedicoEstudio.tsx`

### 6.1 Tipo `OuterTab` (`:25`)
Añadir `'antecedentes'` como nuevo valor: `type OuterTab = 'somatometria' | 'signos_vitales' | 'agudeza_visual' | 'antecedentes' | 'examen_medico'`.

### 6.2 Array `outerTabs` (`:356-361`)
Añadir entrada `{ id: 'antecedentes', label: 'Antecedentes', icon: '📋', done: hasAntecedentes, locked: false }` — **`locked: false` SIEMPRE** (no es prerrequisito, decisión Frank). Posición: entre `agudeza_visual` y `examen_medico`.

### 6.3 Estado local
- Añadir estado para `antecedentes_captured` (las 5 secciones), inicializado desde `physicalExamData.antecedentes_captured` con fallback a `longitudinalData` (snapshot del historial maestro) cuando el médico aún no ha capturado nada.
- Indicador `hasAntecedentes` (boolean) para el dot de completitud en la outer-tab.

### 6.4 Render de la outer-tab "Antecedentes"
- Renderizar componente nuevo `AntecedentesCaptura` (ver §7) cuando `outerTab === 'antecedentes'`.
- **No** incluye el lock de `canAccessExamen` (`:231`) — la outer-tab es accesible desde el inicio.
- Pasa `readonly`, `eventId`, `workerId`, `initialData` (snapshot o fallback longitudinal), `prefilledData`.

### 6.5 Banner de bloqueo (`:398-410`)
El banner actual solo aplica cuando `outerTab !== 'examen_medico' && !canAccessExamen`. La nueva outer-tab "antecedentes" no dispara el banner (no es prerrequisito). Verificar que la condición no cambie de comportamiento.

### 6.6 Intacto
- Pestañas 1-3 (Somatometría, Signos Vitales, Agudeza Visual): sin cambios.
- Pestaña 4 (Examen Médico) con sus 3 inner-tabs (Módulo 1 / Exploración / Impresión): sin cambios funcionales. Solo se ajusta la inner-tab "Módulo 1" para que su `<details>` de referencia longitudinal (`:800-829`) muestre las 5 secciones (no solo 3) una vez que el loader las inyecte — **cambio cosmético en `LONGITUDINAL_SECTIONS` (`:69-73`)**.

---

## 7. Componente nuevo `AntecedentesCaptura.tsx`

**Archivo nuevo:** `frontend/src/components/clinical/AntecedentesCaptura.tsx`

### 7.1 Responsabilidad
Editor de las 5 secciones declarativas como **snapshot por cita**. Difiere de `AntecedentesForm.tsx` (que escribe al historial maestro vía `upsertWorkerClinicalHistory`) en que persiste a `physicalExamData.antecedentes_captured` vía `saveAntecedentesCaptura` (snapshot local de la cita).

### 7.2 Props
- `eventId: string`
- `workerId?: string` (para CTA "Editar historial longitudinal maestro →")
- `initialData?: AntecedentesCaptura` (snapshot previo si existe)
- `fallbackLongitudinal?: ClinicalHistoryData` (datos del historial maestro para precarga cuando no hay snapshot previo)
- `prefilledData?: unknown` (snapshot del portal)
- `readonly?: boolean`

### 7.3 Comportamiento
1. **Precarga:** si `initialData` (snapshot previo de la cita) existe, usarlo. Si no, precargar desde `fallbackLongitudinal` (historial maestro) y/o `prefilledData` (portal).
2. **Indicador de proveniencia por campo:** cada campo con valor proveniente del portal/longitudinal muestra badge "📋 Del portal" (azul). Cuando el médico modifica un campo, el badge cambia a "✏️ Editado en consulta" (ámbar). Tracking local de campos modificados.
3. **Edición:** inputs editables (mismo patrón `disabled={readonly}` que el resto del componente).
4. **Guardado:** botón "💾 Guardar antecedentes" → llama `saveAntecedentesCaptura(eventId, payload)`. No dispara IA. No cambia `EventTest.status`.
5. **CTA lateral:** "Editar historial longitudinal maestro →" (link a `/history/${workerId}`) para que el médico, si detecta cambios persistentes, vaya a editar la fuente maestra (respeta `ARCH-20260326-04` §"Comportamiento esperado cuando el médico detecta cambios").
6. **Reusa diccionarios** del helper `antecedentes-fields.ts` (§5 de la pregunta 5) — mismas `field`/`label`/`help` que `AntecedentesForm.tsx`.

### 7.4 Layout (referencia visual, SOFIA implementa el JSX)
- Header con título "Antecedentes — Captura por cita" + nota explicativa breve.
- Grid 3 columnas en desktop: col1 = Datos Personales, col2 = Historia Laboral, col3 = Heredo-Familiares.
- Fila 2: No Patológicos (con subs desplegables, mismo patrón que `AntecedentesForm.tsx:630-665`).
- Fila 3: Patológicos (con fieldsets por grupo: endocrino/cardiopulmonar/neurologico/digestivo/otras, mismo patrón que `AntecedentesForm.tsx:448-570`).
- Footer: botón guardar + mensaje de éxito/error + banner readonly cuando aplique.

---

## 8. Action backend

**Archivo:** `frontend/src/actions/medical-exam.actions.ts`

Añadir export `saveAntecedentesCaptura(eventId: string, rawData: unknown)`:

**Contrato:**
- Entrada: `eventId`, `rawData` (shape `AntecedentesCapturaSchema`).
- Validación: `AntecedentesCapturaSchema.parse(rawData)` (lanza ZodError si inválido).
- Persistencia: **read-modify-write merge** sobre `physicalExamData`:
  1. `getMedicalExam(eventId)` para leer `physicalExamData` actual.
  2. Merge: `{ ...existingPhysicalExamData, antecedentes_captured: parsedData }` (preserva Exploración/Impresión/Módulo1).
  3. `prisma.medicalExam.upsert({ where:{eventId}, update:{ physicalExamData: merged }, create:{ eventId, physicalExamData:{ antecedentes_captured: parsedData } } })`.
- **NO** invoca `triggerStructuredStudyAIPrediagnosis` (no es parte del flujo IA del Examen Médico).
- **NO** cambia `EventTest.status` (la outer-tab "Antecedentes" no cierra el examen).
- **NO** escribe `writeTimelineEntry` (opcional — SOFIA decide si añadir entrada de cronograma `ANTECEDENTES_CAPTURED`; si lo añade, debe ser no-bloqueante).
- `revalidatePath(`/events/${eventId}`)`.
- Retorna `{ success: boolean; error?: string }`.

**No modificar:** `saveExamenMedicoPapeleta`, `updateSomatometria`, `updateAgudezaVisual`, `updateExploracionFisica`, `getMedicalExam`.

---

## 9. Helper compartido `antecedentes-fields.ts`

**Archivo nuevo:** `frontend/src/lib/antecedentes-fields.ts`

Extraer de `AntecedentesForm.tsx` los siguientes diccionarios (mover, no duplicar):
- `HEREDOFAMILIARES_DESCRIPCIONES` (`AntecedentesForm.tsx:40-50`)
- `PATOLOGICOS_DESCRIPCIONES` (`:52-84`, con `GrupoPatologicos`)
- `NO_PATOLOGICOS_DESCRIPCIONES` (`:97-140`, con `NoPatologicoItem`)
- Listas de campos de `datos_personales` (inferir de `:327-334`)
- Listas de campos de `historia_laboral` (inferir de `:377-407`)

`AntecedentesForm.tsx` y `AntecedentesCaptura.tsx` importan del helper. **Scope estricto:** solo extracción + reimport. No rediseñar las descripciones ni la estructura.

---

## 10. Permisos por rol

- **Visible para:** cualquier rol con acceso a la papeleta del evento (ADMIN, SUPERADMIN, DOCTOR_GENERAL, DOCTOR_VALIDATOR, RECEPTIONIST, CAPTURIST — hereda el acceso actual a `/events/[id]?view=IN_PROGRESS`).
- **Editable cuando:** `readonly === false` (es decir, `currentStep <= 3`: SCHEDULED/CHECKED_IN/IN_PROGRESS, ver `page.tsx:186`).
- **Readonly cuando:** `currentStep > 3` (VALIDATING/COMPLETED).
- **No añadir** guard de rol específico en el componente nuevo. Reusar el `readonly` que ya fluye desde `page.tsx` → `PapeletaWorkspace` → `ExamenMedicoEstudio` → `AntecedentesCaptura`.

---

## 11. Criterios de Aceptación

### Funcionales
- **CA-1:** Al abrir `?view=IN_PROGRESS` y seleccionar el estudio "Examen Médico", aparece una 5ª outer-tab "Antecedentes" entre "Agudeza Visual" y "Examen Médico".
- **CA-2:** La outer-tab "Antecedentes" es accesible **sin** completar Somatometría/Signos Vitales/Agudeza Visual (no participa del lock `canAccessExamen`).
- **CA-3:** Si el paciente llenó el portal, las 5 secciones aparecen **precargadas y editables** en la outer-tab.
- **CA-4:** Si el paciente NO llenó el portal pero existe historial maestro, las 5 secciones precargan desde el historial longitudinal.
- **CA-5:** El médico puede editar cualquier campo. Al guardar, persiste en `physicalExamData.antecedentes_captured` del `MedicalExam` (snapshot por cita), **sin** sobrescribir el historial maestro.
- **CA-6:** Tras guardar, un `router.refresh()` (o revalidate) muestra los valores persistidos al reabrir la outer-tab.
- **CA-7:** Los campos provenientes del portal/longitudinal muestran badge "📋 Del portal"; los editados por el médico muestran "✏️ Editado en consulta".
- **CA-8:** Cuando el evento pasa a VALIDATING/COMPLETED, la outer-tab entra en modo readonly (inputs disabled + banner).
- **CA-9:** El flujo de la pestaña 4 (Examen Médico → Exploración/Impresión) queda **intacto**: guardar Antecedentes no dispara IA ni cambia `EventTest.status`.
- **CA-10:** El CTA "Editar historial longitudinal maestro →" abre `/history/${workerId}` en pestaña nueva.

### No funcionales / regresión
- **CA-11:** `pnpm typecheck` pasa con 0 errores (baseline verde preservado).
- **CA-12:** `pnpm test` (vitest) pasa — los tests existentes no se rompen. SOFIA añade tests del action `saveAntecedentesCaptura` (merge no destructivo, validación Zod).
- **CA-13:** `pnpm lint` pasa con 0 errores.
- **CA-14:** La inner-tab "Módulo 1" de la pestaña 4 sigue mostrando el `<details>` de referencia longitudinal, ahora con las 5 secciones (no solo 3) una vez inyectadas por el loader.
- **CA-15:** Exámenes médicos existentes (sin `antecedentes_captured`) siguen abriendo y parseando sin error (compatibilidad retroactiva).

### Casos de prueba (regresión E2E)
- **CP-1:** Evento nuevo, paciente SIN portal, SIN historial → outer-tab "Antecedentes" abre con campos vacíos editables → médico llena y guarda → reabrir muestra valores persistidos.
- **CP-2:** Evento con paciente que SÍ llenó portal → outer-tab precarga valores del portal con badge "📋 Del portal" → médico edita un campo → badge cambia a "✏️ Editado en consulta" → guarda → snapshot persiste.
- **CP-3:** Evento con historial maestro pero sin portal → outer-tab precarga desde `longitudinalData` (5 secciones, no 3).
- **CP-4:** Evento en VALIDATING → outer-tab "Antecedentes" en readonly.
- **CP-5:** Flujo E2E existente `frontend/tests/flujo-completo.spec.ts` (TC-08 examen) sigue pasando — la nueva outer-tab no rompe la navegación a la pestaña 4.

---

## 12. Riesgos y Plan de Rollback

### Riesgos
- **R1 (bajo):** Drift entre diccionarios de `AntecedentesForm.tsx` y `AntecedentesCaptura.tsx` si no se extrae el helper. **Mitigación:** el helper `antecedentes-fields.ts` es prerrequisito (§9).
- **R2 (bajo):** Merge destructivo sobre `physicalExamData` si el action no hace read-modify-write. **Mitigación:** el contrato del action (§8) exige leer el `physicalExamData` actual antes de mergear.
- **R3 (medio):** Confusión de usuario entre "editar snapshot de la cita" vs "editar historial maestro". **Mitigación:** badges de proveniencia + CTA explícito al historial maestro (§7.3 punto 5).
- **R4 (bajo):** Regression en `flujo-completo.spec.ts` TC-08 si el selector de outer-tabs cambia. **Mitigación:** la nueva outer-tab se añade, no reemplaza; los selectores existentes siguen validando.
- **R5 (bajo):** `AntecedentesCapturaSchema` con `_provenance` podría chocar con `z.record(z.any())` del `modulo1` existente. **Mitigación:** son claves distintas (`antecedentes_captured` vs `modulo1`).

### Rollback
- **Reversible sin migración:** como `physicalExamData` es `Json?` y `antecedentes_captured` es opcional, revertir el código hace que los snapshots queden huérfanos en el JSON pero no rompen nada (el schema los ignora).
- **Rollback parcial:** si la outer-tab causa problemas, se puede ocultar (no renderizar `outerTab === 'antecedentes'`) sin tocar el resto.
- **No requiere** rollback de BD ni migración inversa.

---

## 13. Archivos a tocar (resumen para SOFIA)

| Archivo | Acción | Líneas aprox. |
|---|---|---|
| `frontend/src/lib/antecedentes-fields.ts` | **NUEVO** (helper compartido, extraído de AntecedentesForm) | ~150 |
| `frontend/src/components/clinical/AntecedentesCaptura.tsx` | **NUEVO** (componente editor snapshot) | ~350-450 |
| `frontend/src/components/clinical/AntecedentesForm.tsx` | **MODIFICAR** (reimportar de `antecedentes-fields.ts`) | ~-100/+10 |
| `frontend/src/schemas/clinical/exam.schema.ts` | **MODIFICAR** (añadir `AntecedentesCapturaSchema` + extender `ExamenMedicoCompletoSchema`) | +15 |
| `frontend/src/actions/medical-exam.actions.ts` | **MODIFICAR** (añadir `saveAntecedentesCaptura`) | +50 |
| `frontend/src/app/events/[id]/_lib/event-page-data.ts` | **MODIFICAR** (inyectar `no_patologicos` + `patologicos` en `longitudinalData`, `:185-199`) | +10 |
| `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` | **MODIFICAR** (nueva outer-tab, estado, render condicional, `LONGITUDINAL_SECTIONS` a 5) | +60 |
| `frontend/src/actions/__tests__/medical-exam.actions.test.ts` (o nuevo) | **NUEVO/MODIFICAR** (tests del action nuevo) | +60 |
| `frontend/tests/flujo-completo.spec.ts` | **MODIFICAR** (regresión: verificar que TC-08 sigue pasando con la 5ª outer-tab) | +5 |

**Total estimado:** ~700-850 líneas, 2 archivos nuevos + 6 modificados.

---

## 14. Validaciones obligatorias (handoff a SOFIA)

```
1. pnpm typecheck          (0 errores, baseline preservado)
2. pnpm test               (vitest — sin regresión + tests nuevos del action)
3. pnpm lint               (0 errores)

Segunda mano de validación: GEMINI (subagent_type='gemini') tras implementación.
Qodo está sunset — NO invocar qodo. (Ver AGENTS.md global §"Segunda mano")

Self-review manual antes de reportar como listo:
  - ¿El código refleja esta SPEC?
  - ¿Hay code smells evidentes?
  - ¿Los tests cubren CP-1..CP-5?
  - ¿Algún riesgo de regresión en la pestaña 4 (Exploración/Impresión)?
```

---

## 15. DoD (Definition of Done)

- CA-1..CA-15 verificados con evidencia.
- Gates `pnpm typecheck` / `pnpm test` / `pnpm lint` en verde.
- GEMINI auditoría completada (0 bloqueadores).
- `PROYECTO.md` actualizado por CRONISTA con la entrada de cola correspondiente.
- **No** commit/push/PR sin OK explícito de Frank.
- **No** deploy ni migración de BD (no aplica).

---

## 16. Fuente de verdad y referencias

- `PROYECTO.md` (raíz) — fuente de verdad del proyecto.
- `context/SPECs/SPEC_ARCH-20260326-04-HISTORIAL-MAESTRO-EXAMEN-SNAPSHOT.md` — decisión canónica padre.
- `context/decisions/ADR-20260809-01-ANTECEDENTES-SNAPSHOT-POR-CITA.md` — ADR companion.
- `context/interconsultas/HANDOFF_ARCH-20260809-01_SOFIA_ANTECEDENTES-OUTER-TAB.md` — handoff a SOFIA.
- Evidencia de archivos: `prisma/schema.prisma:427`, `exam.schema.ts:121-127`, `medical-exam.actions.ts:175-240`, `event-page-data.ts:175-199`, `ExamenMedicoEstudio.tsx:25,231,356-361,731-909`, `AntecedentesForm.tsx:40-140,236-242`, `history.schema.ts:148-154`, `page.tsx:186`.
