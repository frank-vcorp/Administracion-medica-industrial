/**
 * @file Tests focales (V1) para los CTAs de descarga del PDF consolidado
 *   de Examen Médico (`/api/pdf/examen-medico/[eventId]`) y del ZIP de
 *   cierre clínico (`/api/zip/clinical-closure/[eventId]`).
 *
 * @id IMPL-FEATURE-20260825-03 (rondas 3 y 4 / IMPLEMENTATION_DEFECT + FND-20260825-22)
 * @id IMPL-FEATURE-20260825-04 (ronda 4 — ZIP gate paridad con PDF)
 * @backup context/SPECs/SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md
 * @adr context/decisions/ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md
 * @qa context/reviews/QA-20260825-03-FEATURE-20260825-03.md
 * @finding discovery/FINDINGS.md FND-20260825-18
 * @finding discovery/FINDINGS.md FND-20260825-22
 * @decision discovery/DECISIONS.md DEC-20260825-19
 * @businessRule discovery/BUSINESS-RULES.md BR-20260825-20
 *
 * IMPLEMENTATION_DEFECT observado en producción:
 *   - Ronda 3 (FND-20260825-18): `ExamenMedicoEstudio` no mostraba CTA
 *     PDF → se agrega visible cuando hay aptitud persistida.
 *   - Ronda 4 (FND-20260825-22 / DEC-20260825-19 / BR-20260825-20):
 *     Completar NO emite MedicalVerdict → los CTAs deben ocultarse
 *     hasta que haya verdict emitido (PDF/ZIP devuelven 404 antes).
 *
 * Cubre:
 *   - `examenMedicoPdfUrl(eventId)` / `clinicalClosureZipUrl(eventId)`
 *     construyen las URLs correctas (sin path traversal, sin query,
 *     sin hash).
 *   - `shouldShowExamenMedicoPdfCta(aptitud, hasMedicalVerdict)`:
 *       · true sólo si aptitud es string no-vacío Y `hasMedicalVerdict`
 *         es estrictamente `true` (BR-20260825-20 — gate de emisión).
 *       · false si aptitud falta O si `hasMedicalVerdict !== true`
 *         (incluye null, undefined, false — defensa en profundidad).
 *   - `shouldShowClinicalClosureZipCta` hereda el mismo gate
 *     (paridad PDF/ZIP — SPEC FEATURE-20260825-04 §Reglas).
 *   - La decisión de visibilidad NO depende del rol de sesión — la
 *     autorización por rol la aplica la ruta autenticada.
 */
import { describe, it, expect } from 'vitest'
import {
  examenMedicoPdfUrl,
  shouldShowExamenMedicoPdfCta,
  clinicalClosureZipUrl,
  shouldShowClinicalClosureZipCta,
} from '@/components/clinical/ExamenMedicoEstudio'

describe('IMPL-FEATURE-20260825-03 ronda 4: CTA PDF consolidado Examen Médico', () => {
  // ─── examenMedicoPdfUrl ────────────────────────────────────────────────────
  it('examenMedicoPdfUrl: construye /api/pdf/examen-medico/<eventId>', () => {
    expect(examenMedicoPdfUrl('event-1')).toBe(
      '/api/pdf/examen-medico/event-1',
    )
    // No añade prefijo, sufijo, query ni hash.
    expect(examenMedicoPdfUrl('event-1')).not.toMatch(/[?#]/)
    expect(examenMedicoPdfUrl('event-1')).not.toMatch(/\/api\/pdf\/examen-medico\/+$/)
  })

  it('examenMedicoPdfUrl: acepta UUIDs (formato real)', () => {
    const uuid = '7c6f1c2e-4f8b-4d2b-9b9c-1f9a4d6e7b21'
    expect(examenMedicoPdfUrl(uuid)).toBe(
      `/api/pdf/examen-medico/${uuid}`,
    )
  })

  // ─── shouldShowExamenMedicoPdfCta (gate aptitud + verdict emitido) ──────
  // BR-20260825-20 / DEC-20260825-19 / FND-20260825-22: el CTA sólo se
  // muestra si AMBAS condiciones son verdaderas:
  //   (1) aptitud canónica NO vacía persistida
  //   (2) MedicalVerdict emitido (hasMedicalVerdict === true)
  it('shouldShowExamenMedicoPdfCta: true con aptitud + verdict=true', () => {
    expect(shouldShowExamenMedicoPdfCta('APTO', true)).toBe(true)
    expect(shouldShowExamenMedicoPdfCta('APTO CONDICIONADO', true)).toBe(true)
    expect(shouldShowExamenMedicoPdfCta('NO APTO', true)).toBe(true)
    expect(
      shouldShowExamenMedicoPdfCta(
        'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO',
        true,
      ),
    ).toBe(true)
  })

  // ─── Gate aptitud (ronda 3) preservado ──────────────────────────────────
  it('shouldShowExamenMedicoPdfCta: false cuando la aptitud es null/undefined', () => {
    expect(shouldShowExamenMedicoPdfCta(null, true)).toBe(false)
    expect(shouldShowExamenMedicoPdfCta(undefined, true)).toBe(false)
  })

  it('shouldShowExamenMedicoPdfCta: false cuando la aptitud es string vacío o whitespace', () => {
    expect(shouldShowExamenMedicoPdfCta('', true)).toBe(false)
    expect(shouldShowExamenMedicoPdfCta('   ', true)).toBe(false)
    expect(shouldShowExamenMedicoPdfCta('\t\n', true)).toBe(false)
  })

  // ─── Gate verdict emitido (ronda 4 / DEC-20260825-19 / FND-20260825-22) ──
  it('REGRESIÓN FND-20260825-22: aptitud OK pero sin verdict → CTA oculto', () => {
    // El médico ya guardó aptitud ("APTO") pero todavía NO firmó el
    // dictamen (MedicalVerdict no emitido). El CTA NO debe mostrarse —
    // el endpoint devolvería 404 y debemos evitar exponer al médico a
    // un 404. Mientras tanto se muestra el mensaje pendiente invitando
    // a "Firmar y Emitir Dictamen".
    expect(shouldShowExamenMedicoPdfCta('APTO', false)).toBe(false)
  })

  it('REGRESIÓN FND-20260825-22: aptitud OK pero hasMedicalVerdict=null/undefined → CTA oculto', () => {
    // Defensa en profundidad: si el caller NO pasa `hasMedicalVerdict`
    // (null/undefined), el CTA NO se muestra por defecto (firma
    // pendiente).
    expect(shouldShowExamenMedicoPdfCta('APTO', null)).toBe(false)
    expect(shouldShowExamenMedicoPdfCta('APTO', undefined)).toBe(false)
  })

  it('REGRESIÓN FND-20260825-22: sin aptitud y con verdict → CTA oculto', () => {
    // Hay verdict emitido pero NO hay aptitud persistida (edge case:
    // event legacy o aptitud borrada). El CTA tampoco debe mostrarse —
    // el endpoint devolvería 409 por gate de aptitud (ADR §R6 / P2-3).
    expect(shouldShowExamenMedicoPdfCta('', true)).toBe(false)
    expect(shouldShowExamenMedicoPdfCta(null, true)).toBe(false)
  })

  // ─── Persistencia tras refresh (ronda 4) ───────────────────────────────
  // El componente inicializa `aptitud` state desde `physicalExamData.aptitud`
  // y `hasMedicalVerdict` desde la prop que viene del page/workspace
  // (que se hidrata desde `event.verdict` en BD). Tras reload con verdict
  // persistido, ambos siguen siendo verdaderos → CTA visible.
  it('persistencia tras refresh: aptitud + verdict persistidos → CTA visible', () => {
    expect(shouldShowExamenMedicoPdfCta('APTO', true)).toBe(true)
  })

  it('persistencia tras refresh: sin verdict persistido → CTA oculto (aunque haya aptitud)', () => {
    // Caso FND-20260825-22: tras refrescar después de Completar, el
    // médico ve aptitud="APTO" pero el verdict aún no existe.
    expect(shouldShowExamenMedicoPdfCta('APTO', false)).toBe(false)
  })

  // ─── Decisión sin acoplamiento al rol ─────────────────────────────────────
  it('la decisión del CTA NO depende del rol — la auth la aplica la ruta', () => {
    // El CTA aparece cuando hay aptitud + verdict, sin importar el rol.
    // La autorización por rol (CAPTURIST/RECEPTIONIST → 403;
    // COMPANY_CLIENT → 403; clínico → 200) se aplica en la ruta
    // autenticada `/api/pdf/examen-medico/[eventId]` (paridad con
    // QA-20260825-03 P1-1). El CTA es sólo UX.
    expect(shouldShowExamenMedicoPdfCta('APTO', true)).toBe(true)
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

  // ─── Paridad con PDF gate (ronda 4: aptitud + verdict) ──────────────────
  it('shouldShowClinicalClosureZipCta: true con aptitud + verdict=true', () => {
    expect(shouldShowClinicalClosureZipCta('APTO', true)).toBe(true)
    expect(shouldShowClinicalClosureZipCta('APTO CONDICIONADO', true)).toBe(true)
  })

  it('REGRESIÓN FND-20260825-22: ZIP CTA oculto sin verdict aunque haya aptitud', () => {
    // Mismo gate que el PDF: el ZIP sólo se habilita con verdict
    // emitido (BR-20260825-20 / DEC-20260825-19).
    expect(shouldShowClinicalClosureZipCta('APTO', false)).toBe(false)
    expect(shouldShowClinicalClosureZipCta('APTO', null)).toBe(false)
    expect(shouldShowClinicalClosureZipCta('APTO', undefined)).toBe(false)
  })

  it('shouldShowClinicalClosureZipCta: false si aptitud falta', () => {
    expect(shouldShowClinicalClosureZipCta(undefined, true)).toBe(false)
    expect(shouldShowClinicalClosureZipCta(null, true)).toBe(false)
    expect(shouldShowClinicalClosureZipCta('', true)).toBe(false)
    expect(shouldShowClinicalClosureZipCta('   ', true)).toBe(false)
  })

  it('paridad con CTA PDF: ZIP hereda exactamente el gate aptitud + verdict', () => {
    // SPEC FEATURE-20260825-04 §Reglas: el ZIP requiere aptitud + verdict
    // (mismo gate que el PDF individual). El CTA debe mostrar/ocultar
    // de forma sincronizada con el PDF para no invitar a un 404/409.
    const aptitudValues = [
      'APTO',
      'NO APTO',
      'APTO CONDICIONADO',
      '',
      undefined,
      null,
      '  ',
    ]
    const verdictValues = [true, false, null, undefined]
    for (const a of aptitudValues) {
      for (const v of verdictValues) {
        expect(shouldShowClinicalClosureZipCta(a, v as boolean | null)).toBe(
          shouldShowExamenMedicoPdfCta(a, v as boolean | null),
        )
      }
    }
  })
})