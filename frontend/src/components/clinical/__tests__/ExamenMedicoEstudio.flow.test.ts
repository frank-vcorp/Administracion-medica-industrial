/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const mockSearchParams = {
  value: new URLSearchParams(''),
}

const mockUpdateSomatometria = vi.fn(async () => ({ success: true }))
const mockUpdateAgudezaVisual = vi.fn(async () => ({ success: true }))
const mockSaveExamenMedicoPapeleta = vi.fn(async () => ({
  success: true,
  studyStatus: 'RESULT_REGISTERED',
}))

vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams.value,
}))

vi.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'doc-1', role: 'DOCTOR_GENERAL', fullName: 'Dr. Prueba' } },
  }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children?: unknown; href: string }) =>
    createElement('a', { href, ...props }, children as never),
}))

vi.mock('@/actions/medical-exam.actions', () => ({
  saveExamenMedicoPapeleta: (...args: unknown[]) =>
    mockSaveExamenMedicoPapeleta(...(args as [])),
  updateSomatometria: (...args: unknown[]) =>
    mockUpdateSomatometria(...(args as [])),
  updateAgudezaVisual: (...args: unknown[]) =>
    mockUpdateAgudezaVisual(...(args as [])),
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

async function flushAsync() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('ExamenMedicoEstudio — desbloqueo, avance automático y diseño homogéneo', () => {
  beforeEach(() => {
    mockSearchParams.value = new URLSearchParams('')
    window.history.replaceState({}, '', '/events/evt-flow')
    mockUpdateSomatometria.mockClear()
    mockUpdateAgudezaVisual.mockClear()
    mockSaveExamenMedicoPapeleta.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('desbloquea Antecedentes, Exploración Física e Impresión clínica incluso con examData vacío', async () => {
    render(
      createElement(ExamenMedicoEstudio, {
        eventId: 'evt-flow',
        eventTestId: 'et-flow',
        examData: {},
        papeletaLayout: true,
      }),
    )
    await flushAsync()

    const antecedentesBtn = screen.getByRole('button', { name: /Antecedentes/i }) as HTMLButtonElement
    const exploracionBtn = screen.getByRole('button', { name: /Exploración Física/i }) as HTMLButtonElement
    const impresionBtn = screen.getByRole('button', { name: /Impresión clínica/i }) as HTMLButtonElement

    expect(antecedentesBtn.disabled).toBe(false)
    expect(exploracionBtn.disabled).toBe(false)
    expect(impresionBtn.disabled).toBe(false)

    fireEvent.click(exploracionBtn)
    expect(screen.getByText('Hallazgos por aparato y sistema')).toBeTruthy()
    expect((screen.getByTestId('exploracion-boca-estado') as HTMLSelectElement).disabled).toBe(false)

    fireEvent.click(impresionBtn)
    expect(screen.getByText('Resumen Clínico por Sistema')).toBeTruthy()
    expect(
      (screen.getByTestId('resumen-clinico-salud_bucal') as HTMLSelectElement).disabled,
    ).toBe(false)
  })

  it('avanza automáticamente Somatometría → Signos Vitales → Agudeza Visual → Antecedentes al guardar y continuar', async () => {
    render(
      createElement(ExamenMedicoEstudio, {
        eventId: 'evt-flow',
        eventTestId: 'et-flow',
        examData: {},
        papeletaLayout: true,
      }),
    )
    await flushAsync()

    expect(screen.getByText('Paso 1 de 6')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText('Ej: 75.5'), { target: { value: '75.5' } })
    fireEvent.change(screen.getByPlaceholderText('Ej: 1,75 o 175'), { target: { value: '1.75' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar → Signos Vitales' }))
    })
    await flushAsync()

    expect(mockUpdateSomatometria).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Paso 2 de 6')).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('120'), { target: { value: '120' } })
    fireEvent.change(screen.getByPlaceholderText('BPM'), { target: { value: '72' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar → Agudeza Visual' }))
    })
    await flushAsync()

    expect(mockUpdateSomatometria).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Paso 3 de 6')).toBeTruthy()

    const combos = screen.getAllByRole('combobox') as HTMLSelectElement[]
    fireEvent.change(combos[0], { target: { value: '20/20' } })
    fireEvent.change(combos[1], { target: { value: '20/20' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar y continuar → Antecedentes' }))
    })
    await flushAsync()

    expect(mockUpdateAgudezaVisual).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Paso 4 de 6')).toBeTruthy()
    expect(screen.getByText('Antecedentes — Captura por cita')).toBeTruthy()
  })

  it('mantiene claves disjuntas entre somaForm y vitalsForm al editar peso tras recarga', async () => {
    render(
      createElement(ExamenMedicoEstudio, {
        eventId: 'evt-flow',
        eventTestId: 'et-flow',
        examData: {
          somatometryData: {
            peso_kg: 70,
            talla_m: 1.7,
            ta_sistolica: 118,
            fc_min: 68,
          },
        },
        papeletaLayout: true,
      }),
    )
    await flushAsync()

    const pesoInput = screen.getByPlaceholderText('Ej: 75.5') as HTMLInputElement
    fireEvent.change(pesoInput, { target: { value: '82' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    })
    await flushAsync()

    expect(mockUpdateSomatometria).toHaveBeenCalledTimes(1)
    const sentPayload = (mockUpdateSomatometria.mock.calls[0] as unknown[])[1] as Record<
      string,
      unknown
    >
    expect(sentPayload.peso_kg).toBe('82')
    expect(sentPayload.ta_sistolica).toBe('118')
    expect(sentPayload.fc_min).toBe('68')
  })

  it('permite cambiar desde emSection=agudeza_visual a Exploración Física sin bloquear con errores de Antecedentes', async () => {
    mockSearchParams.value = new URLSearchParams('emSection=agudeza_visual')
    window.history.replaceState({}, '', '/events/evt-flow?emSection=agudeza_visual')

    render(
      createElement(ExamenMedicoEstudio, {
        eventId: 'evt-flow',
        eventTestId: 'et-flow',
        examData: {},
        papeletaLayout: true,
      }),
    )
    await flushAsync()

    expect(screen.getByText('Paso 3 de 6')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Exploración Física/i }))
    expect(screen.getByText('Paso 5 de 6')).toBeTruthy()
    expect(screen.queryByTestId('study-missing-fields-banner')).toBeNull()
  })

  it('muestra encabezado homogéneo Paso X de 6 en todas las secciones del flujo SME', async () => {
    render(
      createElement(ExamenMedicoEstudio, {
        eventId: 'evt-flow',
        eventTestId: 'et-flow',
        examData: {},
        papeletaLayout: true,
      }),
    )
    await flushAsync()

    expect(screen.getByText('Paso 1 de 6')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /Signos Vitales/i })[0])
    expect(screen.getByText('Paso 2 de 6')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /Agudeza Visual/i })[0])
    expect(screen.getByText('Paso 3 de 6')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /Antecedentes/i })[0])
    expect(screen.getByText('Paso 4 de 6')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /Exploración Física/i })[0])
    expect(screen.getByText('Paso 5 de 6')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /Impresión clínica/i })[0])
    expect(screen.getByText('Paso 6 de 6')).toBeTruthy()
  })
})
