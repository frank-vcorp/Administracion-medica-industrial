-- Refinamiento idempotente del prompt de prediagnóstico de Examen Médico
-- para exigir 100% español y prohibir estrictamente anglicismos/Spanglish como 'essentiallyWithin'.

DO $migration$
DECLARE
  v_old_rule TEXT := '6. Responde SOLO en JSON, sin markdown.';
  v_new_rule TEXT := '6. Responde SOLO en JSON, sin markdown.
7. IDIOMA OBLIGATORIO: Redacta absolutamente toda tu respuesta (summary, justification, limitations, etc.) 100% en ESPAÑOL médico estándar de México. Queda estrictamente prohibido usar términos en inglés, anglicismos o palabras combinadas como "essentiallyWithin"; usa siempre expresiones en español como "dentro de parámetros normales" o "sin alteraciones relevantes".';

  rec RECORD;
  v_options JSONB;
  v_cal JSONB;
  v_pubs JSONB;
  v_new_pubs JSONB;
  v_elem JSONB;
  v_prompt TEXT;
  v_idx INT;
  v_changed BOOLEAN;
BEGIN
  FOR rec IN
    SELECT mt."id", mt."options"
    FROM "medical_tests" mt
    WHERE jsonb_typeof(mt."options") = 'object'
      AND jsonb_typeof(mt."options"->'aiCalibration') = 'object'
      AND (
        LOWER(COALESCE(mt."name", '')) LIKE '%examen medico%'
        OR LOWER(COALESCE(mt."name", '')) LIKE '%examen médico%'
        OR mt."options"->'aiCalibration'->>'canonicalStudyType' = 'ExamenMedico'
      )
  LOOP
    v_changed := false;
    v_options := rec."options";
    v_cal := v_options->'aiCalibration';

    -- 1. Si está en diagnosis.prompt (formato V1/V2)
    IF jsonb_typeof(v_cal->'diagnosis') = 'object' THEN
      v_prompt := COALESCE(v_cal #>> '{diagnosis,prompt}', '');
      IF POSITION(v_old_rule IN v_prompt) > 0 AND POSITION('essentiallyWithin' IN v_prompt) = 0 THEN
        v_cal := jsonb_set(
          v_cal,
          '{diagnosis,prompt}',
          to_jsonb(REPLACE(v_prompt, v_old_rule, v_new_rule)),
          true
        );
        v_changed := true;
      END IF;
    END IF;

    -- 2. Si está en clinicalCriteria.prompt (formato V3)
    IF jsonb_typeof(v_cal->'clinicalCriteria') = 'object' THEN
      v_prompt := COALESCE(v_cal #>> '{clinicalCriteria,prompt}', '');
      IF POSITION(v_old_rule IN v_prompt) > 0 AND POSITION('essentiallyWithin' IN v_prompt) = 0 THEN
        v_cal := jsonb_set(
          v_cal,
          '{clinicalCriteria,prompt}',
          to_jsonb(REPLACE(v_prompt, v_old_rule, v_new_rule)),
          true
        );
        v_changed := true;
      END IF;
    END IF;

    -- 3. Si está en publishedVersions (V3)
    IF jsonb_typeof(v_cal->'publishedVersions') = 'array' THEN
      v_pubs := v_cal->'publishedVersions';
      v_new_pubs := '[]'::jsonb;
      FOR v_idx IN 0 .. jsonb_array_length(v_pubs) - 1 LOOP
        v_elem := v_pubs->v_idx;
        v_prompt := COALESCE(v_elem #>> '{clinicalCriteria,prompt}', '');
        IF POSITION(v_old_rule IN v_prompt) > 0 AND POSITION('essentiallyWithin' IN v_prompt) = 0 THEN
          v_elem := jsonb_set(
            v_elem,
            '{clinicalCriteria,prompt}',
            to_jsonb(REPLACE(v_prompt, v_old_rule, v_new_rule)),
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

    -- 4. Si está en draft.clinicalCriteria
    IF jsonb_typeof(v_cal->'draft'->'clinicalCriteria') = 'object' THEN
      v_prompt := COALESCE(v_cal #>> '{draft,clinicalCriteria,prompt}', '');
      IF POSITION(v_old_rule IN v_prompt) > 0 AND POSITION('essentiallyWithin' IN v_prompt) = 0 THEN
        v_cal := jsonb_set(
          v_cal,
          '{draft,clinicalCriteria,prompt}',
          to_jsonb(REPLACE(v_prompt, v_old_rule, v_new_rule)),
          true
        );
        v_changed := true;
      END IF;
    END IF;

    IF v_changed THEN
      v_options := jsonb_set(v_options, '{aiCalibration}', v_cal, true);
      UPDATE "medical_tests"
      SET "options" = v_options
      WHERE "id" = rec."id";
    END IF;
  END LOOP;
END $migration$;
