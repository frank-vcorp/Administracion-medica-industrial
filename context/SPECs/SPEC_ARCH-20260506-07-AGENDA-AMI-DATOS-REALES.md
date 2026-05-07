## SPEC: Agenda AMI basada en datos reales para capacidad, sobrecupo y flujo sin cita

**ID:** ARCH-20260506-07  
**Estado:** Lista para implementacion gradual  
**Padre:** ARCH-20260225-06-FASE2-MODULOS  
**Insumo base:** [AMI AGENDA MARZO 2026.xlsx](../datos%20AMI/Formatos%20Sim/AMI%20AGENDA%20MARZO%202026.xlsx)

### Objetivo

Formalizar el siguiente corte del modulo de Agenda usando datos reales de AMI para evolucionar de agenda generica a agenda operativa: capacidad por sede, patrones de carga, combinaciones de perfiles y preparacion para flujo sin cita o atencion masiva.

## Contexto estrategico

La agenda real es parte del soporte operativo necesario para la futura capa de IA medica de Google ya planteada a AMI. Sin una agenda aterrizada a capacidad, sobrecupo y flujo real, la capa clinica tendra poco valor operacional.

## Problema a resolver

- La agenda actual existe, pero fue construida como capacidad general del sistema.
- AMI opera con dinamicas reales de sobrecupo, mezcla de perfiles, horarios pico y excepciones sin cita.
- Sin aterrizar estas reglas con datos reales, la agenda puede seguir viendose correcta tecnicamente pero incompleta operativamente.

## Alcance de esta fase

### Sí entra
- Analizar agenda real de AMI por clinica.
- Identificar horas pico, dias pico y perfiles frecuentes.
- Proponer una capa de reglas para capacidad y sobrecupo.
- Dejar lista la base funcional para un futuro modulo o flujo de atencion sin cita.

### No entra
- Implementar en esta misma SPEC toda la logica completa de atencion masiva.
- Integrar motor predictivo complejo.
- Rehacer por completo el modulo de citas existente.

## Preguntas que esta SPEC debe responder

1. Que considera AMI una carga normal por sede.
2. Como distinguen operativamente una cita regular de una carga masiva.
3. Que perfiles y estudios dominan por clinica.
4. Que reglas minimas debe cumplir la agenda para no estorbar la operacion real.

## Entregables esperados

### A. Analisis operativo de agenda
- Resumen por sede.
- Horas pico.
- Perfiles y paquetes mas frecuentes.
- Observaciones sobre huecos, sobrecupo y comportamiento real.

### B. Reglas funcionales de agenda
- Definicion preliminar de capacidad por sede.
- Regla de sobrecupo tolerable.
- Regla base para activar flujo sin cita o atencion masiva.
- Propuesta de visibilidad para recepcion y coordinacion.

### C. Backlog derivado
- Ajustes a UI de agenda.
- Necesidades de analitica y dashboard.
- Necesidades de integracion con perfiles y estudios.

## Criterios de aceptación

1. Existe un resumen claro de como se comporta la agenda real AMI por sede.
2. Se documentan reglas base para capacidad y sobrecupo.
3. Queda identificado lo que debe seguir como SPEC hija de atencion sin cita o carga masiva.
4. La agenda futura deja de depender solo de supuestos genericos.

## Dependencias de informacion AMI

- Confirmacion de que marzo 2026 es representativo.
- Aclaracion de politica real de sobrecupo.
- Criterio real para atencion sin cita.
- Validacion de perfiles mas frecuentes por sede.

## Handoff a SOFIA o analisis posterior

- No iniciar implementacion amplia hasta cerrar el analisis de datos reales.
- Priorizar primero lectura analitica del Excel y definicion de reglas antes de tocar UI.