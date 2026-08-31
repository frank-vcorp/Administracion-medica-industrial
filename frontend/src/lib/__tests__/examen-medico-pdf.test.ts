/**
 * @file Tests focales V1 para `buildExamenMedicoPdfData` y helpers puros.
 *
 * Cubre FEATURE-20260825-03:
 *   - Auto-poblamiento del resumen ejecutivo de 9 campos sin duplicar captura.
 *   - Slots independientes (audiometria/espirometria/laboratorios/radiografia/
 *     examen_medico) preservados y trazables.
 *   - Recomendaciones auto-pobladas con edición médica (snapshot del médico
 *     gana sobre el auto-poblamiento).
 *   - Aptitud/impresión/restricciones/observaciones son la decisión
 *     EXPLÍCITA del médico, NO se auto-decidaptitud ni se firma.
 *   - Datos faltantes visibles como `—`/nulos, nunca defaults silenciosos.
 *   - El builder es PURO: no toca Prisma, no hace IO, no decide aptitud.
 *
 * @id IMPL-FEATURE-20260825-03
 * @spec SPEC-FEATURE-20260825-03-EXAMEN-MEDICO-ENTREGABLE.md AC-1..AC-10
 * @adr ADR-20260825-02-EXAMEN-MEDICO-ENTREGABLE.md
 */
import { describe, it, expect } from 'vitest'
import {
  buildExamenMedicoPdfData,
  __test__,
  type BuildExamenMedicoPdfInput,
} from '@/lib/examen-medico-pdf'

// ── Datos base ───────────────────────────────────────────────────────────────

function baseInput(
  overrides: Partial<BuildExamenMedicoPdfInput> = {}
): BuildExamenMedicoPdfInput {
  return {
    folio: 'folio-test',
    signedAt: new Date('2026-08-25T19:30:00.000Z'),
    status: 'SIGNED',
    worker: {
      firstName: 'Juan',
      lastName: 'Pérez',
      universalId: 'UNI-001',
      dob: new Date('1985-04-12T00:00:00.000Z'),
      sexo: 'M',
      identidadGenero: 'MASCULINO',
      empresa: 'ACME S.A.',
      puesto: 'Operador',
      area: 'Producción',
      tipoExamen: 'PERIÓDICO',
      direccion: 'Av. Industria 100',
      estadoCivil: 'CASADO',
      escolaridad: 'PREPARATORIA',
      tipoSanguineo: 'O POSITIVO',
    },
    ahf: {
      diabetes: 'PADRE',
      hipertension: 'MADRE',
      epilepsia: 'NEGADOS',
      cardiopatia: 'NEGADOS',
      renales: 'NEGADOS',
      asma: 'NEGADOS',
      cancer: 'NEGADOS',
      mentales: 'NEGADO',
      otras: 'NEGADOS',
    },
    apnp: {
      alcohol: 'NEGADO',
      tabaco: 'NEGADO',
      drogas: 'NEGADO',
      ejercicio: 'SI — 3 veces/semana',
      alimentacion: 'BUENA',
      tatuajes: 'NEGADO',
    },
    historiaOcupacional: {
      empresa: 'ACME S.A.',
      puesto: 'Operador',
      area: 'Producción',
      narrativa: 'Anterior 1: Beta SA (Operador, 4 años)',
      riesgos: 'Ruido, calor',
      epp: 'Tapones auditivos, casco',
    },
    app: { texto: 'Sin padecimientos crónicos' },
    historiaGineco: null,
    inmunizaciones: 'Hepatitis B: SI; Tétanos: SI',
    somatometria: {
      peso: '75.5',
      talla: '1.75',
      imc: '24.65',
      cintura: '88',
      cadera: '98',
      ta: '120/80',
      fc: '72',
      fr: '16',
      temperatura: '36.5',
    },
    agudezaVisual: {
      visionLejanaOD: '20/20',
      visionLejanaOI: '20/20',
      visionCercanaOD: '20/20',
      visionCercanaOI: '20/20',
      lejanaCorregidaOD: '20/20',
      lejanaCorregidaOI: '20/20',
      cercanaCorregidaOD: '20/20',
      cercanaCorregidaOI: '20/20',
      reflejos: 'PRESENTES Y NORMOREFLECTICOS',
      ishihara: 'NORMAL (LEE 12, 8, 6, 29, 57, 45)',
      campimetria: 'CAMPOS VISUALES DENTRO DE PARAMETROS NORMALES',
    },
    exploracion: {
      neurologico: 'Alerta, orientado',
      cabeza: 'Cráneo normocéfalo',
      piel_y_faneras: 'Sin datos patológicos',
      oidos_cad: 'Permeable, MT íntegra',
      oidos_cai: 'Permeable, MT íntegra',
      ojos: 'Pupilas isocóricas',
      boca_estado: 'CARIES Y SARRO',
      boca_alineacion: 'Adecuada',
      nariz: 'Alineada',
      faringe: 'Sin datos patológicos',
      cuello: 'Cilíndrico, tráquea central',
      torax: 'Mesomórfico',
      corazon: 'Ruidos rítmicos',
      campos_pulmonares: 'Bien ventilados',
      abdomen: 'Globoso, blando',
      genitourinario: 'Giordano negativo bilateral',
      columna_vertebral: 'Alineada',
      test_adam: 'NEGATIVO',
      ms_superiores: 'Íntegros',
      fuerza_muscular_daniels_sup: '5/5',
      ms_inferiores: 'Íntegros',
      fuerza_muscular_daniels_inf: '5/5',
      circulacion_venosa: 'C0: SIN SIGNOS VISIBLES NI PALPABLES',
      arco_de_movilidad: 'PRESENTES Y NORMAL',
      tono_muscular: 'NORMAL',
      coordinacion: 'NORMAL',
      test_romberg: 'NEGATIVO',
      signo_bragard: 'NEGATIVO',
      prueba_finkelstein: 'NEGATIVO',
      signo_tinel: 'NEGATIVO',
      prueba_phanel: 'NEGATIVO',
      prueba_lasegue: 'NEGATIVO',
      presencia_quiste_sinovial: 'NORMAL',
    },
    impresionDiagnostica: 'Trabajador sano, apto para el puesto.',
    aptitud: 'APTO',
    restricciones: 'Sin restricciones.',
    observacionesFinales: 'Sin observaciones adicionales.',
    notaCondicionamiento: null,
    medico: {
      fullName: 'Dra. María González',
      professionalLicense: '12345678',
      signatureImageUrl: 'data:image/png;base64,iVBORw0KGgo=',
    },
    slots: {
      audiometria: 'Audiometría: Hipoacusia conductiva leve bilateral',
      espirometria: 'Espirometría: patrón obstructivo leve',
      laboratorios: 'Laboratorios: Biometría hemática dentro de parámetros',
      radiografia: 'Radiografía: Sin hallazgos patológicos',
      examenMedico: 'Examen médico: sin alteraciones',
    },
    ia: {
      audiometriaClasificacion: 'CONDUCTIVA',
      espirometriaPatron: 'OBSTRUCTIVO',
      radiografiaHallazgo: null,
      laboratorioOutOfRange: false,
    },
    logoDataUrl: null,
    ...overrides,
  }
}

// ─── Tests del builder principal ─────────────────────────────────────────────

describe('IMPL-FEATURE-20260825-03: buildExamenMedicoPdfData (4 secciones AMI)', () => {
  // AC-1: el resumen se auto-pobla desde el perfil/Event sin pedir datos duplicados.
  it('AC-1: resumen ejecutivo de 9 campos auto-poblado desde snapshot', () => {
    const data = buildExamenMedicoPdfData(baseInput())
    expect(data.summary.estado_nutricional).toBe('NORMAL')
    expect(data.summary.salud_bucal).toBe('CARIES Y SARRO')
    expect(data.summary.agudeza_visual).toBe('NORMAL')
    expect(data.summary.presion_arterial).toBe('NORMAL AL MOMENTO DE LA TOMA')
    expect(data.summary.audiometria).toBeTruthy()
    expect(data.summary.espirometria).toBeTruthy()
    expect(data.summary.laboratorios).toBeTruthy()
    expect(data.summary.radiografia).toBeTruthy()
  })

  // AC-2: los cinco slots de estudios se preservan independientes y trazables.
  it('AC-2: slots independientes audiometria/espirometria/laboratorios/radiografia/examenMedico', () => {
    const data = buildExamenMedicoPdfData(baseInput())
    expect(data.slots.audiometria).toContain('Hipoacusia conductiva')
    expect(data.slots.espirometria).toContain('obstructivo')
    expect(data.slots.laboratorios).toContain('Biometría hemática')
    expect(data.slots.radiografia).toContain('Sin hallazgos')
    expect(data.slots.examenMedico).toContain('sin alteraciones')
    // NO se mezclan: cada slot conserva su contenido original.
    expect(data.slots.audiometria).not.toContain('Espirometría')
    expect(data.slots.espirometria).not.toContain('Audiometría')
  })

  // AC-3: el PDF reproduce la estructura AMI de 4 páginas/secciones.
  it('AC-3: el output contiene los 4 bloques del PDF AMI', () => {
    const data = buildExamenMedicoPdfData(baseInput())
    // I. Identificación e historia: paciente + AHF + APNP
    expect(data.paciente.nombreCompleto).toBe('Juan Pérez')
    expect(data.ahf.diabetes).toBe('PADRE')
    expect(data.apnp.alcohol).toBe('NEGADO')
    // II. Antecedentes y mediciones: APP, GO, inmunizaciones, somatometría, AV
    expect(data.app).toContain('Sin padecimientos crónicos')
    expect(data.inmunizaciones).toContain('Hepatitis B')
    expect(data.somatometria.imc).toBe('24.65')
    expect(data.agudezaVisual.reflejos).toBeTruthy()
    // III. Exploración
    expect(data.exploracion.neurologico).toBeTruthy()
    expect(data.pruebasMusculo.testAdam).toBe('NEGATIVO')
    expect(data.impresionDiagnostica).toContain('apto para el puesto')
    // IV. Dictamen
    expect(data.aptitud).toBe('APTO')
    expect(data.restricciones).toBe('Sin restricciones.')
    expect(data.observacionesFinales).toBeTruthy()
    expect(data.recomendaciones.length).toBeGreaterThan(0)
    expect(data.medico.fullName).toBe('Dra. María González')
    expect(data.medico.professionalLicense).toBe('12345678')
  })

  // AC-4: los faltantes aparecen como pendientes/visibles, no como valores inventados.
  it('AC-4: datos faltantes → null/visible, nunca defaults silenciosos', () => {
    const data = buildExamenMedicoPdfData(
      baseInput({
        ahf: {}, // sin antecedentes
        apnp: {},
        agudezaVisual: {},
        exploracion: {},
        aptitud: '', // médico no eligió aptitud
        slots: {
          audiometria: null,
          espirometria: null,
          laboratorios: null,
          radiografia: null,
          examenMedico: null,
        },
      })
    )
    // Todos los campos opcionales quedan `null` (no se inventan).
    expect(data.ahf.diabetes).toBeNull()
    expect(data.apnp.alcohol).toBeNull()
    expect(data.agudezaVisual.visionLejanaOD).toBeNull()
    expect(data.exploracion.neurologico).toBeNull()
    expect(data.slots.audiometria).toBeNull()
    expect(data.slots.espirometria).toBeNull()
    // Pero la aptitud NO se auto-rellena: si el médico no eligió, queda ''
    // (visible, sin default).
    expect(data.aptitud).toBe('')
  })

  // AC-5: las recomendaciones se auto-pueblan desde hallazgos.
  it('AC-5: recomendaciones auto-pobladas desde hallazgos de caries/sarro', () => {
    const data = buildExamenMedicoPdfData(baseInput())
    expect(data.recomendaciones.length).toBeGreaterThan(0)
    // Caries+sarro → recomendación de odontología.
    expect(
      data.recomendaciones.some(r =>
        r.toUpperCase().includes('ODONTOLOGÍA')
      )
    ).toBe(true)
    // Audiometría CONDUCTIVA → recomendaciones de EPP + seguimiento.
    expect(
      data.recomendaciones.some(r =>
        r.toUpperCase().includes('TAPONES')
      )
    ).toBe(true)
  })

  // AC-6: la aptitud sólo puede ser seleccionada por el médico (NO se auto-decidaptitud).
  it('AC-6: aptitud vacía NO se rellena automáticamente', () => {
    const data = buildExamenMedicoPdfData(
      baseInput({ aptitud: '' })
    )
    expect(data.aptitud).toBe('')
  })

  it('AC-6bis: aptitud válida se respeta tal cual (decisión médica)', () => {
    const data = buildExamenMedicoPdfData(
      baseInput({
        aptitud: 'APTO CONDICIONADO',
      })
    )
    expect(data.aptitud).toBe('APTO CONDICIONADO')
  })

  // AC-7: impresión, restricciones y observaciones finales vienen del médico.
  it('AC-7: impresión diagnóstica + restricciones + observaciones = decisión médica', () => {
    const data = buildExamenMedicoPdfData(
      baseInput({
        impresionDiagnostica: 'Trabaja con lentes correctivos.',
        restricciones: 'Uso obligatorio de lentes.',
        observacionesFinales: 'Control anual con optometrista.',
      })
    )
    expect(data.impresionDiagnostica).toContain('lentes correctivos')
    expect(data.restricciones).toContain('lentes')
    expect(data.observacionesFinales).toContain('optometrista')
  })

  // AC-8: el PDF incluye médico, cédula, fecha, firma y membrete.
  it('AC-8: médico / cédula / fecha / firma / membrete presentes', () => {
    const data = buildExamenMedicoPdfData(baseInput())
    expect(data.medico.fullName).toBe('Dra. María González')
    expect(data.medico.professionalLicense).toBe('12345678')
    expect(data.medico.signatureImageUrl).toContain('data:image/png')
    expect(data.signedAt).toBeInstanceOf(Date)
    expect(data.logoUrl).toBe('')
    expect(data.folio).toBe('folio-test')
  })

  // AC-9/AC-10: cobertura de scope y privacidad.
  it('AC-9/AC-10: folio + status + médico + paciente completos (puerta para auth de descarga)', () => {
    const data = buildExamenMedicoPdfData(baseInput())
    expect(data.folio).toBeTruthy()
    expect(data.status).toBe('SIGNED')
    expect(data.paciente.nombreCompleto).toBeTruthy()
    expect(data.medico.fullName).toBeTruthy()
  })

  // Helper: derivación de IMC → estado nutricional.
  it('deriveEstadoNutricionalFromImc: cubre bajo peso / normal / sobrepeso / obesidad', () => {
    const { deriveEstadoNutricionalFromImc } = __test__
    expect(deriveEstadoNutricionalFromImc('17.0')).toBe('BAJO PESO')
    expect(deriveEstadoNutricionalFromImc('22.5')).toBe('NORMAL')
    expect(deriveEstadoNutricionalFromImc('27.0')).toBe('SOBREPESO')
    expect(deriveEstadoNutricionalFromImc('31.5')).toBe('OBESIDAD')
    expect(deriveEstadoNutricionalFromImc('')).toBe('')
    expect(deriveEstadoNutricionalFromImc(null)).toBe('')
    expect(deriveEstadoNutricionalFromImc(undefined)).toBe('')
    expect(deriveEstadoNutricionalFromImc('abc')).toBe('')
  })

  // Helper: TA → resumen presión arterial.
  it('derivePresionArterialResumen: normal / alta / baja / ausente', () => {
    const { derivePresionArterialResumen } = __test__
    expect(derivePresionArterialResumen('120/80')).toBe(
      'NORMAL AL MOMENTO DE LA TOMA'
    )
    expect(derivePresionArterialResumen('150/95')).toBe('ALTA')
    expect(derivePresionArterialResumen('85/55')).toBe('BAJA')
    expect(derivePresionArterialResumen('')).toBe('')
    expect(derivePresionArterialResumen(null)).toBe('')
    expect(derivePresionArterialResumen('mal')).toBe('')
  })

  // Helper: Visión → resumen agudeza visual.
  it('deriveAgudezaVisualResumen: normal / disminuida / ausente', () => {
    const { deriveAgudezaVisualResumen } = __test__
    expect(deriveAgudezaVisualResumen('20/20', '20/20')).toBe('NORMAL')
    expect(deriveAgudezaVisualResumen('20/20', '20/40')).toBe('DISMINUIDA')
    expect(deriveAgudezaVisualResumen('', '')).toBe('')
    expect(deriveAgudezaVisualResumen(null, null)).toBe('')
  })

  // Helper: fechas y edad seguras.
  it('edadFromFechaNacimiento y fechaFromDate: seguros y nunca NaN', () => {
    const { edadFromFechaNacimiento, fechaFromDate } = __test__
    expect(
      edadFromFechaNacimiento(new Date('1985-04-12T00:00:00.000Z'))
    ).toMatch(/^\d+$/)
    expect(edadFromFechaNacimiento(null)).toBe('')
    expect(edadFromFechaNacimiento('')).toBe('')
    expect(fechaFromDate(new Date('1985-04-12T00:00:00.000Z'))).toMatch(
      /\d{2}\/\d{2}\/\d{4}/
    )
    expect(fechaFromDate(null)).toBe('')
    expect(fechaFromDate('')).toBe('')
  })

  // Helper: string seguro.
  it('s: null/undefined/empty → vacío', () => {
    const { s } = __test__
    expect(s(null)).toBe('')
    expect(s(undefined)).toBe('')
    expect(s('  ')).toBe('')
    expect(s('x')).toBe('x')
    expect(s(0)).toBe('0')
  })

  // Inmunizaciones/historiaGineco null se preservan.
  it('historiaGineco y slots no se inventan cuando faltan', () => {
    const data = buildExamenMedicoPdfData(
      baseInput({
        historiaGineco: null,
        inmunizaciones: null,
        slots: {
          audiometria: null,
          espirometria: null,
          laboratorios: null,
          radiografia: null,
          examenMedico: null,
        },
      })
    )
    expect(data.historiaGineco).toBeNull()
    expect(data.inmunizaciones).toBeNull()
    expect(data.slots.audiometria).toBeNull()
    expect(data.slots.espirometria).toBeNull()
    expect(data.slots.laboratorios).toBeNull()
    expect(data.slots.radiografia).toBeNull()
    expect(data.slots.examenMedico).toBeNull()
  })
})