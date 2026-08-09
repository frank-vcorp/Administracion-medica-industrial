/**
 * @file Componente client para gestión de AI Provider Keys.
 * @id IMPL-20260809-06 — ARCH-20260809-03
 * @spec context/SPECs/SPEC_ARCH-20260809-03-MANAGE-AI-API-KEYS.md
 *
 * Tarjeta por proveedor con:
 *  - Estado actual (present, keySuffix mascareado, source, baseUrl, defaultModel, updatedAt).
 *  - Botón "Editar" (solo SUPERADMIN) abre modal con confirmación doble de la key.
 *  - Botón "Eliminar" (solo SUPERADMIN) con confirmación modal.
 *
 * Política de privacidad: NUNCA se loguea la key completa en consola; el backend
 * ya NUNCA la expone (sólo `keySuffix` = últimos 4 chars).
 */
'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  AI_PROVIDER_LABELS,
  type AIProvider,
  type AIKeyPublic,
} from '@/types/ai-keys'
import {
  listAIProviderKeys,
  updateAIProviderKey,
  deleteAIProviderKey,
} from '@/actions/ai-keys.actions'

// IMPL-20260809-09: Modelos sugeridos por provider para el selector de extracción.
// El usuario puede elegir un modelo predefinido o escribir uno custom
// (campo "Otro" revela un input de texto libre).
const PROVIDER_MODELS: Record<AIProvider, { id: string; label: string; description?: string }[]> = {
  gemini: [
    { id: 'gemini-flash-latest', label: 'Gemini Flash (latest)', description: 'Última versión estable de Flash (recomendado para nuevas keys)' },
    { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Disponible solo para keys antiguos' },
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Mayor calidad, más lento y caro' },
    { id: 'gemini-flash-lite-latest', label: 'Gemini Flash-Lite (latest)', description: 'Más barato y rápido' },
  ],
  m3: [
    { id: 'MiniMax-M3', label: 'MiniMax-M3', description: 'Modelo frontier multimodal (1M context)' },
    { id: 'MiniMax-M2.7', label: 'MiniMax-M2.7', description: 'Recursive self-improvement' },
    { id: 'MiniMax-M2.7-highspeed', label: 'MiniMax-M2.7 Highspeed', description: 'Más rápido (~100 tps)' },
    { id: 'MiniMax-M2.5', label: 'MiniMax-M2.5' },
    { id: 'MiniMax-M2.5-highspeed', label: 'MiniMax-M2.5 Highspeed' },
  ],
  dr7: [
    { id: 'medgemma-27b-it', label: 'MedGemma 27B IT', description: 'Modelo clínico grande (recomendado)' },
    { id: 'medgemma-4b-it', label: 'MedGemma 4B IT', description: 'Más rápido y barato' },
  ],
}

const CUSTOM_VALUE = '__custom__'

interface AIProviderKeyManagerProps {
  canEdit: boolean
}

export default function AIProviderKeyManager({ canEdit }: AIProviderKeyManagerProps) {
  const [providers, setProviders] = useState<AIKeyPublic[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null)
  const [deletingProvider, setDeletingProvider] = useState<AIProvider | null>(null)

  const reload = useCallback(async () => {
    setError(null)
    const result = await listAIProviderKeys()
    if (!result.ok || !result.providers) {
      setError(result.error ?? 'Error desconocido al cargar el listado')
      setProviders([])
      return
    }
    setProviders(result.providers)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-900">
          {error}
        </div>
      )}

      {providers === null ? (
        <p className="text-sm text-gray-500">Cargando…</p>
      ) : (
        providers.map((p) => (
          <ProviderCard
            key={p.provider}
            info={p}
            canEdit={canEdit}
            onEdit={() => setEditingProvider(p.provider)}
            onDelete={() => setDeletingProvider(p.provider)}
          />
        ))
      )}

      {editingProvider && (
        <EditModal
          provider={editingProvider}
          current={providers?.find((x) => x.provider === editingProvider) ?? null}
          onClose={() => setEditingProvider(null)}
          onSaved={() => {
            setEditingProvider(null)
            void reload()
          }}
        />
      )}

      {deletingProvider && (
        <DeleteConfirmModal
          provider={deletingProvider}
          onClose={() => setDeletingProvider(null)}
          onDeleted={() => {
            setDeletingProvider(null)
            void reload()
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ProviderCard
// ---------------------------------------------------------------------------
function ProviderCard(props: {
  info: AIKeyPublic
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const { info, canEdit, onEdit, onDelete } = props
  const masked = info.keySuffix
    ? `••••••••${info.keySuffix}`
    : '(sin clave en BD)'
  const sourceLabel = info.source === 'db' ? 'BD' : 'env var'

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="font-semibold text-base">
            {AI_PROVIDER_LABELS[info.provider]}{' '}
            <span className="text-xs text-gray-500 font-mono">({info.provider})</span>
          </h2>

          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-gray-500">Estado</dt>
            <dd>
              {info.present ? (
                <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-800">
                  presente
                </span>
              ) : (
                <span className="inline-block px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700">
                  ausente
                </span>
              )}
            </dd>

            <dt className="text-gray-500">Key</dt>
            <dd className="font-mono">{masked}</dd>

            <dt className="text-gray-500">Fuente activa</dt>
            <dd>
              <span
                className={
                  info.source === 'db'
                    ? 'inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800'
                    : 'inline-block px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-700'
                }
              >
                {sourceLabel}
              </span>
            </dd>

            <dt className="text-gray-500">Base URL</dt>
            <dd className="font-mono text-xs break-all">
              {info.baseUrl ?? '—'}
            </dd>

            <dt className="text-gray-500">Modelo default</dt>
            <dd className="font-mono text-xs">{info.defaultModel ?? '—'}</dd>

            <dt className="text-gray-500">Última actualización</dt>
            <dd className="text-xs">
              {info.updatedAt
                ? new Date(info.updatedAt).toLocaleString()
                : '—'}
            </dd>
          </dl>
        </div>

        {canEdit && (
          <div className="flex flex-col gap-2 min-w-[120px]">
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
              onClick={onEdit}
            >
              {info.present ? 'Rotar' : 'Insertar'}
            </button>
            {info.present && (
              <button
                type="button"
                className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700"
                onClick={onDelete}
              >
                Eliminar
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EditModal — con confirmación doble de la key
// ---------------------------------------------------------------------------
function EditModal(props: {
  provider: AIProvider
  current: AIKeyPublic | null
  onClose: () => void
  onSaved: () => void
}) {
  const { provider, current, onClose, onSaved } = props
  const [apiKey, setApiKey] = useState('')
  const [apiKeyConfirm, setApiKeyConfirm] = useState('')
  const [baseUrl, setBaseUrl] = useState<string>(current?.baseUrl ?? '')
  const [defaultModel, setDefaultModel] = useState<string>(current?.defaultModel ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const keysMatch = apiKey.length > 0 && apiKey === apiKeyConfirm

  // IMPL-20260809-09: Determinar si el defaultModel actual es uno predefinido
  // o un valor custom. Si es custom, mostrar el campo "Otro" por defecto.
  const providerModels = useMemo(() => PROVIDER_MODELS[provider] ?? [], [provider])
  const isCustomModel = defaultModel.length > 0 && !providerModels.some(m => m.id === defaultModel)
  const modelSelectValue = isCustomModel ? CUSTOM_VALUE : (defaultModel || providerModels[0]?.id || '')

  const [useCustomModel, setUseCustomModel] = useState<boolean>(isCustomModel)

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    const result = await updateAIProviderKey({
      provider,
      apiKey,
      baseUrl: baseUrl.trim() || null,
      defaultModel: defaultModel.trim() || null,
      expectedUpdatedAt: current?.updatedAt ?? null,
    })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? 'Error desconocido')
      return
    }
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
        <h3 className="text-lg font-semibold mb-1">
          {current?.present ? 'Rotar' : 'Insertar'} clave — {AI_PROVIDER_LABELS[provider]}
        </h3>
        <p className="text-xs text-gray-500 mb-4 font-mono">({provider})</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              API Key <span className="text-red-600">*</span>
            </label>
            <input
              type="password"
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-... o equivalente del proveedor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirmar API Key <span className="text-red-600">*</span>
              {!keysMatch && apiKeyConfirm.length > 0 && (
                <span className="ml-2 text-xs text-red-600 font-normal">
                  (no coincide)
                </span>
              )}
            </label>
            <input
              type="password"
              autoComplete="off"
              className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-sm"
              value={apiKeyConfirm}
              onChange={(e) => setApiKeyConfirm(e.target.value)}
              placeholder="pega de nuevo para confirmar"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Base URL (opcional)
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://api.example.com/v1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Modelo default para extracción
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs bg-white"
              value={useCustomModel ? CUSTOM_VALUE : modelSelectValue}
              onChange={(e) => {
                const v = e.target.value
                if (v === CUSTOM_VALUE) {
                  setUseCustomModel(true)
                  setDefaultModel('')
                } else {
                  setUseCustomModel(false)
                  setDefaultModel(v)
                }
              }}
            >
              {providerModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}{m.description ? ` — ${m.description}` : ''}
                </option>
              ))}
              <option value={CUSTOM_VALUE}>Otro (escribir modelo custom)…</option>
            </select>
            {useCustomModel && (
              <input
                type="text"
                className="w-full mt-2 px-3 py-2 border border-gray-300 rounded font-mono text-xs"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="nombre-exacto-del-modelo"
                autoFocus
              />
            )}
            <p className="mt-1 text-xs text-gray-500">
              Modelo que usará la capa de extracción cuando este provider esté activo.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={submit}
            disabled={!keysMatch || submitting}
          >
            {submitting ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DeleteConfirmModal — con checkbox de aceptación
// ---------------------------------------------------------------------------
function DeleteConfirmModal(props: {
  provider: AIProvider
  onClose: () => void
  onDeleted: () => void
}) {
  const { provider, onClose, onDeleted } = props
  const [accept, setAccept] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setSubmitting(true)
    const result = await deleteAIProviderKey(provider)
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error ?? 'Error desconocido')
      return
    }
    onDeleted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold mb-2 text-red-700">
          Eliminar clave — {AI_PROVIDER_LABELS[provider]}
        </h3>
        <p className="text-sm text-gray-700 mb-3">
          La fila cifrada se borrará de la base de datos. La siguiente corrida
          caerá a la variable de entorno (<code>env</code>) — no se elimina la env var.
        </p>
        <p className="text-sm text-gray-700 mb-3">
          Para confirmar, marca el checkbox:
        </p>

        <label className="flex items-start gap-2 mb-4 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={accept}
            onChange={(e) => setAccept(e.target.checked)}
          />
          <span>
            Confirmo que quiero eliminar la clave de
            <strong className="font-mono mx-1">{provider}</strong>
            persistida en la BD.
          </span>
        </label>

        {error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={submit}
            disabled={!accept || submitting}
          >
            {submitting ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  )
}