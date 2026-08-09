# SPEC v2: Sub-pestaña "Antecedentes" dentro de Examen Médico (snapshot por cita)

**ID:** `ARCH-20260809-01` (v2)
**Reemplaza:** SPEC v1 `context/SPECs/SPEC_ARCH-20260809-01-ANTECEDENTES-OUTER-TAB-EXAMEN-MEDICO.md` (marcada **SUPERSEDED**).
**Padre:** `ARCH-20260326-04` (Historial Maestro + Examen Snapshot), `ARCH-20260324-04` (Examen Médico), `ARCH-20260326-06` (Historial Maestro Longitudinal)
**Estado:** READY (cumple DoR)
**Prioridad:** P1
**Implementación asociada:** `IMPL-20260809-02` (rework de `IMPL-20260809-01` commiteado en `a1b2f44`)
**Modelo:** INTEGA Spark 1.1 (Spec) → SOFIA M3 (implementación) → GEMINI (auditoría)
**Fecha:** 2026-08-09

---

## 0. Changelog (v1 → v2)

| Aspecto | v1 (rechazada en prod) | v2 (aprobada) |
|---|---|---|
| Posición UI | 5ª **outer-tab** paralela a Examen Médico | 1ª **sub-pestaña** dentro de Examen Médico |
| `OuterTab` type | incluye `'antecedentes'` | vuelve a 4 valores (sin `'antecedentes'`) |
| `InnerTab` type | `'declarativa' \| 'exploracion' \| 'impresion'` | añade `'antecedentes'` **al inicio** |
| Persistencia | action autónoma `saveAntecedentesCaptura` (sin IA, sin status) | **integrada** en `saveExamenMedicoPapeleta` (consistente con Módulo 1) |
| `buildPayload()` | excluía `antecedentes_captured` (defensa I-1) | **incluye** `antecedentes_captured` (revertir I-1) |
| Banner ámbar | excluía `'antecedentes'` de la condición | vuelve a condición original |
| Action eliminado | — | `saveAntecedentesCaptura` se **elimina** |
| Tests | 18 (12 del action + 6 schemas) | 5 schemas conservados + tests nuevos de `saveExamenMedicoPapeleta` con `antecedentes_captured` |
| ADR | punto 4 ("action autónoma sin IA") | **revisado** — ver nota en ADR (la persistencia integrada dispara IA como Módulo 1) |

**Motivo del cambio:** Frank vio `IMPL-20260809-01` (outer-tab) en producción y lo **rechazó** por UX. Decisión nueva: Antecedentes vive dentro del Examen Médico como primera sub-pestaña, al lado de Módulo 1 / Exploración / Impresión. No es un fix, es un **cambio de decisión de UX** → SPEC nueva (v2) con changelog explícito, no edición silenciosa de v1.

---

## 1. Contexto y Problema

En el workspace Events (`?view=IN_PROGRESS`), el estudio "Examen Médico" (`frontend/src/components/clinical/ExamenMedicoEstudio.tsx`) exponía 4 outer-tabs: `somatometria`, `signos_vitales`, `agudeza_visual`, `examen_medico`. La inner-tab "Módulo 1" dentro de "Examen Médico" (`ExamenMedicoEstudio.tsx:731-909`) solo contenía ginecológicos/inmunizaciones + nota libre del médico.

**Hueco original (heredado de v1):** las 5 secciones declarativas del paciente — `datos_personales`, `historia_laboral`, `heredo_familiares`, `no_patologicos`, `patologicos` — no eran editables dentro del estudio Examen Médico. Solo se mostraban como referencia readonly en un `<details>` colapsable. La causa raíz del loader (v1 §1) sigue resuelta: `event-page-data.ts:185-199` ya inyecta las 5 secciones en `longitudinalData` (cambio aplicado en `IMPL-20260809-01` y **se conserva** en v2).

**Por qué v2:** v1 resolvió el hueco añadiendo una 5ª outer-tab "Antecedentes" **separada** del Examen Médico. Tras ver el resultado en producción, Frank rechazó esa decisión de UX: prefiere que Antecedentes sea la **primera sub-pestaña dentro de "Examen Médico"** (junto a Módulo 1, Exploración Física, Impresión/Aptitud), no una pestaña paralela. Esto cambia la arquitectura UI y la de persistencia.

---

## 2. Decisión del Usuario (aprobada v2)

**Opción A-v2** (confirmada por Frank tras rechazar v1 en prod): mover "Antecedentes" a la **primera sub-pestaña dentro de la outer-tab "Examen Médico"** (outer-tab 4), editable, que precargue lo que ya contestó el paciente. Restricciones explícitas:

- Antecedentes es la **primera** inner-tab de Examen Médico (antes que Módulo 1).
- Queda **dentro** del flujo del Examen Médico (ya no es paralela ni independiente).
- Si el paciente llenó el portal, los valores aparecen **precargados y editables** por el médico.
- Las correcciones del médico se **persisten como snapshot por cita** en `physicalExamData.antecedentes_captured` (decisión de datos del ADR `ADR-20260809-01` **sin cambios**).

Estructura final de `innerTabs` (dentro de "Examen Médico"):

```
1. 🩺 Antecedentes   ← NUEVO (Datos Personales, Historia Laboral, Heredo-Familiares, No Patológicos, Patológicos)
2. 📋 Módulo 1       (existente — cuestionario paciente in-situ: gine/inmuno + nota)
3. 🩻 Exploración Física
4. ✅ Impresión / Aptitud
```

---

## 3. Decisión Arquitectónica y Justificación

Esta SPEC **concreta y aplica** la decisión canónica `ARCH-20260326-04` (precedencia §1: ADR activo prevalece) al componente `ExamenMedicoEstudio`. Ver ADR companion `context/decisions/ADR-20260809-01-ANTECEDENTES-SNAPSHOT-POR-CITA.md` (con nota de revisión SPEC v2 añadida en su §"Revisión SPEC v2").

### 3.1 Modelo de persistencia: snapshot por cita en `physicalExamData` (SIN cambios vs v1)

- Sub-objeto `antecedentes_captured` dentro de `physicalExamData` (campo `Json?` de `MedicalExam`, ver `prisma/schema.prisma:427`).
- Shape: `{ datos_personales?, historia_laboral?, heredo_familiares?, no_patologicos?, patologicos?, _provenance?: { source, updatedAt, capturedBy } }`.
- **NO requiere migración Prisma**: `physicalExamData` es `Json?` libre. Aditivo y reversible.
- **NO sobrescribe** el historial maestro (`WorkerClinicalHistory`). Respeta `ARCH-20260326-04` §"Regla de Autoridad de Dato".
- Coexiste con `ExploracionFisicaSchema` + `ImpresiónAptitudSchema` + `modulo1` + `antecedentes_medico`, que **quedan intactos**.

### 3.2 Cambio de arquitectura UI: outer-tab → inner-tab

- v1 usaba `outerTabs` (5ª entrada `'antecedentes'`). **v2 elimina** esa entrada: `outerTabs` vuelve a 4 (somatometria, signos_vitales, agudeza_visual, examen_medico).
- v2 añade `'antecedentes'` a `type InnerTab` como **primer** valor (ver `ExamenMedicoEstudio.tsx:31`).
- `activeInnerTab` por defecto pasa de `'declarativa'` a `'antecedentes'` (ver `:184`), de modo que al abrir Examen Médico la primera sub-pestaña visible sea Antecedentes.
- `hasAntecedentes` (indicador de completitud, `:273-291`) **se conserva** pero ahora alimenta el dot de la **inner-tab** Antecedentes (antes era el dot de la outer-tab).

### 3.3 Cambio de arquitectura de persistencia: action autónoma → integrada (P1)

- v1 usaba action autónoma `saveAntecedentesCaptura` (merge read-modify-write, **sin** IA, **sin** cambio de status). Justificación v1: la outer-tab era independiente del flujo del examen.
- **v2 elimina** `saveAntecedentesCaptura`. Antecedentes ahora persiste **dentro** del payload de `saveExamenMedicoPapeleta` (mismo action que ya usan Módulo 1 / Exploración / Impresión). Ver §8.
- Justificación: al ser una sub-pestaña del Examen Médico, Antecedentes es parte del flujo clínico. Disparar IA prediagnóstico al guardar (como ya hace Módulo 1) es **consistente y deseable** — los antecedentes son contexto clínico que la IA debe considerar. La preocupación original del ADR punto 4 ("no disparar IA desde la outer-tab independiente") **ya no aplica**.

### 3.4 Resolución de las preguntas abiertas (P1–P4)

| # | Pregunta | Decisión v2 | Confianza |
|---|---|---|---|
| P1 | ¿`antecedentes_captured` vía `saveAntecedentesCaptura` o integrado en `saveExamenMedicoPapeleta`? | **Integrado en `saveExamenMedicoPapeleta`.** Eliminar `saveAntecedentesCaptura`. `buildPayload()` incluye `antecedentes_captured`. Consistente con Módulo 1. Reduce superficie de ataque (un action menos). | 90% |
| P2 | ¿Banner ámbar de bloqueo? | **Revertir** a condición original `outerTab !== 'examen_medico' && !canAccessExamen` (quitar la exclusión `&& outerTab !== 'antecedentes'` añadida en I-4). Ya no hay outer-tab antecedentes que excluir. | 95% |
| P3 | ¿Tests? | E2E TC-08b: cambiar de "verificar outer-tab Antecedentes" a "abrir Examen Médico → ver sub-pestaña Antecedentes como primera → editar → guardar". Unit tests: eliminar los 12+1 tests de `saveAntecedentesCaptura`; conservar los 5 tests de schemas (`ExamenMedicoCompletoSchema`/`AntecedentesCapturaSchema`/`DatosPersonalesModulo1Schema`); añadir cobertura de `saveExamenMedicoPapeleta` con `antecedentes_captured` en el payload. | 90% |
| P4 | ¿`git revert a1b2f44` o nuevo commit? | **Nuevo commit** `IMPL-20260809-02` que sobrescribe. Mantiene trazabilidad del rework (no rompe historia). Mensaje: `feat(events): IMPL-20260809-02 mover Antecedentes a sub-pestaña de Examen Médico`. | 90% |

---

## 4. Modelo de Datos (SIN cambios vs v1 rework)

### 4.1 Prisma (`MedicalExam`) — SIN cambios
Campo `physicalExamData Json? @default("{}")` ya existe (`prisma/schema.prisma:427`). No hay migración.

### 4.2 Zod — `exam.schema.ts` SIN cambios
- `AntecedentesCapturaSchema` (`exam.schema.ts:134-142`) **se conserva** (reusa `ClinicalHistoryDataSchema` + `_provenance`).
- `ExamenMedicoCompletoSchema` (`:146-157`) **ya acepta** `antecedentes_captured: AntecedentesCapturaSchema.optional()` (añadido en I-1). Compatibilidad retroactiva garantizada (`.optional()`).
- `antecedentes_medico` (string libre, `:149`) **se conserva** — es la nota resumen del médico, distinta del snapshot estructurado.

> Nota: aunque el action `saveAntecedentesCaptura` se elimina, los **schemas** se conservan porque `ExamenMedicoCompletoSchema` los referencia y los tests de schema (13-17) los validan.

### 4.3 Tipos TypeScript
- `AntecedentesCaptura = z.infer<typeof AntecedentesCapturaSchema>` (sin cambios).
- `ExamData` en `ExamenMedicoEstudio.tsx:18-24` sin cambios (ya es `Record<string, unknown>`).

---

## 5. Cambios en el loader (`event-page-data.ts`) — SIN cambios vs v1

**Archivo:** `frontend/src/app/events/[id]/_lib/event-page-data.ts`

El bloque `:175-199` ya inyecta las 5 secciones (modificación aplicada en `IMPL-20260809-01` y conservada en v2). **No tocar.** `LONGITUDINAL_SECTIONS` en `ExamenMedicoEstudio.tsx:73-82` ya tiene 5 entradas — **se conserva**.

---

## 6. Cambios en `ExamenMedicoEstudio.tsx`

**Archivo:** `frontend/src/components/clinical/ExamenMedicoEstudio.tsx`

### 6.1 `type OuterTab` (`:29`) — REVERTIR
Quitar `'antecedentes'`: vuelve a `type OuterTab = 'somatometria' | 'signos_vitales' | 'agudeza_visual' | 'examen_medico'` (4 valores, estado pre-v1).

### 6.2 `type InnerTab` (`:31`) — AÑADIR `'antecedentes'` AL INICIO
`type InnerTab = 'antecedentes' | 'declarativa' | 'exploracion' | 'impresion'`.

### 6.3 `activeInnerTab` default (`:184`)
`useState<InnerTab>('declarativa')` → `useState<InnerTab>('antecedentes')` (al abrir Examen Médico, Antecedentes es la primera sub-pestaña visible).

### 6.4 Array `outerTabs` (`:407-413`) — ELIMINAR entrada `'antecedentes'`
Quitar la línea `{ id: 'antecedentes', label: 'Antecedentes', icon: '📋', done: hasAntecedentes, locked: false }`. El array vuelve a 4 entradas.

### 6.5 Array `innerTabs` (`:293-297`) — AÑADIR entrada Antecedentes PRIMERA
```
innerTabs = [
  { id: 'antecedentes', label: 'Antecedentes', icon: '🩺', done: hasAntecedentes },   // NUEVO, primero
  { id: 'declarativa',  label: 'Módulo 1',     icon: '📋', done: hasM1 },
  { id: 'exploracion',  label: 'Exploración Física', icon: '🩻', done: hasPhysicalExam },
  { id: 'impresion',    label: 'Impresión y Aptitud', icon: '✅', done: hasAptitud },
]
```

### 6.6 Estado local `antecedentes_captured` — LEVANTAR al padre
- v1: el estado vivía dentro de `<AntecedentesCaptura>` (que llamaba al action directo).
- v2: `ExamenMedicoEstudio` debe **mantener** el estado estructurado de `antecedentes_captured` (objeto, las 5 secciones), inicializado desde `physicalExamData.antecedentes_captured` con fallback a `longitudinalData`/`prefilledData`. **Mismo patrón que `modulo1`** (ver `:191-200`).
- `<AntecedentesCaptura>` pasa a ser un componente **controlado**: recibe `value` (estado antecedentes) + `onChange` (callback que actualiza el estado del padre). Ya no llama al action ni tiene su propio botón guardar.
- El mecanismo exacto (props `value/onChange` vs `ref` imperativo) lo decide SOFIA; el **contrato innegociable** es: `buildPayload()` debe poder incluir el objeto `antecedentes_captured` actualizado.

### 6.7 `buildPayload()` (`:306-315`) — REVERTIR I-1 (INCLUIR `antecedentes_captured`)
- Quitar la destructure defensiva `const { antecedentes_captured: _antecedentesCaptured, ...rest } = form`.
- En su lugar, **añadir** el estado levantado: `return { ...form, aptitud: aptitud || undefined, modulo1, antecedentes_captured: antecedentesState }`.
- El filtro `isPrimitive` del init de `form` (`:172-180`) **se conserva** (sigue siendo correcto: evita que `modulo1` y `antecedentes_captured` —objetos— se serialicen como `"[object Object]"` al caer en `form` plano). Esos objetos viven en estados separados.

### 6.8 Banner ámbar de bloqueo (`:455`) — REVERTIR I-4
Quitar `&& outerTab !== 'antecedentes'`. Vuelve a: `{outerTab !== 'examen_medico' && !canAccessExamen && (...)}`.

### 6.9 Render de la sub-pestaña Antecedentes
- **Eliminar** el bloque `outerTab === 'antecedentes'` (líneas ~733-748 en v1): ya no es outer-tab.
- **Añadir** dentro del bloque `outerTab === 'examen_medico' && canAccessExamen` (donde ya se renderizan las inner-tabs), un nuevo bloque `{activeInnerTab === 'antecedentes' && (...)}` que monta `<AntecedentesCaptura value={...} onChange={...} ... />` como **primera** sub-pestaña.
- Navegación: la sub-pestaña Antecedentes tiene botón "Continuar → Módulo 1" (análogo al "Continuar → Exploración" de Módulo 1, `:980-984`). Opcionalmente un "💾 Guardar borrador" secundario que llama `handleSave(false)` (igual que Exploración, `:1017`).

### 6.10 Guardado desde Antecedentes
- El botón de guardado de Antecedentes (si se incluye) llama `handleSave(false)` (draft) → `saveExamenMedicoPapeleta(eventId, eventTestId, payload, false)`. El payload incluye `antecedentes_captured` gracias a §6.7.
- Esto dispara IA prediagnóstico y deja `EventTest.status = 'RESULT_REGISTERED'` — **idéntico al comportamiento de Módulo 1/Exploración al guardar borrador**. No es un side-effect inesperado; es el flujo canónico del examen.

### 6.11 Intacto
- Pestañas 1-3 (Somatometría, Signos Vitales, Agudeza Visual): sin cambios.
- Sub-pestañas Módulo 1 / Exploración / Impresión: sin cambios funcionales (solo pasan a ser 2ª/3ª/4ª en el array `innerTabs`).

---

## 7. Componente `AntecedentesCaptura.tsx` — REFACTORIZAR a controlado

**Archivo:** `frontend/src/components/clinical/AntecedentesCaptura.tsx`

### 7.1 Responsabilidad (cambia vs v1)
Sigue siendo el editor de las 5 secciones declarativas como snapshot por cita. **Diferencia vs v1:** ya **no** llama al action ni gestiona la persistencia. Es ahora un componente **controlado** que reporta su estado al padre (`ExamenMedicoEstudio`) vía callback, y el padre lo incluye en `saveExamenMedicoPapeleta`. Difiere de `AntecedentesForm.tsx` (editor maestro vía `upsertWorkerClinicalHistory`) en que sigue escribiendo al snapshot local.

### 7.2 Props (cambian vs v1)
- `eventId: string` — **se conserva** solo si se usa para CTA/referencia; **ya no** se usa para llamar action.
- `workerId?: string` (CTA "Editar historial longitudinal maestro →").
- `value: AntecedentesCaptura | null` (estado actual del snapshot — controlado).
- `onChange: (next: AntecedentesCaptura) => void` (callback al padre cuando cambia un campo).
- `initialProvenance?: { source: 'snapshot' | 'portal' | 'longitudinal' | 'none' }` (para el badge de proveniencia — calculado por el padre con `pickPrefill`).
- `readonly?: boolean`.
- **Quitan:** `initialData`, `fallbackLongitudinal`, `prefilledData` como props separadas (la precarga en cascada la hace el padre, que ya tiene `longitudinalData`/`prefilledData`/`physicalExamData.antecedentes_captured`; el hijo recibe solo `value` ya resuelto).

### 7.3 Comportamiento (cambia vs v1)
1. **Precarga:** la hace el padre (resuelve cascada snapshot → portal → longitudinal con la función `pickPrefill` existente, `:192-207`). El hijo recibe `value` ya resuelto.
2. **Indicador de proveniencia por campo:** se conserva (badge "📋 Del portal" / "✏️ Editado en consulta"). El tracking de campos modificados (`modified` Set) se conserva a nivel local; el badge global de fuente se recibe vía `initialProvenance`.
3. **Edición:** inputs editables (`disabled={readonly}`), mismo patrón. Al cambiar un campo → `onChange(updatedForm)`.
4. **Guardado:** **sin botón propio**. El guardado lo dispara el padre (`handleSave`). El hijo solo expone estado vía `onChange`. (El footer con botón "💾 Guardar antecedentes" de v1, `:626-635`, **se elimina**.)
5. **CTA lateral** "Editar historial longitudinal maestro →" (`:322-335`): **se conserva**.
6. **Reusa diccionarios** del helper `antecedentes-fields.ts` — sin cambios.

### 7.4 Layout — SIN cambios vs v1
Header + grid 3 columnas (DP/HL/HF) + fila NP + fila P (con fieldsets por grupo). El helper `stripEmptyEnumKeys` (I-2) **se conserva** para limpiar `turno`/`estado_civil` vacíos antes de emitir `onChange` (el schema sigue siendo estricto en esos enums).

---

## 8. Action backend — ELIMINAR `saveAntecedentesCaptura`

**Archivo:** `frontend/src/actions/medical-exam.actions.ts`

### 8.1 Eliminar
- Quitar el export `saveAntecedentesCaptura` (`:261-333`).
- Quitar el import de `AntecedentesCapturaSchema` del action (`:15`) — **solo si** no se usa en otro punto del archivo. (El schema `AntecedentesCapturaSchema` **se conserva** en `exam.schema.ts` porque `ExamenMedicoCompletoSchema` lo referencia; solo se quita el import en el action.)

### 8.2 `saveExamenMedicoPapeleta` — SIN cambios de código
El action existente (`:178-243`) ya:
- Valida con `ExamenMedicoCompletoSchema.parse(rawData)` (que ya acepta `antecedentes_captured` desde I-1).
- Hace `prisma.medicalExam.upsert({ update: { physicalExamData: data } })` — **full replace** de `physicalExamData`. Es seguro porque `buildPayload()` (§6.7) ahora incluye el snapshot completo + exploración + modulo1 + aptitud, igual que ya incluye modulo1.
- Dispara IA prediagnóstico (`:203-208`) y cambia `EventTest.status` (`:197-201`). **Esperado y consistente** con Módulo 1.
- Escribe timeline entry `MEDICAL_EXAM_SAVED` (`:226-232`). **Sin cambios.**

### 8.3 No modificar
`updateSomatometria`, `updateAgudezaVisual`, `updateExploracionFisica`, `getMedicalExam`.

### 8.4 Consecuencia sobre el ADR punto 4
El ADR `ADR-20260809-01` punto 4 decía "Action backend autónoma... sin IA... sin status change". En v2 esto **se revisa**: antecedentes ya no tiene action autónomo. Persiste vía `saveExamenMedicoPapeleta`, que **sí** dispara IA y **sí** cambia status (a `RESULT_REGISTERED` en draft). Esto es **aceptable** porque antecedentes ahora es parte del flujo del examen (sub-pestaña), no una outer-tab independiente. Se añade nota de revisión al ADR (ver entrega §3 del handoff).

---

## 9. Helper compartido `antecedentes-fields.ts` — SIN cambios

**Archivo:** `frontend/src/lib/antecedentes-fields.ts`

Extraído en v1. `AntecedentesForm.tsx` y `AntecedentesCaptura.tsx` lo importan. **No tocar.**

---

## 10. Permisos por rol — SIN cambios vs v1

- Visible para cualquier rol con acceso a la papeleta del evento.
- Editable cuando `readonly === false` (`currentStep <= 3`: SCHEDULED/CHECKED_IN/IN_PROGRESS, ver `page.tsx:186`).
- Readonly cuando `currentStep > 3` (VALIDATING/COMPLETED).
- Hereda `readonly` desde `page.tsx` → `PapeletaWorkspace` → `ExamenMedicoEstudio` → `AntecedentesCaptura`. Sin guard de rol nuevo.

---

## 11. Criterios de Aceptación

### Funcionales
- **CA-1:** Al abrir `?view=IN_PROGRESS` y seleccionar el estudio "Examen Médico", aparecen **4 outer-tabs** (Somatometría, Signos Vitales, Agudeza Visual, Examen Médico). **No existe** outer-tab "Antecedentes".
- **CA-2:** Al entrar a "Examen Médico", la primera sub-pestaña visible es **"🩺 Antecedentes"**, seguida de Módulo 1, Exploración Física, Impresión/Aptitud.
- **CA-3:** Si el paciente llenó el portal, las 5 secciones aparecen **precargadas y editables** en la sub-pestaña Antecedentes.
- **CA-4:** Si el paciente NO llenó el portal pero existe historial maestro, las 5 secciones precargan desde el historial longitudinal.
- **CA-5:** El médico puede editar cualquier campo. Al guardar (vía el botón de borrador de la sub-pestaña o al completar desde Impresión), `antecedentes_captured` se persiste en `physicalExamData` del `MedicalExam` (snapshot por cita), **sin** sobrescribir el historial maestro.
- **CA-6:** Tras guardar, `revalidatePath` muestra los valores persistidos al reabrir la sub-pestaña.
- **CA-7:** Los campos provenientes del portal/longitudinal muestran badge "📋 Del portal"; los editados por el médico muestran "✏️ Editado en consulta".
- **CA-8:** Cuando el evento pasa a VALIDATING/COMPLETED, la sub-pestaña Antecedentes entra en modo readonly (inputs disabled + banner readonly del hijo).
- **CA-9:** Guardar Antecedentes dispara IA prediagnóstico y deja `EventTest.status = RESULT_REGISTERED` (draft) — **idéntico al comportamiento de Módulo 1/Exploración**. No es un side-effect inesperado.
- **CA-10:** El CTA "Editar historial longitudinal maestro →" abre `/history/${workerId}` en pestaña nueva.
- **CA-11:** La acción `saveAntecedentesCaptura` **ya no existe** en `medical-exam.actions.ts` (eliminada). Ningún componente la importa.

### No funcionales / regresión
- **CA-12:** `pnpm typecheck` pasa con 0 errores (baseline verde preservado).
- **CA-13:** `pnpm test` pasa — los 5 tests de schema conservados pasan; los tests eliminados de `saveAntecedentesCaptura` se quitan; se añaden tests de `saveExamenMedicoPapeleta` con `antecedentes_captured` en el payload (verifican que el snapshot se persiste en el full-replace).
- **CA-14:** `pnpm lint` pasa con 0 errores.
- **CA-15:** La sub-pestaña "Módulo 1" sigue mostrando el `<details>` de referencia longitudinal con las 5 secciones (no solo 3).
- **CA-16:** Exámenes médicos existentes (sin `antecedentes_captured`) siguen abriendo y parseando sin error (compatibilidad retroactiva).
- **CA-17:** El flujo E2E `frontend/tests/flujo-completo.spec.ts` TC-08 pasa con la nueva estructura de sub-pestañas.

### Casos de prueba (regresión E2E y unitarios)
- **CP-1:** Evento nuevo, paciente SIN portal, SIN historial → abrir Examen Médico → sub-pestaña Antecedentes visible como primera → campos vacíos editables → médico llena y guarda borrador → reabrir muestra valores persistidos en `physicalExamData.antecedentes_captured`.
- **CP-2:** Evento con paciente que SÍ llenó portal → Antecedentes precarga valores del portal con badge "📋 Del portal" → médico edita un campo → badge cambia a "✏️ Editado en consulta" → guarda → snapshot persiste vía `saveExamenMedicoPapeleta`.
- **CP-3:** Evento con historial maestro pero sin portal → Antecedentes precarga desde `longitudinalData` (5 secciones, no 3).
- **CP-4:** Evento en VALIDATING → sub-pestaña Antecedentes en readonly.
- **CP-5:** Flujo E2E `flujo-completo.spec.ts` TC-08 sigue pasando con 4 outer-tabs + 4 inner-tabs (Antecedentes como primera inner).
- **CP-6 (unit):** `saveExamenMedicoPapeleta` con payload que incluye `antecedentes_captured` → persiste el snapshot en `physicalExamData` (full-replace incluye el campo).
- **CP-7 (unit):** `ExamenMedicoCompletoSchema.parse` acepta payload con `antecedentes_captured` como objeto (conservado del test 13) y rechaza string `"[object Object]"` (conservado del test 14).

---

## 12. Riesgos y Plan de Rollback

### Riesgos
- **R1 (medio):** Al integrar en `saveExamenMedicoPapeleta` (full-replace de `physicalExamData`), si `buildPayload()` no incluye un campo previamente persistido, se pierde. **Mitigación:** `form` se inicializa desde `physicalExamData` primitivos (`:172-180`), `modulo1` desde `physicalExamData.modulo1` (`:191-200`), y `antecedentesState` desde `physicalExamData.antecedentes_captured` (nuevo, §6.6). Los tres estados se rehidratan desde DB al montar → el full-replace preserva todo. Tests CP-6 lo cubren.
- **R2 (bajo):** Levantar el estado de Antecedentes al padre puede generar re-renders si `onChange` emite en cada tecla. **Mitigación:** SOFIA puede usar `useCallback`/memoización; el patrón ya se usa con `modulo1` sin problema.
- **R3 (medio):** Confusión usuario entre "editar snapshot de la cita" vs "editar historial maestro". **Mitigación:** badges de proveniencia + CTA explícito (se conservan de v1).
- **R4 (bajo):** Regresión en `flujo-completo.spec.ts` TC-08 si cambia el número de outer-tabs. **Mitigación:** se **reduce** de 5 a 4 outer-tabs (estado pre-v1); los selectores existentes de TC-08 que asumen 4 outer-tabs vuelven a ser válidos. TC-08b debe actualizarse para la nueva inner-tab.
- **R5 (bajo):** Disparar IA al guardar solo Antecedentes (draft) puede consumir tokens innecesarios si el médico guarda muchas veces. **Mitigación:** este es el comportamiento **ya existente** para Módulo 1/Exploración; no se introduce un coste nuevo relativo al flujo actual. Si Frank quiere optimizarlo, es una SPEC aparte (debounce de IA).
- **R6 (bajo):** `AntecedentesCapturaSchema` con `_provenance` podría chocar con `z.record(z.any())` del `modulo1`. **Mitigación:** son claves distintas (`antecedentes_captured` vs `modulo1`). Sin cambios vs v1.

### Rollback
- **Reversible sin migración:** `physicalExamData` es `Json?` y `antecedentes_captured` es opcional. Revertir el código hace que los snapshots queden huérfanos en el JSON pero no rompen nada.
- **Rollback del commit:** si `IMPL-20260809-02` causa problemas, `git revert` ese commit restaura v1 (outer-tab). Como v1 está en `main` (`a1b2f44`), el revert es trivial.
- **Rollback parcial:** si la sub-pestaña causa problemas, se puede ocultar (no renderizar `activeInnerTab === 'antecedentes'`) sin tocar el action.
- **No requiere** rollback de BD ni migración inversa.

---

## 13. Archivos a tocar (resumen para SOFIA)

| Archivo | Acción | Notas |
|---|---|---|
| `frontend/src/components/clinical/ExamenMedicoEstudio.tsx` | **MODIFICAR** | Revertir `OuterTab` a 4 valores; añadir `'antecedentes'` a `InnerTab` (primero); `activeInnerTab` default `'antecedentes'`; eliminar entrada `'antecedentes'` de `outerTabs`; añadir entrada a `innerTabs` (primera); levantar estado `antecedentes_captured`; `buildPayload()` lo incluye (revertir I-1); revertir banner I-4; eliminar bloque `outerTab === 'antecedentes'`; añadir bloque `activeInnerTab === 'antecedentes'` dentro de examen_medico |
| `frontend/src/components/clinical/AntecedentesCaptura.tsx` | **MODIFICAR** | Pasar a controlado: props `value/onChange/initialProvenance`; eliminar `saveAntecedentesCaptura` import + `handleSave` + botón guardar; conservar layout, `buildInitialState`, `pickPrefill`, `stripEmptyEnumKeys`, `FieldRow`, badges |
| `frontend/src/actions/medical-exam.actions.ts` | **MODIFICAR** | Eliminar `saveAntecedentesCaptura` (`:261-333`) + su import de `AntecedentesCapturaSchema` (`:15`) si no se usa más en el archivo |
| `frontend/src/actions/__tests__/medical-exam.actions.test.ts` | **MODIFICAR** | Eliminar tests 1-12 y 18 (del action); conservar tests 13-17 (schemas); añadir tests de `saveExamenMedicoPapeleta` con `antecedentes_captured` (CP-6/CP-7) |
| `frontend/tests/flujo-completo.spec.ts` | **MODIFICAR** | TC-08/TC-08b: actualizar a 4 outer-tabs + Antecedentes como primera inner-tab |
| `frontend/src/schemas/clinical/exam.schema.ts` | **SIN cambios** | `AntecedentesCapturaSchema` + `ExamenMedicoCompletoSchema` ya correctos (v1 rework) |
| `frontend/src/lib/antecedentes-fields.ts` | **SIN cambios** | Extraído en v1 |
| `frontend/src/components/clinical/AntecedentesForm.tsx` | **SIN cambios** | Ya reimporta del helper |
| `frontend/src/app/events/[id]/_lib/event-page-data.ts` | **SIN cambios** | Ya inyecta 5 secciones (v1) |
| `prisma/schema.prisma` | **SIN cambios** | `physicalExamData` ya es `Json?` |

**Total:** 4 archivos modificados + 1 test modificado. **Menos superficie que v1** (v1 tenía 2 archivos nuevos + 6 modificados; v2 reutiliza lo de v1 y solo refactoriza).

---

## 14. Validaciones obligatorias (handoff a SOFIA)

```
1. pnpm typecheck          (0 errores, baseline preservado)
2. pnpm test               (vitest — sin regresión; tests de saveAntecedentesCaptura eliminados;
                             tests de schema conservados; tests nuevos de saveExamenMedicoPapeleta con antecedentes_captured)
3. pnpm lint               (0 errores)

Segunda mano de validación: GEMINI (subagent_type='gemini') tras implementación.
Qodo está sunset — NO invocar qodo. (Ver AGENTS.md global §"Segunda mano")

Self-review manual antes de reportar como listo:
  - ¿El código refleja esta SPEC v2 §3-§9?
  - ¿buildPayload() incluye antecedentes_captured como objeto (no string)?
  - ¿saveAntecedentesCaptura fue eliminada y ningún archivo la importa?
  - ¿AntecedentesCaptura es controlado (value/onChange) y sin botón guardar propio?
  - ¿activeInnerTab default es 'antecedentes'?
  - ¿El banner ámbar volvió a la condición original (sin exclusión 'antecedentes')?
  - ¿Compatibilidad retroactiva: exámenes sin antecedentes_captured siguen abriendo?
  - ¿TC-08 E2E pasa con la nueva estructura?
```

---

## 15. DoD (Definition of Done)

- CA-1..CA-17 verificados con evidencia.
- Gates `pnpm typecheck` / `pnpm test` / `pnpm lint` en verde.
- GEMINI auditoría completada (0 bloqueadores).
- `PROYECTO.md` actualizado por CRONISTA con la entrada de diario correspondiente a `IMPL-20260809-02`.
- **No** commit/push/PR sin OK explícito de Frank.
- **No** deploy ni migración de BD (no aplica).

---

## 16. Fuente de verdad y referencias

- `PROYECTO.md` (raíz) — fuente de verdad del proyecto.
- SPEC v1 (SUPERSEDED): `context/SPECs/SPEC_ARCH-20260809-01-ANTECEDENTES-OUTER-TAB-EXAMEN-MEDICO.md`.
- `context/SPECs/SPEC_ARCH-20260326-04-HISTORIAL-MAESTRO-EXAMEN-SNAPSHOT.md` — decisión canónica padre.
- `context/decisions/ADR-20260809-01-ANTECEDENTES-SNAPSHOT-POR-CITA.md` — ADR companion (con nota de revisión SPEC v2).
- `context/interconsultas/HANDOFF_ARCH-20260809-01_v2_SOFIA_ANTECEDENTES-SUB-PESTANA.md` — handoff a SOFIA (v2).
- Commit v1 (rechazado en prod): `a1b2f44` (`IMPL-20260809-01`).
- Evidencia de archivos: `prisma/schema.prisma:427`, `exam.schema.ts:134-157`, `medical-exam.actions.ts:178-243,261-333`, `ExamenMedicoEstudio.tsx:29,31,184,273-297,306-315,407-413,455,733-748`, `AntecedentesCaptura.tsx:25,192-207,247-288,626-635`, `medical-exam.actions.test.ts:1-278`.
