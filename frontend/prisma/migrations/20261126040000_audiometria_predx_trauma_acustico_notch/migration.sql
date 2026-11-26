-- Refinamiento idempotente de clinicalCriteria.prompt de Audiometría (V3)
-- para reportar explícitamente escotomas por trauma acústico (francos >25 dB e
-- incipientes <=25 dB) con recuperación en 8000 Hz y distinguirlos de curvas descendentes.

DO $migration$
DECLARE
  v_old_rule4 TEXT := $old_r4$4. Si detectas pérdida, describe lateralidad, severidad y patrón sugerido con lenguaje prudente.$old_r4$;

  v_new_rule4 TEXT := $new_r4$4. Si detectas pérdida, describe lateralidad, severidad y patrón sugerido con lenguaje prudente.
   - Si `interpretacion_derivada_sme` o los umbrales muestran `ESCOTOMA_TRAUMA_ACUSTICO_FRANCO` (caída >25 dB en 3000–6000 Hz con descenso ≥15 dB desde 2000 Hz y recuperación ≥10 dB en 8000 Hz), señala explícitamente el escotoma en frecuencias agudas (indicando las frecuencias exactas y recuperación en 8000 Hz) como patrón compatible con trauma acústico / daño auditivo inducido por ruido, solicitando correlación con exposición laboral a ruido y otoscopía.
   - Si un oído muestra `ESCOTOMA_TRAUMA_ACUSTICO_INCIPIENTE` (muesca con caída ≥15 dB en 3000–6000 Hz y recuperación ≥10 dB en 8000 Hz pero aún con umbrales ≤25 dB), descríbelo como audición dentro de límites normales con muesca/escotoma incipiente en frecuencias agudas (posible signo temprano de exposición a ruido que amerita vigilancia), sin clasificarlo como hipoacusia establecida.
   - Si muestra `DESCENDENTE_AGUDAS_SIN_RECUPERACION` (caída progresiva hasta 8000 Hz >25 dB sin recuperación en 8000 Hz), descríbelo como patrón descendente en frecuencias agudas (correlacionar con edad/presbiacusia u otras causas) sin etiquetarlo como escotoma por trauma acústico.$new_r4$;

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

    -- 1. Versión publicada vigente en V3
    IF jsonb_typeof(v_cal->'publishedVersions') = 'array' THEN
      v_pubs := v_cal->'publishedVersions';
      v_new_pubs := '[]'::jsonb;
      FOR v_idx IN 0 .. jsonb_array_length(v_pubs) - 1 LOOP
        v_elem := v_pubs->v_idx;
        v_prompt := COALESCE(v_elem #>> '{clinicalCriteria,prompt}', '');
        IF COALESCE(v_elem->>'versionId', '') = 'backfill-extraction-audiometria-20261120'
           AND POSITION(v_old_rule4 IN v_prompt) > 0
           AND POSITION('ESCOTOMA_TRAUMA_ACUSTICO_FRANCO' IN v_prompt) = 0 THEN
          v_elem := jsonb_set(
            v_elem,
            '{clinicalCriteria,prompt}',
            to_jsonb(REPLACE(v_prompt, v_old_rule4, v_new_rule4)),
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

    -- 2. Draft si conserva el bloque anterior
    IF jsonb_typeof(v_cal->'draft') = 'object' THEN
      v_draft_prompt := COALESCE(v_cal #>> '{draft,clinicalCriteria,prompt}', '');
      IF POSITION(v_old_rule4 IN v_draft_prompt) > 0
         AND POSITION('ESCOTOMA_TRAUMA_ACUSTICO_FRANCO' IN v_draft_prompt) = 0 THEN
        v_cal := jsonb_set(
          v_cal,
          '{draft,clinicalCriteria,prompt}',
          to_jsonb(REPLACE(v_draft_prompt, v_old_rule4, v_new_rule4)),
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
