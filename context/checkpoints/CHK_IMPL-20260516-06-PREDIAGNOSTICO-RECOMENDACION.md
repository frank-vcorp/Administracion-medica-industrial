# CHECKPOINT IMPL-20260516-06 — Prediagnóstico IA: Recomendación Clínica Visible

**Fecha:** 2026-05-16  
**ID de Intervención:** IMPL-20260516-06  
**SPEC de Referencia:** `context/SPECs/SPEC_ARCH-20260516-06-PREDIAGNOSTICO-CON-RECOMENDACION-CLINICA.md`  
**Handoff de Origen:** `context/interconsultas/HANDOFF_ARCH-20260516-06_SOFIA_RECOMENDACION-PREDIAGNOSTICO.md`

---

## Resumen de Entrega

Se implementó el slice mínimo para agregar un campo `recommendation` (recomendación clínica prudente) al prediagnóstico IA. El cambio cubre el contrato completo: schema → prompt → UI.

---

## Archivos Modificados

| Archivo | Cambio |
|---------|--------|
| `backend/app/schemas/medical.py` | Campo `recommendation: Optional[str] = None` agregado a `AIPrediagnosisResult` (con docstring de guardrail) |
| `backend/app/services/ai/prediagnostic.py` | Prompt de Audiometría actualizado con regla 9 que exige y guía el campo `recommendation`. Todos los prompts restantes (Laboratorio, Espirometría, Rayos_X, ECG, Somatometría, AgudezaVisual, ExamenMedico) tienen `"recommendation": null` en su JSON de ejemplo para compatibilidad hacia adelante |
| `frontend/src/components/clinical/StudyAIPrediagnosisPanel.tsx` | Interfaz `AIPrediagnosisData` extendida con `recommendation?: string | null`. Bloque visual "Seguimiento sugerido" renderizado después de la barra de confianza, con estilo `bg-teal-50` distinguible |

---

## Criterios de Aceptación — Estado

| Criterio | Estado |
|----------|--------|
| 1. Nuevo prediagnóstico de Audiometría devuelve campo `recommendation` en payload | ✅ Prompt exige el campo; schema lo acepta |
| 2. `recommendation` se persiste sin romper snapshots previos | ✅ `Optional[str] = None` — snapshots viejos sin el campo deserializan correctamente |
| 3. Tarjeta muestra sección visible "Seguimiento sugerido" | ✅ Renderizado condicionado `{predxData.recommendation && ...}` |
| 4. Recomendación nunca expresa aptitud, dictamen ni tratamiento prescriptivo | ✅ Regla explícita PROHIBIDO en el prompt. El schema no lo valida (responsabilidad del LLM + revisión médica). |
| 5. Si `AI_NON_CONCLUSIVE`, la recomendación se adapta al estado | ✅ Regla 9 del prompt cubre el caso non_conclusive con wording de "repetir estudio / validar calidad" |

---

## Guardrails Activos (no modificados)

- El bloque de advertencia "Modo sombra clínica" permanece intacto en la UI.
- La restricción contra aptitud laboral y dictamen final está reforzada en el prompt (regla 2 explícita más precisa que antes).
- El campo `recommendation` en el schema tiene docstring explícito de lo que PROHÍBE.

---

## Compatibilidad con Snapshots Históricos

- `recommendation: Optional[str] = None` → snapshots sin el campo cargan como `None`.
- La UI usa `{predxData.recommendation && (...)}` → no renderiza nada si `recommendation` es `null` o `undefined`.
- **Sin migraciones de base de datos necesarias.** El campo vive en el JSON de `prediagnosisData` del snapshot, no en columnas.

---

## Validación Ejecutada

- Gate 1 (Compilación): `get_errors` en los 3 archivos → 0 errores.
- Gate 2 (Testing): Validación de contrato bloqueada por sandbox en este entorno. Se verificó manualmente que:
  - `Optional[str] = None` es el patrón correcto en Pydantic V2 para retrocompatibilidad.
  - El bloque JSX `{predxData.recommendation && (...)}` es el patrón seguro para `string | null | undefined` en React/TSX.
  - El prompt de Audiometría incluye el ejemplo JSON con `recommendation` string no-null para caso conclusivo.
- Gate 3 (Revisión de código): Revisión interna realizada. Cambio acotado a 3 archivos, sin side effects.
- Gate 4 (Documentación): Este checkpoint y los comentarios en código (`IMPL-20260516-06`).

---

## Riesgos Residuales

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| El LLM podría generar `recommendation` que contenga lenguaje de aptitud laboral | Medio | Regla PROHIBIDO explícita en el prompt. El médico debe revisar antes de usar. El bloque de guardrail visual está intacto. |
| Snapshots viejos muestran sección "Seguimiento sugerido" vacía (no renderizada) | Bajo | Controlado por `{predxData.recommendation && ...}` |
| Proveedor Featherless/MedGemma podría ignorar el campo `recommendation` en algunos modelos | Bajo | El campo es `Optional`; si el LLM no lo produce, el parser Pydantic lo deja como `None` y la UI no lo muestra |
| No se reprocesaron snapshots históricos | Información | La SPEC excluye explícitamente el reprocesamiento masivo |

---

## Siguiente Paso Sugerido

Reprocesar una Audiometría real en el entorno para confirmar que el LLM efectivamente produce el campo `recommendation` con el nuevo prompt. Validar que el wording sea clínico y prudente antes de considerar el slice cerrado en Gate 2.
