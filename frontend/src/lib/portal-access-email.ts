/**
 * Envío de credenciales temporales del portal B2B (mismo canal SMTP que resultados/pagos).
 */

export async function sendPortalAccessCredentialsEmail(args: {
  to: string
  companyName: string
  loginEmail: string
  temporaryPassword: string
  loginUrl: string
}): Promise<{ success: boolean; error?: string; skipped?: boolean }> {
  const smtpHost = process.env.SMTP_HOST
  const smtpPort = process.env.SMTP_PORT
  const smtpUser = process.env.SMTP_USER
  const smtpPass = process.env.SMTP_PASS
  const fromAddress =
    process.env.PORTAL_ACCESS_EMAIL_FROM ??
    process.env.RESULTS_EMAIL_FROM ??
    process.env.PAYMENT_RECEIPT_FROM ??
    'no-reply@ami.local'

  if (!smtpHost || !smtpPort) {
    console.info(
      `[PORTAL_ACCESS] (sin SMTP) credenciales para ${args.loginEmail} @ ${args.companyName}`,
    )
    return { success: true, skipped: true }
  }

  try {
    const nodemailerPkg = 'nodemailer'
    const nodemailer = await import(/* webpackIgnore: true */ nodemailerPkg).catch(() => null)
    if (!nodemailer) {
      return { success: false, error: 'Servicio de correo no disponible.' }
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    })

    await transporter.sendMail({
      from: fromAddress,
      to: args.to,
      subject: `Acceso al portal cliente — ${args.companyName}`,
      text:
        `Administración Médica Industrial\n\n` +
        `Se habilitó el portal para ${args.companyName}.\n\n` +
        `URL de acceso: ${args.loginUrl}\n` +
        `Usuario: ${args.loginEmail}\n` +
        `Contraseña temporal: ${args.temporaryPassword}\n\n` +
        `En su primer ingreso deberá aceptar los términos y condiciones, ` +
        `el aviso de privacidad y definir una contraseña nueva.\n\n` +
        `No comparta estas credenciales fuera de su organización.`,
    })

    return { success: true }
  } catch (err) {
    console.error('[PORTAL_ACCESS] sendMail failed:', err)
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error al enviar correo',
    }
  }
}
