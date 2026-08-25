# SPEC-FEATURE-20260824-02 — Cuestionario emergente de Espirometría

- **Estado:** READY_FOR_SOFIA
- **Origen:** DEC-20260824-03
- **Prioridad:** P1 funcional
- **Autorización:** Frank autorizó migración Prisma para `event_tests.clinicalContext` JSON.

## Objetivo

Capturar antecedentes respiratorios y exploración física de Espirometría mediante un modal predominantemente seleccionable, asociado al `EventTest`, para reducir errores y aportar contexto al prediagnóstico IA.

## Alcance funcional

Modal activado desde el Event mediante `Completar cuestionario` / `Editar cuestionario`.

### Antecedentes

- Espirometría previa: No/Sí + rango de tiempo.
- Dificultad para respirar: No/Sí.
- Exposición a humos, vapores, gases, sustancias químicas, polvos o solventes: No/Sí + tipo catálogo/Otro + duración por rango.
- Fuma o fumó: No/Sí + cigarrillos por rango + desde cuándo/rango + dejó de fumar/rango cuando aplique.
- Epilepsia o enfermedad cardiaca/pulmonar: No/Sí + catálogo/Otro.
- Embarazo: No/Sí/No aplica.
- Medicamento inhalador/bronco­dilatador: No/Sí + catálogo/Otro.
- Procedimiento quirúrgico en últimos tres meses: No/Sí + catálogo/Otro.
- Observaciones opcionales.

### Exploración física

- Vías respiratorias superiores.
- Tórax.
- Pulmones.
- Cada campo usa estado seleccionable (Normal/Alterado/No realizado) y observación opcional sólo si corresponde.

Los datos personales/laborales del encabezado se reutilizan de la papeleta y no se duplican.

## Persistencia y contrato

- Agregar `clinicalContext Json?` a `EventTest` mediante migración Prisma.
- Payload versionado: `{ schemaVersion: "espirometria-questionnaire-v1", capturedAt, antecedentes, exploracionFisica, observaciones }`.
- Server Action/API con Zod server-side; guardar atómicamente por `eventTestId`; editar reemplaza el snapshot actual y conserva `updatedAt`.
- No guardar secretos ni duplicar PII innecesaria.
- Si no está contestado, permitir cargar/procesar PDF pero marcar contexto incompleto para IA.

## IA

Incluir `clinicalContext` estructurado en el contexto de MedGemma/DR7 cuando exista. No permitir que IA invente respuestas ausentes. Mantener modo sombra, criterios AMI, revisión médica y separación extracción/prediagnóstico.

## UI

- Modal antes del upload/procesamiento en el Event.
- Resumen compacto tras guardar: completado, fecha y Editar.
- No modificar criterios clínicos actuales ni panel de repetibilidad salvo integración de contexto.
- Accesible por teclado, cancelar no guarda, errores visibles.

## Criterios verificables

- AC-1: Modal muestra todas las preguntas del XLS de AMI sin duplicar datos personales.
- AC-2: Preguntas Sí/No, No aplica, rangos y catálogos; campos condicionales sólo cuando corresponden.
- AC-3: Guardar crea/actualiza `clinicalContext` del EventTest con schemaVersion.
- AC-4: Payload inválido es rechazado server-side con error visible.
- AC-5: Recargar Event muestra resumen y permite editar.
- AC-6: PDF puede cargarse sin cuestionario, pero IA recibe advertencia de contexto incompleto.
- AC-7: IA recibe el contexto cuando está guardado, sin inventar ausentes.
- AC-8: Audiometría y otros estudios no cambian.

## Validación

- V1: typecheck, Zod/server action y tests focales.
- V2: suite frontend/backend una vez.
- V3: Playwright del Event: abrir modal, completar selección condicional, guardar, editar, verificar payload/requests y procesar contexto.

## Prohibido

No duplicar PII, no usar texto libre como sustituto de catálogos, no bloquear upload por cuestionario incompleto, no cambiar prompt AMI fuera de añadir el contexto estructurado, no emitir diagnóstico/aptitud desde el formulario.
