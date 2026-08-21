/**
 * @file FIX-20260821-01 §4.5 / AC-7.1: Label UI del stage "extracting" NO
 * afirma "Gemini" cuando el provider extractivo real es `m3` (FIX-20260812-12).
 *
 * Valida el helper `extractingStageLabel` que produce el label mostrado en
 * `PapeletaWorkspace` durante la etapa de extracción. El provider viene de
 * `extraction_snapshot.audit.extraction_provider_used` (no expuesto todavía en
 * esta fase del upload, por lo que el panel renderiza con texto neutro).
 *
 * Reglas:
 * - m3      → "Extrayendo datos con Minimax" (provider vigente post-FIX-20260812-12).
 * - gemini  → "Extrayendo datos con Gemini".
 * - ausente/otro → "Extrayendo datos" (texto neutro, sin afirmar proveedor).
 *
 * @id IMPL-20260821-01-UI-LABEL-TEST
 * @spec SPEC_FIX-20260821-01-GATE-TABLEAWARE-ESPIROMETRIA.md §7.3 (AC-7.1)
 */
import { describe, it, expect } from 'vitest'
import { extractingStageLabel } from '@/lib/clinical/extraction-stage-label'

describe('IMPL-20260821-01 / AC-7.1: extraction stage label deriva de provider real', () => {
  it('AC-7.1: cuando provider es "m3", el label contiene "Minimax" y NO contiene "Gemini"', () => {
    const label = extractingStageLabel('m3')
    expect(label).toBe('Extrayendo datos con Minimax')
    expect(label).not.toContain('Gemini')
  })

  it('AC-7.1: cuando provider es "gemini", el label contiene "Gemini"', () => {
    const label = extractingStageLabel('gemini')
    expect(label).toBe('Extrayendo datos con Gemini')
  })

  it('AC-7.1 (defensa): cuando provider es undefined o null, devuelve texto neutro', () => {
    expect(extractingStageLabel(undefined)).toBe('Extrayendo datos')
    expect(extractingStageLabel(null)).toBe('Extrayendo datos')
    expect(extractingStageLabel('')).toBe('Extrayendo datos')
  })

  it('AC-7.1 (defensa): provider desconocido → texto neutro sin afirmar proveedor', () => {
    // Cualquier valor que no sea m3/gemini debe producir texto neutro
    // para no mentir al usuario sobre el proveedor activo.
    expect(extractingStageLabel('xml_parser')).toBe('Extrayendo datos')
    expect(extractingStageLabel('openai')).toBe('Extrayendo datos')
    expect(extractingStageLabel('M3')).toBe('Extrayendo datos con Minimax') // case-insensitive
  })
})