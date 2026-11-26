-- Refinamiento idempotente del prompt activo de extracción de Audiometría (V3)
-- para evitar corrimientos horizontales sobre líneas punteadas de media octava
-- sin etiqueta (3000 Hz y 6000 Hz) y variación de orden izquierda/derecha.

DO $migration$
DECLARE
  v_old_block TEXT := $old_block$1. Identifica los ejes de la gráfica:
   - Eje Y (vertical): dB HL (decibeles de nivel de audición), rango típico -10 a 120
   - Eje X (horizontal): Frecuencia en Hz (125, 250, 500, 1K, 2K, 4K, 8K)

2. Identifica los símbolos de cada oído:
   - O (círculo, típicamente rojo) = Oído Derecho (OD)
   - X (equis, típicamente azul) = Oído Izquierdo (OI)
   - Si hay vía ósea: < (corchete izquierdo) = OD, > (corchete derecho) = OI

3. Extrae los valores de umbral para cada frecuencia visible en la gráfica:
   - Lee el valor de dB HL donde cada símbolo intersecta cada frecuencia
   - Si un símbolo no está presente en una frecuencia, usa null
   - NO inventes valores para frecuencias donde no hay símbolo visible

4. Si hay tabla resumen con PTA (Promedio de Tonos Puros):
   - Captura el PTA reportado para cada oído
   - El PTA típicamente promedia 500, 1000, 2000 Hz$old_block$;

  v_new_block TEXT := $new_block$1. Identifica los ejes de la gráfica:
   - Eje Y (vertical): dB HL (decibeles de nivel de audición), rango típico -10 a 120
   - Eje X (horizontal, escala logarítmica):
     * Líneas verticales SÓLIDAS etiquetadas: 125, 250, 500, 1K (1000), 2K (2000), 4K (4000) y 8K (8000) Hz.
     * Líneas verticales PUNTEADAS sin etiqueta numérica (medias octavas, más cercanas a la octava superior): 750 Hz (entre 500 y 1K), 1500 Hz (entre 1K y 2K), **3000 Hz (entre 2K y 4K)** y **6000 Hz (entre 4K y 8K)**.
     * NUNCA recorras un símbolo sobre la línea punteada de 3000 Hz hacia 4000 Hz, ni recorras un símbolo en 4000 Hz hacia 6000 Hz.

2. Identifica los símbolos y el título de cada gráfica (el orden izquierda/derecha varía según el audiómetro: "Oído izq" con X azul puede estar a la izquierda y "Oído der" con O rojo a la derecha, o viceversa):
   - O (círculo, típicamente rojo) = Oído Derecho (OD)
   - X (equis, típicamente azul) = Oído Izquierdo (OI)
   - Si hay vía ósea: < (corchete izquierdo) = OD, > (corchete derecho) = OI

3. Extrae los valores de umbral para cada frecuencia visible en la gráfica:
   - Lee el valor de dB HL donde cada símbolo intersecta cada frecuencia sólida o punteada
   - Si un símbolo no está presente en una frecuencia, usa null
   - NO inventes valores para frecuencias donde no hay símbolo visible

4. Si hay tabla resumen o etiqueta con PTA / HTL:
   - Captura el PTA reportado para cada oído si aparece impreso
   - Si aparece HTL o PTA impreso en la gráfica, verifica que tus umbrales extraídos sean consistentes con ese valor
   - El PTA típicamente promedia 500, 1000, 2000 Hz$new_block$;

  rec RECORD;
  v_options JSONB;
  v_cal JSONB;
  v_pubs JSONB;
  v_new_pubs JSONB;
  v_elem JSONB;
  v_prompt TEXT;
  v_draft_prompt TEXT;
  v_idx INT;
  v_changed BOOLEAN;
BEGIN
  FOR rec IN
    SELECT mt."id", mt."options"
    FROM "medical_tests" mt
    WHERE jsonb_typeof(mt."options") = 'object'
      AND jsonb_typeof(mt."options"->'aiCalibration') = 'object'
      AND (
        mt."options"->'aiCalibration'->>'currentPublishedVersionId' = 'backfill-extraction-audiometria-20261120'
        OR LOWER(COALESCE(mt."name", '')) LIKE '%audiometr%'
      )
  LOOP
    v_changed := false;
    v_options := rec."options";
    v_cal := v_options->'aiCalibration';

    -- 1. Actualizar versión publicada vigente en V3
    IF jsonb_typeof(v_cal->'publishedVersions') = 'array' THEN
      v_pubs := v_cal->'publishedVersions';
      v_new_pubs := '[]'::jsonb;
      FOR v_idx IN 0 .. jsonb_array_length(v_pubs) - 1 LOOP
        v_elem := v_pubs->v_idx;
        v_prompt := COALESCE(v_elem #>> '{extraction,prompt}', '');
        IF COALESCE(v_elem->>'versionId', '') = 'backfill-extraction-audiometria-20261120'
           AND POSITION(v_old_block IN v_prompt) > 0 THEN
          v_elem := jsonb_set(
            v_elem,
            '{extraction,prompt}',
            to_jsonb(REPLACE(v_prompt, v_old_block, v_new_block)),
            true
          );
          v_changed := true;
        END IF;
        v_new_pubs := v_new_pubs || jsonb_build_array(v_elem);
      END LOOP;
      IF v_changed THEN
        v_cal := jsonb_set(v_cal, '{publishedVersions}', v_new_pubs, true);
      END IF;
    END IF;

    -- 2. Actualizar draft si aún conserva exactamente el bloque anterior
    IF jsonb_typeof(v_cal->'draft') = 'object' THEN
      v_draft_prompt := COALESCE(v_cal #>> '{draft,extraction,prompt}', '');
      IF POSITION(v_old_block IN v_draft_prompt) > 0 THEN
        v_cal := jsonb_set(
          v_cal,
          '{draft,extraction,prompt}',
          to_jsonb(REPLACE(v_draft_prompt, v_old_block, v_new_block)),
          true
        );
        v_changed := true;
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
