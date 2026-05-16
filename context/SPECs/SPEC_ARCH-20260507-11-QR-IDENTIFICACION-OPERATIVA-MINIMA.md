# SPEC ARCH-20260507-11 — QR de Identificacion Operativa Minima

- ID: ARCH-20260507-11
- Fecha: 2026-05-07
- Agente: INTEGRA - Arquitecto
- Estado: Backlog futuro, no implementar aun

## Objetivo

Reducir la recaptura manual de datos en equipos de estudio mediante un QR operativo minimo que permita reutilizar solo:

1. nombre completo
2. fecha de nacimiento

La meta es ahorrar tiempo y disminuir errores de captura sin modificar el flujo clinico actual.

## Contexto

Durante validacion en sitio se observo que, en ciertos estudios, el personal necesita volver a escribir datos basicos del paciente directamente en la maquina o en la estacion asociada al equipo para poder emitir su reporte.

La friccion identificada no esta en datos clinicos complejos ni en el expediente completo, sino en la recaptura repetitiva de:

1. nombre completo
2. fecha de nacimiento

Por tanto, la oportunidad no es construir un intercambio clinico completo, sino una ayuda operativa minima de identificacion.

## Restriccion principal

Esta mejora no debe rediseñar el proceso medico actual.

Eso implica:

1. no cambiar estados del flujo de estudios
2. no volver obligatorio el uso de QR para poder atender
3. no bloquear la operacion si el lector QR no esta disponible
4. no agregar datos clinicos o sensibles innecesarios al QR

## Propuesta funcional

### 1. QR con payload minimo

Generar un QR con solo los dos campos confirmados como utiles para captura rapida:

1. nombre completo
2. fecha de nacimiento

Formato inicial sugerido:

```text
AMI|NOMBRE=JUAN PEREZ LOPEZ|FN=1990-08-14
```

Notas:

1. `FN` debe usar formato `YYYY-MM-DD`
2. el contenido debe ser legible para un lector QR que actue como teclado
3. no incluir CURP, diagnosticos, resultados ni antecedentes en esta fase

### 2. Uso como ayuda operativa, no como fuente de verdad

El QR no sustituye el expediente ni la papeleta.

Su funcion es solo acelerar la recaptura en estaciones o equipos que requieren volver a ingresar esos datos para generar reportes.

### 3. Presencia en puntos utiles del flujo

La solucion debera evaluarse para mostrarse en uno o ambos de estos puntos:

1. papeleta impresa o PDF operativo
2. vista del evento o workspace en pantalla

La decision final de ubicacion puede definirse en la iteracion de implementacion.

### 4. Compatibilidad con lectores tipo teclado

El MVP debe asumir que el lector QR se comporta como entrada de teclado.

Por ello, el valor codificado debe poder copiarse o pegarse de forma simple en software externo o estaciones auxiliares, sin depender de integraciones especiales con cada equipo medico.

## Alcance propuesto para una futura V1

Incluye:

1. generacion del QR con nombre completo y fecha de nacimiento
2. visualizacion del QR en un punto operativo del flujo
3. formato estable y consistente para lectura por scanner
4. validacion en campo con al menos un caso real de uso

No incluye todavia:

1. cifrado o firma avanzada del payload
2. tokenizacion con backend intermedio
3. integracion nativa con equipos medicos
4. sincronizacion automatica de software de terceros
5. inclusion de mas datos personales o clinicos

## Regla de diseño

Si el QR pide mas datos de los necesarios, se vuelve riesgoso y menos portable.

La version inicial debe obedecer el principio:

1. minima informacion util
2. cero bloqueo operativo
3. cero rediseño de flujo
4. compatibilidad primero

## Diseño tecnico minimo

### Payload sugerido

Campos:

1. `NOMBRE`
2. `FN`

Ejemplo:

```text
AMI|NOMBRE=MARIA ELENA GOMEZ LOPEZ|FN=1987-03-22
```

### Fuente de datos esperada

Los datos deberan tomarse del evento activo y del trabajador asociado.

### Render probable

Puntos probables de render futuro:

1. componente de papeleta o pase operativo
2. generacion PDF asociada al evento
3. header o panel lateral del evento si se requiere vista en pantalla

### Libreria probable

La implementacion futura puede usar una libreria estable de generacion de QR en frontend o en PDF, siempre que no altere el flujo actual ni agregue complejidad innecesaria.

## Archivos probables

- frontend/src/components/clinical/PapeletaWorkspace.tsx
- frontend/src/app/events/[id]/page.tsx
- frontend/src/lib/pdf
- frontend/src/components/pdf

## Criterios de aceptacion

1. existe un QR operativo con nombre completo y fecha de nacimiento
2. la fecha usa formato `YYYY-MM-DD`
3. el QR puede mostrarse en un punto natural del flujo sin bloquear la atencion
4. no se agregan datos clinicos ni sensibles fuera del alcance definido
5. el flujo medico actual no cambia por esta mejora

## Riesgos controlados

1. si se agregan demasiados datos, aumenta el riesgo de exposicion innecesaria
2. si el formato no es consistente, cada estacion lo interpretara distinto
3. si se hace obligatorio, puede frenar la operacion cuando no haya lector disponible

## Criterio de exito

La mejora sera exitosa si el personal puede reutilizar nombre completo y fecha de nacimiento con un escaneo rapido, reduciendo la recaptura manual sin introducir friccion nueva en piso.

## Referencias

- context/Juntas/MINUTA_VISITA_AMI_2026-04-17.md
- context/Juntas/SEGUIMIENTO_VISITA_AMI_2026-04-17.md
- context/SPECs/SPEC_ARCH-20260507-07-TRAZABILIDAD-LIGERA-SIN-CAMBIAR-FLUJO.md