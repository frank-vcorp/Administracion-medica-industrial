/**
 * @file Tests focales (V1) para el CTA de descarga del PDF consolidado de
 *   Examen Médico (`/api/pdf/examen-medico/[eventId]`).
 *
 * @id IMPL-FEATURE-20260825-03 (ronda 3 / IMPLEMENTATION_DEFECT)
 * @backup context/SPECs/SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md
 * @adr context/decisions/ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md
 * @qa context/reviews/QA-20260825-03-FEATURE-20260825-03.md
 * @finding discovery/FINDINGS.md FND-20260825-18
 *
 * IMPLEMENTATION_DEFECT observado en producción: `ExamenMedicoEstudio`
 * guardaba/completaba correctamente pero NO mostraba ningún botón/enlace
 * para descargar el PDF consolidado AMI. Esta round agrega un CTA
 * visible enlazando a `/api/pdf/examen-medico/${eventId}` en nueva
 * pestaña, preservando la autorización de la ruta (regla §R6 del ADR:
 * gate de aptitud canónica).
 *
 * Cubre:
 *   - `examenMedicoPdfUrl(eventId)` construye la URL correcta
 *     (sin path traversal, sin query, sin hash).
 *   - `shouldShowExamenMedicoPdfCta(aptitud)`:
 *       · true sólo si la aptitud es un string no-vacío (cualquiera de
 *         los 5 valores canónicos del PDF + legacy `'NO APTO'`).
 *       · false si es null/undefined/string vacío/whitespace.
 *   - La decisión de visibilidad NO depende del rol de sesión — la
 *     autorización por rol la aplica la ruta autenticada
 *     (`/api/pdf/examen-medico/[eventId]`); el CTA sólo verifica la
 *     aptitud persistida.
 */
import { describe, it, expect } from 'vitest'
import {
  examenMedicoPdfUrl,
  shouldShowExamenMedicoPdfCta,
  clinicalClosureZipUrl,
  shouldShowClinicalClosureZipCta,
} from '@/components/clinical/ExamenMedicoEstudio'

describe('IMPL-FEATURE-20260825-03 ronda 3: CTA PDF consolidado Examen Médico', () => {
  // ─── examenMedicoPdfUrl ────────────────────────────────────────────────────
  it('examenMedicoPdfUrl: construye /api/pdf/examen-medico/<eventId>', () => {
    expect(examenMedicoPdfUrl('event-1')).toBe(
      '/api/pdf/examen-medico/event-1'
    )
    // No añade prefijo, sufijo, query ni hash.
    expect(examenMedicoPdfUrl('event-1')).not.toMatch(/[?#]/)
    expect(examenMedicoPdfUrl('event-1')).not.toMatch(/\/api\/pdf\/examen-medico\/+$/)
  })

  it('examenMedicoPdfUrl: acepta UUIDs (formato real)', () => {
    const uuid = '7c6f1c2e-4f8b-4d2b-9b9c-1f9a4d6e7b21'
    expect(examenMedicoPdfUrl(uuid)).toBe(
      `/api/pdf/examen-medico/${uuid}`
    )
  })

  // ─── shouldShowExamenMedicoPdfCta ──────────────────────────────────────────
  it('shouldShowExamenMedicoPdfCta: true con cualquiera de los 5 valores canónicos', () => {
    const canonical = [
      'APTO',
      'APTO CONDICIONADO',
      'APTO CON RESTRICCIONES',
      'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO',
      'PENDIENTE DE RESULTADOS',
    ]
    for (const v of canonical) {
      expect(shouldShowExamenMedicoPdfCta(v)).toBe(true)
    }
  })

  it('shouldShowExamenMedicoPdfCta: true con legacy "NO APTO" (DA-1)', () => {
    expect(shouldShowExamenMedicoPdfCta('NO APTO')).toBe(true)
  })

  it('shouldShowExamenMedicoPdfCta: false cuando la aptitud es null/undefined', () => {
    expect(shouldShowExamenMedicoPdfCta(null)).toBe(false)
    expect(shouldShowExamenMedicoPdfCta(undefined)).toBe(false)
  })

  it('shouldShowExamenMedicoPdfCta: false cuando la aptitud es string vacío o whitespace', () => {
    expect(shouldShowExamenMedicoPdfCta('')).toBe(false)
    expect(shouldShowExamenMedicoPdfCta('   ')).toBe(false)
    expect(shouldShowExamenMedicoPdfCta('\t\n')).toBe(false)
  })

  // ─── Persistencia tras recarga ────────────────────────────────────────────
  // El componente inicializa `aptitud` state desde `physicalExamData.aptitud`
  // (línea 306). Si el médico guardó la aptitud, al recargar el state
  // también queda con valor → el CTA persiste.
  //
  // Esto se modela en el test verificando que el helper trata una aptitud
  // persistida (string no-vacío) como visible, independientemente del
  // origen (state local vs physicalExamData).
  it('persistencia tras recarga: aptitud persistida → CTA visible', () => {
    // Simula `physicalExamData = { aptitud: 'APTO' }` cargado al inicio.
    const persistedAptitud = 'APTO'
    expect(shouldShowExamenMedicoPdfCta(persistedAptitud)).toBe(true)
  })

  it('persistencia tras recarga: sin aptitud persistida → CTA oculto', () => {
    // Simula `physicalExamData = {}` o `physicalExamData = { aptitud: '' }`.
    expect(shouldShowExamenMedicoPdfCta(undefined)).toBe(false)
    expect(shouldShowExamenMedicoPdfCta('')).toBe(false)
  })

  // ─── Decisión sin acoplamiento al rol ─────────────────────────────────────
  it('la decisión del CTA NO depende del rol — la auth la aplica la ruta', () => {
    // El CTA aparece cuando hay aptitud, sin importar el rol. La
    // autorización por rol (CAPTURIST/RECEPTIONIST → 403; COMPANY_CLIENT
    // → 403; clínico → 200) se aplica en la ruta autenticada
    // `/api/pdf/examen-medico/[eventId]` (paridad con QA-20260825-03
    // P1-1). El CTA es sólo UX.
    expect(shouldShowExamenMedicoPdfCta('APTO')).toBe(true)
  })
})

describe('IMPL-FEATURE-20260825-04: CTA ZIP de cierre clínico', () => {
  it('clinicalClosureZipUrl: construye /api/zip/clinical-closure/<eventId>', () => {
    expect(clinicalClosureZipUrl('event-1')).toBe(
      '/api/zip/clinical-closure/event-1',
    )
    expect(clinicalClosureZipUrl('event-1')).not.toMatch(/[?#]/)
    expect(clinicalClosureZipUrl('event-1')).not.toMatch(/\/+$/)
  })

  it('clinicalClosureZipUrl: acepta UUIDs', () => {
    const uuid = '7c6f1c2e-4f8b-4d2b-9b9c-1f9a4d6e7b21'
    expect(clinicalClosureZipUrl(uuid)).toBe(
      `/api/zip/clinical-closure/${uuid}`,
    )
  })

  it('shouldShowClinicalClosureZipCta: true si y sólo si aptitud NO-vacía', () => {
    expect(shouldShowClinicalClosureZipCta('APTO')).toBe(true)
    expect(shouldShowClinicalClosureZipCta('APTO CONDICIONADO')).toBe(true)
    expect(shouldShowClinicalClosureZipCta(undefined)).toBe(false)
    expect(shouldShowClinicalClosureZipCta(null)).toBe(false)
    expect(shouldShowClinicalClosureZipCta('')).toBe(false)
    expect(shouldShowClinicalClosureZipCta('   ')).toBe(false)
  })

  it('paridad con CTA PDF: ZIP hereda el gate de aptitud canónica', () => {
    // SPEC FEATURE-20260825-04 §Reglas: el ZIP requiere aptitud
    // (mismo gate que el PDF individual). El CTA debe mostrar/ocultar
    // de forma sincronizada con el PDF para no invitar a un 409/404.
    for (const v of ['APTO', 'NO APTO', 'APTO CONDICIONADO']) {
      expect(shouldShowClinicalClosureZipCta(v)).toBe(
        shouldShowExamenMedicoPdfCta(v),
      )
    }
    for (const v of [undefined, null, '', '  ']) {
      expect(shouldShowClinicalClosureZipCta(v)).toBe(
        shouldShowExamenMedicoPdfCta(v),
      )
    }
  })
})