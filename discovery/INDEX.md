# Discovery — Administración Médica Industrial

## Estado

- **Versión funcional:** 2026-08-20.1
- **Fuente funcional vigente:** `discovery/FUNCTIONAL-BASELINE.md`
- **Estado:** `conditionally_ready`
- **Último checkpoint:** DEC-20260820-01, FND-20260820-01/02/03

## Decisiones activas

- DEC-20260819-01 — Impresión y Aptitud muestra dictámenes independientes por prueba antes del dictamen general.
- DEC-20260819-02 — Mantener Impresión y Aptitud bajo Examen Médico hasta revisión AMI.
- DEC-20260820-01 — Calibración es fuente única de ejecución y presentación por prueba.

## Bloqueadores

- Definir entregable independiente de Audiometría y Espirometría desde sus documentos de revisión.
- Confirmar criterios funcionales para habilitar el dictamen integrado y ZIP.
- Revisión AMI de aptitud consolidada para perfiles sin Examen Médico (OQ-20260819-04 diferida).
- Resolver la desconexión Calibración↔Events antes de seguir cerrando entregables IA de Audiometría/Espirometría.

## Regla transversal incorporada

- `BR-20260825-01` / `FND-20260825-01`: el entregable validado se reutilizará para casi todos los Events; cada estudio conserva información, criterios, presentación y documento particulares.

## Fuentes de revisión

- `context/datos AMI/informacion para revision/REPORTE DE EXAMEN MEDICO (APTITUD) EJEMPLO.pdf`
- `context/datos AMI/informacion para revision/FORMATO EXAMEN MEDICO SODEXO.pdf`
- `context/datos AMI/informacion para revision/FORMATO EXAMEN MEDICO FLOWSERVE.xlsx`
- `context/Juntas/Revision Ami10082026.txt`

## Próximo bloque funcional

Especificar el contrato técnico para convertir Calibración en fuente única y asegurar paridad con Events.
