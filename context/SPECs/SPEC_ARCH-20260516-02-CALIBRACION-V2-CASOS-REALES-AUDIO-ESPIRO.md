# SPEC ARCH-20260516-02 — Calibración V2 con casos reales para Audiometría y Espirometría

- ID: ARCH-20260516-02
- Fecha: 2026-05-16
- Agente: INTEGRA - Arquitecto
- Estado: listo para implementación
- Relacionado con:
  - context/SPECs/SPEC_ARCH-20260513-01-CALIBRACION-V1-AUDIOMETRIA-ESPIROMETRIA.md
  - context/SPECs/SPEC_ARCH-20260326-16-PREDIAGNOSTICO-IA-ESTRUCTURADO.md
  - context/SPECs/SPEC_ARCH-20260506-09-ARQUITECTURA-IA-DOS-MOMENTOS.md

## Objetivo

Ejecutar una calibración V2, ya no conceptual sino guiada por casos reales vistos en producción, para elevar la utilidad clínica de Audiometría y Espirometría en dos frentes:

1. mejorar la fidelidad de extracción contra el PDF real
2. endurecer la consistencia lógica del prediagnóstico en modo sombra

Esta calibración debe ocurrir explícitamente a través del panel de calibración existente por prueba, no como ajuste técnico invisible desligado de la consola administrativa.

## Hallazgos reales que disparan este corte

### A. Audiometría

Con caso real observado en expediente:

1. la extracción actual sí captura correctamente el mínimo clínico útil por frecuencia y por oído
2. la interpretación IA resultante es consistente con los datos extraídos y con una lectura de audición normal bilateral
3. sin embargo, al compararla con el PDF se observa que el modelo probablemente mezcla lectura de gráfica y tabla
4. en consecuencia, algunos valores finos pueden quedar aproximados y no necesariamente idénticos a la tabla resumen del estudio
5. además, el RAW todavía omite metadatos visibles del PDF como fecha de nacimiento, creador, PTA y algunos bloques auxiliares

Conclusión:

1. Audiometría está clínicamente usable en V1
2. su siguiente mejora no es rediseñar la salida, sino priorizar mejor la fuente numérica y ampliar campos visibles de soporte

### B. Espirometría

Con caso real observado en expediente y contraste contra PDF/diagnóstico humano:

1. la extracción actual ya captura el núcleo útil: `fvc`, `fev1`, `fev1_fvc_ratio`, `% predicho`, interpretabilidad y notas de calidad
2. el razonamiento intermedio del prediagnóstico ya detecta señales compatibles con patrón restrictivo
3. la síntesis final puede contradecir sus propias premisas y cerrar con etiqueta incorrecta, por ejemplo “obstrucción leve” pese a relación conservada y FVC reducida
4. el PDF contiene más datos visibles que hoy no se capturan: sexo, edad, talla, peso, IMC, hora, referencia, equipo, FEV1/VC, PEF, FEF25-75, FET100, Vext, edad pulmonar y bloques REF/LLN
5. por tanto, el problema no es que el sistema no vea nada útil, sino que aún se queda corto en extracción y le faltan reglas determinísticas de coherencia clínica final

Conclusión:

1. Espirometría ya es prometedora, no fallida
2. la calibración V2 debe ampliar extracción y evitar cierres clínicos que contradigan los propios números extraídos

## Decisión de arquitectura

Esta calibración V2 sigue respetando la arquitectura de dos momentos:

1. extracción documental estructurada
2. interpretación clínica en modo sombra

La mejora debe hacerse endureciendo cada capa por separado. No se autoriza mezclar la corrección del extractor con un resumen clínico opaco ni sustituir la decisión médica final.

Regla adicional no negociable de este corte:

1. la calibración debe quedar gobernada desde `/admin/services/[id]/calibration`
2. la configuración por prueba debe reflejarse en `MedicalTest.options.aiCalibration`
3. no se acepta una corrección solo en prompts/backend si el criterio no puede verse, versionarse y ajustarse desde el panel

## Alcance aprobado

Incluye:

1. ajustar prompts y contrato de extracción de Audiometría para priorizar fuente numérica más estable cuando coexistan tabla y gráfica
2. ampliar el contrato de Espirometría para capturar más metadatos y parámetros visibles del PDF real
3. endurecer reglas de síntesis clínica de Espirometría para evitar contradicciones entre justificación y conclusión
4. reflejar la calibración desde el panel existente por prueba, usando `aiCalibration`
5. usar los casos reales ya observados como casos de calibración obligatorios dentro de esa consola
6. dejar una nueva prueba posterior sobre documentos reales para verificar mejora

No incluye:

1. cambio del flujo clínico vigente
2. dictamen automático o aptitud laboral
3. retraining o fine-tuning del modelo
4. soporte exhaustivo para todos los layouts del mercado en esta iteración

## Reglas obligatorias

1. la salida principal sigue siendo parámetros estructurados, no texto libre
2. la IA no puede cerrar un patrón clínico que contradiga explícitamente los números que ella misma cita
3. si la conclusión entra en conflicto con sus propias justificaciones, debe degradarse a `AI_NON_CONCLUSIVE` o a una etiqueta más conservadora
4. la calibración debe quedar anclada al módulo existente de calibración IA; no se autoriza una consola paralela
5. cada ajuste relevante de Audiometría/Espirometría debe quedar visible como configuración o criterio gobernable por prueba, no como “magia” opaca en runtime

## Diseño técnico mínimo

### Superficie obligatoria del panel de calibración

Esta iteración debe entrar por la plataforma ya definida en `ARCH-20260327-15`.

La implementación mínima debe permitir que un calibrador abra la prueba en `/admin/services/[id]/calibration` y vea, para Audiometría y Espirometría:

1. documento fuente
2. extracción actual
3. campos faltantes o discrepantes
4. salida clínica/prediagnóstico
5. configuración vigente de `aiCalibration`
6. espacio para guardar o versionar criterios de calibración de esa prueba

La calibración V2 no se considera cumplida si solo cambia el backend y el panel sigue sin reflejar los criterios nuevos.

### Contrato mínimo en aiCalibration

La configuración por prueba debe reflejar, como mínimo, bloques distinguibles para:

1. `extraction`
2. `diagnosis`
3. `realCaseNotes` o equivalente de observaciones de calibración

No se exige en esta SPEC un data model perfecto nuevo, pero sí que la prueba pueda mostrar y guardar criterios útiles desde el panel.

### A. Audiometría V2

Objetivo de calibración:

1. preservar el mínimo clínico ya logrado
2. reducir discrepancias finas cuando el PDF contenga simultáneamente gráfica y tabla resumen

Requisitos mínimos:

1. cuando exista tabla numérica explícita, priorizarla sobre la lectura aproximada de gráfica
2. conservar el contrato actual de frecuencias canónicas: 250, 500, 1000, 2000, 3000, 4000, 6000 y 8000 Hz
3. ampliar, cuando el PDF lo muestre con claridad, campos auxiliares como `fecha_nacimiento`, `pta`, `creado_por` o equivalentes de soporte
4. mantener la conclusión clínica prudente de normalidad bilateral cuando todos los umbrales estén en rango normal
5. reflejar en el panel de calibración el criterio de precedencia de fuente numérica (tabla > gráfica) para esta prueba

### B. Espirometría V2

Objetivo de calibración:

1. aumentar densidad de extracción real contra el PDF
2. impedir que el resumen clínico final contradiga las premisas numéricas

Campos de alta prioridad a capturar además del mínimo actual:

1. `sexo`
2. `edad`
3. `talla_cm`
4. `peso_kg`
5. `imc`
6. `fev1_vc`
7. `pef`
8. `fef25_75`
9. `fet100`
10. `vext`
11. `edad_pulmon`
12. `ref` y `lln` cuando el layout lo permita de forma clara

Reglas clínicas mínimas obligatorias en la síntesis:

1. si `fev1_fvc_ratio` está conservado y `fvc_percent_predicho < 80`, no cerrar como patrón obstructivo salvo evidencia adicional muy fuerte
2. si la relación está conservada y los volúmenes están reducidos, priorizar formulaciones prudentes como `compatible con patrón sugestivo de restricción`
3. si las notas de calidad o repetibilidad son ambiguas o internamente inconsistentes, degradar confianza y explicitar limitaciones
4. si el resumen final contradice una justificación numérica previa, degradar a `AI_NON_CONCLUSIVE` antes que emitir etiqueta errónea
5. las reglas clínicas relevantes deben quedar visibles en la configuración diagnóstica de la prueba dentro del panel

### C. Casos de calibración obligatorios

La iteración no se considera cerrada sin correr, como mínimo, estos dos casos reales:

1. Audiometría con audición normal bilateral y comparación tabla/gráfica
2. Espirometría con FVC reducida y relación conservada, donde el diagnóstico humano del estudio apunte a patrón restrictivo

Estos casos deben ser revisables desde la consola de calibración, no solo desde la papeleta clínica.

## Criterios de aceptación

1. Audiometría conserva extracción completa por oído/frecuencia y reduce discrepancias finas frente a la tabla del PDF cuando esta exista
2. Audiometría mantiene conclusión clínica consistente con los números extraídos
3. Espirometría amplía extracción más allá del núcleo mínimo actual con al menos parte de los campos adicionales de alta prioridad
4. Espirometría no vuelve a cerrar como “obstrucción” cuando los datos extraídos apoyan una lectura restrictiva o no obstructiva
5. la calibración queda visible y ajustable desde `/admin/services/[id]/calibration` para ambas pruebas
6. existe al menos una prueba comparativa posterior sobre documentos reales para validar mejora
7. el resultado sigue entrando como modo sombra clínica, revisable por médico

## Criterio de éxito

La calibración V2 será exitosa cuando Audiometría gane precisión documental sin perder su buena consistencia clínica actual, y cuando Espirometría deje de tener cierres clínicos contradictorios y se acerque mejor al razonamiento del diagnóstico humano a partir de sus propios parámetros estructurados.