# SPEC ARCH-20260518-15 - Audiometría: Prompt Clínico Derivado por MedGemma

## 1. Objetivo

Mover la síntesis clínica derivada de Audiometría a la capa de interpretación clínica de MedGemma, en lugar de intentar reconstruirla desde extracción documental o desde lógica dura en frontend.

## 2. Problema Detectado

El formato fuente de Audiometría puede incluir texto ya redactado como:

- descripción audiométrica
- diagnóstico audiométrico
- clasificación de hipoacusia
- recomendaciones

Sin embargo, por decisión arquitectónica vigente, ese bloque no debe persistirse como extracción documental aprobada. Aun así, la UI clínica necesita un resumen equivalente y clínicamente útil.

## 3. Decisión Arquitectónica

Se aprueba que ese bloque sea generado por la **capa clínica** de MedGemma usando como evidencia:

- umbrales por frecuencia por oído
- PTA por oído si está disponible
- vía ósea cuando exista
- separación aéreo-ósea cuando exista
- completitud/calidad documental

No se aprueba resolverlo en frontend con fórmulas rígidas como fuente principal.

## 4. Fundamento

La documentación vigente ya separa:

1. extracción documental fiel
2. interpretación clínica asistida

Y además establece explícitamente que la “descripción audiométrica” del formato no debe entrar al contrato extractivo.

Referencias:

- `context/SPECs/SPEC_ARCH-20260516-07-AUDIOMETRIA-EXTRACCION-CAMPOS-FUENTE-DIAGNOSTICOS.md`
- `context/SPECs/SPEC_ARCH-20260513-01-CALIBRACION-V1-AUDIOMETRIA-ESPIROMETRIA.md`
- `backend/app/services/ai/prediagnostic.py`

## 5. Alcance

### Incluye

- definir el prompt clínico final de `Audiometria` para la capa de configuración
- permitir que la calibración clínica por prueba pida explícitamente este bloque derivado
- ampliar el contrato JSON esperado del prediagnóstico para Audiometría
- definir cómo debe presentarse en UI el bloque clínico derivado cuando exista

### No incluye

- modificar extracción documental para persistir la descripción narrativa del formato
- convertir frontend en calculadora clínica principal
- emitir aptitud laboral o diagnóstico definitivo

## 6. Salida Clínica Esperada

La respuesta clínica de Audiometría debe incluir, además de los campos ya exigidos, estos bloques:

### 6.1 resumen_por_oido

```json
{
  "oido_derecho": {
    "pta": 13,
    "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES",
    "severity": "NORMAL",
    "pattern": "SIN_PATRON_PATOLOGICO_CLARO",
    "basis": ["via_aerea.250=15", "via_aerea.500=20", "via_aerea.1000=10"]
  },
  "oido_izquierdo": {
    "pta": 8,
    "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES",
    "severity": "NORMAL",
    "pattern": "SIN_PATRON_PATOLOGICO_CLARO",
    "basis": ["via_aerea.250=10", "via_aerea.500=15", "via_aerea.1000=0"]
  }
}
```

### 6.2 resumen_bilateral

```json
{
  "status": "AUDICION_BILATERAL_DENTRO_DE_LIMITES_NORMALES",
  "laterality": "BILATERAL",
  "symmetry": "SIN_ASIMETRIA_CLINICAMENTE_RELEVANTE",
  "note": "Hallazgos globales compatibles con audición bilateral dentro de límites normales para las frecuencias disponibles."
}
```

### 6.3 clasificacion_hipoacusia

```json
{
  "right": "NO_APLICA",
  "left": "NO_APLICA",
  "bilateral": "NO_APLICA",
  "confidence": 0.74
}
```

### 6.4 recommendation

Debe mantenerse prudente y ocupacional, sin aptitud ni tratamiento.

## 7. Prompt Clínico Propuesto para Audiometría

Bloque recomendado para insertar o fusionar en `PREDIAGNOSTIC_PROMPTS["Audiometria"]`:

```text
Reglas específicas para Audiometría ocupacional:

1. Interpreta la audiometría como capa clínica derivada, no como extracción textual del formato.
2. Si existen umbrales de vía aérea por oído y frecuencias suficientes, genera obligatoriamente:
   - resumen_por_oido
   - resumen_bilateral
   - clasificacion_hipoacusia
3. Usa PTA por oído si ya viene extraído; si no viene, puedes estimarlo solo cuando haya frecuencias suficientes y deja esa limitación explícita.
4. Determina audición dentro de límites normales cuando los umbrales relevantes permanezcan <= 25 dB en las frecuencias disponibles y no exista patrón patológico claro.
5. Si hay pérdida, describe lateralidad, severidad y patrón sugerido con lenguaje prudente: conductiva, neurosensorial, mixta o no concluyente.
6. Solo infiere conductiva, neurosensorial o mixta si existen datos suficientes (por ejemplo vía ósea, separación aéreo-ósea u otros patrones consistentes). Si no, usa NO_CONCLUYENTE_PARA_TIPO.
7. No copies ni reproduzcas la descripción audiométrica escrita dentro del documento fuente como si fuera tu conclusión. Tu salida debe derivarse de los parámetros extraídos.
8. Los campos Faringe, CAD, CAI, MTD y MTI pueden mencionarse como contexto documental, pero no deben ser la base principal de la conclusión audiométrica.
9. Mantén lenguaje prudente: "compatible con", "sugiere", "sin evidencia suficiente para afirmar", "requiere correlación clínica".
10. No emitas aptitud laboral, dictamen definitivo, incapacidad ni tratamiento farmacológico.
```

## 8. JSON Esperado Propuesto

La salida clínica de Audiometría debe tender a esta forma:

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

## 9. Presentación UI Esperada

Cuando la salida clínica de Audiometría traiga los bloques derivados, la UI de prediagnóstico debe presentarlos en este orden:

### 9.1 Resumen bilateral

- estado global bilateral
- lateralidad
- simetría
- nota clínica breve

### 9.2 Resumen por oído

Dos tarjetas paralelas o una tabla de dos columnas:

- PTA
- status
- severidad
- patrón
- base resumida

### 9.3 Clasificación de hipoacusia

- right
- left
- bilateral
- confidence

### 9.4 Relación con el resto del prediagnóstico

Estos bloques:

- no sustituyen `summary`
- no sustituyen `justification`
- no sustituyen `recommendation`
- complementan el prediagnóstico estructurado y deben verse como salida derivada de MedGemma

## 10. Criterios de Aceptación

1. El prompt clínico de Audiometría exige explícitamente resumen por oído y resumen bilateral.
2. MedGemma deja de depender de la descripción narrativa del documento fuente para producir su síntesis.
3. La salida clínica conserva el contrato base existente y añade bloques específicos de Audiometría.
4. Si faltan datos suficientes, la clasificación etiológica degrada a no concluyente en vez de inventar tipo de hipoacusia.
5. Faringe/CAD/CAI/MTD/MTI no se convierten en base principal de la conclusión audiométrica.
6. La UI clínica tiene un orden de presentación claro para resumen bilateral, resumen por oído y clasificación.

## 11. Archivos Probables

- `backend/app/services/ai/prediagnostic.py`
- `backend/app/schemas/medical.py` si se decide formalizar campos nuevos del output clínico
- capa de configuración clínica por prueba
- superficies frontend que presenten el prediagnóstico clínico de Audiometría

## 12. Resultado Esperado

Audiometría conserva una extracción documental limpia y, además, obtiene un bloque clínico derivado consistente, explicable y trazable desde MedGemma, alineado con la lógica del formato sin copiarlo textualmente.