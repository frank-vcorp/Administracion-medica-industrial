/**
 * @file Tests para `buildVerdictFromExam` — IMPL-20260817-10-C1.
 *
 * Cubre DA-2 (ARCH-20260817-02 Corte 3):
 * - Auto-poblamiento de campos del dictamen desde `physicalExamData`.
 * - Default de aptitud (`PENDIENTE DE RESULTADOS`) cuando no hay valor.
 * - Preservación de edición manual previa (`existing`).
 * - Defensa en profundidad contra tipos incorrectos (no-string).
 * - Defaults de médico evaluador y fecha.
 *
 * @id IMPL-20260817-10-C3
 * @spec SPEC_ARCH-20260817-02 §2.2 (DA-2), §5.4 (AC-16, AC-18, AC-19)
 * @decision DA-2 (ARCH-20260817-02) — auto-poblamiento dictamen
 *           desde pestaña Impresión/Aptitud (no pisa edición manual).
 */
import { describe, it, expect } from 'vitest'
import {
  buildVerdictFromExam,
  DEFAULT_APTITUD,
  type PartialVerdictBuildOutput,
} from '@/lib/clinical/verdict.builder'

describe('IMPL-20260817-10-C3: buildVerdictFromExam (DA-2 auto-poblamiento MedicalVerdict)', () => {
  // ─── Auto-poblamiento básico desde physicalExamData ─────────────────────────
  it('96. Auto-pobla aptitud desde physicalExamData.aptitud', () => {
    const verdict = buildVerdictFromExam({ aptitud: 'APTO' })
    expect(verdict.aptitud).toBe('APTO')
  })

  it('97. Default aptitud es PENDIENTE DE RESULTADOS si no hay valor', () => {
    const verdict = buildVerdictFromExam({})
    expect(verdict.aptitud).toBe(DEFAULT_APTITUD)
    expect(verdict.aptitud).toBe('PENDIENTE DE RESULTADOS')
  })

  it('98. Default aptitud es PENDIENTE si aptitud es null o no-string', () => {
    const fromNull = buildVerdictFromExam({ aptitud: null })
    const fromNumber = buildVerdictFromExam({ aptitud: 42 })
    const fromObject = buildVerdictFromExam({ aptitud: { value: 'APTO' } })
    expect(fromNull.aptitud).toBe('PENDIENTE DE RESULTADOS')
    expect(fromNumber.aptitud).toBe('PENDIENTE DE RESULTADOS')
    expect(fromObject.aptitud).toBe('PENDIENTE DE RESULTADOS')
  })

  it('99. Auto-pobla impresión diagnóstica desde physicalExamData.impresion_diagnostica (DA-1 legacy sin slots)', () => {
    // IMPL-20260817-12-C1: si NO hay slots por prueba, fallback al legacy
    // `impresion_diagnostica` consolidado.
    const verdict = buildVerdictFromExam({ impresion_diagnostica: 'Sano' })
    expect(verdict.impresionDiagnostica).toBe('Sano')
  })

  it('100. Auto-pobla recomendaciones desde physicalExamData.recomendaciones', () => {
    const verdict = buildVerdictFromExam({ recomendaciones: '1.- VALORACION...' })
    expect(verdict.recomendaciones).toBe('1.- VALORACION...')
  })

  it('101. Auto-pobla examenFisico desde physicalExamData.examen_medico_texto', () => {
    const verdict = buildVerdictFromExam({
      examen_medico_texto: 'Sin hallazgos patológicos al momento del examen.',
    })
    expect(verdict.examenFisico).toBe('Sin hallazgos patológicos al momento del examen.')
  })

  it('102. Campos null/undefined se normalizan a string vacío', () => {
    const verdict = buildVerdictFromExam({
      impresion_diagnostica: null,
      recomendaciones: undefined,
      examen_medico_texto: null,
    })
    expect(verdict.impresionDiagnostica).toBe('')
    expect(verdict.recomendaciones).toBe('')
    expect(verdict.examenFisico).toBe('')
  })

  it('103. Auto-poblamiento completo desde physicalExamData completo (Corte 4.5)', () => {
    // IMPL-20260817-12-C1: cuando hay slot nuevo por prueba, gana sobre
    // el legacy. Aquí solo `examen_medico_texto` está set, por lo que el
    // consolidado devuelve el prefijo "Examen médico: ..." y NO el legacy.
    const physicalExamData = {
      aptitud: 'APTO CONDICIONADO',
      impresion_diagnostica: 'Hallazgos visuales menores',
      recomendaciones: '1.- Valoración por optometría',
      examen_medico_texto: 'Examen físico sin alteraciones',
    }
    const verdict = buildVerdictFromExam(physicalExamData)
    expect(verdict.aptitud).toBe('APTO CONDICIONADO')
    expect(verdict.impresionDiagnostica).toBe(
      'Examen médico: Examen físico sin alteraciones',
    )
    expect(verdict.recomendaciones).toBe('1.- Valoración por optometría')
    expect(verdict.examenFisico).toBe('Examen físico sin alteraciones')
  })

  // ─── Preservación de edición manual previa (DA-2) ───────────────────────────
  it('104. Preserva edición manual previa del médico cuando `existing` está presente', () => {
    const manual: PartialVerdictBuildOutput = {
      aptitud: 'APTO CONDICIONADO',
      impresionDiagnostica: 'Texto editado por el médico',
      recomendaciones: 'Recomendaciones editadas',
    }
    const verdict = buildVerdictFromExam(
      { aptitud: 'APTO', examen_medico_texto: 'Auto' },
      manual,
    )
    expect(verdict.aptitud).toBe('APTO CONDICIONADO') // preserva manual
    expect(verdict.impresionDiagnostica).toBe('Texto editado por el médico')
    expect(verdict.recomendaciones).toBe('Recomendaciones editadas')
  })

  it('105. Existing null se trata como sin edición previa (auto-pobla)', () => {
    const verdict = buildVerdictFromExam(
      { aptitud: 'APTO' },
      null,
    )
    expect(verdict.aptitud).toBe('APTO')
  })

  it('106. Existing con campos parciales: campos presentes se preservan, ausentes caen al default (NO auto-pobla)', () => {
    // DA-2 estricto: si el médico ya engagement (existing != null),
    // no se re-construye desde physicalExamData. Existing trae solo
    // aptitud; impresionDiagnostica cae a '' (default), NO al texto
    // del examen. Esto evita pisar decisiones explícitas del médico
    // cuando guarda un dictamen incompleto a propósito.
    const partialExisting: PartialVerdictBuildOutput = {
      aptitud: 'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO',
    }
    const verdict = buildVerdictFromExam(
      {
        aptitud: 'APTO',
        impresion_diagnostica: 'Hallazgo crítico de audiometría',
      },
      partialExisting,
    )
    expect(verdict.aptitud).toBe(
      'NO CUMPLE CON LOS CRITERIOS DE SALUD PARA EL PUESTO PROPUESTO',
    )
    // impresionDiagnostica cae a '' (default) — NO se re-pobla desde
    // physicalExamData porque existing != null significa que el médico
    // ya engagement con el formulario (DA-2 preservar edición).
    expect(verdict.impresionDiagnostica).toBe('')
  })

  // ─── Defaults de médico y fecha ─────────────────────────────────────────────
  it('107. Defaults: fechaEmision es Date actual cuando no se pasa', () => {
    const before = new Date()
    const verdict = buildVerdictFromExam({})
    const after = new Date()
    expect(verdict.fechaEmision).toBeInstanceOf(Date)
    expect(verdict.fechaEmision.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(verdict.fechaEmision.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it('108. Defaults: medicoEvaluador y medicoRevisor son undefined si no se pasan', () => {
    const verdict = buildVerdictFromExam({})
    expect(verdict.medicoEvaluador).toBeUndefined()
    expect(verdict.medicoRevisor).toBeUndefined()
  })

  it('109. Defaults: medicoEvaluador se aplica cuando se pasa', () => {
    const verdict = buildVerdictFromExam(
      {},
      undefined,
      { medicoEvaluador: 'Dr. Juan Pérez', fechaEmision: new Date('2026-08-17') },
    )
    expect(verdict.medicoEvaluador).toBe('Dr. Juan Pérez')
    expect(verdict.fechaEmision).toEqual(new Date('2026-08-17'))
  })

  it('110. Defaults: medicoRevisor se aplica cuando se pasa', () => {
    const verdict = buildVerdictFromExam(
      {},
      undefined,
      { medicoRevisor: 'Dra. María López' },
    )
    expect(verdict.medicoRevisor).toBe('Dra. María López')
  })

  // ─── Defensa en profundidad: tipos no esperados ─────────────────────────────
  it('111. physicalExamData como Record vacío produce VerdictBuildOutput válido', () => {
    const verdict = buildVerdictFromExam({})
    expect(verdict).toEqual({
      aptitud: 'PENDIENTE DE RESULTADOS',
      impresionDiagnostica: '',
      recomendaciones: '',
      examenFisico: '',
      fechaEmision: expect.any(Date),
      medicoEvaluador: undefined,
      medicoRevisor: undefined,
    })
  })

  it('112. physicalExamData con campos no-string en posición de string: usa default', () => {
    const verdict = buildVerdictFromExam({
      aptitud: 123,
      impresion_diagnostica: ['array', 'not', 'string'],
      recomendaciones: { obj: true },
      examen_medico_texto: true,
    })
    expect(verdict.aptitud).toBe('PENDIENTE DE RESULTADOS')
    expect(verdict.impresionDiagnostica).toBe('')
    expect(verdict.recomendaciones).toBe('')
    expect(verdict.examenFisico).toBe('')
  })

  // ─── Integración: caso típico de DA-2 ───────────────────────────────────────
  it('113. Caso típico DA-2: médico firmó apto condicionado con restricciones (Corte 4.5)', () => {
    // IMPL-20260817-12-C1: el slot `examen_medico_texto` setea el
    // consolidado del dictamen (gana sobre legacy). Legacy `impresion_diagnostica`
    // queda como respaldo para DA-1.
    const physicalExamData = {
      aptitud: 'APTO CONDICIONADO',
      impresion_diagnostica: 'Trabajador con sobrepeso y disminución de agudeza visual.',
      restricciones: 'Uso obligatorio de lentes correctivos durante la jornada.',
      observaciones_finales: 'Se sugiere control nutricional en 3 meses.',
      examen_medico_texto: 'Exploración física sin alteraciones mayores.',
    }
    const verdict = buildVerdictFromExam(physicalExamData)
    expect(verdict.aptitud).toBe('APTO CONDICIONADO')
    expect(verdict.impresionDiagnostica).toBe(
      'Examen médico: Exploración física sin alteraciones mayores.',
    )
    expect(verdict.examenFisico).toBe(
      'Exploración física sin alteraciones mayores.',
    )
  })

  // ─── IMPL-20260817-12-C1 (Corte 4.5): 5 slots por prueba + DA-1 ────────────
  it('114. Concatena los 5 slots por prueba para el Diagnóstico Final', () => {
    // Sin punto final en los textos para evitar "doble punto" en join('. ').
    const physicalExamData = {
      examen_medico_texto: 'Sin hallazgos patológicos',
      audiometria_texto: 'OD: HIPOACUSIA LEVE',
      espirometria_texto: 'Patrón restrictivo leve',
      laboratorios_texto: 'BH normal, QS normal',
      radiografia_texto: 'RXTORAX sin alteraciones',
    }
    const verdict = buildVerdictFromExam(physicalExamData)
    expect(verdict.impresionDiagnostica).toBe(
      'Examen médico: Sin hallazgos patológicos. ' +
        'Audiometría: OD: HIPOACUSIA LEVE. ' +
        'Espirometría: Patrón restrictivo leve. ' +
        'Laboratorios: BH normal, QS normal. ' +
        'Radiografía: RXTORAX sin alteraciones',
    )
  })

  it('115. Solo algunos slots: concatena los presentes en orden, ignora vacíos', () => {
    const physicalExamData = {
      examen_medico_texto: 'Examen físico normal',
      laboratorios_texto: 'QS: glucosa 110 mg/dL',
    }
    const verdict = buildVerdictFromExam(physicalExamData)
    expect(verdict.impresionDiagnostica).toBe(
      'Examen médico: Examen físico normal. Laboratorios: QS: glucosa 110 mg/dL',
    )
  })

  it('116. DA-1: sin slots, fallback a legacy `impresion_diagnostica` consolidado', () => {
    const physicalExamData = {
      impresion_diagnostica: 'Trabajador sano, sin hallazgos.',
    }
    const verdict = buildVerdictFromExam(physicalExamData)
    expect(verdict.impresionDiagnostica).toBe(
      'Trabajador sano, sin hallazgos.',
    )
  })

  it('117. DA-1: slots vacíos (strings vacíos), fallback a legacy', () => {
    const physicalExamData = {
      examen_medico_texto: '',
      audiometria_texto: '',
      espirometria_texto: '',
      laboratorios_texto: '',
      radiografia_texto: '',
      impresion_diagnostica: 'Hallazgos visuales menores.',
    }
    const verdict = buildVerdictFromExam(physicalExamData)
    expect(verdict.impresionDiagnostica).toBe('Hallazgos visuales menores.')
  })

  it('118. DA-1: ningún slot NI legacy → string vacío', () => {
    const verdict = buildVerdictFromExam({})
    expect(verdict.impresionDiagnostica).toBe('')
  })

  it('119. examenFisico prefiere slot nuevo, fallback a legacy (DA-1)', () => {
    const withNew = buildVerdictFromExam({
      examen_medico_texto: 'Texto del slot nuevo',
      impresion_diagnostica: 'Texto legacy',
    })
    expect(withNew.examenFisico).toBe('Texto del slot nuevo')

    const legacyOnly = buildVerdictFromExam({
      impresion_diagnostica: 'Solo legacy',
    })
    expect(legacyOnly.examenFisico).toBe('Solo legacy')

    const nothing = buildVerdictFromExam({})
    expect(nothing.examenFisico).toBe('')
  })
})
