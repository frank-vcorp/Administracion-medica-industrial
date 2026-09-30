# SPEC_ARCH-20260819-02 — Tarjetas por prueba (prototipo no persistente) en Impresión y Aptitud

- **ID:** SPEC_ARCH-20260819-02
- **Estado:** READY
- **Versión:** 1.0
- **Propietario:** INTEGRA
- **Intervención arquitectónica:** ARCH-20260819-02
- **ADR relacionado:** ADR-20260819-03
- **Checkpoint funcional:** DEC-20260819-02, DEC-20260819-03, OQ-20260819-04 (deferred)

## 1. Resultado

Añadir a la inner-tab **Impresión y Aptitud** del `ExamenMedicoEstudio` una sección **no persistente** de **3 tarjetas por prueba** (Examen Médico, Audiometría, Espirometría) renderizada **encima** del consolidado existente (`LiveSummaryPreview` + selector de aptitud + impresión diagnóstica). El prototipo valida visualmente el contrato de "resultados por prueba" antes de conectar extracción/descargables reales. Audiometría y Espirometría usan **fixtures anonimizados**; Examen Médico consume el resumen real existente.

## 2. Fuentes funcionales por ID

- **DEC-20260819-01** — dictámenes por prueba antes del consolidado.
- **DEC-20260819-02** — mantener Impresión y Aptitud bajo Examen Médico (no mover navegación).
- **DEC-20260819-03** — validar tarjetas con papeletas de muestra antes de cerrar entregables.
- **BR-20260819-01** — separación y consolidación de dictámenes (reglas 1-5).
- **FLOW-20260819-01** — flujo de impresión y aptitud.
- **SCN-20260819-01** — médico consolidad atención con varias pruebas.
- **SCN-20260819-02** — atención con una prueba no aplicable.
- **FND-20260819-01** — falta de paneles por prueba.
- **OQ-20260819-04** — deferred (DEC-20260819-02 la resuelve por ahora).

## 3. Alcance y exclusiones técnicas

### Incluir
- Nuevo componente presentacional `ResultadosPorPrueba` + subcomponente `PruebaCard`.
- Módulo de fixtures tipados y anonimizados `sample-test-cards.ts` (sólo frontend, no expuesto al backend).
- Estado local de expandir/contraer por tarjeta.
- Integración en `ExamenMedicoEstudio.tsx` (render al inicio de la inner-tab `impresion`).
- Tests de renderizado, no-persistencia, etiquetas de muestra, expandir/contraer y no-regresión del consolidado.
- Commit granular local (sin push).

### Excluir
- Extracción real de PDF/PNG/DOCX.
- IA real de Audiometría/Espirometría.
- Generación de PDFs individuales y ZIP final.
- Descargables funcionales (botones presentes pero `disabled`).
- Cambios a Prisma, migraciones, server actions, API routes, backend.
- Copiar archivos de `context/datos AMI/` a `public/` o assets desplegados.
- Mover Impresión y Aptitud fuera de Examen Médico (DEC-20260819-02).

## 4. Código observado y referencias de archivo/línea

- `frontend/src/components/clinical/ExamenMedicoEstudio.tsx:1424-1444` — inicio de la inner-tab `impresion`; hoy arranca con `<LiveSummaryPreview form={form} />`. La nueva sección se inserta **antes** de esa línea, dentro del mismo `<div className="space-y-4">` (línea 1426).
- `frontend/src/components/clinical/ExamenMedicoEstudio.tsx:1446-1471` — selector de aptitud (CONST. PROTEGIDO: no modificar).
- `frontend/src/components/clinical/ExamenMedicoEstudio.tsx:1537-1648` — impresión diagnóstica, restricciones, observaciones, recomendaciones, médicos firmantes (CONST. PROTEGIDO: no modificar).
- `frontend/src/components/clinical/LiveSummaryPreview.tsx` — consolidado de 9 campos (CONST. PROTEGIDO: no modificar; se sigue renderizando intacto debajo de las tarjetas).
- `frontend/src/lib/clinical/exam-summary.ts` — `buildExamSummary`, `EXAM_SUMMARY_LABELS`, tipos `ExamSnapshot`/`IaResults`/`ExamSummary`. El modelo ya soporta slots por prueba (`audiometria_texto`, `espirometria_texto`, etc.).
- `frontend/src/lib/clinical/verdict.builder.ts` — `buildVerdictFromExam` ya concatena los 5 slots por prueba.
- `frontend/src/schemas/clinical/exam.schema.ts` — catálogos ZIN (no se modifican).
- Estado `form` (líneas 297-305) y `aptitud` (líneas 306-308) del componente padre: la tarjeta Examen Médico los lee en modo read-only; **no** los muta.

## 5. Contratos afectados y protegidos

### Afectados (aditivo, reversible)
- Contrato de UI de la inner-tab `impresion`: añade una sección visual encima del consolidado. Eliminarla = borrar 1 import + 1 render + los archivos nuevos. Cero migración.

### Protegidos (no tocar)
- `LiveSummaryPreview` y los 9 campos del resumen ejecutivo.
- Selector de aptitud y `APTITUD_OPTIONS` (5 valores canónicos DA-1).
- Persistencia vía `saveExamenMedicoPapeleta` y `buildPayload()`.
- `buildExamSummary` / `buildVerdictFromExam`.
- Schema Prisma, server actions, backend, API.

## 6. Modelo técnico (contrato, sin código de producción)

### 6.1 Ubicación y render
La sección se renderiza dentro de la inner-tab `impresion` (`activeInnerTab === 'impresion'`), como **primer hijo** del contenedor existente, antes de `<LiveSummaryPreview form={form} />`. No crea una nueva pestaña ni nueva outer-tab.

### 6.2 Contrato de tipos (firmas, no implementación)

```ts
// frontend/src/lib/clinical/sample-test-cards.ts
export type PruebaId = 'examen_medico' | 'audiometria' | 'espirometria'
export type PruebaCardStatus =
  | 'pendiente' | 'incompleta' | 'lista_para_revision'
  | 'validada' | 'no_aplica'

export interface PruebaCardData {
  id: PruebaId
  nombre: string
  estado: PruebaCardStatus
  resumen: string        // resumen clínico breve (1-3 líneas)
  dictamen: string       // dictamen individual de esa prueba
  accionLabel: string    // "Ver detalle" | "Ver papeleta"
  isSample: boolean      // true para fixtures audiometría/espirometría
  detalleExtra?: string  // contenido mostrado al expandir (opcional)
}
```

### 6.3 Prop del componente presentacional
```ts
// ResultadosPorPrueba recibe el form real para derivar la tarjeta Examen Médico
export interface ResultadosPorPruebaProps {
  form: Record<string, string>   // snapshot físico existente (read-only)
  aptitud: string               // aptitud seleccionada (read-only)
  readonly?: boolean
}
```

### 6.4 Origen de datos por tarjeta
| Tarjeta | Origen resumen | Origen dictamen | isSample |
|---|---|---|---|
| Examen Médico | derivado de `form` (`impresion_diagnostica` / `examen_medico_texto`) | `aptitud` (literal DA-1) o `"Pendiente de resultado"` | `false` |
| Audiometría | fixture anonimizado | fixture anonimizado | `true` |
| Espirometría | fixture anonimizado | fixture anonimizado | `true` |

### 6.5 Fixtures anonimizados
`sample-test-cards.ts` exporta constantes `AUDIO_FIXTURE` y `ESPIRO_FIXTURE` con valores **sintéticos** derivados de la estructura clínica (frecuencias 250-8000 Hz + PTA por oído para audiometría; FVC/FEV1/FEV1-FVC para espirometría). **Prohibido:** nombres, CURP, teléfonos, correos o cualquier dato personal extraído de las muestras AMI. El resumen debe ser claramente ilustrativo (p.ej. "PTA OD 15 dB / OI 20 dB — rango normal").

## 7. Reglas e invariantes

1. **No persistencia:** `ResultadosPorPrueba` no importa nada de `@/actions/*` ni de backend; no muta `form`, `aptitud` ni estado del padre. Sólo lee `form`/`aptitud` (read-only).
2. **No fuga de datos:** ningún archivo de `context/datos AMI/` se referencia en `import`, se copia a `public/` ni entra al bundle del frontend.
3. **Etiqueta de muestra obligatoria:** la sección y cada tarjeta con `isSample === true` muestran el literal **`Vista de muestra — no se guarda`**.
4. **Descargables no funcionales:** cualquier botón de descarga se renderiza `disabled` con etiqueta `Disponible al validar resultado`. No hay handler funcional.
5. **Consolidado intacto:** `LiveSummaryPreview`, selector de aptitud, impresión diagnóstica, recomendaciones y médicos firmantes siguen renderizándose y funcionando sin cambios debajo de las tarjetas.
6. **Orden DOM:** la sección de tarjetas precede al consolidado en el árbol DOM de la inner-tab `impresion`.
7. **Accesibilidad/consistencia:** estilos Tailwind coherentes con la UI existente (tarjetas `bg-white border border-slate-200 rounded-xl`), soportan modo `readonly`.
8. **Expandir/contraer:** cada tarjeta expone un toggle que revela/oculta su detalle. El comportamiento exacto (acordeón vs. independiente) es decisión reversible interna de SOFIA; el contrato exige que al menos una tarjeta pueda expandirse y mostrar su detalle.

## 8. Casos borde y errores

- **CB-1 form vacío:** si `impresion_diagnostica` y `aptitud` están vacíos, la tarjeta Examen Médico muestra estado `pendiente`/`incompleta` y un placeholder de resumen, sin lanzar error.
- **CB-2 estado `no_aplica`:** una tarjeta con `estado === 'no_aplica'` muestra badge "No aplica" y no se trata como pendiente (SCN-20260819-02). Aunque el prototipo muestra 3 tarjetas fijas, el componente debe renderizar el badge correctamente si se le pasa ese estado.
- **CB-3 readonly:** en modo `readonly`, las tarjetas se renderizan; los toggles de expansión siguen funcionales (es sólo visualización); los botones de descarga siguen `disabled`.
- **CB-4 fixtura sin PII:** los fixtures no contienen patrones de PII (CURP `^[A-Z]{4}\d{6}` , correos, teléfonos `^\d{10}$`).
- **CB-5 props nulas:** `form` puede ser `{}`; el componente no asume claves presentes.

## 9. Seguridad, privacidad y permisos

- **Privacidad (crítico):** las muestras en `context/datos AMI/informacion para revision/` pueden contener datos de personas. SOFIA puede **consultarlas** sólo para entender la estructura de layout, pero **prohibido** transcribir nombres, IDs, CURP, fechas de nacimiento, teléfonos, correos o valores reales de pacientes. Los fixtures son 100% sintéticos.
- **No copiar archivos:** ningún `.png/.pdf/.docx/.xlsx` de AMI se copia a `public/`, assets ni DB.
- **No persistir muestra:** nada del prototipo se guarda en `MedicalExam.physicalExamData`, `MedicalVerdict` ni datos del paciente.
- **No descargables:** sin generación de PDF/ZIP ni endpoints de descarga.
- **Permisos:** sin cambios de auth/RBAC; el componente hereda el modo `readonly` del padre.

## 10. Migración/compatibilidad

Ninguna. No toca Prisma, migraciones, backend ni server actions. Compatibilidad total con datos legacy: el slot `examen_medico_texto`/`impresion_diagnostica` ya existe y se lee sin escribir.

## 11. Criterios de aceptación (verificables por ejecución)

- **AC-1** Sección al inicio del consolidado. Al renderizar la inner-tab `impresion`, el nodo `data-testid="resultados-por-prueba"` aparece **antes** (orden DOM menor) que `data-testid="live-summary-preview"`.
- **AC-2** 3 tarjetas con nombres correctos: existen `data-testid="prueba-card-examen_medico"`, `"prueba-card-audiometria"`, `"prueba-card-espirometria"`, con encabezados "Examen Médico", "Audiometría", "Espirometría".
- **AC-3** Cada tarjeta expone estado, resumen, dictamen y acción: existen `data-testid="prueba-card-{id}-estado"`, `-resumen`, `-dictamen`, `-accion`.
- **AC-4** Etiqueta de muestra presente: el texto `Vista de muestra — no se guarda` aparece al menos en la sección global y en las tarjetas Audiometría y Espirometría (las dos fixtures).
- **AC-5** Expandible: un nodo `data-testid="prueba-card-audiometria-detalle"` está oculto inicialmente; tras click en `data-testid="prueba-card-audiometria-toggle"` queda visible.
- **AC-6** No-regresión consolidado: `data-testid="live-summary-preview"` sigue presente y los 9 labels de `EXAM_SUMMARY_LABELS` se renderizan; el selector de aptitud renderiza las 5 opciones `APTITUD_OPTIONS`.
- **AC-7** Descargables no funcionales: todo `data-testid="prueba-card-{id}-descarga"` está `disabled` y su texto contiene `Disponible al validar resultado`.
- **AC-8** No persistencia (aislamiento): el componente `ResultadosPorPrueba` **no importa** nada de `@/actions/*` ni muta props. Validación: `rg "@/actions" frontend/src/components/clinical/ResultadosPorPrueba.tsx frontend/src/components/clinical/PruebaCard.tsx` → 0 matches.
- **AC-9** No fuga de datos (estático): `rg -i "informacion para revision|AUDIO TA|AUDIO VO|ESPIRO OB|REPORTE DE EXAMEN MEDICO|datos AMI" frontend/src frontend/public` → 0 matches; y `frontend/public` no contiene archivos AMI.
- **AC-10** Fixtures sin PII: test afirma que `AUDIO_FIXTURE`/`ESPIRO_FIXTURE` no contienen regex de CURP `^[A-Z]{4}\d{6}`, correo `@`, ni teléfono `^\d{10}$`; y que `isSample === true` para ambos.
- **AC-11** Examen Médico consume datos reales: renderizando con `form.impresion_diagnostica = "Hallazgo X"` y `aptitud = "APTO"`, la tarjeta `prueba-card-examen_medico` refleja ese resumen/dictamen y `isSample === false`.
- **AC-12** `npm run typecheck` → 0 errores.
- **AC-13** `npm test` → todos los tests pasan (existentes + nuevos de `ResultadosPorPrueba`).
- **AC-14** `npm run lint` → 0 errores nuevos (no regresión vs baseline verde).
- **AC-15** Validación funcional Playwright E2E cubriendo: navegar a papeleta con examen médico completo → abrir inner-tab "Impresión y Aptitud" → afirmar 3 tarjetas visibles + consolidado presente + etiqueta de muestra. **Si el sandbox no permite E2E**, declarar `NO EJECUTADA` con justificación (queda pendiente para Frank en prod).

## 12. Validaciones detectadas y salida esperada

| Comando | Salida esperada |
|---|---|
| `npm run typecheck` (en `frontend/`) | `exit 0`, 0 errores |
| `npm test` (en `frontend/`) | todos verde, incluye nuevos tests del componente |
| `npm run lint` (en `frontend/`) | 0 errores nuevos |
| `rg "@/actions" frontend/src/components/clinical/ResultadosPorPrueba.tsx frontend/src/components/clinical/PruebaCard.tsx` | 0 matches (AC-8) |
| `rg -i "informacion para revision|AUDIO TA|AUDIO VO|ESPIRO OB|REPORTE DE EXAMEN MEDICO|datos AMI" frontend/src frontend/public` | 0 matches (AC-9) |
| Playwright E2E (opcional, sandbox) | 3 tarjetas + consolidado + badge muestra (AC-15) |

## 13. Rollback recomendado (no ejecución)

Reversible total: `git revert` de los commits del prototipo, o eliminar:
- `frontend/src/components/clinical/ResultadosPorPrueba.tsx`
- `frontend/src/components/clinical/PruebaCard.tsx`
- `frontend/src/lib/clinical/sample-test-cards.ts`
- `frontend/src/components/clinical/__tests__/ResultadosPorPrueba.test.tsx`
- y el import + render añadido en `ExamenMedicoEstudio.tsx`.

Cero migración, cero cambio de contrato persistente. INTEGRA recomienda; Frank autoriza la ejecución.

## 14. Riesgos y pendientes

- **R-1** Confusión visual entre tarjetas de muestra y datos reales → mitigado por AC-4 (etiqueta obligatoria) y AC-10 (fixtures sin PII).
- **R-2** Frank puede pedir cambios de layout tras revisar (esperable, es prototipo) → los componentes nuevos son presentacionales y reutilizables, fáciles de ajustar.
- **R-3** E2E puede no correr en sandbox → AC-15 contempla `NO EJECUTADA` justificada.
- **Pendiente (fuera de esta SPEC):** entregables reales de Audiometría y Espirometría desde extracción (OQ-20260819-03), ZIP final (OQ-20260819-02), condición de emisión del dictamen integrado (OQ-20260819-01), aptitud sin Examen Médico (OQ-20260819-04 deferred).

## 15. DoD

- AC-1 a AC-14 verdes.
- AC-15 ejecutada o declarada `NO EJECUTADA` con justificación.
- Commits locales granulares, **sin push**.
- Reporte IMPL-REPORT con archivos, criterios cubiertos y evidencia.
- GEMINI PASS/PASS_WITH_WARNINGS cuando INTEGRA lo cite (cambio UI aditivo, no toca contrato público; clasificable bajo riesgo, ver ADR §5).
