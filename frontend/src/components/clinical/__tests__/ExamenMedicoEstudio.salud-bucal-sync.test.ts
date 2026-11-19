/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'

const mockSearchParams = {
  value: new URLSearchParams('emSection=exploracion'),
}

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams.value,
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'doc-1', role: 'DOCTOR', fullName: 'Dr. Prueba' } },
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children?: unknown; href: string }) =>
    createElement('a', { href, ...props }, children as never),
}))

vi.mock('@/actions/medical-exam.actions', () => ({
  saveExamenMedicoPapeleta: vi.fn(async () => ({ success: true, studyStatus: 'RESULT_REGISTERED' })),
  updateSomatometria: vi.fn(async () => ({ success: true })),
  updateAgudezaVisual: vi.fn(async () => ({ success: true })),
}))

vi.mock('@/actions/doctor-profile.actions', () => ({
  getCurrentDoctorProfile: vi.fn(async () => ({
    success: true,
    profile: { fullName: 'Dr. Prueba', professionalLicense: '123456' },
  })),
}))

vi.mock('@/actions/event-test.actions', () => ({
  updateEventTestStatus: vi.fn(async () => ({ success: true })),
}))

import ExamenMedicoEstudio from '@/components/clinical/ExamenMedicoEstudio'

function buildBaseExamData(
  physicalOverrides: Record<string, unknown> = {},
  somaOverrides: Record<string, unknown> = {},
  eyeOverrides: Record<string, unknown> = {},
) {
  return {
    somatometryData: {
      peso_kg: '70',
      talla_m: '1.75',
      ta_sistolica: '120',
      ta_diastolica: '80',
      fc_min: '72',
      ...somaOverrides,
    },
    eyeAcuityData: {
      vision_lejana_od: '20/40',
      vision_lejana_oi: '20/20',
      ...eyeOverrides,
    },
    physicalExamData: {
      modulo1: { m1_sexo: 'Masculino' },
      antecedentes_captured: {
        datos_personales: { puesto_actual: 'Operador' },
        historia_laboral: { riesgo_ergonomico: false },
        heredo_familiares: { diabetes: 'NEGADOS' },
        no_patologicos: { alcohol: { estado: 'NEGADO' } },
        patologicos: {
          diabetes: { estado: 'SI', detalle: { tratamiento: 'Metformina' } },
        },
      },
      ...physicalOverrides,
    },
  }
}

async function flushAsyncEffects() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('ExamenMedicoEstudio: sincronización Salud bucal → Resumen Clínico, Impresión diagnóstica y Recomendaciones', () => {
  beforeEach(() => {
    mockSearchParams.value = new URLSearchParams('emSection=exploracion')
    window.history.replaceState({}, '', '/events/evt-1?emSection=exploracion')
  })

  afterEach(() => {
    cleanup()
  })

  it('sincroniza Caries y sarro desde Exploración Física hacia Resumen Clínico, Impresión diagnóstica y Recomendaciones', async () => {
    render(
      createElement(ExamenMedicoEstudio, {
        eventId: 'evt-1',
        eventTestId: 'et-1',
        examData: buildBaseExamData({
          agudeza_visual_resumen: 'DISMINUIDA',
          estado_nutricional: 'NORMAL',
          presion_arterial_resumen: 'NORMAL AL MOMENTO DE LA TOMA',
        }),
      }),
    )
    await flushAsyncEffects()

    const bocaSelect = screen.getByTestId('exploracion-boca-estado') as HTMLSelectElement
    expect(bocaSelect.value).toBe('SIN DATOS')

    fireEvent.change(bocaSelect, { target: { value: 'CARIES Y SARRO' } })
    expect(bocaSelect.value).toBe('CARIES Y SARRO')

    fireEvent.click(screen.getByRole('button', { name: /Impresión clínica/i }))

    const resumenSaludBucal = screen.getByTestId(
      'resumen-clinico-salud_bucal',
    ) as HTMLSelectElement
    expect(resumenSaludBucal.value).toBe('CARIES Y SARRO')

    const resumenAgudeza = screen.getByTestId(
      'resumen-clinico-agudeza_visual_resumen',
    ) as HTMLSelectElement
    expect(resumenAgudeza.value).toBe('DISMINUIDA')

    const impresionTextarea = screen.getByPlaceholderText(
      /auto-completa al abrir esta pestaña/i,
    ) as HTMLTextAreaElement
    expect(impresionTextarea.value).toContain('Caries y sarro')
    expect(impresionTextarea.value).toContain('Disminución agudeza visual')
    expect(impresionTextarea.value).not.toContain('Insuficiencia venosa')

    const recsTextarea = screen.getByPlaceholderText(
      /Recomendación uno/i,
    ) as HTMLTextAreaElement
    expect(recsTextarea.value).toContain(
      'VALORACIÓN POR ODONTOLOGÍA PARA TRATAMIENTO DE CARIES Y SARRO',
    )
    expect(recsTextarea.value).toContain(
      'VALORACIÓN CON OPTOMETRISTA POR DISMINUCIÓN DE LA AGUDEZA VISUAL',
    )
    expect(recsTextarea.value).not.toContain('MEDIDAS DE HIGIENE VENOSA')
  })

  it('repara estado previo obsoleto (boca_estado CARIES Y SARRO con salud_bucal SIN DATOS) y Regenerar desde hallazgos incluye exploracion', async () => {
    mockSearchParams.value = new URLSearchParams('emSection=impresion')
    window.history.replaceState({}, '', '/events/evt-2?emSection=impresion')

    render(
      createElement(ExamenMedicoEstudio, {
        eventId: 'evt-2',
        eventTestId: 'et-2',
        examData: buildBaseExamData({
          boca_estado: 'CARIES Y SARRO',
          salud_bucal: 'SIN DATOS',
          circulacion_venosa: 'C2: VARICES',
          agudeza_visual_resumen: 'DISMINUIDA',
          estado_nutricional: 'NORMAL',
          presion_arterial_resumen: 'NORMAL AL MOMENTO DE LA TOMA',
          recomendaciones_clinicas:
            '1.- VALORACIÓN CON OPTOMETRISTA POR DISMINUCIÓN DE LA AGUDEZA VISUAL',
        }),
      }),
    )
    await flushAsyncEffects()

    const resumenSaludBucal = screen.getByTestId(
      'resumen-clinico-salud_bucal',
    ) as HTMLSelectElement
    expect(resumenSaludBucal.value).toBe('CARIES Y SARRO')

    const recsTextarea = screen.getByPlaceholderText(
      /Recomendación uno/i,
    ) as HTMLTextAreaElement
    expect(recsTextarea.value).toBe(
      '1.- VALORACIÓN CON OPTOMETRISTA POR DISMINUCIÓN DE LA AGUDEZA VISUAL',
    )

    fireEvent.click(
      screen.getByRole('button', { name: /Regenerar desde hallazgos/i }),
    )

    expect(recsTextarea.value).toContain(
      'VALORACIÓN POR ODONTOLOGÍA PARA TRATAMIENTO DE CARIES Y SARRO',
    )
    expect(recsTextarea.value).toContain(
      'VALORACIÓN CON OPTOMETRISTA POR DISMINUCIÓN DE LA AGUDEZA VISUAL',
    )
    expect(recsTextarea.value).toContain('MEDIDAS DE HIGIENE VENOSA')
  })

  it('respeta ediciones manuales del médico en Salud Bucal y Recomendaciones', async () => {
    mockSearchParams.value = new URLSearchParams('emSection=impresion')
    window.history.replaceState({}, '', '/events/evt-3?emSection=impresion')

    render(
      createElement(ExamenMedicoEstudio, {
        eventId: 'evt-3',
        eventTestId: 'et-3',
        examData: buildBaseExamData({
          boca_estado: 'CARIES Y SARRO',
          agudeza_visual_resumen: 'DISMINUIDA',
        }),
      }),
    )
    await flushAsyncEffects()

    const resumenSaludBucal = screen.getByTestId(
      'resumen-clinico-salud_bucal',
    ) as HTMLSelectElement
    expect(resumenSaludBucal.value).toBe('CARIES Y SARRO')

    fireEvent.change(resumenSaludBucal, { target: { value: 'CARIES' } })
    expect(resumenSaludBucal.value).toBe('CARIES')

    const recsTextarea = screen.getByPlaceholderText(
      /Recomendación uno/i,
    ) as HTMLTextAreaElement
    fireEvent.change(recsTextarea, {
      target: { value: '1.- NOTA MANUAL DEL MÉDICO' },
    })
    expect(recsTextarea.value).toBe('1.- NOTA MANUAL DEL MÉDICO')

    fireEvent.click(screen.getByRole('button', { name: /Exploración Física/i }))
    const bocaSelect = screen.getByTestId('exploracion-boca-estado') as HTMLSelectElement
    fireEvent.change(bocaSelect, { target: { value: 'SARRO' } })

    fireEvent.click(screen.getByRole('button', { name: /Impresión clínica/i }))
    expect(
      (screen.getByTestId('resumen-clinico-salud_bucal') as HTMLSelectElement).value,
    ).toBe('CARIES')
    expect(
      (screen.getByPlaceholderText(/Recomendación uno/i) as HTMLTextAreaElement).value,
    ).toBe('1.- NOTA MANUAL DEL MÉDICO')
  })

  it('deriva los 4 campos de Resumen Clínico desde Somatometría, Signos Vitales, Agudeza Visual y Exploración cuando vienen vacíos en physicalExamData', async () => {
    mockSearchParams.value = new URLSearchParams('emSection=impresion')
    window.history.replaceState({}, '', '/events/evt-4?emSection=impresion')

    render(
      createElement(ExamenMedicoEstudio, {
        eventId: 'evt-4',
        eventTestId: 'et-4',
        examData: buildBaseExamData(
          { boca_estado: 'CARIES' },
          { peso_kg: '88', talla_m: '1.75', ta_sistolica: '145', ta_diastolica: '92' },
          { vision_lejana_od: '20/40', vision_lejana_oi: '20/20' },
        ),
      }),
    )
    await flushAsyncEffects()

    expect(
      (screen.getByTestId('resumen-clinico-estado_nutricional') as HTMLSelectElement).value,
    ).toBe('SOBREPESO')
    expect(
      (screen.getByTestId('resumen-clinico-salud_bucal') as HTMLSelectElement).value,
    ).toBe('CARIES')
    expect(
      (screen.getByTestId('resumen-clinico-agudeza_visual_resumen') as HTMLSelectElement).value,
    ).toBe('DISMINUIDA')
    expect(
      (screen.getByTestId('resumen-clinico-presion_arterial_resumen') as HTMLSelectElement).value,
    ).toBe('ALTA')
  })
})
