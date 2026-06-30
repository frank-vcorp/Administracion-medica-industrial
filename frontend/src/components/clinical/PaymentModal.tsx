'use client'
/**
 * Modal de Pago y Recibo de la Papeleta.
 * Patrón visual inspirado en CorroborationModal.tsx: header ámbar, max-w-xl,
 * z-50, animación fade-in.
 *
 * @id IMPL-20260630-01
 * @spec context/SPECs/SPEC_ARCH-20260630-01-MODAL-PAGO-RECIBO-PAPELETA.md
 */

import { useState, useTransition, useMemo, useCallback } from 'react'
import { pdf } from '@react-pdf/renderer'
import { PaymentReceiptPDF, type ReceiptPDFData } from '@/components/pdf/PaymentReceiptPDF'
import {
  createPaymentRecord,
} from '@/actions/payment.actions'
import {
  getPaymentMethodLabel,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '@/lib/payment.constants'

// ── Props ────────────────────────────────────────────────────────────────────
interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  /** Callback cuando el pago se persiste correctamente. */
  onSuccess?: (info: { paymentId: string; receiptSent: boolean }) => void
  eventId: string
  workerId: string
  workerName: string
  universalId?: string | null
  companyName: string
  branchName?: string | null
  receivedBy: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

function parseAmount(input: string): number {
  if (!input) return NaN
  // Aceptar coma decimal europea
  const normalized = input.replace(',', '.').replace(/[^0-9.]/g, '')
  return Number(normalized)
}

// ── Componente ───────────────────────────────────────────────────────────────
export default function PaymentModal({
  isOpen,
  onClose,
  onSuccess,
  eventId,
  workerId,
  workerName,
  universalId,
  companyName,
  branchName,
  receivedBy,
}: PaymentModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [method, setMethod] = useState<PaymentMethod>('EFECTIVO')
  const [amountStr, setAmountStr] = useState('')
  const [reference, setReference] = useState('')
  const [sendReceipt, setSendReceipt] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')

  const amount = useMemo(() => parseAmount(amountStr), [amountStr])
  const amountValid = Number.isFinite(amount) && amount > 0

  const emailValid = useMemo(() => {
    if (!sendReceipt) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())
  }, [sendReceipt, recipientEmail])

  const canSubmit = amountValid && emailValid && !isPending

  const reset = useCallback(() => {
    setMethod('EFECTIVO')
    setAmountStr('')
    setReference('')
    setSendReceipt(false)
    setRecipientEmail('')
    setError(null)
  }, [])

  const handleClose = useCallback(() => {
    if (isPending) return
    reset()
    onClose()
  }, [isPending, reset, onClose])

  const generatePdfDataUrl = useCallback(async (): Promise<string | undefined> => {
    try {
      const payload: ReceiptPDFData = {
        paymentId: `PENDIENTE-${Date.now()}`,
        eventId,
        createdAt: new Date(),
        amount,
        method: getPaymentMethodLabel(method),
        reference: reference.trim() || null,
        worker: { firstName: workerName.split(' ')[0] ?? '', lastName: workerName.split(' ').slice(1).join(' ') || '·', universalId },
        company: companyName ? { name: companyName } : null,
        branch: branchName ? { name: branchName } : null,
        receivedBy,
      }
      const blob = await pdf(<PaymentReceiptPDF data={payload} />).toBlob()
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    } catch (err) {
      console.warn('[PaymentModal] No se pudo generar el PDF, continuando sin adjunto.', err)
      return undefined
    }
  }, [amount, method, reference, eventId, workerName, universalId, companyName, branchName, receivedBy])

  const handleSubmit = useCallback(() => {
    setError(null)
    if (!amountValid) {
      setError('El monto debe ser mayor a 0.')
      return
    }
    if (sendReceipt && !emailValid) {
      setError('Ingresa un email válido para enviar el recibo.')
      return
    }

    startTransition(async () => {
      // Generar PDF solo si vamos a enviar recibo
      const pdfDataUrl = sendReceipt ? await generatePdfDataUrl() : undefined

      const result = await createPaymentRecord({
        eventId,
        workerId,
        amount,
        method,
        reference: reference.trim() || null,
        sendReceiptTo: sendReceipt ? recipientEmail.trim() : undefined,
        pdfDataUrl,
      })

      if (result.success) {
        onSuccess?.({
          paymentId: result.paymentId ?? '',
          receiptSent: !!result.receiptSent,
        })
        reset()
        onClose()
      } else {
        setError(result.error ?? 'Error al registrar el pago.')
      }
    })
  }, [
    amountValid,
    amount,
    emailValid,
    sendReceipt,
    recipientEmail,
    generatePdfDataUrl,
    eventId,
    workerId,
    method,
    reference,
    onSuccess,
    reset,
    onClose,
  ])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="bg-amber-500 px-8 py-6 text-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-3xl">💳</span>
            <div>
              <h2 className="text-lg font-black">Pago y Recibo</h2>
              <p className="text-amber-100 text-xs font-medium">
                Registra el pago de la papeleta y emite un comprobante · ARCH-20260630-01
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-8 space-y-6">
          {/* Datos del evento */}
          <section className="bg-slate-50 rounded-2xl p-5 space-y-3 border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              Papeleta
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Trabajador
                </p>
                <p className="text-sm font-medium text-slate-700">
                  {workerName || '—'}
                </p>
              </div>
              {universalId && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    ID
                  </p>
                  <p className="text-xs font-mono text-slate-500">
                    {universalId}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">
                  Empresa
                </p>
                <p className="text-sm font-medium text-slate-700">
                  {companyName || '—'}
                </p>
              </div>
              {branchName && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Sucursal
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    {branchName}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Método de pago */}
          <section className="space-y-3">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              Método de pago
            </p>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              disabled={isPending}
              className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none disabled:opacity-60"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {getPaymentMethodLabel(m)}
                </option>
              ))}
            </select>
          </section>

          {/* Monto */}
          <section className="space-y-3">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              Monto
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                $
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="0.00"
                disabled={isPending}
                className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 pl-8 rounded-xl text-lg font-bold outline-none disabled:opacity-60"
              />
            </div>
            {amountStr && !amountValid && (
              <p className="text-[10px] text-red-600 font-medium">
                Ingresa un monto válido mayor a 0.
              </p>
            )}
            {amountValid && (
              <p className="text-[10px] text-emerald-600 font-medium">
                Monto a registrar: ${formatCurrency(amount)} MXN
              </p>
            )}
          </section>

          {/* Referencia / Nota */}
          <section className="space-y-3">
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">
              Referencia / Nota <span className="text-slate-400 font-normal">(opcional)</span>
            </p>
            <textarea
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={isPending}
              placeholder="Folio de transferencia, número de cheque, autorización, etc."
              className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none resize-none disabled:opacity-60"
            />
          </section>

          {/* Enviar recibo por email */}
          <section className="space-y-3 border-t border-slate-100 pt-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sendReceipt}
                onChange={(e) => setSendReceipt(e.target.checked)}
                disabled={isPending}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-xs font-bold text-slate-700">
                📧 Enviar recibo por email
              </span>
            </label>
            {sendReceipt && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 block">
                  Email destino <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  disabled={isPending}
                  placeholder="cliente@empresa.com"
                  className="w-full bg-slate-50 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-400 border-none p-3 rounded-xl text-sm outline-none disabled:opacity-60"
                />
                {recipientEmail && !emailValid && (
                  <p className="text-[10px] text-red-600 font-medium">
                    Email inválido.
                  </p>
                )}
                <p className="text-[10px] text-slate-400">
                  Se adjuntará un PDF del recibo generado al momento del pago.
                </p>
              </div>
            )}
          </section>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 font-medium">
              ⚠️ {error}
            </p>
          )}
        </div>

        {/* Acciones */}
        <div className="flex gap-3 p-6 border-t border-slate-100 flex-shrink-0">
          <button
            onClick={handleClose}
            disabled={isPending}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl font-bold text-sm transition-all disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white py-3 px-6 rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? '⏳ Procesando...'
              : sendReceipt
                ? '🧾 Registrar y Enviar Recibo'
                : '💾 Registrar Pago'}
          </button>
        </div>
      </div>
    </div>
  )
}