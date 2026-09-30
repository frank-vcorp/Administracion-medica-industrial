# ADR-20260819-03 — Tarjetas por prueba como prototipo UI no persistente con fixtures anonimizados

- **ID:** ADR-20260819-03
- **Estado:** Accepted
- **Fecha:** 2026-08-19
- **Propietario:** INTEGRA
- **Intervención:** ARCH-20260819-02
- **SPEC relacionada:** SPEC_ARCH-20260819-02
- **Fuentes funcionales:** DEC-20260819-01, DEC-20260819-02, DEC-20260819-03, BR-20260819-01, FND-20260819-01, SCN-20260819-01/02

## 1. Contexto

DEC-20260819-03 exige mostrar dentro de Impresión y Aptitud tres tarjetas (Examen Médico, Audiometría, Espirometría) **antes** de cerrar los entregables reales de Audiometría/Espirometría, para que Frank revise la interfaz y pida correcciones. Las muestras disponibles en `context/datos AMI/informacion para revision/` (PNG/DOCX/PDF) pueden contener datos de personas. El modelo de datos actual ya soporta slots por prueba (`examen_medico_texto`, `audiometria_texto`, `espirometria_texto` en `physicalExamData`, leídos por `exam-summary.ts` y `verdict.builder.ts`), pero la UI de la inner-tab `impresion` arranca directo con el consolidado (`LiveSummaryPreview`) sin tarjetas individuales (FND-20260819-01).

## 2. Opciones consideradas

1. **Conectar resultados reales de Audiometría/Espirometría ahora.** Requiere extracción IA y entregables todavía no cerrados (OQ-20260819-03 open). Violenta DEC-20260819-03, que pide validar la UI primero.
2. **Persistir las tarjetas de muestra en `MedicalExam`/`MedicalVerdict`.** Persiste datos de muestra como si fueran clínicos; rompe la privacidad y mezcla muestra con expediente real.
3. **Prototipo UI no persistente con fixtures anonimizados.** Componentes presentacionales nuevos, estado local de expandir/contraer, fixtures sintéticos derivados sólo de la estructura clínica. Sin backend, sin migración, sin descargables funcionales. Examen Médico consume el resumen real existente.
4. **Copiar las papeletas AMI a `public/` para embeberlas.** Expone datos de pacientes al bundle desplegado; viola la restricción de privacidad del handoff.

## 3. Decisión

**Opción 3: prototipo UI no persistente con fixtures anonimizados.**

- La sección `ResultadosPorPrueba` es **puramente presentacional**: lee `form`/`aptitud` del padre en modo read-only para la tarjeta Examen Médico; Audiometría/Espirometría usan fixtures tipados y sintéticos.
- **No persistencia:** ningún dato de muestra se guarda en `MedicalExam.physicalExamData`, `MedicalVerdict` ni datos del paciente. El componente no importa server actions ni muta estado del padre.
- **No fuga de datos:** ningún archivo de `context/datos AMI/` se referencia, copia a `public/` o entra al bundle. SOFIA puede consultar las muestras sólo para entender la estructura de layout; prohibido transcribir PII real.
- **No descargables:** los botones de descarga se renderizan `disabled` con la etiqueta `Disponible al validar resultado`.
- **Consolidado intacto:** `LiveSummaryPreview`, selector de aptitud e impresión diagnóstica siguen funcionando debajo de las tarjetas, sin regresión.
- **Reversibilidad total:** eliminar el prototipo = borrar los archivos nuevos + 1 import + 1 render. Cero migración, cero cambio de contrato persistente.

## 4. Consecuencias

- **Positivas:** valida el contrato visual de "resultados por prueba" (DEC-20260819-01/03) sin acoplarse a entregables no cerrados; preserva privacidad; reversible; sin riesgo de regresión de persistencia.
- **Negativas:** Audiometría/Espirometría muestran datos sintéticos, no reales; los descargables no funcionan todavía. Ambas son **esperadas** por DEC-20260819-03 y explícitamente fuera de alcance.
- **Trazabilidad:** las tarjetas reales (con datos y descargables) llegarán cuando se cierren los entregables de extracción; esta SPEC sólo sienta el contrato UI. Se registran los pendientes en SPEC §14 (OQ-01/02/03/04).

## 5. Reversibilidad

Alta. Reversión = `git revert` de los commits del prototipo o borrado manual de los 4-5 archivos nuevos + 1 línea de integración. No hay migración que deshacer ni contrato persistente que reconciliar. Clasificación de riesgo para auditoría GEMINI: **bajo** (cambio UI aditivo, no toca contrato público, schema ni auth).

## 6. Alternativa descartada y por qué

La Opción 1 (resultados reales ahora) se descarta porque depende de extracción y entregables abiertos (OQ-20260819-03) y contradice la secuencia que Frank fijó en DEC-20260819-03: primero la interfaz, después los datos reales. La Opción 2 y la Opción 4 se descartan por violar la restricción de privacidad y no-persistencia del handoff funcional.

## 7. Referencias funcionales

- DEC-20260819-01 (dictámenes por prueba), DEC-20260819-02 (no mover navegación), DEC-20260819-03 (validar UI antes de cerrar entregables).
- BR-20260819-01 (separación y consolidación de dictámenes).
- FND-20260819-01 (ausencia de paneles por prueba).
- SCN-20260819-01 (varias pruebas), SCN-20260819-02 (prueba no aplicable).
