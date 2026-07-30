# SPEC-FIX-20260729-07 — Trigger LabOrder automático desde SAMPLE_TAKEN + Componente Dictamen final

**ID:** `FIX-20260729-07-G-LAB-TRIGGER-01` (también cubre `G-DICT-03`)
**Fecha:** 2026-07-29
**Prioridad:** P1 (Alta)
**Tipo:** Fix funcional (gap detectado por IMPL-20260729-02 lote de remediación)
**Estado:** [~] Pendiente de aprobación INTEGRA / Frank

---

## 1. Problema

TC-11 del flujo E2E falla en producción post-deploy (`f4a60dc` + `6486bcc` + `334ee41` + `c28c97d` + `91010b5`) porque:

- El usuario hace click en **"Registrar muestra tomada"** en un estudio de laboratorio (e.g. `BIOMETRIA HEMATICA COMPLETA`).
- El status del `EventTest` SÍ cambia correctamente a `SAMPLE_TAKEN` (badge "Pendiente de resultado de prueba de laboratorio" visible en la papeleta).
- Pero el trigger backend `EventTest.status → SAMPLE_TAKEN ⇒ LabOrder DRAFT` **no se ejecuta** en Railway, o el LabOrder creado **no aparece en la bandeja `/lab/reception`**.
- Resultado: la papeleta queda huérfana sin LabOrder en la bandeja del laboratorio.

Adicionalmente, TC-12 (dictamen final) requiere que el evento alcance el estado `VALIDATING`, lo cual presupone que los estudios críticos se han completado. Sin el trigger LabOrder funcional, la papeleta puede no progresar a `VALIDATING`, bloqueando TC-12.

## 2. Causas probables

1. **El trigger backend no existe o está comentado**: verificar `backend/app/services/event_service.py` (o equivalente) y buscar la lógica `if event_test.status == SAMPLE_TAKEN: create_lab_order_draft(...)`.
2. **El trigger se ejecuta pero el `LabOrder` se crea con `branchId` o `companyId` incorrecto**: la bandeja `/lab/reception` podría filtrar por sucursal y el LabOrder queda en otra branch.
3. **La bandeja `/lab/reception` filtra por estado `DRAFT` o `SAVED`**: si el trigger crea el LabOrder con un estado distinto (e.g. `PENDING` por error), no aparece.
4. **El trigger falla silenciosamente por excepción no capturada**: logear la ejecución del trigger.
5. **Permisos RBAC**: el trigger puede intentar crear el LabOrder con un usuario que no tiene permisos suficientes, fallando con P2002/P2003.

## 3. Alcance

**Incluido:**

1. **Diagnóstico**: leer `backend/app/services/event_service.py` (o `event_test_service.py`), `backend/app/api/v1/lab/pending_orders.py`, y la bandeja frontend `frontend/src/app/lab/reception/page.tsx`.
2. **Fix del trigger**: asegurar que `EventTest.status = SAMPLE_TAKEN` dispara la creación de `LabOrder DRAFT` con:
   - `workerId` del EventTest.
   - `companyId` del worker.
   - `medicalEventId` del evento.
   - `branchId` de la sucursal correcta (misma que el evento).
   - `doctorName` del médico tratante.
   - Items: `LabOrderItem` por cada `EventTest` de tipo laboratorio.
3. **Validación de la bandeja**: confirmar que `/lab/reception` muestra el LabOrder nuevo.
4. **Reactivación de TC-11**: una vez cerrado el gap, eliminar el `test.skip(true)` en `frontend/tests/flujo-completo.spec.ts` y restaurar el bloque de navegación a `/lab/reception` + asserts de fila.
5. **TC-12 (dictamen)**: verificar que el componente `EventFlowController` muestra "Reporte médico de aptitud" cuando el evento alcanza `VALIDATING`. Si no existe, crear el componente UI mínimo (selector aptitud + campo conclusiones + botón firmar).

**Excluido:**

- Cambios al parser XML directo (ya cerrado en `6486bcc` + BOM + import).
- Cambios al esquema Prisma o migraciones nuevas.
- Refactor del módulo de laboratorio completo.
- Cambios al módulo de dictamen médico en producción hasta validar TC-11.

## 4. Decisiones arquitectónicas

- **D1**: el trigger debe ser **transaccional**: si la creación del LabOrder falla, el status del EventTest debe hacer rollback a su estado anterior para evitar inconsistencia.
- **D2**: usar server action `event-test.actions.ts:updateEventTestStatus` (o equivalente) para disparar el trigger, NO lógica inline en el backend FastAPI.
- **D3**: la bandeja `/lab/reception` debe mostrar LabOrders en estado `DRAFT` y `SAVED` (no solo `SAVED`).
- **D4**: el componente de dictamen (TC-12) puede ser tan simple como un modal con selector `APTO / APTO CON RESTRICCIONES / NO APTO` + campo de texto + botón firmar que invoca `closeMedicalEvent(eventId, verdict)`.

## 5. Definition of Ready

- [x] Gap funcional documentado en checkpoint `CHK_IMPL-20260729-02-SOFIA.md` y PROYECTO.md.
- [x] SPEC firmada.
- [x] Baseline frontend en verde (ya confirmado).
- [ ] Aprobación de Frank para abrir lote nuevo.

## 6. Definition of Done

- TC-11 E2E: tras click en "Registrar muestra tomada", el LabOrder aparece en `/lab/reception` con el `eventId` correcto.
- TC-12 E2E: tras completar estudios, el evento alcanza `VALIDATING`, aparece el selector de aptitud en `EventFlowController`, y se firma el dictamen cerrando el evento.
- Gates verdes (typecheck/vitest/lint).
- Commit + push autorizado.
- PROYECTO.md actualizado con cierre del fix.

## 7. Estimación

| Tarea | Tiempo |
|---|---|
| Diagnóstico | 1 h |
| Fix del trigger | 1.5 h |
| Validación de bandeja | 0.5 h |
| Reactivación TC-11 (test) | 0.5 h |
| Componente dictamen + TC-12 (si falta) | 1.5 h |
| Validación E2E completa | 1 h |
| Doc y checkpoint | 0.5 h |
| **Total** | **~6.5 h** |

## 8. Riesgos

- **R1**: el fix del trigger puede romper otros flujos que dependan del status `SAMPLE_TAKEN` (e.g. vistas de reporte que asumen que sin LabOrder = sin muestra). Validar reportes masivos y dashboard.
- **R2**: el componente de dictamen, si no existe, es UI nueva; debe pasar por UX review mínima.
- **R3**: reactivación de TC-11 puede requerir ajustes de selectores adicionales si la bandeja ha cambiado su estructura.

## 9. Estado

[~] Pendiente aprobación Frank
**Gating**: Independiente (puede ejecutarse en lote posterior).
**Próxima acción**: Frank aprueba → INTEGRA abre lote nuevo con handoff a SOFIA + DEBY (diagnóstico trigger).