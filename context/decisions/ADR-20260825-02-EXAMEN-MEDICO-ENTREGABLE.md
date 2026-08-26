# ADR-20260825-02 — Entregable consolidado de Examen Médico desde perfil clínico

- **Estado:** ACCEPTED_FOR_SPEC / sin implementación
- **Fecha:** 2026-08-25
- **Origen:** `DEC-20260825-13`, `BR-20260825-14`, `FND-20260825-16`, `FND-20260825-17`

## Contexto

AMI entrega un PDF de Examen Médico de cuatro páginas que consolida identificación, historia ocupacional, antecedentes, exploración, resultados, impresión diagnóstica, aptitud, recomendaciones y firma. El sistema ya cuenta con `ExamenMedicoEstudio`, `physicalExamData`, slots independientes por prueba y helpers de aptitud.

## Decisión

El PDF se construirá desde el perfil clínico del paciente, el Event, los slots de estudios y la revisión médica. El sistema auto-poblará el resumen ejecutivo y recomendaciones; el médico conservará la decisión de aptitud, impresión, restricciones y notas finales.

## Reglas

1. Cada bloque conserva origen y fecha: perfil, Event, estudio fuente, derivación o decisión médica.
2. No duplicar captura de datos ya disponibles en el perfil clínico.
3. Cada estudio complementario conserva su dictamen independiente; el Examen Médico genera el consolidado.
4. Aptitud nunca se calcula automáticamente: es decisión explícita del médico.
5. IA sólo apoya; no firma, no decide aptitud ni sustituye la revisión.
6. El PDF sólo se genera con revisión/aptitud válida y médico autenticado.
7. La descarga se protege por paciente/Event y autorización de sesión.
8. Datos faltantes generan estado visible o pendiente; nunca defaults silenciosos.

## Consecuencia

Se reutiliza la infraestructura actual y se completa la migración de slots/entregable, sin crear un segundo perfil paralelo ni mezclar información de pacientes.
