/**
 * @file Tests del componente AIProviderKeyManager.
 * @id IMPL-20260809-06 — ARCH-20260809-03
 * @spec context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md
 *
 * Cubre AC-13 (confirmación doble deshabilita Guardar) y CB-12 (ADMIN no
 * ve botones de editar/eliminar). Renderizamos con @testing-library/react
 * para aserciones sobre el DOM resultante.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('@/actions/ai-keys.actions', () => ({
  listAIProviderKeys: vi.fn(),
  updateAIProviderKey: vi.fn(),
  deleteAIProviderKey: vi.fn(),
}))

import AIProviderKeyManager from '../AIProviderKeyManager'
import {
  listAIProviderKeys,
  updateAIProviderKey,
  deleteAIProviderKey,
} from '@/actions/ai-keys.actions'

const SAMPLE = [
  { provider: 'gemini', present: false, keySuffix: null, baseUrl: null, defaultModel: null, enabled: false, updatedAt: null, updatedBy: null, source: 'env' as const },
  { provider: 'm3', present: true, keySuffix: 'abcd', baseUrl: 'https://api.m/v1', defaultModel: 'M3-X', enabled: true, updatedAt: '2026-08-09T18:00:00Z', updatedBy: 'u', source: 'db' as const },
  { provider: 'dr7', present: false, keySuffix: null, baseUrl: null, defaultModel: null, enabled: false, updatedAt: null, updatedBy: null, source: 'env' as const },
]

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AIProviderKeyManager', () => {
  it('renders 3 providers on success', async () => {
    ;(listAIProviderKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      providers: SAMPLE,
    })

    render(<AIProviderKeyManager canEdit={false} />)

    await waitFor(() => {
      expect(screen.getByText(/Gemini/i)).toBeInTheDocument()
      expect(screen.getByText(/M3/i)).toBeInTheDocument()
      expect(screen.getByText(/DR7|MedGemma/i)).toBeInTheDocument()
    })
  })

  it('ADMIN role does not see edit/delete buttons', async () => {
    ;(listAIProviderKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      providers: SAMPLE,
    })

    render(<AIProviderKeyManager canEdit={false} />)

    await waitFor(() => {
      expect(screen.queryByText(/Insertar/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Rotar/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Eliminar/i)).not.toBeInTheDocument()
    })
  })

  it('SUPERADMIN role sees Insertar/Rotar buttons for each provider', async () => {
    ;(listAIProviderKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      providers: SAMPLE,
    })

    render(<AIProviderKeyManager canEdit={true} />)

    await waitFor(() => {
      // 2 Insertar (gemini, dr7) + 1 Rotar (m3) = 3 botones primarios
      expect(screen.getAllByRole('button', { name: /Insertar|Rotar/i }).length).toBe(3)
      // Sólo 1 Eliminar (m3 tiene present=true)
      expect(screen.getAllByRole('button', { name: /Eliminar/i }).length).toBe(1)
    })
  })

  it('Edit modal disables Guardar when confirmation differs (AC-13)', async () => {
    ;(listAIProviderKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      providers: SAMPLE,
    })
    ;(updateAIProviderKey as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      result: { provider: 'm3', present: true, keySuffix: 'abcd', baseUrl: null, defaultModel: null, enabled: true, updatedAt: 'now', source: 'db' },
    })

    render(<AIProviderKeyManager canEdit={true} />)

    await waitFor(() => screen.getByRole('button', { name: /Rotar/i }))

    // Click Rotar (m3)
    fireEvent.click(screen.getByRole('button', { name: /Rotar/i }))

    // Aparece modal
    const inputs = await screen.findAllByDisplayValue('')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
    const apiKeyInput = inputs[0]
    const apiKeyConfirmInput = inputs[1]

    // Keys distintas → Guardar deshabilitado
    fireEvent.change(apiKeyInput, { target: { value: 'sk-original-9999' } })
    fireEvent.change(apiKeyConfirmInput, { target: { value: 'sk-OTRA-9999' } })

    const guardarBtn = screen.getByRole('button', { name: /Guardar/i })
    expect(guardarBtn).toBeDisabled()

    // Ahora coinciden → Guardar habilitado
    fireEvent.change(apiKeyConfirmInput, { target: { value: 'sk-original-9999' } })
    expect(guardarBtn).not.toBeDisabled()

    // Click Guardar llama updateAIProviderKey
    fireEvent.click(guardarBtn)

    await waitFor(() => {
      expect(updateAIProviderKey).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'm3',
          apiKey: 'sk-original-9999',
        })
      )
    })
  })

  it('Delete modal requires checkbox acceptance', async () => {
    ;(listAIProviderKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      providers: SAMPLE,
    })
    ;(deleteAIProviderKey as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      result: { provider: 'm3', present: false, source: 'env' },
    })

    render(<AIProviderKeyManager canEdit={true} />)

    await waitFor(() => screen.getByRole('button', { name: /Eliminar/i }))
    fireEvent.click(screen.getByRole('button', { name: /Eliminar/i }))

    const eliminarBtn = await screen.findByRole('button', { name: /^Eliminar/i })
    expect(eliminarBtn).toBeDisabled()

    // Marcar checkbox
    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)
    expect(eliminarBtn).not.toBeDisabled()

    fireEvent.click(eliminarBtn)
    await waitFor(() => {
      expect(deleteAIProviderKey).toHaveBeenCalledWith('m3')
    })
  })

  it('renders error message on list failure', async () => {
    ;(listAIProviderKeys as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      error: 'Backend caído',
    })

    render(<AIProviderKeyManager canEdit={false} />)

    await waitFor(() => {
      expect(screen.getByText(/Backend caído/)).toBeInTheDocument()
    })
  })
})