# HANDOFF ARCH-20260603-05 a SOFIA - Realineación Renderer Espirometría

## Objetivo

Corregir la UI de Espirometría para que renderice el payload exhaustivo vigente sin tocar backend ni calibración.

## Estado

La extracción Gemini ya llega bien. El defecto vigente es visual y está localizado en el schema del renderer.

## Hipótesis local ya validada

El renderer general sí funciona, pero el schema de Espirometría sigue apuntando a claves legacy. Por eso el card muestra algunos datos por coincidencia parcial, mientras la tabla de parámetros pierde casi todas las columnas.

## Archivo ancla

- `frontend/src/components/clinical/extraction-presentation-schemas.ts`

## Ruta de apoyo

- `frontend/src/components/clinical/ClinicalExtractionRenderer.tsx`

## Payload real que debe gobernar

### Raíz

- `fvc`
- `fev1`
- `fev1_fvc_ratio`
- `fvc_percent_predicho`
- `fev1_percent_predicho`

### `paciente`

- `nombre_completo`
- `sexo`
- `edad_anios`
- `talla_cm`
- `peso_kg`
- `imc`
- `motivo`
- `procedencia`
- `fuma`

### `estudio`

- `referencia`
- `fecha_estudio`
- `hora_estudio`
- `tipo_reporte`
- `equipo_modelo`
- `version_software`

### `condiciones`

- `tecnico`
- `transductor`
- `temperatura_c`
- `humedad_pct`
- `presion_mmhg`
- `referencia_ecuacion`
- `factor_etnico`
- `factor_btps`

### `calidad`

- `repetibilidad_ats_ers_fvc`
- `repetibilidad_ats_ers_fev1`
- `es_interpretable`
- `completitud_documental`
- `notas_calidad`

### `parametros[]`

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

### `graficas`

- `curva_flujo_volumen_presente`
- `curva_volumen_tiempo_presente`
- `maniobras_graficadas`
- `observaciones_grafica`

## Restricciones

1. No tocar backend.
2. No tocar prompts.
3. No abrir más de 2 archivos.
4. Mantener `ClinicalExtractionRenderer` como motor general.
5. Si el schema basta, no introducir normalización adicional.

## Salida esperada

Código en frontend listo para validación, con Espirometría alineada al payload real y tabla de parámetros completa.

## Validación exacta

`cd /workspaces/Administracion-medica-industrial/frontend && pnpm build`

## Referencia

- `context/SPECs/SPEC_ARCH-20260603-05-REALINEACION-RENDERER-ESPIROMETRIA-PAYLOAD-REAL.md`