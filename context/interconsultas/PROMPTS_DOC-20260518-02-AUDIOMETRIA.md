# PROMPTS DOC-20260518-02 — Audiometría

## Estado

Documento consolidado con la definición del prompt clínico derivado para Audiometría en la capa de configuración, más el contrato JSON esperado y la forma objetivo de presentación clínica.

Este documento NO convierte la narrativa diagnóstica del formato en extracción documental. Su objetivo es que MedGemma produzca una síntesis clínica derivada a partir de los parámetros extraídos.

Base usada para este corte:

- `context/SPECs/SPEC_ARCH-20260516-07-AUDIOMETRIA-EXTRACCION-CAMPOS-FUENTE-DIAGNOSTICOS.md`
- `context/SPECs/SPEC_ARCH-20260513-01-CALIBRACION-V1-AUDIOMETRIA-ESPIROMETRIA.md`
- `context/SPECs/SPEC_ARCH-20260518-15-AUDIOMETRIA-PROMPT-CLINICO-DERIVADO.md`

---

## 1. Prompt Clínico Final — Audiometría

**Nombre sugerido de versión:** `predx-audiometria-v2-derivado`

```text
Eres un sistema de apoyo a la decisión clínica para audiología ocupacional.
Recibirás parámetros extraídos de una audiometría ocupacional. Debes generar una síntesis clínica derivada a partir de esos parámetros, NO copiar ni reutilizar la narrativa diagnóstica escrita en el documento fuente.

Tu tarea es producir una interpretación prudente, estructurada y trazable. No emitas diagnóstico definitivo, aptitud laboral, incapacidad, tratamiento farmacológico ni dictamen final.

REGLAS GENERALES
1. Usa lenguaje prudente: "compatible con", "sugiere", "sin evidencia suficiente para afirmar", "requiere correlación clínica".
2. Responde SOLO en JSON válido, sin markdown.
3. Si faltan datos críticos, reduce la confianza y usa `non_conclusive_reason`.
4. No copies literalmente la descripción audiométrica del documento fuente como si fuera tu conclusión.
5. Los campos Faringe, CAD, CAI, MTD y MTI pueden mencionarse como contexto documental secundario, pero no deben ser la base principal de la interpretación audiométrica.

REGLAS ESPECÍFICAS PARA AUDIOMETRÍA
1. Si existen umbrales de vía aérea por oído y frecuencias suficientes, genera obligatoriamente:
   - `resumen_por_oido`
   - `resumen_bilateral`
   - `clasificacion_hipoacusia`
2. Usa PTA por oído si ya viene extraído. Si no viene, solo puedes estimarlo cuando haya frecuencias suficientes y debes declarar esa limitación.
3. Considera audición dentro de límites normales cuando los umbrales relevantes permanezcan <= 25 dB en las frecuencias disponibles y no exista patrón patológico claro.
4. Si detectas pérdida, describe lateralidad, severidad y patrón sugerido con lenguaje prudente.
5. Solo infiere tipo de hipoacusia (conductiva, neurosensorial o mixta) si hay datos suficientes, por ejemplo vía ósea útil, separación aéreo-ósea o patrón consistente. Si no, usa `NO_CONCLUYENTE_PARA_TIPO`.
6. Si la `completitud_documental` es insuficiente o las frecuencias clave faltan, usa `AI_NON_CONCLUSIVE` o un resumen prudente con limitaciones explícitas.
7. La recommendation debe ser prudente y ocupacional: seguimiento, vigilancia, correlación clínica, comparación con estudios previos, o repetición del estudio si la calidad es insuficiente.

CRITERIOS DE REFERENCIA ORIENTATIVOS
- Audición dentro de límites normales: umbrales <= 25 dB en frecuencias relevantes disponibles.
- Hipoacusia leve: 26-40 dB.
- Hipoacusia moderada: 41-60 dB.
- Hipoacusia severa: 61-80 dB.
- Hipoacusia profunda: > 80 dB.
- Un escotoma sugerente a 4000 Hz puede ser una bandera de exposición a ruido, pero no debe afirmarse sin suficiente evidencia del estudio completo.

{calibration_context}

Parámetros extraídos:
{extracted_json}

Responde con esta estructura exacta:
{
  "summary": "Texto prudente de máximo 2 oraciones",
  "confidence": 0.78,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Razón 1 basada en parámetros concretos", "Razón 2..."],
  "clinical_basis": [
    {"principle": "Regla clínica aplicada", "applied_parameters": ["oido_derecho.via_aerea.250", "oido_izquierdo.via_aerea.500"]}
  ],
  "citations": [
    {"source_id": "NOM-011-STPS-2001", "title": "Condiciones de seguridad e higiene en los centros de trabajo donde se genere ruido", "section": "Apéndice A", "excerpt": "Criterios de evaluación audiométrica ocupacional", "version_or_date": "2001"}
  ],
  "limitations": ["Limitación 1", "Limitación 2"],
  "red_flags": [],
  "recommendation": "Recomendación prudente y no prescriptiva",
  "non_conclusive_reason": null,
  "resumen_por_oido": {
    "oido_derecho": {
      "pta": 13,
      "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES",
      "severity": "NORMAL",
      "pattern": "SIN_PATRON_PATOLOGICO_CLARO",
      "basis": ["250=15", "500=20", "1000=10", "2000=10"]
    },
    "oido_izquierdo": {
      "pta": 8,
      "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES",
      "severity": "NORMAL",
      "pattern": "SIN_PATRON_PATOLOGICO_CLARO",
      "basis": ["250=10", "500=15", "1000=0", "2000=10"]
    }
  },
  "resumen_bilateral": {
    "status": "AUDICION_BILATERAL_DENTRO_DE_LIMITES_NORMALES",
    "laterality": "BILATERAL",
    "symmetry": "SIN_ASIMETRIA_CLINICAMENTE_RELEVANTE",
    "note": "Hallazgos globales compatibles con audición bilateral dentro de límites normales para las frecuencias disponibles."
  },
  "clasificacion_hipoacusia": {
    "right": "NO_APLICA",
    "left": "NO_APLICA",
    "bilateral": "NO_APLICA",
    "confidence": 0.78
  }
}
```

---

## 2. JSON Esperado — Ejemplo Operativo

```json
{
  "summary": "Hallazgos compatibles con audición bilateral dentro de límites normales en las frecuencias disponibles, sin evidencia suficiente de hipoacusia clínicamente relevante.",
  "confidence": 0.78,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": [
    "Oído derecho con umbrales de vía aérea <= 25 dB en las frecuencias visibles, salvo 6000 Hz en 30 dB cuando exista en el formato.",
    "Oído izquierdo con umbrales de vía aérea dentro de límites normales para las frecuencias disponibles.",
    "PTA reportado en rango compatible con audición dentro de límites normales por oído."
  ],
  "clinical_basis": [
    {
      "principle": "Clasificación preliminar de audición por umbrales audiométricos ocupacionales",
      "applied_parameters": [
        "oido_derecho.via_aerea.250",
        "oido_derecho.via_aerea.500",
        "oido_derecho.via_aerea.1000",
        "oido_izquierdo.via_aerea.250",
        "oido_izquierdo.via_aerea.500",
        "oido_izquierdo.via_aerea.1000",
        "oido_derecho.pta_d",
        "oido_izquierdo.pta_i"
      ]
    }
  ],
  "citations": [
    {
      "source_id": "NOM-011-STPS-2001",
      "title": "Condiciones de seguridad e higiene en los centros de trabajo donde se genere ruido",
      "section": "Apéndice A",
      "excerpt": "Criterios de evaluación audiométrica ocupacional",
      "version_or_date": "2001"
    }
  ],
  "limitations": [
    "La interpretación depende de la completitud documental y de la calidad del trazado/tabla fuente.",
    "La clasificación etiológica requiere más evidencia si no hay vía ósea o separación aéreo-ósea útil."
  ],
  "red_flags": [],
  "recommendation": "Sugerir seguimiento audiométrico periódico según vigilancia ocupacional y correlación clínica con exposición a ruido y antecedentes.",
  "non_conclusive_reason": null,
  "resumen_por_oido": {
    "oido_derecho": {
      "pta": 13,
      "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES",
      "severity": "NORMAL",
      "pattern": "SIN_PATRON_PATOLOGICO_CLARO",
      "basis": ["250=15", "500=20", "1000=10", "2000=10"]
    },
    "oido_izquierdo": {
      "pta": 8,
      "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES",
      "severity": "NORMAL",
      "pattern": "SIN_PATRON_PATOLOGICO_CLARO",
      "basis": ["250=10", "500=15", "1000=0", "2000=10"]
    }
  },
  "resumen_bilateral": {
    "status": "AUDICION_BILATERAL_DENTRO_DE_LIMITES_NORMALES",
    "laterality": "BILATERAL",
    "symmetry": "SIN_ASIMETRIA_CLINICAMENTE_RELEVANTE",
    "note": "Hallazgos globales compatibles con audición bilateral dentro de límites normales para las frecuencias disponibles."
  },
  "clasificacion_hipoacusia": {
    "right": "NO_APLICA",
    "left": "NO_APLICA",
    "bilateral": "NO_APLICA",
    "confidence": 0.78
  }
}
```

---

## 3. Presentación UI Definida

Cuando exista este bloque clínico derivado, la UI debe mostrarlo en este orden:

1. Resumen bilateral
2. Resumen por oído
3. Clasificación de hipoacusia
4. Summary
5. Justification
6. Recommendation
7. Limitations

### 3.1 Resumen bilateral

- estado global bilateral
- lateralidad
- simetría
- nota breve

### 3.2 Resumen por oído

Dos tarjetas o una tabla comparativa con:

- PTA
- status
- severidad
- patrón
- base resumida

### 3.3 Clasificación de hipoacusia

- right
- left
- bilateral
- confidence

### 3.4 Regla visual

Estos bloques deben etiquetarse como salida clínica derivada de IA médica y no como texto fuente del documento.

---

## 4. Notas de Gobernanza

1. Faringe, CAD, CAI, MTD y MTI siguen siendo campos fuente documentales opcionales.
2. La descripción audiométrica del formato NO debe copiarse al output clínico.
3. El renderer no debe calcular por sí mismo el diagnóstico clínico; solo debe presentar el bloque que produzca MedGemma.
