# CURRENT — FIX-20260821-01 implementación SOFIA READY_FOR_VERIFYING

- **Actualizado:** 2026-08-21 11:23 CST
- **WIP:** 0 — sesión SOFIA cerrada (entrega `READY_FOR_VERIFYING`); espera auditoría GEMINI
- **Estado:** `READY_FOR_VERIFYING` (FIX-20260821-01) — implementación SOFIA completa; pendiente verificación INTEGRA + auditoría GEMINI obligatoria (cambio de contrato soft)
- **SPEC activa:** `context/SPECs/SPEC_FIX-20260821-01-GATE-TABLEAWARE-ESPIROMETRIA.md` v1.0
- **Handoff cerrado:** `context/interconsultas/HANDOFF_FIX-20260821-01_SOFIA-MINIMAX-ESPIRO.md` (implementación completa)
- **IMPL-REPORT:** pendiente escritura por SOFIA — ver entrada 2026-08-21 11:23 en PROYECTO.md
- **Origen funcional:** hallazgo FND-20260821-03 + dictamen DEBY FIX-20260821-01 L2 (causa raíz H3 confirmada)
- **Próxima acción:** INTEGRA verifica (gates + AC) → GEMINI audita (contrato soft) → ATLAS pide OK Frank → commit/push con autorización explícita.
- **AC resultados:**
  - AC-1.1, 1.2, 1.3 → PASS (gate table-aware básico / Mejor fila / negativa sin filas)
  - AC-2.1, 2.2, 2.3, 2.4, 2.5 → PASS (backfill estándar / Mejor prioridad / con sufijo / bare keys / mapeo paciente-fecha)
  - AC-3.1 → PASS (determinismo bit-a-bit)
  - AC-4.1, 4.2 → PASS (control regresión Audiometría + otros tipos)
  - AC-5.1 → PASS (selector provider m3 preservado)
  - AC-6.1 E2E real → **NO EJECUTADA** (precondición MEDGEMMA_ENABLED=true + DR7_API_KEY real; sin credenciales en test env). Queda como pendiente para verificación INTEGRA.
  - AC-7.1 → PASS (label UI: m3 → "Minimax"; gemini → "Gemini"; ausente → "Extrayendo datos" neutro)
- **Cambios productos:** 4 archivos modificados + 2 archivos nuevos (sin schema Prisma, sin migración):
  - `backend/app/services/ai/extractor.py` (frozenset ampliado + helper `_backfill_espirometry_scalar` + normalizer con backfill/mapeo)
  - `backend/app/services/ai/prediagnostic.py` (helper gate table-aware + integración en `_check_minimum_params`)
  - `backend/tests/test_ai_pipeline.py` (+12 tests `TestFIX20260821_01GateTableawareEspirometria`)
  - `frontend/src/components/clinical/PapeletaWorkspace.tsx` (label UI derivando de provider)
  - `frontend/src/lib/clinical/extraction-stage-label.ts` (nuevo helper exportable)
  - `frontend/src/lib/clinical/__tests__/extraction-stage-label.test.ts` (nuevo test AC-7.1)
- **Gates focal:** pytest nuevos 12/12 PASS; typecheck frontend 0 errores; vitest focal 4/4 PASS; lint focal 0 nuevos; build `next build` SUCCESS.
- **Regresión baseline:** 31 fallos pytest preexistentes `M3_CREDENTIALS_UNAVAILABLE` + 15 fallos vitest preexistentes en `medical-exam.actions.test.ts` — **idénticos antes/después**, 0 nuevos fallos introducidos.
- **Contexto previo:** lote nocturno `LOTE-20260820-01` **CERRADO** (expiración 2026-08-21 07:00 America/Mexico_City), estado `DONE (pendiente-revisión-Frank)` — `CIERRE-LOTE.md` firmado, QA `PASS_WITH_WARNINGS`
- **SPEC lote previo:** `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` v1.0 (HISTÓRICO — lote cerrado)
- **Veredicto QA (lote previo):** `context/reviews/QA-20260820-08-LOTE-NOCTURNO-AUDIO-ESPIRO.md` → PASS_WITH_WARNINGS (2×P1 + 2×P2 + 1×P3; ningún bloqueante)
- **Calibraciones V3 resultantes (NO publicadas):**
  - **Audiometría:** `status='tested'` (NO published; cobertura 4/8 frecs vs PDF SAAVEDRA; regla de promoción ≥50% pendiente confirmación Frank — hallazgo F-5).
  - **Espirometría:** `status='draft'` (NO tested, NO published; 4/4 parámetros vía OCR PNG; LLN no extraíble del AMI — DG-3).
- **Fuera del lote (explícito):**
  - **`ARCH-20260820-01 Fase 5`** (snapshot versionado + migración Prisma aditiva): no incluida en este lote; sigue `READY`, requiere autorización separada de Frank.
  - **Publicación V3** (`tested→published`): prohibida por el lote; ambas calibraciones permanecen en `draft`/`tested` locales.
  - **`context/datos AMI/**`: intacto (0 modificaciones — `find … -newer /tmp/kilo/.lote-start` → 0 archivos).
  - **`git status`:** sin cambios staged; ningún commit/push del lote; rama `main` no afectada por SOFIA/INTEGRA.
- **Reversibilidad:** 100% (carpeta `context/lote-nocturno-20260820-01/` retirable al confirmar Frank; cero cambios en `frontend/src/**`, `backend/app/**`, `prisma/**`).
- **Siguiente acción para Frank (al regreso):**
  1. **DG-1:** entregar PDF espirometría real (Sibelmed W20s con tabla exhaustiva FVC/FEV1/M1/M2/M3/REF/LLN, ≥10 parámetros).
  2. **DG-2:** entregar PDF Audio con las 8 frecuencias canónicas industriales (250–8000 Hz) — para cobertura ≥80%.
  3. **DG-3:** entregar XLSX de valores de referencia espirometría (con LLN/ecuaciones GLI-2012 por etnia/edad/sexo/talla).
  4. **F-5:** confirmar la regla de promoción Audio a `tested` con ≥50% cobertura (4/8 frecs) — o revertir a `draft` hasta nuevo insumo AMI.
  5. Decidir archivado definitivo o retiro de `context/lote-nocturno-20260820-01/`.
- **Próximo paso INTEGRA:** ninguno en FIX-20260821-01 (handoff firmado, esperar a que ATLAS active SOFIA). Reactivación pendiente de autorización de Frank para ARCH-20260820-01 Fase 5, publicación V3, lote de seguimiento con insumos AMI reales, o decisión sobre `enabled` legacy V1/V2 + reenvío de `medical_test_id`.
