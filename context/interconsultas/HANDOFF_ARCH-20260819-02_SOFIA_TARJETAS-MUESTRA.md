# HANDOFF_ARCH-20260819-02 — SOFIA: Tarjetas por prueba (prototipo no persistente)

~~~text
SPEC-HANDOFF
Origen: INTEGRA
ID tarea: ARCH-20260819-02
SPEC activa: context/SPECs/SPEC_ARCH-20260819-02-TARJETAS-MUESTRA-POR-PRUEBA.md
ADR: context/decisions/ADR-20260819-03-TARJETAS-MUESTRA-POR-PRUEBA.md
Referencias funcionales: DEC-20260819-01/02/03, BR-20260819-01, FLOW-20260819-01, SCN-20260819-01/02, FND-20260819-01
Resultado: 3 tarjetas por prueba (Examen Médico real + Audiometría/Espirometría fixtures) en la inner-tab "Impresión y Aptitud", encima del consolidado existente, no persistentes, con descargables deshabilitados.
Alcance de archivos/módulos:
  NUEVOS:
    - frontend/src/components/clinical/ResultadosPorPrueba.tsx
    - frontend/src/components/clinical/PruebaCard.tsx
    - frontend/src/lib/clinical/sample-test-cards.ts
    - frontend/src/components/clinical/__tests__/ResultadosPorPrueba.test.tsx
  MODIFICADOS (mínimo):
    - frontend/src/components/clinical/ExamenMedicoEstudio.tsx (import + render al inicio de la inner-tab 'impresion', antes de <LiveSummaryPreview>)
Contratos que cambian: ninguno (cambio UI aditivo, reversible).
Contratos protegidos (NO tocar):
  - LiveSummaryPreview.tsx (consolidado 9 campos)
  - selector de aptitud + APTITUD_OPTIONS (ExamenMedicoEstudio.tsx:1446-1471)
  - impresión diagnóstica/restricciones/observaciones/recomendaciones/médicos firmantes (ExamenMedicoEstudio.tsx:1537-1648)
  - buildPayload() y saveExamenMedicoPapeleta (no mutar form/aptitud)
  - buildExamSummary / buildVerdictFromExam / exam.schema.ts / Prisma / server actions / backend
Criterios AC: AC-1 a AC-15 (ver SPEC §11). Todos verificables por ejecución.
Casos borde: CB-1 form vacío; CB-2 estado no_aplica; CB-3 readonly; CB-4 fixtures sin PII; CB-5 props nulas (ver SPEC §8).
Validaciones detectadas:
  - npm run typecheck   (frontend/) -> 0 errores
  - npm test            (frontend/) -> todos verde (existentes + nuevos)
  - npm run lint        (frontend/) -> 0 errores nuevos
  - rg "@/actions" frontend/src/components/clinical/ResultadosPorPrueba.tsx frontend/src/components/clinical/PruebaCard.tsx -> 0 matches
  - rg -i "informacion para revision|AUDIO TA|AUDIO VO|ESPIRO OB|REPORTE DE EXAMEN MEDICO|datos AMI" frontend/src frontend/public -> 0 matches
Restricciones:
  - NO push. Commits locales granulares, sin push (Frank autoriza push después de auditar).
  - NO copiar PNG/PDF/DOCX/XLSX de context/datos AMI/ a public/ ni assets.
  - NO persistir muestra en MedicalExam/MedicalVerdict/datos del paciente.
  - NO descargables funcionales (botones disabled, etiqueta "Disponible al validar resultado").
  - NO tocar Prisma, migraciones, server actions, API, backend.
  - NO mover Impresión y Aptitud fuera de Examen Médico (DEC-20260819-02).
  - Fixtures 100% sintéticos: sin nombres, CURP, teléfonos, correos ni valores reales de pacientes.
  - data-testid obligatorios: resultados-por-prueba, prueba-card-{id}, prueba-card-{id}-estado/-resumen/-dictamen/-accion/-detalle/-toggle/-descarga.
Dependencias: ninguna nueva (React 19 + Tailwind + @testing-library/react + vitest ya en package.json).
DoD: AC-1..AC-14 verdes + AC-15 ejecutada o NO EJECUTADA justificada + reporte IMPL-REPORT.
Prohibido inferir: nombres de pacientes reales, valores clínicos reales, ni contratos de persistencia.
~~~

## Gate de independencia (paralelismo)

**Decisión: 1 SOFIA secuencial.** La tarea NO es paralelizable:

- **Grupo A (archivos nuevos):** `ResultadosPorPrueba.tsx`, `PruebaCard.tsx`, `sample-test-cards.ts`, test.
- **Grupo B (integración):** `ExamenMedicoEstudio.tsx` importa `ResultadosPorPrueba` del Grupo A.

Existe **dependencia de orden runtime** (B importa A) y **conjuntos de archivos no disjuntos en el contrato** (B depende del export de A). No se puede producir evidencia de cero acoplamiento. Por la tabla de paralelismo (INTEGRA §19): tarea con dependencias internas fuertes → secuencial, 1 SOFIA.

## Notas operativas para SOFIA

- **Ubicación exacta de integración:** `frontend/src/components/clinical/ExamenMedicoEstudio.tsx`, dentro del bloque `activeInnerTab === 'impresion'` (alrededor de la línea 1426, dentro del `<div className="space-y-4">`). Inserta `<ResultadosPorPrueba form={form} aptitud={aptitud} readonly={readonly} />` como **primer hijo**, antes de `<LiveSummaryPreview form={form} />` (línea 1444).
- **Derivación de la tarjeta Examen Médico (datos reales):**
  - `resumen` ← `form.examen_medico_texto ?? form.impresion_diagnostica ?? ''` (slot nuevo con fallback legacy, mismo patrón que `pickText` en `exam-summary.ts:109`).
  - `dictamen` ← `aptitud || 'Pendiente de resultado'` (literal DA-1 cuando existe).
  - `estado` ← derivar: si `aptitud` no vacío → `'validada'`; si `resumen` no vacío → `'lista_para_revision'`; sino `'incompleta'`.
  - `isSample` ← `false`. `accionLabel` ← `'Ver detalle'`.
- **Fixtures Audiometría/Espirometría:** valores sintéticos ilustrativos (p.ej. audiometría: "PTA OD 15 dB / OI 20 dB — rango normal"; espirometría: "FVC 92% pred. · FEV1/FVC 0.78 — restrictivo leve"). `isSample` ← `true`. `accionLabel` ← `'Ver papeleta'`. `estado` representativo (`'validada'` o `'lista_para_revision'`).
- **Etiqueta de muestra:** la sección y cada tarjeta `isSample === true` muestran el literal `Vista de muestra — no se guarda`.
- **Descargables:** renderiza un botón `disabled` por tarjeta con `data-testid="prueba-card-{id}-descarga"` y texto `Disponible al validar resultado`.
- **Estructura clínica de referencia:** SOFIA puede consultar `context/datos AMI/informacion para revision/AUDIO TA.png`, `AUDIO VO .png`, `ESPIRO OB.png` y `PROGRAMA PARA REALIZAR AUDIOMETRÍA.docx` **solo** para entender el layout/campos. **Prohibido** transcribir PII; los fixtures deben ser sintéticos.
- **Tests:** usar vitest + @testing-library/react (patrón existente en `frontend/src/**/__tests__`). Cubrir AC-1 a AC-11 como mínimo. AC-15 (Playwright) es opcional según sandbox; si no corre, declarar `NO EJECUTADA` con justificación.
- **Estado previo de gates:** el frontend tiene baseline verde (typecheck 0, vitest 273+/273+, lint 0). Preservar verde; no introducir regresiones.
- **Reporte:** entregar IMPL-REPORT con archivos modificados, criterios AC cubiertos, comandos ejecutados + resultado, y estado `READY_FOR_VERIFYING` o `BLOCKED`.
