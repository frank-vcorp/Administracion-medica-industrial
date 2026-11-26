import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'prisma/migrations/20261125180000_backfill_v3_clinical_criteria_and_rayos_x_calibration/migration.sql',
)

describe('Migración SQL idempotente backfill_v3_clinical_criteria_and_rayos_x_calibration', () => {
  it('existe el archivo SQL de migración en prisma/migrations/', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
  })

  it('protege prompts existentes en BD (solo rellena cuando están vacíos/NULL) y excluye manual_service', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8')
    expect(sql).toContain("<> 'manual_service'")
    expect(sql).toContain(
      "NULLIF(BTRIM(COALESCE(v_elem #>> '{clinicalCriteria,prompt}', '')), '') IS NULL",
    )
    expect(sql).toContain(
      "v_prompt_now := NULLIF(BTRIM(COALESCE(v_cal #>> '{extraction,prompt}', '')), '');",
    )
    expect(sql).toContain(
      "v_prompt_now := NULLIF(BTRIM(COALESCE(v_cal #>> '{diagnosis,prompt}', '')), '');",
    )
    expect(sql).toContain('IF v_prompt_now IS NULL THEN')
    expect(sql).toContain("jsonb_typeof(rec.\"options\") = 'object'")
  })

  it('cubre backfill V3 de Audiometría, Espirometría y calibración de Rayos X (RayosXData)', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8')
    expect(sql).toContain('predx-audiometria-v2-derivado')
    expect(sql).toContain('espirometria-prediagnosis-v3')
    expect(sql).toContain('IMG-%')
    expect(sql).toContain('Rayos_X')
    expect(sql).toContain('extract-rayos-x-ami-v1')
    expect(sql).toContain('predx-rayos-x-ami-v1')
    expect(sql).toContain('"paciente"')
    expect(sql).toContain('"fecha_estudio"')
    expect(sql).toContain('"localizacion"')
    expect(sql).toContain('"hallazgos"')
    expect(sql).toContain('{extracted_json}')
  })
})
