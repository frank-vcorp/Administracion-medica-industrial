# SPEC-FEATURE-20260914-01 — Campimetría: captura manual + prediagnóstico IA

- **Estado:** IN_PROGRESS
- **Origen:** Minuta AMI-SR F-017 #15 + `CAMPIMETRÍA.xlsx` (formato 005-2018)
- **Prioridad:** P1 funcional

## Objetivo

Cuando `CAMPIMETRIA` está en la papeleta, el médico **llena un formulario** (confrontación + Ishihara + exploración oftalmológica). **No hay alta de PDF**: no existe máquina que entregue archivo.

Dos capas:

1. **Captura** — solo lo propio de la prueba. No se re-teclea lo que ya está en la papeleta.
2. **Prediagnóstico IA** — el mismo recuadro que audiometría y espirometría: la IA sugiere un hallazgo; el médico lo aprueba o escribe el suyo. **No se muestra preview del formato 005-2018.**

## Hereda (solo lectura)

Nombre, edad, empresa, fecha, médico de sesión. Diabetes / HTA / cirugías del expediente. Agudeza Snellen de agudeza visual o examen médico. Si falta agudeza: “Pendiente en papeleta”.

## Captura (clics; texto solo si Alterado / Otro)

- Uso de lentes y cirugías oculares (SI/NO + detalle condicional).
- Exploración OD/OI: movimientos, reflejos, pupilas, conjuntiva, esclera, fondo, anexos. Default Normal (plantilla Excel).
- Confrontación OD/OI: combo normal / alterados / no aplica. Dos PNGs fijos (`confrontacion-oi.png`, `confrontacion-od.png`).
- Ishihara: Normal ambos ojos (rellena 12, 45, 3, 5, 2, 26, 74) o Alterado (número por placa). Una tira fija (`ishihara.png`). Reemplazo en `frontend/public/clinical/campimetria/`.
- Aptitud: combo.

## Prediagnóstico (igual que el resto de estudios)

Al guardar, se dispara `prediagnosis-from-params` con los parámetros de captura. El panel `StudyAIPrediagnosisPanel` muestra la sugerencia; el médico valida o edita el diagnóstico.

## Persistencia

`EventTest.clinicalContext` versionado `campimetria-questionnaire-v1`. Zod server-side. Completar → `COMPLETED`; borrador → `RESULT_REGISTERED`.

## Fuera de alcance (esta entrega)

PDF firmado/pyHanko. Dropzone. Gráficas editables. Preview 005-2018 en papeleta.
