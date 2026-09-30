# Functional Baseline — Resultados clínicos y aptitud

## Propósito

El médico debe disponer de resultados clínicos separados por prueba para tomar una decisión de aptitud laboral informada, sin reescribir información que el sistema puede derivar.

## Modelo funcional

1. Un perfil médico define entre una y N pruebas aplicables a la atención.
2. Cada prueba conserva su resultado, su dictamen independiente y su descargable individual.
3. El Examen Médico es una prueba independiente; no sustituye a los dictámenes de Audiometría, Espirometría, Laboratorios ni Radiografía.
4. El dictamen general integra los dictámenes de las pruebas aplicables, sin sobrescribirlos ni mezclarlos.
5. La aptitud laboral consolidada siempre la decide el médico; el sistema presenta evidencia y recomendaciones auto-pobladas.
6. El entregable operativo se reutiliza entre casi todos los Events: conserva un ciclo común de resultado, revisión, validación, trazabilidad y descargable, con contenido particular por tipo de prueba.
7. Audiometría y Espirometría comparten el patrón del entregable, pero no comparten automáticamente campos, criterios clínicos, umbrales ni formato documental.

## Pantalla Impresión y Aptitud

### Resultados por prueba

Muestra una tarjeta por cada prueba del perfil que aplica al paciente. Cada tarjeta incluye:

- Nombre de la prueba.
- Estado: pendiente, incompleta, lista para revisión, validada o no aplica.
- Resumen clínico breve.
- Dictamen independiente de esa prueba.
- Acción para ver detalle.
- Descargable individual cuando el resultado está validado.

### Consolidado y Aptitud

Se muestra debajo de todas las tarjetas de prueba:

- Resumen ejecutivo de evidencia clínica.
- Recomendaciones auto-pobladas y editables por el médico.
- Aptitud laboral consolidada elegida por el médico.
- Descargable del dictamen integrado.
- Descarga ZIP con todos los descargables individuales disponibles y el dictamen integrado final.

## Alcance actual

- Examen Médico: especificación de entregable en preparación.
- Audiometría: pendiente de análisis desde extracción de datos.
- Espirometría: pendiente de análisis desde extracción de datos.

## Regla de extensibilidad

El cierre funcional de Espirometría debe servir como referencia reutilizable para Audiometría y casi todos los Events posteriores. La reutilización corresponde al flujo y al contrato de entrega; la información clínica se define por estudio.

## Fuera de alcance actual

- Nota médica de consulta.
- Certificado médico laboral independiente.
- Incapacidades y pases de salida.
