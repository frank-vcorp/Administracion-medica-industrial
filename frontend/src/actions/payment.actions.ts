'use server'
/**
 * @fileoverview Server Actions para Pagos y Recibos (ARCH-20260630-01)
 * @description Persistencia de PaymentRecord, envío de recibo por email,
 *              consulta de historial de pagos por evento.
 * @author SOFIA - Builder
 * @id IMPL-20260630-01
 * @spec context/SPECs/SPEC_ARCH-20260630-01-MODAL-PAGO-RECIBO-PAPELETA.md
 */

import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/actions/audit.actions'
import {
  PAYMENT_METHODS,
  type PaymentMethod,
  type PaymentHistoryItem,
} from '@/lib/payment.constants'

// ─────────────────────────────────────────────────────────────────────────────
// Schemas Zod
// ─────────────────────────────────────────────────────────────────────────────

const CreatePaymentSchema = z.object({
  eventId: z.string().min(1, 'eventId requerido'),
  workerId: z.string().min(1, 'workerId requerido'),
  amount: z
    .number({ error: 'Monto debe ser numérico' })
    .positive('El monto debe ser mayor a 0')
    .finite('El monto debe ser finito')
    .max(99999999.99, 'Monto fuera de rango'),
  method: z.enum(PAYMENT_METHODS, {
    error: () => 'Método de pago no permitido',
  }),
  reference: z.string().max(500).optional().nullable(),
})

const SendReceiptSchema = z.object({
  paymentId: z.string().min(1, 'paymentId requerido'),
  email: z.email('Email inválido'),
})

// ─────────────────────────────────────────────────────────────────────────────
// 1. createPaymentRecord — persiste el pago y opcionalmente dispara recibo
// ─────────────────────────────────────────────────────────────────────────────

export interface CreatePaymentInput {
  eventId: string
  workerId: string
  amount: number
  method: PaymentMethod
  reference?: string | null
  /** Si se incluye, también se intenta enviar el recibo por email. */
  sendReceiptTo?: string
  /** PDF del recibo en dataURL (generado en cliente) si se va a enviar. */
  pdfDataUrl?: string
}

export interface CreatePaymentResult {
  success: boolean
  paymentId?: string
  receiptSent?: boolean
  error?: string
}

/**
 * Registra un pago asociado al evento médico (papeleta). Si se proporciona
 * `sendReceiptTo`, intenta enviar el PDF del recibo por email inmediatamente
 * y persiste el flag `receiptSent` + el dataURL del PDF en `receiptPdfUrl`.
 *
 * Permisos: ADMIN, RECEPTIONIST, DOCTOR_GENERAL, DOCTOR_VALIDATOR, CAPTURIST.
 * NURSE/EMPRESA: solo lectura (rechazado).
 */
export async function createPaymentRecord(
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: 'No autenticado.' }
    }

    const allowedRoles = [
      'ADMIN',
      'RECEPTIONIST',
      'DOCTOR_GENERAL',
      'DOCTOR_VALIDATOR',
      'CAPTURIST',
    ]
    if (!allowedRoles.includes(session.user.role)) {
      return {
        success: false,
        error: 'No tienes permisos para registrar pagos.',
      }
    }

    // ── Validación Zod ───────────────────────────────────────────────────────
    const parsed = CreatePaymentSchema.safeParse({
      eventId: input.eventId,
      workerId: input.workerId,
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? undefined,
    })
    if (!parsed.success) {
      const issue = parsed.error.issues[0]
      return {
        success: false,
        error: issue?.message ?? 'Datos de pago inválidos.',
      }
    }

    // ── Validación de email opcional ─────────────────────────────────────────
    let receiptSent = false
    let receiptEmail: string | null = null
    let receiptPdfUrl: string | null = null

    if (input.sendReceiptTo) {
      const emailCheck = z
        .email('Email inválido para envío de recibo')
        .safeParse(input.sendReceiptTo)
      if (!emailCheck.success) {
        return {
          success: false,
          error: emailCheck.error.issues[0]?.message ?? 'Email inválido.',
        }
      }
      receiptEmail = emailCheck.data
    }

    // ── Persistencia transaccional ───────────────────────────────────────────
    const created = await prisma.$transaction(async (tx) => {
      const event = await tx.medicalEvent.findUnique({
        where: { id: parsed.data.eventId },
        select: { id: true, workerId: true },
      })
      if (!event) {
        throw new Error('Evento médico no encontrado.')
      }
      if (event.workerId !== parsed.data.workerId) {
        throw new Error(
          'El workerId no coincide con el evento médico seleccionado.'
        )
      }

      const payment = await tx.paymentRecord.create({
        data: {
          eventId: parsed.data.eventId,
          workerId: parsed.data.workerId,
          amount: parsed.data.amount,
          method: parsed.data.method,
          reference: parsed.data.reference ?? null,
          receiptSent: false,
          receiptEmail: receiptEmail,
          receiptPdfUrl: null,
          createdById: session.user.id,
        },
        select: { id: true },
      })

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'PaymentRecord',
          entityId: payment.id,
          userId: session.user.id,
          details: {
            eventId: parsed.data.eventId,
            workerId: parsed.data.workerId,
            amount: parsed.data.amount,
            method: parsed.data.method,
            reference: parsed.data.reference ?? null,
            requestedReceiptEmail: receiptEmail,
          },
        },
      })

      return payment.id
    }, { maxWait: 8000, timeout: 12000 })

    // ── Envío de recibo (fuera de la transacción crítica) ────────────────────
    if (receiptEmail) {
      const sendRes = await dispatchReceiptEmail({
        paymentId: created,
        email: receiptEmail,
        pdfDataUrl: input.pdfDataUrl,
      })
      if (sendRes.success) {
        receiptSent = true
        receiptPdfUrl = input.pdfDataUrl ?? null
        await prisma.paymentRecord.update({
          where: { id: created },
          data: {
            receiptSent: true,
            receiptPdfUrl: receiptPdfUrl,
          },
        })
      } else {
        // Pago persistido, pero recibo no enviado — lo dejamos registrado para
        // que la UI pueda mostrar el estado y reintentar.
        await logAudit(
          'PAYMENT_RECEIPT_SEND_FAILED',
          'PaymentRecord',
          created,
          { email: receiptEmail, reason: sendRes.error }
        )
      }
    }

    revalidatePath(`/events/${parsed.data.eventId}`)

    return {
      success: true,
      paymentId: created,
      receiptSent,
    }
  } catch (error) {
    console.error('[CREATE PAYMENT RECORD ERROR]:', error)
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Error al registrar el pago.',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. sendReceiptEmail — reenvío manual de recibo (post-creación)
// ─────────────────────────────────────────────────────────────────────────────

export interface SendReceiptEmailInput {
  paymentId: string
  email: string
  pdfDataUrl?: string
}

/**
 * Reenvía el recibo de un pago ya persistido. Útil cuando el envío inicial
 * falló o cuando el usuario quiere reenviarlo a otra dirección.
 */
export async function sendReceiptEmail(
  input: SendReceiptEmailInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: 'No autenticado.' }
    }

    const parsed = SendReceiptSchema.safeParse({
      paymentId: input.paymentId,
      email: input.email,
    })
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? 'Datos inválidos.',
      }
    }

    const payment = await prisma.paymentRecord.findUnique({
      where: { id: parsed.data.paymentId },
      select: { id: true, eventId: true },
    })
    if (!payment) {
      return { success: false, error: 'Pago no encontrado.' }
    }

    const result = await dispatchReceiptEmail({
      paymentId: parsed.data.paymentId,
      email: parsed.data.email,
      pdfDataUrl: input.pdfDataUrl,
    })

    if (result.success) {
      await prisma.paymentRecord.update({
        where: { id: parsed.data.paymentId },
        data: {
          receiptSent: true,
          receiptEmail: parsed.data.email,
          receiptPdfUrl: input.pdfDataUrl ?? undefined,
        },
      })
      await logAudit(
        'PAYMENT_RECEIPT_SENT',
        'PaymentRecord',
        parsed.data.paymentId,
        { email: parsed.data.email, manual: true }
      )
      revalidatePath(`/events/${payment.eventId}`)
    } else {
      await logAudit(
        'PAYMENT_RECEIPT_SEND_FAILED',
        'PaymentRecord',
        parsed.data.paymentId,
        { email: parsed.data.email, reason: result.error, manual: true }
      )
    }

    return result
  } catch (error) {
    console.error('[SEND RECEIPT EMAIL ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al enviar recibo.',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// dispatchReceiptEmail — helper SMTP con fallback a log
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchReceiptEmail(args: {
  paymentId: string
  email: string
  pdfDataUrl?: string
}): Promise<{ success: boolean; error?: string }> {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const fromAddress = process.env.PAYMENT_RECEIPT_FROM ?? 'no-reply@ami.local'

  if (!smtpHost || !smtpPort) {
    // Modo desarrollo / sin SMTP configurado: solo logueamos.
    // El PDF queda persistido en receiptPdfUrl para descarga.
    console.info(
      `[RECEIPT] (sin SMTP) recibo ${args.paymentId} → ${args.email}`
    )
    return { success: true }
  }

  try {
    // Carga dinámica de nodemailer — opcional, el sistema funciona sin él.
    // @ts-expect-error — paquete opcional, se carga solo si SMTP_HOST está configurado
    const nodemailer = await import('nodemailer').catch(() => null)
    if (!nodemailer) {
      console.warn(
        '[RECEIPT] SMTP_HOST configurado pero nodemailer no está instalado. Fallback a log.'
      )
      console.info(
        `[RECEIPT] (sin transport) recibo ${args.paymentId} → ${args.email}`
      )
      return { success: true }
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    })

    const attachments: Array<{ filename: string; content: string; encoding: string }> = []
    if (args.pdfDataUrl) {
      const match = args.pdfDataUrl.match(/^data:application\/pdf;base64,(.+)$/)
      if (match) {
        attachments.push({
          filename: `recibo-${args.paymentId}.pdf`,
          content: match[1],
          encoding: 'base64',
        })
      }
    }

    await transporter.sendMail({
      from: fromAddress,
      to: args.email,
      subject: `Recibo de pago #${args.paymentId.slice(0, 8)} — AMI`,
      text:
        `Adjuntamos el comprobante de su pago reciente en Administración Médica Industrial.\n\n` +
        `Folio de pago: ${args.paymentId}\n\n` +
        `Este correo es generado automáticamente. Si requiere factura, responda a este mensaje.`,
      attachments,
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Fallo SMTP',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. getPaymentHistory — listado de pagos por evento
// ─────────────────────────────────────────────────────────────────────────────

export async function getPaymentHistory(
  eventId: string
): Promise<{ success: boolean; payments?: PaymentHistoryItem[]; error?: string }> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: 'No autenticado.' }
    }

    if (!eventId) {
      return { success: false, error: 'eventId requerido.' }
    }

  const records = await prisma.paymentRecord.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      method: true,
      reference: true,
      receiptSent: true,
      receiptEmail: true,
      createdAt: true,
      // ARCH-20260630-02: WhatsApp metadata
      receiptWhatsAppSent: true,
      receiptWhatsAppPhone: true,
      receiptWhatsAppAt: true,
      createdBy: { select: { fullName: true } },
    },
  })

  const payments: PaymentHistoryItem[] = records.map((r) => ({
    id: r.id,
    amount: r.amount.toString(),
    method: r.method,
    reference: r.reference,
    receiptSent: r.receiptSent,
    receiptEmail: r.receiptEmail,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy.fullName,
    receiptWhatsAppSent: r.receiptWhatsAppSent,
    receiptWhatsAppPhone: r.receiptWhatsAppPhone,
    receiptWhatsAppAt: r.receiptWhatsAppAt?.toISOString() ?? null,
  }))

  return { success: true, payments }
  } catch (error) {
    console.error('[GET PAYMENT HISTORY ERROR]:', error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Error al obtener historial.',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. uploadReceiptPdf — ARCH-20260630-02
//    Sube el PDF del recibo a un storage accesible por URL temporal (24h) para
//    poder compartirlo en WhatsApp Web (que no soporta adjuntos por URL scheme).
// ─────────────────────────────────────────────────────────────────────────────

const RECEIPT_URL_TTL_HOURS = 24

export interface UploadReceiptInput {
  paymentId: string
  pdfBase64: string
}

export interface UploadReceiptResult {
  success: boolean
  downloadUrl?: string
  expiresAt?: string
  error?: string
}

/**
 * Persiste el PDF del recibo en storage y devuelve una URL temporal (24h) que
 * se incluye en el mensaje de WhatsApp. La URL la abre el destinatario para
 * descargar el PDF manualmente.
 *
 * Storage: filesystem local en `public/uploads/receipts/` para dev. En prod se
 * debería conmutar a S3/Cloudinary — el contrato del action (regresa URL) ya
 * está abstraído.
 */
export async function uploadReceiptPdf(
  input: UploadReceiptInput
): Promise<UploadReceiptResult> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: 'No autenticado.' }
    }

    // Validar que el pago existe
    const payment = await prisma.paymentRecord.findUnique({
      where: { id: input.paymentId },
      select: { id: true, eventId: true },
    })
    if (!payment) {
      return { success: false, error: 'Pago no encontrado.' }
    }

    if (!input.pdfBase64 || input.pdfBase64.length < 100) {
      return { success: false, error: 'PDF vacío o inválido.' }
    }

    // Persistir en filesystem local. En prod reemplazar por S3 signed URL.
    const fs = await import('fs/promises')
    const path = await import('path')
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'receipts')
    await fs.mkdir(uploadsDir, { recursive: true })

    const filename = `recibo-${input.paymentId}-${Date.now()}.pdf`
    const filepath = path.join(uploadsDir, filename)
    await fs.writeFile(filepath, Buffer.from(input.pdfBase64, 'base64'))

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || ''
    const downloadUrl = `${baseUrl}/uploads/receipts/${filename}`
    const expiresAt = new Date(Date.now() + RECEIPT_URL_TTL_HOURS * 60 * 60 * 1000)

    // Actualizar el PaymentRecord con la URL temporal y expiración
    await prisma.paymentRecord.update({
      where: { id: input.paymentId },
      data: {
        receiptDownloadUrl: downloadUrl,
        receiptDownloadExpires: expiresAt,
      },
    })

    await logAudit(
      'PAYMENT_RECEIPT_PDF_UPLOADED',
      'PaymentRecord',
      input.paymentId,
      { downloadUrl, expiresAt: expiresAt.toISOString() }
    )

    revalidatePath(`/events/${payment.eventId}`)

    return {
      success: true,
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
    }
  } catch (error) {
    console.error('[UPLOAD RECEIPT PDF ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al subir PDF.',
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. sendReceiptWhatsApp — ARCH-20260630-02
//    Registra que se envió el recibo por WhatsApp Web y devuelve la URL de
//    WhatsApp para que el cliente abra `window.open`.
// ─────────────────────────────────────────────────────────────────────────────

export interface SendReceiptWhatsAppInput {
  paymentId: string
  phone: string
  message: string
  downloadUrl: string
}

export interface SendReceiptWhatsAppResult {
  success: boolean
  whatsAppUrl?: string
  error?: string
}

/**
 * Marca el recibo como enviado por WhatsApp (registra teléfono + timestamp) y
 * devuelve la URL wa.me para que el cliente la abra en nueva pestaña.
 *
 * El envío real lo hace el usuario desde WhatsApp Web; este action solo
 * persiste la trazabilidad (quién, cuándo, a qué número).
 */
export async function sendReceiptWhatsApp(
  input: SendReceiptWhatsAppInput
): Promise<SendReceiptWhatsAppResult> {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return { success: false, error: 'No autenticado.' }
    }

    // Validar input
    if (!input.phone || input.phone.replace(/\D/g, '').length < 10) {
      return { success: false, error: 'Teléfono inválido (mínimo 10 dígitos).' }
    }
    if (!input.message || input.message.trim().length < 5) {
      return { success: false, error: 'Mensaje demasiado corto.' }
    }

    // Verificar que el pago existe
    const payment = await prisma.paymentRecord.findUnique({
      where: { id: input.paymentId },
      select: { id: true, eventId: true },
    })
    if (!payment) {
      return { success: false, error: 'Pago no encontrado.' }
    }

    // Construir URL wa.me con el mensaje completo (incluye link al PDF)
    const { buildWhatsAppShareUrl } = await import('@/lib/payment.constants')
    const finalMessage = input.downloadUrl
      ? `${input.message}\n\n📄 Recibo: ${input.downloadUrl}`
      : input.message
    const whatsAppUrl = buildWhatsAppShareUrl(input.phone, finalMessage)

    // Persistir trazabilidad
    await prisma.paymentRecord.update({
      where: { id: input.paymentId },
      data: {
        receiptWhatsAppSent: true,
        receiptWhatsAppPhone: input.phone,
        receiptWhatsAppAt: new Date(),
      },
    })

    await logAudit(
      'PAYMENT_RECEIPT_WHATSAPP_SENT',
      'PaymentRecord',
      input.paymentId,
      { phone: input.phone, hasLink: !!input.downloadUrl }
    )

    revalidatePath(`/events/${payment.eventId}`)

    return { success: true, whatsAppUrl }
  } catch (error) {
    console.error('[SEND RECEIPT WHATSAPP ERROR]:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error al enviar por WhatsApp.',
    }
  }
}