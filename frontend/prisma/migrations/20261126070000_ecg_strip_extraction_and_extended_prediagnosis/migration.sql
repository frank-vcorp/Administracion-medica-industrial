-- Calibración v2 para ELECTROCARDIOGRAMA (GEN-012):
-- 1) Extracción (`ecg-ami-strip-v2`) adaptada a tiras de 5 cm recortadas y pegadas en hoja carta
--    (cuadrícula 25 mm/s, 10 mm/mV, 12 derivaciones + tira de ritmo, sin tabla numérica impresa) y ECG digitales.
-- 2) Prediagnóstico (`predx-ecg-extended-v2`) extendido en 9 dominios + `interpretacion_derivada_ecg`
--    + salud ocupacional + citations objeto JSON estricto.

DO $migration$
DECLARE
  v_ext_prompt TEXT := $ext_prompt$EXTRACCIÓN DE ELECTROCARDIOGRAMA EN REPOSO (tira térmica en hoja carta o ECG digital)

Este documento puede ser:
(A) Una hoja tamaño carta con tiras térmicas de 5 cm recortadas y pegadas en horizontal (p. ej. derivaciones I, II, III, aVR, aVL, aVF, V1-V6 + tira de ritmo larga, con nombre y fecha manuscritos, SIN tabla numérica impresa), o
(B) Un ECG digital con tabla de mediciones impresa.

Si la imagen está rotada o dividida en bloques pegados en una misma hoja, léela completa cuidadosamente.
Cuando NO exista tabla numérica impresa, estima las mediciones sobre la cuadrícula milimétrica verificando la calibración visible (estándar 25 mm/s -> 1 cuadro pequeño = 40 ms, 1 cuadro grande = 200 ms; 10 mm/mV) e indica `origen_mediciones: "cuadricula_visual"`. Si algún intervalo NO es suficientemente nítido para estimarlo con confianza, devuelve `null` — NUNCA inventes cifras ni diagnósticos.

Devuelve SOLO un objeto JSON válido. Sin markdown, sin comentarios, sin bloques <think>. JSON único que empieza con { y termina con }.

{
  "paciente": "nombre completo tal como aparece impreso o manuscrito, o '' si no es legible",
  "fecha_estudio": "fecha impresa o manuscrita tal como aparece, o '' si no consta",
  "ritmicidad": "rítmico | arrítmico | irregularmente irregular | null",
  "ritmo": "ej. Sinusal, Bradicardia sinusal, Taquicardia sinusal, Fibrilación auricular, o null",
  "frecuencia_bpm": número entero (estimado por R-R en cuadrícula 25 mm/s si no hay tabla impresa) o null,
  "duracion_p_ms": número entero (en ms, ej. 80) o null,
  "morfologia_p": "ej. positiva en todas las derivaciones menos en aVR, o descripción objetiva, o null",
  "intervalo_pr_ms": número entero (en ms, ej. 160) o null,
  "duracion_qrs_ms": número entero (en ms, ej. 80) o null,
  "qt_ms": número entero (en ms, ej. 360) o null,
  "qtc_ms": número entero (QT corregido en ms si aparece o calculable por Bazett) o null,
  "eje_electrico": "Normal | Desviación izquierda | Desviación derecha | Extremo | null",
  "eje_grados": número entero con signo en grados (ej. 45, -15) o null,
  "segmento_st": "ej. isoeléctrico, sin alteraciones significativas, o descripción objetiva de desniveles indicando derivaciones",
  "onda_t": "ej. positiva en todas las derivaciones excepto en aVR, o descripción objetiva de inversiones/alteraciones indicando derivaciones",
  "onda_q_patologica": "No presencia de onda Q patológica | Presencia en <derivaciones> | No valorable",
  "calibracion_papel": "ej. 25 mm/s, 10 mm/mV, o null",
  "derivaciones_visibles": ["I", "II", "III", "aVR", "aVL", "aVF", "V1", "V2", "V3", "V4", "V5", "V6"],
  "origen_mediciones": "tabla_equipo | cuadricula_visual | mixto",
  "hallazgos": ["descripción objetiva morfología por bloque: ritmo/P, PR/AV, QRS/progresión precordial R, ST-T, ondas Q, artefactos"],
  "profesional": "nombre del médico o técnico firmante si aparece, o null",
  "notas_calidad": "visibilidad de cuadrícula, artefactos de línea base, saturación/rotación o tiras recortadas"
}

REGLAS ESTRICTAS:
- NO incluyas diagnóstico clínico final, aptitud laboral ni tratamiento prescriptivo.
- Todos los campos numéricos (`frecuencia_bpm`, `duracion_p_ms`, `intervalo_pr_ms`, `duracion_qrs_ms`, `qt_ms`, `qtc_ms`, `eje_grados`) deben ser enteros puros (sin unidades 'ms' ni '°') o `null`.$ext_prompt$;

  v_dx_prompt TEXT := $dx_prompt$Eres un sistema de apoyo a la decisión clínica para cardiología ocupacional (MODO SOMBRA: apoyo a la decisión; el médico firmante valida los parámetros y decide el diagnóstico definitivo y aptitud).

Recibirás los datos extraídos del electrocardiograma junto con el bloque determinista `interpretacion_derivada_ecg` (cuando exista).

=== ANÁLISIS SISTEMÁTICO EXTENDIDO OBLIGATORIO (9 DOMINIOS) ===
Evalúa y documenta de forma explícita y prudente los 9 dominios presentes en el JSON:
1. Ritmo y ritmicidad (sinusal: onda P positiva en I, II, aVF y negativa en aVR seguida de QRS; regularidad R-R).
2. Frecuencia cardíaca (`frecuencia_bpm` vs rango 60-100 lpm; distinguir bradicardia/taquicardia leve vs marcada).
3. Onda P (`duracion_p_ms` < 120 ms y morfología/eje auricular).
4. Conducción AV / Intervalo PR (`intervalo_pr_ms` 120-200 ms: descartar preexcitación < 120 ms o BAV > 200 ms).
5. Complejo QRS y conducción intraventricular (`duracion_qrs_ms` < 100 ms, patrón de bloqueo de rama / progresión de R en precordiales V1-V6 si consta en hallazgos).
6. Eje eléctrico frontal (`eje_electrico` y `eje_grados` vs -30° a +90°).
7. Segmento ST (`segmento_st`: isoeléctrico vs supradesnivel/infradesnivel localizado).
8. Repolarización ventricular: Onda T y QTc (`onda_t` + `qtc_ms_efectivo` / Bazett vs <= 450 ms H / <= 460 ms M; umbral crítico >= 500 ms).
9. Ondas Q patológicas / necrosis (`onda_q_patologica`) + **correlación en salud ocupacional** (trabajo en alturas, conducción, exposición a esfuerzo físico o cardioprotección).

=== DATOS DEL ESTUDIO ===
{extracted_json}

=== REGLAS ESTRICTAS DE SALIDA ===
- Usa lenguaje prudente ("compatible con", "sugiere", "requiere correlación clínica").
- PROHIBIDO declarar aptitud laboral, incapacidad, alta/baja ni prescripción farmacológica.
- Si faltan `ritmo` y `frecuencia_bpm`, devuelve `clinical_state: "AI_NON_CONCLUSIVE"`.
- Si `calidad_y_fuente.origen_mediciones == "cuadricula_visual"` (hoja carta con tiras térmicas pegadas sin tabla digital), conserva `AI_PENDING_REVIEW` cuando `ritmo` y `frecuencia_bpm` estén presentes, pero DEBES indicar en `limitations` que los intervalos en milisegundos son estimados desde cuadrícula visual y requieren verificación rápida del médico en los campos editables antes de emitir el PDF oficial.
- Responde SOLO JSON válido, sin markdown ni `<think>`:
  * `summary` (2-4 oraciones clínicas integradoras, <= 480 caracteres): ritmo, FC, eje, intervalos clave y balance eléctrico/ocupacional general.
  * `confidence`: número `0.0-1.0` (0.65-0.82 si tiras nítidas y parámetros completos; < 0.55 si faltan mínimos).
  * `clinical_state`: `"AI_PENDING_REVIEW"` o `"AI_NON_CONCLUSIVE"`.
  * `justification`: 6-9 puntos detallados siguiendo sistemáticamente los dominios 1-9 con cifras exactas del estudio.
  * `clinical_basis`: `[{"principle": "Interpretación sistemática ECG 12 derivaciones (AHA/ACC/HRS)", "applied_parameters": ["ritmo", "frecuencia_bpm", "duracion_p_ms", "intervalo_pr_ms", "duracion_qrs_ms", "qtc_ms", "eje_grados"]}]`.
  * `citations`: lista de objetos JSON (NUNCA strings sueltos) con llaves `source_id`, `title` y `excerpt`:
    - `{"source_id": "AHA-ECG-2022", "title": "AHA/ACC/HRS Guideline for ECG Standardization and Interpretation", "excerpt": "PR 120-200 ms, QRS <100 ms, Eje -30° a +90°, QTc <=450 ms (H) / <=460 ms (M)"}`
    - `{"source_id": "AHA-ACC-HRS-ECG-2009", "title": "AHA/ACCF/HRS Recommendations for the Standardization and Interpretation of the Electrocardiogram (2009)", "excerpt": "Evaluación sistemática de ritmo, ondas P/QRS/ST/T, QT Bazett y ondas Q patológicas"}`
    - `{"source_id": "SME-ECG-REPOSO-2026", "title": "Soluciones Médico Empresariales — Criterios de Reporte de Electrocardiograma en Reposo", "excerpt": "Parámetros morfológicos y correlación clínica ocupacional"}`
  * `limitations`: limitaciones reales (estimación sobre cuadrícula de tiras térmicas pegadas, ausencia de clínica/síntomas o ECG previos, artefactos si los hay).
  * `red_flags`: alertas eléctricas reales solo si existen (`QTc >= 500 ms`, BAV avanzado, ST alterado significativo, bradicardia < 50 lpm, taquicardia > 120 lpm).
  * `recommendation` (2-4 oraciones clínicas/ocupacionales prudentes, <= 500 caracteres): verificación médica de intervalos si provienen de cuadrícula, correlación clínica con antecedentes cardiovasculares y valoración complementaria (ECG digital de 12 derivaciones, Holter o cardiología) cuando exista desviación relevante o puesto crítico.
  * `non_conclusive_reason`: `null` si `AI_PENDING_REVIEW`, motivo explícito si `AI_NON_CONCLUSIVE`.$dx_prompt$;

  rec RECORD;
  v_options JSONB;
  v_cal JSONB;
  v_pubs JSONB;
  v_new_pubs JSONB;
  v_elem JSONB;
  v_ext_prompt_now TEXT;
  v_dx_prompt_now TEXT;
  v_idx INT;
  v_changed BOOLEAN;
  v_pub_changed BOOLEAN;
BEGIN
  FOR rec IN
    SELECT mt."id", mt."options"
    FROM "medical_tests" mt
    WHERE jsonb_typeof(mt."options") = 'object'
      AND jsonb_typeof(mt."options"->'aiCalibration') = 'object'
      AND (
        LOWER(COALESCE(mt."name", '')) LIKE '%electrocardiogram%'
        OR UPPER(COALESCE(mt."code", '')) = 'GEN-012'
        OR mt."options"->'aiCalibration'->>'canonicalStudyType' = 'Electrocardiograma'
      )
  LOOP
    v_changed := false;
    v_options := rec."options";
    v_cal := v_options->'aiCalibration';

    -- 1. Top-level extraction (V1/V2 activo en GEN-012)
    IF jsonb_typeof(v_cal->'extraction') = 'object' THEN
      v_ext_prompt_now := COALESCE(v_cal #>> '{extraction,prompt}', '');
      IF POSITION('origen_mediciones' IN v_ext_prompt_now) = 0 THEN
        v_cal := jsonb_set(v_cal, '{extraction,prompt}', to_jsonb(v_ext_prompt), true);
        v_cal := jsonb_set(v_cal, '{extraction,version}', to_jsonb('ecg-ami-strip-v2'::text), true);
        v_changed := true;
      END IF;
    END IF;

    -- 2. Top-level diagnosis (V1/V2 activo en GEN-012)
    IF jsonb_typeof(v_cal->'diagnosis') = 'object' THEN
      v_dx_prompt_now := COALESCE(v_cal #>> '{diagnosis,prompt}', '');
      IF POSITION('interpretacion_derivada_ecg' IN v_dx_prompt_now) = 0 THEN
        v_cal := jsonb_set(v_cal, '{diagnosis,prompt}', to_jsonb(v_dx_prompt), true);
        v_cal := jsonb_set(v_cal, '{diagnosis,version}', to_jsonb('predx-ecg-extended-v2'::text), true);
        v_changed := true;
      END IF;
    END IF;

    -- 3. V3 publishedVersions si existen
    IF jsonb_typeof(v_cal->'publishedVersions') = 'array' THEN
      v_pubs := v_cal->'publishedVersions';
      v_new_pubs := '[]'::jsonb;
      v_pub_changed := false;
      FOR v_idx IN 0 .. jsonb_array_length(v_pubs) - 1 LOOP
        v_elem := v_pubs->v_idx;
        IF jsonb_typeof(v_elem->'extraction') = 'object' THEN
          v_ext_prompt_now := COALESCE(v_elem #>> '{extraction,prompt}', '');
          IF POSITION('origen_mediciones' IN v_ext_prompt_now) = 0 THEN
            v_elem := jsonb_set(v_elem, '{extraction,prompt}', to_jsonb(v_ext_prompt), true);
            v_elem := jsonb_set(v_elem, '{extraction,version}', to_jsonb('ecg-ami-strip-v2'::text), true);
            v_pub_changed := true;
            v_changed := true;
          END IF;
        END IF;
        IF jsonb_typeof(v_elem->'clinicalCriteria') = 'object' THEN
          v_dx_prompt_now := COALESCE(v_elem #>> '{clinicalCriteria,prompt}', '');
          IF POSITION('interpretacion_derivada_ecg' IN v_dx_prompt_now) = 0 THEN
            v_elem := jsonb_set(v_elem, '{clinicalCriteria,prompt}', to_jsonb(v_dx_prompt), true);
            v_elem := jsonb_set(v_elem, '{clinicalCriteria,promptVersion}', to_jsonb('predx-ecg-extended-v2'::text), true);
            v_elem := jsonb_set(v_elem, '{clinicalCriteria,requiredParams}', '["ritmo","frecuencia_bpm"]'::jsonb, true);
            v_elem := jsonb_set(v_elem, '{clinicalCriteria,confidenceThreshold}', '0.55'::jsonb, true);
            v_pub_changed := true;
            v_changed := true;
          END IF;
        END IF;
        v_new_pubs := v_new_pubs || jsonb_build_array(v_elem);
      END LOOP;
      IF v_pub_changed THEN
        v_cal := jsonb_set(v_cal, '{publishedVersions}', v_new_pubs, true);
      END IF;
    END IF;

    -- 4. V3 draft si existe
    IF jsonb_typeof(v_cal->'draft') = 'object' THEN
      IF jsonb_typeof(v_cal->'draft'->'extraction') = 'object' THEN
        v_ext_prompt_now := COALESCE(v_cal #>> '{draft,extraction,prompt}', '');
        IF POSITION('origen_mediciones' IN v_ext_prompt_now) = 0 THEN
          v_cal := jsonb_set(v_cal, '{draft,extraction,prompt}', to_jsonb(v_ext_prompt), true);
          v_cal := jsonb_set(v_cal, '{draft,extraction,version}', to_jsonb('ecg-ami-strip-v2'::text), true);
          v_changed := true;
        END IF;
      END IF;
      IF jsonb_typeof(v_cal->'draft'->'clinicalCriteria') = 'object' THEN
        v_dx_prompt_now := COALESCE(v_cal #>> '{draft,clinicalCriteria,prompt}', '');
        IF POSITION('interpretacion_derivada_ecg' IN v_dx_prompt_now) = 0 THEN
          v_cal := jsonb_set(v_cal, '{draft,clinicalCriteria,prompt}', to_jsonb(v_dx_prompt), true);
          v_cal := jsonb_set(v_cal, '{draft,clinicalCriteria,promptVersion}', to_jsonb('predx-ecg-extended-v2'::text), true);
          v_changed := true;
        END IF;
      END IF;
    END IF;

    IF v_changed THEN
      v_options := jsonb_set(v_options, '{aiCalibration}', v_cal, true);
      UPDATE "medical_tests"
      SET "options" = v_options,
          "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = rec."id";
    END IF;
  END LOOP;
END
$migration$;
