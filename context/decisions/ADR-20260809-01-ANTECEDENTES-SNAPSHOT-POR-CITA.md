# ADR-20260809-01: Antecedentes como snapshot por cita en Examen Médico

**Estado:** Activo (con revisión SPEC v2 — ver §"Revisión SPEC v2" abajo)
**Fecha:** 2026-08-09
**Decisor:** INTEGA
**Especifica/Concreta:** `ARCH-20260326-04` (Historial Maestro + Examen Snapshot)
**SPEC companion vigente:** `context/SPECs/SPEC_ARCH-20260809-01-ANTECEDENTES-SUB-PESTANA-EXAMEN-MEDICO.md` (v2 — sustituye a la v1 outer-tab)

## Contexto

Frank (vía ATLAS M3) reportó que en el estudio "Examen Médico" (`ExamenMedicoEstudio.tsx`) las 5 secciones declarativas del paciente (`datos_personales`, `historia_laboral`, `heredo_familiares`, `no_patologicos`, `patologicos`) **no son editables** dentro de la cita. El médico solo ve un `<details>` readonly con 3 de 5 secciones, y cuando el paciente no llenó el portal, debe preguntar todo desde cero sin dónde registrarlo.

Frank aprobó la **Opción A**: nueva outer-tab "Antecedentes", editable, que precargue lo del portal, con persistencia **aparte** del historial longitudinal (snapshot por cita).

## Decisión

**Concretizar `ARCH-20260326-04` para el componente `ExamenMedicoEstudio`:**

1. **Snapshot por cita, no sobrescritura del maestro.** Las ediciones del médico en la nueva outer-tab "Antecedentes" persisten en `physicalExamData.antecedentes_captured` del `MedicalExam` (Json libre, `schema.prisma:427`). **No** invocan `upsertWorkerClinicalHistory` (que escribe al historial maestro). Respeta `ARCH-20260326-04` §"Regla de Autoridad de Dato" punto 2: "El Examen Médico es un snapshot clínico del estado usado en esa cita. No sustituye ni redefine por sí mismo la historia maestra."

2. **Precarga con fallback en cascada.** Orden: (a) snapshot previo de la cita si existe → (b) `prefilledData` del portal → (c) `longitudinalData` del historial maestro. Esto encarna `ARCH-20260326-04` §"Diseño Funcional Requerido" punto 3: "Debe mostrar el snapshot importado para la cita actual" + "Debe tomar como base la Historia Clínica al iniciar el episodio."

3. **CTA explícito al historial maestro.** La outer-tab incluye un link "Editar historial longitudinal maestro →" hacia `/history/${workerId}`. Encarna `ARCH-20260326-04` §"Comportamiento esperado cuando el médico detecta cambios": "actualizar la historia maestra" es una acción separada y consciente, no un side-effect del guardado del snapshot.

4. **Action backend autónoma.** `saveAntecedentesCaptura` hace merge (read-modify-write) sobre `physicalExamData`, **sin** disparar IA prediagnóstico ni cambiar `EventTest.status`. Respeta `ARCH-20260326-04` §"Riesgos a Evitar": "Que el snapshot por cita vuelva a convertirse en el lugar de captura principal" — la outer-tab es confirmación/captura puntual, no reemplaza la autoridad del maestro.

5. **No requiere migración Prisma.** `physicalExamData` es `Json?` (`schema.prisma:427`). Sub-objeto `antecedentes_captured` es aditivo y reversible. Compatibilidad retroactiva garantizada por campos `.optional()`.

6. **Visibilidad/readonly heredados.** No añadir lógica de rol nueva. La outer-tab hereda `readonly` (calculado por estado del evento en `page.tsx:186`, no por rol). Respeta el principio de mínima sorpresa y consistencia con el flujo actual.

## Alternativas consideradas

- **(A) Meter las 5 secciones dentro de la inner-tab "Módulo 1" de la pestaña 4.** Descartada por Frank explícitamente: prefiere outer-tab separada para no mezclar con gine/inmuno existentes y para evitar el lock de `canAccessExamen`.
- **(B) Sobrescribir el historial maestro al guardar.** Descartada: viola `ARCH-20260326-04` §"Riesgos a Evitar": "Que un cambio longitudinal modifique retroactivamente dictámenes de citas cerradas." El snapshot por cita preserva integridad legal/auditoría.
- **(C) Nueva tabla Prisma `AntecedentesCaptura`.** Descartada: innecesaria. `physicalExamData` ya es Json libre y el snapshot vive naturalmente en el `MedicalExam` (relación 1:1 con el evento/cita). Añadir tabla sería over-engineering y requeriría migración.

## Consecuencias

- **Positivas:** el médico captura antecedentes en la cita sin perder el historial maestro como autoridad. Snapshot inmutable por cita para auditoría. Cero migración de BD. Reversible.
- **Negativas:** el snapshot puede divergir del historial maestro si el médico edita solo el snapshot y no propaga al maestro. **Mitigación:** CTA explícito + badges de proveniencia que hacen visible la divergencia.
- **Neutras:** `AntecedentesForm.tsx` (editor maestro) y `AntecedentesCaptura.tsx` (editor snapshot) coexisten con responsabilidades distintas — documentar claramente en los headers de cada archivo.

## Trazabilidad

- **No es una decisión nueva.** Aplica `ARCH-20260326-04` al componente `ExamenMedicoEstudio`. Si `ARCH-20260326-04` se revierte, esta SPEC debe revisarse.
- Padre de SPECs futuras que toquen antecedentes en cita.

---

## Revisión SPEC v2 (2026-08-09)

**Contexto:** la SPEC v1 (`...-OUTER-TAB-...`) fue implementada en `IMPL-20260809-01` (commit `a1b2f44`) y **rechazada por Frank tras ver el resultado en producción**. Frank aprobó mover "Antecedentes" de outer-tab separada a **primera sub-pestaña dentro de Examen Médico**.

**SPEC vigente:** `context/SPECs/SPEC_ARCH-20260809-01-ANTECEDENTES-SUB-PESTANA-EXAMEN-MEDICO.md` (v2).

**Qué se MANTIENE de este ADR (decisión de datos, sin cambios):**
- Puntos 1, 2, 3, 5, 6: snapshot por cita en `physicalExamData.antecedentes_captured`, precarga en cascada, CTA al maestro, sin migración, visibilidad/readonly heredados. **Vigentes.**

**Qué se REVISA de este ADR (decisión de UI/persistencia):**
- **Punto 4 ("Action backend autónoma... sin IA... sin status change"): SUPERSEDED por SPEC v2 §3.3 y §8.** En v2, `saveAntecedentesCaptura` se **elimina** y antecedentes persiste vía `saveExamenMedicoPapeleta` (mismo action que Módulo 1/Exploración/Impresión). Esto **sí** dispara IA prediagnóstico y **sí** cambia `EventTest.status` a `RESULT_REGISTERED` (en draft). Es **aceptable** porque antecedentes ahora es parte del flujo del examen (sub-pestaña), no una outer-tab independiente. La justificación original ("la outer-tab es confirmación puntual, no reemplaza la autoridad del maestro") se preserva: el snapshot sigue sin sobrescribir el historial maestro; solo cambió el action que lo escribe.

**Alternativa (A) reconsiderada:** en v1 §"Alternativas consideradas", la opción (A) "Meter las 5 secciones dentro de la inner-tab Módulo 1" fue descartada. En v2, Frank aprueba una variante: Antecedentes como **inner-tab propia** (no dentro de Módulo 1, sino paralela a Módulo 1 dentro de Examen Médico). Esto preserva la separación visual (no mezcla con gine/inmuno) que motivó descartar (A) en v1, pero la coloca **dentro** del flujo del examen en lugar de como outer-tab independiente.

**Conclusión:** la decisión de **datos** (snapshot por cita) del ADR se mantiene. Solo la decisión de **UI/persistencia** (punto 4 + ubicación outer-tab) se revisa en SPEC v2. Precedencia §1: SPEC v2 explícita prevalece sobre el punto 4 del ADR donde haya conflicto.
