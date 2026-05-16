# SPEC ARCH-20260516-12: Espirometría — Extracción Exhaustiva de Datos Fuente

- ID: ARCH-20260516-12
- Fecha: 2026-05-16
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260516-02-CALIBRACION-V2-CASOS-REALES-AUDIO-ESPIRO.md
  - context/SPECs/SPEC_ARCH-20260513-01-CALIBRACION-V1-AUDIOMETRIA-ESPIROMETRIA.md

## 1. Objetivo

Elevar la extracción de Espirometría desde un contrato mínimo centrado en `fev1`, `fvc` y `ratio` hacia un contrato exhaustivo que recupere todos los datos fuente visibles del layout real usado por AMI, priorizando la tabla numérica sobre la gráfica y preservando trazabilidad suficiente para calibración y revisión clínica posterior.

## 2. Problema Observado

- El contrato actual de `EspirometriaData` captura solo el núcleo mínimo.
- El formato real observado contiene mucha más información visible y útil para calibración:
  - identificación del estudio
  - metadatos del paciente
  - condiciones de adquisición
  - equipo y versión
  - tabla completa con `M1`, `M2`, `M3`, `%REF`, `REF`, `LLN`
  - repetibilidad ATS/ERS
  - elementos gráficos
- Si el extractor solo toma `fev1` y `fvc`, se pierde contexto documental crítico y se limita innecesariamente la calidad de la capa clínica.

## 3. Caso Fuente que gobierna este corte

Sobre el layout real revisado se observan como visibles, entre otros:

1. `referencia`
2. `fecha`
3. `hora`
4. `nombre`
5. `sexo`
6. `edad`
7. `talla`
8. `peso`
9. `temperatura`
10. `presion`
11. `humedad`
12. `fuma`
13. `motivo`
14. `procedencia`
15. `imc`
16. `tecnico`
17. `transductor`
18. `referencia ecuación`
19. `F. étnico`
20. `F. BTPS`
21. `tipo de informe`
22. `equipo/modelo`
23. `version`
24. tabla de parámetros con `M1`, `M2`, `M3`, `%REF`, `REF`, `LLN`
25. `Repetibilidad ATS/ERS: FVC` y `FEV1`
26. gráficas de flujo-volumen y volumen-tiempo

## 4. Decisión Arquitectónica

Se aprueba un contrato de extracción exhaustivo para Espirometría con estas reglas:

1. La extracción sigue siendo documental, no clínica.
2. La tabla numérica tiene precedencia absoluta sobre cualquier inferencia desde la gráfica.
3. Debe preservarse tanto el `label` literal de cada fila como una `key` canónica cuando se pueda mapear con seguridad.
4. Si una fila no se puede normalizar a una clave conocida, no se pierde: se conserva con una `key` derivada razonablemente del label.
5. La capa clínica posterior será la responsable de interpretar, no el extractor.

## 5. Contrato Objetivo

La extracción debe tender a una estructura con los siguientes bloques.

### A. paciente

1. `nombre_completo`
2. `sexo`
3. `edad_anios`
4. `talla_cm`
5. `peso_kg`
6. `imc`
7. `fuma`
8. `motivo`
9. `procedencia`

### B. estudio

1. `referencia`
2. `fecha_estudio`
3. `hora_estudio`
4. `tipo_reporte`
5. `equipo_modelo`
6. `version_software`

### C. condiciones

1. `temperatura_c`
2. `presion_mmhg`
3. `humedad_pct`
4. `tecnico`
5. `transductor`
6. `referencia_ecuacion`
7. `factor_etnico`
8. `factor_btips`

### D. parametros

Lista exhaustiva de filas tabulares. Cada elemento debe permitir, como mínimo:

1. `label`
2. `key`
3. `unidad`
4. `m1`
5. `m1_pct_ref`
6. `m2`
7. `m2_pct_ref`
8. `m3`
9. `m3_pct_ref`
10. `ref`
11. `lln`

### E. calidad

1. `repetibilidad_ats_ers_fvc`
2. `repetibilidad_ats_ers_fev1`
3. `es_interpretable`
4. `completitud_documental`
5. `notas_calidad`

### F. graficas

1. `curva_flujo_volumen_presente`
2. `curva_volumen_tiempo_presente`
3. `maniobras_graficadas`
4. `observaciones_grafica`

## 6. Mapeo Canónico Inicial de Parámetros

El extractor debe reconocer, cuando aparezcan, al menos estas filas:

1. `Mejor FVC` -> `mejor_fvc_l`
2. `Mejor FEV1` -> `mejor_fev1_l`
3. `Mejor FEV1/FVC` -> `mejor_fev1_fvc_pct`
4. `FVC` -> `fvc_l`
5. `FEV1` -> `fev1_l`
6. `FEV1/FVC` -> `fev1_fvc_pct`
7. `FEV1/VC` -> `fev1_vc_pct`
8. `PEF` -> `pef_l_s`
9. `FEF25-75` -> `fef25_75_l_s`
10. `FET100` -> `fet100_s`
11. `Vext.` -> `vext_l`
12. `Edad de pulmón` -> `edad_pulmon`

Si aparece una fila adicional, debe conservarse también.

## 7. Reglas Obligatorias del Prompt

1. Responder solo JSON válido.
2. No incluir interpretación clínica ni conclusión.
3. No inventar valores faltantes.
4. Priorizar la tabla sobre la gráfica.
5. Marcar `es_interpretable=false` cuando falten `FEV1` o `FVC`.
6. Usar `notas_calidad` para ambigüedad, ilegibilidad o columnas incompletas.
7. No omitir filas tabulares visibles aunque no sean parte del núcleo V1 previo.

## 8. Alcance

### Incluye

1. actualizar prompt de extracción de Espirometría
2. ampliar schema backend para soportar estructura exhaustiva
3. ajustar tests de extracción para el nuevo contrato
4. dejar trazabilidad suficiente para calibración y revisión posterior

### No incluye

1. interpretación clínica final
2. rediseño de la UI clínica completa
3. automatización de análisis de curvas más allá de marcar presencia

## 9. Criterios de Aceptación

1. El extractor recupera identificación, paciente, condiciones y equipo cuando estén visibles.
2. El extractor ya no limita Espirometría a `fev1`, `fvc` y `ratio`.
3. La tabla tabular se recupera como lista exhaustiva de parámetros con `M1`, `M2`, `M3`, `%REF`, `REF`, `LLN` cuando existan.
4. Filas no reconocidas canónicamente no se pierden.
5. La salida sigue siendo puramente extractiva, sin diagnóstico.
6. Los tests del slice validan al menos un layout real equivalente al caso fuente revisado.

## 10. Resultado Esperado

Espirometría deja de operar con una extracción mínima y pasa a exponer un snapshot documental suficientemente rico para calibración clínica seria, comparación contra PDF real y futuras reglas de interpretación consistentes con la evidencia fuente.