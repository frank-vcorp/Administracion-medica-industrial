# CIERRE-LOTE — LOTE-20260820-01 (lote nocturno Audio/Espiro)

- **Lote:** `LOTE-20260820-01` (loteId único)
- **Ventana:** 2026-08-20 23:48 → 2026-08-21 07:00 America/Mexico_City
- **Cierre INTEGRA:** 2026-08-21 00:30 CST (Unidad 6)
- **Autorización:** `DEC-20260820-04` + `FND-20260820-05`
- **SPEC:** `context/SPECs/SPEC_LOTE-20260820-01-NOCTURNO-AUDIO-ESPIRO.md` v1.0
- **Handoff SOFIA:** `context/interconsultas/HANDOFF_LOTE-20260820-01_SOFIA_AUDIO-ESPIRO.md`
- **Veredicto QA:** `context/reviews/QA-20260820-08-LOTE-NOCTURNO-AUDIO-ESPIRO.md` → **PASS_WITH_WARNINGS** (severidad mayor P1: 2 hallazgos no bloqueantes; P2: 2; P3: 1)
- **Estado final recomendado:** **`DONE (pendiente-revisión-Frank)`** — lote cerrado; sin V3 publicadas, sin commit/push, sin PII, sin secretos.

---

## 1. Resultado

| Prueba | Calibración V3 resultante | Estado publicación |
|---|---|---|
| **Audiometría** | `audiometria-v3-tested.json` (8 frecs canónicas, cobertura 4/8 con valor directo del PDF SAAVEDRA) | `status='tested'` — **NO published** |
| **Espirometría** | `espirometria-v3-draft.json` (FVC/FEV1/FEV1-FVC/FEF25-75 vía OCR; LLN sin ref) | `status='draft'` — **NO tested, NO published** |

- **IA sólo describe:** cero diagnóstico y cero aptitud emitida por el lote.
- **`AI_NON_CONCLUSIVE` validado:** `audio-non-conclusive.html` muestra `'AI_NON_CONCLUSIVE'` + razón `'parametros_minimos_faltantes'` + atributo `data-ai-flag`.
- **Evidencia:** `context/lote-nocturno-20260820-01/evidencia/` (27 archivos: 5 PNG, 5 accessibility, 5 HTML mocks, 2 snapshots V3, 2 fixtures extracción, 12 hashes SHA-256, playwright config + spec).

## 2. AC verificados (15/15 PASS o NO PROCEDE justificado)

PASS: AC-1.1, AC-1.2 (adaptado sin BD), AC-1.3, AC-1.4, AC-2.1, AC-2.2, AC-2.3, AC-2.5, AC-3.1, AC-3.2, AC-3.3, AC-3.4 (con caveat), AC-4.1, AC-4.2 (condicional), AC-4.3, AC-4.4, AC-6.1..6.4. NO PROCEDE justificado: AC-2.4 (PDF sólo 4/8 frecs).

## 3. Restricciones duras verificadas (10/10 PASS)

WIP=1, sin commit/push/deploy/migración, sin `published` V3, sin secretos/`.env`, sin PII persistida, sin aptitud/diagnóstico IA, `context/datos AMI/**` intacto (`find … -newer /tmp/kilo/.lote-start` → 0), `AI_NON_CONCLUSIVE` visible con razón, una sola `notify_user` al cierre.

## 4. GAPS — catálogo priorizado y decisiones matinales

### P1 (3) — bloquean promoción exhaustiva; decisión matinal de Frank

| ID | Descripción | Owner propuesto | Decisión matinal |
|---|---|---|---|
| **DG-1** | AMI no entrega PDF espirometría real (sólo PNG; faltan PPTx de patrones) | **ATLAS→Frank** | Frank entrega PDF Sibelmed W20s + PPTx patrones |
| **DG-2** | PDF SAAVEDRA AUDIO sólo expone 4/8 frecs canónicas | **ATLAS→Frank** | Frank entrega PDF Audio con 8 frecs (250–8000 Hz) |
| **DG-3** | `VALORES DE REFERENCIA.xlsx` sin hoja espirometría/LLN | **ATLAS→Frank** | Frank entrega XLSX de valores de referencia espirometría (GLI-2012) |

### P2 (3) — calidad/auditoría

DG-4 (snapshot local en lugar de SELECT, sin BD local), DG-5 (extracciones simuladas), DG-6 (Chromium binario reutilizado).

### P3 (2) — cosméticos

DG-7 (catálogo AMI 51 vs 13 SPEC), DG-8 (schema snapshot espiro ≠ `_ESPIROMETRIA_CANONICAL_KEYS`).

## 5. Hallazgos QA (F-1..F-5) y decisiones matinales

| ID | Sev | Owner | Decisión matinal |
|---|---|---|---|
| **F-1** | P1 | SOFIA (INTEGRA documenta) | Frank confirma regla de promoción con simulación: regenerar fixture con OCR de mayor fidelidad (psm 6 + revisión 9 filas) o aceptar divergencia |
| **F-2** | P1 | SOFIA (INTEGRA documenta) | Frank confirma demografía `paciente_detalle` desde filename vs PDF; próximo lote: tolerar nulls cuando PDF no expone |
| **F-3** | P2 | INTEGRA | Aceptar: mocks HTML ≠ renderer real; aclarar en `EVIDENCIA-RENDERER.md §1` que son evidencia de contrato, no del renderer real |
| **F-4** | P2 | INTEGRA | Ya registrado como DG-7; sin acción adicional |
| **F-5** | P3 | INTEGRA | **Frank confirma regla de promoción Audio a `tested` con ≥50% cobertura** (4/8 frecs canónicas sin campos contradictorios) — o revertir a `draft` hasta nuevo insumo AMI |

## 6. Acciones para Frank al regreso

1. **Decidir F-5** (regla de promoción Audio 50%).
2. **Aprobar próximos pasos DG-1/DG-2/DG-3** (entrega de insumos reales).
3. **Confirmar archivado o retiro** de `context/lote-nocturno-20260820-01/` (reversibilidad 100%).

---

**Notas de reversión (NO ejecutar):** carpeta del lote retirable en cualquier momento; ningún commit/push; rama `main` intacta en lo que el lote tocó.
