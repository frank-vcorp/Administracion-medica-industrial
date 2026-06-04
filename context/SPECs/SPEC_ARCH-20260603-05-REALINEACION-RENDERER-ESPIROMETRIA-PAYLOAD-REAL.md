# SPEC ARCH-20260603-05 - Realineación del Renderer de Espirometría con el Payload Real Exhaustivo

## 1. Objetivo

Corregir la capa de presentación de Espirometría para que renderice de forma legible el payload exhaustivo que Gemini ya extrae correctamente, sin tocar backend, prompts ni persistencia.

## 2. Problema Confirmado

La extracción documental de Espirometría ya entrega el contrato exhaustivo correcto, pero la UI clínica sigue usando un schema visual con claves legacy. El resultado es una presentación parcial: algunos campos sí aparecen por coincidencia de nombre, pero el resumen principal queda incompleto y la tabla de parámetros pierde casi todas sus columnas.

## 3. Hipótesis Local Falsable

Si el schema visual de Espirometría deja de buscar claves legacy como:

- `fev1_fvc`
- `fvc_pct_pred`
- `fev1_pct_pred`
- `edad`
- `talla`
- `peso`
- `fecha`
- `hora`
- `temperatura`
- `humedad`
- `presion`
- `ecuacion_referencia`
- `repetibilidad_ats_fvc`
- `repetibilidad_ats_fev1`
- `unidad`
- `m1`
- `m2`
- `m3`
- `ref`
- `lln`
- `pref_m1`
- `pref_m2`
- `pref_m3`
- `curva_flujo_volumen`
- `curva_volumen_tiempo`
- `observaciones`

y en su lugar mapea las claves reales del payload vigente:

- `fev1_fvc_ratio`
- `fvc_percent_predicho`
- `fev1_percent_predicho`
- `edad_anios`
- `talla_cm`
- `peso_kg`
- `fecha_estudio`
- `hora_estudio`
- `temperatura_c`
- `humedad_pct`
- `presion_mmhg`
- `referencia_ecuacion`
- `repetibilidad_ats_ers_fvc`
- `repetibilidad_ats_ers_fev1`
- `unit`
- `m1_value`
- `m2_value`
- `m3_value`
- `ref_value`
- `lln_value`
- `m1_pct_ref`
- `m2_pct_ref`
- `m3_pct_ref`
- `curva_flujo_volumen_presente`
- `curva_volumen_tiempo_presente`
- `observaciones_grafica`

entonces la vista volverá a mostrar correctamente el resumen, los datos técnicos y la tabla espirométrica completa sin modificar el snapshot persistido.

## 4. Evidencia Confirmada

### 4.1 Ancla inicial

El archivo ancla es:

- `frontend/src/components/clinical/extraction-presentation-schemas.ts`

Ahí vive la decisión visual de qué claves se leen para Espirometría.

### 4.2 Ruta de control

El renderer general:

- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`

sí soporta tablas y key-values, pero solo pinta lo que el schema le indique. El problema no está en Gemini ni en la persistencia del snapshot, sino en la configuración del schema de presentación.

### 4.3 Desalineamiento observado

El payload real vigente de Espirometría usa claves exhaustivas del corte de extracción de mayo. El schema visual todavía apunta a alias antiguos y por eso:

1. el resumen principal omite razón y porcentajes predichos
2. paciente y estudio muestran solo subconjuntos por coincidencia parcial
3. la tabla `parametros` conserva `label`, pero pierde columnas porque el schema pide `unidad`, `m1`, `m2`, `m3`, `ref`, `lln` y `%REF`, mientras el array real trae `unit`, `m1_value`, `m2_value`, `m3_value`, `ref_value`, `lln_value`, `m1_pct_ref`, `m2_pct_ref`, `m3_pct_ref`
4. gráficas e indicadores quedan incompletos por nombres legacy

## 5. Datos Existentes a Reutilizar

### 5.1 No crear ni tocar

- el payload backend de extracción
- los prompts de calibración
- la persistencia de snapshots
- la resolución de `studyType`

### 5.2 Reutilizar exactamente

- `ClinicalExtractionRenderer` como motor de render
- `TableBlock` existente para la tabla de parámetros
- `KeyValueBlock` existente para secciones simples
- el payload exhaustivo ya persistido en `test.extractionSnapshot.extractedData`

## 6. Datos Faltantes a Crear

No faltan datos en backend. Solo falta crear la capa de compatibilidad visual del schema de Espirometría con el payload real.

Opcionalmente, si el equipo lo considera más limpio, se puede crear una normalización mínima en frontend para alias de Espirometría dentro de `ClinicalExtractionRenderer.tsx`, pero este corte no la exige si el schema puede alinearse directamente.

## 7. Alcance

### Incluye

- realinear el schema de Espirometría al payload real vigente
- hacer visible el resumen principal completo
- restaurar columnas de la tabla de parámetros espirométricos
- mostrar correctamente metadatos de paciente, estudio, calidad, condiciones y gráficas
- mantener el renderer general actual

### No incluye

- cambios de backend
- recalibración de prompts
- rediseño visual del card
- cambios en Audiometría u otros estudios

## 8. Archivos Exactos Permitidos

Máximo permitido: 2 archivos.

Archivos autorizados:

1. `frontend/src/components/clinical/extraction-presentation-schemas.ts`
2. `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx` solo si hace falta una normalización mínima de alias o formato para no duplicar lógica en el schema

No se autoriza abrir más superficie en este corte.

## 9. Presentación Requerida

### 9.1 Resumen principal

Debe mostrar desde raíz:

- `fvc`
- `fev1`
- `fev1_fvc_ratio`
- `fvc_percent_predicho`
- `fev1_percent_predicho`

### 9.2 Datos del paciente

Debe tomar desde `paciente`:

- `nombre_completo`
- `sexo`
- `edad_anios`
- `talla_cm`
- `peso_kg`
- `imc`
- `motivo`
- `procedencia`
- `fuma`

### 9.3 Datos del estudio

Debe tomar desde `estudio`:

- `referencia`
- `fecha_estudio`
- `hora_estudio`
- `tipo_reporte`
- `equipo_modelo`
- `version_software`

### 9.4 Condiciones técnicas

Debe tomar desde `condiciones`:

- `tecnico`
- `transductor`
- `temperatura_c`
- `humedad_pct`
- `presion_mmhg`
- `referencia_ecuacion`
- `factor_etnico`
- `factor_btps`

### 9.5 Calidad técnica del estudio

Debe tomar desde `calidad`:

- `repetibilidad_ats_ers_fvc`
- `repetibilidad_ats_ers_fev1`
- `es_interpretable`
- `completitud_documental`
- `notas_calidad`

### 9.6 Parámetros espirométricos

La tabla debe consumir `parametros` y mapear columnas reales:

- `label`
- `unit`
- `m1_value`
- `m2_value`
- `m3_value`
- `ref_value`
- `lln_value`
- `m1_pct_ref`
- `m2_pct_ref`
- `m3_pct_ref`

### 9.7 Gráficas e indicadores

Debe tomar desde `graficas`:

- `curva_flujo_volumen_presente`
- `curva_volumen_tiempo_presente`
- `maniobras_graficadas`
- `observaciones_grafica`

## 10. Regla de UX

La tabla de parámetros debe seguir siendo la superficie principal de lectura médica. No se aprueba degradarla a listado JSON ni a filas genéricas sin columnas clínicas.

## 11. Criterios de Aceptación

1. El card de Espirometría muestra el resumen principal con ratio y porcentajes predichos.
2. Los datos de paciente, estudio y condiciones técnicas se ven con las claves reales del snapshot actual.
3. La tabla `Parámetros espirométricos` vuelve a mostrar columnas de unidad, maniobras, referencia, LLN y porcentajes cuando existan.
4. No se modifica backend ni snapshots persistidos.
5. El frontend compila sin errores.

## 12. Validación Exacta Esperada

Ejecutar:

`cd /workspaces/Administracion-medica-industrial/frontend && pnpm build`

## 13. Resultado Esperado

Espirometría vuelve a verse como una representación clínica legible del payload exhaustivo ya extraído por Gemini. El defecto queda acotado como problema de presentación y no de calibración ni de extracción.