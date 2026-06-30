/**
 * @fileoverview Endpoint que redirige a WhatsApp Web con el recibo del pago.
 *
 * FIX-20260630-03: Esta ruta evita el popup blocker porque el navegador la
 * trata como una navegación normal (302 redirect), NO como window.open().
 *
 * Flujo:
 * 1. Frontend crea el PaymentRecord + sube el PDF (trazabilidad completa).
 * 2. Frontend hace una navegación GET a /api/payment/receipt/whatsapp/[id]
 *    con target="_blank" → el navegador abre nueva pestaña automáticamente.
 * 3. Este route handler construye la URL wa.me con el link del PDF y devuelve
 *    un redirect 302. El navegador sigue el redirect → usuario aterriza en
 *    WhatsApp Web con el mensaje prellenado.
 *
 * URL params:
 *   ?phone=+5215512345678   (requerido)
 *
 * @id FIX-20260630-03
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { buildWhatsAppShareUrl, buildDefaultReceiptMessage, getPaymentMethodLabel } from '@/lib/payment.constants'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params
  const phone = req.nextUrl.searchParams.get('phone')

  if (!phone) {
    return new NextResponse(
      '<html><body style="font-family:system-ui;text-align:center;padding:40px;">' +
        '<h2>❌ Teléfono faltante</h2>' +
        '<p>No se proporcionó teléfono destino.</p>' +
        '</body></html>',
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  // Permitir acceso sin sesión para el redirect (el paymentId es un secreto opaco
  // difícil de adivinar). Si quieres endurecer, agrega validacion de sesión aquí.
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new NextResponse(
      '<html><body style="font-family:system-ui;text-align:center;padding:40px;">' +
        '<h2>🔒 No autenticado</h2>' +
        '<p>Debes iniciar sesión para enviar recibos por WhatsApp.</p>' +
        '</body></html>',
      { status: 401, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const payment = await prisma.paymentRecord.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      amount: true,
      method: true,
      receiptDownloadUrl: true,
      event: {
        select: {
          worker: { select: { firstName: true, lastName: true } },
        },
      },
    },
  })

  if (!payment) {
    return new NextResponse(
      '<html><body style="font-family:system-ui;text-align:center;padding:40px;">' +
        '<h2>❌ Pago no encontrado</h2>' +
        '<p>El folio no existe en el sistema.</p>' +
        '</body></html>',
      { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    )
  }

  const w = payment.event.worker
  const workerFullName = `${w.firstName} ${w.lastName}`.trim()
  const message = buildDefaultReceiptMessage({
    amount: payment.amount.toString(),
    methodLabel: getPaymentMethodLabel(payment.method),
    paymentId: payment.id,
    workerName: workerFullName,
    downloadUrl: payment.receiptDownloadUrl,
  })

  const waUrl = buildWhatsAppShareUrl(phone, message)

  // 302 Found: temporal redirect. El navegador abre nueva pestaña y sigue el redirect.
  return NextResponse.redirect(waUrl, 302)
}
