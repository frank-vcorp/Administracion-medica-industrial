# Scenarios

## SCN-20260819-01 — Médico consolida una atención con varias pruebas

**Given** una atención tiene Examen Médico, Audiometría y Espirometría aplicables

**And** cada prueba tiene un resultado y dictamen independiente validado

**When** el médico abre Impresión y Aptitud

**Then** ve tres tarjetas separadas, una por prueba

**And** cada tarjeta muestra resumen, dictamen individual y acción para descargar su reporte

**And** ve debajo un consolidado con recomendaciones auto-pobladas

**And** el médico selecciona la aptitud laboral general sin reescribir los resultados individuales

**And** al emitir el dictamen integrado puede descargarlo

**And** puede descargar un ZIP con los tres reportes individuales y el dictamen integrado.

## SCN-20260819-02 — Atención con una prueba no aplicable

**Given** una atención tiene una prueba marcada no aplicable

**When** el médico abre Impresión y Aptitud

**Then** la tarjeta identifica la prueba como no aplicable

**And** no la trata como resultado pendiente

**And** permite continuar al consolidado si todas las demás pruebas aplicables están validadas.