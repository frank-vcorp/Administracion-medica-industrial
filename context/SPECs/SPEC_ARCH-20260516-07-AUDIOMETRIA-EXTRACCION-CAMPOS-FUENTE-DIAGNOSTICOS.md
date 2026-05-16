# SPEC ARCH-20260516-07: Audiometría — Extracción de Campos Fuente del Formato Diagnóstico

## 1. Objetivo
Ampliar la extracción de Audiometría para capturar campos visibles del formato clínico/diagnóstico fuente que hoy no están contemplados en el contrato extractivo, preservando la separación entre:
- datos fuente documentales
- interpretación clínica generada por IA

## 2. Problema Observado
El extractor actual de Audiometría solo contempla:
- paciente
- fecha
- umbrales por frecuencia en oído derecho/izquierdo
- frecuencias detectadas
- completitud documental
- notas de calidad

Eso deja fuera campos visibles en el formato real, como:
- Faringe
- CAD
- CAI
- MTD
- MTI

## 3. Hallazgo Técnico
### Prompt actual
El prompt de extracción de Audiometría en `backend/app/services/ai/extractor.py` está limitado a frecuencias canónicas y calidad documental.

### Schema actual
`AudiometriaData` en `backend/app/schemas/medical.py` solo define umbrales y metadata mínima.

### Clasificación de los campos faltantes
- `Faringe`: no pertenece al contrato actual de Audiometría; parece hallazgo ORL/exploración física.
- `CAD` / `CAI`: hallazgos de oído derecho/izquierdo del formato clínico, hoy fuera del contrato de Audiometría.
- `MTD` / `MTI`: hallazgos de membrana timpánica derecha/izquierda, hoy fuera del contrato.
- `Descripción audiométrica`: por criterio clínico reportado por la doctora, no debe entrar al contrato extractivo de Audiometría; se excluye explícitamente del alcance.

## 4. Decisión Arquitectónica
Se aprueba ampliar la capa extractiva de Audiometría con un subbloque de "campos fuente del formato".

### Regla clave
Si el documento trae una descripción diagnóstica o semidiagnóstica escrita en el formato, esa sección debe ignorarse para la extracción de Audiometría porque no forma parte del contrato aprobado.

Esto conserva la arquitectura de dos momentos:
1. extracción fiel del documento
2. interpretación clínica IA separada

## 5. Alcance
### Incluye
- Extender `AudiometriaData` para soportar campos fuente adicionales cuando existan.
- Ajustar el prompt de extracción para leer esos campos del formato real.
- Mostrar esos campos en la vista de valores capturados si se extraen.

### No incluye
- Sustituir el prediagnóstico IA por la descripción escrita en el documento.
- Cambiar guardrails clínicos de la capa interpretativa.
- Fusionar Audiometría con Examen Médico.

## 6. Contrato Propuesto
Agregar a `AudiometriaData` campos opcionales como:

```json
{
  "paciente": "...",
  "fecha_estudio": "...",
  "oido_derecho": {"250": 5},
  "oido_izquierdo": {"250": 5},
  "faringe": "Sin datos patológicos",
  "cad": "permeable",
  "cai": "permeable",
  "mtd": "Íntegra, aspecto normal",
  "mti": "Íntegra, aspecto normal",
  "frecuencias_detectadas": ["250", "500"],
  "completitud_documental": "suficiente",
  "notas_calidad": null
}
```

## 7. Reglas de Extracción
1. Estos campos son opcionales; si no aparecen, no deben forzarse.
2. La sección de descripción audiométrica redactada en el formato debe ignorarse y no persistirse.
3. No mezclar estos campos con `summary` o `recommendation` de la capa clínica.
4. Mantener umbrales por frecuencia como núcleo principal del estudio.

## 8. Criterios de Aceptación
1. Una Audiometría con formato diagnóstico como el mostrado permite extraer `cad`, `cai`, `mtd` y `mti` cuando estén visibles.
2. Si existe `faringe` en el documento y forma parte del mismo formato, se captura como campo fuente opcional.
3. La UI de valores capturados muestra esos campos sin romper estudios viejos.
4. La descripción audiométrica escrita en el formato no se extrae ni se persiste.
5. El prediagnóstico IA sigue siendo una capa separada del texto fuente documental.

## 9. Consideración Clínica
Por criterio clínico de la doctora, la descripción audiométrica escrita en el formato no debe formar parte de la extracción aprobada para Audiometría. El extractor debe limitarse a parámetros y campos fuente válidos del formato, sin arrastrar esa sección narrativa.

## 10. Archivos Probables
- `backend/app/schemas/medical.py`
- `backend/app/services/ai/extractor.py`
- Componentes frontend que renderizan valores capturados de Audiometría
- Tests de extracción de Audiometría si existen

## 11. Prioridad
Este corte es complementario al de recomendación clínica visible. Corrige fidelidad extractiva del documento real.

## 12. Resultado Esperado
La extracción de Audiometría representa mejor el formato real de AMI y conserva separados:
- los parámetros y campos fuente válidos del formato
- lo que la IA interpreta