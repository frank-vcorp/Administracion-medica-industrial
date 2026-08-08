'use client'

/**
 * @file WorkerIdentityCard — Card "Identificación" de la ficha del paciente.
 * Muestra la última identificación registrada (tipo + fecha + miniatura
 * ampliable) o "Sin identificación registrada" cuando no hay evidencia.
 * @id IMPL-20260808-04
 * @spec context/SPECs/SPEC_IMPL-20260808-04-LAST-IDENTITY-UI.md
 *
 * Componente cliente (necesita useState para el lightbox). Recibe los 4
 * campos de identidad como props desde la server-component que carga la
 * ficha (`workers/[id]/page.tsx` → `getWorkerById`).
 */
import { useState } from 'react'
import IdentityLightbox from '@/components/IdentityLightbox'

interface Props {
  firstName: string
  lastName: string
  lastIdentityDocumentType: string | null
  lastIdentityFrontFileUrl: string | null
  lastIdentityBackFileUrl: string | null
  lastIdentityVerifiedAt: string | Date | null
}

const DOC_TYPE_LABELS: Record<string, string> = {
  INE: 'INE',
  PASAPORTE: 'Pasaporte',
  LICENCIA: 'Licencia de conducir',
  OTRA_IDENTIFICACION_OFICIAL: 'Otra identificación oficial',
}

export default function WorkerIdentityCard({
  firstName,
  lastName,
  lastIdentityDocumentType,
  lastIdentityFrontFileUrl,
  lastIdentityBackFileUrl,
  lastIdentityVerifiedAt,
}: Props) {
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const hasEvidence = !!lastIdentityFrontFileUrl
  const fullName = `${firstName} ${lastName}`

  const verifiedAtDate = lastIdentityVerifiedAt
    ? typeof lastIdentityVerifiedAt === 'string'
      ? new Date(lastIdentityVerifiedAt)
      : lastIdentityVerifiedAt
    : null

  const docTypeLabel = lastIdentityDocumentType
    ? DOC_TYPE_LABELS[lastIdentityDocumentType] ?? lastIdentityDocumentType
    : null

  return (
    <>
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900">Identificación</h3>
          {hasEvidence && (
            <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-full font-bold uppercase tracking-widest">
              Registrada
            </span>
          )}
        </div>

        {hasEvidence ? (
          <div className="space-y-4">
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Tipo</p>
                <p className="text-sm text-slate-900 font-medium mt-0.5">{docTypeLabel ?? '—'}</p>
              </div>
              {verifiedAtDate && (
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">Verificada</p>
                  <p className="text-sm text-slate-900 font-medium mt-0.5">
                    {verifiedAtDate.toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Frente
              </p>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="block group w-full"
                aria-label={`Ver identificación de ${fullName} en tamaño completo`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- data URL base64 (no external); next/Image requiere hosts declarados. */}
                <img
                  src={lastIdentityFrontFileUrl!}
                  alt={`Identificación (frente) de ${fullName}`}
                  className="w-full h-32 object-cover rounded-lg border border-slate-200 group-hover:border-blue-400 transition-colors cursor-zoom-in"
                />
              </button>
            </div>

            {lastIdentityBackFileUrl && (
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                  Reverso
                </p>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(true)}
                  className="block group w-full"
                  aria-label={`Ver reverso de identificación de ${fullName}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- data URL base64 (no external); next/Image requiere hosts declarados. */}
                  <img
                    src={lastIdentityBackFileUrl}
                    alt={`Identificación (reverso) de ${fullName}`}
                    className="w-full h-32 object-cover rounded-lg border border-slate-200 group-hover:border-blue-400 transition-colors cursor-zoom-in"
                  />
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <p className="text-2xl mb-2">🪪</p>
            <p className="text-sm font-semibold text-slate-600">
              Sin identificación registrada
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Se capturará en la primera cita con corroboración de identidad.
            </p>
          </div>
        )}
      </div>

      <IdentityLightbox
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        src={lastIdentityFrontFileUrl}
        backSrc={lastIdentityBackFileUrl ?? null}
        alt={`Identificación (frente) de ${fullName}`}
        backAlt={`Identificación (reverso) de ${fullName}`}
        title={`Identificación de ${fullName}`}
        subtitle={docTypeLabel ?? null}
      />
    </>
  )
}
