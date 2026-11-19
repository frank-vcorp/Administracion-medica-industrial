-- Promoción idempotente de variantes heredadas de MiniMax-M3 a MiniMax-M3.1-Flash
-- en ai_provider_keys y MedicalTest.options.aiCalibration (V1/V2 y V3).

-- 1. ai_provider_keys: normalizar defaultModel del proveedor m3
UPDATE "ai_provider_keys"
SET "defaultModel" = 'MiniMax-M3.1-Flash'
WHERE "provider" = 'm3'
  AND (
    "defaultModel" IS NULL
    OR lower(btrim("defaultModel")) IN (
      '',
      'm3',
      'minimax',
      'minimax m3',
      'minimax-m3',
      'minimax-m3-flash',
      'minimax-m3.1-flash'
    )
  )
  AND COALESCE("defaultModel", '') <> 'MiniMax-M3.1-Flash';

-- 2. medical_tests: V1/V2 options.aiCalibration.extraction.model
UPDATE "medical_tests"
SET "options" = jsonb_set(
  "options",
  '{aiCalibration,extraction,model}',
  '"MiniMax-M3.1-Flash"'::jsonb,
  false
)
WHERE jsonb_typeof("options") = 'object'
  AND jsonb_typeof("options"->'aiCalibration') = 'object'
  AND jsonb_typeof("options"->'aiCalibration'->'extraction') = 'object'
  AND lower(btrim(COALESCE("options"->'aiCalibration'->'extraction'->>'model', ''))) IN (
    'm3',
    'minimax',
    'minimax m3',
    'minimax-m3',
    'minimax-m3-flash',
    'minimax-m3.1-flash'
  )
  AND COALESCE("options"->'aiCalibration'->'extraction'->>'model', '') <> 'MiniMax-M3.1-Flash';

-- 3. medical_tests: V3 options.aiCalibration.draft.extraction.model
UPDATE "medical_tests"
SET "options" = jsonb_set(
  "options",
  '{aiCalibration,draft,extraction,model}',
  '"MiniMax-M3.1-Flash"'::jsonb,
  false
)
WHERE jsonb_typeof("options") = 'object'
  AND jsonb_typeof("options"->'aiCalibration') = 'object'
  AND jsonb_typeof("options"->'aiCalibration'->'draft') = 'object'
  AND jsonb_typeof("options"->'aiCalibration'->'draft'->'extraction') = 'object'
  AND lower(btrim(COALESCE("options"->'aiCalibration'->'draft'->'extraction'->>'model', ''))) IN (
    'm3',
    'minimax',
    'minimax m3',
    'minimax-m3',
    'minimax-m3-flash',
    'minimax-m3.1-flash'
  )
  AND COALESCE("options"->'aiCalibration'->'draft'->'extraction'->>'model', '') <> 'MiniMax-M3.1-Flash';

-- 4. medical_tests: V3 options.aiCalibration.publishedVersions[*].extraction.model
UPDATE "medical_tests"
SET "options" = jsonb_set(
  "options",
  '{aiCalibration,publishedVersions}',
  (
    SELECT jsonb_agg(
      CASE
        WHEN jsonb_typeof(elem) = 'object'
          AND jsonb_typeof(elem->'extraction') = 'object'
          AND lower(btrim(COALESCE(elem->'extraction'->>'model', ''))) IN (
            'm3',
            'minimax',
            'minimax m3',
            'minimax-m3',
            'minimax-m3-flash',
            'minimax-m3.1-flash'
          )
          AND COALESCE(elem->'extraction'->>'model', '') <> 'MiniMax-M3.1-Flash'
        THEN jsonb_set(elem, '{extraction,model}', '"MiniMax-M3.1-Flash"'::jsonb, false)
        ELSE elem
      END
    )
    FROM jsonb_array_elements("options"->'aiCalibration'->'publishedVersions') AS elem
  ),
  false
)
WHERE jsonb_typeof("options") = 'object'
  AND jsonb_typeof("options"->'aiCalibration') = 'object'
  AND jsonb_typeof("options"->'aiCalibration'->'publishedVersions') = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements("options"->'aiCalibration'->'publishedVersions') AS elem
    WHERE jsonb_typeof(elem) = 'object'
      AND jsonb_typeof(elem->'extraction') = 'object'
      AND lower(btrim(COALESCE(elem->'extraction'->>'model', ''))) IN (
        'm3',
        'minimax',
        'minimax m3',
        'minimax-m3',
        'minimax-m3-flash',
        'minimax-m3.1-flash'
      )
      AND COALESCE(elem->'extraction'->>'model', '') <> 'MiniMax-M3.1-Flash'
  );
