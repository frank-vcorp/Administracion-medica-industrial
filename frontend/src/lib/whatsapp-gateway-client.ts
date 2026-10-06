type GatewayJson = {
  ok?: boolean
  error?: string
  status?: string
  linkedPhone?: string | null
  qrDataUrl?: string | null
  lastError?: string | null
}

function gatewayBase(): string {
  return (
    process.env.WHATSAPP_GATEWAY_URL?.trim() ||
    process.env.NEXT_PUBLIC_WHATSAPP_GATEWAY_URL?.trim() ||
    ''
  )
}

function gatewaySecret(): string {
  return process.env.WHATSAPP_GATEWAY_SECRET?.trim() || ''
}

export function isWhatsAppGatewayConfigured(): boolean {
  return Boolean(gatewayBase() && gatewaySecret())
}

export async function callWhatsAppGateway(args: {
  path: string
  method: 'GET' | 'POST'
  role: string
  userId: string
}): Promise<{ ok: boolean; data?: GatewayJson; error?: string }> {
  const base = gatewayBase()
  const secret = gatewaySecret()
  if (!base || !secret) {
    return {
      ok: false,
      error:
        'Gateway WhatsApp no configurado. Defina WHATSAPP_GATEWAY_URL y WHATSAPP_GATEWAY_SECRET en el servidor.',
    }
  }

  try {
    const res = await fetch(`${base.replace(/\/$/, '')}${args.path}`, {
      method: args.method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'x-ami-role': args.role,
        'x-ami-userid': args.userId,
      },
      cache: 'no-store',
    })
    const json = (await res.json().catch(() => ({}))) as GatewayJson
    if (!res.ok || json.ok === false) {
      return {
        ok: false,
        error: json.error ?? `Gateway respondió ${res.status}`,
      }
    }
    return { ok: true, data: json }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red con el gateway WhatsApp',
    }
  }
}
