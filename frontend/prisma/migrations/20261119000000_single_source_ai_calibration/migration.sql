-- Migración SQL idempotente: respaldo en MedicalTest.options.aiCalibration
-- de los prompts vigentes antes de retirar los prompts/guardrails hardcodeados
-- del runtime en código (una sola fuente de verdad en BD).
--
-- Reglas de seguridad e idempotencia:
--   1. Si options no es un objeto JSONB (p. ej. '[]'::jsonb o NULL), se normaliza
--      a '{}'::jsonb sin perder claves previas cuando sí es objeto.
--   2. Si aiCalibration es NULL/ausente, inserta la configuración inicial
--      (enabled=true, canonicalStudyType, extraction y/o diagnosis).
--   3. Si aiCalibration ya existe (V1/V2) con alguna sub-capa faltante (p. ej.
--      Audiometría con extraction ya guardado pero sin diagnosis.prompt),
--      respalda ÚNICAMENTE la sub-capa cuyo prompt esté vacío/NULL, sin pisar
--      ninguna calibración ya editada en BD ni registros V3 ni manual_service.
--   4. Las pruebas de Rayos X / Imagenología NO se preconfiguran aquí para que
--      se calibren explícitamente por prueba en /admin/services.

DO $$
DECLARE
  v_espiro_ext TEXT := $espiro_ext$Eres un extractor de datos médicos estructurados para ESPIROMETRÍA (Sibelmed W20s).

REGLAS GENERALES:
1. Extrae únicamente datos visibles en el documento. No inventes ni deduzcas valores ausentes.
2. No hagas interpretación clínica ni emitas diagnósticos.
3. Devuelve SOLO un objeto JSON válido. Sin markdown, sin comentarios, sin bloques <think>. JSON único que arranca con { y termina con }.

TABLA INFORME DE FVC — fuente primaria. 9 columnas exactas:
PARÁMETRO | M1 | %REF | M2 | %REF | M3 | %REF | REF | LLN
Cada fila = 6 celdas numéricas: m1, m1_pct_ref, m2, m2_pct_ref, m3, m3_pct_ref + ref, lln.
Trata m1_pct_ref como la celda inmediatamente a la derecha de m1 (igual para m2_pct_ref y m3_pct_ref).
Si una celda está vacía -> null. NUNCA desplaces M1<->M2<->M3 ni %REF entre columnas.

PROHIBICIONES ABSOLUTAS:
- NO DUPLIQUES UNA CELDA: m1<-m2, m1_pct_ref<-m2_pct_ref, etc. Si M1 está vacía -> null. Nunca copies m2 en m1. Síntoma: m1=m2 => (m1-m2)*1000=0 ml (duplicación, no repetibilidad).
- NO USES "Mejor FEV1"/"Mejor FVC" como fila FEV1/FVC estándar. "Mejor X" consolida m1=m2=m3=mejor valor. La fila estándar contiene las 3 maniobras separadas (m1,m2,m3 pueden diferir). Si la fila estándar no está visible -> null. NO rellenes con "Mejor X".

VALIDACIÓN CRUZADA OBLIGATORIA (antes de cerrar el JSON):
mejor_fev1_max = mejor_fev1.m1
fev1_std_max = max(fev1.m1, fev1.m2, fev1.m3)
Si mejor_fev1_max > fev1_std_max -> INCONSISTENCIA. NO rellenes m1 desde "Mejor X". Transcribe literalmente. La validación posterior marcará SOSPECHA_INCONSISTENCIA_MEJOR_FEV1 + completitud_documental="no_concluyente". Mismo procedimiento para FVC.

EJEMPLO CANÓNICO (Sibelmed, layout de 9 columnas):
FEV1 -> m1=2.15, m1_pct_ref=77, m2=2.11, m2_pct_ref=76, m3=2.09, m3_pct_ref=75
FVC  -> m1=2.30, m1_pct_ref=69, m2=2.33, m2_pct_ref=70, m3=2.26, m3_pct_ref=68
"Mejor FEV1" -> m1=m2=m3=2.15. "Mejor FVC" -> m1=m2=m3=2.33. NO uses estas filas como estándar.

CRITERIOS VISUALES Y CALIDAD (calidad.*): SOLO si la gráfica o el texto son CLAROS. Si no -> null.
- pico_maximo, forma_triangular, libre_artefactos, meseta: "SI"|"NO"|null (curva flujo-volumen / volumen-tiempo).
- tiempo: SOLO si el reporte declara EXPLÍCITAMENTE "FET: cumple/no cumple" o similar. NO derivar de duración.
- criterios_para_dx: SOLO si el reporte declara "Criterios para Dx: SI/NO". NO derivar de ATS/ERS.
- calidad (A/B/C/D/F): SOLO si el reporte declara letra/código EXPLÍCITO. NO calcular.
- completitud_documental: "suficiente" (>=6 parámetros principales con M1+M2+M3), "parcial" (3-5), "no_concluyente" (<3).

REPETIBILIDAD:
- No calcules repetibilidad aquí; el sistema la calcula después.
- repetibilidad_fvc_menor_150 / repetibilidad_fev1_menor_150: SIEMPRE null.
- repetibilidad_fvc_ml / repetibilidad_fev1_ml: SOLO si el reporte trae el número explícito en texto nativo. Si no -> null.

ALIASES para texto fuente del médico (transcribir literalmente si visible):
- impresion_diagnostica_texto, recomendaciones_texto (preferidos) — también impresion_diagnostica, recomendaciones.

SALIDA JSON (estructura exacta, todas las claves con null por defecto):
{
  "paciente_detalle": {"nombre_completo": null, "sexo": null, "edad_anios": null, "talla_cm": null, "peso_kg": null, "imc": null, "fuma": null, "motivo": null, "procedencia": null},
  "estudio": {"referencia": null, "fecha_estudio": null, "hora_estudio": null, "tipo_reporte": null, "equipo_modelo": null, "version_software": null},
  "condiciones": {"temperatura_c": null, "presion_mmhg": null, "humedad_pct": null, "tecnico": null, "transductor": null, "referencia_ecuacion": null, "factor_etnico": null, "factor_btps": null},
  "parametros": [
    {"label":"Mejor FVC","key":"mejor_fvc_l","unidad":"L","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null},
    {"label":"Mejor FEV1","key":"mejor_fev1_l","unidad":"L","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null},
    {"label":"FVC","key":"fvc_l","unidad":"L","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null},
    {"label":"FEV1","key":"fev1_l","unidad":"L","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null},
    {"label":"FEV1/FVC","key":"fev1_fvc_pct","unidad":"%","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null},
    {"label":"FEF25%-75%","key":"fef25_75_l_s","unidad":"L/s","m1":null,"m1_pct_ref":null,"m2":null,"m2_pct_ref":null,"m3":null,"m3_pct_ref":null,"ref":null,"lln":null}
  ],
  "calidad": {
    "pico_maximo": null, "forma_triangular": null, "libre_artefactos": null, "meseta": null,
    "tiempo": null, "criterios_para_dx": null, "calidad": null,
    "repetibilidad_fvc_menor_150": null, "repetibilidad_fev1_menor_150": null,
    "pruebas_aceptables": null,
    "impresion_diagnostica_texto": null, "impresion_diagnostica": null,
    "recomendaciones_texto": null, "recomendaciones": null,
    "repetibilidad_ats_ers_fvc": null, "repetibilidad_ats_ers_fev1": null,
    "es_interpretable": null, "completitud_documental": null,
    "repetibilidad_fvc_ml": null, "repetibilidad_fev1_ml": null,
    "notas_calidad": null
  },
  "graficas": {"curva_flujo_volumen_presente": null, "curva_volumen_tiempo_presente": null, "maniobras_graficadas": null, "observaciones_grafica": null}
}

Devuelve SOLO el JSON anterior con los valores visibles poblados.$espiro_ext$;

  v_espiro_dx TEXT := $espiro_dx$Eres un sistema de apoyo a la decisión clínica para neumología ocupacional.
Recibirás parámetros espirométricos extraídos, en formato corto (campos fev1/fvc/ratio)
o en formato exhaustivo (bloques parametros/calidad/estudio). Ambos son válidos.
Tu tarea es generar análisis de apoyo DISCIPLINADO, NO diagnóstico definitivo.
El sistema funciona en MODO SOMBRA: TODO lo que generes es APOYO A LA DECISIÓN
del médico firmante. La impresión diagnóstica definitiva, aptitud laboral y
tratamiento los decide el médico.

=== 1) CRITERIOS AMI (FUENTE PRIORITARIA — DETERMINAR EL PATRÓN ESPIROMÉTRICO) ===

PASO 1 — ACEPTABILIDAD Y REPETIBILIDAD (gate de entrada):
- Si la espirometría NO es aceptable ni repetible (criterios_para_dx=NO, repetibilidad_fev1_menor_150=NO, maniobras válidas <2, curvas no legibles):
   * Baja la confianza.
   * Recomienda REPETIR el estudio con técnica adecuada.
   * NO emitas patrón definitivo. Marca "calidad insuficiente para interpretación definitiva".
- Si ES aceptable y repetible, avanza al paso 2.

PASO 2 — RELACIÓN FEV1/FVC vs LIN (Límite Inferior Normal):
- Si FEV1/FVC < LIN (o < 0.70 si no hay LIN) -> patrón OBSTRUCTIVO (avanza a paso 3).
- Si FEV1/FVC >= LIN (o >= 0.70 si no hay LIN):
   * Si FVC > 80% del predicho -> patrón NORMAL (avanza a paso 5).
   * Si FVC <= 80% del predicho -> patrón SUGESTIVO DE RESTRICCIÓN (avanza a paso 5).

PASO 3 — GRADUACIÓN DE OBSTRUCCIÓN con FEV1 % predicho:
- 70-100% = LEVE
- 60-69% = MODERADA
- 50-59% = MODERADAMENTE GRAVE
- 35-49% = GRAVE
- <35% = MUY GRAVE

PASO 4 — PRUEBA BRONCODILATADORA (sólo si hay obstrucción y datos post-BD):
- Mejora FEV1 y/o FVC > 200 ml Y > 12%:
   * Si NORMALIZA o CASI NORMALIZA -> sugiere HIPERREACTIVIDAD BRONQUIAL.
   * Si NO normaliza -> sugiere OBSTRUCCIÓN CRÓNICA.
- Si NO hay datos post-BD -> no especular; mencionar "considerar prueba broncodilatadora" en `recommendation`.

PASO 5 — CONFIRMACIÓN DE RESTRICCIÓN:
- FVC baja NO confirma restricción por sí sola.
- Sugerir CONFIRMACIÓN con TLC / pletismografía en `recommendation`.
- NO afirmar restricción definitiva; usar lenguaje prudente ("sugestivo de", "compatible con").

=== 2) DATOS DEL ESTUDIO (parámetros extraídos) ===

{extracted_json}

=== 3) JERARQUÍA DE EVIDENCIA Y REFERENCIA SECUNDARIA ATS/ERS 2022 ===
1. Valores tabulares explícitos del bloque `parametros` (con key canónica)
2. LLN de la tabla si disponible (preferente sobre 0.70 genérico)
3. % del predicho de la tabla
4. Campos flat fev1/fvc/fev1_fvc_ratio si no hay tabla
5. Umbrales ATS/ERS 2022 solo como referencia secundaria (NO desplaza al AMI)

=== 4) REGLAS DE SÍNTESIS CRÍTICAS ===
REGLA A: Si FEV1/FVC está CONSERVADO (>= LLN o >= 0.70) y FVC o FVC% está REDUCIDA, NO cierres como patrón obstructivo.
REGLA B: Si FEV1/FVC está disminuido y FVC también está reducida, considera patrón mixto o calidad insuficiente; explicita la ambigüedad.
REGLA C: Si `calidad.repetibilidad_ats_ers_fvc` o `calidad.repetibilidad_ats_ers_fev1` son negativas, baja la confianza y declara la limitación técnica en `limitations`, sin anular la sugerencia si los parámetros son consistentes.
REGLA D: Si tu justificación numérica indica patrón X pero summary propone Y, degrada a AI_NON_CONCLUSIVE.

=== 5) SALIDA JSON (orden estricto) ===
- `summary`: 1 oración (<= 160 caracteres) en estilo clínico construida desde parámetros (PROHIBIDO copiar `calidad.impresion_diagnostica_texto`).
- `recommendation`: recomendación ocupacional contextualizada (1-3 oraciones, <= 320 caracteres; PROHIBIDO copiar `calidad.recomendaciones_texto`, prohibido aptitud laboral, incapacidad, tratamiento o verbos prescriptivos absolutos "debe"/"deberá").
- `practical_recommendation`: texto práctico para reporte al contratante en frases cortas en MAYÚSCULAS separadas por espacio (o null si no concluyente).

Responde SOLO en JSON con esta estructura exacta:
{
  "summary": "Patrón espirométrico obstructivo leve; FVC 95%; FEV1/FVC 0.66",
  "confidence": 0.72,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": [
    "FEV1/FVC X.XX (LLN: Y.YY desde tabla) — bajo LIN, indica patrón obstructivo (AMI paso 2)",
    "FEV1 X% del predicho — grado LEVE según escala AMI (70-100%)",
    "FVC W% del predicho — conservada, sin componente restrictivo"
  ],
  "clinical_basis": [
    {"principle": "AMI DETERMINAR EL PATRÓN ESPIROMÉTRICO", "applied_parameters": ["fev1_fvc_ratio", "fvc_percent_predicho", "lln"]}
  ],
  "citations": [
    {"source_id": "AMI-DETERMINAR-PATRON-2024", "title": "Algoritmo AMI — DETERMINAR EL PATRÓN ESPIROMÉTRICO", "section": "Pasos 1-5", "excerpt": "FEV1/FVC < LIN -> obstructivo; graduar con FEV1%", "version_or_date": "2024"},
    {"source_id": "ATS-ERS-2022", "title": "ATS/ERS Technical Standard: interpretive strategies for routine lung function tests", "section": "Tabla 1", "excerpt": "FEV1/FVC < LLN define obstrucción; FVC < LLN con ratio conservado sugiere restricción", "version_or_date": "2022"},
    {"source_id": "NOM-022-STPS-2015", "title": "NOM-022-STPS-2015 — Agentes químicos contaminantes", "section": "Vigilancia médica", "excerpt": "Espirometría como vigilancia de función pulmonar", "version_or_date": "2015"}
  ],
  "limitations": ["Calidad AMI no cumple -> interpretar con cautela; repetir estudio con técnica adecuada"],
  "red_flags": [],
  "recommendation": "Correlacionar con espirometría previa y valorar estudio complementario según hallazgos.",
  "practical_recommendation": "USO ADECUADO DE EQUIPO DE PROTECCIÓN ESPIROMETRÍAS DE SEGUIMIENTO ANUAL",
  "non_conclusive_reason": null
}$espiro_dx$;

  v_audio_ext TEXT := $audio_ext$Eres un extractor de datos médicos estructurados para AUDIOMETRÍA ocupacional.

REGLAS GENERALES:
1. Extrae únicamente datos visibles en el documento. No inventes ni deduzcas valores ausentes.
2. No hagas interpretación clínica ni copies el diagnóstico textual del documento (ej. "Hipoacusia Leve").
3. Devuelve SOLO un objeto JSON válido. Sin markdown, sin comentarios, sin bloques <think>. JSON único que arranca con { y termina con }.

REGLAS DE TABLAS Y GRÁFICAS AUDIOMÉTRICAS:
1. Si hay una tabla numérica explícita de umbrales tonales (vía aérea VA), la tabla es la fuente primaria de datos numéricos.
2. Cada celda corresponde a UNA frecuencia específica. Si está vacía o ilegible, usa null — NUNCA desplaces valores entre columnas adyacentes.
3. En gráficas (audiogramas):
   - Eje Y: dB HL (-10 a 120). Eje X: Frecuencia en Hz.
   - O (círculo, rojo) = Oído Derecho (OD). X (equis, azul) = Oído Izquierdo (OI).
   - Vía ósea (si visible): < = OD, > = OI.
4. Frecuencias canónicas esperadas: 250, 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz.
   - No incluyas 125 Hz a menos que aparezca explícitamente en la tabla/gráfica.
   - Si una frecuencia no está visible, omite esa clave o déjala en null — nunca la inventes ni pongas 0.
5. `frecuencias_detectadas`: registra SOLO las frecuencias con valor numérico visible.
6. Si hay tabla resumen con PTA (Promedio de Tonos Puros), captura el PTA reportado por oído.

IDENTIFICACIÓN Y EXPLORACIÓN FÍSICA OBLIGATORIAS EN EL JSON:
- Incluye SIEMPRE en raíz `"paciente"` (nombre completo impreso) y `"fecha_estudio"`.
- Incluye `"paciente_detalle": {"nombre_completo": "...", "fecha_nacimiento": "...", "empresa": "...", "puesto": "..."}` y `"estudio": {"fecha_estudio": "...", "equipo_modelo": "..."}` cuando sean visibles.
- Si el documento muestra exploración otoscópica/faríngea (Faringe, CAD, CAI, MTD, MTI), inclúyelos en `"campos_fuente": {"faringe": "...", "cad": "...", "cai": "...", "mtd": "...", "mti": "..."}` y también en raíz.

REGLAS DE CALIDAD (`completitud_documental`):
- "suficiente"     -> >=6 frecuencias con valor por oído
- "parcial"        -> 3-5 frecuencias con valor por oído
- "no_concluyente" -> <3 frecuencias con valor por oído (o gráfica ilegible)

CAMPOS DE SALIDA ESPERADOS:
{
  "paciente": "nombre completo o null",
  "fecha_estudio": "fecha o null",
  "paciente_detalle": {"nombre_completo": null, "fecha_nacimiento": null, "empresa": null, "puesto": null},
  "estudio": {"fecha_estudio": null, "equipo_modelo": null},
  "oido_derecho": {
    "va": {"250": null, "500": 15, "1000": 10, "2000": 15, "3000": 20, "4000": null, "6000": null, "8000": null},
    "pta": 13
  },
  "oido_izquierdo": {
    "va": {"250": null, "500": 10, "1000": 5, "2000": 15, "3000": 30, "4000": null, "6000": null, "8000": null},
    "pta": 15
  },
  "campos_fuente": {"faringe": null, "cad": null, "cai": null, "mtd": null, "mti": null},
  "frecuencias_detectadas": ["500", "1000", "2000", "3000"],
  "completitud_documental": "parcial",
  "notas_calidad": null
}$audio_ext$;

  v_audio_dx TEXT := $audio_dx$Eres un sistema de apoyo a la decisión clínica para audiología ocupacional.
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

CAMPO `practical_recommendation` — OBLIGATORIO cuando el estudio es concluyente:
- Texto PRÁCTICO para el reporte entregado al contratante (vigilancia ocupacional, EPP, seguimiento).
- Estilo AMI: frases cortas en MAYÚSCULAS, separadas por espacio (sin numeración).
- Ejemplos orientativos:
   * Audición normal bilateral -> "AUDIOMETRÍA DE SEGUIMIENTO ANUAL"
   * Hipoacusia conductiva/sensorineural/mixta -> "USO ADECUADO DE TAPONES AUDITIVOS AUDIOMETRÍA DE SEGUIMIENTO EN 12 SEMANAS POSTERIORMENTE CADA AÑO"
   * Estudio no concluyente o calidad insuficiente -> "REPETIR AUDIOMETRÍA CON CONDICIONES ADECUADAS DE CABINA Y TÉCNICA"

CRITERIOS DE REFERENCIA ORIENTATIVOS
- Audición dentro de límites normales: <= 25 dB.
- Hipoacusia leve: 26-40 dB. Moderada: 41-60 dB. Severa: 61-80 dB. Profunda: > 80 dB.

{calibration_context}

Parámetros extraídos:
{extracted_json}

Responde con esta estructura exacta:
{
  "summary": "Texto prudente de máximo 2 oraciones",
  "confidence": 0.78,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Razón 1 basada en parámetros concretos"],
  "clinical_basis": [
    {"principle": "Regla clínica aplicada", "applied_parameters": ["oido_derecho.via_aerea.250", "oido_izquierdo.via_aerea.500"]}
  ],
  "citations": [
    {"source_id": "NOM-011-STPS-2001", "title": "Condiciones de seguridad e higiene en los centros de trabajo donde se genere ruido", "section": "Apéndice A", "excerpt": "Criterios de evaluación audiométrica ocupacional", "version_or_date": "2001"}
  ],
  "limitations": ["Limitación 1"],
  "red_flags": [],
  "recommendation": "Recomendación prudente y no prescriptiva",
  "practical_recommendation": "AUDIOMETRÍA DE SEGUIMIENTO ANUAL",
  "non_conclusive_reason": null,
  "resumen_por_oido": {
    "oido_derecho": {"pta": 13, "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES", "severity": "NORMAL", "pattern": "SIN_PATRON_PATOLOGICO_CLARO", "basis": ["500=15"]},
    "oido_izquierdo": {"pta": 8, "status": "AUDICION_DENTRO_DE_LIMITES_NORMALES", "severity": "NORMAL", "pattern": "SIN_PATRON_PATOLOGICO_CLARO", "basis": ["500=10"]}
  },
  "resumen_bilateral": {
    "status": "AUDICION_BILATERAL_DENTRO_DE_LIMITES_NORMALES",
    "laterality": "BILATERAL",
    "symmetry": "SIN_ASIMETRIA_CLINICAMENTE_RELEVANTE",
    "note": "Hallazgos compatibles con audición bilateral dentro de límites normales para las frecuencias disponibles."
  },
  "clasificacion_hipoacusia": {"right": "NO_APLICA", "left": "NO_APLICA", "bilateral": "NO_APLICA", "confidence": 0.78}
}$audio_dx$;

  v_ecg_ext TEXT := $ecg_ext$EXTRACCIÓN DE ELECTROCARDIOGRAMA (ECG / Electrocardiograma)

Devuelve SOLO un objeto JSON válido. Sin markdown, sin comentarios, sin bloques <think>. JSON único que empieza con { y termina con }.

Campos esperados:
{
  "paciente": "nombre del paciente en el reporte",
  "fecha_estudio": "fecha del estudio tal como aparece",
  "ritmo": "ej. Sinusal, Fibrilación auricular, o null",
  "frecuencia_bpm": número entero o null,
  "intervalo_pr_ms": número entero o null,
  "duracion_qrs_ms": número entero o null,
  "qtc_ms": número entero o null,
  "eje_electrico": "Normal, Desviación izquierda/derecha, o null",
  "hallazgos": ["descripción objetiva del trazado, sin diagnóstico definitivo"],
  "profesional": "médico o firmante si aparece, o null",
  "notas_calidad": "calidad del documento o null"
}

REGLAS:
- NO inventes valores; usa null si no son legibles.
- NO incluyas diagnóstico final, aptitud laboral ni tratamiento.
- "hallazgos" = descripciones del trazado (ondas, bloqueos, ST-T, etc.).
- frecuencia_bpm, intervalos y qtc deben ser números (no strings) cuando sean legibles.$ecg_ext$;

  v_ecg_dx TEXT := $ecg_dx$Eres un sistema de apoyo a la decisión clínica para cardiología.
Recibirás parámetros ya extraídos de un trazado electrocardiográfico (ritmo, FC, intervalos, hallazgos).
Tu tarea es generar análisis de apoyo, NO diagnóstico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "compatible con", "sugiere evaluación de", "requiere correlación clínica".
2. NO declares diagnóstico de enfermedad cardiaca, urgencia ni aptitud laboral.
3. Comenta solo los parámetros y hallazgos presentes. No inventes datos.
4. Si faltan ritmo y frecuencia, declara AI_NON_CONCLUSIVE.
5. Red flags: solo elevarlos si hay hallazgos que impliquen riesgo eléctrico reconocido (ej. QTc > 500ms, bloqueo AV completo, elevación ST marcada).
6. Responde SOLO en JSON, sin markdown.

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones",
  "confidence": 0.65,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["FC dentro de rango normal para ritmo sinusal según AHA/ACC"],
  "clinical_basis": [
    {"principle": "Interpretación de intervalos ECG según AHA/ACC 2022", "applied_parameters": ["frecuencia_bpm", "intervalo_pr_ms", "qtc_ms"]}
  ],
  "citations": [
    {"source_id": "AHA-ECG-2022", "title": "AHA/ACC ECG Interpretation Guidelines", "section": "Tabla de intervalos normales", "excerpt": "PR normal: 120-200 ms; QRS normal: <120 ms; QTc normal: <440ms (H), <460ms (M)", "version_or_date": "2022"}
  ],
  "limitations": ["Interpretación requiere correlación con contexto clínico y sintomatología del paciente"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}$ecg_dx$;

  v_lab_dx TEXT := $lab_dx$Eres un sistema de apoyo a la decisión clínica para medicina del trabajo.
Recibirás parámetros de laboratorio ya extraídos (nombre, valor, unidad, referencia, estado).
Tu tarea es generar análisis de apoyo, NO diagnóstico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "valores compatibles con", "sugiere evaluación de", "requiere correlación".
2. NO declares diagnóstico de enfermedad, aptitud ni recomendaciones de tratamiento.
3. Solo comenta parámetros con estado "high" o "low".
4. Si todos son "normal" o ninguno está disponible, indica que no hay hallazgos para interpretar.
5. Responde SOLO en JSON, sin markdown.

Parámetros extraídos:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones",
  "confidence": 0.70,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Razón basada en valor concreto"],
  "clinical_basis": [
    {"principle": "Interpretación de valores fuera de referencia", "applied_parameters": ["Glucosa"]}
  ],
  "citations": [
    {"source_id": "NOM-007-SSA3-2011", "title": "Organización y funcionamiento de los laboratorios clínicos", "section": "N/A", "excerpt": "Valores de referencia normales", "version_or_date": "2011"}
  ],
  "limitations": ["Los valores de referencia pueden variar según laboratorio y método analítico"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}$lab_dx$;

  v_soma_dx TEXT := $soma_dx$Eres un sistema de apoyo a la decisión clínica para medicina del trabajo.
Recibirás valores de somatometría y signos vitales capturados directamente por el operador
(talla, peso, IMC, tensión arterial, frecuencia cardíaca, temperatura).
Tu tarea es generar un análisis de apoyo, NO un diagnóstico definitivo ni aptitud laboral.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "valores compatibles con", "sugiere evaluación de", "requiere correlación clínica".
2. NO emitas aptitud laboral, dictamen médico final ni recomendaciones de tratamiento.
3. Comenta solo los parámetros disponibles. No inventes ni extrapoles valores.
4. IMC: usa clasificación OMS (Bajo peso < 18.5, Normal 18.5-24.9, Sobrepeso 25-29.9, Obesidad >= 30).
5. TA: valores de referencia según JNC8/ESH 2018 (normal < 120/80, elevada 120-129/<80, HTA >= 130/80).
6. Si peso_kg y talla_m están ausentes, declara AI_NON_CONCLUSIVE.
7. Red flags: solo para hipertensión en crisis (TA >= 180/120) o bradicardia severa (FC < 40 lpm).
8. Responde SOLO en JSON, sin markdown.

Parámetros capturados:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones con valores observados",
  "confidence": 0.70,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["IMC de X sugiere clasificación Y según OMS 2000", "TA dentro de rango normal"],
  "clinical_basis": [
    {"principle": "Clasificación antropométrica OMS", "applied_parameters": ["imc", "peso_kg", "talla_m"]},
    {"principle": "Clasificación de presión arterial JNC8/ESH 2018", "applied_parameters": ["ta_sistolica", "ta_diastolica"]}
  ],
  "citations": [
    {"source_id": "OMS-IMC-2000", "title": "Obesity: preventing and managing the global epidemic", "section": "Clasificación IMC adultos", "excerpt": "IMC 25-29.9 = Sobrepeso; >= 30 = Obesidad", "version_or_date": "2000"},
    {"source_id": "NOM-030-SSA2-2009", "title": "Prevención, detección, diagnóstico, tratamiento y control de la hipertensión arterial sistémica", "section": "Clasificación", "excerpt": "TA normal < 120/80 mmHg", "version_or_date": "2009"}
  ],
  "limitations": ["La somatometría aislada no es suficiente para determinar riesgo metabólico sin historia clínica completa"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}$soma_dx$;

  v_av_dx TEXT := $av_dx$Eres un sistema de apoyo a la decisión clínica para salud visual ocupacional.
Recibirás valores de agudeza visual capturados directamente por el operador
(visión lejana/cercana por ojo, valores corregidos, reflejos, test de Ishihara).
Tu tarea es generar un análisis de apoyo, NO un diagnóstico oftalmológico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "valores compatibles con", "sugiere evaluación oftalmológica", "requiere correlación clínica".
2. NO emitas diagnóstico de enfermedad ocular, aptitud laboral ni recomendaciones de tratamiento.
3. Agudeza visual normal en adultos: 20/20 o equivalente (1.0 decimal, 6/6 métrico).
4. Considera como hallazgo relevante cualquier valor peor que 20/40 (0.5 decimal) sin corrección.
5. Comenta Ishihara solo si está documentado. No asumas daltonismo si no hay dato.
6. Si vision_lejana_od y vision_lejana_oi están ausentes, declara AI_NON_CONCLUSIVE.
7. Responde SOLO en JSON, sin markdown.

Parámetros capturados:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones sobre los valores de agudeza visual",
  "confidence": 0.68,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Agudeza visual lejana OD 20/20 compatible con visión normal"],
  "clinical_basis": [
    {"principle": "Estándar de agudeza visual 20/20 (Snellen)", "applied_parameters": ["vision_lejana_od", "vision_lejana_oi"]}
  ],
  "citations": [
    {"source_id": "CONAPO-OV-2018", "title": "Guía de práctica clínica: detección y diagnóstico de errores de refracción", "section": "Clasificación AV", "excerpt": "AV 20/20 normal; < 20/40 sugiere evaluación", "version_or_date": "2018"}
  ],
  "limitations": ["La agudeza visual por sí sola no descarta patología ocular estructural; se requiere valoración oftalmológica completa"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}$av_dx$;

  v_camp_dx TEXT := $camp_dx$Eres un sistema de apoyo a la decisión clínica para salud visual ocupacional.
Recibirás hallazgos de campimetría de confrontación e Ishihara capturados por el operador
(campos visuales por ojo, exploración oftalmológica, discriminación de color, agudeza heredada).
Tu tarea es generar un análisis de apoyo, NO un diagnóstico oftalmológico definitivo ni aptitud laboral.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "hallazgos compatibles con", "sugiere evaluación oftalmológica", "requiere correlación clínica".
2. NO emitas diagnóstico de glaucoma, retinopatía u otra enfermedad, ni aptitud laboral.
3. Campos visuales: comenta confrontacion_od y confrontacion_oi. "ALTERADOS" es hallazgo relevante.
4. Ishihara: comenta ishihara_resultado. No asumas daltonismo si el resultado es NORMAL o NO APLICA.
5. Agudeza visual heredada puede estar PENDIENTE: no la inventes.
6. Si faltan confrontacion_od y confrontacion_oi, declara AI_NON_CONCLUSIVE.
7. Responde SOLO en JSON, sin markdown.

Parámetros capturados:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones sobre campos visuales e Ishihara",
  "confidence": 0.68,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Campos visuales de confrontación dentro de parámetros normales en ambos ojos"],
  "clinical_basis": [
    {"principle": "Campimetría de confrontación como tamiz de campo visual", "applied_parameters": ["confrontacion_od", "confrontacion_oi"]}
  ],
  "citations": [
    {"source_id": "AAO-VF-2022", "title": "Primary Open-Angle Glaucoma Preferred Practice Pattern", "section": "Visual field testing", "excerpt": "Confrontation fields are a screening adjunct", "version_or_date": "2022"}
  ],
  "limitations": ["La confrontación no sustituye perimetría automatizada; se requiere correlación oftalmológica"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}$camp_dx$;

  v_exmed_dx TEXT := $exmed_dx$Eres un sistema de apoyo a la decisión clínica para medicina del trabajo.
Recibirás hallazgos de una exploración física general capturados directamente por el médico
(hallazgos por sistema: neurológico, corazón, pulmones, abdomen, columna, extremidades, etc.).
Tu tarea es generar un análisis de apoyo, NO un diagnóstico médico definitivo.

REGLAS ESTRICTAS:
1. Usa lenguaje prudente: "hallazgos compatibles con", "sugiere evaluación de", "requiere correlación clínica".
2. NO emitas diagnóstico de enfermedad, aptitud laboral ni recomendaciones de tratamiento.
3. Solo comenta los sistemas con hallazgos documentados. Ignora campos vacíos o null.
4. Red flags: solo para hallazgos que impliquen riesgo inmediato (ej. soplo cardíaco no documentado, signos meníngeos, abdomen en tabla).
5. Si todos los campos están vacíos o null, declara AI_NON_CONCLUSIVE.
6. Responde SOLO en JSON, sin markdown.

Parámetros capturados:
{extracted_json}

Responde en JSON con esta estructura exacta:
{
  "summary": "Texto prudente de máx. 2 oraciones sobre los hallazgos principales",
  "confidence": 0.60,
  "clinical_state": "AI_PENDING_REVIEW",
  "justification": ["Exploración física sin hallazgos patológicos relevantes documentados"],
  "clinical_basis": [
    {"principle": "Exploración física sistemática por aparatos y sistemas", "applied_parameters": ["corazon", "campos_pulmonares", "ms_superiores", "ms_inferiores"]}
  ],
  "citations": [
    {"source_id": "IMSS-575-12", "title": "Guía de práctica clínica: examen médico ocupacional", "section": "Exploración por sistemas", "excerpt": "La exploración por sistemas es parte integral del examen médico", "version_or_date": "2012"}
  ],
  "limitations": ["La exploración física aislada no reemplaza estudios de gabinete complementarios"],
  "red_flags": [],
  "recommendation": null,
  "non_conclusive_reason": null
}$exmed_dx$;
BEGIN
  -- ── 1. ESPIROMETRÍA: respaldo completo solo cuando aiCalibration es NULL ──
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    CASE WHEN jsonb_typeof("options") = 'object' THEN "options" ELSE '{}'::jsonb END,
    '{aiCalibration}',
    jsonb_build_object(
      'enabled', true,
      'canonicalStudyType', 'Espirometria',
      'extraction', jsonb_build_object(
        'enabled', true,
        'provider', 'm3',
        'version', 'espirometria-sibelmed-v8',
        'prompt', v_espiro_ext
      ),
      'diagnosis', jsonb_build_object(
        'enabled', true,
        'version', 'espirometria-prediagnosis-v3',
        'prompt', v_espiro_dx
      )
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%espirometr%'
      OR UPPER("code") LIKE 'ESPIRO%'
    )
    AND COALESCE(
      CASE WHEN jsonb_typeof("options") = 'object' THEN "options"->>'operationMode' ELSE NULL END,
      ''
    ) <> 'manual_service'
    AND (
      jsonb_typeof("options") <> 'object'
      OR "options"->'aiCalibration' IS NULL
      OR jsonb_typeof("options"->'aiCalibration') = 'null'
    );

  -- Sub-capa faltante en Espirometría (V1/V2 parcial sin pisar lo ya editado)
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,extraction}',
    COALESCE("options"->'aiCalibration'->'extraction', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'provider', COALESCE("options"->'aiCalibration'->'extraction'->>'provider', 'm3'),
      'version', 'espirometria-sibelmed-v8',
      'prompt', v_espiro_ext
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%espirometr%'
      OR UPPER("code") LIKE 'ESPIRO%'
    )
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'extraction'->>'prompt', '')), '') IS NULL;

  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,diagnosis}',
    COALESCE("options"->'aiCalibration'->'diagnosis', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'version', 'espirometria-prediagnosis-v3',
      'prompt', v_espiro_dx
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%espirometr%'
      OR UPPER("code") LIKE 'ESPIRO%'
    )
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'diagnosis'->>'prompt', '')), '') IS NULL;

  -- ── 2. AUDIOMETRÍA: respaldo completo solo cuando aiCalibration es NULL ───
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    CASE WHEN jsonb_typeof("options") = 'object' THEN "options" ELSE '{}'::jsonb END,
    '{aiCalibration}',
    jsonb_build_object(
      'enabled', true,
      'canonicalStudyType', 'Audiometria',
      'extraction', jsonb_build_object(
        'enabled', true,
        'provider', 'm3',
        'version', 'extract-audio-graficas-v2',
        'prompt', v_audio_ext
      ),
      'diagnosis', jsonb_build_object(
        'enabled', true,
        'version', 'predx-audiometria-v2-derivado',
        'prompt', v_audio_dx
      )
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%audiometr%'
      OR UPPER("code") LIKE 'AUDIO%'
    )
    AND COALESCE(
      CASE WHEN jsonb_typeof("options") = 'object' THEN "options"->>'operationMode' ELSE NULL END,
      ''
    ) <> 'manual_service'
    AND (
      jsonb_typeof("options") <> 'object'
      OR "options"->'aiCalibration' IS NULL
      OR jsonb_typeof("options"->'aiCalibration') = 'null'
    );

  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,extraction}',
    COALESCE("options"->'aiCalibration'->'extraction', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'provider', COALESCE("options"->'aiCalibration'->'extraction'->>'provider', 'm3'),
      'version', 'extract-audio-graficas-v2',
      'prompt', v_audio_ext
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%audiometr%'
      OR UPPER("code") LIKE 'AUDIO%'
    )
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'extraction'->>'prompt', '')), '') IS NULL;

  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,diagnosis}',
    COALESCE("options"->'aiCalibration'->'diagnosis', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'version', 'predx-audiometria-v2-derivado',
      'prompt', v_audio_dx
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%audiometr%'
      OR UPPER("code") LIKE 'AUDIO%'
    )
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'diagnosis'->>'prompt', '')), '') IS NULL;

  -- ── 3. ELECTROCARDIOGRAMA (ECG): respaldo cuando aiCalibration es NULL ────
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    CASE WHEN jsonb_typeof("options") = 'object' THEN "options" ELSE '{}'::jsonb END,
    '{aiCalibration}',
    jsonb_build_object(
      'enabled', true,
      'canonicalStudyType', 'Electrocardiograma',
      'extraction', jsonb_build_object(
        'enabled', true,
        'provider', 'm3',
        'version', 'ecg-ami-bootstrap-v1',
        'prompt', v_ecg_ext
      ),
      'diagnosis', jsonb_build_object(
        'enabled', true,
        'version', 'predx-ecg-v1',
        'prompt', v_ecg_dx
      )
    ),
    true
  )
  WHERE (
      UPPER("code") = 'CARD-ECG'
      OR LOWER("name") LIKE '%electrocardio%'
      OR LOWER(BTRIM("name")) IN ('ecg', 'ekg')
    )
    AND COALESCE(
      CASE WHEN jsonb_typeof("options") = 'object' THEN "options"->>'operationMode' ELSE NULL END,
      ''
    ) <> 'manual_service'
    AND (
      jsonb_typeof("options") <> 'object'
      OR "options"->'aiCalibration' IS NULL
      OR jsonb_typeof("options"->'aiCalibration') = 'null'
    );

  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,extraction}',
    COALESCE("options"->'aiCalibration'->'extraction', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'provider', COALESCE("options"->'aiCalibration'->'extraction'->>'provider', 'm3'),
      'version', 'ecg-ami-bootstrap-v1',
      'prompt', v_ecg_ext
    ),
    true
  )
  WHERE (
      UPPER("code") = 'CARD-ECG'
      OR LOWER("name") LIKE '%electrocardio%'
      OR LOWER(BTRIM("name")) IN ('ecg', 'ekg')
    )
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'extraction'->>'prompt', '')), '') IS NULL;

  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,diagnosis}',
    COALESCE("options"->'aiCalibration'->'diagnosis', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'version', 'predx-ecg-v1',
      'prompt', v_ecg_dx
    ),
    true
  )
  WHERE (
      UPPER("code") = 'CARD-ECG'
      OR LOWER("name") LIKE '%electrocardio%'
      OR LOWER(BTRIM("name")) IN ('ecg', 'ekg')
    )
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'diagnosis'->>'prompt', '')), '') IS NULL;

  -- ── 4. FORMULARIOS INTERNOS Y LABORATORIO (solo diagnóstico vigente) ─────
  -- Somatometría
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    CASE WHEN jsonb_typeof("options") = 'object' THEN "options" ELSE '{}'::jsonb END,
    '{aiCalibration}',
    jsonb_build_object(
      'enabled', true,
      'canonicalStudyType', 'Somatometria',
      'diagnosis', jsonb_build_object(
        'enabled', true,
        'version', 'predx-somatometria-v1',
        'prompt', v_soma_dx
      )
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%somatometr%'
      OR LOWER("name") LIKE '%signos vitales%'
      OR LOWER("name") LIKE '%antropometr%'
    )
    AND COALESCE(
      CASE WHEN jsonb_typeof("options") = 'object' THEN "options"->>'operationMode' ELSE NULL END,
      ''
    ) <> 'manual_service'
    AND (
      jsonb_typeof("options") <> 'object'
      OR "options"->'aiCalibration' IS NULL
      OR jsonb_typeof("options"->'aiCalibration') = 'null'
    );

  -- Agudeza Visual
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    CASE WHEN jsonb_typeof("options") = 'object' THEN "options" ELSE '{}'::jsonb END,
    '{aiCalibration}',
    jsonb_build_object(
      'enabled', true,
      'canonicalStudyType', 'AgudezaVisual',
      'diagnosis', jsonb_build_object(
        'enabled', true,
        'version', 'predx-agudeza-visual-v1',
        'prompt', v_av_dx
      )
    ),
    true
  )
  WHERE LOWER("name") LIKE '%agudeza visual%'
    AND COALESCE(
      CASE WHEN jsonb_typeof("options") = 'object' THEN "options"->>'operationMode' ELSE NULL END,
      ''
    ) <> 'manual_service'
    AND (
      jsonb_typeof("options") <> 'object'
      OR "options"->'aiCalibration' IS NULL
      OR jsonb_typeof("options"->'aiCalibration') = 'null'
    );

  -- Campimetría
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    CASE WHEN jsonb_typeof("options") = 'object' THEN "options" ELSE '{}'::jsonb END,
    '{aiCalibration}',
    jsonb_build_object(
      'enabled', true,
      'canonicalStudyType', 'Campimetria',
      'diagnosis', jsonb_build_object(
        'enabled', true,
        'version', 'predx-campimetria-v1',
        'prompt', v_camp_dx
      )
    ),
    true
  )
  WHERE LOWER("name") LIKE '%campimetr%'
    AND COALESCE(
      CASE WHEN jsonb_typeof("options") = 'object' THEN "options"->>'operationMode' ELSE NULL END,
      ''
    ) <> 'manual_service'
    AND (
      jsonb_typeof("options") <> 'object'
      OR "options"->'aiCalibration' IS NULL
      OR jsonb_typeof("options"->'aiCalibration') = 'null'
    );

  -- Examen Médico
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    CASE WHEN jsonb_typeof("options") = 'object' THEN "options" ELSE '{}'::jsonb END,
    '{aiCalibration}',
    jsonb_build_object(
      'enabled', true,
      'canonicalStudyType', 'ExamenMedico',
      'diagnosis', jsonb_build_object(
        'enabled', true,
        'version', 'predx-examen-medico-v1',
        'prompt', v_exmed_dx
      )
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%examen medico%'
      OR LOWER("name") LIKE '%examen médico%'
    )
    AND COALESCE(
      CASE WHEN jsonb_typeof("options") = 'object' THEN "options"->>'operationMode' ELSE NULL END,
      ''
    ) <> 'manual_service'
    AND (
      jsonb_typeof("options") <> 'object'
      OR "options"->'aiCalibration' IS NULL
      OR jsonb_typeof("options"->'aiCalibration') = 'null'
    );

  -- Laboratorio (solo prompt clínico de apoyo; nunca toca pruebas de Imagen/RX)
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    CASE WHEN jsonb_typeof("options") = 'object' THEN "options" ELSE '{}'::jsonb END,
    '{aiCalibration}',
    jsonb_build_object(
      'enabled', true,
      'canonicalStudyType', 'Laboratorio',
      'diagnosis', jsonb_build_object(
        'enabled', true,
        'version', 'predx-laboratorio-v1',
        'prompt', v_lab_dx
      )
    ),
    true
  )
  WHERE EXISTS (
      SELECT 1
      FROM "test_categories" c
      WHERE c."id" = "medical_tests"."categoryId"
        AND LOWER(c."name") LIKE '%laboratorio%'
    )
    AND COALESCE(
      CASE WHEN jsonb_typeof("options") = 'object' THEN "options"->>'operationMode' ELSE NULL END,
      ''
    ) <> 'manual_service'
    AND (
      jsonb_typeof("options") <> 'object'
      OR "options"->'aiCalibration' IS NULL
      OR jsonb_typeof("options"->'aiCalibration') = 'null'
    );

  -- Sub-capa diagnosis faltante para Somatometría, Agudeza Visual, Campimetría, Examen Médico y Laboratorio (V1/V2 sin pisar prompts editados)
  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,diagnosis}',
    COALESCE("options"->'aiCalibration'->'diagnosis', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'version', 'predx-somatometria-v1',
      'prompt', v_soma_dx
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%somatometr%'
      OR LOWER("name") LIKE '%signos vitales%'
      OR LOWER("name") LIKE '%antropometr%'
    )
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'diagnosis'->>'prompt', '')), '') IS NULL;

  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,diagnosis}',
    COALESCE("options"->'aiCalibration'->'diagnosis', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'version', 'predx-agudeza-visual-v1',
      'prompt', v_av_dx
    ),
    true
  )
  WHERE LOWER("name") LIKE '%agudeza visual%'
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'diagnosis'->>'prompt', '')), '') IS NULL;

  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,diagnosis}',
    COALESCE("options"->'aiCalibration'->'diagnosis', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'version', 'predx-campimetria-v1',
      'prompt', v_camp_dx
    ),
    true
  )
  WHERE LOWER("name") LIKE '%campimetr%'
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'diagnosis'->>'prompt', '')), '') IS NULL;

  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,diagnosis}',
    COALESCE("options"->'aiCalibration'->'diagnosis', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'version', 'predx-examen-medico-v1',
      'prompt', v_exmed_dx
    ),
    true
  )
  WHERE (
      LOWER("name") LIKE '%examen medico%'
      OR LOWER("name") LIKE '%examen médico%'
    )
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'diagnosis'->>'prompt', '')), '') IS NULL;

  UPDATE "medical_tests"
  SET "options" = jsonb_set(
    "options",
    '{aiCalibration,diagnosis}',
    COALESCE("options"->'aiCalibration'->'diagnosis', '{}'::jsonb) || jsonb_build_object(
      'enabled', true,
      'version', 'predx-laboratorio-v1',
      'prompt', v_lab_dx
    ),
    true
  )
  WHERE EXISTS (
      SELECT 1
      FROM "test_categories" c
      WHERE c."id" = "medical_tests"."categoryId"
        AND LOWER(c."name") LIKE '%laboratorio%'
    )
    AND jsonb_typeof("options") = 'object'
    AND jsonb_typeof("options"->'aiCalibration') = 'object'
    AND COALESCE("options"->'aiCalibration'->>'schemaVersion', '') <> 'V3'
    AND COALESCE("options"->>'operationMode', '') <> 'manual_service'
    AND NULLIF(BTRIM(COALESCE("options"->'aiCalibration'->'diagnosis'->>'prompt', '')), '') IS NULL;
END $$;
