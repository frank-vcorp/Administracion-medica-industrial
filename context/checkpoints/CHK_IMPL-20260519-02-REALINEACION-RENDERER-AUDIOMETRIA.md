# Checkpoint IMPL-20260519-02 — Realineación Renderer Audiometría

**Fecha:** 2026-05-19  
**Agente:** SOFIA - Builder  
**ID:** IMPL-20260519-02  
**SPEC:** context/SPECs/SPEC_ARCH-20260519-02-REALINEACION-RENDERER-AUDIOMETRIA-PAYLOAD-REAL.md  
**HANDOFF:** context/interconsultas/HANDOFF_ARCH-20260519-02_SOFIA_REALINEACION-RENDERER-AUDIOMETRIA.md

---

## Hipótesis falsable aplicada

`getValueAtPath(data, "oido_derecho.via_aerea")` devolvía `undefined` porque el payload real usa `.va`/`.vo`. El renderer ya usaba la infraestructura correcta (`getValueAtPath` con dot-notation); el único error era en las rutas configuradas en el schema.

**Check discriminante:** `get_errors` sobre los dos archivos del slice → **0 errores TypeScript**.

---

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `frontend/src/components/clinical/extraction-presentation-schemas.ts` | Único archivo modificado |

---

## Resumen exacto del cambio

Dentro de `audiometriaSchema` (solo lectura de datos, sin tocar renderer):

| Antes (legacy) | Después (payload real) |
|----------------|----------------------|
| `sourceKey: "paciente"` | `sourceKey: "paciente_detalle"` |
| `fields: ["completitud_documental", "notas_calidad"]` (objeto serializado) | `fields: ["completitud_documental"]` + sección `note` con `source: "notas_calidad.descripcion"` |
| `kind: "keyValue", sourceKey: "resumen_oidos", fields: ["pta_d", "pta_i"]` | Dos secciones `keyValue`: `sourceKey: "oido_derecho", fields: ["pta_visible"]` y `sourceKey: "oido_izquierdo", fields: ["pta_visible"]` |
| `rightKey: "oido_derecho.via_aerea"` | `rightKey: "oido_derecho.va"` |
| `leftKey: "oido_izquierdo.via_aerea"` | `leftKey: "oido_izquierdo.va"` |
| `rightKey: "oido_derecho.via_osea"` | `rightKey: "oido_derecho.vo"` |
| `leftKey: "oido_izquierdo.via_osea"` | `leftKey: "oido_izquierdo.vo"` |

El caso especial `section.sourceKey === "resumen_oidos"` en `SectionBlock` queda inerte (ninguna sección lo usa ya) — no se eliminó para no tocar el renderer.

---

## Validación ejecutada

- `get_errors` en `extraction-presentation-schemas.ts` → **0 errores**  
- `get_errors` en `ClinicalExtractionRenderer.tsx` → **0 errores**  
- `vscode_listCodeUsages` en `audiometriaSchema` → solo 2 referencias internas (definición + registro), ningún contrato externo roto.

---

## Soft Gates

| Gate | Estado |
|------|--------|
| 1. Compilación (tsc) | ✅ 0 errores |
| 2. Testing | ⚠️ Sin tests automáticos para schemas de presentación — validación visual requerida con payload real |
| 3. Revisión | ✅ Cambio mínimo, 1 archivo, rutas confirmadas contra payload real de SPEC |
| 4. Documentación | ✅ Watermark `@realigned IMPL-20260519-02` en el archivo, checkpoint generado |

---

## Riesgos residuales

1. **`oido_derecho.separacion`** — se conservó tal cual (no estaba en el alcance de la SPEC). Si el payload real tampoco la entrega, esa tabla simplemente no renderizará (comportamiento silencioso correcto: `BilateralFrequencyTableBlock` retorna `null` si no hay frecuencias).
2. **`buildAudiometriaSummary`** en el renderer queda muerto (lee `pta_d`/`pta_i` que ya no existen). No causa error en runtime ni en TS (es una función interna), pero acumula deuda técnica. Candidata a limpieza en refactor futuro.
3. **Validación visual pendiente:** requiere carga de un estudio Audiometría real en UI para confirmar que las tablas aparecen correctamente. El Gate 2 queda abierto hasta esa verificación.
