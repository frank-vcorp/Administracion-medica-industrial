import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  'prisma/migrations/20261119000000_single_source_ai_calibration/migration.sql',
)

describe('Migración SQL idempotente single_source_ai_calibration', () => {
  it('existe el archivo SQL de migración en prisma/migrations/', () => {
    expect(existsSync(MIGRATION_PATH)).toBe(true)
  })

  it('protege calibraciones existentes en BD (WHERE aiCalibration IS NULL / sub-capa vacía y excluye V3/manual_service)', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8')
    expect(sql).toContain('"options"->\'aiCalibration\' IS NULL')
    expect(sql).toContain("jsonb_typeof(\"options\") = 'object'")
    expect(sql).toContain("<> 'V3'")
    expect(sql).toContain("<> 'manual_service'")
    expect(sql).toContain("NULLIF(BTRIM(COALESCE(\"options\"->'aiCalibration'->'extraction'->>'prompt', '')), '') IS NULL")
    expect(sql).toContain("NULLIF(BTRIM(COALESCE(\"options\"->'aiCalibration'->'diagnosis'->>'prompt', '')), '') IS NULL")
  })

  it('respalda Espirometría, Audiometría, ECG, formularios internos y Laboratorio sin preconfigurar RX', () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8')
    expect(sql).toMatch(/%espirometr%/i)
    expect(sql).toMatch(/%audiometr%/i)
    expect(sql).toMatch(/CARD-ECG/i)
    expect(sql).toMatch(/%somatometr%/i)
    expect(sql).toMatch(/%agudeza visual%/i)
    expect(sql).toMatch(/%campimetr%/i)
    expect(sql).toMatch(/%laboratorio%/i)
    expect(sql).not.toMatch(/%radiograf%|%tele de torax%|%columna lumbosacra%/i)
  })
})
