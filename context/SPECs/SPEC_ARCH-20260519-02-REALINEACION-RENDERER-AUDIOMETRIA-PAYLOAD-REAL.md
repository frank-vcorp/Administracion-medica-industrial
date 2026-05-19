# SPEC ARCH-20260519-02 - Realineación del Renderer de Audiometría con el Payload Real Tabular

## 1. Objetivo

Corregir el renderer clínico de Audiometría para que vuelva a mostrar las tablas comparativas acordadas en la SPEC visual original, usando el payload real que hoy entrega la extracción validada en producción.

## 2. Problema Confirmado

La extracción de Audiometría ya mejoró y ahora toma correctamente la tabla en vez de la gráfica. Sin embargo, la UI sigue sin mostrar las tablas comparativas por frecuencia porque el schema de presentación de Audiometría quedó apuntando a rutas legacy que ya no corresponden al payload real.

## 3. Hipótesis Local Falsable

Si el schema de presentación de Audiometría en frontend deja de buscar:

- `oido_derecho.via_aerea`
- `oido_izquierdo.via_aerea`
- `oido_derecho.via_osea`
- `oido_izquierdo.via_osea`
- `resumen_oidos.pta_d`
- `resumen_oidos.pta_i`

y en su lugar usa las rutas reales del payload vigente:

- `paciente_detalle`
- `oido_derecho.va`
- `oido_izquierdo.va`
- `oido_derecho.vo`
- `oido_izquierdo.vo`
- `oido_derecho.pta_visible`
- `oido_izquierdo.pta_visible`
- `notas_calidad.descripcion`

entonces volverán a renderizarse correctamente:

- la tabla comparativa de vía aérea
- la tabla comparativa de vía ósea
- el resumen técnico legible
- los indicadores PTA por oído

sin modificar el payload backend.

## 4. Evidencia Confirmada

### SPEC visual vigente

`context/SPECs/SPEC_ARCH-20260518-14-RENDERER-CLINICO-AUDIOMETRIA.md` exige:

1. resumen del estudio
2. tabla audiométrica principal por frecuencia
3. campos fuente del formato

### Payload real observado en producción

El payload hoy válido ya viene como:

```json
{
  "estudio": { ... },
  "condiciones": { ... },
  "oido_derecho": {
    "va": { "250": 5, "500": 10, ... },
    "vo": { ... },
    "pta_visible": 8
  },
  "oido_izquierdo": {
    "va": { "250": 10, "500": 10, ... },
    "vo": { ... },
    "pta_visible": 8
  },
  "paciente_detalle": { ... },
  "notas_calidad": {
    "descripcion": "...",
    "frecuencias_detectadas_va_derecho": 8,
    "frecuencias_detectadas_va_izquierdo": 8
  },
  "completitud_documental": "suficiente"
}
```

### Desalineamiento localizado

El schema actual de frontend sigue esperando rutas viejas, por eso la tabla no aparece aunque el bloque de render bilateral sí existe.

## 5. Alcance

### Incluye

- realinear el schema visual de Audiometría al payload real vigente
- restaurar la tabla bilateral de vía aérea
- restaurar la tabla bilateral de vía ósea
- mostrar PTA por oído desde `pta_visible`
- mostrar `notas_calidad.descripcion` de forma legible en vez de serializar el objeto completo
- mapear `paciente_detalle` en vez de `paciente`

### No incluye

- cambiar el payload backend de extracción
- rediseñar toda la UI clínica
- cambiar el prediagnóstico clínico derivado

## 6. Presentación Requerida

### 6.1 Paciente

Tomar desde `paciente_detalle`:

- `nombre_completo`
- `identificacion`
- `sexo`
- `fecha_nacimiento`
- `notas`

### 6.2 Estudio

Tomar desde `estudio`:

- `fecha_estudio`
- `hora_estudio`
- `tipo_reporte`
- `transductor`
- `ultima_calibracion`
- `numero_serie_audiometro`
- `numero_serie_transductor`

### 6.3 Resumen técnico

Mostrar de forma legible:

- `completitud_documental`
- `notas_calidad.descripcion`

No debe renderizarse el objeto entero serializado como JSON crudo dentro del card principal.

### 6.4 Indicadores por oído

Mostrar:

- `oido_derecho.pta_visible`
- `oido_izquierdo.pta_visible`

### 6.5 Tablas bilaterales

#### Vía aérea

- `oido_derecho.va`
- `oido_izquierdo.va`

#### Vía ósea

- `oido_derecho.vo`
- `oido_izquierdo.vo`

Orden preferido:

- 250
- 500
- 1000
- 2000
- 3000
- 4000
- 6000
- 8000

Si existen otras frecuencias como 125, 750 o 1500, deben mostrarse después o según el orden soportado por el bloque, pero sin romper la tabla.

### 6.6 Campos fuente del formato

Mantener:

- `faringe`
- `cad`
- `cai`
- `mtd`
- `mti`

## 7. Regla de UX

Las tablas de Audiometría deben volver a ser la superficie principal de lectura médica extractiva. No se aprueba reemplazarlas por key-values serializados ni por texto técnico crudo.

## 8. Archivos Probables

- `frontend/src/components/clinical/extraction-presentation-schemas.ts`
- posiblemente `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` si hay que soportar `notas_calidad.descripcion` como note o key-value limpio

## 9. Criterios de Aceptación

1. Vuelven a verse las tablas comparativas de Audiometría en la UI extractiva.
2. La tabla de vía aérea usa `va` y la de vía ósea usa `vo`.
3. `PTA` por oído se muestra desde `pta_visible`.
4. `notas_calidad` se presenta de forma legible, no como objeto serializado completo.
5. No se modifica el payload backend.
6. El frontend compila sin errores.

## 10. Validación Mínima Esperada

- validación enfocada del renderer/slice tocado
- `tsc --noEmit` del frontend o check equivalente del slice

## 11. Resultado Esperado

La UI de Audiometría vuelve a reflejar exactamente la estrategia aprobada originalmente: tablas comparativas por frecuencia legibles para médico, pero ahora alineadas al payload real vigente del extractor.